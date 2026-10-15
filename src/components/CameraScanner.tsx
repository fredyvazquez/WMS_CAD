import React, { useEffect, useState, useRef, useCallback } from 'react';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';
import { X, Camera, CheckCircle2, Zap, ZapOff, ZoomIn, Info, Trash2, Clock, ChevronUp, ChevronDown, SwitchCamera, Keyboard, Send } from 'lucide-react';

interface ScannedItem {
  id: string;
  code: string;
  time: number;
}

interface CameraScannerProps {
  onScan: (code: string) => void;
  onRemoveCode?: (code: string) => void;
  onClose: () => void;
  title?: string;
}

export const CameraScanner: React.FC<CameraScannerProps> = ({ 
  onScan, 
  onRemoveCode,
  onClose,
  title = "Escáner de Código de Barras"
}) => {
  const [error, setError] = useState<string | null>(null);
  const [scanHistory, setScanHistory] = useState<ScannedItem[]>([]);
  const [totalScanned, setTotalScanned] = useState(0);
  const [activeEngine, setActiveEngine] = useState<'NATIVE' | 'ZXING' | 'STARTING'>('STARTING');
  
  // Mobile and Desktop camera capabilities
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [zoomAvailable, setZoomAvailable] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(1);
  const [maxZoom, setMaxZoom] = useState(1);
  const [minZoom, setMinZoom] = useState(1);

  // Multi-camera & browser flexibility state
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [showManualInput, setShowManualInput] = useState<boolean>(false);
  const [manualCodeInput, setManualCodeInput] = useState<string>('');

  // Anti-duplicate pause & feedback state
  const [delaySeconds, setDelaySeconds] = useState<number>(3.5);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [scannedFeedbackCode, setScannedFeedbackCode] = useState<string | null>(null);
  const [isListExpanded, setIsListExpanded] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const zxingControlsRef = useRef<IScannerControls | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const isScanningActiveRef = useRef<boolean>(true);
  const isPausedRef = useRef<boolean>(false);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastScannedRef = useRef<string>('');
  const lastScanTimeRef = useRef<number>(0);

  // Sound feedback using Web Audio API
  const playBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(850, ctx.currentTime); // Crisp scanner tone
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {
      // AudioContext unavailable or restricted
    }
  };

  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const onRemoveCodeRef = useRef(onRemoveCode);
  useEffect(() => {
    onRemoveCodeRef.current = onRemoveCode;
  }, [onRemoveCode]);

  const resumeScanningImmediately = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setScannedFeedbackCode(null);
    setRemainingSeconds(0);
    isPausedRef.current = false;
  }, []);

  const handleDecodedCode = useCallback((rawCode: string) => {
    if (isPausedRef.current) return;

    const cleanCode = rawCode.trim().toUpperCase();
    if (!cleanCode) return;

    const now = Date.now();
    // Prevent duplicate scan of identical code within cooldown window
    if (cleanCode === lastScannedRef.current && (now - lastScanTimeRef.current) < (delaySeconds * 1000 + 400)) {
      return;
    }

    lastScannedRef.current = cleanCode;
    lastScanTimeRef.current = now;

    // Immediately pause scanning
    isPausedRef.current = true;
    setScannedFeedbackCode(cleanCode);
    setRemainingSeconds(delaySeconds);

    // Multi-sensory feedback
    playBeep();
    if (navigator.vibrate) {
      navigator.vibrate([70]);
    }

    const newItem: ScannedItem = {
      id: `${cleanCode}-${now}-${Math.random().toString(36).substring(2, 7)}`,
      code: cleanCode,
      time: now
    };

    setScanHistory(prev => [newItem, ...prev]);
    setTotalScanned(prev => prev + 1);
    onScanRef.current(cleanCode);

    // Countdown interval every 100ms
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    const startCountdown = Date.now();
    const totalMs = delaySeconds * 1000;

    countdownIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startCountdown;
      const left = Math.max(0, (totalMs - elapsed) / 1000);
      setRemainingSeconds(Number(left.toFixed(1)));
      if (left <= 0) {
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
        setScannedFeedbackCode(null);
        isPausedRef.current = false;
      }
    }, 100);
  }, [delaySeconds]);

  // Remove an item that was scanned by mistake
  const handleDeleteHistoryItem = (itemToDelete: ScannedItem) => {
    setScanHistory(prev => prev.filter(i => i.id !== itemToDelete.id));
    setTotalScanned(prev => Math.max(0, prev - 1));

    if (onRemoveCodeRef.current) {
      onRemoveCodeRef.current(itemToDelete.code);
    }

    // Confirmation vibration
    if (navigator.vibrate) {
      navigator.vibrate([40, 50, 40]);
    }
  };

  // Toggle Flashlight / Torch
  const toggleTorch = async () => {
    if (!trackRef.current || !torchAvailable) return;
    try {
      const nextState = !isTorchOn;
      await (trackRef.current as any).applyConstraints({
        advanced: [{ torch: nextState }]
      });
      setIsTorchOn(nextState);
    } catch (err) {
      console.warn("No se pudo activar la linterna:", err);
    }
  };

  // Apply Digital / Optical Zoom
  const applyZoom = async (newZoom: number) => {
    if (!trackRef.current || !zoomAvailable) return;
    try {
      const clamped = Math.min(Math.max(newZoom, minZoom), maxZoom);
      await (trackRef.current as any).applyConstraints({
        advanced: [{ zoom: clamped }]
      });
      setCurrentZoom(clamped);
    } catch (err) {
      console.warn("No se pudo ajustar el zoom:", err);
    }
  };

  // Enumerate cameras on mount for devices with multiple cameras or webcams
  useEffect(() => {
    if (navigator.mediaDevices && typeof navigator.mediaDevices.enumerateDevices === 'function') {
      navigator.mediaDevices.enumerateDevices().then(devices => {
        const videoDevs = devices.filter(d => d.kind === 'videoinput');
        setAvailableCameras(videoDevs);
        if (videoDevs.length > 0 && !selectedDeviceId) {
          // Prefer environment / rear camera if available
          const rearCam = videoDevs.find(d => 
            d.label.toLowerCase().includes('back') || 
            d.label.toLowerCase().includes('rear') || 
            d.label.toLowerCase().includes('trasera') ||
            d.label.toLowerCase().includes('environment')
          );
          if (rearCam) {
            setSelectedDeviceId(rearCam.deviceId);
          }
        }
      }).catch(() => {
        // Enumerate not permitted before permission granted
      });
    }
  }, [selectedDeviceId]);

  const switchCamera = () => {
    if (availableCameras.length > 1) {
      const currentIndex = availableCameras.findIndex(c => c.deviceId === selectedDeviceId);
      const nextIndex = (currentIndex + 1) % availableCameras.length;
      setSelectedDeviceId(availableCameras[nextIndex].deviceId);
    } else {
      setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
    }
  };

  const handleManualSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = manualCodeInput.trim().toUpperCase();
    if (!clean) return;
    handleDecodedCode(clean);
    setManualCodeInput('');
  };

  useEffect(() => {
    isScanningActiveRef.current = true;
    let isCancelled = false;

    const startScanner = async () => {
      try {
        setError(null);
        setTorchAvailable(false);
        setIsTorchOn(false);
        setZoomAvailable(false);

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Navegador sin soporte de cámara o conexión no segura (se requiere HTTPS o localhost).');
        }

        let stream: MediaStream | null = null;

        // Tier 1: Try HD stream with continuous focus (optimal for modern mobile rear cameras)
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
              facingMode: selectedDeviceId ? undefined : { ideal: facingMode },
              width: { ideal: 1920, min: 1280 },
              height: { ideal: 1080, min: 720 },
              // @ts-expect-error non-standard continuous focus
              focusMode: { ideal: "continuous" }
            }
          });
        } catch {
          // Tier 2: Flexible 720p stream without strict 'min' (prevents OverconstrainedError on laptop webcams)
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              audio: false,
              video: {
                deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
                facingMode: selectedDeviceId ? undefined : { ideal: facingMode },
                width: { ideal: 1280 },
                height: { ideal: 720 }
              }
            });
          } catch {
            // Tier 3: Universal fallback - any available video resolution
            stream = await navigator.mediaDevices.getUserMedia({
              audio: false,
              video: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : true
            });
          }
        }

        if (isCancelled || !stream) {
          if (stream) stream.getTracks().forEach(t => t.stop());
          return;
        }

        streamRef.current = stream;
        const videoTrack = stream.getVideoTracks()[0];
        trackRef.current = videoTrack;

        // Refresh available cameras once stream permissions are granted
        if (navigator.mediaDevices && typeof navigator.mediaDevices.enumerateDevices === 'function') {
          navigator.mediaDevices.enumerateDevices().then(devices => {
            const videoDevs = devices.filter(d => d.kind === 'videoinput');
            setAvailableCameras(videoDevs);
          }).catch(() => {});
        }

        // Inspect capabilities (torch, zoom)
        if (videoTrack && typeof videoTrack.getCapabilities === 'function') {
          const caps = videoTrack.getCapabilities() as any;
          if (caps.torch) {
            setTorchAvailable(true);
          }
          if (caps.zoom) {
            setZoomAvailable(true);
            setMinZoom(caps.zoom.min || 1);
            setMaxZoom(caps.zoom.max || 1);
            const initialZoom = Math.min(1.5, caps.zoom.max || 1);
            if (initialZoom > 1) {
              try {
                await (videoTrack as any).applyConstraints({
                  advanced: [{ zoom: initialZoom }]
                });
                setCurrentZoom(initialZoom);
              } catch {
                // Ignore constraint failure
              }
            }
          }
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        // Check if native BarcodeDetector is supported with code_128
        let hasNativeBarcodeDetector = false;
        let nativeDetector: any = null;

        if ('BarcodeDetector' in window) {
          try {
            const supportedFormats: string[] = await (window as any).BarcodeDetector.getSupportedFormats();
            if (supportedFormats.includes('code_128')) {
              nativeDetector = new (window as any).BarcodeDetector({
                formats: ['code_128', 'code_39', 'ean_13', 'upc_a']
              });
              hasNativeBarcodeDetector = true;
            }
          } catch {
            nativeDetector = null;
          }
        }

        if (hasNativeBarcodeDetector && nativeDetector && videoRef.current) {
          setActiveEngine('NATIVE');
          
          let lastFrameDetectTime = 0;
          const detectNativeLoop = async () => {
            if (!isScanningActiveRef.current || isCancelled) return;

            const now = performance.now();
            // Process at ~25 FPS only if not paused
            if (!isPausedRef.current && (now - lastFrameDetectTime) >= 40 && videoRef.current && videoRef.current.readyState >= 2) {
              lastFrameDetectTime = now;
              try {
                const barcodes = await nativeDetector.detect(videoRef.current);
                if (barcodes && barcodes.length > 0 && !isPausedRef.current) {
                  for (const bc of barcodes) {
                    if (bc.rawValue) {
                      handleDecodedCode(bc.rawValue);
                      break;
                    }
                  }
                }
              } catch {
                // Ignore occasional frame detection error
              }
            }

            if (isScanningActiveRef.current && !isCancelled) {
              animFrameRef.current = requestAnimationFrame(detectNativeLoop);
            }
          };

          animFrameRef.current = requestAnimationFrame(detectNativeLoop);
        } else if (videoRef.current) {
          // Fallback to ZXing with TRY_HARDER = true prioritizing CODE_128
          setActiveEngine('ZXING');

          const hints = new Map<DecodeHintType, any>();
          hints.set(DecodeHintType.POSSIBLE_FORMATS, [
            BarcodeFormat.CODE_128,
            BarcodeFormat.CODE_39,
            BarcodeFormat.EAN_13,
            BarcodeFormat.UPC_A
          ]);
          hints.set(DecodeHintType.TRY_HARDER, true);

          const reader = new BrowserMultiFormatReader(hints, {
            delayBetweenScanAttempts: 60
          });

          const controls = await reader.decodeFromVideoElement(videoRef.current, (result) => {
            if (result && isScanningActiveRef.current && !isPausedRef.current) {
              handleDecodedCode(result.getText());
            }
          });

          zxingControlsRef.current = controls;
        }
      } catch (err: any) {
        if (!isCancelled) {
          console.error("Error al iniciar cámara:", err);
          setError(
            err.name === 'NotAllowedError'
              ? 'Permiso de cámara denegado. Permite el acceso a la cámara en tu navegador o escribe el código manualmente.'
              : 'No se pudo iniciar la cámara seleccionada. Puedes usar la entrada manual de código abajo. Detalle: ' + (err.message || err)
          );
        }
      }
    };

    startScanner();

    return () => {
      isCancelled = true;
      isScanningActiveRef.current = false;

      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }

      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }

      if (zxingControlsRef.current) {
        try {
          zxingControlsRef.current.stop();
        } catch {
          // ignore
        }
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, [handleDecodedCode, selectedDeviceId, facingMode]);

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col select-none text-white overflow-hidden pb-4 md:pb-0" translate="no">
      {/* Top Header */}
      <div className="p-3 bg-black/85 backdrop-blur border-b border-slate-800 flex justify-between items-center z-30 flex-shrink-0">
        <div className="flex items-center gap-2 truncate pr-2">
          <Camera size={18} className="text-blue-400 flex-shrink-0" />
          <div className="truncate">
            <h3 className="font-bold text-sm leading-tight truncate">{title}</h3>
            <span className="text-[10px] text-slate-400 flex items-center gap-1 truncate">
              Code 128 / Auto • {activeEngine === 'NATIVE' ? '⚡ Hardware ML Kit' : activeEngine === 'ZXING' ? '🔍 ZXing Deep' : 'Iniciando...'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Switch Camera Button (multi-camera / desktop webcam toggle) */}
          {availableCameras.length > 1 && (
            <button
              onClick={switchCamera}
              className="p-2 rounded-full border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
              title="Cambiar Cámara (Frontal / Trasera / Externa)"
            >
              <SwitchCamera size={18} />
            </button>
          )}

          {/* Manual Input Toggle Button */}
          <button
            onClick={() => setShowManualInput(prev => !prev)}
            className={`p-2 rounded-full border transition-colors ${
              showManualInput 
                ? 'bg-blue-600 border-blue-500 text-white shadow-[0_0_12px_rgba(59,130,246,0.5)]' 
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
            title="Escribir clave manualmente / lector USB"
          >
            <Keyboard size={18} />
          </button>

          {/* Torch Toggle */}
          {torchAvailable && (
            <button
              onClick={toggleTorch}
              className={`p-2 rounded-full border transition-colors ${
                isTorchOn
                  ? 'bg-amber-500 border-amber-400 text-black shadow-[0_0_12px_rgba(245,158,11,0.5)]'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
              }`}
              title="Linterna / Flash"
            >
              {isTorchOn ? <Zap size={18} /> : <ZapOff size={18} />}
            </button>
          )}

          {/* Close button */}
          <button 
            onClick={onClose} 
            className="p-2 bg-red-600 hover:bg-red-700 rounded-full text-white shadow-lg transition-colors"
            title="Cerrar"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Main Viewfinder Section */}
      <div className="flex-1 relative flex flex-col justify-center items-center overflow-hidden bg-black min-h-0">
        {/* Full Video Stream */}
        <video 
          ref={videoRef}
          playsInline
          autoPlay
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Manual Barcode Input Panel (Shown on demand or as fallback if camera has error) */}
        {(showManualInput || error) && (
          <div className="absolute top-4 left-4 right-4 z-40 bg-slate-900/95 border border-slate-700 p-3 rounded-xl shadow-2xl backdrop-blur max-w-md mx-auto animate-in fade-in slide-in-from-top-2">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Keyboard size={14} className="text-blue-400" />
                Captura Manual / Pistola USB
              </span>
              {error && (
                <span className="text-[10px] text-amber-400 font-medium">Modo alternativo</span>
              )}
            </div>
            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <input
                type="text"
                autoFocus
                placeholder="Ingresar o escanear clave..."
                value={manualCodeInput}
                onChange={(e) => setManualCodeInput(e.target.value)}
                className="flex-1 bg-black/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono uppercase focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-bold text-xs text-white flex items-center gap-1.5 transition-colors shadow-md"
              >
                <Send size={14} />
                <span>Registrar</span>
              </button>
            </form>
          </div>
        )}

        {/* Shaded Viewfinder Overlay with Horizontal Laser */}
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
          {/* Top backdrop */}
          <div className="w-full flex-1 bg-black/45" />

          {/* Target Reticle Area (Wide horizontal box suited for Code 128) */}
          <div className={`w-[85%] max-w-sm h-36 relative border-2 rounded-xl overflow-hidden flex items-center justify-center shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] transition-all duration-300 ${
            scannedFeedbackCode 
              ? 'border-emerald-400 bg-emerald-950/85 shadow-[0_0_24px_rgba(16,185,129,0.4)]' 
              : 'border-dashed border-blue-400/80 bg-transparent'
          }`}>
            {/* Corner Brackets */}
            <div className={`absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 transition-colors duration-200 ${scannedFeedbackCode ? 'border-emerald-400' : 'border-blue-500'}`} />
            <div className={`absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 transition-colors duration-200 ${scannedFeedbackCode ? 'border-emerald-400' : 'border-blue-500'}`} />
            <div className={`absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 transition-colors duration-200 ${scannedFeedbackCode ? 'border-emerald-400' : 'border-blue-500'}`} />
            <div className={`absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 transition-colors duration-200 ${scannedFeedbackCode ? 'border-emerald-400' : 'border-blue-500'}`} />

            {/* If code was just scanned, display prominent feedback card with live countdown bar */}
            {scannedFeedbackCode ? (
              <div 
                onClick={resumeScanningImmediately}
                className="pointer-events-auto cursor-pointer flex flex-col items-center justify-center p-3 text-center w-full h-full select-none z-10"
                title="Toca para continuar inmediatamente"
              >
                <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs uppercase tracking-wider mb-1">
                  <CheckCircle2 size={16} className="text-emerald-400 animate-bounce" />
                  <span>¡Código Escaneado!</span>
                </div>
                <div className="font-mono text-xl sm:text-2xl font-black text-white bg-black/70 px-4 py-1.5 rounded-lg border border-emerald-500/60 shadow-lg tracking-wider">
                  {scannedFeedbackCode}
                </div>
                <div className="text-[11px] text-emerald-300 font-medium mt-1.5 flex items-center gap-1.5">
                  <Clock size={12} className="text-emerald-400" />
                  <span>Siguiente en {remainingSeconds.toFixed(1)}s (toca para reanudar)</span>
                </div>
                {/* Visual depleting progress bar */}
                <div className="w-3/4 max-w-[200px] bg-emerald-950 h-1.5 rounded-full overflow-hidden mt-1.5 border border-emerald-800">
                  <div 
                    className="bg-emerald-400 h-full transition-all duration-100 ease-linear"
                    style={{ width: `${Math.max(0, Math.min(100, (remainingSeconds / delaySeconds) * 100))}%` }}
                  />
                </div>
              </div>
            ) : (
              <>
                {/* Scanning Laser Line */}
                <div className="w-full h-0.5 bg-red-500 shadow-[0_0_8px_#ef4444] animate-pulse" />

                {/* Instruction tooltip */}
                <span className="absolute bottom-1.5 text-[10px] text-white/90 bg-black/60 px-2 py-0.5 rounded font-mono tracking-tight flex items-center gap-1">
                  <Info size={10} className="text-blue-400" />
                  Apunta las barras horizontalmente
                </span>
              </>
            )}
          </div>

          {/* Bottom backdrop */}
          <div className="w-full flex-1 bg-black/45 flex flex-col items-center justify-start pt-2">
            {/* Zoom Controls if available */}
            {zoomAvailable && maxZoom > 1 && (
              <div className="pointer-events-auto flex items-center gap-1.5 bg-slate-900/80 backdrop-blur border border-slate-700 px-3 py-1 rounded-full shadow-lg">
                <ZoomIn size={14} className="text-slate-400" />
                <span className="text-xs font-semibold text-slate-300">Zoom:</span>
                {[1, 1.5, 2, 2.5].filter(z => z <= maxZoom).map((zoomLevel) => (
                  <button
                    key={zoomLevel}
                    onClick={() => applyZoom(zoomLevel)}
                    className={`px-2 py-0.5 rounded-full text-xs font-bold transition-colors ${
                      Math.abs(currentZoom - zoomLevel) < 0.2
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {zoomLevel}x
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Error message if camera fails */}
        {error && (
          <div className="absolute bottom-4 left-4 right-4 z-30 bg-red-950/90 border border-red-800 text-red-200 text-xs p-3 rounded-lg shadow-2xl backdrop-blur text-center max-w-md mx-auto">
            {error}
          </div>
        )}
      </div>

      {/* Bottom Scan History & Management Section */}
      <div className={`bg-slate-900 border-t border-slate-800 transition-all duration-300 z-30 flex-shrink-0 flex flex-col ${
        isListExpanded ? 'h-72 sm:h-80' : 'max-h-60'
      }`}>
        <div className="max-w-md w-full mx-auto p-3 flex flex-col h-full">
          {/* Header of the list with Total count and Expand/Collapse toggle */}
          <div className="flex justify-between items-center mb-2 flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Lecturas ({scanHistory.length})
              </span>
              {totalScanned > 0 && (
                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold">
                  Total: {totalScanned}
                </span>
              )}
            </div>

            {/* Delay selector + Expand toggle */}
            <div className="flex items-center gap-1.5">
              <div className="flex items-center bg-slate-950 rounded-lg p-0.5 border border-slate-800 text-[10px]">
                <Clock size={12} className="text-slate-400 ml-1 mr-0.5" />
                <span className="text-slate-400 mr-1">Pausa:</span>
                {[2, 3.5, 5].map((sec) => (
                  <button
                    key={sec}
                    onClick={() => setDelaySeconds(sec)}
                    className={`px-1.5 py-0.5 rounded font-bold transition-colors ${
                      delaySeconds === sec
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {sec}s
                  </button>
                ))}
              </div>

              {scanHistory.length > 2 && (
                <button
                  onClick={() => setIsListExpanded(!isListExpanded)}
                  className="p-1 rounded bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs flex items-center gap-1"
                  title={isListExpanded ? "Minimizar lista" : "Expandir lista"}
                >
                  {isListExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                </button>
              )}
            </div>
          </div>

          {/* List items */}
          {scanHistory.length === 0 ? (
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3 text-center text-xs text-slate-500 my-auto">
              Aún no hay códigos escaneados. Apunta a una etiqueta Code 128 (ej. <span className="font-mono text-slate-400">890D010535</span>).
            </div>
          ) : (
            <div className="space-y-1.5 overflow-y-auto flex-1 pr-1">
              {scanHistory.map((item, idx) => (
                <div 
                  key={item.id} 
                  className={`flex items-center justify-between gap-2 text-xs p-2 rounded-lg border transition-all ${
                    idx === 0 
                      ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/70 shadow-sm' 
                      : 'bg-slate-950/70 text-slate-300 border-slate-800/80'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                    <CheckCircle2 size={15} className={idx === 0 ? 'text-emerald-400 flex-shrink-0' : 'text-slate-500 flex-shrink-0'} />
                    <span className="font-mono font-bold text-sm tracking-wide truncate">{item.code}</span>
                    <span className="text-[10px] text-slate-500 font-mono flex-shrink-0">
                      {new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>

                  {/* Delete button for removing this code */}
                  <button
                    onClick={() => handleDeleteHistoryItem(item)}
                    className="p-1.5 px-2 bg-red-950/70 hover:bg-red-700 text-red-300 hover:text-white border border-red-800/80 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors flex-shrink-0 active:scale-95 shadow-sm"
                    title={`Eliminar ${item.code} (-1)`}
                  >
                    <Trash2 size={13} className="text-red-400" />
                    <span>Quitar</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

