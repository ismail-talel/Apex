export const environment = {
  production: false,
  apiUrl: 'http://localhost:5000/api',
  backendUrl: 'http://localhost:5000',
  wsUrl: 'http://localhost:5000',
  wsOptions: {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
    autoConnect: false,
    secure: false,
    rejectUnauthorized: false
  }
};
