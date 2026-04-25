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

const resolvedArtworkCache = new Map<string, string>();
const failedArtworkCandidates = new Set<string>();
const ABSOLUTE_OR_EMBEDDED_SRC_REGEX = /^(?:[a-z][a-z0-9+.-]*:\/\/|data:|blob:)/i;

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

const buildInputCandidates = (rawSrc?: string, detailsPath?: string): string[] => {
    if (rawSrc) {
        const normalizedSrc = rawSrc.trim();
        if (!normalizedSrc) return [];
        if (ABSOLUTE_OR_EMBEDDED_SRC_REGEX.test(normalizedSrc)) {
            return [normalizedSrc];
        }
        return buildSrcCandidates(normalizedSrc);
    }

    if (detailsPath) {
        return buildSrcCandidates(detailsPath);
    }

    return [];
};

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
    const cacheKey = src || details?.path || '';

    const srcCandidates = React.useMemo(() => {
        const rawCandidates = buildInputCandidates(src, details?.path);

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
    }, [cacheKey]);


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
            src={displaySrc}
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
