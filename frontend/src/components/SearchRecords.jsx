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
  const [sortOrder, setSortOrder] = useState('newest');
  const [selectedSlip, setSelectedSlip] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    // initial load is done by SlipsProvider; ensure we have data
    if (!slips || slips.length === 0) loadSlips();
  }, []);

  useEffect(() => {
    filterSlips();
  }, [slips, searchTerm, statusFilter, dateFilter, sortOrder]);

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

    // Sort by date (operate on a shallow copy to avoid mutating context state):
    // - 'newest' should reflect recent updates (use `updated_at` when present, fallback to `created_at`)
    // - 'oldest' should be based on Issued date (`created_at`) only
    filtered = [...filtered].sort((a, b) => {
      const parseTime = (slip, mode) => {
        const dateStr = mode === 'newest' ? (slip.updated_at || slip.created_at) : slip.created_at;
        const t = new Date(dateStr).getTime();
        return Number.isFinite(t) ? t : 0;
      };

      if (sortOrder === 'newest') {
        const tA = parseTime(a, 'newest');
        const tB = parseTime(b, 'newest');
        return tB - tA; // descending (most recent first)
      }

      const tA = parseTime(a, 'oldest');
      const tB = parseTime(b, 'oldest');
      return tA - tB; // ascending (oldest first)
    });

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

  const handleSelectSlip = (slip) => {
    setSelectedSlip(slip);
    setIsModalOpen(true);
  };

  return (
    <div className="container">
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <Search style={{ width: 26, height: 26, color: 'var(--primary)', marginRight: 10 }} />
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>Search Records</h1>
        </div>

        <p className="text-gray-600 mb-6">
          Search and review historical admission slip records. All actions are logged and can be reviewed at any time.
        </p>

        {/* Filters */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '12px', marginBottom: 12, padding: 12, background: 'rgba(15,23,42,0.02)', borderRadius: 8 }}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Search className="w-4 h-4 inline mr-1" />
              Search
            </label>
              <div className="input-with-icon">
                <Search className="icon" />
                <input
                  type="text"
                  placeholder="Search by name, slip number, year, section..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="form-input"
                />
              </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Filter className="w-4 h-4 inline mr-1" />
              Status
            </label>
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
                  <option value="approved">Approved</option>
                </select>
              </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              Date
            </label>
              <div className="input-with-icon">
                <Calendar className="icon" />
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="form-input"
                />
              </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Filter className="w-4 h-4 inline mr-1" />
              Sort By
            </label>
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
        </div>

        {/* Results - semantic table with auto-sizing, edge-to-edge inside card */}
        <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
          <div className="records-table-container" style={{ overflowX: 'auto' }}>
            <div className="records-table-scroll">
              <table className="records-table">
              <thead>
                <tr>
                  <th>Student & Slip Info</th>
                  <th>Status</th>
                  <th>Violation</th>
                  <th>Year &amp; Section</th>
                  <th>Date &amp; Time</th>
                </tr>
              </thead>

              <tbody>
                {filteredSlips.map((slip) => (
                  <tr
                    key={slip.id}
                    onClick={() => handleSelectSlip(slip)}
                    className={selectedSlip?.id === slip.id ? 'bg-blue-50 cursor-pointer' : 'hover:bg-gray-50 cursor-pointer'}
                  >
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
                      {getStatusBadge(slip.status)}
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

                    <td>
                      <p className="text-gray-900">{slip.year} - {slip.section}</p>
                    </td>

                    <td className="text-xs">
                      <p className="text-gray-900">Issued: {slip.created_at ? new Date(slip.created_at).toLocaleString() : '-'}</p>
                      {slip.updated_at && slip.status !== 'issued' && slip.updated_at !== slip.created_at && (
                        <p className="text-gray-600">Updated: {new Date(slip.updated_at).toLocaleString()}</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          </div>

          {isModalOpen && selectedSlip && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.45)', padding: '1rem' }}>
              <div className="card" style={{ width: '100%', maxWidth: '760px', maxHeight: '90vh', overflowY: 'auto', padding: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>{selectedSlip.student_name}</h3>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px' }}>
                      <span className="text-xs text-gray-500">{selectedSlip.slip_number}</span>
                      <span className="text-xs text-gray-500">•</span>
                      <span className="text-xs text-gray-500">{selectedSlip.year} - {selectedSlip.section}</span>
                    </div>
                  </div>
                  <div>
                    <button onClick={() => { setIsModalOpen(false); setSelectedSlip(null); }} className="btn btn-ghost" style={{ padding: '6px 12px' }}>Close</button>
                  </div>
                </div>

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
                    <div style={{ fontSize: '0.95rem', color: '#111827', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{selectedSlip.teacher_comments || selectedSlip.remarks || '-'}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {filteredSlips.length === 0 && (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>
              <FileText style={{ width: 48, height: 48, margin: '0 auto 12px', color: 'rgba(15,23,42,0.25)' }} />
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