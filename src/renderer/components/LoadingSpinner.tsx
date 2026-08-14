import React from 'react';

interface LoadingSpinnerProps {
  size?: number;
  color?: string;
  message?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 40,
  color = '#F01428',
  message = 'Loading...',
}) => {
  return (
    <div style={{ textAlign: 'center', padding: '20px' }}>
      <div
        style={{
          display: 'inline-block',
          width: size,
          height: size,
          border: `4px solid ${color}33`,
          borderTopColor: color,
          borderRadius: '50%',
          animation: 'spin 0.8s ease-in-out infinite',
        }}
      />
      {message && (
        <p style={{ marginTop: '12px', color: '#666', fontSize: '14px' }}>
          {message}
        </p>
      )}
    </div>
  );
};