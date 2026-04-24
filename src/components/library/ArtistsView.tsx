import React, { useMemo } from 'react';
import { useLibrary } from '../../contexts/LibraryContext';
import { usePlayer } from '../../contexts/PlayerContext';
import { useUI } from '../../contexts/UIContext';
import { TrackItem } from '../../types/music';
import { User } from 'lucide-react';
import { CollectionGridView, GridItem } from './CollectionGridView';
import { getInitials, getMutedVisualStyle, seedFromArtistName } from '../../utils/collectionVisuals';
import { groupTracks, sortGroupsAlphabeticallyWithUnknownLast } from '../../utils/grouping';
import { createGroupContextMenu } from '../../utils/contextMenuPresets';


interface ArtistGroup {
    name: string;
    tracks: TrackItem[];
    albums: Set<string>;
}

interface ArtistsViewProps {
    onNavigate: (view: any, data: any) => void;
}

export const ArtistsView: React.FC<ArtistsViewProps> = ({ onNavigate }) => {
    const { state: libraryState } = useLibrary();
    const { playTrack, addToQueue, addToNext } = usePlayer();
    const { showContextMenu, showToast } = useUI();

    const artists = useMemo(() => {
        const { groups } = groupTracks(libraryState.filteredTracks, {
            keyExtractor: track => track.metadata?.artists ?? [],
            unknownLabel: 'Unknown Artist'
        });

        return sortGroupsAlphabeticallyWithUnknownLast(groups.values()).map(group => {
            const albums = new Set<string>();
            group.tracks.forEach(track => {
                const albumName = track.metadata?.album?.trim();
                if (albumName) {
                    albums.add(albumName.toLowerCase());
                }
            });

            return {
                name: group.name,
                tracks: group.tracks,
                albums
            };
        });
    }, [libraryState.filteredTracks]);

    const onRightClick = (e: React.MouseEvent, artist: ArtistGroup) => {
        e.preventDefault();
        e.stopPropagation();
        showContextMenu(e.clientX, e.clientY, createGroupContextMenu({
            name: artist.name,
            tracks: artist.tracks,
            playTrack,
            addToNext,
            addToQueue,
            showToast,
            playLabel: `Play Artist: ${artist.name}`,
            playNextLabel: 'Listen Next',
            addToQueueLabel: 'Add All to Queue',
            addToPlaylistLabel: 'Add Artist to Playlist',
            createPlaylistLabel: 'Create Playlist from Artist',
            createPlaylistName: `${artist.name} Collection`
        }));
    };

    const gridItems: GridItem[] = artists.map(artist => {
        const palette = getMutedVisualStyle(seedFromArtistName(artist.name));
        const initials = getInitials(artist.name);
        const initialsSizeClass = initials.length > 4 ? 'text-2xl' : 'text-4xl';
        return {
            id: artist.name,
            title: artist.name,
            subtitle: `${artist.tracks.length} tracks • ${artist.albums.size} albums`,
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
