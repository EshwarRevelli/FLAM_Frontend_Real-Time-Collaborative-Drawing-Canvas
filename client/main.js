(async function(){
  const room = 'default';
  const name = 'User-' + Math.floor(Math.random()*1000);
  await WS.connect(room, name);

  // Listen for server updates
  WS.on('room_state', state => state.history.forEach(op => CanvasApp.applyRemoteOp(op)));
  WS.on('stroke_chunk', data => CanvasApp.applyRemoteChunk(data));
  WS.on('stroke_end', op => CanvasApp.applyRemoteOp(op));
  WS.on('undo', op => CanvasApp.remoteUndo(op));
  WS.on('redo', op => CanvasApp.remoteRedo(op));
  
  // UI
  document.getElementById('color').addEventListener('input', e=> CanvasApp.setColor(e.target.value));
  document.getElementById('size').addEventListener('input', e=> CanvasApp.setSize(+e.target.value));
  document.getElementById('brush').addEventListener('click', ()=> CanvasApp.setTool('brush'));
  document.getElementById('eraser').addEventListener('click', ()=> CanvasApp.setTool('eraser'));
  document.getElementById('undo').addEventListener('click', ()=> CanvasApp.requestUndo());
  document.getElementById('redo').addEventListener('click', ()=> CanvasApp.requestRedo());
})();
