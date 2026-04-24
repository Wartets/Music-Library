import React, { useMemo, useState } from 'react';
import { useLibrary } from '../../contexts/LibraryContext';
import { usePlayer } from '../../contexts/PlayerContext';
import { useUI } from '../../contexts/UIContext';
import { Calendar, Hash, CalendarRange } from 'lucide-react';
import { CollectionGridView, GridItem } from './CollectionGridView';
import { getMutedVisualStyle, seedFromYear } from '../../utils/collectionVisuals';
import { groupTracks, sortGroupsByCountWithUnknownLast, sortGroupsAlphabeticallyWithUnknownLast } from '../../utils/grouping';
import { createGroupContextMenu } from '../../utils/contextMenuPresets';
import type { TrackItem } from '../../types/music';
import type { GroupedTracks } from '../../utils/grouping';

interface YearsViewProps {
    onNavigate: (view: any, data: any) => void;
}

export const YearsView: React.FC<YearsViewProps> = ({ onNavigate }) => {
    const { state: libraryState } = useLibrary();
    const { playTrack, addToQueue, addToNext } = usePlayer();
    const { showContextMenu, showToast } = useUI();
    const [groupBy, setGroupBy] = useState<'year' | 'decade'>('year');
    const [sortBy, setSortBy] = useState<'year' | 'count'>('year');

    const parseGroupStartYear = (value: string): number => {
        const cleaned = value.trim().toLowerCase() === 'unknown year'
            ? ''
            : value.replace(/s$/i, '');

        const parsed = parseInt(cleaned, 10);
        return Number.isNaN(parsed) ? -Infinity : parsed;
    };

    const parseYear = (value: string | null | undefined): number | null => {
        const year = parseInt(String(value || '').trim(), 10);
        if (Number.isNaN(year) || year < 1900 || year > 2100) {
            return null;
        }
        return year;
    };

    const years = useMemo(() => {
        const { groups } = groupTracks(libraryState.filteredTracks, {
            keyExtractor: (track) => {
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

        if (sortBy === 'year') {
            return sortGroupsAlphabeticallyWithUnknownLast(groups.values(), (a, b) => {
                const yearA = parseGroupStartYear(a.name);
                const yearB = parseGroupStartYear(b.name);
                return yearB - yearA || a.name.localeCompare(b.name);
            });
        }

        return sortGroupsByCountWithUnknownLast(groups.values(), (a, b) => {
            const yearA = parseGroupStartYear(a.name);
            const yearB = parseGroupStartYear(b.name);
            return yearB - yearA;
        });
    }, [groupBy, libraryState.filteredTracks, sortBy]);

    const onRightClick = (e: React.MouseEvent, yearGroup: GroupedTracks<TrackItem>) => {
        e.preventDefault();
        e.stopPropagation();
        showContextMenu(e.clientX, e.clientY, createGroupContextMenu({
            name: yearGroup.name,
            tracks: yearGroup.tracks,
            playTrack,
            addToNext,
            addToQueue,
            showToast,
            playLabel: `Play Year: ${yearGroup.name}`
        }));
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
