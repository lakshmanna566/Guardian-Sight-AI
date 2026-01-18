import React, { useEffect, useState, useRef } from 'react';
import { Terminal, Cpu } from 'lucide-react';

interface ReasoningOverlayProps {
  isAnalyzing: boolean;
  currentStep?: string;
}

const PROCESS_LOGS = [
  "INITIALIZING VISION KERNEL...",
  "LOADING OSHA_1910_STD.BIN...",
  "DETECTING HUMAN SUBJECTS...",
  "CALCULATING SPATIAL VECTORS...",
  "ANALYZING PPE COMPLIANCE...",
  "CHECKING FALL HAZARDS (ZONE A)...",
  "REFERENCING SAFETY MANUAL 4.2(a)...",
  "EVALUATING RISK PROBABILITY...",
  "GENERATING COMPLIANCE REPORT...",
  "FINALIZING AUDIT..."
];

export const ReasoningOverlay: React.FC<ReasoningOverlayProps> = ({ isAnalyzing }) => {
  const [logs, setLogs] = useState<string[]>([]);
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    
    if (isAnalyzing) {
      setLogs([]); // Clear logs on start
      let index = 0;
      
      interval = setInterval(() => {
        if (index < PROCESS_LOGS.length) {
          const timestamp = new Date().toISOString().split('T')[1].slice(0, 8); // HH:MM:SS
          setLogs(prev => [...prev, `[${timestamp}] ${PROCESS_LOGS[index]}`]);
          index++;
        }
      }, 400); // Add a new line every 400ms
    } else {
      setLogs([]);
    }

    return () => clearInterval(interval);
  }, [isAnalyzing]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="h-full bg-slate-950 border border-slate-800 rounded-xl p-0 font-mono flex flex-col overflow-hidden shadow-lg relative">
      {/* Terminal Header */}
      <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 flex justify-between items-center z-10">
        <div className="flex items-center gap-2">
           <Terminal size={14} className="text-cyan-500" />
           <span className="text-[11px] font-bold text-slate-300 uppercase tracking-widest">
             Reasoning Core
           </span>
        </div>
        <div className="flex gap-1.5">
          <div className="w-2 h-2 rounded-full bg-slate-700"></div>
          <div className="w-2 h-2 rounded-full bg-slate-700"></div>
          <div className={`w-2 h-2 rounded-full ${isAnalyzing ? 'bg-cyan-500 animate-pulse' : 'bg-slate-700'}`}></div>
        </div>
      </div>
      
      {/* Terminal Content */}
      <div className="flex-1 p-4 overflow-hidden relative bg-black/50">
         {/* Background Grid */}
         <div className="absolute inset-0 opacity-[0.05] bg-[linear-gradient(rgba(0,255,255,0.1)_1px,transparent_1px)] bg-[size:100%_4px] pointer-events-none"></div>

         {isAnalyzing ? (
           <div className="relative z-10 h-full flex flex-col">
             {/* Progress Bar */}
             <div className="mb-4">
                <div className="flex justify-between text-[10px] text-cyan-500 uppercase mb-1">
                    <span>Analysis Stream</span>
                    <span className="animate-pulse">ACTIVE</span>
                </div>
                <div className="h-0.5 w-full bg-slate-800 relative overflow-hidden">
                    <div className="absolute inset-y-0 left-0 bg-cyan-500 w-1/3 animate-[translateX_1.5s_ease-in-out_infinite]" style={{ animationName: 'scanbar' }}></div>
                </div>
                <style>{`
                  @keyframes scanbar {
                    0% { left: -30%; }
                    100% { left: 100%; }
                  }
                `}</style>
             </div>

             {/* Scrolling Logs */}
             <div ref={logContainerRef} className="flex-1 overflow-hidden flex flex-col justify-end space-y-1">
                {logs.map((log, i) => (
                    <div key={i} className="text-[10px] md:text-xs text-cyan-400/80 font-mono animate-[fadeIn_0.2s_ease-out]">
                       <span className="opacity-50 mr-2">{'>'}</span>{log}
                    </div>
                ))}
                <div className="text-[10px] md:text-xs text-cyan-400 font-mono animate-pulse">
                   <span className="opacity-50 mr-2">{'>'}</span>_
                </div>
             </div>
           </div>
         ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-700 gap-3">
              <Cpu size={32} strokeWidth={1} className="opacity-30" />
              <div className="text-center">
                <p className="text-xs uppercase tracking-widest text-slate-600">Idle State</p>
                <p className="text-[10px] opacity-40">Awaiting Frame Input</p>
              </div>
            </div>
         )}
      </div>
    </div>
  );
};