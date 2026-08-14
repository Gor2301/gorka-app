import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

console.log('🚀 Starting React app...');

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error('❌ Root element not found!');
} else {
  console.log('✅ Root element found');
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  console.log('✅ React rendered successfully');
}