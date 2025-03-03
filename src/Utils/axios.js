import axios from 'axios';

const axiosInstance = axios.create({
    baseURL: 'http://localhost:3000/api/v1/', // Backend URL (make sure it's correct)
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true, // If you're using cookies for authentication
});

export default axiosInstance;
