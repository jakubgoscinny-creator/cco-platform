"use client";

import { useEffect, useState } from "react";

interface QuestionImageFile {
  fileId: number;
  mimetype: string;
  name: string;
}

/**
 * CCO-T077: renders a question's Podio-hosted image attachments (Supermenu
 * embeds), which never appear as a real <img> in the question's HTML — see
 * resolveQuestionImages in src/lib/sync.ts for why this has to be a separate
 * fetch rather than baked into the question text. Renders nothing while
 * loading or if the question has no such images (the common case), so it
 * never introduces layout shift or a visible "checking..." state.
 *
 * Callers MUST pass `key={podioItemId}` so React remounts this component
 * (fresh `useState(null)`) on question change, instead of showing the
 * previous question's images while the new fetch is in flight.
 */
export function QuestionImages({ podioItemId }: { podioItemId: number }) {
  const [images, setImages] = useState<QuestionImageFile[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/question-images/${podioItemId}`)
      .then((res) => (res.ok ? res.json() : { images: [] }))
      .then((data) => {
        if (!cancelled) setImages(data.images ?? []);
      })
      .catch(() => {
        if (!cancelled) setImages([]);
      });
    return () => {
      cancelled = true;
    };
  }, [podioItemId]);

  if (!images?.length) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-3">
      {images.map((img) => (
        // eslint-disable-next-line @next/next/no-img-element -- proxied Podio bytes, not a static/optimizable asset
        <img
          key={img.fileId}
          src={`/api/podio-file/${img.fileId}?type=${encodeURIComponent(img.mimetype)}`}
          alt={img.name || "Question image"}
          className="max-w-full sm:max-w-sm rounded-lg border border-cco-border"
        />
      ))}
    </div>
  );
}
