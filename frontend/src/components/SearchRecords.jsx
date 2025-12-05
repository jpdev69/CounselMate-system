// src/components/SearchRecords.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useSlips } from '../contexts/SlipsContext';
import { getStudentAdmissionSlips } from '../services/api';
import api from '../services/api';
import * as XLSX from 'xlsx';
import { Search, FileText, User, Calendar, CheckCircle } from 'lucide-react';

const SearchRecords = () => {
  const { slips, loadSlips, approveSlip: approveSlipApi, updateSlipInState } = useSlips();
  const [filteredSlips, setFilteredSlips] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [sortOrder, setSortOrder] = useState('newest');
  const [numberSort, setNumberSort] = useState('highest');
  const [selectedSlip, setSelectedSlip] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [groupViewStudent, setGroupViewStudent] = useState(null);
  const [groupSlips, setGroupSlips] = useState([]);
  const [groupPage, setGroupPage] = useState(1);
  const [groupPageSize] = useState(3);
  const [groupTotal, setGroupTotal] = useState(0);
  const [groupLoading, setGroupLoading] = useState(false);
  const [groupFetchedAll, setGroupFetchedAll] = useState(false);
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

  // Fetch current group page when group view student, page, pageSize, sort order, or status filter changes
  useEffect(() => {
    let mounted = true;
    const fetchPage = async () => {
      if (!groupViewStudent) return;
      setGroupLoading(true);
      try {
        const params = { sort: groupSortOrder };
        if (groupStatusFilter !== 'all') params.status = groupStatusFilter;
        const resp = await getStudentAdmissionSlips(groupViewStudent.id, groupPage, groupPageSize, params);
        if (!mounted) return;
        if (resp.data?.success) {
          setGroupSlips(resp.data.slips || []);
          setGroupTotal(resp.data.total || 0);
        }
      } catch (e) {
        console.error('Failed to load group slips:', e);
        setGroupSlips([]);
        setGroupTotal(0);
      } finally {
        if (mounted) setGroupLoading(false);
      }
    };
    fetchPage();
    return () => { mounted = false; };
  }, [groupViewStudent, groupPage, groupPageSize, groupSortOrder, groupStatusFilter]);

  // If a client-side filter is applied and the student has more slips than the page size, fetch all slips so client-side filtering can operate across the whole set
  useEffect(() => {
    let mounted = true;
      // Only fetch all slips when client-side searchable filters are applied; use server-side pagination for status-only filters
      const shouldFetchAll = !!groupViewStudent && (groupSearchTerm || groupDateFilter || groupSortOrder !== 'newest') && (groupTotal > groupPageSize) && !groupFetchedAll;
    if (!shouldFetchAll) return;
    (async () => {
      setGroupLoading(true);
      try {
        const params = { sort: groupSortOrder };
        if (groupStatusFilter !== 'all') params.status = groupStatusFilter;
        const resp = await getStudentAdmissionSlips(groupViewStudent.id, 1, groupTotal || 1000, params);
        if (!mounted) return;
        if (resp.data?.success) {
          setGroupSlips(resp.data.slips || []);
          setGroupFetchedAll(true);
        }
      } catch (e) {
        console.error('Failed to fetch all group slips for filtering:', e);
      } finally {
        if (mounted) setGroupLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [groupSearchTerm, groupStatusFilter, groupDateFilter, groupSortOrder, groupViewStudent, groupTotal, groupFetchedAll, groupPageSize]);

  // Reset to first page when any group filter changes to keep pagination stable and predictable
  useEffect(() => {
    if (!groupViewStudent) return;
    setGroupPage(1);
    setGroupFetchedAll(false);
  }, [groupSearchTerm, groupStatusFilter, groupDateFilter, groupSortOrder, groupViewStudent]);

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
  });

  // Apply optional sorting by number of records (highest/lowest). If not requested, sort by most recent slip.
  if (numberSort === 'highest') {
    groupedList.sort((a, b) => b.count - a.count);
  } else if (numberSort === 'lowest') {
    groupedList.sort((a, b) => a.count - b.count);
  } else {
    groupedList.sort((a,b) => b.latest && a.latest ? new Date(b.latest.created_at).getTime() - new Date(a.latest.created_at).getTime() : 0);
  }

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

  // Count of approved slips in current filtered results
  const approvedCount = filteredSlips.filter(s => s.status === 'approved').length;

  const exportApprovedToXLSX = () => {
    const approved = filteredSlips.filter(s => s.status === 'approved');
    if (!approved || approved.length === 0) {
      alert('No APPROVED records to export');
      return;
    }

    // Map slips to a flat JSON structure suitable for XLSX
    const rows = approved.map(s => ({
      SlipNumber: s.slip_number || '',
      StudentName: s.student_name || '',
      StudentId: s.student_id || '',
      Year: s.year || '',
      Section: s.section || '',
      Status: (s.status || '').toString().toUpperCase(),
      DateIssued: s.created_at || '',
      LastUpdated: s.updated_at || '',
      Violation: s.violation_description || '',
      Description: s.description || '',
      CounselorRemarks: s.teacher_comments || s.remarks || ''
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Approved Slips');
    XLSX.writeFile(wb, `approved_slips_${new Date().toISOString().slice(0,10)}.xlsx`);
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
        

        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Search style={{ width: 26, height: 26, color: 'var(--primary)', marginRight: 10 }} />
            <h1 style={{ fontSize: 20, fontWeight: 700 }}>Search Records</h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 13, color: '#374151' }}>Sort by Records:</label>
            <select value={numberSort} onChange={(e) => setNumberSort(e.target.value)} className="form-input">
              <option value="highest">Highest</option>
              <option value="lowest">Lowest</option>
              <option value="most_recent">Most recent</option>
            </select>
          </div>
        </div>

        

        {/* Results - semantic table with auto-sizing, edge-to-edge inside card */}
        <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
          <div className="records-table-container" style={{ overflowX: 'auto' }}>
            <div className="records-table-scroll">
              <table className="records-table">
              <thead>
                <tr>
                  <th>Student Name</th>
                  <th style={{ width: 140, textAlign: 'center' }}>Number of Records</th>
                </tr>
              </thead>

              <tbody>
                {groupedList.length === 0 ? (
                  <tr>
                    <td colSpan={2} style={{ textAlign: 'center', padding: 20 }}>
                      <span className="text-gray-600">No records found</span>
                    </td>
                  </tr>
                ) : (
                  groupedList.map(group => (
                    <tr
                      key={group.key}
                      onClick={() => {
                        // Open group modal and load first page
                        setGroupViewStudent({ id: group.student_id, name: group.student_name });
                        setGroupPage(1);
                        setGroupFetchedAll(false);
                        setGroupLoading(true);
                        (() => {
                          const params = { sort: groupSortOrder };
                          if (groupStatusFilter !== 'all') params.status = groupStatusFilter;
                          return getStudentAdmissionSlips(group.student_id, 1, groupPageSize, params);
                        })()
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
                            <div style={{ width: 36, height: 36, borderRadius: 9999, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                              <User style={{ width: 16, height: 16, color: '#6b7280' }} />
                            </div>
                            <div>
                              <h3 className="font-medium text-gray-900">{group.student_name}</h3>
                            </div>
                          </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="text-gray-700 font-medium">{group.count}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              </table>
            </div>
          </div>

          {isModalOpen && selectedSlip && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.45)', padding: '1rem' }}>
              <div className="card" style={{ width: '100%', maxWidth: '760px', maxHeight: '90vh', overflowY: 'auto', padding: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>{selectedSlip.student_name}</h3>
                    <div style={{ marginTop: 8, color: '#6b7280', fontSize: 13 }}>
                      <span style={{ marginRight: 8 }}>{selectedSlip.slip_number}</span>
                      <span style={{ marginRight: 8 }}>{[selectedSlip.year, selectedSlip.section].filter(Boolean).join(' ')}</span>
                      {/* course removed from header as requested */}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ marginBottom: 6 }}>
                        <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadgeClass(selectedSlip.status)}`}>
                          {getStatusDisplay(selectedSlip.status)}
                        </span>
                      </div>
                      <button
                        onClick={() => { setIsModalOpen(false); setSelectedSlip(null); }}
                        className="btn"
                        style={{
                          padding: '6px 12px',
                          background: 'transparent',
                          border: '1px solid var(--primary)',
                          color: 'var(--primary)',
                          borderRadius: 6
                        }}
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>

                {/* Improved details layout: label / value pairs */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 8, alignItems: 'start' }}>
                    <div style={{ fontSize: '0.85rem', color: '#374151', fontWeight: 600 }}>Date Issued</div>
                    <div style={{ fontSize: '0.95rem', color: '#111827' }}>{selectedSlip.created_at ? new Date(selectedSlip.created_at).toLocaleString() : '-'}</div>

                    <div style={{ fontSize: '0.85rem', color: '#374151', fontWeight: 600 }}>Last Updated</div>
                    <div style={{ fontSize: '0.95rem', color: '#111827' }}>{(selectedSlip.updated_at && selectedSlip.updated_at !== selectedSlip.created_at) ? new Date(selectedSlip.updated_at).toLocaleString() : '-'}</div>


                    <div style={{ fontSize: '0.85rem', color: '#374151', fontWeight: 600 }}>Year &amp; Section</div>
                    <div style={{ fontSize: '0.95rem', color: '#111827' }}>{[selectedSlip.year, selectedSlip.section].filter(Boolean).join(' ') || '-'}</div>

                    <div style={{ fontSize: '0.85rem', color: '#374151', fontWeight: 600 }}>Violation</div>
                    <div style={{ fontSize: '0.95rem', color: '#111827', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{selectedSlip.violation_description || 'No violation specified'}</div>

                    <div style={{ fontSize: '0.85rem', color: '#374151', fontWeight: 600 }}>Description</div>
                    <div style={{ fontSize: '0.95rem', color: '#111827', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{selectedSlip.description || '-'}</div>

                    <div style={{ fontSize: '0.85rem', color: '#374151', fontWeight: 600 }}>Counselor Remarks</div>
                    <div style={{ fontSize: '0.95rem', color: '#111827', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{selectedSlip.teacher_comments || selectedSlip.remarks || '-'}</div>

                    {/* course row removed as requested */}
                  </div>
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
                            onChange={(e) => setGroupSearchTerm((e.target.value || '').toString().slice(0, 32))}
                            maxLength={32}
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

                        // If we've fetched all slips for this student, apply pagination client-side
                        const applyClientPagination = groupFetchedAll;

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

                        // If client-side pagination is active, slice the list for the current page
                        if (applyClientPagination) {
                          const start = (groupPage - 1) * groupPageSize;
                          list = list.slice(start, start + groupPageSize);
                        }

                        return list.map(s => (
                          <li key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #e6edf3' }}>
                            <div>
                              <div style={{ fontWeight: 600 }}>{s.slip_number}</div>
                              <div style={{ fontSize: 13, color: '#6b7280' }}>{s.violation_description || 'No violation specified'}</div>
                              <div style={{ fontSize: 12, color: '#6b7280' }}>{s.created_at ? new Date(s.created_at).toLocaleString() : '-'}</div>
                            </div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              {/* Slip status badge displayed beside the View button */}
                              <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                                <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadgeClass(s.status)}`} title={`Status: ${getStatusDisplay(s.status)}`}>
                                  {getStatusDisplay(s.status)}
                                </span>
                              </span>
                              <button className="btn btn-primary" onClick={() => { handleSelectSlip(s); }}>View</button>
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
                            // If we've already fetched all slips, perform client-side pagination only
                            if (groupFetchedAll) return;
                            setGroupLoading(true);
                            try {
                              const params = { sort: groupSortOrder };
                              if (groupStatusFilter !== 'all') params.status = groupStatusFilter;
                              const resp = await getStudentAdmissionSlips(groupViewStudent.id, p, groupPageSize, params);
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
          <p>
            Showing {groupedList.length} existing student{groupedList.length !== 1 ? 's' : ''} of {slips.length} total records
          </p>
        </div>
        {/* Floating Export button (bottom-right) */}
        <div style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 1000 }}>
          <button
            onClick={exportApprovedToXLSX}
            className="btn btn-primary"
            disabled={approvedCount === 0}
            title={approvedCount === 0 ? 'No approved records to export' : `Export ${approvedCount} approved record${approvedCount!==1?'s':''} to XLSX`}
            style={{ padding: '10px 14px', borderRadius: 8, boxShadow: '0 6px 18px rgba(15,23,42,0.12)', display: 'flex', alignItems: 'center', gap: 8 }}
          >
            Export to XLSX
            {approvedCount > 0 && (
              <span style={{ background: 'rgba(255,255,255,0.12)', padding: '2px 8px', borderRadius: 9999, fontSize: 12 }}>{approvedCount}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SearchRecords;