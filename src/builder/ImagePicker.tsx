import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
} from 'react';
import { listImages, saveImageFile, type StoredImage } from '../story/imageStore';
import type { Story } from '../story/types';
import { useImageUrl } from '../story/useImageUrl';

export interface ImagePickerProps {
  label: string;
  value?: string;
  story?: Story;
  storyId?: string;
  onChange: (imageId: string | undefined) => void;
  testId?: string;
}

function LibraryThumb({
  image,
  selected,
  onSelect,
}: {
  image: StoredImage;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`image-library-thumb-btn ${selected ? 'is-selected' : ''}`}
      onClick={onSelect}
      aria-label={`Select image ${image.name}`}
      aria-pressed={selected}
    >
      <img src={image.dataUrl} alt={image.name} className="image-library-thumb-img" />
      <span className="image-library-thumb-name">{image.name}</span>
    </button>
  );
}

export function ImagePicker({
  label,
  value,
  story,
  storyId,
  onChange,
  testId,
}: ImagePickerProps) {
  const inputId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [libraryImages, setLibraryImages] = useState<StoredImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const effectiveStoryId = story?.id ?? storyId;
  const previewUrl = useImageUrl(value);

  const refreshLibrary = useCallback(async () => {
    const items = await listImages(effectiveStoryId);
    setLibraryImages(items);
  }, [effectiveStoryId]);

  useEffect(() => {
    if (showLibrary) {
      void refreshLibrary();
    }
  }, [showLibrary, refreshLibrary]);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const saved = await saveImageFile(file, {
        storyId: effectiveStoryId,
        name: file.name,
      });
      onChange(saved.id);
      if (showLibrary) {
        await refreshLibrary();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to upload image.');
    } finally {
      setBusy(false);
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    void handleFile(file);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer?.files?.[0];
    void handleFile(file);
  };

  const handleDropZoneKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInputRef.current?.click();
    }
  };

  return (
    <div
      className="image-picker"
      data-testid={testId ?? `image-picker-${inputId}`}
      role="group"
      aria-label={label}
    >
      <div className="image-picker__label">{label}</div>

      <div
        className={`image-picker__dropzone ${dragging ? 'is-dragging' : ''}`}
        tabIndex={0}
        role="button"
        aria-label={`${label}: drop image or press Enter to upload`}
        onKeyDown={handleDropZoneKeyDown}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        {previewUrl ? (
          <img
            src={previewUrl}
            alt={`${label} preview`}
            className="image-picker__preview"
          />
        ) : (
          <span className="image-picker__empty">No image selected — drop file or upload</span>
        )}
      </div>

      <input
        ref={fileInputRef}
        id={inputId}
        type="file"
        accept="image/*"
        aria-label={`Upload ${label}`}
        className="image-picker__file-input"
        onChange={handleInputChange}
      />

      <div className="image-picker__actions">
        <button
          type="button"
          disabled={busy}
          onClick={() => fileInputRef.current?.click()}
        >
          {value ? `Replace ${label}` : `Upload ${label}`}
        </button>
        <button
          type="button"
          aria-expanded={showLibrary}
          onClick={() => setShowLibrary((v) => !v)}
        >
          {showLibrary ? 'Close library' : `Choose ${label} from library`}
        </button>
        {value && (
          <button
            type="button"
            className="btn-danger"
            aria-label={`Remove ${label}`}
            onClick={() => onChange(undefined)}
          >
            Remove
          </button>
        )}
      </div>

      {showLibrary && (
        <div
          className="image-picker__library"
          role="region"
          aria-label={`${label} image library`}
        >
          {libraryImages.length === 0 ? (
            <p className="inspector-sublabel">No images stored for this story yet.</p>
          ) : (
            <div className="image-library-grid">
              {libraryImages.map((img) => (
                <LibraryThumb
                  key={img.id}
                  image={img}
                  selected={value === img.id}
                  onSelect={() => {
                    onChange(img.id);
                    setShowLibrary(false);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {error && (
        <div role="alert" className="image-picker__error">
          {error}
        </div>
      )}
    </div>
  );
}
