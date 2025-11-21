// src/components/SearchRecords.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useSlips } from '../contexts/SlipsContext';
import { Search, Filter, FileText, User, Calendar } from 'lucide-react';

const SearchRecords = () => {
  const { slips, loadSlips } = useSlips();
  const [filteredSlips, setFilteredSlips] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');

  useEffect(() => {
    // initial load is done by SlipsProvider; ensure we have data
    if (!slips || slips.length === 0) loadSlips();
  }, []);

  useEffect(() => {
    filterSlips();
  }, [slips, searchTerm, statusFilter, dateFilter]);

  // loadSlips provided by context

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

  // Table ref for resizing calculations
  const tableRef = useRef(null);
  const [colWidths, setColWidths] = useState([28, 14, 16, 14, 10, 10, 8]);
  const sampleViolationDescriptions = [
    "I don't know",
    'Sikka: The student is not acting properly',
    'Neiga'
  ];
  const resizing = useRef({ index: null, startX: 0, startWidths: [] });

  const startResize = (e, index) => {
    e.preventDefault();
    resizing.current = { index, startX: e.clientX, startWidths: [...colWidths] };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', stopResize);
  };

  const onMouseMove = (e) => {
    if (resizing.current.index === null) return;
    const dx = e.clientX - resizing.current.startX;
    const tableWidth = tableRef.current?.getBoundingClientRect().width || 1;
    const deltaPercent = (dx / tableWidth) * 100;
    const newWidths = [...resizing.current.startWidths];
    const i = resizing.current.index;
    const next = i + 1 < newWidths.length ? i + 1 : null;

    newWidths[i] = Math.max(5, Math.min(80, resizing.current.startWidths[i] + deltaPercent));
    if (next !== null) {
      newWidths[next] = Math.max(5, Math.min(80, resizing.current.startWidths[next] - deltaPercent));
    }

    setColWidths(newWidths);
  };

  const stopResize = () => {
    resizing.current = { index: null, startX: 0, startWidths: [] };
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', stopResize);
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

        {/* Results - semantic table with resizable columns */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="records-table-container">
            <table className="records-table" ref={tableRef}>
              <colgroup>
                {colWidths.map((w, i) => (
                  <col key={i} style={{ width: `${w}%` }} />
                ))}
              </colgroup>

              <thead>
                <tr>
                  <th>Student & Slip Info<div className="resizer" onMouseDown={(e) => startResize(e, 0)} aria-hidden="true" /></th>
                  <th>Violation<div className="resizer" onMouseDown={(e) => startResize(e, 1)} aria-hidden="true" /></th>
                  <th>Violation Description<div className="resizer" onMouseDown={(e) => startResize(e, 2)} aria-hidden="true" /></th>
                  <th>Year &amp; Section<div className="resizer" onMouseDown={(e) => startResize(e, 3)} aria-hidden="true" /></th>
                  <th>Date &amp; Time<div className="resizer" onMouseDown={(e) => startResize(e, 3)} aria-hidden="true" /></th>
                  <th>Status<div className="resizer" onMouseDown={(e) => startResize(e, 4)} aria-hidden="true" /></th>
                  <th>Counselor Remarks<div className="resizer" onMouseDown={(e) => startResize(e, 5)} aria-hidden="true" /></th>
                </tr>
              </thead>

              <tbody className="max-h-96 overflow-y-auto">
                {filteredSlips.map((slip) => (
                  <tr key={slip.id}>
                    <td>
                      <div className="flex items-center">
                        <User className="w-4 h-4 text-gray-400 mr-2" />
                        <div>
                          <p className="font-medium text-gray-900">{slip.student_name}</p>
                          <p className="text-gray-600 text-xs">{slip.slip_number}</p>
                        </div>
                      </div>
                    </td>

                    <td>
                      {slip.violation_description ? (
                        <div>
                          <p className="font-medium">{slip.violation_description}</p>
                        </div>
                      ) : (
                        <span className="text-gray-400">Not specified</span>
                      )}
                    </td>

                    <td className="text-xs text-gray-600">
                      {slip.description ? (
                        <p className="text-gray-600 text-xs truncate">{slip.description}</p>
                      ) : (
                        <p className="text-gray-400 text-xs truncate">{sampleViolationDescriptions.join(', ')}</p>
                      )}
                    </td>

                    <td>
                      <p className="text-gray-900">{slip.year} - {slip.section}</p>
                    </td>

                    <td className="text-xs">
                      <p className="text-gray-900">Issued: {slip.created_at ? new Date(slip.created_at).toLocaleString() : '-'}</p>
                      {slip.updated_at && slip.status !== 'issued' && slip.updated_at !== slip.created_at && (
                        <p className="text-gray-600">Updated: {new Date(slip.updated_at).toLocaleString()}</p>
                      )}
                    </td>

                    <td>
                      {getStatusBadge(slip.status)}
                    </td>

                    <td className="text-xs text-gray-600">
                      {slip.teacher_comments || slip.remarks ? (
                        <p className="text-gray-600 text-xs truncate">{slip.teacher_comments || slip.remarks}</p>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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