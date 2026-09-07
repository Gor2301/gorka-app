import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import OwnerAppShell from '../components/OwnerAppShell';
import { getClient, verifyClient, suspendClient, rejectClient, reinstateClient, updateClient, type Client } from '../services/api';
import { 
  ArrowLeft, 
  CheckCircle, 
  XCircle, 
  Ban, 
  RefreshCw, 
  Edit, 
  FileText,
  Loader2 
} from 'lucide-react';

const ClientDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError('No client ID provided');
      setLoading(false);
      return;
    }
    loadClient();
  }, [id]);

  const loadClient = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getClient(id);
      setClient(data);
    } catch (err) {
      console.error('Error loading client:', err);
      setError(err instanceof Error ? err.message : 'Failed to load client');
    } finally {
      setLoading(false);
    }
  };

  // ========== ACTION HANDLERS ==========
  const handleVerify = async (id: string, notes: string) => {
    setActionLoading('verify');
    try {
      await verifyClient(id, notes);
      await loadClient();
      alert('✅ Client verified successfully!');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to verify client');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSuspend = async (id: string, reason: string) => {
    setActionLoading('suspend');
    try {
      await suspendClient(id, reason);
      await loadClient();
      alert('⛔ Client suspended successfully!');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to suspend client');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string, reason: string) => {
    setActionLoading('reject');
    try {
      await rejectClient(id, reason);
      await loadClient();
      alert('❌ Client rejected successfully!');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to reject client');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReinstate = async (id: string, notes: string) => {
    setActionLoading('reinstate');
    try {
      await reinstateClient(id, notes);
      await loadClient();
      alert('🔄 Client reinstated successfully!');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to reinstate client');
    } finally {
      setActionLoading(null);
    }
  };

  // ========== HELPERS ==========
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return { color: '#22C55E', bg: '#DCFCE7' };
      case 'PENDING_REVIEW': return { color: '#EAB308', bg: '#FEF9C3' };
      case 'PENDING_EMAIL': return { color: '#F97316', bg: '#FFEDD5' };
      case 'SUSPENDED': return { color: '#EF4444', bg: '#FEE2E2' };
      case 'REJECTED': return { color: '#9CA3AF', bg: '#F3F4F6' };
      default: return { color: '#6B7280', bg: '#F3F4F6' };
    }
  };

  const getTypeLabel = (type?: string) => {
    switch (type) {
      case 'AGENCY': return 'Collection Agency';
      case 'BANK': return 'Bank';
      case 'LAW_FIRM': return 'Law Firm';
      case 'FINANCE': return 'Finance Company';
      default: return type || 'Not specified';
    }
  };

  // ========== LOADING & ERROR STATES ==========
  if (loading) {
    return (
      <OwnerAppShell>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <div>Loading client details...</div>
        </div>
      </OwnerAppShell>
    );
  }

  if (error) {
    return (
      <OwnerAppShell>
        <div style={{ padding: '24px' }}>
          <div style={{ color: '#EF4444', marginBottom: '16px' }}>Error: {error}</div>
          <button
            onClick={loadClient}
            style={{
              padding: '8px 16px',
              border: '1px solid #E3E3E3',
              borderRadius: '6px',
              backgroundColor: 'white',
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
          <button
            onClick={() => navigate('/clients')}
            style={{
              padding: '8px 16px',
              marginLeft: '8px',
              border: '1px solid #E3E3E3',
              borderRadius: '6px',
              backgroundColor: 'white',
              cursor: 'pointer'
            }}
          >
            Back to Clients
          </button>
        </div>
      </OwnerAppShell>
    );
  }

  if (!client) {
    return (
      <OwnerAppShell>
        <div style={{ padding: '24px' }}>
          <h2>Client not found</h2>
          <button onClick={() => navigate('/clients')}>Back to Clients</button>
        </div>
      </OwnerAppShell>
    );
  }

  const statusColors = getStatusColor(client.verificationStatus || client.status || 'PENDING_EMAIL');

  return (
    <OwnerAppShell>
      <div>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
          <button
            onClick={() => navigate('/clients')}
            style={{
              padding: '8px 16px',
              border: '1px solid #E3E3E3',
              borderRadius: '6px',
              backgroundColor: 'white',
              cursor: 'pointer',
              fontSize: '14px',
              color: '#4A4A4A',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <ArrowLeft size={16} />
            Back
          </button>
          <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#111111', margin: 0 }}>
            Client Details
          </h2>
          <span style={{
            display: 'inline-block',
            padding: '4px 14px',
            borderRadius: '12px',
            fontSize: '13px',
            fontWeight: '500',
            backgroundColor: statusColors.bg,
            color: statusColors.color
          }}>
            {client.verificationStatus || client.status || 'PENDING_EMAIL'}
          </span>
        </div>

        {/* Client Identity Card */}
        <div style={{
          backgroundColor: 'white',
          border: '1px solid #E3E3E3',
          borderRadius: '8px',
          padding: '24px',
          marginBottom: '24px'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111111', marginBottom: '16px' }}>
                {client.name}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F3F4F6', padding: '6px 0' }}>
                  <span style={{ color: '#6B7280', fontSize: '13px' }}>Client Type</span>
                  <span style={{ fontSize: '13px', fontWeight: '500' }}>{getTypeLabel(client.type)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F3F4F6', padding: '6px 0' }}>
                  <span style={{ color: '#6B7280', fontSize: '13px' }}>Registration #</span>
                  <span style={{ fontSize: '13px' }}>{client.registrationNumber || 'Not set'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F3F4F6', padding: '6px 0' }}>
                  <span style={{ color: '#6B7280', fontSize: '13px' }}>Tax ID</span>
                  <span style={{ fontSize: '13px' }}>{client.taxId || 'Not set'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F3F4F6', padding: '6px 0' }}>
                  <span style={{ color: '#6B7280', fontSize: '13px' }}>Plan</span>
                  <span style={{ fontSize: '13px', fontWeight: '500', color: '#7C3AED' }}>{client.plan || 'STARTER'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F3F4F6', padding: '6px 0' }}>
                  <span style={{ color: '#6B7280', fontSize: '13px' }}>Joined</span>
                  <span style={{ fontSize: '13px' }}>{client.joinedDate ? new Date(client.joinedDate).toLocaleDateString() : 'Not set'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                  <span style={{ color: '#6B7280', fontSize: '13px' }}>Website</span>
                  <span style={{ fontSize: '13px' }}>{client.website || 'Not set'}</span>
                </div>
              </div>
            </div>

            <div>
              <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#111111', marginBottom: '12px' }}>
                Primary Contact
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F3F4F6', padding: '6px 0' }}>
                  <span style={{ color: '#6B7280', fontSize: '13px' }}>Name</span>
                  <span style={{ fontSize: '13px', fontWeight: '500' }}>{client.primaryContact || 'Not set'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F3F4F6', padding: '6px 0' }}>
                  <span style={{ color: '#6B7280', fontSize: '13px' }}>Email</span>
                  <span style={{ fontSize: '13px' }}>{client.contactEmail || 'Not set'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F3F4F6', padding: '6px 0' }}>
                  <span style={{ color: '#6B7280', fontSize: '13px' }}>Phone</span>
                  <span style={{ fontSize: '13px' }}>{client.contactPhone || 'Not set'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                  <span style={{ color: '#6B7280', fontSize: '13px' }}>Address</span>
                  <span style={{ fontSize: '13px', textAlign: 'right', maxWidth: '200px' }}>{client.address || 'Not set'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                  <span style={{ color: '#6B7280', fontSize: '13px' }}>Billing Email</span>
                  <span style={{ fontSize: '13px' }}>{client.billingEmail || 'Not set'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 5 Metrics Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '24px' }}>
          <div style={{ backgroundColor: 'white', border: '1px solid #E3E3E3', borderRadius: '8px', padding: '16px' }}>
            <div style={{ fontSize: '12px', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Debtors</div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#111111', marginTop: '4px' }}>{(client.totalDebtors || 0).toLocaleString()}</div>
          </div>
          <div style={{ backgroundColor: 'white', border: '1px solid #E3E3E3', borderRadius: '8px', padding: '16px' }}>
            <div style={{ fontSize: '12px', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Debt</div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#111111', marginTop: '4px' }}>${(client.totalDebt || 0).toLocaleString()}</div>
          </div>
          <div style={{ backgroundColor: 'white', border: '1px solid #E3E3E3', borderRadius: '8px', padding: '16px' }}>
            <div style={{ fontSize: '12px', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Agents</div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#111111', marginTop: '4px' }}>{client.activeAgents || 0} / {client.totalAgents || 0}</div>
            <div style={{ fontSize: '11px', color: '#6B7280' }}>Active / Total</div>
          </div>
          <div style={{ backgroundColor: 'white', border: '1px solid #E3E3E3', borderRadius: '8px', padding: '16px' }}>
            <div style={{ fontSize: '12px', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Monthly Revenue</div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#111111', marginTop: '4px' }}>${(client.monthlyRevenue || 0).toLocaleString()}</div>
          </div>
          <div style={{ backgroundColor: 'white', border: '1px solid #E3E3E3', borderRadius: '8px', padding: '16px' }}>
            <div style={{ fontSize: '12px', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Recovery Rate</div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#111111', marginTop: '4px' }}>{client.recoveryRate || 0}%</div>
          </div>
        </div>

        {/* Sync Status */}
        <div style={{
          backgroundColor: 'white',
          border: '1px solid #E3E3E3',
          borderRadius: '8px',
          padding: '16px 24px',
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: client.syncStatus === 'ONLINE' ? '#22C55E' :
                              client.syncStatus === 'OFFLINE' ? '#F97316' : '#EF4444'
            }} />
            <span style={{ fontSize: '14px', fontWeight: '500' }}>Sync Status: {client.syncStatus || 'UNKNOWN'}</span>
            <span style={{ fontSize: '13px', color: '#6B7280' }}>Last sync: {client.lastSync ? new Date(client.lastSync).toLocaleString() : 'Never'}</span>
          </div>
          <span style={{ fontSize: '13px', color: '#6B7280' }}>Last active: {client.lastActive ? new Date(client.lastActive).toLocaleString() : 'Unknown'}</span>
        </div>

        {/* Usage Section */}
        <div style={{
          backgroundColor: 'white',
          border: '1px solid #E3E3E3',
          borderRadius: '8px',
          padding: '24px',
          marginBottom: '24px'
        }}>
          <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#111111', marginBottom: '16px' }}>Usage Overview</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            <div>
              <div style={{ fontSize: '12px', color: '#6B7280' }}>AI Calls</div>
              <div style={{ fontSize: '18px', fontWeight: '600', color: '#111111' }}>{client.aiCalls?.toLocaleString() || 0}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#6B7280' }}>Emails Sent</div>
              <div style={{ fontSize: '18px', fontWeight: '600', color: '#111111' }}>{client.emailsSent?.toLocaleString() || 0}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#6B7280' }}>SMS Sent</div>
              <div style={{ fontSize: '18px', fontWeight: '600', color: '#111111' }}>{client.smsSent?.toLocaleString() || 0}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#6B7280' }}>Total Revenue</div>
              <div style={{ fontSize: '18px', fontWeight: '600', color: '#111111' }}>${(client.totalRevenue || 0).toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* ========== ACTIONS SECTION ========== */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '24px', flexWrap: 'wrap' }}>
          {/* Verify - Only for PENDING_REVIEW */}
          {client.verificationStatus === 'PENDING_REVIEW' && (
            <button
              onClick={() => {
                const notes = window.prompt('Verification notes (optional):');
                if (notes !== null) handleVerify(client.id, notes || '');
              }}
              disabled={actionLoading === 'verify'}
              style={{
                padding: '8px 20px',
                backgroundColor: '#22C55E',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {actionLoading === 'verify' ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <CheckCircle size={16} />
              )}
              {actionLoading === 'verify' ? 'Loading...' : 'Verify'}
            </button>
          )}

          {/* Reject - Only for non-ACTIVE, non-REJECTED */}
          {client.verificationStatus !== 'ACTIVE' && client.verificationStatus !== 'REJECTED' && (
            <button
              onClick={() => {
                const reason = window.prompt('Rejection reason:');
                if (reason) handleReject(client.id, reason);
              }}
              disabled={actionLoading === 'reject'}
              style={{
                padding: '8px 20px',
                backgroundColor: '#EF4444',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {actionLoading === 'reject' ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <XCircle size={16} />
              )}
              {actionLoading === 'reject' ? 'Loading...' : 'Reject'}
            </button>
          )}

          {/* Suspend - Only for ACTIVE */}
          {client.verificationStatus === 'ACTIVE' && (
            <button
              onClick={() => {
                const reason = window.prompt('Suspension reason:');
                if (reason) handleSuspend(client.id, reason);
              }}
              disabled={actionLoading === 'suspend'}
              style={{
                padding: '8px 20px',
                backgroundColor: '#F97316',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {actionLoading === 'suspend' ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Ban size={16} />
              )}
              {actionLoading === 'suspend' ? 'Loading...' : 'Suspend'}
            </button>
          )}

          {/* Reinstate - Only for SUSPENDED */}
          {client.verificationStatus === 'SUSPENDED' && (
            <button
              onClick={() => {
                const notes = window.prompt('Reinstate notes (optional):');
                if (notes !== null) handleReinstate(client.id, notes || '');
              }}
              disabled={actionLoading === 'reinstate'}
              style={{
                padding: '8px 20px',
                backgroundColor: '#2563EB',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {actionLoading === 'reinstate' ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <RefreshCw size={16} />
              )}
              {actionLoading === 'reinstate' ? 'Loading...' : 'Reinstate'}
            </button>
          )}

          {/* Edit - Always visible */}
          <button
            onClick={() => navigate(`/clients/${client.id}/edit`)}
            style={{
              padding: '8px 20px',
              backgroundColor: 'white',
              color: '#4A4A4A',
              border: '1px solid #E3E3E3',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Edit size={16} />
            Edit
          </button>

          {/* View Audit */}
          <button
            onClick={() => navigate(`/audit?client=${client.id}`)}
            style={{
              padding: '8px 20px',
              backgroundColor: 'white',
              color: '#4A4A4A',
              border: '1px solid #E3E3E3',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <FileText size={16} />
            View Audit
          </button>
        </div>
      </div>
    </OwnerAppShell>
  );
};

export default ClientDetailPage;