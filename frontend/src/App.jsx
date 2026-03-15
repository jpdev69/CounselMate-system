// src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SlipsProvider } from './contexts/SlipsContext';
import Layout from './components/Layout';
import Login from './components/Login';
import ForgotPassword from './components/ForgotPassword';
import Dashboard from './components/Dashboard';
import PrintAdmissionSlip from './components/PrintAdmissionSlip';
import CompleteForm from './components/CompleteForm';
import SearchRecords from './components/SearchRecords';
import ChangePassword from './components/ChangePassword';
import RecoveryEmail from './components/RecoveryEmail';
import StudentManual from './components/StudentManual';
import AdminPanel from './components/AdminPanel';
import AdminLogin from './components/AdminLogin';
import AdminLayout from './components/AdminLayout';
import ReportStudent from './components/ReportStudent';
import './App.css';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p className="loading-text">Loading...</p>
      </div>
    );
  }
  
  return user ? children : <Navigate to="/login" />;
};

const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p className="loading-text">Loading...</p>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/admin/login" />;
  }
  
  if (user.role !== 'admin') {
    return <Navigate to="/" />; // Redirect counselors to main dashboard, not login
  }
  
  return children;
};

const PublicRoute = ({ children }) => {
  const { user } = useAuth();
  return !user ? children : <Navigate to="/" />;
};

const AdminPublicRoute = ({ children }) => {
  const { user } = useAuth();
  if (!user) {
    return children;
  }
  if (user.role === 'admin') {
    return <Navigate to="/admin" />;
  }
  return <Navigate to="/" />;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
            <Route 
              path="/login" 
              element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              } 
            />
            <Route
              path="/forgot-password"
              element={
                <PublicRoute>
                  <ForgotPassword />
                </PublicRoute>
              }
            />
            <Route 
              path="/admin/login" 
              element={
                <AdminPublicRoute>
                  <AdminLogin />
                </AdminPublicRoute>
              } 
            />
            <Route 
              path="/admin/*" 
              element={
                <AdminRoute>
                  <AdminLayout>
                    <Routes>
                      <Route path="/" element={<AdminPanel />} />
                      <Route path="*" element={<Navigate to="/admin" />} />
                    </Routes>
                  </AdminLayout>
                </AdminRoute>
              } 
            />
            <Route 
              path="/*" 
              element={
                <ProtectedRoute>
                  <SlipsProvider>
                    <Layout>
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/print-slip" element={<PrintAdmissionSlip />} />
                      <Route path="/complete-form" element={<CompleteForm />} />
                      <Route path="/report-student" element={<ReportStudent />} />
                      <Route path="/search" element={<SearchRecords />} />
                      <Route path="/student-manual" element={<StudentManual />} />
                      <Route path="/change-password" element={<ChangePassword />} />
                      <Route path="/recovery-email" element={<RecoveryEmail />} />
                      <Route path="*" element={<Navigate to="/" />} />
                      
                    </Routes>
                  </Layout>
                  </SlipsProvider>
                </ProtectedRoute>
              } 
            />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;