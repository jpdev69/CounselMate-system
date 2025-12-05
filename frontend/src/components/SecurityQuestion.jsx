// src/components/SecurityQuestion.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMySecurityQuestion, updateMySecurityQuestion } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Eye, EyeOff } from 'lucide-react';

// Preset questions (front-end choices only)
const PRESET = [
	{ id: 1, question: 'What was the first school event you disliked?' },
	{ id: 2, question: 'What was the first video game level you got stuck on?' },
	{ id: 3, question: 'What was the first internet username you made up?' }
];

const SecurityQuestion = () => {
	const [selectedId, setSelectedId] = useState(null);
	const [input, setInput] = useState('');
	const [feedback, setFeedback] = useState(null);
	const [savedQuestion, setSavedQuestion] = useState(null);
	const [saving, setSaving] = useState(false);
	const [loading, setLoading] = useState(false);
	const [verified, setVerified] = useState(Boolean(sessionStorage.getItem('verifiedSecurityQuestion')));
	const [password, setPassword] = useState('');
	const [showVerifyPassword, setShowVerifyPassword] = useState(false);
	const [verifyError, setVerifyError] = useState(null);
	const [retryAfterMs, setRetryAfterMs] = useState(null);
	const [timeLeft, setTimeLeft] = useState(null);
	const navigate = useNavigate();
	const { user, login } = useAuth();


	useEffect(() => {
		let mounted = true;
		const load = async () => {
			setLoading(true);
			try {
				const res = await getMySecurityQuestion();
				if (!mounted) return;
				if (res.data && res.data.securityQuestion) {
					const q = res.data.securityQuestion;
					// Normalize to the server-enforced 32-char limit so comparisons match what we save
					setSavedQuestion((q || '').toString().slice(0, 32));
					const matched = PRESET.find(p => p.question === q);
					if (matched) setSelectedId(matched.id);
				}
			} catch (err) {
				console.error('Failed to load saved question', err);
			} finally {
				if (mounted) setLoading(false);
			}
		};

		if (verified) {
			load();
		}

		return () => { mounted = false; };
	}, [verified]);

	const selected = PRESET.find(p => p.id === selectedId) || null;

	const handleSave = async (e) => {
		e.preventDefault();
		setFeedback(null);
		if (!selected) return setFeedback({ ok: false, text: 'Please select a question.' });
		if (!input.trim()) return setFeedback({ ok: false, text: 'Please enter your answer.' });

		setSaving(true);
		try {
			// Truncate question and answer to 32 chars to match backend validation middleware
			const payload = { security_question: (selected.question || '').toString().slice(0, 32), security_answer: (input || '').toString().slice(0, 32) };
			const res = await updateMySecurityQuestion(payload);
			if (res.data && res.data.success) {
				// store the truncated version to match backend storage and keep the "Current" indicator working
				setSavedQuestion((selected.question || '').toString().slice(0, 32));
				setFeedback({ ok: true, text: 'Saved successfully.' });
				setInput('');
			} else {
				setFeedback({ ok: false, text: res.data?.error || 'Failed to save' });
			}
		} catch (err) {
			console.error('Save error', err);
			setFeedback({ ok: false, text: err.response?.data?.error || err.message || 'Failed to save' });
		} finally {
			setSaving(false);
		}
	};

	const handleVerify = async (e) => {
		e.preventDefault();
		setVerifyError(null);
		const email = (user && user.email) || 'counselor@university.edu';
		try {
			const res = await login(email, password);
			if (res && res.success) {
				sessionStorage.setItem('verifiedSecurityQuestion', '1');
				setVerified(true);
				setRetryAfterMs(null);
				setTimeLeft(null);
			} else {
				// Avoid showing the login page's verbose message here; show a generic verification failure
				const errMsg = (res && res.error && res.error.includes('Invalid email or password'))
					? 'Verification failed'
					: (res?.error || 'Verification failed');
				setVerifyError(errMsg);
				if (res?.retryAfterMs) setRetryAfterMs(res.retryAfterMs);
			}
		} catch (err) {
			console.error('Verify error', err);
			const r = err.response?.data?.retryAfterMs || null;
			if (r) setRetryAfterMs(r);
			setVerifyError('Failed to verify password');
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
						<div style={{ fontSize: 13, color: '#6b7280' }}>Please enter your current password to continue to Security Question settings.</div>
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
				<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
					<div>
						<h2 style={{ margin: 0 }}>Security Question</h2>
						<div style={{ fontSize: 13, color: '#6b7280' }}>Save your answer — this will be used to reset the counselor account password.</div>
					</div>
					<div />
				</div>

				<div style={{ display: 'grid', gap: 14 }}>
					<div style={{ display: 'grid', gap: 8 }}>
						<div style={{ fontWeight: 700 }}>Choose a question</div>
						<div style={{ display: 'grid', gap: 8 }}>
							{PRESET.map(p => (
								<label
									key={p.id}
									className={`nav-item`}
									style={{
										display: 'flex',
										alignItems: 'center',
										gap: 12,
										padding: '10px',
										borderRadius: 8,
										background: selectedId === p.id ? '#f1f5f9' : 'transparent',
										cursor: 'pointer',
										color: '#0f172a'
									}}
								>
									<input type="radio" name="q" checked={selectedId === p.id} onChange={() => { setSelectedId(p.id); setFeedback(null); }} />
									<div style={{ flex: 1, color: '#0f172a', fontWeight: 600 }}>{p.question}</div>
									{( (savedQuestion || '').toString().slice(0,32) === (p.question || '').toString().slice(0,32) ) && <div style={{ fontSize: 12, color: '#065f46', fontWeight: 600 }}>Current</div>}
								</label>
							))}
						</div>
					</div>

					{selected && (
						<form onSubmit={handleSave} style={{ display: 'grid', gap: 10 }}>
							<div>
								<label style={{ display: 'block', fontSize: 13, marginBottom: 6, fontWeight: 600 }}>Your Answer</label>
								<input className="form-input" value={input} onChange={(e) => setInput((e.target.value || '').toString().slice(0, 32))} placeholder="Enter your answer" />
							</div>

							<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
								<button className="btn btn-primary" type="submit" disabled={saving} style={{ marginRight: 12, whiteSpace: 'nowrap' }}>{saving ? 'Saving...' : 'Save My Answer'}</button>
								{feedback && (
									<div className={`alert ${feedback.ok ? 'alert-success' : 'alert-error'}`} style={{ margin: 0, marginLeft: 'auto' }}>{feedback.text}</div>
								)}
							</div>
						</form>
					)}
				</div>
			</div>
		</div>
	);
};

export default SecurityQuestion;

