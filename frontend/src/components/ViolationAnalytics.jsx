import React, { useState, useEffect, useRef } from 'react';
import './ViolationAnalytics.css';
import api from '../services/api';
import { TrendingUp, Users, AlertTriangle, BookOpen, BarChart3, PieChart } from 'lucide-react';
import ViolationTrendsChart from './ViolationTrendsChart';

/**
 * ViolationAnalytics Component
 * Displays violation statistics and analytics with interactive charts
 * 
 * Usage:
 * <ViolationAnalytics />
 */

const ViolationAnalytics = ({ schoolYear, term }) => {
  const [summary, setSummary] = useState(null);
  const [violations, setViolations] = useState(null);
  const [courses, setCourses] = useState(null);
  const [violationTypes, setViolationTypes] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hoveredBar, setHoveredBar] = useState(null);
  const [hoveredCourse, setHoveredCourse] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const violatorSvgRef = useRef(null);
  const violatorVizRef = useRef(null);
  const [violatorTooltip, setViolatorTooltip] = useState({ visible: false, left: 0, top: 0, name: '', count: 0 });

  const itemsPerPage = 5;

  useEffect(() => {
    fetchAnalyticsData();
  }, [schoolYear, term]);

  const showViolatorTooltip = (idx) => {
    if (!violations || !violatorSvgRef.current || !violatorVizRef.current) return;
    const student = violations[idx];
    if (!student) return;
    const maxViolations = Math.max(...violations.slice(0, 10).map(s => parseInt(s.violation_count)));
    const barHeight = (parseInt(student.violation_count) / maxViolations) * 140;
    const x = 15 + idx * 25;
    const y = 170 - barHeight;
    const svgRect = violatorSvgRef.current.getBoundingClientRect();
    const containerRect = violatorVizRef.current.getBoundingClientRect();
    let left = svgRect.left + x + 10 - containerRect.left;
    let top = svgRect.top + y - 10 - containerRect.top;
    left = Math.max(8, Math.min(left, containerRect.width - 8));
    top = Math.max(8, Math.min(top, containerRect.height - 8));
    setViolatorTooltip({ visible: true, left, top, name: student.full_name, count: student.violation_count });
  };

  const hideViolatorTooltip = () => {
    setViolatorTooltip({ visible: false, left: 0, top: 0, name: '', count: 0 });
  };

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      setError(null);

      await api.get('/visualizations/health');

      // Build query parameters
      const queryParams = new URLSearchParams();
      if (schoolYear) queryParams.append('schoolYear', schoolYear);
      if (term) queryParams.append('term', term);
      const queryString = queryParams.toString();

      const [summaryRes, violationsRes, coursesRes, typesRes] = await Promise.all([
        api.get(`/visualizations/violations/summary${queryString ? `?${queryString}` : ''}`),
        api.get(`/visualizations/violations/by-student${queryString ? `?${queryString}` : ''}`),
        api.get(`/visualizations/violations/by-course${queryString ? `?${queryString}` : ''}`),
        api.get(`/visualizations/violations/by-type${queryString ? `?${queryString}` : ''}`)
      ]);

      setSummary(summaryRes.data.summary);
      setViolations(violationsRes.data.data);
      setCourses(coursesRes.data.data);
      setViolationTypes(typesRes.data.data);
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="analytics-container"><p className="loading">Loading analytics...</p></div>;
  }

  if (error) {
    return <div className="analytics-container"><p className="error">Error: {error}</p></div>;
  }

  // Calculate derived statistics
  const averageViolations = summary?.students_with_violations > 0 
    ? (summary.total_violations / summary.students_with_violations).toFixed(2)
    : '0.00';
  
  const topViolations = violationTypes?.filter(v => v.violation_count > 0).slice(0, 5) || [];
  const topCourses = courses?.filter(c => c.violation_count > 0).slice(0, 5) || [];
  const topViolators = violations?.filter(v => v.violation_count > 0).slice(0, 8) || [];
  
  // Pagination for courses legend only
  const totalPages = Math.ceil((courses?.filter(c => c.violation_count > 0).length || 0) / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedCourses = courses?.filter(c => c.violation_count > 0).slice(startIndex, endIndex) || [];
  
  // Use all courses for the chart, but paginated courses for legend
  const coursesWithViolations = courses?.filter(c => c.violation_count > 0) || [];
  const courseTotal = coursesWithViolations.reduce((sum, course) => sum + (parseInt(course.violation_count, 10) || 0), 0);
  
  const totalViolations = summary?.total_violations || 0;
  
  // Color palette for academic visualization
  const colors = {
    primary: '#1e40af',
    secondary: '#3b82f6',
    accent: '#60a5fa',
    success: '#059669',
    warning: '#d97706',
    danger: '#dc2626'
  };

  // Chart colors - More striking and vibrant
  const violatorColors = (topViolators || []).map((_, idx) => `hsl(${idx * 45}, 85%, 55%)`);
  const violatorBorderColors = (topViolators || []).map((_, idx) => `hsl(${idx * 45}, 85%, 35%)`);
  const typeColors = (topViolations || []).map((_, idx) => `hsl(${idx * 60}, 90%, 60%)`);
  const courseColors = (coursesWithViolations || []).map((_, idx) => `hsl(${idx * 80}, 85%, 55%)`);
  const circumference = 2 * Math.PI * 60;
  const courseSegments = (coursesWithViolations || []).reduce((acc, course, idx) => {
    const value = parseInt(course.violation_count, 10) || 0;
    const dash = courseTotal > 0 ? (value / courseTotal) * circumference : 0;
    const segment = {
      ...course,
      color: courseColors[idx],
      dash,
      offset: acc.offset
    };
    acc.offset -= dash;
    acc.list.push(segment);
    return acc;
  }, { offset: 0, list: [] }).list;
  const hoveredCourseData = (hoveredCourse != null && courseSegments[hoveredCourse]) ? courseSegments[hoveredCourse] : null;

  // Helper function to get course color by code/name
  const getCourseColor = (course) => {
    const index = coursesWithViolations?.findIndex(c => 
      (c.code && c.code === course.code) || 
      (c.course && c.course === course.course) ||
      (c.code === course.course) ||
      (c.course === course.code)
    );
    return index >= 0 ? courseColors[index] : '#667eea';
  };

  return (
    <div className="analytics-container">
      {/* Header */}
      <div className="analytics-header">
        <div className="header-content">
          <h1>Violation Analytics Dashboard</h1>
          <p className="header-subtitle">Statistical Overview of Student Violations</p>
        </div>
      </div>

      {/* Key Metrics and Top Violators Row */}
      <div className="metrics-violators-row">
        {/* Key Metrics */}
        <div className="metrics-grid">
          <div className="metric-card primary">
            <div className="metric-icon">
              <AlertTriangle size={24} />
            </div>
            <div className="metric-content">
              <div className="metric-value">{totalViolations}</div>
              <div className="metric-label">Total {totalViolations === 1 ? 'Violation' : 'Violations'}</div>
            </div>
          </div>
          
          <div className="metric-card secondary">
            <div className="metric-icon">
              <Users size={24} />
            </div>
            <div className="metric-content">
              <div className="metric-value">{summary?.students_with_violations || 0}</div>
              <div className="metric-label">Student{summary?.students_with_violations === 1 ? '' : 's'} with Violations</div>
            </div>
          </div>
          
          <div className="metric-card success">
            <div className="metric-icon">
              <TrendingUp size={24} />
            </div>
            <div className="metric-content">
              <div className="metric-value">
                {summary?.most_common_violation?.description ? 
                  (summary.most_common_violation.description.length > 50 ? 
                    summary.most_common_violation.description.substring(0, 50) + '...' : 
                    summary.most_common_violation.description) : 
                  'No violations found'
                }
              </div>
              <div className="metric-label">Most Common Violation</div>
            </div>
          </div>
        </div>

        {/* Top Violators Chart */}
        <div className="compact-viz-card">
          <div className="viz-header">
            <Users size={18} />
            <h3>Top Violators</h3>
          </div>
          <div className="viz-content" ref={violatorVizRef}>
            {topViolators.length === 0 ? (
              <div style={{ 
                textAlign: 'center', 
                padding: '40px', 
                color: '#94a3b8',
                fontSize: '14px'
              }}>
                No violators found for the selected filters
              </div>
            ) : (
              <>
                <svg ref={violatorSvgRef} className="compact-bar-chart" viewBox="0 0 250 200">
                  {topViolators.map((student, idx) => {
                    const maxViolations = Math.max(...topViolators.map(s => parseInt(s.violation_count)));
                    const barHeight = (parseInt(student.violation_count) / maxViolations) * 140;
                    const x = 15 + idx * 25;
                    const y = 170 - barHeight;
                    const isHovered = hoveredBar === idx;
                    return (
                      <g key={idx} 
                        onMouseEnter={() => { setHoveredBar(idx); showViolatorTooltip(idx); }}
                        onMouseLeave={() => { setHoveredBar(null); hideViolatorTooltip(); }}
                        style={{ cursor: 'pointer' }}>
                        <rect x={x} y={y} width="20" height={barHeight} fill={violatorColors[idx]} opacity={isHovered ? 1 : 0.8}
                          rx={2}
                          style={{ transition: 'all 0.2s ease' }}
                        />
                        <text x={x + 10} y="190" textAnchor="middle" fontSize="9" fill="#666">
                          {idx + 1}
                        </text>
                      </g>
                    );
                  })}
                </svg>
                {violatorTooltip.visible && (
                  <div className="compact-tooltip" style={{ left: `${violatorTooltip.left}px`, top: `${violatorTooltip.top}px` }}>
                    <div className="tooltip-name">{violatorTooltip.name}</div>
                    <div className="tooltip-count">{violatorTooltip.count} {parseInt(violatorTooltip.count) === 1 ? 'violation' : 'violations'}</div>
                  </div>
                )}
                <div className="compact-legend">
                  {topViolators.map((student, idx) => (
                    <div key={idx} className="legend-item-small">
                      <span className="legend-dot-small" style={{ backgroundColor: violatorColors[idx] }}></span>
                      <span className="legend-text">{student.full_name.split(' ')[0]} ({student.violation_count})</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Violation Trends Chart */}
      <div className="trends-chart-section">
        <ViolationTrendsChart schoolYear={schoolYear} term={term} />
      </div>

      {/* Charts Grid */}
      <div className="charts-grid">
        {/* Course Distribution Chart */}
        <div className="compact-viz-card">
          <div className="viz-header">
            <BarChart3 size={18} />
            <h3>Violations by Program</h3>
          </div>
          <div className="viz-content">
            {coursesWithViolations.length === 0 ? (
              <div style={{ 
                textAlign: 'center', 
                padding: '40px', 
                color: '#94a3b8',
                fontSize: '14px'
              }}>
                No program violations found for the selected filters
              </div>
            ) : (
              <>
                <svg className="compact-pie-chart" viewBox="0 0 200 200">
                  {courseSegments.length > 0 && courseTotal > 0 ? (
                    courseSegments.map((segment, idx) => {
                      const isActive = hoveredCourse === idx;
                      return (
                        <circle
                          key={idx}
                          cx="100"
                          cy="100"
                          r="60"
                          fill="none"
                          stroke={segment.color}
                          strokeWidth={isActive ? 50 : 40}
                          strokeDasharray={`${segment.dash} ${circumference}`}
                          strokeDashoffset={segment.offset}
                          opacity={isActive ? 1 : 0.85}
                          onMouseEnter={() => setHoveredCourse(idx)}
                          onMouseLeave={() => setHoveredCourse(null)}
                          style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
                        />
                      );
                    })
                  ) : (
                    <circle
                      cx="100"
                      cy="100"
                      r="60"
                      fill="none"
                      stroke="#e2e8f0"
                      strokeWidth="40"
                      opacity="0.5"
                    />
                  )}
                  {hoveredCourseData ? (
                    <>
                      <text x="100" y="95" textAnchor="middle" fontSize="12" fontWeight="600" fill="#333">
                        {hoveredCourseData.code || hoveredCourseData.course}
                      </text>
                      <text x="100" y="110" textAnchor="middle" fontSize="11" fill="#666">
                        {hoveredCourseData.violation_count} {parseInt(hoveredCourseData.violation_count) === 1 ? 'violation' : 'violations'}
                      </text>
                    </>
                  ) : (
                    <>
                      <text x="100" y="100" textAnchor="middle" fontSize="16" fontWeight="bold" fill="#333">
                        {coursesWithViolations.length}
                      </text>
                      <text x="100" y="115" textAnchor="middle" fontSize="10" fill="#666">
                        Programs
                      </text>
                    </>
                  )}
                </svg>
                <div className="compact-legend">
                  {paginatedCourses.map((course, idx) => {
                    const courseColor = getCourseColor(course);
                    return (
                      <div key={idx} className="legend-item-small">
                        <span className="legend-dot-small" style={{ backgroundColor: courseColor }}></span>
                        <span className="legend-text">{course.code || course.course} ({course.violation_count})</span>
                      </div>
                    );
                  })}
                </div>
                {/* Pagination for Programs */}
                {coursesWithViolations.length > 5 && (
                  <div className="pagination-controls">
                    <button 
                      className="pagination-btn"
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                    >
                      ← Previous
                    </button>
                    <span className="pagination-info">
                      Showing {startIndex + 1}-{Math.min(endIndex, coursesWithViolations.length)} of {coursesWithViolations.length}
                    </span>
                    <button 
                      className="pagination-btn"
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Top 5 Violation Types */}
        <div className="compact-viz-card">
          <div className="viz-header">
            <PieChart size={18} />
            <h3>Top 5 Violation Types</h3>
          </div>
          <div className="viz-content">
            {topViolations.length === 0 ? (
              <div style={{ 
                textAlign: 'center', 
                padding: '40px', 
                color: '#94a3b8',
                fontSize: '14px'
              }}>
                No violations found for the selected filters
              </div>
            ) : (
              <div className="compact-horizontal-bars">
                {topViolations.map((type, idx) => {
                  const percentage = totalViolations > 0 
                    ? ((type.violation_count / totalViolations) * 100)
                    : 0;
                  const maxCount = Math.max(...topViolations.map(t => t.violation_count));
                  const barWidth = maxCount > 0 ? (type.violation_count / maxCount) * 100 : 0;
                  return (
                    <div key={idx} className="horizontal-bar-item">
                      <div className="bar-label">{type.description}</div>
                      <div className="bar-container">
                        <div className="horizontal-bar" style={{ width: `${barWidth}%`, background: typeColors[idx] }}></div>
                      </div>
                      <div className="bar-stats">
                        <span className="bar-count">{type.violation_count}</span>
                        <span className="bar-percentage">({percentage.toFixed(1)}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
};

export default ViolationAnalytics;

