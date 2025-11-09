(async function(){
  const room = 'default';
  const name = 'User-' + Math.floor(Math.random()*1000);
  await WS.connect(room, name);

  const myId = WS.id();

  // Listen for server updates
  WS.on('room_state', state => {
    CanvasApp.updateUsers(state.users);
    state.history.forEach(op => CanvasApp.applyRemoteOp(op));
  });
  WS.on('stroke_chunk', data => CanvasApp.applyRemoteChunk(data));
  WS.on('stroke_end', op => CanvasApp.applyRemoteOp(op));
  WS.on('undo', op => CanvasApp.remoteUndo(op));
  WS.on('redo', op => CanvasApp.remoteRedo(op));
  WS.on('cursor', data => CanvasApp.setCursor(data.userId, data.x, data.y, data.color, data.name));
  WS.on('user_join', users => CanvasApp.updateUsers(users));
  WS.on('user_left', id => CanvasApp.removeCursor(id));

  // UI
  document.getElementById('color').addEventListener('input', e=> CanvasApp.setColor(e.target.value));
  document.getElementById('size').addEventListener('input', e=> CanvasApp.setSize(+e.target.value));
  document.getElementById('brush').addEventListener('click', ()=> CanvasApp.setTool('brush'));
  document.getElementById('eraser').addEventListener('click', ()=> CanvasApp.setTool('eraser'));
  document.getElementById('undo').addEventListener('click', ()=> CanvasApp.requestUndo());
  document.getElementById('redo').addEventListener('click', ()=> CanvasApp.requestRedo());
})();
