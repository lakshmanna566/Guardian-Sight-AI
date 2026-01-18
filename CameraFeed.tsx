import React, { useRef, useEffect, useState } from 'react';
import { Camera, CameraOff, Scan, FileVideo } from 'lucide-react';

interface CameraFeedProps {
  isActive: boolean;
  onFrameCapture: (base64: string) => void;
  intervalMs?: number;
  uploadSrc?: string | null;
}

export const CameraFeed: React.FC<CameraFeedProps> = ({ 
  isActive, 
  onFrameCapture, 
  intervalMs = 3000,
  uploadSrc
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const streamRef = useRef<MediaStream | null>(null);

  // Handle Video Source (Camera vs File)
  useEffect(() => {
    const setupCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          streamRef.current = stream;
          setHasPermission(true);
          // Explicitly play to ensure stream starts
          videoRef.current.play().catch(e => {
             if (e.name !== 'AbortError') console.log("Camera play error", e);
          });
        }
      } catch (err) {
        console.error("Error accessing camera:", err);
        setHasPermission(false);
      }
    };

    const cleanupStream = () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };

    if (uploadSrc) {
      // FILE MODE
      cleanupStream();
      if (videoRef.current) {
        videoRef.current.srcObject = null; // Clear any existing camera stream
        videoRef.current.src = uploadSrc;
        videoRef.current.load();
        setHasPermission(true); // Permission implied for file
      }
    } else {
      // CAMERA MODE
      if (isActive) {
        if (videoRef.current) {
             videoRef.current.removeAttribute('src'); // Cleanly remove file src
             videoRef.current.load();
        }
        setupCamera();
      } else {
        cleanupStream();
      }
    }

    return cleanupStream;
  }, [isActive, uploadSrc]);

  // Handle Playback State for File
  useEffect(() => {
    if (uploadSrc && videoRef.current) {
        if (isActive) {
            const playPromise = videoRef.current.play();
            if (playPromise !== undefined) {
              playPromise.catch(e => {
                 if (e.name !== 'AbortError') console.error("Play error", e);
              });
            }
        } else {
            videoRef.current.pause();
        }
    }
  }, [isActive, uploadSrc]);

  // Frame Capture Loop
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;

    if (isActive && hasPermission) {
      intervalId = setInterval(() => {
        if (videoRef.current && canvasRef.current) {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          
          if (video.readyState >= video.HAVE_CURRENT_DATA) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const base64 = canvas.toDataURL('image/jpeg', 0.7); 
              onFrameCapture(base64);
            }
          }
        }
      }, intervalMs);
    }

    return () => clearInterval(intervalId);
  }, [isActive, hasPermission, intervalMs, onFrameCapture]);

  return (
    <div className="relative w-full h-full bg-black overflow-hidden group">
      {!isActive && (
        <div className="absolute inset-0 flex items-center justify-center flex-col gap-4 bg-slate-900/50 backdrop-blur-sm z-10">
          <div className="relative">
            <div className={`absolute inset-0 ${uploadSrc ? 'bg-amber-500' : 'bg-cyan-500'} blur-xl opacity-20 animate-pulse`}></div>
            {uploadSrc ? (
               <FileVideo size={64} className="text-amber-500 relative z-10" />
            ) : (
               <CameraOff size={64} className="text-slate-600 relative z-10" />
            )}
          </div>
          <div className="flex flex-col items-center">
            <span className="font-mono text-lg text-slate-400 tracking-[0.2em] font-bold">
                {uploadSrc ? 'READY FOR ANALYSIS' : 'SYSTEM OFFLINE'}
            </span>
            <span className="text-xs text-slate-600 mt-1 font-mono">
                {uploadSrc ? 'VIDEO FILE LOADED' : 'AWAITING INPUT STREAM'}
            </span>
          </div>
        </div>
      )}
      
      <video 
        ref={videoRef} 
        autoPlay={!uploadSrc} // Autoplay only for camera, file is controlled by isActive
        playsInline 
        muted 
        loop={!!uploadSrc}
        className={`w-full h-full object-contain transition-opacity duration-1000 ${isActive ? 'opacity-100' : 'opacity-20 grayscale'}`}
      />
      <canvas ref={canvasRef} className="hidden" />
      
      {/* HUD Overlay Layer */}
      <div className="absolute inset-0 pointer-events-none p-4 md:p-6 flex flex-col justify-between">
        
        {/* Top Bar HUD */}
        <div className="flex justify-between items-start">
           <div className="flex items-center gap-2">
             <div className={`w-3 h-3 rounded-sm ${isActive ? 'bg-red-500 animate-pulse shadow-[0_0_10px_red]' : 'bg-slate-700'}`}></div>
             <div className="flex flex-col">
                <span className="text-[10px] font-mono text-white bg-black/50 px-1.5 py-0.5 rounded-sm border border-white/10 tracking-widest">
                  {uploadSrc ? 'SRC-FILE' : 'CAM-01'} • {isActive ? 'LIVE' : 'STANDBY'}
                </span>
             </div>
           </div>
           
           <div className="text-[10px] font-mono text-cyan-500/80 bg-black/50 px-2 py-1 border border-cyan-500/20 rounded-sm">
             OSHA-COMPLIANCE-MODE: ACTIVE
           </div>
        </div>

        {/* Center Crosshair */}
        {isActive && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-30">
                <div className="w-12 h-12 border border-cyan-400 rounded-full flex items-center justify-center relative">
                    <div className="w-1 h-1 bg-cyan-400 rounded-full"></div>
                    <div className="absolute top-0 w-px h-3 bg-cyan-400"></div>
                    <div className="absolute bottom-0 w-px h-3 bg-cyan-400"></div>
                    <div className="absolute left-0 h-px w-3 bg-cyan-400"></div>
                    <div className="absolute right-0 h-px w-3 bg-cyan-400"></div>
                </div>
            </div>
        )}

        {/* Bottom Bar HUD */}
        <div className="flex justify-between items-end">
             <div className="text-[9px] font-mono text-slate-500">
               {uploadSrc ? 'PLAYBACK' : '1280x720'} @ 30FPS <br/>
               ISO: {uploadSrc ? 'N/A' : 'AUTO'}
             </div>
             
             {/* Corner Brackets */}
             <svg className="absolute inset-4 md:inset-6 w-[calc(100%-2rem)] h-[calc(100%-2rem)] md:w-[calc(100%-3rem)] md:h-[calc(100%-3rem)] opacity-40" xmlns="http://www.w3.org/2000/svg">
                <path d="M40 2 H2 V40" fill="none" stroke="currentColor" strokeWidth="2" className="text-cyan-500" />
                <path d="M40 100% H2 V100%-40" transform="scale(1, -1) translate(0, -100%)" fill="none" stroke="currentColor" strokeWidth="2" className="text-cyan-500" />
                <path d="M100%-40 2 H100%-2 V40" transform="scale(-1, 1) translate(-100%, 0)" fill="none" stroke="currentColor" strokeWidth="2" className="text-cyan-500" />
                <path d="M100%-40 100% H100%-2 V100%-40" transform="scale(-1, -1) translate(-100%, -100%)" fill="none" stroke="currentColor" strokeWidth="2" className="text-cyan-500" />
             </svg>
        </div>
      </div>
      
      {/* Scanline & Grid Effect */}
      {isActive && (
        <>
            <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.4)_50%)] bg-[length:100%_4px] opacity-20"></div>
            <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:100px_100px]"></div>
            
            {/* Moving Scan Bar */}
            <div className="absolute top-0 left-0 w-full h-0.5 bg-cyan-400/50 shadow-[0_0_20px_rgba(34,211,238,0.5)] animate-[scan_3s_linear_infinite] opacity-50"></div>
            <style>{`
                @keyframes scan {
                0% { top: 0%; opacity: 0; }
                10% { opacity: 1; }
                90% { opacity: 1; }
                100% { top: 100%; opacity: 0; }
                }
            `}</style>
        </>
      )}
    </div>
  );
};