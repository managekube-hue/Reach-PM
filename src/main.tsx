import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

function showRuntimeError(message: string) {
  const existing = document.getElementById('__reach-runtime-error');
  const el = existing || document.createElement('div');
  el.id = '__reach-runtime-error';
  el.setAttribute(
    'style',
    'position:fixed;top:8px;left:8px;right:8px;z-index:99999;padding:10px 12px;background:#3f1010;color:#ffd2d2;border:1px solid #a33;border-radius:8px;font:12px/1.4 monospace;white-space:pre-wrap;'
  );
  el.textContent = `REACH runtime error: ${message}`;
  if (!existing) {
    document.body.appendChild(el);
  }
}

window.addEventListener('error', (event) => {
  const msg = event.error?.message || event.message || 'Unknown error';
  showRuntimeError(msg);
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = (event as PromiseRejectionEvent).reason;
  const msg = typeof reason === 'string' ? reason : reason?.message || JSON.stringify(reason);
  showRuntimeError(msg || 'Unhandled promise rejection');
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
