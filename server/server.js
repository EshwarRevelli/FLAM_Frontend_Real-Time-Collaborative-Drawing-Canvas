const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const DrawingState = require('./drawing-state');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const drawingState = new DrawingState();

app.use(express.static(path.join(__dirname, '../client')));

io.on('connection', socket => {
  console.log('Client connected:', socket.id);

  socket.on('join', ({ room, name }) => {
    socket.join(room);
    const user = { id: socket.id, name, color: randomColor() };
    drawingState.addUser(room, user);

    // send full room state
    socket.emit('room_state', drawingState.getState(room));
    socket.to(room).emit('user_join', drawingState.getState(room).users);
  });

  socket.on('stroke_chunk', data => {
    const room = drawingState.getUserRoom(socket.id);
    if(!room) return;
    data.userId = socket.id;
    socket.to(room).emit('stroke_chunk', data);
  });

  socket.on('stroke_end', op => {
    const room = drawingState.getUserRoom(socket.id);
    if(!room) return;
    drawingState.addStroke(room, op);
    socket.to(room).emit('stroke_end', op);
  });

  socket.on('cursor', data => {
    const room = drawingState.getUserRoom(socket.id);
    if(!room) return;
    const user = drawingState.rooms[room].users[socket.id];
    socket.to(room).emit('cursor', { userId: socket.id, x:data.x, y:data.y, color:user.color, name:user.name });
  });

  socket.on('undo', () => {
    const room = drawingState.getUserRoom(socket.id);
    if(!room) return;
    const op = drawingState.undoLast(room);
    if(op) io.in(room).emit('undo', op);
  });

  socket.on('redo', () => {
    const room = drawingState.getUserRoom(socket.id);
    if(!room) return;
    const op = drawingState.redoLast(room);
    if(op) io.in(room).emit('redo', op);
  });

  socket.on('disconnect', () => {
    const room = drawingState.getUserRoom(socket.id);
    if(room){
      drawingState.removeUser(room, socket.id);
      socket.to(room).emit('user_left', socket.id);
    }
    console.log('Client disconnected:', socket.id);
  });
});

function randomColor(){
  const colors = ['#e6194b','#3cb44b','#ffe119','#4363d8','#f58231','#911eb4'];
  return colors[Math.floor(Math.random()*colors.length)];
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
