import React from 'react';
import { usePlayer } from '../../contexts/PlayerContext';
import { Visualizer } from '../player/Visualizer';
import { formatSizeMb } from '../../utils/formatters';

export const ContextPanel: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    const { state: playerState, getProgress } = usePlayer();
    const track = playerState.currentTrack;
    const [progressR, setProgressR] = React.useState(0);

    // Local timer for high-performance UI updates (lyrics scrolling)
    React.useEffect(() => {
        if (!isOpen) return;
        const interval = setInterval(() => {
            setProgressR(getProgress());
        }, 200);
        return () => clearInterval(interval);
    }, [isOpen, getProgress]);

    const parsedLyrics = React.useMemo(() => {
        const text = track?.metadata?.lyrics || track?.metadata?.description || track?.metadata?.comment || '';
        if (!text) return null;

        const lines = text.split('\n');
        let hasTimestamps = false;

        const lyricsData = lines.map((line, idx) => {
            const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\]/);
            if (match) {
                hasTimestamps = true;
                const min = parseInt(match[1]);
                const sec = parseInt(match[2]);
                const ms = parseInt(match[3]);
                const timeInSeconds = min * 60 + sec + (ms / (match[3].length === 2 ? 100 : 1000));
                const content = line.replace(/\[\d{2}:\d{2}\.\d{2,3}\]/, '').trim();
                return { time: timeInSeconds, content, id: idx };
            }
            return { time: -1, content: line.trim(), id: idx };
        }).filter(l => l.content.length > 0 || l.time >= 0);

        return lyricsData.length > 0 ? { lines: lyricsData, hasTimestamps } : null;
    }, [track]);

    // Simple smooth scroll ref for active lyric
    const lyricsRef = React.useRef<HTMLDivElement>(null);
    const activeLyricIndex = React.useMemo(() => {
        if (!parsedLyrics?.hasTimestamps || progressR === 0) return -1;
        // Find the last lyric line that is <= current time
        let activeIdx = -1;
        for (let i = 0; i < parsedLyrics.lines.length; i++) {
            if (parsedLyrics.lines[i].time !== -1 && parsedLyrics.lines[i].time <= progressR) {
                activeIdx = i;
            } else if (parsedLyrics.lines[i].time !== -1 && parsedLyrics.lines[i].time > progressR) {
                break;
            }
        }
        return activeIdx;
    }, [parsedLyrics, progressR]);

    React.useEffect(() => {
        if (activeLyricIndex >= 0 && lyricsRef.current) {
            const activeEl = lyricsRef.current.querySelector(`[data-index="${activeLyricIndex}"]`);
            if (activeEl) {
                activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, [activeLyricIndex]);

    if (!isOpen) return null;

    return (
        <aside className="w-80 bg-black/40 backdrop-blur-xl border-l border-white/10 flex flex-col h-full overflow-hidden transition-all duration-300 z-40 relative">
            <div className="absolute inset-0 bg-dominant/5 pointer-events-none"></div>
            <div className="relative z-10 p-4 pt-6 flex flex-col h-full">
                <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
                    <h2 className="text-white font-bold tracking-tight text-lg">Track Details</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-6 pr-2">
                    {/* Visualizer */}
                    <div className="bg-white/5 rounded-xl p-4 border border-white/5 shadow-inner">
                        <h3 className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-4">Audio Output</h3>
                        <div className="bg-black/40 rounded-lg p-2 overflow-hidden border border-black">
                            <Visualizer />
                        </div>
                    </div>

                    {!track ? (
                        <div className="text-center text-gray-500 mt-10 text-sm font-medium">No track playing</div>
                    ) : (
                        <>
                            {/* Audio Specs */}
                            <div>
                                <h3 className="text-[10px] text-dominant-light uppercase tracking-widest font-bold mb-3 border-b border-dominant/30 pb-1.5 inline-block">Technical Specs</h3>
                                <ul className="space-y-2.5 text-xs">
                                    <li className="flex justify-between items-center">
                                        <span className="text-gray-400">Codec</span>
                                        <span className="text-white uppercase font-mono bg-white/10 px-1.5 py-0.5 rounded">{track.audio_specs?.codec || 'Unknown'}</span>
                                    </li>
                                    <li className="flex justify-between items-center">
                                        <span className="text-gray-400">Bit Rate</span>
                                        <span className="text-white font-mono">{track.audio_specs?.bitrate || '-'}</span>
                                    </li>
                                    <li className="flex justify-between items-center">
                                        <span className="text-gray-400">Sample Rate</span>
                                        <span className="text-white font-mono">{track.audio_specs?.sample_rate || '-'}</span>
                                    </li>
                                    <li className="flex justify-between items-center">
                                        <span className="text-gray-400">Channels</span>
                                        <span className="text-white font-mono">{track.audio_specs?.channels || '-'}</span>
                                    </li>
                                    <li className="flex justify-between items-center">
                                        <span className="text-gray-400">Quality</span>
                                        <span className={`font-black tracking-widest font-mono text-[10px] px-2 py-0.5 rounded ${track.audio_specs?.is_lossless ? 'bg-dominant text-black shadow' : 'bg-white/5 text-gray-400'}`}>
                                            {track.audio_specs?.is_lossless ? 'LOSSLESS' : 'LOSSY'}
                                        </span>
                                    </li>
                                </ul>
                            </div>

                            {/* Metadata Details */}
                            <div>
                                <h3 className="text-[10px] text-dominant-light uppercase tracking-widest font-bold mb-3 border-b border-dominant/30 pb-1.5 inline-block">Metadata</h3>
                                <ul className="space-y-2.5 text-xs">
                                    <li className="flex justify-between items-center">
                                        <span className="text-gray-400">BPM</span>
                                        <span className="text-white font-mono">{track.metadata?.bpm || '-'}</span>
                                    </li>
                                    <li className="flex justify-between items-start">
                                        <span className="text-gray-400">Genre</span>
                                        <span className="text-white text-right break-words max-w-[150px]">
                                            {Array.isArray(track.metadata?.genre) ? track.metadata.genre.join(', ') : track.metadata?.genre || '-'}
                                        </span>
                                    </li>
                                    <li className="flex justify-between items-center">
                                        <span className="text-gray-400">Year</span>
                                        <span className="text-white font-mono">{track.metadata?.year || '-'}</span>
                                    </li>
                                </ul>
                            </div>

                            {/* File Info */}
                            <div>
                                <h3 className="text-[10px] text-dominant-light uppercase tracking-widest font-bold mb-3 border-b border-dominant/30 pb-1.5 inline-block">File Information</h3>
                                <ul className="space-y-2.5 text-xs">
                                    <li className="flex flex-col gap-1.5 bg-black/20 p-2 rounded border border-white/5">
                                        <span className="text-gray-500 text-[10px] uppercase font-bold tracking-widest">File Path</span>
                                        <span className="text-gray-300 opacity-70 font-mono tracking-tight break-all leading-snug">{track.file.path}</span>
                                    </li>
                                    <li className="flex justify-between items-center mt-3">
                                        <span className="text-gray-400">Size</span>
                                        <span className="text-white font-mono">{formatSizeMb(track.file.size_bytes)}</span>
                                    </li>
                                </ul>
                            </div>

                            {parsedLyrics && (
                                <div className="flex-1 flex flex-col min-h-[200px] mt-4">
                                    <h3 className="text-[10px] text-dominant-light uppercase tracking-widest font-bold mb-3 border-b border-dominant/30 pb-1.5 inline-block">Lyrics</h3>
                                    <div
                                        ref={lyricsRef}
                                        className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2 text-sm"
                                        style={{ scrollBehavior: 'smooth' }}
                                    >
                                        {parsedLyrics.lines.map((line: any, idx: number) => {
                                            if (line.content === '' && line.time === -1) {
                                                return <div key={line.id} className="h-4" />;
                                            }
                                            const isActive = activeLyricIndex === idx;
                                            return (
                                                <div
                                                    key={line.id}
                                                    data-index={idx}
                                                    className={`transition-colors duration-300 ${!parsedLyrics.hasTimestamps ? 'text-gray-300' :
                                                        isActive ? 'text-dominant font-bold scale-[1.02] transform origin-left' :
                                                            'text-gray-500 hover:text-gray-300'
                                                        }`}
                                                >
                                                    {line.content || '♪'}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </aside>
    );
};
