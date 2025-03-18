// vidlacing-frontend/src/utils/axios.js
import axios from "axios";

const axiosInstance = axios.create({
  baseURL: "http://localhost:3000/api/v1/", // Adjust to your backend URL
  headers: { "Content-Type": "application/json" },
});

// Add token to requests if logged in
axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default axiosInstance;