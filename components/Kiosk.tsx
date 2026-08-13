
import React, { useState, useEffect, useRef } from 'react';
import { WebcamCapture } from './ui/WebcamCapture';
import { identifyFace } from '../services/gemini';
import { getEmployees, markAttendance } from '../services/supabase';
import { Employee } from '../types';
import { Check, X, Loader2, RefreshCw, WifiOff, AlertTriangle, QrCode, ScanFace, MapPin, Info } from 'lucide-react';

export const Kiosk: React.FC = () => {
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string>('Ready to scan');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [mode, setMode] = useState<'face' | 'qr'>('qr');
  const [lastQrScan, setLastQrScan] = useState<string | null>(null);
  
  const [errorType, setErrorType] = useState<'network' | 'recognition' | 'generic'>('generic');
  const [debugInfo, setDebugInfo] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);

  // Cooldown so the same QR code isn't re-processed repeatedly while it stays in the frame
  const processedScanRef = useRef<{ data: string; at: number }>({ data: '', at: 0 });

  const playSuccessSound = () => {
    try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;
        
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1); // A5
        
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.8);
    } catch (e) {
        console.warn("Audio play failed", e);
    }
  };

  const loadData = async () => {
    try {
      const data = await getEmployees();
      setEmployees(data);
    } catch (error) {
      console.error("Kiosk Init Error:", error);
      setStatus('error');
      setMessage("System Offline");
      setErrorType('network');
    }
  };

  useEffect(() => {
    loadData();
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => console.log("Location access granted"),
            (err) => console.warn("Location access denied", err)
        );
    }
  }, []);

  const getCurrentLocation = (): Promise<{lat: number, lng: number} | undefined> => {
      return new Promise((resolve) => {
          if (!navigator.geolocation) {
              resolve(undefined);
              return;
          }
          navigator.geolocation.getCurrentPosition(
              (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
              (err) => {
                  console.warn("Location failed:", err.message);
                  resolve(undefined);
              },
              { timeout: 5000, enableHighAccuracy: true }
          );
      });
  };

  const handleQrScan = async (data: string) => {
     if (status === 'processing' || status === 'success') return;
     if (data === lastQrScan && status === 'error') return; // Debounce error on same code

     // Ignore repeated scans of the same QR within a 15 second cooldown window
     const now = Date.now();
     if (processedScanRef.current.data === data && now - processedScanRef.current.at < 15000) return;
     processedScanRef.current = { data, at: now };

     // CLEANUP DATA (Crucial for Scanners)
     let cleanData = data.trim();
     
     // Legacy/URL extraction
     if (cleanData.includes('?id=')) {
         cleanData = cleanData.split('?id=')[1];
     } else if (cleanData.includes('/')) {
         const parts = cleanData.split('/');
         cleanData = parts[parts.length - 1];
     }
     
     const finalId = cleanData.trim();
     console.log(`[QR Scan] Raw: "${data}" | Processed: "${finalId}"`);

     setLastQrScan(data); 
     setStatus('processing');
     setMessage("Verifying...");
     setDebugInfo(null);

     // 1. Prioritize student_id lookup (case-insensitive)
     let employee = employees.find(e => 
         e.student_id && e.student_id.trim().toLowerCase() === finalId.toLowerCase()
     );

     if (employee) {
         console.log(`[QR Scan] Match found via Student ID: ${employee.name} (${employee.student_id})`);
     } else {
         // 2. Fallback to internal UUID lookup
         employee = employees.find(e => e.id === finalId);
         if (employee) {
             console.log(`[QR Scan] Match found via Internal UUID: ${employee.name}`);
         } else {
             console.warn(`[QR Scan] No match found for: "${finalId}"`);
         }
     }

     if (employee && employee.student_id) {
        try {
            const location = await getCurrentLocation();
            
            // Mark Attendance
            await markAttendance(employee.student_id, employee.name, 1.0, location);
            
            setStatus('success');
            setMessage(`Verified: ${employee.name}`);
            playSuccessSound();

            setTimeout(() => {
                setStatus('idle');
                setMessage('Ready to scan');
                setLastQrScan(null);
            }, 2000);
        } catch (e: any) {
            setStatus('error');
            const msg = e?.message || "";
            if (/already|complete|checked in and out/i.test(msg)) {
                setMessage("Already Marked Today");
            } else {
                setMessage("Attendance Failed");
            }
            setDebugInfo(msg);
            // Don't clear lastQrScan immediately on error to prevent rapid-fire error looping
            setTimeout(() => setStatus('idle'), 2500);
        }
     } else {
        setStatus('error');
        setMessage("ID Not Found");
        setDebugInfo(`Scanned: ${cleanData}`);
        setErrorType('recognition');
        setTimeout(() => {
            setStatus('idle');
            setMessage('Ready to scan');
        }, 1500);
     }
  };

  const handleCapture = async (imageSrc: string) => {
    setStatus('processing');
    setMessage("Verifying Identity...");
    setErrorType('generic');
    setDebugInfo(null);

    try {
      if (employees.length === 0) {
          const data = await getEmployees();
          if (data.length === 0) throw new Error("Database Empty");
          setEmployees(data);
      }

      const result = await identifyFace(imageSrc, employees);

      if (result.identified && result.employeeId) {
        const employee = employees.find(e => e.id === result.employeeId);
        
        if (employee && employee.student_id) {
          setMessage("Recording Location...");
          const location = await getCurrentLocation();
          
          await markAttendance(employee.student_id, employee.name, result.confidence, location);
          
          setStatus('success');
          setMessage(`Welcome, ${employee.name}`);
          playSuccessSound();
          
          setTimeout(() => {
            setStatus('idle');
            setMessage('Ready to scan');
          }, 3000);
        } else {
           throw new Error("Employee record missing or has no Student ID");
        }
      } else {
        setStatus('error');
        setMessage("Face not recognized");
        setErrorType('recognition');
        setTimeout(() => {
            setStatus('idle');
            setMessage('Ready to scan');
        }, 2000);
      }
    } catch (err: any) {
      console.error("Recognition Process Error:", err);
      setStatus('error');
      setErrorType('generic');
      setDebugInfo(err.message || err.toString());
      
      const errMsg = err.message || "";
      
      if (errMsg.includes("Network") || errMsg.includes("fetch")) {
          setMessage("Connection Error");
          setErrorType('network');
      } else if (errMsg.includes("Quota")) {
          setMessage("AI Quota Limit Hit");
      } else if (errMsg.includes("Database Empty")) {
          setMessage("No Users Registered");
      } else if (errMsg.includes("API Key") || errMsg.includes("not valid")) {
          setMessage("Invalid AI API Key");
          setErrorType('generic');
      } else if (errMsg.includes("AI not initialized") || errMsg.includes("configuration")) {
          setMessage("AI Config Error");
          setErrorType('generic');
      } else if (errMsg.includes("blocked") || errMsg.includes("SAFETY")) {
          setMessage("Image Blocked (Safety)");
      } else if (errMsg.startsWith("AI Error:")) {
          setMessage(errMsg.replace("AI Error: ", ""));
      } else {
          setMessage("Verification Failed");
      }

      setTimeout(() => {
        if (!showDebug) {
            setStatus('idle');
            setMessage('Ready to scan');
        }
      }, 3000);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[85vh] p-6 animate-fade-in relative overflow-hidden">
      
      <div className="w-full max-w-xl flex flex-col items-center gap-6 z-10">
        
        {/* Status HUD - Moved Above Camera */}
        <div className={`
            w-full max-w-sm flex flex-col items-center justify-center py-4 px-6 rounded-2xl border transition-all duration-500 shadow-xl backdrop-blur-xl relative mb-4
            ${status === 'idle' ? 'bg-surface-50/80 dark:bg-surface-900/80 border-surface-200 dark:border-white/10 text-content-primary' : ''}
            ${status === 'processing' ? 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400' : ''}
            ${status === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 scale-105 shadow-emerald-500/10' : ''}
            ${status === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400' : ''}
        `}>
            <div className="flex items-center gap-3">
                {status === 'idle' && (
                    <div className="relative flex items-center justify-center">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981]"></div>
                        <div className="absolute w-full h-full rounded-full bg-emerald-500 animate-ping opacity-75"></div>
                    </div>
                )}
                
                {status === 'processing' && <Loader2 className="w-5 h-5 animate-spin" />}
                {status === 'success' && <Check className="w-6 h-6 stroke-[3]" />}
                
                {status === 'error' && (
                    <>
                        {errorType === 'network' && <WifiOff className="w-5 h-5" />}
                        {errorType === 'recognition' && <AlertTriangle className="w-5 h-5" />}
                        {errorType === 'generic' && <X className="w-5 h-5" />}
                    </>
                )}
                
                <span className="text-sm font-bold tracking-wide uppercase">{message}</span>
            </div>

            {status === 'error' && debugInfo && (
                <button 
                    onClick={() => setShowDebug(!showDebug)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-current opacity-50 hover:opacity-100 transition-opacity"
                >
                    <Info className="w-4 h-4" />
                </button>
            )}
            
            {showDebug && status === 'error' && debugInfo && (
                <div className="mt-3 pt-3 border-t border-current/10 w-full text-[10px] font-mono break-all leading-tight opacity-90">
                    {debugInfo}
                </div>
            )}
        </div>

        {/* Mode Toggle */}
        <div className="flex flex-col items-center gap-4 mb-4">
            <div className="flex items-center bg-surface-200/50 dark:bg-surface-900/60 backdrop-blur-xl p-1.5 rounded-full border border-surface-200 dark:border-white/10 shadow-sm transition-all">
                <button 
                    onClick={() => { setMode('face'); setStatus('idle'); setMessage('Ready to scan'); }}
                    className={`flex items-center gap-2 px-6 py-2 rounded-full text-sm font-medium transition-all duration-300 ${mode === 'face' ? 'bg-content-primary text-content-inverted shadow-md' : 'text-content-secondary hover:text-content-primary'}`}
                >
                    <ScanFace className="w-4 h-4" />
                    <span>Face ID</span>
                </button>
                <button 
                    onClick={() => { setMode('qr'); setStatus('idle'); setMessage('Ready to scan'); }}
                    className={`flex items-center gap-2 px-6 py-2 rounded-full text-sm font-medium transition-all duration-300 ${mode === 'qr' ? 'bg-content-primary text-content-inverted shadow-md' : 'text-content-secondary hover:text-content-primary'}`}
                >
                    <QrCode className="w-4 h-4" />
                    <span>QR Code</span>
                </button>
            </div>
            {mode === 'face' && (
                <p className="text-[9px] text-content-secondary uppercase tracking-widest font-mono opacity-50 flex items-center gap-2 animate-fade-in">
                    <Info className="w-3 h-3" />
                    Didn't register face? Switch to QR code
                </p>
            )}
        </div>

        <WebcamCapture 
            onCapture={handleCapture} 
            onQrScan={handleQrScan}
            label={mode === 'face' ? "Scan Face" : "Scan QR"} 
            scanningMode={mode}
        />
        
        <div className="mt-8 flex justify-between items-center text-[10px] text-content-secondary uppercase tracking-[0.2em] px-4 opacity-60 hover:opacity-100 transition-opacity w-full max-w-lg">
             <div className="flex items-center gap-1">
                 <MapPin className="w-3 h-3" />
                 <span>GPS Enabled</span>
             </div>
             <button onClick={loadData} className="hover:text-content-primary transition-colors flex items-center gap-2 group">
                <span>Sync DB</span>
                <RefreshCw className="w-3 h-3 group-active:animate-spin" />
             </button>
        </div>
      </div>

      {/* Footer */}
    </div>
  );
};
