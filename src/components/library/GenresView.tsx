import React, { useMemo, useState } from 'react';
import { useLibrary } from '../../contexts/LibraryContext';
import { usePlayer } from '../../contexts/PlayerContext';
import { useUI } from '../../contexts/UIContext';
import { Play, ListPlus, FolderPlus, Tags, Filter, Hash } from 'lucide-react';
import { persistenceService } from '../../services/persistence';
import { CollectionGridView, GridItem } from './CollectionGridView';

interface GenresViewProps {
    onNavigate: (view: any, data: any) => void;
}

export const GenresView: React.FC<GenresViewProps> = ({ onNavigate }) => {
    const { state: libraryState } = useLibrary();
    const { playTrack, addToQueue, addToNext } = usePlayer();
    const { showContextMenu, showToast } = useUI();
    const [sortBy, setSortBy] = useState<'name' | 'count'>('name');

    const genres = useMemo(() => {
        const groups: Record<string, { name: string, tracks: any[] }> = {};
        libraryState.filteredTracks.forEach(track => {
            let trackGenresRaw = track.metadata?.genre;
            let trackGenres: string[] = [];
            if (!Array.isArray(trackGenresRaw)) {
                trackGenres = trackGenresRaw ? [trackGenresRaw as string] : ['Unknown Genre'];
            } else {
                trackGenres = trackGenresRaw as string[];
            }
            trackGenres.forEach((genreName: string) => {
                if (!groups[genreName]) {
                    groups[genreName] = {
                        name: genreName,
                        tracks: []
                    };
                }
                groups[genreName].tracks.push(track);
            });
        });

        const sorted = Object.values(groups);
        if (sortBy === 'name') {
            return sorted.sort((a, b) => a.name.localeCompare(b.name));
        } else {
            return sorted.sort((a, b) => b.tracks.length - a.tracks.length || a.name.localeCompare(b.name));
        }
    }, [libraryState.filteredTracks, sortBy]);

    const onRightClick = (e: React.MouseEvent, genreGroup: any) => {
        e.preventDefault();
        e.stopPropagation();
        const playlists = persistenceService.getPlaylists();

        showContextMenu(e.clientX, e.clientY, [
            {
                label: `Play Genre: ${genreGroup.name}`,
                icon: <Play size={14} fill="currentColor" />,
                onClick: () => {
                    playTrack(genreGroup.tracks[0], genreGroup.tracks);
                    showToast(`Playing genre: ${genreGroup.name}`);
                }
            },
            {
                label: 'Play Next',
                icon: <Play size={14} className="text-dominant-light" />,
                onClick: () => {
                    [...genreGroup.tracks].reverse().forEach((t: any) => addToNext(t));
                    showToast(`Genre ${genreGroup.name} will play next`, 'success');
                }
            },
            {
                label: 'Add to Queue',
                icon: <ListPlus size={14} />,
                onClick: () => {
                    genreGroup.tracks.forEach((t: any) => addToQueue(t));
                    showToast(`Added ${genreGroup.tracks.length} tracks to queue`);
                }
            },
            { divider: true, label: '', onClick: () => { } },
            {
                label: 'Add to Playlist',
                icon: <FolderPlus size={14} />,
                onClick: () => { },
                subItems: playlists.map(pl => ({
                    label: pl.name,
                    onClick: () => {
                        genreGroup.tracks.forEach((t: any) => persistenceService.addTrackToPlaylist(pl.id, t.logic.hash_sha256));
                        showToast(`Added genre to ${pl.name}`, 'success');
                    }
                }))
            },
            { divider: true, label: '', onClick: () => { } },
            {
                label: 'Save as New Playlist',
                icon: <FolderPlus size={14} />,
                onClick: () => {
                    const newPl = persistenceService.createPlaylist(genreGroup.name);
                    genreGroup.tracks.forEach((t: any) => persistenceService.addTrackToPlaylist(newPl.id, t.logic.hash_sha256));
                    showToast(`Created playlist "${genreGroup.name}"`, 'success');
                }
            }
        ]);
    };

    const gridItems: GridItem[] = genres.map(genre => ({
        id: genre.name,
        title: genre.name,
        subtitle: `${genre.tracks.length} tracks`,
        icon: <Tags size={48} className="text-white/20 group-hover:text-dominant transition-colors group-hover:scale-110 duration-700" />,
        onClick: () => onNavigate('AllTracks', { filter: { type: 'genre', value: genre.name } }),
        onContextMenu: (e) => onRightClick(e, genre)
    }));

    return (
        <CollectionGridView
            title="Genres"
            subtitle={`${genres.length} categories`}
            items={gridItems}
            sortOptions={[
                { id: 'name', label: 'Name', icon: <Filter size={14} /> },
                { id: 'count', label: 'Track Count', icon: <Hash size={14} /> }
            ]}
            currentSort={sortBy}
            onSortChange={(id) => setSortBy(id as 'name' | 'count')}
        />
    );
};
