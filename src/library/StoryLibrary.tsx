import { useRef, useState, type ChangeEvent } from 'react';
import { exportStoryBundle, importStoryBundle } from '../story/bundle';
import type { Story } from '../story/types';
import { useImageUrl } from '../story/useImageUrl';

export interface StoryLibraryProps {
  stories: Story[];
  onCreateBlank: (title?: string) => void;
  onOpenDemo: () => void;
  onOpenBuilder: (storyId: string) => void;
  onOpenPlayer: (storyId: string) => void;
  onRename: (storyId: string, nextTitle: string) => void;
  onDuplicate: (storyId: string) => void;
  onDelete: (storyId: string) => Promise<void>;
  onImported: (story: Story) => void;
}

function StoryCardCover({ imageId, title }: { imageId?: string; title: string }) {
  const url = useImageUrl(imageId);
  if (url) {
    return <img src={url} alt={`${title} cover`} className="library-card__cover-img" />;
  }
  return (
    <div className="library-card__cover-placeholder" aria-hidden="true">
      <span>{title.slice(0, 1).toUpperCase()}</span>
    </div>
  );
}

function formatEditedDate(timestamp?: number): string {
  if (!timestamp) return 'Recently edited';
  try {
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return 'Recently edited';
  }
}

export function StoryLibrary({
  stories,
  onCreateBlank,
  onOpenDemo,
  onOpenBuilder,
  onOpenPlayer,
  onRename,
  onDuplicate,
  onDelete,
  onImported,
}: StoryLibraryProps) {
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [busyExportId, setBusyExportId] = useState<string | null>(null);

  const handleImportChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setStatusError(null);
    try {
      const text = await file.text();
      const imported = await importStoryBundle(text);
      onImported(imported);
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Unable to import story file.');
    }
  };

  const handleExport = async (story: Story) => {
    setStatusError(null);
    setBusyExportId(story.id);
    try {
      const bundle = await exportStoryBundle(story);
      const json = JSON.stringify(bundle, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${story.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'story'}.gnc.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Unable to export story.');
    } finally {
      setBusyExportId(null);
    }
  };

  return (
    <section className="story-library" aria-label="Story library" data-testid="story-library">
      <div className="story-library__header">
        <div>
          <h2>Your Stories</h2>
          <p className="story-library__subtitle">
            Create a new branching graphic novel, open the demo story, or import a bundle file.
          </p>
        </div>
        <div className="story-library__actions">
          <button
            type="button"
            className="btn-primary"
            onClick={() => onCreateBlank()}
          >
            New story
          </button>
          <button type="button" onClick={onOpenDemo}>
            Open demo story
          </button>
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
          >
            Import story
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            aria-label="Import story bundle file"
            className="image-picker__file-input"
            onChange={handleImportChange}
          />
        </div>
      </div>

      {statusError && (
        <div role="alert" className="library-error" data-testid="library-error">
          {statusError}
        </div>
      )}

      {stories.length === 0 ? (
        <div className="library-empty">
          <p>No saved stories yet. Start a blank story or open The Iron Bell demo.</p>
        </div>
      ) : (
        <ul className="library-grid">
          {stories.map((story) => {
            const isRenaming = renamingId === story.id;
            const isConfirmingDelete = confirmDeleteId === story.id;
            const startNode = story.nodes[story.startNodeId];
            const fallbackCover =
              startNode?.kind === 'passage' ? startNode.image : startNode?.encounter.enemy.image;
            return (
              <li
                key={story.id}
                className="library-card"
                data-testid={`story-card-${story.id}`}
              >
                <div className="library-card__cover">
                  <StoryCardCover
                    imageId={story.coverImage ?? fallbackCover}
                    title={story.title}
                  />
                </div>
                <div className="library-card__body">
                  {isRenaming ? (
                    <form
                      className="library-rename-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        onRename(story.id, renameDraft);
                        setRenamingId(null);
                      }}
                    >
                      <input
                        type="text"
                        aria-label={`Rename ${story.title}`}
                        value={renameDraft}
                        onChange={(e) => setRenameDraft(e.target.value)}
                      />
                      <button type="submit">Save</button>
                      <button type="button" onClick={() => setRenamingId(null)}>
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <>
                      <h3 className="library-card__title">{story.title}</h3>
                      <div className="library-card__meta">
                        <span>Last edited: {formatEditedDate(story.updatedAt)}</span>
                        <span>{Object.keys(story.nodes).length} scenes</span>
                      </div>
                    </>
                  )}

                  {isConfirmingDelete ? (
                    <div className="library-delete-confirm" role="alertdialog" aria-label={`Confirm delete ${story.title}`}>
                      <span>Delete &ldquo;{story.title}&rdquo;, its images, and its save?</span>
                      <div className="library-card__btn-row">
                        <button
                          type="button"
                          className="btn-danger"
                          onClick={() => {
                            void onDelete(story.id).then(() => setConfirmDeleteId(null));
                          }}
                        >
                          Confirm delete
                        </button>
                        <button type="button" onClick={() => setConfirmDeleteId(null)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="library-card__btn-row">
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => onOpenBuilder(story.id)}
                      >
                        Edit
                      </button>
                      <button type="button" onClick={() => onOpenPlayer(story.id)}>
                        Play
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRenamingId(story.id);
                          setRenameDraft(story.title);
                        }}
                      >
                        Rename
                      </button>
                      <button type="button" onClick={() => onDuplicate(story.id)}>
                        Duplicate
                      </button>
                      <button
                        type="button"
                        disabled={busyExportId === story.id}
                        onClick={() => void handleExport(story)}
                      >
                        Export
                      </button>
                      <button
                        type="button"
                        className="btn-danger"
                        onClick={() => setConfirmDeleteId(story.id)}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
