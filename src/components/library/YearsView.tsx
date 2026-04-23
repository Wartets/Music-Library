import React, { useMemo, useState } from 'react';
import { useLibrary } from '../../contexts/LibraryContext';
import { usePlayer } from '../../contexts/PlayerContext';
import { useUI } from '../../contexts/UIContext';
import { Play, ListPlus, FolderPlus, Calendar, Hash, CalendarRange } from 'lucide-react';
import { persistenceService } from '../../services/persistence';
import { CollectionGridView, GridItem } from './CollectionGridView';
import { getMutedVisualStyle, seedFromYear } from '../../utils/collectionVisuals';
import { groupTracks } from '../../utils/grouping';

interface YearsViewProps {
    onNavigate: (view: any, data: any) => void;
}

export const YearsView: React.FC<YearsViewProps> = ({ onNavigate }) => {
    const { state: libraryState } = useLibrary();
    const { playTrack, addToQueue, addToNext } = usePlayer();
    const { showContextMenu, showToast } = useUI();
    const [groupBy, setGroupBy] = useState<'year' | 'decade'>('year');
    const [sortBy, setSortBy] = useState<'year' | 'count'>('year');

    const parseYear = (value: string | null | undefined): number | null => {
        const year = parseInt(String(value || '').trim(), 10);
        if (Number.isNaN(year) || year < 1900 || year > 2100) {
            return null;
        }
        return year;
    };

    const years = useMemo(() => {
        const grouped = groupTracks(libraryState.filteredTracks, {
            getValues: (track) => {
                const parsedYear = parseYear(track.metadata?.year);
                if (parsedYear === null) {
                    return null;
                }

                if (groupBy === 'decade') {
                    const decade = Math.floor(parsedYear / 10) * 10;
                    return `${decade}s`;
                }

                return String(parsedYear);
            },
            unknownLabel: 'Unknown Year'
        });

        const sorted = [...grouped];
        if (sortBy === 'year') {
            return sorted.sort((a, b) => {
                if (a.isUnknown) return 1;
                if (b.isUnknown) return -1;
                const yearA = parseInt(a.name, 10) || 0;
                const yearB = parseInt(b.name, 10) || 0;
                return yearB - yearA || a.name.localeCompare(b.name);
            });
        } else {
            return sorted.sort((a, b) => {
                if (a.isUnknown) return 1;
                if (b.isUnknown) return -1;
                return b.tracks.length - a.tracks.length || (parseInt(b.name, 10) - parseInt(a.name, 10));
            });
        }
    }, [groupBy, libraryState.filteredTracks, sortBy]);

    const onRightClick = (e: React.MouseEvent, yearGroup: any) => {
        e.preventDefault();
        e.stopPropagation();
        const playlists = persistenceService.getPlaylists();

        showContextMenu(e.clientX, e.clientY, [
            {
                label: `Play Year: ${yearGroup.name}`,
                icon: <Play size={14} fill="currentColor" />,
                onClick: () => {
                    playTrack(yearGroup.tracks[0], yearGroup.tracks);
                    showToast(`Playing year: ${yearGroup.name}`);
                }
            },
            {
                label: 'Play Next',
                icon: <Play size={14} className="text-dominant-light" />,
                onClick: () => {
                    [...yearGroup.tracks].reverse().forEach((t: any) => addToNext(t));
                    showToast(`Year ${yearGroup.name} will play next`, 'success');
                }
            },
            {
                label: 'Add to Queue',
                icon: <ListPlus size={14} />,
                onClick: () => {
                    yearGroup.tracks.forEach((t: any) => addToQueue(t));
                    showToast(`Added ${yearGroup.tracks.length} tracks to queue`);
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
                        yearGroup.tracks.forEach((t: any) => persistenceService.addTrackToPlaylist(pl.id, t.logic.hash_sha256));
                        showToast(`Added year to ${pl.name}`, 'success');
                    }
                }))
            },
            { divider: true, label: '', onClick: () => { } },
            {
                label: 'Save as New Playlist',
                icon: <FolderPlus size={14} />,
                onClick: () => {
                    const newPl = persistenceService.createPlaylist(yearGroup.name);
                    yearGroup.tracks.forEach((t: any) => persistenceService.addTrackToPlaylist(newPl.id, t.logic.hash_sha256));
                    showToast(`Created playlist "${yearGroup.name}"`, 'success');
                }
            }
        ]);
    };

    const gridItems: GridItem[] = years.map(yearGroup => {
        const palette = getMutedVisualStyle(seedFromYear(yearGroup.name));
        const filterValue = yearGroup.name;
        return {
            id: yearGroup.name,
            title: yearGroup.name,
            subtitle: `${yearGroup.tracks.length} tracks`,
            visualToken: {
                style: {
                    background: palette.background,
                    borderColor: palette.borderColor
                },
                symbol: (
                    <span className="font-black tracking-tight" style={{ color: palette.accentColor }}>
                        {yearGroup.name === 'Unknown Year' ? '?' : yearGroup.name.slice(-2)}
                    </span>
                ),
                label: yearGroup.name === 'Unknown Year' ? 'Unknown' : 'Year',
                symbolClassName: 'text-5xl leading-none'
            },
            onClick: () => onNavigate('AllTracks', { filter: { type: 'year', value: filterValue } }),
            onContextMenu: (e) => onRightClick(e, yearGroup)
        };
    });

    return (
        <CollectionGridView
            title="Years"
            subtitle={`${years.length} release years`}
            items={gridItems}
            sortOptions={[
                { id: 'group-year', label: 'By Year', icon: <Calendar size={14} /> },
                { id: 'group-decade', label: 'By Decade', icon: <CalendarRange size={14} /> },
                { id: 'year', label: 'Year', icon: <Calendar size={14} /> },
                { id: 'count', label: 'Track Count', icon: <Hash size={14} /> }
            ]}
            currentSort={groupBy === 'year' ? sortBy : `group-${groupBy}`}
            onSortChange={(id) => {
                if (id === 'group-year') {
                    setGroupBy('year');
                    return;
                }
                if (id === 'group-decade') {
                    setGroupBy('decade');
                    return;
                }
                setSortBy(id as 'year' | 'count');
            }}
        />
    );
};
