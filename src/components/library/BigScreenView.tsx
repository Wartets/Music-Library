import React, { useCallback, useEffect, useRef, useState } from 'react';
import { usePlayer } from '../../contexts/PlayerContext';
import { Visualizer } from '../player/Visualizer';
import { Maximize2, Minimize2, X } from 'lucide-react';
import { formatDuration } from '../../utils/formatters';

export const BigScreenView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { state, togglePlay, playNext, playPrevious, seek, getProgress } = usePlayer();
    const track = state.currentTrack;
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [localProgress, setLocalProgress] = useState(0);
    const [isControlsVisible, setIsControlsVisible] = useState(true);
    const [isButtonHovered, setIsButtonHovered] = useState(false);
    const inactivityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const resetInactivity = useCallback(() => {
        setIsControlsVisible(true);
        if (inactivityTimeoutRef.current) clearTimeout(inactivityTimeoutRef.current);
        inactivityTimeoutRef.current = setTimeout(() => {
            if (!isButtonHovered) {
                setIsControlsVisible(false);
            }
        }, 3000);
    }, [isButtonHovered]);

    useEffect(() => {
        window.addEventListener('mousemove', resetInactivity);
        resetInactivity();
        return () => {
            window.removeEventListener('mousemove', resetInactivity);
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

    if (!track) {
        return (
            <div className="h-full flex flex-col items-center justify-center bg-black text-white">
                <p>No track currently playing</p>
                <button onClick={onBack} className="mt-4 text-dominant hover:underline">Go Back</button>
            </div>
        );
    }

    const toggleFullscreen = () => {
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

    const artworkPath = track.artworks?.track_artwork?.[0]?.path || track.artworks?.album_artwork?.[0]?.path;
    const dominantColor = track.artworks?.track_artwork?.[0]?.dominant_color || track.artworks?.album_artwork?.[0]?.dominant_color || '#121212';

    return (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col overflow-hidden select-none">
            {/* Background Glow */}
            <div
                className="absolute inset-0 opacity-40 blur-[120px] transition-colors duration-1000 scale-150"
                style={{
                    background: `radial-gradient(circle at center, ${dominantColor} 0%, transparent 70%)`,
                    backgroundColor: dominantColor
                }}
            ></div>
            <div className="absolute inset-0 bg-black/40"></div>

            {/* Header */}
            <div className={`relative z-10 flex items-center justify-between p-8 transition-opacity duration-1000 ${isControlsVisible || isButtonHovered ? 'opacity-100' : 'opacity-40'}`}>
                <button
                    onClick={onBack}
                    onMouseEnter={() => setIsButtonHovered(true)}
                    onMouseLeave={() => setIsButtonHovered(false)}
                    className={`group flex items-center bg-white/10 hover:bg-white/20 rounded-full transition-all duration-700 ease-in-out border border-white/10 hover:border-white/20 shadow-2xl backdrop-blur-md active:scale-95 overflow-hidden h-[44px] ${!isControlsVisible && !isButtonHovered ? 'w-[44px]' : 'w-[200px]'}`}
                >
                    <div className="flex items-center justify-center w-[44px] h-[44px] flex-shrink-0">
                        <X size={18} />
                    </div>
                    <div className={`overflow-hidden transition-all duration-700 flex items-center ${!isControlsVisible && !isButtonHovered ? 'w-0 opacity-0' : 'w-full opacity-100'}`}>
                        <span className="font-black text-xs uppercase tracking-widest text-white/90 whitespace-nowrap">Exit Immersion</span>
                    </div>
                </button>
                <div className="flex items-center gap-4">
                    <button onClick={toggleFullscreen} className="p-3 bg-white/5 hover:bg-white/10 rounded-full transition-all text-white opacity-40 hover:opacity-100">
                        {isFullscreen ? <Minimize2 size={24} /> : <Maximize2 size={24} />}
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center gap-12 px-12 pb-24">
                <div className="flex flex-col lg:flex-row items-center justify-center gap-16 max-w-7xl w-full">

                    {/* Artwork & Visualizer Container */}
                    <div className="relative group perspective-1000">
                        <div className="w-80 h-80 md:w-[450px] md:h-[450px] rounded-2xl overflow-hidden shadow-2xl shadow-black/50 border border-white/10 transition-transform duration-700 group-hover:rotate-y-6 group-hover:scale-105">
                            {artworkPath ? (
                                <img src={artworkPath} alt="Artwork" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full bg-white/5 flex items-center justify-center text-8xl">♪</div>
                            )}
                        </div>

                        {/* Overlay Visualizer Rings or similar could go here */}
                    </div>

                    {/* Info & Metadata */}
                    <div className="flex flex-col items-center lg:items-start text-center lg:text-left max-w-xl">
                        <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white mb-4 line-clamp-2">
                            {track.metadata?.title || track.logic.track_name}
                        </h1>
                        <p className="text-xl md:text-3xl text-white/50 font-medium mb-8">
                            {track.metadata?.artists?.join(', ') || 'Unknown Artist'}
                        </p>

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

                {/* Bottom Visualizer */}
                <div className="w-full max-w-4xl h-32 opacity-80 pointer-events-none">
                    <Visualizer />
                </div>
            </div>

            {/* Controls (Floating/Overlay) */}
            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-10 z-20 opacity-40 hover:opacity-100 transition-opacity duration-300 bg-white/5 backdrop-blur-xl px-10 py-5 rounded-full border border-white/10">
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
            </div>
        </div>
    );
};
