const WS = (function(){
  let socket = null;
  return {
    connect: (room, name) => {
      return new Promise(resolve => {
        socket = io();
        socket.emit('join', { room, name });
        socket.on('connect', () => resolve());
      });
    },
    on: (event, cb) => { if(socket) socket.on(event, cb); },
    emit: (event, data) => { if(socket) socket.emit(event, data); },
    id: () => socket ? socket.id : null
  };
})();
window.WS = WS;
