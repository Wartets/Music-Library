/**
 * Formats a duration in seconds to a mm:ss string.
 * @param seconds - Total seconds
 */
export const formatDuration = (seconds?: number | string): string => {
    if (!seconds) return '0:00';
    const num = typeof seconds === 'string' ? parseFloat(seconds) : seconds;
    if (isNaN(num)) return '0:00';

    const minutes = Math.floor(num / 60);
    const remainingSeconds = Math.floor(num % 60);

    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

/**
 * Parses a mm:ss duration string into total seconds.
 * @param durationStr - String like "3:45"
 */
export const parseDuration = (durationStr?: string | null): number => {
    if (!durationStr) return 0;
    const parts = durationStr.split(':');
    if (parts.length === 2) {
        return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    }
    if (parts.length === 1) {
        return parseInt(parts[0]);
    }
    return 0;
};

/**
 * Formats an epoch timestamp to a local date string.
 * @param epoch - Timestamp
 */
export const formatDate = (epoch?: number): string => {
    if (!epoch) return 'Unknown';
    return new Date(epoch).toLocaleDateString();
};

/**
 * Formats a byte size into MB.
 * @param bytes - Size in bytes
 */
export const formatSizeMb = (bytes?: number): string => {
    if (!bytes) return '0 MB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
};

/**
 * Determines if a track is lossless based on specs.
 * @param isLossless - boolean
 */
export const getLosslessBadge = (isLossless?: boolean): string | null => {
    return isLossless ? 'LOSSLESS' : null;
};
