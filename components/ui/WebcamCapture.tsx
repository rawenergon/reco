
import React, { useRef, useState, useCallback, useEffect } from 'react';
import { RefreshCw, Lock, CameraOff, SwitchCamera, QrCode, ScanFace } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import jsQR from 'jsqr';

interface WebcamCaptureProps {
  onCapture: (base64: string) => void;
  onQrScan?: (data: string) => void;
  label?: string;
  scanningMode?: 'face' | 'qr';
}

export const WebcamCapture: React.FC<WebcamCaptureProps> = ({ 
  onCapture, 
  onQrScan,
  label = "Capture",
  scanningMode = 'face'
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const requestRef = useRef<number | null>(null);
  
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<{title: string, message: string} | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  // Automatically switch default camera based on mode, but allows manual toggling later
  useEffect(() => {
    setFacingMode(scanningMode === 'qr' ? 'environment' : 'user');
  }, [scanningMode]);

  const stopCamera = useCallback(() => {
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    setError(null);

    try {
      const constraints: MediaStreamConstraints = {
        video: { 
          facingMode: facingMode,
          width: { ideal: 1920, min: 1280 }, 
          height: { ideal: 1080, min: 720 },
          frameRate: { ideal: 30 }
        } 
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints).catch(() => {
        // Fallback to basic constraints if advanced fails
        return navigator.mediaDevices.getUserMedia({ 
           video: { facingMode: facingMode, width: { ideal: 1280 }, height: { ideal: 720 } }
        });
      });
      
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true"); // Required for iOS
        videoRef.current.onloadedmetadata = () => {
            setIsStreaming(true);
        };
      }
    } catch (err: any) {
      console.error("Webcam Access Error:", err);
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setError({
              title: "Camera Access Denied",
              message: "Please click the lock icon in your browser address bar and allow camera access."
          });
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setError({
              title: "No Camera Found",
              message: "We couldn't detect a camera. Please check your connections."
          });
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          setError({
              title: "Camera In Use",
              message: "Your camera is being used by another application. Please close it and retry."
          });
      } else {
          setError({
              title: "Camera Error",
              message: "Unable to access camera. Please refresh or try another browser."
          });
      }
    }
  }, [facingMode, stopCamera]);

  const lastScanTimeRef = useRef<number>(0);
  
  // QR Scanning Loop
  const tick = useCallback(() => {
    const now = Date.now();
    
    if (videoRef.current && canvasRef.current && scanningMode === 'qr' && isStreaming) {
      if (now - lastScanTimeRef.current > 150) { // Scan approx 6-7 times per second
        lastScanTimeRef.current = now;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d', { willReadFrequently: true });

        if (video.readyState === video.HAVE_ENOUGH_DATA && context) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "attemptBoth",
          });

          if (code && code.data && onQrScan) {
             onQrScan(code.data);
          }
        }
      }
    }
    requestRef.current = requestAnimationFrame(tick);
  }, [isStreaming, scanningMode, onQrScan]);

  useEffect(() => {
    if (isStreaming && scanningMode === 'qr') {
       requestRef.current = requestAnimationFrame(tick);
    } else {
       if (requestRef.current) cancelAnimationFrame(requestRef.current);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    }
  }, [isStreaming, scanningMode, tick]);

  const capture = useCallback(() => {
    if (videoRef.current && canvasRef.current && isStreaming) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const context = canvas.getContext('2d');
      if (context) {
        if (facingMode === 'user' && scanningMode === 'face') {
            context.translate(canvas.width, 0);
            context.scale(-1, 1);
        }
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9); 
        onCapture(dataUrl);
      }
    }
  }, [onCapture, isStreaming, facingMode, scanningMode]);

  const toggleCamera = () => {
      setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  return (
    <div className="flex flex-col items-center w-full max-w-lg mx-auto relative px-4">
      <div className="relative w-full aspect-[4/3] md:aspect-video bg-surface-950 rounded-3xl overflow-hidden shadow-2xl border border-white/5 group ring-1 ring-white/10">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted
          className={`w-full h-full object-cover transition-opacity duration-700 ${isStreaming ? 'opacity-100' : 'opacity-0'} ${(facingMode === 'user' && scanningMode === 'face') ? 'transform scale-x-[-1]' : ''}`} 
        />
        
        {/* Animated Overlays */}
        <AnimatePresence mode="wait">
          {isStreaming && !error && (
            <motion.div 
              key={scanningMode}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
              className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden"
            >
              {scanningMode === 'face' ? (
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="relative flex items-center justify-center"
                >
                  {/* Face ID Frame */}
                  <div className="relative w-64 h-80">
                    {/* Corners */}
                    <div className="absolute top-0 left-0 w-12 h-12 border-t-2 border-l-2 border-emerald-500/80 rounded-tl-3xl"></div>
                    <div className="absolute top-0 right-0 w-12 h-12 border-t-2 border-r-2 border-emerald-500/80 rounded-tr-3xl"></div>
                    <div className="absolute bottom-0 left-0 w-12 h-12 border-b-2 border-l-2 border-emerald-500/80 rounded-bl-3xl"></div>
                    <div className="absolute bottom-0 right-0 w-12 h-12 border-b-2 border-r-2 border-emerald-500/80 rounded-br-3xl"></div>
                    
                    {/* Inner Guide */}
                    <div className="absolute inset-4 border border-white/10 rounded-[2.5rem] bg-emerald-500/5 backdrop-blur-[1px]"></div>
                    
                    {/* Scanning Line */}
                    <motion.div 
                      animate={{ 
                        top: ['10%', '90%', '10%'],
                        opacity: [0.2, 1, 0.2]
                      }}
                      transition={{ 
                        duration: 3, 
                        repeat: Infinity, 
                        ease: "easeInOut" 
                      }}
                      className="absolute left-6 right-6 h-[2px] bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.8)] z-10"
                    />

                    {/* Progress Rings/Dots */}
                    <motion.div 
                      animate={{ rotate: 360 }}
                      transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                      className="absolute -inset-8 border border-dashed border-emerald-500/20 rounded-full"
                    />
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  initial={{ scale: 1.1, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="relative w-64 h-64 flex items-center justify-center"
                >
                  {/* QR Frame */}
                  <div className="relative w-full h-full border-2 border-white/10 rounded-2xl bg-black/20">
                     {/* QR Specific Corners */}
                     <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-500 rounded-tl-lg"></div>
                     <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-emerald-500 rounded-tr-lg"></div>
                     <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-emerald-500 rounded-bl-lg"></div>
                     <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-500 rounded-br-lg"></div>

                     {/* Intense Laser Animation */}
                     <motion.div 
                        animate={{ top: ['0%', '100%', '0%'] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        className="absolute left-0 w-full h-1 z-10"
                     >
                        <div className="w-full h-full bg-emerald-500 shadow-[0_0_20px_#10b981,0_0_40px_#10b981]" />
                        <div className="w-full h-24 bg-gradient-to-b from-emerald-500/20 to-transparent -translate-y-full" />
                     </motion.div>

                     {/* Grid Mesh Background Effect */}
                     <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:20px_20px]" />
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Status Indicators */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 backdrop-blur-xl px-4 py-2 rounded-full border border-white/10 shadow-xl z-20">
            <motion.div 
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" 
            />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/90">
                {scanningMode === 'face' ? 'Analyze Face' : 'Scanning QR'}
            </span>
        </div>

        {/* Loading State */}
        {!isStreaming && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-content-secondary gap-4 bg-surface-950">
            <RefreshCw className="w-8 h-8 animate-spin text-emerald-500 opacity-80" />
            <span className="text-[10px] tracking-[0.3em] uppercase font-semibold text-white/40">Initializing Systems</span>
          </div>
        )}

        {/* Error State */}
        {error && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 bg-surface-900/90 backdrop-blur-md z-30"
            >
                <div className="bg-red-500/20 p-4 rounded-full mb-6 border border-red-500/20">
                    {error.title.includes("Access") ? <Lock className="w-8 h-8 text-red-500" /> : <CameraOff className="w-8 h-8 text-red-500" />}
                </div>
                <h3 className="text-white font-bold text-xl mb-2">{error.title}</h3>
                <p className="text-sm text-white/60 max-w-[280px] mb-8 leading-relaxed">{error.message}</p>
                <button 
                    onClick={startCamera}
                    className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-2xl text-xs uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-emerald-500/20"
                >
                    Retry Connection
                </button>
            </motion.div>
        )}

        {/* Switch Camera Button */}
        {isStreaming && !error && (
             <button 
                onClick={toggleCamera}
                className="absolute top-6 right-6 p-3 bg-white/5 backdrop-blur-2xl rounded-2xl text-white/70 hover:text-white hover:bg-white/20 transition-all active:scale-95 border border-white/10 pointer-events-auto z-40 group"
                title="Switch Camera"
             >
                <SwitchCamera className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />
             </button>
        )}
      </div>
      
      <canvas ref={canvasRef} className="hidden" />

      {/* Action Area */}
      <div className="mt-8 h-20 flex items-center justify-center">
        <AnimatePresence mode="wait">
          {scanningMode === 'face' ? (
            <motion.div
              key="face-btn"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center gap-4"
            >
              <button
                onClick={capture}
                disabled={!isStreaming || !!error}
                className="relative group p-1 rounded-full border-2 border-emerald-500/30 hover:border-emerald-500 transition-all active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label={label}
              >
                <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-2xl relative overflow-hidden">
                    <div className="absolute inset-0 bg-emerald-500/0 group-hover:bg-emerald-500/10 transition-colors" />
                    <ScanFace className="w-8 h-8 text-black" />
                </div>
                {/* Visual Ring Animation while active */}
                {isStreaming && (
                    <motion.div 
                        initial={{ scale: 1 }}
                        animate={{ scale: 1.1, opacity: 0 }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="absolute inset-0 rounded-full border-2 border-emerald-500 pointer-events-none"
                    />
                )}
              </button>
              <span className="text-[10px] font-bold uppercase tracking-widest text-content-secondary">Tap to verify</span>
            </motion.div>
          ) : (
            <motion.div
              key="qr-status"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center gap-3"
            >
              <div className="flex items-center gap-3 px-6 py-3 bg-surface-100 dark:bg-white/5 rounded-2xl border border-white/5 shadow-inner">
                <QrCode className="w-5 h-5 text-emerald-500 animate-pulse" />
                <span className="text-xs font-medium text-content-secondary tracking-wide">Position QR code within frame</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
