const GITHUB_OWNER = 'Wartets';
const GITHUB_REPOSITORY = 'Music-Library';
const GITHUB_BRANCH = 'main';

const GITHUB_RAW_BASE_URL = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPOSITORY}/${GITHUB_BRANCH}`;
const ABSOLUTE_URL_REGEX = /^[a-z][a-z0-9+.-]*:\/\//i;
const BASE_URL = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '') || '/';

const toPosixPath = (value: string): string => value.replace(/\\/g, '/').replace(/\/+/g, '/').trim();

const stripFileScheme = (value: string): string => value.replace(/^file:\/\//i, '');

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

const normalizeRepositoryRelativePath = (inputPath: string): string => {
    if (!inputPath) return '';

    const stripped = stripFileScheme(inputPath).trim();
    if (!stripped) return '';
    if (ABSOLUTE_URL_REGEX.test(stripped)) return stripped;

    let normalized = toPosixPath(stripped);

    const repoAnchorIndex = normalized.toLowerCase().indexOf('/music-library/');
    if (repoAnchorIndex >= 0) {
        normalized = normalized.slice(repoAnchorIndex + '/music-library/'.length);
    }

    normalized = normalized.replace(/^[A-Za-z]:\//, '').replace(/^\/+/, '');

    const collectionAnchor = normalized.match(/(Album\s+\d[^/]*|Single|save)\/.*$/i);
    if (collectionAnchor) {
        normalized = collectionAnchor[0];
    }

    return normalized.replace(/^\/+/, '');
};

export const resolveAssetCandidates = (assetPath: string, includeLocalFallback: boolean = true): string[] => {
    const normalized = normalizeRepositoryRelativePath(assetPath);
    if (!normalized) return [];
    if (ABSOLUTE_URL_REGEX.test(normalized)) return [normalized];

    const encodedPath = toEncodedUrlPath(normalized);
    const candidates = [`${GITHUB_RAW_BASE_URL}/${encodedPath}`];

    if (includeLocalFallback) {
        if (BASE_URL !== '/') {
            candidates.push(`${BASE_URL}/${encodedPath}`);
        }
        candidates.push(`/${encodedPath}`);
    }

    return Array.from(new Set(candidates));
};

export const resolvePreferredAssetUrl = (assetPath: string): string => {
    return resolveAssetCandidates(assetPath)[0] || '';
};

export const resolveRepositoryRelativePath = normalizeRepositoryRelativePath;
