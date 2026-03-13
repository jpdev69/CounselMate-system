// src/components/CompleteForm.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { getViolationTypes, validateViolation } from '../services/api';
import { useSlips } from '../contexts/SlipsContext';
import { FileText, CheckCircle, Search, Filter, Trash2, Calendar } from 'lucide-react';
import SchoolYearSelector from './SchoolYearSelector';
import TermSelector from './TermSelector';
import '../App-table-update.css';

// ── Sort helper component ─────────────────────────────────────────────
const SortHeader = ({ colKey, label, sortCol, sortDir, onSort, className }) => {
  const active = sortCol === colKey;
  return (
    <th
      className={className}
      data-sort-active={active ? 'true' : 'false'}
      data-sort-dir={active ? sortDir : 'none'}
    >
      <button className="sort-btn" onClick={() => onSort(colKey)}>
        <span>{label}</span>
        <span className="sort-icon">
          <span
            className="arr-up"
            style={{ opacity: active && sortDir === 'asc' ? 1 : 0.3 }}
          />
          <span
            className="arr-down"
            style={{ opacity: active && sortDir === 'desc' ? 1 : 0.3 }}
          />
        </span>
      </button>
    </th>
  );
};

const CompleteForm = () => {
  const { slips, loadSlips, completeSlip, approveSlip: approveSlipApi, updateSlipInState, deleteSlip } = useSlips();
  const [violationTypes, setViolationTypes] = useState([]);
  const [selectedSlip, setSelectedSlip] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [formData, setFormData] = useState({
    violationTypeId: '',
    description: '',
    remarks: '',
    course: ''
  });
  const [schoolYear, setSchoolYear] = useState('');
  const [term, setTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [validationError, setValidationError] = useState(null);
  const [proceedWithError, setProceedWithError] = useState(false);
  const formRef = useRef(null);
  // Column sort state
  const [sortCol, setSortCol] = useState('date');
  const [sortDir, setSortDir] = useState('desc');

  const handleColSort = (col) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const location = useLocation();

  // If a slipId is provided in the URL, open that slip's details/modal
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const slipId = params.get('slipId');
    if (slipId && slips && slips.length) {
      const found = slips.find(s => String(s.id) === String(slipId));
      if (found && (!selectedSlip || selectedSlip.id !== found.id)) {
        handleSelectSlip(found);
      }
    }
  }, [location.search, slips]);

  const loadData = async () => {
    try {
      console.log('🔄 Loading violations from backend...');
      const violationsResponse = await getViolationTypes();
      setViolationTypes(violationsResponse.data);
    } catch (error) {
      console.error('❌ Failed to load data:', error);
    }
  };

  // Exclude already approved slips from being selectable for completion
  const filteredSlips = slips
    .filter(slip => slip.status !== 'approved')
    .filter(slip => statusFilter === 'all' || slip.status === statusFilter)
    .filter(slip =>
      slip.student_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      slip.slip_number?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .filter(slip => {
      if (!startDate && !endDate) return true;
      if (!slip.created_at) return false;
      const slipDateObj = new Date(slip.created_at);
      slipDateObj.setHours(0, 0, 0, 0);

      const isAfterStart = !startDate || slipDateObj >= new Date(new Date(startDate).setHours(0, 0, 0, 0));
      const isBeforeEnd = !endDate || slipDateObj <= new Date(new Date(endDate).setHours(23, 59, 59, 999));

      return isAfterStart && isBeforeEnd;
    })
    .sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      switch (sortCol) {
        case 'name': return dir * (a.student_name || '').localeCompare(b.student_name || '');
        case 'status': return dir * (a.status || '').localeCompare(b.status || '');
        case 'violation': return dir * (a.violation_description || '').localeCompare(b.violation_description || '');
        case 'section': return dir * (`${a.year} ${a.section}` || '').localeCompare(`${b.year} ${b.section}` || '');
        case 'issued': {
          const tA = new Date(a.created_at).getTime() || 0;
          const tB = new Date(b.created_at).getTime() || 0;
          return dir * (tA - tB);
        }
        case 'updated': {
          // If no updated_at exists, fall back to created_at
          const tA = new Date(a.updated_at || a.created_at).getTime() || 0;
          const tB = new Date(b.updated_at || b.created_at).getTime() || 0;
          return dir * (tA - tB);
        }
        case 'date':
        default: {
          const tA = new Date(a.created_at).getTime() || 0;
          const tB = new Date(b.created_at).getTime() || 0;
          return dir * (tA - tB);
        }
      }
    });

  const handleSelectSlip = (slip) => {
    console.log('📝 Selected slip:', slip);
    setSelectedSlip(slip);
    setFormData({
      violationTypeId: slip.violation_type_id || '',
      description: slip.description || '',
      remarks: slip.teacher_comments || slip.remarks || '',
      course: slip.course || ''
    });
    setSchoolYear(slip.school_year || '');
    setTerm(slip.term || '');
    // Reset validation error when opening a new slip
    setValidationError(null);
    setProceedWithError(false);
    // open modal immediately to avoid scrolling
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSlip) {
      alert('Please select an admission slip first.');
      return;
    }

    if (!formData.violationTypeId) {
      alert('Please select a violation type.');
      return;
    }
    if (!formData.description.trim()) {
      alert('Please provide a violation description.');
      return;
    }
    if (!schoolYear) {
      alert('Please select a school year.');
      return;
    }
    if (!term) {
      alert('Please select a term.');
      return;
    }
    setLoading(true);
    try {
      console.log('🔍 Validating violation description matches violation type...');

      // First, validate that the description matches the violation type
      const validationResponse = await validateViolation({
        violation_type_id: parseInt(formData.violationTypeId),
        description: formData.description
      });

      const validationResult = validationResponse.data?.validation;

      // If validation fails and user hasn't chosen to proceed anyway, show error
      if (!validationResult?.matches && !proceedWithError) {
        // Violation doesn't match - display error below the field
        setLoading(false);
        setValidationError(validationResult?.reason || 'The violation description does not match the selected violation type.');
        setProceedWithError(false);
        console.log('❌ Form completion suspended due to validation failure');
        return;
      }

      if (validationResult?.matches) {
        console.log('✅ Violation description validation passed');
        setValidationError(null);
        setProceedWithError(false);
      } else if (proceedWithError) {
        console.log('⚠️ Proceeding with validation warning');
      }

      // Confirm with a simple message
      if (!window.confirm('Proceed to complete this form?')) {
        setLoading(false);
        setProceedWithError(false);
        return; // user cancelled
      }

      // Prepare data based on your API structure
      const submitData = {
        violation_type_id: parseInt(formData.violationTypeId),
        description: formData.description,
        teacher_comments: formData.remarks, // Match your API field name
        course: formData.course,
        school_year: schoolYear,
        term: term,
        status: 'form_completed',
        skip_validation: proceedWithError || false
      };

      console.log('📤 Sending data to API:', submitData);

      const response = await completeSlip(selectedSlip.id, submitData);
      console.log('✅ SUCCESS - Form completed:', response.data);
      setSelectedSlip(null);
      setFormData({ violationTypeId: '', description: '', remarks: '', course: '' });
      alert('Form completed successfully! Status updated to "Form Completed".');
      setIsModalOpen(false);
    } catch (error) {
      console.error('❌ COMPLETE FORM ERROR:', error);

      // If the endpoint doesn't exist, use a fallback
      if (error.response?.status === 404) {
        console.log('🔧 Endpoint not found, using fallback...');
        await handleSubmitFallback();
        setIsModalOpen(false);
      } else {
        const errorMessage = error.response?.data?.error || error.response?.data?.validation?.reason || error.response?.data?.message || error.message || 'Failed to complete form';
        alert(`Error: ${errorMessage}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Fallback function if the API endpoint doesn't exist
  const handleSubmitFallback = async () => {
    try {
      console.log('🔄 Using fallback - updating local state only');

      // Update local state to simulate success
      const updatedSlip = {
        ...(selectedSlip || {}),
        status: 'form_completed',
        violation_type_id: parseInt(formData.violationTypeId),
        description: formData.description,
        teacher_comments: formData.remarks,
        course: formData.course,
        violation_code: violationTypes.find(vt => vt.id == formData.violationTypeId)?.code,
        violation_description: violationTypes.find(vt => vt.id == formData.violationTypeId)?.description
      };

      // update shared state
      if (updateSlipInState) updateSlipInState(updatedSlip);
      setSelectedSlip(null);
      setFormData({ violationTypeId: '', description: '', remarks: '', course: '' });

      alert('Form completed successfully! (Local update - backend endpoint not available)');
    } catch (fallbackError) {
      console.error('❌ Fallback also failed:', fallbackError);
      alert('Failed to complete form. Please check backend configuration.');

    }
  };



  const handleApprove = async (slipId) => {
    if (!confirm('Are you sure you want to approve this slip?')) return;

    try {
      console.log('✅ Attempting to approve slip:', slipId);
      const response = await approveSlipApi(slipId);
      console.log('✅ Approve response:', response.data);
      // close modal and clear selection
      setIsModalOpen(false);
      setSelectedSlip(null);
      alert('Slip approved successfully!');
    } catch (error) {
      console.error('❌ Approve slip error:', error);

      // Fallback for approve
      if (error.response?.status === 404) {
        console.log('🔧 Approve endpoint not found, using fallback...');
        const updatedSlip = { ...(slips.find(s => s.id === slipId) || {}), status: 'approved' };
        if (updateSlipInState) updateSlipInState(updatedSlip);
        setIsModalOpen(false);
        setSelectedSlip(null);
        alert('Slip approved successfully! (Local update)');
      } else {
        const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message || 'Failed to approve slip';
        alert(`Approve error: ${errorMessage}`);
      }
    }
  };

  const handleDelete = async (slip) => {
    if (!confirm('Are you sure you want to delete this admission slip? This action cannot be undone.')) return;

    try {
      console.log('🗑️ Attempting to delete slip:', slip.id);
      await deleteSlip(slip.id);
      setIsModalOpen(false);
      setSelectedSlip(null);
      alert('Slip deleted successfully.');
    } catch (err) {
      console.error('❌ Delete slip error:', err);
      if (err.response?.status === 404) {
        // Refresh list if server reports it's already gone
        await loadSlips();
        setIsModalOpen(false);
        setSelectedSlip(null);
        alert('Slip was already deleted. List refreshed.');
      } else if (err.response?.data?.error) {
        alert(`Delete failed: ${err.response.data.error}`);
      } else {
        alert('Failed to delete slip. See console for details.');
      }
    }
  };

  const getStatusDisplay = (status) => {
    const statusMap = {
      'issued': 'ISSUED',
      'form_completed': 'FORM COMPLETED',
      'approved': 'APPROVED'
    };
    return statusMap[status] || status?.toUpperCase() || 'UNKNOWN';
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'issued': return 'bg-yellow-100 text-yellow-800';
      case 'form_completed': return 'bg-blue-100 text-blue-800';
      case 'approved': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="container">
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
          <div className="icon-container" style={{ 
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
            <FileText style={{ width: '22px', height: '22px' }} />
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', margin: 0 }}>Complete Admission Form</h1>
        </div>

        <p className="text-muted" style={{ marginBottom: '16px', fontSize: '0.95rem' }}>
          Search for admission slips to complete violation details.
        </p>

        {/* Search and Sort */}
        <div style={{ marginBottom: '16px', display: 'grid', gridTemplateColumns: '1.5fr 1fr 2fr', gap: '12px' }}>
          <div className="input-with-icon">
            <Search className="icon" />
            <input
              type="text"
              placeholder="Search by student or slip..."
              value={searchTerm}
              onChange={(e) => setSearchTerm((e.target.value || '').toString().slice(0, 32))}
              maxLength={32}
              className="form-input"
            />
          </div>
          <div className="input-with-icon">
            <Filter className="icon" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="form-input"
            >
              <option value="all">All Status</option>
              <option value="issued">Issued</option>
              <option value="form_completed">Form Completed</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#ffffff', border: '1px solid #ced4da', borderRadius: '4px', paddingLeft: '12px' }}>
            <Calendar className="icon" style={{ color: '#6c757d', width: '16px', height: '16px' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '13px', color: '#6c757d', fontWeight: 500 }}>From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="form-input"
                style={{ border: 'none', background: 'transparent', padding: '6px' }}
                title="Start Date"
              />
            </div>

            <div style={{ width: '1px', height: '24px', backgroundColor: '#e9ecef' }}></div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '13px', color: '#6c757d', fontWeight: 500 }}>To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="form-input"
                style={{ border: 'none', background: 'transparent', padding: '6px', borderRadius: 0 }}
                title="End Date"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Slip List */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Issued Admission Slips</h2>
            <div className="records-table-container" style={{ overflowX: 'auto' }}>
              <div className="records-table-scroll">
                <table className="records-table">
                  <thead>
                    <tr>
                      <SortHeader colKey="name" label="Student & Slip Info" sortCol={sortCol} sortDir={sortDir} onSort={handleColSort} className="col-name" />
                      <SortHeader colKey="status" label="Status" sortCol={sortCol} sortDir={sortDir} onSort={handleColSort} className="col-status" />
                      <SortHeader colKey="violation" label="Violation" sortCol={sortCol} sortDir={sortDir} onSort={handleColSort} className="col-violation" />
                      <SortHeader colKey="section" label="Year & Section" sortCol={sortCol} sortDir={sortDir} onSort={handleColSort} className="col-section" />
                      <SortHeader colKey="issued" label="Issued" sortCol={sortCol} sortDir={sortDir} onSort={handleColSort} className="col-issued" />
                      <SortHeader colKey="updated" label="Updated" sortCol={sortCol} sortDir={sortDir} onSort={handleColSort} className="col-updated" />
                      <th className="col-actions"><button className="sort-btn" style={{ cursor: 'default' }}>Actions</button></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSlips.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-gray-500">
                          <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                          <p>No admission slips found</p>
                        </td>
                      </tr>
                    ) : (
                      filteredSlips.map((slip) => (
                        <tr
                          key={slip.id}
                          onClick={() => handleSelectSlip(slip)}
                          className={selectedSlip?.id === slip.id ? 'bg-blue-50 cursor-pointer' : 'hover:bg-gray-50 cursor-pointer'}
                        >
                          <td>
                            <h3 className="font-medium text-gray-900">{slip.student_name}</h3>
                            <p className="text-xs text-gray-500">{slip.slip_number}</p>
                          </td>

                          <td className="text-right">
                            <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadgeClass(slip.status)}`}>
                              {getStatusDisplay(slip.status)}
                            </span>
                          </td>

                          <td className="text-xs text-gray-600">{slip.violation_description || 'No violation specified'}</td>

                          <td className="text-xs text-gray-600">
                            <div className="text-sm text-gray-700">{slip.year} - {slip.section}</div>
                          </td>

                          <td className="text-xs text-gray-600">
                            <div className="text-gray-700">{slip.created_at ? new Date(slip.created_at).toLocaleString() : '-'}</div>
                          </td>

                          <td className="text-xs text-gray-600">
                            {slip.updated_at && slip.status !== 'issued' && slip.updated_at !== slip.created_at ? (
                              <div className="text-gray-700">{new Date(slip.updated_at).toLocaleString()}</div>
                            ) : (
                              <div className="text-gray-400">-</div>
                            )}
                          </td>

                          <td>
                            {slip.status === 'form_completed' && (
                              <div>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleApprove(slip.id); }}
                                  className="mt-2 w-full bg-green-600 text-white py-1 px-3 rounded text-sm hover:bg-green-700 transition-colors flex items-center justify-center"
                                >
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                  Approve
                                </button>
                              </div>
                            )}
                            {(slip.status === 'form_completed' || slip.status === 'issued') && (
                              <div>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDelete(slip); }}
                                  className="mt-2 w-full bg-red-600 text-white py-1 px-3 rounded text-sm hover:bg-red-700 transition-colors flex items-center justify-center"
                                >
                                  <Trash2 className="w-4 h-4 mr-1" />
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
              <p>Showing {filteredSlips.length} of {slips.length} total records</p>
            </div>
          </div>

          {isModalOpen && selectedSlip && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.45)', padding: '1rem' }}>
              <div className="card" style={{ width: '100%', maxWidth: '760px', maxHeight: '90vh', overflowY: 'auto', padding: '32px' }}>
                {/* Header: compact title + actions */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '15px' }}>
                  <button
                    onClick={() => setIsModalOpen(false)}
                    style={{ padding: '8px 16px', backgroundColor: '#ef4444', color: 'white', borderRadius: '4px', border: 'none', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
                  >
                    Close
                  </button>
                </div>

                <div style={{ textAlign: 'center', marginBottom: '15px' }}>
                  <h2 style={{ color: '#006400', fontFamily: 'Times New Roman, serif', margin: '0', fontSize: '24px', letterSpacing: '0.5px' }}>ISABELA STATE UNIVERSITY</h2>
                  <h3 style={{ margin: '8px 0', fontFamily: 'Times New Roman, serif', fontSize: '16px', fontWeight: 'normal', letterSpacing: '1px' }}>GUIDANCE OFFICE</h3>
                  <h3 style={{ textDecoration: 'underline', margin: '15px 0 5px 0', fontSize: '20px', fontWeight: 'bold', fontFamily: 'Arial, sans-serif' }}>ADMISSION SLIP REPORT</h3>
                </div>

                <hr style={{ border: 'none', borderTop: '3px double #006400', margin: '20px 0' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '15px' }}>
                  <div>
                    <h3 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 5px 0', textTransform: 'uppercase', fontFamily: 'Arial, sans-serif' }}>{selectedSlip.student_name}</h3>
                    <div style={{ color: '#555', fontSize: '15px' }}>Slip Reference: <strong style={{ color: '#000' }}>{selectedSlip.slip_number}</strong></div>
                  </div>
                  <div style={{ border: '1px solid #333', padding: '4px 8px', fontWeight: 'bold', fontSize: '14px', letterSpacing: '1px', textTransform: 'uppercase', color: '#000' }}>
                    {getStatusDisplay(selectedSlip.status)}
                  </div>
                </div>

                {/* Meta table rows */}
                <div style={{ border: '1px solid #a1a1aa', borderBottom: 'none', display: 'grid', gridTemplateColumns: '1fr 1fr', marginBottom: '20px', fontFamily: 'Arial, sans-serif' }}>
                  <div style={{ borderBottom: '1px solid #a1a1aa', borderRight: '1px solid #a1a1aa', padding: '12px' }}>
                    <div style={{ fontSize: '12px', color: '#555', fontWeight: 700, marginBottom: '6px', letterSpacing: '0.5px' }}>DATE &amp; TIME</div>
                    <div style={{ fontSize: '15px', color: '#111827' }}>{selectedSlip.created_at ? new Date(selectedSlip.created_at).toLocaleString() : '-'}</div>
                  </div>
                  <div style={{ borderBottom: '1px solid #a1a1aa', padding: '12px' }}>
                    <div style={{ fontSize: '12px', color: '#555', fontWeight: 700, marginBottom: '6px', letterSpacing: '0.5px' }}>LAST UPDATED</div>
                    <div style={{ fontSize: '15px', color: '#111827' }}>{(selectedSlip.updated_at && selectedSlip.updated_at !== selectedSlip.created_at) ? new Date(selectedSlip.updated_at).toLocaleString() : '-'}</div>
                  </div>
                  <div style={{ borderBottom: '1px solid #a1a1aa', borderRight: '1px solid #a1a1aa', padding: '12px' }}>
                    <div style={{ fontSize: '12px', color: '#555', fontWeight: 700, marginBottom: '6px', letterSpacing: '0.5px' }}>YEAR &amp; SECTION</div>
                    <div style={{ fontSize: '15px', color: '#111827' }}>{[selectedSlip.year, selectedSlip.section].filter(Boolean).join(' ') || '-'}</div>
                  </div>
                  <div style={{ borderBottom: '1px solid #a1a1aa', padding: '12px' }}>
                    <div style={{ fontSize: '12px', color: '#555', fontWeight: 700, marginBottom: '6px', letterSpacing: '0.5px' }}>COURSE</div>
                    <div style={{ fontSize: '15px', color: '#111827' }}>{selectedSlip.course || '-'}</div>
                  </div>
                  <div style={{ borderBottom: '1px solid #a1a1aa', borderRight: '1px solid #a1a1aa', padding: '12px' }}>
                    <div style={{ fontSize: '12px', color: '#555', fontWeight: 700, marginBottom: '6px', letterSpacing: '0.5px' }}>SCHOOL YEAR</div>
                    <div style={{ fontSize: '15px', color: '#111827' }}>{selectedSlip.school_year || '-'}</div>
                  </div>
                  <div style={{ borderBottom: '1px solid #a1a1aa', padding: '12px' }}>
                    <div style={{ fontSize: '12px', color: '#555', fontWeight: 700, marginBottom: '6px', letterSpacing: '0.5px' }}>TERM</div>
                    <div style={{ fontSize: '15px', color: '#111827' }}>{selectedSlip.term || '-'}</div>
                  </div>
                </div>

                {/* Content */}
                {selectedSlip.status === 'form_completed' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', fontFamily: 'Arial, sans-serif' }}>
                    <div style={{ border: '1px solid #c1c1c1', backgroundColor: '#fff', marginBottom: '20px' }}>
                      <div style={{ borderBottom: '1px solid #c1c1c1', padding: '12px 16px' }}>
                        <div style={{ fontSize: '13px', color: '#555', fontWeight: 700, marginBottom: '8px', letterSpacing: '0.5px' }}>VIOLATION</div>
                        <div style={{ fontSize: '15px', color: '#111827', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{selectedSlip.violation_description || 'No violation specified'}</div>
                      </div>

                      <div style={{ borderBottom: '1px solid #c1c1c1', padding: '12px 16px' }}>
                        <div style={{ fontSize: '13px', color: '#555', fontWeight: 700, marginBottom: '8px', letterSpacing: '0.5px' }}>DESCRIPTION</div>
                        <div style={{ fontSize: '15px', color: '#111827', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{selectedSlip.description || '-'}</div>
                      </div>

                      <div style={{ padding: '12px 16px' }}>
                        <div style={{ fontSize: '13px', color: '#555', fontWeight: 700, marginBottom: '8px', letterSpacing: '0.5px' }}>COUNSELOR REMARKS</div>
                        <textarea
                          value={formData.remarks}
                          onChange={(e) => setFormData({ ...formData, remarks: (e.target.value || '').toString().slice(0, 500) })}
                          maxLength={500}
                          rows="4"
                          className="form-input"
                          placeholder="Add counselor remarks or recommendations..."
                          style={{ width: '100%', resize: 'vertical', border: '1px solid #e5e7eb', borderRadius: '4px', padding: '10px', fontSize: '15px', fontFamily: 'Arial, sans-serif' }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button
                        onClick={async () => { await handleApprove(selectedSlip.id); setIsModalOpen(false); }}
                        style={{ padding: '8px 16px', backgroundColor: '#1e7b44', color: 'white', borderRadius: '4px', border: 'none', fontWeight: 600, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                      >
                        Approve Slip
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(selectedSlip); }}
                        style={{ padding: '8px 16px', backgroundColor: '#ef4444', color: 'white', borderRadius: '4px', border: 'none', display: 'flex', alignItems: 'center', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </button>
                    </div>
                  </div>
                ) : (
                  <form ref={formRef} onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', fontFamily: 'Arial, sans-serif' }}>
                    <div style={{ border: '1px solid #c1c1c1', backgroundColor: '#fff', marginBottom: '20px' }}>
                      <div style={{ borderBottom: '1px solid #c1c1c1', padding: '12px 16px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#555', fontWeight: 700, letterSpacing: '0.5px', fontFamily: 'Arial, sans-serif' }}>VIOLATION TYPE *</label>
                        <select
                          value={formData.violationTypeId}
                          onChange={(e) => setFormData({ ...formData, violationTypeId: e.target.value })}
                          className="form-input"
                          required
                          style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '15px', fontFamily: 'Arial, sans-serif' }}
                        >
                          <option value="">Select violation type</option>
                          {(() => {
                            const minor = violationTypes.filter(vt => vt.category === 'minor' && vt.requires_admission_slip);
                            const major = violationTypes.filter(vt => vt.category === 'major' && vt.requires_admission_slip);
                            if (minor.length === 0 && major.length === 0) {
                              return <option disabled>No violations set to require a slip — configure in Admin Panel</option>;
                            }
                            return (
                              <>
                                {minor.length > 0 && (
                                  <optgroup label="Minor Offenses (Section 2.1)">
                                    {minor.map(type => (
                                      <option key={type.id} value={type.id}>
                                        {type.description}
                                      </option>
                                    ))}
                                  </optgroup>
                                )}
                                {major.length > 0 && (
                                  <optgroup label="Major Offenses (Section 2.2)">
                                    {major.map(type => (
                                      <option key={type.id} value={type.id}>
                                        {type.description}
                                      </option>
                                    ))}
                                  </optgroup>
                                )}
                              </>
                            );
                          })()}
                        </select>
                      </div>

                      <div style={{ borderBottom: '1px solid #c1c1c1', padding: '12px 16px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#555', fontWeight: 700, letterSpacing: '0.5px', fontFamily: 'Arial, sans-serif' }}>VIOLATION DESCRIPTION *</label>
                        <textarea
                          value={formData.description}
                          onChange={(e) => {
                            setFormData({ ...formData, description: (e.target.value || '').toString().slice(0, 500) });
                            if (validationError) setValidationError(null);
                          }}
                          maxLength={500}
                          rows="4"
                          className="form-input"
                          placeholder="Detailed description of the violation..."
                          required
                          style={{ width: '100%', resize: 'vertical', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '15px', fontFamily: 'Arial, sans-serif', borderColor: validationError ? '#ef4444' : undefined }}
                        />
                        {validationError && (
                          <div style={{ marginTop: '8px', padding: '10px', backgroundColor: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '6px', color: '#991b1b', fontSize: '0.9rem' }}>
                            <strong>⚠️ Validation Issue:</strong> {validationError}
                            <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setProceedWithError(true);
                                  setTimeout(() => {
                                    if (formRef.current) formRef.current.requestSubmit();
                                  }, 0);
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

                      <div style={{ borderBottom: '1px solid #c1c1c1', padding: '12px 16px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#555', fontWeight: 700, letterSpacing: '0.5px', fontFamily: 'Arial, sans-serif' }}>SCHOOL YEAR *</label>
                        <SchoolYearSelector
                          value={schoolYear}
                          onChange={setSchoolYear}
                          required={true}
                        />
                      </div>

                      <div style={{ borderBottom: '1px solid #c1c1c1', padding: '12px 16px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#555', fontWeight: 700, letterSpacing: '0.5px', fontFamily: 'Arial, sans-serif' }}>TERM *</label>
                        <TermSelector
                          value={term}
                          onChange={setTerm}
                          required={true}
                        />
                      </div>

                      <div style={{ padding: '12px 16px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#555', fontWeight: 700, letterSpacing: '0.5px', fontFamily: 'Arial, sans-serif' }}>COUNSELOR REMARKS</label>
                        <textarea
                          value={formData.remarks}
                          onChange={(e) => setFormData({ ...formData, remarks: (e.target.value || '').toString().slice(0, 500) })}
                          maxLength={500}
                          rows="3"
                          className="form-input"
                          placeholder="Additional remarks or recommendations..."
                          style={{ width: '100%', resize: 'vertical', padding: '10px', border: '1px solid #e5e7eb', borderRadius: '4px', fontSize: '15px', fontFamily: 'Arial, sans-serif' }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '20px' }}>
                      <button
                        type="submit"
                        disabled={loading}
                        style={{ padding: '8px 16px', backgroundColor: '#1e7b44', color: 'white', borderRadius: '4px', border: 'none', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
                      >
                        {loading ? 'Submitting...' : `Complete Form`}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleDelete(selectedSlip); }}
                        style={{ padding: '8px 16px', backgroundColor: '#ef4444', color: 'white', borderRadius: '4px', border: 'none', display: 'flex', alignItems: 'center', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default CompleteForm;