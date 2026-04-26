import React, { useCallback, useEffect, useRef, useState } from 'react';
import { usePlayer } from '../../contexts/PlayerContext';
import { RepeatMode } from '../../types/playback';
import { Maximize2, Minimize2, Repeat, Repeat1, Shuffle, X } from 'lucide-react';
import { formatDuration } from '../../utils/formatters';
import { ViewType } from '../layout/AppLayout';
import { ArtworkImage } from '../shared/ArtworkImage';
import { ImmersiveVisualizer } from '../player/ImmersiveVisualizer';
import { TrackItem } from '../../types/music';
import { useIsMobile, useIsTablet } from '../../hooks/useMediaQuery';

const getTrackArtwork = (track?: TrackItem | null) => track?.artworks?.track_artwork?.[0] || track?.artworks?.album_artwork?.[0];

const hashText = (value: string): number => {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
        hash = ((hash << 5) - hash) + value.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
};

const getFallbackArtworkColor = (track?: TrackItem | null) => {
    const seed = track?.metadata?.title || track?.logic?.track_name || 'track';
    const hue = hashText(seed) % 360;
    return `hsl(${hue} 36% 28%)`;
};

const getTrackDominantColor = (track?: TrackItem | null) => getTrackArtwork(track)?.dominant_color || getFallbackArtworkColor(track);

const getTrackTitle = (track?: TrackItem | null) => track?.metadata?.title || track?.logic.track_name || 'Unknown Track';

export const BigScreenView: React.FC<{ onBack: () => void; onNavigate: (view: ViewType, data?: any) => void }> = ({ onBack, onNavigate }) => {
    const { state, togglePlay, playNext, playPrevious, seek, getProgress, toggleShuffle, setRepeat, seekForward, seekBackward } = usePlayer();
    const track = state.currentTrack;
    const isMobile = useIsMobile();
    const isTablet = useIsTablet();
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [localProgress, setLocalProgress] = useState(0);
    const [isControlsVisible, setIsControlsVisible] = useState(true);
    const [transitionTrack, setTransitionTrack] = useState<TrackItem | null>(null);
    const [isArtworkTransitioning, setIsArtworkTransitioning] = useState(false);
    const inactivityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const transitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const transitionFrameRef = useRef<number | null>(null);
    const previousTrackRef = useRef<TrackItem | null>(track);
    const inactivityTimeoutMs = isFullscreen ? 3000 : 4500;
    const showFullscreenButton = !isMobile && !isTablet;

    const resetInactivity = useCallback(() => {
        setIsControlsVisible(true);
        if (inactivityTimeoutRef.current) clearTimeout(inactivityTimeoutRef.current);
        inactivityTimeoutRef.current = setTimeout(() => {
            setIsControlsVisible(false);
        }, inactivityTimeoutMs);
    }, [inactivityTimeoutMs]);

    useEffect(() => {
        window.addEventListener('mousemove', resetInactivity);
        window.addEventListener('mousedown', resetInactivity);
        window.addEventListener('keydown', resetInactivity);
        window.addEventListener('touchstart', resetInactivity);
        window.addEventListener('wheel', resetInactivity, { passive: true });
        resetInactivity();
        return () => {
            window.removeEventListener('mousemove', resetInactivity);
            window.removeEventListener('mousedown', resetInactivity);
            window.removeEventListener('keydown', resetInactivity);
            window.removeEventListener('touchstart', resetInactivity);
            window.removeEventListener('wheel', resetInactivity);
            if (inactivityTimeoutRef.current) clearTimeout(inactivityTimeoutRef.current);
        };
    }, [resetInactivity]);

    useEffect(() => {
        const interval = setInterval(() => {
            setLocalProgress(getProgress());
        }, 500);
        return () => clearInterval(interval);
    }, [getProgress]);

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onBack();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onBack]);

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(Boolean(document.fullscreenElement));
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    useEffect(() => {
        const nextTrackId = track?.logic.hash_sha256 || null;
        const previousTrack = previousTrackRef.current;

        if (!track) {
            previousTrackRef.current = null;
            setTransitionTrack(null);
            setIsArtworkTransitioning(false);
            return;
        }

        const previousTrackId = previousTrack?.logic.hash_sha256 || null;
        if (previousTrack && previousTrackId !== nextTrackId) {
            setTransitionTrack(previousTrack);
            setIsArtworkTransitioning(true);

            if (transitionTimeoutRef.current) {
                clearTimeout(transitionTimeoutRef.current);
            }
            if (transitionFrameRef.current !== null) {
                cancelAnimationFrame(transitionFrameRef.current);
            }

            transitionFrameRef.current = requestAnimationFrame(() => {
                setIsArtworkTransitioning(false);
            });

            transitionTimeoutRef.current = setTimeout(() => {
                setTransitionTrack(null);
            }, 1100);
        }

        previousTrackRef.current = track;
    }, [track]);

    useEffect(() => {
        return () => {
            if (transitionTimeoutRef.current) {
                clearTimeout(transitionTimeoutRef.current);
            }
            if (transitionFrameRef.current !== null) {
                cancelAnimationFrame(transitionFrameRef.current);
            }
        };
    }, []);

    if (!track) {
        return (
            <div className="h-full flex flex-col items-center justify-center bg-black text-white">
                <p>No track currently playing</p>
                <button onClick={onBack} className="mt-4 text-dominant hover:underline">Go Back</button>
            </div>
        );
    }

    const toggleFullscreen = () => {
        if (!showFullscreenButton) {
            return;
        }

        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
            setIsFullscreen(true);
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
                setIsFullscreen(false);
            }
        }
    };

    const handleBackgroundDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement;
        if (target.closest('button, a, input, textarea')) return;
        toggleFullscreen();
    };

    const artworkDetails = getTrackArtwork(track);
    const transitionArtworkDetails = getTrackArtwork(transitionTrack);
    const dominantColor = getTrackDominantColor(track);

    return (
        <div className={`fixed inset-0 z-[100] flex flex-col overflow-hidden select-none ${isControlsVisible ? 'cursor-default' : 'cursor-none'}`} onDoubleClick={handleBackgroundDoubleClick}>
            {/* Static artwork-derived background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                <ImmersiveVisualizer track={track} className="opacity-100" />
                <div className="absolute inset-0 transition-colors duration-700" style={{ backgroundColor: dominantColor, opacity: 0.24, mixBlendMode: 'screen' }} />
                <div className="absolute inset-0 bg-black/35 mix-blend-overlay" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_25%,rgba(255,255,255,0.08),transparent_58%)]" />
                <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.14),rgba(0,0,0,0.28))]" />
            </div>

            {/* Header */}
            <div className={`relative z-10 flex items-center justify-between p-8 transition-opacity duration-500 ${isControlsVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
                <button
                    onClick={onBack}
                    className={`group flex items-center bg-white/10 hover:bg-white/20 rounded-full transition-all duration-700 ease-in-out border border-white/10 hover:border-white/20 shadow-2xl backdrop-blur-md active:scale-95 overflow-hidden h-[44px] w-[44px]`}
                >
                    <div className="flex items-center justify-center w-[44px] h-[44px] flex-shrink-0">
                        <X size={18} />
                    </div>
                </button>
                <div className="flex items-center gap-4">
                    {showFullscreenButton && (
                        <button onClick={toggleFullscreen} className="p-3 bg-white/5 hover:bg-white/10 rounded-full transition-all text-white opacity-40 hover:opacity-100">
                            {isFullscreen ? <Minimize2 size={24} /> : <Maximize2 size={24} />}
                        </button>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center gap-12 px-12 pb-24">
                <div className="flex flex-col lg:flex-row items-center justify-center gap-16 max-w-7xl w-full">

                    {/* Artwork & Visualizer Container */}
                    <div className="relative group perspective-1000 isolate">
                        <div
                            className="absolute -inset-12 rounded-full blur-3xl transition-all duration-1000 ease-out pointer-events-none"
                            style={{
                                background: `radial-gradient(circle, ${dominantColor} 0%, transparent 70%)`,
                                opacity: isArtworkTransitioning ? 0.75 : 0.95,
                            }}
                        />
                        <div className={`relative w-80 h-80 md:w-[450px] md:h-[450px] rounded-[2rem] overflow-hidden border border-white/10 bg-black/20 shadow-[0_40px_120px_rgba(0,0,0,0.55)] transition-all duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)] ${isArtworkTransitioning ? 'scale-[1.01]' : 'scale-100'} group-hover:shadow-[0_48px_140px_rgba(0,0,0,0.62)]`}>
                            {transitionTrack && transitionArtworkDetails && (
                                <div className={`absolute inset-0 transition-all duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)] ${isArtworkTransitioning ? 'opacity-100 scale-100 blur-0' : 'opacity-0 scale-[0.965] blur-sm'}`}>
                                    <ArtworkImage
                                        details={transitionArtworkDetails}
                                        alt={getTrackTitle(transitionTrack)}
                                        className="w-full h-full object-cover"
                                        loading="eager"
                                    />
                                </div>
                            )}
                            <div className={`absolute inset-0 transition-all duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)] ${isArtworkTransitioning ? 'opacity-0 scale-[1.03] blur-sm' : 'opacity-100 scale-100 blur-0'}`}>
                                <ArtworkImage
                                    details={artworkDetails}
                                    alt={getTrackTitle(track)}
                                    className="w-full h-full object-cover"
                                    loading="eager"
                                />
                            </div>
                            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.18),transparent_24%,transparent_76%,rgba(255,255,255,0.08))] opacity-60 mix-blend-soft-light pointer-events-none" />
                            <div className="absolute inset-0 bg-gradient-to-tr from-black/35 via-transparent to-white/5 pointer-events-none" />
                            <div className={`absolute inset-0 transition-opacity duration-1000 pointer-events-none ${isArtworkTransitioning ? 'opacity-100' : 'opacity-60'}`}>
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(255,255,255,0.18),transparent_35%)]" />
                                <div className="absolute inset-0 bg-[linear-gradient(115deg,transparent_0%,rgba(255,255,255,0.12)_48%,transparent_52%)] opacity-50" />
                            </div>
                        </div>

                        {/* Overlay Visualizer Rings or similar could go here */}
                    </div>

                    {/* Info & Metadata */}
                    <div className={`flex flex-col items-center lg:items-start text-center lg:text-left max-w-xl transition-all duration-700 ease-out ${isArtworkTransitioning ? 'translate-y-1 opacity-80' : 'translate-y-0 opacity-100'}`}>
                        <button
                            onClick={() => onNavigate('SongDetail', track)}
                            className="text-4xl md:text-6xl font-black tracking-tight text-white mb-4 hover:text-dominant-light transition-colors text-center lg:text-left break-words"
                        >
                            {track.metadata?.title || track.logic.track_name}
                        </button>
                        <button
                            onClick={() => onNavigate('ArtistDetail', track.metadata?.artists?.[0] || 'Unknown Artist')}
                            className="text-xl md:text-3xl text-white/50 font-medium mb-8 hover:text-white transition-colors break-words"
                        >
                            {track.metadata?.artists?.join(', ') || 'Unknown Artist'}
                        </button>

                        {/* Progress Bar (Big) */}
                        <div className="w-full h-2 bg-white/10 rounded-full mb-4 relative cursor-pointer group" onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const x = e.clientX - rect.left;
                            const pct = x / rect.width;

                            const parseDur = (str: string | null): number => {
                                if (!str) return 0;
                                const p = str.split(':');
                                let s = 0, m = 1;
                                while (p.length > 0) {
                                    s += m * parseFloat(p.pop() || '0');
                                    m *= 60;
                                }
                                return s;
                            };

                            const totalDur = parseDur(track.audio_specs.duration);
                            seek(totalDur * pct);
                        }}>
                            <div
                                className="h-full bg-white rounded-full relative"
                                style={{
                                    width: `${(() => {
                                        const parseDur = (str: string | null): number => {
                                            if (!str) return 0;
                                            const p = str.split(':');
                                            let s = 0, m = 1;
                                            while (p.length > 0) {
                                                s += m * parseFloat(p.pop() || '0');
                                                m *= 60;
                                            }
                                            return s;
                                        };
                                        const dur = parseDur(track.audio_specs.duration);
                                        return dur > 0 ? (localProgress / dur) * 100 : 0;
                                    })()}%`
                                }}
                            >
                                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg scale-0 group-hover:scale-100 transition-transform"></div>
                            </div>
                        </div>
                        <div className="w-full flex justify-between text-white/30 font-mono text-sm">
                            <span>{formatDuration(localProgress)}</span>
                            <span>{track.audio_specs.duration}</span>
                        </div>
                    </div>
                </div>

            </div>

            {/* Controls (Floating/Overlay) */}
            <div className={`absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-5 z-20 transition-opacity duration-300 bg-white/5 backdrop-blur-xl px-8 py-4 rounded-full border border-white/10 ${isControlsVisible ? 'opacity-40 hover:opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
                <button
                    onClick={toggleShuffle}
                    className={`text-xs px-3 py-1 rounded-full border transition-all inline-flex items-center justify-center gap-1 min-w-10 ${state.shuffle ? 'bg-white text-black border-white' : 'text-white/80 border-white/30 hover:border-white'}`}
                    title="Shuffle"
                    aria-pressed={state.shuffle}
                >
                    <Shuffle size={14} />
                </button>
                <button
                    onClick={seekBackward}
                    className="text-white hover:scale-110 active:scale-95 transition-all"
                    title="Back 10 seconds"
                >
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M11 17l-5-5 5-5" /><path d="M18 17l-5-5 5-5" /></svg>
                </button>
                <button onClick={playPrevious} className="text-white hover:scale-110 active:scale-95 transition-all">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" /></svg>
                </button>
                <button onClick={togglePlay} className="w-20 h-20 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-xl">
                    {state.isPlaying ? (
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                    ) : (
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor" className="ml-1"><path d="M8 5v14l11-7z" /></svg>
                    )}
                </button>
                <button onClick={playNext} className="text-white hover:scale-110 active:scale-95 transition-all">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" /></svg>
                </button>
                <button
                    onClick={seekForward}
                    className="text-white hover:scale-110 active:scale-95 transition-all"
                    title="Forward 10 seconds"
                >
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M13 17l5-5-5-5" /><path d="M6 17l5-5-5-5" /></svg>
                </button>
                <button
                    onClick={() => setRepeat(state.repeat === RepeatMode.None ? RepeatMode.All : state.repeat === RepeatMode.All ? RepeatMode.One : RepeatMode.None)}
                    className={`text-xs px-3 py-1 rounded-full border transition-all inline-flex items-center justify-center gap-1 min-w-10 ${state.repeat !== RepeatMode.None ? 'bg-white text-black border-white' : 'text-white/80 border-white/30 hover:border-white'}`}
                    title={`Repeat: ${state.repeat}`}
                    aria-pressed={state.repeat !== RepeatMode.None}
                >
                    {state.repeat === RepeatMode.One ? <Repeat1 size={14} /> : <Repeat size={14} />}
                </button>
            </div>
        </div>
    );
};

