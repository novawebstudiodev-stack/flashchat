// Loaded via CDN in chat.html
// Wraps socket.io-client with typed event helpers

let _socket = null;

const socketClient = {
  connect(token) {
    _socket = io(window.APP_CONFIG.SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    _socket.on('connect',       () => console.log('[Socket] connected'));
    _socket.on('disconnect',    () => console.log('[Socket] disconnected'));
    _socket.on('connect_error', (e) => console.warn('[Socket] error:', e.message));

    return _socket;
  },

  get socket() { return _socket; },

  on(event, handler)  { _socket?.on(event, handler); },
  off(event, handler) { _socket?.off(event, handler); },
  emit(event, data)   { _socket?.emit(event, data); },

  disconnect() {
    _socket?.disconnect();
    _socket = null;
  },
};

window.socketClient = socketClient;
