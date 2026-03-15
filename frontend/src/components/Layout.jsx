// src/components/Layout.jsx
import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link, useLocation } from 'react-router-dom';
import { LogOut, Home, FileText, Search, User, Key, Menu, Printer, BookOpen, Settings, ClipboardList, Mail } from 'lucide-react';
import { useState } from 'react';
import '../App.css';

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const navigation = [
    { name: 'Dashboard', href: '/', icon: Home },
    { name: 'Print Admission Slip', href: '/print-slip', icon: Printer },
    { name: 'Complete Form', href: '/complete-form', icon: FileText },
    { name: 'Report Student', href: '/report-student', icon: ClipboardList },
    { name: 'Search Violation Records', href: '/search', icon: Search },
    { name: 'Student Manual', href: '/student-manual', icon: BookOpen },
    { name: 'Change Password', href: '/change-password', icon: Key },
    { name: 'Recovery Email', href: '/recovery-email', icon: Mail },
  ];

  const handleSidebarToggle = () => {
    if (window.innerWidth <= 768) {
      setMobileOpen(!mobileOpen);
    } else {
      setCollapsed(!collapsed);
    }
  };

  return (
    <div className="layout">
      {/* Top Header Navigation */}
      <header className="top-header">
        <div className="top-header-left">
          <button
            className="sidebar-toggle"
            onClick={handleSidebarToggle}
            aria-label="Toggle sidebar"
          >
            <Menu size={20} />
          </button>
          <img src="/GuidanceOS-system-logo.png" alt="ISU Logo" className="top-header-logo" />
          <h1 className="top-header-title">GuidanceOS</h1>
        </div>
        
        <div className="top-header-right">
          <div className="user-profile">
            <div className="user-avatar-icon">
              <User size={16} />
            </div>
            <span className="user-name">University Counselor</span>
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
      
      {/* Main Layout Body */}
      <div className={`layout-body ${collapsed ? 'sidebar-collapsed' : ''}`}>
        {/* Sidebar */}
        <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
          <nav className="sidebar-nav">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`nav-item ${isActive ? 'nav-item-active' : ''}`}
                  onClick={() => {
                    if (window.innerWidth <= 768) {
                      setMobileOpen(false);
                    }
                  }}
                >
                  <Icon className="nav-icon" />
                  <span className="nav-text">{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main content */}
        <main className="main-content">
          <div className="main-container">
            {children}
          </div>
        </main>
      </div>
      
      {/* Overlay for mobile when sidebar is open */}
      {mobileOpen && (
        <div 
          className="sidebar-overlay" 
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
            backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 800
          }}
        ></div>
      )}
    </div>
  );
};

export default Layout;