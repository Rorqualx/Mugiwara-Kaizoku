import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:3000/api/v1/ws');

ws.on('open', () => {
  console.log('Connected!');

  // Subscribe to library scan progress
  ws.send(JSON.stringify({
    type: 'subscribe',
    channel: 'library:scan:progress'
  }));

  console.log('Subscribed to library:scan:progress');
});

ws.on('message', (data) => {
  console.log('Message:', data.toString());
});

ws.on('close', (code, reason) => {
  console.log('Closed:', code, String(reason));
});

ws.on('error', (err) => {
  console.log('Error:', err.message);
});

// Check state after 5 seconds
setTimeout(() => {
  console.log('After 5s: state=' + ws.readyState + ' (1=OPEN)');
  if (ws.readyState === 1) {
    console.log('SUCCESS: WebSocket connection is stable!');
    ws.close(1000, 'Test complete');
  }
}, 5000);
