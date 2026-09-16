import { useRef, useState } from 'react';
import { CheckCircle2, ImagePlus, Loader2, RefreshCcw, X } from 'lucide-react';
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
 * Capture source is a device file picker (works on desktop + mobile). This is
 * the same Confirm/Retake gate the camera path will feed once it lands.
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
    // retain the object URL for preview until Retake/Confirm
    (file as unknown as { _url: string })._url = url;
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
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-medium">Add photo</h3>
        <button type="button" onClick={onCancel} aria-label="Close" className="rounded p-1 text-zinc-400 hover:text-zinc-200">
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="mb-3 text-sm text-zinc-400">{promptTitle}</p>

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
          className="flex w-full flex-col items-center gap-2 rounded-lg border border-dashed border-zinc-700 px-4 py-10 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
        >
          <ImagePlus className="h-8 w-8" />
          <span className="text-sm">Choose a photo from your device</span>
        </button>
      )}

      {phase === 'preview' && previewUrl && (
        <div className="flex flex-col gap-3">
          <img src={previewUrl} alt="Preview of your capture" className="max-h-72 w-full rounded-lg object-contain" />
          {error && <p className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">{error}</p>}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={retake}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-zinc-700 px-4 py-2.5 text-sm text-zinc-200 hover:bg-zinc-800"
            >
              <RefreshCcw className="h-4 w-4" /> Retake
            </button>
            <button
              type="button"
              onClick={confirm}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-900 hover:bg-white"
            >
              <CheckCircle2 className="h-4 w-4" /> Confirm
            </button>
          </div>
        </div>
      )}

      {phase === 'compressing' && (
        <div className="flex items-center justify-center gap-2 py-8 text-zinc-400">
          <Loader2 className="h-5 w-5 animate-spin" /> Processing…
        </div>
      )}
    </div>
  );
}
