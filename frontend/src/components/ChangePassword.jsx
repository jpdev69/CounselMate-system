// src/components/ChangePassword.jsx
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Lock, Key, CheckCircle, Eye, EyeOff } from 'lucide-react';

// Small badge used by password intellisense to show pass/fail for rules
const Badge = ({ ok, text }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: ok ? '#064e3b' : '#6b7280', background: ok ? 'rgba(16,185,129,0.06)' : 'transparent', padding: '4px 8px', borderRadius: 8, border: ok ? '1px solid rgba(16,185,129,0.10)' : '1px solid transparent' }}>
    <div style={{ width: 12, height: 12, borderRadius: 12, background: ok ? '#10b981' : '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 10, lineHeight: 1 }}>
      {ok ? '✓' : '•'}
    </div>
    <div style={{ fontSize: 12 }}>{text}</div>
  </div>
);

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
  const [passwordFeedback, setPasswordFeedback] = useState({
    length: false,
    letter: false,
    number: false,
    upper: false,
    special: false,
    strength: 'Weak',
    score: 0
  });
  const { changePassword, user } = useAuth();

  const handleChange = (e) => {
    const val = (e.target.value || '').toString().slice(0, 32);
    setFormData({
      ...formData,
      [e.target.name]: val
    });
    if (message || error) {
      setMessage('');
      setError('');
    }
    // live password intellisense for new password
    if (e.target.name === 'newPassword') {
      const fb = evaluatePassword(val);
      setPasswordFeedback(fb);
    }
  };

  const evaluatePassword = (pwd) => {
    const length = pwd.length >= 6;
    const letter = /[A-Za-z]/.test(pwd);
    const number = /\d/.test(pwd);
    const upper = /[A-Z]/.test(pwd);
    const special = /[^A-Za-z0-9]/.test(pwd);

    let score = 0;
    if (length) score += 1;
    if (letter) score += 1;
    if (number) score += 1;
    if (upper) score += 1;
    if (special) score += 1;

    let strength = 'Very Weak';
    if (score >= 4 && pwd.length >= 10) strength = 'Strong';
    else if (score >= 3) strength = 'Medium';
    else if (score >= 2) strength = 'Weak';

    return { length, letter, number, upper, special, strength, score };
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

    // Client-side validation: new password must include at least one letter and one number (special chars allowed)
    const requireLetterAndDigit = /(?=.*[A-Za-z])(?=.*\d)/;
    if (!requireLetterAndDigit.test(formData.newPassword)) {
      setError('New password must include at least one letter and one number');
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
                maxLength={32}
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
                maxLength={32}
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
            {/* Password intellisense / feedback */}
            <div style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{ flex: 1, height: 8, borderRadius: 6, background: '#e6edf3', overflow: 'hidden' }}>
                  <div style={{ width: `${(passwordFeedback.score / 5) * 100}%`, height: '100%', transition: 'width 160ms', background: passwordFeedback.score >= 4 ? '#10b981' : passwordFeedback.score >= 3 ? '#f59e0b' : '#ef4444' }} />
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', minWidth: 64, textAlign: 'right' }}>{passwordFeedback.strength}</div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Badge ok={passwordFeedback.length} text="At least 6 characters" />
                <Badge ok={passwordFeedback.letter} text="Contains at least one letter" />
                <Badge ok={passwordFeedback.number} text="Contains at least one number" />
                <Badge ok={passwordFeedback.upper} text="Contains an uppercase letter" />
                <Badge ok={passwordFeedback.special} text="Contains a special character" />
              </div>
              
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
                maxLength={32}
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