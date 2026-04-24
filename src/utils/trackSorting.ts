import type { TrackItem } from '../types/music';

export const sortTracksByTrackNumber = (tracks: TrackItem[]): TrackItem[] => (
    [...tracks].sort((a, b) => (a.metadata?.track_number || '0').localeCompare(b.metadata?.track_number || '0'))
);
