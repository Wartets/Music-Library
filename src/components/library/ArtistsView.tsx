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
        const groups = new Map<string, ArtistGroup>();
        const unknownGroup = { name: 'Unknown Artist', tracks: [] as TrackItem[], albums: new Set<string>() };

        for (const track of libraryState.filteredTracks) {
            const rawArtists = track.metadata?.artists;
            const validArtists = Array.isArray(rawArtists)
                ? rawArtists.map(artist => artist?.trim() || '').filter(Boolean)
                : [];
            const albumName = track.metadata?.album?.trim();

            if (validArtists.length === 0) {
                unknownGroup.tracks.push(track);
                if (albumName) unknownGroup.albums.add(albumName.toLowerCase());
                continue;
            }

            for (const artistName of validArtists) {
                const key = artistName.toLowerCase();
                const group = groups.get(key) || { name: artistName, tracks: [], albums: new Set<string>() };
                group.tracks.push(track);
                if (albumName) group.albums.add(albumName.toLowerCase());
                groups.set(key, group);
            }
        }

        if (unknownGroup.tracks.length > 0) {
            groups.set('__unknown__', unknownGroup);
        }

        const sorted = Array.from(groups.values()).sort((a, b) => {
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
