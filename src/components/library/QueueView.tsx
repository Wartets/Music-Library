import React, { useState, useMemo, useEffect } from 'react';
import { usePlayer } from '../../contexts/PlayerContext';
import { useLibrary } from '../../contexts/LibraryContext';
import { ArtworkImage } from '../shared/ArtworkImage';
import { TrackItem } from '../../types/music';
import {
    Play, Trash2, GripVertical, ListMusic, History,
    Search, Download, Save,
    Zap, Clock, Filter, Shuffle, Repeat, Repeat1
} from 'lucide-react';
import { formatDuration, parseDuration } from '../../utils/formatters';
import { useUI } from '../../contexts/UIContext';
import { persistenceService } from '../../services/persistence';
import { VirtualList } from '../shared/VirtualList';
import { useTrackContextMenu } from '../../hooks/useTrackContextMenu';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    TouchSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from '@dnd-kit/core';
import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface QueueTrackItem {
    originalIndex: number;
    id: string;
    startTimeSeconds: number;
    logic: any;
    metadata: any;
    audio_specs: any;
    artworks: any;
    versions?: any[];
}

interface SortableItemProps {
    track: QueueTrackItem;
    index: number;
    curIdx: number;
    playTrack: any;
    removeFromQueue: any;
    originalQueue: any[];
    onContextMenu?: (e: React.MouseEvent) => void;
}

const getArtworkForTrack = (track: any) => {
    const fromTrack = track.artworks?.track_artwork?.[0] || track.artworks?.album_artwork?.[0];
    if (fromTrack) return fromTrack;
    const fromVersion = track.versions?.find((v: any) => v.artworks?.track_artwork?.[0] || v.artworks?.album_artwork?.[0]);
    return fromVersion?.artworks?.track_artwork?.[0] || fromVersion?.artworks?.album_artwork?.[0];
};

const trackTitle = (track: any) => track.metadata?.title || track.logic.track_name;

const SortableTrackItem: React.FC<SortableItemProps> = React.memo(({ track, index, curIdx, playTrack, removeFromQueue, originalQueue, onContextMenu }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: track.logic.hash_sha256 + '-' + index });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 100 : 1,
    };

    const artwork = getArtworkForTrack(track);

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`group flex items-center gap-5 p-3 rounded-2xl bg-white/2 hover:bg-white/5 transition-colors border border-transparent hover:border-white/5 relative ${isDragging ? 'opacity-50 shadow-2xl bg-white/10' : ''}`}
            onContextMenu={onContextMenu}
        >
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-dominant rounded-r-full opacity-0 group-hover:opacity-100 transition-opacity"></div>

            <div className="text-[10px] font-black text-white/10 w-6 text-center group-hover:hidden font-mono">
                {(index + 1).toString().padStart(2, '0')}
            </div>
            <button
                onClick={() => playTrack(track, originalQueue)}
                className="hidden group-hover:flex w-6 h-6 items-center justify-center text-dominant bg-dominant/10 rounded-lg hover:bg-dominant/20 transition-colors"
            >
                <Play size={14} fill="currentColor" />
            </button>

            <div className="w-12 h-12 rounded-xl overflow-hidden bg-white/5 flex-shrink-0 border border-white/5 group-hover:border-white/10 transition-colors shadow-lg">
                <ArtworkImage details={artwork} alt={trackTitle(track)} />
            </div>

            <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white truncate group-hover:text-dominant-light transition-colors">{trackTitle(track)}</div>
                <div className="text-[10px] font-bold text-gray-500 truncate uppercase tracking-tighter mt-0.5">{track.metadata?.artists?.join(', ')}</div>
            </div>

            <div className="flex flex-col items-end gap-1 min-w-[80px]">
                <div className="text-[10px] font-black text-gray-600 font-mono">+{formatDuration(track.startTimeSeconds)}</div>
                <div className="text-xs font-bold text-white/40">{track.audio_specs?.duration}</div>
            </div>

            <div className="hidden group-hover:flex items-center gap-1 border-l border-white/5 pl-3 ml-2">
                <button
                    onClick={() => removeFromQueue(curIdx + 1 + track.originalIndex)}
                    className="p-2 text-gray-500 hover:text-red-400 transition-colors hover:bg-red-500/10 rounded-lg"
                    title="Remove from queue"
                >
                    <Trash2 size={16} />
                </button>
                <div
                    {...attributes}
                    {...listeners}
                    className="p-2 text-gray-600 cursor-grab active:cursor-grabbing hover:text-white transition-colors"
                >
                    <GripVertical size={16} />
                </div>
            </div>
        </div>
    );
});

const QueueListItem: React.FC<{
    track: QueueTrackItem;
    index: number;
    curIdx: number;
    playTrack: any;
    removeFromQueue: any;
    originalQueue: any[];
    onContextMenu?: (e: React.MouseEvent) => void;
}> = React.memo(({ track, index, curIdx, playTrack, removeFromQueue, originalQueue, onContextMenu }) => {
    const artwork = getArtworkForTrack(track);
    return (
        <div className="group flex items-center gap-5 p-3 rounded-2xl bg-white/2 hover:bg-white/5 transition-colors border border-transparent hover:border-white/5 relative h-full" onContextMenu={onContextMenu}>
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-dominant rounded-r-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="text-[10px] font-black text-white/10 w-6 text-center font-mono">{(index + 1).toString().padStart(2, '0')}</div>
            <button
                onClick={() => playTrack(track, originalQueue)}
                className="w-6 h-6 items-center justify-center text-dominant bg-dominant/10 rounded-lg hover:bg-dominant/20 transition-colors inline-flex"
            >
                <Play size={14} fill="currentColor" />
            </button>
            <div className="w-12 h-12 rounded-xl overflow-hidden bg-white/5 flex-shrink-0 border border-white/5 shadow-lg">
                <ArtworkImage details={artwork} alt={trackTitle(track)} />
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white truncate">{trackTitle(track)}</div>
                <div className="text-[10px] font-bold text-gray-500 truncate uppercase tracking-tighter mt-0.5">{track.metadata?.artists?.join(', ')}</div>
            </div>
            <div className="flex flex-col items-end gap-1 min-w-[80px]">
                <div className="text-[10px] font-black text-gray-600 font-mono">+{formatDuration(track.startTimeSeconds)}</div>
                <div className="text-xs font-bold text-white/40">{track.audio_specs?.duration}</div>
            </div>
            <button
                onClick={() => removeFromQueue(curIdx + 1 + track.originalIndex)}
                className="p-2 text-gray-500 hover:text-red-400 transition-colors hover:bg-red-500/10 rounded-lg"
                title="Remove from queue"
            >
                <Trash2 size={16} />
            </button>
        </div>
    );
});

export const QueueView: React.FC = () => {
    const {
        state: playerState,
        getProgress,
        removeFromQueue,
        playTrack,
        clearQueue,
        reorderQueue,
        setAutoplay,
        saveQueueAsPlaylist,
        toggleShuffle,
        setRepeat
    } = usePlayer();
    const { state: libState } = useLibrary();
    const { showToast } = useUI();
    const { openTrackContextMenu } = useTrackContextMenu();

    const [activeTab, setActiveTab] = useState<'queue' | 'history'>('queue');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<'index' | 'duration' | 'name'>('index');
    const [clockTick, setClockTick] = useState(0);
    const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

    useEffect(() => {
        const media = window.matchMedia('(max-width: 767px)');
        const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
        setIsMobile(media.matches);
        media.addEventListener('change', onChange);
        return () => media.removeEventListener('change', onChange);
    }, []);

    useEffect(() => {
        if (activeTab !== 'queue') return;
        const timer = window.setInterval(() => setClockTick(prev => prev + 1), 1000);
        return () => window.clearInterval(timer);
    }, [activeTab]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 8 },
        }),
        useSensor(TouchSensor, {
            activationConstraint: { delay: 200, tolerance: 5 },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const currentTrack = playerState.currentTrack;
    const queue = playerState.queue;
    const history = useMemo(() => {
        const historyIds = persistenceService.getHistoryIds();
        const trackMap = new Map<string, any>();
        libState.tracks.forEach(track => {
            trackMap.set(track.logic.hash_sha256, track);
        });

        return historyIds
            .map(id => {
                const primaryId = libState.versionToPrimaryMap[id] || id;
                return trackMap.get(primaryId) || null;
            })
            .filter((track): track is any => Boolean(track));
    }, [libState.tracks, libState.versionToPrimaryMap, playerState.history]);

    const curIdx = currentTrack
        ? queue.findIndex(t => t.logic.hash_sha256 === currentTrack.logic.hash_sha256)
        : -1;

    const nextTracksRaw = curIdx !== -1 ? queue.slice(curIdx + 1) : queue;

    const filteredQueue = useMemo(() => {
        let items = nextTracksRaw.map((track, i) => ({ ...track, originalIndex: i, id: track.logic.hash_sha256 + '-' + i }));

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            items = items.filter(t =>
                t.metadata?.title?.toLowerCase().includes(q) ||
                t.metadata?.artists?.some((a: string) => a.toLowerCase().includes(q)) ||
                (Array.isArray(t.metadata?.genre)
                    ? t.metadata.genre.join(' ').toLowerCase()
                    : String(t.metadata?.genre || '').toLowerCase()
                ).includes(q)
            );
        }

        if (sortBy === 'duration') {
            items.sort((a, b) => parseDuration(a.audio_specs?.duration) - parseDuration(b.audio_specs?.duration));
        } else if (sortBy === 'name') {
            items.sort((a, b) => (a.metadata?.title || '').localeCompare(b.metadata?.title || ''));
        }

        return items;
    }, [nextTracksRaw, searchQuery, sortBy]);

    const queueWithTime: QueueTrackItem[] = useMemo(() => {
        let cumulativeTime = 0;
        const currentProgressRaw = getProgress();
        const currentProgress = Number.isFinite(currentProgressRaw) ? currentProgressRaw : 0;
        const currentDuration = currentTrack ? parseDuration(currentTrack.audio_specs?.duration) : 0;
        const remainingCurrent = Math.max(0, currentDuration - currentProgress);
        cumulativeTime = remainingCurrent;

        return filteredQueue.map((item) => {
            const startTime = cumulativeTime;
            cumulativeTime += parseDuration(item.audio_specs?.duration);
            return { ...item, startTimeSeconds: startTime };
        });
    }, [filteredQueue, currentTrack, getProgress, clockTick]);

    const totalQueueDuration = useMemo(() => {
        const currentDuration = currentTrack ? parseDuration(currentTrack.audio_specs?.duration) : 0;
        const progressRaw = getProgress();
        const progress = Number.isFinite(progressRaw) ? progressRaw : 0;
        const remainingCurrent = currentTrack ? Math.max(0, currentDuration - progress) : 0;
        const upcomingDuration = nextTracksRaw.reduce((sum, t) => sum + parseDuration(t.audio_specs?.duration), 0);
        return remainingCurrent + upcomingDuration;
    }, [nextTracksRaw, currentTrack, getProgress, clockTick]);

    const isDragEnabled = !searchQuery && sortBy === 'index' && queueWithTime.length <= 120;

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = filteredQueue.findIndex((item) => item.id === active.id);
            const newIndex = filteredQueue.findIndex((item) => item.id === over.id);
            if (oldIndex < 0 || newIndex < 0) return;

            const absoluteOldIndex = curIdx + 1 + filteredQueue[oldIndex].originalIndex;
            const absoluteNewIndex = curIdx + 1 + filteredQueue[newIndex].originalIndex;

            reorderQueue(absoluteOldIndex, absoluteNewIndex);
            showToast('Queue reordered', 'info', { subtle: true });
        }
    };

    const handleExport = () => {
        const data = JSON.stringify(playerState.queue, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `queue_export_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Queue exported successfully', 'success');
    };

    const handleSaveAsPlaylist = () => {
        const name = prompt('Enter playlist name:', 'My Queue');
        if (name) {
            saveQueueAsPlaylist(name);
            showToast(`Saved ${queue.length} tracks to playlist "${name}"`, 'success');
        }
    };

    const clearHistory = () => {
        persistenceService.clearHistory();
        showToast('Playback history cleared', 'success');
        setClockTick(prev => prev + 1);
    };

    const repeatLabel = playerState.repeat === 'one' ? 'Repeat One' : playerState.repeat === 'all' ? 'Repeat All' : 'Repeat Off';

    if (isMobile) {
        return (
            <div className="h-full overflow-y-auto custom-scrollbar pt-14 px-3 sm:px-4 pb-28 bg-surface-primary">
                <div className="mb-3">
                    <h1 className="text-lg font-black tracking-tight text-white">Playback Control</h1>
                    <p className="text-gray-500 text-[11px] mt-1 flex items-center gap-2 flex-wrap">
                        <span className="flex items-center gap-1"><ListMusic size={12} /> {nextTracksRaw.length} upcoming</span>
                        <span className="flex items-center gap-1"><Clock size={12} /> {formatDuration(totalQueueDuration)} left</span>
                    </p>
                </div>

                <div className="mb-3 grid grid-cols-2 gap-2">
                    <button
                        onClick={() => setActiveTab('queue')}
                        className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${activeTab === 'queue' ? 'bg-dominant text-on-dominant' : 'bg-white/5 text-gray-300 border border-white/10'}`}
                    >
                        <ListMusic size={13} /> Queue
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${activeTab === 'history' ? 'bg-dominant text-on-dominant' : 'bg-white/5 text-gray-300 border border-white/10'}`}
                    >
                        <History size={13} /> History
                    </button>
                </div>

                <div className="mb-3 relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                    <input
                        type="text"
                        placeholder="Filter queue..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-3 text-xs text-white outline-none focus:border-dominant"
                    />
                </div>

                <div className="mb-3 flex items-center gap-2 flex-wrap">
                    <button
                        onClick={() => setSortBy('index')}
                        className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider ${sortBy === 'index' ? 'bg-white/15 text-white' : 'bg-white/5 text-gray-400 border border-white/10'}`}
                    >Default</button>
                    <button
                        onClick={() => setSortBy('name')}
                        className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider ${sortBy === 'name' ? 'bg-white/15 text-white' : 'bg-white/5 text-gray-400 border border-white/10'}`}
                    >Name</button>
                    <button
                        onClick={() => setSortBy('duration')}
                        className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider ${sortBy === 'duration' ? 'bg-white/15 text-white' : 'bg-white/5 text-gray-400 border border-white/10'}`}
                    >Duration</button>
                </div>

                <div className="mb-4 flex items-center gap-2 flex-wrap">
                    <button
                        onClick={toggleShuffle}
                        className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border ${playerState.shuffle ? 'bg-dominant/20 border-dominant/40 text-dominant-light' : 'bg-white/5 border-white/10 text-gray-400'}`}
                        aria-label={playerState.shuffle ? 'Disable shuffle' : 'Enable shuffle'}
                    >Shuffle {playerState.shuffle ? 'On' : 'Off'}</button>
                    <button
                        onClick={() => setRepeat(playerState.repeat === 'none' ? 'all' : playerState.repeat === 'all' ? 'one' : 'none')}
                        className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border ${playerState.repeat !== 'none' ? 'bg-dominant/20 border-dominant/40 text-dominant-light' : 'bg-white/5 border-white/10 text-gray-400'}`}
                        aria-label={`Repeat mode: ${repeatLabel}`}
                    >{repeatLabel}</button>
                    <button
                        onClick={() => setAutoplay(!playerState.autoplay)}
                        className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border ${playerState.autoplay ? 'bg-green-500/10 border-green-500/30 text-green-500' : 'bg-white/5 border-white/10 text-gray-400'}`}
                        aria-label={playerState.autoplay ? 'Disable autoplay' : 'Enable autoplay'}
                    >Auto {playerState.autoplay ? 'ON' : 'OFF'}</button>
                    <button onClick={handleExport} className="p-2 bg-white/5 rounded-xl border border-white/10 text-gray-300" aria-label="Export queue"><Download size={14} /></button>
                    <button onClick={handleSaveAsPlaylist} className="p-2 bg-white/5 rounded-xl border border-white/10 text-gray-300" aria-label="Save as playlist"><Save size={14} /></button>
                    <button onClick={clearQueue} className="p-2 bg-red-500/10 rounded-xl border border-red-500/30 text-red-400" aria-label="Clear queue"><Trash2 size={14} /></button>
                </div>

                {activeTab === 'queue' ? (
                    <div className="space-y-2 pb-4">
                        {queueWithTime.length === 0 ? (
                            <div className="h-44 flex flex-col items-center justify-center text-gray-500 border border-dashed border-white/10 rounded-2xl">
                                <ListMusic size={36} className="opacity-20 mb-2" />
                                <p className="text-sm font-bold text-white/30">Queue empty</p>
                            </div>
                        ) : (
                            queueWithTime.map((track) => (
                                <div
                                    key={track.id}
                                    className="group flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/10"
                                    onContextMenu={(e) => openTrackContextMenu(e, track as unknown as TrackItem, playerState.queue, undefined)}
                                >
                                    <button onClick={() => playTrack(track as unknown as TrackItem, playerState.queue)} className="w-10 h-10 rounded-lg bg-dominant/20 text-dominant flex items-center justify-center hover:bg-dominant/30 transition-colors active:scale-95" aria-label="Play track">
                                        <Play size={14} fill="currentColor" />
                                    </button>
                                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-white/5 border border-white/10">
                                        <ArtworkImage details={getArtworkForTrack(track)} alt={trackTitle(track)} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="text-xs font-bold text-white truncate">{trackTitle(track)}</div>
                                        <div className="text-[10px] text-gray-500 truncate">{track.metadata?.artists?.join(', ')}</div>
                                    </div>
                                    <div className="text-[10px] text-gray-400 font-mono">{track.audio_specs?.duration}</div>
                                    <button
                                        onClick={() => removeFromQueue(curIdx + 1 + track.originalIndex)}
                                        className="p-2 min-w-10 min-h-10 flex items-center justify-center text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors active:scale-95"
                                        aria-label="Remove from queue"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                ) : (
                    <div className="space-y-2 pb-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-[10px] font-black uppercase tracking-widest text-white/30">Recently Played</h2>
                            <button onClick={clearHistory} className="text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-red-400">Clear</button>
                        </div>
                        {history.length === 0 ? (
                            <div className="h-40 flex items-center justify-center rounded-2xl border border-dashed border-white/10 text-gray-500 text-xs">
                                No playback history yet.
                            </div>
                        ) : (
                            history.map((track: any, index: number) => (
                                <div
                                    key={`${track.logic.hash_sha256}-${index}`}
                                    className="group flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/10"
                                    onClick={() => playTrack(track)}
                                    onContextMenu={(e) => openTrackContextMenu(e, track as unknown as TrackItem, history, undefined)}
                                >
                                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-white/5 border border-white/10">
                                        <ArtworkImage details={getArtworkForTrack(track)} alt={trackTitle(track)} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="text-xs font-bold text-white truncate">{trackTitle(track)}</div>
                                        <div className="text-[10px] text-gray-500 truncate">{track.metadata?.artists?.join(', ')}</div>
                                    </div>
                                    <div className="text-[10px] text-gray-400 font-mono">{track.audio_specs?.duration}</div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col p-3 md:p-6 pt-16 md:pt-24 overflow-hidden relative z-10 bg-surface-primary">
            <div className="flex flex-col gap-4 md:gap-6 mb-4 md:mb-8">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h1 className="text-2xl md:text-4xl font-black tracking-tighter text-white">Playback Control</h1>
                        <p className="text-gray-500 text-xs md:text-sm mt-1 flex items-center gap-3 md:gap-4 flex-wrap">
                            <span className="flex items-center gap-1.5"><ListMusic size={14} /> {nextTracksRaw.length} tracks upcoming</span>
                            <span className="flex items-center gap-1.5"><Clock size={14} /> {formatDuration(totalQueueDuration)} remaining</span>
                            <span className={`text-xs font-black uppercase tracking-wider ${playerState.shuffle ? 'text-dominant-light' : 'text-gray-600'}`}>
                                Shuffle {playerState.shuffle ? 'On' : 'Off'}
                            </span>
                            <span className={`text-xs font-black uppercase tracking-wider ${playerState.repeat !== 'none' ? 'text-dominant-light' : 'text-gray-600'}`}>
                                {repeatLabel}
                            </span>
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={handleExport} title="Export Queue" className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl transition-colors border border-white/5 text-gray-400 hover:text-white h-10 w-10 flex items-center justify-center">
                            <Download size={18} />
                        </button>
                        <button onClick={handleSaveAsPlaylist} title="Save as Playlist" className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl transition-colors border border-white/5 text-gray-400 hover:text-white h-10 w-10 flex items-center justify-center">
                            <Save size={18} />
                        </button>
                        <button onClick={clearQueue} className="flex items-center justify-center gap-2 px-3 md:px-5 py-2 hover:bg-red-500/20 rounded-xl text-xs md:text-sm font-bold transition-colors border border-transparent hover:border-red-500/20 text-red-500 ml-1 md:ml-2 h-10">
                            <Trash2 size={16} />
                            <span className="hidden sm:inline">Clear Queue</span>
                        </button>
                    </div>
                </div>

                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex p-1 bg-white/5 rounded-xl border border-white/5">
                        <button
                            onClick={() => setActiveTab('queue')}
                            className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all h-10 ${activeTab === 'queue' ? 'bg-dominant text-on-dominant shadow-lg' : 'text-gray-400 hover:text-white'}`}
                        >
                            <ListMusic size={16} /> Queue
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all h-10 ${activeTab === 'history' ? 'bg-dominant text-on-dominant shadow-lg' : 'text-gray-400 hover:text-white'}`}
                        >
                            <History size={16} /> History
                        </button>
                    </div>

                    <div className="flex-1 min-w-[220px] max-w-md relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-dominant transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder="Filter queue..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white/5 border border-white/5 rounded-2xl py-2 pl-12 pr-4 text-sm text-white outline-none focus:border-dominant focus:bg-white/10 transition-all font-medium h-12"
                        />
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center bg-white/5 rounded-xl border border-white/5 overflow-hidden h-12">
                            <button
                                onClick={() => setSortBy('index')}
                                className={`h-full px-3.5 flex items-center justify-center ${sortBy === 'index' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                                title="Default Sort"
                            >
                                <Zap size={16} />
                            </button>
                            <button
                                onClick={() => setSortBy('name')}
                                className={`h-full px-3.5 border-l border-white/5 flex items-center justify-center ${sortBy === 'name' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                                title="Sort by Name"
                            >
                                <Filter size={16} />
                            </button>
                            <button
                                onClick={() => setSortBy('duration')}
                                className={`h-full px-3.5 border-l border-white/5 flex items-center justify-center ${sortBy === 'duration' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                                title="Sort by Duration"
                            >
                                <Clock size={16} />
                            </button>
                        </div>

                        <button
                            onClick={toggleShuffle}
                            className={`flex items-center justify-center gap-2 px-3 rounded-xl text-xs font-black uppercase tracking-widest transition-colors border h-12 ${playerState.shuffle ? 'bg-dominant/20 border-dominant/40 text-dominant-light' : 'bg-white/5 border-white/5 text-gray-500 hover:text-white'}`}
                            title="Toggle shuffle"
                        >
                            <Shuffle size={14} />
                            Shuffle
                        </button>

                        <button
                            onClick={() => setRepeat(playerState.repeat === 'none' ? 'all' : playerState.repeat === 'all' ? 'one' : 'none')}
                            className={`flex items-center justify-center gap-2 px-3 rounded-xl text-xs font-black uppercase tracking-widest transition-colors border h-12 ${playerState.repeat !== 'none' ? 'bg-dominant/20 border-dominant/40 text-dominant-light' : 'bg-white/5 border-white/5 text-gray-500 hover:text-white'}`}
                            title={`Repeat mode: ${repeatLabel}`}
                        >
                            {playerState.repeat === 'one' ? <Repeat1 size={14} /> : <Repeat size={14} />}
                            {playerState.repeat === 'none' ? 'Repeat Off' : playerState.repeat === 'all' ? 'Repeat All' : 'Repeat One'}
                        </button>

                        <button
                            onClick={() => setAutoplay(!playerState.autoplay)}
                            className={`flex items-center justify-center gap-2 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-colors border h-12 ${playerState.autoplay ? 'bg-green-500/10 border-green-500/30 text-green-500' : 'bg-white/5 border-white/5 text-gray-500 hover:text-white'}`}
                        >
                            Autoplay: {playerState.autoplay ? 'ON' : 'OFF'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-20">
                {activeTab === 'queue' ? (
                    <div className="space-y-8">
                        {currentTrack && (
                            <section className="hidden md:block">
                                <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 mb-4 px-2">Now Spinning</h2>
                                <div className="bg-white/5 border border-white/10 rounded-2xl md:rounded-3xl p-4 md:p-6 flex items-center gap-4 md:gap-8 shadow-2xl overflow-hidden relative group">
                                    <div className="absolute inset-0 bg-dominant/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    <div className="w-16 h-16 md:w-24 md:h-24 rounded-2xl overflow-hidden shadow-2xl flex-shrink-0 ring-1 ring-white/10 relative z-10">
                                        <ArtworkImage details={getArtworkForTrack(currentTrack)} alt={trackTitle(currentTrack)} />
                                    </div>
                                    <div className="flex-1 min-w-0 relative z-10">
                                        <h3 className="text-xl md:text-3xl font-black text-white truncate leading-tight">{trackTitle(currentTrack)}</h3>
                                        <p className="text-dominant-light text-sm md:text-lg font-bold truncate mt-1.5 flex items-center gap-2 md:gap-3">
                                            {currentTrack.metadata?.artists?.join(', ')}
                                            <span className="w-1.5 h-1.5 rounded-full bg-white/20"></span>
                                            <span className="text-gray-500 text-xs md:text-sm font-medium">{currentTrack.metadata?.album}</span>
                                        </p>
                                    </div>
                                    <div className="flex flex-col items-end gap-1 relative z-10">
                                        <div className="flex items-end gap-1.5 h-8">
                                            {[40, 100, 60, 90, 50].map((height, i) => (
                                                <div
                                                    key={i}
                                                    className={`w-1.5 bg-dominant rounded-full ${playerState.isPlaying ? 'animate-[pulse_1s_ease-in-out_infinite]' : ''}`}
                                                    style={{ height: `${height}%`, animationDelay: `${i * 120}ms` }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </section>
                        )}

                        <section>
                            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 mb-4 px-2">Next up in list</h2>
                            {queueWithTime.length === 0 ? (
                                <div className="h-64 flex flex-col items-center justify-center text-gray-500 border-2 border-dashed border-white/5 rounded-3xl">
                                    <ListMusic size={64} className="opacity-10 mb-4" />
                                    <p className="text-xl font-bold text-white/20">Queue empty</p>
                                </div>
                            ) : isDragEnabled ? (
                                <DndContext
                                    sensors={sensors}
                                    collisionDetection={closestCenter}
                                    onDragEnd={handleDragEnd}
                                >
                                    <SortableContext
                                        items={queueWithTime.map(t => t.id)}
                                        strategy={verticalListSortingStrategy}
                                    >
                                        <div className="space-y-2">
                                            {queueWithTime.map((track, index) => (
                                                <SortableTrackItem
                                                    key={track.id}
                                                    track={track}
                                                    index={index}
                                                    curIdx={curIdx}
                                                    playTrack={playTrack}
                                                    removeFromQueue={removeFromQueue}
                                                    originalQueue={playerState.queue}
                                                    onContextMenu={(e) => openTrackContextMenu(e, track as unknown as TrackItem, playerState.queue, undefined)}
                                                />
                                            ))}
                                        </div>
                                    </SortableContext>
                                </DndContext>
                            ) : (
                                <div className="h-[min(70vh,720px)] rounded-2xl border border-white/5 overflow-hidden">
                                    <VirtualList
                                        items={queueWithTime}
                                        rowHeight={74}
                                        renderRow={(track: QueueTrackItem, index: number) => (
                                            <div className="px-1 py-1">
                                                <QueueListItem
                                                    track={track}
                                                    index={index}
                                                    curIdx={curIdx}
                                                    playTrack={playTrack}
                                                    removeFromQueue={removeFromQueue}
                                                    originalQueue={playerState.queue}
                                                    onContextMenu={(e) => openTrackContextMenu(e, track as unknown as TrackItem, playerState.queue, undefined)}
                                                />
                                            </div>
                                        )}
                                        overscan={8}
                                    />
                                </div>
                            )}
                        </section>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 px-2">Recently Played</h2>
                            <button onClick={clearHistory} className="text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-red-400 transition-colors">Clear History</button>
                        </div>
                        {history.length === 0 ? (
                            <div className="h-56 flex items-center justify-center rounded-3xl border border-dashed border-white/10 text-gray-500 text-sm">
                                No playback history yet.
                            </div>
                        ) : (
                            <div className="h-[min(70vh,720px)] rounded-2xl border border-white/5 overflow-hidden">
                                <VirtualList
                                    items={history}
                                    rowHeight={60}
                                    renderRow={(track: any, index: number) => (
                                        <div className="px-1 py-1">
                                            <div
                                                key={`${track.logic.hash_sha256}-${index}`}
                                                className="group flex items-center gap-4 p-3 rounded-2xl bg-white/2 hover:bg-white/5 transition-colors border border-transparent hover:border-white/5 cursor-pointer"
                                                onClick={() => playTrack(track)}
                                                onContextMenu={(e) => openTrackContextMenu(e, track as unknown as TrackItem, history, undefined)}
                                            >
                                                <div className="w-10 h-10 rounded-lg overflow-hidden bg-white/5 flex-shrink-0 border border-white/5">
                                                    <ArtworkImage details={getArtworkForTrack(track)} alt={trackTitle(track)} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-bold text-white truncate">{trackTitle(track)}</div>
                                                    <div className="text-xs text-gray-500 truncate">{track.metadata?.artists?.join(', ')}</div>
                                                </div>
                                                <div className="text-xs text-gray-500 font-mono">{track.audio_specs?.duration}</div>
                                            </div>
                                        </div>
                                    )}
                                    overscan={10}
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
