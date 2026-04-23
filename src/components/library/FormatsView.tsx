import React, { useMemo, useState } from 'react';
import { useLibrary } from '../../contexts/LibraryContext';
import { usePlayer } from '../../contexts/PlayerContext';
import { useUI } from '../../contexts/UIContext';
import { Play, ListPlus, FolderPlus, FileAudio, Hash } from 'lucide-react';
import { persistenceService } from '../../services/persistence';
import { CollectionGridView, GridItem } from './CollectionGridView';
import { getMutedVisualStyle, seedFromText } from '../../utils/collectionVisuals';
import { TrackItem } from '../../types/music';

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
    const { playTrack, addToQueue } = usePlayer();
    const { showContextMenu, showToast } = useUI();
    const [sortBy, setSortBy] = useState<'name' | 'count'>('count');

    const formats = useMemo(() => {
        const groupedByFormat = new Map<string, FormatGroup>();

        for (const track of libraryState.filteredTracks) {
            const rawExt = (track.file?.ext || '').trim();
            const ext = rawExt ? rawExt.toUpperCase() : 'UNKNOWN';

            if (!groupedByFormat.has(ext)) {
                groupedByFormat.set(ext, {
                    key: ext,
                    name: ext,
                    tracks: [],
                    losslessCount: 0,
                    lossyCount: 0
                });
            }

            const group = groupedByFormat.get(ext)!;
            group.tracks.push(track);

            if (track.audio_specs?.is_lossless) {
                group.losslessCount += 1;
            } else {
                group.lossyCount += 1;
            }
        }

        const sorted = Array.from(groupedByFormat.values());

        if (sortBy === 'name') {
            sorted.sort((a, b) => a.name.localeCompare(b.name));
            return sorted;
        }

        sorted.sort((a, b) => {
            const countDiff = b.tracks.length - a.tracks.length;
            if (countDiff !== 0) return countDiff;
            return a.name.localeCompare(b.name);
        });

        return sorted;
    }, [libraryState.filteredTracks, sortBy]);

    const runAsyncOperation = (operation: () => void, successMessage: string, errorMessage: string) => {
        window.setTimeout(() => {
            try {
                operation();
                showToast(successMessage, 'success');
            } catch (error) {
                console.error(error);
                showToast(errorMessage, 'error');
            }
        }, 0);
    };

    const onRightClick = (e: React.MouseEvent, fmt: FormatGroup) => {
        e.preventDefault();
        e.stopPropagation();
        const playlists = persistenceService.getPlaylists();

        showContextMenu(e.clientX, e.clientY, [
            {
                label: `Play All ${fmt.name}`,
                icon: <Play size={14} fill="currentColor" />,
                onClick: () => {
                    if (fmt.tracks.length === 0) {
                        showToast(`No tracks available for ${fmt.name}`, 'error');
                        return;
                    }
                    playTrack(fmt.tracks[0], fmt.tracks);
                }
            },
            {
                label: 'Add to Queue',
                icon: <ListPlus size={14} />,
                onClick: () => {
                    showToast(`Adding ${fmt.tracks.length} tracks to queue...`);
                    runAsyncOperation(
                        () => {
                            fmt.tracks.forEach(track => addToQueue(track));
                        },
                        `Added ${fmt.tracks.length} tracks to queue`,
                        `Failed to add ${fmt.name} tracks to queue`
                    );
                }
            },
            { divider: true, label: '', onClick: () => { } },
            {
                label: 'Add to Playlist', icon: <FolderPlus size={14} />, onClick: () => { },
                subItems: playlists.map(pl => ({
                    label: pl.name,
                    onClick: () => {
                        showToast(`Adding ${fmt.tracks.length} tracks to ${pl.name}...`);
                        runAsyncOperation(
                            () => {
                                for (const track of fmt.tracks) {
                                    persistenceService.addTrackToPlaylist(pl.id, track.logic.hash_sha256);
                                }
                            },
                            `Added ${fmt.tracks.length} ${fmt.name} tracks to ${pl.name}`,
                            `Failed to add ${fmt.name} tracks to ${pl.name}`
                        );
                    }
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
