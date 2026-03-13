// src/components/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ViolationAnalytics from './ViolationAnalytics';
import { useSlips } from '../contexts/SlipsContext';
import SchoolYearSelector from './SchoolYearSelector';

const Dashboard = () => {
  const { slips } = useSlips();
  const [recentViolations, setRecentViolations] = useState([]);
  const [selectedSchoolYear, setSelectedSchoolYear] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
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
                  cursor: 'pointer',
                  transition: 'background-color 0.2s ease',
                  padding: '4px 8px',
                  borderRadius: '4px'
                }}
                onClick={() => handleTickerClick(violation)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
                title={`Click to view ${violation.studentName}'s violation details`}
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

      {/* Filters Section */}
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
            <SchoolYearSelector
              value={selectedSchoolYear}
              onChange={setSelectedSchoolYear}
              required={false}
              placeholder="All Years"
            />
          </div>
          
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
                minWidth: '120px',
                backgroundColor: '#ffffff',
                color: '#374151'
              }}
            >
              <option value="">All Terms</option>
              <option value="1st">1st Semester</option>
              <option value="2nd">2nd Semester</option>
              <option value="Summer">Summer</option>
            </select>
          </div>
        </div>
      </div>

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