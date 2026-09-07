import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL || '';

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    companyName: '',
    clientType: 'AGENCY',
    registrationNumber: '',
    taxId: '',
    primaryContact: '',
    contactEmail: '',
    contactPhone: '',
    address: '',
    website: '',
    billingEmail: '',
    billingPhone: '',
    password: '',
    confirmPassword: '',
    termsAccepted: false
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    // Validate password length
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      setLoading(false);
      return;
    }

    // Validate terms
    if (!formData.termsAccepted) {
      setError('You must accept the Terms of Service');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyName: formData.companyName,
          clientType: formData.clientType,
          registrationNumber: formData.registrationNumber || undefined,
          taxId: formData.taxId || undefined,
          primaryContact: formData.primaryContact,
          contactEmail: formData.contactEmail,
          contactPhone: formData.contactPhone,
          address: formData.address || undefined,
          website: formData.website || undefined,
          billingEmail: formData.billingEmail || undefined,
          billingPhone: formData.billingPhone || undefined,
          password: formData.password,
          termsAccepted: formData.termsAccepted
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      setSuccess(true);
      // Store the email for verification
      localStorage.setItem('pendingVerificationEmail', formData.contactEmail);
      
      // Redirect to verification page after 2 seconds
      setTimeout(() => {
        navigate('/verify-email?email=' + encodeURIComponent(formData.contactEmail));
      }, 2000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h2 style={styles.title}>✅ Registration Successful!</h2>
          <p style={styles.message}>
            A verification email has been sent to <strong>{formData.contactEmail}</strong>.
            Please check your inbox and click the verification link.
          </p>
          <p style={styles.message}>
            You will be redirected to the verification page...
          </p>
          <Link to={`/verify-email?email=${encodeURIComponent(formData.contactEmail)}`} style={styles.link}>
            Click here if you are not redirected
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.logo}>GORKA</h1>
        <h2 style={styles.subtitle}>Create Your Account</h2>
        <p style={styles.description}>
          Join GORKA to start managing your debt recovery operations.
        </p>

        {error && (
          <div style={styles.error}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          {/* Company Information */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Company Information</h3>
            
            <div style={styles.row}>
              <div style={styles.field}>
                <label style={styles.label}>Company Name *</label>
                <input
                  type="text"
                  name="companyName"
                  value={formData.companyName}
                  onChange={handleChange}
                  required
                  style={styles.input}
                  placeholder="e.g., Agency Alpha"
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Client Type *</label>
                <select
                  name="clientType"
                  value={formData.clientType}
                  onChange={handleChange}
                  style={{ ...styles.input, ...styles.select }}
                  required
                >
                  <option value="AGENCY">Collection Agency</option>
                  <option value="BANK">Bank</option>
                  <option value="LAW_FIRM">Law Firm</option>
                  <option value="FINANCE">Finance Company</option>
                  <option value="CORPORATE">Corporate</option>
                </select>
              </div>
            </div>

            <div style={styles.row}>
              <div style={styles.field}>
                <label style={styles.label}>Registration Number</label>
                <input
                  type="text"
                  name="registrationNumber"
                  value={formData.registrationNumber}
                  onChange={handleChange}
                  style={styles.input}
                  placeholder="e.g., REG-2024-001"
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Tax ID</label>
                <input
                  type="text"
                  name="taxId"
                  value={formData.taxId}
                  onChange={handleChange}
                  style={styles.input}
                  placeholder="e.g., TAX-987654321"
                />
              </div>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Website</label>
              <input
                type="url"
                name="website"
                value={formData.website}
                onChange={handleChange}
                style={styles.input}
                placeholder="https://example.com"
              />
            </div>
          </div>

          {/* Contact Information */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Contact Information</h3>

            <div style={styles.field}>
              <label style={styles.label}>Primary Contact Name *</label>
              <input
                type="text"
                name="primaryContact"
                value={formData.primaryContact}
                onChange={handleChange}
                required
                style={styles.input}
                placeholder="e.g., John Doe"
              />
            </div>

            <div style={styles.row}>
              <div style={styles.field}>
                <label style={styles.label}>Contact Email *</label>
                <input
                  type="email"
                  name="contactEmail"
                  value={formData.contactEmail}
                  onChange={handleChange}
                  required
                  style={styles.input}
                  placeholder="john@company.com"
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Contact Phone *</label>
                <input
                  type="tel"
                  name="contactPhone"
                  value={formData.contactPhone}
                  onChange={handleChange}
                  required
                  style={styles.input}
                  placeholder="+1 (555) 123-4567"
                />
              </div>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Address</label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleChange}
                style={{ ...styles.input, ...styles.textarea }}
                placeholder="123 Main St, City, State, ZIP"
                rows={2}
              />
            </div>

            <div style={styles.row}>
              <div style={styles.field}>
                <label style={styles.label}>Billing Email</label>
                <input
                  type="email"
                  name="billingEmail"
                  value={formData.billingEmail}
                  onChange={handleChange}
                  style={styles.input}
                  placeholder="billing@company.com"
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Billing Phone</label>
                <input
                  type="tel"
                  name="billingPhone"
                  value={formData.billingPhone}
                  onChange={handleChange}
                  style={styles.input}
                  placeholder="+1 (555) 123-4568"
                />
              </div>
            </div>
          </div>

          {/* Account Setup */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Account Setup</h3>

            <div style={styles.row}>
              <div style={styles.field}>
                <label style={styles.label}>Password *</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  style={styles.input}
                  placeholder="Min 8 characters"
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Confirm Password *</label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  style={styles.input}
                  placeholder="Confirm your password"
                />
              </div>
            </div>
          </div>

          {/* Terms */}
          <div style={styles.termsContainer}>
            <input
              type="checkbox"
              name="termsAccepted"
              checked={formData.termsAccepted}
              onChange={handleChange}
              style={styles.checkbox}
              required
            />
            <label style={styles.termsLabel}>
              I agree to the{' '}
              <a href="/terms" style={styles.termsLink}>Terms of Service</a>
              {' '}and{' '}
              <a href="/privacy" style={styles.termsLink}>Privacy Policy</a>
            </label>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.submitButton,
              ...(loading ? styles.submitButtonDisabled : {})
            }}
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>

          <p style={styles.loginText}>
            Already have an account?{' '}
            <Link to="/login" style={styles.loginLink}>
              Sign In
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
};

// ========== STYLES ==========
const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
    padding: '24px'
  },
  card: {
    maxWidth: '760px',
    width: '100%',
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
    padding: '48px',
    border: '1px solid #E5E7EB'
  },
  logo: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#7C3AED',
    margin: '0 0 4px 0',
    letterSpacing: '-0.5px'
  },
  subtitle: {
    fontSize: '22px',
    fontWeight: '600',
    color: '#111827',
    margin: '0 0 8px 0'
  },
  description: {
    fontSize: '14px',
    color: '#6B7280',
    margin: '0 0 24px 0'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px'
  },
  section: {
    borderBottom: '1px solid #F3F4F6',
    paddingBottom: '20px'
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#111827',
    margin: '0 0 16px 0'
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px'
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  label: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#374151'
  },
  input: {
    padding: '10px 14px',
    border: '1px solid #D1D5DB',
    borderRadius: '6px',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.15s',
    fontFamily: 'inherit',
    width: '100%',
    boxSizing: 'border-box'
  },
  select: {
    appearance: 'auto',
    backgroundColor: 'white'
  },
  textarea: {
    resize: 'vertical',
    minHeight: '60px'
  },
  checkbox: {
    width: '18px',
    height: '18px',
    accentColor: '#7C3AED',
    cursor: 'pointer',
    flexShrink: 0
  },
  termsContainer: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    paddingTop: '4px'
  },
  termsLabel: {
    fontSize: '14px',
    color: '#374151',
    lineHeight: '1.5'
  },
  termsLink: {
    color: '#7C3AED',
    textDecoration: 'none',
    fontWeight: '500'
  },
  submitButton: {
    padding: '12px 24px',
    backgroundColor: '#7C3AED',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
    marginTop: '4px'
  },
  submitButtonDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed'
  },
  loginText: {
    textAlign: 'center',
    fontSize: '14px',
    color: '#6B7280',
    margin: '12px 0 0 0'
  },
  loginLink: {
    color: '#7C3AED',
    textDecoration: 'none',
    fontWeight: '500'
  },
  error: {
    padding: '12px 16px',
    backgroundColor: '#FEE2E2',
    color: '#DC2626',
    borderRadius: '6px',
    fontSize: '14px',
    marginBottom: '16px'
  },
  message: {
    fontSize: '15px',
    color: '#374151',
    margin: '8px 0',
    lineHeight: '1.6'
  },
  link: {
    color: '#7C3AED',
    textDecoration: 'none',
    fontWeight: '500',
    display: 'inline-block',
    marginTop: '12px'
  }
};

export default RegisterPage;