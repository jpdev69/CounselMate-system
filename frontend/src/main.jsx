import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './contexts/AuthContext';
import { SlipsProvider } from './contexts/SlipsContext';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <SlipsProvider>
        <App />
      </SlipsProvider>
    </AuthProvider>
  </React.StrictMode>,
)