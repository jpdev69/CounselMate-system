import React, { useState, useEffect, useRef } from 'react';
import './ViolationAnalytics.css';

/**
 * ViolationAnalytics Component
 * Displays violation statistics and analytics with interactive charts
 * 
 * Usage:
 * <ViolationAnalytics />
 */

const ViolationAnalytics = () => {
  const [summary, setSummary] = useState(null);
  const [violations, setViolations] = useState(null);
  const [courses, setCourses] = useState(null);
  const [violationTypes, setViolationTypes] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeChart, setActiveChart] = useState('violators');
  const [hoveredBar, setHoveredBar] = useState(null);
  const [hoveredCourse, setHoveredCourse] = useState(null);
  const violatorSvgRef = useRef(null);
  const violatorVizRef = useRef(null);
  const [violatorTooltip, setViolatorTooltip] = useState({ visible: false, left: 0, top: 0, name: '', count: 0 });
  const chartsRef = useRef({});

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const showViolatorTooltip = (idx) => {
    if (!violations || !violatorSvgRef.current || !violatorVizRef.current) return;
    const student = violations[idx];
    if (!student) return;
    const maxViolations = Math.max(...violations.slice(0, 10).map(s => parseInt(s.violation_count)));
    const barHeight = (parseInt(student.violation_count) / maxViolations) * 200;
    const x = 20 + idx * 36;
    const y = 250 - barHeight;
    const svgRect = violatorSvgRef.current.getBoundingClientRect();
    const containerRect = violatorVizRef.current.getBoundingClientRect();
    let left = svgRect.left + x + 15 - containerRect.left; // center-ish
    let top = svgRect.top + y - 10 - containerRect.top; // slightly above bar
    // clamp tooltip inside container
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

      const API_BASE_URL = 'http://localhost:5000/api';

      // First test if the API is responding
      const healthRes = await fetch(`${API_BASE_URL}/visualizations/health`);
      if (!healthRes.ok) {
        throw new Error('Analytics API health check failed. Backend may be down.');
      }

      // Fetch all data in parallel
      const [summaryRes, violationsRes, coursesRes, typesRes] = await Promise.all([
        fetch(`${API_BASE_URL}/visualizations/violations/summary`),
        fetch(`${API_BASE_URL}/visualizations/violations/by-student`),
        fetch(`${API_BASE_URL}/visualizations/violations/by-course`),
        fetch(`${API_BASE_URL}/visualizations/violations/by-type`)
      ]);

      if (!summaryRes.ok) {
        const errorText = await summaryRes.text();
        console.error('Summary response status:', summaryRes.status, 'Body:', errorText.substring(0, 200));
        throw new Error(`Summary fetch failed: ${summaryRes.status}`);
      }
      
      if (!violationsRes.ok) {
        throw new Error(`Violations fetch failed: ${violationsRes.status}`);
      }
      
      if (!coursesRes.ok) {
        throw new Error(`Courses fetch failed: ${coursesRes.status}`);
      }

      if (!typesRes.ok) {
        throw new Error(`Violation types fetch failed: ${typesRes.status}`);
      }

      // Check content-type to ensure we're getting JSON
      const contentType = summaryRes.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned non-JSON response. Backend error occurred.');
      }

      const summaryData = await summaryRes.json();
      const violationsData = await violationsRes.json();
      const coursesData = await coursesRes.json();
      const typesData = await typesRes.json();

      setSummary(summaryData.summary);
      setViolations(violationsData.data);
      setCourses(coursesData.data);
      setViolationTypes(typesData.data);
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

  // Derived colors so charts and legends stay in sync
  const violatorColors = (violations || []).map((_, idx) => `hsl(${idx * 30}, 70%, 55%)`);
  const violatorBorderColors = (violations || []).map((_, idx) => `hsl(${idx * 30}, 70%, 38%)`);
  const typeColors = (violationTypes || []).map((_, idx) => `hsl(${idx * 40}, 70%, 60%)`);
  // Derived values for consistent course color mapping between chart and legend
  const courseColors = (courses || []).map((_, idx) => `hsl(${idx * 60}, 70%, 60%)`);
  const courseTotal = (courses || []).reduce((sum, course) => sum + (parseInt(course.violation_count, 10) || 0), 0);
  const circumference = 2 * Math.PI * 80;
  const courseSegments = (courses || []).slice(0, 8).reduce((acc, course, idx) => {
    const value = parseInt(course.violation_count, 10) || 0;
    const dash = courseTotal > 0 ? (value / courseTotal) * circumference : 0;
    const segment = {
      ...course,
      color: courseColors[idx] || '#667eea',
      dash,
      offset: acc.offset
    };
    acc.offset -= dash;
    acc.list.push(segment);
    return acc;
  }, { offset: 0, list: [] }).list;
  // Course data for hovered segment
  const hoveredCourseData = (hoveredCourse != null && courseSegments[hoveredCourse]) ? courseSegments[hoveredCourse] : null;

  return (
    <div className="analytics-container">
      {/* Analysis Content */}
      <div className="analysis-content">
        <div className="summary-details">
            <h3>📊 Data Analysis Overview</h3>
            
            {/* Overview Metrics */}
            <div className="overview-metrics">
              <div className="metric-box">
                <div className="metric-label">Total Committed Violations of Students</div>
                <div className="metric-value">{summary?.total_violations || 0}</div>
              </div>
              <div className="metric-box">
                <div className="metric-label">Unique Students with Reported Violation</div>
                <div className="metric-value">{summary?.students_with_violations || 0}</div>
              </div>
              <div className="metric-box">
                <div className="metric-label">Average Occurring Violations per Student</div>
                <div className="metric-value">{(summary?.total_violations / summary?.students_with_violations).toFixed(1)}</div>
              </div>
            </div>

            {/* Key Insights */}
            <div className="key-insights">
              <h4>Key Insights</h4>
              {summary?.top_violator && (
                <div className="insight-card clickable" onClick={() => setActiveChart('violators')}>
                  <div className="insight-icon">🔴</div>
                  <div className="insight-content">
                    <div className="insight-title">Top Violator</div>
                    <div className="insight-data">
                      <strong>{summary.top_violator.full_name}</strong> with <strong>{summary.top_violator.violation_count}</strong> violations
                    </div>
                  </div>
                </div>
              )}
              {summary?.most_common_violation && (
                <div className="insight-card clickable" onClick={() => setActiveChart('types')}>
                  <div className="insight-icon">⚠️</div>
                  <div className="insight-content">
                    <div className="insight-title">Most Reported Violation</div>
                    <div className="insight-data">
                      <strong>{summary.most_common_violation.description}</strong> with <strong>{summary.most_common_violation.violation_count}</strong> occurrences
                    </div>
                  </div>
                </div>
              )}
              {summary?.most_violated_course && (
                <div className="insight-card clickable" onClick={() => setActiveChart('courses')}>
                  <div className="insight-icon">📚</div>
                  <div className="insight-content">
                    <div className="insight-title">Course with Most Violations</div>
                    <div className="insight-data">
                      <strong>{summary.most_violated_course.course}</strong> with <strong>{summary.most_violated_course.violation_count}</strong> violations
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Data Visualization Charts */}
            <div className="data-visualizations">
              <h4>Violation Patterns & Trends</h4>
              <div className="viz-grid">
                {activeChart === 'violators' && (
                  <div ref={violatorVizRef} className="viz-container full-width">
                    <h5>🔴 Top 10 Violators</h5>
                    <svg ref={violatorSvgRef} className="simple-chart" viewBox="0 0 400 300">
                      {violations.slice(0, 10).map((student, idx) => {
                        const maxViolations = Math.max(...violations.slice(0, 10).map(s => parseInt(s.violation_count)));
                        const barHeight = (parseInt(student.violation_count) / maxViolations) * 200;
                        const x = 20 + idx * 36;
                        const y = 250 - barHeight;
                        const isHovered = hoveredBar === idx;
                        return (
                          <g key={idx} 
                            onMouseEnter={() => { setHoveredBar(idx); showViolatorTooltip(idx); }}
                            onMouseLeave={() => { setHoveredBar(null); hideViolatorTooltip(); }}
                            style={{ cursor: 'pointer' }}>
                            <rect x={x} y={y} width="30" height={barHeight} fill={violatorColors[idx]} opacity={isHovered ? 1 : 0.8}
                              stroke={violatorBorderColors[idx]} strokeWidth={isHovered ? 3 : 0} rx={4}
                              style={{ transition: 'stroke-width 0.12s, filter 0.12s', filter: isHovered ? 'drop-shadow(0px 6px 8px rgba(102,126,234,0.15))' : 'none' }}
                            />
                            {/* Tooltip handled by floating overlay */}
                            <text x={x + 15} y="285" textAnchor="middle" fontSize="10" fill="#333">
                              {idx + 1}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                    {violatorTooltip.visible && (
                      <div className="violator-tooltip" style={{ left: `${violatorTooltip.left}px`, top: `${violatorTooltip.top}px` }}>
                        <div className="violator-tooltip-name">{violatorTooltip.name}</div>
                        <div className="violator-tooltip-count">{violatorTooltip.count} violations</div>
                      </div>
                    )}
                    <div className="chart-legend">
                      {violations.slice(0, 10).map((student, idx) => {
                        const isActive = hoveredBar === idx;
                        return (
                          <div
                            key={idx}
                            className={`legend-item ${isActive ? 'active' : ''}`}
                            onMouseEnter={() => { setHoveredBar(idx); showViolatorTooltip(idx); }}
                            onMouseLeave={() => { setHoveredBar(null); hideViolatorTooltip(); }}
                          >
                            <span className="legend-dot" style={{ backgroundColor: violatorColors[idx] }}></span>
                            <span className="legend-number">{idx + 1}</span>
                            <span className="legend-name">{student.full_name}</span>
                            <span className="legend-value">{student.violation_count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {activeChart === 'courses' && (
                  <div className="viz-container full-width">
                    <h5>📚 Violations by Course</h5>
                    <div className="chart-wrapper">
                      <svg className="pie-chart" viewBox="0 0 300 300">
                        {courseSegments.map((segment, idx) => {
                          const isActive = hoveredCourse === idx;
                          return (
                            <circle
                              key={idx}
                              cx="150"
                              cy="150"
                              r="80"
                              fill="none"
                              stroke={segment.color}
                              strokeWidth={isActive ? 74 : 60}
                              strokeDasharray={`${segment.dash} ${circumference}`}
                              strokeDashoffset={segment.offset}
                              opacity={isActive ? 1 : 0.85}
                              onMouseEnter={() => setHoveredCourse(idx)}
                              onMouseLeave={() => setHoveredCourse(null)}
                              style={{ cursor: 'pointer', transition: 'stroke-width 0.2s, opacity 0.15s, filter 0.15s', filter: isActive ? 'drop-shadow(0 6px 10px rgba(0,0,0,0.12))' : 'none' }}
                            />
                          );
                        })}
                        {hoveredCourseData ? (
                          <>
                            <text x="150" y="140" className="title" textAnchor="middle" fontWeight="700" fill="#333">
                              {hoveredCourseData.course}
                            </text>
                            <text x="150" y="160" className="subtitle" textAnchor="middle">
                              {hoveredCourseData.violation_count} violations
                            </text>
                          </>
                        ) : (
                          <>
                            <text x="150" y="150" textAnchor="middle" fontSize="24" fontWeight="bold" fill="#333">
                              {courses.length}
                            </text>
                            <text x="150" y="175" textAnchor="middle" fontSize="12" fill="#666">
                              Courses
                            </text>
                          </>
                        )}
                      </svg>
                    </div>
                    <div className="chart-legend">
                      {courseSegments.map((segment, idx) => {
                        const isActive = hoveredCourse === idx;
                        return (
                          <div
                            key={idx}
                            className={`legend-item ${isActive ? 'active' : ''}`}
                            onMouseEnter={() => setHoveredCourse(idx)}
                            onMouseLeave={() => setHoveredCourse(null)}
                          >
                            <span className="legend-dot" style={{ backgroundColor: segment.color }}></span>
                            <span className="legend-name">{segment.course}</span>
                            <span className="legend-value">{segment.violation_count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {activeChart === 'types' && (
                  <div className="viz-container full-width">
                    <h5>⚠️ Violation Type Distribution</h5>
                    <div className="stat-distribution">
                      {violationTypes && violationTypes.length > 0 ? (
                        violationTypes.map((type, idx) => {
                        const percentage = ((parseInt(type.violation_count) / summary?.total_violations) * 100).toFixed(1);
                        return (
                            <div
                              key={idx}
                              className={`dist-item`}
                            >
                              <div className="dist-bar" style={{ width: `${percentage}%`, background: typeColors[idx] }}></div>
                              <div className="dist-label">{type.description}</div>
                              <div className="dist-value">{type.violation_count} ({percentage}%)</div>
                            </div>
                          );
                        })
                      ) : (
                        <p>No violation type data available</p>
                      )}
                    </div>
                    <div className="chart-legend">
                      {violationTypes && violationTypes.map((type, idx) => (
                        <div key={idx} className="legend-item">
                          <span className="legend-dot" style={{ backgroundColor: typeColors[idx] }}></span>
                          <span className="legend-name">{type.description}</span>
                          <span className="legend-value">{type.violation_count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ViolationAnalytics;

