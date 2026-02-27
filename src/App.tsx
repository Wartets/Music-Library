import React, { useEffect } from 'react';
import { AppLayout } from './components/layout/AppLayout';
import { usePlayer } from './contexts/PlayerContext';
import { persistenceService } from './services/persistence';
import { dbService } from './services/db';
import { parseDuration } from './utils/formatters';

const DEFAULT_FAVICON = `${import.meta.env.BASE_URL}vite.svg`;

const getDisplayTrackName = (track: ReturnType<typeof usePlayer>['state']['currentTrack']) => {
    if (!track) return 'Unknown Track';
    return track.logic?.track_name || track.metadata?.title || 'Unknown Track';
};

const resolveArtworkSrc = (rawPath?: string): string => rawPath ? dbService.getRelativePath(rawPath) : '';

const App: React.FC = () => {
    const { state, togglePlay, playNext, playPrevious, seekForward, seekBackward, getProgress } = usePlayer();
    const track = state.currentTrack;

    useEffect(() => {
        // Update document title
        if (track) {
            const trackName = getDisplayTrackName(track);
            const artists = track.metadata?.artists?.join(', ') || 'Unknown Artist';
            document.title = `${trackName} - ${artists}`;
        } else {
            document.title = 'Music Library';
        }

        // Update favicon
        const favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
        if (favicon) {
            const artworkPath = track?.artworks?.track_artwork?.[0]?.path || track?.artworks?.album_artwork?.[0]?.path;
            const artworkSrc = resolveArtworkSrc(artworkPath);
            if (artworkSrc) {
                favicon.href = artworkSrc;
            } else {
                // Revert to default favicon
                favicon.href = DEFAULT_FAVICON;
            }
        }
    }, [track]);

    useEffect(() => {
        if (!('mediaSession' in navigator)) return;
        if (!track) {
            navigator.mediaSession.metadata = null;
            navigator.mediaSession.playbackState = 'none';
            return;
        }

        const artworkPath = track?.artworks?.track_artwork?.[0]?.path || track?.artworks?.album_artwork?.[0]?.path || '';
        const artworkSrc = resolveArtworkSrc(artworkPath);

        navigator.mediaSession.metadata = new MediaMetadata({
            title: getDisplayTrackName(track),
            artist: track.metadata?.artists?.join(', ') || 'Unknown Artist',
            album: track.metadata?.album || '',
            artwork: artworkSrc ? [
                { src: artworkSrc, sizes: '96x96', type: 'image/jpeg' },
                { src: artworkSrc, sizes: '192x192', type: 'image/jpeg' },
                { src: artworkSrc, sizes: '512x512', type: 'image/jpeg' },
            ] : undefined
        });

        navigator.mediaSession.setActionHandler('play', () => togglePlay());
        navigator.mediaSession.setActionHandler('pause', () => togglePlay());
        navigator.mediaSession.setActionHandler('previoustrack', () => playPrevious());
        navigator.mediaSession.setActionHandler('nexttrack', () => playNext());
        navigator.mediaSession.setActionHandler('seekbackward', () => seekBackward());
        navigator.mediaSession.setActionHandler('seekforward', () => seekForward());
    }, [track, togglePlay, playPrevious, playNext, seekBackward, seekForward]);

    useEffect(() => {
        if (!('mediaSession' in navigator)) return;
        navigator.mediaSession.playbackState = track ? (state.isPlaying ? 'playing' : 'paused') : 'none';
    }, [track?.logic.hash_sha256, state.isPlaying]);

    useEffect(() => {
        if (!('mediaSession' in navigator)) return;
        if (!track || typeof navigator.mediaSession.setPositionState !== 'function') return;

        const updatePosition = () => {
            const duration = parseDuration(track.audio_specs?.duration);
            const position = Math.max(0, Math.min(duration, getProgress()));
            if (!Number.isFinite(duration) || duration <= 0) return;
            navigator.mediaSession.setPositionState({
                duration,
                position,
                playbackRate: 1
            });
        };

        updatePosition();
        const timer = window.setInterval(updatePosition, 1000);
        return () => window.clearInterval(timer);
    }, [track?.logic.hash_sha256, getProgress]);

    useEffect(() => {
        const notificationsEnabled = persistenceService.get('ui_now_playing_notifications') === true;
        if (!notificationsEnabled || !track || !state.isPlaying) return;
        if (!('Notification' in window) || Notification.permission !== 'granted') return;
        if (document.visibilityState !== 'hidden') return;

        const title = getDisplayTrackName(track);
        const artist = track.metadata?.artists?.join(', ') || 'Unknown Artist';
        const artworkPath = track.artworks?.track_artwork?.[0]?.path || track.artworks?.album_artwork?.[0]?.path;
        const artworkSrc = resolveArtworkSrc(artworkPath);

        const notification = new Notification(title, {
            body: artist,
            icon: artworkSrc || DEFAULT_FAVICON,
            tag: `now-playing-${track.logic.hash_sha256}`,
            silent: true
        });

        window.setTimeout(() => notification.close(), 5000);
    }, [track?.logic.hash_sha256, state.isPlaying]);

    return (
        <AppLayout />
    );
};

export default App;
