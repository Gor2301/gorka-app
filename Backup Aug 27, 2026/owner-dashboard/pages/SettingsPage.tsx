import React, { useState } from 'react';
import OwnerAppShell from '../components/OwnerAppShell';

interface Plan {
  id: string;
  name: string;
  price: number;
  aiCalls: string;
  comms: string;
  debtors: string;
  features: string[];
}

interface FeatureFlag {
  id: string;
  name: string;
  enabled: boolean;
  description: string;
}

const SettingsPage: React.FC = () => {
  // Pricing Plans
  const [plans] = useState<Plan[]>([
    {
      id: '1',
      name: 'Starter',
      price: 29,
      aiCalls: '50/mo',
      comms: '100',
      debtors: '1,000',
      features: ['Basic AI Copilot', 'Email only', 'Single user']
    },
    {
      id: '2',
      name: 'Pro',
      price: 99,
      aiCalls: '500/mo',
      comms: '1,000',
      debtors: '10,000',
      features: ['Advanced AI Copilot', 'Email + SMS', '5 users', 'API Access']
    },
    {
      id: '3',
      name: 'Enterprise',
      price: 0,
      aiCalls: 'Unlimited',
      comms: 'Unlimited',
      debtors: 'Unlimited',
      features: ['Custom AI', 'All channels', 'Unlimited users', 'Dedicated support', 'Custom integration']
    },
  ]);

  // Feature Flags
  const [featureFlags, setFeatureFlags] = useState<FeatureFlag[]>([
    { id: '1', name: 'AI Copilot', enabled: true, description: 'Enable AI-powered recommendations for agents' },
    { id: '2', name: 'Multi-Channel Comms', enabled: true, description: 'Enable SMS, Voice, and Push notifications' },
    { id: '3', name: 'Skip Tracing', enabled: false, description: 'Enable skip tracing for debtor discovery' },
    { id: '4', name: 'Voice Calls', enabled: true, description: 'Enable voice call capabilities' },
    { id: '5', name: 'Connectors', enabled: true, description: 'Enable external API connectors' },
  ]);

  // Security Settings
  const [securitySettings] = useState({
    mfaEnabled: true,
    sessionTimeout: 15,
    passwordMinLength: 8,
    requireSpecialChars: true,
  });

  const [activeTab, setActiveTab] = useState<'plans' | 'features' | 'security'>('plans');

  const toggleFeature = (id: string) => {
    setFeatureFlags(prev =>
      prev.map(flag =>
        flag.id === id ? { ...flag, enabled: !flag.enabled } : flag
      )
    );
  };

  return (
    <OwnerAppShell>
      <div>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#111111' }}>
            Platform Settings
          </h2>
          <span style={{ fontSize: '13px', color: '#6B7280' }}>
            GORKA Platform v1.0.0
          </span>
        </div>

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          gap: '4px',
          marginBottom: '24px',
          borderBottom: '1px solid #E3E3E3',
          paddingBottom: '4px'
        }}>
          <button
            onClick={() => setActiveTab('plans')}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderRadius: '6px 6px 0 0',
              backgroundColor: activeTab === 'plans' ? '#7C3AED' : 'transparent',
              color: activeTab === 'plans' ? 'white' : '#4A4A4A',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: activeTab === 'plans' ? '500' : '400'
            }}
          >
            Pricing Plans
          </button>
          <button
            onClick={() => setActiveTab('features')}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderRadius: '6px 6px 0 0',
              backgroundColor: activeTab === 'features' ? '#7C3AED' : 'transparent',
              color: activeTab === 'features' ? 'white' : '#4A4A4A',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: activeTab === 'features' ? '500' : '400'
            }}
          >
            Feature Flags
          </button>
          <button
            onClick={() => setActiveTab('security')}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderRadius: '6px 6px 0 0',
              backgroundColor: activeTab === 'security' ? '#7C3AED' : 'transparent',
              color: activeTab === 'security' ? 'white' : '#4A4A4A',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: activeTab === 'security' ? '500' : '400'
            }}
          >
            Security
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'plans' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <p style={{ fontSize: '14px', color: '#6B7280', margin: 0 }}>
                Manage subscription plans and pricing for all clients
              </p>
              <button style={{
                padding: '8px 16px',
                backgroundColor: '#7C3AED',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '500'
              }}>
                + Add Plan
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              {plans.map((plan) => (
                <div key={plan.id} style={{
                  backgroundColor: 'white',
                  border: plan.name === 'Pro' ? '2px solid #7C3AED' : '1px solid #E3E3E3',
                  borderRadius: '8px',
                  padding: '20px',
                  position: 'relative'
                }}>
                  {plan.name === 'Pro' && (
                    <span style={{
                      position: 'absolute',
                      top: '-10px',
                      right: '16px',
                      backgroundColor: '#7C3AED',
                      color: 'white',
                      padding: '2px 12px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: '600'
                    }}>
                      POPULAR
                    </span>
                  )}
                  <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111111', margin: '0 0 4px 0' }}>
                    {plan.name}
                  </h3>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: '#111111', marginBottom: '8px' }}>
                    {plan.price > 0 ? `$${plan.price}` : 'Custom'}
                    {plan.price > 0 && <span style={{ fontSize: '14px', fontWeight: '400', color: '#6B7280' }}>/mo</span>}
                  </div>
                  <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: '12px', marginTop: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '4px 0' }}>
                      <span style={{ color: '#6B7280' }}>AI Calls</span>
                      <span style={{ fontWeight: '500' }}>{plan.aiCalls}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '4px 0' }}>
                      <span style={{ color: '#6B7280' }}>Communications</span>
                      <span style={{ fontWeight: '500' }}>{plan.comms}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '4px 0' }}>
                      <span style={{ color: '#6B7280' }}>Debtors</span>
                      <span style={{ fontWeight: '500' }}>{plan.debtors}</span>
                    </div>
                  </div>
                  <div style={{ marginTop: '12px' }}>
                    {plan.features.map((feature, idx) => (
                      <div key={idx} style={{ fontSize: '13px', color: '#4A4A4A', padding: '2px 0' }}>
                        ✅ {feature}
                      </div>
                    ))}
                  </div>
                  <button style={{
                    width: '100%',
                    marginTop: '16px',
                    padding: '8px',
                    border: '1px solid #E3E3E3',
                    borderRadius: '6px',
                    backgroundColor: 'white',
                    cursor: 'pointer',
                    fontSize: '13px',
                    color: '#4A4A4A'
                  }}>
                    Edit Plan
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'features' && (
          <div>
            <p style={{ fontSize: '14px', color: '#6B7280', marginBottom: '16px' }}>
              Enable or disable platform features globally
            </p>

            <div style={{
              backgroundColor: 'white',
              border: '1px solid #E3E3E3',
              borderRadius: '8px',
              overflow: 'hidden'
            }}>
              {featureFlags.map((flag, index) => (
                <div
                  key={flag.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '16px 20px',
                    borderBottom: index < featureFlags.length - 1 ? '1px solid #F3F4F6' : 'none'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: '500', color: '#111111' }}>{flag.name}</div>
                    <div style={{ fontSize: '13px', color: '#6B7280' }}>{flag.description}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{
                      fontSize: '13px',
                      color: flag.enabled ? '#22C55E' : '#6B7280',
                      fontWeight: '500'
                    }}>
                      {flag.enabled ? '✅ On' : '❌ Off'}
                    </span>
                    <button
                      onClick={() => toggleFeature(flag.id)}
                      style={{
                        width: '44px',
                        height: '24px',
                        borderRadius: '12px',
                        border: 'none',
                        backgroundColor: flag.enabled ? '#7C3AED' : '#D1D5DB',
                        cursor: 'pointer',
                        position: 'relative',
                        transition: 'background-color 0.2s ease'
                      }}
                    >
                      <div style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        backgroundColor: 'white',
                        position: 'absolute',
                        top: '3px',
                        left: flag.enabled ? '23px' : '3px',
                        transition: 'left 0.2s ease'
                      }} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div>
            <p style={{ fontSize: '14px', color: '#6B7280', marginBottom: '16px' }}>
              Platform security settings and policies
            </p>

            <div style={{
              backgroundColor: 'white',
              border: '1px solid #E3E3E3',
              borderRadius: '8px',
              padding: '20px'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F3F4F6', paddingBottom: '12px' }}>
                  <div>
                    <div style={{ fontWeight: '500', color: '#111111' }}>Multi-Factor Authentication (MFA)</div>
                    <div style={{ fontSize: '13px', color: '#6B7280' }}>Require MFA for all Owner accounts</div>
                  </div>
                  <span style={{
                    padding: '4px 12px',
                    borderRadius: '12px',
                    fontSize: '13px',
                    fontWeight: '500',
                    backgroundColor: '#DCFCE7',
                    color: '#22C55E'
                  }}>
                    ✅ Enabled
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F3F4F6', paddingBottom: '12px' }}>
                  <div>
                    <div style={{ fontWeight: '500', color: '#111111' }}>Session Timeout</div>
                    <div style={{ fontSize: '13px', color: '#6B7280' }}>Auto-logout after inactivity</div>
                  </div>
                  <span style={{ fontSize: '14px', fontWeight: '500' }}>
                    {securitySettings.sessionTimeout} minutes
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F3F4F6', paddingBottom: '12px' }}>
                  <div>
                    <div style={{ fontWeight: '500', color: '#111111' }}>Password Policy</div>
                    <div style={{ fontSize: '13px', color: '#6B7280' }}>Minimum length and complexity requirements</div>
                  </div>
                  <span style={{ fontSize: '14px', fontWeight: '500' }}>
                    Min {securitySettings.passwordMinLength} chars • {securitySettings.requireSpecialChars ? '✅ Special chars required' : '❌ No special chars'}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: '500', color: '#111111' }}>IP Whitelisting</div>
                    <div style={{ fontSize: '13px', color: '#6B7280' }}>Restrict Owner access to trusted IPs</div>
                  </div>
                  <button style={{
                    padding: '6px 16px',
                    border: '1px solid #E3E3E3',
                    borderRadius: '6px',
                    backgroundColor: 'white',
                    cursor: 'pointer',
                    fontSize: '13px',
                    color: '#4A4A4A'
                  }}>
                    Configure
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </OwnerAppShell>
  );
};

export default SettingsPage;