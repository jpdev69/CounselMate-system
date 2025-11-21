// src/components/Layout.jsx
import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link, useLocation } from 'react-router-dom';
import { LogOut, Home, FileText, Search, User, Key } from 'lucide-react';
import '../App.css';

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const navigation = [
    { name: 'Dashboard', href: '/', icon: Home },
    { name: 'Print Admission Slip', href: '/print-slip', icon: FileText },
    { name: 'Complete Form', href: '/complete-form', icon: FileText },
    { name: 'Search Records', href: '/search', icon: Search },
    { name: 'Change Password', href: '/change-password', icon: Key },
  ];

  return (
    <div className="layout">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
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
                {item.name}
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
              <p className="user-name">{user?.name}</p>
              <p className="user-role">{user?.role}</p>
            </div>
            <button
              onClick={logout}
              className="logout-btn"
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