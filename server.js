const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const dgram = require('dgram');
const path = require('path');

const PORT = 3000;
const UDP_LISTEN_PORT = 25000;  // Listen to LabVIEW on 25000
const UDP_SEND_PORT = 54400;    // Send to LabVIEW on 54400
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

// State vectors (6 channels each)
let txBaselines = [10.0, 20.0, 30.0, 40.0, 50.0, 0.0]; // Base values
let txModulated = [false, false, false, false, false, false]; // Toggle modulation
let rxValues = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0]; // Received values

let simTime = 0.0;

// Universal Configuration
let config = {
  intervalMs: 10,  // Rate limit
  isRunning: true
};

// Broadcaster to all connected WS clients
function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

// Handle incoming UDP packets from LabVIEW (6 x 64-bit doubles = 48 bytes)
udpRx.on('message', (msg) => {
  if (msg.length === 48) {
    try {
      for (let i = 0; i < 6; i++) {
        rxValues[i] = msg.readDoubleBE(i * 8);
      }
      // Broadcast received LabVIEW values to Web UI
      broadcast({
        type: 'rx_data',
        values: rxValues
      });
    } catch (err) {
      console.error('Error parsing LabVIEW UDP packet:', err);
    }
  } else {
    console.warn(`Unexpected LabVIEW UDP packet length: ${msg.length} bytes (expected 48)`);
  }
});

udpRx.on('listening', () => {
  const address = udpRx.address();
  console.log(`Listening for incoming UDP on port ${address.port}`);
});

// Bind UDP Rx Socket
udpRx.bind(UDP_LISTEN_PORT);

// Main Abstract Simulation/Generation Loop
let simInterval = null;

function startSimulation() {
  if (simInterval) clearInterval(simInterval);
  
  simInterval = setInterval(() => {
    if (!config.isRunning) return;

    const intervalSec = config.intervalMs / 1000.0;
    const currentTx = [];

    // Calculate dynamic state for each of the 6 channels
    for (let i = 0; i < 6; i++) {
      if (txModulated[i]) {
        // Add a 1 Hz sine wave modulation with an amplitude of 10% of baseline (or default amplitude of 5.0)
        const amplitude = txBaselines[i] !== 0 ? Math.abs(txBaselines[i]) * 0.2 : 5.0;
        currentTx[i] = txBaselines[i] + amplitude * Math.sin(2 * Math.PI * 1.0 * simTime);
      } else {
        currentTx[i] = txBaselines[i];
      }
    }

    simTime += intervalSec;

    // Pack as 6 double-precision floats (48 bytes total, Big Endian)
    const buffer = Buffer.alloc(48);
    for (let i = 0; i < 6; i++) {
      buffer.writeDoubleBE(currentTx[i], i * 8);
    }

    // Send UDP packet to LabVIEW
    udpTx.send(buffer, UDP_SEND_PORT, UDP_TARGET_HOST, (err) => {
      if (err) console.error('Error sending UDP payload:', err);
    });

    // Stream the active output state to the browser
    broadcast({
      type: 'tx_data',
      values: currentTx,
      time: simTime
    });

  }, config.intervalMs);
}

// Handle WebSockets connections
wss.on('connection', (ws) => {
  console.log('Web client connected.');

  // Push current configuration/baselines/states
  ws.send(JSON.stringify({
    type: 'init',
    config: config,
    baselines: txBaselines,
    modulated: txModulated,
    rxValues: rxValues
  }));

  // Handle updates from browser dashboard
  ws.on('message', (message) => {
    try {
      const msg = JSON.parse(message);
      if (msg.type === 'update_tx') {
        txBaselines[msg.channel] = msg.value;
        console.log(`Updated Tx Channel ${msg.channel + 1} value to ${msg.value}`);
      } 
      else if (msg.type === 'update_modulation') {
        txModulated[msg.channel] = msg.value;
        console.log(`Updated Tx Channel ${msg.channel + 1} modulation: ${msg.value}`);
      }
      else if (msg.type === 'update_config') {
        Object.assign(config, msg.config);
        if (msg.config.intervalMs !== undefined) {
          startSimulation();
        }
        // Sync configuration state
        broadcast({
          type: 'config',
          config: config
        });
      }
    } catch (err) {
      console.error('Error handling client message:', err);
    }
  });

  ws.on('close', () => {
    console.log('Web client disconnected.');
  });
});

// Start Simulation
startSimulation();

// Start HTTP Server
server.listen(PORT, () => {
  console.log(`Universal Web UDP Console running at http://localhost:${PORT}`);
});
