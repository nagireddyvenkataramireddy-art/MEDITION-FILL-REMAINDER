
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Robust Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Use relative path './sw.js' and set scope to './' to avoid origin issues in previews
    navigator.serviceWorker.register('./sw.js', { scope: './' })
      .then(registration => {
        console.log('SW registered with scope:', registration.scope);
      })
      .catch(error => {
        console.warn('SW registration failed (this is common in preview environments):', error);
      });
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
