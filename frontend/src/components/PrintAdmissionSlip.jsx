// src/components/PrintAdmissionSlip.jsx
import React, { useState, useEffect, useRef } from 'react';
import { issueAdmissionSlip, verifyStudent, getStudentAdmissionSlips, getAdminCourses, getCourseYearLevels, getYearLevelSections, checkStudentEditOverride } from '../services/api';
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
  const pendingYearLevel = useRef('');

  // Student edit override state
  const [studentEditOverride, setStudentEditOverride] = useState(false);
  const [overrideLoading, setOverrideLoading] = useState(false);

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
          setMatchedStudent(resp.data.student || null);
          
          // Check if editing is allowed due to override setting
          const allowEdit = resp.data.allowEdit || resp.data.overrideEnabled || false;
          
          if (allowEdit && studentEditOverride) {
            // Override enabled - allow editing but DON'T auto-fill dropdowns
            setVerified(false); // Still treat as existing student for button text
            setVerificationMessage(resp.data.message || 'Student found - you can edit the information below');
            
            // Only pre-fill the name fields, but leave course/year/section for counselor to choose
            const s = resp.data.student || {};
            const full = (s.full_name || '').toString().trim();
            const parts = full.split(/\s+/).filter(Boolean);
            const first = parts[0] || '';
            const last = parts.length > 1 ? parts[parts.length - 1] : '';
            const middle = parts.length > 2 ? parts.slice(1, -1).join(' ') : '';

            // Block the verify useEffect from re-triggering while we write state
            autofillInProgress.current = true;
            setFormData(fd => ({
              ...fd,
              firstName: first,
              middleName: middle,
              lastName: last,
              // Keep current year and section values - don't override them
              year: fd.year,
              section: fd.section
            }));

            // DON'T auto-fill course, year level, or section when override is enabled
            // Let the counselor choose these values manually
            
            setTimeout(() => { autofillInProgress.current = false; }, 0);
          } else {
            // Override disabled - block editing
            setVerified(false);
            setVerificationMessage(resp.data.message || 'A matching student was found');
            
            // Auto-fill to show existing data but don't allow editing
            const s = resp.data.student || {};
            const full = (s.full_name || '').toString().trim();
            const parts = full.split(/\s+/).filter(Boolean);
            const first = parts[0] || '';
            const last = parts.length > 1 ? parts[parts.length - 1] : '';
            const middle = parts.length > 2 ? parts.slice(1, -1).join(' ') : '';
            const targetSection = s.section || '';
            const targetYear = s.year || '';

            autofillInProgress.current = true;
            setFormData(fd => ({
              ...fd,
              firstName: first,
              middleName: middle,
              lastName: last,
              year: targetYear || fd.year,
              section: targetSection || fd.section
            }));

            const matchedCourse = s.course
              ? courses.find(c => c.name === s.course || c.code === s.course)
              : null;

            if (matchedCourse && String(matchedCourse.id) !== String(courseId)) {
              pendingYearLevel.current = targetYear;
              pendingSection.current = targetSection;
              setCourseId(String(matchedCourse.id));
            } else {
              const matchedYl = targetYear ? yearLevels.find(yl => yl.year_level === targetYear) : null;
              if (matchedYl && String(matchedYl.id) !== String(yearLevelId)) {
                pendingSection.current = targetSection;
                setYearLevelId(String(matchedYl.id));
              } else if (matchedYl) {
                pendingSection.current = '';
                setFormData(fd => ({ ...fd, section: targetSection }));
              }
            }

            setTimeout(() => { autofillInProgress.current = false; }, 0);
          }
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

  // Load student edit override setting
  useEffect(() => {
    let mounted = true;
    const loadOverrideSetting = async () => {
      try {
        setOverrideLoading(true);
        const response = await checkStudentEditOverride();
        if (mounted) {
          setStudentEditOverride(response.data?.enabled || false);
        }
      } catch (error) {
        console.warn('Failed to check student edit override:', error);
        if (mounted) setStudentEditOverride(false);
      } finally {
        if (mounted) setOverrideLoading(false);
      }
    };
    
    loadOverrideSetting();
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

  // When year levels finish loading after an autofill-driven course change,
  // find and apply the pending year level so the dropdown resolves correctly.
  useEffect(() => {
    if (pendingYearLevel.current && yearLevels.length > 0) {
      const target = pendingYearLevel.current;
      pendingYearLevel.current = '';
      const matchedYl = yearLevels.find(yl => yl.year_level === target);
      if (matchedYl) setYearLevelId(String(matchedYl.id));
    }
  }, [yearLevels]);

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
      if (matchedStudent && matchedStudent.id) {
        payload.student_id = matchedStudent.id;
        // Add update flag if override is enabled and we're allowing edits
        if (studentEditOverride) {
          payload.updateExistingStudent = true;
        }
      }
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
      <div className="card" style={{ padding: '32px', fontFamily: 'Arial, sans-serif' }}>

        {/* University Header */}
        <div style={{ textAlign: 'center', marginBottom: '15px' }}>
          <h2 style={{ color: '#006400', fontFamily: 'Times New Roman, serif', margin: '0', fontSize: '24px', letterSpacing: '0.5px' }}>ISABELA STATE UNIVERSITY</h2>
          <h3 style={{ margin: '8px 0', fontFamily: 'Times New Roman, serif', fontSize: '16px', fontWeight: 'normal', letterSpacing: '1px' }}>GUIDANCE OFFICE</h3>
          <h3 style={{ textDecoration: 'underline', margin: '15px 0 5px 0', fontSize: '20px', fontWeight: 'bold', fontFamily: 'Arial, sans-serif' }}>ADMISSION SLIP ISSUANCE</h3>
        </div>

        <hr style={{ border: 'none', borderTop: '3px double #006400', margin: '20px 0' }} />

        <p className="text-muted" style={{ marginBottom: '24px', lineHeight: '1.5', fontSize: '0.95rem', color: '#555', fontFamily: 'Arial, sans-serif' }}>
          Issue an admission slip for a student who has violated university policy. The system will log the issuance and generate a printable slip.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column' }}>

          <div style={{ border: '1px solid #c1c1c1', backgroundColor: '#fff', marginBottom: '20px' }}>
            {/* Student Name Section */}
            <div style={{ borderBottom: '1px solid #c1c1c1', padding: '12px 16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#555', fontWeight: 700, letterSpacing: '0.5px' }}>STUDENT NAME *</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
                <div style={{ position: 'relative' }}>
                  <User style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: '#6b7280' }} />
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    maxLength={32}
                    className="form-input"
                    placeholder="First"
                    required
                    style={{ paddingLeft: '34px', width: '100%', border: '1px solid #ccc', borderRadius: '4px', height: '40px' }}
                  />
                </div>
                <input
                  type="text"
                  name="middleName"
                  value={formData.middleName}
                  onChange={handleChange}
                  maxLength={32}
                  className="form-input"
                  placeholder="Middle"
                  style={{ width: '100%', border: '1px solid #ccc', borderRadius: '4px', height: '40px' }}
                />
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  maxLength={32}
                  className="form-input"
                  placeholder="Last"
                  required
                  style={{ width: '100%', border: '1px solid #ccc', borderRadius: '4px', height: '40px' }}
                />
              </div>
            </div>

            {/* Course Section */}
            <div style={{ borderBottom: '1px solid #c1c1c1', padding: '12px 16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#555', fontWeight: 700, letterSpacing: '0.5px' }}>COURSE *</label>
              <div style={{ position: 'relative' }}>
                <GraduationCap style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', width: '18px', height: '18px', color: '#6b7280' }} />
                <select
                  value={courseId}
                  onChange={handleCourseChange}
                  className="form-input"
                  required
                  disabled={coursesLoading || (verified === false && !studentEditOverride)}
                  style={{ paddingLeft: '34px', width: '100%', border: '1px solid #ccc', borderRadius: '4px', height: '40px', appearance: 'none', backgroundColor: '#fff' }}
                >
                  <option value="">
                    {coursesLoading ? 'Loading courses…' : 'Select course'}
                  </option>
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Year & Section Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
              <div style={{ borderRight: '1px solid #c1c1c1', padding: '12px 16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#555', fontWeight: 700, letterSpacing: '0.5px' }}>YEAR LEVEL *</label>
                <div style={{ position: 'relative' }}>
                  <Book style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: '#6b7280' }} />
                  <select
                    value={yearLevelId}
                    onChange={handleYearLevelChange}
                    className="form-input"
                    required
                    disabled={!courseId || yearLevelsLoading || (verified === false && !studentEditOverride)}
                    style={{ paddingLeft: '34px', width: '100%', border: '1px solid #ccc', borderRadius: '4px', height: '40px', appearance: 'none', backgroundColor: '#fff' }}
                  >
                    <option value="">Select year</option>
                    {yearLevels.map(yl => (
                      <option key={yl.id} value={yl.id}>{yl.year_level}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ padding: '12px 16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#555', fontWeight: 700, letterSpacing: '0.5px' }}>SECTION *</label>
                <div style={{ position: 'relative' }}>
                  <Users style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: '#6b7280' }} />
                  <select
                    name="section"
                    value={formData.section}
                    onChange={handleChange}
                    className="form-input"
                    required
                    disabled={!yearLevelId || sectionsLoading || (verified === false && !studentEditOverride)}
                    style={{ paddingLeft: '34px', width: '100%', border: '1px solid #ccc', borderRadius: '4px', height: '40px', appearance: 'none', backgroundColor: '#fff' }}
                  >
                    <option value="">Select section</option>
                    {sections.map(s => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div style={{ padding: '12px', marginBottom: '16px', fontSize: '14px', color: '#b91c1c', backgroundColor: '#fee2e2', borderRadius: '4px', border: '1px solid #fca5a5' }}>
              {error}
            </div>
          )}

          {/* Verification status */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '13px', fontWeight: 500, color: verified === true || (verified === false && studentEditOverride && matchedStudent) ? '#059669' : verified === false ? '#b91c1c' : '#6b7280' }}>
              {verificationLoading ? 'Checking records...' : verificationMessage}
            </div>
          </div>

          {/* Previous slips display */}
          {matchedStudent && (
            <div style={{ marginBottom: '20px', padding: '16px', borderRadius: '4px', border: '1px solid #e5e7eb', background: '#f9fafb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ fontWeight: 700, fontSize: '14px', textTransform: 'uppercase', color: '#374151' }}>Previous records: {matchedStudent.full_name}</div>
                <div style={{ fontSize: '12px', background: '#e5e7eb', padding: '2px 8px', borderRadius: '12px', color: '#4b5563' }}>{slipsTotal} slips</div>
              </div>

              {slipsLoading ? (
                <div style={{ fontSize: '13px', color: '#6b7280' }}>Loading records…</div>
              ) : studentSlips.length === 0 ? (
                <div style={{ fontSize: '13px', color: '#6b7280' }}>No previous records found.</div>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {studentSlips.map(s => (
                      <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', borderBottom: '1px solid #e5e7eb', fontSize: '13px' }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{s.slip_number}</div>
                          <div style={{ color: '#6b7280' }}>{new Date(s.created_at).toLocaleDateString()}</div>
                        </div>
                        <div style={{ fontWeight: 700, color: s.status === 'approved' ? '#059669' : '#b45309' }}>
                          {(s.status || '').toUpperCase()}
                        </div>
                      </div>
                    ))}
                  </div>

                  {(() => {
                    const totalPages = Math.ceil((slipsTotal || 0) / slipsPageSize);
                    if (totalPages <= 1) return null;
                    return (
                      <div style={{ marginTop: '12px', display: 'flex', gap: '6px' }}>
                        {[...Array(totalPages)].map((_, i) => (
                          <button
                            type="button"
                            key={i}
                            onClick={() => setSlipsPage(i + 1)}
                            style={{
                              padding: '4px 10px',
                              fontSize: '12px',
                              backgroundColor: (i + 1) === slipsPage ? '#1e7b44' : '#fff',
                              color: (i + 1) === slipsPage ? '#fff' : '#374151',
                              border: '1px solid #d1d5db',
                              borderRadius: '4px',
                              cursor: 'pointer'
                            }}
                          >{i + 1}</button>
                        ))}
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          )}

          {result && (
            <div style={{ padding: '16px', borderRadius: '4px', border: '1px solid #d1fae5', background: '#ecfdf5', color: '#065f46', marginBottom: '20px' }}>
              <p style={{ fontWeight: 700, margin: '0 0 8px 0' }}>SLIP ISSUED SUCCESSFULLY</p>
              <p style={{ margin: '0 0 12px 0', fontSize: '14px' }}>Reference: <strong>{result.slip.slip_number}</strong></p>
              {printedSlipId !== result.slip.id && (
                <button
                  type="button"
                  onClick={handlePrint}
                  style={{ padding: '8px 16px', backgroundColor: '#1e7b44', color: 'white', borderRadius: '4px', border: 'none', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
                >
                  Print Admission Slip
                </button>
              )}
            </div>
          )}

          {!(printedSlipId && result && printedSlipId === result.slip.id) && (
            <button
              type="submit"
              disabled={submitDisabled}
              style={{
                width: '100%',
                padding: '14px',
                backgroundColor: '#1e7b44',
                color: 'white',
                borderRadius: '4px',
                border: 'none',
                fontWeight: 700,
                fontSize: '15px',
                cursor: submitDisabled ? 'not-allowed' : 'pointer',
                opacity: submitDisabled ? 0.6 : 1,
                textTransform: 'uppercase',
                letterSpacing: '1px'
              }}
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