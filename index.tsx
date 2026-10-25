
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Robust Service Worker Registration for Phone Push Reminders
if ('serviceWorker' in navigator) {
  const registerSW = () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(registration => {
        console.log('MediMind SW registered with scope:', registration.scope);
      })
      .catch(error => {
        // Fallback relative scope
        navigator.serviceWorker.register('./sw.js', { scope: './' })
          .catch(e => console.warn('SW registration fallback warning:', e));
      });
  };

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    registerSW();
  } else {
    window.addEventListener('load', registerSW);
  }
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
