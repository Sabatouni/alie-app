import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '../../context/ToastContext';
import {
  ACCEPT_ATTR,
  ACCEPTED_LABEL,
  MAX_INPUT_BYTES,
  formatBytes,
  friendlyUploadError,
  removeFromStorage,
  uploadImage,
  validateImageFile,
} from '../../lib/mediaUpload';

// The one uploader UI in the ALIÈ admin. Media Library and the per-product
// Images panel both render this; the only thing that differs between them is
// what `onUpload` does with the returned URL.
//
// Everything network-facing lives in lib/mediaUpload.js — this file is purely
// drag/drop, progress and error presentation.

// supabase-js exposes no upload progress event, so the bar advances by pipeline
// stage instead of bytes. These weights are what each stage is "worth".
const STAGE_FRACTION = {
  queued: 0,
  validating: 0.05,
  optimizing: 0.35,
  uploading: 0.7,
  saving: 0.9,
  done: 1,
  failed: 1,
};

const STAGE_LABEL = {
  queued: 'Waiting…',
  validating: 'Checking…',
  optimizing: 'Optimising…',
  uploading: 'Uploading…',
  saving: 'Saving…',
  done: 'Done',
  failed: 'Failed',
};

export default function ImageUploader({
  /** async (uploadResult) => void — persist the row. Throwing here rolls back the storage object. */
  onUpload,
  /** ({ uploaded, failed, savedBytes }) => void — fired once per batch, after all files settle. */
  onComplete,
  multiple = true,
  label = 'Upload Images',
  hint,
  disabled = false,
  compact = false,
  className = '',
}) {
  const toast = useToast();
  const inputRef = useRef(null);
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState([]);
  const [dragging, setDragging] = useState(false);

  // Drag events fire on every child element, so a plain boolean flickers.
  const dragDepth = useRef(0);

  // Guards setState-after-unmount if the admin navigates away mid-upload.
  // Set inside the effect, not at declaration: StrictMode's dev-only
  // mount/unmount/remount would otherwise leave this false forever.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const setStage = useCallback((id, stage, error) => {
    if (!alive.current) return;
    setItems((list) => list.map((i) => (i.id === id ? { ...i, stage, error } : i)));
  }, []);

  const runBatch = useCallback(async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length || disabled) return;

    const batch = files.map((file, index) => ({
      id: `${Date.now()}-${index}-${file.name}`,
      name: file.name,
      file,
      stage: 'queued',
      error: null,
    }));

    setErrors([]);
    setItems(batch);
    setBusy(true);

    const failures = [];
    let uploaded = 0;
    let savedBytes = 0;

    try {
      for (const item of batch) {
        try {
          // Cheap client-side rejection first, so an unsupported file never
          // costs the admin an optimize pass or a round trip.
          const invalid = validateImageFile(item.file);
          if (invalid) throw new Error(invalid);

          const result = await uploadImage(item.file, {
            onStage: (stage) => setStage(item.id, stage),
          });
          savedBytes += result.savedBytes;

          setStage(item.id, 'saving');
          try {
            await onUpload?.(result);
          } catch (persistErr) {
            // The object made it to storage but the row didn't — don't leave
            // an orphan behind.
            await removeFromStorage([result.path]);
            throw persistErr;
          }

          setStage(item.id, 'done');
          uploaded++;
        } catch (err) {
          const message = friendlyUploadError(err);
          setStage(item.id, 'failed', message);
          failures.push(`${item.name}: ${message}`);
        }
      }

      if (!alive.current) return;

      if (uploaded > 0) {
        const saved = savedBytes > 512 * 1024 ? ` · saved ${formatBytes(savedBytes)} via optimisation` : '';
        toast?.success(`Uploaded ${uploaded} ${uploaded === 1 ? 'image' : 'images'}${saved}.`);
      }
      if (failures.length) {
        setErrors(failures);
        toast?.error(`${failures.length} ${failures.length === 1 ? 'file' : 'files'} could not be uploaded.`);
      }

      onComplete?.({ uploaded, failed: failures.length, savedBytes });
    } finally {
      if (alive.current) {
        setBusy(false);
        // Leave failed rows on screen so the admin can read why; clear the rest.
        setItems((list) => list.filter((i) => i.stage === 'failed'));
      }
    }
  }, [disabled, onComplete, onUpload, setStage, toast]);

  function handleInputChange(e) {
    // Copy the FileList into a real array BEFORE clearing the input. `files` is
    // a live view of the input — setting value='' empties it, so reading it
    // afterwards would hand runBatch an empty list and silently do nothing.
    const files = Array.from(e.target.files || []);
    e.target.value = ''; // allow re-picking the same file
    runBatch(files);
  }

  function handleDragEnter(e) {
    e.preventDefault();
    if (disabled || busy) return;
    dragDepth.current++;
    setDragging(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  }

  function handleDragOver(e) {
    e.preventDefault();
    if (!disabled && !busy) e.dataTransfer.dropEffect = 'copy';
  }

  function handleDrop(e) {
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    if (disabled || busy) return;
    const dropped = Array.from(e.dataTransfer?.files || []);
    runBatch(multiple ? dropped : dropped.slice(0, 1));
  }

  function openPicker() {
    if (!disabled && !busy) inputRef.current?.click();
  }

  const overall = items.length
    ? items.reduce((sum, i) => sum + (STAGE_FRACTION[i.stage] ?? 0), 0) / items.length
    : 0;

  const inert = disabled || busy;

  return (
    <div className={className}>
      <div
        role="button"
        tabIndex={inert ? -1 : 0}
        aria-disabled={inert}
        aria-label={`${label}. Drag and drop images here, or press Enter to browse.`}
        onClick={openPicker}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPicker(); }
        }}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={[
          'border border-dashed text-center transition-colors duration-200 cursor-pointer',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-paper',
          compact ? 'px-5 py-6' : 'px-6 py-10',
          dragging ? 'border-camel bg-camel/5' : 'border-ink/20 hover:border-ink/45 bg-white',
          inert ? 'opacity-60 pointer-events-none' : '',
        ].join(' ')}
      >
        <span className="btn-primary inline-block pointer-events-none">
          {busy ? 'Uploading…' : label}
        </span>
        <p className="text-xs text-ink/45 mt-3">
          {hint || `Drag & drop or click to browse · ${ACCEPTED_LABEL} · up to ${formatBytes(MAX_INPUT_BYTES)} each`}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_ATTR}
          multiple={multiple}
          onChange={handleInputChange}
          className="hidden"
          disabled={inert}
        />
      </div>

      {busy && (
        <div className="mt-4" role="status" aria-live="polite">
          <div className="h-[3px] bg-ink/10 overflow-hidden">
            <div
              className="h-full bg-ink transition-[width] duration-300 ease-out"
              style={{ width: `${Math.round(overall * 100)}%` }}
            />
          </div>
          <ul className="mt-3 space-y-1.5">
            {items.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-4 text-xs text-ink/55">
                <span className="truncate">{i.name}</span>
                <span className="shrink-0 tabular-nums text-ink/40">{STAGE_LABEL[i.stage]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {errors.length > 0 && (
        <div role="alert" className="mt-4 border border-red-200 bg-red-50 px-3.5 py-3">
          <ul className="space-y-1">
            {errors.map((message) => (
              <li key={message} className="text-xs text-red-700 leading-relaxed">{message}</li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => { setErrors([]); setItems([]); }}
            className="btn-link mt-2.5 text-red-700/80 hover:text-red-700"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
