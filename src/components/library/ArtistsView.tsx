import React, { useMemo } from 'react';
import { useLibrary } from '../../contexts/LibraryContext';
import { usePlayer } from '../../contexts/PlayerContext';
import { useUI } from '../../contexts/UIContext';
import { TrackItem } from '../../types/music';
import { Play, ListPlus, Plus, FolderPlus, Zap, User } from 'lucide-react';
import { persistenceService } from '../../services/persistence';
import { CollectionGridView, GridItem } from './CollectionGridView';
import { getInitials, getMutedVisualStyle, seedFromArtistName } from '../../utils/collectionVisuals';


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
        let unknownArtistTracks: TrackItem[] = [];

        libraryState.filteredTracks.forEach(track => {
            const artistNames = track.metadata?.artists;
            
            // Check if artists array is empty or falsy
            if (!artistNames || !Array.isArray(artistNames) || artistNames.length === 0) {
                unknownArtistTracks.push(track);
            } else {
                // Filter out empty strings from the array
                const validArtists = artistNames
                    .map(a => (a || '').trim())
                    .filter(a => a.length > 0);
                
                if (validArtists.length === 0) {
                    unknownArtistTracks.push(track);
                } else {
                    validArtists.forEach(artistName => {
                        const key = artistName.toLowerCase();
                        if (!groups[key]) {
                            groups[key] = { name: artistName, tracks: [] };
                        }
                        groups[key].tracks.push(track);
                    });
                }
            }
        });
        
        if (unknownArtistTracks.length > 0) {
            groups['__unknown__'] = { name: 'Unknown Artist', tracks: unknownArtistTracks };
        }

        const sorted = Object.values(groups).sort((a, b) => {
            if (a.name === 'Unknown Artist') return 1;
            if (b.name === 'Unknown Artist') return -1;
            return a.name.localeCompare(b.name);
        });
        
        return sorted;
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

    const gridItems: GridItem[] = artists.map(artist => {
        const palette = getMutedVisualStyle(seedFromArtistName(artist.name));
        const initials = getInitials(artist.name);
        const initialsSizeClass = initials.length > 4 ? 'text-2xl' : 'text-4xl';
        return {
            id: artist.name,
            title: artist.name,
            subtitle: `${artist.tracks.length} tracks reported`,
            visualToken: {
                style: {
                    background: palette.background,
                    borderColor: palette.borderColor
                },
                symbol: (
                    <div className="flex flex-col items-center gap-2">
                        <span className={`${initialsSizeClass} font-black tracking-tight`} style={{ color: palette.accentColor }}>
                            {initials}
                        </span>
                        <User size={18} style={{ color: palette.mutedTextColor }} />
                    </div>
                ),
                label: 'Artist',
            },
            onClick: () => onNavigate('ArtistDetail', artist.name),
            onContextMenu: (e) => onRightClick(e, artist)
        };
    });

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
