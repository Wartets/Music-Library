import React, { useMemo, useState } from 'react';
import { useLibrary } from '../../contexts/LibraryContext';
import { usePlayer } from '../../contexts/PlayerContext';
import { useUI } from '../../contexts/UIContext';
import { Play, ListPlus, FolderPlus, FileAudio, Hash } from 'lucide-react';
import { persistenceService } from '../../services/persistence';
import { CollectionGridView, GridItem } from './CollectionGridView';
import { getMutedVisualStyle, seedFromText } from '../../utils/collectionVisuals';

interface FormatsViewProps {
    onNavigate: (view: any, data: any) => void;
}

export const FormatsView: React.FC<FormatsViewProps> = ({ onNavigate }) => {
    const { state: libraryState } = useLibrary();
    const { playTrack, addToQueue } = usePlayer();
    const { showContextMenu, showToast } = useUI();
    const [sortBy, setSortBy] = useState<'name' | 'count'>('count');

    const formats = useMemo(() => {
        const groups: Record<string, { name: string, tracks: any[], isLossless: boolean }> = {};
        libraryState.filteredTracks.forEach(track => {
            const ext = (track.file?.ext || 'unknown').toUpperCase();
            if (!groups[ext]) {
                groups[ext] = { name: ext, tracks: [], isLossless: !!track.audio_specs?.is_lossless };
            }
            groups[ext].tracks.push(track);
        });

        const sorted = Object.values(groups);
        if (sortBy === 'name') return sorted.sort((a, b) => a.name.localeCompare(b.name));
        return sorted.sort((a, b) => b.tracks.length - a.tracks.length);
    }, [libraryState.filteredTracks, sortBy]);

    const onRightClick = (e: React.MouseEvent, fmt: any) => {
        e.preventDefault();
        e.stopPropagation();
        const playlists = persistenceService.getPlaylists();

        showContextMenu(e.clientX, e.clientY, [
            { label: `Play All ${fmt.name}`, icon: <Play size={14} fill="currentColor" />, onClick: () => { playTrack(fmt.tracks[0], fmt.tracks); } },
            { label: 'Add to Queue', icon: <ListPlus size={14} />, onClick: () => { fmt.tracks.forEach((t: any) => addToQueue(t)); showToast(`Added ${fmt.tracks.length} tracks`); } },
            { divider: true, label: '', onClick: () => { } },
            {
                label: 'Add to Playlist', icon: <FolderPlus size={14} />, onClick: () => { },
                subItems: playlists.map(pl => ({
                    label: pl.name, onClick: () => { fmt.tracks.forEach((t: any) => persistenceService.addTrackToPlaylist(pl.id, t.logic.hash_sha256)); showToast(`Added to ${pl.name}`, 'success'); }
                }))
            },
        ]);
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
                        {fmt.isLossless && (
                            <span className="text-[10px] font-black bg-green-500/20 text-green-300 px-2 py-0.5 rounded-full border border-green-400/30 tracking-wider">
                                LOSSLESS
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
