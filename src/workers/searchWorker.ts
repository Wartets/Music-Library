import { TrackItem } from '../types/music';

// A simple in-memory store for the worker
let tracksCache: TrackItem[] = [];

self.onmessage = (e: MessageEvent) => {
    const { type, payload } = e.data;

    if (type === 'INIT') {
        tracksCache = payload || [];
        postMessage({ type: 'INIT_DONE' });
    } else if (type === 'SEARCH') {
        const { query, id } = payload;

        if (!query || !query.trim()) {
            postMessage({ type: 'SEARCH_DONE', payload: { id, results: tracksCache } });
            return;
        }

        const terms = query.toLowerCase().split(/\s+/).filter(Boolean);

        const results = tracksCache.filter(track => {
            return terms.every((term: string) => {
                if (term.includes(':')) {
                    const [key, val] = term.split(':');
                    if (key === 'year') {
                        const yearText = String(track.metadata?.year || '').trim().toLowerCase();
                        if (/^\d{3}0s$|^\d{4}0s$/.test(val)) {
                            const decadeStart = parseInt(val.slice(0, -1), 10);
                            const year = parseInt(yearText, 10);
                            return !Number.isNaN(year) && year >= decadeStart && year < (decadeStart + 10);
                        }
                        return yearText === val;
                    }
                    if (key === 'folder') return String(track.file?.dir || '').toLowerCase().includes(val);
                    if (key === 'format') return String(track.file?.ext || '').toLowerCase() === val;
                    if (key === 'artist') return (track.metadata?.artists || []).some(a => a.toLowerCase().includes(val));
                    if (key === 'genre') return String(track.metadata?.genre || '').toLowerCase().includes(val);
                }

                const searchableText = [
                    track.logic?.track_name,
                    track.metadata?.title,
                    track.metadata?.artists ? track.metadata.artists.join(' ') : '',
                    track.metadata?.album,
                    track.metadata?.genre,
                    track.metadata?.year,
                    track.logic?.hierarchy?.folder
                ].filter(Boolean).join(' ').toLowerCase();

                return searchableText.includes(term);
            });
        });

        postMessage({ type: 'SEARCH_DONE', payload: { id, results } });
    }
};
