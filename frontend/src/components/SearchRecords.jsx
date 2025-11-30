// src/components/SearchRecords.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useSlips } from '../contexts/SlipsContext';
import { getStudentAdmissionSlips } from '../services/api';
import api from '../services/api';
import { Search, Filter, FileText, User, Calendar, CheckCircle } from 'lucide-react';

const SearchRecords = () => {
  const { slips, loadSlips, approveSlip: approveSlipApi, updateSlipInState } = useSlips();
  const [filteredSlips, setFilteredSlips] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [sortOrder, setSortOrder] = useState('newest');
  const [selectedSlip, setSelectedSlip] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showFiltersPopup, setShowFiltersPopup] = useState(false);
  const [groupViewStudent, setGroupViewStudent] = useState(null);
  const [groupSlips, setGroupSlips] = useState([]);
  const [groupPage, setGroupPage] = useState(1);
  const [groupPageSize] = useState(5);
  const [groupTotal, setGroupTotal] = useState(0);
  const [groupLoading, setGroupLoading] = useState(false);
  const [groupSearchTerm, setGroupSearchTerm] = useState('');
  const [groupStatusFilter, setGroupStatusFilter] = useState('all');
  const [groupDateFilter, setGroupDateFilter] = useState('');
  const [groupSortOrder, setGroupSortOrder] = useState('newest');

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

  // Group slips by student (prefer student_id if available, otherwise student_name)
  const grouped = filteredSlips.reduce((acc, slip) => {
    const key = slip.student_id ? `id:${slip.student_id}` : `name:${(slip.student_name||'').toLowerCase()}`;
    if (!acc[key]) acc[key] = { key, student_id: slip.student_id, student_name: slip.student_name, slips: [] };
    acc[key].slips.push(slip);
    return acc;
  }, {});

  const groupedList = Object.values(grouped).map(g => {
    const sorted = g.slips.slice().sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const latest = sorted[0];
    return {
      key: g.key,
      student_id: g.student_id,
      student_name: g.student_name,
      count: g.slips.length,
      latest,
      slips: sorted
    };
  }).sort((a,b) => b.latest && a.latest ? new Date(b.latest.created_at).getTime() - new Date(a.latest.created_at).getTime() : 0);

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

  const getStatusDisplay = (status) => {
    const statusMap = {
      issued: 'ISSUED',
      form_completed: 'FORM COMPLETED',
      approved: 'APPROVED'
    };
    return statusMap[status] || (status || '').toString().toUpperCase();
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'issued': return 'bg-yellow-100 text-yellow-800';
      case 'form_completed': return 'bg-blue-100 text-blue-800';
      case 'approved': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleApprove = async (slipId) => {
    if (!confirm('Are you sure you want to approve this slip?')) return;
    try {
      const resp = await approveSlipApi(slipId);
      setIsModalOpen(false);
      setSelectedSlip(null);
      alert('Slip approved successfully!');
    } catch (err) {
      console.error('Approve error:', err);
      if (err.response?.status === 404) {
        const updatedSlip = { ...(slips.find(s => s.id === slipId) || {}), status: 'approved' };
        if (updateSlipInState) updateSlipInState(updatedSlip);
        setIsModalOpen(false);
        setSelectedSlip(null);
        alert('Slip approved (local update)');
      } else {
        alert(err.response?.data?.error || 'Failed to approve slip');
      }
    }
  };

  const handleSelectSlip = (slip) => {
    setSelectedSlip(slip);
    setIsModalOpen(true);
  };

  const location = useLocation();

  // If a slipId is provided in the URL, open that slip's details/modal
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const slipId = params.get('slipId');
    if (slipId && slips && slips.length) {
      const found = slips.find(s => String(s.id) === String(slipId));
      if (found && (!selectedSlip || selectedSlip.id !== found.id)) {
        setSelectedSlip(found);
        setIsModalOpen(true);
      }
    }
  }, [location.search, slips]);

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

        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Search style={{ width: 26, height: 26, color: 'var(--primary)', marginRight: 10 }} />
            <h1 style={{ fontSize: 20, fontWeight: 700 }}>Search Records</h1>
          </div>

          <div>
            <button onClick={() => setShowFiltersPopup(true)} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Filter style={{ width: 16, height: 16 }} />
              Filters
            </button>
          </div>
        </div>

        {/* Filters Pop-up */}
        {showFiltersPopup && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.45)', padding: '1rem' }}>
            <div className="card" style={{ width: '100%', maxWidth: '720px', maxHeight: '90vh', overflowY: 'auto', padding: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Filters</h3>
                  <div style={{ fontSize: 13, color: '#6b7280', marginTop: 6 }}>Refine your search results</div>
                </div>
                <div>
                  <button onClick={() => setShowFiltersPopup(false)} className="btn btn-ghost" style={{ padding: '6px 12px' }}>Close</button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '12px', marginBottom: 12 }}>
                <div>
                    <div>
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
                    <div>
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
                    <div>
                      <input
                        type="date"
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                        className="form-input"
                      />
                    </div>
                </div>

                <div>
                    <div>
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

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button onClick={() => { setSearchTerm(''); setStatusFilter('all'); setDateFilter(''); setSortOrder('newest'); }} className="btn btn-outline">Reset</button>
                <button onClick={() => setShowFiltersPopup(false)} className="btn btn-primary">Apply</button>
              </div>
            </div>
          </div>
        )}

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
                {groupedList.length === 0 ? (
                  filteredSlips.map((slip) => (
                    <tr
                      key={slip.id}
                      onClick={() => handleSelectSlip(slip)}
                      className={selectedSlip?.id === slip.id ? 'bg-blue-50 cursor-pointer' : 'hover:bg-gray-50 cursor-pointer'}
                    >
                      <td>
                        <div className="flex items-center">
                          <User className="w-4 h-4 text-gray-400 mr-2" />
                          <div>
                            <h3 className="font-medium text-gray-900">{slip.student_name}</h3>
                            <p className="text-xs text-gray-500">{slip.slip_number}</p>
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
                  ))
                ) : (
                  groupedList.map(group => (
                    <tr
                      key={group.key}
                      onClick={() => {
                        // Open group modal and load first page
                        setGroupViewStudent({ id: group.student_id, name: group.student_name });
                        setGroupPage(1);
                        setGroupLoading(true);
                        getStudentAdmissionSlips(group.student_id, 1, groupPageSize)
                          .then(resp => {
                            if (resp.data?.success) {
                              setGroupSlips(resp.data.slips || []);
                              setGroupTotal(resp.data.total || 0);
                            } else {
                              setGroupSlips([]);
                              setGroupTotal(0);
                            }
                          })
                          .catch(err => {
                            console.error('Failed to load group slips:', err);
                            setGroupSlips([]);
                            setGroupTotal(0);
                          })
                          .finally(() => setGroupLoading(false));
                      }}
                      className={'hover:bg-gray-50 cursor-pointer'}
                    >
                      <td>
                        <div className="flex items-center">
                          <User className="w-4 h-4 text-gray-400 mr-2" />
                          <div>
                            <h3 className="font-medium text-gray-900">{group.student_name}</h3>
                            <p className="text-xs text-gray-500">{group.latest?.slip_number} • {group.count} record{group.count>1?'s':''}</p>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadgeClass(group.latest?.status)}`}>
                          {getStatusDisplay(group.latest?.status)}
                        </span>
                      </td>

                      <td>
                        {group.latest?.violation_description ? (
                          <div>
                            <p className="font-medium">{group.latest.violation_description}</p>
                          </div>
                        ) : (
                          <span className="text-gray-400">Not specified</span>
                        )}
                      </td>

                      <td>
                        <p className="text-gray-900">{group.latest?.year} - {group.latest?.section}</p>
                      </td>

                      <td className="text-xs">
                        <p className="text-gray-900">Issued: {group.latest?.created_at ? new Date(group.latest.created_at).toLocaleString() : '-'}</p>
                        {group.latest?.updated_at && group.latest?.status !== 'issued' && group.latest?.updated_at !== group.latest?.created_at && (
                          <p className="text-gray-600">Updated: {new Date(group.latest.updated_at).toLocaleString()}</p>
                        )}
                      </td>
                    </tr>
                  ))
                )}
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
                      {selectedSlip.course && (
                        <>
                          <span className="text-xs text-gray-500">•</span>
                          <span className="text-xs text-gray-500">{selectedSlip.course}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadgeClass(selectedSlip.status)}`}>
                      {getStatusDisplay(selectedSlip.status)}
                    </span>
                    <button onClick={() => { setIsModalOpen(false); setSelectedSlip(null); }} className="btn btn-ghost" style={{ padding: '6px 12px' }}>Close</button>
                  </div>
                </div>

                {/* Meta rows */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                  <div>
                    <div style={{ fontSize: '0.85rem', color: '#374151', fontWeight: 600 }}>Date &amp; Time</div>
                    <div style={{ fontSize: '0.95rem', color: '#111827', marginTop: '4px' }}>{selectedSlip.created_at ? new Date(selectedSlip.created_at).toLocaleString() : '-'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.85rem', color: '#374151', fontWeight: 600 }}>Last Updated</div>
                    <div style={{ fontSize: '0.95rem', color: '#111827', marginTop: '4px' }}>{(selectedSlip.updated_at && selectedSlip.updated_at !== selectedSlip.created_at) ? new Date(selectedSlip.updated_at).toLocaleString() : '-'}</div>
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

                  <div>
                    <div style={{ fontSize: '0.85rem', color: '#374151', fontWeight: 600, marginBottom: '6px' }}>Course</div>
                    <div style={{ fontSize: '0.95rem', color: '#111827', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{selectedSlip.course || '-'}</div>
                  </div>
                  {/* Buttons removed per design: modal is read-only text-only */}
                </div>
              </div>
            </div>
          )}

          {/* Group view modal */}
          {groupViewStudent && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.45)', padding: '1rem' }}>
              <div className="card" style={{ width: '100%', maxWidth: '820px', maxHeight: '80vh', overflowY: 'auto', padding: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>{groupViewStudent.name}</h3>
                    <div style={{ fontSize: 13, color: '#6b7280' }}>{groupTotal} record{groupTotal>1?'s':''}</div>
                  </div>
                  <div>
                    <button onClick={() => setGroupViewStudent(null)} className="btn btn-ghost">Close</button>
                  </div>
                </div>

                {groupLoading ? (
                  <div style={{ fontSize: 13, color: '#6b7280' }}>Loading slips…</div>
                ) : groupSlips.length === 0 ? (
                  <div style={{ fontSize: 13, color: '#6b7280' }}>No slips found for this student.</div>
                ) : (
                  <div>
                    {/* Group filters (client-side) */}
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '12px', marginBottom: 12 }}>
                      <div>
                        <input
                          type="text"
                          placeholder="Search within student slips..."
                          value={groupSearchTerm}
                          onChange={(e) => setGroupSearchTerm(e.target.value)}
                          className="form-input"
                        />
                      </div>

                      <div>
                        <select value={groupStatusFilter} onChange={(e) => setGroupStatusFilter(e.target.value)} className="form-input">
                          <option value="all">All Status</option>
                          <option value="issued">Issued</option>
                          <option value="form_completed">Form Completed</option>
                          <option value="approved">Approved</option>
                        </select>
                      </div>

                      <div>
                        <input type="date" value={groupDateFilter} onChange={(e) => setGroupDateFilter(e.target.value)} className="form-input" />
                      </div>

                      <div>
                        <select value={groupSortOrder} onChange={(e) => setGroupSortOrder(e.target.value)} className="form-input">
                          <option value="newest">Most Recently Updated</option>
                          <option value="oldest">Oldest Issued</option>
                        </select>
                      </div>
                    </div>

                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {(() => {
                        // Apply client-side filtering and sorting to groupSlips
                        let list = (groupSlips || []).slice();

                        if (groupSearchTerm) {
                          const q = groupSearchTerm.toLowerCase();
                          list = list.filter(s => (s.slip_number || '').toLowerCase().includes(q) || (s.violation_description || '').toLowerCase().includes(q) || (s.description || '').toLowerCase().includes(q));
                        }

                        if (groupStatusFilter !== 'all') {
                          list = list.filter(s => s.status === groupStatusFilter);
                        }

                        if (groupDateFilter) {
                          list = list.filter(s => {
                            const slipDate = new Date(s.created_at).toISOString().split('T')[0];
                            return slipDate === groupDateFilter;
                          });
                        }

                        list = list.sort((a, b) => {
                          const tA = new Date(groupSortOrder === 'newest' ? (a.updated_at || a.created_at) : a.created_at).getTime() || 0;
                          const tB = new Date(groupSortOrder === 'newest' ? (b.updated_at || b.created_at) : b.created_at).getTime() || 0;
                          return groupSortOrder === 'newest' ? tB - tA : tA - tB;
                        });

                        return list.map(s => (
                          <li key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #e6edf3' }}>
                            <div>
                              <div style={{ fontWeight: 600 }}>{s.slip_number}</div>
                              <div style={{ fontSize: 13, color: '#6b7280' }}>{s.violation_description || 'No violation specified'}</div>
                              <div style={{ fontSize: 12, color: '#6b7280' }}>{s.created_at ? new Date(s.created_at).toLocaleString() : '-'}</div>
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button className="btn btn-secondary" onClick={() => {
                                const base = api.defaults?.baseURL || 'http://localhost:5000/api';
                                const url = `${base.replace(/\/$/, '')}/admission-slips/print-slip?slip_id=${encodeURIComponent(s.id)}`;
                                window.open(url, '_blank');
                              }}>Print</button>
                              <button className="btn btn-primary" onClick={() => { setGroupViewStudent(null); handleSelectSlip(s); }}>View</button>
                            </div>
                          </li>
                        ));
                      })()}
                    </ul>

                    <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {(() => {
                        const totalPages = Math.max(1, Math.ceil((groupTotal || 0) / groupPageSize));
                        const pages = [];
                        for (let i = 1; i <= totalPages; i++) pages.push(i);
                        return pages.map(p => (
                          <button key={p} onClick={async () => {
                            if (p === groupPage) return;
                            setGroupPage(p);
                            setGroupLoading(true);
                            try {
                              const resp = await getStudentAdmissionSlips(groupViewStudent.id, p, groupPageSize);
                              if (resp.data?.success) {
                                setGroupSlips(resp.data.slips || []);
                                setGroupTotal(resp.data.total || 0);
                              }
                            } catch (e) {
                              console.error('Failed to load page:', e);
                            } finally {
                              setGroupLoading(false);
                            }
                          }} className={`btn ${p === groupPage ? 'btn-primary' : 'btn-outline'}`} style={{ padding: '6px 10px' }}>{p}</button>
                        ));
                      })()}
                    </div>
                  </div>
                )}
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
          <p>Showing {groupedList.length} grouped students ({filteredSlips.length} slips) of {slips.length} total records</p>
        </div>
      </div>
    </div>
  );
};

export default SearchRecords;