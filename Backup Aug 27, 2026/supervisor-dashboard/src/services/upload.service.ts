const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000/api';

export interface UploadResponse {
  success: boolean;
  message: string;
  count?: number;
  errors?: string[];
}

export const uploadService = {
  async uploadStructuredData(token: string, file: File, dataType: string): Promise<UploadResponse> {
    const text = await file.text();
    const debtors: any[] = [];

    if (dataType === 'csv' || file.name.endsWith('.csv')) {
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        return {
          success: false,
          message: 'CSV file must have at least a header row and one data row',
          errors: ['File appears empty or invalid']
        };
      }

      const firstLine = lines[0];
      let delimiter = ',';
      if (firstLine.includes('\t')) delimiter = '\t';
      else if (firstLine.includes(';')) delimiter = ';';

      const headers = firstLine.split(delimiter).map(h => h.trim());
      console.log('📋 Headers:', headers);
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(delimiter).map(v => v.trim());
        const row: any = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || null;
        });

        // Extract name from various formats
        let name = row['Name'] || row['name'] || '';
        if (!name) {
          const firstName = row['First Name'] || row['First'] || row['first_name'] || row['firstName'] || '';
          const lastName = row['Last Name'] || row['Last'] || row['last_name'] || row['lastName'] || '';
          name = `${firstName} ${lastName}`.trim();
        }
        
        if (!name || name.trim() === '') {
          console.log(`Row ${i}: Skipping - no name`);
          continue;
        }

        // Extract total debt from various formats
        let totalDebt = 0;
        const debtValue = row['Total Debt'] || row['total_debt'] || row['Debt'] || row['debt'] || row['Total'] || row['total'] || '0';
        if (typeof debtValue === 'string') {
          totalDebt = parseFloat(debtValue.replace(/[$,]/g, '')) || 0;
        } else if (typeof debtValue === 'number') {
          totalDebt = debtValue;
        }

        debtors.push({
          name: name.trim(),
          email: row['Email'] || row['email'] || null,
          phone: row['Phone'] || row['phone'] || null,
          address: row['Address'] || row['address'] || null,
          totalDebt: totalDebt,
          status: 'ACTIVE'
        });
      }
    } else {
      return {
        success: false,
        message: 'Only CSV files are supported currently',
        errors: ['JSON, Excel, and XML support coming soon']
      };
    }

    console.log(`✅ Parsed ${debtors.length} debtors`);

    if (debtors.length === 0) {
      return {
        success: false,
        message: 'No valid debtors found in file',
        errors: ['Make sure the CSV has "Name" or "First Name" and "Last Name" columns']
      };
    }

    // Test the first debtor
    console.log('📤 First debtor:', JSON.stringify(debtors[0], null, 2));

    // Send to backend
    try {
      const response = await fetch(`${API_URL}/debtors/bulk`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ debtors })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Backend error:', errorText);
        throw new Error(`Upload failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      return {
        success: result.success,
        message: result.message || `Created ${result.data?.successCount || 0} debtors`,
        count: result.data?.successCount || 0,
        errors: result.data?.errors || []
      };
    } catch (err: any) {
      console.error('❌ Upload error:', err);
      return {
        success: false,
        message: err.message || 'Upload failed',
        errors: [err.message]
      };
    }
  },

  async uploadUnstructuredData(token: string, file: File, documentType: string): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', documentType);

    const response = await fetch(`${API_URL}/documents/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Upload failed');
    }

    return response.json();
  }
};