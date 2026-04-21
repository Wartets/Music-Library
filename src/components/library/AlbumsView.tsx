import React, { useMemo } from 'react';
import { useLibrary } from '../../contexts/LibraryContext';
import { usePlayer } from '../../contexts/PlayerContext';
import { useUI } from '../../contexts/UIContext';
import { Filter, User, Play, ListPlus, Plus, FolderPlus, Pencil, Zap } from 'lucide-react';
import { persistenceService } from '../../services/persistence';
import { CollectionGridView, GridItem } from './CollectionGridView';
import { getTrackCollectionKey, getTrackCollectionLabel } from '../../utils/collectionLabels';


interface AlbumsViewProps {
    onNavigate: (view: any, data: any) => void;
}

export const AlbumsView: React.FC<AlbumsViewProps> = ({ onNavigate }) => {
    const { state: libraryState, setEditingTracks } = useLibrary();
    const { playTrack, addToQueue, addToNext } = usePlayer();
    const { showContextMenu, showToast } = useUI();
    const [sortBy, setSortBy] = React.useState<'name' | 'artist'>('artist');

    const albums = useMemo(() => {
        const groups: Record<string, any> = {};
        const unknownAlbums: any[] = [];
        
        libraryState.filteredTracks.forEach(track => {
            const album = track.metadata?.album;
            
            // Check if album metadata is empty/null/undefined
            const isEmptyAlbum = !album || (typeof album === 'string' && !album.trim());
            
            if (isEmptyAlbum) {
                unknownAlbums.push(track);
            } else {
                const albumTrimmed = album.trim();
                const key = `album:${albumTrimmed.toLowerCase()}`;
                if (!groups[key]) {
                    groups[key] = {
                        id: key,
                        name: albumTrimmed,
                        artist: track.metadata?.album_artist || track.metadata?.artists?.[0] || 'Unknown Artist',
                        tracks: [],
                        artwork: track.artworks?.album_artwork?.[0] || track.artworks?.track_artwork?.[0]
                    };
                }
                groups[key].tracks.push(track);
            }
        });
        
        if (unknownAlbums.length > 0) {
            groups['__unknown__'] = {
                id: '__unknown__',
                name: 'Unknown Album',
                artist: 'Unknown Artist',
                tracks: unknownAlbums,
                artwork: unknownAlbums[0]?.artworks?.album_artwork?.[0] || unknownAlbums[0]?.artworks?.track_artwork?.[0]
            };
        }
        
        const sorted = Object.values(groups);
        if (sortBy === 'name') {
            return sorted.sort((a, b) => {
                if (a.id === '__unknown__') return 1;
                if (b.id === '__unknown__') return -1;
                return a.name.localeCompare(b.name);
            });
        } else {
            return sorted.sort((a, b) => {
                if (a.id === '__unknown__') return 1;
                if (b.id === '__unknown__') return -1;
                const artistCmp = a.artist.localeCompare(b.artist);
                if (artistCmp !== 0) return artistCmp;
                return a.name.localeCompare(b.name);
            });
        }
    }, [libraryState.filteredTracks, sortBy]);

    const onRightClick = React.useCallback((e: React.MouseEvent, album: any) => {
        e.preventDefault();
        e.stopPropagation();
        const playlists = persistenceService.getPlaylists();

        showContextMenu(e.clientX, e.clientY, [
            {
                label: `Play Album: ${album.name}`,
                icon: <Play size={14} fill="currentColor" />,
                onClick: () => {
                    const sortedTracks = [...album.tracks].sort((a: any, b: any) => (a.metadata?.track_number || '0').localeCompare(b.metadata?.track_number || '0'));
                    playTrack(sortedTracks[0], sortedTracks);
                    showToast(`Playing album: ${album.name}`);
                }
            },
            {
                label: 'Play Next',
                icon: <Zap size={14} className="text-dominant-light" />,
                onClick: () => {
                    const sortedTracks = [...album.tracks].sort((a: any, b: any) => (a.metadata?.track_number || '0').localeCompare(b.metadata?.track_number || '0'));
                    sortedTracks.reverse().forEach((t: any) => addToNext(t));
                    showToast(`Album ${album.name} will play next`, 'success');
                }
            },
            {
                label: 'Add to Queue',
                icon: <ListPlus size={14} />,
                onClick: () => {
                    album.tracks.forEach((t: any) => addToQueue(t));
                    showToast(`Added ${album.tracks.length} tracks to queue`);
                }
            },
            { divider: true, label: '', onClick: () => { } },
            {
                label: 'Add to Playlist',
                icon: <Plus size={14} />,
                onClick: () => { },
                subItems: playlists.map(pl => ({
                    label: pl.name,
                    onClick: () => {
                        album.tracks.forEach((t: any) => persistenceService.addTrackToPlaylist(pl.id, t.logic.hash_sha256));
                        showToast(`Added album to ${pl.name}`, 'success');
                    }
                }))
            },
            {
                label: 'Go to Artist',
                icon: <User size={14} />,
                onClick: () => onNavigate('ArtistDetail', album.artist)
            },
            { divider: true, label: '', onClick: () => { } },
            {
                label: 'Save as New Playlist',
                icon: <FolderPlus size={14} />,
                onClick: () => {
                    const newPl = persistenceService.createPlaylist(album.name);
                    album.tracks.forEach((t: any) => persistenceService.addTrackToPlaylist(newPl.id, t.logic.hash_sha256));
                    showToast(`Created playlist "${album.name}"`, 'success');
                }
            },
            { divider: true, label: '', onClick: () => { } },
            {
                label: 'Edit Tracking Metadata',
                icon: <Pencil size={14} />,
                onClick: () => {
                    if (album.tracks.length > 0) {
                        setEditingTracks(album.tracks)
                    }
                }
            }
        ]);
    }, [addToNext, addToQueue, onNavigate, playTrack, setEditingTracks, showContextMenu, showToast]);

    const gridItems: GridItem[] = albums.map(album => ({
        id: album.id,
        title: album.name,
        subtitle: album.artist,
        imageDetails: album.artwork,
        onClick: () => onNavigate('AlbumDetail', album),
        onContextMenu: (e) => onRightClick(e, album)
    }));

    return (
        <CollectionGridView
            title="Albums"
            subtitle={`${albums.length} collections`}
            items={gridItems}
            sortOptions={[
                { id: 'name', label: 'Title', icon: <Filter size={14} /> },
                { id: 'artist', label: 'Artist', icon: <User size={14} /> }
            ]}
            currentSort={sortBy}
            onSortChange={(id) => setSortBy(id as 'name' | 'artist')}
        />
    );
};

