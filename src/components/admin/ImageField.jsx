import { useCallback, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import ImageUploader from './ImageUploader';
import { thumbnailSrc } from '../../lib/mediaUrl';

// A single-image form field: preview + upload + paste-a-URL escape hatch.
//
// Replaces the bare "Image URL (copy from Media Library)" text inputs that used
// to sit in Homepage, Events, Journal, Collaborations and Countdowns. Those made
// the admin visit two screens and copy a string by hand.
//
// Uploads go through ImageUploader → lib/mediaUpload.js, the same and only
// upload path in the project. Each upload is also registered in
// alie_media_library, which keeps one browsable inventory of every file in the
// bucket and — because deletion checks that table — stops a Media Library
// delete from pulling an image out from under a homepage section.

export default function ImageField({
  label,
  value,
  onChange,
  hint,
  aspect = 'aspect-[16/9]',
  className = '',
}) {
  const { session } = useAuth();
  const [showUrlInput, setShowUrlInput] = useState(false);

  const persistUpload = useCallback(async (result) => {
    const { error } = await supabase.from('alie_media_library').insert({
      filename: result.filename,
      url: result.url,
      uploaded_by: session?.user?.id,
    });
    if (error) throw error; // ImageUploader removes the object it just wrote
    onChange(result.url);
  }, [onChange, session?.user?.id]);

  return (
    <div className={className}>
      {label && <label className="field-label">{label}</label>}

      {value ? (
        <div className="flex items-start gap-4">
          <div className={`${aspect} w-40 bg-stone/20 overflow-hidden flex-shrink-0 border border-ink/10`}>
            <img src={thumbnailSrc(value)} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
          </div>
          <div className="flex flex-col gap-2 pt-1">
            <button type="button" onClick={() => onChange('')} className="btn-link-danger text-left">
              Remove image
            </button>
            <button type="button" onClick={() => setShowUrlInput((v) => !v)} className="btn-link text-left">
              {showUrlInput ? 'Hide URL field' : 'Use a URL instead'}
            </button>
          </div>
        </div>
      ) : (
        <>
          <ImageUploader
            multiple={false}
            compact
            label="Upload Image"
            hint={hint}
            onUpload={persistUpload}
          />
          <button type="button" onClick={() => setShowUrlInput((v) => !v)} className="btn-link mt-2.5">
            {showUrlInput ? 'Hide URL field' : 'Or paste an image URL'}
          </button>
        </>
      )}

      {showUrlInput && (
        <input
          type="url"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://…"
          aria-label={`${label || 'Image'} URL`}
          className="field-input mt-2.5"
        />
      )}
    </div>
  );
}
