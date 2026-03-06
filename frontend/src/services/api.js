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

export const getMySecurityQuestion = () =>
  api.get('/auth/me/security-question');

export const updateMySecurityQuestion = (payload) =>
  api.put('/auth/me/security-question', payload);

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

// Chatbot API
export const chatbotAsk = (message) =>
  api.post('/chatbot/ask', { message });

export default api;