import React, { useEffect, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, CheckCircle2 } from 'lucide-react';

export const CameraScanner: React.FC<{
  onScan: (code: string) => void;
  onClose: () => void;
}> = ({ onScan, onClose }) => {
  const [error, setError] = useState<string | null>(null);
  const [scanHistory, setScanHistory] = useState<{code: string, time: number}[]>([]);
  const [totalScanned, setTotalScanned] = useState(0);

  useEffect(() => {
    const html5QrCode = new Html5Qrcode("reader", { verbose: false, experimentalFeatures: { useBarCodeDetectorIfSupported: true } });

    let lastScanned = '';
    let lastScanTime = 0;

    html5QrCode.start(
      { facingMode: "environment" },
      {
        fps: 15
        // Eliminamos `qrbox` para que escanee todo el cuadro de video.
        // Los códigos muy largos necesitan espacio en blanco a los lados (quiet zone),
        // y el qrbox estaba recortando ese espacio.
      },
      (decodedText) => {
        const now = Date.now();
        // Prevent duplicate scans within 1.5 seconds
        if (decodedText !== lastScanned || (now - lastScanTime) > 1500) {
          lastScanned = decodedText;
          lastScanTime = now;
          if (navigator.vibrate) navigator.vibrate([100, 50, 100]); // Success vibration
          
          setScanHistory(prev => [{code: decodedText, time: now}, ...prev].slice(0, 3));
          setTotalScanned(prev => prev + 1);
          onScan(decodedText);
        }
      },
      () => {
        // parse errors are normal (no barcode found in current frame)
      }
    ).catch((err) => {
      setError("No se pudo iniciar la cámara. Asegúrate de dar permisos o de estar usando HTTPS. Detalle: " + err);
    });

    return () => {
      if (html5QrCode.isScanning) {
        html5QrCode.stop().catch(console.error);
      }
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900 flex flex-col" translate="no">
      <div className="p-4 bg-black text-white flex justify-between items-center shadow-lg z-10">
        <h3 className="font-bold flex items-center gap-2"><Camera size={20}/> Escáner Activo</h3>
        <button onClick={onClose} className="p-2 bg-red-600 hover:bg-red-700 rounded-full text-white shadow-lg transition-colors">
          <X size={20} />
        </button>
      </div>
      
      <div className="flex-1 flex flex-col justify-start items-center pt-8 relative">
        <div id="reader" className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl border-4 border-slate-700 bg-black"></div>
        {error && <div className="text-red-400 p-4 text-center text-sm mt-4 bg-black/50 rounded mx-4 border border-red-900/50">{error}</div>}
        
        {/* Real-time scan feedback */}
        <div className="w-full max-w-sm mt-6 px-4">
          <div className="bg-slate-800 rounded-xl p-4 shadow-xl border border-slate-700">
            <div className="flex justify-between items-center mb-3">
              <span className="text-slate-300 text-sm font-bold">Registro de Lecturas</span>
              <span className="bg-blue-600 text-white px-2 py-1 rounded text-xs font-bold">
                Total: {totalScanned}
              </span>
            </div>
            
            {scanHistory.length === 0 ? (
              <div className="text-slate-500 text-sm text-center py-4">
                Apunta la cámara al código de barras.<br/>Se agregará +1 automáticamente.
              </div>
            ) : (
              <div className="space-y-2">
                {scanHistory.map((item, idx) => (
                  <div key={`${item.code}-${item.time}`} className={`flex items-center gap-2 text-sm p-2 rounded ${idx === 0 ? 'bg-green-900/40 text-green-400 border border-green-800/50' : 'text-slate-400'}`}>
                    <CheckCircle2 size={16} className={idx === 0 ? 'text-green-500' : 'text-slate-500'} />
                    <span className="font-mono font-bold truncate flex-1">{item.code}</span>
                    <span className="text-xs opacity-60">¡Agregado!</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
