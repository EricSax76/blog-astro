const resolveDefaultBaseUrl = () => {
    const defaultUrl = new URL('/api/', window.location.origin);
    return defaultUrl.toString().replace(/\/$/, '');
};

export const API_BASE_URL = (window.__API_BASE_URL__ || resolveDefaultBaseUrl()).replace(/\/$/, '');

export const endpoints = {
    auth: `${API_BASE_URL}/auth`,
    users: `${API_BASE_URL}/users`,
};
