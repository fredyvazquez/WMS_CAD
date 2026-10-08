import React, { useEffect, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera } from 'lucide-react';

export const CameraScanner: React.FC<{
  onScan: (code: string) => void;
  onClose: () => void;
}> = ({ onScan, onClose }) => {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const html5QrCode = new Html5Qrcode("reader");

    let lastScanned = '';
    let lastScanTime = 0;

    html5QrCode.start(
      { facingMode: "environment" },
      {
        fps: 10,
        qrbox: { width: 250, height: 100 }
      },
      (decodedText) => {
        const now = Date.now();
        // Prevent duplicate scans within 1.5 seconds
        if (decodedText !== lastScanned || (now - lastScanTime) > 1500) {
          lastScanned = decodedText;
          lastScanTime = now;
          if (navigator.vibrate) navigator.vibrate(200);
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
    <div className="fixed inset-0 z-[100] bg-slate-900 flex flex-col">
      <div className="p-4 bg-black text-white flex justify-between items-center shadow-lg z-10">
        <h3 className="font-bold flex items-center gap-2"><Camera size={20}/> Escáner Activo</h3>
        <button onClick={onClose} className="p-2 bg-red-600 hover:bg-red-700 rounded-full text-white shadow-lg transition-colors">
          <X size={20} />
        </button>
      </div>
      <div className="flex-1 flex flex-col justify-center items-center p-4 relative">
        <div id="reader" className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl border-4 border-slate-700 bg-black"></div>
        {error && <div className="text-red-400 p-4 text-center text-sm mt-4 bg-black/50 rounded mx-4 border border-red-900/50">{error}</div>}
        
        <div className="mt-8 text-white/80 text-sm text-center px-6 max-w-sm bg-black/40 p-4 rounded-xl backdrop-blur-sm border border-white/10">
          Apunta la cámara al código de barras.<br/><br/>
          <span className="text-green-400 font-bold">¡Tip!</span> Se agregará <strong>+1</strong> automáticamente al inventario por cada lectura exitosa.
        </div>
      </div>
    </div>
  );
};
