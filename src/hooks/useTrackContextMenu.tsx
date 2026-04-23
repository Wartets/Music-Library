import React from 'react';
import { useUI } from '../contexts/UIContext';
import { usePlayer } from '../contexts/PlayerContext';
import { useLibrary } from '../contexts/LibraryContext';
import { persistenceService } from '../services/persistence';
import { dbService } from '../services/db';
import { TrackItem } from '../types/music';
import { parseDuration } from '../utils/formatters';
import {
    Play, ListPlus, User, Disc, Heart, Star, Pencil, Copy, Share, FolderPlus, Zap, Plus,
    Download, Eye, Repeat, FastForward, Info, RefreshCw, Tag, SlidersHorizontal, Trash2, EyeOff, ListMinus
} from 'lucide-react';
import { ContextMenuItem } from '../components/shared/ContextMenu';

export const useTrackContextMenu = () => {
    const { showContextMenu, showToast } = useUI();
    const { playTrack, addToQueue, addToNext, seek, setRepeat, stop } = usePlayer();
    const { state: libraryState, setEditingTracks, refresh } = useLibrary();
    const previewTimerRef = React.useRef<number | null>(null);

    const clearPreviewTimer = React.useCallback(() => {
        if (previewTimerRef.current !== null) {
            window.clearTimeout(previewTimerRef.current);
            previewTimerRef.current = null;
        }
    }, []);

    React.useEffect(() => {
        return () => {
            clearPreviewTimer();
        };
    }, [clearPreviewTimer]);

    const exportM3U = (name: string, tracks: TrackItem[]) => {
        let m3u = '#EXTM3U\n';
        tracks.forEach((t) => {
            const secs = parseDuration(t.audio_specs?.duration || '0:00');
            m3u += `#EXTINF:${Math.round(secs)},${t.metadata?.artists?.[0] || 'Unknown'} - ${t.metadata?.title || t.logic.track_name}\n`;
            m3u += `${t.file?.path || ''}\n`;
        });
        const blob = new Blob([m3u], { type: 'audio/x-mpegurl' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${name}.m3u`;
        a.click();
        URL.revokeObjectURL(url);
    };

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
        const containingPlaylists = playlists.filter(pl => pl.trackIds.includes(track.logic.hash_sha256));
        const hasPlaylists = playlists.length > 0;

        const playbackActions: ContextMenuItem[] = [
            {
                label: 'Play',
                icon: <Play size={14} fill="currentColor" />,
                onClick: () => {
                    clearPreviewTimer();
                    playTrack(track, list.length > 0 ? list : [track]);
                    showToast(`Playing ${track.metadata?.title || track.logic.track_name}`);
                }
            },
            {
                label: 'Preview (15s)',
                icon: <Eye size={14} />,
                onClick: () => {
                    clearPreviewTimer();
                    playTrack(track, [track]);
                    showToast('Preview started', 'info', { subtle: true, durationMs: 1400 });
                    previewTimerRef.current = window.setTimeout(() => {
                        stop();
                        showToast('Preview ended', 'info', { subtle: true, durationMs: 1400 });
                        previewTimerRef.current = null;
                    }, 15000);
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
            {
                label: 'Skip to End',
                icon: <FastForward size={14} />,
                onClick: () => {
                    const duration = parseDuration(track.audio_specs?.duration || '0:00');
                    if (duration > 1) {
                        seek(Math.max(0, duration - 0.5));
                        showToast('Jumped near track end', 'info', { subtle: true });
                    }
                }
            },
            {
                label: 'Loop Playback',
                icon: <Repeat size={14} />,
                onClick: () => {
                    setRepeat('one');
                    playTrack(track, [track]);
                    showToast('Repeat-one enabled for this track', 'success');
                }
            },
        ];

        const navigateActions: ContextMenuItem[] = [
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
            {
                label: 'Show Detailed Information',
                icon: <Info size={14} />,
                onClick: () => onNavigate?.('SongDetail', track)
            },
            {
                label: 'View Similar Albums',
                icon: <Disc size={14} />,
                onClick: () => { },
                lazySubItems: () => {
                    const similarAlbums = Array.from(new Set(
                        libraryState.tracks
                            .filter(t => t.logic.hash_sha256 !== track.logic.hash_sha256)
                            .filter(t => {
                                const sameArtist = (t.metadata?.artists || []).some(a => (track.metadata?.artists || []).includes(a));
                                const sameGenre = t.metadata?.genre && track.metadata?.genre && t.metadata.genre === track.metadata.genre;
                                return Boolean(sameArtist || sameGenre);
                            })
                            .map(t => t.metadata?.album)
                            .filter((album): album is string => Boolean(album) && album !== track.metadata?.album)
                    )).slice(0, 8);

                    return similarAlbums.map(album => ({
                        label: album,
                        onClick: () => onNavigate?.('AlbumDetail', album)
                    }));
                }
            }
        ];

        const playlistActions: ContextMenuItem[] = [
            {
                label: 'Add to Playlist',
                icon: <Plus size={14} />,
                onClick: () => { },
                disabled: !hasPlaylists,
                subItems: playlists.map(pl => ({
                    label: pl.name,
                    onClick: () => {
                        persistenceService.addTrackToPlaylist(pl.id, track.logic.hash_sha256);
                        showToast(`Added to ${pl.name}`, 'success');
                    }
                }))
            },
            {
                label: 'Remove from Playlist',
                icon: <ListMinus size={14} />,
                onClick: () => { },
                disabled: containingPlaylists.length === 0,
                subItems: containingPlaylists.map(pl => ({
                    label: pl.name,
                    onClick: () => {
                        persistenceService.removeFromPlaylist(pl.id, track.logic.hash_sha256);
                        showToast(`Removed from ${pl.name}`, 'success');
                        refresh();
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
            {
                label: 'Export Track Playlist (M3U)',
                icon: <Share size={14} />,
                onClick: () => {
                    exportM3U(track.metadata?.title || track.logic.track_name, [track]);
                    showToast('M3U exported', 'success');
                }
            }
        ];

        const libraryActions: ContextMenuItem[] = [
            {
                label: isFavorite ? 'Remove from Favorites' : 'Add to Favorites',
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
                    label: r === 0 ? 'Clear Rating' : `${r}/5`,
                    onClick: () => {
                        persistenceService.setRating(track.logic.hash_sha256, r);
                        showToast(r === 0 ? 'Rating cleared' : `Rated ${r} star${r > 1 ? 's' : ''}`, 'success');
                        refresh();
                    }
                }))
            },
            {
                label: 'Add Custom Tags',
                icon: <Tag size={14} />,
                onClick: () => setEditingTracks([track])
            },
            {
                label: 'Edit Metadata',
                icon: <Pencil size={14} />,
                onClick: () => setEditingTracks([track])
            },
            {
                label: 'Enable Equalizer',
                icon: <SlidersHorizontal size={14} />,
                onClick: () => onNavigate?.('Settings', { tab: 'audio' })
            },
        ];

        const utilityActions: ContextMenuItem[] = [
            {
                label: 'Download',
                icon: <Download size={14} />,
                onClick: () => {
                    const href = dbService.getRelativePath(track.file.path);
                    const a = document.createElement('a');
                    a.href = href;
                    a.download = track.file?.name || `${track.logic.track_name}.${track.file?.ext || 'audio'}`;
                    a.click();
                    showToast('Download started', 'success');
                }
            },
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
            }
        ];

        const maintenanceActions: ContextMenuItem[] = [
            {
                label: 'Update Library / Refresh',
                icon: <RefreshCw size={14} />,
                onClick: () => {
                    window.location.reload();
                }
            },
            {
                label: 'Clear Playback History',
                icon: <Trash2 size={14} />,
                onClick: () => {
                    persistenceService.clearHistory();
                    showToast('Playback history cleared', 'success');
                    refresh();
                }
            },
            {
                label: 'Hide Item',
                icon: <EyeOff size={14} />,
                onClick: () => {
                    persistenceService.hideTrack(track.logic.hash_sha256);
                    showToast('Track hidden from library', 'warning');
                    window.setTimeout(() => window.location.reload(), 250);
                }
            }
        ];

        const groupedMenus: ContextMenuItem[] = [
            {
                label: 'Playback Actions',
                icon: <Play size={14} />,
                onClick: () => { },
                subItems: playbackActions,
            },
            ...(navigateActions.length > 0 ? [{
                label: 'Go To / Explore',
                icon: <Info size={14} />,
                onClick: () => { },
                subItems: navigateActions,
            }] : []),
            {
                label: 'Playlists',
                icon: <FolderPlus size={14} />,
                onClick: () => { },
                subItems: playlistActions,
            },
            {
                label: 'Library & Metadata',
                icon: <Tag size={14} />,
                onClick: () => { },
                subItems: libraryActions,
            },
            {
                label: 'Utilities',
                icon: <Copy size={14} />,
                onClick: () => { },
                subItems: utilityActions,
            },
            {
                label: 'Maintenance',
                icon: <RefreshCw size={14} />,
                onClick: () => { },
                subItems: maintenanceActions,
            },
        ];

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
            ...groupedMenus,
            ...additionalItems,
        ]);
    };

    return { openTrackContextMenu };
};
