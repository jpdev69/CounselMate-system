// frontend/src/services/api.js
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  console.log(`Making ${config.method?.toUpperCase()} request to: ${config.url}`);
  const token = localStorage.getItem('authToken');
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
      localStorage.removeItem('authToken');
      localStorage.removeItem('userData');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const login = (email, password) => 
  api.post('/auth/login', { email, password });

export const changePassword = (data) => 
  api.put('/auth/change-password', data);

// Admission Slips API
export const issueAdmissionSlip = (data) => 
  api.post('/admission-slips/issue', data);

export const verifyStudent = (data) =>
  api.post('/admission-slips/verify', data);

export const completeForm = (slipId, data) => 
  api.put(`/admission-slips/${slipId}/complete`, data);

export const approveSlip = (slipId) => 
  api.put(`/admission-slips/${slipId}/approve`);

export const getAdmissionSlips = () => 
  api.get('/admission-slips');

export const getAdmissionSlip = (slipId) => 
  api.get(`/admission-slips/${slipId}`);

export const getViolationTypes = () => 
  api.get('/violation-types');

export default api;