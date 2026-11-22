import { MemoryPhotoItem } from '../types';

export interface MemoryManifestEntry {
  filename: string;
  caption?: string;
  date?: string;
}

/**
 * Fallback placeholder slots shown cleanly until the user places real photographs
 * inside public/images/memories/ and registers them in manifest.json.
 */
const DEFAULT_PLACEHOLDER_SLOTS: MemoryPhotoItem[] = [
  {
    id: 'memory-slot-1',
    src: null,
    caption: 'Memory Frame I',
    date: 'Add photo in public/images/memories/',
    aspectRatio: 4 / 3,
    isPlaceholder: true,
  },
  {
    id: 'memory-slot-2',
    src: null,
    caption: 'Memory Frame II',
    date: 'Add photo in public/images/memories/',
    aspectRatio: 3 / 4,
    isPlaceholder: true,
  },
  {
    id: 'memory-slot-3',
    src: null,
    caption: 'Memory Frame III',
    date: 'Add photo in public/images/memories/',
    aspectRatio: 1,
    isPlaceholder: true,
  },
  {
    id: 'memory-slot-4',
    src: null,
    caption: 'Memory Frame IV',
    date: 'Add photo in public/images/memories/',
    aspectRatio: 16 / 10,
    isPlaceholder: true,
  },
  {
    id: 'memory-slot-5',
    src: null,
    caption: 'Memory Frame V',
    date: 'Add photo in public/images/memories/',
    aspectRatio: 4 / 5,
    isPlaceholder: true,
  },
  {
    id: 'memory-slot-6',
    src: null,
    caption: 'Memory Frame VI',
    date: 'Add photo in public/images/memories/',
    aspectRatio: 4 / 3,
    isPlaceholder: true,
  },
];

export async function loadMemoryGalleryItems(
  manifestPath = '/images/memories/manifest.json'
): Promise<MemoryPhotoItem[]> {
  try {
    const res = await fetch(manifestPath, { cache: 'no-store' });
    if (!res.ok) {
      return DEFAULT_PLACEHOLDER_SLOTS;
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return DEFAULT_PLACEHOLDER_SLOTS;
    }

    const data = (await res.json()) as { memories?: MemoryManifestEntry[] };
    const entries = Array.isArray(data?.memories) ? data.memories : [];
    const validEntries = entries.filter(
      (entry) => typeof entry?.filename === 'string' && entry.filename.trim().length > 0
    );

    if (validEntries.length === 0) {
      return DEFAULT_PLACEHOLDER_SLOTS;
    }

    return validEntries.map((entry, index) => {
      const cleanName = entry.filename.replace(/^\/+/, '');
      return {
        id: `memory-photo-${index + 1}`,
        src: `/images/memories/${cleanName}`,
        caption: entry.caption?.trim() || `Memory ${index + 1}`,
        date: entry.date?.trim() || undefined,
        isPlaceholder: false,
      };
    });
  } catch {
    return DEFAULT_PLACEHOLDER_SLOTS;
  }
}
