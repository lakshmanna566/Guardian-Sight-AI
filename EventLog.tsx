import React, { useRef, useEffect } from 'react';
import { ShieldCheck, AlertOctagon, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { SafetyEvent } from '../types';

interface EventLogProps {
  events: SafetyEvent[];
}

export const EventLog: React.FC<EventLogProps> = ({ events }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [events]);

  return (
    <>
      <div className="bg-slate-900/80 px-4 py-3 border-b border-slate-800 flex justify-between items-center backdrop-blur">
        <h3 className="text-slate-200 font-bold uppercase tracking-widest text-xs flex items-center gap-2">
          <ShieldCheck size={14} className="text-cyan-500" />
          Event Stream
        </h3>
        <span className="text-[10px] font-mono bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full border border-slate-700">
          {events.length} LOGS
        </span>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950/30 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
        {events.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-2 opacity-60">
            <Info size={24} />
            <span className="text-xs font-mono uppercase">Log Empty</span>
          </div>
        )}
        
        {events.map((event) => (
          <div 
            key={event.id} 
            className={`relative group rounded-lg p-3 border border-l-4 transition-all hover:translate-x-1 ${
              event.severity === 'critical' || event.severity === 'high' ? 'border-l-red-500 border-y-red-900/30 border-r-red-900/30 bg-red-950/10' :
              event.severity === 'medium' ? 'border-l-amber-500 border-y-amber-900/30 border-r-amber-900/30 bg-amber-950/10' :
              'border-l-emerald-500 border-y-emerald-900/30 border-r-emerald-900/30 bg-emerald-950/10'
            }`}
          >
            {/* Header */}
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                 {event.severity === 'safe' ? (
                   <CheckCircle2 size={14} className="text-emerald-500" />
                 ) : (
                   <AlertOctagon size={14} className={event.severity === 'critical' ? "text-red-500 animate-pulse" : "text-amber-500"} />
                 )}
                 <span className={`font-bold text-[10px] uppercase tracking-wider ${
                    event.severity === 'safe' ? 'text-emerald-400' : 
                    event.severity === 'critical' ? 'text-red-400' : 'text-amber-400'
                  }`}>
                    {event.severity} PRIORITY
                 </span>
              </div>
              <span className="text-[10px] font-mono text-slate-500">
                {event.timestamp.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' })}
              </span>
            </div>

            {/* Content */}
            <div className="mb-2">
                <div className="text-xs text-slate-500 font-mono uppercase mb-0.5 tracking-wider">{event.location}</div>
                <p className="text-sm text-slate-200 font-medium leading-snug shadow-black drop-shadow-sm">{event.message}</p>
            </div>
            
            {/* Reasoning Drawer */}
            <div className="mt-3 pt-2 border-t border-white/5">
              <span className="text-[9px] text-slate-500 font-bold uppercase block mb-1.5 tracking-wider">AI Analysis Trace</span>
              <ul className="space-y-1">
                {event.reasoning.map((step, idx) => (
                    <li key={idx} className="text-[10px] text-slate-400 font-mono pl-2 border-l border-slate-700 leading-relaxed">
                       {step}
                    </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </>
  );
};