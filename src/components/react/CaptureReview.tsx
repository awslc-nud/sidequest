import { useRef, useState } from 'react';
import { Check, ImagePlus, Loader2, RefreshCcw, X } from 'lucide-react';
import { compressBlobToWebP, ImageProcessingError } from '../../client/canvasCompress';

interface Props {
  promptTitle: string;
  onCancel: () => void;
  onConfirm: (blob: Blob) => Promise<void>;
}

type Phase = 'pick' | 'preview' | 'compressing';

/**
 * Capture → review flow. AC-01: the photo stays entirely in memory until the
 * attendee taps Confirm; Retake discards the buffer with zero I/O.
 *
 * The hidden file input carries `capture="environment"`, so on a phone the OS
 * camera opens directly; desktop falls back to a file picker. This is the
 * Confirm/Retake gate applied to whichever source the platform provides.
 */
export default function CaptureReview({ promptTitle, onCancel, onConfirm }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>('pick');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.');
      return;
    }
    setError(null);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setPhase('preview');
  };

  const retake = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setError(null);
    setPhase('pick');
    if (inputRef.current) inputRef.current.value = '';
  };

  const confirm = async () => {
    if (!inputRef.current?.files?.[0]) return;
    setPhase('compressing');
    setError(null);
    try {
      const blob = await compressBlobToWebP(inputRef.current.files[0]);
      await onConfirm(blob);
      retake();
    } catch (e) {
      setError(e instanceof ImageProcessingError ? e.message : 'Could not process that image. Please try another.');
      setPhase('preview');
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-brand-track bg-brand-white p-4 shadow-xl">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-brand-ink">Add photo</h3>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Close"
          className="rounded-full p-1.5 text-brand-muted transition hover:bg-brand-bg hover:text-brand-ink"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="text-sm text-brand-muted">{promptTitle}</p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        aria-label="Choose an image"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {phase === 'pick' && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-brand-track px-4 py-10 text-brand-deep transition hover:border-brand-accent hover:bg-brand-bg"
        >
          <ImagePlus className="h-8 w-8" />
          <span className="text-sm font-medium">Take or choose a photo</span>
        </button>
      )}

      {phase === 'preview' && previewUrl && (
        <div className="flex flex-col gap-3">
          <img src={previewUrl} alt="Preview of your capture" className="max-h-72 w-full rounded-xl object-contain" />
          {error && (
            <p className="rounded-lg border border-brand-orange/50 bg-brand-orange-soft px-3 py-2 text-sm text-brand-ink">{error}</p>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={retake}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-brand-track px-4 py-2.5 text-sm font-medium text-brand-deep transition hover:bg-brand-track/40"
            >
              <RefreshCcw className="h-4 w-4" /> Retake
            </button>
            <button
              type="button"
              onClick={confirm}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-brand-deep px-4 py-2.5 text-sm font-semibold text-brand-white transition hover:bg-brand-ink"
            >
              <Check className="h-4 w-4" strokeWidth={3} /> Confirm
            </button>
          </div>
        </div>
      )}

      {phase === 'compressing' && (
        <div className="flex items-center justify-center gap-2 py-8 text-brand-muted">
          <Loader2 className="h-5 w-5 animate-spin" /> Processing…
        </div>
      )}
    </div>
  );
}
