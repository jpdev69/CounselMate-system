// src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Login from './components/Login';
import ForgotPassword from './components/ForgotPassword';
import Dashboard from './components/Dashboard';
import PrintAdmissionSlip from './components/PrintAdmissionSlip';
import CompleteForm from './components/CompleteForm';
import SearchRecords from './components/SearchRecords';
import ChangePassword from './components/ChangePassword';
import SecurityQuestion from './components/SecurityQuestion';
import Analytics from './components/Analytics';
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

const PublicRoute = ({ children }) => {
  const { user } = useAuth();
  return !user ? children : <Navigate to="/" />;
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
              path="/*" 
              element={
                <ProtectedRoute>
                  <Layout>
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/print-slip" element={<PrintAdmissionSlip />} />
                      <Route path="/complete-form" element={<CompleteForm />} />
                      <Route path="/search" element={<SearchRecords />} />
                      <Route path="/analytics" element={<Analytics />} />
                      <Route path="/change-password" element={<ChangePassword />} />
                      <Route path="/security-question" element={<SecurityQuestion />} />
                      <Route path="*" element={<Navigate to="/" />} />
                      
                    </Routes>
                  </Layout>
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