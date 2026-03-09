// frontend/src/services/api.js
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // 60 seconds for LLM validation
});

api.interceptors.request.use((config) => {
  console.log(`Making ${config.method?.toUpperCase()} request to: ${config.url}`);
  const token = sessionStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    console.log(`Response received from: ${response.config.url}`, response.status);
    return response;
  },
  (error) => {
    console.error('API Error:', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      message: error.message
    });
    
    if (error.response?.status === 401) {
      const requestUrl = error.config?.url || '';
      const isLoginRequest = requestUrl.includes('/auth/login');

      // Clear session data for any 401
      sessionStorage.removeItem('authToken');
      sessionStorage.removeItem('userData');
      sessionStorage.removeItem('verifiedSecurityQuestion');

      // Notify the AuthContext via a custom event so React Router handles
      // the redirect (avoids a full page reload that would restart the loop).
      if (!isLoginRequest) {
        window.dispatchEvent(new CustomEvent('guidanceos:unauthenticated'));
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const login = (email, password) => 
  api.post('/auth/login', { email, password });

export const changePassword = (data) => 
  api.put('/auth/change-password', data);

export const getSecurityQuestion = () =>
  api.get('/auth/forgot');

export const resetPasswordWithSecurity = (payload) =>
  api.post('/auth/forgot/reset', payload);

export const verifySecurityAnswer = (payload) =>
  api.post('/auth/forgot/verify', payload);

export const sendOtp = () =>
  api.post('/auth/forgot/send-otp');

export const verifyOtp = (payload) =>
  api.post('/auth/forgot/verify-otp', payload);

export const resetPasswordWithOtp = (payload) =>
  api.post('/auth/forgot/reset-with-otp', payload);

export const getMySecurityQuestion = () =>
  api.get('/auth/me/security-question');

export const updateMySecurityQuestion = (payload) =>
  api.put('/auth/me/security-question', payload);

export const getGmailSettings = () =>
  api.get('/auth/me/gmail-settings');

export const updateGmailSettings = (payload) =>
  api.put('/auth/me/gmail-settings', payload);

// Admission Slips API
export const issueAdmissionSlip = (data) => 
  api.post('/admission-slips/issue', data);

export const verifyStudent = (data) =>
  api.post('/admission-slips/verify', data);

export const completeForm = (slipId, data) => 
  api.put(`/admission-slips/${slipId}/complete`, data);

export const validateViolation = (data) =>
  api.post('/admission-slips/validate-violation', data);

export const approveSlip = (slipId) => 
  api.put(`/admission-slips/${slipId}/approve`);

export const getAdmissionSlips = () => 
  api.get('/admission-slips');

export const getAdmissionSlip = (slipId) => 
  api.get(`/admission-slips/${slipId}`);

export const getViolationTypes = () => 
  api.get('/violation-types');

export const getStudentAdmissionSlips = (studentId, page = 1, pageSize = 5, params = {}) => {
  const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize), ...params }).toString();
  return api.get(`/admission-slips/student/${encodeURIComponent(studentId)}/slips?${qs}`);
};

export const deleteAdmissionSlip = (slipId) =>
  api.delete(`/admission-slips/${slipId}`);

// Student Reports API (violations without admission slips)
export const createStudentReport = (data) =>
  api.post('/reports', data);

export const getStudentReports = () =>
  api.get('/reports');

export const resolveStudentReport = (reportId, data) =>
  api.put(`/reports/${reportId}/resolve`, data);

export const deleteStudentReport = (reportId) =>
  api.delete(`/reports/${reportId}`);

// Chatbot API
export const chatbotAsk = (message) =>
  api.post('/chatbot/ask', { message });

// Admin API — courses, year levels, sections
export const getAdminCourses = () =>
  api.get('/admin/courses');

export const createAdminCourse = (data) =>
  api.post('/admin/courses', data);

export const updateAdminCourse = (id, data) =>
  api.put(`/admin/courses/${encodeURIComponent(id)}`, data);

export const deleteAdminCourse = (id) =>
  api.delete(`/admin/courses/${encodeURIComponent(id)}`);

export const getCourseYearLevels = (courseId) =>
  api.get(`/admin/courses/${encodeURIComponent(courseId)}/year-levels`);

export const addCourseYearLevel = (courseId, data) =>
  api.post(`/admin/courses/${encodeURIComponent(courseId)}/year-levels`, data);

export const updateYearLevel = (id, data) =>
  api.put(`/admin/year-levels/${encodeURIComponent(id)}`, data);

export const deleteYearLevel = (id) =>
  api.delete(`/admin/year-levels/${encodeURIComponent(id)}`);

export const getYearLevelSections = (yearLevelId) =>
  api.get(`/admin/year-levels/${encodeURIComponent(yearLevelId)}/sections`);

export const addYearLevelSection = (yearLevelId, data) =>
  api.post(`/admin/year-levels/${encodeURIComponent(yearLevelId)}/sections`, data);

export const updateSection = (id, data) =>
  api.put(`/admin/sections/${encodeURIComponent(id)}`, data);

export const deleteSection = (id) =>
  api.delete(`/admin/sections/${encodeURIComponent(id)}`);

// Admin API — violation types
export const getAdminViolationTypes = () =>
  api.get('/admin/violation-types');

export const updateViolationTypeSlip = (id, data) =>
  api.put(`/admin/violation-types/${encodeURIComponent(id)}`, data);

export const extractViolationTypes = (formData) =>
  api.post('/admin/violations/extract', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
  });

export const saveViolationTypes = (data) =>
  api.post('/admin/violations/save', data);

// Admin API — Student Manual
export const getStudentManualInfo = () =>
  api.get('/admin/student-manual/info');

export const uploadStudentManual = (formData) =>
  api.post('/admin/student-manual', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

// Chatbot API — fetch raw manual text
export const getStudentManual = () =>
  api.get('/chatbot/manual');

export default api;