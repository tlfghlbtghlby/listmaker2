import React, { useEffect, useRef, useState } from 'react';
import { X, Camera, RefreshCw, AlertCircle, ScanLine } from 'lucide-react';
import { playBarcodeBeep } from '../utils/barcodeUtils';

interface CameraBarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  title?: string;
}

export const CameraBarcodeScanner: React.FC<CameraBarcodeScannerProps> = ({
  isOpen,
  onClose,
  onScan,
  title = 'مسح الرمز الشريطي (الباركود) بالكاميرا'
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const scanningRef = useRef<boolean>(false);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    startCamera();
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const stopCamera = () => {
    scanningRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const startCamera = async () => {
    setErrorMsg(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('الكاميرا غير مدعومة في هذا المتصفح.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setIsCameraActive(true);
        startScanningLoop();
      }
    } catch (err: any) {
      console.warn("Camera start notice:", err);
      setErrorMsg('تعذر فتح الكاميرا (يرجى السماح بالوصول للكاميرا أو استخدام ماسح الباركود اليدوي USB).');
    }
  };

  const startScanningLoop = () => {
    scanningRef.current = true;

    // Check if browser has native BarcodeDetector API (supported in Android Chrome and modern browsers)
    if ('BarcodeDetector' in window) {
      const barcodeDetector = new (window as any).BarcodeDetector({
        formats: ['code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'qr_code', 'data_matrix']
      });

      const detectInterval = setInterval(async () => {
        if (!scanningRef.current || !videoRef.current || videoRef.current.readyState < 2) return;

        try {
          const barcodes = await barcodeDetector.detect(videoRef.current);
          if (barcodes && barcodes.length > 0) {
            const raw = barcodes[0].rawValue?.trim();
            if (raw) {
              clearInterval(detectInterval);
              scanningRef.current = false;
              playBarcodeBeep(true);
              onScan(raw);
              onClose();
            }
          }
        } catch (e) {
          // Frame detection glitch, continue scanning
        }
      }, 250);

      return () => clearInterval(detectInterval);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = manualCode.trim();
    if (clean) {
      playBarcodeBeep(true);
      onScan(clean);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3">
      <div className="bg-slate-900 text-white rounded-2xl border border-slate-700 shadow-2xl max-w-md w-full overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ScanLine className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-sm text-white">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Viewport */}
        <div className="relative bg-black h-64 sm:h-72 flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            autoPlay
            playsInline
            muted
          />

          {/* Scanner Overlay Line */}
          {isCameraActive && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
              <div className="w-64 h-36 border-2 border-emerald-400 rounded-xl relative shadow-2xl shadow-emerald-500/30 flex items-center justify-center">
                <div className="w-full h-0.5 bg-emerald-400 shadow-xs shadow-emerald-400 animate-pulse"></div>
                <div className="absolute -top-6 text-[11px] font-bold text-emerald-300 bg-black/60 px-2 py-0.5 rounded-md">
                  وجّه الكاميرا نحو الباركود
                </div>
              </div>
            </div>
          )}

          {/* Loading or Error State */}
          {!isCameraActive && !errorMsg && (
            <div className="text-center text-slate-400 p-4 flex flex-col items-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
              <span className="text-xs font-semibold">جاري فتح الكاميرا...</span>
            </div>
          )}

          {errorMsg && (
            <div className="text-center p-4 text-xs font-bold text-amber-300 max-w-xs flex flex-col items-center gap-2">
              <AlertCircle className="w-6 h-6 text-amber-400" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Manual Barcode Input Fallback */}
        <div className="p-4 bg-slate-950/80 border-t border-slate-800 space-y-3">
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="أو أدخل رقم الباركود يدوياً..."
              className="flex-1 px-3 py-2 text-xs bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
              autoFocus
            />
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition cursor-pointer"
            >
              تأكيد
            </button>
          </form>

          <div className="text-center text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span>ماسح الباركود اللاسلكي والـ USB يعمل تلقائياً في أي وقت دون فتح الكاميرا</span>
          </div>
        </div>

      </div>
    </div>
  );
};
