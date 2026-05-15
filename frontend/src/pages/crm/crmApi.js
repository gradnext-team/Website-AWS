import axios from 'axios';

export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Helper for authenticated API calls — always sends cookies (CRM session or
// admin session) to support both sales-rep and admin auth flows.
export const apiCall = {
  get: (path) => axios.get(`${BACKEND_URL}${path}`, { withCredentials: true }),
  post: (path, data) => axios.post(`${BACKEND_URL}${path}`, data || {}, { withCredentials: true }),
  put: (path, data) => axios.put(`${BACKEND_URL}${path}`, data || {}, { withCredentials: true }),
  delete: (path) => axios.delete(`${BACKEND_URL}${path}`, { withCredentials: true }),
};
