import React, { useCallback, useMemo, useState } from 'react';
import { useLibrary } from '../../contexts/LibraryContext';
import { usePlayer } from '../../contexts/PlayerContext';
import { persistenceService } from '../../services/persistence';
import { TrackItem } from '../../types/music';
import { Play } from 'lucide-react';
import { useItemContextMenu } from '../../hooks/useItemContextMenu';
import { parseDuration } from '../../utils/formatters';
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
        genreDistribution,
        maxGenreCount,
        totalPlaytimeMinutes,
        averageBitrate,
        totalTracks,
        totalAlbums,
        totalArtists,
        totalGenres,
        totalFolders,
        totalSizeGb,
        averageDurationMinutes,
        losslessCount,
        ratedTracksCount,
        averageRating,
        totalVersions,
        singlesCount,
        topCodec,
        averageSampleRateKhz,
        oldestYear,
        newestYear,
        historyCount,
        favoritesCount,
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

        const genres: Record<string, number> = {};
        const artistSet = new Set<string>();
        const albumSet = new Set<string>();
        const folderSet = new Set<string>();
        let totalTime = 0;
        let totalBitrate = 0;
        let bitrateCount = 0;
        let totalSizeMb = 0;
        let lossless = 0;
        let totalVersionsCount = 0;
        let singles = 0;
        let totalSampleRate = 0;
        let sampleRateCount = 0;
        const codecDist: Record<string, number> = {};
        const years: number[] = [];

        tracks.forEach(t => {
            const trackGenres = t.metadata?.genre;
            if (Array.isArray(trackGenres)) {
                trackGenres.forEach(g => genres[g] = (genres[g] || 0) + 1);
            } else if (trackGenres) {
                genres[trackGenres] = (genres[trackGenres] || 0) + 1;
            }

            const artists = t.metadata?.artists || [];
            artists.forEach(artist => {
                if (artist?.trim()) artistSet.add(artist.trim());
            });

            if (t.metadata?.album?.trim()) albumSet.add(t.metadata.album.trim());
            if (t.logic?.hierarchy?.folder?.trim()) folderSet.add(t.logic.hierarchy.folder.trim());
            if (t.logic?.is_single) singles++;
            totalVersionsCount += t.versions?.length || 1;

            if (t.audio_specs?.duration) {
                totalTime += parseDuration(t.audio_specs.duration);
            }

            if (t.audio_specs?.bitrate) {
                const val = parseInt(t.audio_specs.bitrate);
                if (!isNaN(val)) {
                    totalBitrate += val;
                    bitrateCount++;
                }
            }

            if (t.audio_specs?.sample_rate) {
                const sampleRate = parseInt(String(t.audio_specs.sample_rate).replace(/[^\d]/g, ''), 10);
                if (!isNaN(sampleRate) && sampleRate > 0) {
                    totalSampleRate += sampleRate;
                    sampleRateCount++;
                }
            }

            const codec = (t.audio_specs?.codec || t.file?.ext || 'unknown').toLowerCase();
            codecDist[codec] = (codecDist[codec] || 0) + 1;

            const year = Number(t.metadata?.year);
            if (!isNaN(year) && year > 1000) years.push(year);

            totalSizeMb += t.file?.size_mb || 0;
            if (t.audio_specs?.is_lossless) {
                lossless++;
            }
        });

        const sortedGenres = Object.entries(genres).sort((a, b) => b[1] - a[1]).slice(0, 8);
        const ratingsValues = Object.values(ratings).filter(val => val > 0);

        return {
            recentlyPlayed: recentlyPlayedTracks,
            mostPlayed: mostPlayedTracks,
            newArrivals: newArrivalsTracks,
            favorites: favoriteTracks,
            genreDistribution: sortedGenres,
            maxGenreCount: Math.max(...Object.values(genres).concat(1)),
            totalPlaytimeMinutes: Math.round(totalTime / 60),
            averageBitrate: bitrateCount > 0 ? Math.round(totalBitrate / bitrateCount) : 0,
            totalTracks: tracks.length,
            totalAlbums: albumSet.size,
            totalArtists: artistSet.size,
            totalGenres: Object.keys(genres).length,
            totalFolders: folderSet.size,
            totalSizeGb: totalSizeMb / 1024,
            averageDurationMinutes: tracks.length > 0 ? (totalTime / tracks.length) / 60 : 0,
            losslessCount: lossless,
            ratedTracksCount: ratingsValues.length,
            averageRating: ratingsValues.length > 0
                ? ratingsValues.reduce((acc, n) => acc + n, 0) / ratingsValues.length
                : 0,
            totalVersions: totalVersionsCount,
            singlesCount: singles,
            topCodec: Object.entries(codecDist).sort((a, b) => b[1] - a[1])[0]?.[0]?.toUpperCase() || '-',
            averageSampleRateKhz: sampleRateCount > 0 ? (totalSampleRate / sampleRateCount) / 1000 : 0,
            oldestYear: years.length ? Math.min(...years) : null,
            newestYear: years.length ? Math.max(...years) : null,
            historyCount: persistenceService.getHistoryIds().length,
            favoritesCount: favs.length,
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
        <div className="h-full overflow-y-auto custom-scrollbar bg-[#0a0a0a] pt-16 md:pt-24 px-3 md:px-8 pb-24 md:pb-32">
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-8 md:space-y-12">
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

                {/* Sidebar: Stats & Favorites */}
                <div className="space-y-12">
                    <section className="bg-white/2 rounded-3xl p-6 border border-white/5">
                        <h2 className="text-lg font-black tracking-tight text-white mb-6">Library Stats</h2>
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="rounded-xl border border-white/5 bg-white/5 p-3">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Tracks</div>
                                    <div className="text-lg font-black text-white mt-1">{totalTracks}</div>
                                </div>
                                <div className="rounded-xl border border-white/5 bg-white/5 p-3">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Albums</div>
                                    <div className="text-lg font-black text-white mt-1">{totalAlbums}</div>
                                </div>
                                <div className="rounded-xl border border-white/5 bg-white/5 p-3">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Artists</div>
                                    <div className="text-lg font-black text-white mt-1">{totalArtists}</div>
                                </div>
                                <div className="rounded-xl border border-white/5 bg-white/5 p-3">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Genres</div>
                                    <div className="text-lg font-black text-white mt-1">{totalGenres}</div>
                                </div>
                            </div>
                            <div className="flex justify-between items-center group">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 group-hover:text-gray-300 transition-colors">Total Playtime</span>
                                <span className="text-sm font-black text-dominant">{totalPlaytimeMinutes} min</span>
                            </div>
                            <div className="flex justify-between items-center group">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 group-hover:text-gray-300 transition-colors">Avg. Quality</span>
                                <span className="text-sm font-black text-white">{averageBitrate} kbps</span>
                            </div>
                            <div className="flex justify-between items-center group">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 group-hover:text-gray-300 transition-colors">Avg. Duration</span>
                                <span className="text-sm font-black text-white">{averageDurationMinutes.toFixed(1)} min</span>
                            </div>
                            <div className="flex justify-between items-center group">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 group-hover:text-gray-300 transition-colors">Library Size</span>
                                <span className="text-sm font-black text-white">{totalSizeGb.toFixed(2)} GB</span>
                            </div>
                            <div className="flex justify-between items-center group">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 group-hover:text-gray-300 transition-colors">Versions</span>
                                <span className="text-sm font-black text-white">{totalVersions}</span>
                            </div>
                            <div className="flex justify-between items-center group">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 group-hover:text-gray-300 transition-colors">Singles</span>
                                <span className="text-sm font-black text-white">{singlesCount}</span>
                            </div>
                            <div className="flex justify-between items-center group">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 group-hover:text-gray-300 transition-colors">Top Codec</span>
                                <span className="text-sm font-black text-white">{topCodec}</span>
                            </div>
                            <div className="flex justify-between items-center group">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 group-hover:text-gray-300 transition-colors">Avg. Sample Rate</span>
                                <span className="text-sm font-black text-white">{averageSampleRateKhz.toFixed(1)} kHz</span>
                            </div>
                            <div className="flex justify-between items-center group">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 group-hover:text-gray-300 transition-colors">Year Range</span>
                                <span className="text-sm font-black text-white">{oldestYear && newestYear ? `${oldestYear}-${newestYear}` : '-'}</span>
                            </div>
                            <div className="flex justify-between items-center group">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 group-hover:text-gray-300 transition-colors">Lossless</span>
                                <span className="text-sm font-black text-white">{losslessCount} ({totalTracks > 0 ? Math.round((losslessCount / totalTracks) * 100) : 0}%)</span>
                            </div>
                            <div className="flex justify-between items-center group">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 group-hover:text-gray-300 transition-colors">Rated Tracks</span>
                                <span className="text-sm font-black text-white">{ratedTracksCount} {ratedTracksCount > 0 ? `(${averageRating.toFixed(1)}★)` : ''}</span>
                            </div>
                            <div className="flex justify-between items-center group">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 group-hover:text-gray-300 transition-colors">Folders</span>
                                <span className="text-sm font-black text-white">{totalFolders}</span>
                            </div>
                            <div className="flex justify-between items-center group">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 group-hover:text-gray-300 transition-colors">History Entries</span>
                                <span className="text-sm font-black text-white">{historyCount}</span>
                            </div>
                            <div className="flex justify-between items-center group">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 group-hover:text-gray-300 transition-colors">Favorites</span>
                                <span className="text-sm font-black text-white">{favoritesCount}</span>
                            </div>
                            <div className="pt-4 border-t border-white/5">
                                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-600 mb-4">Genre Mix</h3>
                                <div className="space-y-3">
                                    {genreDistribution.map(([genre, count]) => (
                                        <div key={genre} className="space-y-1.5">
                                            <div className="flex justify-between text-[10px] font-bold">
                                                <span className="text-gray-400">{genre}</span>
                                                <span className="text-gray-600">{count}</span>
                                            </div>
                                            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-dominant/40 group-hover:bg-dominant transition-all duration-1000"
                                                    style={{ width: `${(count / maxGenreCount) * 100}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </section>

                    {favorites.length > 0 && (
                        <section>
                            <div className="flex items-end justify-between mb-6 px-2">
                                <h2 className="text-lg font-black tracking-tight text-white">Favorites</h2>
                                <button onClick={() => onNavigate('Favorites')} className="text-[10px] font-bold text-gray-500 hover:text-white transition-colors">See All</button>
                            </div>
                            <div className="space-y-2">
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
                </div>
            </div>
        </div>
    );
};
