// src/components/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { getAdmissionSlips } from '../services/api';
import { FileText, CheckCircle, Clock, Users, TrendingUp } from 'lucide-react';
import '../App.css';

const Dashboard = () => {
  const [slips, setSlips] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    issued: 0,
    formCompleted: 0,
    approved: 0
  });

  useEffect(() => {
    loadSlips();
  }, []);

  const loadSlips = async () => {
    try {
      const response = await getAdmissionSlips();
      const slipsData = response.data;
      setSlips(slipsData);

      // Calculate statistics
      setStats({
        total: slipsData.length,
        issued: slipsData.filter(s => s.status === 'issued').length,
        formCompleted: slipsData.filter(s => s.status === 'form_completed').length,
        approved: slipsData.filter(s => s.status === 'approved').length
      });
    } catch (error) {
      console.error('Failed to load slips:', error);
    }
  };

  const recentSlips = slips.slice(0, 5);

  const StatCard = ({ title, value, icon: Icon, color }) => (
    <div className="stat-card">
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

  return (
    <div className="dashboard-container">
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
        />
        <StatCard
          title="Awaiting Forms"
          value={stats.issued}
          icon={Clock}
          color="yellow"
        />
        <StatCard
          title="Pending Review"
          value={stats.formCompleted}
          icon={Users}
          color="blue"
        />
        <StatCard
          title="Approved"
          value={stats.approved}
          icon={CheckCircle}
          color="green"
        />
      </div>

      <div className="dashboard-content">
        {/* Recent Activity */}
        <div className="dashboard-section">
          <h2 className="section-title">Recent Admission Slips</h2>
          <div className="slips-list">
            {recentSlips.map((slip) => (
              <div key={slip.id} className="slip-item">
                <div className="slip-info">
                  <p className="slip-name">{slip.student_name}</p>
                  <p className="slip-details">{slip.year} - {slip.section}</p>
                  <p className="slip-number">{slip.slip_number}</p>
                </div>
                <span className={`status-badge status-${slip.status}`}>
                  {slip.status?.replace('_', ' ').toUpperCase()}
                </span>
              </div>
            ))}
            {recentSlips.length === 0 && (
              <p className="no-data">No admission slips found</p>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="dashboard-section">
          <h2 className="section-title">Quick Actions</h2>
          <div className="quick-actions">
            <a
              href="/print-slip"
              className="action-link"
            >
              <FileText className="action-icon action-icon-blue" />
              <div className="action-content">
                <p className="action-title">Print Admission Slip</p>
                <p className="action-description">Issue a new admission slip for policy violation</p>
              </div>
            </a>

            <a
              href="/complete-form"
              className="action-link"
            >
              <CheckCircle className="action-icon action-icon-green" />
              <div className="action-content">
                <p className="action-title">Complete Forms</p>
                <p className="action-description">Process returned admission slips</p>
              </div>
            </a>

            <a
              href="/search"
              className="action-link"
            >
              <TrendingUp className="action-icon action-icon-purple" />
              <div className="action-content">
                <p className="action-title">Search Records</p>
                <p className="action-description">View historical records and analytics</p>
              </div>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;