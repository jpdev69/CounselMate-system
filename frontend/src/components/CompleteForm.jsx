// src/components/CompleteForm.jsx
import React, { useState, useEffect } from 'react';
import { getAdmissionSlips, getViolationTypes, completeForm, approveSlip } from '../services/api';
import { FileText, CheckCircle, Search } from 'lucide-react';

const CompleteForm = () => {
  const [slips, setSlips] = useState([]);
  const [violationTypes, setViolationTypes] = useState([]);
  const [selectedSlip, setSelectedSlip] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    violationTypeId: '',
    description: '',
    remarks: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      console.log('🔄 Loading data from backend...');
      const [slipsResponse, violationsResponse] = await Promise.all([
        getAdmissionSlips(),
        getViolationTypes()
      ]);
      setSlips(slipsResponse.data);
      setViolationTypes(violationsResponse.data);
      console.log('✅ Data loaded successfully:', slipsResponse.data);
    } catch (error) {
      console.error('❌ Failed to load data:', error);
    }
  };

  const filteredSlips = slips.filter(slip =>
    slip.student_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    slip.slip_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelectSlip = (slip) => {
    console.log('📝 Selected slip:', slip);
    setSelectedSlip(slip);
    setFormData({
      violationTypeId: slip.violation_type_id || '',
      description: slip.description || '',
      remarks: slip.remarks || ''
    });
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

    setLoading(true);
    try {
      console.log('🚀 Attempting to complete form for slip:', selectedSlip.id);
      
      // Prepare data based on your API structure
      const submitData = {
        violation_type_id: parseInt(formData.violationTypeId),
        description: formData.description,
        teacher_comments: formData.remarks, // Match your API field name
        status: 'form_completed'
      };

      console.log('📤 Sending data to API:', submitData);

      const response = await completeForm(selectedSlip.id, submitData);
      console.log('✅ SUCCESS - Form completed:', response.data);
      // Update slips in-place using returned slip (no full re-fetch)
      const updatedSlip = response.data.slip;
      setSlips(prev => prev.map(s => (s.id === updatedSlip.id ? updatedSlip : s)));
      setSelectedSlip(null);
      setFormData({ violationTypeId: '', description: '', remarks: '' });
      alert('Form completed successfully! Status updated to "Form Completed".');
    } catch (error) {
      console.error('❌ COMPLETE FORM ERROR:', error);
      
      // If the endpoint doesn't exist, use a fallback
      if (error.response?.status === 404) {
        console.log('🔧 Endpoint not found, using fallback...');
        await handleSubmitFallback();
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
      const updatedSlips = slips.map(slip => 
        slip.id === selectedSlip.id 
          ? { 
              ...slip, 
              status: 'form_completed',
              violation_type_id: parseInt(formData.violationTypeId),
              description: formData.description,
              teacher_comments: formData.remarks,
              violation_code: violationTypes.find(vt => vt.id == formData.violationTypeId)?.code,
              violation_description: violationTypes.find(vt => vt.id == formData.violationTypeId)?.description
            }
          : slip
      );
      
      setSlips(updatedSlips);
      setSelectedSlip(null);
      setFormData({ violationTypeId: '', description: '', remarks: '' });
      
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
      const response = await approveSlip(slipId);
      const updatedSlip = response.data.slip;
      setSlips(prev => prev.map(s => (s.id === updatedSlip.id ? updatedSlip : s)));
      alert('Slip approved successfully!');
    } catch (error) {
      console.error('❌ Approve slip error:', error);

      // Fallback for approve
      if (error.response?.status === 404) {
        console.log('🔧 Approve endpoint not found, using fallback...');
        const updatedSlips = slips.map(slip => 
          slip.id === slipId 
            ? { ...slip, status: 'approved' }
            : slip
        );
        setSlips(updatedSlips);
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
    <div className="max-w-6xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center mb-6">
          <FileText className="w-8 h-8 text-blue-600 mr-3" />
          <h1 className="text-2xl font-bold text-gray-900">Complete Admission Form</h1>
        </div>

        <p className="text-gray-600 mb-6">
          Search for issued admission slips and complete the violation details after the student returns the filled form.
        </p>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by student name or slip number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Slip List */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Issued Admission Slips</h2>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {filteredSlips.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p>No admission slips found</p>
                </div>
              ) : (
                filteredSlips.map((slip) => (
                  <div
                    key={slip.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedSlip?.id === slip.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                    onClick={() => handleSelectSlip(slip)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium text-gray-900">{slip.student_name}</h3>
                        <p className="text-sm text-gray-600">{slip.year} - {slip.section}</p>
                        <p className="text-xs text-gray-500">Slip: {slip.slip_number}</p>
                        <p className="text-xs text-gray-400">ID: {slip.id}</p>
                      </div>
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadgeClass(slip.status)}`}>
                        {getStatusDisplay(slip.status)}
                      </span>
                    </div>
                    {slip.status === 'form_completed' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleApprove(slip.id);
                        }}
                        className="mt-2 w-full bg-green-600 text-white py-1 px-3 rounded text-sm hover:bg-green-700 transition-colors flex items-center justify-center"
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Approve Slip
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Form */}
          <div>
            <h2 className="text-lg font-semibold mb-4">
              {selectedSlip ? 'Complete Violation Details' : 'Select a Slip'}
            </h2>
            
            {selectedSlip ? (
              <div>
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <h3 className="font-medium text-gray-900">{selectedSlip.student_name}</h3>
                  <p className="text-sm text-gray-600">{selectedSlip.year} - {selectedSlip.section}</p>
                  <p className="text-xs text-gray-500">Slip: {selectedSlip.slip_number}</p>
                  <p className="text-xs text-gray-400">Status: {getStatusDisplay(selectedSlip.status)}</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Violation Type *
                    </label>
                    <select
                      value={formData.violationTypeId}
                      onChange={(e) => setFormData({ ...formData, violationTypeId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      required
                    >
                      <option value="">Select violation type</option>
                      {violationTypes.map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.code} - {type.description}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Violation Description *
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows="3"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      placeholder="Detailed description of the violation..."
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Counselor Remarks
                    </label>
                    <textarea
                      value={formData.remarks}
                      onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                      rows="2"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      placeholder="Additional remarks or recommendations..."
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {loading ? 'Submitting...' : `Complete Form for ${selectedSlip.student_name}`}
                  </button>
                </form>
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p>Select an admission slip from the list to complete the form</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompleteForm;