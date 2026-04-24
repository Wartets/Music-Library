import { TrackItem } from '../types/music';
import { isPathWithin, normalizePath } from '../utils/pathUtils';

// Configuration for search behavior
interface WorkerConfig {
    advancedOperators: boolean;
    fieldWeights?: {
        title: number;
        artist: number;
        album: number;
        genre: number;
        year: number;
        format: number;
    };
}

// A simple in-memory store for the worker
let tracksCache: TrackItem[] = [];
let workerConfig: WorkerConfig = {
    advancedOperators: true,
    fieldWeights: {
        title: 1.0,
        artist: 0.9,
        album: 0.8,
        genre: 0.7,
        year: 0.6,
        format: 0.5
    }
};

/**
 * Tokenizes query string respecting quotes and operators
 */
const tokenizeQuery = (query: string): string[] => {
    return (query.match(/(?:[^\s"]+|"[^"]*")+/g) || [])
        .map(token => token.trim())
        .filter(Boolean);
};

/**
 * Parse filter token like "artist:Miles Davis"
 */
const parseFilterToken = (token: string): { key: string; value: string } | null => {
    const separatorIndex = token.indexOf(':');
    if (separatorIndex <= 0) {
        return null;
    }

    const rawKey = token.slice(0, separatorIndex).toLowerCase();
    let rawValue = token.slice(separatorIndex + 1).trim();
    if (!rawValue) {
        return null;
    }

    if (rawValue.startsWith('"') && rawValue.endsWith('"') && rawValue.length >= 2) {
        rawValue = rawValue.slice(1, -1);
    }

    return {
        key: rawKey,
        value: rawValue.toLowerCase()
    };
};

/**
 * Calculate relevance score for a track against a search term
 * Uses field weights to boost relevance of matches in important fields
 */
const calculateRelevance = (track: TrackItem, term: string): number => {
    if (!term) return 0;
    
    const weights = workerConfig.fieldWeights || {
        title: 1,
        artist: 1,
        album: 1,
        genre: 1,
        year: 1,
        format: 1
    };
    let score = 0;

    // Exact field matches get highest scores
    const title = (track.metadata?.title || track.logic?.track_name || '').toLowerCase();
    if (title === term) score += 100 * (weights.title ?? 1);
    else if (title.includes(term)) score += 50 * (weights.title ?? 1);

    const artists = (track.metadata?.artists || []).join(' ').toLowerCase();
    if (artists === term) score += 90 * (weights.artist ?? 1);
    else if (artists.includes(term)) score += 45 * (weights.artist ?? 1);

    const album = (track.metadata?.album || '').toLowerCase();
    if (album === term) score += 80 * (weights.album ?? 1);
    else if (album.includes(term)) score += 40 * (weights.album ?? 1);

    const genre = String(track.metadata?.genre || '').toLowerCase();
    if (genre === term) score += 70 * (weights.genre ?? 1);
    else if (genre.includes(term)) score += 35 * (weights.genre ?? 1);

    const year = String(track.metadata?.year || '').toLowerCase();
    if (year === term) score += 60 * (weights.year ?? 1);
    else if (year.includes(term)) score += 30 * (weights.year ?? 1);

    const format = String(track.file?.ext || '').toLowerCase();
    if (format === term) score += 50 * (weights.format ?? 1);
    else if (format.includes(term)) score += 25 * (weights.format ?? 1);

    return score;
};

/**
 * Check if a track matches a single query term (respects field filters)
 */
const matchesTerm = (track: TrackItem, term: string): boolean => {
    const filter = parseFilterToken(term);
    if (filter) {
        const { key, value: val } = filter;
        if (key === 'year') {
            const yearText = String(track.metadata?.year || '').trim().toLowerCase();
            if (/^\d{3}0s$|^\d{4}0s$/.test(val)) {
                const decadeStart = parseInt(val.slice(0, -1), 10);
                const year = parseInt(yearText, 10);
                return !Number.isNaN(year) && year >= decadeStart && year < (decadeStart + 10);
            }
            return yearText === val;
        }
        if (key === 'folder') {
            const trackFolder = normalizePath(track.file?.dir || '').toLowerCase();
            const requestedFolder = normalizePath(val).toLowerCase();
            return isPathWithin(requestedFolder, trackFolder);
        }
        if (key === 'format') return String(track.file?.ext || '').toLowerCase() === val;
        if (key === 'artist') return (track.metadata?.artists || []).some(a => a.toLowerCase().includes(val));
        if (key === 'genre') return String(track.metadata?.genre || '').toLowerCase().includes(val);
        if (key === 'album') return (track.metadata?.album || '').toLowerCase().includes(val);
    }

    // Generic search across all searchable fields
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
};

/**
 * Parse and evaluate advanced query with operators (AND, OR, NOT)
 * Grammar:
 *   - "term1 term2" or "term1 AND term2" = both must match (intersection)
 *   - "term1 OR term2" = either matches (union)
 *   - "NOT term" = excludes matches
 */
interface QueryNode {
    type: 'AND' | 'OR' | 'NOT' | 'TERM';
    value?: string;
    children?: QueryNode[];
}

const parseAdvancedQuery = (tokens: string[]): QueryNode | null => {
    if (tokens.length === 0) return null;

    // Simple parser: handle OR (lowest precedence), then AND, then NOT (highest)
    // Find OR operators first
    let orIndex = -1;
    for (let i = 0; i < tokens.length; i++) {
        if (tokens[i].toUpperCase() === 'OR') {
            orIndex = i;
            break;
        }
    }

    if (orIndex >= 0) {
        const left = parseAdvancedQuery(tokens.slice(0, orIndex));
        const right = parseAdvancedQuery(tokens.slice(orIndex + 1));
        if (left && right) {
            return { type: 'OR', children: [left, right] };
        }
    }

    // Find NOT operators
    let notIndex = -1;
    for (let i = 0; i < tokens.length; i++) {
        if (tokens[i].toUpperCase() === 'NOT') {
            notIndex = i;
            break;
        }
    }

    if (notIndex >= 0) {
        const operand = parseAdvancedQuery(tokens.slice(notIndex + 1));
        if (operand) {
            return { type: 'NOT', children: [operand] };
        }
    }

    // Find AND operators or implicit AND
    let andIndex = -1;
    for (let i = 0; i < tokens.length; i++) {
        if (tokens[i].toUpperCase() === 'AND') {
            andIndex = i;
            break;
        }
    }

    if (andIndex >= 0) {
        const left = parseAdvancedQuery(tokens.slice(0, andIndex));
        const right = parseAdvancedQuery(tokens.slice(andIndex + 1));
        if (left && right) {
            return { type: 'AND', children: [left, right] };
        }
    }

    // If we have multiple tokens and no operators, treat as implicit AND
    if (tokens.length > 1) {
        const left = { type: 'TERM' as const, value: tokens[0] };
        const right = parseAdvancedQuery(tokens.slice(1));
        if (right) {
            return { type: 'AND', children: [left, right] };
        }
    }

    // Single term
    return { type: 'TERM', value: tokens[0] };
};

/**
 * Evaluate query node against a track
 */
const evaluateQueryNode = (node: QueryNode | null, track: TrackItem): boolean => {
    if (!node) return true;

    switch (node.type) {
        case 'TERM':
            return node.value ? matchesTerm(track, node.value) : true;
        case 'AND':
            return node.children ? node.children.every(child => evaluateQueryNode(child, track)) : true;
        case 'OR':
            return node.children ? node.children.some(child => evaluateQueryNode(child, track)) : false;
        case 'NOT':
            return node.children ? !evaluateQueryNode(node.children[0], track) : true;
        default:
            return true;
    }
};

self.onmessage = (e: MessageEvent) => {
    const { type, payload, config } = e.data;

    if (type === 'CONFIG_UPDATE') {
        workerConfig = { ...workerConfig, ...config };
        return;
    }

    if (type === 'INIT') {
        tracksCache = payload || [];
        if (config) {
            workerConfig = { ...workerConfig, ...config };
        }
        postMessage({ type: 'INIT_DONE' });
    } else if (type === 'SEARCH') {
        const { query, id } = payload;

        if (!query || !query.trim()) {
            postMessage({ type: 'SEARCH_DONE', payload: { id, results: tracksCache } });
            return;
        }

        const tokens = tokenizeQuery(query.toLowerCase());
        
        // Parse advanced query if operators are enabled
        let queryNode: QueryNode | null = null;
        if (workerConfig.advancedOperators) {
            queryNode = parseAdvancedQuery(tokens);
        } else {
            // Fallback to simple AND logic (all terms must match)
            if (tokens.length > 0) {
                queryNode = { type: 'AND', children: tokens.map(t => ({ type: 'TERM' as const, value: t })) };
            }
        }

        // Filter and score results
        const resultsWithScores = tracksCache
            .filter(track => evaluateQueryNode(queryNode, track))
            .map(track => {
                // Calculate relevance score for sorting
                let score = 0;
                tokens.forEach(token => {
                    score += calculateRelevance(track, token);
                });
                return { track, score };
            });

        // Sort by relevance (highest first)
        const results = resultsWithScores
            .sort((a, b) => b.score - a.score)
            .map(item => item.track);

        postMessage({ type: 'SEARCH_DONE', payload: { id, results } });
    }
};
