import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import {
  deleteImage,
  listImages,
  saveImageFile,
  subscribeImageStore,
  type StoredImage,
} from '../story/imageStore';
import { findImageUsages } from '../story/imageUsage';
import type { Story } from '../story/types';

export interface ImageLibraryPanelProps {
  story: Story;
}

export function ImageLibraryPanel({ story }: ImageLibraryPanelProps) {
  const [images, setImages] = useState<StoredImage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const items = await listImages(story.id);
    setImages(items);
  }, [story.id]);

  useEffect(() => {
    void load();
    return subscribeImageStore(() => {
      void load();
    });
  }, [load]);

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    try {
      await saveImageFile(file, { storyId: story.id, name: file.name });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to upload image.');
    }
  };

  const handleDelete = async (image: StoredImage) => {
    setError(null);
    const result = await deleteImage(image.id, story);
    if (!result.ok) {
      const places = result.usedBy.map((u) => u.label).join(', ');
      setError(`Cannot delete "${image.name}": still used in ${places}.`);
      return;
    }
    await load();
  };

  return (
    <section className="image-library-panel" aria-label="Story image library" data-testid="image-library-panel">
      <div className="integration-row-head">
        <h3>Story Image Library</h3>
        <label className="image-library-upload-btn">
          <span>Upload image</span>
          <input
            type="file"
            accept="image/*"
            aria-label="Upload image to library"
            className="image-picker__file-input"
            onChange={handleUpload}
          />
        </label>
      </div>

      <p className="inspector-sublabel">
        Images stored in this story ({images.length}). Delete unused images here.
      </p>

      {error && (
        <div role="alert" className="image-picker__error" data-testid="image-library-error">
          {error}
        </div>
      )}

      {images.length === 0 ? (
        <p className="inspector-sublabel">No images yet.</p>
      ) : (
        <ul className="image-library-list">
          {images.map((img) => {
            const usages = findImageUsages(story, img.id);
            return (
              <li key={img.id} className="image-library-item" data-testid={`library-image-${img.id}`}>
                <img src={img.dataUrl} alt={img.name} className="image-library-item__thumb" />
                <div className="image-library-item__meta">
                  <strong>{img.name}</strong>
                  <span className="inspector-sublabel">
                    {usages.length === 0
                      ? 'Unused'
                      : `Used in: ${usages.map((u) => u.label).join(', ')}`}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn-danger"
                  aria-label={`Delete ${img.name}`}
                  onClick={() => void handleDelete(img)}
                >
                  Delete
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
