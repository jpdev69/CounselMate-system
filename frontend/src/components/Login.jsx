// src/components/Login.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { School, User, Lock, Eye, EyeOff } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [retryAfterMs, setRetryAfterMs] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Client-side validation (disable native browser validation via form noValidate)
    if (!email || !password) {
      // Keep message generic to avoid revealing which field is missing
      setError('Invalid email or password. Please check your credentials and try again.');
      return;
    }

    if (!email.includes('@')) {
      setError("Please include an '@' in the email address.");
      return;
    }

    setLoading(true);

    try {
      const result = await login(email, password);

      if (result.success) {
        // On success clear any previous rate-limit state
        setRetryAfterMs(null);
        setTimeLeft(null);
        navigate('/');
      } else {
        setError(result.error);
        if (result.retryAfterMs) {
          setRetryAfterMs(result.retryAfterMs);
        }
      }
    } catch (err) {
      // If login returns a failure object with retryAfterMs from AuthContext
      if (err && err.retryAfterMs) {
        setRetryAfterMs(err.retryAfterMs);
        setError(err.error || 'Too many attempts. Try again later.');
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Timer for retryAfterMs
  useEffect(() => {
    if (!retryAfterMs) return undefined;
    const end = Date.now() + retryAfterMs;
    const fmt = (ms) => {
      const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      if (minutes > 0) return `${minutes}:${String(seconds).padStart(2, '0')}`;
      return `${seconds}s`;
    };
    setTimeLeft(fmt(retryAfterMs));
    const t = setInterval(() => {
      const remaining = end - Date.now();
      if (remaining <= 0) {
        setRetryAfterMs(null);
        setTimeLeft(null);
        clearInterval(t);
        return;
      }
      setTimeLeft(fmt(remaining));
    }, 1000);
    return () => clearInterval(t);
  }, [retryAfterMs]);

  return (
    <div className="login-container">
      <div className="login-card card">
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>
            <div className="icon-container">
              <School className="icon" />
            </div>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>CounselMate</h1>
          <p className="text-muted">Guidance Counselor Portal</p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="" style={{ display: 'grid', gap: '0.75rem' }}>
          {error && (
            <div className="alert alert-error">
              {error}
              {retryAfterMs && (
                <div style={{ fontSize: 12, marginTop: 6 }}>
                  Try again in {timeLeft || 'a few seconds'}.
                </div>
              )}
            </div>
          )}

          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.95rem' }}>Email Address</label>
            <div className="input-with-icon">
              <User className="icon" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail((e.target.value || '').toString().slice(0, 32))}
                maxLength={32}
                className="form-input"
                placeholder="Enter your email"
                disabled={!!retryAfterMs}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.95rem' }}>Password</label>
            <div className="input-with-icon" style={{ position: 'relative' }}>
              <Lock className="icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword((e.target.value || '').toString().slice(0, 32))}
                maxLength={32}
                className="form-input"
                placeholder="Enter your password"
                aria-label="Password"
                disabled={!!retryAfterMs}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="password-toggle"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !!retryAfterMs}
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '6px' }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem' }}>
          <div style={{ fontSize: '0.9rem' }}>
            <Link to="/forgot-password" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>Forgot password?</Link>
          </div>
          <div style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.9rem' }} className="text-muted">
            <p style={{ margin: 0 }}>Web-based Guidance Monitoring and Record-Keeping System</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;