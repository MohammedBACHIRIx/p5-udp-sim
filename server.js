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

// Active Simulation State
let simState = {
  vOut: 0.0,
  iL: 0.0,
  ref: 12.0,
  duty: 0.5,
  noise: 0.0,
  time: 0.0
};

// LabVIEW Command State (Received from LabVIEW)
let labviewState = {
  v1: 0.0,
  v2: 0.0,
  v3: 0.0,
  v4: 0.0,
  v5: 0.0,
  v6: 0.0
};

// Simulation Configuration (controlled from web UI)
let config = {
  intervalMs: 10,  // Default to 10ms (100 Hz)
  vRefOffset: 12.0,
  dutyOffset: 0.5,
  noiseMagnitude: 0.1,
  loadResistor: 10.0,
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
      // Read doubles as Big Endian
      labviewState.v1 = msg.readDoubleBE(0);
      labviewState.v2 = msg.readDoubleBE(8);
      labviewState.v3 = msg.readDoubleBE(16);
      labviewState.v4 = msg.readDoubleBE(24);
      labviewState.v5 = msg.readDoubleBE(32);
      labviewState.v6 = msg.readDoubleBE(40);

      // Notify Web UI about received LabVIEW data
      broadcast({
        type: 'labview_data',
        values: [labviewState.v1, labviewState.v2, labviewState.v3, labviewState.v4, labviewState.v5, labviewState.v6]
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
  console.log(`Listening for LabVIEW UDP on port ${address.port}`);
});

// Bind UDP Rx Socket
udpRx.bind(UDP_LISTEN_PORT);

// Main Simulation Loop
let simInterval = null;

function startSimulation() {
  if (simInterval) clearInterval(simInterval);
  
  simInterval = setInterval(() => {
    if (!config.isRunning) return;

    const t = simState.time;
    const intervalSec = config.intervalMs / 1000.0;

    // 1. Generate 6 variables simulating typical HIL/converter signals
    simState.vOut = config.vRefOffset + 2.0 * Math.sin(2 * Math.PI * 50 * t);
    simState.iL = (config.vRefOffset / config.loadResistor) + 0.5 * Math.sin(2 * Math.PI * 50 * t - Math.PI / 4) + (Math.random() - 0.5) * config.noiseMagnitude;
    simState.ref = config.vRefOffset;
    simState.duty = config.dutyOffset + 0.1 * Math.sin(2 * Math.PI * 10 * t);
    simState.noise = (Math.random() - 0.5) * config.noiseMagnitude;
    simState.time = t + intervalSec;

    // 2. Pack as 6 double-precision floats (8 bytes each = 48 bytes total, Big Endian)
    const buffer = Buffer.alloc(48);
    buffer.writeDoubleBE(simState.vOut, 0);
    buffer.writeDoubleBE(simState.iL, 8);
    buffer.writeDoubleBE(simState.ref, 16);
    buffer.writeDoubleBE(simState.duty, 24);
    buffer.writeDoubleBE(simState.noise, 32);
    buffer.writeDoubleBE(simState.time, 40);

    // 3. Send via UDP to LabVIEW
    udpTx.send(buffer, UDP_SEND_PORT, UDP_TARGET_HOST, (err) => {
      if (err) console.error('Error sending UDP to LabVIEW:', err);
    });

    // 4. Stream simulation parameters to the browser UI
    broadcast({
      type: 'sim_data',
      values: [simState.vOut, simState.iL, simState.ref, simState.duty, simState.noise, simState.time]
    });

  }, config.intervalMs);
}

// Handle WebSockets connections
wss.on('connection', (ws) => {
  console.log('Web client connected.');

  // Send current configuration state to UI on connect
  ws.send(JSON.stringify({
    type: 'config',
    config: config
  }));

  // Handle incoming control messages from the browser UI
  ws.on('message', (message) => {
    try {
      const msg = JSON.parse(message);
      if (msg.type === 'update_config') {
        // Update local configuration state
        Object.assign(config, msg.config);

        // If the interval/rate has changed, restart the simulation timer
        if (msg.config.intervalMs !== undefined) {
          startSimulation();
        }
        
        console.log('Updated simulation config:', config);
        
        // Broadcast new config to all clients
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
  console.log(`Web interface running at http://localhost:${PORT}`);
});
