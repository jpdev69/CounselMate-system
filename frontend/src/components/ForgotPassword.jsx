// src/components/ForgotPassword.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSecurityQuestion, resetPasswordWithSecurity, verifySecurityAnswer } from '../services/api';

// Preset questions (keep in sync with SecurityQuestion component)
const PRESET = [
  { id: 1, question: 'What was the first school event you disliked?' },
  { id: 2, question: 'What was the first video game level you got stuck on?' },
  { id: 3, question: 'What was the first internet username you made up?' }
];
import { Eye, EyeOff } from 'lucide-react';

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
  const [question, setQuestion] = useState(null);
  const [answer, setAnswer] = useState('');
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
  const [answerVerified, setAnswerVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const res = await getSecurityQuestion();
        if (!mounted) return;
        if (res.data && res.data.securityQuestion) {
          // The server stores a truncated (32-char) value. If it matches the start
          // of a preset question, display the full preset text so users see the
          // complete question on the forgot-password page.
          const stored = (res.data.securityQuestion || '').toString();
          const matched = PRESET.find(p => (p.question || '').toString().slice(0, 32) === stored.slice(0, 32));
          if (matched) {
            setQuestion(matched.question);
          } else {
            setQuestion(stored || null);
          }
        } else {
          setQuestion(null);
          setMessage({ type: 'info', text: 'No security question configured.' });
        }
      } catch (err) {
        console.error('Lookup error', err);
        setMessage({ type: 'error', text: 'Failed to load security question. Try again later.' });
      } finally {
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const handleReset = async (e) => {
    e.preventDefault();
    setMessage(null);
    if (!answer.trim()) return setMessage({ type: 'error', text: 'Please enter your answer' });
    if (!answerVerified) return setMessage({ type: 'error', text: 'Verification failed' });
    if (!newPassword || newPassword !== confirmPassword) return setMessage({ type: 'error', text: 'Passwords do not match' });
    // basic password policy check: require at least one letter and one number (allow special chars)
    if (!/(?=.*[A-Za-z])(?=.*\d)/.test(newPassword)) {
      return setMessage({ type: 'error', text: 'Password must include at least one letter and one number' });
    }

    setLoading(true);
    try {
      const res = await resetPasswordWithSecurity({ answer, newPassword });
        if (res.data && res.data.success) {
          setMessage({ type: 'success', text: 'Password reset successfully. Please sign in.' });
          setRetryAfterMs(null);
          setTimeLeft(null);
        setTimeout(() => navigate('/login'), 1400);
      } else {
        setMessage({ type: 'error', text: res.data?.error || 'Failed to reset password' });
      }
    } catch (err) {
      console.error('Reset error', err);
      const errMsg = err.response?.data?.error || err.message || 'Failed to reset password';
      const r = err.response?.data?.retryAfterMs || null;
      if (r) setRetryAfterMs(r);
      setMessage({ type: 'error', text: errMsg });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAnswer = async () => {
    setMessage(null);
    if (!answer.trim()) return setMessage({ type: 'error', text: 'Please enter your answer' });
    setVerifying(true);
    try {
      const res = await verifySecurityAnswer({ answer });
        if (res.data && res.data.success) {
          setAnswerVerified(true);
          setRetryAfterMs(null);
          setTimeLeft(null);
      } else {
        setMessage({ type: 'error', text: res.data?.error || 'Invalid answer' });
      }
    } catch (err) {
      console.error('Verify error', err);
      const errMsg = err.response?.data?.error || err.message || 'Failed to verify answer';
      const r = err.response?.data?.retryAfterMs || null;
      if (r) setRetryAfterMs(r);
      setMessage({ type: 'error', text: errMsg });
    } finally {
      setVerifying(false);
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
  return (
    <div className="login-container">
      <div className="login-card card">
        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0 }}>Forgot Password</h2>
          <p className="text-muted">Answer your saved security question to reset the counselor account password.</p>
        </div>

        <form onSubmit={handleReset} style={{ display: 'grid', gap: '0.75rem' }}>
          {message && (
            <div className={`alert ${message.type === 'error' ? 'alert-error' : message.type === 'success' ? 'alert-success' : 'alert-info'}`}>
              {message.text}
              {retryAfterMs && (
                <div style={{ fontSize: 12, marginTop: 6 }}>Try again in {timeLeft || 'a few seconds'}.</div>
              )}
            </div>
          )}

          <div>
            {!answerVerified ? (
              <>
                <div style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '6px' }}>Security Question</div>
                <div style={{ marginBottom: '8px' }}>{question || '-'}</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    value={answer}
                    onChange={(e) => { setAnswer((e.target.value || '').toString().slice(0, 32)); if (answerVerified) setAnswerVerified(false); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        // If the answer isn't verified yet, treat Enter as a "Verify" action
                        if (!answerVerified && answer.trim()) {
                          handleVerifyAnswer();
                        }
                      }
                    }}
                    className="form-input"
                    placeholder="Your answer"
                  />
                  <button type="button" className="btn btn-primary" onClick={handleVerifyAnswer} disabled={verifying || !answer.trim() || !!retryAfterMs} style={{ whiteSpace: 'nowrap' }}>{verifying ? 'Verifying...' : 'Verify Answer'}</button>
                </div>
              </>
            ) : (
              <div style={{ fontSize: 12, color: '#065f46', marginTop: 6 }}>Answer verified — you may now choose a new password.</div>
            )}
          </div>
          {answerVerified && (
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
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#6b7280',
                      cursor: 'pointer',
                      padding: 0,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center'
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
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#6b7280',
                      cursor: 'pointer',
                      padding: 0,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </>
          )}

          {answerVerified && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-primary" disabled={loading || !!retryAfterMs} style={{ flex: 1 }}>{loading ? 'Resetting...' : 'Reset Password'}</button>
              <button type="button" className="btn" onClick={() => navigate('/login')}>Cancel</button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default ForgotPassword;
