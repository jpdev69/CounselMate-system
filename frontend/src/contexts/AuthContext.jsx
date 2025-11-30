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
    const token = localStorage.getItem('authToken');
    const userData = localStorage.getItem('userData');
    
    if (token && userData) {
      setUser(JSON.parse(userData));
    }
    setLoading(false);
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
      
      localStorage.setItem('authToken', token);
      localStorage.setItem('userData', JSON.stringify(user));
      setUser(user);
      
      return { success: true };
    } catch (error) {
      console.error('Login error details:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
      
      return { 
        success: false, 
        error: 'Invalid email or password. Please check your credentials and try again.' 
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
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    setUser(null);
  };

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