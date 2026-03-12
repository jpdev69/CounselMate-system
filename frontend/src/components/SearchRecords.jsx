// src/components/SearchRecords.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useSlips } from '../contexts/SlipsContext';
import { getStudentAdmissionSlips, getStudentReports, resolveStudentReport, deleteStudentReport } from '../services/api';
import api from '../services/api';
import * as XLSX from 'xlsx';
import { Search, FileText, User, Calendar, CheckCircle, Trash2 } from 'lucide-react';
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
          <span className="arr-up" style={{ opacity: active && sortDir === 'asc' ? 1 : 0.3 }} />
          <span className="arr-down" style={{ opacity: active && sortDir === 'desc' ? 1 : 0.3 }} />
        </span>
      </button>
    </th>
  );
};

const SearchRecords = () => {
  const { slips, loadSlips, approveSlip: approveSlipApi, updateSlipInState } = useSlips();
  const [filteredSlips, setFilteredSlips] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [sortOrder, setSortOrder] = useState('newest');
  const numberSort = 'highest';
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
  const [groupStartDate, setGroupStartDate] = useState('');
  const [groupEndDate, setGroupEndDate] = useState('');

  // Column sort state for the student list table
  const [sortCol, setSortCol] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const handleColSort = (col) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  // Student reports (violation reports, no admission slip)
  const [allReports, setAllReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const resp = await getStudentReports();
        setAllReports(resp.data || []);
      } catch (e) {
        console.error('Failed to load student reports:', e);
      }
    })();
  }, []);

  useEffect(() => {
    // initial load is done by SlipsProvider; ensure we have data
    if (!slips || slips.length === 0) loadSlips();
  }, []);

  useEffect(() => {
    filterSlips();
  }, [slips, searchTerm, statusFilter, dateFilter, sortOrder]);

  // Fetch current group page when group view student, page, pageSize, or status filter changes
  useEffect(() => {
    let mounted = true;
    const fetchPage = async () => {
      if (!groupViewStudent) return;
      // When all records are already loaded (client-side pagination active), skip the
      // server fetch — it would overwrite the complete list with a single page's worth
      // of data, making every page after the first appear empty.
      if (groupFetchedAll) return;
      setGroupLoading(true);
      try {
        const params = { sort: 'newest' };
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
  }, [groupViewStudent, groupPage, groupPageSize, groupStatusFilter, groupFetchedAll]);

  // If a client-side filter is applied and the student has more slips than the page size, fetch all slips so client-side filtering can operate across the whole set
  useEffect(() => {
    let mounted = true;
    // Only fetch all slips when client-side searchable filters are applied; use server-side pagination for status-only filters
    const shouldFetchAll = !!groupViewStudent && (groupSearchTerm || groupStartDate || groupEndDate) && (groupTotal > groupPageSize) && !groupFetchedAll;
    if (!shouldFetchAll) return;
    (async () => {
      setGroupLoading(true);
      try {
        const params = { sort: 'newest' };
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
  }, [groupSearchTerm, groupStatusFilter, groupStartDate, groupEndDate, groupViewStudent, groupTotal, groupFetchedAll, groupPageSize]);

  // Reset to first page when any group filter changes to keep pagination stable and predictable
  useEffect(() => {
    if (!groupViewStudent) return;
    setGroupPage(1);
    setGroupFetchedAll(false);
  }, [groupSearchTerm, groupStatusFilter, groupStartDate, groupEndDate, groupViewStudent]);

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
    const key = slip.student_id ? `id:${slip.student_id}` : `name:${(slip.student_name || '').toLowerCase()}`;
    if (!acc[key]) acc[key] = { key, student_id: slip.student_id, student_name: slip.student_name, slips: [] };
    acc[key].slips.push(slip);
    return acc;
  }, {});

  const groupedList = Object.values(grouped).map(g => {
    const sorted = g.slips.slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
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
    groupedList.sort((a, b) => b.latest && a.latest ? new Date(b.latest.created_at).getTime() - new Date(a.latest.created_at).getTime() : 0);
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

  const handleResolveReport = async (reportId) => {
    if (!confirm('Mark this report as resolved?')) return;
    try {
      await resolveStudentReport(reportId, {});
      setAllReports(prev => prev.map(r => r.id === reportId ? { ...r, status: 'resolved' } : r));
      setIsReportModalOpen(false);
      setSelectedReport(null);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to resolve report');
    }
  };

  const handleDeleteReport = async (reportId) => {
    if (!confirm('Are you sure you want to delete this report? This cannot be undone.')) return;
    try {
      await deleteStudentReport(reportId);
      setAllReports(prev => prev.filter(r => r.id !== reportId));
      setIsReportModalOpen(false);
      setSelectedReport(null);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete report');
    }
  };

  // Count of approved slips and resolved reports in current filtered results
  const approvedCount = filteredSlips.filter(s => s.status === 'approved').length;
  const resolvedReportsCount = allReports.filter(r => r.status === 'resolved').length;
  const exportableCount = approvedCount + resolvedReportsCount;

  const exportApprovedToXLSX = () => {
    const approved = filteredSlips.filter(s => s.status === 'approved');
    const resolved = allReports.filter(r => r.status === 'resolved');

    if (approved.length === 0 && resolved.length === 0) {
      alert('No APPROVED slips or RESOLVED reports to export');
      return;
    }

    const wb = XLSX.utils.book_new();

    // Sheet 1 – Approved Admission Slips
    if (approved.length > 0) {
      const slipRows = approved.map(s => ({
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
      const ws1 = XLSX.utils.json_to_sheet(slipRows);
      XLSX.utils.book_append_sheet(wb, ws1, 'Approved Slips');
    }

    // Sheet 2 – Resolved Violation Reports
    if (resolved.length > 0) {
      const reportRows = resolved.map(r => ({
        StudentName: r.student_name || '',
        StudentId: r.student_id || '',
        Course: r.course || '',
        Year: r.year || '',
        Section: r.section || '',
        ViolationCategory: (r.violation_category || '').toUpperCase(),
        ViolationType: r.violation_description || '',
        Description: r.description || '',
        CounselorRemarks: r.remarks || '',
        Status: (r.status || '').toString().toUpperCase(),
        DateReported: r.created_at || '',
        LastUpdated: r.updated_at || ''
      }));
      const ws2 = XLSX.utils.json_to_sheet(reportRows);
      XLSX.utils.book_append_sheet(wb, ws2, 'Resolved Reports');
    }

    XLSX.writeFile(wb, `records_export_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const location = useLocation();

  // Merge student reports into the student groupings so both admission slips
  // and violation reports appear together in Search Records.
  const reportSearchFiltered = allReports.filter(r =>
    !searchTerm || (r.student_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );
  const reportGrouped = reportSearchFiltered.reduce((acc, r) => {
    const key = r.student_id ? `id:${r.student_id}` : `name:${(r.student_name || '').toLowerCase()}`;
    if (!acc[key]) acc[key] = { key, student_id: r.student_id, student_name: r.student_name, reports: [] };
    acc[key].reports.push(r);
    return acc;
  }, {});

  // Build merged list: slip groups enriched with their reports, plus report-only students
  const mergedGroupsMap = {};
  groupedList.forEach(g => {
    mergedGroupsMap[g.key] = { ...g, reports: reportGrouped[g.key]?.reports || [] };
  });
  Object.values(reportGrouped).forEach(rg => {
    if (!mergedGroupsMap[rg.key]) {
      mergedGroupsMap[rg.key] = {
        key: rg.key, student_id: rg.student_id, student_name: rg.student_name,
        count: 0, latest: null, slips: [], reports: rg.reports
      };
    }
  });
  const mergedGroupedList = Object.values(mergedGroupsMap);
  // Column-click sort takes precedence; fall back to numberSort dropdown
  if (sortCol === 'count') {
    const dir = sortDir === 'asc' ? 1 : -1;
    mergedGroupedList.sort((a, b) => dir * ((a.count + a.reports.length) - (b.count + b.reports.length)));
  } else if (sortCol === 'name') {
    const dir = sortDir === 'asc' ? 1 : -1;
    mergedGroupedList.sort((a, b) => dir * (a.student_name || '').localeCompare(b.student_name || ''));
  } else if (numberSort === 'highest') {
    mergedGroupedList.sort((a, b) => (b.count + b.reports.length) - (a.count + a.reports.length));
  } else if (numberSort === 'lowest') {
    mergedGroupedList.sort((a, b) => (a.count + a.reports.length) - (b.count + b.reports.length));
  } else {
    mergedGroupedList.sort((a, b) => {
      const la = a.latest || (a.reports[0] ? { created_at: a.reports[0].created_at } : null);
      const lb = b.latest || (b.reports[0] ? { created_at: b.reports[0].created_at } : null);
      return lb && la ? new Date(lb.created_at).getTime() - new Date(la.created_at).getTime() : 0;
    });
  }

  // Reports belonging to the currently open group modal student
  const groupViewReports = groupViewStudent
    ? allReports.filter(r => {
      if (groupViewStudent.id && r.student_id) return String(r.student_id) === String(groupViewStudent.id);
      return (r.student_name || '').toLowerCase() === (groupViewStudent.name || '').toLowerCase();
    })
    : [];

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


        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
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
              <Search style={{ width: '22px', height: '22px' }} />
            </div>
            <h1 style={{ fontSize: '20px', fontWeight: '700', margin: 0 }}>Search Violation Records</h1>
          </div>
        </div>

        <p className="text-muted" style={{ marginBottom: 16, fontSize: '0.9rem' }}>
          Look up for student records and violation reports.
        </p>

        {/* Search bar */}
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: '#9ca3af', pointerEvents: 'none' }} />
          <input
            type="text"
            placeholder="Search by student name…"
            value={searchTerm}
            onChange={(e) => setSearchTerm((e.target.value || '').toString().slice(0, 32))}
            maxLength={32}
            className="form-input"
            style={{ paddingLeft: 34, width: '100%', boxSizing: 'border-box' }}
          />
        </div>



        {/* Results - semantic table with auto-sizing, edge-to-edge inside card */}
        <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
          <div className="records-table-container" style={{ overflowX: 'auto' }}>
            <div className="records-table-scroll">
              <table className="records-table">
                <thead>
                  <tr>
                    <SortHeader colKey="name" label="Student Name" sortCol={sortCol} sortDir={sortDir} onSort={handleColSort} className="col-name" />
                    <SortHeader colKey="count" label="Number of Records" sortCol={sortCol} sortDir={sortDir} onSort={handleColSort} className="col-count" />
                  </tr>
                </thead>

                <tbody>
                  {mergedGroupedList.length === 0 ? (
                    <tr>
                      <td colSpan={2} style={{ textAlign: 'center', padding: 20 }}>
                        <span className="text-gray-600">No records found</span>
                      </td>
                    </tr>
                  ) : (
                    mergedGroupedList.map(group => (
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
                          <span className="text-gray-700 font-medium">{group.count + group.reports.length}</span>
                          {group.reports.length > 0 && group.count > 0 && (
                            <span style={{ fontSize: 11, color: '#6b7280', display: 'block' }}>
                              {group.count} slip{group.count !== 1 ? 's' : ''}, {group.reports.length} report{group.reports.length !== 1 ? 's' : ''}
                            </span>
                          )}
                          {group.reports.length > 0 && group.count === 0 && (
                            <span style={{ fontSize: 11, color: '#6b7280', display: 'block' }}>
                              {group.reports.length} report{group.reports.length !== 1 ? 's' : ''} only
                            </span>
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
            <div style={{ position: 'fixed', inset: 0, zIndex: 1010, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.45)', padding: '1rem' }}>
              <div className="card" style={{ width: '100%', maxWidth: '760px', maxHeight: '90vh', overflowY: 'auto', padding: '32px', fontFamily: 'Arial, sans-serif' }}>

                {/* Red close button */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '15px' }}>
                  <button
                    onClick={() => { setIsModalOpen(false); setSelectedSlip(null); }}
                    style={{ padding: '8px 16px', backgroundColor: '#ef4444', color: 'white', borderRadius: '4px', border: 'none', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
                  >
                    Close
                  </button>
                </div>

                {/* University Header */}
                <div style={{ textAlign: 'center', marginBottom: '15px' }}>
                  <h2 style={{ color: '#006400', fontFamily: 'Times New Roman, serif', margin: '0', fontSize: '24px', letterSpacing: '0.5px' }}>ISABELA STATE UNIVERSITY</h2>
                  <h3 style={{ margin: '8px 0', fontFamily: 'Times New Roman, serif', fontSize: '16px', fontWeight: 'normal', letterSpacing: '1px' }}>GUIDANCE OFFICE</h3>
                  <h3 style={{ textDecoration: 'underline', margin: '15px 0 5px 0', fontSize: '20px', fontWeight: 'bold', fontFamily: 'Arial, sans-serif' }}>ADMISSION SLIP REPORT</h3>
                </div>

                <hr style={{ border: 'none', borderTop: '3px double #006400', margin: '20px 0' }} />

                {/* Student name + status badge */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '15px' }}>
                  <div>
                    <h3 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 5px 0', textTransform: 'uppercase', fontFamily: 'Arial, sans-serif' }}>{selectedSlip.student_name}</h3>
                    <div style={{ color: '#555', fontSize: '15px' }}>Slip Reference: <strong style={{ color: '#000' }}>{selectedSlip.slip_number}</strong></div>
                  </div>
                  <div style={{ border: '1px solid #333', padding: '4px 8px', fontWeight: 'bold', fontSize: '14px', letterSpacing: '1px', textTransform: 'uppercase', color: '#000' }}>
                    {getStatusDisplay(selectedSlip.status)}
                  </div>
                </div>

                {/* Meta table */}
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
                </div>

                {/* Content sections */}
                <div style={{ border: '1px solid #c1c1c1', backgroundColor: '#fff' }}>
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
                    <div style={{ fontSize: '15px', color: '#111827', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{selectedSlip.teacher_comments || selectedSlip.remarks || '-'}</div>
                  </div>
                </div>

              </div>
            </div>
          )}


          {/* Group view modal */}
          {groupViewStudent && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.45)', padding: '1.5rem 1rem' }}>
              {/* Modal card: flex column, hard max height, nothing overflows */}
              <div className="card" style={{ width: '100%', maxWidth: '820px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>

                {/* ── Fixed header ── */}
                <div style={{ padding: '16px 20px 0', flexShrink: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <div>
                      <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#0f172a' }}>{groupViewStudent.name}</h3>
                      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                        {groupViewStudent.toggle === 'reports' ? groupViewReports.length : groupTotal} record{((groupViewStudent.toggle === 'reports' ? groupViewReports.length : groupTotal) !== 1) ? 's' : ''}
                      </div>
                    </div>
                    <button onClick={() => setGroupViewStudent(null)} className="btn btn-ghost">Close</button>
                  </div>

                  {/* ── Segmented toggle ── */}
                  <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 10, padding: 3, gap: 3, marginBottom: 14 }}>
                    {[['slips', 'Admission Slips'], ['reports', 'Violation Reports']].map(([key, label]) => {
                      const active = key === 'reports' ? groupViewStudent.toggle === 'reports' : (groupViewStudent.toggle !== 'reports');
                      return (
                        <button
                          key={key}
                          onClick={() => setGroupViewStudent(v => ({ ...v, toggle: key }))}
                          style={{
                            flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                            background: active ? 'white' : 'transparent',
                            color: active ? 'var(--primary)' : '#6b7280',
                            boxShadow: active ? '0 1px 4px rgba(15,23,42,0.10)' : 'none',
                            transition: 'all 0.18s',
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>

                  {/* ── Filters row (shared layout for both tabs) ── */}
                  {(groupViewStudent.toggle !== 'reports') && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 2fr', gap: 10, marginBottom: 10 }}>
                      <input type="text" placeholder="Search slips…" value={groupSearchTerm} onChange={e => setGroupSearchTerm((e.target.value || '').slice(0, 32))} maxLength={32} className="form-input" style={{ fontSize: 13 }} />
                      <select value={groupStatusFilter} onChange={e => setGroupStatusFilter(e.target.value)} className="form-input" style={{ fontSize: 13 }}>
                        <option value="all">All Status</option>
                        <option value="issued">Issued</option>
                        <option value="form_completed">Form Completed</option>
                        <option value="approved">Approved</option>
                      </select>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#ffffff', border: '1px solid #ced4da', borderRadius: '4px', paddingLeft: '12px' }}>
                        <Calendar className="icon" style={{ color: '#6c757d', width: '16px', height: '16px' }} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '13px', color: '#6c757d', fontWeight: 500 }}>From:</span>
                          <input type="date" value={groupStartDate} onChange={e => setGroupStartDate(e.target.value)} className="form-input" style={{ border: 'none', background: 'transparent', padding: '6px' }} title="Start Date" />
                        </div>
                        <div style={{ width: '1px', height: '24px', backgroundColor: '#e9ecef' }}></div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '13px', color: '#6c757d', fontWeight: 500 }}>To:</span>
                          <input type="date" value={groupEndDate} onChange={e => setGroupEndDate(e.target.value)} className="form-input" style={{ border: 'none', background: 'transparent', padding: '6px', borderRadius: 0 }} title="End Date" />
                        </div>
                      </div>
                    </div>
                  )}
                  {groupViewStudent.toggle === 'reports' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 2fr', gap: 10, marginBottom: 10 }}>
                      <input type="text" placeholder="Search reports…" value={groupViewStudent.reportSearchTerm || ''} onChange={e => setGroupViewStudent(v => ({ ...v, reportSearchTerm: (e.target.value || '').slice(0, 32), reportPage: 1 }))} maxLength={32} className="form-input" style={{ fontSize: 13 }} />
                      <select value={groupViewStudent.reportStatusFilter || 'all'} onChange={e => setGroupViewStudent(v => ({ ...v, reportStatusFilter: e.target.value, reportPage: 1 }))} className="form-input" style={{ fontSize: 13 }}>
                        <option value="all">All Status</option>
                        <option value="reported">Reported</option>
                        <option value="resolved">Resolved</option>
                      </select>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#ffffff', border: '1px solid #ced4da', borderRadius: '4px', paddingLeft: '12px' }}>
                        <Calendar className="icon" style={{ color: '#6c757d', width: '16px', height: '16px' }} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '13px', color: '#6c757d', fontWeight: 500 }}>From:</span>
                          <input type="date" value={groupViewStudent.reportStartDate || ''} onChange={e => setGroupViewStudent(v => ({ ...v, reportStartDate: e.target.value, reportPage: 1 }))} className="form-input" style={{ border: 'none', background: 'transparent', padding: '6px' }} title="Start Date" />
                        </div>
                        <div style={{ width: '1px', height: '24px', backgroundColor: '#e9ecef' }}></div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '13px', color: '#6c757d', fontWeight: 500 }}>To:</span>
                          <input type="date" value={groupViewStudent.reportEndDate || ''} onChange={e => setGroupViewStudent(v => ({ ...v, reportEndDate: e.target.value, reportPage: 1 }))} className="form-input" style={{ border: 'none', background: 'transparent', padding: '6px', borderRadius: 0 }} title="End Date" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* thin divider before list */}
                  <div style={{ borderTop: '1px solid #e6edf3', marginLeft: -20, marginRight: -20 }} />
                </div>

                {/* ── Scrollable list body ── */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px' }}>

                  {/* Slips list */}
                  {(groupViewStudent.toggle !== 'reports') && (
                    <>
                      {groupLoading ? (
                        <div style={{ fontSize: 13, color: '#6b7280', padding: '16px 0' }}>Loading slips…</div>
                      ) : (() => {
                        let list = (groupSlips || []).slice();
                        const applyClientPagination = groupFetchedAll;
                        if (groupSearchTerm) {
                          const q = groupSearchTerm.toLowerCase();
                          list = list.filter(s => (s.slip_number || '').toLowerCase().includes(q) || (s.violation_description || '').toLowerCase().includes(q) || (s.description || '').toLowerCase().includes(q));
                        }
                        if (groupStatusFilter !== 'all') list = list.filter(s => s.status === groupStatusFilter);
                        if (groupStartDate) list = list.filter(s => new Date(s.created_at) >= new Date(groupStartDate));
                        if (groupEndDate) {
                          const end = new Date(groupEndDate);
                          end.setHours(23, 59, 59, 999);
                          list = list.filter(s => new Date(s.created_at) <= end);
                        }
                        list = list.sort((a, b) => {
                          const tA = new Date(a.updated_at || a.created_at).getTime() || 0;
                          const tB = new Date(b.updated_at || b.created_at).getTime() || 0;
                          return tB - tA;
                        });
                        if (applyClientPagination) list = list.slice((groupPage - 1) * groupPageSize, groupPage * groupPageSize);
                        if (list.length === 0) return <div style={{ fontSize: 13, color: '#6b7280', padding: '16px 0', textAlign: 'center' }}>No slips found.</div>;
                        return (
                          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                            {list.map(s => (
                              <li key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderBottom: '1px solid #f1f5f9' }}>
                                <div style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
                                  <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.slip_number}</div>
                                  <div style={{ fontSize: 13, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.violation_description || 'No violation specified'}</div>
                                  <div style={{ fontSize: 12, color: '#9ca3af' }}>{s.created_at ? new Date(s.created_at).toLocaleString() : '-'}</div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                  <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadgeClass(s.status)}`}>{getStatusDisplay(s.status)}</span>
                                  <button className="btn btn-primary" style={{ padding: '5px 14px', fontSize: 13 }} onClick={() => handleSelectSlip(s)}>View</button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        );
                      })()}
                    </>
                  )}

                  {/* Reports list */}
                  {groupViewStudent.toggle === 'reports' && (() => {
                    let list = groupViewReports.slice();
                    if (groupViewStudent.reportSearchTerm) {
                      const q = groupViewStudent.reportSearchTerm.toLowerCase();
                      list = list.filter(r => (r.violation_description || '').toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q));
                    }
                    if (groupViewStudent.reportStatusFilter && groupViewStudent.reportStatusFilter !== 'all') {
                      list = list.filter(r => (r.status || '').toLowerCase() === groupViewStudent.reportStatusFilter);
                    }
                    if (groupViewStudent.reportStartDate) {
                      list = list.filter(r => new Date(r.created_at) >= new Date(groupViewStudent.reportStartDate));
                    }
                    if (groupViewStudent.reportEndDate) {
                      const end = new Date(groupViewStudent.reportEndDate);
                      end.setHours(23, 59, 59, 999);
                      list = list.filter(r => new Date(r.created_at) <= end);
                    }
                    list = list.sort((a, b) => {
                      const tA = new Date(a.created_at).getTime() || 0;
                      const tB = new Date(b.created_at).getTime() || 0;
                      return tB - tA;
                    });
                    const pageSize = groupPageSize;
                    const page = groupViewStudent.reportPage || 1;
                    const pagedList = list.slice((page - 1) * pageSize, page * pageSize);
                    if (pagedList.length === 0) return <div style={{ fontSize: 13, color: '#6b7280', padding: '16px 0', textAlign: 'center' }}>No violation reports found.</div>;
                    return (
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        {pagedList.map(r => (
                          <li key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderBottom: '1px solid #f1f5f9' }}>
                            <div style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
                              <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.violation_description || 'No violation type'}</div>
                              <div style={{ fontSize: 13, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description || '-'}</div>
                              <div style={{ fontSize: 12, color: '#9ca3af' }}>{r.created_at ? new Date(r.created_at).toLocaleString() : '-'}</div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                              <span className={`px-2 py-1 text-xs rounded-full ${r.status === 'resolved' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{(r.status || '').toUpperCase()}</span>
                              <button className="btn btn-primary" style={{ padding: '5px 14px', fontSize: 13 }} onClick={() => { setSelectedReport(r); setIsReportModalOpen(true); }}>View</button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    );
                  })()}

                </div>

                {/* ── Fixed pagination footer ── */}
                <div style={{ padding: '10px 20px', borderTop: '1px solid #e6edf3', flexShrink: 0, display: 'flex', gap: 6, flexWrap: 'wrap', minHeight: 52, alignItems: 'center' }}>
                  {/* Slips pagination */}
                  {(groupViewStudent.toggle !== 'reports') && (() => {
                    let listCount = groupTotal || 0;
                    if (groupFetchedAll) {
                      let list = (groupSlips || []).slice();
                      if (groupSearchTerm) {
                        const q = groupSearchTerm.toLowerCase();
                        list = list.filter(s => (s.slip_number || '').toLowerCase().includes(q) || (s.violation_description || '').toLowerCase().includes(q) || (s.description || '').toLowerCase().includes(q));
                      }
                      if (groupStatusFilter !== 'all') list = list.filter(s => s.status === groupStatusFilter);
                      if (groupStartDate) list = list.filter(s => new Date(s.created_at) >= new Date(groupStartDate));
                      if (groupEndDate) {
                        const end = new Date(groupEndDate);
                        end.setHours(23, 59, 59, 999);
                        list = list.filter(s => new Date(s.created_at) <= end);
                      }
                      listCount = list.length;
                    }
                    const totalPages = Math.max(1, Math.ceil(listCount / groupPageSize));
                    if (totalPages <= 1) return <span style={{ fontSize: 12, color: '#9ca3af' }}>Page 1 of 1</span>;
                    const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
                    return pages.map(p => (
                      <button key={p} onClick={async () => {
                        if (p === groupPage) return;
                        setGroupPage(p);
                        if (groupFetchedAll) return;
                        setGroupLoading(true);
                        try {
                          const params = { sort: 'newest' };
                          if (groupStatusFilter !== 'all') params.status = groupStatusFilter;
                          const resp = await getStudentAdmissionSlips(groupViewStudent.id, p, groupPageSize, params);
                          if (resp.data?.success) { setGroupSlips(resp.data.slips || []); setGroupTotal(resp.data.total || 0); }
                        } catch (e) { console.error('Failed to load page:', e); } finally { setGroupLoading(false); }
                      }} className={`btn ${p === groupPage ? 'btn-primary' : 'btn-outline'}`} style={{ padding: '5px 10px', fontSize: 13 }}>{p}</button>
                    ));
                  })()}
                  {/* Reports pagination */}
                  {groupViewStudent.toggle === 'reports' && (() => {
                    let list = groupViewReports.slice();
                    if (groupViewStudent.reportSearchTerm) {
                      const q = groupViewStudent.reportSearchTerm.toLowerCase();
                      list = list.filter(r => (r.violation_description || '').toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q));
                    }
                    if (groupViewStudent.reportStatusFilter && groupViewStudent.reportStatusFilter !== 'all') list = list.filter(r => (r.status || '').toLowerCase() === groupViewStudent.reportStatusFilter);
                    if (groupViewStudent.reportStartDate) list = list.filter(r => new Date(r.created_at) >= new Date(groupViewStudent.reportStartDate));
                    if (groupViewStudent.reportEndDate) {
                      const end = new Date(groupViewStudent.reportEndDate);
                      end.setHours(23, 59, 59, 999);
                      list = list.filter(r => new Date(r.created_at) <= end);
                    }
                    const totalPages = Math.max(1, Math.ceil(list.length / groupPageSize));
                    if (totalPages <= 1) return <span style={{ fontSize: 12, color: '#9ca3af' }}>Page 1 of 1</span>;
                    const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
                    const currentPage = groupViewStudent.reportPage || 1;
                    return pages.map(p => (
                      <button key={p} onClick={() => setGroupViewStudent(v => ({ ...v, reportPage: p }))}
                        className={`btn ${p === currentPage ? 'btn-primary' : 'btn-outline'}`} style={{ padding: '5px 10px', fontSize: 13 }}>{p}</button>
                    ));
                  })()}
                </div>

              </div>
            </div>
          )}

          {mergedGroupedList.length === 0 && (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>
              <FileText style={{ width: 48, height: 48, margin: '0 auto 12px', color: 'rgba(15,23,42,0.25)' }} />
              <p>No records found matching your search criteria</p>
            </div>
          )}
        </div>

        <div className="mt-4 text-sm text-gray-600">
          <p>
            Showing {mergedGroupedList.length} student{mergedGroupedList.length !== 1 ? 's' : ''} &mdash; {slips.length} admission slip{slips.length !== 1 ? 's' : ''}, {allReports.length} violation report{allReports.length !== 1 ? 's' : ''}
          </p>
        </div>
        {/* Floating Export button (bottom-right) */}
        <div style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 1000 }}>
          <button
            onClick={exportApprovedToXLSX}
            className="btn btn-primary"
            disabled={exportableCount === 0}
            title={exportableCount === 0
              ? 'No approved slips or resolved reports to export'
              : `Export ${approvedCount} approved slip${approvedCount !== 1 ? 's' : ''} + ${resolvedReportsCount} resolved report${resolvedReportsCount !== 1 ? 's' : ''} to XLSX`}
            style={{ padding: '10px 14px', borderRadius: 8, boxShadow: '0 6px 18px rgba(15,23,42,0.12)', display: 'flex', alignItems: 'center', gap: 8 }}
          >
            Export to XLSX
            {exportableCount > 0 && (
              <span style={{ background: 'rgba(255,255,255,0.12)', padding: '2px 8px', borderRadius: 9999, fontSize: 12 }}>{exportableCount}</span>
            )}
          </button>
        </div>
      </div>

      {/* Violation Report Detail Modal */}
      {isReportModalOpen && selectedReport && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1020, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.45)', padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto', padding: '32px', fontFamily: 'Arial, sans-serif' }}>

            {/* Red close button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '15px' }}>
              <button
                onClick={() => { setIsReportModalOpen(false); setSelectedReport(null); }}
                style={{ padding: '8px 16px', backgroundColor: '#ef4444', color: 'white', borderRadius: '4px', border: 'none', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>

            {/* University Header */}
            <div style={{ textAlign: 'center', marginBottom: '15px' }}>
              <h2 style={{ color: '#006400', fontFamily: 'Times New Roman, serif', margin: '0', fontSize: '24px', letterSpacing: '0.5px' }}>ISABELA STATE UNIVERSITY</h2>
              <h3 style={{ margin: '8px 0', fontFamily: 'Times New Roman, serif', fontSize: '16px', fontWeight: 'normal', letterSpacing: '1px' }}>GUIDANCE OFFICE</h3>
              <h3 style={{ textDecoration: 'underline', margin: '15px 0 5px 0', fontSize: '20px', fontWeight: 'bold', fontFamily: 'Arial, sans-serif' }}>STUDENT VIOLATION REPORT</h3>
            </div>

            <hr style={{ border: 'none', borderTop: '3px double #006400', margin: '20px 0' }} />

            {/* Student name + status badge */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '15px' }}>
              <div>
                <h3 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 5px 0', textTransform: 'uppercase', fontFamily: 'Arial, sans-serif' }}>{selectedReport.student_name}</h3>
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <div style={{ border: '1px solid #333', padding: '4px 8px', fontWeight: 'bold', fontSize: '13px', letterSpacing: '1px', textTransform: 'uppercase', color: '#000' }}>
                  {(selectedReport.status || '').toUpperCase()}
                </div>
                {selectedReport.violation_category && (
                  <div style={{ border: '1px solid #c1c1c1', padding: '4px 8px', fontSize: '13px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: selectedReport.violation_category === 'major' ? '#b91c1c' : '#c2410c' }}>
                    {selectedReport.violation_category.toUpperCase()}
                  </div>
                )}
              </div>
            </div>

            {/* Meta table */}
            <div style={{ border: '1px solid #a1a1aa', borderBottom: 'none', display: 'grid', gridTemplateColumns: '1fr 1fr', marginBottom: '20px' }}>
              <div style={{ borderBottom: '1px solid #a1a1aa', borderRight: '1px solid #a1a1aa', padding: '12px' }}>
                <div style={{ fontSize: '12px', color: '#555', fontWeight: 700, marginBottom: '6px', letterSpacing: '0.5px' }}>DATE REPORTED</div>
                <div style={{ fontSize: '15px', color: '#111827' }}>{selectedReport.created_at ? new Date(selectedReport.created_at).toLocaleString() : '-'}</div>
              </div>
              <div style={{ borderBottom: '1px solid #a1a1aa', padding: '12px' }}>
                <div style={{ fontSize: '12px', color: '#555', fontWeight: 700, marginBottom: '6px', letterSpacing: '0.5px' }}>COURSE</div>
                <div style={{ fontSize: '15px', color: '#111827' }}>{selectedReport.course || '-'}</div>
              </div>
              <div style={{ borderBottom: '1px solid #a1a1aa', padding: '12px' }}>
                <div style={{ fontSize: '12px', color: '#555', fontWeight: 700, marginBottom: '6px', letterSpacing: '0.5px' }}>YEAR &amp; SECTION</div>
                <div style={{ fontSize: '15px', color: '#111827' }}>{[selectedReport.year, selectedReport.section].filter(Boolean).join(' - ') || '-'}</div>
              </div>
            </div>

            {/* Content sections */}
            <div style={{ border: '1px solid #c1c1c1', backgroundColor: '#fff', marginBottom: '20px' }}>
              <div style={{ borderBottom: '1px solid #c1c1c1', padding: '12px 16px' }}>
                <div style={{ fontSize: '13px', color: '#555', fontWeight: 700, marginBottom: '8px', letterSpacing: '0.5px' }}>VIOLATION TYPE</div>
                <div style={{ fontSize: '15px', color: '#111827' }}>{selectedReport.violation_description || '-'}</div>
              </div>
              <div style={{ borderBottom: '1px solid #c1c1c1', padding: '12px 16px' }}>
                <div style={{ fontSize: '13px', color: '#555', fontWeight: 700, marginBottom: '8px', letterSpacing: '0.5px' }}>DESCRIPTION</div>
                <div style={{ fontSize: '15px', color: '#111827', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{selectedReport.description || '-'}</div>
              </div>
              <div style={{ padding: '12px 16px' }}>
                <div style={{ fontSize: '13px', color: '#555', fontWeight: 700, marginBottom: '8px', letterSpacing: '0.5px' }}>COUNSELOR REMARKS</div>
                <div style={{ fontSize: '15px', color: '#111827', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{selectedReport.remarks || '-'}</div>
              </div>
            </div>

            {/* Action buttons */}
            {selectedReport.status !== 'resolved' && (
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '32px' }}>
                <button
                  onClick={() => handleResolveReport(selectedReport.id)}
                  style={{ padding: '8px 16px', backgroundColor: '#1e7b44', color: 'white', borderRadius: '4px', border: 'none', fontWeight: 600, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <CheckCircle style={{ width: 16, height: 16 }} /> Resolve
                </button>
                <button
                  onClick={() => handleDeleteReport(selectedReport.id)}
                  style={{ padding: '8px 16px', backgroundColor: '#ef4444', color: 'white', borderRadius: '4px', border: 'none', fontWeight: 600, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Trash2 style={{ width: 16, height: 16 }} /> Delete
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchRecords;