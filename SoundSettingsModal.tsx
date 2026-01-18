import React from 'react';
import { X, Volume2, PlayCircle, Check } from 'lucide-react';

export type AlertSoundType = 'siren' | 'beep' | 'pulse';

interface SoundSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSound: AlertSoundType;
  onSoundChange: (sound: AlertSoundType) => void;
  volume: number;
  onVolumeChange: (volume: number) => void;
  onPreview: () => void;
}

export const SoundSettingsModal: React.FC<SoundSettingsModalProps> = ({
  isOpen,
  onClose,
  currentSound,
  onSoundChange,
  volume,
  onVolumeChange,
  onPreview,
}) => {
  if (!isOpen) return null;

  const sounds: { id: AlertSoundType; label: string }[] = [
    { id: 'siren', label: 'Industrial Siren' },
    { id: 'beep', label: 'High-Pitch Beep' },
    { id: 'pulse', label: 'Warning Pulse' },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md overflow-hidden relative animate-in zoom-in-95 duration-200">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
          <h2 className="text-white font-bold text-sm uppercase tracking-wider flex items-center gap-2">
            <Volume2 size={16} className="text-cyan-500" />
            Audio Configuration
          </h2>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Volume Control */}
          <div className="space-y-3">
            <div className="flex justify-between items-center text-xs uppercase tracking-wide font-bold text-slate-400">
              <span>Master Volume</span>
              <span>{Math.round(volume * 100)}%</span>
            </div>
            <div className="relative flex items-center">
                <Volume2 size={16} className="text-slate-500 mr-3" />
                <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500 hover:accent-cyan-400"
                />
            </div>
          </div>

          {/* Sound Selection */}
          <div className="space-y-3">
             <label className="text-xs uppercase tracking-wide font-bold text-slate-400">Alert Tone</label>
             <div className="grid gap-2">
               {sounds.map((sound) => (
                 <div 
                   key={sound.id}
                   onClick={() => onSoundChange(sound.id)}
                   className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                     currentSound === sound.id 
                       ? 'bg-cyan-950/30 border-cyan-500/50 shadow-[0_0_10px_rgba(6,182,212,0.1)]' 
                       : 'bg-slate-800/50 border-slate-700 hover:border-slate-600 hover:bg-slate-800'
                   }`}
                 >
                   <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                        currentSound === sound.id ? 'border-cyan-500' : 'border-slate-600'
                      }`}>
                        {currentSound === sound.id && <div className="w-2 h-2 bg-cyan-500 rounded-full" />}
                      </div>
                      <span className={`text-sm font-medium ${currentSound === sound.id ? 'text-white' : 'text-slate-300'}`}>
                        {sound.label}
                      </span>
                   </div>
                   {currentSound === sound.id && <Check size={16} className="text-cyan-500" />}
                 </div>
               ))}
             </div>
          </div>

          {/* Preview Button */}
          <button
            onClick={onPreview}
            className="w-full py-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:border-slate-500 rounded-lg text-sm font-bold text-cyan-400 uppercase tracking-wider flex items-center justify-center gap-2 transition-all hover:shadow-lg hover:shadow-cyan-900/20 active:scale-[0.98]"
          >
            <PlayCircle size={18} />
            Test Audio Settings
          </button>
        </div>

        <div className="p-4 bg-slate-950/50 text-[10px] text-slate-500 text-center font-mono border-t border-slate-800">
          Settings are automatically saved to local storage.
        </div>
      </div>
    </div>
  );
};