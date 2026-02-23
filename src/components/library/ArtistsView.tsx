import React, { useMemo } from 'react';
import { useLibrary } from '../../contexts/LibraryContext';
import { usePlayer } from '../../contexts/PlayerContext';
import { useUI } from '../../contexts/UIContext';
import { TrackItem } from '../../types/music';
import { Play, ListPlus, Plus, FolderPlus, Zap, User } from 'lucide-react';
import { persistenceService } from '../../services/persistence';
import { CollectionGridView, GridItem } from './CollectionGridView';


interface ArtistGroup {
    name: string;
    tracks: TrackItem[];
}

interface ArtistsViewProps {
    onNavigate: (view: any, data: any) => void;
}

export const ArtistsView: React.FC<ArtistsViewProps> = ({ onNavigate }) => {
    const { state: libraryState } = useLibrary();
    const { playTrack, addToQueue, addToNext } = usePlayer();
    const { showContextMenu, showToast } = useUI();

    const artists = useMemo(() => {
        const groups: Record<string, ArtistGroup> = {};

        libraryState.filteredTracks.forEach(track => {
            const artistNames = track.metadata?.artists || ['Unknown Artist'];
            artistNames.forEach(artistName => {
                if (!groups[artistName]) {
                    groups[artistName] = { name: artistName, tracks: [] };
                }
                groups[artistName].tracks.push(track);
            });
        });

        return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name));
    }, [libraryState.filteredTracks]);

    const onRightClick = (e: React.MouseEvent, artist: ArtistGroup) => {
        e.preventDefault();
        e.stopPropagation();
        const playlists = persistenceService.getPlaylists();

        showContextMenu(e.clientX, e.clientY, [
            {
                label: `Play Artist: ${artist.name}`,
                icon: <Play size={14} fill="currentColor" />,
                onClick: () => {
                    if (artist.tracks.length > 0) {
                        playTrack(artist.tracks[0], artist.tracks);
                        showToast(`Playing artist: ${artist.name}`);
                    }
                }
            },
            {
                label: 'Listen Next',
                icon: <Zap size={14} className="text-dominant-light" />,
                onClick: () => {
                    [...artist.tracks].reverse().forEach(t => addToNext(t));
                    showToast(`${artist.name}'s library added to next up`, 'success');
                }
            },
            {
                label: 'Add All to Queue',
                icon: <ListPlus size={14} />,
                onClick: () => {
                    artist.tracks.forEach(t => addToQueue(t));
                    showToast(`Added ${artist.tracks.length} tracks to queue`);
                }
            },
            { divider: true, label: '', onClick: () => { } },
            {
                label: 'Add Artist to Playlist',
                icon: <Plus size={14} />,
                onClick: () => { },
                subItems: playlists.map(pl => ({
                    label: pl.name,
                    onClick: () => {
                        artist.tracks.forEach(t => persistenceService.addTrackToPlaylist(pl.id, t.logic.hash_sha256));
                        showToast(`Added artist to ${pl.name}`, 'success');
                    }
                }))
            },
            { divider: true, label: '', onClick: () => { } },
            {
                label: 'Create Playlist from Artist',
                icon: <FolderPlus size={14} />,
                onClick: () => {
                    const newPl = persistenceService.createPlaylist(`${artist.name} Collection`);
                    artist.tracks.forEach(t => persistenceService.addTrackToPlaylist(newPl.id, t.logic.hash_sha256));
                    showToast(`Created playlist for ${artist.name}`, 'success');
                }
            },
        ]);
    };

    const gridItems: GridItem[] = artists.map(artist => ({
        id: artist.name,
        title: artist.name,
        subtitle: `${artist.tracks.length} tracks reported`,
        imageDetails: artist.tracks[0]?.artworks?.album_artwork?.[0] || artist.tracks[0]?.artworks?.track_artwork?.[0],
        icon: <User size={48} className="text-white/20 group-hover:text-dominant transition-colors group-hover:scale-110 duration-700" />,
        onClick: () => onNavigate('ArtistDetail', artist.name),
        onContextMenu: (e) => onRightClick(e, artist)
    }));

    return (
        <CollectionGridView
            title="Artists"
            subtitle={`${artists.length} performers`}
            items={gridItems}
            sortOptions={[]}
            currentSort=""
            onSortChange={() => { }}
        />
    );
};
