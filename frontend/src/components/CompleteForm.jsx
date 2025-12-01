// src/components/CompleteForm.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { getViolationTypes } from '../services/api';
import { useSlips } from '../contexts/SlipsContext';
import { FileText, CheckCircle, Search, Filter } from 'lucide-react';

const CompleteForm = () => {
  const { slips, loadSlips, completeSlip, approveSlip: approveSlipApi, updateSlipInState } = useSlips();
  const [violationTypes, setViolationTypes] = useState([]);
  const [selectedSlip, setSelectedSlip] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('newest');
  const [formData, setFormData] = useState({
    violationTypeId: '',
    description: '',
    remarks: '',
    course: ''
  });
  const [isModalOpen, setIsModalOpen] = useState(false);

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
    .filter(slip =>
      slip.student_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      slip.slip_number?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const parseTime = (slip, mode) => {
        const dateStr = mode === 'newest' ? (slip.updated_at || slip.created_at) : slip.created_at;
        const t = new Date(dateStr).getTime();
        return Number.isFinite(t) ? t : 0;
      };

      if (sortOrder === 'newest') {
        const tA = parseTime(a, 'newest');
        const tB = parseTime(b, 'newest');
        return tB - tA; // most recently updated first
      }

      const tA = parseTime(a, 'oldest');
      const tB = parseTime(b, 'oldest');
      return tA - tB; // oldest issued first
    });

    

  const handleSelectSlip = (slip) => {
    console.log('📝 Selected slip:', slip);
    setSelectedSlip(slip);
    setFormData({
      violationTypeId: slip.violation_type_id || '',
      description: slip.description || '',
      remarks: slip.remarks || '',
      course: slip.course || ''
    });
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
    // Require course when completing an ISSUED slip
    if ((selectedSlip.status === 'issued' || !selectedSlip.status) && !formData.course?.toString().trim()) {
      alert('Please enter the student\'s Course before completing the form.');
      return;
    }

    // Confirm with a simple message
    if (!window.confirm('Proceed to complete this form?')) {
      return; // user cancelled
    }

    setLoading(true);
    try {
      console.log('🚀 Attempting to complete form for slip:', selectedSlip.id);
      
      // Prepare data based on your API structure
      const submitData = {
        violation_type_id: parseInt(formData.violationTypeId),
        description: formData.description,
        teacher_comments: formData.remarks, // Match your API field name
        course: formData.course,
        status: 'form_completed'
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
        const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message || 'Failed to complete form';
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
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
          <div className="icon-container" style={{ width: '48px', height: '48px', marginRight: '12px' }}>
            <FileText style={{ width: '24px', height: '24px' }} />
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', margin: 0 }}>Complete Admission Form</h1>
        </div>

        <p className="text-muted" style={{ marginBottom: '16px', fontSize: '0.95rem' }}>
          Search for issued admission slips and complete the violation details after the student returns the filled form.
        </p>

        {/* Search and Sort */}
        <div style={{ marginBottom: '16px', display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
          <div className="input-with-icon">
            <Search className="icon" />
            <input
              type="text"
              placeholder="Search by student name or slip number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm((e.target.value || '').toString().slice(0, 32))}
              maxLength={32}
              className="form-input"
            />
          </div>
          <div className="input-with-icon">
            <Filter className="icon" />
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="form-input"
            >
              <option value="newest">Most Recently Updated</option>
              <option value="oldest">Oldest Issued</option>
            </select>
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
                      <th>Student & Slip Info</th>
                      <th>Status</th>
                      <th>Violation</th>
                      <th>Year & Section</th>
                      <th>Date &amp; Time</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSlips.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-gray-500">
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
                            <div className="text-gray-700">Issued: {slip.created_at ? new Date(slip.created_at).toLocaleString() : '-'}</div>
                            {slip.updated_at && slip.status !== 'issued' && slip.updated_at !== slip.created_at && (
                              <div className="text-gray-600">Updated: {new Date(slip.updated_at).toLocaleString()}</div>
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
            <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.45)', padding: '1rem' }}>
              <div className="card" style={{ width: '100%', maxWidth: '760px', maxHeight: '90vh', overflowY: 'auto', padding: '18px' }}>
                {/* Header: compact title + actions */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>{selectedSlip.student_name}</h3>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px' }}>
                        <span className="text-xs text-gray-500">{selectedSlip.slip_number}</span>
                      </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadgeClass(selectedSlip.status)}`}>
                      {getStatusDisplay(selectedSlip.status)}
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

                {/* Meta rows - include Year, Section and Course as labeled cells */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                  <div>
                    <div style={{ fontSize: '0.85rem', color: '#374151', fontWeight: 600 }}>Date &amp; Time</div>
                    <div style={{ fontSize: '0.95rem', color: '#111827', marginTop: '4px' }}>{selectedSlip.created_at ? new Date(selectedSlip.created_at).toLocaleString() : '-'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.85rem', color: '#374151', fontWeight: 600 }}>Last Updated</div>
                    <div style={{ fontSize: '0.95rem', color: '#111827', marginTop: '4px' }}>{(selectedSlip.updated_at && selectedSlip.updated_at !== selectedSlip.created_at) ? new Date(selectedSlip.updated_at).toLocaleString() : '-'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.85rem', color: '#374151', fontWeight: 600 }}>Year &amp; Section</div>
                    <div style={{ fontSize: '0.95rem', color: '#111827', marginTop: '4px' }}>{[selectedSlip.year, selectedSlip.section].filter(Boolean).join(' ') || '-'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.85rem', color: '#374151', fontWeight: 600 }}>Course</div>
                    <div style={{ fontSize: '0.95rem', color: '#111827', marginTop: '4px' }}>{selectedSlip.course || '-'}</div>
                  </div>
                </div>

                {/* Content */}
                {selectedSlip.status === 'form_completed' ? (
                  <div style={{ display: 'grid', gap: '12px' }}>
                    <div>
                      <div style={{ fontSize: '0.85rem', color: '#374151', fontWeight: 600, marginBottom: '6px' }}>Violation</div>
                      <div style={{ fontSize: '0.95rem', color: '#111827', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{selectedSlip.violation_description || 'No violation specified'}</div>
                    </div>

                    <div>
                      <div style={{ fontSize: '0.85rem', color: '#374151', fontWeight: 600, marginBottom: '6px' }}>Description</div>
                      <div style={{ fontSize: '0.95rem', color: '#111827', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{selectedSlip.description || '-'}</div>
                    </div>


                    <div>
                      <div style={{ fontSize: '0.85rem', color: '#374151', fontWeight: 600, marginBottom: '6px' }}>Counselor Remarks</div>
                      <textarea
                        value={formData.remarks}
                        onChange={(e) => setFormData({ ...formData, remarks: (e.target.value || '').toString().slice(0, 128) })}
                        maxLength={128}
                        rows="4"
                        className="form-input"
                        placeholder="Add counselor remarks or recommendations..."
                        style={{ width: '100%', resize: 'vertical' }}
                      />
                    </div>

                    {/* Course is shown in the meta header above */}

                    <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                      <button
                        onClick={async () => { await handleApprove(selectedSlip.id); setIsModalOpen(false); }}
                        className="btn btn-primary"
                      >
                        Approve Slip
                      </button>

                      <button
                        onClick={() => setIsModalOpen(false)}
                        className="btn"
                        style={{ padding: '6px 12px', background: 'transparent', border: '1px solid var(--primary)', color: 'var(--primary)', borderRadius: 6 }}
                      >
                        Close
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>Course</label>
                      <input
                        value={formData.course}
                        onChange={(e) => setFormData({ ...formData, course: (e.target.value || '').toString().slice(0, 32) })}
                        maxLength={32}
                        className="form-input"
                        placeholder="Student's course (e.g., BS Computer Science)"
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>Violation Type *</label>
                      <select
                        value={formData.violationTypeId}
                        onChange={(e) => setFormData({ ...formData, violationTypeId: e.target.value })}
                        className="form-input"
                        required
                        style={{ width: '100%' }}
                      >
                        <option value="">Select violation type</option>
                        {violationTypes.map((type) => (
                          <option key={type.id} value={type.id}>{type.description}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>Violation Description *</label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: (e.target.value || '').toString().slice(0, 128) })}
                        maxLength={128}
                        rows="4"
                        className="form-input"
                        placeholder="Detailed description of the violation..."
                        required
                        style={{ width: '100%', resize: 'vertical' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>Counselor Remarks</label>
                      <textarea
                        value={formData.remarks}
                        onChange={(e) => setFormData({ ...formData, remarks: (e.target.value || '').toString().slice(0, 128) })}
                        maxLength={128}
                        rows="3"
                        className="form-input"
                        placeholder="Additional remarks or recommendations..."
                        style={{ width: '100%', resize: 'vertical' }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                      <button
                        type="submit"
                        disabled={loading || ((selectedSlip.status === 'issued' || !selectedSlip.status) && !formData.course?.toString().trim())}
                        className="btn btn-primary"
                      >
                        {loading ? 'Submitting...' : `Complete Form for ${selectedSlip.student_name}`}
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsModalOpen(false)}
                        className="btn"
                        style={{ padding: '6px 12px', background: 'transparent', border: '1px solid var(--primary)', color: 'var(--primary)', borderRadius: 6 }}
                      >
                        Cancel
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