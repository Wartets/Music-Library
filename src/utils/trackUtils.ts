import type { TrackItem } from '../types/music';

export const resolveTrackVersion = (
    id: string,
    tracks: TrackItem[],
    versionToPrimaryMap: Record<string, string>
): TrackItem | undefined => {
    const trackMap = new Map(tracks.map(track => [track.logic.hash_sha256, track] as const));
    const primaryId = versionToPrimaryMap[id] || id;
    return trackMap.get(primaryId);
};
