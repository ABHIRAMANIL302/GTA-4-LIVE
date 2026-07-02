/* =============================================================
 * GTA IV Pause Screen Overlay - Core Application Logic
 * ============================================================= */

// -------------------------------------------------------------
// Web Audio API Synthesizer Class (GTA IV Style Ambient Sound)
// -------------------------------------------------------------
class GTAAmbientSynth {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.isPlaying = false;
    this.volume = 0.4;
    this.activeNodes = [];
    this.chordIndex = 0;
    this.chordInterval = null;
    this.kickInterval = null;
    this.hissNode = null;
    
    // Chord progression: Dm -> Bb -> Gm -> A (slow, minor, cinematic)
    this.chords = [
      [146.83, 174.61, 220.00, 293.66], // Dm (D3, F3, A3, D4)
      [116.54, 146.83, 174.61, 233.08], // Bb (Bb2, D3, F3, Bb3)
      [98.00, 116.54, 146.83, 196.00],  // Gm (G2, Bb2, D3, G3)
      [110.00, 138.61, 164.81, 220.00]   // A (A2, C#3, E3, A3)
    ];
  }

  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      
      // Compressor to bind low end and pads together
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-18, this.ctx.currentTime);
      this.compressor.knee.setValueAtTime(24, this.ctx.currentTime);
      this.compressor.ratio.setValueAtTime(3.5, this.ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.06, this.ctx.currentTime);
      this.compressor.release.setValueAtTime(0.2, this.ctx.currentTime);
      
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
      
      this.masterGain.connect(this.compressor);
      this.compressor.connect(this.ctx.destination);
    } catch (e) {
      console.warn("Web Audio API not supported or blocked: ", e);
    }
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, parseFloat(vol)));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  // Synthesize short mechanical navigation hover tick
  playTick() {
    this.init();
    if (!this.ctx || this.ctx.state === 'suspended') return;
    
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(250, now);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.04);
    
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(180, now);
    filter.Q.setValueAtTime(4, now);
    
    gainNode.gain.setValueAtTime(0.08, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    
    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.compressor);
    
    osc.start(now);
    osc.stop(now + 0.05);
  }

  // Synthesize menu select click
  playSelect() {
    this.init();
    if (!this.ctx || this.ctx.state === 'suspended') return;
    
    const now = this.ctx.currentTime;
    
    // Low thud
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(140, now);
    osc1.frequency.exponentialRampToValueAtTime(30, now + 0.08);
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc1.connect(gain1);
    gain1.connect(this.compressor);
    osc1.start(now);
    osc1.stop(now + 0.09);
    
    // High metal click
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now);
    osc2.frequency.setValueAtTime(760, now + 0.02);
    gain2.gain.setValueAtTime(0.06, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc2.connect(gain2);
    gain2.connect(this.compressor);
    osc2.start(now);
    osc2.stop(now + 0.06);
  }

  // Double heartbeat kick sound
  playHeartbeat() {
    if (!this.ctx || this.ctx.state === 'suspended') return;
    const now = this.ctx.currentTime;
    
    const thud = (timeOffset) => {
      const t = now + timeOffset;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const lp = this.ctx.createBiquadFilter();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(65, t);
      osc.frequency.exponentialRampToValueAtTime(25, t + 0.18);
      
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(70, t);
      
      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      
      osc.connect(lp);
      lp.connect(gain);
      gain.connect(this.compressor);
      
      osc.start(t);
      osc.stop(t + 0.23);
    };
    
    // double beat: thud... thud...
    thud(0);
    thud(0.38);
  }

  // Play a long, fading D-minor / dark chord
  playPadChord(freqs, duration) {
    if (!this.ctx || this.ctx.state === 'suspended') return;
    const now = this.ctx.currentTime;
    
    // Create nodes for this specific chord
    const oscs = [];
    const chordGain = this.ctx.createGain();
    const lpf = this.ctx.createBiquadFilter();
    
    lpf.type = 'lowpass';
    lpf.frequency.setValueAtTime(450, now);
    lpf.frequency.linearRampToValueAtTime(700, now + duration / 2);
    lpf.frequency.linearRampToValueAtTime(400, now + duration);
    lpf.Q.setValueAtTime(1.5, now);

    chordGain.gain.setValueAtTime(0.0, now);
    // Slow attack
    chordGain.gain.linearRampToValueAtTime(0.06, now + 4.5);
    // Sustain
    chordGain.gain.setValueAtTime(0.06, now + duration - 4.5);
    // Slow release
    chordGain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    
    freqs.forEach(f => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f + (Math.random() - 0.5) * 0.4, now); // subtle detune
      osc.connect(lpf);
      osc.start(now);
      osc.stop(now + duration);
      oscs.push(osc);
      this.activeNodes.push(osc);
    });

    lpf.connect(chordGain);
    chordGain.connect(this.compressor);
    
    // Clean up nodes after completion
    setTimeout(() => {
      this.activeNodes = this.activeNodes.filter(n => !oscs.includes(n));
    }, (duration + 1) * 1000);
  }

  startAmbience() {
    return; // Disabled to ensure only the custom background music plays
    
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    
    this.isPlaying = true;
    
    // 1. Bass drone layer (runs continuously)
    const droneOsc = this.ctx.createOscillator();
    const droneGain = this.ctx.createGain();
    const droneLpf = this.ctx.createBiquadFilter();
    
    droneOsc.type = 'sine';
    droneOsc.frequency.setValueAtTime(55, this.ctx.currentTime); // A1 bass note
    
    droneLpf.type = 'lowpass';
    droneLpf.frequency.setValueAtTime(65, this.ctx.currentTime);
    
    // Slow volume sweep LFO for drone
    const droneLfo = this.ctx.createOscillator();
    const droneLfoGain = this.ctx.createGain();
    droneLfo.type = 'sine';
    droneLfo.frequency.setValueAtTime(0.08, this.ctx.currentTime); // very slow LFO
    droneLfoGain.gain.setValueAtTime(0.05, this.ctx.currentTime);
    
    droneGain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    droneLfo.connect(droneLfoGain);
    droneLfoGain.connect(droneGain.gain); // modulate drone volume
    
    droneOsc.connect(droneLpf);
    droneLpf.connect(droneGain);
    droneGain.connect(this.compressor);
    
    droneOsc.start();
    droneLfo.start();
    
    this.activeNodes.push(droneOsc, droneLfo);

    // 2. Continuous analog hiss (creates texture)
    const bufferSize = 2 * this.ctx.sampleRate;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    
    this.hissNode = this.ctx.createBufferSource();
    this.hissNode.buffer = noiseBuffer;
    this.hissNode.loop = true;
    
    const hissFilter = this.ctx.createBiquadFilter();
    hissFilter.type = 'bandpass';
    hissFilter.frequency.setValueAtTime(4500, this.ctx.currentTime);
    hissFilter.Q.setValueAtTime(0.8, this.ctx.currentTime);
    
    const hissGain = this.ctx.createGain();
    hissGain.gain.setValueAtTime(0.003, this.ctx.currentTime);
    
    this.hissNode.connect(hissFilter);
    hissFilter.connect(hissGain);
    hissGain.connect(this.compressor);
    this.hissNode.start();

    // 3. Heartbeat double thud loops every 4.8 seconds
    this.playHeartbeat();
    this.kickInterval = setInterval(() => {
      this.playHeartbeat();
    }, 4800);

    // 4. Strings Pad Progression
    // Chords play for 14 seconds, overlapping every 12 seconds
    const chordDuration = 14;
    const triggerNextChord = () => {
      const activeChord = this.chords[this.chordIndex];
      this.playPadChord(activeChord, chordDuration);
      this.chordIndex = (this.chordIndex + 1) % this.chords.length;
    };
    
    triggerNextChord();
    this.chordInterval = setInterval(triggerNextChord, 12000);
  }

  stopAmbience() {
    return; // Disabled
    
    // Stop and clear all active audio nodes
    this.activeNodes.forEach(node => {
      try { node.stop(); } catch(e) {}
    });
    this.activeNodes = [];
    
    if (this.hissNode) {
      try { this.hissNode.stop(); } catch(e) {}
      this.hissNode = null;
    }
    
    clearInterval(this.kickInterval);
    clearInterval(this.chordInterval);
  }
}

// Instantiate Global Synthesizer
const synth = new GTAAmbientSynth();

// -------------------------------------------------------------
// Interactive Vector Map Engine (GTA IV Style)
// -------------------------------------------------------------
class GTAMapEngine {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    
    // Pan & Zoom states
    this.panX = 0;
    this.panY = 0;
    this.zoom = 1.0;
    this.time = 0;
    this.animationStyle = 'pan-zoom'; // 'pan-zoom', 'pulse', 'static'
    
    // Hardcoded coordinate nodes defining simplified Liberty City islands
    this.islands = {
      alderney: [ // Left Island (Alderney)
        {x: 180, y: 150}, {x: 250, y: 170}, {x: 270, y: 320}, {x: 280, y: 460},
        {x: 260, y: 580}, {x: 220, y: 720}, {x: 150, y: 780}, {x: 120, y: 700},
        {x: 100, y: 550}, {x: 120, y: 320}, {x: 140, y: 220}
      ],
      algonquin: [ // Central Island (Algonquin)
        {x: 440, y: 140}, {x: 520, y: 200}, {x: 540, y: 350}, {x: 520, y: 540},
        {x: 480, y: 690}, {x: 440, y: 740}, {x: 410, y: 700}, {x: 390, y: 540},
        {x: 410, y: 320}, {x: 420, y: 200}
      ],
      brokerDukes: [ // Right Island (Broker / Dukes / South Bohan)
        {x: 680, y: 260}, {x: 820, y: 220}, {x: 940, y: 280}, {x: 960, y: 450},
        {x: 910, y: 640}, {x: 840, y: 720}, {x: 720, y: 750}, {x: 640, y: 680},
        {x: 610, y: 500}, {x: 620, y: 360}
      ],
      bohan: [ // Top Island (Bohan)
        {x: 580, y: 60}, {x: 720, y: 80}, {x: 750, y: 150}, {x: 680, y: 200},
        {x: 580, y: 180}, {x: 540, y: 120}
      ]
    };
    
    // GPS Highway Path coordinate points
    this.gpsPath = [
      {x: 850, y: 580}, // Start in Broker
      {x: 760, y: 580}, 
      {x: 680, y: 530}, // Broker-Algonquin bridge
      {x: 520, y: 530}, // Enter Algonquin
      {x: 480, y: 530},
      {x: 480, y: 420}, // Head North
      {x: 460, y: 350}  // Player position (Algonquin)
    ];

    // Bind resize handler
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  resize() {
    this.canvas.width = this.canvas.parentElement.clientWidth;
    this.canvas.height = this.canvas.parentElement.clientHeight;
  }

  setAnimationStyle(style) {
    this.animationStyle = style;
  }

  draw() {
    this.time += 0.005;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    
    // Adjust Pan & Zoom over time
    if (this.animationStyle === 'pan-zoom') {
      this.zoom = 1.05 + Math.sin(this.time * 0.5) * 0.08;
      this.panX = Math.sin(this.time * 0.7) * 40;
      this.panY = Math.cos(this.time * 0.5) * 30;
    } else if (this.animationStyle === 'pulse') {
      this.zoom = 1.0;
      this.panX = 0;
      this.panY = 0;
    } else { // Static
      this.zoom = 0.95;
      this.panX = 0;
      this.panY = 0;
    }

    // 1. Draw Water background
    ctx.fillStyle = '#0b0f13';
    ctx.fillRect(0, 0, w, h);
    
    ctx.save();
    // Center map drawing in canvas viewport
    ctx.translate(w / 2 + this.panX, h / 2 + this.panY);
    ctx.scale(this.zoom, this.zoom);
    
    // Local scale factor to fit coordinate bounds (1000x800 base) in window
    const scaleFactor = Math.min(w / 1100, h / 900);
    ctx.scale(scaleFactor, scaleFactor);
    ctx.translate(-500, -400); // Translate back from coordinate pivot center

    // Draw Grid Lines (Coordinate System)
    ctx.strokeStyle = 'rgba(32, 45, 59, 0.25)';
    ctx.lineWidth = 1;
    const gridSize = 80;
    for (let x = -200; x < 1200; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, -200);
      ctx.lineTo(x, 1000);
      ctx.stroke();
    }
    for (let y = -200; y < 1000; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(-200, y);
      ctx.lineTo(1200, y);
      ctx.stroke();
    }

    // 2. Draw Islands
    ctx.fillStyle = '#141c24'; // Muted dark slate for land
    ctx.strokeStyle = '#273442'; // Dark border for shore
    ctx.lineWidth = 3;

    Object.keys(this.islands).forEach(key => {
      const points = this.islands[key];
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    });

    // 3. Draw Road Networks (Grids inside islands)
    ctx.strokeStyle = '#1d2730';
    ctx.lineWidth = 1.5;
    
    // Algonquin Grid (Vertical / Horizontal street grid)
    for (let y = 220; y < 650; y += 35) {
      ctx.beginPath();
      ctx.moveTo(412, y);
      ctx.lineTo(518, y);
      ctx.stroke();
    }
    for (let x = 420; x < 520; x += 25) {
      ctx.beginPath();
      ctx.moveTo(x, 210);
      ctx.lineTo(x, 650);
      ctx.stroke();
    }

    // Broker Grid
    for (let y = 350; y < 680; y += 45) {
      ctx.beginPath();
      ctx.moveTo(630, y);
      ctx.lineTo(880, y);
      ctx.stroke();
    }
    for (let x = 650; x < 880; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 320);
      ctx.lineTo(x, 700);
      ctx.stroke();
    }

    // Alderney Grid
    for (let y = 250; y < 700; y += 45) {
      ctx.beginPath();
      ctx.moveTo(130, y);
      ctx.lineTo(260, y);
      ctx.stroke();
    }
    for (let x = 140; x < 260; x += 35) {
      ctx.beginPath();
      ctx.moveTo(x, 220);
      ctx.lineTo(x, 700);
      ctx.stroke();
    }

    // Bridges (Connecting lines between islands)
    ctx.strokeStyle = '#2b3947';
    ctx.lineWidth = 4;
    
    // Alderney-Algonquin Bridges
    const drawBridge = (x1, y1, x2, y2) => {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    };
    
    drawBridge(270, 300, 410, 300); // North Bridge
    drawBridge(275, 480, 395, 480); // South Bridge
    // Algonquin-Broker Bridges
    drawBridge(530, 420, 620, 420); // East Bridge 1 (Algonquin - Broker)
    drawBridge(525, 540, 650, 540); // East Bridge 2
    // Algonquin-Bohan Bridge
    drawBridge(490, 190, 560, 170);

    // 4. Draw GPS Pathway (Glowing Yellow/Cyan route)
    const routeColor = state.accentColor || '#8fd2eb';
    ctx.strokeStyle = routeColor; // Active GPS Path color
    ctx.lineWidth = 5;
    ctx.shadowBlur = 12;
    ctx.shadowColor = hexToRgbA(routeColor, 0.6);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    
    // Animate dashed line offsets
    ctx.setLineDash([12, 8]);
    ctx.lineDashOffset = -this.time * 50;

    ctx.beginPath();
    ctx.moveTo(this.gpsPath[0].x, this.gpsPath[0].y);
    for (let i = 1; i < this.gpsPath.length; i++) {
      ctx.lineTo(this.gpsPath[i].x, this.gpsPath[i].y);
    }
    ctx.stroke();
    
    // Reset shadow & dash states for other renders
    ctx.shadowBlur = 0;
    ctx.setLineDash([]);

    // 5. Draw Waypoint Red Target (Broker Start Point)
    const waypointX = this.gpsPath[0].x;
    const waypointY = this.gpsPath[0].y;
    const pulseFactor = 1 + Math.sin(this.time * 12) * 0.2;
    
    ctx.fillStyle = 'rgba(209, 46, 46, 0.2)';
    ctx.beginPath();
    ctx.arc(waypointX, waypointY, 20 * pulseFactor, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#d12e2e';
    ctx.beginPath();
    ctx.arc(waypointX, waypointY, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 6. Draw Player Indicator (Cyan glowing rotating arrow in Algonquin)
    const playerX = this.gpsPath[this.gpsPath.length - 1].x;
    const playerY = this.gpsPath[this.gpsPath.length - 1].y;
    
    ctx.save();
    ctx.translate(playerX, playerY);
    ctx.rotate(Math.sin(this.time * 0.6) * 0.4); // Subtle rotation wobble
    
    // Outer player glow circle
    const playerPulse = 1.0 + Math.sin(this.time * 8) * 0.12;
    ctx.fillStyle = hexToRgbA(routeColor, 0.15);
    ctx.beginPath();
    ctx.arc(0, 0, 16 * playerPulse, 0, Math.PI * 2);
    ctx.fill();
    
    // Player Arrow Polygon
    ctx.fillStyle = routeColor;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(8, 7);
    ctx.lineTo(0, 3);
    ctx.lineTo(-8, 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    ctx.restore();
    ctx.restore();

    // Loop
    requestAnimationFrame(() => this.draw());
  }
}

// -------------------------------------------------------------
// Main Application State & Initialization
// -------------------------------------------------------------
const APP_STATE_KEY = 'gta4_overlay_state';

const DEFAULT_STATE = {
  // Timer States
  duration: 300,        // Default 5 mins (in seconds)
  timeLeft: 300,
  isRunning: false,
  
  // Status Labels
  statusTitle: "GAME STARTS IN",
  statusDesc: "Niko is taking a quick coffee break at the TW@ Internet Cafe. The gameplay will resume shortly.",
  
  // Navigation
  activeTab: "pause",
  autoCycle: false,
  cycleInterval: 15,
  mapStyle: "pan-zoom",
  
  // Audio Configs
  audioPlaying: false,
  musicVolume: 0.4,
  
  // Radio Configs
  activeRadioId: "track1",
  radioSong: "Alex Moretto - All Night Long",

  // Aesthetic Customization
  timerColor: "#ffffff",
  accentColor: "#8fd2eb",
  timerFont: "mono",
  timerGlow: true,
  bgDigits: true,

  // Stats Database
  stats: {
    stream: [
      { name: "Stream Runtime", val: "01:25:40", highlight: true },
      { name: "Broadcast Resolution", val: "1080p 60FPS" },
      { name: "Encoder Quality", val: "CBR 6000 Kbps" },
      { name: "Current Latency", val: "1.4 seconds" },
      { name: "Overlay Status", val: "Synced & Live", highlight: true }
    ],
    gameplay: [
      { name: "Active Game", val: "GTA IV (v1.0.7.0)" },
      { name: "Current Mission", val: "Three Leaf Clover", highlight: true },
      { name: "Overall Completion", val: "38.25%" },
      { name: "Missions Completed", val: "28 / 88" },
      { name: "Wanted Level", val: "⭐⭐⭐⭐" }
    ],
    fun: [
      { name: "Coffee Consumed", val: "3 Cups" },
      { name: "Cousin Roman Calls", val: "17" },
      { name: "Roman Calls Ignored", val: "17", highlight: true },
      { name: "Bikes Crashed", val: "12" },
      { name: "Hot Dogs Eaten", val: "9" }
    ]
  },
  
  // Social Media Details
  socials: [
    { id: "twitch", platform: "Twitch", handle: "NikoBellicStreams", icon: "🎮", url: "https://twitch.tv" },
    { id: "youtube", platform: "YouTube", handle: "NikoBellicGaming", icon: "📺", url: "https://youtube.com" },
    { id: "discord", platform: "Discord", handle: "Niko's Cab Co.", icon: "💬", url: "https://discord.gg" },
    { id: "twitter", platform: "Twitter/X", handle: "@NikoBellicLC", icon: "🐦", url: "https://x.com" }
  ]
};

// GTA IV Station Metadata
const RADIO_STATIONS = [
  { id: "off", name: "Radio Off", icon: "🔇", freq: "OFF", defaultSong: "Radio Disabled", src: null },
  { id: "track1", name: "Speed Garage NCS", icon: "🎵", freq: "99.1 FM", defaultSong: "Alex Moretto - All Night Long", src: "Alex Moretto - All Night Long  Speed Garage  NCS - Copyright Free Music.mp3" },
  { id: "track2", name: "Seasons Remix NCS", icon: "🎧", freq: "103.2 FM", defaultSong: "Rival x Cadmium - Seasons", src: "Rival x Cadmium - Seasons (ft Harley Bird) [Futuristik & Whogaux Remix]  NCS - Copyright Free Music.mp3" }
];

let state = { ...DEFAULT_STATE };
let timerInterval = null;
let cycleInterval = null;
let mapEngine = null;

// Initialize app on DOM Load
document.addEventListener('DOMContentLoaded', () => {
  // Check URL parameters first
  const urlParams = new URLSearchParams(window.location.search);
  const isObsMode = urlParams.get('stream') === 'true';
  const isControlMode = urlParams.get('control') === 'true';
  
  if (isObsMode) {
    document.body.classList.add('obs-mode');
  }

  // Load state from LocalStorage, or set defaults
  const savedState = localStorage.getItem(APP_STATE_KEY);
  if (savedState) {
    try {
      state = JSON.parse(savedState);
      // Ensure complex structures merge in case of structural updates
      state.stats = { ...DEFAULT_STATE.stats, ...state.stats };
      state.socials = state.socials || DEFAULT_STATE.socials;
    } catch(e) {
      state = { ...DEFAULT_STATE };
    }
  } else {
    state = { ...DEFAULT_STATE };
    localStorage.setItem(APP_STATE_KEY, JSON.stringify(state));
  }

  // Initialize Canvas Map
  mapEngine = new GTAMapEngine('map-canvas');
  mapEngine.setAnimationStyle(state.mapStyle);
  mapEngine.draw();

  // Set initial HUD volume from state
  synth.setVolume(state.musicVolume);

  // Setup DOM Elements and Events
  initHUD();
  initControlPanel();
  syncUI();

  // Sync Timer Clock ticker
  startTimerClockThread();

  // Real-time Storage Sync (crucial for OBS / Multi-tab setup)
  window.addEventListener('storage', (e) => {
    if (e.key === APP_STATE_KEY) {
      try {
        const newState = JSON.parse(e.newValue);
        // Track specific triggers (volume, tab, play state)
        const oldActiveTab = state.activeTab;
        const oldAudioState = state.audioPlaying;
        const oldVolume = state.musicVolume;
        
        state = newState;
        
        // Handle Tab Sync
        if (state.activeTab !== oldActiveTab) {
          switchHUDTab(state.activeTab, false); // no sound feedback for synced tab changes
        }

        // Handle Audio Playback Sync
        if (state.audioPlaying !== oldAudioState) {
          togglePauseMusic(state.audioPlaying);
        }

        // Handle Volume Sync
        if (state.musicVolume !== oldVolume) {
          synth.setVolume(state.musicVolume);
        }

        // Keep map animation synced
        if (mapEngine) {
          mapEngine.setAnimationStyle(state.mapStyle);
        }

        syncUI();
      } catch(err) {
        console.error("Failed to sync storage state: ", err);
      }
    }
  });

  // Handle auto-play restriction with audio prompt overlay
  const overlay = document.getElementById('audio-start-overlay');
  const btnAudio = document.getElementById('btn-enable-audio');

  // If NOT in OBS mode, show audio start prompt if audio is enabled
  if (!isObsMode && state.audioPlaying && synth.ctx === null) {
    overlay.classList.remove('hidden');
  }

  btnAudio.addEventListener('click', () => {
    overlay.classList.add('hidden');
    synth.init();
    if (state.audioPlaying) {
      togglePauseMusic(true);
    }
  });

  // Enable audio context on any direct clicks
  document.body.addEventListener('click', () => {
    if (synth.ctx && synth.ctx.state === 'suspended') {
      synth.ctx.resume();
    }
  });
});

// Save state and notify other tabs via localStorage
function saveState() {
  localStorage.setItem(APP_STATE_KEY, JSON.stringify(state));
}

// -------------------------------------------------------------
// HUD Rendering & Navigation
// -------------------------------------------------------------
function initHUD() {
  // Navigation click listeners
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      const targetTab = e.currentTarget.getAttribute('data-tab');
      switchHUDTab(targetTab);
      
      // Update state
      state.activeTab = targetTab;
      saveState();
      
      // Sync Control panel selector
      const selectTab = document.getElementById('select-active-tab');
      if (selectTab) selectTab.value = targetTab;
    });

    item.addEventListener('mouseenter', () => {
      synth.playTick();
    });
  });

  // Stats Category Click
  document.querySelectorAll('.stats-cat-item').forEach(item => {
    item.addEventListener('click', (e) => {
      synth.playSelect();
      document.querySelectorAll('.stats-cat-item').forEach(i => i.classList.remove('active'));
      e.currentTarget.classList.add('active');
      renderStatsDetails(e.currentTarget.getAttribute('data-cat'));
    });
    item.addEventListener('mouseenter', () => {
      synth.playTick();
    });
  });

  // Keycap Keyboard Nav shortcuts
  document.addEventListener('keydown', (e) => {
    // Avoid hijacking inputs in control panel
    if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
      return;
    }

    const key = e.key.toLowerCase();
    
    if (key === 'escape') {
      synth.playSelect();
      resetTimer();
    } else if (key === ' ') {
      e.preventDefault(); // Stop scrolling page
      synth.playSelect();
      if (state.isRunning) {
        pauseTimer();
      } else {
        startTimer();
      }
    } else if (key === 'm') {
      synth.playSelect();
      state.audioPlaying = !state.audioPlaying;
      togglePauseMusic(state.audioPlaying);
      saveState();
      syncUI();
    } else if (key === 'c') {
      synth.playSelect();
      toggleControlPanel();
    } else if (e.key === 'Enter') {
      synth.playSelect();
      // cycle tabs
      const tabs = ["pause", "stats", "socials", "radio"];
      const nextIdx = (tabs.indexOf(state.activeTab) + 1) % tabs.length;
      switchHUDTab(tabs[nextIdx]);
      state.activeTab = tabs[nextIdx];
      saveState();
      syncUI();
    }
  });

  // Initialize clock text format (THURSDAY 19:50)
  updateGTAClock();
}

function switchHUDTab(tabName, playSound = true) {
  if (playSound) {
    synth.playSelect();
  }

  // Header Nav updates
  document.querySelectorAll('.nav-item').forEach(item => {
    if (item.getAttribute('data-tab') === tabName) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Main Section display transitions
  document.querySelectorAll('.tab-content').forEach(section => {
    section.classList.remove('active');
  });
  
  const activeSection = document.getElementById(`tab-content-${tabName}`);
  if (activeSection) {
    activeSection.classList.add('active');
  }
}

// -------------------------------------------------------------
// UI synchronization (Stats, Socials, Clock)
// -------------------------------------------------------------
function syncUI() {
  // 1. Switch Tab
  switchHUDTab(state.activeTab, false);

  // 2. Timer Update
  updateTimerDisplay();

  // 3. Populate Social Links (TW@ Theme)
  const socContainer = document.getElementById('socials-container');
  if (socContainer) {
    socContainer.innerHTML = '';
    state.socials.forEach(s => {
      const card = document.createElement('div');
      card.className = 'tw-card';
      card.innerHTML = `
        <div class="tw-header">
          <div class="tw-logo-mini">TW@</div>
          <div class="tw-title">${s.platform} Link</div>
        </div>
        <div class="tw-body">
          <div class="tw-icon">${s.icon}</div>
          <div class="tw-platform">${s.platform}</div>
          <div class="tw-handle">${s.handle}</div>
          <a href="${s.url}" target="_blank" class="tw-link-btn">Connect</a>
        </div>
      `;
      socContainer.appendChild(card);
    });
  }

  // 4. Populate Radio Stations list & Detail details
  const radioList = document.getElementById('radio-station-list');
  if (radioList) {
    radioList.innerHTML = '';
    RADIO_STATIONS.forEach(rs => {
      const li = document.createElement('li');
      li.className = `radio-item ${state.activeRadioId === rs.id ? 'active' : ''}`;
      li.innerHTML = `
        <span class="radio-logo-icon">${rs.icon}</span>
        <div>
          <div>${rs.name}</div>
          <div style="font-size: 12px; font-weight: 500; opacity: 0.6;">${rs.freq}</div>
        </div>
      `;
      li.addEventListener('click', () => {
        synth.playSelect();
        state.activeRadioId = rs.id;
        state.radioSong = rs.defaultSong;
        saveState();
        syncUI();
      });
      li.addEventListener('mouseenter', () => synth.playTick());
      radioList.appendChild(li);
    });

    // Sync Details display
    const currentRadio = RADIO_STATIONS.find(rs => rs.id === state.activeRadioId) || RADIO_STATIONS[0];
    document.getElementById('radio-station-name').innerText = currentRadio.name.toUpperCase();
    document.getElementById('radio-song-name').innerText = state.radioSong;
    document.getElementById('radio-logo-display').innerText = currentRadio.icon;
    const freqDisplay = document.getElementById('radio-freq-display');
    if (freqDisplay) freqDisplay.innerText = currentRadio.freq + (currentRadio.freq === 'OFF' ? '' : ' — STREAM BROADCAST');
    
    // Play selected track
    const bgMusic = document.getElementById('bg-music');
    if (bgMusic) {
      if (currentRadio.src) {
        const currentSrc = bgMusic.getAttribute('src');
        if (currentSrc !== currentRadio.src) {
          bgMusic.setAttribute('src', currentRadio.src);
          if (state.audioPlaying) bgMusic.play().catch(e => console.warn('Autoplay prevented', e));
        }
      } else {
        if (bgMusic.getAttribute('src')) {
          bgMusic.pause();
          bgMusic.removeAttribute('src');
        }
      }
    }
    
    // Toggle disc spinner spin
    const spinner = document.getElementById('radio-disc-spinner');
    if (state.audioPlaying) {
      spinner.classList.add('playing');
    } else {
      spinner.classList.remove('playing');
    }
  }

  // 5. Populate Stats Details
  const activeCatItem = document.querySelector('.stats-cat-item.active');
  const activeCat = activeCatItem ? activeCatItem.getAttribute('data-cat') : 'stream';
  renderStatsDetails(activeCat);

  // 6. Sync Texts
  document.getElementById('overlay-status-title').innerText = state.statusTitle;
  document.getElementById('overlay-status-desc').innerText = state.statusDesc;

  // 7. Apply dynamic styling custom colors & fonts
  applyAesthetics();

  // 8. Sync Control Panel inputs (only if CP elements exist)
  syncControlPanelInputs();

  // 9. Auto-Cycle Tab Handle
  toggleAutoCycle(state.autoCycle);
}

function applyAesthetics() {
  // 1. Apply timer digits color
  document.documentElement.style.setProperty('--gta-timer-color', state.timerColor || '#ffffff');
  
  // 2. Apply neon outer glow
  if (state.timerGlow) {
    const shadowColor = hexToRgbA(state.timerColor || '#ffffff', 0.4);
    const shadowColorStrong = hexToRgbA(state.timerColor || '#ffffff', 0.8);
    document.documentElement.style.setProperty('--gta-timer-glow', `0 0 12px ${shadowColor}, 0 0 25px ${shadowColorStrong}`);
  } else {
    document.documentElement.style.setProperty('--gta-timer-glow', 'none');
  }

  // 3. Apply faint LED background digits
  const bgDigitsEl = document.getElementById('timer-bg-digits');
  if (bgDigitsEl) {
    bgDigitsEl.style.display = state.bgDigits ? 'block' : 'none';
    bgDigitsEl.style.color = hexToRgbA(state.timerColor || '#ffffff', 0.02);
  }

  // 4. Apply HUD Accent Color
  document.documentElement.style.setProperty('--gta-accent-blue', state.accentColor || '#8fd2eb');
  const rgb = hexToRgb(state.accentColor || '#8fd2eb');
  if (rgb) {
    document.documentElement.style.setProperty('--gta-accent-blue-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
  }

  // 5. Apply timer typography
  let fontValue = "'Share Tech Mono', monospace";
  if (state.timerFont === 'condensed') {
    fontValue = "'Barlow Condensed', sans-serif";
  } else if (state.timerFont === 'logo') {
    fontValue = "'Pricedown', 'Impact', sans-serif";
  }
  document.documentElement.style.setProperty('--gta-timer-font', fontValue);
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

function hexToRgbA(hex, alpha) {
  const r = hexToRgb(hex);
  if (r) {
    return `rgba(${r.r}, ${r.g}, ${r.b}, ${alpha})`;
  }
  return `rgba(255, 255, 255, ${alpha})`;
}

function renderStatsDetails(catName) {
  const container = document.getElementById('stats-list-container');
  const title = document.getElementById('stats-detail-title');
  if (!container) return;

  container.innerHTML = '';
  
  // Set details pane header title
  const catTitles = { stream: "Stream Stats", gameplay: "Niko's Progress", fun: "Fun Stats" };
  title.innerText = catTitles[catName] || "Statistics";

  const rows = state.stats[catName] || [];
  rows.forEach(r => {
    const row = document.createElement('div');
    row.className = 'stats-row';
    row.innerHTML = `
      <span class="stats-label">${r.name}</span>
      <span class="stats-value ${r.highlight ? 'highlight' : ''}">${r.val}</span>
    `;
    container.appendChild(row);
  });
}

function startTimerClockThread() {
  // Update real-world in-game clock every 15s
  setInterval(updateGTAClock, 15000);
  
  // Process countdown ticks
  setInterval(() => {
    if (state.isRunning) {
      if (state.timeLeft > 0) {
        state.timeLeft -= 1;
        updateTimerDisplay();
        
        // Write to storage silently without full state updates
        localStorage.setItem(APP_STATE_KEY, JSON.stringify(state));
      } else {
        // Timer completes
        state.isRunning = false;
        state.timeLeft = 0;
        saveState();
        syncUI();
      }
    }
  }, 1000);
}

function updateGTAClock() {
  const clock = document.getElementById('gta-clock');
  if (!clock) return;

  const days = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
  const now = new Date();
  
  const dayName = days[now.getDay()];
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  
  clock.innerText = `${dayName} ${hours}:${minutes}`;
}

// -------------------------------------------------------------
// Timer Operations
// -------------------------------------------------------------
function startTimer() {
  if (state.timeLeft <= 0) {
    state.timeLeft = state.duration;
  }
  state.isRunning = true;
  saveState();
  syncUI();
}

function pauseTimer() {
  state.isRunning = false;
  saveState();
  syncUI();
}

function resetTimer() {
  state.isRunning = false;
  state.timeLeft = state.duration;
  saveState();
  syncUI();
}

function updateTimerDisplay() {
  const minEl = document.getElementById('timer-minutes');
  const secEl = document.getElementById('timer-seconds');
  const progressFill = document.getElementById('timer-progress');
  if (!minEl || !secEl || !progressFill) return;

  const mins = Math.floor(state.timeLeft / 60);
  const secs = state.timeLeft % 60;

  minEl.innerText = mins.toString().padStart(2, '0');
  secEl.innerText = secs.toString().padStart(2, '0');

  // Fill calculation
  const percent = state.duration > 0 ? (state.timeLeft / state.duration) * 100 : 0;
  progressFill.style.width = `${percent}%`;
}

// -------------------------------------------------------------
// Pause Ambient Music
// -------------------------------------------------------------
function togglePauseMusic(play) {
  const bgMusic = document.getElementById('bg-music');
  if (play) {
    if (bgMusic && bgMusic.getAttribute('src')) {
      bgMusic.volume = state.musicVolume;
      bgMusic.play().catch(e => console.warn('Audio auto-play prevented', e));
    }
  } else {
    if (bgMusic) bgMusic.pause();
  }
  
  // Update Radio disc spins
  const spinner = document.getElementById('radio-disc-spinner');
  if (spinner) {
    if (play) spinner.classList.add('playing');
    else spinner.classList.remove('playing');
  }
}

// -------------------------------------------------------------
// Control Panel Logic & State Input Handlers
// -------------------------------------------------------------
function initControlPanel() {
  const panel = document.getElementById('control-panel');
  const floatBtn = document.getElementById('btn-floating-control');
  const closeBtn = document.getElementById('btn-close-cp');
  const hudContainer = document.querySelector('.gta-hud-container');

  // Toggle Panel open/close
  const togglePanel = () => {
    panel.classList.toggle('open');
    hudContainer.classList.toggle('sidebar-open');
  };

  floatBtn.addEventListener('click', () => {
    synth.playSelect();
    togglePanel();
  });
  closeBtn.addEventListener('click', () => {
    synth.playSelect();
    togglePanel();
  });

  // 1. OBS / Overlay Mode Button
  document.getElementById('btn-toggle-obs').addEventListener('click', () => {
    synth.playSelect();
    const url = new URL(window.location.href);
    url.searchParams.set('stream', 'true');
    window.location.href = url.toString(); // Reload in OBS mode
  });

  // Set up copy link box URL
  const obsUrlInput = document.getElementById('obs-url-display');
  if (obsUrlInput) {
    const streamUrl = new URL(window.location.href);
    streamUrl.searchParams.set('stream', 'true');
    obsUrlInput.value = streamUrl.toString();
  }

  document.getElementById('btn-copy-url').addEventListener('click', () => {
    obsUrlInput.select();
    document.execCommand('copy');
    synth.playSelect();
    const btn = document.getElementById('btn-copy-url');
    btn.innerText = 'Copied!';
    setTimeout(() => { btn.innerText = 'Copy'; }, 2000);
  });

  // 2. Timer Setup buttons
  document.getElementById('btn-timer-start').addEventListener('click', () => {
    synth.playSelect();
    // read inputs first
    const mins = parseInt(document.getElementById('input-minutes').value) || 0;
    const secs = parseInt(document.getElementById('input-seconds').value) || 0;
    const totalSecs = mins * 60 + secs;
    
    // If duration changed, re-apply it
    if (totalSecs !== state.duration) {
      state.duration = totalSecs;
      state.timeLeft = totalSecs;
    }
    startTimer();
  });

  document.getElementById('btn-timer-pause').addEventListener('click', () => {
    synth.playSelect();
    pauseTimer();
  });

  document.getElementById('btn-timer-reset').addEventListener('click', () => {
    synth.playSelect();
    resetTimer();
  });

  // Increment / Decrement
  document.getElementById('btn-add-1m').addEventListener('click', () => {
    synth.playSelect();
    state.timeLeft = Math.min(state.timeLeft + 60, 5940); // cap at 99m
    state.duration = Math.max(state.duration, state.timeLeft);
    saveState();
    syncUI();
  });

  document.getElementById('btn-sub-1m').addEventListener('click', () => {
    synth.playSelect();
    state.timeLeft = Math.max(state.timeLeft - 60, 0);
    saveState();
    syncUI();
  });

  document.getElementById('btn-add-30s').addEventListener('click', () => {
    synth.playSelect();
    state.timeLeft = Math.min(state.timeLeft + 30, 5940);
    state.duration = Math.max(state.duration, state.timeLeft);
    saveState();
    syncUI();
  });

  // 3. Status Text fields (change events)
  const titleIn = document.getElementById('input-status-title');
  const descIn = document.getElementById('input-status-desc');

  const handleTextChange = () => {
    state.statusTitle = titleIn.value;
    state.statusDesc = descIn.value;
    saveState();
    syncUI();
  };

  titleIn.addEventListener('input', handleTextChange);
  descIn.addEventListener('input', handleTextChange);

  // 4. Tab / Cycle Setting Handlers
  const selectTab = document.getElementById('select-active-tab');
  selectTab.addEventListener('change', (e) => {
    synth.playSelect();
    state.activeTab = e.target.value;
    saveState();
    syncUI();
  });

  const checkCycle = document.getElementById('check-auto-cycle');
  checkCycle.addEventListener('change', (e) => {
    synth.playSelect();
    state.autoCycle = e.target.checked;
    saveState();
    syncUI();
  });

  const selectMap = document.getElementById('select-map-style');
  selectMap.addEventListener('change', (e) => {
    synth.playSelect();
    state.mapStyle = e.target.value;
    if (mapEngine) mapEngine.setAnimationStyle(state.mapStyle);
    saveState();
  });

  const musicCheck = document.getElementById('check-play-music');
  if (musicCheck) {
    musicCheck.addEventListener('change', (e) => {
      synth.playSelect();
      state.audioPlaying = e.target.checked;
      togglePauseMusic(state.audioPlaying);
      saveState();
      syncUI();
    });
  }

  const volumeSlider = document.getElementById('input-music-volume');
  volumeSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    document.getElementById('volume-val').innerText = `${Math.round(val * 100)}%`;
    state.musicVolume = val;
    synth.setVolume(val);
    const bgMusic = document.getElementById('bg-music');
    if (bgMusic) bgMusic.volume = val;
    
    // Auto start/stop play depending on volume values
    if (val > 0 && !state.audioPlaying) {
      state.audioPlaying = true;
      togglePauseMusic(true);
    } else if (val === 0 && state.audioPlaying) {
      state.audioPlaying = false;
      togglePauseMusic(false);
    }
    saveState();
    syncUI();
  });

  // Populate Radio select
  const radioSelect = document.getElementById('cp-radio-station');
  RADIO_STATIONS.forEach(rs => {
    const opt = document.createElement('option');
    opt.value = rs.id;
    opt.innerText = rs.name;
    radioSelect.appendChild(opt);
  });

  radioSelect.addEventListener('change', (e) => {
    synth.playSelect();
    const stationId = e.target.value;
    const rs = RADIO_STATIONS.find(r => r.id === stationId);
    state.activeRadioId = stationId;
    state.radioSong = rs.defaultSong;
    document.getElementById('cp-song-name').value = rs.defaultSong;
    saveState();
    syncUI();
  });

  document.getElementById('cp-song-name').addEventListener('input', (e) => {
    state.radioSong = e.target.value;
    saveState();
    // Throttle layout sync slightly to prevent heavy redraw
    document.getElementById('radio-song-name').innerText = e.target.value;
  });

  // 5. Aesthetic Inputs
  const timerColorIn = document.getElementById('input-timer-color');
  const accentColorIn = document.getElementById('input-accent-color');
  const timerFontSelect = document.getElementById('select-timer-font');
  const timerGlowCheck = document.getElementById('check-timer-glow');
  const bgDigitsCheck = document.getElementById('check-bg-digits');

  if (timerColorIn) {
    timerColorIn.addEventListener('input', (e) => {
      state.timerColor = e.target.value;
      saveState();
      applyAesthetics();
    });
  }
  if (accentColorIn) {
    accentColorIn.addEventListener('input', (e) => {
      state.accentColor = e.target.value;
      saveState();
      applyAesthetics();
      // Instantly sync the UI layout colors
      document.querySelectorAll('.tw-card:hover').forEach(card => card.style.borderColor = state.accentColor);
    });
  }
  if (timerFontSelect) {
    timerFontSelect.addEventListener('change', (e) => {
      synth.playSelect();
      state.timerFont = e.target.value;
      saveState();
      applyAesthetics();
    });
  }
  if (timerGlowCheck) {
    timerGlowCheck.addEventListener('change', (e) => {
      synth.playSelect();
      state.timerGlow = e.target.checked;
      saveState();
      applyAesthetics();
    });
  }
  if (bgDigitsCheck) {
    bgDigitsCheck.addEventListener('change', (e) => {
      synth.playSelect();
      state.bgDigits = e.target.checked;
      saveState();
      applyAesthetics();
    });
  }

  // Build Editable lists
  buildStatsEditor();
  buildSocialsEditor();
}

function toggleControlPanel() {
  const panel = document.getElementById('control-panel');
  const hudContainer = document.querySelector('.gta-hud-container');
  if (panel && hudContainer) {
    panel.classList.toggle('open');
    hudContainer.classList.toggle('sidebar-open');
  }
}

function syncControlPanelInputs() {
  // Guard for OBS layout checks
  if (document.body.classList.contains('obs-mode')) return;

  const mins = Math.floor(state.duration / 60);
  const secs = state.duration % 60;
  
  const mInput = document.getElementById('input-minutes');
  const sInput = document.getElementById('input-seconds');
  if (mInput && document.activeElement !== mInput) mInput.value = mins;
  if (sInput && document.activeElement !== sInput) sInput.value = secs;

  const titleIn = document.getElementById('input-status-title');
  const descIn = document.getElementById('input-status-desc');
  if (titleIn && document.activeElement !== titleIn) titleIn.value = state.statusTitle;
  if (descIn && document.activeElement !== descIn) descIn.value = state.statusDesc;

  const selectTab = document.getElementById('select-active-tab');
  if (selectTab) selectTab.value = state.activeTab;

  const checkCycle = document.getElementById('check-auto-cycle');
  if (checkCycle) checkCycle.checked = state.autoCycle;

  const musicCheck = document.getElementById('check-play-music');
  if (musicCheck) musicCheck.checked = state.audioPlaying;

  const selectMap = document.getElementById('select-map-style');
  if (selectMap) selectMap.value = state.mapStyle;

  const volumeSlider = document.getElementById('input-music-volume');
  if (volumeSlider) {
    volumeSlider.value = state.musicVolume;
    document.getElementById('volume-val').innerText = `${Math.round(state.musicVolume * 100)}%`;
  }

  const radioSelect = document.getElementById('cp-radio-station');
  if (radioSelect) radioSelect.value = state.activeRadioId;

  const songIn = document.getElementById('cp-song-name');
  if (songIn && document.activeElement !== songIn) songIn.value = state.radioSong;

  const timerColorIn = document.getElementById('input-timer-color');
  if (timerColorIn && document.activeElement !== timerColorIn) timerColorIn.value = state.timerColor || '#ffffff';

  const accentColorIn = document.getElementById('input-accent-color');
  if (accentColorIn && document.activeElement !== accentColorIn) accentColorIn.value = state.accentColor || '#8fd2eb';

  const timerFontSelect = document.getElementById('select-timer-font');
  if (timerFontSelect) timerFontSelect.value = state.timerFont || 'mono';

  const timerGlowCheck = document.getElementById('check-timer-glow');
  if (timerGlowCheck) timerGlowCheck.checked = state.timerGlow !== false;

  const bgDigitsCheck = document.getElementById('check-bg-digits');
  if (bgDigitsCheck) bgDigitsCheck.checked = state.bgDigits !== false;
}

// Stats Live editor fields population
function buildStatsEditor() {
  const container = document.getElementById('stats-inputs-list');
  const catSelect = document.getElementById('stats-edit-cat');
  if (!container || !catSelect) return;

  const rebuild = () => {
    container.innerHTML = '';
    const cat = catSelect.value;
    const rows = state.stats[cat] || [];

    rows.forEach((r, idx) => {
      const row = document.createElement('div');
      row.className = 'editor-row';
      row.innerHTML = `
        <input type="text" class="stat-name-in" value="${r.name}" placeholder="Stat Name">
        <input type="text" class="stat-val-in" value="${r.val}" placeholder="Stat Value">
      `;
      
      const inputs = row.querySelectorAll('input');
      inputs.forEach(input => {
        input.addEventListener('input', () => {
          rows[idx].name = row.querySelector('.stat-name-in').value;
          rows[idx].val = row.querySelector('.stat-val-in').value;
          saveState();
          
          // Fast local sync of stats if currently viewing this category
          const activeCatItem = document.querySelector('.stats-cat-item.active');
          if (activeCatItem && activeCatItem.getAttribute('data-cat') === cat) {
            renderStatsDetails(cat);
          }
        });
      });
      container.appendChild(row);
    });
  };

  catSelect.addEventListener('change', rebuild);
  rebuild();
}

// Social Media editor fields population
function buildSocialsEditor() {
  const container = document.getElementById('socials-inputs-list');
  if (!container) return;

  container.innerHTML = '';
  state.socials.forEach((s, idx) => {
    const section = document.createElement('div');
    section.style.marginBottom = '12px';
    section.style.borderBottom = '1px solid #1f2937';
    section.style.paddingBottom = '8px';
    
    section.innerHTML = `
      <div style="font-size: 12px; font-weight: 700; color: #9ca3af; margin-bottom: 4px;">${s.platform.toUpperCase()}</div>
      <div class="editor-row">
        <input type="text" class="soc-handle-in" value="${s.handle}" placeholder="Handle">
        <input type="text" class="soc-url-in" value="${s.url}" placeholder="Link URL">
      </div>
    `;

    const inputs = section.querySelectorAll('input');
    inputs.forEach(input => {
      input.addEventListener('input', () => {
        state.socials[idx].handle = section.querySelector('.soc-handle-in').value;
        state.socials[idx].url = section.querySelector('.soc-url-in').value;
        saveState();
        syncUI();
      });
    });

    container.appendChild(section);
  });
}

// -------------------------------------------------------------
// Auto-Cycle Mode Handler
// -------------------------------------------------------------
function toggleAutoCycle(enable) {
  clearInterval(cycleInterval);
  if (!enable) return;

  cycleInterval = setInterval(() => {
    // Cycles HUD tabs in order: pause -> stats -> socials -> radio
    const tabs = ["pause", "stats", "socials", "radio"];
    const nextIdx = (tabs.indexOf(state.activeTab) + 1) % tabs.length;
    
    state.activeTab = tabs[nextIdx];
    saveState();
    
    // Apply changes visually
    switchHUDTab(state.activeTab, false);
    syncControlPanelInputs();
  }, state.cycleInterval * 1000);
}
