// src/components/ChangePassword.jsx
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Lock, Key, CheckCircle, Eye, EyeOff } from 'lucide-react';

const ChangePassword = () => {
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const { changePassword, user } = useAuth();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    if (message || error) {
      setMessage('');
      setError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    // Validation
    if (formData.newPassword !== formData.confirmPassword) {
      setError('New passwords do not match');
      setLoading(false);
      return;
    }

    if (formData.newPassword.length < 6) {
      setError('New password must be at least 6 characters long');
      setLoading(false);
      return;
    }

    if (formData.newPassword === formData.currentPassword) {
      setError('New password must be different from current password');
      setLoading(false);
      return;
    }

    try {
      const result = await changePassword(formData.currentPassword, formData.newPassword);
      
      if (result.success) {
        setMessage('Password changed successfully! You will need to use your new password for future logins.');
        setFormData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
        // Clear all show password states
        setShowCurrentPassword(false);
        setShowNewPassword(false);
        setShowConfirmPassword(false);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Failed to change password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const togglePasswordVisibility = (field) => {
    switch (field) {
      case 'current':
        setShowCurrentPassword(!showCurrentPassword);
        break;
      case 'new':
        setShowNewPassword(!showNewPassword);
        break;
      case 'confirm':
        setShowConfirmPassword(!showConfirmPassword);
        break;
      default:
        break;
    }
  };

  return (
    <div className="container" style={{ maxWidth: '500px' }}>
      <div className="card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
          <div className="icon-container" style={{ width: '48px', height: '48px', marginRight: '12px' }}>
            <Key style={{ width: '24px', height: '24px' }} />
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', margin: 0 }}>
            Change Password
          </h1>
        </div>

        <p className="text-muted" style={{ marginBottom: '20px', lineHeight: '1.5', fontSize: '0.95rem' }}>
          Update your account password. For security reasons, please choose a strong, unique password.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>
              Current Password
            </label>
            <div className="input-with-icon" style={{ position: 'relative' }}>
              <Lock className="icon" />
              <input
                type={showCurrentPassword ? "text" : "password"}
                name="currentPassword"
                value={formData.currentPassword}
                onChange={handleChange}
                className="form-input"
                placeholder="Enter your current password"
                required
                style={{ paddingRight: '40px' }}
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility('current')}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#6b7280',
                  cursor: 'pointer'
                }}
              >
                {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>
              New Password
            </label>
            <div className="input-with-icon" style={{ position: 'relative' }}>
              <Lock className="icon" />
              <input
                type={showNewPassword ? "text" : "password"}
                name="newPassword"
                value={formData.newPassword}
                onChange={handleChange}
                className="form-input"
                placeholder="Enter new password (min. 6 characters)"
                required
                minLength="6"
                style={{ paddingRight: '40px' }}
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility('new')}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#6b7280',
                  cursor: 'pointer'
                }}
              >
                {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>
              Confirm New Password
            </label>
            <div className="input-with-icon" style={{ position: 'relative' }}>
              <Lock className="icon" />
              <input
                type={showConfirmPassword ? "text" : "password"}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="form-input"
                placeholder="Confirm your new password"
                required
                minLength="6"
                style={{ paddingRight: '40px' }}
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility('confirm')}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#6b7280',
                  cursor: 'pointer'
                }}
              >
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="alert alert-error">
              <strong>Error:</strong> {error}
            </div>
          )}

          {message && (
            <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(16,185,129,0.08)', color: 'var(--success)', border: '1px solid rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center' }}>
              <CheckCircle style={{ width: '16px', height: '16px', marginRight: '8px' }} />
              <div>
                <strong>Success!</strong> {message}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '8px', padding: '12px', fontWeight: 600 }}
          >
            {loading ? (
              <>
                <div style={{ 
                  width: '16px', 
                  height: '16px', 
                  border: '2px solid transparent',
                  borderTop: '2px solid white',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  marginRight: '8px'
                }} />
                Changing Password...
              </>
            ) : (
              'Change Password'
            )}
          </button>
        </form>

        <div style={{ 
          backgroundColor: '#f8fafc', 
          border: '1px solid #e2e8f0', 
          borderRadius: '8px', 
          padding: '16px',
          marginBottom: '16px'
        }}>
          <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
            Password Requirements:
          </h3>
          <ul style={{ 
            listStyleType: 'none', 
            padding: 0, 
            margin: 0 
          }}>
            <li style={{ 
              fontSize: '13px', 
              color: '#6b7280', 
              padding: '4px 0', 
              position: 'relative', 
              paddingLeft: '16px' 
            }}>
              • At least 6 characters long
            </li>
            <li style={{ 
              fontSize: '13px', 
              color: '#6b7280', 
              padding: '4px 0', 
              position: 'relative', 
              paddingLeft: '16px' 
            }}>
              • Include uppercase and lowercase letters
            </li>
            <li style={{ 
              fontSize: '13px', 
              color: '#6b7280', 
              padding: '4px 0', 
              position: 'relative', 
              paddingLeft: '16px' 
            }}>
              • Include numbers and special characters
            </li>
            <li style={{ 
              fontSize: '13px', 
              color: '#6b7280', 
              padding: '4px 0', 
              position: 'relative', 
              paddingLeft: '16px' 
            }}>
              • Different from your previous passwords
            </li>
          </ul>
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default ChangePassword;