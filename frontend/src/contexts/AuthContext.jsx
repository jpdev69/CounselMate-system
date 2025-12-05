// src/contexts/AuthContext.jsx
import React, { createContext, useState, useContext, useEffect } from 'react';
import { login as apiLogin, changePassword as apiChangePassword } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = sessionStorage.getItem('authToken');
    const userData = sessionStorage.getItem('userData');

    const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

    const isTokenExpired = (t) => {
      if (!t) return true;
      // token format used by backend: 'simple-token-<timestamp>'
      const parts = t.split('-');
      const ts = parseInt(parts[parts.length - 1], 10);
      if (Number.isNaN(ts)) return true;
      return (Date.now() - ts) > SESSION_TTL_MS;
    };

    if (token && userData) {
      if (isTokenExpired(token)) {
        // Token appears expired — clear session to avoid restored logins
        sessionStorage.removeItem('authToken');
        sessionStorage.removeItem('userData');
        sessionStorage.removeItem('verifiedSecurityQuestion');
        setUser(null);
      } else {
        setUser(JSON.parse(userData));
      }
    }

    setLoading(false);

    // If the page becomes visible (e.g., restored by the browser), re-check token freshness
    const handleVisibility = () => {
      const t = sessionStorage.getItem('authToken');
      if (isTokenExpired(t)) {
        logout();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  const login = async (email, password) => {
    try {
      console.log('Attempting login with:', email);
      
      // Only allow counselor@university.edu
      if (email !== 'counselor@university.edu') {
        return {
          success: false,
          error: 'Invalid email or password. Please check your credentials and try again.'
        };
      }
      
      const response = await apiLogin(email, password);
      console.log('Login response:', response.data);
      
      const { token, user } = response.data;
      
      // Store session data in sessionStorage so it does not persist across browser restarts
      sessionStorage.setItem('authToken', token);
      sessionStorage.setItem('userData', JSON.stringify(user));
      setUser(user);
      
      return { success: true, retryAfterMs: null };
    } catch (error) {
      console.error('Login error details:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
      // Propagate rate-limited messages (429) or server messages if present
      const retryAfterMs = error.response?.data?.retryAfterMs || null;
      if (error.response?.status === 429) {
        return { success: false, error: error.response?.data?.error || 'Too many attempts. Try again later.', retryAfterMs };
      }
      return { 
        success: false, 
        error: error.response?.data?.error || 'Invalid email or password. Please check your credentials and try again.',
        retryAfterMs
      };
    }
  };

  const changePassword = async (currentPassword, newPassword) => {
    try {
      await apiChangePassword({
        currentPassword,
        newPassword
      });
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: 'Failed to change password. Please try again.' 
      };
    }
  };

  const logout = () => {
    sessionStorage.removeItem('authToken');
    sessionStorage.removeItem('userData');
    sessionStorage.removeItem('verifiedSecurityQuestion');
    setUser(null);
  };

  // Inactivity auto-logout (configurable). This helps prevent sessions staying active
  // when users leave the application unattended.
  useEffect(() => {
    const INACTIVITY_MS = 15 * 60 * 1000; // 15 minutes
    let timeoutId = null;

    const resetTimeout = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        logout();
      }, INACTIVITY_MS);
    };

    // Activity events to listen to
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'click'];
    events.forEach((ev) => window.addEventListener(ev, resetTimeout));

    // Reset on mount and when user changes
    resetTimeout();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach((ev) => window.removeEventListener(ev, resetTimeout));
    };
  }, [user]);

  const value = {
    user,
    login,
    logout,
    changePassword,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};