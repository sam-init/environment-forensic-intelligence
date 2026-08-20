/**
 * Axios API client with base URL from environment.
 */
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor: unwrap user-facing errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.detail ??
      error.response?.data?.error ??
      'Could not reach the server. Please try again later.';
    return Promise.reject(new Error(message));
  },
);

export default api;
