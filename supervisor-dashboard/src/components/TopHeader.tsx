import React from 'react';
import { Search, Bell } from 'lucide-react';

const TopHeader: React.FC = () => {
  return (
    <div style={{
      height: '56px',
      background: '#FFFFFF',
      borderBottom: '1px solid #E3E3E3',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 32px',
      position: 'fixed',
      top: 0,
      left: '240px',
      right: 0,
      zIndex: 100
    }}>
      <div style={{ fontSize: '13px', color: '#4A4A4A' }}>
        Workspace / Dashboard
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <Search size={18} strokeWidth={1.7} color="#8A8A8A" style={{ cursor: 'pointer' }} />
        <Bell size={18} strokeWidth={1.7} color="#8A8A8A" style={{ cursor: 'pointer' }} />
        <div style={{
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          background: '#7C3AED',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
          fontWeight: 600
        }}>
          JS
        </div>
      </div>
    </div>
  );
};

export default TopHeader;