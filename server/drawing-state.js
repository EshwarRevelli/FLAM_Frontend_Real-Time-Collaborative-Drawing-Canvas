class DrawingState {
  constructor() {
    this.rooms = {};
  }

  ensureRoom(roomId) {
    if (!this.rooms[roomId]) this.rooms[roomId] = { users: {}, history: [], undone: [] };
    return this.rooms[roomId];
  }

  addUser(roomId, user) {
    const room = this.ensureRoom(roomId);
    room.users[user.id] = user;
  }

  removeUser(roomId, socketId) {
    const room = this.rooms[roomId];
    if (room) delete room.users[socketId];
  }

  addStroke(roomId, op) {
    const room = this.ensureRoom(roomId);
    room.history.push(op);
    room.undone = [];
  }

  undoLast(roomId) {
    const room = this.ensureRoom(roomId);
    if (room.history.length === 0) return null;
    const last = room.history.pop();
    room.undone.push(last);
    return last;
  }

  redoLast(roomId) {
    const room = this.ensureRoom(roomId);
    if (room.undone.length === 0) return null;
    const op = room.undone.pop();
    room.history.push(op);
    return op;
  }

  getState(roomId) {
    const room = this.ensureRoom(roomId);
    return {
      users: room.users,
      history: room.history,
    };
  }

  getUserRoom(socketId) {
    for (const [roomId, room] of Object.entries(this.rooms)) {
      if (room.users[socketId]) return roomId;
    }
    return null;
  }
}

module.exports = DrawingState;
