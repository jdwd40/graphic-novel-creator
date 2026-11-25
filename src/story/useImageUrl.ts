import { useEffect, useState } from 'react';
import { getImage, getImageSync, isImageId, subscribeImageStore } from './imageStore';

export function useImageUrl(imageRef?: string): string | undefined {
  const [, setTick] = useState(0);
  const [asyncUrl, setAsyncUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    return subscribeImageStore(() => {
      setTick((t) => t + 1);
    });
  }, []);

  useEffect(() => {
    if (!isImageId(imageRef)) {
      setAsyncUrl(undefined);
      return;
    }

    const sync = getImageSync(imageRef);
    if (sync) {
      setAsyncUrl(sync.dataUrl);
      return;
    }

    let cancelled = false;
    void getImage(imageRef)
      .then((found) => {
        if (!cancelled) {
          setAsyncUrl(found?.dataUrl);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAsyncUrl(undefined);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [imageRef]);

  if (!imageRef) return undefined;
  if (!isImageId(imageRef)) return imageRef;
  return getImageSync(imageRef)?.dataUrl ?? asyncUrl;
}
