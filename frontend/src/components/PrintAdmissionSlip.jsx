// src/components/PrintAdmissionSlip.jsx
import React, { useState } from 'react';
import { issueAdmissionSlip } from '../services/api';
import api from '../services/api';
import { useSlips } from '../contexts/SlipsContext';
import { Printer, User, Book, Users } from 'lucide-react';

const PrintAdmissionSlip = () => {
  const [formData, setFormData] = useState({
    studentName: '',
    year: '',
    section: ''
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [printedSlipId, setPrintedSlipId] = useState(null);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const { issueSlip } = useSlips();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      // Basic client-side validation to avoid blank users
      if (!formData.studentName || !formData.studentName.toString().trim() || !formData.section || !formData.section.toString().trim()) {
        setError('Student name and section are required');
        setLoading(false);
        return;
      }

      // Prefer to use context helper so state is updated centrally
      let response;
      if (issueSlip) {
        response = await issueSlip(formData);
      } else {
        response = await issueAdmissionSlip(formData);
      }
      setResult(response.data);

      // Open backend print endpoint in a new tab immediately using API base URL
      const slipId = response.data?.slip?.id;
      if (slipId) {
        try {
          const base = api.defaults?.baseURL || 'http://localhost:5000/api';
          // base already contains '/api', so point to the print-slip path under admission-slips
          const url = `${base.replace(/\/$/, '')}/admission-slips/print-slip?slip_id=${encodeURIComponent(slipId)}`;
          window.open(url, '_blank');
          // mark as printed so UI hides print/issue buttons
          setPrintedSlipId(slipId);
        } catch (openErr) {
          console.warn('Failed to open print tab:', openErr);
        }
      }

      // Reset form
      setFormData({ studentName: '', year: '', section: '' });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to issue admission slip');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    // Prefer opening the backend print endpoint if available
    const slipId = result?.slip?.id;
    if (slipId) {
      const base = api.defaults?.baseURL || 'http://localhost:5000/api';
      const url = `${base.replace(/\/$/, '')}/admission-slips/print-slip?slip_id=${encodeURIComponent(slipId)}`;
      window.open(url, '_blank');
      setPrintedSlipId(slipId);
    }
  };

  return (
    <div className="container">
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <Printer style={{ width: 28, height: 28, color: 'var(--primary)' }} />
          <h1 style={{ marginLeft: 12, fontSize: 20, fontWeight: 700 }}>Print Admission Slip</h1>
        </div>

        <p className="text-gray-600 mb-6">
          Issue an admission slip for a student who has violated university policy.
          The system will log the issuance and generate a printable slip.
        </p>

        <form onSubmit={handleSubmit} className="" style={{ display: 'grid', gap: 12 }}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Student Name
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                name="studentName"
                value={formData.studentName}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="Enter student's full name"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Year Level
            </label>
            <div className="relative">
              <Book className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <select
                name="year"
                value={formData.year}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                required
              >
                <option value="">Select year level</option>
                <option value="1st Year">1st Year</option>
                <option value="2nd Year">2nd Year</option>
                <option value="3rd Year">3rd Year</option>
                <option value="4th Year">4th Year</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Section
            </label>
            <div className="relative">
              <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                name="section"
                value={formData.section}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="Enter section (e.g., A, B, C)"
                required
              />
            </div>
          </div>

          {error && (
            <div className="p-3 text-sm text-red-700 bg-red-100 rounded-lg">
              {error}
            </div>
          )}

          {result && (
            <div style={{ padding: 12, borderRadius: 8, background: 'rgba(16,185,129,0.08)', color: 'var(--success)' }}>
              <p style={{ fontWeight: 600 }}>Admission slip issued successfully!</p>
              <p>Slip Number: {result.slip.slip_number}</p>
              {printedSlipId !== result.slip.id && (
                <button
                  type="button"
                  onClick={handlePrint}
                  className="btn btn-primary"
                  style={{ marginTop: 8 }}
                >
                  Print Slip
                </button>
              )}
              {printedSlipId === result.slip.id && (
                <p style={{ marginTop: 8, fontSize: 13, color: 'var(--muted)' }}>Slip has been printed.</p>
              )}
            </div>
          )}

          {/* Hide issue button after the slip has been printed */}
          {!(printedSlipId && result && printedSlipId === result.slip.id) && (
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px', fontWeight: 600 }}
            >
              {loading ? 'Issuing Slip...' : 'Issue Admission Slip'}
            </button>
          )}
        </form>
      </div>
    </div>
  );
};

export default PrintAdmissionSlip;