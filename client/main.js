(async function(){
  let currentRoom = 'default';
  let currentName = 'User-' + Math.floor(Math.random()*1000);
  let latency = 0;
  let fps = 0;
  let lastFrameTime = performance.now();
  let frameCount = 0;
  
  // Performance monitoring
  function updateFPS() {
    frameCount++;
    const now = performance.now();
    if(now - lastFrameTime >= 1000) {
      fps = Math.round((frameCount * 1000) / (now - lastFrameTime));
      frameCount = 0;
      lastFrameTime = now;
      document.getElementById('fps-display').textContent = fps;
    }
    requestAnimationFrame(updateFPS);
  }
  updateFPS();
  
  // Latency measurement
  function measureLatency() {
    if(!window.WS) return;
    const start = performance.now();
    WS.emit('ping', {timestamp: start});
  }
  
  WS.on('pong', (data) => {
    latency = Math.round(performance.now() - data.timestamp);
    document.getElementById('latency-display').textContent = latency + 'ms';
  });
  
  setInterval(measureLatency, 1000);
  
  // Connect to default room
  await WS.connect(currentRoom, currentName);
  const myId = WS.id();

  // Listen for server updates
  WS.on('room_state', state => {
    CanvasApp.updateUsers(state.users);
    CanvasApp.clearCanvas();
    state.history.forEach(op => CanvasApp.applyRemoteOp(op));
    updateUserCount();
  });
  
  WS.on('stroke_chunk', data => CanvasApp.applyRemoteChunk(data));
  WS.on('stroke_end', op => CanvasApp.applyRemoteOp(op));
  WS.on('undo', op => CanvasApp.remoteUndo(op));
  WS.on('redo', op => CanvasApp.remoteRedo(op));
  WS.on('cursor', data => CanvasApp.setCursor(data.userId, data.x, data.y, data.color, data.name));
  WS.on('user_join', users => {
    CanvasApp.updateUsers(users);
    updateUserCount();
  });
  WS.on('user_left', id => {
    CanvasApp.removeCursor(id);
    updateUserCount();
  });

  function updateUserCount() {
    const users = document.getElementById('users-container');
    const userCount = users ? users.children.length : 0;
    document.getElementById('user-count').textContent = userCount;
  }

  // Room Management
  const roomInput = document.getElementById('room-input');
  const joinRoomBtn = document.getElementById('join-room');
  const currentRoomDisplay = document.getElementById('current-room');
  
  joinRoomBtn.addEventListener('click', async () => {
    const newRoom = roomInput.value.trim() || 'default';
    if(newRoom === currentRoom) return;
    
    currentRoom = newRoom;
    currentRoomDisplay.textContent = `Room: ${currentRoom}`;
    CanvasApp.clearCanvas();
    await WS.connect(currentRoom, currentName);
    updateUserCount();
  });
  
  roomInput.addEventListener('keypress', async (e) => {
    if(e.key === 'Enter') {
      joinRoomBtn.click();
    }
  });

  // UI - Drawing Tools
  const colorInput = document.getElementById('color');
  const colorDisplay = document.getElementById('color-display');
  const sizeInput = document.getElementById('size');
  const sizeDisplay = document.getElementById('size-display');
  const brushBtn = document.getElementById('brush');
  const eraserBtn = document.getElementById('eraser');
  const rectangleBtn = document.getElementById('rectangle');
  const circleBtn = document.getElementById('circle');
  const toolButtons = [brushBtn, eraserBtn, rectangleBtn, circleBtn];

  colorInput.addEventListener('input', e => {
    const color = e.target.value;
    CanvasApp.setColor(color);
    colorDisplay.textContent = color.toUpperCase();
  });

  sizeInput.addEventListener('input', e => {
    const size = +e.target.value;
    CanvasApp.setSize(size);
    sizeDisplay.textContent = size;
  });

  function setActiveTool(activeBtn) {
    toolButtons.forEach(btn => btn.classList.remove('active'));
    activeBtn.classList.add('active');
  }

  brushBtn.addEventListener('click', () => {
    CanvasApp.setTool('brush');
    setActiveTool(brushBtn);
  });

  eraserBtn.addEventListener('click', () => {
    CanvasApp.setTool('eraser');
    setActiveTool(eraserBtn);
  });

  rectangleBtn.addEventListener('click', () => {
    CanvasApp.setTool('rectangle');
    setActiveTool(rectangleBtn);
  });

  circleBtn.addEventListener('click', () => {
    CanvasApp.setTool('circle');
    setActiveTool(circleBtn);
  });

  document.getElementById('undo').addEventListener('click', () => CanvasApp.requestUndo());
  document.getElementById('redo').addEventListener('click', () => CanvasApp.requestRedo());

  // Save/Load
  document.getElementById('save').addEventListener('click', () => {
    CanvasApp.saveCanvas();
  });

  const loadBtn = document.getElementById('load');
  const loadFile = document.getElementById('load-file');
  
  loadBtn.addEventListener('click', () => {
    loadFile.click();
  });
  
  loadFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if(!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if(CanvasApp.loadCanvas(data)) {
          // Broadcast loaded operations
          data.ops.forEach(op => {
            if(window.WS) WS.emit('stroke_end', op);
          });
          alert('Canvas loaded successfully!');
        } else {
          alert('Failed to load canvas data.');
        }
      } catch(err) {
        alert('Error loading file: ' + err.message);
      }
    };
    reader.readAsText(file);
    loadFile.value = '';
  });

  // Initialize color display
  colorDisplay.textContent = colorInput.value.toUpperCase();

  // Mobile toggle functionality
  const mobileToggle = document.getElementById('mobile-toggle');
  const toolsPanel = document.getElementById('tools');
  const mobileOverlay = document.getElementById('mobile-overlay');
  
  function toggleMobilePanel() {
    toolsPanel.classList.toggle('mobile-open');
    mobileToggle.classList.toggle('active');
    if (mobileOverlay) {
      mobileOverlay.classList.toggle('active');
    }
    document.body.classList.toggle('no-scroll');
  }
  
  if (mobileToggle && toolsPanel) {
    mobileToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMobilePanel();
    });

    if (mobileOverlay) {
      mobileOverlay.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
          toggleMobilePanel();
        }
      });
    }

    document.addEventListener('click', (e) => {
      if (window.innerWidth <= 768) {
        if (!toolsPanel.contains(e.target) && !mobileToggle.contains(e.target)) {
          if (toolsPanel.classList.contains('mobile-open')) {
            toggleMobilePanel();
          }
        }
      }
    });

    toolsPanel.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }
  
  // Initial user count update
  updateUserCount();
})();
