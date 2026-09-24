import { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, CameraOff, Loader2, Scan } from 'lucide-react';

type CameraState = 'idle' | 'starting' | 'active' | 'error';

interface Props {
  /** Pause decoding while a redeem request is in flight. */
  paused: boolean;
  /** Called once per decoded QR payload. */
  onScan: (value: string) => void;
}

/** Map a getUserMedia failure to marshal-readable copy. */
export function cameraErrorMessage(err: unknown): string {
  const name = (err as { name?: string } | null)?.name;
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Camera permission was denied. Allow camera access in your browser settings, then retry.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'No camera was found on this device. Use the code entry below instead.';
    case 'NotReadableError':
    case 'AbortError':
      return 'The camera is already in use by another app. Close it and retry, or use the code entry below.';
    default:
      return 'Could not start the camera. Use the code entry below instead.';
  }
}

/**
 * Live camera QR scanner for the marshal viewfinder.
 *
 * Decodes frames with `jsQR` (works on iOS Safari, unlike `BarcodeDetector`).
 * A scan fires `onScan` once and disarms until `paused` cycles back to false,
 * so a single pass can't be redeemed twice by the decode loop.
 */
export default function QrScanner({ paused, onScan }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const armedRef = useRef(true);
  const pausedRef = useRef(paused);
  const onScanRef = useRef(onScan);

  const [state, setState] = useState<CameraState>('idle');
  const [error, setError] = useState<string | null>(null);

  onScanRef.current = onScan;

  useEffect(() => {
    pausedRef.current = paused;
    if (!paused) armedRef.current = true;
  }, [paused]);

  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setState('idle');
  }, []);

  const decodeLoop = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (armedRef.current && !pausedRef.current && video.readyState >= video.HAVE_CURRENT_DATA && video.videoWidth > 0) {
      const canvas = canvasRef.current ?? (canvasRef.current = document.createElement('canvas'));
      const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(frame.data, frame.width, frame.height, { inversionAttempts: 'dontInvert' });
        if (code?.data) {
          armedRef.current = false;
          onScanRef.current(code.data);
        }
      }
    }

    rafRef.current = requestAnimationFrame(decodeLoop);
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setState('error');
      setError('Camera access needs a secure (HTTPS) connection or localhost.');
      return;
    }

    setState('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setState('idle');
        return;
      }

      video.srcObject = stream;
      await video.play().catch(() => undefined);
      armedRef.current = true;
      setState('active');
      rafRef.current = requestAnimationFrame(decodeLoop);
    } catch (err) {
      setState('error');
      setError(cameraErrorMessage(err));
    }
  }, [decodeLoop]);

  useEffect(() => stopCamera, [stopCamera]);

  return (
    <section
      id="scanner-slot"
      aria-label="Claim scanner"
      className="relative flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-dashed border-zinc-700 bg-zinc-900/40"
      data-asset="marshal-scanner"
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        aria-label="Camera preview"
        className={`h-full w-full object-cover transition-opacity ${state === 'active' ? 'opacity-100' : 'opacity-0'}`}
      />

      {state === 'active' && (
        <>
          <div className="pointer-events-none absolute inset-6 rounded-lg border-2 border-emerald-400/70" />
          <div className="pointer-events-none absolute inset-x-0 h-0.5 animate-[qr-scan_2.4s_ease-in-out_infinite] bg-emerald-400/80" />
          <button
            type="button"
            onClick={stopCamera}
            className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded-lg bg-zinc-900/80 px-3 py-1.5 text-xs font-medium text-zinc-200 backdrop-blur transition hover:bg-zinc-800"
          >
            <CameraOff className="h-3.5 w-3.5" /> Stop
          </button>
        </>
      )}

      {state !== 'active' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
          <Scan className="h-12 w-12 text-zinc-600" />
          <p className={`text-sm ${state === 'error' ? 'text-amber-300' : 'text-zinc-400'}`}>
            {state === 'error' ? error : "Point the camera at the attendee's QR code."}
          </p>
          <button
            type="button"
            onClick={() => void startCamera()}
            disabled={state === 'starting'}
            className="flex items-center gap-2 rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-900 transition hover:bg-white disabled:opacity-50"
          >
            {state === 'starting' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            {state === 'error' ? 'Retry camera' : state === 'starting' ? 'Starting…' : 'Start camera'}
          </button>
        </div>
      )}
    </section>
  );
}
