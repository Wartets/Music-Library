import React, { useEffect } from 'react';
import { AppLayout } from './components/layout/AppLayout';
import { usePlayer } from './contexts/PlayerContext';

const App: React.FC = () => {
    const { state } = usePlayer();
    const track = state.currentTrack;

    useEffect(() => {
        // Update document title
        if (track) {
            const trackName = track.metadata?.title || track.logic.track_name;
            const artists = track.metadata?.artists?.join(', ') || 'Unknown Artist';
            document.title = `${trackName} - ${artists}`;
        } else {
            document.title = 'Music Library';
        }

        // Update favicon
        const favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
        if (favicon) {
            const artworkPath = track?.artworks?.track_artwork?.[0]?.path || track?.artworks?.album_artwork?.[0]?.path;
            if (artworkPath) {
                favicon.href = artworkPath;
            } else {
                // Revert to default favicon
                favicon.href = '/vite.svg';
            }
        }
    }, [track]);

    return (
        <AppLayout />
    );
};

export default App;
