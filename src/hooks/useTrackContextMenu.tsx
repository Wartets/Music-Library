import React from 'react';
import { useUI } from '../contexts/UIContext';
import { usePlayer } from '../contexts/PlayerContext';
import { useLibrary } from '../contexts/LibraryContext';
import { persistenceService } from '../services/persistence';
import { TrackItem } from '../types/music';
import {
    Play, ListPlus, User, Disc, Heart, Star, Pencil, Copy, Share, FolderPlus, Zap, Plus
} from 'lucide-react';

export const useTrackContextMenu = () => {
    const { showContextMenu, showToast } = useUI();
    const { playTrack, addToQueue, addToNext } = usePlayer();
    const { setEditingTracks, refresh } = useLibrary();

    const openTrackContextMenu = (
        e: React.MouseEvent,
        track: TrackItem,
        list: TrackItem[] = [],
        onNavigate?: (view: any, data?: any) => void,
        additionalItems: any[] = []
    ) => {
        e.preventDefault();
        e.stopPropagation();

        const playlists = persistenceService.getPlaylists();
        const isFavorite = persistenceService.isFavorite(track.logic.hash_sha256);

        showContextMenu(e.clientX, e.clientY, [
            {
                label: 'Play',
                icon: <Play size={14} fill="currentColor" />,
                onClick: () => {
                    playTrack(track, list.length > 0 ? list : [track]);
                    showToast(`Playing ${track.metadata?.title || track.logic.track_name}`);
                }
            },
            {
                label: 'Play Next',
                icon: <Zap size={14} className="text-dominant-light" />,
                onClick: () => {
                    addToNext(track);
                    showToast(`Added to play next: ${track.metadata?.title || 'Track'}`, 'success');
                }
            },
            {
                label: 'Add to Queue',
                icon: <ListPlus size={14} />,
                onClick: () => {
                    addToQueue(track);
                    showToast(`Added to queue: ${track.metadata?.title || 'Track'}`);
                }
            },
            { divider: true, label: '', onClick: () => { } },
            ...((onNavigate && track.metadata?.artists?.[0]) ? [{
                label: 'Go to Artist',
                icon: <User size={14} />,
                onClick: () => onNavigate('ArtistDetail', track.metadata.artists[0])
            }] : []),
            ...((onNavigate && track.metadata?.album) ? [{
                label: 'Go to Album',
                icon: <Disc size={14} />,
                onClick: () => onNavigate('AlbumDetail', track.metadata.album)
            }] : []),
            { divider: true, label: '', onClick: () => { } },
            {
                label: 'Add to Playlist',
                icon: <Plus size={14} />,
                onClick: () => { },
                subItems: playlists.map(pl => ({
                    label: pl.name,
                    onClick: () => {
                        persistenceService.addTrackToPlaylist(pl.id, track.logic.hash_sha256);
                        showToast(`Added to ${pl.name}`, 'success');
                    }
                }))
            },
            {
                label: 'Save as New Playlist',
                icon: <FolderPlus size={14} />,
                onClick: () => {
                    const plName = track.metadata?.title || 'New Playlist';
                    const newPl = persistenceService.createPlaylist(plName);
                    persistenceService.addTrackToPlaylist(newPl.id, track.logic.hash_sha256);
                    showToast(`Created playlist "${plName}"`, 'success');
                }
            },
            { divider: true, label: '', onClick: () => { } },
            {
                label: isFavorite ? '♥ Remove from Favorites' : '♡ Add to Favorites',
                icon: <Heart size={14} className={isFavorite ? 'text-red-400 fill-red-400' : ''} />,
                onClick: () => {
                    const nowFav = persistenceService.toggleFavorite(track.logic.hash_sha256);
                    showToast(nowFav ? 'Added to Favorites' : 'Removed from Favorites', 'success');
                    refresh();
                }
            },
            {
                label: 'Rate',
                icon: <Star size={14} />,
                onClick: () => { },
                subItems: [0, 1, 2, 3, 4, 5].map(r => ({
                    label: r === 0 ? 'Clear Rating' : '★'.repeat(r) + '☆'.repeat(5 - r),
                    onClick: () => {
                        persistenceService.setRating(track.logic.hash_sha256, r);
                        showToast(r === 0 ? 'Rating cleared' : `Rated ${r} star${r > 1 ? 's' : ''}`, 'success');
                        refresh();
                    }
                }))
            },
            {
                label: 'Edit Metadata',
                icon: <Pencil size={14} />,
                onClick: () => setEditingTracks([track])
            },
            { divider: true, label: '', onClick: () => { } },
            {
                label: 'Copy File Path',
                icon: <Copy size={14} />,
                onClick: () => {
                    navigator.clipboard.writeText(track.file.path);
                    showToast('File path copied to clipboard');
                }
            },
            {
                label: 'Copy SHA256 Hash',
                icon: <Share size={14} />,
                onClick: () => {
                    navigator.clipboard.writeText(track.logic.hash_sha256);
                    showToast('Hash copied to clipboard');
                }
            },
            ...additionalItems,
        ]);
    };

    return { openTrackContextMenu };
};
