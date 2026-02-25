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
const resolvedArtworkCache = new Map<string, string>();
const failedArtworkCandidates = new Set<string>();

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
    }, [cacheKey]);

    if (!displaySrc || hasError) {
        return (
            <div className={`flex items-center justify-center bg-white/5 text-white/20 ${className}`}>
                {fallback || (
                    <svg width="40%" height="40%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9 12v-2"></path><path d="M15 12v-2"></path><path d="M12 15v.01"></path></svg>
                )}
            </div>
        );
    }

    return (
        <img
            src={displaySrc}
            alt={alt}
            className={`object-cover ${className}`}
            loading="lazy"
            decoding="async"
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
