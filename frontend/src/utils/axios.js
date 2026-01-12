import axios from 'axios';

// Get API URL from environment variable or use default
// IMPORTANT: React only reads env variables that start with REACT_APP_
let API_URL = process.env.REACT_APP_API_URL;

// Debug: Log what we're getting
console.log('🔧 REACT_APP_API_URL raw:', process.env.REACT_APP_API_URL);
console.log('🔧 Type:', typeof process.env.REACT_APP_API_URL);

// Fallback to default if not set or empty
if (!API_URL || API_URL.trim() === '' || API_URL === 'undefined') {
  API_URL = 'http://localhost:5500/api';
  console.log('⚠️ Using default API URL:', API_URL);
} else {
  console.log('✅ Using API URL from .env:', API_URL);
}

// Ensure API_URL is a valid full URL
if (!API_URL.startsWith('http://') && !API_URL.startsWith('https://')) {
  console.error('❌ Invalid API_URL format. Must start with http:// or https://');
  API_URL = 'http://localhost:5500/api';
}

// Ensure API_URL ends with /api (but don't double it)
if (!API_URL.endsWith('/api')) {
  if (API_URL.endsWith('/')) {
    API_URL = API_URL + 'api';
  } else {
    API_URL = API_URL + '/api';
  }
}

console.log('🔧 Final API Base URL:', API_URL);

// Validate the URL
if (!API_URL || API_URL === 'undefined' || API_URL.length < 10) {
  console.error('❌ CRITICAL: API_URL is invalid!', API_URL);
  API_URL = 'http://localhost:5500/api';
  console.log('🔧 Forced to use:', API_URL);
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
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Debug: Log the full URL being requested
    const fullURL = config.baseURL + config.url;
    console.log('🌐 Making request to:', fullURL);
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

