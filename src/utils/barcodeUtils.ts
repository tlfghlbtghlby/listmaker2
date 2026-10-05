import { useEffect, useRef, useState } from 'react';

/**
 * Normalizes barcode strings (converts Arabic numerals, trims spaces and control chars)
 */
export const normalizeBarcode = (raw: string | undefined | null): string => {
  if (!raw) return '';
  const arabicNumerals = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
  let str = raw.toString().trim();
  arabicNumerals.forEach((digit, i) => {
    str = str.split(digit).join(i.toString());
  });
  // Strip control characters, keeping letters, digits, and standard barcode symbols (- _ .)
  return str.replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim();
};

/**
 * Generates an authentic POS cashier beep sound using Web Audio API
 */
export const playBarcodeBeep = (isSuccess = true) => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    if (isSuccess) {
      // Crisp 1760Hz POS scanner cashier beep (70ms)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1760, ctx.currentTime);

      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.08);
      setTimeout(() => ctx.close().catch(() => {}), 150);
    } else {
      // Low double-tone warning for unrecognized barcode (440Hz -> 330Hz)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.setValueAtTime(330, ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.2);
      setTimeout(() => ctx.close().catch(() => {}), 250);
    }
  } catch (e) {
    // AudioContext might be blocked until user interacts with page
  }
};

interface UseBarcodeScannerProps {
  onScan: (barcode: string) => void;
  isEnabled?: boolean;
}

/**
 * Custom hook to automatically intercept hardware USB & Bluetooth barcode scanners.
 * Hardware scanners act as Human Interface Devices (HID keyboard) that emit characters
 * in rapid bursts (< 80ms per keystroke) terminated by an Enter or Tab key.
 */
export const useBarcodeScanner = ({ onScan, isEnabled = true }: UseBarcodeScannerProps) => {
  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const strokeTimestampsRef = useRef<number[]>([]);

  useEffect(() => {
    if (!isEnabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore modifier keys
      if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') {
        return;
      }

      const now = Date.now();
      const timeDiff = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // Active focused element
      const activeEl = document.activeElement;
      const isInputFocused = activeEl && (
        activeEl.tagName === 'INPUT' || 
        activeEl.tagName === 'TEXTAREA' || 
        (activeEl as HTMLElement).isContentEditable
      );

      // If time between keystrokes was too long for a hardware scanner (> 110ms),
      // reset buffer to prevent human typing concatenation
      if (timeDiff > 110) {
        bufferRef.current = '';
        strokeTimestampsRef.current = [];
      }

      // Hardware barcode scanner termination keys (Enter or Tab)
      if (e.key === 'Enter' || e.key === 'Tab') {
        const rawCode = bufferRef.current.trim();
        const timestamps = strokeTimestampsRef.current;

        // Calculate average keystroke interval to verify it came from a hardware barcode scanner
        let isScannerBurst = false;
        if (timestamps.length >= 3) {
          const totalDuration = timestamps[timestamps.length - 1] - timestamps[0];
          const avgInterval = totalDuration / (timestamps.length - 1);
          // Scanners average under 75ms per character
          if (avgInterval < 85) {
            isScannerBurst = true;
          }
        }

        if (rawCode.length >= 3 && isScannerBurst) {
          e.preventDefault();
          e.stopPropagation();

          // If an input was focused while the barcode scanner typed into it, clear or fix the input
          if (isInputFocused && activeEl) {
            const input = activeEl as HTMLInputElement;
            // If the input value ends with the scanned barcode, remove the scanned barcode part
            if (input.value && input.value.includes(rawCode)) {
              input.value = input.value.replace(rawCode, '').trim();
            }
          }

          bufferRef.current = '';
          strokeTimestampsRef.current = [];
          
          const cleanBarcode = normalizeBarcode(rawCode);
          if (cleanBarcode) {
            // Trigger scanner event
            window.dispatchEvent(new CustomEvent('hardware-barcode-scan', { detail: { barcode: cleanBarcode } }));
            onScan(cleanBarcode);
          }
          return;
        }

        // Handle case where user deliberately typed into a designated barcode input and pressed Enter
        if (isInputFocused && activeEl) {
          const isBarcodeInput = (activeEl as HTMLElement).getAttribute('data-barcode-input') === 'true';
          const val = (activeEl as HTMLInputElement).value?.trim();
          if (isBarcodeInput && val && val.length >= 2) {
            e.preventDefault();
            (activeEl as HTMLInputElement).value = '';
            bufferRef.current = '';
            strokeTimestampsRef.current = [];
            const clean = normalizeBarcode(val);
            onScan(clean);
            return;
          }
        }

        bufferRef.current = '';
        strokeTimestampsRef.current = [];
        return;
      }

      // Collect single printable characters
      if (e.key.length === 1) {
        bufferRef.current += e.key;
        strokeTimestampsRef.current.push(now);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isEnabled, onScan]);
};

/**
 * Hook to monitor barcode scanner hardware activity
 */
export const useScannerStatus = () => {
  const [lastScannedBarcode, setLastScannedBarcode] = useState<string | null>(null);
  const [lastScanTimestamp, setLastScanTimestamp] = useState<number | null>(null);
  const [isActivelyScanning, setIsActivelyScanning] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      const barcode = e.detail?.barcode;
      if (barcode) {
        setLastScannedBarcode(barcode);
        setLastScanTimestamp(Date.now());
        setIsActivelyScanning(true);
        setTimeout(() => setIsActivelyScanning(false), 2000);
      }
    };

    window.addEventListener('hardware-barcode-scan', handler);
    return () => {
      window.removeEventListener('hardware-barcode-scan', handler);
    };
  }, []);

  return {
    isReady: true, // Standard USB/Bluetooth HID scanners are plug-and-play ready
    lastScannedBarcode,
    lastScanTimestamp,
    isActivelyScanning,
  };
};
