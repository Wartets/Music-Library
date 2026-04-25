import React from 'react';
import { ImageDetails } from '../../types/music';
import { dbService } from '../../services/db';

interface ArtworkImageProps {
    details?: ImageDetails;
    src?: string;
    alt?: string;
    className?: string;
    fallback?: React.ReactNode;
    loading?: 'lazy' | 'eager';
}

const ARTWORK_CACHE_NAME = 'music-library-artwork-v1';
const resolvedArtworkCache = new Map<string, string>();
const failedArtworkCandidates = new Set<string>();
const blobCache = new Map<string, string>();

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

const buildSrcCandidates = (pathValue: string): string[] => dbService.getAssetCandidates(pathValue);

/**
 * Parse dimensions string (e.g., "1920 x 1080") to get width and height numbers.
 * Returns null if parsing fails.
 */
const parseDimensions = (dimensions?: string): { width: number; height: number } | null => {
    if (!dimensions) return null;
    const match = dimensions.match(/(\d+)\s*x\s*(\d+)/i);
    if (match) {
        const width = parseInt(match[1], 10);
        const height = parseInt(match[2], 10);
        if (width > 0 && height > 0) {
            return { width, height };
        }
    }
    return null;
};

/**
 * Build srcset from candidates for responsive images.
 * Uses dimension hints when available for width descriptors.
 */
const buildSrcSet = (candidates: string[], dimensions?: string): string | undefined => {
    if (!candidates || candidates.length === 0) return undefined;
    
    const dims = parseDimensions(dimensions);
    if (dims) {
        // Use the primary candidate with width descriptor
        const sizeVariants = candidates.map(candidate => {
            return `${candidate} ${dims.width}w`;
        });
        return sizeVariants.join(', ');
    }
    
    return undefined;
};

/**
 * Get aspect ratio CSS value from aspect_ratio field.
 */
const getAspectRatioCSS = (aspectRatio: string | undefined): string | undefined => {
    if (!aspectRatio) return undefined;
    switch (aspectRatio) {
        case 'Square': return '1 / 1';
        case 'Landscape': return '16 / 9';
        case 'Portrait': return '3 / 4';
        default: return undefined;
    }
};

export const ArtworkImage: React.FC<ArtworkImageProps> = ({ details, src, alt = 'Artwork', className = 'w-full h-full', fallback, loading = 'lazy' }) => {
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

     const displaySrc = srcCandidates[candidateIndex] ?? null;

    // Parse dimensions and aspect ratio for responsive images and layout
    const dimensions = React.useMemo(() => parseDimensions(details?.dimensions), [details?.dimensions]);
     const aspectRatioCSS = React.useMemo(() => 
         getAspectRatioCSS(details?.aspect_ratio), 
         [details?.aspect_ratio]
     ) as string | undefined;

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

        // Check memory cache first for fastest response
        const memoryCached = blobCache.get(displaySrc);
        if (memoryCached && !cancelled) {
            setCachedSrc(memoryCached);
            blobUrlRef.current = memoryCached;
            return;
        }

        caches.open(ARTWORK_CACHE_NAME)
            .then(cache => cache.match(displaySrc))
            .then(response => response ? response.blob() : null)
            .then(blob => {
                if (!blob || cancelled) return;
                const blobUrl = URL.createObjectURL(blob);
                blobUrlRef.current = blobUrl;
                blobCache.set(displaySrc, blobUrl); // Memory cache the blob URL for instant reuse
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

    // Build srcset for responsive image delivery.
    // Keep this hook before early returns to preserve hook order across renders.
    const srcSet = React.useMemo(() => buildSrcSet(srcCandidates, details?.dimensions), [srcCandidates, details?.dimensions]);

    if (!displaySrc || hasError) {
        const fallbackSeed = (alt && alt !== 'Artwork')
            ? alt
            : (details?.name || 'Track');
        const fallbackVisual = createFallbackVisual(fallbackSeed);
        
        // Use aspect ratio when available for proper fallback layout
        const style: React.CSSProperties = { background: fallbackVisual.background };
        if (aspectRatioCSS) {
            style.aspectRatio = aspectRatioCSS as any;
        }
        
        return (
            <div
                className={`flex items-center justify-center text-white/90 overflow-hidden ${className}`}
                style={style}
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
            srcSet={srcSet}
            alt={alt}
            width={dimensions?.width}
            height={dimensions?.height}
            className={`object-cover ${className}`}
            loading={loading}
            decoding="async"
            style={aspectRatioCSS ? { aspectRatio: aspectRatioCSS as any } : undefined}
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
                                 return response.blob().then(blob => {
                                   blobCache.set(displaySrc, URL.createObjectURL(blob)); // Cache successful fetch
                                   return cache.put(displaySrc, response);
                                 });
                             });
                        })
                        .catch(() => {
                            // Ignore cache write failures.
                        });
                }
            }}
            onError={() => {
                failedArtworkCandidates.add(displaySrc);
                blobCache.delete(displaySrc); // Remove bad cache entry
                if (candidateIndex < srcCandidates.length - 1) {
                    setCandidateIndex(prev => prev + 1);
                    return;
                }
                if (cacheKey) {
                    resolvedArtworkCache.delete(cacheKey);
                    blobCache.delete(cacheKey);
                }
                setHasError(true);
            }}
        />
    );
};
