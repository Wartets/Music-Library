import React, { useMemo, useState } from 'react';
import { useLibrary } from '../../contexts/LibraryContext';
import { usePlayer } from '../../contexts/PlayerContext';
import { useUI } from '../../contexts/UIContext';
import { Play, ListPlus, FolderPlus, FolderOpen, Hash } from 'lucide-react';
import { persistenceService } from '../../services/persistence';
import { CollectionGridView, GridItem } from './CollectionGridView';
import { getMutedVisualStyle, seedFromText } from '../../utils/collectionVisuals';

interface FoldersViewProps {
    onNavigate: (view: any, data: any) => void;
}

export const FoldersView: React.FC<FoldersViewProps> = ({ onNavigate }) => {
    const { state: libraryState } = useLibrary();
    const { playTrack, addToQueue } = usePlayer();
    const { showContextMenu, showToast } = useUI();
    const [sortBy, setSortBy] = useState<'name' | 'count'>('name');

    const folders = useMemo(() => {
        const groups: Record<string, { name: string, path: string, tracks: any[] }> = {};
        libraryState.filteredTracks.forEach(track => {
            const dir = track.file?.dir || 'Unknown';
            const folderName = dir.split(/[/\\]/).filter(Boolean).pop() || dir;
            if (!groups[dir]) {
                groups[dir] = { name: folderName, path: dir, tracks: [] };
            }
            groups[dir].tracks.push(track);
        });

        const sorted = Object.values(groups);
        if (sortBy === 'name') {
            return sorted.sort((a, b) => a.name.localeCompare(b.name));
        }
        return sorted.sort((a, b) => b.tracks.length - a.tracks.length);
    }, [libraryState.filteredTracks, sortBy]);

    const onRightClick = (e: React.MouseEvent, folder: any) => {
        e.preventDefault();
        e.stopPropagation();
        const playlists = persistenceService.getPlaylists();

        showContextMenu(e.clientX, e.clientY, [
            {
                label: `Play Folder`,
                icon: <Play size={14} fill="currentColor" />,
                onClick: () => { playTrack(folder.tracks[0], folder.tracks); showToast(`Playing folder: ${folder.name}`); }
            },
            { label: 'Add to Queue', icon: <ListPlus size={14} />, onClick: () => { folder.tracks.forEach((t: any) => addToQueue(t)); showToast(`Added ${folder.tracks.length} tracks`); } },
            { divider: true, label: '', onClick: () => { } },
            {
                label: 'Add to Playlist', icon: <FolderPlus size={14} />, onClick: () => { },
                subItems: playlists.map(pl => ({
                    label: pl.name, onClick: () => { folder.tracks.forEach((t: any) => persistenceService.addTrackToPlaylist(pl.id, t.logic.hash_sha256)); showToast(`Added to ${pl.name}`, 'success'); }
                }))
            },
        ]);
    };

    const gridItems: GridItem[] = folders.map(folder => {
        const palette = getMutedVisualStyle(seedFromText(folder.path));
        const firstArtworkTrack = folder.tracks.find((t: any) =>
            t.artworks?.track_artwork?.length || t.artworks?.album_artwork?.length
        );
        const artworkDetails = firstArtworkTrack?.artworks?.track_artwork?.[0] || firstArtworkTrack?.artworks?.album_artwork?.[0];

        return {
            id: folder.path,
            title: folder.name,
            subtitle: `${folder.tracks.length} tracks`,
            imageDetails: artworkDetails,
            visualToken: artworkDetails ? undefined : {
                style: {
                    background: palette.background,
                    borderColor: palette.borderColor
                },
                symbol: <FolderOpen size={44} style={{ color: palette.accentColor }} />,
                label: 'Folder',
            },
            onClick: () => onNavigate('AllTracks', { filter: { type: 'folder', value: folder.path } }),
            onContextMenu: (e) => onRightClick(e, folder)
        };
    });

    return (
        <CollectionGridView
            title="Folders"
            subtitle={`${folders.length} directories`}
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
