import React from 'react';
import { ImageDetails } from '../../types/music';

interface ArtworkImageProps {
    details?: ImageDetails;
    src?: string;
    alt?: string;
    className?: string;
    fallback?: React.ReactNode;
}

const ABSOLUTE_URL_REGEX = /^[a-z][a-z0-9+.-]*:\/\//i;
const BASE_URL = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '') || '/';
const ARTWORK_CACHE_NAME = 'music-library-artwork-v1';
const resolvedArtworkCache = new Map<string, string>();
const failedArtworkCandidates = new Set<string>();

const hashText = (value: string): number => {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
        hash = ((hash << 5) - hash) + value.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
};

const createFallbackVisual = (seedText: string) => {
    const seed = hashText(seedText || 'track');
    const hue = seed % 360;
    const background = `linear-gradient(145deg, hsla(${hue}, 38%, 38%, 0.9), hsla(${(hue + 28) % 360}, 32%, 24%, 0.92))`;
    const letter = (seedText.match(/[\p{L}\p{N}]/u)?.[0] || '?').toUpperCase();
    return { background, letter };
};

const safeEncodeSegment = (segment: string): string => {
    if (!segment) return segment;
    try {
        return encodeURIComponent(decodeURIComponent(segment)).replace(/%3A/g, ':');
    } catch {
        return encodeURIComponent(segment).replace(/%3A/g, ':');
    }
};

const toEncodedUrlPath = (pathValue: string): string => {
    return pathValue
        .split('/')
        .map((segment, index) => {
            if (index === 0 && segment === '') return '';
            return safeEncodeSegment(segment);
        })
        .join('/');
};

const buildSrcCandidates = (pathValue: string): string[] => {
    const normalizedRaw = pathValue.replace(/^file:\/\//i, '').replace(/\\/g, '/').trim();
    if (!normalizedRaw) return [];
    if (ABSOLUTE_URL_REGEX.test(normalizedRaw)) return [normalizedRaw];

    const relativeCandidates = new Set<string>();
    const finalCandidates = new Set<string>();

    const addRelativeCandidate = (candidate: string) => {
        const sanitized = candidate.trim().replace(/\\/g, '/').replace(/^\/+/, '');
        if (!sanitized) return;
        relativeCandidates.add(sanitized);
    };

    const addFinalCandidate = (candidate: string) => {
        if (!candidate) return;
        finalCandidates.add(candidate);
    };

    addRelativeCandidate(normalizedRaw);

    const withoutDrive = normalizedRaw.replace(/^[A-Za-z]:\//, '');
    if (withoutDrive !== normalizedRaw) {
        addRelativeCandidate(withoutDrive);
    }

    const libraryAnchorMatch = normalizedRaw.match(/\/(Album\s+\d[^/]*|Single|save)\/.*/i);
    if (libraryAnchorMatch) {
        addRelativeCandidate(libraryAnchorMatch[0]);
    }

    const repoAnchor = '/Music-Library/';
    const repoAnchorIndex = normalizedRaw.toLowerCase().indexOf(repoAnchor.toLowerCase());
    if (repoAnchorIndex >= 0) {
        const relToRepo = normalizedRaw.slice(repoAnchorIndex + repoAnchor.length);
        addRelativeCandidate(relToRepo);
    }

    relativeCandidates.forEach((relativePath) => {
        const encodedRelative = toEncodedUrlPath(relativePath);
        addFinalCandidate(`/${encodedRelative}`);
        if (BASE_URL !== '/') {
            addFinalCandidate(`${BASE_URL}/${encodedRelative}`);
        }
    });

    if (normalizedRaw.startsWith('/')) {
        addFinalCandidate(toEncodedUrlPath(normalizedRaw));
    }

    return Array.from(finalCandidates);
};

export const ArtworkImage: React.FC<ArtworkImageProps> = ({ details, src, alt = 'Artwork', className = 'w-full h-full', fallback }) => {
    const [hasError, setHasError] = React.useState(false);
    const [candidateIndex, setCandidateIndex] = React.useState(0);
    const [cachedSrc, setCachedSrc] = React.useState<string | null>(null);
    const blobUrlRef = React.useRef<string | null>(null);
    const cacheKey = src || details?.path || '';

    const srcCandidates = React.useMemo(() => {
        const rawCandidates = src
            ? [src]
            : details?.path
                ? buildSrcCandidates(details.path)
                : [];

        const availableCandidates = rawCandidates.filter(candidate => !failedArtworkCandidates.has(candidate));
        const cachedCandidate = cacheKey ? resolvedArtworkCache.get(cacheKey) : undefined;

        if (cachedCandidate && availableCandidates.includes(cachedCandidate)) {
            return [cachedCandidate, ...availableCandidates.filter(candidate => candidate !== cachedCandidate)];
        }

        return availableCandidates;
    }, [src, details?.path, cacheKey]);

    const displaySrc = srcCandidates[candidateIndex] || null;

    React.useEffect(() => {
        setHasError(false);
        setCandidateIndex(0);
        setCachedSrc(null);
    }, [cacheKey]);

    React.useEffect(() => {
        let cancelled = false;

        if (!displaySrc || typeof window === 'undefined' || !('caches' in window)) {
            return () => {
                cancelled = true;
                if (blobUrlRef.current) {
                    URL.revokeObjectURL(blobUrlRef.current);
                    blobUrlRef.current = null;
                }
            };
        }

        if (blobUrlRef.current) {
            URL.revokeObjectURL(blobUrlRef.current);
            blobUrlRef.current = null;
        }

        caches.open(ARTWORK_CACHE_NAME)
            .then(cache => cache.match(displaySrc))
            .then(response => response ? response.blob() : null)
            .then(blob => {
                if (!blob || cancelled) return;
                const blobUrl = URL.createObjectURL(blob);
                blobUrlRef.current = blobUrl;
                setCachedSrc(blobUrl);
            })
            .catch(() => {
                // Ignore cache read failures and continue with network source.
            });

        return () => {
            cancelled = true;
            if (blobUrlRef.current) {
                URL.revokeObjectURL(blobUrlRef.current);
                blobUrlRef.current = null;
            }
        };
    }, [displaySrc]);

    if (!displaySrc || hasError) {
        const fallbackSeed = (alt && alt !== 'Artwork')
            ? alt
            : (details?.name || 'Track');
        const fallbackVisual = createFallbackVisual(fallbackSeed);
        return (
            <div
                className={`flex items-center justify-center text-white/90 ${className}`}
                style={{ background: fallbackVisual.background }}
            >
                {fallback || (
                    <span className="text-2xl font-black tracking-tight select-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.4)]">
                        {fallbackVisual.letter}
                    </span>
                )}
            </div>
        );
    }

    return (
        <img
            src={cachedSrc || displaySrc}
            alt={alt}
            className={`object-cover ${className}`}
            loading="lazy"
            decoding="async"
            onLoad={() => {
                if (cacheKey) {
                    resolvedArtworkCache.set(cacheKey, displaySrc);
                }

                if (displaySrc && typeof window !== 'undefined' && 'caches' in window) {
                    caches.open(ARTWORK_CACHE_NAME)
                        .then(cache => cache.match(displaySrc).then(match => ({ cache, match })))
                        .then(({ cache, match }) => {
                            if (match) return;
                            return fetch(displaySrc, { cache: 'force-cache' }).then(response => {
                                if (!response.ok) return;
                                return cache.put(displaySrc, response.clone());
                            });
                        })
                        .catch(() => {
                            // Ignore cache write failures.
                        });
                }
            }}
            onError={() => {
                failedArtworkCandidates.add(displaySrc);
                if (candidateIndex < srcCandidates.length - 1) {
                    setCandidateIndex(prev => prev + 1);
                    return;
                }
                if (cacheKey) {
                    resolvedArtworkCache.delete(cacheKey);
                }
                setHasError(true);
            }}
        />
    );
};
