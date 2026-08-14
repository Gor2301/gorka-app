import React, { useState, useEffect, useRef } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { useAuth, AuthProvider } from './AuthWrapper';
import { ConfirmDialog } from './components/ConfirmDialog';
import { LoadingSpinner } from './components/LoadingSpinner';

// ==================== LOGIN PAGE ====================
const LoginPage: React.FC<{ onSwitchToRegister: () => void }> = ({ onSwitchToRegister }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      toast.success('✅ Login successful!');
    } catch (err: any) {
      setError(err.message || 'Login failed');
      toast.error('❌ ' + (err.message || 'Login failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        padding: '48px',
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        maxWidth: '400px',
        width: '100%',
        animation: 'fadeIn 0.5s ease-in-out'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ fontSize: '36px', color: '#F01428' }}>GORKA</h1>
          <p style={{ color: '#666', fontSize: '14px' }}>Debt Collection Platform</p>
        </div>

        <h2 style={{ fontSize: '20px', textAlign: 'center', marginBottom: '24px' }}>Sign In</h2>

        {error && (
          <div style={{
            background: '#f8d7da',
            color: '#721c24',
            padding: '12px',
            borderRadius: '4px',
            marginBottom: '16px'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '14px', color: '#555' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@gorka.local"
              style={{ width: '100%', padding: '12px', border: '1px solid #d0d0d0', borderRadius: '4px', fontSize: '14px' }}
              required
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '14px', color: '#555' }}>
              Password
            </label>
            <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{ width: '100%', padding: '12px', paddingRight: '40px', border: '1px solid #d0d0d0', borderRadius: '4px', fontSize: '14px' }}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '10px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' }}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              background: '#F01428',
              color: 'white',
              border: 'none',
              padding: '14px',
              borderRadius: '4px',
              fontSize: '16px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <button
            onClick={onSwitchToRegister}
            style={{ background: 'none', border: 'none', color: '#F01428', cursor: 'pointer', fontSize: '14px' }}
          >
            Don't have an account? Register
          </button>
        </div>
      </div>
    </div>
  );
};

// ==================== REGISTER PAGE ====================
const RegisterPage: React.FC<{ onSwitchToLogin: () => void }> = ({ onSwitchToLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { register } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(email, password, name || email.split('@')[0]);
      toast.success('✅ Registration successful!');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
      toast.error('❌ ' + (err.message || 'Registration failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        padding: '48px',
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        maxWidth: '400px',
        width: '100%',
        animation: 'fadeIn 0.5s ease-in-out'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ fontSize: '36px', color: '#F01428' }}>GORKA</h1>
          <p style={{ color: '#666', fontSize: '14px' }}>Debt Collection Platform</p>
        </div>

        <h2 style={{ fontSize: '20px', textAlign: 'center', marginBottom: '24px' }}>Create Account</h2>

        {error && (
          <div style={{
            background: '#f8d7da',
            color: '#721c24',
            padding: '12px',
            borderRadius: '4px',
            marginBottom: '16px'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '14px', color: '#555' }}>
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your Name"
              style={{ width: '100%', padding: '12px', border: '1px solid #d0d0d0', borderRadius: '4px', fontSize: '14px' }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '14px', color: '#555' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={{ width: '100%', padding: '12px', border: '1px solid #d0d0d0', borderRadius: '4px', fontSize: '14px' }}
              required
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '14px', color: '#555' }}>
              Password (min 6 characters)
            </label>
            <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{ width: '100%', padding: '12px', paddingRight: '40px', border: '1px solid #d0d0d0', borderRadius: '4px', fontSize: '14px' }}
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '10px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' }}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              background: '#28a745',
              color: 'white',
              border: 'none',
              padding: '14px',
              borderRadius: '4px',
              fontSize: '16px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1
            }}
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <button
            onClick={onSwitchToLogin}
            style={{ background: 'none', border: 'none', color: '#F01428', cursor: 'pointer', fontSize: '14px' }}
          >
            Already have an account? Sign In
          </button>
        </div>
      </div>
    </div>
  );
};

// ==================== MAIN APP ====================
const AppContent: React.FC = () => {
  const { user, logout, isAuthenticated, loading } = useAuth();
  const [showRegister, setShowRegister] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmDialogProps, setConfirmDialogProps] = useState({
    title: '',
    message: '',
    onConfirm: () => {},
    confirmText: 'Yes, Delete',
    confirmColor: '#dc3545'
  });

  // ---- STATE ----
  const [activePage, setActivePage] = useState('communications');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [actions, setActions] = useState<any[]>([]);
  const [loadingActions, setLoadingActions] = useState(true);
  const [debtors, setDebtors] = useState<any[]>([]);
  const [debtorsLoading, setDebtorsLoading] = useState(false);
  const [communications, setCommunications] = useState<any[]>([]);
  const [commsLoading, setCommsLoading] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [showTemplateForm, setShowTemplateForm] = useState(false);

  // ---- FORM STATE ----
  const [emailForm, setEmailForm] = useState({ to: '', subject: '', content: '', debtorId: '', templateId: '' });
  const [smsForm, setSmsForm] = useState({ phoneNumber: '', message: '', debtorId: '', templateId: '' });
  const [pushForm, setPushForm] = useState({ title: '', body: '', icon: '', debtorId: '', data: '' });
  const [voiceForm, setVoiceForm] = useState({ phoneNumber: '', message: '', voice: 'woman', language: 'en-US', debtorId: '' });
// AI Copilot State
const [copilotRecommendation, setCopilotRecommendation] = useState<any>(null);
const [copilotLoading, setCopilotLoading] = useState(false);
const [copilotError, setCopilotError] = useState<string | null>(null);
  const [commChannel, setCommChannel] = useState('email');

  // ---- TEMPLATE FORM ----
  const [templateForm, setTemplateForm] = useState({
    name: '',
    subject: '',
    content: '',
    channel: 'EMAIL',
    type: 'CUSTOM',
    description: '',
    variables: [] as string[]
  });

  // ---- ACTION FORM ----
  const [formData, setFormData] = useState({
    debtorId: '',
    type: 'REMINDER',
    title: '',
    description: '',
    dueDate: ''
  });

  // ---- DASHBOARD ----
  const [dashboardStats, setDashboardStats] = useState({
    totalDebtors: 0,
    totalActions: 0,
    totalCommunications: 0,
    pendingActions: 0
  });
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [actionStatusData, setActionStatusData] = useState([
    { label: 'PENDING', value: 0, color: '#ffc107' },
    { label: 'IN_PROGRESS', value: 0, color: '#17a2b8' },
    { label: 'COMPLETED', value: 0, color: '#28a745' },
    { label: 'CANCELLED', value: 0, color: '#dc3545' }
  ]);
  const [commsStatsData, setCommsStatsData] = useState([
    { label: 'SENT', value: 0, color: '#28a745' },
    { label: 'FAILED', value: 0, color: '#dc3545' },
    { label: 'PENDING', value: 0, color: '#ffc107' }
  ]);

  // ---- MODALS ----
  const [selectedAction, setSelectedAction] = useState<any | null>(null);
  const [showActionDetail, setShowActionDetail] = useState(false);
  const [editingAction, setEditingAction] = useState<any | null>(null);

  const [selectedDebtor, setSelectedDebtor] = useState<any | null>(null);
  const [showDebtorDetail, setShowDebtorDetail] = useState(false);
  const [debtorActions, setDebtorActions] = useState<any[]>([]);
  const [debtorCommunications, setDebtorCommunications] = useState<any[]>([]);
  const [debtorDetailLoading, setDebtorDetailLoading] = useState(false);
  const [quickActionForm, setQuickActionForm] = useState({
    type: 'REMINDER',
    title: '',
    description: '',
    dueDate: ''
  });
  const [quickEmailForm, setQuickEmailForm] = useState({
    to: '',
    subject: '',
    content: '',
    templateId: ''
  });

  // ---- DEBTOR SELECTOR ----
  const [showDebtorSelector, setShowDebtorSelector] = useState(false);
  const [selectorMode, setSelectorMode] = useState<'email' | 'sms' | 'push'>('email');
  const [emailSuggestions, setEmailSuggestions] = useState<any[]>([]);
  const [showEmailSuggestions, setShowEmailSuggestions] = useState(false);
  const emailSuggestionRef = useRef<HTMLDivElement>(null);
  const [smsSuggestions, setSmsSuggestions] = useState<any[]>([]);
  const [showSmsSuggestions, setShowSmsSuggestions] = useState(false);
  const smsSuggestionRef = useRef<HTMLDivElement>(null);

  const API_URL = 'http://localhost:3000/api';

  // ==================== HELPER FUNCTIONS ====================
  const parseDate = (dateStr: string) => {
    if (!dateStr) return new Date(0);
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return new Date(dateStr.replace('T', ' ').replace('Z', ''));
    return d;
  };

  const formatDateUTC = (dateStr: string) => {
    const d = parseDate(dateStr);
    return d.toUTCString();
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: '#fff3cd',
      IN_PROGRESS: '#cce5ff',
      COMPLETED: '#d4edda',
      CANCELLED: '#f8d7da',
      SENT: '#d4edda',
      FAILED: '#f8d7da',
      ACTIVE: '#d4edda',
      DELETED: '#f8d7da',
      DRAFT: '#fff3cd',
      ARCHIVED: '#f8d7da'
    };
    const textColors: Record<string, string> = {
      PENDING: '#856404',
      IN_PROGRESS: '#004085',
      COMPLETED: '#155724',
      CANCELLED: '#721c24',
      SENT: '#155724',
      FAILED: '#721c24',
      ACTIVE: '#155724',
      DELETED: '#721c24',
      DRAFT: '#856404',
      ARCHIVED: '#721c24'
    };
    return {
      background: colors[status] || '#e0e0e0',
      color: textColors[status] || '#333'
    };
  };

  const getChannelBadge = (channel: string) => {
    const colors: Record<string, string> = {
      EMAIL: '#cce5ff',
      SMS: '#d4edda',
      PUSH: '#fff3cd'
    };
    const textColors: Record<string, string> = {
      EMAIL: '#004085',
      SMS: '#155724',
      PUSH: '#856404'
    };
    return {
      background: colors[channel] || '#e0e0e0',
      color: textColors[channel] || '#333'
    };
  };

  // ==================== API FUNCTIONS ====================
  const loadActions = async () => {
    try {
      const response = await fetch(`${API_URL}/actions`);
      const data = await response.json();
      if (data.success) setActions(data.data);
    } catch (error) {
      console.error('Error loading actions:', error);
    } finally {
      setLoadingActions(false);
    }
  };

  const loadDebtors = async (search?: string) => {
    setDebtorsLoading(true);
    try {
      const url = search ? `${API_URL}/debtors?search=${encodeURIComponent(search)}` : `${API_URL}/debtors`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.success) setDebtors(data.data);
    } catch (error) {
      console.error('Error loading debtors:', error);
    } finally {
      setDebtorsLoading(false);
    }
  };

  const loadCommunications = async () => {
    setCommsLoading(true);
    try {
      const response = await fetch(`${API_URL}/communications`);
      const data = await response.json();
      if (data.success) setCommunications(data.data);
    } catch (error) {
      console.error('Error loading communications:', error);
    } finally {
      setCommsLoading(false);
    }
  };

  const loadTemplates = async () => {
    setTemplatesLoading(true);
    try {
      const response = await fetch(`${API_URL}/templates`);
      const data = await response.json();
      if (data.success) setTemplates(data.data);
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setTemplatesLoading(false);
    }
  };

  const loadDashboardStats = async () => {
    setDashboardLoading(true);
    try {
      const debtorsRes = await fetch(`${API_URL}/debtors`);
      const debtorsData = await debtorsRes.json();
      const actionsRes = await fetch(`${API_URL}/actions`);
      const actionsData = await actionsRes.json();
      const commsRes = await fetch(`${API_URL}/communications`);
      const commsData = await commsRes.json();

      const debtors = debtorsData.success ? debtorsData.data : [];
      const actions = actionsData.success ? actionsData.data : [];
      const comms = commsData.success ? commsData.data : [];

      const pending = actions.filter((a: any) => a.status === 'PENDING').length;
      const sent = comms.filter((c: any) => c.status === 'SENT').length;
      const failed = comms.filter((c: any) => c.status === 'FAILED').length;
      const pendingComms = comms.filter((c: any) => c.status === 'PENDING').length;

      setDashboardStats({
        totalDebtors: debtors.length,
        totalActions: actions.length,
        totalCommunications: comms.length,
        pendingActions: pending
      });

      setActionStatusData([
        { label: 'PENDING', value: pending, color: '#ffc107' },
        { label: 'IN_PROGRESS', value: actions.filter((a: any) => a.status === 'IN_PROGRESS').length, color: '#17a2b8' },
        { label: 'COMPLETED', value: actions.filter((a: any) => a.status === 'COMPLETED').length, color: '#28a745' },
        { label: 'CANCELLED', value: actions.filter((a: any) => a.status === 'CANCELLED').length, color: '#dc3545' }
      ]);

      setCommsStatsData([
        { label: 'SENT', value: sent, color: '#28a745' },
        { label: 'FAILED', value: failed, color: '#dc3545' },
        { label: 'PENDING', value: pendingComms, color: '#ffc107' }
      ]);

      const activity: any[] = [];
      debtors.slice(0, 3).forEach((d: any) => {
        activity.push({
          icon: '👤',
          message: `New debtor added: ${d.name}`,
          time: formatDateUTC(d.createdAt)
        });
      });
      actions.slice(0, 2).forEach((a: any) => {
        activity.push({
          icon: '📋',
          message: `New action: ${a.title} (${a.status})`,
          time: formatDateUTC(a.createdAt)
        });
      });
      comms.slice(0, 2).forEach((c: any) => {
        activity.push({
          icon: c.channel === 'EMAIL' ? '📧' : '📱',
          message: `${c.channel} sent to ${c.contactEmail || c.contactPhone || 'Unknown'}`,
          time: formatDateUTC(c.createdAt)
        });
      });
      setRecentActivity(activity.slice(0, 5));
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    } finally {
      setDashboardLoading(false);
    }
  };

  // ==================== CREATE FUNCTIONS ====================
  const createAction = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, dueDate: formData.dueDate || null })
      });
      const data = await response.json();
      if (data.success) {
        toast.success('✅ Action created successfully!');
        setFormData({ debtorId: '', type: 'REMINDER', title: '', description: '', dueDate: '' });
        loadActions();
        loadDashboardStats();
      } else {
        toast.error('❌ ' + (data.error || 'Failed to create action'));
      }
    } catch (error) {
      toast.error('❌ ' + (error as Error).message);
    }
  };

  const createDebtor = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const name = (form.querySelector('#debtorName') as HTMLInputElement).value;
    const email = (form.querySelector('#debtorEmail') as HTMLInputElement).value;
    const phone = (form.querySelector('#debtorPhone') as HTMLInputElement).value;
    const address = (form.querySelector('#debtorAddress') as HTMLInputElement).value;

    if (!name || !email) {
      toast.error('❌ Name and Email are required!');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/debtors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone: phone || null, address: address || null, organizationId: 'org_123', status: 'ACTIVE' })
      });
      const data = await response.json();
      if (data.success) {
        toast.success('✅ Debtor created successfully!');
        form.reset();
        loadDebtors();
        loadDashboardStats();
      } else {
        toast.error('❌ ' + (data.error || 'Failed to create debtor'));
      }
    } catch (error) {
      toast.error('❌ ' + (error as Error).message);
    }
  };

  const createTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...templateForm, organizationId: 'org_123' })
      });
      const data = await response.json();
      if (data.success) {
        toast.success('✅ Template created successfully!');
        setTemplateForm({ name: '', subject: '', content: '', channel: 'EMAIL', type: 'CUSTOM', description: '', variables: [] });
        setShowTemplateForm(false);
        loadTemplates();
      } else {
        toast.error('❌ ' + (data.error || 'Failed to create template'));
      }
    } catch (error) {
      toast.error('❌ ' + (error as Error).message);
    }
  };

  const sendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
const token = localStorage.getItem('auth_token');

const response = await fetch(`${API_URL}/communications/email`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    to: emailForm.to,
    subject: emailForm.subject,
    content: emailForm.content,
    from: 'GORKA <onboarding@resend.dev>',
    replyTo: 'support@gorka.com',
    debtorId: emailForm.debtorId || null,
    templateId: emailForm.templateId || null
  })
});
      const data = await response.json();
      if (data.success) {
        toast.success('✅ Email sent successfully!');
        setEmailForm({ to: '', subject: '', content: '', debtorId: '', templateId: '' });
        loadCommunications();
        loadDashboardStats();
      } else {
        toast.error('❌ ' + (data.error || 'Failed to send email'));
      }
    } catch (error) {
      toast.error('❌ ' + (error as Error).message);
    }
  };

  const sendSMS = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/communications/sms`, {
        method: 'POST',
        headers: { 
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
},
        body: JSON.stringify({
          to: smsForm.phoneNumber,
          message: smsForm.message,
          from: 'MOCEAN'
        })
      });
      const data = await response.json();
      if (data.success) {
        toast.success('✅ SMS sent successfully!');
        setSmsForm({ phoneNumber: '', message: '', debtorId: '', templateId: '' });
        loadCommunications();
        loadDashboardStats();
      } else {
        toast.error('❌ ' + (data.error || 'Failed to send SMS'));
      }
    } catch (error) {
      toast.error('❌ ' + (error as Error).message);
    }
  };

  const sendPush = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/communications/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: pushForm.debtorId || 'user_001',
          title: pushForm.title,
          body: pushForm.body,
          icon: pushForm.icon || '/icon.png',
          data: pushForm.data ? JSON.parse(pushForm.data) : {}
        })
      });
      const data = await response.json();
      if (data.success) {
        toast.success('✅ Push notification sent successfully!');
        setPushForm({ title: '', body: '', icon: '', debtorId: '', data: '' });
        loadCommunications();
        loadDashboardStats();
      } else {
        toast.error('❌ ' + (data.error || 'Failed to send push notification'));
      }
    } catch (error) {
      toast.error('❌ ' + (error as Error).message);
    }
  };

  const sendVoice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/communications/voice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: voiceForm.phoneNumber,
          message: voiceForm.message,
          voice: voiceForm.voice,
          language: voiceForm.language,
          debtorId: voiceForm.debtorId || null
        })
      });
      const data = await response.json();
      if (data.success) {
        toast.success('✅ Voice call initiated! (Mock)');
        setVoiceForm({ phoneNumber: '', message: '', voice: 'woman', language: 'en-US', debtorId: '' });
        loadCommunications();
        loadDashboardStats();
      } else {
        toast.error('❌ ' + (data.error || 'Failed to make voice call'));
      }
    } catch (error) {
      toast.error('❌ ' + (error as Error).message);
    }
  };
// ==================== LIVE VOICE CALL ====================
const initiateLiveCall = async (debtorPhone: string) => {
  try {
    // Use your own phone number as agent
    const agentPhone = '+639610489002'; // ← YOUR PHONE NUMBER

    toast.loading('📞 Initiating call...');

    const response = await fetch(`${API_URL}/communications/call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        debtorPhone: debtorPhone,
        agentPhone: agentPhone
      })
    });

    const data = await response.json();
    toast.dismiss();

    if (data.success) {
      toast.success('📞 Call initiated! Your phone will ring shortly.');
    } else {
      toast.error('❌ ' + (data.error || 'Failed to initiate call'));
    }
  } catch (error) {
    toast.dismiss();
    toast.error('❌ ' + (error as Error).message);
  }
};
  // ==================== EFFECTS ====================
  useEffect(() => {
    if (isAuthenticated) {
      loadActions();
      loadTemplates();
      loadCommunications();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (activePage === 'communications') loadCommunications();
    if (activePage === 'debtors') loadDebtors();
    if (activePage === 'dashboard') loadDashboardStats();
    if (activePage === 'templates') loadTemplates();
  }, [activePage, isAuthenticated]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emailSuggestionRef.current && !emailSuggestionRef.current.contains(event.target as Node)) {
        setShowEmailSuggestions(false);
      }
      if (smsSuggestionRef.current && !smsSuggestionRef.current.contains(event.target as Node)) {
        setShowSmsSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ==================== HANDLERS ====================
  const handleEmailInputChange = (value: string) => {
    setEmailForm({ ...emailForm, to: value });
    if (value.length > 0) {
      const filtered = debtors.filter(d => d.email?.toLowerCase().includes(value.toLowerCase()) || d.name?.toLowerCase().includes(value.toLowerCase()));
      setEmailSuggestions(filtered);
      setShowEmailSuggestions(true);
    } else {
      setShowEmailSuggestions(false);
    }
  };

  const handleEmailSuggestionClick = (debtor: any) => {
    setEmailForm({ ...emailForm, to: debtor.email || '', debtorId: debtor.id });
    setShowEmailSuggestions(false);
  };

  const handleSmsInputChange = (value: string) => {
    setSmsForm({ ...smsForm, phoneNumber: value });
    if (value.length > 0) {
      const filtered = debtors.filter(d => d.phone?.toLowerCase().includes(value.toLowerCase()) || d.name?.toLowerCase().includes(value.toLowerCase()));
      setSmsSuggestions(filtered);
      setShowSmsSuggestions(true);
    } else {
      setShowSmsSuggestions(false);
    }
  };

  const handleSmsSuggestionClick = (debtor: any) => {
    setSmsForm({ ...smsForm, phoneNumber: debtor.phone || '', debtorId: debtor.id });
    setShowSmsSuggestions(false);
  };

  const openDebtorSelector = (mode: 'email' | 'sms' | 'push') => {
    setSelectorMode(mode);
    loadDebtors();
    setShowDebtorSelector(true);
  };

  const handleDebtorSelect = (debtor: any) => {
    if (selectorMode === 'email') {
      setEmailForm({ ...emailForm, to: debtor.email || '', debtorId: debtor.id });
    } else if (selectorMode === 'sms') {
      setSmsForm({ ...smsForm, phoneNumber: debtor.phone || '', debtorId: debtor.id });
    } else if (selectorMode === 'push') {
      setPushForm({ ...pushForm, debtorId: debtor.id });
    }
    setShowDebtorSelector(false);
  };

  const loadEmailTemplate = (template: any) => {
    setEmailForm({ ...emailForm, subject: template.subject || '', content: template.content, templateId: template.id });
  };

  const loadSmsTemplate = (template: any) => {
    setSmsForm({ ...smsForm, message: template.content, templateId: template.id });
  };

  const handleLogout = () => {
    setConfirmDialogProps({
      title: 'Logout',
      message: 'Are you sure you want to logout?',
      onConfirm: () => { logout(); toast.info('👋 Logged out successfully'); setShowConfirmDialog(false); },
      confirmText: 'Yes, Logout',
      confirmColor: '#F01428'
    });
    setShowConfirmDialog(true);
  };

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      loadDebtors((e.target as HTMLInputElement).value);
    }
  };

  // ==================== MODAL FUNCTIONS ====================
  const openActionDetail = (action: any) => {
    setSelectedAction(action);
    setEditingAction({ ...action });
    setShowActionDetail(true);
  };

  const updateActionStatus = async (id: string, status: string) => {
    try {
      const response = await fetch(`${API_URL}/actions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const data = await response.json();
      if (data.success) {
        toast.success('✅ Action status updated to ' + status);
        loadActions();
        loadDashboardStats();
        setShowActionDetail(false);
      } else {
        toast.error('❌ ' + (data.error || 'Failed to update action status'));
      }
    } catch (error) {
      toast.error('❌ ' + (error as Error).message);
    }
  };

  const deleteAction = async (id: string) => {
    setConfirmDialogProps({
      title: 'Delete Action',
      message: 'Are you sure you want to delete this action?',
      onConfirm: async () => {
        try {
          const response = await fetch(`${API_URL}/actions/${id}`, { method: 'DELETE' });
          const data = await response.json();
          if (data.success) {
            toast.success('✅ Action deleted successfully!');
            loadActions();
            loadDashboardStats();
            setShowActionDetail(false);
          } else {
            toast.error('❌ ' + (data.error || 'Failed to delete action'));
          }
        } catch (error) {
          toast.error('❌ ' + (error as Error).message);
        }
        setShowConfirmDialog(false);
      },
      confirmText: 'Yes, Delete',
      confirmColor: '#dc3545'
    });
    setShowConfirmDialog(true);
  };

  const editAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAction) return;
    try {
      const response = await fetch(`${API_URL}/actions/${editingAction.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editingAction.title,
          description: editingAction.description,
          dueDate: editingAction.dueDate,
          type: editingAction.type,
          status: editingAction.status
        })
      });
      const data = await response.json();
      if (data.success) {
        toast.success('✅ Action updated successfully!');
        loadActions();
        loadDashboardStats();
        setShowActionDetail(false);
        setEditingAction(null);
      } else {
        toast.error('❌ ' + (data.error || 'Failed to update action'));
      }
    } catch (error) {
      toast.error('❌ ' + (error as Error).message);
    }
  };

  const loadDebtorDetails = async (debtorId: string) => {
    setDebtorDetailLoading(true);
    try {
      const response = await fetch(`${API_URL}/debtors/${debtorId}`);
      const data = await response.json();
      if (data.success) {
        setSelectedDebtor(data.data);
        setDebtorActions(data.data.actions || []);
        setDebtorCommunications(data.data.messageLogs || []);
        setQuickEmailForm({ to: data.data.email || '', subject: '', content: '', templateId: '' });
      }
    } catch (error) {
      console.error('Error loading debtor details:', error);
    } finally {
      setDebtorDetailLoading(false);
    }
  };

  const openDebtorDetail = (debtor: any) => {
    loadDebtorDetails(debtor.id);
    setShowDebtorDetail(true);
  };

  const createQuickAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDebtor) return;
    try {
      const response = await fetch(`${API_URL}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ debtorId: selectedDebtor.id, ...quickActionForm, dueDate: quickActionForm.dueDate || null })
      });
      const data = await response.json();
      if (data.success) {
        toast.success('✅ Action created successfully!');
        setQuickActionForm({ type: 'REMINDER', title: '', description: '', dueDate: '' });
        loadDebtorDetails(selectedDebtor.id);
        loadActions();
        loadDashboardStats();
      } else {
        toast.error('❌ ' + (data.error || 'Failed to create action'));
      }
    } catch (error) {
      toast.error('❌ ' + (error as Error).message);
    }
  };

  const sendQuickEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDebtor) return;
    try {
      const response = await fetch(`${API_URL}/communications/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactEmail: quickEmailForm.to || selectedDebtor.email,
          subject: quickEmailForm.subject,
          content: quickEmailForm.content,
          debtorId: selectedDebtor.id,
          contactName: selectedDebtor.name,
          templateId: quickEmailForm.templateId || null
        })
      });
      const data = await response.json();
      if (data.success) {
        toast.success('✅ Email sent successfully!');
        setQuickEmailForm({ ...quickEmailForm, subject: '', content: '' });
        loadDebtorDetails(selectedDebtor.id);
        loadCommunications();
        loadDashboardStats();
      } else {
        toast.error('❌ ' + (data.error || 'Failed to send email'));
      }
    } catch (error) {
      toast.error('❌ ' + (error as Error).message);
    }
  };

  const loadTemplateIntoQuickEmail = (template: any) => {
    setQuickEmailForm({ ...quickEmailForm, subject: template.subject || '', content: template.content, templateId: template.id });
  };

// ============================================
// AI Copilot Functions
// ============================================

const getCopilotRecommendation = async (debtorId: string) => {
  setCopilotLoading(true);
  setCopilotError(null);
  
  try {
    const token = localStorage.getItem('auth_token');
    console.log('🔑 Token value:', token);
    if (!token) {
      setCopilotError('Please log in first');
      toast.error('❌ Please log in first');
      setCopilotLoading(false);
      return;
    }
    
    const url = `http://localhost:3000/api/copilot/analyze`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ debtorId })
    });
    
    const data = await response.json();
    
    if (data.success) {
      setCopilotRecommendation(data.data);
      toast.success('✅ AI recommendation generated!');
    } else {
      setCopilotError(data.error || 'Failed to get recommendation');
      toast.error('❌ ' + (data.error || 'Failed to get recommendation'));
    }
  } catch (error) {
    setCopilotError('Network error. Please try again.');
    toast.error('❌ Network error');
  } finally {
    setCopilotLoading(false);
  }
};

const loadDraftIntoEmail = () => {
  if (!copilotRecommendation || !selectedDebtor) return;
  
  setEmailForm({
    to: selectedDebtor.email || '',
    subject: copilotRecommendation.emailDraft?.subject || '',
    content: copilotRecommendation.emailDraft?.body || '',
    debtorId: selectedDebtor.id,
    templateId: ''
  });
  
  toast.success('📝 Draft loaded into Quick Email!');
  setCopilotRecommendation(null);
};

const approveAndSend = async () => {
  if (!copilotRecommendation?.recommendationId) {
    toast.error('❌ No recommendation to approve');
    return;
  }
  
  try {
    const token = localStorage.getItem('auth_token');
    const url = `http://localhost:3000/api/copilot/approve/${copilotRecommendation.recommendationId}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    if (data.success) {
      toast.success('✅ Recommendation approved! Ready to send.');
      loadDraftIntoEmail();
    } else {
      toast.error('❌ ' + (data.error || 'Failed to approve'));
    }
  } catch (error) {
    toast.error('❌ Network error');
  }
};  const deleteDebtor = async (id: string) => {
    setConfirmDialogProps({
      title: 'Delete Debtor',
      message: 'Are you sure you want to delete this debtor?',
      onConfirm: async () => {
        try {
          const response = await fetch(`${API_URL}/debtors/${id}`, { method: 'DELETE' });
          const data = await response.json();
          if (data.success) {
            toast.success('✅ Debtor deleted successfully!');
            loadDebtors();
            loadDashboardStats();
            setShowDebtorDetail(false);
          } else {
            toast.error('❌ ' + (data.error || 'Failed to delete debtor'));
          }
        } catch (error) {
          toast.error('❌ ' + (error as Error).message);
        }
        setShowConfirmDialog(false);
      },
      confirmText: 'Yes, Delete',
      confirmColor: '#dc3545'
    });
    setShowConfirmDialog(true);
  };

  const deleteTemplate = async (id: string) => {
    setConfirmDialogProps({
      title: 'Delete Template',
      message: 'Are you sure you want to delete this template?',
      onConfirm: async () => {
        try {
          const response = await fetch(`${API_URL}/templates/${id}`, { method: 'DELETE' });
          const data = await response.json();
          if (data.success) {
            toast.success('✅ Template deleted successfully!');
            loadTemplates();
          } else {
            toast.error('❌ ' + (data.error || 'Failed to delete template'));
          }
        } catch (error) {
          toast.error('❌ ' + (error as Error).message);
        }
        setShowConfirmDialog(false);
      },
      confirmText: 'Yes, Delete',
      confirmColor: '#dc3545'
    });
    setShowConfirmDialog(true);
  };

  // ==================== PAGE RENDER FUNCTIONS ====================

  const renderCommunications = () => {
    return (
      <div className="fade-in">
        <div style={{ background: 'white', padding: '20px 24px', borderRadius: '8px', marginBottom: '24px', borderTop: '4px solid #F01428' }}>
          <h1 style={{ fontSize: '28px', color: '#1a1a1a' }}>📱 Multi-Channel Communications</h1>
          <p style={{ color: '#666' }}>Send emails, SMS, and push notifications to your debtors</p>
        </div>

        <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: '#f0f0f0', padding: '4px', borderRadius: '8px' }}>
          {['email', 'sms', 'push', 'voice'].map((tab) => (
            <button
              key={tab}
              onClick={() => setCommChannel(tab)}
              style={{
                flex: 1,
                padding: '12px 24px',
                background: commChannel === tab ? 'white' : 'transparent',
                color: commChannel === tab ? '#F01428' : '#666',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: commChannel === tab ? 600 : 400,
                boxShadow: commChannel === tab ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              {tab === 'email' ? '📧 Email' : tab === 'sms' ? '📱 SMS' : tab === 'push' ? '🔔 Push' : '📞 Voice'}
            </button>
          ))}
        </div>

        {/* Email Form */}
        {commChannel === 'email' && (
          <div style={{ background: 'white', padding: '24px', borderRadius: '8px', marginBottom: '24px' }}>
            <h2 style={{ marginBottom: '16px', fontSize: '18px' }}>✉️ Send Email</h2>
            <form onSubmit={sendEmail}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '14px', color: '#555' }}>To (Email) *</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div ref={emailSuggestionRef} style={{ position: 'relative', flex: 1 }}>
                    <input
                      type="email"
                      placeholder="debtor@example.com"
                      value={emailForm.to}
                      onChange={(e) => handleEmailInputChange(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid #d0d0d0', borderRadius: '4px', fontSize: '14px' }}
                      required
                    />
                    {showEmailSuggestions && emailSuggestions.length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #d0d0d0', borderRadius: '4px', maxHeight: '150px', overflowY: 'auto', zIndex: 10, boxShadow: '0 4px 8px rgba(0,0,0,0.1)' }}>
                        {emailSuggestions.map((debtor) => (
                          <div key={debtor.id} onClick={() => handleEmailSuggestionClick(debtor)} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #eee' }} onMouseEnter={(e) => e.currentTarget.style.background = '#f0f0f0'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                            <div><strong>{debtor.name}</strong></div>
                            <div style={{ fontSize: '12px', color: '#666' }}>{debtor.email}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button type="button" onClick={() => openDebtorSelector('email')} style={{ background: '#e8f4f8', color: '#2c3e50', border: '1px solid #c0dce8', padding: '10px 16px', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', whiteSpace: 'nowrap' }}>📋 Select</button>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '14px', color: '#555' }}>Load Template</label>
                <select
                  value={emailForm.templateId}
                  onChange={(e) => {
                    const templateId = e.target.value;
                    if (templateId) {
                      const template = templates.find(t => t.id === templateId);
                      if (template) loadEmailTemplate(template);
                    } else {
                      setEmailForm({ ...emailForm, templateId: '', subject: '', content: '' });
                    }
                  }}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #d0d0d0', borderRadius: '4px', fontSize: '14px' }}
                >
                  <option value="">-- Select a template --</option>
                  {templates.filter(t => t.channel === 'EMAIL').map((template) => (
                    <option key={template.id} value={template.id}>{template.name} ({template.channel})</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '14px', color: '#555' }}>Subject *</label>
                <input type="text" placeholder="Payment Reminder" value={emailForm.subject} onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d0d0d0', borderRadius: '4px', fontSize: '14px' }} required />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '14px', color: '#555' }}>Content *</label>
                <textarea rows={4} placeholder="Dear debtor, ..." value={emailForm.content} onChange={(e) => setEmailForm({ ...emailForm, content: e.target.value })} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d0d0d0', borderRadius: '4px', fontSize: '14px' }} required />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '14px', color: '#555' }}>Debtor ID (optional)</label>
                <input type="text" placeholder="debtor_001" value={emailForm.debtorId} onChange={(e) => setEmailForm({ ...emailForm, debtorId: e.target.value })} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d0d0d0', borderRadius: '4px', fontSize: '14px' }} />
              </div>

              <button type="submit" style={{ background: '#F01428', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '4px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>📤 Send Email</button>
            </form>
          </div>
        )}

        {/* SMS Form */}
        {commChannel === 'sms' && (
          <div style={{ background: 'white', padding: '24px', borderRadius: '8px', marginBottom: '24px' }}>
            <h2 style={{ marginBottom: '16px', fontSize: '18px' }}>📱 Send SMS</h2>
            <form onSubmit={sendSMS}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '14px', color: '#555' }}>Phone Number *</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div ref={smsSuggestionRef} style={{ position: 'relative', flex: 1 }}>
                    <input type="text" placeholder="+1234567890" value={smsForm.phoneNumber} onChange={(e) => handleSmsInputChange(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d0d0d0', borderRadius: '4px', fontSize: '14px' }} required />
                    {showSmsSuggestions && smsSuggestions.length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #d0d0d0', borderRadius: '4px', maxHeight: '150px', overflowY: 'auto', zIndex: 10, boxShadow: '0 4px 8px rgba(0,0,0,0.1)' }}>
                        {smsSuggestions.map((debtor) => (
                          <div key={debtor.id} onClick={() => handleSmsSuggestionClick(debtor)} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #eee' }} onMouseEnter={(e) => e.currentTarget.style.background = '#f0f0f0'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                            <div><strong>{debtor.name}</strong></div>
                            <div style={{ fontSize: '12px', color: '#666' }}>{debtor.phone}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button type="button" onClick={() => openDebtorSelector('sms')} style={{ background: '#e8f4f8', color: '#2c3e50', border: '1px solid #c0dce8', padding: '10px 16px', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', whiteSpace: 'nowrap' }}>📋 Select</button>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '14px', color: '#555' }}>Load Template</label>
                <select
                  value={smsForm.templateId}
                  onChange={(e) => {
                    const templateId = e.target.value;
                    if (templateId) {
                      const template = templates.find(t => t.id === templateId);
                      if (template) loadSmsTemplate(template);
                    } else {
                      setSmsForm({ ...smsForm, templateId: '', message: '' });
                    }
                  }}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #d0d0d0', borderRadius: '4px', fontSize: '14px' }}
                >
                  <option value="">-- Select a template --</option>
                  {templates.filter(t => t.channel === 'SMS').map((template) => (
                    <option key={template.id} value={template.id}>{template.name} ({template.channel})</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '14px', color: '#555' }}>Message *</label>
                <textarea rows={3} placeholder="Your SMS message..." value={smsForm.message} onChange={(e) => setSmsForm({ ...smsForm, message: e.target.value })} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d0d0d0', borderRadius: '4px', fontSize: '14px' }} required />
                <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>{smsForm.message.length} characters</div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '14px', color: '#555' }}>Debtor ID (optional)</label>
                <input type="text" placeholder="debtor_001" value={smsForm.debtorId} onChange={(e) => setSmsForm({ ...smsForm, debtorId: e.target.value })} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d0d0d0', borderRadius: '4px', fontSize: '14px' }} />
              </div>

              <button type="submit" style={{ background: '#28a745', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '4px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>📤 Send SMS</button>
            </form>
          </div>
        )}

        {/* Push Form */}
        {commChannel === 'push' && (
          <div style={{ background: 'white', padding: '24px', borderRadius: '8px', marginBottom: '24px' }}>
            <h2 style={{ marginBottom: '16px', fontSize: '18px' }}>🔔 Send Push Notification</h2>
            <form onSubmit={sendPush}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '14px', color: '#555' }}>Title *</label>
                <input type="text" placeholder="Payment Reminder" value={pushForm.title} onChange={(e) => setPushForm({ ...pushForm, title: e.target.value })} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d0d0d0', borderRadius: '4px', fontSize: '14px' }} required />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '14px', color: '#555' }}>Body *</label>
                <textarea rows={3} placeholder="Your push notification message..." value={pushForm.body} onChange={(e) => setPushForm({ ...pushForm, body: e.target.value })} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d0d0d0', borderRadius: '4px', fontSize: '14px' }} required />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '14px', color: '#555' }}>Icon URL (optional)</label>
                <input type="text" placeholder="/icon.png" value={pushForm.icon} onChange={(e) => setPushForm({ ...pushForm, icon: e.target.value })} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d0d0d0', borderRadius: '4px', fontSize: '14px' }} />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '14px', color: '#555' }}>Debtor ID (optional)</label>
                <input type="text" placeholder="debtor_001" value={pushForm.debtorId} onChange={(e) => setPushForm({ ...pushForm, debtorId: e.target.value })} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d0d0d0', borderRadius: '4px', fontSize: '14px' }} />
                <button type="button" onClick={() => openDebtorSelector('push')} style={{ marginTop: '8px', background: '#e8f4f8', color: '#2c3e50', border: '1px solid #c0dce8', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>📋 Select from Debtors</button>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '14px', color: '#555' }}>Additional Data (JSON, optional)</label>
                <input type="text" placeholder='{"action_id": "123"}' value={pushForm.data} onChange={(e) => setPushForm({ ...pushForm, data: e.target.value })} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d0d0d0', borderRadius: '4px', fontSize: '14px' }} />
              </div>

              <button type="submit" style={{ background: '#ffc107', color: '#333', border: 'none', padding: '10px 24px', borderRadius: '4px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>🔔 Send Push</button>
            </form>
          </div>
        )}

        {/* Voice Form */}
        {commChannel === 'voice' && (
          <div style={{ background: 'white', padding: '24px', borderRadius: '8px', marginBottom: '24px' }}>
            <h2 style={{ marginBottom: '16px', fontSize: '18px' }}>📞 Make Voice Call</h2>
            <form onSubmit={sendVoice}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '14px', color: '#555' }}>Phone Number *</label>
                <input
                  type="text"
                  placeholder="+1234567890"
                  value={voiceForm.phoneNumber}
                  onChange={(e) => setVoiceForm({ ...voiceForm, phoneNumber: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #d0d0d0', borderRadius: '4px', fontSize: '14px' }}
                  required
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '14px', color: '#555' }}>Message *</label>
                <textarea
                  rows={3}
                  placeholder="Message to be spoken..."
                  value={voiceForm.message}
                  onChange={(e) => setVoiceForm({ ...voiceForm, message: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #d0d0d0', borderRadius: '4px', fontSize: '14px' }}
                  required
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '14px', color: '#555' }}>Voice (optional)</label>
                <select
                  value={voiceForm.voice}
                  onChange={(e) => setVoiceForm({ ...voiceForm, voice: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #d0d0d0', borderRadius: '4px', fontSize: '14px' }}
                >
                  <option value="woman">Woman</option>
                  <option value="man">Man</option>
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '14px', color: '#555' }}>Language (optional)</label>
                <select
                  value={voiceForm.language}
                  onChange={(e) => setVoiceForm({ ...voiceForm, language: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #d0d0d0', borderRadius: '4px', fontSize: '14px' }}
                >
                  <option value="en-US">English (US)</option>
                  <option value="en-GB">English (UK)</option>
                  <option value="es-ES">Spanish</option>
                  <option value="fr-FR">French</option>
                  <option value="de-DE">German</option>
                  <option value="tl-PH">Tagalog</option>
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '14px', color: '#555' }}>Debtor ID (optional)</label>
                <input
                  type="text"
                  placeholder="debtor_001"
                  value={voiceForm.debtorId}
                  onChange={(e) => setVoiceForm({ ...voiceForm, debtorId: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #d0d0d0', borderRadius: '4px', fontSize: '14px' }}
                />
              </div>

              <button type="submit" style={{ background: '#17a2b8', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '4px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                📞 Make Call
              </button>
            </form>
          </div>
        )}

        {/* Communication History */}
        <div style={{ background: 'white', padding: '24px', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '18px' }}>📋 Communication History</h2>
            <button onClick={loadCommunications} style={{ background: '#e0e0e0', color: '#333', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>🔄 Refresh</button>
          </div>
          {commsLoading ? (
            <LoadingSpinner message="Loading communications..." />
          ) : communications.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
              <div style={{ fontSize: '48px' }}>📭</div>
              <p>No communications found. Send your first message above!</p>
            </div>
          ) : (
            <ul style={{ listStyle: 'none' }}>
              {communications.map((comm) => {
                const badge = getStatusBadge(comm.status);
                const channelBadge = getChannelBadge(comm.channel);
                return (
                  <li key={comm.id} style={{ padding: '16px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div>
                        <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600, background: channelBadge.background, color: channelBadge.color, marginRight: '8px' }}>{comm.channel}</span>
                        <strong>{comm.subject || comm.content?.substring(0, 50) || 'No subject'}</strong>
                      </div>
                      <div style={{ fontSize: '14px', color: '#666', marginTop: '4px' }}>{comm.contactEmail || comm.contactPhone || 'Unknown recipient'}</div>
                      <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>{comm.sentAt ? `Sent: ${formatDateUTC(comm.sentAt)}` : `Created: ${formatDateUTC(comm.createdAt)}`}</div>
                    </div>
                    <span style={{ padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', background: badge.background, color: badge.color }}>{comm.status}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    );
  };

  const renderActionsPage = () => {
    return (
      <div className="fade-in">
        <div style={{ background: 'white', padding: '20px 24px', borderRadius: '8px', marginBottom: '24px', borderTop: '4px solid #F01428' }}>
          <h1 style={{ fontSize: '28px', color: '#1a1a1a' }}>📋 Actions Management</h1>
          <p style={{ color: '#666' }}>Create and manage collection actions for your debtors</p>
        </div>

        <div style={{ background: 'white', padding: '24px', borderRadius: '8px', marginBottom: '24px' }}>
          <h2 style={{ marginBottom: '16px', fontSize: '18px' }}>➕ Create New Action</h2>
          <form onSubmit={createAction}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '14px', color: '#555' }}>Debtor ID *</label>
              <input type="text" value={formData.debtorId} onChange={(e) => setFormData({ ...formData, debtorId: e.target.value })} placeholder="Enter debtor ID" style={{ width: '100%', padding: '10px 12px', border: '1px solid #d0d0d0', borderRadius: '4px', fontSize: '14px' }} required />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '14px', color: '#555' }}>Action Type *</label>
              <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d0d0d0', borderRadius: '4px', fontSize: '14px' }} required>
                <option value="REMINDER">Reminder</option>
                <option value="DEMAND_LETTER">Demand Letter</option>
                <option value="PAYMENT_PLAN">Payment Plan</option>
                <option value="FINAL_NOTICE">Final Notice</option>
                <option value="LEGAL">Legal Action</option>
                <option value="CUSTOM">Custom</option>
              </select>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '14px', color: '#555' }}>Title *</label>
              <input type="text" placeholder="e.g., First Payment Reminder" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d0d0d0', borderRadius: '4px', fontSize: '14px' }} required />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '14px', color: '#555' }}>Description</label>
              <textarea rows={2} placeholder="Add details about this action" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d0d0d0', borderRadius: '4px', fontSize: '14px' }} />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '14px', color: '#555' }}>Due Date</label>
              <input type="date" value={formData.dueDate} onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d0d0d0', borderRadius: '4px', fontSize: '14px' }} />
            </div>

            <button type="submit" style={{ background: '#F01428', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '4px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>🚀 Create Action</button>
          </form>
        </div>

        <div style={{ background: 'white', padding: '24px', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '18px' }}>📋 All Actions</h2>
            <button onClick={loadActions} style={{ background: '#e0e0e0', color: '#333', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>🔄 Refresh</button>
          </div>
          {loadingActions ? (
            <LoadingSpinner message="Loading actions..." />
          ) : actions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
              <div style={{ fontSize: '48px' }}>📭</div>
              <p>No actions found. Create your first action above!</p>
            </div>
          ) : (
            <ul style={{ listStyle: 'none' }}>
              {actions.map((action) => {
                const badge = getStatusBadge(action.status);
                return (
                  <li key={action.id} onClick={() => openActionDetail(action)} style={{ padding: '16px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onMouseEnter={(e) => e.currentTarget.style.background = '#f8f9fa'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                    <div>
                      <div><strong>{action.title}</strong> <span style={{ fontSize: '12px', color: '#888' }}>{action.type}</span></div>
                      <div style={{ fontSize: '14px', color: '#666', marginTop: '4px' }}>{action.description || 'No description'}</div>
                      <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>ID: {action.id.substring(0, 8)}... | Created: {formatDateUTC(action.createdAt)}</div>
                    </div>
                    <span style={{ padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', background: badge.background, color: badge.color }}>{action.status}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    );
  };

  const renderDebtorsPage = () => {
    return (
      <div className="fade-in">
        <div style={{ background: 'white', padding: '20px 24px', borderRadius: '8px', marginBottom: '24px', borderTop: '4px solid #F01428' }}>
          <h1 style={{ fontSize: '28px', color: '#1a1a1a' }}>👤 Debtors Management</h1>
          <p style={{ color: '#666' }}>Manage your debtors and their information</p>
        </div>

        <div style={{ background: 'white', padding: '24px', borderRadius: '8px', marginBottom: '24px' }}>
          <h2 style={{ marginBottom: '16px', fontSize: '18px' }}>➕ Add New Debtor</h2>
          <form onSubmit={createDebtor}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '14px', color: '#555' }}>Name *</label>
                <input type="text" id="debtorName" placeholder="John Doe" style={{ width: '100%', padding: '10px 12px', border: '1px solid #d0d0d0', borderRadius: '4px', fontSize: '14px' }} required />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '14px', color: '#555' }}>Email *</label>
                <input type="email" id="debtorEmail" placeholder="john@example.com" style={{ width: '100%', padding: '10px 12px', border: '1px solid #d0d0d0', borderRadius: '4px', fontSize: '14px' }} required />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '14px', color: '#555' }}>Phone</label>
                <input type="text" id="debtorPhone" placeholder="+1 (555) 123-4567" style={{ width: '100%', padding: '10px 12px', border: '1px solid #d0d0d0', borderRadius: '4px', fontSize: '14px' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '14px', color: '#555' }}>Address</label>
                <input type="text" id="debtorAddress" placeholder="123 Main St, City" style={{ width: '100%', padding: '10px 12px', border: '1px solid #d0d0d0', borderRadius: '4px', fontSize: '14px' }} />
              </div>
            </div>
            <button type="submit" style={{ marginTop: '16px', background: '#F01428', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '4px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>➕ Add Debtor</button>
          </form>
        </div>

        <div style={{ background: 'white', padding: '24px', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '18px' }}>📋 All Debtors</h2>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input type="text" placeholder="Search debtors..." style={{ padding: '8px 12px', border: '1px solid #d0d0d0', borderRadius: '4px', fontSize: '14px', width: '200px' }} onKeyUp={handleSearch} />
              <button onClick={() => loadDebtors()} style={{ background: '#e0e0e0', color: '#333', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>🔄 Refresh</button>
            </div>
          </div>
          {debtorsLoading ? (
            <LoadingSpinner message="Loading debtors..." />
          ) : debtors.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
              <div style={{ fontSize: '48px' }}>📭</div>
              <p>No debtors found. Add your first debtor above!</p>
            </div>
          ) : (
            <ul style={{ listStyle: 'none' }}>
              {debtors.map((debtor) => {
                const badge = getStatusBadge(debtor.status);
                return (
                  <li key={debtor.id} onClick={() => openDebtorDetail(debtor)} style={{ padding: '16px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onMouseEnter={(e) => e.currentTarget.style.background = '#f8f9fa'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                    <div>
                      <div><strong>{debtor.name}</strong> <span style={{ fontSize: '12px', color: '#888' }}>{debtor.email || 'No email'}</span></div>
                      <div style={{ fontSize: '14px', color: '#666' }}>{debtor.phone || 'No phone'} | {debtor.address || 'No address'}</div>
                      <div style={{ fontSize: '12px', color: '#999' }}>ID: {debtor.id.substring(0, 8)}... | Created: {formatDateUTC(debtor.createdAt)}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', background: badge.background, color: badge.color }}>{debtor.status}</span>
                      <button onClick={(e) => { e.stopPropagation(); deleteDebtor(debtor.id); }} style={{ background: '#dc3545', color: 'white', border: 'none', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>🗑️</button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    );
  };

  const renderTemplatesPage = () => {
    return (
      <div className="fade-in">
        <div style={{ background: 'white', padding: '20px 24px', borderRadius: '8px', marginBottom: '24px', borderTop: '4px solid #F01428' }}>
          <h1 style={{ fontSize: '28px', color: '#1a1a1a' }}>📝 Templates</h1>
          <p style={{ color: '#666' }}>Create and manage reusable templates for all channels</p>
        </div>

        <div style={{ background: 'white', padding: '24px', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '18px' }}>📋 All Templates</h2>
            <button onClick={() => setShowTemplateForm(!showTemplateForm)} style={{ background: '#F01428', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>{showTemplateForm ? '❌ Cancel' : '➕ New Template'}</button>
          </div>

          {showTemplateForm && (
            <form onSubmit={createTemplate} style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
              <h3 style={{ marginBottom: '16px', fontSize: '16px' }}>Create New Template</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '14px', color: '#555' }}>Template Name *</label>
                  <input type="text" placeholder="My Template" value={templateForm.name} onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d0d0d0', borderRadius: '4px', fontSize: '14px' }} required />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '14px', color: '#555' }}>Channel</label>
                  <select value={templateForm.channel} onChange={(e) => setTemplateForm({ ...templateForm, channel: e.target.value })} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d0d0d0', borderRadius: '4px', fontSize: '14px' }}>
                    <option value="EMAIL">Email</option>
                    <option value="SMS">SMS</option>
                    <option value="PUSH">Push</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '14px', color: '#555' }}>Template Type</label>
                  <select value={templateForm.type} onChange={(e) => setTemplateForm({ ...templateForm, type: e.target.value })} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d0d0d0', borderRadius: '4px', fontSize: '14px' }}>
                    <option value="REMINDER">Reminder</option>
                    <option value="DEMAND">Demand</option>
                    <option value="PAYMENT">Payment</option>
                    <option value="LEGAL">Legal</option>
                    <option value="CUSTOM">Custom</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '14px', color: '#555' }}>Subject</label>
                  <input type="text" placeholder="Email subject" value={templateForm.subject} onChange={(e) => setTemplateForm({ ...templateForm, subject: e.target.value })} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d0d0d0', borderRadius: '4px', fontSize: '14px' }} />
                </div>
              </div>
              <div style={{ marginTop: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '14px', color: '#555' }}>Description</label>
                <input type="text" placeholder="Template description" value={templateForm.description} onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d0d0d0', borderRadius: '4px', fontSize: '14px' }} />
              </div>
              <div style={{ marginTop: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '14px', color: '#555' }}>Content *</label>
                <textarea rows={6} placeholder="Dear {{debtor_name}}, ..." value={templateForm.content} onChange={(e) => setTemplateForm({ ...templateForm, content: e.target.value })} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d0d0d0', borderRadius: '4px', fontSize: '14px' }} required />
              </div>
              <button type="submit" style={{ marginTop: '16px', background: '#28a745', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '4px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>💾 Save Template</button>
            </form>
          )}

          {templatesLoading ? (
            <LoadingSpinner message="Loading templates..." />
          ) : templates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
              <div style={{ fontSize: '48px' }}>📭</div>
              <p>No templates found. Create your first template above!</p>
            </div>
          ) : (
            <ul style={{ listStyle: 'none' }}>
              {templates.map((template) => {
                const badge = getStatusBadge(template.status);
                const channelBadge = getChannelBadge(template.channel);
                return (
                  <li key={template.id} style={{ padding: '16px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div>
                        <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600, background: channelBadge.background, color: channelBadge.color, marginRight: '8px' }}>{template.channel}</span>
                        <strong>{template.name}</strong> <span style={{ fontSize: '12px', color: '#888' }}>{template.type}</span>
                      </div>
                      <div style={{ fontSize: '14px', color: '#666' }}>{template.subject || 'No subject'}</div>
                      <div style={{ fontSize: '12px', color: '#999' }}>{template.description || 'No description'}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', background: badge.background, color: badge.color }}>{template.status}</span>
                      <button onClick={() => deleteTemplate(template.id)} style={{ background: '#dc3545', color: 'white', border: 'none', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>🗑️</button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    );
  };

  const renderDashboardPage = () => {
    return (
      <div className="fade-in">
        <div style={{ background: 'white', padding: '20px 24px', borderRadius: '8px', marginBottom: '24px', borderTop: '4px solid #F01428' }}>
          <h1 style={{ fontSize: '28px', color: '#1a1a1a' }}>📊 Dashboard</h1>
          <p style={{ color: '#666' }}>Real-time analytics and key performance indicators</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
          {[
            { label: '👤 Total Debtors', value: dashboardStats.totalDebtors, color: '#F01428' },
            { label: '📋 Total Actions', value: dashboardStats.totalActions, color: '#28a745' },
            { label: '📧 Communications', value: dashboardStats.totalCommunications, color: '#17a2b8' },
            { label: '⏳ Pending Actions', value: dashboardStats.pendingActions, color: '#ffc107' }
          ].map((item, index) => (
            <div key={index} style={{ background: 'white', padding: '20px', borderRadius: '8px', textAlign: 'center', transition: 'all 0.2s' }} onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'; e.currentTarget.style.transform = 'translateY(-2px)'; }} onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)'; e.currentTarget.style.transform = 'translateY(0)'; }}>
              <div style={{ fontSize: '32px', color: item.color, fontWeight: 'bold' }}>{item.value}</div>
              <div style={{ color: '#666', fontSize: '14px', marginTop: '4px' }}>{item.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
          <div style={{ background: 'white', padding: '24px', borderRadius: '8px' }}>
            <h3 style={{ marginBottom: '16px', fontSize: '16px', color: '#333' }}>📊 Actions by Status</h3>
            <div style={{ height: '200px', display: 'flex', alignItems: 'flex-end', gap: '16px', padding: '0 20px' }}>
              {actionStatusData.map((item, index) => (
                <div key={index} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }}>
                  <div style={{ width: '100%', height: `${(item.value / Math.max(...actionStatusData.map(d => d.value), 1)) * 100}%`, background: item.color, borderRadius: '4px 4px 0 0', minHeight: '10px' }} />
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '8px', textAlign: 'center' }}>{item.label}</div>
                  <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#333' }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: 'white', padding: '24px', borderRadius: '8px' }}>
            <h3 style={{ marginBottom: '16px', fontSize: '16px', color: '#333' }}>📧 Communication Stats</h3>
            <div style={{ height: '200px', display: 'flex', alignItems: 'flex-end', gap: '16px', padding: '0 20px' }}>
              {commsStatsData.map((item, index) => (
                <div key={index} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }}>
                  <div style={{ width: '100%', height: `${(item.value / Math.max(...commsStatsData.map(d => d.value), 1)) * 100}%`, background: item.color, borderRadius: '4px 4px 0 0', minHeight: '10px' }} />
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '8px', textAlign: 'center' }}>{item.label}</div>
                  <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#333' }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ background: 'white', padding: '24px', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', color: '#333' }}>🔄 Recent Activity</h3>
            <button onClick={loadDashboardStats} style={{ background: '#e0e0e0', color: '#333', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>🔄 Refresh</button>
          </div>
          {dashboardLoading ? (
            <LoadingSpinner message="Loading activity..." />
          ) : recentActivity.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: '#888' }}>No recent activity</div>
          ) : (
            <ul style={{ listStyle: 'none' }}>
              {recentActivity.map((activity, index) => (
                <li key={index} style={{ padding: '12px 0', borderBottom: index < recentActivity.length - 1 ? '1px solid #eee' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div><span style={{ fontSize: '16px', marginRight: '8px' }}>{activity.icon}</span> <span style={{ fontSize: '14px', color: '#333' }}>{activity.message}</span></div>
                  <div style={{ fontSize: '12px', color: '#999' }}>{activity.time}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  };

  // ==================== MODALS ====================

  const renderActionDetailModal = () => {
    if (!showActionDetail || !selectedAction) return null;

    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowActionDetail(false)}>
        <div style={{ background: 'white', borderRadius: '12px', padding: '32px', maxWidth: '600px', width: '90%', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }} onClick={(e) => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '24px' }}>📋 Action Details</h2>
            <button onClick={() => setShowActionDetail(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#999' }}>✕</button>
          </div>

          <form onSubmit={editAction}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '14px', color: '#555' }}>Title *</label>
              <input type="text" value={editingAction?.title || ''} onChange={(e) => setEditingAction({ ...editingAction!, title: e.target.value })} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d0d0d0', borderRadius: '4px', fontSize: '14px' }} required />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '14px', color: '#555' }}>Type</label>
              <select value={editingAction?.type || ''} onChange={(e) => setEditingAction({ ...editingAction!, type: e.target.value })} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d0d0d0', borderRadius: '4px', fontSize: '14px' }}>
                <option value="REMINDER">Reminder</option>
                <option value="DEMAND_LETTER">Demand Letter</option>
                <option value="PAYMENT_PLAN">Payment Plan</option>
                <option value="FINAL_NOTICE">Final Notice</option>
                <option value="LEGAL">Legal Action</option>
                <option value="CUSTOM">Custom</option>
              </select>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '14px', color: '#555' }}>Status</label>
              <select value={editingAction?.status || ''} onChange={(e) => setEditingAction({ ...editingAction!, status: e.target.value })} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d0d0d0', borderRadius: '4px', fontSize: '14px' }}>
                <option value="PENDING">Pending</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '14px', color: '#555' }}>Description</label>
              <textarea rows={3} value={editingAction?.description || ''} onChange={(e) => setEditingAction({ ...editingAction!, description: e.target.value })} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d0d0d0', borderRadius: '4px', fontSize: '14px' }} />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '14px', color: '#555' }}>Due Date</label>
              <input type="date" value={editingAction?.dueDate ? new Date(editingAction.dueDate).toISOString().split('T')[0] : ''} onChange={(e) => setEditingAction({ ...editingAction!, dueDate: e.target.value || null })} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d0d0d0', borderRadius: '4px', fontSize: '14px' }} />
            </div>

            <div style={{ marginBottom: '16px', fontSize: '12px', color: '#999' }}>
              <div>Debtor ID: {selectedAction.debtorId}</div>
              <div>Created: {formatDateUTC(selectedAction.createdAt)}</div>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => { const statuses = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']; const currentIndex = statuses.indexOf(selectedAction.status); const nextStatus = statuses[(currentIndex + 1) % statuses.length]; updateActionStatus(selectedAction.id, nextStatus); }} style={{ background: '#17a2b8', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>🔄 Next Status</button>
              <button type="button" onClick={() => deleteAction(selectedAction.id)} style={{ background: '#dc3545', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>🗑️ Delete</button>
              <button type="submit" style={{ background: '#F01428', color: 'white', border: 'none', padding: '8px 24px', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>💾 Save</button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const renderDebtorDetailModal = () => {
    if (!showDebtorDetail || !selectedDebtor) return null;

    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, overflow: 'auto', padding: '20px' }} onClick={() => setShowDebtorDetail(false)}>
        <div style={{ background: 'white', borderRadius: '12px', padding: '32px', maxWidth: '900px', width: '95%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }} onClick={(e) => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '24px' }}>👤 Debtor Profile</h2>
            <button onClick={() => setShowDebtorDetail(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#999' }}>✕</button>
          </div>

          {debtorDetailLoading ? (
            <LoadingSpinner message="Loading debtor details..." />
          ) : (
            <>
              <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', marginBottom: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div><strong>Name:</strong> {selectedDebtor.name}</div>
                <div><strong>Email:</strong> {selectedDebtor.email || 'N/A'}</div>
                <div><strong>Phone:</strong> {selectedDebtor.phone || 'N/A'}</div>
                <div><strong>Address:</strong> {selectedDebtor.address || 'N/A'}</div>
                <div><strong>Status:</strong> <span style={{ padding: '2px 8px', borderRadius: '4px', background: selectedDebtor.status === 'ACTIVE' ? '#d4edda' : '#f8d7da', color: selectedDebtor.status === 'ACTIVE' ? '#155724' : '#721c24', fontSize: '12px' }}>{selectedDebtor.status}</span></div>
                <div><strong>ID:</strong> {selectedDebtor.id}</div>
                <div><strong>Created:</strong> {formatDateUTC(selectedDebtor.createdAt)}</div>
              </div>

              {/* Quick Action */}
              <div style={{ background: '#f8f9fa', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
                <h3 style={{ marginBottom: '12px', fontSize: '16px' }}>⚡ Quick Action</h3>
                <form onSubmit={createQuickAction} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <select value={quickActionForm.type} onChange={(e) => setQuickActionForm({ ...quickActionForm, type: e.target.value })} style={{ padding: '8px 12px', border: '1px solid #d0d0d0', borderRadius: '4px', fontSize: '14px', flex: '1', minWidth: '120px' }}>
                    <option value="REMINDER">Reminder</option>
                    <option value="DEMAND_LETTER">Demand Letter</option>
                    <option value="PAYMENT_PLAN">Payment Plan</option>
                    <option value="FINAL_NOTICE">Final Notice</option>
                    <option value="LEGAL">Legal Action</option>
                    <option value="CUSTOM">Custom</option>
                  </select>
                  <input type="text" placeholder="Title" value={quickActionForm.title} onChange={(e) => setQuickActionForm({ ...quickActionForm, title: e.target.value })} style={{ padding: '8px 12px', border: '1px solid #d0d0d0', borderRadius: '4px', fontSize: '14px', flex: '1', minWidth: '150px' }} required />
                  <input type="date" value={quickActionForm.dueDate} onChange={(e) => setQuickActionForm({ ...quickActionForm, dueDate: e.target.value })} style={{ padding: '8px 12px', border: '1px solid #d0d0d0', borderRadius: '4px', fontSize: '14px', width: '150px' }} />
                  <button type="submit" style={{ background: '#F01428', color: 'white', border: 'none', padding: '8px 20px', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}>➕ Add</button>
                </form>
              </div>

              {/* Quick Email */}
              <div style={{ background: '#f8f9fa', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
                <h3 style={{ marginBottom: '12px', fontSize: '16px' }}>📧 Quick Email</h3>
                <form onSubmit={sendQuickEmail}>
                  <div style={{ marginBottom: '8px' }}>
                    <select value={quickEmailForm.templateId} onChange={(e) => { const templateId = e.target.value; if (templateId) { const template = templates.find(t => t.id === templateId); if (template) loadTemplateIntoQuickEmail(template); } else { setQuickEmailForm({ ...quickEmailForm, templateId: '', subject: '', content: '' }); } }} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d0d0d0', borderRadius: '4px', fontSize: '14px' }}>
                      <option value="">-- Load Template --</option>
                      {templates.map((template) => (
                        <option key={template.id} value={template.id}>{template.name} ({template.channel})</option>
                      ))}
                    </select>
                  </div>
                  <input type="text" placeholder="Subject" value={quickEmailForm.subject} onChange={(e) => setQuickEmailForm({ ...quickEmailForm, subject: e.target.value })} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d0d0d0', borderRadius: '4px', fontSize: '14px', marginBottom: '8px' }} required />
                  <textarea rows={2} placeholder="Content" value={quickEmailForm.content} onChange={(e) => setQuickEmailForm({ ...quickEmailForm, content: e.target.value })} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d0d0d0', borderRadius: '4px', fontSize: '14px', marginBottom: '8px' }} required />
                  <button type="submit" style={{ background: '#17a2b8', color: 'white', border: 'none', padding: '8px 20px', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}>📤 Send</button>
                </form>
              </div>

              {/* Actions */}
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ marginBottom: '12px', fontSize: '16px' }}>📋 Actions ({debtorActions.length})</h3>
                {debtorActions.length === 0 ? (
                  <div style={{ color: '#999', padding: '10px' }}>No actions for this debtor</div>
                ) : (
                  <ul style={{ listStyle: 'none' }}>
                    {debtorActions.map((action) => {
                      const badge = getStatusBadge(action.status);
                      return (
                        <li key={action.id} style={{ padding: '10px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <strong>{action.title}</strong> <span style={{ fontSize: '12px', color: '#888' }}>{action.type}</span>
                            <div style={{ fontSize: '12px', color: '#999' }}>{action.description || 'No description'}</div>
                          </div>
                          <span style={{ padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', background: badge.background, color: badge.color }}>{action.status}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {/* Communications */}
              <div>
                <h3 style={{ marginBottom: '12px', fontSize: '16px' }}>📧 Communications ({debtorCommunications.length})</h3>
                {debtorCommunications.length === 0 ? (
                  <div style={{ color: '#999', padding: '10px' }}>No communications for this debtor</div>
                ) : (
                  <ul style={{ listStyle: 'none' }}>
                    {debtorCommunications.map((comm) => {
                      const badge = getStatusBadge(comm.status);
                      return (
                        <li key={comm.id} style={{ padding: '10px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <strong>{comm.subject || 'No subject'}</strong> <span style={{ fontSize: '12px', color: '#888' }}>{comm.channel}</span>
                            <div style={{ fontSize: '12px', color: '#999' }}>To: {comm.contactEmail || 'Unknown'}</div>
                          </div>
                          <span style={{ padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', background: badge.background, color: badge.color }}>{comm.status}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              {/* ============================================
                  AI COPILOT PANEL
                  ============================================ */}
              <div style={{
                marginBottom: '20px',
                border: '2px solid #F01428',
                borderRadius: '8px',
                padding: '16px',
                background: '#f8f9fa'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '12px'
                }}>
                  <h3 style={{ margin: 0, color: '#F01428', fontSize: '16px' }}>
                    🤖 AI Copilot
                  </h3>
                  <button
                    onClick={() => selectedDebtor && getCopilotRecommendation(selectedDebtor.id)}
                    disabled={copilotLoading}
                    style={{
                      background: '#F01428',
                      color: 'white',
                      border: 'none',
                      padding: '6px 16px',
                      borderRadius: '4px',
                      cursor: copilotLoading ? 'not-allowed' : 'pointer',
                      fontSize: '13px',
                      opacity: copilotLoading ? 0.6 : 1
                    }}
                  >
                    {copilotLoading ? '⏳ Analyzing...' : '💡 Get Recommendation'}
                  </button>
                </div>

                {copilotError && (
                  <div style={{
                    background: '#f8d7da',
                    color: '#721c24',
                    padding: '10px',
                    borderRadius: '4px',
                    marginBottom: '10px',
                    fontSize: '14px'
                  }}>
                    ❌ {copilotError}
                  </div>
                )}

                {copilotRecommendation && (
                  <div>
                    {/* Recommendation Card */}
                    <div style={{
                      background: 'white',
                      padding: '12px',
                      borderRadius: '4px',
                      marginBottom: '10px',
                      border: '1px solid #e0e0e0'
                    }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap'
                      }}>
                        <div>
                          <span style={{
                            background: copilotRecommendation.recommendation?.priority === 'HIGH' ? '#F01428' : 
                                        copilotRecommendation.recommendation?.priority === 'MEDIUM' ? '#ffc107' : '#28a745',
                            color: 'white',
                            padding: '2px 10px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 'bold'
                          }}>
                            {copilotRecommendation.recommendation?.priority || 'MEDIUM'}
                          </span>
                          <span style={{
                            marginLeft: '8px',
                            fontSize: '14px',
                            fontWeight: 'bold'
                          }}>
                            📧 {copilotRecommendation.recommendation?.channel || 'EMAIL'}
                          </span>
                          <span style={{
                            marginLeft: '8px',
                            fontSize: '12px',
                            color: '#666'
                          }}>
                            {copilotRecommendation.recommendation?.tone || 'PROFESSIONAL'}
                          </span>
                        </div>
                        <span style={{
                          fontSize: '11px',
                          color: '#999'
                        }}>
                          ⏱ {copilotRecommendation.recommendation?.timing || 'WITHIN_48_HOURS'}
                        </span>
                      </div>
                      <p style={{
                        fontSize: '13px',
                        marginTop: '8px',
                        marginBottom: '0',
                        color: '#333'
                      }}>
                        {copilotRecommendation.recommendation?.rationale || 'No rationale provided'}
                      </p>
                      {copilotRecommendation.usedFallback && (
                        <p style={{
                          fontSize: '12px',
                          color: '#856404',
                          marginTop: '4px',
                          background: '#fff3cd',
                          padding: '4px 8px',
                          borderRadius: '4px'
                        }}>
                          ⚠️ Using fallback rules (AI not available)
                        </p>
                      )}
                    </div>

                    {/* Email Draft */}
                    {copilotRecommendation.emailDraft && (
                      <div style={{
                        background: 'white',
                        padding: '12px',
                        borderRadius: '4px',
                        marginBottom: '10px',
                        border: '1px solid #e0e0e0'
                      }}>
                        <p style={{
                          fontSize: '13px',
                          fontWeight: 'bold',
                          margin: '0 0 4px 0',
                          color: '#0056b3'
                        }}>
                          📝 Draft Email
                        </p>
                        <p style={{
                          fontSize: '13px',
                          fontWeight: '600',
                          margin: '0 0 4px 0'
                        }}>
                          Subject: {copilotRecommendation.emailDraft.subject}
                        </p>
                        <div style={{
                          fontSize: '13px',
                          margin: '0',
                          whiteSpace: 'pre-wrap',
                          background: '#f1f3f5',
                          padding: '8px',
                          borderRadius: '4px',
                          maxHeight: '150px',
                          overflow: 'auto'
                        }}>
                          {copilotRecommendation.emailDraft.body}
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div style={{
                      display: 'flex',
                      gap: '8px',
                      justifyContent: 'flex-end',
                      flexWrap: 'wrap'
                    }}>
                      <button
                        onClick={loadDraftIntoEmail}
                        style={{
                          background: '#28a745',
                          color: 'white',
                          border: 'none',
                          padding: '6px 16px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '13px'
                        }}
                      >
                        📝 Load Draft
                      </button>
                      <button
                        onClick={approveAndSend}
                        style={{
                          background: '#007bff',
                          color: 'white',
                          border: 'none',
                          padding: '6px 16px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '13px'
                        }}
                      >
                        ✅ Approve & Send
                      </button>
                      <button
                        onClick={() => {
                          setCopilotRecommendation(null);
                          setCopilotError(null);
                        }}
                        style={{
                          background: '#6c757d',
                          color: 'white',
                          border: 'none',
                          padding: '6px 16px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '13px'
                        }}
                      >
                        ✕ Dismiss
                      </button>
                    </div>
                  </div>
                )}
              </div>
<div style={{ marginTop: '20px', display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
  <button
    onClick={() => initiateLiveCall(selectedDebtor.phone)}
    style={{
      background: '#28a745',
      color: 'white',
      border: 'none',
      padding: '8px 16px',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: 600
    }}
    onMouseEnter={(e) => e.currentTarget.style.background = '#218838'}
    onMouseLeave={(e) => e.currentTarget.style.background = '#28a745'}
  >
    📞 Call Debtor
  </button>
  <button onClick={() => deleteDebtor(selectedDebtor.id)} style={{ background: '#dc3545', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>🗑️ Delete Debtor</button>
  <button onClick={() => setShowDebtorDetail(false)} style={{ background: '#e0e0e0', color: '#333', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>Close</button>
</div>
            </>
          )}
        </div>
      </div>
    );
  };

  const renderDebtorSelectorModal = () => {
    if (!showDebtorSelector) return null;

    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }} onClick={() => setShowDebtorSelector(false)}>
        <div style={{ background: 'white', borderRadius: '12px', padding: '32px', maxWidth: '600px', width: '100%', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }} onClick={(e) => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '20px' }}>👤 Select a Debtor</h2>
            <button onClick={() => setShowDebtorSelector(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#999' }}>✕</button>
          </div>

          {debtorsLoading ? (
            <LoadingSpinner message="Loading debtors..." />
          ) : debtors.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
              <div style={{ fontSize: '48px' }}>📭</div>
              <p>No debtors found. Please add a debtor first.</p>
            </div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {debtors.map((debtor) => (
                <li key={debtor.id} onClick={() => handleDebtorSelect(debtor)} style={{ padding: '12px 16px', borderBottom: '1px solid #eee', cursor: 'pointer', transition: 'all 0.2s', borderRadius: '4px' }} onMouseEnter={(e) => { e.currentTarget.style.background = '#f0f0f0'; e.currentTarget.style.transform = 'translateX(4px)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.transform = 'translateX(0)'; }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div><strong>{debtor.name}</strong></div>
                      <div style={{ fontSize: '12px', color: '#666' }}>{debtor.email || 'No email'} | {debtor.phone || 'No phone'}</div>
                    </div>
                    <div style={{ fontSize: '12px', color: '#999' }}>
                      {selectorMode === 'email' && '📧'}
                      {selectorMode === 'sms' && '📱'}
                      {selectorMode === 'push' && '🔔'}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  };

  // ==================== SIDEBAR ====================
  const sidebarItems = [
    { id: 'communications', label: 'Communications', icon: '📱' },
    { id: 'actions', label: 'Actions', icon: '📋' },
    { id: 'debtors', label: 'Debtors', icon: '👤' },
    { id: 'templates', label: 'Templates', icon: '📝' },
    { id: 'dashboard', label: 'Dashboard', icon: '📊' }
  ];

  // ==================== PAGE RENDER ====================
  const renderPage = () => {
    switch (activePage) {
      case 'communications': return renderCommunications();
      case 'actions': return renderActionsPage();
      case 'debtors': return renderDebtorsPage();
      case 'templates': return renderTemplatesPage();
      case 'dashboard': return renderDashboardPage();
      default: return <div>Page not found</div>;
    }
  };

  // ==================== MAIN RETURN ====================
  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: '#1a1a1a', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '36px', color: '#F01428' }}>GORKA</h1>
          <LoadingSpinner message="Loading..." />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return showRegister ? (
      <RegisterPage onSwitchToLogin={() => setShowRegister(false)} />
    ) : (
      <LoginPage onSwitchToRegister={() => setShowRegister(true)} />
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f0f2f5' }}>
      <Toaster position="top-right" />

      <ConfirmDialog
        isOpen={showConfirmDialog}
        title={confirmDialogProps.title}
        message={confirmDialogProps.message}
        onConfirm={confirmDialogProps.onConfirm}
        onCancel={() => setShowConfirmDialog(false)}
        confirmText={confirmDialogProps.confirmText}
        confirmColor={confirmDialogProps.confirmColor}
      />

      {/* Sidebar */}
      <div className="sidebar" style={{
        width: sidebarOpen ? '260px' : '60px',
        background: '#e8f4f8',
        color: '#2c3e50',
        padding: '20px 0',
        position: 'fixed',
        height: '100vh',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        boxShadow: '2px 0 8px rgba(0,0,0,0.05)',
        transition: 'width 0.3s ease'
      }}>
        <div>
          <div style={{ padding: '0 24px 24px', borderBottom: '1px solid #c0dce8', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h1 style={{ fontSize: sidebarOpen ? '24px' : '18px', color: '#F01428', transition: 'font-size 0.3s ease', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                {sidebarOpen ? 'GORKA' : 'G'}
              </h1>
              {sidebarOpen && <small style={{ color: '#5a7a8a' }}>Collection Platform</small>}
            </div>
            <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#4a6a7a', transition: 'transform 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}>
              {sidebarOpen ? '◀' : '▶'}
            </button>
          </div>

          {user && sidebarOpen && (
            <div style={{ padding: '0 24px 16px', fontSize: '12px', color: '#4a6a7a', borderBottom: '1px solid #c0dce8', marginBottom: '16px' }}>
              {user.email}
              <span style={{ display: 'block', fontSize: '10px', color: '#5a7a8a' }}>Role: {user.role}</span>
            </div>
          )}

          {sidebarItems.map((item) => (
            <div key={item.id} style={{
              padding: sidebarOpen ? '12px 24px' : '12px 16px',
              background: activePage === item.id ? '#c0dce8' : 'transparent',
              color: activePage === item.id ? '#1a2a3a' : '#4a6a7a',
              borderRight: activePage === item.id ? '3px solid #F01428' : 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontWeight: activePage === item.id ? 600 : 400,
              borderRadius: activePage === item.id ? '0 8px 8px 0' : '0',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              whiteSpace: 'nowrap',
              overflow: 'hidden'
            }}
            onMouseEnter={(e) => { if (activePage !== item.id) { e.currentTarget.style.background = '#d4e8f0'; e.currentTarget.style.color = '#1a2a3a'; } }}
            onMouseLeave={(e) => { if (activePage !== item.id) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#4a6a7a'; } }}
            onClick={() => setActivePage(item.id)}
          >
            <span className="sidebar-icon" style={{ fontSize: sidebarOpen ? '18px' : '20px' }}>{item.icon}</span>
            {sidebarOpen && <span className="sidebar-text">{item.label}</span>}
          </div>
          ))}
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid #c0dce8' }}>
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              background: 'transparent',
              color: '#dc3545',
              border: '1px solid #dc3545',
              padding: sidebarOpen ? '8px' : '4px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: sidebarOpen ? '14px' : '10px',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
              overflow: 'hidden'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#dc3545'; e.currentTarget.style.color = 'white'; e.currentTarget.style.transform = 'scale(1.02)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#dc3545'; e.currentTarget.style.transform = 'scale(1)'; }}
          >
            {sidebarOpen ? '🚪 Logout' : '🚪'}
          </button>
        </div>
      </div>

      <div className="main-content" style={{
        marginLeft: sidebarOpen ? '260px' : '60px',
        padding: '24px',
        flex: 1,
        transition: 'margin-left 0.3s ease'
      }}>
        {renderPage()}
      </div>

      {/* Modals */}
      {renderActionDetailModal()}
      {renderDebtorDetailModal()}
      {renderDebtorSelectorModal()}
    </div>
  );
};

// ==================== APP ====================
const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;