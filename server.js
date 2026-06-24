const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const dgram = require('dgram');
const path = require('path');

const PORT = 3000;
const UDP_LISTEN_PORT = 54400;
const UDP_SEND_PORT = 25000;
const UDP_TARGET_HOST = '127.0.0.1';

// Setup Express app
const app = express();
app.use(express.static(path.join(__dirname, 'public')));

// Create HTTP server & WebSocket server
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Setup UDP Sockets
const udpRx = dgram.createSocket('udp4');
const udpTx = dgram.createSocket('udp4');

// Broadcaster to all connected WS clients
function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

// Handle incoming UDP packets from the simulation (6 x 64-bit doubles = 48 bytes)
udpRx.on('message', (msg) => {
  if (msg.length === 48) {
    try {
      // Read doubles as Big Endian
      const val1 = msg.readDoubleBE(0);
      const val2 = msg.readDoubleBE(8);
      const val3 = msg.readDoubleBE(16);
      const val4 = msg.readDoubleBE(24);
      const val5 = msg.readDoubleBE(32);
      const val6 = msg.readDoubleBE(40);

      // Broadcast values to the WebSocket clients
      broadcast({
        type: 'data',
        values: [val1, val2, val3, val4, val5, val6]
      });
    } catch (err) {
      console.error('Error parsing UDP packet:', err);
    }
  } else {
    console.warn(`Unexpected UDP packet length: ${msg.length} bytes (expected 48)`);
  }
});

udpRx.on('listening', () => {
  const address = udpRx.address();
  console.log(`UDP Receiver listening on ${address.address}:${address.port}`);
});

// Bind UDP Rx Socket
udpRx.bind(UDP_LISTEN_PORT);

// Handle WebSockets connections
wss.on('connection', (ws) => {
  console.log('Web client connected.');

  // Handle incoming commands from UI and relay as UDP packets
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'control' && Array.isArray(data.values) && data.values.length === 6) {
        // Create 48-byte buffer for 6 doubles
        const buffer = Buffer.alloc(48);
        for (let i = 0; i < 6; i++) {
          buffer.writeDoubleBE(data.values[i], i * 8);
        }
        // Send UDP packet to Python simulation receiver
        udpTx.send(buffer, UDP_SEND_PORT, UDP_TARGET_HOST, (err) => {
          if (err) console.error('Error sending UDP command:', err);
        });
      }
    } catch (err) {
      console.error('Error relaying control message:', err);
    }
  });

  ws.on('close', () => {
    console.log('Web client disconnected.');
  });
});

// Start HTTP Server
server.listen(PORT, () => {
  console.log(`Web interface running at http://localhost:${PORT}`);
});
