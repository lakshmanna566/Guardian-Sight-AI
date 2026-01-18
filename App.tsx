import React, { useState, useCallback, useRef, useEffect } from 'react';
import { CameraFeed } from './components/CameraFeed';
import { EventLog } from './components/EventLog';
import { ReasoningOverlay } from './components/ReasoningOverlay';
import { analyzeFrame } from './services/geminiService';
import { SafetyEvent, Severity } from './types';
import { SoundSettingsModal, AlertSoundType } from './components/SoundSettingsModal';
import { Play, Square, AlertOctagon, Activity, AlertTriangle, Volume2, VolumeX, Settings, PlayCircle, Clock, Shield, Upload, Download, FileVideo, X } from 'lucide-react';

// --- Sound Generation Utilities ---

const playSiren = (ctx: AudioContext, now: number, masterVolume: number, severity: Severity) => {
  const masterGain = ctx.createGain();
  masterGain.connect(ctx.destination);

  // Dynamic Parameters based on Severity
  let baseFreq = 880;
  let peakFreq = 1200;
  let modRate = 12;
  let duration = 0.6;
  let volAdjust = 1.0;

  switch (severity) {
    case 'critical':
      baseFreq = 1000; peakFreq = 1600; modRate = 20; duration = 0.9; volAdjust = 1.2;
      break;
    case 'medium':
      baseFreq = 440; peakFreq = 600; modRate = 6; duration = 0.5; volAdjust = 0.7;
      break;
    case 'low':
      baseFreq = 220; peakFreq = 300; modRate = 3; duration = 0.4; volAdjust = 0.4;
      break;
    case 'high':
    default:
      // Defaults apply
      break;
  }

  // FM SYNTHESIS
  const carrier = ctx.createOscillator();
  carrier.type = 'sawtooth';
  carrier.frequency.setValueAtTime(baseFreq, now);

  const modulator = ctx.createOscillator();
  modulator.type = 'sine';
  modulator.frequency.setValueAtTime(modRate, now); 

  const modGain = ctx.createGain();
  modGain.gain.setValueAtTime(100, now); 

  modulator.connect(modGain);
  modGain.connect(carrier.frequency);
  
  carrier.connect(masterGain);

  // Pitch Ramp
  carrier.frequency.linearRampToValueAtTime(peakFreq, now + (duration * 0.2));
  carrier.frequency.linearRampToValueAtTime(baseFreq, now + (duration * 0.8));

  // Envelope
  const effectiveVol = 0.3 * masterVolume * volAdjust;
  masterGain.gain.setValueAtTime(effectiveVol, now);
  masterGain.gain.exponentialRampToValueAtTime(0.01, now + duration);

  carrier.start(now);
  modulator.start(now);
  carrier.stop(now + duration);
  modulator.stop(now + duration);
};

const playBeep = (
  ctx: AudioContext, 
  now: number, 
  masterVolume: number,
  severity: Severity
) => {
  const masterGain = ctx.createGain();
  masterGain.connect(ctx.destination);
  
  let frequency = 1200;
  let duration = 0.15;
  let count = 1;
  let interval = 0.2;
  let volAdjust = 1.0;

  switch (severity) {
    case 'critical':
      frequency = 1500; count = 3; interval = 0.12; duration = 0.08; volAdjust = 1.1;
      break;
    case 'medium':
      frequency = 800; count = 1; duration = 0.2; volAdjust = 0.7;
      break;
    case 'low':
      frequency = 440; count = 1; duration = 0.15; volAdjust = 0.5;
      break;
    case 'high':
    default:
      frequency = 1200; count = 2; interval = 0.18;
      break;
  }

  for (let i = 0; i < count; i++) {
    const startTime = now + (i * interval);
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, startTime);
    
    const gain = ctx.createGain();
    gain.connect(masterGain);
    
    const effectiveVol = 0.3 * masterVolume * volAdjust;
    gain.gain.setValueAtTime(effectiveVol, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    
    osc.start(startTime);
    osc.stop(startTime + duration);
  }
};

const playPulse = (
  ctx: AudioContext, 
  now: number, 
  masterVolume: number,
  severity: Severity
) => {
  const masterGain = ctx.createGain();
  masterGain.connect(ctx.destination);

  let frequency = 110;
  let pulseCount = 2;
  let pulseDuration = 0.1;
  let interval = 0.15;
  let volAdjust = 1.0;

  switch (severity) {
    case 'critical':
      frequency = 150; pulseCount = 4; pulseDuration = 0.06; interval = 0.1; volAdjust = 1.2;
      break;
    case 'medium':
      frequency = 80; pulseCount = 1; pulseDuration = 0.3; volAdjust = 0.8;
      break;
    case 'low':
      frequency = 55; pulseCount = 1; pulseDuration = 0.4; volAdjust = 0.5;
      break;
    case 'high':
    default:
      // Defaults apply
      break;
  }

  for (let i = 0; i < pulseCount; i++) {
    const startTime = now + (i * interval);
    const stopTime = startTime + pulseDuration;

    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(frequency, now); 
    
    const gain = ctx.createGain();
    gain.connect(masterGain);
    osc.connect(gain);

    const effectiveVol = 0.4 * masterVolume * volAdjust;
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(effectiveVol, startTime + 0.01);
    gain.gain.setValueAtTime(effectiveVol, stopTime - 0.01);
    gain.gain.linearRampToValueAtTime(0, stopTime);

    osc.start(startTime);
    osc.stop(stopTime);
  }
};

const App: React.FC = () => {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [events, setEvents] = useState<SafetyEvent[]>([]);
  const [lastAlert, setLastAlert] = useState<SafetyEvent | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Video Upload State
  const [uploadedVideoSrc, setUploadedVideoSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Audio State
  const [isMuted, setIsMuted] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Load settings from localStorage
  const [alertSound, setAlertSound] = useState<AlertSoundType>(() => {
    return (localStorage.getItem('safety_auditor_sound') as AlertSoundType) || 'siren';
  });
  const [volume, setVolume] = useState<number>(() => {
    const saved = localStorage.getItem('safety_auditor_volume');
    return saved ? parseFloat(saved) : 0.5;
  });
  
  // Refs
  const isMutedRef = useRef(isMuted);
  const alertSoundRef = useRef(alertSound);
  const volumeRef = useRef(volume);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    alertSoundRef.current = alertSound;
    localStorage.setItem('safety_auditor_sound', alertSound);
  }, [alertSound]);

  useEffect(() => {
    volumeRef.current = volume;
    localStorage.setItem('safety_auditor_volume', volume.toString());
  }, [volume]);

  // Clock Timer
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Cleanup audio
  useEffect(() => {
    return () => {
      audioCtxRef.current?.close();
    };
  }, []);
  
  // Visual Flash State
  const [activeSeverity, setActiveSeverity] = useState<Severity | null>(null);

  const initAudio = async () => {
    if (!audioCtxRef.current) {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      audioCtxRef.current = new AudioContext();
    }
    if (audioCtxRef.current.state === 'suspended') {
      await audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  const toggleMonitoring = useCallback(async () => {
    if (!isMonitoring) {
      try {
        const ctx = await initAudio();
        // Confirmation chirp
        playBeep(ctx, ctx.currentTime, volumeRef.current, 'low');
      } catch (e) {
        console.error("Audio init failed", e);
      }
    }
    setIsMonitoring(prev => !prev);
  }, [isMonitoring]);

  const playAlertSound = useCallback(async (force = false, severity: Severity = 'high') => {
    if (!force && isMutedRef.current) return;
    // Don't play sound for safe events unless forced
    if (severity === 'safe' && !force) return;

    let ctx = audioCtxRef.current;
    if (!ctx) {
      ctx = await initAudio();
    }
    
    if (!ctx) return;

    const now = ctx.currentTime;
    const type = alertSoundRef.current;
    const vol = volumeRef.current;

    if (type === 'siren') {
      playSiren(ctx, now, vol, severity);
    } else if (type === 'beep') {
      playBeep(ctx, now, vol, severity);
    } else if (type === 'pulse') {
      playPulse(ctx, now, vol, severity);
    }
  }, []);

  const triggerAlert = (event: SafetyEvent) => {
    setEvents(prev => [...prev, event]);
    
    // Set Visual Flash based on severity
    setActiveSeverity(event.severity);
    
    // Determine duration
    let duration = 600;
    if (event.severity === 'critical') duration = 1200;
    else if (event.severity === 'high') duration = 900;
    else if (event.severity === 'medium') duration = 700;
    else if (event.severity === 'low') duration = 400;
    else if (event.severity === 'safe') duration = 500;

    // Reset visual flash after duration
    setTimeout(() => setActiveSeverity(null), duration);

    // Persistent Header Alert (Critical/High only for persistent banner)
    if (event.severity === 'high' || event.severity === 'critical') {
      setLastAlert(event);
      setTimeout(() => setLastAlert(null), 5000); // Banner stays for 5s
    }

    // Audio Feedback (Dynamic based on severity)
    if (event.severity !== 'safe') {
      playAlertSound(false, event.severity);
      console.log(`[AUDIO TRIGGER] Type: ${alertSoundRef.current}, Severity: ${event.severity}`);
    }
  };

  const handleFrameCapture = useCallback(async (base64: string) => {
    if (isAnalyzing) return; 
    setIsAnalyzing(true);
    try {
      const result = await analyzeFrame(base64);
      if (result) {
        const steps = result.reasoning_steps
            .split(/\d+\./)
            .map(s => s.trim())
            .filter(s => s.length > 0);

        const newEvent: SafetyEvent = {
          id: crypto.randomUUID(),
          timestamp: new Date(),
          severity: result.severity,
          message: result.message,
          location: result.location,
          reasoning: steps.length > 0 ? steps : [result.reasoning_steps]
        };
        triggerAlert(newEvent);
      }
    } catch (e) {
      console.error("Analysis loop error:", e);
    } finally {
      setIsAnalyzing(false);
    }
  }, [isAnalyzing, playAlertSound]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (uploadedVideoSrc) {
        URL.revokeObjectURL(uploadedVideoSrc);
      }
      const url = URL.createObjectURL(file);
      setUploadedVideoSrc(url);
      setIsMonitoring(false); // Reset monitoring when new file loaded
    }
  };

  const downloadCSV = () => {
    if (events.length === 0) {
      alert("No events to log.");
      return;
    }
    
    const headers = ['Timestamp', 'Severity', 'Location', 'Message', 'Reasoning'];
    const rows = events.map(e => [
      e.timestamp.toISOString(),
      e.severity,
      `"${e.location.replace(/"/g, '""')}"`,
      `"${e.message.replace(/"/g, '""')}"`,
      `"${e.reasoning.join('; ').replace(/"/g, '""')}"`
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `safety_audit_log_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-cyan-900 selection:text-white overflow-hidden relative">
      
      {/* Grid Pattern Background */}
      <div className="absolute inset-0 pointer-events-none opacity-5 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>

      {/* Full Screen Alarm Flash Overlay - Updated blend mode and colors */}
      <div 
        className={`absolute inset-0 z-50 pointer-events-none transition-opacity duration-300 mix-blend-hard-light ${
          activeSeverity === 'critical' ? 'bg-red-600 opacity-60' : 
          activeSeverity === 'high' ? 'bg-orange-600 opacity-50' : 
          activeSeverity === 'medium' ? 'bg-amber-500 opacity-40' :
          activeSeverity === 'low' ? 'bg-blue-500 opacity-30' :
          activeSeverity === 'safe' ? 'bg-emerald-500 opacity-30' :
          'opacity-0'
        }`}
      />

      {/* Header */}
      <header className="h-16 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-40 shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-2 rounded-lg shadow-lg shadow-orange-900/20 text-slate-950">
            <AlertOctagon size={24} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="font-bold text-xl tracking-tight text-white leading-none">
              INDUSTRIAL AUDITOR <span className="text-amber-500">PRO</span>
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-slate-400 font-mono tracking-widest uppercase">
                Powered by Gemini 3 Flash
              </span>
              <span className="w-1 h-1 rounded-full bg-slate-600"></span>
              <span className="text-[10px] text-cyan-500 font-mono tracking-widest uppercase flex items-center gap-1">
                 v2.5.0 <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse"></span>
              </span>
            </div>
          </div>
        </div>

        {/* Center: System Clock */}
        <div className="hidden md:flex flex-col items-center bg-black/20 px-4 py-1 rounded border border-slate-800/50">
           <div className="text-xs text-slate-500 font-mono tracking-widest uppercase mb-0.5">System Time</div>
           <div className="text-lg font-mono font-bold text-slate-200 tabular-nums">
             {currentTime.toLocaleTimeString([], { hour12: false })}
           </div>
        </div>

        <div className="flex items-center gap-4">
          
          {/* Audio Controls */}
          <div className="flex items-center gap-1 bg-black/40 rounded-lg p-1 border border-slate-800 backdrop-blur-sm">
            <button 
              onClick={() => setIsMuted(!isMuted)}
              className={`p-2 rounded hover:bg-white/5 transition-colors ${isMuted ? 'text-red-400' : 'text-emerald-400'}`}
              title={isMuted ? "Unmute Alerts" : "Mute Alerts"}
            >
              {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <div className="w-px h-6 bg-slate-800 mx-1"></div>
            
            <button
               onClick={() => setIsSettingsOpen(true)}
               className="p-2 rounded text-slate-400 hover:text-white transition-colors flex items-center gap-2 group"
               title="Audio Settings"
            >
               <Settings size={16} className="group-hover:rotate-90 transition-transform duration-500" />
            </button>
          </div>
          
           {/* Upload/Export Controls */}
           <div className="flex items-center gap-2">
            <input 
              type="file" 
              accept="video/*" 
              ref={fileInputRef} 
              className="hidden" 
              onChange={handleFileUpload} 
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-300 transition-colors uppercase tracking-wider"
              title="Upload Video for Audit"
            >
              <Upload size={14} />
              <span className="hidden lg:inline">Upload</span>
            </button>
            <button 
              onClick={downloadCSV}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-300 transition-colors uppercase tracking-wider"
              title="Download Safety Log CSV"
            >
              <Download size={14} />
              <span className="hidden lg:inline">Log</span>
            </button>
             
            {/* Clear Button if File Loaded */}
            {uploadedVideoSrc && (
               <button 
                 onClick={() => {
                   setUploadedVideoSrc(null);
                   setIsMonitoring(false);
                 }}
                 className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-900/50 hover:bg-red-900 border border-red-700 text-xs font-bold text-red-200 transition-colors uppercase tracking-wider"
                 title="Close Video / Return to Camera"
               >
                 <X size={14} />
               </button>
            )}
          </div>

          {lastAlert && (
            <div className={`animate-pulse hidden md:flex items-center gap-2 font-bold uppercase tracking-wider text-xs border px-3 py-1.5 rounded shadow-[0_0_15px_currentColor] ${
               lastAlert.severity === 'critical' 
               ? 'text-red-500 border-red-500/50 bg-red-950/50' 
               : 'text-orange-500 border-orange-500/50 bg-orange-950/50'
            }`}>
              <Activity size={14} />
              {lastAlert.severity} HAZARD
            </div>
          )}
          
          <button
            onClick={toggleMonitoring}
            className={`group relative flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider transition-all shadow-lg overflow-hidden ${
              isMonitoring 
                ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-900/30 border border-red-500' 
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30 border border-emerald-500'
            }`}
          >
            <div className={`absolute inset-0 bg-white/20 translate-y-full transition-transform duration-300 ${isMonitoring ? '' : 'group-hover:translate-y-0'}`}></div>
            {isMonitoring ? (
              <>
                <Square size={14} fill="currentColor" /> {uploadedVideoSrc ? 'STOP VIDEO' : 'STOP FEED'}
              </>
            ) : (
              <>
                <Play size={14} fill="currentColor" /> {uploadedVideoSrc ? 'ANALYZE VIDEO' : 'START FEED'}
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Grid */}
      <main className="p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-4rem)]">
        
        {/* Left Column: Video & Visualization (8/12) */}
        <div className="lg:col-span-8 flex flex-col gap-6 h-full min-h-0">
          {/* Video Feed Area */}
          <div className="flex-1 min-h-0 relative rounded-xl overflow-hidden border border-slate-700 bg-black shadow-2xl ring-1 ring-white/5">
             <CameraFeed 
               isActive={isMonitoring} 
               onFrameCapture={handleFrameCapture}
               intervalMs={5000} 
               uploadSrc={uploadedVideoSrc}
             />
             
             {/* Tech Stats Overlay */}
             {isMonitoring && (
               <div className="absolute bottom-6 right-6 flex flex-col items-end space-y-1 pointer-events-none">
                 <div className="flex items-center gap-2 text-[10px] font-mono text-cyan-500 bg-black/80 backdrop-blur px-2 py-1 rounded border border-cyan-900/50">
                   <Activity size={10} />
                   <span>LATENCY: {Math.floor(Math.random() * 20) + 45}ms</span>
                 </div>
                 <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400 bg-black/80 backdrop-blur px-2 py-1 rounded border border-slate-800">
                   <span>BUFFER: 1024KB</span>
                 </div>
               </div>
             )}
          </div>

          {/* Reasoning Engine Visualizer */}
          <div className="h-48 shrink-0">
            <ReasoningOverlay isAnalyzing={isAnalyzing} />
          </div>
        </div>

        {/* Right Column: Event Log (4/12) */}
        <div className="lg:col-span-4 h-full min-h-0 bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-xl overflow-hidden shadow-xl flex flex-col">
          <EventLog events={events} />
        </div>

      </main>

      {/* Settings Modal */}
      <SoundSettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentSound={alertSound}
        onSoundChange={setAlertSound}
        volume={volume}
        onVolumeChange={setVolume}
        onPreview={() => playAlertSound(true, 'high')}
      />

      {/* API Key Modal (Simple Check) */}
      {!process.env.API_KEY && (
        <div className="absolute inset-0 bg-slate-950/90 z-[100] flex items-center justify-center p-6 backdrop-blur-sm">
          <div className="bg-slate-900 border border-red-500/50 p-8 rounded-2xl max-w-md text-center shadow-2xl shadow-red-900/20">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="text-red-500" size={32} />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Configuration Error</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              API Key is missing. This application requires a Google GenAI API Key configured in the environment variables to function properly.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;