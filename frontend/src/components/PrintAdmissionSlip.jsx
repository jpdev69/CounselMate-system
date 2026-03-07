// src/components/PrintAdmissionSlip.jsx
import React, { useState, useEffect, useRef } from 'react';
import { issueAdmissionSlip, verifyStudent, getStudentAdmissionSlips, getAdminCourses, getCourseYearLevels, getYearLevelSections } from '../services/api';
import api from '../services/api';
import { useSlips } from '../contexts/SlipsContext';
import { Printer, User, Book, Users, GraduationCap } from 'lucide-react';

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
  const autofillInProgress = useRef(false);
  const pendingSection = useRef('');

  const [courseId, setCourseId] = useState('');
  const [yearLevelId, setYearLevelId] = useState('');
  const [courses, setCourses] = useState([]);
  const [yearLevels, setYearLevels] = useState([]);
  const [sections, setSections] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [yearLevelsLoading, setYearLevelsLoading] = useState(false);
  const [sectionsLoading, setSectionsLoading] = useState(false);

  const handleChange = (e) => {
    const val = (e.target.value || '').toString().slice(0, 32);
    setFormData({
      ...formData,
      [e.target.name]: val
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

    // Suppress re-verification triggered by our own autofill writes
    if (autofillInProgress.current) return;

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
            const matchedYl = s.year ? yearLevels.find(yl => yl.year_level === s.year) : null;
            const targetSection = s.section || '';

            autofillInProgress.current = true;
            setFormData(fd => ({
              ...fd,
              firstName: first,
              middleName: middle,
              lastName: last,
              year: s.year || fd.year,
              section: targetSection || fd.section
            }));

            if (matchedYl && String(matchedYl.id) !== String(yearLevelId)) {
              pendingSection.current = targetSection;
              setYearLevelId(String(matchedYl.id));
            } else if (matchedYl && String(matchedYl.id) === String(yearLevelId)) {
              pendingSection.current = '';
              setFormData(fd => ({ ...fd, section: targetSection }));
            }
            setTimeout(() => { autofillInProgress.current = false; }, 0);
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

  // Fetch courses on mount
  useEffect(() => {
    let mounted = true;
    setCoursesLoading(true);
    getAdminCourses()
      .then(res => { if (mounted) setCourses(res.data?.courses || []); })
      .catch(err => console.error('Failed to load courses', err))
      .finally(() => { if (mounted) setCoursesLoading(false); });
    return () => { mounted = false; };
  }, []);

  // Fetch year levels when courseId changes
  useEffect(() => {
    if (!courseId) { setYearLevels([]); setYearLevelId(''); return; }
    let mounted = true;
    setYearLevelsLoading(true);
    getCourseYearLevels(courseId)
      .then(res => { if (mounted) setYearLevels(res.data?.yearLevels || []); })
      .catch(err => console.error('Failed to load year levels', err))
      .finally(() => { if (mounted) setYearLevelsLoading(false); });
    return () => { mounted = false; };
  }, [courseId]);

  // Fetch sections when yearLevelId changes
  useEffect(() => {
    if (!yearLevelId) { setSections([]); return; }
    let mounted = true;
    setSectionsLoading(true);
    getYearLevelSections(yearLevelId)
      .then(res => { if (mounted) setSections(res.data?.sections || []); })
      .catch(err => console.error('Failed to load sections', err))
      .finally(() => { if (mounted) setSectionsLoading(false); });
    return () => { mounted = false; };
  }, [yearLevelId]);

  // When sections finish loading after an autofill-driven year level change,
  // apply the pending section so the dropdown resolves correctly.
  useEffect(() => {
    if (pendingSection.current && sections.length > 0) {
      const target = pendingSection.current;
      pendingSection.current = '';
      setFormData(fd => ({ ...fd, section: target }));
    }
  }, [sections]);

  const handleCourseChange = (e) => {
    const val = e.target.value;
    setCourseId(val);
    setYearLevelId('');
    setSections([]);
    setFormData(fd => ({ ...fd, year: '', section: '' }));
    setVerified(null);
    setVerificationMessage('');
    setError('');
    setMatchedStudent(null);
    setResult(null);
    setPrintedSlipId(null);
  };

  const handleYearLevelChange = (e) => {
    const val = e.target.value;
    setYearLevelId(val);
    const yl = yearLevels.find(y => String(y.id) === val);
    setSections([]);
    setFormData(fd => ({ ...fd, year: yl ? yl.year_level : '', section: '' }));
    setVerified(null);
    setVerificationMessage('');
    setError('');
    setMatchedStudent(null);
    setResult(null);
    setPrintedSlipId(null);
  };

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
      if (!studentName || !courseId || !formData.year || !formData.section || !formData.section.toString().trim()) {
        setError('Student name, course, year level, and section are required');
        setLoading(false);
        return;
      }

      // Prefer to use context helper so state is updated centrally
      // If we matched an existing student, include its DB id so backend will attach the slip
      const selectedCourseObj = courses.find(c => String(c.id) === String(courseId));
      const courseName = selectedCourseObj ? selectedCourseObj.name : '';
      const payload = { ...formData, studentName, course: courseName };
      if (matchedStudent && matchedStudent.id) payload.student_id = matchedStudent.id;
      let response;
      if (issueSlip) {
        response = await issueSlip(payload);
      } else {
        response = await issueAdmissionSlip(payload);
      }
      setResult(response.data);

      // Open backend print endpoint in a new tab using authenticated request
      const slipId = response.data?.slip?.id;
      if (slipId) {
        await openPrintTab(slipId);
        setPrintedSlipId(slipId);
      }

      // Reset form
      setFormData({ firstName: '', middleName: '', lastName: '', year: '', section: '' });
      setCourseId('');
      setYearLevelId('');
      setSections([]);
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

  // Opens the backend-generated print HTML in a new tab using the authenticated axios
  // instance so the JWT token is sent — plain window.open() would be rejected (401).
  const openPrintTab = async (slipId) => {
    try {
      const response = await api.get(`/admission-slips/print-slip?slip_id=${encodeURIComponent(slipId)}`, {
        responseType: 'text',
      });
      const blob = new Blob([response.data], { type: 'text/html' });
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
    } catch (err) {
      console.error('Failed to open print tab:', err);
    }
  };

  const handlePrint = () => {
    const slipId = result?.slip?.id;
    if (slipId) {
      openPrintTab(slipId);
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
                  maxLength={32}
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
                  maxLength={32}
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
                  maxLength={32}
                  className="form-input"
                  placeholder="Last name"
                  required
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Course
            </label>
            <div className="input-with-icon">
              <GraduationCap className="icon" />
              <select
                value={courseId}
                onChange={handleCourseChange}
                className="form-input"
                required
                disabled={coursesLoading}
              >
                <option value="">
                  {coursesLoading
                    ? 'Loading courses…'
                    : courses.length === 0
                      ? 'No courses — configure in Admin Panel'
                      : 'Select course'}
                </option>
                {courses.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Year Level
            </label>
            <div className="input-with-icon">
              <Book className="icon" />
              <select
                value={yearLevelId}
                onChange={handleYearLevelChange}
                className="form-input"
                required
                disabled={!courseId || yearLevelsLoading}
              >
                <option value="">
                  {!courseId
                    ? 'Select a course first'
                    : yearLevelsLoading
                      ? 'Loading…'
                      : yearLevels.length === 0
                        ? 'No year levels configured'
                        : 'Select year level'}
                </option>
                {yearLevels.map(yl => (
                  <option key={yl.id} value={yl.id}>{yl.year_level}</option>
                ))}
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
                disabled={!yearLevelId || sectionsLoading}
              >
                <option value="">
                  {!yearLevelId
                    ? 'Select a year level first'
                    : sectionsLoading
                      ? 'Loading…'
                      : sections.length === 0
                        ? 'No sections configured'
                        : 'Select section'}
                </option>
                {sections.map(s => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
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