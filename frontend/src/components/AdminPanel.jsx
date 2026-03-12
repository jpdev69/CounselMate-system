// src/components/AdminPanel.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Settings, Plus, Trash2, ChevronRight, Upload, BookOpen } from 'lucide-react';
import {
  getAdminCourses, createAdminCourse, updateAdminCourse, deleteAdminCourse,
  getCourseYearLevels, addCourseYearLevel, updateYearLevel, deleteYearLevel,
  getYearLevelSections, addYearLevelSection, updateSection, deleteSection,
  getAdminViolationTypes, updateViolationTypeSlip, extractViolationTypes, saveViolationTypes,
  getStudentManualInfo, uploadStudentManual,
} from '../services/api';

const AdminPanel = () => {
  // ── Courses ────────────────────────────────────────────────────────────────
  const [courses, setCourses] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseCode, setNewCourseCode] = useState('');
  const [courseError, setCourseError] = useState('');
  const [courseAdding, setCourseAdding] = useState(false);

  // edit mode for courses
  const [editCourse, setEditCourse] = useState(null); // { id, name, code }
  const [editCourseError, setEditCourseError] = useState('');
  const [editCourseSaving, setEditCourseSaving] = useState(false);
  const [coursePage, setCoursePage] = useState(1);
  const COURSES_PAGE_SIZE = 6;
  const YEAR_LEVELS_PAGE_SIZE = 4;
  const SECTIONS_PAGE_SIZE = 3;

  // ── Year Levels ────────────────────────────────────────────────────────────
  const [yearLevels, setYearLevels] = useState([]);
  const [yearLevelsLoading, setYearLevelsLoading] = useState(false);
  const [selectedYearLevel, setSelectedYearLevel] = useState(null);
  const [newYearLevel, setNewYearLevel] = useState('');
  const [yearLevelError, setYearLevelError] = useState('');
  const [yearLevelAdding, setYearLevelAdding] = useState(false);
  const [yearLevelPage, setYearLevelPage] = useState(1);

  // edit mode for year levels
  const [editYearLevel, setEditYearLevel] = useState(null); // { id, year_level }
  const [editYearLevelError, setEditYearLevelError] = useState('');
  const [editYearLevelSaving, setEditYearLevelSaving] = useState(false);

  // ── Sections ───────────────────────────────────────────────────────────────
  const [sections, setSections] = useState([]);
  const [sectionsLoading, setSectionsLoading] = useState(false);
  const [newSection, setNewSection] = useState('');
  const [sectionError, setSectionError] = useState('');
  const [sectionAdding, setSectionAdding] = useState(false);
  const [sectionPage, setSectionPage] = useState(1);

  // edit mode for sections
  const [editSection, setEditSection] = useState(null); // { id, name }
  const [editSectionError, setEditSectionError] = useState('');
  const [editSectionSaving, setEditSectionSaving] = useState(false);

  // ── Violation Types ─────────────────────────────────────────────────────
  const [violationTypes, setViolationTypes] = useState([]);
  const [violationTypesLoading, setViolationTypesLoading] = useState(true);
  const [vtTogglingId, setVtTogglingId] = useState(null);
  const [vtPage, setVtPage] = useState(1);
  const VT_PAGE_SIZE = 10;

  // ── Student Manual ──────────────────────────────────────────────────────
  const [manualInfo, setManualInfo] = useState(null);
  const [manualFile, setManualFile] = useState(null);
  const [manualUploading, setManualUploading] = useState(false);
  const [manualUploadSuccess, setManualUploadSuccess] = useState(false);
  const [manualUploadError, setManualUploadError] = useState('');
  const manualFileInputRef = useRef(null);

  // ── Violations Upload ──────────────────────────────────────────────────────
  const [violationsFile, setViolationsFile] = useState(null);
  const [violationsUploading, setViolationsUploading] = useState(false);
  const [violationsUploadSuccess, setViolationsUploadSuccess] = useState(false);
  const [violationsUploadError, setViolationsUploadError] = useState('');
  const violationsFileInputRef = useRef(null);
  const [vtPreview, setVtPreview] = useState(null); // null | array — extracted violations awaiting review
  const [vtExisting, setVtExisting] = useState([]); // current DB violations shown for reference
  const [vtPreviewSaving, setVtPreviewSaving] = useState(false);
  const [vtPreviewSaveSuccess, setVtPreviewSaveSuccess] = useState(false);
  const [vtPreviewError, setVtPreviewError] = useState('');

  // ── Load courses on mount ──────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    setCoursesLoading(true);
    getAdminCourses()
      .then(res => { if (mounted) setCourses(res.data?.courses || []); })
      .catch(err => console.error('Failed to load courses', err))
      .finally(() => { if (mounted) setCoursesLoading(false); });
    return () => { mounted = false; };
  }, []);
  // ── Load violation types on mount ───────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    getAdminViolationTypes()
      .then(res => { if (mounted) setViolationTypes(res.data?.violationTypes || []); })
      .catch(err => console.error('Failed to load violation types', err))
      .finally(() => { if (mounted) setViolationTypesLoading(false); });
    return () => { mounted = false; };
  }, []);

  // ── Load manual info on mount ────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    getStudentManualInfo()
      .then(res => { if (mounted) setManualInfo(res.data?.info || null); })
      .catch(() => { });
    return () => { mounted = false; };
  }, []);
  // ── Load year levels when course changes ───────────────────────────────────
  useEffect(() => {
    if (!selectedCourse) { setYearLevels([]); setSelectedYearLevel(null); setYearLevelPage(1); return; }
    let mounted = true;
    setYearLevelsLoading(true);
    setSelectedYearLevel(null);
    setYearLevelPage(1);
    getCourseYearLevels(selectedCourse.id)
      .then(res => { if (mounted) setYearLevels(res.data?.yearLevels || []); })
      .catch(err => console.error('Failed to load year levels', err))
      .finally(() => { if (mounted) setYearLevelsLoading(false); });
    return () => { mounted = false; };
  }, [selectedCourse]);

  // ── Load sections when year level changes ──────────────────────────────────
  useEffect(() => {
    if (!selectedYearLevel) { setSections([]); setSectionPage(1); return; }
    let mounted = true;
    setSectionsLoading(true);
    setSectionPage(1);
    getYearLevelSections(selectedYearLevel.id)
      .then(res => { if (mounted) setSections(res.data?.sections || []); })
      .catch(err => console.error('Failed to load sections', err))
      .finally(() => { if (mounted) setSectionsLoading(false); });
    return () => { mounted = false; };
  }, [selectedYearLevel]);

  // ── Course handlers ────────────────────────────────────────────────────────
  const handleAddCourse = async (e) => {
    e.preventDefault();
    setCourseError('');
    if (!newCourseName.trim()) return setCourseError('Course name is required');
    if (!newCourseCode.trim()) return setCourseError('Course code is required');
    setCourseAdding(true);
    try {
      const res = await createAdminCourse({ name: newCourseName.trim(), code: newCourseCode.trim() });
      setCourses(prev => [...prev, { ...res.data.course, year_level_count: 0 }]);
      setNewCourseName('');
      setNewCourseCode('');
      setCoursePage(1);
    } catch (err) {
      setCourseError(err.response?.data?.error || 'Failed to add course');
    } finally {
      setCourseAdding(false);
    }
  };

  const handleSaveEditCourse = async (e) => {
    e.preventDefault();
    setEditCourseError('');
    if (!editCourse.name.trim()) return setEditCourseError('Course name is required');
    if (!editCourse.code.trim()) return setEditCourseError('Course code is required');
    setEditCourseSaving(true);
    try {
      const res = await updateAdminCourse(editCourse.id, { name: editCourse.name.trim(), code: editCourse.code.trim() });
      setCourses(prev => prev.map(c => c.id === editCourse.id ? { ...c, ...res.data.course } : c));
      if (selectedCourse?.id === editCourse.id) setSelectedCourse(res.data.course);
      setEditCourse(null);
    } catch (err) {
      setEditCourseError(err.response?.data?.error || 'Failed to update course');
    } finally {
      setEditCourseSaving(false);
    }
  };

  const handleDeleteCourse = async (course) => {
    if (!window.confirm(`Delete "${course.name}"? This will also remove all its year levels and sections.`)) return;
    try {
      await deleteAdminCourse(course.id);
      setCourses(prev => prev.filter(c => c.id !== course.id));
      if (selectedCourse?.id === course.id) setSelectedCourse(null);
      setCoursePage(1);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete course');
    }
  };

  // ── Year level handlers ────────────────────────────────────────────────────
  const handleAddYearLevel = async (e) => {
    e.preventDefault();
    setYearLevelError('');
    if (!newYearLevel.trim()) return setYearLevelError('Year level is required');
    setYearLevelAdding(true);
    try {
      const res = await addCourseYearLevel(selectedCourse.id, {
        year_level: newYearLevel.trim(),
        sort_order: yearLevels.length,
      });
      setYearLevels(prev => [...prev, { ...res.data.yearLevel, section_count: 0 }]);
      // Bump year_level_count on the parent course
      setCourses(prev => prev.map(c =>
        c.id === selectedCourse.id ? { ...c, year_level_count: (c.year_level_count || 0) + 1 } : c
      ));
      setNewYearLevel('');
      setYearLevelPage(1);
    } catch (err) {
      setYearLevelError(err.response?.data?.error || 'Failed to add year level');
    } finally {
      setYearLevelAdding(false);
    }
  };

  const handleSaveEditYearLevel = async (e) => {
    e.preventDefault();
    setEditYearLevelError('');
    if (!editYearLevel.year_level.trim()) return setEditYearLevelError('Year level is required');
    setEditYearLevelSaving(true);
    try {
      const res = await updateYearLevel(editYearLevel.id, { year_level: editYearLevel.year_level.trim() });
      setYearLevels(prev => prev.map(y => y.id === editYearLevel.id ? { ...y, ...res.data.yearLevel } : y));
      if (selectedYearLevel?.id === editYearLevel.id)
        setSelectedYearLevel(prev => ({ ...prev, ...res.data.yearLevel }));
      setEditYearLevel(null);
    } catch (err) {
      setEditYearLevelError(err.response?.data?.error || 'Failed to update year level');
    } finally {
      setEditYearLevelSaving(false);
    }
  };

  const handleDeleteYearLevel = async (yl) => {
    if (!window.confirm(`Delete "${yl.year_level}"? This will also remove its sections.`)) return;
    try {
      await deleteYearLevel(yl.id);
      setYearLevels(prev => prev.filter(y => y.id !== yl.id));
      if (selectedYearLevel?.id === yl.id) setSelectedYearLevel(null);
      setCourses(prev => prev.map(c =>
        c.id === selectedCourse.id ? { ...c, year_level_count: Math.max(0, (c.year_level_count || 1) - 1) } : c
      ));
      setYearLevelPage(1);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete year level');
    }
  };

  // ── Section handlers ───────────────────────────────────────────────────────
  const handleAddSection = async (e) => {
    e.preventDefault();
    setSectionError('');
    if (!newSection.trim()) return setSectionError('Section name is required');
    setSectionAdding(true);
    try {
      const res = await addYearLevelSection(selectedYearLevel.id, { name: newSection.trim() });
      setSections(prev => [...prev, res.data.section]);
      setYearLevels(prev => prev.map(y =>
        y.id === selectedYearLevel.id ? { ...y, section_count: (y.section_count || 0) + 1 } : y
      ));
      setNewSection('');
      setSectionPage(1);
    } catch (err) {
      setSectionError(err.response?.data?.error || 'Failed to add section');
    } finally {
      setSectionAdding(false);
    }
  };

  const handleSaveEditSection = async (e) => {
    e.preventDefault();
    setEditSectionError('');
    if (!editSection.name.trim()) return setEditSectionError('Section name is required');
    setEditSectionSaving(true);
    try {
      const res = await updateSection(editSection.id, { name: editSection.name.trim() });
      setSections(prev => prev.map(s => s.id === editSection.id ? { ...s, ...res.data.section } : s));
      setEditSection(null);
    } catch (err) {
      setEditSectionError(err.response?.data?.error || 'Failed to update section');
    } finally {
      setEditSectionSaving(false);
    }
  };

  const handleDeleteSection = async (sec) => {
    try {
      await deleteSection(sec.id);
      setSections(prev => prev.filter(s => s.id !== sec.id));
      setYearLevels(prev => prev.map(y =>
        y.id === selectedYearLevel.id ? { ...y, section_count: Math.max(0, (y.section_count || 1) - 1) } : y
      ));
      setSectionPage(1);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete section');
    }
  };
  // ── Student Manual handler ────────────────────────────────────────────
  const handleUploadManual = async () => {
    if (!manualFile) return;
    setManualUploading(true);
    setManualUploadSuccess(false);
    setManualUploadError('');
    const formData = new FormData();
    formData.append('manual', manualFile);
    try {
      const res = await uploadStudentManual(formData);
      setManualInfo(res.data?.info || null);
      setManualUploadSuccess(true);
      setManualFile(null);
      if (manualFileInputRef.current) manualFileInputRef.current.value = '';
      setTimeout(() => setManualUploadSuccess(false), 4000);
    } catch (err) {
      setManualUploadError(err.response?.data?.error || 'Upload failed');
    } finally {
      setManualUploading(false);
    }
  };
  // ── Violations upload handler ──────────────────────────────────────────
  const handleUploadViolations = async () => {
    if (!violationsFile) return;
    setViolationsUploading(true);
    setViolationsUploadSuccess(false);
    setViolationsUploadError('');
    setVtPreview(null);
    setVtPreviewError('');
    const formData = new FormData();
    formData.append('violations', violationsFile);
    try {
      const res = await extractViolationTypes(formData);
      setVtExisting(res.data?.existing || []);
      setVtPreview(res.data?.violations || []);
      setViolationsFile(null);
      if (violationsFileInputRef.current) violationsFileInputRef.current.value = '';
    } catch (err) {
      setViolationsUploadError(err.response?.data?.error || 'Extraction failed');
    } finally {
      setViolationsUploading(false);
    }
  };

  const handleSaveViolations = async () => {
    setVtPreviewSaving(true);
    setVtPreviewError('');
    try {
      const res = await saveViolationTypes({ violations: vtPreview });
      setViolationTypes(res.data?.violationTypes || []);
      setVtPage(1);
      setVtPreview(null);
      setVtExisting([]);
      setVtPreviewSaveSuccess(true);
      setTimeout(() => setVtPreviewSaveSuccess(false), 4000);
    } catch (err) {
      setVtPreviewError(err.response?.data?.error || 'Failed to save violations');
    } finally {
      setVtPreviewSaving(false);
    }
  };

  // ── Violation type handler ────────────────────────────────────────────
  const handleToggleAdmissionSlip = async (vt) => {
    setVtTogglingId(vt.id);
    try {
      const res = await updateViolationTypeSlip(vt.id, { requires_admission_slip: !vt.requires_admission_slip });
      setViolationTypes(prev => prev.map(v => v.id === vt.id ? { ...v, ...res.data.violationType } : v));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update violation type');
    } finally {
      setVtTogglingId(null);
    }
  };

  // ── Shared styles ──────────────────────────────────────────────────────────
  const panelCard = {
    border: '1px solid #e5e7eb',
    borderRadius: 10,
    padding: 16,
    background: '#fafafa',
    minHeight: 320,
  };

  const itemRow = (active) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 10px',
    borderRadius: 6,
    cursor: 'pointer',
    background: active ? '#eff6ff' : '#fff',
    border: active ? '1.5px solid var(--primary)' : '1px solid #e5e7eb',
    marginBottom: 4,
  });

  return (
    <div className="container">
      <div className="card" style={{ padding: 20 }}>
        {/* Header */}
        {/* Header */}
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
            <Settings style={{ width: '22px', height: '22px' }} />
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: '700', margin: 0 }}>Admin Panel</h1>
        </div>
        <p className="text-muted" style={{ marginBottom: 20, fontSize: '0.9rem' }}>
          Set up courses, year levels, sections, and violation types used across the system.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>

          {/* ── COURSES ─────────────────────────────────────────────────────── */}
          <div style={panelCard}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: '#374151' }}>
              Courses
            </div>

            {/* Add course form */}
            {editCourse ? (
              <form onSubmit={handleSaveEditCourse} style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
                <input
                  className="form-input"
                  placeholder="Course name"
                  value={editCourse.name}
                  onChange={e => setEditCourse(ec => ({ ...ec, name: e.target.value.slice(0, 128) }))}
                  maxLength={128}
                  autoFocus
                />
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    className="form-input"
                    placeholder="Code"
                    value={editCourse.code}
                    onChange={e => setEditCourse(ec => ({ ...ec, code: e.target.value.slice(0, 32) }))}
                    maxLength={32}
                    style={{ flex: 1 }}
                  />
                  <button className="btn btn-primary" type="submit" disabled={editCourseSaving} style={{ whiteSpace: 'nowrap', fontSize: 12 }}>
                    Save
                  </button>
                  <button type="button" className="btn" onClick={() => setEditCourse(null)} style={{ fontSize: 12 }}>
                    Cancel
                  </button>
                </div>
                {editCourseError && <div className="alert alert-error" style={{ fontSize: 12 }}>{editCourseError}</div>}
              </form>
            ) : (
              <form onSubmit={handleAddCourse} style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
                <input
                  className="form-input"
                  placeholder="Course name (e.g. BS in Computer Science)"
                  value={newCourseName}
                  onChange={e => setNewCourseName(e.target.value.slice(0, 128))}
                  maxLength={128}
                />
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    className="form-input"
                    placeholder="Code (e.g. BSCS)"
                    value={newCourseCode}
                    onChange={e => setNewCourseCode(e.target.value.slice(0, 32))}
                    maxLength={32}
                    style={{ flex: 1 }}
                  />
                  <button className="btn btn-primary" type="submit" disabled={courseAdding} title="Add course">
                    <Plus size={14} />
                  </button>
                </div>
                {courseError && <div className="alert alert-error" style={{ fontSize: 12 }}>{courseError}</div>}
              </form>
            )}

            {/* Course list */}
            {coursesLoading ? (
              <div style={{ fontSize: 13, color: '#9ca3af' }}>Loading…</div>
            ) : courses.length === 0 ? (
              <div style={{ fontSize: 13, color: '#9ca3af' }}>No courses defined yet.</div>
            ) : (() => {
              const totalCoursePages = Math.max(1, Math.ceil(courses.length / COURSES_PAGE_SIZE));
              const pagedCourses = courses.slice((coursePage - 1) * COURSES_PAGE_SIZE, coursePage * COURSES_PAGE_SIZE);
              return (
                <div>
                  {pagedCourses.map(c => (
                    <div key={c.id} onClick={() => setSelectedCourse(c)} style={itemRow(selectedCourse?.id === c.id)}>
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {c.name}
                        </div>
                        <div style={{ fontSize: 11, color: '#6b7280' }}>
                          {c.code} · {c.year_level_count} year level{c.year_level_count !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 2, marginLeft: 6, flexShrink: 0 }}>
                        <ChevronRight size={13} color={selectedCourse?.id === c.id ? 'var(--primary)' : '#d1d5db'} />
                        <button
                          type="button"
                          title="Edit course"
                          onClick={ev => { ev.stopPropagation(); setEditCourse({ id: c.id, name: c.name, code: c.code }); setEditCourseError(''); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: '2px 4px' }}
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          title="Delete course"
                          onClick={ev => { ev.stopPropagation(); handleDeleteCourse(c); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '2px 4px' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {totalCoursePages > 1 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 10 }}>
                      {Array.from({ length: totalCoursePages }, (_, i) => i + 1).map(p => (
                        <button
                          key={p}
                          onClick={() => setCoursePage(p)}
                          className={`btn ${p === coursePage ? 'btn-primary' : 'btn-outline'}`}
                          style={{ padding: '4px 9px', fontSize: 12 }}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* ── YEAR LEVELS ─────────────────────────────────────────────────── */}
          <div style={panelCard}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: '#374151' }}>
              Year Levels{selectedCourse ? <span style={{ fontWeight: 400, color: '#6b7280' }}> — {selectedCourse.code}</span> : ''}
            </div>

            {!selectedCourse ? (
              <div style={{ fontSize: 13, color: '#9ca3af' }}>← Select a course first.</div>
            ) : (
              <>
                {editYearLevel ? (
                  <form onSubmit={handleSaveEditYearLevel} style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                    <input
                      className="form-input"
                      placeholder="Year level"
                      value={editYearLevel.year_level}
                      onChange={e => setEditYearLevel(ey => ({ ...ey, year_level: e.target.value.slice(0, 32) }))}
                      maxLength={32}
                      style={{ flex: 1 }}
                      autoFocus
                    />
                    <button className="btn btn-primary" type="submit" disabled={editYearLevelSaving} style={{ whiteSpace: 'nowrap', fontSize: 12 }}>
                      Save
                    </button>
                    <button type="button" className="btn" onClick={() => setEditYearLevel(null)} style={{ fontSize: 12 }}>
                      Cancel
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleAddYearLevel} style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                    <input
                      className="form-input"
                      placeholder="e.g. 1st Year"
                      value={newYearLevel}
                      onChange={e => setNewYearLevel(e.target.value.slice(0, 32))}
                      maxLength={32}
                      style={{ flex: 1 }}
                    />
                    <button className="btn btn-primary" type="submit" disabled={yearLevelAdding} title="Add year level">
                      <Plus size={14} />
                    </button>
                  </form>
                )}
                {(editYearLevel ? editYearLevelError : yearLevelError) && (
                  <div className="alert alert-error" style={{ fontSize: 12, marginBottom: 8 }}>
                    {editYearLevel ? editYearLevelError : yearLevelError}
                  </div>
                )}

                {yearLevelsLoading ? (
                  <div style={{ fontSize: 13, color: '#9ca3af' }}>Loading…</div>
                ) : yearLevels.length === 0 ? (
                  <div style={{ fontSize: 13, color: '#9ca3af' }}>No year levels yet.</div>
                ) : (() => {
                  const totalYlPages = Math.max(1, Math.ceil(yearLevels.length / YEAR_LEVELS_PAGE_SIZE));
                  const pagedYl = yearLevels.slice((yearLevelPage - 1) * YEAR_LEVELS_PAGE_SIZE, yearLevelPage * YEAR_LEVELS_PAGE_SIZE);
                  return (
                    <div>
                      {pagedYl.map(yl => (
                        <div key={yl.id} onClick={() => setSelectedYearLevel(yl)} style={itemRow(selectedYearLevel?.id === yl.id)}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{yl.year_level}</div>
                            <div style={{ fontSize: 11, color: '#6b7280' }}>
                              {yl.section_count} section{yl.section_count !== 1 ? 's' : ''}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 2, marginLeft: 6, flexShrink: 0 }}>
                            <ChevronRight size={13} color={selectedYearLevel?.id === yl.id ? 'var(--primary)' : '#d1d5db'} />
                            <button
                              type="button"
                              title="Edit year level"
                              onClick={ev => { ev.stopPropagation(); setEditYearLevel({ id: yl.id, year_level: yl.year_level }); setEditYearLevelError(''); }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: '2px 4px' }}
                            >
                              ✏️
                            </button>
                            <button
                              type="button"
                              title="Delete year level"
                              onClick={ev => { ev.stopPropagation(); handleDeleteYearLevel(yl); }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '2px 4px' }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                      {totalYlPages > 1 && (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 10 }}>
                          {Array.from({ length: totalYlPages }, (_, i) => i + 1).map(p => (
                            <button
                              key={p}
                              onClick={() => setYearLevelPage(p)}
                              className={`btn ${p === yearLevelPage ? 'btn-primary' : 'btn-outline'}`}
                              style={{ padding: '4px 9px', fontSize: 12 }}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </>
            )}
          </div>

          {/* ── SECTIONS ────────────────────────────────────────────────────── */}
          <div style={panelCard}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: '#374151' }}>
              Sections{selectedYearLevel ? <span style={{ fontWeight: 400, color: '#6b7280' }}> — {selectedYearLevel.year_level}</span> : ''}
            </div>

            {!selectedYearLevel ? (
              <div style={{ fontSize: 13, color: '#9ca3af' }}>← Select a year level first.</div>
            ) : (
              <>
                {editSection ? (
                  <form onSubmit={handleSaveEditSection} style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                    <input
                      className="form-input"
                      placeholder="Section name"
                      value={editSection.name}
                      onChange={e => setEditSection(es => ({ ...es, name: e.target.value.slice(0, 32) }))}
                      maxLength={32}
                      style={{ flex: 1 }}
                      autoFocus
                    />
                    <button className="btn btn-primary" type="submit" disabled={editSectionSaving} style={{ whiteSpace: 'nowrap', fontSize: 12 }}>
                      Save
                    </button>
                    <button type="button" className="btn" onClick={() => setEditSection(null)} style={{ fontSize: 12 }}>
                      Cancel
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleAddSection} style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                    <input
                      className="form-input"
                      placeholder="e.g. A"
                      value={newSection}
                      onChange={e => setNewSection(e.target.value.slice(0, 32))}
                      maxLength={32}
                      style={{ flex: 1 }}
                    />
                    <button className="btn btn-primary" type="submit" disabled={sectionAdding} title="Add section">
                      <Plus size={14} />
                    </button>
                  </form>
                )}
                {(editSection ? editSectionError : sectionError) && (
                  <div className="alert alert-error" style={{ fontSize: 12, marginBottom: 8 }}>
                    {editSection ? editSectionError : sectionError}
                  </div>
                )}

                {sectionsLoading ? (
                  <div style={{ fontSize: 13, color: '#9ca3af' }}>Loading…</div>
                ) : sections.length === 0 ? (
                  <div style={{ fontSize: 13, color: '#9ca3af' }}>No sections yet.</div>
                ) : (() => {
                  const totalSecPages = Math.max(1, Math.ceil(sections.length / SECTIONS_PAGE_SIZE));
                  const pagedSec = sections.slice((sectionPage - 1) * SECTIONS_PAGE_SIZE, sectionPage * SECTIONS_PAGE_SIZE);
                  return (
                    <div>
                      {pagedSec.map(sec => (
                        <div key={sec.id} style={{ ...itemRow(false), cursor: 'default' }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{sec.name}</div>
                          <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                            <button
                              type="button"
                              title="Edit section"
                              onClick={() => { setEditSection({ id: sec.id, name: sec.name }); setEditSectionError(''); }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: '2px 4px' }}
                            >
                              ✏️
                            </button>
                            <button
                              type="button"
                              title="Delete section"
                              onClick={() => handleDeleteSection(sec)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '2px 4px' }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                      {totalSecPages > 1 && (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 10 }}>
                          {Array.from({ length: totalSecPages }, (_, i) => i + 1).map(p => (
                            <button
                              key={p}
                              onClick={() => setSectionPage(p)}
                              className={`btn ${p === sectionPage ? 'btn-primary' : 'btn-outline'}`}
                              style={{ padding: '4px 9px', fontSize: 12 }}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </>
            )}
          </div>

        </div>

        {/* ── VIOLATION TYPES ────────────────────────────────────────── */}
        <div style={{ marginTop: 28 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, color: '#374151' }}>Violation Types</div>
          <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: 10 }}>
            Upload a plain-text (.txt) discipline document to automatically extract and import violation types via AI.
            Non-discipline documents will be rejected.
          </p>

          {/* Upload violations txt */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14, padding: '10px 14px', background: '#f3f4f6', borderRadius: 8 }}>

            <input
              ref={violationsFileInputRef}
              type="file"
              accept=".txt,text/plain"
              onChange={e => {
                setViolationsFile(e.target.files?.[0] || null);
                setViolationsUploadError('');
                setViolationsUploadSuccess(false);
              }}
              style={{ fontSize: 13 }}
            />
            <button
              className="btn btn-primary"
              onClick={handleUploadViolations}
              disabled={!violationsFile || violationsUploading}
              style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', fontSize: 13 }}
            >
              <Upload size={14} />
              {violationsUploading ? 'Analyzing…' : 'Extract & Import'}
            </button>
            {violationsUploadSuccess && (
              <span style={{ color: '#10b981', fontSize: 13, fontWeight: 600 }}>✓ Violation types updated</span>
            )}
            {violationsUploadError && (
              <span style={{ color: '#ef4444', fontSize: 13 }}>{violationsUploadError}</span>
            )}
          </div>

          {/* ── PREVIEW TABLE (shown after extraction, before saving) ── */}
          {vtPreview && (() => {
            return (
              <div style={{ marginBottom: 18 }}>
                {/* Existing violations reference */}
                {vtExisting.length > 0 && (
                  <details style={{ marginBottom: 10, border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
                    <summary style={{ padding: '8px 14px', background: '#f9fafb', cursor: 'pointer', fontWeight: 600, fontSize: 12, color: '#374151', userSelect: 'none' }}>
                      📋 Existing in DB ({vtExisting.length} violations) — expand to compare
                    </summary>
                    <div style={{ overflowX: 'auto', maxHeight: 220, overflowY: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                        <thead>
                          <tr style={{ background: '#f3f4f6', position: 'sticky', top: 0 }}>
                            <th style={{ padding: '4px 10px', textAlign: 'left', color: '#6b7280', fontWeight: 600 }}>Ref</th>
                            <th style={{ padding: '4px 10px', textAlign: 'left', color: '#6b7280', fontWeight: 600 }}>Category</th>
                            <th style={{ padding: '4px 10px', textAlign: 'left', color: '#6b7280', fontWeight: 600 }}>Description</th>
                            <th style={{ padding: '4px 10px', textAlign: 'left', color: '#6b7280', fontWeight: 600, fontFamily: 'monospace' }}>Code</th>
                          </tr>
                        </thead>
                        <tbody>
                          {vtExisting.map((v, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid #f3f4f6', background: '#fff' }}>
                              <td style={{ padding: '3px 10px', color: '#9ca3af', fontFamily: 'monospace' }}>{v.section_ref}</td>
                              <td style={{ padding: '3px 10px' }}>
                                <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 10, background: v.category === 'minor' ? '#fef9c3' : '#fee2e2', color: v.category === 'minor' ? '#92400e' : '#991b1b' }}>
                                  {v.category}
                                </span>
                              </td>
                              <td style={{ padding: '3px 10px', color: '#374151' }}>{v.description}</td>
                              <td style={{ padding: '3px 10px', fontFamily: 'monospace', color: '#6b7280', fontSize: 10 }}>{v.code}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                )}

                {/* Extracted preview */}
                <div style={{ border: '1.5px solid #3b82f6', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ background: '#eff6ff', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: '#1d4ed8' }}>
                        🔍 Review extracted violations ({vtPreview.length})
                      </span>

                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {vtPreviewError && <span style={{ color: '#ef4444', fontSize: 12 }}>{vtPreviewError}</span>}
                      <button
                        type="button"
                        className="btn"
                        onClick={() => { setVtPreview(null); setVtExisting([]); setVtPreviewError(''); }}
                        style={{ fontSize: 12 }}
                      >
                        Discard
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleSaveViolations}
                        disabled={vtPreviewSaving || vtPreview.length === 0}
                        style={{ fontSize: 12, whiteSpace: 'nowrap' }}
                      >
                        {vtPreviewSaving ? 'Saving…' : `✓ Confirm & Import (${vtPreview.length})`}
                      </button>
                    </div>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                          <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, color: '#374151', width: 60 }}>Ref</th>
                          <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, color: '#374151', width: 80 }}>Category</th>
                          <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Description</th>
                          <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, color: '#374151', width: 160 }}>Code</th>
                          <th style={{ padding: '6px 10px', width: 32 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {vtPreview.map((vt, i) => {
                          return (
                            <tr key={i} style={{ borderBottom: '1px solid #f3f4f6', background: '#fff' }}>
                              <td style={{ padding: '4px 6px' }}>
                                <input
                                  value={vt.section_ref || ''}
                                  onChange={e => setVtPreview(prev => prev.map((v, idx) => idx === i ? { ...v, section_ref: e.target.value } : v))}
                                  style={{ width: 52, fontSize: 12, padding: '2px 4px', border: '1px solid #d1d5db', borderRadius: 4 }}
                                />
                              </td>
                              <td style={{ padding: '4px 6px' }}>
                                <select
                                  value={vt.category}
                                  onChange={e => setVtPreview(prev => prev.map((v, idx) => idx === i ? { ...v, category: e.target.value } : v))}
                                  style={{ fontSize: 12, padding: '2px 4px', border: '1px solid #d1d5db', borderRadius: 4 }}
                                >
                                  <option value="minor">Minor</option>
                                  <option value="major">Major</option>
                                </select>
                              </td>
                              <td style={{ padding: '4px 6px' }}>
                                <input
                                  value={vt.description || ''}
                                  onChange={e => setVtPreview(prev => prev.map((v, idx) => idx === i ? { ...v, description: e.target.value } : v))}
                                  style={{ width: '100%', minWidth: 200, fontSize: 12, padding: '2px 4px', border: '1px solid #d1d5db', borderRadius: 4 }}
                                />
                              </td>
                              <td style={{ padding: '4px 6px' }}>
                                <input
                                  value={vt.code || ''}
                                  onChange={e => setVtPreview(prev => prev.map((v, idx) => idx === i ? { ...v, code: e.target.value.toUpperCase() } : v))}
                                  style={{ width: 148, fontSize: 11, padding: '2px 4px', border: '1px solid #d1d5db', borderRadius: 4, fontFamily: 'monospace' }}
                                />
                              </td>
                              <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                                <button
                                  type="button"
                                  onClick={() => setVtPreview(prev => prev.filter((_, idx) => idx !== i))}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 2 }}
                                  title="Remove"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ padding: '8px 12px', borderTop: '1px solid #e5e7eb', background: '#f9fafb' }}>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setVtPreview(prev => [...prev, { code: '', description: '', category: 'minor', section_ref: '' }])}
                      style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <Plus size={12} /> Add row
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {vtPreviewSaveSuccess && (
            <div style={{ marginBottom: 12, color: '#10b981', fontWeight: 600, fontSize: 13 }}>✓ Violation types saved successfully</div>
          )}

          {violationTypesLoading ? (
            <div style={{ fontSize: 13, color: '#9ca3af' }}>Loading…</div>
          ) : (() => {
            const sorted = [...violationTypes].sort((a, b) => {
              const parse = s => (s || '').split('.').map(Number);
              const ap = parse(a.section_ref);
              const bp = parse(b.section_ref);
              for (let i = 0; i < Math.max(ap.length, bp.length); i++) {
                const diff = (ap[i] || 0) - (bp[i] || 0);
                if (diff !== 0) return diff;
              }
              return 0;
            });
            const totalPages = Math.ceil(sorted.length / VT_PAGE_SIZE);
            const page = Math.min(vtPage, totalPages);
            const pageItems = sorted.slice((page - 1) * VT_PAGE_SIZE, page * VT_PAGE_SIZE);
            return (
              <>
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', width: 60 }}>Ref</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', width: 72 }}>Category</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Violation</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, color: '#374151', width: 180 }}>Form Requirement</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageItems.map((vt, i) => (
                        <tr key={vt.id} style={{ borderBottom: i < pageItems.length - 1 ? '1px solid #f3f4f6' : 'none', background: '#fff' }}>
                          <td style={{ padding: '8px 12px', color: '#9ca3af', fontFamily: 'monospace', fontSize: 11 }}>{vt.section_ref}</td>
                          <td style={{ padding: '8px 12px' }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: 12,
                              fontSize: 11,
                              fontWeight: 600,
                              background: vt.category === 'minor' ? '#fef9c3' : '#fee2e2',
                              color: vt.category === 'minor' ? '#92400e' : '#991b1b',
                            }}>
                              {vt.category === 'minor' ? 'Minor' : 'Major'}
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px', color: '#111827' }}>{vt.description}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            <button
                              type="button"
                              disabled={vtTogglingId === vt.id}
                              onClick={() => handleToggleAdmissionSlip(vt)}
                              style={{
                                padding: '4px 14px',
                                borderRadius: 20,
                                border: 'none',
                                cursor: vtTogglingId === vt.id ? 'not-allowed' : 'pointer',
                                fontWeight: 600,
                                fontSize: 12,
                                background: vt.requires_admission_slip ? '#3b82f6' : '#e5e7eb',
                                color: vt.requires_admission_slip ? '#fff' : '#6b7280',
                                opacity: vtTogglingId === vt.id ? 0.6 : 1,
                                transition: 'background 0.15s',
                                minWidth: 140,
                              }}
                            >
                              {vt.requires_admission_slip ? '✓ Requires Slip' : 'Report Only'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {totalPages > 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 10 }}>
                    <button
                      type="button"
                      onClick={() => setVtPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: page === 1 ? 'not-allowed' : 'pointer', color: '#374151', fontSize: 13, opacity: page === 1 ? 0.4 : 1 }}
                    >
                      ‹
                    </button>
                    {Array.from({ length: totalPages }, (_, idx) => idx + 1).map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setVtPage(n)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 6,
                          border: '1px solid ' + (n === page ? 'var(--primary)' : '#e5e7eb'),
                          background: n === page ? 'var(--primary)' : '#fff',
                          color: n === page ? '#fff' : '#374151',
                          fontWeight: n === page ? 700 : 400,
                          cursor: 'pointer',
                          fontSize: 13,
                        }}
                      >
                        {n}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setVtPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: page === totalPages ? 'not-allowed' : 'pointer', color: '#374151', fontSize: 13, opacity: page === totalPages ? 0.4 : 1 }}
                    >
                      ›
                    </button>
                    <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 6 }}>
                      {sorted.length} violations
                    </span>
                  </div>
                )}
              </>
            );
          })()}
        </div>

        {/* ── STUDENT MANUAL ─────────────────────────────────────────── */}
        <div style={{ marginTop: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <BookOpen size={18} color="var(--primary)" />
            <span style={{ fontWeight: 700, fontSize: 15, color: '#374151' }}>Student Manual</span>
          </div>
          <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: 14 }}>
            Upload a plain-text (.txt) Student Manual to replace the one used by the Chatbot at the Student Manual page.
          </p>

          {/* Current manual info */}
          {manualInfo && (
            <div style={{
              marginBottom: 14,
              fontSize: 13,
              color: '#374151',
              background: '#f3f4f6',
              borderRadius: 8,
              padding: '10px 14px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '6px 20px',
              alignItems: 'center',
            }}>
              <span>
                <strong>Active file:</strong>&nbsp;{manualInfo.filename || 'none'}
              </span>
              {manualInfo.uploadedAt && (
                <span>Uploaded: {new Date(manualInfo.uploadedAt).toLocaleString()}</span>
              )}
              <span>{(manualInfo.chars || 0).toLocaleString()} chars</span>
              <span>{(manualInfo.lines || 0).toLocaleString()} lines</span>
              {manualInfo.source === 'upload' && (
                <span style={{ color: '#10b981', fontWeight: 600, fontSize: 11, background: '#d1fae5', borderRadius: 4, padding: '2px 7px' }}>
                  CUSTOM
                </span>
              )}
              {manualInfo.source === 'default' && (
                <span style={{ color: '#6b7280', fontSize: 11, background: '#e5e7eb', borderRadius: 4, padding: '2px 7px' }}>
                  DEFAULT
                </span>
              )}
            </div>
          )}

          {/* Upload form */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              ref={manualFileInputRef}
              type="file"
              accept=".txt,text/plain"
              onChange={e => {
                setManualFile(e.target.files?.[0] || null);
                setManualUploadError('');
                setManualUploadSuccess(false);
              }}
              style={{ fontSize: 13 }}
            />
            <button
              className="btn btn-primary"
              onClick={handleUploadManual}
              disabled={!manualFile || manualUploading}
              style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', fontSize: 13 }}
            >
              <Upload size={14} />
              {manualUploading ? 'Uploading…' : 'Upload Manual'}
            </button>
            {manualUploadSuccess && (
              <span style={{ color: '#10b981', fontSize: 13, fontWeight: 600 }}>
                ✓ Manual updated — chatbot is now using the new file
              </span>
            )}
            {manualUploadError && (
              <span style={{ color: '#ef4444', fontSize: 13 }}>{manualUploadError}</span>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default AdminPanel;
