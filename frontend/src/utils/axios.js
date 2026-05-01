import axios from 'axios';
import { getAxiosBaseURL } from '../config/apiBase';

const API_URL = getAxiosBaseURL();

const isDev = process.env.NODE_ENV === 'development';
if (isDev) {
  console.log('🔧 API Base URL:', API_URL || '(missing)');
}

// Create axios instance with base URL
const axiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if available
axiosInstance.interceptors.request.use(
  (config) => {
    if (!config.baseURL && process.env.NODE_ENV !== 'development') {
      return Promise.reject(
        new Error(
          'API URL is not configured. Set REACT_APP_API_URL for the production build or runtime-config.js.'
        )
      );
    }
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Debug: Log the full URL being requested
    if (isDev) {
      const fullURL = (config.baseURL || '') + (config.url || '');
      console.log('🌐 Making request to:', fullURL);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle response errors
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Unauthorized - clear token
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      // Only redirect to login if not already on login/register page
      // This prevents redirect loops
      const currentPath = window.location.pathname;
      if (currentPath !== '/login' && currentPath !== '/register') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;

