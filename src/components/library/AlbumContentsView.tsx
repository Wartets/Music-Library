import React, { useMemo } from 'react';
import { AlbumGroup } from '../../types/music';
import { useLibrary } from '../../contexts/LibraryContext';
import { LibraryBrowser } from './LibraryBrowser';


interface AlbumContentsViewProps {
    album: AlbumGroup | string;
    onNavigate: (view: any, data: any) => void;
}

export const AlbumContentsView: React.FC<AlbumContentsViewProps> = ({ album: initialAlbum, onNavigate }) => {
    const { state: libraryState } = useLibrary();

    const album = useMemo(() => {
        if (typeof initialAlbum === 'object' && initialAlbum !== null && 'tracks' in initialAlbum) {
            return initialAlbum as AlbumGroup;
        }

        const albumName = typeof initialAlbum === 'string' ? initialAlbum : (initialAlbum as any)?.name;
        if (!albumName) return null;

        const tracks = libraryState.tracks.filter(t => t.metadata?.album === albumName);
        if (tracks.length === 0) return null;

        return {
            name: albumName,
            artist: tracks[0].metadata?.album_artist || tracks[0].metadata?.artists?.[0] || 'Unknown Artist',
            tracks: tracks,
            artworkPath: tracks[0].artworks?.album_artwork?.[0]?.path || tracks[0].artworks?.track_artwork?.[0]?.path,
            dominantColor: tracks[0].artworks?.album_artwork?.[0]?.dominant_color || tracks[0].artworks?.track_artwork?.[0]?.dominant_color || '#1a1a1a'
        } as AlbumGroup;
    }, [initialAlbum, libraryState.tracks]);

    if (!album) return (
        <div className="h-full flex items-center justify-center text-gray-500 font-bold uppercase tracking-widest">
            Album not found
        </div>
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
