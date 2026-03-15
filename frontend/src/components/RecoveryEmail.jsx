// src/components/RecoveryEmail.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getGmailSettings, updateGmailSettings, verifyCurrentPassword } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Mail, ShieldCheck, Eye, EyeOff } from 'lucide-react';

const RecoveryEmail = () => {
	const [loading, setLoading] = useState(false);
	const [verified, setVerified] = useState(Boolean(sessionStorage.getItem('verifiedSecurityQuestion')));
	const [password, setPassword] = useState('');
	const [showVerifyPassword, setShowVerifyPassword] = useState(false);
	const [verifyError, setVerifyError] = useState(null);
	const [retryAfterMs, setRetryAfterMs] = useState(null);
	const [timeLeft, setTimeLeft] = useState(null);
	// Gmail recovery email state
	const [gmailReady, setGmailReady] = useState(false);
	const [gmailUser, setGmailUser] = useState(null);
	const [recoveryEmail, setRecoveryEmail] = useState('');
	const [recoveryEmailInput, setRecoveryEmailInput] = useState('');
	const [gmailFeedback, setGmailFeedback] = useState(null);
	const [savingGmail, setSavingGmail] = useState(false);
	const navigate = useNavigate();
	const { user } = useAuth();

	useEffect(() => {
		let mounted = true;
		const loadGmail = async () => {
			try {
				const res = await getGmailSettings();
				if (!mounted) return;
				if (res.data && res.data.success) {
					setGmailReady(res.data.gmailReady || false);
					setGmailUser(res.data.gmailUser || null);
					const re = res.data.recoveryEmail || '';
					setRecoveryEmail(re);
					setRecoveryEmailInput(re);
				}
			} catch (err) {
				console.error('Failed to load Gmail settings', err);
			}
		};

		if (verified) {
			loadGmail();
		}

		return () => { mounted = false; };
	}, [verified]);

	const handleSaveGmail = async (e) => {
		e.preventDefault();
		setGmailFeedback(null);
		if (!recoveryEmailInput.trim()) return setGmailFeedback({ ok: false, text: 'Please enter an email address.' });
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recoveryEmailInput.trim())) return setGmailFeedback({ ok: false, text: 'Invalid email address.' });
		setSavingGmail(true);
		try {
			const res = await updateGmailSettings({ recoveryEmail: recoveryEmailInput.trim() });
			if (res.data && res.data.success) {
				setRecoveryEmail(recoveryEmailInput.trim());
				setGmailFeedback({ ok: true, text: 'Recovery email saved.' });
			} else {
				setGmailFeedback({ ok: false, text: res.data?.error || 'Failed to save' });
			}
		} catch (err) {
			setGmailFeedback({ ok: false, text: err.response?.data?.error || err.message || 'Failed to save' });
		} finally {
			setSavingGmail(false);
		}
	};

	const handleVerify = async (e) => {
		e.preventDefault();
		setVerifyError(null);
		if (!password.trim()) {
			setVerifyError('Password is required');
			return;
		}

		try {
			const response = await verifyCurrentPassword(password);
			
			if (response.data && response.data.success) {
				sessionStorage.setItem('verifiedSecurityQuestion', '1');
				setVerified(true);
				setRetryAfterMs(null);
				setTimeLeft(null);
			} else {
				setVerifyError(response.data?.error || 'Invalid password');
				if (response.data?.retryAfterMs) {
					setRetryAfterMs(response.data.retryAfterMs);
				}
				if (response.data?.remainingAttempts !== undefined) {
					const attemptsMessage = response.data.remainingAttempts > 0 
						? ` ${response.data.remainingAttempts} attempt${response.data.remainingAttempts === 1 ? '' : 's'} remaining.`
						: ' No attempts remaining.';
					setVerifyError(prev => prev + attemptsMessage);
				}
			}
		} catch (err) {
			console.error('Verify error', err);
			const errorMessage = err.response?.data?.error || err.message || 'Failed to verify password. Please try again.';
			const retryMs = err.response?.data?.retryAfterMs;
			const remainingAttempts = err.response?.data?.remainingAttempts;
			
			if (retryMs) {
				setRetryAfterMs(retryMs);
				setVerifyError(errorMessage);
			} else {
				setVerifyError(errorMessage);
			}
			
			if (remainingAttempts !== undefined) {
				const attemptsMessage = remainingAttempts > 0 
					? ` ${remainingAttempts} attempt${remainingAttempts === 1 ? '' : 's'} remaining.`
					: ' No attempts remaining.';
				setVerifyError(prev => prev + attemptsMessage);
			}
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

	if (!verified) {
		return (
			<div className="container">
				<div className="card" style={{ padding: 20, maxWidth: 520, margin: '80px auto' }}>
					<div style={{ marginBottom: 12 }}>
						<h2 style={{ margin: 0 }}>Verify Password</h2>
						<div style={{ fontSize: 13, color: '#6b7280' }}>Please enter your current password to continue to Recovery Email settings.</div>
					</div>
					<form onSubmit={handleVerify} style={{ display: 'grid', gap: 10 }}>
						<div style={{ position: 'relative' }}>
							<input
								type={showVerifyPassword ? 'text' : 'password'}
								className="form-input"
								placeholder="Current password"
								value={password}
								maxLength={32}
								onChange={(e) => setPassword((e.target.value || '').toString().slice(0, 32))}
								style={{ paddingRight: '40px' }}
								disabled={!!retryAfterMs}
							/>
							<button
								type="button"
								aria-label={showVerifyPassword ? 'Hide password' : 'Show password'}
								className="btn"
								onClick={() => setShowVerifyPassword(s => !s)}
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
								{showVerifyPassword ? <EyeOff size={16} /> : <Eye size={16} />}
							</button>
						</div>
						<div style={{ display: 'flex', gap: 8 }}>
							<button className="btn btn-primary" type="submit" disabled={!!retryAfterMs}>Verify</button>
							<button type="button" className="btn" onClick={() => navigate('/dashboard')}>Cancel</button>
						</div>
						{verifyError && (
							<div className={`alert alert-error`} style={{ marginTop: 8 }}>
								{verifyError}
								{retryAfterMs && (
									<div style={{ fontSize: 12, marginTop: 6 }}>Try again in {timeLeft || 'a few seconds'}.</div>
								)}
							</div>
						)}
					</form>
				</div>
			</div>
		);
	}

	return (
		<div className="container">
			<div className="card" style={{ padding: 20, maxWidth: 720, margin: '0 auto' }}>
				<div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
					<div style={{
						width: '40px',
						height: '40px',
						marginRight: '12px',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						background: 'rgba(0, 102, 51, 0.08)',
						borderRadius: '8px',
						color: 'var(--primary)',
						flexShrink: 0
					}}>
						<Mail style={{ width: '22px', height: '22px' }} />
					</div>
					<div>
						<h1 style={{ fontSize: '20px', fontWeight: '700', margin: 0 }}>Recovery Email</h1>
						<p className="text-muted" style={{ margin: 0, fontSize: '0.9rem' }}>
							Manage your Gmail recovery email for OTP-based password reset.
						</p>
					</div>
				</div>

				<div style={{ display: 'grid', gap: 14 }}>
					{/* ── Recovery Email Setup ── */}
					<div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Recovery Email</div>

					<form onSubmit={handleSaveGmail} style={{ display: 'grid', gap: 10 }}>
						<div>
							<label style={{ display: 'block', fontSize: 13, marginBottom: 6, fontWeight: 600 }}>Recovery Email Address</label>
							<input
								className="form-input"
								type="email"
								value={recoveryEmailInput}
								onChange={(e) => { setRecoveryEmailInput(e.target.value); setGmailFeedback(null); }}
								placeholder="e.g. counselor@gmail.com"
							/>
							{recoveryEmail && recoveryEmailInput !== recoveryEmail && (
								<div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Current: {recoveryEmail}</div>
							)}
						</div>
						<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
							<button className="btn btn-primary" type="submit" disabled={savingGmail} style={{ whiteSpace: 'nowrap' }}>{savingGmail ? 'Saving...' : 'Save Recovery Email'}</button>
							{gmailFeedback && (
								<div className={`alert ${gmailFeedback.ok ? 'alert-success' : 'alert-error'}`} style={{ margin: 0 }}>{gmailFeedback.text}</div>
							)}
						</div>
					</form>

					{/* ── Gmail Configuration Status ── */}
					<div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 20, marginTop: 4 }}>
						<div style={{ marginBottom: 12 }}>
							<div style={{ fontWeight: 700, fontSize: '0.95rem' }}>System Status</div>
						</div>
						<div style={{ display: 'grid', gap: 8 }}>
							<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
								<div style={{ 
									width: '8px', 
									height: '8px', 
									borderRadius: '50%', 
									background: gmailReady ? '#10b981' : '#ef4444' 
								}} />
								<span style={{ fontSize: 13 }}>
									Gmail Service: {gmailReady ? 'Configured' : 'Not Configured'}
								</span>
							</div>
							{recoveryEmail && (
								<div style={{ fontSize: 12, color: '#6b7280' }}>
									Recovery Email: {recoveryEmail}
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default RecoveryEmail;
