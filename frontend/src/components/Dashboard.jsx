// src/components/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
// getAdmissionSlips handled by SlipsContext
import { FileText, CheckCircle, Clock, Users, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import '../App.css';
import { useSlips } from '../contexts/SlipsContext';

const Dashboard = () => {
  const { slips, loadSlips } = useSlips();

  const [stats, setStats] = useState({
    total: 0,
    issued: 0,
    formCompleted: 0,
    approved: 0
  });

  useEffect(() => {
    // ensure context has loaded slips
    if (!slips || slips.length === 0) loadSlips();
  }, []);

  useEffect(() => {
    const slipsData = slips || [];
    setStats({
      total: slipsData.length,
      issued: slipsData.filter(s => s.status === 'issued').length,
      formCompleted: slipsData.filter(s => s.status === 'form_completed').length,
      approved: slipsData.filter(s => s.status === 'approved').length
    });
  }, [slips]);

  const recentSlips = slips.slice(0, 5);

  const handleSlipClick = (slip) => {
    // If the slip has been completed (awaiting review), open Complete Form
    if (slip.status === 'form_completed') {
      navigate(`/complete-form?slipId=${slip.id}`);
      return;
    }

    // If the slip is approved, go to search (read-only historical view)
    if (slip.status === 'approved') {
      navigate(`/search?slipId=${slip.id}`);
      return;
    }

    // Default: for issued or other statuses, route to complete-form
    navigate(`/complete-form?slipId=${slip.id}`);
  };

  const StatCard = ({ title, value, icon: Icon, color, onClick }) => (
    <div
      className="stat-card"
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => { if (onClick && (e.key === 'Enter' || e.key === ' ')) onClick(); }}
      style={onClick ? { cursor: 'pointer' } : undefined}
    >
      <div className="stat-content">
        <div className={`stat-icon stat-icon-${color}`}>
          <Icon className="stat-icon-svg" />
        </div>
        <div className="stat-text">
          <p className="stat-title">{title}</p>
          <p className="stat-value">{value}</p>
        </div>
      </div>
    </div>
  );

  const navigate = useNavigate();

  return (
    <div className="dashboard-container container">
      <div className="dashboard-header">
        <h1 className="dashboard-title">Dashboard</h1>
        <p className="dashboard-subtitle">Web-based Guidance Monitoring and Record-Keeping System</p>
      </div>

      {/* Statistics */}
      <div className="stats-grid">
        <StatCard
          title="Total Slips"
          value={stats.total}
          icon={FileText}
          color="blue"
          onClick={() => navigate('/search')}
        />
        <StatCard
          title="Awaiting Forms"
          value={stats.issued}
          icon={Clock}
          color="yellow"
          onClick={() => navigate('/complete-form')}
        />
        <StatCard
          title="Pending Review"
          value={stats.formCompleted}
          icon={Users}
          color="blue"
          onClick={() => navigate('/complete-form')}
        />
        <StatCard
          title="Approved"
          value={stats.approved}
          icon={CheckCircle}
          color="green"
          onClick={() => navigate('/search')}
        />
      </div>

      <div className="dashboard-content">
        {/* Recent Activity */}
          <div className="dashboard-section card surface">
          <h2 className="section-title">Recent Admission Slips</h2>
            <div className="slips-list max-h-64 overflow-y-auto min-h-0 border border-gray-100 rounded-lg">
              {recentSlips.length === 0 && (
                <p className="p-4 text-sm text-gray-500">No admission slips found</p>
              )}
              {recentSlips.map((slip) => (
                <div
                  key={slip.id}
                  className="slip-item p-3 border-b border-gray-100 flex justify-between items-center"
                  onClick={() => handleSlipClick(slip)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSlipClick(slip); }}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="slip-info">
                    <p className="slip-name font-medium text-gray-900">{slip.student_name}</p>
                    <p className="slip-details text-xs text-gray-600">{slip.year} - {slip.section} • <span className="text-xs text-gray-500">{slip.slip_number}</span></p>
                  </div>
                  <span className={`status-badge status-${slip.status} text-xs`}>
                    {slip.status?.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
        </div>

        {/* Quick Actions */}
        <div className="dashboard-section card surface">
          <h2 className="section-title">Quick Actions</h2>
          <div className="quick-actions">
            <Link to="/print-slip" className="action-link">
              <FileText className="action-icon action-icon-blue" />
              <div className="action-content">
                <p className="action-title">Print Admission Slip</p>
                <p className="action-description">Issue a new admission slip for policy violation</p>
              </div>
            </Link>

            <Link to="/complete-form" className="action-link">
              <CheckCircle className="action-icon action-icon-green" />
              <div className="action-content">
                <p className="action-title">Complete Forms</p>
                <p className="action-description">Process returned admission slips</p>
              </div>
            </Link>

            <Link to="/search" className="action-link">
              <TrendingUp className="action-icon action-icon-purple" />
              <div className="action-content">
                <p className="action-title">Search Records</p>
                <p className="action-description">View historical records and analytics</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;