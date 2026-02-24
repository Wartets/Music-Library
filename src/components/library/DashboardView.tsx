import React, { useMemo } from 'react';
import { useLibrary } from '../../contexts/LibraryContext';
import { usePlayer } from '../../contexts/PlayerContext';
import { persistenceService } from '../../services/persistence';
import { TrackItem } from '../../types/music';
import { Play, Star } from 'lucide-react';
import { useTrackContextMenu } from '../../hooks/useTrackContextMenu';

import { ViewType } from '../layout/AppLayout';
import { ArtworkImage } from '../shared/ArtworkImage';

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
        averageRating
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

            if (t.audio_specs?.duration) {
                const parts = t.audio_specs.duration.split(':').map(Number);
                if (parts.length === 2) {
                    totalTime += (parts[0] * 60) + parts[1];
                } else if (parts.length === 3) {
                    totalTime += (parts[0] * 3600) + (parts[1] * 60) + parts[2];
                }
            }

            if (t.audio_specs?.bitrate) {
                const val = parseInt(t.audio_specs.bitrate);
                if (!isNaN(val)) {
                    totalBitrate += val;
                    bitrateCount++;
                }
            }

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
                : 0
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
                    <ArtworkImage details={track.artworks?.track_artwork?.[0] || track.artworks?.album_artwork?.[0]} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
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
                <p className="text-[10px] text-gray-500 truncate mt-0.5 font-medium">
                    <HighlightText text={track.metadata?.artists?.[0] || 'Unknown Artist'} query={libraryState.searchQuery} />
                </p>
            </div>
        );
    };

    const TrackRow = ({ track, list, index }: { track: TrackItem, list: TrackItem[], index: number }) => {
        const isPlaying = playerState.currentTrack?.logic.hash_sha256 === track.logic.hash_sha256;
        const rating = persistenceService.getRating(track.logic.hash_sha256);

        return (
            <div
                className={`flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-all group cursor-pointer ${isPlaying ? 'bg-dominant/5' : ''}`}
                onClick={() => playTrack(track, list)}
                onContextMenu={(e) => handleContextMenu(e, track, list)}
            >
                <span className="text-[10px] font-mono text-gray-600 w-4 text-right">{index + 1}</span>
                <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-white/5 border border-white/5">
                    <ArtworkImage details={track.artworks?.track_artwork?.[0] || track.artworks?.album_artwork?.[0]} />
                </div>
                <div className="flex-1 min-w-0">
                    <h4 className={`text-xs font-bold truncate ${isPlaying ? 'text-dominant-light' : 'text-white'}`}>
                        <HighlightText text={track.metadata?.title || track.logic.track_name} query={libraryState.searchQuery} />
                    </h4>
                    <p className="text-[10px] text-gray-500 truncate mt-0.5">
                        <HighlightText text={track.metadata?.artists?.[0] || 'Unknown Artist'} query={libraryState.searchQuery} />
                    </p>
                </div>
                {rating > 0 && (
                    <div className="flex gap-0.5 text-yellow-500/80">
                        {Array.from({ length: rating }).map((_, i) => <Star key={i} size={8} fill="currentColor" />)}
                    </div>
                )}
                <span className="text-[10px] font-mono text-gray-500">{track.audio_specs?.duration}</span>
            </div>
        );
    };

    return (
        <div className="h-full overflow-y-auto custom-scrollbar bg-[#0a0a0a] pt-24 px-8 pb-32">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                {/* Main Content: Recently & Most Played */}
                <div className="lg:col-span-2 space-y-12">
                    <section>
                        <div className="flex items-end justify-between mb-6">
                            <h2 className="text-2xl font-black tracking-tighter text-white">Recently Played</h2>
                            <button onClick={() => onNavigate('DetailedHistory')} className="text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-dominant transition-colors">View All History</button>
                        </div>
                        <div className="flex gap-6 overflow-x-auto pb-4 custom-scrollbar-horizontal no-scrollbar">
                            {recentlyPlayed.map(track => (
                                <TrackCard key={`recent-${track.logic.hash_sha256}`} track={track} list={recentlyPlayed} />
                            ))}
                        </div>
                    </section>

                    <section>
                        <div className="flex items-end justify-between mb-6">
                            <h2 className="text-2xl font-black tracking-tighter text-white">Most Played</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-2">
                            {mostPlayed.map((track, i) => (
                                <TrackRow key={`most-${track.logic.hash_sha256}`} track={track} list={mostPlayed} index={i} />
                            ))}
                        </div>
                    </section>

                    <section>
                        <div className="flex items-end justify-between mb-6">
                            <h2 className="text-2xl font-black tracking-tighter text-white">New Arrivals</h2>
                        </div>
                        <div className="flex gap-6 overflow-x-auto pb-4 custom-scrollbar-horizontal no-scrollbar">
                            {newArrivals.map(track => (
                                <TrackCard key={`new-${track.logic.hash_sha256}`} track={track} list={newArrivals} />
                            ))}
                        </div>
                    </section>
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
                                    <TrackRow key={`fav-${track.logic.hash_sha256}`} track={track} list={favorites} index={i} />
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            </div>
        </div>
    );
};
