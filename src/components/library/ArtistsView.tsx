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
import type { GroupedTracks } from '../../utils/grouping';


interface ArtistGroup {
    name: string;
    tracks: TrackItem[];
    albumCount: number;
}

interface ArtistsViewProps {
    onNavigate: (view: any, data: any) => void;
}

export const ArtistsView: React.FC<ArtistsViewProps> = ({ onNavigate }) => {
    const { state: libraryState } = useLibrary();
    const { playTrack, addToQueue, addToNext } = usePlayer();
    const { showContextMenu, showToast } = useUI();

    const isUnknownArtist = (value: string): boolean => {
        const normalized = value
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();

        return normalized.length === 0 || normalized === '-' || normalized === 'unknown' || normalized === 'unknown artist' || normalized === 'n/a' || normalized === 'na';
    };

    const getAlbumIdentity = (track: TrackItem): string | null => {
        const albumName = track.metadata?.album?.trim() || track.logic?.hierarchy?.album?.trim() || '';
        if (!albumName) {
            return null;
        }

        const albumArtist = track.metadata?.album_artist?.trim()
            || track.metadata?.artists?.[0]?.trim()
            || 'unknown artist';

        return `${albumArtist.toLowerCase()}::${albumName.toLowerCase()}`;
    };

    const artists = useMemo(() => {
        const { groups } = groupTracks(libraryState.filteredTracks, {
            keyExtractor: track => track.metadata?.artists ?? [],
            unknownLabel: 'Unknown Artist',
            isUnknownValue: isUnknownArtist
        });

        return sortGroupsAlphabeticallyWithUnknownLast(groups.values()).map((group: GroupedTracks<TrackItem>) => {
            const albums = new Set<string>();
            group.tracks.forEach(track => {
                const albumId = getAlbumIdentity(track);
                if (albumId) {
                    albums.add(albumId);
                }
            });

            return {
                name: group.name,
                tracks: group.tracks,
                albumCount: albums.size
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
            subtitle: `${artist.tracks.length} tracks • ${artist.albumCount} albums`,
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
