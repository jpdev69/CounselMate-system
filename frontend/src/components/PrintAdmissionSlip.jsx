// src/components/PrintAdmissionSlip.jsx
import React, { useState, useEffect, useRef } from 'react';
import { issueAdmissionSlip, verifyStudent, getStudentAdmissionSlips } from '../services/api';
import api from '../services/api';
import { useSlips } from '../contexts/SlipsContext';
import { Printer, User, Book, Users } from 'lucide-react';

const PrintAdmissionSlip = () => {
  const [formData, setFormData] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    year: '',
    section: ''
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [printedSlipId, setPrintedSlipId] = useState(null);
  const [verified, setVerified] = useState(null); // null = not checked, true = ok, false = duplicate
  const [matchedStudent, setMatchedStudent] = useState(null);
  const [studentSlips, setStudentSlips] = useState([]);
  const [slipsPage, setSlipsPage] = useState(1);
  const [slipsPageSize] = useState(3);
  const [slipsTotal, setSlipsTotal] = useState(0);
  const [slipsLoading, setSlipsLoading] = useState(false);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState('');
  const verifyTimer = useRef(null);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    // Reset verification state when user edits the name/year/section
    if (['firstName', 'middleName', 'lastName', 'year', 'section'].includes(e.target.name)) {
      setVerified(null);
      setVerificationMessage('');
      setError('');
      setMatchedStudent(null);
      // Clear any previous success result and printed flag when user begins a new entry
      setResult(null);
      setPrintedSlipId(null);
    }
  };

  // Real-time (debounced) verification when name/year/section change
  useEffect(() => {
    // Only attempt verification when required fields are filled
    const firstName = (formData.firstName || '').toString().trim();
    const middleName = (formData.middleName || '').toString().trim();
    const lastName = (formData.lastName || '').toString().trim();
    const year = (formData.year || '').toString().trim();
    const section = (formData.section || '').toString().trim();

    if (!firstName || !lastName || !year || !section) {
      // incomplete — clear verification state
      setVerified(null);
      setVerificationMessage('Fill each form to verify');
      setVerificationLoading(false);
      return;
    }

    // debounce to avoid calling API on every keystroke
    setVerificationLoading(true);
    if (verifyTimer.current) clearTimeout(verifyTimer.current);
    verifyTimer.current = setTimeout(async () => {
      try {
        const resp = await verifyStudent({ firstName, middleName, lastName, year, section });
        if (resp.data?.exists) {
          setVerified(false);
          // store matched student info so we can attach slips to the existing record
          setMatchedStudent(resp.data.student || null);
          // autofill form with existing student details (retain previous data)
          try {
            const s = resp.data.student || {};
            const full = (s.full_name || '').toString().trim();
            const parts = full.split(/\s+/).filter(Boolean);
            const first = parts[0] || '';
            const last = parts.length > 1 ? parts[parts.length - 1] : '';
            const middle = parts.length > 2 ? parts.slice(1, -1).join(' ') : '';
            setFormData(fd => ({
              ...fd,
              firstName: first,
              middleName: middle,
              lastName: last,
              year: s.year || fd.year,
              section: s.section || fd.section
            }));
          } catch (e) {
            // ignore autofill errors
          }
          // show the duplicate message in the verification status only (avoid duplicating it in the error box)
          setVerificationMessage(resp.data.message || 'A matching student was found');
        } else {
          setVerified(true);
          setVerificationMessage('No matching student found. You may issue the slip.');
          setError('');
        }
      } catch (vErr) {
        console.error('Verification error:', vErr);
        setVerified(false);
        setVerificationMessage(vErr.response?.data?.error || 'Verification failed');
        setError(vErr.response?.data?.error || 'Verification failed');
      } finally {
        setVerificationLoading(false);
      }
    }, 600);

    return () => {
      if (verifyTimer.current) {
        clearTimeout(verifyTimer.current);
        verifyTimer.current = null;
      }
    };
  }, [formData.firstName, formData.middleName, formData.lastName, formData.year, formData.section]);

  // Fetch matched student's slips with pagination when a student is matched
  useEffect(() => {
    let cancelled = false;
    const fetchSlips = async () => {
      if (!matchedStudent || !matchedStudent.id) {
        setStudentSlips([]);
        setSlipsTotal(0);
        return;
      }
      setSlipsLoading(true);
      try {
        const resp = await getStudentAdmissionSlips(matchedStudent.id, slipsPage, slipsPageSize);
        if (cancelled) return;
        if (resp.data?.success) {
          setStudentSlips(resp.data.slips || []);
          setSlipsTotal(resp.data.total || 0);
        } else {
          setStudentSlips([]);
          setSlipsTotal(0);
        }
      } catch (e) {
        console.error('Failed to load student slips:', e);
        setStudentSlips([]);
        setSlipsTotal(0);
      } finally {
        if (!cancelled) setSlipsLoading(false);
      }
    };
    fetchSlips();
    return () => { cancelled = true; };
  }, [matchedStudent, slipsPage, slipsPageSize]);

  const { issueSlip } = useSlips();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    // Ensure verification ran before issuing (either new or existing student)
    if (verified === null) {
      setError('Please verify the student first before issuing an admission slip.');
      setLoading(false);
      return;
    }

    try {
      // Basic client-side validation to avoid blank users
      const studentName = [formData.firstName, formData.middleName, formData.lastName]
        .map(s => (s || '').toString().trim())
        .filter(Boolean)
        .join(' ');
      if (!studentName || !formData.section || !formData.section.toString().trim()) {
        setError('Student name and section are required');
        setLoading(false);
        return;
      }

      // Prefer to use context helper so state is updated centrally
      // If we matched an existing student, include its DB id so backend will attach the slip
      const payload = { ...formData, studentName };
      if (matchedStudent && matchedStudent.id) payload.student_id = matchedStudent.id;
      let response;
      if (issueSlip) {
        response = await issueSlip(payload);
      } else {
        response = await issueAdmissionSlip(payload);
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
      setFormData({ firstName: '', middleName: '', lastName: '', year: '', section: '' });
      setVerified(null);
      setVerificationMessage('');
      setMatchedStudent(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to issue admission slip');
    } finally {
      setLoading(false);
    }
  };

  // Manual verify removed — verification runs automatically via the debounced effect above.

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

  // Determine submit button state and label based on verification
  const submitDisabled = loading || verificationLoading || verified === null;
  const submitLabel = loading
    ? 'Issuing Slip...'
    : verified === true
      ? 'New Student'
      : verified === false
        ? 'Add to Existing Student'
        : 'Issue Admission Slip';

  return (
    <div className="container">
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <Printer style={{ width: 28, height: 28, color: 'var(--primary)' }} />
          <h1 style={{ marginLeft: 12, fontSize: 20, fontWeight: 700 }}>Print Admission Slip</h1>
        </div>

        <p className="text-muted" style={{ marginBottom: '16px', lineHeight: '1.5', fontSize: '0.95rem' }}>
          Issue an admission slip for a student who has violated university policy. The system will log the issuance and generate a printable slip.
        </p>

        <form onSubmit={handleSubmit} className="" style={{ display: 'grid', gap: 12 }}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Student Name
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
              <div className="input-with-icon">
                <User className="icon" />
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="First name"
                  required
                />
              </div>
              <div>
                <input
                  type="text"
                  name="middleName"
                  value={formData.middleName}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="Middle name (optional)"
                />
              </div>
              <div>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="Last name"
                  required
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Year Level
            </label>
            <div className="input-with-icon">
              <Book className="icon" />
              <select
                name="year"
                value={formData.year}
                onChange={handleChange}
                className="form-input"
                required
              >
                <option value="">Select year level</option>
                <option value="1st Year">1st Year</option>
                <option value="2nd Year">2nd Year</option>
                <option value="3rd Year">3rd Year</option>
                <option value="4th Year">4th Year</option>
                <option value="5th Year">5th Year</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Section
            </label>
            <div className="input-with-icon">
              <Users className="icon" />
              <select
                name="section"
                value={formData.section}
                onChange={handleChange}
                className="form-input"
                required
              >
                <option value="">Select section</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
              </select>
            </div>
          </div>

          {error && (
            <div className="p-3 text-sm text-red-700 bg-red-100 rounded-lg">
              {error}
            </div>
          )}

          {/* Verification status (automatic) */}
          <div style={{ marginTop: 6 }}>
            <div style={{ fontSize: 13, color: verified === true ? 'green' : verified === false ? '#b91c1c' : '#6b7280' }}>
              {verificationLoading ? 'Verifying...' : verificationMessage}
            </div>
          </div>

          {/* Matched student's previous slips */}
          {matchedStudent && (
            <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: '#f8fafc' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontWeight: 600 }}>Previous slips for: {matchedStudent.full_name || matchedStudent.student_id || '—'}</div>
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>{slipsTotal} total</div>
              </div>

              {slipsLoading ? (
                <div style={{ fontSize: 13, color: '#6b7280' }}>Loading slips…</div>
              ) : studentSlips.length === 0 ? (
                <div style={{ fontSize: 13, color: '#6b7280' }}>No previously issued slips for this student.</div>
              ) : (
                <div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {studentSlips.map(s => (
                      <li key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e6edf3' }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{s.slip_number}</div>
                          <div style={{ fontSize: 13, color: '#6b7280' }}>{new Date(s.created_at || Date.now()).toLocaleString()}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <div style={{ fontSize: 13, color: '#374151' }}>{(s.status || '').toString().toUpperCase()}</div>
                        </div>
                      </li>
                    ))}
                  </ul>

                  {/* Pagination buttons */}
                  {(() => {
                    const totalPages = Math.ceil((slipsTotal || 0) / slipsPageSize);
                    if (totalPages <= 1) return null;
                    const pages = [];
                    for (let i = 1; i <= totalPages; i++) pages.push(i);
                    return (
                      <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {pages.map(p => (
                          <button
                            type="button"
                            key={p}
                            onClick={() => setSlipsPage(p)}
                            className={`btn ${p === slipsPage ? 'btn-primary' : 'btn-outline'}`}
                            style={{ padding: '6px 10px' }}
                          >{p}</button>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}
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
              disabled={submitDisabled}
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px', fontWeight: 600, opacity: submitDisabled ? 0.6 : 1 }}
            >
              {submitLabel}
            </button>
          )}
        </form>
      </div>
    </div>
  );
};

export default PrintAdmissionSlip;