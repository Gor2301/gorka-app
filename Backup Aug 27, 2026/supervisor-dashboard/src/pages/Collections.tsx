import React, { useState, useEffect } from 'react';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';

interface Debtor {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  createdAt: string;
  riskScore: number;
  totalDebt?: number;
}

const Collections: React.FC = () => {
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 20;

  useEffect(() => {
    fetchDebtors();
  }, [page]);

  const fetchDebtors = async () => {
    const token = localStorage.getItem('supervisor_token');
    console.log('🔑 Token from localStorage:', token);
    
    if (!token) {
      setError('Please login first');
      setLoading(false);
      return;
    }

    try {
      const url = new URL('http://127.0.0.1:3000/api/debtors');
      url.searchParams.append('page', page.toString());
      url.searchParams.append('limit', limit.toString());
      if (search) {
        url.searchParams.append('search', search);
      }

      console.log('📡 Fetching from:', url.toString());

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      console.log('📡 Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Error response:', errorText);
        throw new Error(`Failed to fetch debtors: ${response.status}`);
      }

      const data = await response.json();
      console.log('📡 Debtors data:', data);

      if (data.success) {
        setDebtors(data.data || []);
        setTotal(data.pagination?.total || 0);
        setTotalPages(data.pagination?.totalPages || 1);
      } else {
        setError(data.error || 'Failed to fetch debtors');
      }
    } catch (err: any) {
      console.error('❌ Error fetching debtors:', err);
      setError(err.message || 'Failed to fetch debtors');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchDebtors();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return '#10B981';
      case 'PENDING': return '#F59E0B';
      case 'DELETED': return '#EF4444';
      default: return '#8A8A8A';
    }
  };

  const totalDebtSum = debtors.reduce((sum, d) => sum + (d.totalDebt || 0), 0);

  if (loading) {
    return (
      <div>
        <h1 style={{ fontSize: '28px', fontWeight: 500, color: '#111111', marginBottom: '8px' }}>
          Collections
        </h1>
        <p style={{ fontSize: '16px', color: '#4A4A4A' }}>Loading debtors...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1 style={{ fontSize: '28px', fontWeight: 500, color: '#111111', marginBottom: '8px' }}>
          Collections
        </h1>
        <p style={{ fontSize: '16px', color: '#EF4444' }}>Error: {error}</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 500, color: '#111111', marginBottom: '0' }}>
          Collections
        </h1>
        <span style={{ fontSize: '14px', color: '#8A8A8A', background: '#F5F5F5', padding: '4px 12px', borderRadius: '20px' }}>
          Total: {total}
        </span>
      </div>
      <p style={{ fontSize: '16px', color: '#4A4A4A', marginBottom: '24px' }}>
        Manage all debtors in your organization
      </p>

      {/* Search Bar */}
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#8A8A8A' }} />
          <input
            type="text"
            placeholder="Search by name, email, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px 10px 36px',
              border: '1px solid #E3E3E3',
              borderRadius: '6px',
              fontSize: '14px',
              outline: 'none'
            }}
          />
        </div>
        <button
          type="submit"
          style={{
            padding: '10px 24px',
            background: '#7C3AED',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          Search
        </button>
        <button
          type="button"
          onClick={() => {
            setSearch('');
            setPage(1);
            fetchDebtors();
          }}
          style={{
            padding: '10px 16px',
            background: '#F5F5F5',
            color: '#4A4A4A',
            border: '1px solid #E3E3E3',
            borderRadius: '6px',
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          Clear
        </button>
      </form>

      {/* Table */}
      <div style={{
        background: '#FFFFFF',
        border: '1px solid #E3E3E3',
        borderRadius: '8px',
        overflow: 'hidden'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#FAFAFA', borderBottom: '1px solid #E3E3E3' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: '#4A4A4A' }}>Name</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: '#4A4A4A' }}>Email</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: '#4A4A4A' }}>Phone</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: '#4A4A4A' }}>Status</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '13px', fontWeight: 600, color: '#4A4A4A' }}>Total Debt</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: '#4A4A4A' }}>Created</th>
            </tr>
          </thead>
          <tbody>
            {debtors.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#8A8A8A' }}>
                  No debtors found
                </td>
              </tr>
            ) : (
              debtors.map((debtor) => (
                <tr key={debtor.id} style={{ borderBottom: '1px solid #F0F0F0' }}>
                  <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 500, color: '#111111' }}>
                    {debtor.name}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '14px', color: '#4A4A4A' }}>
                    <a href={`mailto:${debtor.email}`} style={{ color: '#7C3AED', textDecoration: 'none' }}>
                      {debtor.email}
                    </a>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '14px', color: '#4A4A4A' }}>
                    {debtor.phone}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 10px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 500,
                      background: getStatusColor(debtor.status) + '20',
                      color: getStatusColor(debtor.status)
                    }}>
                      {debtor.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '14px', color: '#4A4A4A', textAlign: 'right' }}>
                    ${(debtor.totalDebt || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: '#8A8A8A' }}>
                    {new Date(debtor.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Summary Row */}
        {debtors.length > 0 && (
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            padding: '16px 24px',
            background: '#F8F8F8',
            borderTop: '2px solid #E3E3E3',
            fontWeight: 600,
            fontSize: '15px',
            gap: '32px'
          }}>
            <span>Total Debtors: <span style={{ color: '#7C3AED' }}>{debtors.length}</span></span>
            <span>Total Debt: <span style={{ color: '#7C3AED' }}>
              ${totalDebtSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span></span>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px' }}>
          <span style={{ fontSize: '14px', color: '#8A8A8A' }}>
            Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, total)} of {total}
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              style={{
                padding: '8px 12px',
                border: '1px solid #E3E3E3',
                borderRadius: '6px',
                background: 'white',
                cursor: page === 1 ? 'default' : 'pointer',
                opacity: page === 1 ? 0.5 : 1
              }}
            >
              <ChevronLeft size={16} />
            </button>
            <span style={{ padding: '8px 12px', fontSize: '14px', color: '#4A4A4A' }}>
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page === totalPages}
              style={{
                padding: '8px 12px',
                border: '1px solid #E3E3E3',
                borderRadius: '6px',
                background: 'white',
                cursor: page === totalPages ? 'default' : 'pointer',
                opacity: page === totalPages ? 0.5 : 1
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Collections;