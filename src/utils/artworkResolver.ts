import type { ImageDetails, TrackItem } from '../types/music';

type ArtworkTrackLike = {
    artworks?: TrackItem['artworks'];
    versions?: Array<{
        artworks?: TrackItem['artworks'];
    }>;
};

export const getBestArtwork = (track?: ArtworkTrackLike | null): ImageDetails | undefined => {
    if (!track) return undefined;

    const fromTrack = track.artworks?.track_artwork?.[0] || track.artworks?.album_artwork?.[0];
    if (fromTrack) {
        return fromTrack;
    }

    if (!track.versions?.length) {
        return undefined;
    }

    for (const version of track.versions) {
        const fromVersion = version.artworks?.track_artwork?.[0] || version.artworks?.album_artwork?.[0];
        if (fromVersion) {
            return fromVersion;
        }
    }

    return undefined;
};
