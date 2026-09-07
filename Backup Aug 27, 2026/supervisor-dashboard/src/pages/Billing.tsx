import React from 'react';

const Billing: React.FC = () => {
  return (
    <div>
      <h1 style={{
        fontSize: '28px',
        fontWeight: 500,
        color: '#111111',
        marginBottom: '8px'
      }}>
        Billing
      </h1>
      <p style={{
        fontSize: '16px',
        color: '#4A4A4A',
        marginBottom: '32px'
      }}>
        Manage your subscription and usage
      </p>

      <div style={{
        background: '#FFFFFF',
        border: '1px solid #E3E3E3',
        borderRadius: '6px',
        padding: '40px',
        textAlign: 'center',
        color: '#8A8A8A'
      }}>
        Billing information will appear here
      </div>
    </div>
  );
};

export default Billing;