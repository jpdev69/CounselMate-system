// src/components/AdminPanel.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Settings, Plus, Trash2, ChevronRight, Upload, BookOpen, Download, RefreshCw, AlertTriangle, Mail, CheckCircle, XCircle, Clock, Users, Key, Shield } from 'lucide-react';
import {
  getAdminCourses, createAdminCourse, updateAdminCourse, deleteAdminCourse,
  getCourseYearLevels, addCourseYearLevel, updateYearLevel, deleteYearLevel,
  getYearLevelSections, addYearLevelSection, updateSection, deleteSection,
  getAdminViolationTypes, updateViolationTypeSlip, deleteViolationType, createViolationType, extractViolationTypes, saveViolationTypes,
  getStudentManualInfo, uploadStudentManual,
  createBackup, restoreBackup, resetSystem,
  getSignupRequests, updateSignupRequest,
  getUsers, deleteUser, resetUserPassword,
  getStudentEditOverride, updateStudentEditOverride,
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
  const [vtDeletingId, setVtDeletingId] = useState(null);
  const [vtPage, setVtPage] = useState(1);
  const VT_PAGE_SIZE = 10;

  // Manual addition form state
  const [newVtCode, setNewVtCode] = useState('');
  const [newVtDescription, setNewVtDescription] = useState('');
  const [newVtCategory, setNewVtCategory] = useState('minor');
  const [newVtSectionRef, setNewVtSectionRef] = useState('');
  const [vtAdding, setVtAdding] = useState(false);
  const [vtAddError, setVtAddError] = useState('');
  const [vtMatches, setVtMatches] = useState([]);

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

  // ── Backup & Restore ─────────────────────────────────────────────────────
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreFile, setRestoreFile] = useState(null);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreSuccess, setRestoreSuccess] = useState(false);
  const [restoreError, setRestoreError] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState('');
  const restoreFileInputRef = useRef(null);

  // ── Signup Requests ─────────────────────────────────────────────────────
  const [signupRequests, setSignupRequests] = useState([]);
  const [signupRequestsLoading, setSignupRequestsLoading] = useState(true);
  const [updatingRequestId, setUpdatingRequestId] = useState(null);
  const [signupRequestPage, setSignupRequestPage] = useState(1);
  const SIGNUP_REQUESTS_PAGE_SIZE = 5;

  // ── User Management ─────────────────────────────────────────────────────
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [deletingUserId, setDeletingUserId] = useState(null);
  const [resettingUserId, setResettingUserId] = useState(null);
  const [userPage, setUserPage] = useState(1);
  const USERS_PAGE_SIZE = 8;

  // ── Admin Settings ─────────────────────────────────────────────────────
  const [studentEditOverride, setStudentEditOverride] = useState(false);
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [overrideError, setOverrideError] = useState('');

  const handleBackup = async () => {
    setBackupLoading(true);
    try {
      const response = await createBackup();
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `guidanceOS-backup-${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Backup failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setBackupLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!restoreFile) return;
    
    if (!window.confirm('WARNING: This will completely replace all current courses, year levels, sections, and violation types with backup data. This action cannot be undone. Continue?')) {
      return;
    }

    setRestoreLoading(true);
    setRestoreError('');
    setRestoreSuccess(false);
    
    try {
      const text = await restoreFile.text();
      const backupData = JSON.parse(text);
      
      const response = await restoreBackup(backupData);
      if (response.data.success) {
        setRestoreSuccess(true);
        setRestoreFile(null);
        if (restoreFileInputRef.current) restoreFileInputRef.current.value = '';
        
        // Reload page after showing success message
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    } catch (err) {
      setRestoreError(err.response?.data?.error || err.message || 'Invalid backup file');
    } finally {
      setRestoreLoading(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('CRITICAL WARNING: This will permanently delete ALL system data including courses, year levels, sections, violation types, admission slips, student reports, even audit logs. This action cannot be undone and will leave your system completely empty. Are you absolutely sure you want to continue?')) {
      return;
    }

    setResetLoading(true);
    setResetError('');
    setResetSuccess(false);
    
    try {
      const response = await resetSystem();
      if (response.data.success) {
        setResetSuccess(true);
        
        // Reload page to show empty state
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    } catch (err) {
      setResetError(err.response?.data?.error || err.message || 'Reset failed');
    } finally {
      setResetLoading(false);
    }
  };

  // ── Admin Settings Handlers ─────────────────────────────────────────────
  const handleToggleStudentEditOverride = async () => {
    setOverrideLoading(true);
    setOverrideError('');
    
    try {
      const response = await updateStudentEditOverride(!studentEditOverride);
      if (response.data?.success) {
        setStudentEditOverride(response.data.enabled);
      }
    } catch (error) {
      setOverrideError(error.response?.data?.error || 'Failed to update setting');
    } finally {
      setOverrideLoading(false);
    }
  };

  // Load student edit override status on mount
  useEffect(() => {
    let mounted = true;
    const loadOverrideStatus = async () => {
      try {
        const response = await getStudentEditOverride();
        if (mounted && response.data?.success) {
          setStudentEditOverride(response.data.enabled);
        }
      } catch (error) {
        console.warn('Failed to load student edit override status:', error);
      }
    };
    
    loadOverrideStatus();
    return () => { mounted = false; };
  }, []);

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

  // ── Load signup requests on mount ────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    setSignupRequestsLoading(true);
    getSignupRequests()
      .then(res => { if (mounted) setSignupRequests(res.data?.requests || []); })
      .catch(err => console.error('Failed to load signup requests', err))
      .finally(() => { if (mounted) setSignupRequestsLoading(false); });
    return () => { mounted = false; };
  }, []);

  // ── Load users on mount ────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    setUsersLoading(true);
    getUsers()
      .then(res => { if (mounted) setUsers(res.data?.users || []); })
      .catch(err => console.error('Failed to load users', err))
      .finally(() => { if (mounted) setUsersLoading(false); });
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
    
    // Validate field lengths before sending to backend
    const validationErrors = [];
    let hasInvalidFields = false;
    
    vtPreview.forEach((vt, index) => {
      if (vt.code && vt.code.length > 64) hasInvalidFields = true;
      if (vt.description && vt.description.length > 128) hasInvalidFields = true;
      if (vt.section_ref && vt.section_ref.length > 8) hasInvalidFields = true;
    });
    
    if (hasInvalidFields) {
      validationErrors.push('One or more inputs exceed maximum length');
    }
    
    if (validationErrors.length > 0) {
      setVtPreviewError(validationErrors.join('; '));
      setVtPreviewSaving(false);
      return;
    }
    
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

  const handleDeleteViolationType = async (vt) => {
    if (!window.confirm(`Delete violation type "${vt.description}"? This action cannot be undone.`)) return;
    setVtDeletingId(vt.id);
    try {
      await deleteViolationType(vt.id);
      setViolationTypes(prev => prev.filter(v => v.id !== vt.id));
      // Adjust page if necessary
      const totalPages = Math.ceil((violationTypes.length - 1) / VT_PAGE_SIZE);
      if (vtPage > totalPages) {
        setVtPage(totalPages);
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete violation type');
    } finally {
      setVtDeletingId(null);
    }
  };

  // Check for potential matching violations
  const checkViolationMatches = useCallback(() => {
    if (!newVtCode.trim() && !newVtDescription.trim()) {
      setVtMatches([]);
      return;
    }

    const matches = violationTypes.filter(vt => {
      const codeMatch = newVtCode.trim() && vt.code.toLowerCase().includes(newVtCode.trim().toLowerCase());
      const descMatch = newVtDescription.trim() && vt.description.toLowerCase().includes(newVtDescription.trim().toLowerCase());
      const sectionMatch = newVtSectionRef.trim() && vt.section_ref.toLowerCase().includes(newVtSectionRef.trim().toLowerCase());
      
      return codeMatch || descMatch || sectionMatch;
    });

    setVtMatches(matches);
  }, [newVtCode, newVtDescription, newVtSectionRef, violationTypes]);

  // Auto-check matches when input changes
  useEffect(() => {
    checkViolationMatches();
  }, [checkViolationMatches]);

  const handleAddViolationType = async (e) => {
    e.preventDefault();
    setVtAddError('');
    if (!newVtCode.trim()) return setVtAddError('Violation code is required');
    if (!newVtDescription.trim()) return setVtAddError('Violation description is required');
    if (!newVtSectionRef.trim()) return setVtAddError('Section reference is required');
    
    setVtAdding(true);
    try {
      const res = await createViolationType({
        code: newVtCode.trim(),
        description: newVtDescription.trim(),
        category: newVtCategory,
        section_ref: newVtSectionRef.trim()
      });
      setViolationTypes(prev => [...prev, res.data.violationType]);
      // Reset form
      setNewVtCode('');
      setNewVtDescription('');
      setNewVtCategory('minor');
      setNewVtSectionRef('');
      setVtPage(1); // Go to first page to see new entry
    } catch (err) {
      setVtAddError(err.response?.data?.error || 'Failed to add violation type');
    } finally {
      setVtAdding(false);
    }
  };

  // ── Signup Request handlers ────────────────────────────────────────────
  const handleUpdateSignupRequest = async (requestId, status) => {
    setUpdatingRequestId(requestId);
    try {
      const res = await updateSignupRequest(requestId, { status });
      if (res.data.success) {
        // Update the request in the local state
        setSignupRequests(prev => 
          prev.map(req => 
            req.id === requestId 
              ? { ...req, status, updated_at: new Date().toISOString() }
              : req
          )
        );
        
        // Refresh users list if a new user was created
        if (status === 'approved') {
          const usersRes = await getUsers();
          setUsers(usersRes.data?.users || []);
        }
        
        // Show success message
        const message = status === 'approved' 
          ? 'Request approved and user account created successfully!'
          : 'Request rejected successfully.';
        alert(message);
      }
    } catch (err) {
      alert(err.response?.data?.error || `Failed to ${status} request`);
    } finally {
      setUpdatingRequestId(null);
    }
  };

  // ── User Management handlers ────────────────────────────────────────────
  const handleDeleteUser = async (userId, userEmail) => {
    if (!window.confirm(`Delete user account for ${userEmail}?\n\nThis action cannot be undone and will permanently remove all access to the system.`)) {
      return;
    }

    setDeletingUserId(userId);
    try {
      const res = await deleteUser(userId);
      if (res.data.success) {
        // Remove user from local state
        setUsers(prev => prev.filter(user => user.id !== userId));
        alert(res.data.message || 'User account deleted successfully');
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete user account');
    } finally {
      setDeletingUserId(null);
    }
  };

  const handleResetPassword = async (userId, userEmail) => {
    if (!window.confirm(`Reset password for ${userEmail}?\n\nThe password will be reset to 'changeme123' and the user will need to change it on next login.`)) {
      return;
    }

    setResettingUserId(userId);
    try {
      const res = await resetUserPassword(userId);
      if (res.data.success) {
        alert(res.data.message || 'Password reset successfully');
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to reset password');
    } finally {
      setResettingUserId(null);
    }
  };

  // ── Keyword matching for violation descriptions ─────────────────────────────
  const findDescriptionMatches = (extractedDescription, existingViolations) => {
    if (!extractedDescription || !existingViolations?.length) return { hasMatch: false, matches: [], matchingWords: [] };
    
    const extractedLower = extractedDescription.toLowerCase();
    const extractedWords = extractedLower.split(/\s+/).filter(word => word.length > 2); // Filter out very short words
    const matches = [];
    let allMatchingWords = new Set();
    
    // Extract keywords from existing violations
    existingViolations.forEach(existing => {
      if (!existing.description) return;
      
      const existingDesc = existing.description.toLowerCase();
      const existingWords = existingDesc.split(/\s+/).filter(word => word.length > 2); // Filter out very short words
      
      // Check for any word overlap (at least 1 meaningful word)
      const matchingWords = existingWords.filter(word => 
        word.length > 2 && extractedLower.includes(word) // Consider words longer than 2 chars
      );
      
      if (matchingWords.length >= 1) {
        matchingWords.forEach(word => allMatchingWords.add(word));
        matches.push({
          description: existing.description,
          code: existing.code,
          section_ref: existing.section_ref,
          matchingWords: matchingWords,
          confidence: matchingWords.length / existingWords.length
        });
      }
    });
    
    // Sort by confidence (highest first) and return top matches
    const sortedMatches = matches.sort((a, b) => b.confidence - a.confidence);
    
    // Maintain the original order of words as they appear in the extracted description
    const orderedMatchingWords = extractedWords.filter(word => allMatchingWords.has(word));
    
    return {
      hasMatch: sortedMatches.length > 0,
      matches: sortedMatches.slice(0, 3), // Return top 3 matches
      matchingWords: orderedMatchingWords
    };
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16 }}>

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
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: '2px 4px', fontSize: 12 }}
                        >
                          Edit
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
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: '2px 4px', fontSize: 12 }}
                            >
                              Edit
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
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: '2px 4px', fontSize: 12 }}
                            >
                              Edit
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

          {/* Manual Add Violation Form */}
          <div style={{ marginBottom: 14, padding: '10px 14px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: '#374151' }}>
              ➕ Add Violation Manually
            </div>
            <form onSubmit={handleAddViolationType} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
              <div>
                <label style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>Section Ref</label>
                <input
                  className="form-input"
                  placeholder="e.g. 1.1"
                  value={newVtSectionRef}
                  onChange={e => setNewVtSectionRef(e.target.value.slice(0, 16))}
                  maxLength={16}
                  style={{ fontSize: 12 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>Violation Description</label>
                <input
                  className="form-input"
                  placeholder="Enter violation description"
                  value={newVtDescription}
                  onChange={e => setNewVtDescription(e.target.value.slice(0, 256))}
                  maxLength={256}
                  style={{ fontSize: 12 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>Category</label>
                <select
                  className="form-input"
                  value={newVtCategory}
                  onChange={e => setNewVtCategory(e.target.value)}
                  style={{ fontSize: 12 }}
                >
                  <option value="minor">Minor</option>
                  <option value="major">Major</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>Code</label>
                <input
                  className="form-input"
                  placeholder="e.g. LATE_COMING"
                  value={newVtCode}
                  onChange={e => setNewVtCode(e.target.value.toUpperCase().slice(0, 128))}
                  maxLength={128}
                  style={{ fontSize: 12, fontFamily: 'monospace' }}
                />
              </div>
              <div>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={vtAdding || !newVtCode.trim() || !newVtDescription.trim() || !newVtSectionRef.trim()}
                  style={{ fontSize: 12, whiteSpace: 'nowrap' }}
                >
                  {vtAdding ? 'Adding…' : 'Add'}
                </button>
              </div>
            </form>
            {vtAddError && (
              <div className="alert alert-error" style={{ fontSize: 12, marginTop: 6 }}>
                {vtAddError}
              </div>
            )}
            {vtMatches.length > 0 && (
              <div style={{ marginTop: 8, padding: 8, background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 6 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#92400e', marginBottom: 4 }}>
                  Potential existing violations found ({vtMatches.length}):
                </div>
                <div style={{ maxHeight: 150, overflowY: 'auto' }}>
                  {vtMatches.map(match => {
                    const codeMatch = newVtCode.trim() && match.code.toLowerCase().includes(newVtCode.trim().toLowerCase());
                    const descMatch = newVtDescription.trim() && match.description.toLowerCase().includes(newVtDescription.trim().toLowerCase());
                    const sectionMatch = newVtSectionRef.trim() && match.section_ref.toLowerCase().includes(newVtSectionRef.trim().toLowerCase());
                    
                    return (
                      <div key={match.id} style={{ 
                        padding: 4, 
                        marginBottom: 4, 
                        background: '#ffffff', 
                        border: '1px solid #e5e7eb', 
                        borderRadius: 4,
                        fontSize: 11
                      }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ 
                            background: sectionMatch ? '#dcfce7' : '#f3f4f6', 
                            padding: '2px 6px', 
                            borderRadius: 3, 
                            fontFamily: 'monospace',
                            fontWeight: sectionMatch ? 600 : 400
                          }}>
                            {match.section_ref}
                          </span>
                          <span style={{ 
                            background: codeMatch ? '#dcfce7' : '#f3f4f6', 
                            padding: '2px 6px', 
                            borderRadius: 3, 
                            fontFamily: 'monospace',
                            fontWeight: codeMatch ? 600 : 400
                          }}>
                            {match.code}
                          </span>
                          <span style={{ 
                            background: match.category === 'major' ? '#fee2e2' : '#f0f9ff', 
                            padding: '2px 6px', 
                            borderRadius: 3,
                            fontWeight: 600,
                            color: match.category === 'major' ? '#991b1b' : '#1e40af'
                          }}>
                            {match.category.toUpperCase()}
                          </span>
                        </div>
                        <div style={{ 
                          marginTop: 2, 
                          color: '#374151',
                          background: descMatch ? '#dcfce7' : 'transparent',
                          padding: descMatch ? '2px 4px' : 0,
                          borderRadius: 3,
                          fontWeight: descMatch ? 600 : 400
                        }}>
                          {match.description}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
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
                          const matchInfo = findDescriptionMatches(vt.description, vtExisting);
                          return (
                            <tr key={i} style={{ 
                              borderBottom: '1px solid #f3f4f6', 
                              background: '#fff'
                            }}>
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
                                <div style={{ position: 'relative' }}>
                                  <input
                                    value={vt.description || ''}
                                    onChange={e => setVtPreview(prev => prev.map((v, idx) => idx === i ? { ...v, description: e.target.value } : v))}
                                    style={{ 
                                      width: '100%', 
                                      minWidth: 200, 
                                      fontSize: 12, 
                                      padding: '2px 4px', 
                                      border: '1px solid #d1d5db', 
                                      borderRadius: 4,
                                      background: '#fff',
                                      paddingRight: vt.description && vt.description.length > 127 ? '35px' : '25px'
                                    }}
                                  />
                                  <span style={{ 
                                    position: 'absolute', 
                                    right: '6px', 
                                    top: '50%', 
                                    transform: 'translateY(-50%)',
                                    fontSize: 9, 
                                    color: vt.description && vt.description.length > 127 ? '#ef4444' : '#9ca3af',
                                    pointerEvents: 'none'
                                  }}>
                                    {vt.description ? vt.description.length : 0}/128
                                  </span>
                                </div>
                                {matchInfo.hasMatch && (
                                  <div style={{ 
                                    fontSize: 10, 
                                    color: '#374151', 
                                    marginTop: 2,
                                    padding: '2px 4px',
                                    background: '#f9fafb',
                                    borderRadius: 4,
                                    border: '1px solid #e5e7eb'
                                  }}>
                                    {matchInfo.matchingWords.map((word, index) => (
                                      <span key={index}>
                                        {index > 0 && ', '}
                                        <span style={{ 
                                          background: '#fef3c7', 
                                          padding: '1px 3px', 
                                          borderRadius: 2, 
                                          fontSize: 9,
                                          fontWeight: 600
                                        }}>
                                          {word}
                                        </span>
                                      </span>
                                    ))}
                                  </div>
                                )}
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
                        <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, color: '#374151', width: 60 }}>Actions</th>
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
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            <button
                              type="button"
                              disabled={vtDeletingId === vt.id}
                              onClick={() => handleDeleteViolationType(vt)}
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: vtDeletingId === vt.id ? 'not-allowed' : 'pointer',
                                color: '#ef4444',
                                padding: '4px',
                                opacity: vtDeletingId === vt.id ? 0.6 : 1,
                                transition: 'opacity 0.15s',
                              }}
                              title="Delete violation type"
                            >
                              <Trash2 size={14} />
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

        {/* ── STUDENT EDIT OVERRIDE ─────────────────────────────────────────── */}
        <div style={{ marginTop: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Shield size={18} color="var(--primary)" />
            <span style={{ fontWeight: 700, fontSize: 15, color: '#374151' }}>Student Edit Override</span>
          </div>
          <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: 14 }}>
            Enable this toggle to allow counselors to edit existing student information (course, year, section) when issuing admission slips or creating reports.
          </p>

          <div style={{
            border: '1px solid #e5e7eb',
            borderRadius: 10,
            padding: 16,
            background: '#fafafa',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#374151', marginBottom: 2 }}>
                  Allow Student Editing
                </div>
                              </div>
              
              <button
                onClick={handleToggleStudentEditOverride}
                disabled={overrideLoading}
                style={{
                  position: 'relative',
                  width: '60px',
                  height: '32px',
                  background: studentEditOverride ? 'var(--primary)' : '#d1d5db',
                  border: 'none',
                  borderRadius: '16px',
                  cursor: overrideLoading ? 'not-allowed' : 'pointer',
                  transition: 'background 0.2s',
                  outline: 'none'
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: '4px',
                    left: studentEditOverride ? '32px' : '4px',
                    width: '24px',
                    height: '24px',
                    background: '#ffffff',
                    borderRadius: '50%',
                    transition: 'left 0.2s',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }}
                />
              </button>
            </div>

            <div style={{ 
              fontSize: 12, 
              color: studentEditOverride ? '#059669' : '#6b7280',
              fontWeight: 500,
              padding: '8px 12px',
              background: studentEditOverride ? '#d1fae5' : '#f9fafb',
              borderRadius: 6,
              border: `1px solid ${studentEditOverride ? '#a7f3d0' : '#e5e7eb'}`
            }}>
              {studentEditOverride ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: '#059669' }}>✓</span>
                  Student editing is currently ENABLED
                </span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: '#6b7280' }}>○</span>
                  Student editing is currently DISABLED
                </span>
              )}
            </div>

            {overrideError && (
              <div style={{ 
                marginTop: 8,
                padding: '6px 10px', 
                background: '#fee2e2', 
                color: '#991b1b', 
                borderRadius: 4, 
                fontSize: 12 
              }}>
                ❌ {overrideError}
              </div>
            )}

            {overrideLoading && (
              <div style={{ 
                marginTop: 8,
                fontSize: 12, 
                color: '#6b7280',
                fontStyle: 'italic'
              }}>
                Updating setting...
              </div>
            )}
          </div>
        </div>

        {/* ── USER MANAGEMENT & SIGNUP REQUESTS ─────────────────────────── */}
        <div style={{ marginTop: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Mail size={18} color="var(--primary)" />
            <span style={{ fontWeight: 700, fontSize: 15, color: '#374151' }}>User Management</span>
          </div>
          <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: 14 }}>
            Review signup requests and manage counselor accounts.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

            {/* ── SIGNUP REQUESTS ─────────────────────────────────────────── */}
            <div style={panelCard}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: '#374151' }}>
                Pending Requests
              </div>

              {signupRequestsLoading ? (
                <div style={{ fontSize: 13, color: '#9ca3af' }}>Loading signup requests…</div>
              ) : signupRequests.length === 0 ? (
                <div style={{ fontSize: 13, color: '#9ca3af' }}>No signup requests at this time.</div>
              ) : (() => {
                const pendingRequests = signupRequests.filter(req => req.status === 'pending');
                const totalPendingPages = Math.max(1, Math.ceil(pendingRequests.length / SIGNUP_REQUESTS_PAGE_SIZE));
                const pagedRequests = pendingRequests.slice(
                  (signupRequestPage - 1) * SIGNUP_REQUESTS_PAGE_SIZE, 
                  signupRequestPage * SIGNUP_REQUESTS_PAGE_SIZE
                );

                if (pendingRequests.length === 0) {
                  return (
                    <div style={{ fontSize: 13, color: '#9ca3af' }}>
                      No pending signup requests.
                    </div>
                  );
                }

                return (
                  <div>
                    {pagedRequests.map(request => (
                      <div key={request.id} style={{
                        border: '1px solid #e5e7eb',
                        borderRadius: 8,
                        padding: 12,
                        marginBottom: 8,
                        backgroundColor: '#fff'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                          <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            backgroundColor: '#f0f9ff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <Mail size={16} style={{ color: '#1e40af' }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 13, color: '#374151', marginBottom: 2 }}>
                              {request.full_name}
                            </div>
                            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                              {request.email}
                            </div>
                            <div style={{ fontSize: 11, color: '#9ca3af' }}>
                              Requested {new Date(request.created_at).toLocaleDateString()} at {new Date(request.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </div>
                          </div>
                          <div style={{
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: 11,
                            fontWeight: 600,
                            backgroundColor: '#fef3c7',
                            color: '#92400e',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4
                          }}>
                            <Clock size={10} />
                            PENDING
                          </div>
                        </div>
                        
                        <div style={{ 
                          fontSize: 12, 
                          color: '#4b5563', 
                          marginBottom: 12, 
                          padding: 8, 
                          backgroundColor: '#f9fafb', 
                          borderRadius: 6,
                          borderLeft: '3px solid #fbbf24'
                        }}>
                          <strong>Reason:</strong> {request.reason}
                        </div>

                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => {
                              if (window.confirm(`Reject signup request from ${request.full_name} (${request.email})?`)) {
                                handleUpdateSignupRequest(request.id, 'rejected');
                              }
                            }}
                            disabled={updatingRequestId === request.id}
                            style={{
                              padding: '6px 12px',
                              border: '1px solid #ef4444',
                              backgroundColor: '#fff',
                              color: '#ef4444',
                              borderRadius: 6,
                              fontSize: 12,
                              fontWeight: 500,
                              cursor: updatingRequestId === request.id ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              transition: 'all 0.2s'
                            }}
                            onMouseOver={(e) => {
                              if (updatingRequestId !== request.id) {
                                e.target.style.backgroundColor = '#ef4444';
                                e.target.style.color = '#fff';
                              }
                            }}
                            onMouseOut={(e) => {
                              if (updatingRequestId !== request.id) {
                                e.target.style.backgroundColor = '#fff';
                                e.target.style.color = '#ef4444';
                              }
                            }}
                          >
                            {updatingRequestId === request.id ? (
                              <>
                                <div style={{
                                  width: '12px',
                                  height: '12px',
                                  border: '2px solid #ef4444',
                                  borderTop: '2px solid transparent',
                                  borderRadius: '50%',
                                  animation: 'spin 1s linear infinite'
                                }}></div>
                                Processing...
                              </>
                            ) : (
                              <>
                                <XCircle size={14} />
                                Reject
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm(`Approve signup request from ${request.full_name} (${request.email})?\n\nThis will create a new counselor account with default password 'changeme123'.`)) {
                                handleUpdateSignupRequest(request.id, 'approved');
                              }
                            }}
                            disabled={updatingRequestId === request.id}
                            style={{
                              padding: '6px 12px',
                              border: '1px solid #10b981',
                              backgroundColor: '#fff',
                              color: '#10b981',
                              borderRadius: 6,
                              fontSize: 12,
                              fontWeight: 500,
                              cursor: updatingRequestId === request.id ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              transition: 'all 0.2s'
                            }}
                            onMouseOver={(e) => {
                              if (updatingRequestId !== request.id) {
                                e.target.style.backgroundColor = '#10b981';
                                e.target.style.color = '#fff';
                              }
                            }}
                            onMouseOut={(e) => {
                              if (updatingRequestId !== request.id) {
                                e.target.style.backgroundColor = '#fff';
                                e.target.style.color = '#10b981';
                              }
                            }}
                          >
                            {updatingRequestId === request.id ? (
                              <>
                                <div style={{
                                  width: '12px',
                                  height: '12px',
                                  border: '2px solid #10b981',
                                  borderTop: '2px solid transparent',
                                  borderRadius: '50%',
                                  animation: 'spin 1s linear infinite'
                                }}></div>
                                Processing...
                              </>
                            ) : (
                              <>
                                <CheckCircle size={14} />
                                Approve
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ))}

                    {/* Pagination for pending requests */}
                    {totalPendingPages > 1 && (
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'center', 
                        alignItems: 'center', 
                        gap: 8, 
                        marginTop: 12,
                        fontSize: 12
                      }}>
                        <button
                          onClick={() => setSignupRequestPage(prev => Math.max(1, prev - 1))}
                          disabled={signupRequestPage === 1}
                          style={{
                            padding: '4px 8px',
                            border: '1px solid #d1d5db',
                            backgroundColor: '#fff',
                            borderRadius: 4,
                            cursor: signupRequestPage === 1 ? 'not-allowed' : 'pointer'
                          }}
                        >
                          ‹
                        </button>
                        <span style={{ color: '#6b7280' }}>
                          Page {signupRequestPage} of {totalPendingPages}
                        </span>
                        <button
                          onClick={() => setSignupRequestPage(prev => Math.min(totalPendingPages, prev + 1))}
                          disabled={signupRequestPage === totalPendingPages}
                          style={{
                            padding: '4px 8px',
                            border: '1px solid #d1d5db',
                            backgroundColor: '#fff',
                            borderRadius: 4,
                            cursor: signupRequestPage === totalPendingPages ? 'not-allowed' : 'pointer'
                          }}
                        >
                          ›
                        </button>
                      </div>
                    )}

                    {/* Summary stats */}
                    <div style={{ 
                      marginTop: 12, 
                      padding: 8, 
                      backgroundColor: '#f8fafc', 
                      borderRadius: 6, 
                      fontSize: 11, 
                      color: '#6b7280',
                      textAlign: 'center'
                    }}>
                      {pendingRequests.length} pending • {signupRequests.filter(r => r.status === 'approved').length} approved • {signupRequests.filter(r => r.status === 'rejected').length} rejected
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* ── USER ACCOUNTS ────────────────────────────────────────────── */}
            <div style={panelCard}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: '#374151' }}>
                User Accounts
              </div>

              {usersLoading ? (
                <div style={{ fontSize: 13, color: '#9ca3af' }}>Loading users…</div>
              ) : users.length === 0 ? (
                <div style={{ fontSize: 13, color: '#9ca3af' }}>No users found.</div>
              ) : (() => {
                const totalUserPages = Math.max(1, Math.ceil(users.length / USERS_PAGE_SIZE));
                const pagedUsers = users.slice((userPage - 1) * USERS_PAGE_SIZE, userPage * USERS_PAGE_SIZE);

                return (
                  <div>
                    {pagedUsers.map(user => (
                      <div key={user.id} style={{
                        border: '1px solid #e5e7eb',
                        borderRadius: 8,
                        padding: 10,
                        marginBottom: 8,
                        backgroundColor: '#fff',
                        position: 'relative'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                          <div style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            backgroundColor: user.role === 'admin' ? '#fef3c7' : '#f0f9ff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            {user.role === 'admin' ? (
                              <Shield size={14} style={{ color: '#f59e0b' }} />
                            ) : (
                              <Users size={14} style={{ color: '#1e40af' }} />
                            )}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 12, color: '#374151', marginBottom: 2 }}>
                              {user.full_name || 'N/A'}
                            </div>
                            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>
                              {user.email}
                            </div>
                            <div style={{ fontSize: 10, color: '#9ca3af' }}>
                              Joined {new Date(user.created_at).toLocaleDateString()}
                            </div>
                          </div>
                          <div style={{
                            padding: '2px 6px',
                            borderRadius: '10px',
                            fontSize: 10,
                            fontWeight: 600,
                            backgroundColor: user.role === 'admin' ? '#fef3c7' : '#f0f9ff',
                            color: user.role === 'admin' ? '#92400e' : '#1e40af',
                            textTransform: 'uppercase'
                          }}>
                            {user.role}
                          </div>
                        </div>

                        {/* Action buttons for non-admin users */}
                        {user.role !== 'admin' && (
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => handleDeleteUser(user.id, user.email)}
                              disabled={deletingUserId === user.id}
                              style={{
                                padding: '4px 8px',
                                border: '1px solid #ef4444',
                                backgroundColor: '#fff',
                                color: '#ef4444',
                                borderRadius: 4,
                                fontSize: 10,
                                fontWeight: 500,
                                cursor: deletingUserId === user.id ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 3,
                                transition: 'all 0.2s'
                              }}
                              onMouseOver={(e) => {
                                if (deletingUserId !== user.id) {
                                  e.target.style.backgroundColor = '#ef4444';
                                  e.target.style.color = '#fff';
                                }
                              }}
                              onMouseOut={(e) => {
                                if (deletingUserId !== user.id) {
                                  e.target.style.backgroundColor = '#fff';
                                  e.target.style.color = '#ef4444';
                                }
                              }}
                            >
                              {deletingUserId === user.id ? (
                                <>
                                  <div style={{
                                    width: '10px',
                                    height: '10px',
                                    border: '2px solid #ef4444',
                                    borderTop: '2px solid transparent',
                                    borderRadius: '50%',
                                    animation: 'spin 1s linear infinite'
                                  }}></div>
                                  Deleting...
                                </>
                              ) : (
                                <>
                                  <Trash2 size={10} />
                                  Delete
                                </>
                              )}
                            </button>
                          </div>
                        )}

                        {/* Admin protection indicator */}
                        {user.role === 'admin' && (
                          <div style={{ 
                            fontSize: 9, 
                            color: '#92400e', 
                            textAlign: 'center',
                            fontStyle: 'italic',
                            marginTop: 4
                          }}>
                            Protected admin account
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Pagination for users */}
                    {totalUserPages > 1 && (
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'center', 
                        alignItems: 'center', 
                        gap: 6, 
                        marginTop: 8,
                        fontSize: 11
                      }}>
                        <button
                          onClick={() => setUserPage(prev => Math.max(1, prev - 1))}
                          disabled={userPage === 1}
                          style={{
                            padding: '3px 6px',
                            border: '1px solid #d1d5db',
                            backgroundColor: '#fff',
                            borderRadius: 3,
                            cursor: userPage === 1 ? 'not-allowed' : 'pointer'
                          }}
                        >
                          ‹
                        </button>
                        <span style={{ color: '#6b7280' }}>
                          {userPage}/{totalUserPages}
                        </span>
                        <button
                          onClick={() => setUserPage(prev => Math.min(totalUserPages, prev + 1))}
                          disabled={userPage === totalUserPages}
                          style={{
                            padding: '3px 6px',
                            border: '1px solid #d1d5db',
                            backgroundColor: '#fff',
                            borderRadius: 3,
                            cursor: userPage === totalUserPages ? 'not-allowed' : 'pointer'
                          }}
                        >
                          ›
                        </button>
                      </div>
                    )}

                    {/* User summary */}
                    <div style={{ 
                      marginTop: 8, 
                      padding: 6, 
                      backgroundColor: '#f8fafc', 
                      borderRadius: 4, 
                      fontSize: 10, 
                      color: '#6b7280',
                      textAlign: 'center'
                    }}>
                      {users.filter(u => u.role === 'admin').length} admin(s) • {users.filter(u => u.role === 'counselor').length} counselor(s)
                    </div>
                  </div>
                );
              })()}
            </div>

          </div>
        </div>

        {/* ── BACKUP & RESTORE ─────────────────────────────────────────── */}
        <div style={{ marginTop: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <RefreshCw size={18} color="var(--primary)" />
            <span style={{ fontWeight: 700, fontSize: 15, color: '#374151' }}>Backup & Restore</span>
          </div>
          <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: 14 }}>
            Export all system data (courses, year levels, sections, violation types) to a backup file, or restore from a previous backup.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            {/* Backup Section */}
            <div style={{ 
              padding: '16px', 
              background: '#f8fafc', 
              border: '1px solid #e5e7eb', 
              borderRadius: 8 
            }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12, color: '#374151' }}>
                📤 Export Backup
              </div>
              <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 12, lineHeight: 1.4 }}>
                Download a complete backup of all system data including courses, year levels, sections, and violation types.
              </p>
              <button
                className="btn btn-primary"
                onClick={handleBackup}
                disabled={backupLoading}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  gap: 6, 
                  whiteSpace: 'nowrap', 
                  fontSize: 13,
                  width: '100%',
                  minHeight: '40px',
                  height: '40px',
                  marginTop: '38px'
                }}
              >
                <Download size={14} />
                {backupLoading ? 'Creating backup…' : 'Download Backup'}
              </button>
            </div>

            {/* Restore Section */}
            <div style={{ 
              padding: '16px', 
              background: '#fef2f2', 
              border: '1px solid #fecaca', 
              borderRadius: 8 
            }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12, color: '#991b1b' }}>
                📥 Restore Backup
              </div>
              <p style={{ fontSize: 12, color: '#7f1d1d', marginBottom: 12, lineHeight: 1.4 }}>
                <strong>Warning:</strong> This will completely replace all current data. This action cannot be undone.
              </p>
              
              <div style={{ marginBottom: 12 }}>
                <input
                  ref={restoreFileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={e => {
                    setRestoreFile(e.target.files?.[0] || null);
                    setRestoreError('');
                    setRestoreSuccess(false);
                  }}
                  style={{ fontSize: 13, marginBottom: 8 }}
                />
              </div>

              <button
                className="btn"
                onClick={handleRestore}
                disabled={!restoreFile || restoreLoading}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  gap: 6, 
                  whiteSpace: 'nowrap', 
                  fontSize: 13,
                  background: '#dc2626',
                  borderColor: '#dc2626',
                  color: '#fff',
                  width: '100%',
                  minHeight: '40px',
                  height: '40px'
                }}
              >
                <RefreshCw size={14} />
                {restoreLoading ? 'Restoring…' : 'Restore Data'}
              </button>

              {restoreSuccess && (
                <div style={{ 
                  marginTop: 8, 
                  padding: '6px 10px', 
                  background: '#d1fae5', 
                  color: '#065f46', 
                  borderRadius: 4, 
                  fontSize: 12,
                  fontWeight: 600 
                }}>
                  ✅ Backup restored successfully! Page reloading...
                </div>
              )}

              {restoreError && (
                <div style={{ 
                  marginTop: 8, 
                  padding: '6px 10px', 
                  background: '#fee2e2', 
                  color: '#991b1b', 
                  borderRadius: 4, 
                  fontSize: 12 
                }}>
                  ❌ {restoreError}
                </div>
              )}
            </div>

            {/* Reset Section */}
            <div style={{ 
              padding: '16px', 
              background: '#fef2f2', 
              border: '1px solid #fca5a5', 
              borderRadius: 8 
            }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12, color: '#dc2626' }}>
                🚨 Factory Reset
              </div>
              <p style={{ fontSize: 12, color: '#7f1d1d', marginBottom: 12, lineHeight: 1.4 }}>
                <strong>Critical:</strong> This will permanently delete ALL system data and cannot be undone. Use with extreme caution.
              </p>
              
              <button
                className="btn"
                onClick={handleReset}
                disabled={resetLoading}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  gap: 6, 
                  whiteSpace: 'nowrap', 
                  fontSize: 13,
                  background: '#dc2626',
                  borderColor: '#dc2626',
                  color: '#fff',
                  width: '100%',
                  minHeight: '40px',
                  height: '40px',
                  marginTop: '38px'
                }}
              >
                <AlertTriangle size={14} />
                {resetLoading ? 'Resetting…' : 'Delete Everything'}
              </button>

              {resetSuccess && (
                <div style={{ 
                  marginTop: 8, 
                  padding: '6px 10px', 
                  background: '#d1fae5', 
                  color: '#065f46', 
                  borderRadius: 4, 
                  fontSize: 12,
                  fontWeight: 600 
                }}>
                  ✅ System reset successfully! Page reloading...
                </div>
              )}

              {resetError && (
                <div style={{ 
                  marginTop: 8, 
                  padding: '6px 10px', 
                  background: '#fee2e2', 
                  color: '#991b1b', 
                  borderRadius: 4, 
                  fontSize: 12 
                }}>
                  ❌ {resetError}
                </div>
              )}
            </div>
          </div>
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
