let ws = null;

// Global state mirrors
let config = {
  intervalMs: 10,
  isRunning: true
};
let txBaselines = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
let txModulated = [false, false, false, false, false, false];

// UI Telemetry indicators
const connDot = document.getElementById('connection-dot');
const connText = document.getElementById('connection-text');
const valTime = document.getElementById('val-time');
const btnToggle = document.getElementById('btn-toggle');
const sliderInterval = document.getElementById('slider-interval');
const lblInterval = document.getElementById('ctrl-interval-val');

// Channel elements mapping loops
const txValElements = [];
const rxValElements = [];
const sliderElements = [];
const checkboxElements = [];
const labelElements = [];

for (let i = 0; i < 6; i++) {
  txValElements.push(document.getElementById(`tx-val-${i}`));
  rxValElements.push(document.getElementById(`rx-val-${i}`));
  sliderElements.push(document.getElementById(`slide-tx-${i}`));
  checkboxElements.push(document.getElementById(`mod-tx-${i}`));
  labelElements.push(document.getElementById(`lbl-tx-${i}`));
}

// Sparkline Logic
const sparkCtxs = [];
const sparkHistory = [[], [], [], [], [], []];
const MAX_HISTORY = 100;
const sparkColors = ['#00e5ff', '#ffb300', '#00d27a', '#a55eea', '#ff4785', '#00e5ff'];

window.addEventListener('load', () => {
  for (let i = 0; i < 6; i++) {
    const canvas = document.getElementById(`spark-${i}`);
    if (canvas) {
      canvas.width = canvas.clientWidth * 2 || 160;
      canvas.height = canvas.clientHeight * 2 || 60;
      sparkCtxs.push(canvas.getContext('2d'));
    } else {
      sparkCtxs.push(null);
    }
  }
});

function drawSparklines(rxValues) {
  for (let i = 0; i < 6; i++) {
    if (!sparkCtxs[i]) continue;
    
    const val = rxValues[i];
    sparkHistory[i].push(val !== undefined ? val : 0);
    if (sparkHistory[i].length > MAX_HISTORY) {
      sparkHistory[i].shift();
    }
    
    const ctx = sparkCtxs[i];
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    
    ctx.clearRect(0, 0, width, height);
    if (sparkHistory[i].length < 2) continue;
    
    let min = Math.min(...sparkHistory[i]);
    let max = Math.max(...sparkHistory[i]);
    if (max - min < 0.1) {
      min -= 1; max += 1;
    }
    const range = max - min;
    
    ctx.beginPath();
    ctx.strokeStyle = sparkColors[i];
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    const step = width / (MAX_HISTORY - 1);
    
    for (let j = 0; j < sparkHistory[i].length; j++) {
      const v = sparkHistory[i][j];
      const x = j * step;
      const y = height - ((v - min) / range) * (height - 6) - 3;
      if (j === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

// Establish WebSocket connection
function connect() {
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${wsProtocol}//${window.location.host}`);

  ws.onopen = () => {
    connDot.className = 'dot connected';
    connText.innerText = 'Connected';
    connText.style.color = '#05c46b';
    console.log('WS Connection established.');
  };

  ws.onclose = () => {
    connDot.className = 'dot disconnected';
    connText.innerText = 'Disconnected';
    connText.style.color = '#f35588';
    console.log('WS Connection lost. Reconnecting in 2s...');
    setTimeout(connect, 2000);
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      if (data.type === 'init') {
        config = data.config;
        txBaselines = data.baselines;
        txModulated = data.modulated;
        
        // Update sliders & inputs in UI
        updateUISettings();
        // Set initial Rx indicators
        updateRxIndicators(data.rxValues);
      } 
      else if (data.type === 'config') {
        config = data.config;
        updateUISettings();
      } 
      // Telemetry sent from Server to LabVIEW
      else if (data.type === 'tx_data') {
        for (let i = 0; i < 6; i++) {
          if (txValElements[i]) {
            txValElements[i].innerText = data.values[i].toFixed(3);
          }
        }
        if (valTime) {
          valTime.innerText = `${data.time.toFixed(3)} s`;
        }
      } 
      // Telemetry received from LabVIEW
      else if (data.type === 'rx_data') {
        updateRxIndicators(data.values);
        if (data.jitter !== undefined && document.getElementById('val-jitter')) {
          document.getElementById('val-jitter').innerText = data.jitter.toFixed(1) + 'ms';
        }
        if (data.drops !== undefined && document.getElementById('val-drops')) {
          document.getElementById('val-drops').innerText = data.drops;
        }
      }
    } catch (e) {
      console.error('Error handling WebSocket message:', e);
    }
  };
}

function updateRxIndicators(values) {
  for (let i = 0; i < 6; i++) {
    if (rxValElements[i] && values[i] !== undefined) {
      rxValElements[i].innerText = values[i].toFixed(3);
    }
  }
  drawSparklines(values);
}

// Update control widgets to match remote configuration state
function updateUISettings() {
  sliderInterval.value = config.intervalMs;
  lblInterval.innerText = config.intervalMs;

  for (let i = 0; i < 6; i++) {
    if (sliderElements[i]) {
      sliderElements[i].value = txBaselines[i];
    }
    if (labelElements[i]) {
      labelElements[i].innerText = txBaselines[i].toFixed(1);
    }
    if (checkboxElements[i]) {
      checkboxElements[i].checked = txModulated[i];
    }
  }

  if (config.isRunning) {
    btnToggle.innerText = 'PAUSE';
    btnToggle.className = 'btn btn-primary glow-button';
  } else {
    btnToggle.innerText = 'RESUME';
    btnToggle.className = 'btn btn-paused glow-button';
  }
}

// Websocket transmitter functions
function sendConfigChange(updatedKeys) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'update_config',
      config: updatedKeys
    }));
  }
}

function sendTxValue(channel, val) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'update_tx',
      channel: channel,
      value: val
    }));
  }
}

function sendModulationChange(channel, isModulated) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'update_modulation',
      channel: channel,
      value: isModulated
    }));
  }
}

// Wire up events dynamically using array loops
for (let i = 0; i < 6; i++) {
  if (sliderElements[i]) {
    sliderElements[i].addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      labelElements[i].innerText = val.toFixed(1);
      txBaselines[i] = val;
      sendTxValue(i, val);
    });
  }

  if (checkboxElements[i]) {
    checkboxElements[i].addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      txModulated[i] = isChecked;
      sendModulationChange(i, isChecked);
    });
  }
}

sliderInterval.addEventListener('input', (e) => {
  const val = parseInt(e.target.value);
  lblInterval.innerText = val;
  sendConfigChange({ intervalMs: val });
});

btnToggle.addEventListener('click', () => {
  const nextRunningState = !config.isRunning;
  sendConfigChange({ isRunning: nextRunningState });
});

// Initial Connection
connect();
