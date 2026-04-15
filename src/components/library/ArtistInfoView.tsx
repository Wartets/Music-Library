import React, { useMemo } from 'react';
import { useLibrary } from '../../contexts/LibraryContext';
import { usePlayer } from '../../contexts/PlayerContext';
import { TrackItem } from '../../types/music';
import { Play } from 'lucide-react';
import { ArtworkImage } from '../shared/ArtworkImage';
import { ViewType } from '../layout/AppLayout';

interface ArtistInfoViewProps {
    artistName: string;
    onNavigate: (view: ViewType, data?: any) => void;
}

export const ArtistInfoView: React.FC<ArtistInfoViewProps> = ({ artistName, onNavigate }) => {
    const { state: libraryState } = useLibrary();
    const { playTrack, state: playerState } = usePlayer();

    const artistTracks = useMemo(() => {
        return libraryState.tracks.filter(t =>
            t.metadata?.artists?.some(a => a.toLowerCase() === artistName.toLowerCase()) ||
            t.metadata?.album_artist?.toLowerCase() === artistName.toLowerCase()
        );
    }, [libraryState.tracks, artistName]);

    const artistAlbums = useMemo(() => {
        const albums: Record<string, { name: string, artwork?: any, tracks: TrackItem[] }> = {};
        artistTracks.forEach(t => {
            const albumName = t.metadata?.album || 'Unknown Album';
            if (!albums[albumName]) {
                albums[albumName] = {
                    name: albumName,
                    artwork: t.artworks?.album_artwork?.[0] || t.artworks?.track_artwork?.[0],
                    tracks: []
                };
            }
            albums[albumName].tracks.push(t);
        });
        return Object.values(albums);
    }, [artistTracks]);

    return (
        <div className="h-full flex flex-col p-3 md:p-8 pt-16 md:pt-24 overflow-y-auto custom-scrollbar bg-surface-primary">

            <div className="flex flex-col mb-4 md:mb-12">
                <span className="text-[10px] font-black uppercase tracking-[0.5em] text-white/30 mb-2">Artist Profile</span>
                <h1 className="text-3xl md:text-6xl font-black tracking-tighter text-white mb-3 md:mb-4">{artistName}</h1>
                <div className="flex items-center gap-4 text-sm text-gray-400">
                    <span className="bg-white/5 px-3 py-1 rounded-full">{artistAlbums.length} Albums</span>
                    <span className="bg-white/5 px-3 py-1 rounded-full">{artistTracks.length} Tracks</span>
                </div>
            </div>

            {/* Albums Content */}
            <div className="space-y-12">
                {artistAlbums.map(album => (
                    <div key={album.name} className="flex flex-col lg:flex-row gap-8">
                        <div
                            className="w-48 h-48 rounded-2xl overflow-hidden shadow-2xl flex-shrink-0 border border-white/5 bg-gray-900 group relative cursor-pointer"
                            onClick={() => onNavigate('AlbumDetail', album.name)}
                        >
                            {album.artwork ? (
                                <ArtworkImage details={album.artwork} alt={album.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-5xl font-bold text-white/10 uppercase">
                                    {album.name.charAt(0)}
                                </div>
                            )}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    playTrack(album.tracks[0], album.tracks);
                                }}
                                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                            >
                                <div className="w-12 h-12 bg-dominant rounded-full flex items-center justify-center shadow-xl scale-90 group-hover:scale-100 transition-transform">
                                    <Play size={24} fill="var(--color-on-dominant)" stroke="var(--color-on-dominant)" className="ml-1" />
                                </div>
                            </button>
                        </div>

                        <div className="flex-1 flex flex-col">
                            <h3
                                className="text-xl font-bold text-white mb-4 flex items-center gap-3 cursor-pointer hover:text-dominant transition-colors"
                                onClick={() => onNavigate('AlbumDetail', album.name)}
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
