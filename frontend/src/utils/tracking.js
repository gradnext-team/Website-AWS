import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export const trackEvent = (event, metadata = null) => {
  axios.post(`${BACKEND_URL}/api/tracking/event`, { event, metadata }, { withCredentials: true }).catch(() => {});
};

export const trackLogin = () => {
  axios.post(`${BACKEND_URL}/api/tracking/login`, {}, { withCredentials: true }).catch(() => {});
};
