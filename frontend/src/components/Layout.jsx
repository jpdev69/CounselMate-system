// src/components/Layout.jsx
import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link, useLocation } from 'react-router-dom';
import { LogOut, Home, FileText, Search, User, Key, Menu, Printer } from 'lucide-react';
import { useState } from 'react';
import '../App.css';

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const navigation = [
    { name: 'Dashboard', href: '/', icon: Home },
    { name: 'Print Admission Slip', href: '/print-slip', icon: Printer },
    { name: 'Complete Form', href: '/complete-form', icon: FileText },
    { name: 'Search Records', href: '/search', icon: Search },
    { name: 'Change Password', href: '/change-password', icon: Key },
  ];

  return (
    <div className="layout">
      {/* Sidebar */}
      <div className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <button
            className="sidebar-toggle"
            onClick={() => setCollapsed((c) => !c)}
            aria-label="Toggle sidebar"
          >
            <Menu />
          </button>
          <h1 className="sidebar-title">CounselMate</h1>
        </div>
        
        <nav className="sidebar-nav">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`nav-item ${isActive ? 'nav-item-active' : ''}`}
              >
                <Icon className="nav-icon" />
                <span className="nav-text">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* User info and logout */}
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">
              <User className="user-icon" />
            </div>
            <div className="user-details">
              <p className="user-name">University Counselor</p>
            </div>
            <button
              onClick={logout}
              className="btn btn-ghost logout-btn"
              title="Logout"
            >
              <LogOut className="logout-icon" />
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="main-content">
        <main className="main-container">{children}</main>
      </div>
    </div>
  );
};

export default Layout;