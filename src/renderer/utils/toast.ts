import toast from 'react-hot-toast';

export const showToast = {
  success: (message: string) => {
    toast.success(message, {
      duration: 3000,
      position: 'top-right',
      style: {
        background: '#d4edda',
        color: '#155724',
        border: '1px solid #c3e6cb',
        padding: '12px 20px',
        borderRadius: '8px',
      },
    });
  },
  error: (message: string) => {
    toast.error(message, {
      duration: 4000,
      position: 'top-right',
      style: {
        background: '#f8d7da',
        color: '#721c24',
        border: '1px solid #f5c6cb',
        padding: '12px 20px',
        borderRadius: '8px',
      },
    });
  },
  info: (message: string) => {
    toast(message, {
      duration: 3000,
      position: 'top-right',
      style: {
        background: '#cce5ff',
        color: '#004085',
        border: '1px solid #b8daff',
        padding: '12px 20px',
        borderRadius: '8px',
      },
    });
  },
};