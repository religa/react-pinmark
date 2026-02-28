import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './demo.css';
// base.css is imported automatically by CommentOverlay

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
