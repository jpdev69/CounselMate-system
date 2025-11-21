// src/components/SearchRecords.jsx
import React, { useState, useEffect } from 'react';
import { getAdmissionSlips } from '../services/api';
import { Search, Filter, FileText, User, Calendar } from 'lucide-react';

const SearchRecords = () => {
  const [slips, setSlips] = useState([]);
  const [filteredSlips, setFilteredSlips] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');

  useEffect(() => {
    loadSlips();
  }, []);

  useEffect(() => {
    filterSlips();
  }, [slips, searchTerm, statusFilter, dateFilter]);

  const loadSlips = async () => {
    try {
      const response = await getAdmissionSlips();
      setSlips(response.data);
    } catch (error) {
      console.error('Failed to load slips:', error);
    }
  };

  const filterSlips = () => {
    let filtered = slips;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(slip =>
        slip.student_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        slip.slip_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        slip.year?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        slip.section?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(slip => slip.status === statusFilter);
    }

    // Date filter
    if (dateFilter) {
      filtered = filtered.filter(slip => {
        const slipDate = new Date(slip.created_at).toISOString().split('T')[0];
        return slipDate === dateFilter;
      });
    }

    setFilteredSlips(filtered);
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      issued: { color: 'bg-yellow-100 text-yellow-800', label: 'ISSUED' },
      form_completed: { color: 'bg-blue-100 text-blue-800', label: 'FORM COMPLETED' },
      approved: { color: 'bg-green-100 text-green-800', label: 'APPROVED' }
    };

    const config = statusConfig[status] || { color: 'bg-gray-100 text-gray-800', label: status };
    
    return (
      <span className={`px-2 py-1 text-xs rounded-full ${config.color}`}>
        {config.label}
      </span>
    );
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center mb-6">
          <Search className="w-8 h-8 text-blue-600 mr-3" />
          <h1 className="text-2xl font-bold text-gray-900">Search Records</h1>
        </div>

        <p className="text-gray-600 mb-6">
          Search and review historical admission slip records. All actions are logged and can be reviewed at any time.
        </p>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Search className="w-4 h-4 inline mr-1" />
              Search
            </label>
            <input
              type="text"
              placeholder="Search by name, slip number, year, section..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Filter className="w-4 h-4 inline mr-1" />
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            >
              <option value="all">All Status</option>
              <option value="issued">Issued</option>
              <option value="form_completed">Form Completed</option>
              <option value="approved">Approved</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              Date
            </label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
          </div>
        </div>

        {/* Results */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="grid grid-cols-12 gap-4 p-4 bg-gray-50 border-b border-gray-200 text-sm font-medium text-gray-700">
            <div className="col-span-3">Student & Slip Info</div>
            <div className="col-span-2">Violation</div>
            <div className="col-span-3">Details</div>
            <div className="col-span-2">Dates</div>
            <div className="col-span-2">Status</div>
          </div>

          <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
            {filteredSlips.map((slip) => (
              <div key={slip.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="grid grid-cols-12 gap-4 items-center text-sm">
                  <div className="col-span-3">
                    <div className="flex items-center">
                      <User className="w-4 h-4 text-gray-400 mr-2" />
                      <div>
                        <p className="font-medium text-gray-900">{slip.student_name}</p>
                        <p className="text-gray-600 text-xs">{slip.slip_number}</p>
                      </div>
                    </div>
                  </div>

                  <div className="col-span-2">
                    {slip.violation_code ? (
                      <div>
                        <p className="font-medium">{slip.violation_code}</p>
                        <p className="text-gray-600 text-xs truncate">
                          {slip.violation_description}
                        </p>
                      </div>
                    ) : (
                      <span className="text-gray-400">Not specified</span>
                    )}
                  </div>

                  <div className="col-span-3">
                    <p className="text-gray-900">{slip.year} - {slip.section}</p>
                    {slip.description && (
                      <p className="text-gray-600 text-xs truncate">
                        {slip.description}
                      </p>
                    )}
                  </div>

                  <div className="col-span-2">
                    <p className="text-gray-900 text-xs">
                      Issued: {new Date(slip.created_at).toLocaleDateString()}
                    </p>
                    {slip.updated_at && (
                      <p className="text-gray-600 text-xs">
                        Updated: {new Date(slip.updated_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>

                  <div className="col-span-2">
                    {getStatusBadge(slip.status)}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredSlips.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p>No records found matching your search criteria</p>
            </div>
          )}
        </div>

        <div className="mt-4 text-sm text-gray-600">
          <p>Showing {filteredSlips.length} of {slips.length} total records</p>
        </div>
      </div>
    </div>
  );
};

export default SearchRecords;