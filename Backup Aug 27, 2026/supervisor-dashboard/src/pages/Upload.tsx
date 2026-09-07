import React, { useState, useRef } from 'react';
import { uploadService } from '../services/upload.service';

const Upload: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [uploadType, setUploadType] = useState<'structured' | 'unstructured'>('structured');
  const [dataType, setDataType] = useState('csv');
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // All supported formats with descriptions
  const structuredFormats = [
    { name: 'CSV', icon: '📊', description: 'Comma-separated values' },
    { name: 'Excel', icon: '📈', description: '.xlsx, .xls files' },
    { name: 'JSON', icon: '🔢', description: 'JSON array of debtor objects' },
    { name: 'XML', icon: '📋', description: 'XML structured data' },
  ];

  const unstructuredFormats = [
    { name: 'PDF', icon: '📕', description: 'Extract data from PDF invoices' },
    { name: 'Images', icon: '🖼️', description: 'JPG, PNG, TIFF with OCR' },
    { name: 'Text', icon: '📝', description: '.txt, .log files' },
    { name: 'Email', icon: '✉️', description: '.eml, .msg files' },
  ];

  const currentFormats = uploadType === 'structured' ? structuredFormats : unstructuredFormats;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setMessage('');
      setError('');
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setMessage('');
      setError('');
    }
  };

  const handleBrowseClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    const token = localStorage.getItem('supervisor_token');
    if (!token) {
      setError('Please login first');
      return;
    }

    setUploading(true);
    setMessage('');
    setError('');

    try {
      let response;
      if (uploadType === 'structured') {
        response = await uploadService.uploadStructuredData(token, file, dataType);
      } else {
        response = await uploadService.uploadUnstructuredData(token, file, 'document');
      }

      if (response.success) {
        setMessage(`✅ ${response.message} (${response.count || 0} records processed)`);
        setFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        setError(response.message || 'Upload failed');
        // ✅ FIX: Safe error handling with proper type checking
        const errorMessages = response.errors;
        if (errorMessages && Array.isArray(errorMessages) && errorMessages.length > 0) {
          setError(prev => prev + '\n' + errorMessages.slice(0, 3).join('\n'));
        }
      }
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const getFileIcon = () => {
    if (!file) return '📄';
    const ext = file.name.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'csv': return '📊';
      case 'xlsx': case 'xls': return '📈';
      case 'json': return '🔢';
      case 'xml': return '📋';
      case 'pdf': return '📕';
      case 'jpg': case 'jpeg': case 'png': return '🖼️';
      case 'txt': return '📝';
      case 'eml': return '✉️';
      default: return '📄';
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: '28px', fontWeight: 500, color: '#111111', marginBottom: '8px' }}>
        Data Upload
      </h1>
      <p style={{ fontSize: '16px', color: '#4A4A4A', marginBottom: '32px' }}>
        Upload debtor data in structured or unstructured formats
      </p>

      {/* Two main options */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '24px',
        marginBottom: '32px'
      }}>
        {/* Structured Data Card */}
        <div
          onClick={() => setUploadType('structured')}
          style={{
            background: uploadType === 'structured' ? '#F4F0FF' : '#FFFFFF',
            border: uploadType === 'structured' ? '2px solid #7C3AED' : '1px solid #E3E3E3',
            borderRadius: '8px',
            padding: '24px',
            cursor: 'pointer',
            transition: 'all 150ms ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <span style={{ fontSize: '24px' }}>📊</span>
            <h2 style={{
              fontSize: '18px',
              fontWeight: 600,
              color: uploadType === 'structured' ? '#7C3AED' : '#272727',
              margin: 0
            }}>
              Structured Data
            </h2>
          </div>
          <p style={{ fontSize: '14px', color: '#4A4A4A', margin: 0 }}>
            Upload data in predefined formats
          </p>
          <div style={{ marginTop: '12px', fontSize: '13px', color: '#8A8A8A' }}>
            Supported: CSV, Excel, JSON, XML
          </div>
        </div>

        {/* Unstructured Data Card */}
        <div
          onClick={() => setUploadType('unstructured')}
          style={{
            background: uploadType === 'unstructured' ? '#F4F0FF' : '#FFFFFF',
            border: uploadType === 'unstructured' ? '2px solid #7C3AED' : '1px solid #E3E3E3',
            borderRadius: '8px',
            padding: '24px',
            cursor: 'pointer',
            transition: 'all 150ms ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <span style={{ fontSize: '24px' }}>📄</span>
            <h2 style={{
              fontSize: '18px',
              fontWeight: 600,
              color: uploadType === 'unstructured' ? '#7C3AED' : '#272727',
              margin: 0
            }}>
              Unstructured Data
            </h2>
          </div>
          <p style={{ fontSize: '14px', color: '#4A4A4A', margin: 0 }}>
            Upload and extract data from documents
          </p>
          <div style={{ marginTop: '12px', fontSize: '13px', color: '#8A8A8A' }}>
            Supported: PDF, Images, Text, Email
          </div>
        </div>
      </div>

      {/* Upload Area */}
      <div
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        style={{
          border: '2px dashed #E3E3E3',
          borderRadius: '12px',
          padding: '40px',
          textAlign: 'center',
          background: '#FAFAFA',
          marginBottom: '24px'
        }}
      >
        <div style={{ fontSize: '48px', marginBottom: '12px' }}>
          {file ? getFileIcon() : '📤'}
        </div>
        <p style={{ fontSize: '16px', color: '#4A4A4A', marginBottom: '8px' }}>
          {file ? file.name : 'Drag and drop your file here, or click to browse'}
        </p>
        <p style={{ fontSize: '13px', color: '#8A8A8A', marginBottom: '16px' }}>
          {uploadType === 'structured' 
            ? 'Supported: CSV, Excel, JSON, XML'
            : 'Supported: PDF, Images, Text, Email'}
        </p>
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileChange}
          style={{ display: 'none' }}
          accept={uploadType === 'structured' 
            ? '.csv,.xlsx,.xls,.json,.xml'
            : '.pdf,.jpg,.jpeg,.png,.txt,.eml'}
        />
        <button
          onClick={handleBrowseClick}
          style={{
            padding: '10px 24px',
            background: '#7C3AED',
            color: 'white',
            borderRadius: '6px',
            cursor: 'pointer',
            border: 'none',
            fontSize: '14px'
          }}
        >
          Browse Files
        </button>
      </div>

      {/* File Info */}
      {file && (
        <div style={{
          background: '#F4F0FF',
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <strong>{file.name}</strong>
            <span style={{ color: '#8A8A8A', marginLeft: '8px' }}>
              ({(file.size / 1024).toFixed(1)} KB)
            </span>
          </div>
          <button
            onClick={() => {
              setFile(null);
              if (fileInputRef.current) {
                fileInputRef.current.value = '';
              }
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#DC2626',
              cursor: 'pointer'
            }}
          >
            ✕ Remove
          </button>
        </div>
      )}

      {/* Upload Options */}
      {uploadType === 'structured' && file && (
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>
            Data Type
          </label>
          <select
            value={dataType}
            onChange={(e) => setDataType(e.target.value)}
            style={{
              padding: '8px 12px',
              border: '1px solid #E3E3E3',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          >
            <option value="csv">CSV</option>
            <option value="json">JSON</option>
          </select>
        </div>
      )}

      {/* Message / Error */}
      {message && (
        <div style={{
          background: '#E8F5E9',
          color: '#2E7D32',
          padding: '12px',
          borderRadius: '6px',
          marginBottom: '16px',
          whiteSpace: 'pre-wrap'
        }}>
          {message}
        </div>
      )}
      {error && (
        <div style={{
          background: '#FFEBEE',
          color: '#C62828',
          padding: '12px',
          borderRadius: '6px',
          marginBottom: '16px',
          whiteSpace: 'pre-wrap'
        }}>
          ❌ {error}
        </div>
      )}

      {/* Upload Button */}
      <button
        onClick={handleUpload}
        disabled={!file || uploading}
        style={{
          padding: '12px 32px',
          background: file && !uploading ? '#7C3AED' : '#E3E3E3',
          color: file && !uploading ? 'white' : '#8A8A8A',
          border: 'none',
          borderRadius: '6px',
          fontSize: '16px',
          fontWeight: '600',
          cursor: file && !uploading ? 'pointer' : 'default'
        }}
      >
        {uploading ? 'Uploading...' : 'Upload File'}
      </button>

      {/* Supported Formats - Full List with Descriptions */}
      <div style={{ marginTop: '32px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 500, marginBottom: '12px' }}>
          Supported {uploadType === 'structured' ? 'Structured' : 'Unstructured'} Formats
        </h3>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px'
        }}>
          {currentFormats.map((format) => (
            <div key={format.name} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '14px 18px',
              background: '#FAFAFA',
              borderRadius: '8px',
              border: '1px solid #E3E3E3'
            }}>
              <span style={{ fontSize: '24px' }}>{format.icon}</span>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#272727' }}>
                  {format.name}
                </div>
                <div style={{ fontSize: '12px', color: '#8A8A8A' }}>
                  {format.description}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Upload;