import React, { useMemo } from 'react';
import { useLibrary } from '../../contexts/LibraryContext';
import { usePlayer } from '../../contexts/PlayerContext';
import { TrackItem } from '../../types/music';
import { Play } from 'lucide-react';
import { ArtworkImage } from '../shared/ArtworkImage';
import { ViewType } from '../layout/AppLayout';
import { getBestArtwork } from '../../utils/artworkResolver';
import { sortTracksByTrackNumber } from '../../utils/trackSorting';

const normalizeArtistKey = (value: string | null | undefined): string => {
    return String(value || '')
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase();
};

interface ArtistInfoViewProps {
    artistName: string;
    onNavigate: (view: ViewType, data?: any) => void;
}

export const ArtistInfoView: React.FC<ArtistInfoViewProps> = ({ artistName, onNavigate }) => {
    const { state: libraryState } = useLibrary();
    const { playTrack, state: playerState } = usePlayer();

    const normalizedArtistName = useMemo(() => normalizeArtistKey(artistName), [artistName]);

    const tracksByArtist = useMemo(() => {
        const map = new Map<string, TrackItem[]>();

        libraryState.tracks.forEach(track => {
            const candidates = new Set<string>();

            const albumArtistKey = normalizeArtistKey(track.metadata?.album_artist);
            if (albumArtistKey) {
                candidates.add(albumArtistKey);
            }

            (track.metadata?.artists || []).forEach(artist => {
                const artistKey = normalizeArtistKey(artist);
                if (artistKey) {
                    candidates.add(artistKey);
                }
            });

            candidates.forEach(artistKey => {
                if (!map.has(artistKey)) {
                    map.set(artistKey, []);
                }
                map.get(artistKey)!.push(track);
            });
        });

        return map;
    }, [libraryState.tracks]);

    const artistTracks = useMemo(() => {
        return tracksByArtist.get(normalizedArtistName) || [];
    }, [tracksByArtist, normalizedArtistName]);

    const artistAlbums = useMemo(() => {
        const albums: Record<string, { name: string, artwork?: any, tracks: TrackItem[] }> = {};
        artistTracks.forEach(t => {
            const albumName = t.metadata?.album || 'Unknown Album';
            if (!albums[albumName]) {
                // Don't show artwork for "Unknown Album" - singles should not have collection artwork
                const shouldShowArtwork = albumName !== 'Unknown Album';
                albums[albumName] = {
                    name: albumName,
                    artwork: shouldShowArtwork ? getBestArtwork(t) : undefined,
                    tracks: []
                };
            }
            albums[albumName].tracks.push(t);
        });
        return Object.values(albums).map(album => ({
            ...album,
            tracks: sortTracksByTrackNumber(album.tracks)
        }));
    }, [artistTracks]);

    return (
        <div className="h-full flex flex-col p-3 md:p-8 pt-0 md:pt-24 overflow-y-auto custom-scrollbar bg-surface-primary">

            <div className="flex flex-col mb-4 md:mb-12">
                <div className="flex items-center gap-2 mb-2">
                    <button 
                        onClick={() => onNavigate('Artists')}
                        className="md:hidden p-1.5 min-w-8 min-h-8 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        aria-label="Back to artists"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="15 18 9 12 15 6"></polyline>
                        </svg>
                    </button>
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.5em] text-white/30 mb-2">Artist Profile</span>
                <h1 className="text-3xl md:text-6xl font-black tracking-tighter text-white mb-3 md:mb-4">{artistName}</h1>
                <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-gray-400">
                    <span className="bg-white/5 px-2 sm:px-3 py-1 rounded-full">{artistAlbums.length} Albums</span>
                    <span className="bg-white/5 px-2 sm:px-3 py-1 rounded-full">{artistTracks.length} Tracks</span>
                </div>
            </div>

            {/* Albums Content */}
            <div className="space-y-12">
                {artistAlbums.map(album => (
                    <div key={album.name} className="flex flex-col lg:flex-row gap-4 sm:gap-8">
                        <div
                            className={`w-32 h-32 sm:w-40 sm:h-40 lg:w-48 lg:h-48 rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl flex-shrink-0 border border-white/5 bg-gray-900 group relative ${album.name !== 'Unknown Album' ? 'cursor-pointer' : ''}`}
                            onClick={() => album.name !== 'Unknown Album' && onNavigate('AlbumDetail', album.name)}
                        >
                            {album.artwork ? (
                                <ArtworkImage details={album.artwork} alt={album.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-4xl sm:text-5xl font-bold text-white/10 uppercase">
                                    {album.name.charAt(0)}
                                </div>
                            )}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    playTrack(album.tracks[0], album.tracks);
                                }}
                                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 md:group-hover:opacity-0 flex items-center justify-center transition-opacity active:opacity-100 md:active:opacity-0"
                                aria-label="Play album"
                            >
                                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-dominant rounded-full flex items-center justify-center shadow-xl scale-90 group-active:scale-100 md:group-hover:scale-100 transition-transform">
                                    <Play size={20} fill="var(--color-on-dominant)" stroke="var(--color-on-dominant)" className="ml-0.5 sm:ml-1" />
                                </div>
                            </button>
                        </div>

                        <div className="flex-1 flex flex-col">
                            <h3
                                className={`text-xl font-bold text-white mb-4 flex items-center gap-3 ${album.name !== 'Unknown Album' ? 'cursor-pointer hover:text-dominant transition-colors' : ''}`}
                                onClick={() => album.name !== 'Unknown Album' && onNavigate('AlbumDetail', album.name)}
                            >
                                {album.name}
                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{album.tracks.length} tracks</span>
                            </h3>

                            <div className="bg-white/5 rounded-xl border border-white/5 overflow-hidden">
                                {album.tracks.map((track, idx) => {
                                    const isPlaying = playerState.currentTrack?.logic.hash_sha256 === track.logic.hash_sha256;
                                    return (
                                        <div
                                            key={track.logic.hash_sha256}
                                            className={`flex items-center px-4 py-2.5 hover:bg-white/5 cursor-pointer border-b border-white/5 last:border-0 group ${isPlaying ? 'text-dominant-light' : 'text-gray-400'}`}
                                            onClick={() => playTrack(track, artistTracks)}
                                        >
                                            <span className="w-8 text-xs font-mono opacity-40">{idx + 1}</span>
                                            <div className="flex-1 min-w-0 pr-4">
                                                <div className="text-sm font-semibold truncate text-white">{track.metadata?.title || track.logic.track_name}</div>
                                                <div className="text-[10px] uppercase tracking-wider opacity-50">{track.logic.version_name}</div>
                                            </div>
                                            <span className="text-xs font-mono opacity-40">{track.audio_specs.duration || '0:00'}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
