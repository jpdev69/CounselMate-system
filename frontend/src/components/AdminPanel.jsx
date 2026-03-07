// src/components/AdminPanel.jsx
import React, { useState, useEffect } from 'react';
import { Settings, Plus, Trash2, ChevronRight } from 'lucide-react';
import {
  getAdminCourses, createAdminCourse, updateAdminCourse, deleteAdminCourse,
  getCourseYearLevels, addCourseYearLevel, updateYearLevel, deleteYearLevel,
  getYearLevelSections, addYearLevelSection, updateSection, deleteSection,
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

  // ── Year Levels ────────────────────────────────────────────────────────────
  const [yearLevels, setYearLevels] = useState([]);
  const [yearLevelsLoading, setYearLevelsLoading] = useState(false);
  const [selectedYearLevel, setSelectedYearLevel] = useState(null);
  const [newYearLevel, setNewYearLevel] = useState('');
  const [yearLevelError, setYearLevelError] = useState('');
  const [yearLevelAdding, setYearLevelAdding] = useState(false);

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

  // edit mode for sections
  const [editSection, setEditSection] = useState(null); // { id, name }
  const [editSectionError, setEditSectionError] = useState('');
  const [editSectionSaving, setEditSectionSaving] = useState(false);

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

  // ── Load year levels when course changes ───────────────────────────────────
  useEffect(() => {
    if (!selectedCourse) { setYearLevels([]); setSelectedYearLevel(null); return; }
    let mounted = true;
    setYearLevelsLoading(true);
    setSelectedYearLevel(null);
    getCourseYearLevels(selectedCourse.id)
      .then(res => { if (mounted) setYearLevels(res.data?.yearLevels || []); })
      .catch(err => console.error('Failed to load year levels', err))
      .finally(() => { if (mounted) setYearLevelsLoading(false); });
    return () => { mounted = false; };
  }, [selectedCourse]);

  // ── Load sections when year level changes ──────────────────────────────────
  useEffect(() => {
    if (!selectedYearLevel) { setSections([]); return; }
    let mounted = true;
    setSectionsLoading(true);
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
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete section');
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
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
          <Settings style={{ width: 26, height: 26, color: 'var(--primary)' }} />
          <h1 style={{ marginLeft: 10, fontSize: 20, fontWeight: 700 }}>Admin Panel</h1>
        </div>
        <p className="text-muted" style={{ marginBottom: 20, fontSize: '0.9rem' }}>
          Define the courses, year levels, and sections available when issuing admission slips.
          Select a course to manage its year levels, then select a year level to manage its sections.
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
                  placeholder="Course name (e.g. BS Information Technology)"
                  value={newCourseName}
                  onChange={e => setNewCourseName(e.target.value.slice(0, 128))}
                  maxLength={128}
                />
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    className="form-input"
                    placeholder="Code (e.g. BSIT)"
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
            ) : (
              <div>
                {courses.map(c => (
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
              </div>
            )}
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
                ) : (
                  <div>
                    {yearLevels.map(yl => (
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
                  </div>
                )}
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
                ) : (
                  <div>
                    {sections.map(sec => (
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
                  </div>
                )}
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
