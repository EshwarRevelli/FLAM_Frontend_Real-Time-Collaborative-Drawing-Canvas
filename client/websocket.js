const WS = (function(){
  let socket = null;
  return {
    connect: (room, name) => {
      return new Promise(resolve => {
        if(socket && socket.connected) {
          // Leave previous room and join new one
          socket.emit('join', { room, name });
          resolve();
        } else {
          // Create new connection
          socket = io();
          socket.on('connect', () => {
            socket.emit('join', { room, name });
            resolve();
          });
        }
      });
    },
    on: (event, cb) => { if(socket) socket.on(event, cb); },
    emit: (event, data) => { if(socket) socket.emit(event, data); },
    id: () => socket ? socket.id : null,
    disconnect: () => { if(socket) socket.disconnect(); socket = null; }
  };
})();
window.WS = WS;
