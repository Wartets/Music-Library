import React, { useMemo, useState } from 'react';
import { useLibrary } from '../../contexts/LibraryContext';
import { usePlayer } from '../../contexts/PlayerContext';
import { useUI } from '../../contexts/UIContext';
import { Play, ListPlus, FolderPlus, Calendar, Hash } from 'lucide-react';
import { persistenceService } from '../../services/persistence';
import { CollectionGridView, GridItem } from './CollectionGridView';
import { getMutedVisualStyle, seedFromYear } from '../../utils/collectionVisuals';

interface YearsViewProps {
    onNavigate: (view: any, data: any) => void;
}

export const YearsView: React.FC<YearsViewProps> = ({ onNavigate }) => {
    const { state: libraryState } = useLibrary();
    const { playTrack, addToQueue, addToNext } = usePlayer();
    const { showContextMenu, showToast } = useUI();
    const [sortBy, setSortBy] = useState<'year' | 'count'>('year');

    const years = useMemo(() => {
        const groups: Record<string, any> = {};
        const unknownYearTracks: any[] = [];
        
        libraryState.filteredTracks.forEach(track => {
            const yearRaw = track.metadata?.year;
            
            // Check if year is empty/null/undefined
            if (!yearRaw) {
                unknownYearTracks.push(track);
            } else {
                const yearStr = String(yearRaw).trim();
                if (!yearStr) {
                    unknownYearTracks.push(track);
                } else {
                    const yearNum = parseInt(yearStr);
                    // Valid year should be a valid number in reasonable range
                    if (isNaN(yearNum) || yearNum < 1900 || yearNum > 2100) {
                        unknownYearTracks.push(track);
                    } else {
                        const key = String(yearNum);
                        if (!groups[key]) {
                            groups[key] = {
                                name: String(yearNum),
                                tracks: []
                            };
                        }
                        groups[key].tracks.push(track);
                    }
                }
            }
        });
        
        if (unknownYearTracks.length > 0) {
            groups['__unknown__'] = {
                name: 'Unknown Year',
                tracks: unknownYearTracks
            };
        }

        const sorted = Object.values(groups);
        if (sortBy === 'year') {
            return sorted.sort((a, b) => {
                if (a.name === 'Unknown Year') return 1;
                if (b.name === 'Unknown Year') return -1;
                const yearA = parseInt(a.name) || 0;
                const yearB = parseInt(b.name) || 0;
                return yearB - yearA;
            });
        } else {
            return sorted.sort((a, b) => {
                if (a.name === 'Unknown Year') return 1;
                if (b.name === 'Unknown Year') return -1;
                return b.tracks.length - a.tracks.length || parseInt(b.name) - parseInt(a.name);
            });
        }
    }, [libraryState.filteredTracks, sortBy]);

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
            onClick: () => onNavigate('AllTracks', { filter: { type: 'year', value: yearGroup.name } }),
            onContextMenu: (e) => onRightClick(e, yearGroup)
        };
    });

    return (
        <CollectionGridView
            title="Years"
            subtitle={`${years.length} release years`}
            items={gridItems}
            sortOptions={[
                { id: 'year', label: 'Year', icon: <Calendar size={14} /> },
                { id: 'count', label: 'Track Count', icon: <Hash size={14} /> }
            ]}
            currentSort={sortBy}
            onSortChange={(id) => setSortBy(id as 'year' | 'count')}
        />
    );
};
