// src/components/AdminLayout.jsx
import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, Shield } from 'lucide-react';
import '../App.css';

const AdminLayout = ({ children }) => {
  const { user, logout } = useAuth();

  return (
    <div className="layout">
      {/* Top Header Navigation */}
      <header className="top-header" style={{ background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)' }}>
        <div className="top-header-left">
          <img src="/GuidanceOS-system-logo.png" alt="ISU Logo" className="top-header-logo" />
          <h1 className="top-header-title">GuidanceOS Admin</h1>
        </div>
        
        <div className="top-header-right">
          <div className="user-profile">
            <div className="user-avatar-icon" style={{ background: '#dc2626' }}>
              <Shield size={16} />
            </div>
            <span className="user-name">System Administrator</span>
          </div>
          <button
            onClick={logout}
            className="logout-btn-header"
            title="Logout"
          >
            <LogOut size={16} />
            <span className="logout-text">Logout</span>
          </button>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="main-content" style={{ background: '#f8fafc', padding: '20px' }}>
        <div className="main-container">
          {/* Admin Header */}
          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '8px',
            marginBottom: '20px',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                background: '#dc2626',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Shield size={24} color="white" />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600', color: '#1e293b' }}>
                  Administrator Portal
                </h2>
                <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>
                  System configuration and management
                </p>
              </div>
            </div>
          </div>
          
          {children}
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
