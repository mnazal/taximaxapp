import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
  }

  connect() {
    if (!this.socket) {
      this.socket = io(import.meta.env.VITE_SOCKET_URL, {
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
        autoConnect: true
      });

      this.socket.on('connect', () => {
        console.log('Socket connected');
        this.isConnected = true;
      });

      this.socket.on('disconnect', () => {
        console.log('Socket disconnected');
        this.isConnected = false;
      });

      this.socket.on('error', (error) => {
        console.error('Socket error:', error);
      });
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  joinRoom(roomId) {
    if (this.socket && this.isConnected) {
      console.log('Joining room:', roomId);
      this.socket.emit('join_ride', roomId);
    }
  }

  leaveRoom(roomId) {
    if (this.socket && this.isConnected) {
      console.log('Leaving room:', roomId);
      this.socket.emit('leave_ride', roomId);
    }
  }

  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  emit(event, data) {
    if (this.socket && this.isConnected) {
      this.socket.emit(event, data);
    }
  }
}

// Create a single instance
const socketService = new SocketService();

export default socketService; 