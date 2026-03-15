// src/components/SignupRequest.jsx
import React, { useState } from 'react';
import { submitSignupRequest } from '../services/api';
import { Mail, User, MessageSquare, Send, X, CheckCircle } from 'lucide-react';

const SignupRequest = ({ isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    email: '',
    fullName: '',
    reason: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
    if (error) setError('');
  };

  const validateForm = () => {
    if (!formData.email.trim()) {
      setError('Email is required');
      return false;
    }
    if (!formData.fullName.trim()) {
      setError('Full name is required');
      return false;
    }
    if (!formData.reason.trim()) {
      setError('Reason for access is required');
      return false;
    }
    
    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim())) {
      setError('Please enter a valid email address');
      return false;
    }
    
    // Only allow Gmail addresses
    if (!formData.email.trim().toLowerCase().endsWith('@gmail.com')) {
      setError('Only Gmail addresses are allowed for signup requests');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setLoading(true);
    setError('');
    
    try {
      const result = await submitSignupRequest({
        email: formData.email.trim(),
        fullName: formData.fullName.trim(),
        reason: formData.reason.trim()
      });
      
      if (result.data.success) {
        setSuccess(true);
        setFormData({ email: '', fullName: '', reason: '' });
        if (onSuccess) onSuccess();
        
        // Auto close after 3 seconds
        setTimeout(() => {
          handleClose();
        }, 3000);
      } else {
        setError(result.data.error || 'Failed to submit signup request');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({ email: '', fullName: '', reason: '' });
    setError('');
    setSuccess(false);
    setLoading(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div className="modal-content" style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '2rem',
        width: '90%',
        maxWidth: '500px',
        maxHeight: '90vh',
        overflowY: 'auto',
        position: 'relative',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)'
      }}>
        {/* Close button */}
        <button
          onClick={handleClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '0.5rem',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#6b7280'
          }}
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            marginBottom: '0.75rem',
            backgroundColor: '#f0f9ff',
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            alignItems: 'center',
            margin: '0 auto 1rem'
          }}>
            <Mail size={28} style={{ color: '#1e40af' }} />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: '#1f2937' }}>
            Request Access to GuidanceOS
          </h2>
          <p style={{ margin: '0.5rem 0 0', color: '#6b7280', fontSize: '0.95rem' }}>
            Submit a request to become a guidance counselor
          </p>
        </div>

        {success ? (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <div style={{
              backgroundColor: '#f0fdf4',
              border: '2px solid #22c55e',
              borderRadius: '50%',
              width: '80px',
              height: '80px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem'
            }}>
              <CheckCircle size={40} style={{ color: '#22c55e' }} />
            </div>
            <h3 style={{ color: '#16a34a', marginBottom: '0.5rem' }}>Request Submitted!</h3>
            <p style={{ color: '#6b7280', lineHeight: 1.6 }}>
              Your signup request has been submitted successfully. The administrator will review your request and contact you soon.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {error && (
              <div className="alert alert-error" style={{
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#dc2626',
                padding: '0.75rem',
                borderRadius: '6px',
                fontSize: '0.9rem'
              }}>
                {error}
              </div>
            )}

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.95rem', fontWeight: 500, color: '#374151' }}>
                Gmail Address <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div className="input-with-icon" style={{ position: 'relative' }}>
                <Mail className="icon" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', size: '18px' }} />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="your@gmail.com"
                  className="form-input"
                  style={{
                    width: '100%',
                    padding: '0.75rem 0.75rem 0.75rem 2.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '0.95rem',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  disabled={loading}
                />
              </div>
              <small style={{ color: '#6b7280', fontSize: '0.85rem', marginTop: '0.25rem', display: 'block' }}>
                Only Gmail addresses are accepted
              </small>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.95rem', fontWeight: 500, color: '#374151' }}>
                Full Name <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div className="input-with-icon" style={{ position: 'relative' }}>
                <User className="icon" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', size: '18px' }} />
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  placeholder="Enter your full name"
                  className="form-input"
                  style={{
                    width: '100%',
                    padding: '0.75rem 0.75rem 0.75rem 2.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '0.95rem',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.95rem', fontWeight: 500, color: '#374151' }}>
                Reason for Access <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div className="input-with-icon" style={{ position: 'relative' }}>
                <MessageSquare className="icon" style={{ position: 'absolute', left: '0.75rem', top: '0.75rem', color: '#9ca3af', size: '18px' }} />
                <textarea
                  name="reason"
                  value={formData.reason}
                  onChange={handleChange}
                  placeholder="Please explain why you need access to the GuidanceOS system..."
                  rows={4}
                  className="form-input"
                  style={{
                    width: '100%',
                    padding: '0.75rem 0.75rem 0.75rem 2.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '0.95rem',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                    resize: 'vertical',
                    minHeight: '100px'
                  }}
                  disabled={loading}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{
                backgroundColor: '#1e40af',
                color: 'white',
                padding: '0.75rem 1.5rem',
                border: 'none',
                borderRadius: '6px',
                fontSize: '1rem',
                fontWeight: 500,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                transition: 'background-color 0.2s',
                marginTop: '0.5rem'
              }}
            >
              {loading ? (
                <>
                  <div className="spinner" style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid #ffffff',
                    borderTop: '2px solid transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }}></div>
                  Submitting...
                </>
              ) : (
                <>
                  <Send size={18} />
                  Submit Request
                </>
              )}
            </button>
          </form>
        )}

        <div style={{ 
          marginTop: '1.5rem', 
          paddingTop: '1rem', 
          borderTop: '1px solid #e5e7eb',
          textAlign: 'center',
          fontSize: '0.85rem',
          color: '#6b7280'
        }}>
          <p style={{ margin: 0 }}>
            Your request will be reviewed by the system administrator. 
            You will be notified once a decision is made.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignupRequest;
