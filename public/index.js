// State variables
let ws = null;

// Simulation Configuration State
let config = {
  intervalMs: 10,
  vRefOffset: 12.0,
  dutyOffset: 0.5,
  noiseMagnitude: 0.1,
  loadResistor: 10.0,
  isRunning: true
};

// UI Elements (Telemetry Sent)
const connDot = document.getElementById('connection-dot');
const connText = document.getElementById('connection-text');
const valVOut = document.getElementById('val-v_out');
const valIL = document.getElementById('val-i_l');
const valVRef = document.getElementById('val-v_ref');
const valDuty = document.getElementById('val-duty');
const valNoise = document.getElementById('val-noise');
const valTime = document.getElementById('val-time');

// Fillbar Trend Indicators
const trendVOut = document.getElementById('trend-v_out');
const trendIL = document.getElementById('trend-i_l');
const trendVRef = document.getElementById('trend-v_ref');
const trendDuty = document.getElementById('trend-duty');

// UI Elements (Telemetry Received from LabVIEW)
const lvVal1 = document.getElementById('lv-val-1');
const lvVal2 = document.getElementById('lv-val-2');
const lvVal3 = document.getElementById('lv-val-3');
const lvVal4 = document.getElementById('lv-val-4');
const lvVal5 = document.getElementById('lv-val-5');
const lvVal6 = document.getElementById('lv-val-6');

// Control Inputs
const sliderInterval = document.getElementById('slider-interval');
const sliderVRef = document.getElementById('slider-v_ref');
const sliderDuty = document.getElementById('slider-duty');
const sliderLoad = document.getElementById('slider-load');
const sliderNoise = document.getElementById('slider-noise');
const btnToggle = document.getElementById('btn-toggle');

const lblInterval = document.getElementById('ctrl-interval-val');
const lblVRef = document.getElementById('ctrl-v_ref-val');
const lblDuty = document.getElementById('ctrl-duty-val');
const lblLoad = document.getElementById('ctrl-load-val');
const lblNoise = document.getElementById('ctrl-noise-val');


// Establish WebSocket Connection
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
      
      // Update local configuration state from server settings
      if (data.type === 'config') {
        config = data.config;
        updateUISliders();
      }

      // Incoming simulation state sent to LabVIEW
      else if (data.type === 'sim_data') {
        const [vOut, iL, vRef, duty, noise, simTime] = data.values;

        // Update readouts
        valVOut.innerText = vOut.toFixed(2);
        valIL.innerText = iL.toFixed(2);
        valVRef.innerText = vRef.toFixed(2);
        valDuty.innerText = (duty * 100).toFixed(1);
        valNoise.innerText = noise.toFixed(3);
        valTime.innerText = `${simTime.toFixed(3)} s`;

        // Update fill bar widths
        trendVOut.style.width = `${Math.min(100, (vOut / 24) * 100)}%`;
        trendIL.style.width = `${Math.min(100, (iL / 10) * 100)}%`;
        trendVRef.style.width = `${Math.min(100, (vRef / 24) * 100)}%`;
        trendDuty.style.width = `${Math.min(100, duty * 100)}%`;
      }

      // Incoming data packets parsed from LabVIEW
      else if (data.type === 'labview_data') {
        const [lv1, lv2, lv3, lv4, lv5, lv6] = data.values;
        lvVal1.innerText = lv1.toFixed(3);
        lvVal2.innerText = lv2.toFixed(3);
        lvVal3.innerText = lv3.toFixed(3);
        lvVal4.innerText = lv4.toFixed(3);
        lvVal5.innerText = lv5.toFixed(3);
        lvVal6.innerText = lv6.toFixed(3);
      }
    } catch (e) {
      console.error('Error handling WebSocket message:', e);
    }
  };
}

// Update UI elements to reflect remote config
function updateUISliders() {
  sliderInterval.value = config.intervalMs;
  lblInterval.innerText = config.intervalMs;
  
  sliderVRef.value = config.vRefOffset;
  lblVRef.innerText = config.vRefOffset.toFixed(1);
  
  sliderDuty.value = config.dutyOffset * 100.0;
  lblDuty.innerText = (config.dutyOffset * 100.0).toFixed(1);
  
  sliderLoad.value = config.loadResistor;
  lblLoad.innerText = config.loadResistor.toFixed(1);
  
  sliderNoise.value = config.noiseMagnitude;
  lblNoise.innerText = config.noiseMagnitude.toFixed(2);

  if (config.isRunning) {
    btnToggle.innerText = 'PAUSE';
    btnToggle.className = 'btn btn-primary glow-button';
  } else {
    btnToggle.innerText = 'RESUME';
    btnToggle.className = 'btn btn-paused glow-button';
  }
}

// Sends updated configurations to the Node.js server
function sendConfigChange(updatedKeys) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'update_config',
      config: updatedKeys
    }));
  }
}

// Interactive Input Handlers
sliderInterval.addEventListener('input', (e) => {
  const val = parseInt(e.target.value);
  lblInterval.innerText = val;
  sendConfigChange({ intervalMs: val });
});

sliderVRef.addEventListener('input', (e) => {
  const val = parseFloat(e.target.value);
  lblVRef.innerText = val.toFixed(1);
  sendConfigChange({ vRefOffset: val });
});

sliderDuty.addEventListener('input', (e) => {
  const val = parseFloat(e.target.value);
  lblDuty.innerText = val.toFixed(1);
  sendConfigChange({ dutyOffset: val / 100.0 });
});

sliderLoad.addEventListener('input', (e) => {
  const val = parseFloat(e.target.value);
  lblLoad.innerText = val.toFixed(1);
  sendConfigChange({ loadResistor: val });
});

sliderNoise.addEventListener('input', (e) => {
  const val = parseFloat(e.target.value);
  lblNoise.innerText = val.toFixed(2);
  sendConfigChange({ noiseMagnitude: val });
});

btnToggle.addEventListener('click', () => {
  const nextRunningState = !config.isRunning;
  sendConfigChange({ isRunning: nextRunningState });
});

// Initial Connection
connect();
