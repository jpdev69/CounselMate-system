// src/components/ForgotPassword.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { sendOtp, verifyOtp, resetPasswordWithOtp } from '../services/api';
import api from '../services/api';
import { Eye, EyeOff, Mail } from 'lucide-react';

// Small badge used by password intellisense to show pass/fail for rules
const Badge = ({ ok, text }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: ok ? '#064e3b' : '#6b7280', background: ok ? 'rgba(16,185,129,0.06)' : 'transparent', padding: '4px 8px', borderRadius: 8, border: ok ? '1px solid rgba(16,185,129,0.10)' : '1px solid transparent' }}>
    <div style={{ width: 12, height: 12, borderRadius: 12, background: ok ? '#10b981' : '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 10, lineHeight: 1 }}>
      {ok ? '✓' : '•'}
    </div>
    <div style={{ fontSize: 12 }}>{text}</div>
  </div>
);

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

const ForgotPassword = () => {
  // ── Email identification state ─────────────────────────────────────
  const [email, setEmail] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  
  // ── OTP state ────────────────────────────────────────────────────
  const [otpSent, setOtpSent] = useState(false);
  const [otpSentMsg, setOtpSentMsg] = useState('');
  const [otpValue, setOtpValue] = useState('');
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpResendCooldown, setOtpResendCooldown] = useState(null);
  const [otpResendTimeLeft, setOtpResendTimeLeft] = useState(null);

  // ── Shared new-password state ────────────────────────────────────
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordFeedback, setPasswordFeedback] = useState({
    length: false,
    letter: false,
    number: false,
    upper: false,
    special: false,
    strength: 'Weak',
    score: 0
  });
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [retryAfterMs, setRetryAfterMs] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const navigate = useNavigate();

  const handleReset = async (e) => {
    e.preventDefault();
    setMessage(null);
    
    // Trim passwords to avoid whitespace issues
    const trimmedNewPassword = (newPassword || '').trim();
    const trimmedConfirmPassword = (confirmPassword || '').trim();
    
    if (!trimmedNewPassword) {
      return setMessage({ type: 'error', text: 'New password is required' });
    }
    
    if (!trimmedConfirmPassword) {
      return setMessage({ type: 'error', text: 'Please confirm your password' });
    }
    
    if (trimmedNewPassword !== trimmedConfirmPassword) {
      return setMessage({ type: 'error', text: 'Passwords do not match' });
    }
    
    if (!/(?=.*[A-Za-z])(?=.*\d)(?=.*[A-Z])(?=.*[!@#$%^&*(),.?":{}|<>])/.test(trimmedNewPassword)) {
      return setMessage({ type: 'error', text: 'Password must include at least one letter, one number, one uppercase letter, and one special character' });
    }

    setLoading(true);
    try {
      if (!otpVerified) { 
        setLoading(false); 
        return setMessage({ type: 'error', text: 'OTP not verified' }); 
      }
      
      const res = await resetPasswordWithOtp({ newPassword: trimmedNewPassword, email: email.trim() });
      if (res.data && res.data.success) {
        setMessage({ type: 'success', text: 'Password reset successfully. Please sign in.' });
        setRetryAfterMs(null);
        setTimeLeft(null);
        setTimeout(() => navigate('/login'), 1400);
      } else {
        setMessage({ type: 'error', text: res.data?.error || 'Failed to reset password' });
        if (res.data?.remainingAttempts !== undefined) {
          const attemptsMessage = res.data.remainingAttempts > 0 
            ? ` ${res.data.remainingAttempts} attempt${res.data.remainingAttempts === 1 ? '' : 's'} remaining.`
            : ' No attempts remaining.';
          setMessage(prev => ({ ...prev, text: prev.text + attemptsMessage }));
        }
      }
    } catch (err) {
      console.error('Reset error', err);
      const errMsg = err.response?.data?.error || err.message || 'Failed to reset password';
      const r = err.response?.data?.retryAfterMs || null;
      const remainingAttempts = err.response?.data?.remainingAttempts;
      if (r) setRetryAfterMs(r);
      const messageObj = { type: 'error', text: errMsg };
      if (remainingAttempts !== undefined) {
        const attemptsMessage = remainingAttempts > 0 
          ? ` ${remainingAttempts} attempt${remainingAttempts === 1 ? '' : 's'} remaining.`
          : ' No attempts remaining.';
        messageObj.text = errMsg + attemptsMessage;
      }
      setMessage(messageObj);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmail = async (e) => {
    e.preventDefault();
    setMessage(null);
    if (!email.trim()) return setMessage({ type: 'error', text: 'Email is required' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setMessage({ type: 'error', text: 'Invalid email address' });

    setEmailLoading(true);
    try {
      // Check if email exists in the system and has recovery email configured
      const res = await api.post('/auth/forgot/check-email', { email: email.trim() });
      if (res.data && res.data.success) {
        setEmailVerified(true);
        setMessage({ type: 'success', text: res.data.message || 'Email verified. You can now send OTP.' });
      } else {
        setMessage({ type: 'error', text: res.data?.error || 'Email not found or no recovery email configured' });
      }
    } catch (err) {
      const errMsg = err.response?.data?.error || err.message || 'Failed to verify email';
      setMessage({ type: 'error', text: errMsg });
    } finally {
      setEmailLoading(false);
    }
  };

  const handleSendOtp = async () => {
    setMessage(null);
    setOtpLoading(true);
    try {
      const res = await sendOtp({ email: email.trim() });
      if (res.data && res.data.success) {
        setOtpSent(true);
        setOtpSentMsg(res.data.message || 'OTP sent. Check your email.');
        // Start 60-second cooldown for resending (backend handles this, but we keep frontend timer for UI)
        setOtpResendCooldown(60000); // 60 seconds in ms
      } else {
        setMessage({ type: 'error', text: res.data?.error || 'Failed to send OTP' });
        // Handle cooldown from backend response
        if (res.data?.retryAfterMs) {
          setOtpResendCooldown(res.data.retryAfterMs);
        }
      }
    } catch (err) {
      const errMsg = err.response?.data?.error || err.message || 'Failed to send OTP';
      const r = err.response?.data?.retryAfterMs || null;
      if (r) {
        setRetryAfterMs(r);
        setOtpResendCooldown(r);
        // Show dynamic countdown in error message
        const seconds = Math.ceil(r / 1000);
        setMessage({ type: 'error', text: `Please wait ${seconds} seconds before requesting another OTP.` });
      } else {
        setMessage({ type: 'error', text: errMsg });
      }
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setMessage(null);
    if (!otpValue.trim()) return setMessage({ type: 'error', text: 'Please enter the OTP' });
    setOtpLoading(true);
    try {
      const res = await verifyOtp({ otp: otpValue.trim() });
      if (res.data && res.data.success) {
        setOtpVerified(true);
        setRetryAfterMs(null);
        setTimeLeft(null);
      } else {
        setMessage({ type: 'error', text: res.data?.error || 'Invalid OTP' });
        if (res.data?.remainingAttempts !== undefined) {
          const attemptsMessage = res.data.remainingAttempts > 0 
            ? ` ${res.data.remainingAttempts} attempt${res.data.remainingAttempts === 1 ? '' : 's'} remaining.`
            : ' No attempts remaining.';
          setMessage(prev => ({ ...prev, text: prev.text + attemptsMessage }));
        }
      }
    } catch (err) {
      const errMsg = err.response?.data?.error || err.message || 'Invalid OTP';
      const r = err.response?.data?.retryAfterMs || null;
      const remainingAttempts = err.response?.data?.remainingAttempts;
      if (r) setRetryAfterMs(r);
      const messageObj = { type: 'error', text: errMsg };
      if (remainingAttempts !== undefined) {
        const attemptsMessage = remainingAttempts > 0 
          ? ` ${remainingAttempts} attempt${remainingAttempts === 1 ? '' : 's'} remaining.`
          : ' No attempts remaining.';
        messageObj.text = errMsg + attemptsMessage;
      }
      setMessage(messageObj);
    } finally {
      setOtpLoading(false);
    }
  };

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

  // OTP resend cooldown timer
  useEffect(() => {
    if (!otpResendCooldown) return undefined;
    const end = Date.now() + otpResendCooldown;
    const fmt = (ms) => {
      const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
      return `${totalSeconds}s`;
    };
    setOtpResendTimeLeft(fmt(otpResendCooldown));
    const t = setInterval(() => {
      const remaining = end - Date.now();
      if (remaining <= 0) {
        setOtpResendCooldown(null);
        setOtpResendTimeLeft(null);
        // Clear cooldown error message when timer expires
        setMessage(prev => {
          if (prev?.text?.includes('Please wait') && prev?.text?.includes('seconds before requesting')) {
            return null;
          }
          return prev;
        });
        clearInterval(t);
        return;
      }
      setOtpResendTimeLeft(fmt(remaining));
      // Update error message with current countdown
      setMessage(prev => {
        if (prev?.text?.includes('Please wait') && prev?.text?.includes('seconds before requesting')) {
          const seconds = Math.ceil(remaining / 1000);
          return { ...prev, text: `Please wait ${seconds} seconds before requesting another OTP.` };
        }
        return prev;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [otpResendCooldown]);

  return (
    <div className="login-container">
      <div className="login-card card">
        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem' }}>
            <Mail style={{ width: '24px', height: '24px', color: '#1e3a5f', marginRight: '8px' }} />
            <h2 style={{ margin: 0 }}>Forgot Password</h2>
          </div>
          <p className="text-muted">Use Gmail OTP to reset your password. The OTP will be sent to your registered email address.</p>
        </div>

        <form onSubmit={handleReset} style={{ display: 'grid', gap: '0.75rem' }}>
          {message && (
            <div className={`alert ${message.type === 'error' ? 'alert-error' : message.type === 'success' ? 'alert-success' : 'alert-info'}`}>
              {message.text}
              {retryAfterMs && !message.text.includes('Please wait') && !message.text.includes('seconds before requesting') && (
                <div style={{ fontSize: 12, marginTop: 6 }}>Try again in {timeLeft || 'a few seconds'}.</div>
              )}
            </div>
          )}

          {/* ── Email Verification & OTP Section ── */}
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {!emailVerified ? (
              <>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#374151' }}>
                  Enter your email address to start the password recovery process.
                </p>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value.trim())}
                    className="form-input"
                    placeholder="Enter your email address"
                    type="email"
                    style={{ flex: 1 }}
                  />
                  <button 
                    type="button" 
                    className="btn btn-primary" 
                    onClick={handleVerifyEmail}
                    disabled={emailLoading || !email.trim()}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    {emailLoading ? 'Verifying...' : 'Verify Email'}
                  </button>
                </div>
              </>
            ) : !otpVerified ? (
              <>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#374151' }}>
                  A 6-digit one-time password will be sent to your registered email address.
                </p>
                <div style={{ fontSize: 12, color: '#065f46', marginBottom: 8 }}>
                  ✓ Email verified: {email}
                </div>
                {!otpSent ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleSendOtp}
                    disabled={otpLoading || !!retryAfterMs}
                  >
                    {otpLoading ? 'Sending...' : 'Send OTP'}
                  </button>
                ) : (
                  <>
                    <div style={{ fontSize: 12, color: '#065f46' }}>{otpSentMsg}</div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        value={otpValue}
                        onChange={(e) => setOtpValue((e.target.value || '').replace(/\D/g, '').slice(0, 6))}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (otpValue.length === 6) handleVerifyOtp(); } }}
                        className="form-input"
                        placeholder="Enter 6-digit OTP"
                        maxLength={6}
                        inputMode="numeric"
                        style={{ letterSpacing: '0.2em', fontWeight: 700 }}
                      />
                      <button type="button" className="btn btn-primary" onClick={handleVerifyOtp} disabled={otpLoading || otpValue.length < 6 || !!retryAfterMs} style={{ whiteSpace: 'nowrap' }}>
                        {otpLoading ? 'Verifying...' : 'Verify OTP'}
                      </button>
                    </div>
                    <button 
                      type="button" 
                      className="btn" 
                      style={{ fontSize: '0.8rem', color: '#6b7280' }} 
                      onClick={() => { setOtpSent(false); setOtpValue(''); setMessage(null); }} 
                      disabled={otpLoading || !!otpResendCooldown}
                    >
                      {otpResendCooldown ? `Resend OTP (${otpResendTimeLeft})` : 'Resend OTP'}
                    </button>
                  </>
                )}
              </>
            ) : (
              <div style={{ fontSize: 12, color: '#065f46' }}>✓ OTP verified — you may now choose a new password.</div>
            )}
          </div>

          {/* ── New-password fields (shown once OTP is verified) ── */}
          {otpVerified && (
            <>
              <div>
                <label style={{ display: 'block', marginBottom: '6px' }}>New Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => {
                      const v = (e.target.value || '').toString().slice(0, 32);
                      setNewPassword(v);
                      const fb = evaluatePassword(v);
                      setPasswordFeedback(fb);
                    }}
                    className="form-input"
                    placeholder="Enter new password"
                    maxLength={32}
                    style={{ paddingRight: '40px' }}
                  />
                  <button
                    type="button"
                    aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                    className="btn"
                    onClick={() => setShowNewPassword(s => !s)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {/* Password strength feedback */}
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
                <label style={{ display: 'block', marginBottom: '6px' }}>Confirm Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword((e.target.value || '').toString().slice(0, 32))}
                    className="form-input"
                    placeholder="Confirm new password"
                    maxLength={32}
                    style={{ paddingRight: '40px' }}
                  />
                  <button
                    type="button"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    className="btn"
                    onClick={() => setShowConfirmPassword(s => !s)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-primary" disabled={loading || !!retryAfterMs} style={{ flex: 1 }}>{loading ? 'Resetting...' : 'Reset Password'}</button>
                <button type="button" className="btn" onClick={() => navigate('/login')}>Cancel</button>
              </div>
            </>
          )}

          {!otpVerified && (
            <div style={{ textAlign: 'center' }}>
              <button type="button" className="btn" onClick={() => navigate('/login')} style={{ fontSize: '0.875rem' }}>Back to Login</button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default ForgotPassword;
