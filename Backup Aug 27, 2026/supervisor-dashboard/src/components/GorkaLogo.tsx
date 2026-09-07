import React from 'react';

const GorkaLogo: React.FC = () => {
  return (
    <div style={{
      height: '56px',
      padding: '0 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',  // ← CENTER the logo!
      borderBottom: '1px solid #E3E3E3',
      background: '#FAFAFA'
    }}>
      <span style={{
        fontFamily: "'Inter', -apple-system, 'Segoe UI', sans-serif",
        fontSize: '24px',        // ← 30% larger! (was 18px → 24px)
        fontWeight: 700,
        letterSpacing: '0.02em',
        color: '#DC2626',
        textTransform: 'uppercase'
      }}>
        GORKA
      </span>
    </div>
  );
};

export default GorkaLogo;