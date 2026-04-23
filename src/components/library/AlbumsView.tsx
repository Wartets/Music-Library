import React, { useMemo } from 'react';
import { useLibrary } from '../../contexts/LibraryContext';
import { usePlayer } from '../../contexts/PlayerContext';
import { useUI } from '../../contexts/UIContext';
import { Filter, User, Play, ListPlus, Plus, FolderPlus, Pencil, Zap } from 'lucide-react';
import { persistenceService } from '../../services/persistence';
import { CollectionGridView, GridItem } from './CollectionGridView';
import { formatDuration, parseDuration } from '../../utils/formatters';
import { TrackItem } from '../../types/music';

interface AlbumGroup {
    id: string;
    name: string;
    artist: string;
    tracks: TrackItem[];
    sortedTracks: TrackItem[];
    artwork?: TrackItem['artworks']['album_artwork'][0] | TrackItem['artworks']['track_artwork'][0];
    durationSeconds: number;
    durationLabel: string;
}

const getBestAlbumArtwork = (tracks: TrackItem[]) => {
    for (const track of tracks) {
        const albumArtwork = track.artworks?.album_artwork?.[0];
        if (albumArtwork) return albumArtwork;
    }

    for (const track of tracks) {
        const trackArtwork = track.artworks?.track_artwork?.[0];
        if (trackArtwork) return trackArtwork;

        const versionArtwork = track.versions?.find(version => version.artworks?.album_artwork?.[0] || version.artworks?.track_artwork?.[0]);
        if (versionArtwork) {
            return versionArtwork.artworks?.album_artwork?.[0] || versionArtwork.artworks?.track_artwork?.[0];
        }
    }

    return undefined;
};

const getAlbumDurationSeconds = (tracks: TrackItem[]) => {
    return tracks.reduce((total, track) => total + parseDuration(track.audio_specs?.duration || '0:00'), 0);
};

const groupAlbums = (tracks: TrackItem[], sortBy: 'name' | 'artist'): AlbumGroup[] => {
    const groups = new Map<string, AlbumGroup>();
    const unknownTracks: TrackItem[] = [];

    tracks.forEach(track => {
        const album = track.metadata?.album;
        const isEmptyAlbum = !album || (typeof album === 'string' && !album.trim());

        if (isEmptyAlbum) {
            unknownTracks.push(track);
            return;
        }

        const albumName = album.trim();
        const key = `album:${albumName.toLowerCase()}`;
        const existing = groups.get(key);

        if (existing) {
            existing.tracks.push(track);
            return;
        }

        groups.set(key, {
            id: key,
            name: albumName,
            artist: track.metadata?.album_artist || track.metadata?.artists?.[0] || 'Unknown Artist',
            tracks: [track],
            sortedTracks: [track],
            artwork: undefined,
            durationSeconds: 0,
            durationLabel: '0:00'
        });
    });

    if (unknownTracks.length > 0) {
        groups.set('__unknown__', {
            id: '__unknown__',
            name: 'Unknown Album',
            artist: 'Unknown Artist',
            tracks: unknownTracks,
            sortedTracks: [...unknownTracks],
            artwork: undefined,
            durationSeconds: 0,
            durationLabel: '0:00'
        });
    }

    const albums = Array.from(groups.values()).map(album => {
        const sortedTracks = [...album.tracks].sort((a, b) => (a.metadata?.track_number || '0').localeCompare(b.metadata?.track_number || '0'));
        const durationSeconds = getAlbumDurationSeconds(sortedTracks);

        return {
            ...album,
            sortedTracks,
            artwork: getBestAlbumArtwork(sortedTracks),
            durationSeconds,
            durationLabel: formatDuration(durationSeconds),
        };
    });

    return albums.sort((a, b) => {
        if (a.id === '__unknown__') return 1;
        if (b.id === '__unknown__') return -1;

        if (sortBy === 'name') {
            return a.name.localeCompare(b.name);
        }

        const artistCmp = a.artist.localeCompare(b.artist);
        if (artistCmp !== 0) return artistCmp;
        return a.name.localeCompare(b.name);
    });
};


interface AlbumsViewProps {
    onNavigate: (view: any, data: any) => void;
}

export const AlbumsView: React.FC<AlbumsViewProps> = ({ onNavigate }) => {
    const { state: libraryState, setEditingTracks } = useLibrary();
    const { playTrack, addToQueue, addToNext } = usePlayer();
    const { showContextMenu, showToast } = useUI();
    const [sortBy, setSortBy] = React.useState<'name' | 'artist'>('artist');

    const albums = useMemo(() => {
        return groupAlbums(libraryState.filteredTracks, sortBy);
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
                    playTrack(album.sortedTracks[0], album.sortedTracks);
                    showToast(`Playing album: ${album.name}`);
                }
            },
            {
                label: 'Play Next',
                icon: <Zap size={14} className="text-dominant-light" />,
                onClick: () => {
                    album.sortedTracks.slice().reverse().forEach((t: TrackItem) => addToNext(t));
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
        subtitle: `${album.artist} • ${album.tracks.length} tracks • ${album.durationLabel}`,
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

