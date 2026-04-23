import React, { useMemo, useState } from 'react';
import { useLibrary } from '../../contexts/LibraryContext';
import { usePlayer } from '../../contexts/PlayerContext';
import { useUI } from '../../contexts/UIContext';
import { Play, ListPlus, FolderPlus, FolderOpen, Hash } from 'lucide-react';
import { persistenceService } from '../../services/persistence';
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
    const { playTrack, addToQueue } = usePlayer();
    const { showContextMenu, showToast } = useUI();
    const [currentPath, setCurrentPath] = useState('');
    const [sortBy, setSortBy] = useState<'name' | 'count'>('name');

    const folders = useMemo(() => {
        const groupedFolders = groupTracks(libraryState.filteredTracks, {
            getValues: (track) => normalizePath(track.file?.dir),
            unknownLabel: 'Unknown Folder',
            normalizeKey: (value) => normalizePath(value).toLowerCase(),
            isUnknownValue: (value) => normalizePath(value).length === 0,
        });

        const nodes = new Map<string, FolderNode>();

        for (const group of groupedFolders) {
            if (group.isUnknown) {
                continue;
            }

            const normalizedGroupPath = normalizePath(group.name);
            const childPath = getDirectChildPath(currentPath, normalizedGroupPath);
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
    }, [currentPath, libraryState.filteredTracks, sortBy]);

    const onRightClick = (e: React.MouseEvent, folder: FolderNode) => {
        e.preventDefault();
        e.stopPropagation();
        const playlists = persistenceService.getPlaylists();

        showContextMenu(e.clientX, e.clientY, [
            {
                label: `Play Folder`,
                icon: <Play size={14} fill="currentColor" />,
                onClick: () => {
                    if (folder.tracks.length === 0) {
                        showToast(`No tracks in ${folder.name}`, 'error');
                        return;
                    }
                    playTrack(folder.tracks[0], folder.tracks);
                    showToast(`Playing folder: ${folder.name}`);
                }
            },
            {
                label: 'Open Folder Tracks',
                icon: <FolderOpen size={14} />,
                onClick: () => onNavigate('AllTracks', { filter: { type: 'folder', value: folder.path } })
            },
            {
                label: 'Add to Queue',
                icon: <ListPlus size={14} />,
                onClick: () => {
                    folder.tracks.forEach((t: TrackItem) => addToQueue(t));
                    showToast(`Added ${folder.tracks.length} tracks`);
                }
            },
            { divider: true, label: '', onClick: () => { } },
            {
                label: 'Add to Playlist', icon: <FolderPlus size={14} />, onClick: () => { },
                subItems: playlists.map(pl => ({
                    label: pl.name,
                    onClick: () => {
                        folder.tracks.forEach((t: TrackItem) => persistenceService.addTrackToPlaylist(pl.id, t.logic.hash_sha256));
                        showToast(`Added to ${pl.name}`, 'success');
                    }
                }))
            },
        ]);
    };

    const parentPath = getParentPath(currentPath);

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
        const artworkDetails = firstArtworkTrack?.artworks?.track_artwork?.[0] || firstArtworkTrack?.artworks?.album_artwork?.[0];

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
            title={currentPath ? `Folders · ${currentPath}` : 'Folders'}
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
