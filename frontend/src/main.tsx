import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found in DOM.');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
