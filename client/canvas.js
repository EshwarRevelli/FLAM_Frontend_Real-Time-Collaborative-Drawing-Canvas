(function(global){
let canvas, ctx;

function initCanvas() {
  canvas = document.getElementById('canvas');
  if (!canvas) {
    console.error('Canvas element not found!');
    return false;
  }
  ctx = canvas.getContext('2d');
  if (!ctx) {
    console.error('Could not get 2d context!');
    return false;
  }
  return true;
}

function resizeCanvas() {
  if (!canvas) return;
  const isMobile = window.innerWidth <= 768;
  canvas.width = isMobile ? window.innerWidth : window.innerWidth - 280;
  canvas.height = window.innerHeight;
  replayAll();
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (initCanvas()) {
      resizeCanvas();
      setupEventListeners();
    }
  });
} else {
  if (initCanvas()) {
    resizeCanvas();
    setupEventListeners();
  }
}

window.addEventListener('resize', resizeCanvas);
// Handle orientation change on mobile
window.addEventListener('orientationchange', () => {
  setTimeout(resizeCanvas, 100);
});

// Get canvas coordinates from event (works for both mouse and touch)
function getCanvasCoords(e) {
  if (!canvas) return {x: 0, y: 0};
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  
  let clientX, clientY;
  if (e.touches && e.touches.length > 0) {
    clientX = e.touches[0].clientX;
    clientY = e.touches[0].clientY;
  } else if (e.changedTouches && e.changedTouches.length > 0) {
    clientX = e.changedTouches[0].clientX;
    clientY = e.changedTouches[0].clientY;
  } else {
    clientX = e.clientX;
    clientY = e.clientY;
  }
  
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY
  };
}

let drawing = false, tool='brush', color='#000', size=4;
let currentPoints = [], currentOpId = null;
let shapeStart = null; // For rectangle/circle drawing
const ops = [], cursors = {}; // cursors: userId -> {x,y,color,name}
const usersOnline = {}; // userId -> {name,color}

// Generate unique operation ID
function genId(){ return 'op-'+Math.random().toString(36).substr(2,9); }

// Draw a stroke
function drawStroke(ctx, op){
  const { points, color, size, isEraser } = op.payload;
  if(points.length<2) return;
  ctx.strokeStyle = isEraser ? '#fff' : color;
  ctx.lineWidth = size;
  ctx.lineJoin='round';
  ctx.lineCap='round';
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for(let i=1;i<points.length;i++){
    const midX = (points[i-1].x+points[i].x)/2;
    const midY = (points[i-1].y+points[i].y)/2;
    ctx.quadraticCurveTo(points[i-1].x, points[i-1].y, midX, midY);
  }
  ctx.stroke();
}

// Draw a shape (rectangle or circle)
function drawShape(ctx, op){
  const { shapeType, start, end, color, size } = op.payload;
  if(!start || !end) return;
  
  ctx.strokeStyle = color;
  ctx.lineWidth = size;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  
  const width = end.x - start.x;
  const height = end.y - start.y;
  
  if(shapeType === 'rectangle'){
    ctx.strokeRect(start.x, start.y, width, height);
  } else if(shapeType === 'circle'){
    const centerX = start.x + width/2;
    const centerY = start.y + height/2;
    const radius = Math.sqrt(width*width + height*height) / 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2*Math.PI);
    ctx.stroke();
  }
}

// Replay all strokes and cursors
function replayAll(){
  if (!canvas || !ctx) return;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ops.sort((a,b)=>a.timestamp - b.timestamp); // Conflict resolution: sort by time
  for(const op of ops){
    if(op.type==='stroke') drawStroke(ctx, op);
    else if(op.type==='shape') drawShape(ctx, op);
  }
  drawCursors();
}

// Draw all user cursors
function drawCursors(){
  if (!ctx) return;
  for(const [id,c] of Object.entries(cursors)){
    ctx.beginPath();
    ctx.arc(c.x,c.y,4,0,2*Math.PI);
    ctx.fillStyle=c.color||'#000';
    ctx.fill();
    ctx.font='12px sans-serif';
    ctx.fillText(c.name||'User', c.x+8, c.y);
  }
}

// --- EVENTS ---
function handleStart(e) {
  if (!canvas || !ctx) return;
  e.preventDefault();
  e.stopPropagation();
  drawing = true;
  const p = getCanvasCoords(e);
  if (window.WS) WS.emit('cursor', {x: p.x, y: p.y});
  
  if(tool === 'rectangle' || tool === 'circle'){
    shapeStart = p;
    currentOpId = genId();
  } else {
    currentPoints = [p];
    currentOpId = genId();
  }
}

function handleMove(e) {
  if (!canvas || !ctx) return;
  e.preventDefault();
  const p = getCanvasCoords(e);
  
  if (drawing) {
    if(tool === 'rectangle' || tool === 'circle'){
      // Preview shape
      replayAll();
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = size;
      ctx.setLineDash([5, 5]);
      if(tool === 'rectangle'){
        ctx.strokeRect(shapeStart.x, shapeStart.y, p.x - shapeStart.x, p.y - shapeStart.y);
      } else {
        const width = p.x - shapeStart.x;
        const height = p.y - shapeStart.y;
        const centerX = shapeStart.x + width/2;
        const centerY = shapeStart.y + height/2;
        const radius = Math.sqrt(width*width + height*height) / 2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2*Math.PI);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.restore();
    } else {
      currentPoints.push(p);
      
      // Draw live stroke preview
      if (currentPoints.length >= 2) {
        ctx.save();
        ctx.strokeStyle = tool === 'eraser' ? '#fff' : color;
        ctx.lineWidth = size;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(currentPoints[currentPoints.length - 2].x, currentPoints[currentPoints.length - 2].y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.restore();
      }
      
      // Emit chunks for collaboration
      if (currentPoints.length % 6 === 0 && window.WS) {
        WS.emit('stroke_chunk', {opId: currentOpId, points: currentPoints.slice(-6), color, size, isEraser: tool === 'eraser', timestamp: Date.now()});
      }
    }
  }

  // Emit cursor position
  if (window.WS) {
    WS.emit('cursor', {x: p.x, y: p.y});
  }
}

function handleEnd(e) {
  if (!canvas || !ctx) return;
  e.preventDefault();
  if (!drawing) return;
  
  drawing = false;
  const p = getCanvasCoords(e);
  if (window.WS) WS.emit('cursor', {x: p.x, y: p.y});
  
  if(tool === 'rectangle' || tool === 'circle'){
    if(shapeStart){
      const op = {
        id: currentOpId,
        type: 'shape',
        payload: {
          shapeType: tool,
          start: {...shapeStart},
          end: p,
          color,
          size
        },
        timestamp: Date.now()
      };
      ops.push(op);
      if (window.WS) WS.emit('stroke_end', op);
      replayAll();
    }
    shapeStart = null;
  } else if (currentPoints.length > 0) {
    const op = {id: currentOpId, type: 'stroke', payload: {points: [...currentPoints], color, size, isEraser: tool === 'eraser'}, timestamp: Date.now()};
    ops.push(op);
    if (window.WS) WS.emit('stroke_end', op);
    replayAll();
  }
  
  currentPoints = [];
  currentOpId = null;
}

function setupEventListeners() {
  if (!canvas) return;
  
  // Mouse events
  canvas.addEventListener('mousedown', handleStart);
  canvas.addEventListener('mousemove', handleMove);
  window.addEventListener('mouseup', handleEnd);

  // Touch events (for mobile)
  canvas.addEventListener('touchstart', handleStart, {passive: false});
  canvas.addEventListener('touchmove', handleMove, {passive: false});
  canvas.addEventListener('touchend', handleEnd, {passive: false});
  canvas.addEventListener('touchcancel', handleEnd, {passive: false});

  // Pointer events (fallback)
  canvas.addEventListener('pointerdown', handleStart);
  canvas.addEventListener('pointermove', handleMove);
  window.addEventListener('pointerup', handleEnd);
}

// --- Remote ---
function applyRemoteChunk(data){
  const {opId, points, color, size, isEraser, userId, timestamp}=data;
  let existing=ops.find(o=>o.id===opId);
  if(!existing){ existing={id:opId,userId,type:'stroke',payload:{points:[],color,size,isEraser}, timestamp}; ops.push(existing); }
  existing.payload.points.push(...points);
  drawStroke(ctx, existing);
}

function applyRemoteOp(op){ ops.push(op); replayAll(); }

function setCursor(userId,x,y,color,name){
  cursors[userId]={x,y,color,name};
  replayAll();
}

function removeCursor(userId){
  delete cursors[userId];
  delete usersOnline[userId];
  replayAll();
  updateUsersList();
}

function updateUsers(users){
  Object.assign(usersOnline, users);
  replayAll();
  updateUsersList();
}

function updateUsersList(){
  const container = document.getElementById('users-container');
  if(!container) return;
  container.innerHTML = '';
  for(const [id, user] of Object.entries(usersOnline)){
    const div = document.createElement('div');
    div.className = 'user-item';
    div.innerHTML = `<span class="user-color" style="background: ${user.color || '#000'}"></span><span>${user.name || 'User'}</span>`;
    container.appendChild(div);
  }
}

// --- Undo/Redo ---
function remoteUndo(op){ 
  const index = ops.findIndex(o => o.id === op.id);
  if(index !== -1) ops.splice(index, 1);
  replayAll(); 
}
function remoteRedo(op){ ops.push(op); replayAll(); }

function requestUndo(){ if(window.WS) WS.emit('undo',{}); }
function requestRedo(){ if(window.WS) WS.emit('redo',{}); }

// --- Tool setters ---
function setTool(t){ tool=t; }
function setColor(c){ color=c; }
function setSize(s){ size=s; }

// --- Save/Load ---
function saveCanvas(){
  const data = {
    ops: ops,
    timestamp: Date.now(),
    version: '1.0'
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `canvas-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function loadCanvas(data){
  if(!data || !data.ops) return false;
  ops.length = 0;
  ops.push(...data.ops);
  replayAll();
  return true;
}

function getOps(){ return ops; }
function clearCanvas(){
  ops.length = 0;
  Object.keys(cursors).forEach(key => delete cursors[key]);
  Object.keys(usersOnline).forEach(key => delete usersOnline[key]);
  replayAll();
  updateUsersList();
}

// --- Export ---
global.CanvasApp={
  setTool,setColor,setSize,
  applyRemoteChunk,applyRemoteOp,
  setCursor,removeCursor,
  remoteUndo,remoteRedo,requestUndo,requestRedo,
  updateUsers,updateUsersList,
  saveCanvas,loadCanvas,getOps,clearCanvas
};

})(window);
