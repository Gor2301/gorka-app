import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import OwnerAppShell from '../components/OwnerAppShell';
import { getClient, updateClient, type Client } from '../services/api';

const EditClientPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState<Partial<Client>>({});

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
      setFormData({
        name: data.name,
        clientType: data.type,
        registrationNumber: data.registrationNumber,
        taxId: data.taxId,
        primaryContact: data.primaryContact,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone,
        address: data.address,
        website: data.website,
        billingEmail: data.billingEmail,
        billingPhone: data.billingPhone,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load client');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      await updateClient(id!, formData);
      setSuccess(true);
      setTimeout(() => {
        navigate(`/clients/${id}`);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update client');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <OwnerAppShell>
        <div style={{ padding: '24px' }}>Loading client data...</div>
      </OwnerAppShell>
    );
  }

  return (
    <OwnerAppShell>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
          <button
            onClick={() => navigate(`/clients/${id}`)}
            style={{
              padding: '8px 16px',
              border: '1px solid #E3E3E3',
              borderRadius: '6px',
              backgroundColor: 'white',
              cursor: 'pointer',
              fontSize: '14px',
              color: '#4A4A4A'
            }}
          >
            ← Back
          </button>
          <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#111111', margin: 0 }}>
            Edit Client
          </h2>
        </div>

        {error && (
          <div style={{
            padding: '12px 16px',
            backgroundColor: '#FEE2E2',
            color: '#DC2626',
            borderRadius: '6px',
            marginBottom: '16px'
          }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{
            padding: '12px 16px',
            backgroundColor: '#DCFCE7',
            color: '#16A34A',
            borderRadius: '6px',
            marginBottom: '16px'
          }}>
            ✅ Client updated successfully! Redirecting...
          </div>
        )}

        <form onSubmit={handleSubmit} style={{
          backgroundColor: 'white',
          border: '1px solid #E3E3E3',
          borderRadius: '8px',
          padding: '24px'
        }}>
          {/* Company Information */}
          <div style={{ borderBottom: '1px solid #F3F4F6', paddingBottom: '20px', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#111111', marginBottom: '16px' }}>
              Company Information
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '500', color: '#374151' }}>Company Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name || ''}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '6px',
                    fontSize: '14px',
                    marginTop: '4px'
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '500', color: '#374151' }}>Client Type</label>
                <select
                  name="clientType"
                  value={formData.clientType || 'AGENCY'}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '6px',
                    fontSize: '14px',
                    marginTop: '4px',
                    backgroundColor: 'white'
                  }}
                >
                  <option value="AGENCY">Collection Agency</option>
                  <option value="BANK">Bank</option>
                  <option value="LAW_FIRM">Law Firm</option>
                  <option value="FINANCE">Finance Company</option>
                  <option value="CORPORATE">Corporate</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '12px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '500', color: '#374151' }}>Registration Number</label>
                <input
                  type="text"
                  name="registrationNumber"
                  value={formData.registrationNumber || ''}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '6px',
                    fontSize: '14px',
                    marginTop: '4px'
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '500', color: '#374151' }}>Tax ID</label>
                <input
                  type="text"
                  name="taxId"
                  value={formData.taxId || ''}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '6px',
                    fontSize: '14px',
                    marginTop: '4px'
                  }}
                />
              </div>
            </div>

            <div style={{ marginTop: '12px' }}>
              <label style={{ fontSize: '13px', fontWeight: '500', color: '#374151' }}>Website</label>
              <input
                type="url"
                name="website"
                value={formData.website || ''}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: '1px solid #D1D5DB',
                  borderRadius: '6px',
                  fontSize: '14px',
                  marginTop: '4px'
                }}
              />
            </div>
          </div>

          {/* Contact Information */}
          <div style={{ borderBottom: '1px solid #F3F4F6', paddingBottom: '20px', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#111111', marginBottom: '16px' }}>
              Contact Information
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '500', color: '#374151' }}>Primary Contact</label>
                <input
                  type="text"
                  name="primaryContact"
                  value={formData.primaryContact || ''}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '6px',
                    fontSize: '14px',
                    marginTop: '4px'
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '500', color: '#374151' }}>Contact Email</label>
                <input
                  type="email"
                  name="contactEmail"
                  value={formData.contactEmail || ''}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '6px',
                    fontSize: '14px',
                    marginTop: '4px'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '12px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '500', color: '#374151' }}>Contact Phone</label>
                <input
                  type="tel"
                  name="contactPhone"
                  value={formData.contactPhone || ''}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '6px',
                    fontSize: '14px',
                    marginTop: '4px'
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '500', color: '#374151' }}>Address</label>
                <textarea
                  name="address"
                  value={formData.address || ''}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '6px',
                    fontSize: '14px',
                    marginTop: '4px',
                    resize: 'vertical',
                    minHeight: '50px'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '12px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '500', color: '#374151' }}>Billing Email</label>
                <input
                  type="email"
                  name="billingEmail"
                  value={formData.billingEmail || ''}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '6px',
                    fontSize: '14px',
                    marginTop: '4px'
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '500', color: '#374151' }}>Billing Phone</label>
                <input
                  type="tel"
                  name="billingPhone"
                  value={formData.billingPhone || ''}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '6px',
                    fontSize: '14px',
                    marginTop: '4px'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Submit */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: '10px 24px',
                backgroundColor: '#7C3AED',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                opacity: saving ? 0.6 : 1
              }}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={() => navigate(`/clients/${id}`)}
              style={{
                padding: '10px 24px',
                backgroundColor: 'white',
                color: '#4A4A4A',
                border: '1px solid #E3E3E3',
                borderRadius: '6px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </OwnerAppShell>
  );
};

export default EditClientPage;