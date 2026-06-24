'use client';

import { useEffect, useState } from 'react';
import { ImageIcon } from 'lucide-react';

export interface GalleryItem { id: string; storage_path: string; title: string | null }

/**
 * Project gallery — resolves short-lived signed URLs for each media item on
 * mount (images live in the private `project-media` bucket, never a public
 * path). Calm tiled grid; falls back to a placeholder while signing.
 */
export function ProjectGallery({
  items,
  getUrl,
}: {
  items: GalleryItem[];
  getUrl: (path: string) => Promise<string>;
}) {
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    Promise.all(
      items.map(async (it) => [it.id, await getUrl(it.storage_path)] as const)
    ).then((pairs) => {
      if (active) setUrls(Object.fromEntries(pairs));
    });
    return () => {
      active = false;
    };
  }, [items, getUrl]);

  if (items.length === 0) {
    return <p className="text-sm text-charcoal-600/70">No gallery images yet.</p>;
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map((it) => (
        <div key={it.id} className="aspect-[4/3] overflow-hidden rounded border border-stone-line bg-sand-100">
          {urls[it.id] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={urls[it.id]} alt={it.title ?? 'Project image'} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-olive">
              <ImageIcon size={20} strokeWidth={1.5} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
