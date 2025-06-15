const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

// roomId → Set of WebSocket connections
const rooms = new Map();

wss.on('connection', (socket, req) => {
  // For demo, grab roomId from a query param ?room=room1
  const url = new URL(req.url, 'http://localhost');
  const roomId = url.searchParams.get('room') || 'lobby';

  // Add socket to the room
  if (!rooms.has(roomId)) rooms.set(roomId, new Set());
  rooms.get(roomId).add(socket);

  socket.on('message', (data) => {
    // Broadcast to everyone else in the same room
    for (const client of rooms.get(roomId)) {
      if (client !== socket && client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  });

  socket.on('close', () => {
    rooms.get(roomId).delete(socket);
    if (rooms.get(roomId).size === 0) rooms.delete(roomId);
  });
});

console.log('WebSocket server running on ws://localhost:8080');
