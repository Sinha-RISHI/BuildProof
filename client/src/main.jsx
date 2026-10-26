/**
 * main.jsx
 *
 * What this file does:
 *   The entry point that React uses to start the application.
 *   It finds the <div id="root"> in index.html and renders the App component
 *   into it. It also imports index.css, which loads Tailwind CSS.
 *
 * How it fits into BuildProof:
 *   Every React app needs exactly one file like this. You should rarely need
 *   to change it; all real application code lives in App.jsx and its children.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
