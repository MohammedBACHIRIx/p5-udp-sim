// State variables
let ws = null;
const maxDataPoints = 80;
const chartData = {
  labels: [],
  vOut: [],
  iL: []
};

// Controls State (defaults)
const controls = {
  duty: 50.0,
  vRef: 12.0,
  load: 10.0,
  spare1: 0.0,
  spare2: 0.0,
  spare3: 0.0
};

// UI Elements
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

// Control Inputs
const sliderDuty = document.getElementById('slider-duty');
const sliderVRef = document.getElementById('slider-v_ref');
const sliderLoad = document.getElementById('slider-load');

const lblDuty = document.getElementById('ctrl-duty-val');
const lblVRef = document.getElementById('ctrl-v_ref-val');
const lblLoad = document.getElementById('ctrl-load-val');

// Initialize Chart.js
const ctx = document.getElementById('telemetryChart').getContext('2d');
const chart = new Chart(ctx, {
  type: 'line',
  data: {
    labels: chartData.labels,
    datasets: [
      {
        label: 'Vout (V)',
        data: chartData.vOut,
        borderColor: '#00f2fe',
        backgroundColor: 'rgba(0, 242, 254, 0.05)',
        borderWidth: 2.5,
        pointRadius: 0,
        tension: 0.3,
        fill: true
      },
      {
        label: 'IL (A)',
        data: chartData.iL,
        borderColor: '#f35588',
        backgroundColor: 'rgba(243, 85, 136, 0.05)',
        borderWidth: 2.5,
        pointRadius: 0,
        tension: 0.3,
        fill: true
      }
    ]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.03)' },
        ticks: { color: '#9ca3af', font: { size: 10 } }
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.03)' },
        ticks: { color: '#9ca3af' }
      }
    }
  }
});

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

  let lastChartUpdateTime = 0;
  
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'data') {
        const [vOut, iL, vRef, duty, noise, simTime] = data.values;

        // Update readouts
        valVOut.innerText = vOut.toFixed(2);
        valIL.innerText = iL.toFixed(2);
        valVRef.innerText = vRef.toFixed(2);
        valDuty.innerText = (duty * 100).toFixed(1);
        valNoise.innerText = noise.toFixed(3);
        valTime.innerText = `${simTime.toFixed(3)} s`;

        // Update fill bar widths (normalized roughly for visual reference)
        trendVOut.style.width = `${Math.min(100, (vOut / 24) * 100)}%`;
        trendIL.style.width = `${Math.min(100, (iL / 10) * 100)}%`;
        trendVRef.style.width = `${Math.min(100, (vRef / 24) * 100)}%`;
        trendDuty.style.width = `${Math.min(100, duty * 100)}%`;

        // Throttle chart rendering to 40 FPS (25ms) to preserve CPU performance
        const now = Date.now();
        if (now - lastChartUpdateTime > 25) {
          lastChartUpdateTime = now;

          // Push data
          chartData.labels.push(simTime.toFixed(2));
          chartData.vOut.push(vOut);
          chartData.iL.push(iL);

          // Keep sliding window size
          if (chartData.labels.length > maxDataPoints) {
            chartData.labels.shift();
            chartData.vOut.shift();
            chartData.iL.shift();
          }

          chart.update('none'); // Update without full transition animation for high speed
        }
      }
    } catch (e) {
      console.error('Error handling WebSocket message:', e);
    }
  };
}

// Relays Slider Controls to Server
function sendControls() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'control',
      values: [
        controls.duty / 100.0, // Scale duty cycle to [0, 1]
        controls.vRef,
        controls.load,
        controls.spare1,
        controls.spare2,
        controls.spare3
      ]
    }));
  }
}

// Event Listeners for Sliders
sliderDuty.addEventListener('input', (e) => {
  controls.duty = parseFloat(e.target.value);
  lblDuty.innerText = controls.duty.toFixed(1);
  sendControls();
});

sliderVRef.addEventListener('input', (e) => {
  controls.vRef = parseFloat(e.target.value);
  lblVRef.innerText = controls.vRef.toFixed(1);
  sendControls();
});

sliderLoad.addEventListener('input', (e) => {
  controls.load = parseFloat(e.target.value);
  lblLoad.innerText = controls.load.toFixed(1);
  sendControls();
});

// Initial Connection
connect();
