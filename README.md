# Real-Time Collaborative Drawing Canvas

## 🖌️ Overview
This is a real-time multi-user collaborative drawing canvas built using **Vanilla JavaScript**, **HTML5 Canvas**, **Node.js**, and **Socket.io**. Multiple users can draw simultaneously on the same canvas with real-time synchronization, see each other's cursors, and perform global undo/redo operations.

---

## ⚡ Features

### Core Drawing Features
- **Brush Tool**: Draw with customizable color and stroke width (1-50px)
- **Eraser Tool**: Erase parts of the drawing
- **Shape Tools**: Draw rectangles and circles
- **Color Picker**: Full color selection with hex display
- **Adjustable Brush Size**: Real-time slider control

### Real-time Collaboration
- **Live Drawing Sync**: See other users' drawings as they draw (not after they finish)
- **User Cursors**: Real-time cursor positions with user names and colors
- **User Management**: Shows all online users with unique assigned colors
- **Room System**: Create and join different drawing rooms for isolated canvases

### Advanced Features
- **Global Undo/Redo**: Works across all users with conflict resolution
- **Save/Load Sessions**: Export and import canvas state as JSON files
- **Performance Metrics**: Real-time FPS counter and network latency display
- **Mobile Support**: Full touch support for drawing on mobile devices
- **Responsive Design**: Works seamlessly on desktop and mobile

---

## 🚀 Setup Instructions

### Prerequisites
- Node.js (v14 or higher)
- npm (comes with Node.js)

### Installation

1. Clone or download the repository:
```bash
cd "Flam folder"
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

4. Open your browser and navigate to:
```
http://localhost:3000
```

The server will start on port 3000 by default. You can change this by setting the `PORT` environment variable.

---

## 🧪 Testing with Multiple Users

### Method 1: Multiple Browser Windows
1. Open the application in one browser window
2. Open the same URL in another browser window (or incognito mode)
3. Both windows will be in the same room by default
4. Start drawing in one window and see it appear in real-time in the other

### Method 2: Different Devices
1. Find your local IP address (e.g., `192.168.1.100`)
2. Access the app from other devices on the same network: `http://192.168.1.100:3000`
3. All devices will see each other's drawings in real-time

### Method 3: Different Rooms
1. Enter a room name in the "Room" input field (e.g., "room1", "room2")
2. Click "Join Room"
3. Users in different rooms won't see each other's drawings
4. Users in the same room will see all drawings in real-time

### Testing Features
- **Real-time Drawing**: Draw in one window, verify it appears instantly in others
- **Cursor Tracking**: Move your mouse, verify cursor appears for other users
- **Undo/Redo**: Click undo in one window, verify it affects all users
- **Room Isolation**: Join different rooms, verify drawings are isolated
- **Save/Load**: Save a drawing, clear canvas, load it back
- **Mobile**: Open on mobile device, test touch drawing

---

## 📁 Project Structure

```
collaborative-canvas/
├── client/
│   ├── index.html          # Main HTML file
│   ├── style.css           # All styling
│   ├── canvas.js           # Canvas drawing logic
│   ├── websocket.js        # WebSocket client wrapper
│   └── main.js             # App initialization and UI handlers
├── server/
│   ├── server.js           # Express + Socket.io server
│   └── drawing-state.js    # Canvas state management
├── package.json
├── README.md
└── ARCHITECTURE.md
```

---

## 🎯 Known Limitations & Bugs

### Current Limitations
1. **No Drawing Persistence**: Drawings are lost when the server restarts (state is in-memory only)
2. **No User Authentication**: Anyone can join any room with any name
3. **Limited Shape Tools**: Only rectangle and circle shapes are available
4. **No Text Tool**: Text input is not yet implemented
5. **No Image Support**: Cannot import/export images, only JSON state
6. **Undo/Redo Conflict**: If two users undo simultaneously, the last operation wins (no queue)

### Known Bugs
1. **Shape Preview**: Shape preview may flicker on slow devices during drawing
2. **Mobile Performance**: High brush sizes (>30px) may cause lag on older mobile devices
3. **Room Switching**: When switching rooms, there's a brief moment where old drawings may flash
4. **Large Drawings**: Very large drawings (1000+ operations) may cause performance issues

### Future Improvements
- Add database persistence for drawings
- Implement user authentication
- Add more shape tools (line, polygon, etc.)
- Add text tool with font selection
- Implement image import/export
- Add drawing layers
- Improve undo/redo with operation queue
- Add drawing history timeline

---

## ⏱️ Time Spent

- **Initial Setup**: 2 hours
- **Core Drawing Features**: 4 hours
- **Real-time Synchronization**: 3 hours
- **Undo/Redo Implementation**: 2 hours
- **Room System**: 1 hour
- **Shape Tools**: 2 hours
- **Save/Load**: 1 hour
- **Performance Metrics**: 1 hour
- **Mobile Support**: 2 hours
- **UI/UX Improvements**: 2 hours
- **Documentation**: 2 hours
- **Testing & Bug Fixes**: 2 hours

**Total**: ~24 hours

---

## 🛠️ Technical Stack

- **Frontend**: Vanilla JavaScript (ES6+), HTML5 Canvas API
- **Backend**: Node.js, Express.js
- **Real-time**: Socket.io
- **Styling**: Pure CSS (no frameworks)
- **No External Drawing Libraries**: All canvas operations implemented from scratch

---

## 📝 License

This project is created for educational purposes as part of an assignment.

---

## 👤 Author

Created as a collaborative drawing canvas assignment demonstrating:
- Canvas API mastery
- Real-time WebSocket communication
- State synchronization
- Conflict resolution strategies
- Performance optimization
