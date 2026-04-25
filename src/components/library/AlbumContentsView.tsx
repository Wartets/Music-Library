import React, { useMemo } from 'react';
import { AlbumGroup } from '../../types/music';
import { useLibrary } from '../../contexts/LibraryContext';
import { LibraryBrowser } from './LibraryBrowser';
import { getTrackCollectionKey, getTrackCollectionLabel } from '../../utils/collectionLabels';
import { EmptyState } from '../shared/EmptyState';
import { Folder } from 'lucide-react';
import { getCollectionArtwork } from '../../utils/artworkResolver';


interface AlbumContentsViewProps {
    album: AlbumGroup | string;
    onNavigate: (view: any, data: any) => void;
}

export const AlbumContentsView: React.FC<AlbumContentsViewProps> = ({ album: initialAlbum, onNavigate }) => {
    const { state: libraryState } = useLibrary();

    const album = useMemo(() => {
        if (typeof initialAlbum === 'object' && initialAlbum !== null && 'tracks' in initialAlbum) {
            const collectionArtwork = initialAlbum.name.toLowerCase() === 'single' ? undefined : getCollectionArtwork(initialAlbum.tracks);
            return {
                ...initialAlbum,
                artworkPath: collectionArtwork?.path,
                dominantColor: collectionArtwork?.dominant_color || initialAlbum.dominantColor || '#1a1a1a'
            } as AlbumGroup;
        }

        const albumName = typeof initialAlbum === 'string' ? initialAlbum : (initialAlbum as any)?.name;
        if (!albumName) return null;

        const tracks = libraryState.tracks.filter(t => {
            return getTrackCollectionKey(t) === `album:${albumName.toLowerCase()}` || getTrackCollectionLabel(t) === albumName;
        });
        if (tracks.length === 0) return null;

        const collectionArtwork = albumName.toLowerCase() === 'single' ? undefined : getCollectionArtwork(tracks);

        return {
            name: albumName,
            artist: tracks[0].metadata?.album_artist || tracks[0].metadata?.artists?.[0] || 'Unknown Artist',
            tracks: tracks,
            artworkPath: collectionArtwork?.path,
            dominantColor: collectionArtwork?.dominant_color || '#1a1a1a'
        } as AlbumGroup;
    }, [initialAlbum, libraryState.tracks]);

    if (!album) return (
        <EmptyState
            icon={<Folder size={36} />}
            title="Collection not found"
            className="h-full px-6"
            titleClassName="font-bold uppercase tracking-widest text-white/40"
            action={
                <button
                    onClick={() => onNavigate('Albums', null)}
                    className="px-4 py-2.5 min-h-11 rounded-xl border border-white/10 text-white/80 hover:text-white hover:bg-white/5 transition-colors text-[10px] font-black tracking-[0.25em]"
                >
                    Back to Albums
                </button>
            }
        />
    );

    return (
        <LibraryBrowser
            title={album.name}
            subtitle={album.artist}
            tracks={album.tracks}
            onNavigate={onNavigate}
            artworkPath={album.artworkPath}
        />
    );
};
