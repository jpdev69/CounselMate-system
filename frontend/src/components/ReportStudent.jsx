// src/components/ReportStudent.jsx
import React, { useState, useEffect, useRef } from 'react';
import { getViolationTypes, verifyStudent, createStudentReport, getAdminCourses, getCourseYearLevels, getYearLevelSections, validateViolation } from '../services/api';
import { ClipboardList, User, Book, Users, GraduationCap } from 'lucide-react';
import SchoolYearSelector from './SchoolYearSelector';
import TermSelector from './TermSelector';

const ReportStudent = () => {
  // Form state
  const [formData, setFormData] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    year: '',
    section: ''
  });
  const [schoolYear, setSchoolYear] = useState('');
  const [term, setTerm] = useState('');
  const [violationTypeId, setViolationTypeId] = useState('');
  const [description, setDescription] = useState('');
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
  const [validationError, setValidationError] = useState(null);
  const [proceedWithError, setProceedWithError] = useState(false);
  const formRef = useRef(null);

  // Violation types
  const [violationTypes, setViolationTypes] = useState([]);

  // Verification
  const [verified, setVerified] = useState(null);
  const [matchedStudent, setMatchedStudent] = useState(null);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState('');
  const verifyTimer = useRef(null);

  // Course / Year / Section dropdowns
  const [courseId, setCourseId] = useState('');
  const [yearLevelId, setYearLevelId] = useState('');
  const [courses, setCourses] = useState([]);
  const [yearLevels, setYearLevels] = useState([]);
  const [sections, setSections] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [yearLevelsLoading, setYearLevelsLoading] = useState(false);
  const [sectionsLoading, setSectionsLoading] = useState(false);

  // Load data on mount
  useEffect(() => {
    loadViolationTypes();
    loadCourses();
  }, []);

  const loadViolationTypes = async () => {
    try {
      const resp = await getViolationTypes();
      setViolationTypes(resp.data || []);
    } catch (err) {
      console.error('Failed to load violation types:', err);
    }
  };

  const loadCourses = async () => {
    setCoursesLoading(true);
    try {
      const res = await getAdminCourses();
      setCourses(res.data?.courses || []);
    } catch (err) {
      console.error('Failed to load courses', err);
    } finally {
      setCoursesLoading(false);
    }
  };

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

  const autofillInProgress = useRef(false);
  const pendingSection = useRef('');
  const pendingYearLevel = useRef('');

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

  // Auto-verify student (debounced)
  useEffect(() => {
    const firstName = (formData.firstName || '').trim();
    const lastName = (formData.lastName || '').trim();
    const year = (formData.year || '').trim();
    const section = (formData.section || '').trim();

    if (!firstName || !lastName || !year || !section) {
      setVerified(null);
      setVerificationMessage('Fill each form to verify');
      setVerificationLoading(false);
      return;
    }

    // Suppress re-verification triggered by our own autofill writes
    if (autofillInProgress.current) return;

    setVerificationLoading(true);
    if (verifyTimer.current) clearTimeout(verifyTimer.current);
    verifyTimer.current = setTimeout(async () => {
      try {
        const resp = await verifyStudent({
          firstName,
          middleName: (formData.middleName || '').trim(),
          lastName,
          year,
          section
        });
        if (resp.data?.exists) {
          setVerified(false);
          setMatchedStudent(resp.data.student || null);
          try {
            const s = resp.data.student || {};
            const full = (s.full_name || '').trim();
            const parts = full.split(/\s+/).filter(Boolean);
            const first = parts[0] || '';
            const last = parts.length > 1 ? parts[parts.length - 1] : '';
            const middle = parts.length > 2 ? parts.slice(1, -1).join(' ') : '';
            const targetSection = s.section || '';
            const targetYear = s.year || '';

            // Block the verify useEffect from re-triggering while we write state
            autofillInProgress.current = true;
            setFormData(fd => ({
              ...fd,
              firstName: first,
              middleName: middle,
              lastName: last,
              year: targetYear || fd.year,
              section: targetSection || fd.section
            }));

            // Try to auto-fill course → year level → section as a chain.
            // The backend returns the most recent course name from reports/slips.
            const matchedCourse = s.course
              ? courses.find(c => c.name === s.course || c.code === s.course)
              : null;

            if (matchedCourse && String(matchedCourse.id) !== String(courseId)) {
              // Course is different — setting courseId triggers yearLevels to reload.
              // Store year and section so they're applied once those loads settle.
              pendingYearLevel.current = targetYear;
              pendingSection.current = targetSection;
              setCourseId(String(matchedCourse.id));
            } else {
              // Course already selected (or not available) — work with already-loaded yearLevels.
              const matchedYl = targetYear ? yearLevels.find(yl => yl.year_level === targetYear) : null;
              if (matchedYl && String(matchedYl.id) !== String(yearLevelId)) {
                pendingSection.current = targetSection;
                setYearLevelId(String(matchedYl.id));
              } else if (matchedYl) {
                pendingSection.current = '';
                setFormData(fd => ({ ...fd, section: targetSection }));
              }
            }

            // Allow verify to run again after React has flushed all state updates
            setTimeout(() => { autofillInProgress.current = false; }, 0);
          } catch (e) { /* ignore autofill errors */ }
          setVerificationMessage(resp.data.message || 'A matching student was found');
        } else {
          setVerified(true);
          setMatchedStudent(null);
          setVerificationMessage('No matching student found. A new record will be created.');
          setError('');
        }
      } catch (vErr) {
        console.error('Verification error:', vErr);
        setVerified(false);
        setVerificationMessage(vErr.response?.data?.error || 'Verification failed');
      } finally {
        setVerificationLoading(false);
      }
    }, 600);

    return () => {
      if (verifyTimer.current) clearTimeout(verifyTimer.current);
    };
  }, [formData.firstName, formData.middleName, formData.lastName, formData.year, formData.section]);

  const handleChange = (e) => {
    const val = (e.target.value || '').toString().slice(0, 32);
    setFormData({ ...formData, [e.target.name]: val });
    if (['firstName', 'middleName', 'lastName', 'year', 'section'].includes(e.target.name)) {
      setVerified(null);
      setVerificationMessage('');
      setError('');
      setSuccess(null);
      setMatchedStudent(null);
    }
  };

  const handleCourseChange = (e) => {
    const val = e.target.value;
    setCourseId(val);
    setYearLevelId('');
    setSections([]);
    setFormData(fd => ({ ...fd, year: '', section: '' }));
    setVerified(null);
    setVerificationMessage('');
    setError('');
    setSuccess(null);
    setMatchedStudent(null);
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
    setSuccess(null);
    setMatchedStudent(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(null);

    if (verified === null) {
      setError('Please fill in all student fields so verification can run.');
      setLoading(false);
      return;
    }

    if (!violationTypeId) {
      setError('Please select a violation type.');
      setLoading(false);
      return;
    }
    if (!description.trim()) {
      setError('Please provide a violation description.');
      setLoading(false);
      return;
    }

    try {
      // LLM validation — check description matches violation type
      const validationResponse = await validateViolation({
        violation_type_id: parseInt(violationTypeId),
        description: description.trim()
      });
      const validationResult = validationResponse.data?.validation;

      if (!validationResult?.matches && !proceedWithError) {
        setValidationError(validationResult?.reason || 'The violation description does not match the selected violation type.');
        setProceedWithError(false);
        setLoading(false);
        return;
      }

      if (validationResult?.matches) {
        setValidationError(null);
        setProceedWithError(false);
      }

      const studentName = [formData.firstName, formData.middleName, formData.lastName]
        .map(s => (s || '').trim())
        .filter(Boolean)
        .join(' ');

      if (!studentName || !courseId || !formData.year || !formData.section.trim()) {
        setError('Student name, course, year level, and section are required');
        setLoading(false);
        return;
      }

      if (!schoolYear) {
        setError('School year is required');
        setLoading(false);
        return;
      }

      if (!term) {
        setError('Term is required');
        setLoading(false);
        return;
      }

      const selectedCourseObj = courses.find(c => String(c.id) === String(courseId));
      const courseName = selectedCourseObj ? selectedCourseObj.name : '';

      const payload = {
        studentName,
        year: formData.year,
        section: formData.section,
        course: courseName,
        schoolYear,
        term,
        violation_type_id: parseInt(violationTypeId),
        description: description.trim(),
        remarks: remarks.trim() || null
      };
      if (matchedStudent && matchedStudent.id) payload.student_id = matchedStudent.id;

      if (!window.confirm('Submit this violation report?')) {
        setLoading(false);
        return;
      }

      await createStudentReport(payload);

      // Reset form
      setFormData({ firstName: '', middleName: '', lastName: '', year: '', section: '' });
      setCourseId('');
      setYearLevelId('');
      setSections([]);
      setViolationTypeId('');
      setDescription('');
      setRemarks('');
      setSchoolYear('');
      setTerm('');
      setVerified(null);
      setVerificationMessage('');
      setMatchedStudent(null);

      setSuccess({
        message: 'Violation report submitted successfully!',
        studentName: studentName,
        violationType: violationTypes.find(vt => vt.id === parseInt(violationTypeId))?.description || 'Unknown violation'
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit report');
    } finally {
      setLoading(false);
    }
  };

  // Group violation types by category — only those NOT requiring an admission slip
  const minorOffenses = violationTypes.filter(vt => vt.category === 'minor' && !vt.requires_admission_slip);
  const majorOffenses = violationTypes.filter(vt => vt.category === 'major' && !vt.requires_admission_slip);

  const submitDisabled = loading || verificationLoading || verified === null;
  const submitLabel = loading
    ? 'Submitting...'
    : verified === true
      ? 'Report New Student'
      : verified === false
        ? 'Report Existing Student'
        : 'Submit Report';

  return (
    <div className="container">
      <div className="card" style={{ padding: '32px', fontFamily: 'Arial, sans-serif' }}>
        
        {/* University Header */}
        <div style={{ textAlign: 'center', marginBottom: '15px' }}>
          <h2 style={{ color: '#006400', fontFamily: 'Times New Roman, serif', margin: '0', fontSize: '24px', letterSpacing: '0.5px' }}>ISABELA STATE UNIVERSITY</h2>
          <h3 style={{ margin: '8px 0', fontFamily: 'Times New Roman, serif', fontSize: '16px', fontWeight: 'normal', letterSpacing: '1px' }}>GUIDANCE OFFICE</h3>
          <h3 style={{ textDecoration: 'underline', margin: '15px 0 5px 0', fontSize: '20px', fontWeight: 'bold', fontFamily: 'Arial, sans-serif' }}>STUDENT VIOLATION REPORT</h3>
        </div>
        
        <hr style={{ border: 'none', borderTop: '3px double #006400', margin: '20px 0' }} />

        <p className="text-muted" style={{ marginBottom: '24px', lineHeight: '1.5', fontSize: '0.95rem', color: '#555', fontFamily: 'Arial, sans-serif' }}>
          Report a student violation based on the ISU Student Manual. This does not require an admission slip.
        </p>

        <form ref={formRef} onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
          
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
                  disabled={coursesLoading}
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
            <div style={{ borderBottom: '1px solid #c1c1c1', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
              <div style={{ borderRight: '1px solid #c1c1c1', padding: '12px 16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#555', fontWeight: 700, letterSpacing: '0.5px' }}>YEAR LEVEL *</label>
                <div style={{ position: 'relative' }}>
                  <Book style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: '#6b7280' }} />
                  <select
                    value={yearLevelId}
                    onChange={handleYearLevelChange}
                    className="form-input"
                    required
                    disabled={!courseId || yearLevelsLoading}
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
                    disabled={!yearLevelId || sectionsLoading}
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

            {/* School Year & Term Grid */}
            <div style={{ borderBottom: '1px solid #c1c1c1', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
              <div style={{ borderRight: '1px solid #c1c1c1', padding: '12px 16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#555', fontWeight: 700, letterSpacing: '0.5px' }}>SCHOOL YEAR *</label>
                <SchoolYearSelector
                  value={schoolYear}
                  onChange={setSchoolYear}
                  required={true}
                />
              </div>

              <div style={{ padding: '12px 16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#555', fontWeight: 700, letterSpacing: '0.5px' }}>TERM *</label>
                <TermSelector
                  value={term}
                  onChange={setTerm}
                  required={true}
                />
              </div>
            </div>

            {/* Verification Status Row (Single centered cell inside table) */}
            <div style={{ borderBottom: '1px solid #c1c1c1', padding: '8px 16px', textAlign: 'center', backgroundColor: '#f9fafb' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: verified === true ? '#059669' : verified === false ? '#b91c1c' : '#6b7280' }}>
                {verificationLoading ? 'VERIFYING STUDENT...' : (verificationMessage || 'COMPLETE FIELDS TO VERIFY').toUpperCase()}
              </div>
            </div>

            {/* Violation Type */}
            <div style={{ borderBottom: '1px solid #c1c1c1', padding: '12px 16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#555', fontWeight: 700, letterSpacing: '0.5px' }}>VIOLATION TYPE *</label>
              <select
                value={violationTypeId}
                onChange={(e) => setViolationTypeId(e.target.value)}
                className="form-input"
                required
                style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '15px' }}
              >
                <option value="">Select violation type</option>
                {minorOffenses.length > 0 && (
                  <optgroup label="Minor Offenses">
                    {minorOffenses.map(vt => (
                      <option key={vt.id} value={vt.id}>{vt.description}</option>
                    ))}
                  </optgroup>
                )}
                {majorOffenses.length > 0 && (
                  <optgroup label="Major Offenses">
                    {majorOffenses.map(vt => (
                      <option key={vt.id} value={vt.id}>{vt.description}</option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            {/* Violation Description */}
            <div style={{ borderBottom: '1px solid #c1c1c1', padding: '12px 16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#555', fontWeight: 700, letterSpacing: '0.5px' }}>VIOLATION DESCRIPTION *</label>
              <textarea
                value={description}
                onChange={(e) => { setDescription((e.target.value || '').slice(0, 500)); if (validationError) setValidationError(null); }}
                maxLength={500}
                rows="4"
                className="form-input"
                placeholder="Detailed description of the violation..."
                required
                style={{ width: '100%', resize: 'vertical', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '15px', borderColor: validationError ? '#ef4444' : undefined }}
              />
              {validationError && (
                <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '4px', color: '#991b1b', fontSize: '13px' }}>
                  <div style={{ fontWeight: 700, marginBottom: '6px' }}>⚠️ VALIDATION ISSUE</div>
                  <div style={{ marginBottom: '10px' }}>{validationError}</div>
                  <button
                    type="button"
                    onClick={() => {
                      setProceedWithError(true);
                      setTimeout(() => { if (formRef.current) formRef.current.requestSubmit(); }, 0);
                    }}
                    style={{ padding: '6px 12px', backgroundColor: '#fbbf24', color: '#111827', border: 'none', borderRadius: '4px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    PROCEED ANYWAY
                  </button>
                </div>
              )}
            </div>

            {/* Counselor Remarks */}
            <div style={{ padding: '12px 16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#555', fontWeight: 700, letterSpacing: '0.5px' }}>COUNSELOR REMARKS</label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks((e.target.value || '').slice(0, 500))}
                maxLength={500}
                rows="3"
                className="form-input"
                placeholder="Additional remarks or recommendations..."
                style={{ width: '100%', resize: 'vertical', padding: '10px', border: '1px solid #e5e7eb', borderRadius: '4px', fontSize: '15px' }}
              />
            </div>
          </div>

          {error && (
            <div style={{ padding: '12px', marginBottom: '16px', fontSize: '14px', color: '#b91c1c', backgroundColor: '#fee2e2', borderRadius: '4px', border: '1px solid #fca5a5' }}>
              {error}
            </div>
          )}

          {success && (
            <div style={{ padding: '16px', borderRadius: '4px', border: '1px solid #d1fae5', background: '#ecfdf5', color: '#065f46', marginBottom: '20px' }}>
              <p style={{ fontWeight: 700, margin: '0 0 8px 0' }}>REPORT SUBMITTED SUCCESSFULLY</p>
              <p style={{ margin: '0 0 4px 0', fontSize: '14px' }}>Student: <strong>{success.studentName}</strong></p>
              <p style={{ margin: '0 0 12px 0', fontSize: '14px' }}>Violation: <strong>{success.violationType}</strong></p>
              <p style={{ margin: '0', fontSize: '13px', color: '#047857' }}>{success.message}</p>
            </div>
          )}

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
        </form>
      </div>
    </div>
  );
};

export default ReportStudent;
