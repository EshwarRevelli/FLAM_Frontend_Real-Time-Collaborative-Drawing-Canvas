(function(global){
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth - 250;
canvas.height = window.innerHeight;

let drawing = false, tool='brush', color='#000', size=4;
let currentPoints = [], currentOpId = null;
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

// Replay all strokes and cursors
function replayAll(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ops.sort((a,b)=>a.timestamp - b.timestamp); // Conflict resolution: sort by time
  for(const op of ops){
    if(op.type==='stroke') drawStroke(ctx, op);
  }
  drawCursors();
}

// Draw all user cursors
function drawCursors(){
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
canvas.addEventListener('pointerdown', e=>{
  drawing=true;
  const p={x:e.offsetX,y:e.offsetY};
  currentPoints=[p];
  currentOpId=genId();
});
canvas.addEventListener('pointermove', e=>{
  const p={x:e.offsetX,y:e.offsetY};
  if(drawing) currentPoints.push(p);

  // Draw live stroke
  if(drawing){
    ctx.save();
    drawStroke(ctx,{payload:{points:currentPoints.slice(-8), color:tool==='eraser'?'#fff':color, size, isEraser:tool==='eraser'}});
    ctx.restore();
    if(currentPoints.length%6===0 && window.WS){
      WS.emit('stroke_chunk',{opId:currentOpId, points:currentPoints.slice(-6), color, size, isEraser:tool==='eraser', timestamp:Date.now()});
    }
  }

  // Emit cursor position
  if(window.WS) WS.emit('cursor',{x:p.x, y:p.y});
});

window.addEventListener('pointerup', e=>{
  if(!drawing) return; drawing=false;
  const op={id:currentOpId, type:'stroke', payload:{points:currentPoints, color, size, isEraser:tool==='eraser'}, timestamp:Date.now()};
  ops.push(op);
  if(window.WS) WS.emit('stroke_end', op);
  currentPoints=[]; currentOpId=null;
});

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
}

function updateUsers(users){
  Object.assign(usersOnline, users);
  replayAll();
}

// --- Undo/Redo ---
function remoteUndo(op){ ops = ops.filter(o=>o.id!==op.id); replayAll(); }
function remoteRedo(op){ ops.push(op); replayAll(); }

function requestUndo(){ if(window.WS) WS.emit('undo',{}); }
function requestRedo(){ if(window.WS) WS.emit('redo',{}); }

// --- Tool setters ---
function setTool(t){ tool=t; }
function setColor(c){ color=c; }
function setSize(s){ size=s; }

// --- Export ---
global.CanvasApp={setTool,setColor,setSize,applyRemoteChunk,applyRemoteOp,setCursor,removeCursor,remoteUndo,remoteRedo,requestUndo,requestRedo,updateUsers};

})(window);
