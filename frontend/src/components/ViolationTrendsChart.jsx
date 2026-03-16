import React, { useState, useEffect, useRef } from 'react';
import { TrendingUp, TrendingDown, Calendar, BarChart3 } from 'lucide-react';
import api from '../services/api';
import './ViolationTrendsChart.css';

const ViolationTrendsChart = ({ schoolYear, term }) => {
  const [trendsData, setTrendsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState(30);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const svgRef = useRef(null);

  useEffect(() => {
    fetchTrendsData();
  }, [schoolYear, term, timeRange]);

  const fetchTrendsData = async () => {
    try {
      setLoading(true);
      setError(null);

      const queryParams = new URLSearchParams();
      if (schoolYear) queryParams.append('schoolYear', schoolYear);
      if (term) queryParams.append('term', term);
      queryParams.append('days', timeRange.toString());

      const response = await api.get(`/visualizations/violations/daily-trends?${queryParams}`);
      setTrendsData(response.data);
    } catch (err) {
      console.error('Error fetching trends data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getChartDimensions = () => {
    const width = 800;
    const height = 300;
    const margin = { top: 20, right: 60, bottom: 40, left: 60 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    
    return { width, height, margin, chartWidth, chartHeight };
  };

  const renderStockChart = () => {
    if (!trendsData || !trendsData.data || trendsData.data.length === 0) {
      return (
        <div style={{ 
          textAlign: 'center', 
          padding: '60px', 
          color: '#94a3b8',
          fontSize: '16px'
        }}>
          <BarChart3 size={48} style={{ margin: '0 auto 16px', display: 'block' }} />
          No violation data available for the selected period
        </div>
      );
    }

    const { width, height, margin, chartWidth, chartHeight } = getChartDimensions();
    const data = trendsData.data;
    
    // Calculate scales with safety checks
    const validData = data.filter(d => d && (d.violation_count >= 0) && (d.moving_average_7d >= 0));
    const maxViolations = validData.length > 0 
      ? Math.max(...validData.map(d => Math.max(d.violation_count || 0, d.moving_average_7d || 0)))
      : 1; // Default to 1 if no valid data
    
    // If all violations are 0, set a reasonable max for display
    const displayMaxViolations = maxViolations === 0 ? 10 : maxViolations;
    
    const minViolations = 0;
    const xScale = (index) => {
      if (data.length <= 1) return chartWidth / 2; // Center the single point
      return (index / (data.length - 1)) * chartWidth;
    };
    const yScale = (value) => {
      if (isNaN(value) || !isFinite(value)) return chartHeight; // Default to bottom
      return chartHeight - ((Math.max(0, value) - minViolations) / Math.max(1, displayMaxViolations - minViolations)) * chartHeight;
    };

    // Generate path for the line
    const linePath = data.map((point, index) => {
      const x = xScale(index);
      const y = yScale(point.moving_average_7d);
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');

    // Generate area path
    const areaPath = data.length <= 1 
      ? `${linePath} L ${chartWidth / 2} ${chartHeight} L ${chartWidth / 2} ${chartHeight} Z`
      : `${linePath} L ${xScale(data.length - 1)} ${chartHeight} L ${xScale(0)} ${chartHeight} Z`;

    // Calculate change from previous day
    const latestData = data[data.length - 1];
    const previousData = data[data.length - 2];
    const latestCount = latestData?.violation_count || 0;
    const previousCount = previousData?.violation_count || 0;
    const change = latestCount - previousCount;
    const changePercent = previousCount > 0 
      ? ((change / previousCount) * 100).toFixed(1)
      : '0.0';

    return (
      <div className="stock-chart-container">
        <div className="chart-header">
          <div className="chart-title">
            <TrendingUp size={20} />
            <h3>Violation Trends - {trendsData.period}</h3>
          </div>
          <div className="chart-controls">
            <select 
              value={timeRange} 
              onChange={(e) => setTimeRange(parseInt(e.target.value))}
              className="time-range-selector"
            >
              <option value={1}>Daily</option>
              <option value={7}>Weekly</option>
              <option value={30}>1 Month</option>
              <option value={120}>4 Months</option>
              <option value={365}>1 Year</option>
            </select>
          </div>
        </div>

        <div className="chart-stats">
          <div className="stat-card">
            <div className="stat-label">{timeRange === 1 ? 'Today' : 'Latest Day'}</div>
            <div className="stat-value">{latestCount}</div>
            <div className={`stat-change ${change >= 0 ? 'positive' : 'negative'}`}>
              {change >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {change > 0 ? '+' : ''}{change} ({changePercent}%)
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">{timeRange === 1 ? 'Daily Average' : '7-Day Average'}</div>
            <div className="stat-value">{(latestData?.moving_average_7d || 0).toFixed(1)}</div>
            <div className="stat-subtitle">Moving Average</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Period</div>
            <div className="stat-value">{trendsData?.total_violations || 0}</div>
            <div className="stat-subtitle">All Violations</div>
          </div>
        </div>

        <div className="chart-svg-container">
          <svg 
            ref={svgRef} 
            width={width} 
            height={height} 
            className="stock-chart-svg"
          >
            {/* Grid lines */}
            {[0, 25, 50, 75, 100].map((percent) => {
              const y = (percent / 100) * chartHeight;
              return (
                <g key={percent}>
                  <line
                    x1={0}
                    y1={y}
                    x2={chartWidth}
                    y2={y}
                    stroke="#e5e7eb"
                    strokeWidth="1"
                    strokeDasharray="2,2"
                  />
                  <text
                    x={chartWidth + 10}
                    y={y + 4}
                    fontSize="11"
                    fill="#6b7280"
                    textAnchor="start"
                  >
                    {Math.round(displayMaxViolations * (1 - percent / 100))}
                  </text>
                </g>
              );
            })}

            {/* Area fill */}
            <path
              d={areaPath}
              fill="url(#gradient)"
              opacity="0.3"
            />

            {/* Main line */}
            <path
              d={linePath}
              fill="none"
              stroke="#3b82f6"
              strokeWidth="2"
            />

            {/* Data points */}
            {data.map((point, index) => {
              const x = xScale(index);
              const lineY = yScale(point.moving_average_7d || 0);
              const dotY = yScale(point.violation_count || 0); // Use daily count for dots
              const isHovered = hoveredPoint === index;
              
              // Skip rendering if y is invalid
              if (isNaN(lineY) || !isFinite(lineY) || isNaN(dotY) || !isFinite(dotY)) return null;
              
              return (
                <g key={index}>
                  <circle
                    cx={x}
                    cy={dotY}
                    r={isHovered ? 6 : 3}
                    fill="#3b82f6"
                    stroke="#ffffff"
                    strokeWidth="2"
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredPoint(index)}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                  
                  {/* Tooltip */}
                  {isHovered && (
                    <g>
                      <rect
                        x={x - 60}
                        y={dotY - 45}
                        width="120"
                        height="35"
                        fill="#1f2937"
                        rx="4"
                        opacity="0.95"
                      />
                      <text
                        x={x}
                        y={dotY - 25}
                        fontSize="11"
                        fill="#ffffff"
                        textAnchor="middle"
                        fontWeight="600"
                      >
                        {new Date(point.date).toLocaleDateString()}
                      </text>
                      <text
                        x={x}
                        y={dotY - 10}
                        fontSize="10"
                        fill="#9ca3af"
                        textAnchor="middle"
                      >
                        Violations: {point.violation_count || 0} | Avg: {(point.moving_average_7d || 0).toFixed(1)}
                      </text>
                    </g>
                  )}
                </g>
              );
            }).filter(Boolean)}

            {/* Gradient definition */}
            <defs>
              <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.1" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        <div className="chart-legend">
          <div className="legend-item">
            <div className="legend-symbol">
              <div className="line-legend"></div>
            </div>
            <span>7-Day Moving Average</span>
          </div>
          <div className="legend-item">
            <div className="legend-symbol">
              <div className="dot-legend"></div>
            </div>
            <span>Daily Violations</span>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="trends-chart-loading">
        <div className="loading-spinner"></div>
        <p>Loading violation trends...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="trends-chart-error">
        <p>Error loading trends: {error}</p>
        <button onClick={fetchTrendsData} className="retry-btn">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="violation-trends-chart">
      {renderStockChart()}
    </div>
  );
};

export default ViolationTrendsChart;
