// src/components/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ViolationAnalytics from './ViolationAnalytics';
import { useSlips } from '../contexts/SlipsContext';
import api from '../services/api';

const Dashboard = () => {
  const { slips } = useSlips();
  const [recentViolations, setRecentViolations] = useState([]);
  const [selectedSchoolYear, setSelectedSchoolYear] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [availableFilters, setAvailableFilters] = useState({ schoolYears: [], terms: [] });
  const [filtersLoading, setFiltersLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (slips && slips.length > 0) {
      // Get recent violations with status that indicates active/recent activity
      const recent = slips
        .filter(slip => slip.status === 'issued' || slip.status === 'form_completed')
        .slice(0, 10)
        .map(slip => ({
          id: slip.id,
          studentName: slip.student_name,
          violation: slip.violation_description || 'Policy Violation',
          time: slip.created_at ? new Date(slip.created_at).toLocaleString() : 'Unknown',
          status: slip.status?.replace('_', ' ').toUpperCase()
        }));
      setRecentViolations(recent);
    }
  }, [slips]);

  // Fetch available filter options
  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        setFiltersLoading(true);
        const queryParams = selectedSchoolYear ? `?schoolYear=${encodeURIComponent(selectedSchoolYear)}` : '';
        const response = await api.get(`/visualizations/filter-options${queryParams}`);
        setAvailableFilters(response.data.data);
      } catch (error) {
        console.error('Error fetching filter options:', error);
        // Fallback to empty arrays if API fails
        setAvailableFilters({ schoolYears: [], terms: [] });
      } finally {
        setFiltersLoading(false);
      }
    };

    fetchFilterOptions();
  }, [selectedSchoolYear]); // Re-fetch when school year changes

  const handleTickerClick = (violation) => {
    // Navigate based on violation status
    if (violation.status === 'FORM COMPLETED') {
      navigate(`/complete-form?slipId=${violation.id}`);
    } else {
      navigate(`/complete-form?slipId=${violation.id}`);
    }
  };

  return (
    <div>
      {/* Violation Ticker */}
      <div style={{
        backgroundColor: '#1e293b',
        color: '#ffffff',
        padding: '8px 0',
        overflow: 'hidden',
        position: 'relative',
        borderBottom: '2px solid #006633'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          backgroundColor: '#006633',
          padding: '0 15px',
          zIndex: 2,
          fontWeight: 'bold',
          fontSize: '14px'
        }}>
          LATEST ADMISSION SLIPS
        </div>
        <div style={{
          display: 'flex',
          animation: 'scroll 30s linear infinite',
          paddingLeft: '180px', // Space for the label
          whiteSpace: 'nowrap'
        }}>
          {recentViolations.length === 0 ? (
            <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>No recent violations reported</span>
          ) : (
            // Duplicate the list for seamless scrolling
            [...recentViolations, ...recentViolations].map((violation, index) => (
              <span 
                key={index} 
                style={{
                  marginRight: '50px',
                  fontSize: '13px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '15px',
                  padding: '4px 8px',
                  borderRadius: '4px'
                }}
              >
                <span style={{ color: '#fbbf24', fontWeight: 'bold' }}>{violation.studentName}</span>
                <span>{violation.violation}</span>
                <span style={{ color: '#94a3b8', fontSize: '12px' }}>{violation.time}</span>
                <span style={{
                  backgroundColor: violation.status === 'ISSUED' ? '#f59e0b' : '#3b82f6',
                  color: '#ffffff',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: 'bold'
                }}>
                  {violation.status}
                </span>
              </span>
            ))
          )}
        </div>
      </div>

      {/* Add CSS animation */}
      <style>{`
        @keyframes scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>

      {/* Filters Section - Always show filters, but only populate with available options */}
      {!filtersLoading && (
        <div style={{ 
          padding: '20px', 
          backgroundColor: '#f8fafc', 
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          gap: '20px',
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
            {/* School Year Filter - Always show, but only populate with available school years */}
            <div>
              <label style={{ 
                display: 'block', 
                marginBottom: '5px', 
                fontWeight: '600', 
                color: '#374151',
                fontSize: '14px'
              }}>
                School Year:
              </label>
              <select 
                value={selectedSchoolYear}
                onChange={(e) => setSelectedSchoolYear(e.target.value)}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  minWidth: '140px',
                  backgroundColor: '#ffffff',
                  color: '#374151'
                }}
              >
                <option value="">All Years</option>
                {availableFilters.schoolYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
            
            {/* Term Filter - Always show, but only populate with available terms */}
            <div>
              <label style={{ 
                display: 'block', 
                marginBottom: '5px', 
                fontWeight: '600', 
                color: '#374151',
                fontSize: '14px'
              }}>
                Term:
              </label>
              <select 
                value={selectedTerm}
                onChange={(e) => setSelectedTerm(e.target.value)}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  minWidth: '140px',
                  backgroundColor: '#ffffff',
                  color: '#374151'
                }}
              >
                <option value="">All Terms</option>
                {availableFilters.terms.map(term => (
                  <option key={term.value} value={term.value}>{term.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Original Dashboard Content */}
      <div style={{ padding: '20px' }}>
        <ViolationAnalytics 
          schoolYear={selectedSchoolYear} 
          term={selectedTerm} 
        />
      </div>
    </div>
  );
};

export default Dashboard;