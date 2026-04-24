import React, { useMemo, useState } from 'react';
import { useLibrary } from '../../contexts/LibraryContext';
import { usePlayer } from '../../contexts/PlayerContext';
import { useUI } from '../../contexts/UIContext';
import { FolderOpen, Hash } from 'lucide-react';
import { CollectionGridView, GridItem } from './CollectionGridView';
import { getMutedVisualStyle, seedFromText } from '../../utils/collectionVisuals';
import { groupTracks } from '../../utils/grouping';
import {
    getDirectChildPath,
    getParentPath,
    isPathWithin,
    normalizePath,
    getPathBasename,
} from '../../utils/pathUtils';
import { TrackItem } from '../../types/music';
import { createGroupContextMenu } from '../../utils/contextMenuPresets';
import { getBestArtwork } from '../../utils/artworkResolver';
import type { GroupedTracks } from '../../utils/grouping';

interface FoldersViewProps {
    onNavigate: (view: any, data: any) => void;
}

interface FolderNode {
    path: string;
    name: string;
    tracks: TrackItem[];
    hasChildren: boolean;
    directTrackCount: number;
}

export const FoldersView: React.FC<FoldersViewProps> = ({ onNavigate }) => {
    const { state: libraryState } = useLibrary();
    const { playTrack, addToQueue, addToNext } = usePlayer();
    const { showContextMenu, showToast } = useUI();
    const [currentPath, setCurrentPath] = useState('');
    const [sortBy, setSortBy] = useState<'name' | 'count'>('name');
    const normalizedCurrentPath = useMemo(() => normalizePath(currentPath), [currentPath]);

    const folders = useMemo(() => {
        const { groups } = groupTracks(libraryState.filteredTracks, {
            keyExtractor: (track) => track.file?.dir,
            unknownLabel: 'Unknown Folder',
            normalizeKey: (value) => normalizePath(value).toLowerCase(),
            nameResolver: (value) => normalizePath(value),
            isUnknownValue: (value) => normalizePath(value).length === 0,
        });

        const nodes = new Map<string, FolderNode>();

        for (const group of groups.values() as Iterable<GroupedTracks<TrackItem>>) {
            if (group.isUnknown) {
                continue;
            }

            const normalizedGroupPath = group.name;
            const childPath = getDirectChildPath(normalizedCurrentPath, normalizedGroupPath);
            if (!childPath) {
                continue;
            }

            if (!nodes.has(childPath)) {
                nodes.set(childPath, {
                    path: childPath,
                    name: getPathBasename(childPath),
                    tracks: [],
                    hasChildren: false,
                    directTrackCount: 0,
                });
            }

            const node = nodes.get(childPath)!;
            node.tracks.push(...group.tracks);

            if (normalizedGroupPath === childPath) {
                node.directTrackCount += group.tracks.length;
            }

            if (normalizedGroupPath !== childPath && isPathWithin(childPath, normalizedGroupPath)) {
                node.hasChildren = true;
            }
        }

        const sorted = Array.from(nodes.values());
        if (sortBy === 'name') {
            return sorted.sort((a, b) => a.name.localeCompare(b.name));
        }
        return sorted.sort((a, b) => b.tracks.length - a.tracks.length || a.name.localeCompare(b.name));
    }, [libraryState.filteredTracks, normalizedCurrentPath, sortBy]);

    const onRightClick = (e: React.MouseEvent, folder: FolderNode) => {
        e.preventDefault();
        e.stopPropagation();
        showContextMenu(e.clientX, e.clientY, createGroupContextMenu({
            name: folder.name,
            tracks: folder.tracks,
            playTrack,
            addToNext,
            addToQueue,
            showToast,
            playLabel: 'Play Folder',
            extraItems: [
                {
                    label: 'Open Folder Tracks',
                    icon: <FolderOpen size={14} />,
                    onClick: () => onNavigate('AllTracks', { filter: { type: 'folder', value: folder.path } })
                }
            ]
        }));
    };

    const parentPath = getParentPath(normalizedCurrentPath);

    const gridItems: GridItem[] = [
        ...(currentPath ? [{
            id: '__parent__',
            title: parentPath ? getPathBasename(parentPath) : 'Library Root',
            subtitle: 'Go to parent folder',
            visualToken: {
                style: {
                    background: 'linear-gradient(145deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))',
                    borderColor: 'rgba(255,255,255,0.2)'
                },
                symbol: <FolderOpen size={44} className="text-white/80" />,
                label: 'Up',
            },
            onClick: () => setCurrentPath(parentPath),
            onContextMenu: (_e: React.MouseEvent) => { },
        }] : []),
        ...folders.map(folder => {
            const palette = getMutedVisualStyle(seedFromText(folder.path));
            const firstArtworkTrack = folder.tracks.find((t: TrackItem) =>
                t.artworks?.track_artwork?.length || t.artworks?.album_artwork?.length
            );
            const artworkDetails = getBestArtwork(firstArtworkTrack);

            return {
                id: folder.path,
                title: folder.name,
                subtitle: folder.hasChildren
                    ? `${folder.tracks.length} tracks • ${folder.directTrackCount} here`
                    : `${folder.tracks.length} tracks`,
                imageDetails: artworkDetails,
                visualToken: artworkDetails ? undefined : {
                    style: {
                        background: palette.background,
                        borderColor: palette.borderColor
                    },
                    symbol: <FolderOpen size={44} style={{ color: palette.accentColor }} />,
                    label: 'Folder',
                },
                onClick: () => {
                    if (folder.hasChildren) {
                        setCurrentPath(folder.path);
                        return;
                    }
                    onNavigate('AllTracks', { filter: { type: 'folder', value: folder.path } });
                },
                onContextMenu: (e: React.MouseEvent) => onRightClick(e, folder)
            };
        })
    ];

    return (
        <CollectionGridView
            title={normalizedCurrentPath ? `Folders · ${normalizedCurrentPath}` : 'Folders'}
            subtitle={currentPath ? `${folders.length} directories in this level` : `${folders.length} root directories`}
            items={gridItems}
            sortOptions={[
                { id: 'name', label: 'Name', icon: <FolderOpen size={14} className="inline mr-1" /> },
                { id: 'count', label: 'Count', icon: <Hash size={14} className="inline mr-1" /> }
            ]}
            currentSort={sortBy}
            onSortChange={(id) => setSortBy(id as 'name' | 'count')}
        />
    );
};
