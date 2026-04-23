import React, { useMemo } from 'react';
import { useLibrary } from '../../contexts/LibraryContext';
import { usePlayer } from '../../contexts/PlayerContext';
import { persistenceService } from '../../services/persistence';
import { TrackItem } from '../../types/music';
import { Play } from 'lucide-react';
import { useTrackContextMenu } from '../../hooks/useTrackContextMenu';
import { parseDuration } from '../../utils/formatters';

import { ViewType } from '../layout/AppLayout';
import { ArtworkImage } from '../shared/ArtworkImage';
import { TrackRow } from '../shared/TrackRow';

const HighlightText: React.FC<{ text: string, query: string }> = ({ text, query }) => {
    if (!query.trim()) return <>{text}</>;
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return (
        <>
            {parts.map((part, i) =>
                part.toLowerCase() === query.toLowerCase() ? (
                    <mark key={i} className="bg-dominant/30 text-white rounded-sm px-0.5">{part}</mark>
                ) : (
                    part
                )
            )}
        </>
    );
};

interface DashboardViewProps {
    onNavigate: (view: ViewType, data?: any) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
    const { state: libraryState } = useLibrary();
    const { playTrack, state: playerState } = usePlayer();
    const { openTrackContextMenu } = useTrackContextMenu();

    const handleContextMenu = (e: React.MouseEvent, track: TrackItem, list: TrackItem[]) => {
        openTrackContextMenu(e, track, list, onNavigate);
    };

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
        favoritesCount
    } = useMemo(() => {
        const tracks = libraryState.tracks;
        const historyIds = persistenceService.getHistoryIds();
        const favs = persistenceService.getFavorites();
        const playCounts = persistenceService.getAllPlayCounts();
        const ratings = persistenceService.getAllRatings();

        // Statistical calculations
        const { versionToPrimaryMap } = libraryState;

        const recentlyPlayedTracks = historyIds.slice(0, 10)
            .map(id => {
                const primaryId = versionToPrimaryMap[id] || id;
                return tracks.find(t => t.logic.hash_sha256 === primaryId);
            })
            .filter((t): t is TrackItem => !!t);

        const mostPlayedTracks = Object.entries(playCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(entry => {
                const primaryId = versionToPrimaryMap[entry[0]] || entry[0];
                return tracks.find(t => t.logic.hash_sha256 === primaryId);
            })
            .filter((t): t is TrackItem => !!t);

        const sixMonthsAgo = (Date.now() / 1000) - (6 * 30 * 24 * 3600);
        const newArrivalsTracks = tracks
            .filter(t => (t.file?.epoch_created || 0) > sixMonthsAgo)
            .sort((a, b) => (b.file?.epoch_created || 0) - (a.file?.epoch_created || 0))
            .slice(0, 20);

        const favoriteTracks = favs
            .map(id => {
                const primaryId = versionToPrimaryMap[id] || id;
                return tracks.find(t => t.logic.hash_sha256 === primaryId);
            })
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
            historyCount: historyIds.length,
            favoritesCount: favs.length
        };
    }, [libraryState.tracks, playerState.history]);

    const TrackCard = ({ track, list }: { track: TrackItem, list: TrackItem[] }) => {
        const isPlaying = playerState.currentTrack?.logic.hash_sha256 === track.logic.hash_sha256;

        return (
            <div
                className="flex-shrink-0 w-40 group cursor-pointer"
                onClick={() => playTrack(track, list)}
                onContextMenu={(e) => handleContextMenu(e, track, list)}
            >
                <div className="relative aspect-square rounded-2xl overflow-hidden mb-3 shadow-xl group-hover:shadow-dominant/20 transition-all duration-500 bg-white/5 border border-white/5 group-hover:border-dominant/20">
                    <ArtworkImage details={track.artworks?.track_artwork?.[0] || track.artworks?.album_artwork?.[0]} alt={track.metadata?.title || track.logic.track_name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                        <div className="w-12 h-12 rounded-full bg-dominant text-black flex items-center justify-center transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500 shadow-xl">
                            <Play size={20} fill="currentColor" />
                        </div>
                    </div>
                    {isPlaying && (
                        <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-dominant shadow-[0_0_10px_rgba(var(--dominant-rgb),0.8)] animate-pulse"></div>
                    )}
                </div>
                <h3 className={`text-xs font-bold truncate ${isPlaying ? 'text-dominant-light' : 'text-white'}`}>
                    <HighlightText text={track.metadata?.title || track.logic.track_name} query={libraryState.searchQuery} />
                </h3>
                <p className="text-[11px] text-gray-500 truncate mt-0.5 font-medium">
                    <HighlightText text={track.metadata?.artists?.[0] || 'Unknown Artist'} query={libraryState.searchQuery} />
                </p>
            </div>
        );
    };

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
                                {recentlyPlayed.map(track => (
                                    <TrackCard key={`recent-${track.logic.hash_sha256}`} track={track} list={recentlyPlayed} />
                                ))}
                            </div>
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
                                        key={`most-${track.logic.hash_sha256}`}
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
                                {newArrivals.map(track => (
                                    <TrackCard key={`new-${track.logic.hash_sha256}`} track={track} list={newArrivals} />
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Empty State Content for Returning Users with No History */}
                    {totalTracks > 0 && recentlyPlayed.length === 0 && mostPlayed.length === 0 && newArrivals.length === 0 && (
                        <section className="py-8">
                            <div className="text-center">
                                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
                                    <Play size={24} className="text-gray-500" />
                                </div>
                                <h2 className="text-xl font-black text-white mb-2">Start Listening</h2>
                                <p className="text-gray-500 text-sm mb-6">Play some music from your library to see it here.</p>
                                <button 
                                    onClick={() => onNavigate('AllTracks')}
                                    className="px-6 py-3 bg-dominant text-on-dominant rounded-xl font-black uppercase tracking-widest text-xs"
                                >
                                    Browse Library
                                </button>
                            </div>
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
                                        key={`fav-${track.logic.hash_sha256}`}
                                        track={track}
                                        list={favorites}
                                        index={i}
                                        isPlaying={playerState.currentTrack?.logic.hash_sha256 === track.logic.hash_sha256}
                                        query={libraryState.searchQuery}
                                        rating={persistenceService.getRating(track.logic.hash_sha256)}
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
