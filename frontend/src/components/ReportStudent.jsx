// src/components/ReportStudent.jsx
import React, { useState, useEffect, useRef } from 'react';
import { getViolationTypes, verifyStudent, createStudentReport, getStudentReports, resolveStudentReport, deleteStudentReport, getAdminCourses, getCourseYearLevels, getYearLevelSections, validateViolation } from '../services/api';
import { ClipboardList, User, Book, Users, GraduationCap, Search, Filter, CheckCircle, Trash2 } from 'lucide-react';

const ReportStudent = () => {
  // Form state
  const [formData, setFormData] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    year: '',
    section: ''
  });
  const [violationTypeId, setViolationTypeId] = useState('');
  const [description, setDescription] = useState('');
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
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

  // Reports list
  const [reports, setReports] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('newest');
  const [selectedReport, setSelectedReport] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Load data on mount
  useEffect(() => {
    loadViolationTypes();
    loadReports();
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

  const loadReports = async () => {
    try {
      const resp = await getStudentReports();
      setReports(resp.data || []);
    } catch (err) {
      console.error('Failed to load reports:', err);
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
            setFormData(fd => ({
              ...fd,
              firstName: first,
              middleName: middle,
              lastName: last,
              year: s.year || fd.year,
              section: s.section || fd.section
            }));
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
    setMatchedStudent(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

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

      const selectedCourseObj = courses.find(c => String(c.id) === String(courseId));
      const courseName = selectedCourseObj ? selectedCourseObj.name : '';

      const payload = {
        studentName,
        year: formData.year,
        section: formData.section,
        course: courseName,
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
      setVerified(null);
      setVerificationMessage('');
      setMatchedStudent(null);

      alert('Violation report submitted successfully!');
      await loadReports();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit report');
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (reportId) => {
    if (!confirm('Mark this report as resolved?')) return;
    try {
      await resolveStudentReport(reportId, {});
      alert('Report resolved successfully.');
      setIsModalOpen(false);
      setSelectedReport(null);
      await loadReports();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to resolve report');
    }
  };

  const handleDelete = async (reportId) => {
    if (!confirm('Are you sure you want to delete this report? This cannot be undone.')) return;
    try {
      await deleteStudentReport(reportId);
      alert('Report deleted successfully.');
      setIsModalOpen(false);
      setSelectedReport(null);
      await loadReports();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete report');
    }
  };

  // Group violation types by category — only those NOT requiring an admission slip
  const minorOffenses = violationTypes.filter(vt => vt.category === 'minor' && !vt.requires_admission_slip);
  const majorOffenses = violationTypes.filter(vt => vt.category === 'major' && !vt.requires_admission_slip);

  // Filter & sort reports
  const filteredReports = reports
    .filter(r =>
      r.student_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.violation_description?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const tA = new Date(a.created_at).getTime() || 0;
      const tB = new Date(b.created_at).getTime() || 0;
      return sortOrder === 'newest' ? tB - tA : tA - tB;
    });

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'reported': return 'bg-yellow-100 text-yellow-800';
      case 'resolved': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

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
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <ClipboardList style={{ width: 28, height: 28, color: 'var(--primary)' }} />
          <h1 style={{ marginLeft: 12, fontSize: 20, fontWeight: 700 }}>Report Student</h1>
        </div>

        <p className="text-muted" style={{ marginBottom: '16px', lineHeight: '1.5', fontSize: '0.95rem' }}>
          Report a student violation based on the ISU Student Manual. This does not require an admission slip.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          {/* Left: Report Form */}
          <div>
            <h2 className="text-lg font-semibold mb-4">New Violation Report</h2>
            <form ref={formRef} onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
              {/* Student Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Student Name</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
                  <div className="input-with-icon">
                    <User className="icon" />
                    <input type="text" name="firstName" value={formData.firstName} onChange={handleChange} maxLength={32} className="form-input" placeholder="First name" required />
                  </div>
                  <div>
                    <input type="text" name="middleName" value={formData.middleName} onChange={handleChange} maxLength={32} className="form-input" placeholder="Middle name (optional)" />
                  </div>
                  <div>
                    <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} maxLength={32} className="form-input" placeholder="Last name" required />
                  </div>
                </div>
              </div>

              {/* Course */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Course</label>
                <div className="input-with-icon">
                  <GraduationCap className="icon" />
                  <select value={courseId} onChange={handleCourseChange} className="form-input" required disabled={coursesLoading}>
                    <option value="">
                      {coursesLoading ? 'Loading courses...' : courses.length === 0 ? 'No courses — configure in Admin Panel' : 'Select course'}
                    </option>
                    {courses.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Year Level */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Year Level</label>
                <div className="input-with-icon">
                  <Book className="icon" />
                  <select value={yearLevelId} onChange={handleYearLevelChange} className="form-input" required disabled={!courseId || yearLevelsLoading}>
                    <option value="">
                      {!courseId ? 'Select a course first' : yearLevelsLoading ? 'Loading...' : yearLevels.length === 0 ? 'No year levels configured' : 'Select year level'}
                    </option>
                    {yearLevels.map(yl => (
                      <option key={yl.id} value={yl.id}>{yl.year_level}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Section */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Section</label>
                <div className="input-with-icon">
                  <Users className="icon" />
                  <select name="section" value={formData.section} onChange={handleChange} className="form-input" required disabled={!yearLevelId || sectionsLoading}>
                    <option value="">
                      {!yearLevelId ? 'Select a year level first' : sectionsLoading ? 'Loading...' : sections.length === 0 ? 'No sections configured' : 'Select section'}
                    </option>
                    {sections.map(s => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Verification status */}
              <div style={{ fontSize: 13, color: verified === true ? 'green' : verified === false ? '#b91c1c' : '#6b7280' }}>
                {verificationLoading ? 'Verifying...' : verificationMessage}
              </div>

              {/* Violation Type */}
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>Violation Type (per Student Manual) *</label>
                <select
                  value={violationTypeId}
                  onChange={(e) => setViolationTypeId(e.target.value)}
                  className="form-input"
                  required
                  style={{ width: '100%' }}
                >
                  <option value="">Select violation type</option>
                  {minorOffenses.length === 0 && majorOffenses.length === 0 && (
                    <option disabled>No violations configured for Report Student — check Admin Panel</option>
                  )}
                  {minorOffenses.length > 0 && (
                    <optgroup label="Minor Offenses (Section 2.1)">
                      {minorOffenses.map(vt => (
                        <option key={vt.id} value={vt.id}>{vt.description}</option>
                      ))}
                    </optgroup>
                  )}
                  {majorOffenses.length > 0 && (
                    <optgroup label="Major Offenses (Section 2.2)">
                      {majorOffenses.map(vt => (
                        <option key={vt.id} value={vt.id}>{vt.description}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              {/* Description */}
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>Violation Description *</label>
                <textarea
                  value={description}
                  onChange={(e) => { setDescription((e.target.value || '').slice(0, 500)); if (validationError) setValidationError(null); }}
                  maxLength={500}
                  rows="4"
                  className="form-input"
                  placeholder="Detailed description of the violation..."
                  required
                  style={{ width: '100%', resize: 'vertical', borderColor: validationError ? '#ef4444' : undefined }}
                />
                {validationError && (
                  <div style={{ marginTop: '8px', padding: '10px', backgroundColor: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '6px', color: '#991b1b', fontSize: '0.9rem' }}>
                    <strong>⚠️ Validation Issue:</strong> {validationError}
                    <div style={{ marginTop: '8px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setProceedWithError(true);
                          setTimeout(() => { if (formRef.current) formRef.current.requestSubmit(); }, 0);
                        }}
                        className="btn"
                        style={{ padding: '4px 12px', backgroundColor: '#fbbf24', color: '#111827', border: 'none', borderRadius: '4px', fontSize: '0.85rem', cursor: 'pointer' }}
                      >
                        Proceed Anyway
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Remarks */}
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>Counselor Remarks</label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks((e.target.value || '').slice(0, 500))}
                  maxLength={500}
                  rows="3"
                  className="form-input"
                  placeholder="Additional remarks or recommendations..."
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>

              {error && (
                <div className="p-3 text-sm text-red-700 bg-red-100 rounded-lg">{error}</div>
              )}

              <button type="submit" disabled={submitDisabled} className="btn btn-primary" style={{ width: '100%' }}>
                {submitLabel}
              </button>
            </form>
          </div>

          {/* Right: Reports List */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Violation Reports</h2>
            <div style={{ marginBottom: '12px', display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px' }}>
              <div className="input-with-icon">
                <Search className="icon" />
                <input
                  type="text"
                  placeholder="Search by student or violation..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm((e.target.value || '').slice(0, 32))}
                  maxLength={32}
                  className="form-input"
                />
              </div>
              <div className="input-with-icon">
                <Filter className="icon" />
                <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="form-input">
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                </select>
              </div>
            </div>

            <div className="records-table-container" style={{ overflowX: 'auto' }}>
              <div className="records-table-scroll">
                <table className="records-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Violation</th>
                      <th>Category</th>
                      <th>Status</th>
                      <th>Date</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReports.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-gray-500">
                          <ClipboardList className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                          <p>No violation reports found</p>
                        </td>
                      </tr>
                    ) : (
                      filteredReports.map(report => (
                        <tr
                          key={report.id}
                          onClick={() => { setSelectedReport(report); setIsModalOpen(true); }}
                          className="hover:bg-gray-50 cursor-pointer"
                        >
                          <td>
                            <h3 className="font-medium text-gray-900">{report.student_name}</h3>
                            <p className="text-xs text-gray-500">{report.course || '-'}</p>
                          </td>
                          <td className="text-xs text-gray-600">{report.violation_description || '-'}</td>
                          <td>
                            <span className={`px-2 py-1 text-xs rounded-full ${report.violation_category === 'major' ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'}`}>
                              {(report.violation_category || 'N/A').toUpperCase()}
                            </span>
                          </td>
                          <td>
                            <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadgeClass(report.status)}`}>
                              {(report.status || 'unknown').toUpperCase()}
                            </span>
                          </td>
                          <td className="text-xs text-gray-600">{report.created_at ? new Date(report.created_at).toLocaleString() : '-'}</td>
                          <td>
                            {report.status === 'reported' && (
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleResolve(report.id); }}
                                  className="mt-1 bg-green-600 text-white py-1 px-2 rounded text-xs hover:bg-green-700 flex items-center"
                                >
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Resolve
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDelete(report.id); }}
                                  className="mt-1 bg-red-600 text-white py-1 px-2 rounded text-xs hover:bg-red-700 flex items-center"
                                >
                                  <Trash2 className="w-3 h-3 mr-1" />
                                  Delete
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="mt-4 text-sm text-gray-600" style={{ paddingLeft: '4px' }}>
              <p>Showing {filteredReports.length} of {reports.length} total reports</p>
            </div>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {isModalOpen && selectedReport && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.45)', padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', padding: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>{selectedReport.student_name}</h3>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadgeClass(selectedReport.status)}`}>
                  {(selectedReport.status || '').toUpperCase()}
                </span>
                <span className={`px-2 py-1 text-xs rounded-full ${selectedReport.violation_category === 'major' ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'}`}>
                  {(selectedReport.violation_category || '').toUpperCase()}
                </span>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="btn"
                  style={{ padding: '6px 12px', background: 'transparent', border: '1px solid var(--primary)', color: 'var(--primary)', borderRadius: 6 }}
                >
                  Close
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '12px' }}>
              <div>
                <div style={{ fontSize: '0.85rem', color: '#374151', fontWeight: 600 }}>Course</div>
                <div style={{ fontSize: '0.95rem', color: '#111827', marginTop: '4px' }}>{selectedReport.course || '-'}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', color: '#374151', fontWeight: 600 }}>Year & Section</div>
                <div style={{ fontSize: '0.95rem', color: '#111827', marginTop: '4px' }}>{[selectedReport.year, selectedReport.section].filter(Boolean).join(' - ') || '-'}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', color: '#374151', fontWeight: 600 }}>Date</div>
                <div style={{ fontSize: '0.95rem', color: '#111827', marginTop: '4px' }}>{selectedReport.created_at ? new Date(selectedReport.created_at).toLocaleString() : '-'}</div>
              </div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '0.85rem', color: '#374151', fontWeight: 600, marginBottom: '6px' }}>Violation Type</div>
              <div style={{ fontSize: '0.95rem', color: '#111827' }}>{selectedReport.violation_description || '-'}</div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '0.85rem', color: '#374151', fontWeight: 600, marginBottom: '6px' }}>Description</div>
              <div style={{ fontSize: '0.95rem', color: '#111827', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{selectedReport.description || '-'}</div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '0.85rem', color: '#374151', fontWeight: 600, marginBottom: '6px' }}>Counselor Remarks</div>
              <div style={{ fontSize: '0.95rem', color: '#111827', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{selectedReport.remarks || '-'}</div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              {selectedReport.status === 'reported' && (
                <>
                  <button onClick={() => handleResolve(selectedReport.id)} className="btn btn-primary">
                    <CheckCircle className="w-4 h-4 mr-1" /> Resolve
                  </button>
                  <button
                    onClick={() => handleDelete(selectedReport.id)}
                    className="btn"
                    style={{ padding: '6px 12px', background: '#ef4444', color: 'white', borderRadius: 6, border: 'none' }}
                  >
                    <Trash2 className="w-4 h-4 mr-1" /> Delete
                  </button>
                </>
              )}
              <button
                onClick={() => setIsModalOpen(false)}
                className="btn"
                style={{ padding: '6px 12px', background: 'transparent', border: '1px solid var(--primary)', color: 'var(--primary)', borderRadius: 6 }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportStudent;
