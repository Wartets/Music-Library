import React, { useMemo, useState } from 'react';
import { useLibrary } from '../../contexts/LibraryContext';
import { usePlayer } from '../../contexts/PlayerContext';
import { useUI } from '../../contexts/UIContext';
import {
    Play, ListPlus, FolderPlus, Filter, Hash, AudioWaveform, Circle,
    Diamond, Disc3, Film, Mic2, Music, Radio, Square, Triangle, Waves, Zap
} from 'lucide-react';
import { persistenceService } from '../../services/persistence';
import { CollectionGridView, GridItem } from './CollectionGridView';
import { getMutedVisualStyle, seedFromText } from '../../utils/collectionVisuals';

interface GenresViewProps {
    onNavigate: (view: any, data: any) => void;
}

const getGenreSymbol = (genreName: string, accentColor: string): React.ReactNode => {
    const normalized = (genreName || '').toLowerCase();
    const sharedStyle = { color: accentColor };

    if (normalized.includes('rock') || normalized.includes('metal') || normalized.includes('punk')) {
        return <Zap size={44} style={sharedStyle} />;
    }
    if (normalized.includes('hip hop') || normalized.includes('hip-hop') || normalized.includes('rap') || normalized.includes('r&b')) {
        return <Mic2 size={44} style={sharedStyle} />;
    }
    if (normalized.includes('electro') || normalized.includes('edm') || normalized.includes('techno') || normalized.includes('house') || normalized.includes('dance')) {
        return <Radio size={44} style={sharedStyle} />;
    }
    if (normalized.includes('jazz') || normalized.includes('blues') || normalized.includes('soul')) {
        return <Disc3 size={44} style={sharedStyle} />;
    }
    if (normalized.includes('classical') || normalized.includes('orchestra') || normalized.includes('opera')) {
        return <Music size={44} style={sharedStyle} />;
    }
    if (normalized.includes('ambient') || normalized.includes('chill') || normalized.includes('new age')) {
        return <Waves size={44} style={sharedStyle} />;
    }
    if (normalized.includes('soundtrack') || normalized.includes('score') || normalized.includes('cinematic')) {
        return <Film size={44} style={sharedStyle} />;
    }
    if (normalized.includes('pop')) {
        return <AudioWaveform size={44} style={sharedStyle} />;
    }

    const shapes = [Circle, Square, Triangle, Diamond];
    const ShapeIcon = shapes[seedFromText(genreName) % shapes.length];
    return <ShapeIcon size={44} style={sharedStyle} />;
};

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

    const gridItems: GridItem[] = genres.map(genre => {
        const palette = getMutedVisualStyle(seedFromText(genre.name));
        return {
            id: genre.name,
            title: genre.name,
            subtitle: `${genre.tracks.length} tracks`,
            visualToken: {
                style: {
                    background: palette.background,
                    borderColor: palette.borderColor
                },
                symbol: getGenreSymbol(genre.name, palette.accentColor),
                label: 'Genre',
                labelClassName: 'text-[10px] font-bold uppercase tracking-[0.18em]',
            },
            onClick: () => onNavigate('AllTracks', { filter: { type: 'genre', value: genre.name } }),
            onContextMenu: (e) => onRightClick(e, genre)
        };
    });

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
