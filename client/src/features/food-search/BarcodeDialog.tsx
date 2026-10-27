import { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, ScanBarcode } from 'lucide-react';
import { barcodeSchema, type FoodItem } from '@nutritrack/shared';
import { ApiError } from '@/lib/api';
import { lookupBarcode } from '@/services/foods';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { InlineError, Notice } from '@/components/feedback/states';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFound: (food: FoodItem) => void;
}

type ScanControls = { stop: () => void };

/**
 * Camera barcode scanning (ZXing, loaded on demand) where the browser exposes
 * a camera, plus manual entry. Lookups go through the server's barcode-capable
 * providers; a missing product is reported as not found.
 */
export function BarcodeDialog({ open, onOpenChange, onFound }: Props) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<ScanControls | null>(null);
  const cameraSupported = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);

  const stopCamera = () => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setScanning(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      stopCamera();
      setError(null);
      setCameraError(null);
    }
    onOpenChange(next);
  };
  useEffect(() => () => controlsRef.current?.stop(), []);

  const lookup = async (value: string) => {
    const parsed = barcodeSchema.safeParse(value.trim());
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid barcode');
      return;
    }
    setPending(true);
    setError(null);
    try {
      const food = await lookupBarcode(parsed.data);
      handleOpenChange(false);
      onFound(food);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Barcode lookup failed. Please try again.');
    } finally {
      setPending(false);
    }
  };

  const startCamera = async () => {
    setCameraError(null);
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const reader = new BrowserMultiFormatReader();
      setScanning(true);
      controlsRef.current = await reader.decodeFromVideoDevice(undefined, videoRef.current!, (result) => {
        if (result) {
          const text = result.getText();
          setCode(text);
          stopCamera();
          void lookup(text);
        }
      });
    } catch (err) {
      setScanning(false);
      const name = (err as { name?: string })?.name;
      setCameraError(name === 'NotAllowedError' ? 'Camera permission was denied. You can type the barcode instead.' : 'The camera could not be started on this device. Type the barcode instead.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent title="Scan a barcode" description="Point your camera at a product barcode, or type the digits.">
        <div className="space-y-4">
          {cameraSupported ? (
            <div className="space-y-2">
              <div className="relative overflow-hidden rounded-xl border border-line bg-[#0b1020]" style={{ aspectRatio: '4 / 3' }}>
                <video ref={videoRef} className="size-full object-cover" muted playsInline aria-label="Camera preview" />
                {!scanning && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/80">
                    <ScanBarcode className="size-8" aria-hidden />
                    <Button variant="secondary" onClick={startCamera}><Camera /> Start camera</Button>
                  </div>
                )}
                {scanning && <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-danger/80" aria-hidden />}
              </div>
              {scanning && (
                <Button variant="ghost" size="sm" onClick={stopCamera}><CameraOff /> Stop camera</Button>
              )}
              {cameraError && <Notice tone="warning">{cameraError}</Notice>}
            </div>
          ) : (
            <Notice tone="warning">Camera scanning isn't supported in this browser. Enter the barcode digits instead.</Notice>
          )}
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void lookup(code);
            }}
          >
            <Field label="Barcode number" className="flex-1">
              {(p) => <Input {...p} inputMode="numeric" autoComplete="off" placeholder="e.g. 3017624010701" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 14))} />}
            </Field>
            <Button type="submit" loading={pending}>Look up</Button>
          </form>
          {error && <InlineError message={error} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
