import React, { useMemo, useState } from 'react';
import { useLibrary } from '../../contexts/LibraryContext';
import { usePlayer } from '../../contexts/PlayerContext';
import { useUI } from '../../contexts/UIContext';
import { FileAudio, Hash } from 'lucide-react';
import { CollectionGridView, GridItem } from './CollectionGridView';
import { getMutedVisualStyle, seedFromText } from '../../utils/collectionVisuals';
import { TrackItem } from '../../types/music';
import { groupTracks, sortGroupsAlphabeticallyWithUnknownLast, sortGroupsByCountWithUnknownLast } from '../../utils/grouping';
import { createGroupContextMenu } from '../../utils/contextMenuPresets';

interface FormatsViewProps {
    onNavigate: (view: any, data: any) => void;
}

interface FormatGroup {
    key: string;
    name: string;
    tracks: TrackItem[];
    losslessCount: number;
    lossyCount: number;
}

export const FormatsView: React.FC<FormatsViewProps> = ({ onNavigate }) => {
    const { state: libraryState } = useLibrary();
    const { playTrack, addToQueue, addToNext } = usePlayer();
    const { showContextMenu, showToast } = useUI();
    const [sortBy, setSortBy] = useState<'name' | 'count'>('count');

    const formats = useMemo(() => {
        const { groups } = groupTracks(libraryState.filteredTracks, {
            keyExtractor: track => {
                const rawExt = (track.file?.ext || '').trim();
                return rawExt ? rawExt.toUpperCase() : null;
            },
            unknownLabel: 'UNKNOWN'
        });

        const sortedGroups = sortBy === 'name'
            ? sortGroupsAlphabeticallyWithUnknownLast(groups.values())
            : sortGroupsByCountWithUnknownLast(groups.values());

        return sortedGroups.map(group => ({
            key: group.key,
            name: group.name,
            tracks: group.tracks,
            losslessCount: group.tracks.filter(track => track.audio_specs?.is_lossless).length,
            lossyCount: group.tracks.filter(track => !track.audio_specs?.is_lossless).length
        }));
    }, [libraryState.filteredTracks, sortBy]);

    const onRightClick = (e: React.MouseEvent, fmt: FormatGroup) => {
        e.preventDefault();
        e.stopPropagation();
        showContextMenu(e.clientX, e.clientY, createGroupContextMenu({
            name: fmt.name,
            tracks: fmt.tracks,
            playTrack,
            addToNext,
            addToQueue,
            showToast,
            playLabel: `Play All ${fmt.name}`
        }));
    };

    const gridItems: GridItem[] = formats.map(fmt => {
        const palette = getMutedVisualStyle(seedFromText(fmt.name));
        return {
            id: fmt.name,
            title: fmt.name,
            subtitle: `${fmt.tracks.length} tracks`,
            visualToken: {
                style: {
                    background: palette.background,
                    borderColor: palette.borderColor
                },
symbol: (
                    <div className="flex flex-col items-center justify-center gap-2 max-w-full">
                        <span className="text-2xl sm:text-3xl font-black tracking-tight truncate" style={{ color: palette.accentColor }}>
                            {fmt.name}
                        </span>
                        {fmt.losslessCount > 0 && (
                            <span className="text-[10px] font-black bg-green-500/20 text-green-300 px-2 py-0.5 rounded-full border border-green-400/30 tracking-wider">
                                {fmt.lossyCount > 0 ? 'MIXED LOSSLESS' : 'LOSSLESS'}
                            </span>
                        )}
                    </div>
                ),
                label: 'Format',
                symbolClassName: 'text-white'
            },
            onClick: () => onNavigate('AllTracks', { filter: { type: 'format', value: fmt.name } }),
            onContextMenu: (e) => onRightClick(e, fmt)
        };
    });

    return (
        <CollectionGridView
            title="Formats"
            subtitle={`${formats.length} audio formats`}
            items={gridItems}
            sortOptions={[
                { id: 'name', label: 'Name', icon: <FileAudio size={14} className="inline mr-1" /> },
                { id: 'count', label: 'Count', icon: <Hash size={14} className="inline mr-1" /> }
            ]}
            currentSort={sortBy}
            onSortChange={(id) => setSortBy(id as 'name' | 'count')}
        />
    );
};
