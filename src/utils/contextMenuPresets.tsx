import { FolderPlus, ListMinus, ListPlus, Play, Plus, Zap } from 'lucide-react';
import { persistenceService } from '../services/persistence';
import type { Playlist } from '../services/persistence';
import type { TrackItem } from '../types/music';
import type { ContextMenuItem } from '../components/shared/ContextMenu';

interface CreateGroupContextMenuOptions {
    name: string;
    tracks: TrackItem[];
    playTrack: (track: TrackItem, queue?: TrackItem[]) => void;
    addToNext: (track: TrackItem) => void;
    addToQueue: (track: TrackItem) => void;
    showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
    playLabel?: string;
    playNextLabel?: string;
    addToQueueLabel?: string;
    addToPlaylistLabel?: string;
    createPlaylistLabel?: string;
    createPlaylistName?: string;
    extraItems?: ContextMenuItem[];
}

export const createGroupContextMenu = ({
    name,
    tracks,
    playTrack,
    addToNext,
    addToQueue,
    showToast,
    playLabel = `Play ${name}`,
    playNextLabel = 'Play Next',
    addToQueueLabel = 'Add to Queue',
    addToPlaylistLabel = 'Add to Playlist',
    createPlaylistLabel = 'Save as New Playlist',
    createPlaylistName,
    extraItems = []
}: CreateGroupContextMenuOptions): ContextMenuItem[] => {
    const playlists = persistenceService.getPlaylists();

    return [
        {
            label: playLabel,
            icon: <Play size={14} fill="currentColor" />,
            onClick: () => {
                if (tracks.length === 0) {
                    showToast(`No tracks available for ${name}`, 'error');
                    return;
                }

                playTrack(tracks[0], tracks);
                showToast(`Playing ${name}`);
            }
        },
        {
            label: playNextLabel,
            icon: <Zap size={14} className="text-dominant-light" />,
            onClick: () => {
                [...tracks].reverse().forEach(track => addToNext(track));
                showToast(`${name} will play next`, 'success');
            }
        },
        {
            label: addToQueueLabel,
            icon: <ListPlus size={14} />,
            onClick: () => {
                tracks.forEach(track => addToQueue(track));
                showToast(`Added ${tracks.length} tracks to queue`, 'success');
            }
        },
        { divider: true, label: '', onClick: () => { } },
        {
            label: addToPlaylistLabel,
            icon: <Plus size={14} />,
            onClick: () => { },
            subItems: playlists.map(playlist => ({
                label: playlist.name,
                onClick: () => {
                    tracks.forEach(track => persistenceService.addTrackToPlaylist(playlist.id, track.logic.hash_sha256));
                    showToast(`Added to ${playlist.name}`, 'success');
                }
            }))
        },
        ...extraItems,
        { divider: true, label: '', onClick: () => { } },
        {
            label: createPlaylistLabel,
            icon: <FolderPlus size={14} />,
            onClick: () => {
                const playlist = persistenceService.createPlaylist(createPlaylistName || name);
                tracks.forEach(track => persistenceService.addTrackToPlaylist(playlist.id, track.logic.hash_sha256));
                showToast(`Created playlist "${playlist.name}"`, 'success');
            }
        }
    ];
};

interface CreatePlaylistTrackContextMenuOptions {
    isSmart: boolean;
    track: TrackItem;
    playTrack: (track: TrackItem, queue?: TrackItem[]) => void;
    addToQueue: (track: TrackItem) => void;
    showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
    playlist?: Playlist;
    onRemoveFromPlaylist?: () => void;
    onEditMetadata?: () => void;
}

export const createPlaylistTrackContextMenu = ({
    isSmart,
    track,
    playTrack,
    addToQueue,
    showToast,
    onRemoveFromPlaylist,
    onEditMetadata
}: CreatePlaylistTrackContextMenuOptions): ContextMenuItem[] => {
    if (isSmart) {
        return [
            {
                label: 'Play Now',
                icon: <Play size={14} fill="currentColor" />,
                onClick: () => playTrack(track, [track])
            },
            {
                label: 'Add to Queue',
                icon: <ListPlus size={14} />,
                onClick: () => {
                    addToQueue(track);
                    showToast('Added to queue', 'success');
                }
            },
            { divider: true, label: '', onClick: () => { } },
            {
                label: 'Edit Metadata',
                icon: <FolderPlus size={14} />,
                onClick: () => onEditMetadata?.()
            }
        ];
    }

    return [
        { divider: true, label: '', onClick: () => { } },
        {
            label: 'Remove from Playlist',
            icon: <ListMinus size={14} />,
            danger: true,
            onClick: () => {
                onRemoveFromPlaylist?.();
            }
        }
    ];
};
