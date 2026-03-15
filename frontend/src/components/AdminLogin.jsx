// src/components/AdminLogin.jsx
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogIn, Shield, AlertCircle } from 'lucide-react';

const AdminLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // For admin login, we'll use admin@university.edu
      const adminEmail = 'admin@university.edu';
      const result = await login(adminEmail, password);
      
      if (result.success) {
        // Explicitly redirect to admin panel after successful login
        navigate('/admin');
      } else {
        setError(result.error || 'Admin login failed');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <img src="/GuidanceOS-system-logo.png" alt="GuidanceOS Logo" className="login-logo" style={{ height: '64px', marginBottom: '16px' }} />
          <h1>Administrator Login</h1>
          <p className="login-subtitle">GuidanceOS Admin Portal</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && (
            <div className="alert alert-error">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value="admin@university.edu"
              disabled
              className="form-input"
              style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }}
            />
            <small style={{ color: '#6b7280', display: 'block', marginTop: '4px' }}>
              Administrator account is fixed
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-input"
              placeholder="Enter administrator password"
              required
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary btn-block"
            disabled={loading || !password}
          >
            {loading ? (
              <>
                <div className="spinner"></div>
                Signing in...
              </>
            ) : (
              <>
                <LogIn size={16} />
                Sign In as Administrator
              </>
            )}
          </button>
        </form>

        <div className="login-footer">
          <p>
            This portal is for system administrators only. 
            University counselors should use the regular login page.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
