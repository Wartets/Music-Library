import React, { useMemo } from 'react';
import { useLibrary } from '../../contexts/LibraryContext';
import { usePlayer } from '../../contexts/PlayerContext';
import { Play, Heart } from 'lucide-react';
import { useTrackContextMenu } from '../../hooks/useTrackContextMenu';
import { ArtworkImage } from '../shared/ArtworkImage';
import { persistenceService } from '../../services/persistence';
import { TrackItem } from '../../types/music';

interface FavoritesViewProps {
    onNavigate?: (view: any, data?: any) => void;
}

export const FavoritesView: React.FC<FavoritesViewProps> = ({ onNavigate }) => {
    const { state: libraryState } = useLibrary();
    const { playTrack, state: playerState } = usePlayer();
    const { openTrackContextMenu } = useTrackContextMenu();

    const favoriteTracks = useMemo(() => {
        const favIds = persistenceService.getFavorites();
        const trackMap = new Map<string, TrackItem>();
        libraryState.tracks.forEach(t => trackMap.set(t.logic.hash_sha256, t));
        return favIds.map(id => trackMap.get(id)).filter((t): t is TrackItem => !!t);
    }, [libraryState.tracks]);

    const onRightClick = (e: React.MouseEvent, track: TrackItem) => {
        openTrackContextMenu(e, track, favoriteTracks, onNavigate);
    };

    return (
        <div className="h-full flex flex-col p-6 pt-24 overflow-y-auto custom-scrollbar bg-surface-primary">
            <div className="flex items-end justify-between mb-10">
                <div>
                    <h1 className="text-4xl font-black tracking-tighter text-white flex items-center gap-3">
                        <Heart size={32} className="text-red-400 fill-red-400" /> Favorites
                    </h1>
                    <p className="text-gray-500 font-bold uppercase tracking-widest text-xs mt-1">{favoriteTracks.length} tracks</p>
                </div>
                {favoriteTracks.length > 0 && (
                    <button
                        onClick={() => playTrack(favoriteTracks[0], favoriteTracks)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-dominant text-black rounded-xl text-xs font-black uppercase tracking-widest hover:bg-dominant-light transition-all shadow-lg shadow-dominant/10"
                    >
                        <Play size={14} fill="currentColor" /> Play All
                    </button>
                )}
            </div>

            {favoriteTracks.length === 0 && (
                <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
                    <div className="text-center">
                        <Heart size={48} className="mx-auto mb-4 text-gray-600" />
                        <p className="font-bold">No favorites yet</p>
                        <p className="text-xs mt-1">Right-click any track and select "Favorite" to add it here.</p>
                    </div>
                </div>
            )}

            <div className="space-y-1 pb-32">
                {favoriteTracks.map((track, idx) => {
                    const rating = persistenceService.getRating(track.logic.hash_sha256);
                    const isPlaying = playerState.currentTrack?.logic.hash_sha256 === track.logic.hash_sha256;

                    return (
                        <div
                            key={track.logic.hash_sha256}
                            className={`flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-white/5 cursor-pointer transition-all group ${isPlaying ? 'bg-dominant/10' : ''}`}
                            onClick={() => playTrack(track, favoriteTracks)}
                            onContextMenu={(e) => onRightClick(e, track)}
                        >
                            <span className="text-xs text-gray-600 w-6 text-right font-mono">{idx + 1}</span>
                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-white/5 flex-shrink-0 border border-white/5">
                                <ArtworkImage
                                    details={track.artworks?.track_artwork?.[0] || track.artworks?.album_artwork?.[0]}
                                    alt={track.metadata?.title || track.logic.track_name}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className={`truncate text-sm font-bold ${isPlaying ? 'text-dominant-light' : 'text-white'}`}>
                                    {track.metadata?.title || track.logic.track_name}
                                </div>
                                <div className="truncate text-xs text-gray-500">
                                    {track.metadata?.artists?.join(', ') || 'Unknown Artist'}
                                </div>
                            </div>
                            <div className="hidden md:block text-xs text-gray-500 truncate w-32">
                                {track.metadata?.album || 'Single'}
                            </div>
                            {rating > 0 && (
                                <div className="text-xs text-yellow-500 font-bold">
                                    {'\u2605'.repeat(rating)}
                                </div>
                            )}
                            <div className="text-xs text-gray-500 font-mono w-12 text-right">
                                {track.audio_specs?.duration || '0:00'}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
