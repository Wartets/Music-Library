import React, { useCallback, useMemo, useState } from 'react';
import { useLibrary } from '../../contexts/LibraryContext';
import { usePlayer } from '../../contexts/PlayerContext';
import { persistenceService } from '../../services/persistence';
import { TrackItem } from '../../types/music';
import { Play } from 'lucide-react';
import { useItemContextMenu } from '../../hooks/useItemContextMenu';
import { ViewType } from '../layout/AppLayout';
import { TrackRow } from '../shared/TrackRow';
import { TrackCard } from '../shared/TrackCard';
import { resolveHistoryTracks } from '../../utils/historyUtils';
import { resolveTrackVersion } from '../../utils/trackUtils';
import { EmptyState } from '../shared/EmptyState';

interface DashboardViewProps {
    onNavigate: (view: ViewType, data?: any) => void;
}

const normalizeEpochToSeconds = (value?: number | null): number => {
    if (!value || !Number.isFinite(value) || value <= 0) return 0;
    // Support either seconds or milliseconds inputs.
    return value > 1_000_000_000_000 ? Math.floor(value / 1000) : Math.floor(value);
};

const getTrackCreatedEpochSeconds = (track: TrackItem): number => {
    const epochCreated = normalizeEpochToSeconds(track.file?.epoch_created);
    if (epochCreated > 0) return epochCreated;

    const createdRaw = track.file?.created;
    if (!createdRaw) return 0;

    const parsed = Date.parse(createdRaw);
    return Number.isNaN(parsed) ? 0 : Math.floor(parsed / 1000);
};

const getTrackRenderKey = (prefix: string, track: TrackItem, index: number): string => {
    const hash = track.logic?.hash_sha256;
    if (hash && hash !== 'null' && hash !== 'undefined') {
        return `${prefix}-${hash}`;
    }

    const fallbackIdentity = track.file?.path || `${track.logic?.track_name || 'track'}-${track.metadata?.title || 'untitled'}`;
    return `${prefix}-${fallbackIdentity}-${index}`;
};

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
    const { state: libraryState } = useLibrary();
    const { playTrack, state: playerState } = usePlayer();
    const { openItemContextMenu } = useItemContextMenu<TrackItem>();
    const [visibleCounts, setVisibleCounts] = useState({ recentlyPlayed: 8, newArrivals: 8 });

    const handleContextMenu = useCallback((e: React.MouseEvent, track: TrackItem, list: TrackItem[]) => {
        openItemContextMenu(e, track, list, onNavigate);
    }, [onNavigate, openItemContextMenu]);

    const {
        recentlyPlayed,
        mostPlayed,
        newArrivals,
        favorites,
        totalTracks,
        ratings
    } = useMemo(() => {
        const tracks = libraryState.tracks;
        const favs = persistenceService.getFavorites();
        const playCounts = persistenceService.getAllPlayCounts();
        const ratings = persistenceService.getAllRatings();
        const { versionToPrimaryMap } = libraryState;
        const recentlyPlayedTracks = resolveHistoryTracks(tracks, versionToPrimaryMap).slice(0, 10);

        const mostPlayedTracks = Object.entries(playCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(entry => resolveTrackVersion(entry[0], tracks, versionToPrimaryMap))
            .filter((t): t is TrackItem => !!t);

        const newArrivalsTracks = tracks
            .filter(t => getTrackCreatedEpochSeconds(t) > 0)
            .sort((a, b) => getTrackCreatedEpochSeconds(b) - getTrackCreatedEpochSeconds(a))
            .slice(0, 20);

        const favoriteTracks = favs
            .map(id => resolveTrackVersion(id, tracks, versionToPrimaryMap))
            .filter((t): t is TrackItem => !!t)
            .slice(0, 10);

        return {
            recentlyPlayed: recentlyPlayedTracks,
            mostPlayed: mostPlayedTracks,
            newArrivals: newArrivalsTracks,
            favorites: favoriteTracks,
            totalTracks: tracks.length,
            ratings
        };
    }, [libraryState.tracks, libraryState.versionToPrimaryMap]);

    const visibleRecentlyPlayed = useMemo(
        () => recentlyPlayed.slice(0, visibleCounts.recentlyPlayed),
        [recentlyPlayed, visibleCounts.recentlyPlayed]
    );

    const visibleNewArrivals = useMemo(
        () => newArrivals.slice(0, visibleCounts.newArrivals),
        [newArrivals, visibleCounts.newArrivals]
    );

    return (
        <div className="h-full overflow-y-auto custom-scrollbar bg-[#0a0a0a] pt-0 md:pt-24 px-3 md:px-8 pb-24 md:pb-32">
            {/* Welcome Header for New Users */}
            {totalTracks === 0 && (
                <div className="mb-8 p-6 md:p-8 rounded-3xl bg-gradient-to-br from-dominant/20 via-dominant/10 to-transparent border border-dominant/20">
                    <h1 className="text-2xl md:text-4xl font-black tracking-tighter text-white mb-2">
                        Welcome to Your Music Library
                    </h1>
                    <p className="text-gray-400 text-sm md:text-base mb-6 max-w-xl">
                        Start by adding your music folder. Your tracks will appear here with detailed stats and easy navigation.
                    </p>
                    <button 
                        onClick={() => onNavigate('Settings', { tab: 'maintenance' })}
                        className="px-6 py-3 bg-dominant text-on-dominant rounded-xl font-black uppercase tracking-widest text-xs hover:bg-dominant-light transition-colors"
                    >
                        Add Music Folder
                    </button>
                </div>
            )}

            {/* Quick Actions - Always Visible */}
            {totalTracks > 0 && (
                <div className="mb-6 flex flex-wrap gap-2">
                    <button 
                        onClick={() => onNavigate('AllTracks')}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-colors"
                    >
                        All Tracks
                    </button>
                    <button 
                        onClick={() => onNavigate('Albums')}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-colors"
                    >
                        Albums
                    </button>
                    <button 
                        onClick={() => onNavigate('Artists')}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-colors"
                    >
                        Artists
                    </button>
                    <button 
                        onClick={() => onNavigate('Playlists')}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-colors"
                    >
                        Playlists
                    </button>
                    <button 
                        onClick={() => onNavigate('Favorites')}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-colors"
                    >
                        Favorites
                    </button>
                </div>
            )}

            <div className="space-y-8 md:space-y-12">
                {/* Recently Played - Only show if there are tracks */}
                {recentlyPlayed.length > 0 && (
                    <section>
                        <div className="flex items-end justify-between mb-6">
                            <h2 className="text-xl md:text-2xl font-black tracking-tighter text-white">Recently Played</h2>
                            <button onClick={() => onNavigate('DetailedHistory')} className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-gray-400 hover:text-dominant transition-colors">View All History</button>
                        </div>
                        <div className="flex gap-4 md:gap-6 overflow-x-auto pb-4 custom-scrollbar-horizontal no-scrollbar">
                            {visibleRecentlyPlayed.map((track, i) => (
                                <TrackCard
                                    key={getTrackRenderKey('recent', track, i)}
                                    track={track}
                                    list={recentlyPlayed}
                                    query={libraryState.searchQuery}
                                    isPlaying={playerState.currentTrack?.logic.hash_sha256 === track.logic.hash_sha256}
                                    onPlay={(t, list) => playTrack(t, list || recentlyPlayed)}
                                    onContextMenu={(e, t, list) => handleContextMenu(e, t, list || recentlyPlayed)}
                                />
                            ))}
                        </div>
                        {visibleRecentlyPlayed.length < recentlyPlayed.length && (
                            <button
                                onClick={() => setVisibleCounts(prev => ({ ...prev, recentlyPlayed: prev.recentlyPlayed + 8 }))}
                                className="mt-1 px-4 py-2 min-h-11 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-gray-300 hover:text-white hover:bg-white/10 active:scale-95 transition-transform"
                            >
                                Load more
                            </button>
                        )}
                    </section>
                )}

                {/* Most Played - Only show if there are tracks */}
                {mostPlayed.length > 0 && (
                    <section>
                        <div className="flex items-end justify-between mb-6">
                            <h2 className="text-xl md:text-2xl font-black tracking-tighter text-white">Most Played</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 md:gap-x-10 gap-y-2">
                            {mostPlayed.map((track, i) => (
                                <TrackRow
                                    key={getTrackRenderKey('most', track, i)}
                                    track={track}
                                    list={mostPlayed}
                                    index={i}
                                    isPlaying={playerState.currentTrack?.logic.hash_sha256 === track.logic.hash_sha256}
                                    query={libraryState.searchQuery}
                                    onPlay={(t) => playTrack(t, mostPlayed)}
                                    onContextMenu={(e, t) => handleContextMenu(e, t, mostPlayed)}
                                    showRating={false}
                                />
                            ))}
                        </div>
                    </section>
                )}

                {/* Show New Arrivals if available, otherwise show recently added */}
                {newArrivals.length > 0 && (
                    <section>
                        <div className="flex items-end justify-between mb-6">
                            <h2 className="text-xl md:text-2xl font-black tracking-tighter text-white">Recently Added</h2>
                        </div>
                        <div className="flex gap-4 md:gap-6 overflow-x-auto pb-4 custom-scrollbar-horizontal no-scrollbar">
                            {visibleNewArrivals.map((track, i) => (
                                <TrackCard
                                    key={getTrackRenderKey('new', track, i)}
                                    track={track}
                                    list={newArrivals}
                                    query={libraryState.searchQuery}
                                    isPlaying={playerState.currentTrack?.logic.hash_sha256 === track.logic.hash_sha256}
                                    onPlay={(t, list) => playTrack(t, list || newArrivals)}
                                    onContextMenu={(e, t, list) => handleContextMenu(e, t, list || newArrivals)}
                                />
                            ))}
                        </div>
                        {visibleNewArrivals.length < newArrivals.length && (
                            <button
                                onClick={() => setVisibleCounts(prev => ({ ...prev, newArrivals: prev.newArrivals + 8 }))}
                                className="mt-1 px-4 py-2 min-h-11 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-gray-300 hover:text-white hover:bg-white/10 active:scale-95 transition-transform"
                            >
                                Load more
                            </button>
                        )}
                    </section>
                )}

                {favorites.length > 0 && (
                    <section>
                        <div className="flex items-end justify-between mb-6">
                            <h2 className="text-xl md:text-2xl font-black tracking-tighter text-white">Favorites</h2>
                            <button onClick={() => onNavigate('Favorites')} className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-gray-400 hover:text-dominant transition-colors">See All</button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 md:gap-x-10 gap-y-2">
                            {favorites.map((track, i) => (
                                <TrackRow
                                    key={getTrackRenderKey('fav', track, i)}
                                    track={track}
                                    list={favorites}
                                    index={i}
                                    isPlaying={playerState.currentTrack?.logic.hash_sha256 === track.logic.hash_sha256}
                                    query={libraryState.searchQuery}
                                    rating={ratings[track.logic.hash_sha256] || 0}
                                    showRating
                                    showCollection={false}
                                    onPlay={(t) => playTrack(t, favorites)}
                                    onContextMenu={(e, t) => handleContextMenu(e, t, favorites)}
                                />
                            ))}
                        </div>
                    </section>
                )}

                {/* Empty State Content for Returning Users with No History */}
                {totalTracks > 0 && recentlyPlayed.length === 0 && mostPlayed.length === 0 && newArrivals.length === 0 && (
                    <section className="py-8">
                        <EmptyState
                            icon={<Play size={24} />}
                            title="Start Listening"
                            subtitle="Play some music from your library to see it here."
                            className="min-h-[18rem]"
                            titleClassName="text-xl font-black text-white mb-2"
                            subtitleClassName="text-sm text-gray-500"
                            action={
                                <button
                                    onClick={() => onNavigate('AllTracks')}
                                    className="px-6 py-3 bg-dominant text-on-dominant rounded-xl font-black uppercase tracking-widest text-xs"
                                >
                                    Browse Library
                                </button>
                            }
                        />
                    </section>
                )}
            </div>
        </div>
    );
};
