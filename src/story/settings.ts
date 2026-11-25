export interface ReaderSettings {
  autoAdvance: boolean;
}

const READER_SETTINGS_KEY = 'gnc_reader_settings_v1';

export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  autoAdvance: false,
};

export function loadReaderSettings(): ReaderSettings {
  const raw = localStorage.getItem(READER_SETTINGS_KEY);
  if (!raw) return { ...DEFAULT_READER_SETTINGS };
  try {
    const parsed = JSON.parse(raw) as Partial<ReaderSettings>;
    return {
      autoAdvance: Boolean(parsed.autoAdvance),
    };
  } catch {
    return { ...DEFAULT_READER_SETTINGS };
  }
}

export function saveReaderSettings(settings: ReaderSettings): void {
  localStorage.setItem(READER_SETTINGS_KEY, JSON.stringify(settings));
}

export function computeAutoAdvanceDelay(
  resultCaption: string,
  tellCaption: string | null,
): number {
  const totalChars = resultCaption.length + (tellCaption?.length ?? 0);
  const rawMs = 1000 + totalChars * 35;
  return Math.max(1200, Math.min(6000, rawMs));
}
