import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  UserCheck, 
  UserX, 
  Phone, 
  Calendar,
  Shield,
  UserCog,
  Mail,
  X,
  Save
} from 'lucide-react';
import { api } from '../services/api.service';

interface Agent {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
  organizationId: string;
}

const Agents: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
  });

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      setLoading(true);
      const response = await api.get('/users?role=AGENT');
      
      if (response && response.data) {
        const agentsData = Array.isArray(response.data) ? response.data : [];
        setAgents(agentsData);
      } else {
        setAgents([]);
      }
    } catch (error) {
      console.error('Error fetching agents:', error);
      setAgents([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredAgents = agents.filter(agent =>
    agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agent.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleToggleStatus = async (agent: Agent) => {
    try {
      const newStatus = !agent.isActive;
      const response = await api.put(`/users/${agent.id}`, {
        isActive: newStatus
      });
      
      if (response && response.success !== false) {
        setAgents(prev => prev.map(a => 
          a.id === agent.id ? { ...a, isActive: newStatus } : a
        ));
      }
    } catch (error) {
      console.error('Error updating agent status:', error);
      alert('Failed to update agent status');
    }
  };

  const handleDeleteAgent = async (agentId: string) => {
    if (!window.confirm('Are you sure you want to delete this agent?')) return;
    
    try {
      await api.delete(`/users/${agentId}`);
      setAgents(prev => prev.filter(a => a.id !== agentId));
    } catch (error) {
      console.error('Error deleting agent:', error);
      alert('Failed to delete agent');
    }
  };

  const handleAddAgent = async () => {
    try {
      // Validate form
      if (!formData.name.trim()) {
        alert('Name is required');
        return;
      }
      if (!formData.email.trim()) {
        alert('Email is required');
        return;
      }
      if (!formData.password.trim()) {
        alert('Password is required');
        return;
      }

      const response = await api.post('/users', {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        phone: formData.phone || null,
        role: 'AGENT',
        isActive: true
      });

      if (response && response.success !== false) {
        setShowAddModal(false);
        setFormData({ name: '', email: '', password: '', phone: '' });
        await fetchAgents();
      }
    } catch (error: any) {
      console.error('Error creating agent:', error);
      alert(error.message || 'Failed to create agent');
    }
  };

  const handleEditAgent = async () => {
    if (!editingAgent) return;
    
    try {
      if (!formData.name.trim()) {
        alert('Name is required');
        return;
      }
      if (!formData.email.trim()) {
        alert('Email is required');
        return;
      }

      const response = await api.put(`/users/${editingAgent.id}`, {
        name: formData.name,
        email: formData.email,
        phone: formData.phone || null,
        isActive: editingAgent.isActive
      });

      if (response && response.success !== false) {
        setEditingAgent(null);
        setFormData({ name: '', email: '', password: '', phone: '' });
        await fetchAgents();
      }
    } catch (error: any) {
      console.error('Error updating agent:', error);
      alert(error.message || 'Failed to update agent');
    }
  };

  const openEditModal = (agent: Agent) => {
    setEditingAgent(agent);
    setFormData({
      name: agent.name,
      email: agent.email,
      password: '',
      phone: agent.phone || '',
    });
  };

  const modalStyle = {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  };

  const modalContentStyle = {
    background: 'white',
    borderRadius: '16px',
    padding: '32px',
    width: '100%',
    maxWidth: '480px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  };

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    outline: 'none',
    transition: 'all 0.2s ease',
    marginTop: '4px',
  };

  const cardStyle = {
    background: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '20px',
    transition: 'all 0.2s ease',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  };

  const buttonStyle = {
    padding: '6px',
    background: 'none',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            display: 'inline-block',
            width: '40px',
            height: '40px',
            border: '3px solid #f3f4f6',
            borderTop: '3px solid #7C3AED',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <p style={{ color: '#6b7280', marginTop: '16px' }}>Loading agents...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#111827', margin: 0 }}>Agents</h1>
          <p style={{ color: '#6b7280', marginTop: '4px', fontSize: '14px' }}>Manage your collection agents and their permissions</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            background: '#7C3AED',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#6d28d9';
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(124,58,237,0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#7C3AED';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <Plus size={18} />
          Add Agent
        </button>
      </div>

      {/* Search Bar */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ position: 'relative' }}>
          <Search style={{ 
            position: 'absolute', 
            left: '12px', 
            top: '50%', 
            transform: 'translateY(-50%)', 
            color: '#9ca3af' 
          }} size={18} />
          <input
            type="text"
            placeholder="Search agents by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px 10px 40px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '14px',
              outline: 'none',
              transition: 'all 0.2s ease',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#7C3AED';
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(124,58,237,0.1)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#d1d5db';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
        </div>
      </div>

      {/* Agents Grid */}
      {Array.isArray(filteredAgents) && filteredAgents.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '48px 24px', 
          background: '#f9fafb', 
          borderRadius: '12px',
          border: '1px dashed #d1d5db'
        }}>
          <UserCog size={48} style={{ margin: '0 auto 12px', color: '#9ca3af' }} />
          <p style={{ color: '#6b7280', fontSize: '16px' }}>No agents found</p>
          <p style={{ color: '#9ca3af', fontSize: '14px', marginTop: '4px' }}>Click "Add Agent" to create your first agent</p>
        </div>
      ) : (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
          gap: '16px' 
        }}>
          {Array.isArray(filteredAgents) && filteredAgents.map((agent) => (
            <div
              key={agent.id}
              style={cardStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 10px 25px rgba(0,0,0,0.08)';
                e.currentTarget.style.borderColor = '#7C3AED';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
                e.currentTarget.style.borderColor = '#e5e7eb';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    background: '#f3e8ff',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    color: '#7C3AED'
                  }}>
                    {agent.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#111827', margin: 0 }}>
                      {agent.name}
                    </h3>
                    <p style={{ fontSize: '13px', color: '#6b7280', margin: '2px 0 0 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Mail size={14} />
                      {agent.email}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    onClick={() => handleToggleStatus(agent)}
                    style={{
                      ...buttonStyle,
                      color: agent.isActive ? '#16a34a' : '#dc2626',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#f3f4f6';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'none';
                    }}
                    title={agent.isActive ? 'Deactivate' : 'Activate'}
                  >
                    {agent.isActive ? <UserCheck size={18} /> : <UserX size={18} />}
                  </button>
                  <button
                    onClick={() => openEditModal(agent)}
                    style={{
                      ...buttonStyle,
                      color: '#6b7280',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#f3f4f6';
                      e.currentTarget.style.color = '#7C3AED';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'none';
                      e.currentTarget.style.color = '#6b7280';
                    }}
                    title="Edit"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDeleteAgent(agent.id)}
                    style={{
                      ...buttonStyle,
                      color: '#6b7280',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#fef2f2';
                      e.currentTarget.style.color = '#dc2626';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'none';
                      e.currentTarget.style.color = '#6b7280';
                    }}
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f3f4f6' }}>
                {agent.phone && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>
                    <Phone size={14} />
                    <span>{agent.phone}</span>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>
                  <Shield size={14} />
                  <span style={{ textTransform: 'capitalize' }}>{agent.role?.toLowerCase() || 'Agent'}</span>
                  {agent.isActive ? (
                    <span style={{ 
                      background: '#dcfce7', 
                      color: '#16a34a', 
                      fontSize: '11px', 
                      padding: '2px 8px', 
                      borderRadius: '12px',
                      fontWeight: '500'
                    }}>
                      Active
                    </span>
                  ) : (
                    <span style={{ 
                      background: '#fef2f2', 
                      color: '#dc2626', 
                      fontSize: '11px', 
                      padding: '2px 8px', 
                      borderRadius: '12px',
                      fontWeight: '500'
                    }}>
                      Inactive
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#9ca3af' }}>
                  <Calendar size={14} />
                  <span>Joined {new Date(agent.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {(showAddModal || editingAgent) && (
        <div style={modalStyle} onClick={() => {
          setShowAddModal(false);
          setEditingAgent(null);
          setFormData({ name: '', email: '', password: '', phone: '' });
        }}>
          <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#111827', margin: 0 }}>
                {editingAgent ? 'Edit Agent' : 'Add New Agent'}
              </h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingAgent(null);
                  setFormData({ name: '', email: '', password: '', phone: '' });
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#6b7280',
                  padding: '4px',
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                style={inputStyle}
                placeholder="Enter agent name"
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>Email *</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                style={inputStyle}
                placeholder="Enter agent email"
              />
            </div>

            {!editingAgent && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>Password *</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  style={inputStyle}
                  placeholder="Enter agent password"
                />
              </div>
            )}

            <div style={{ marginBottom: '24px' }}>
              <label style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>Phone</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                style={inputStyle}
                placeholder="Enter agent phone (optional)"
              />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={editingAgent ? handleEditAgent : handleAddAgent}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: '#7C3AED',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#6d28d9';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#7C3AED';
                }}
              >
                <Save size={18} />
                {editingAgent ? 'Update Agent' : 'Create Agent'}
              </button>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingAgent(null);
                  setFormData({ name: '', email: '', password: '', phone: '' });
                }}
                style={{
                  padding: '10px 20px',
                  background: '#f3f4f6',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default Agents;