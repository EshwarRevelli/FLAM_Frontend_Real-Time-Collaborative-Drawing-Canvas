# Architecture Documentation

## 📊 Data Flow Diagram

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Client 1  │         │   Client 2  │         │   Client N  │
│  (Browser)  │         │  (Browser)  │         │  (Browser)  │
└──────┬──────┘         └──────┬──────┘         └──────┬──────┘
       │                       │                       │
       │  WebSocket            │  WebSocket            │  WebSocket
       │  (Socket.io)          │  (Socket.io)          │  (Socket.io)
       │                       │                       │
       └───────────────────────┼───────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │   Node.js Server    │
                    │  (Express + Socket) │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │  DrawingState      │
                    │  (In-Memory Store) │
                    └─────────────────────┘
```

### Drawing Event Flow

1. **User draws on canvas** → `handleStart()` → `handleMove()` → `handleEnd()`
2. **Local preview** → Drawn directly to canvas for immediate feedback
3. **Event serialization** → Drawing data converted to JSON
4. **WebSocket emission** → `WS.emit('stroke_end', op)` or `WS.emit('stroke_chunk', data)`
5. **Server receives** → `socket.on('stroke_end')` or `socket.on('stroke_chunk')`
6. **State update** → `drawingState.addStroke(room, op)`
7. **Broadcast** → `socket.to(room).emit('stroke_end', op)`
8. **Other clients receive** → `WS.on('stroke_end')` → `CanvasApp.applyRemoteOp(op)`
9. **Canvas redraw** → `replayAll()` → All operations redrawn in order

---

## 🔌 WebSocket Protocol

### Client → Server Messages

#### `join`
Join a room and initialize connection.
```javascript
{
  room: string,  // Room identifier
  name: string   // User display name
}
```

#### `stroke_chunk`
Stream drawing data in chunks for real-time preview.
```javascript
{
  opId: string,           // Unique operation ID
  points: Array<{x, y}>,  // Array of coordinate points
  color: string,          // Hex color code
  size: number,           // Brush size in pixels
  isEraser: boolean,     // Whether this is an eraser stroke
  timestamp: number       // Unix timestamp
}
```

#### `stroke_end`
Finalize a drawing operation.
```javascript
{
  id: string,             // Unique operation ID
  type: 'stroke' | 'shape',
  payload: {
    // For strokes:
    points: Array<{x, y}>,
    color: string,
    size: number,
    isEraser: boolean,
    
    // For shapes:
    shapeType: 'rectangle' | 'circle',
    start: {x, y},
    end: {x, y}
  },
  timestamp: number
}
```

#### `cursor`
Update cursor position for other users.
```javascript
{
  x: number,  // Canvas X coordinate
  y: number   // Canvas Y coordinate
}
```

#### `undo`
Request to undo the last operation globally.
```javascript
{}  // No data needed
```

#### `redo`
Request to redo the last undone operation globally.
```javascript
{}  // No data needed
```

#### `ping`
Measure network latency.
```javascript
{
  timestamp: number  // Client timestamp for round-trip calculation
}
```

### Server → Client Messages

#### `room_state`
Initial room state sent when joining.
```javascript
{
  users: {
    [userId]: {
      id: string,
      name: string,
      color: string
    }
  },
  history: Array<Operation>  // All drawing operations
}
```

#### `stroke_chunk`
Real-time drawing chunk from another user.
```javascript
{
  opId: string,
  points: Array<{x, y}>,
  color: string,
  size: number,
  isEraser: boolean,
  userId: string,      // Added by server
  timestamp: number
}
```

#### `stroke_end`
Completed drawing operation from another user.
```javascript
{
  id: string,
  type: 'stroke' | 'shape',
  payload: {...},
  timestamp: number
}
```

#### `cursor`
Cursor position update from another user.
```javascript
{
  userId: string,
  x: number,
  y: number,
  color: string,  // User's assigned color
  name: string    // User's display name
}
```

#### `user_join`
Notification when a user joins the room.
```javascript
{
  [userId]: {
    id: string,
    name: string,
    color: string
  }
}
```

#### `user_left`
Notification when a user leaves.
```javascript
userId: string
```

#### `undo`
Global undo operation.
```javascript
{
  id: string,      // Operation ID to remove
  type: string,
  payload: {...},
  timestamp: number
}
```

#### `redo`
Global redo operation.
```javascript
{
  id: string,
  type: string,
  payload: {...},
  timestamp: number
}
```

#### `pong`
Latency measurement response.
```javascript
{
  timestamp: number  // Echo of client's timestamp
}
```

---

## 🔄 Undo/Redo Strategy

### Global Undo/Redo Implementation

The undo/redo system works globally across all users using a **Last-Write-Wins** strategy with timestamp-based conflict resolution.

#### Server-Side State Management

```javascript
// drawing-state.js
class DrawingState {
  rooms = {
    [roomId]: {
      users: {},           // Active users
      history: [],         // Applied operations (stack)
      undone: []          // Undone operations (stack)
    }
  }
}
```

#### Undo Flow

1. **User clicks Undo** → `requestUndo()` → `WS.emit('undo')`
2. **Server receives** → `drawingState.undoLast(room)`
3. **Server pops last operation** from `history` → pushes to `undone`
4. **Server broadcasts** → `io.in(room).emit('undo', op)`
5. **All clients receive** → `remoteUndo(op)` → Remove operation from local `ops` array
6. **Canvas redraws** → `replayAll()` → All remaining operations redrawn

#### Redo Flow

1. **User clicks Redo** → `requestRedo()` → `WS.emit('redo')`
2. **Server receives** → `drawingState.redoLast(room)`
3. **Server pops from `undone`** → pushes to `history`
4. **Server broadcasts** → `io.in(room).emit('redo', op)`
5. **All clients receive** → `remoteRedo(op)` → Add operation to local `ops` array
6. **Canvas redraws** → `replayAll()`

#### Conflict Resolution

**Scenario**: Two users undo simultaneously

1. Both undo requests arrive at server
2. Server processes them sequentially (Socket.io is single-threaded)
3. **Last-Write-Wins**: The second undo removes the operation that was already undone
4. Both clients receive both undo events
5. Clients check if operation exists before removing (idempotent)

**Limitation**: If User A undoes Operation X, and User B undoes Operation Y (which was after X), the order may be confusing. This is a known limitation.

**Improvement Opportunity**: Implement an operation queue with sequence numbers for proper ordering.

---

## ⚡ Performance Decisions

### 1. Chunked Stroke Streaming

**Decision**: Send drawing data in chunks during drawing, not just at the end.

**Why**:
- Provides real-time feedback (users see drawings as they happen)
- Reduces perceived latency
- Better user experience

**Implementation**:
- Every 6 points, emit a `stroke_chunk` event
- Remote clients accumulate chunks into the same operation
- Final `stroke_end` completes the operation

**Trade-off**: More network traffic, but better UX.

### 2. Canvas Redrawing Strategy

**Decision**: Redraw entire canvas on every operation (`replayAll()`).

**Why**:
- Simpler implementation
- Guarantees consistency
- Handles overlapping operations correctly

**Optimization**: Only redraw when necessary (new operation, undo, redo).

**Future Improvement**: Use canvas layers or offscreen canvas for better performance with many operations.

### 3. Operation Sorting

**Decision**: Sort operations by timestamp before redrawing.

**Why**:
- Ensures correct drawing order
- Handles network reordering
- Conflict resolution for simultaneous operations

**Implementation**:
```javascript
ops.sort((a,b) => a.timestamp - b.timestamp);
```

### 4. Coordinate Scaling

**Decision**: Scale coordinates based on canvas size vs. display size.

**Why**:
- Canvas internal size may differ from CSS size
- Ensures accurate touch/mouse coordinates
- Handles window resizing correctly

**Implementation**:
```javascript
const scaleX = canvas.width / rect.width;
const scaleY = canvas.height / rect.height;
x = (clientX - rect.left) * scaleX;
```

### 5. Path Optimization

**Decision**: Use quadratic curves for smooth stroke rendering.

**Why**:
- Smoother lines than straight segments
- Fewer points needed
- Better visual quality

**Implementation**:
```javascript
ctx.quadraticCurveTo(prevX, prevY, midX, midY);
```

### 6. In-Memory State

**Decision**: Store state in memory (no database).

**Why**:
- Faster access
- Simpler implementation
- Sufficient for assignment requirements

**Trade-off**: State lost on server restart.

---

## 🎨 Canvas Operations

### Drawing a Stroke

1. **Capture Points**: Store mouse/touch coordinates in `currentPoints` array
2. **Live Preview**: Draw line segments directly to canvas during `handleMove`
3. **Emit Chunks**: Send every 6 points to server for real-time sync
4. **Finalize**: On `handleEnd`, create operation object and emit `stroke_end`
5. **Store**: Add operation to `ops` array
6. **Redraw**: Call `replayAll()` to ensure consistency

### Drawing a Shape

1. **Start**: Store starting point in `shapeStart`
2. **Preview**: During `handleMove`, redraw all + show dashed preview shape
3. **Finalize**: On `handleEnd`, create shape operation with start/end points
4. **Store & Sync**: Same as stroke

### Eraser

- Same as brush, but `isEraser: true`
- Renders as white strokes (assumes white background)
- Could be improved with `globalCompositeOperation = 'destination-out'`

---

## 🔀 Conflict Resolution

### Simultaneous Drawing

**Problem**: Two users draw at the same time in overlapping areas.

**Solution**: Timestamp-based ordering
- Each operation has a `timestamp`
- Operations sorted by timestamp before rendering
- Last operation drawn on top (correct behavior)

### Network Reordering

**Problem**: Network packets arrive out of order.

**Solution**: Timestamp sorting + operation IDs
- Operations have unique IDs
- Chunks accumulate into same operation (by ID)
- Final rendering sorts by timestamp

### Undo Conflicts

**Problem**: Two users undo simultaneously.

**Solution**: Last-Write-Wins
- Server processes undos sequentially
- Clients check if operation exists before removing (idempotent)
- May result in unexpected behavior (known limitation)

---

## 📱 Mobile Support

### Touch Event Handling

- Uses `touchstart`, `touchmove`, `touchend` events
- Prevents default touch behaviors (scrolling, zooming)
- Calculates coordinates using `getBoundingClientRect()`

### Responsive Design

- Toolbar becomes collapsible overlay on mobile
- Canvas takes full screen on mobile
- Larger touch targets for buttons
- Prevents zoom with viewport meta tag

### Performance

- Touch events may fire more frequently than mouse events
- Chunking helps reduce network traffic
- Canvas redrawing optimized for mobile devices

---

## 🗄️ State Management

### Client State

```javascript
{
  ops: Array<Operation>,        // All drawing operations
  cursors: {[userId]: Cursor},  // Other users' cursors
  usersOnline: {[userId]: User}, // Online users
  tool: 'brush' | 'eraser' | 'rectangle' | 'circle',
  color: string,
  size: number,
  drawing: boolean,
  currentPoints: Array<Point>,
  shapeStart: Point | null
}
```

### Server State

```javascript
{
  rooms: {
    [roomId]: {
      users: {[socketId]: User},
      history: Array<Operation>,  // Applied operations
      undone: Array<Operation>    // Undone operations
    }
  }
}
```

### Operation Structure

```javascript
{
  id: string,              // Unique operation ID
  type: 'stroke' | 'shape',
  payload: {
    // Stroke payload:
    points: Array<{x: number, y: number}>,
    color: string,
    size: number,
    isEraser: boolean,
    
    // Shape payload:
    shapeType: 'rectangle' | 'circle',
    start: {x: number, y: number},
    end: {x: number, y: number}
  },
  timestamp: number,       // Unix timestamp
  userId?: string          // Added by server for chunks
}
```

---

## 🔒 Security Considerations

### Current State
- No authentication
- No input validation
- No rate limiting
- Room names not sanitized

### Potential Issues
1. **Room Name Injection**: Malicious room names could cause issues
2. **Operation Spam**: No limit on operation frequency
3. **Large Payloads**: No size limits on drawing data

### Future Improvements
- Sanitize room names
- Rate limit operations per user
- Validate operation payloads
- Add authentication
- Implement room permissions

---

## 📈 Scalability

### Current Limitations
- In-memory state (lost on restart)
- Single server instance
- No horizontal scaling support

### Scaling Strategies

1. **Database Persistence**: Store operations in database
2. **Redis Pub/Sub**: Use Redis for multi-server state sync
3. **Operation Batching**: Batch operations to reduce network traffic
4. **Canvas Layers**: Use layers for better performance
5. **CDN**: Serve static files via CDN

---

## 🐛 Error Handling

### Client-Side
- Canvas initialization checks
- WebSocket connection error handling
- File load error handling
- Null checks before operations

### Server-Side
- Room existence checks
- User room validation
- Operation validation (basic)

### Network Issues
- Socket.io handles reconnection automatically
- Operations may be lost during disconnection (no retry mechanism)

---

## 📝 Code Organization

### Separation of Concerns

- **canvas.js**: Pure canvas drawing logic, no UI
- **websocket.js**: WebSocket abstraction, no business logic
- **main.js**: UI event handlers, app initialization
- **server.js**: WebSocket server, routing
- **drawing-state.js**: State management, no networking

### Function Naming
- `handle*`: Event handlers
- `draw*`: Canvas drawing functions
- `apply*`: Apply remote operations
- `request*`: Request server actions
- `update*`: Update UI state

---

This architecture document provides a comprehensive overview of the system's design, data flow, and implementation decisions.