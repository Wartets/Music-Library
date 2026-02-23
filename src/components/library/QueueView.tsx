import React, { useState, useMemo } from 'react';
import { usePlayer } from '../../contexts/PlayerContext';
import { ArtworkImage } from '../shared/ArtworkImage';
import {
    Play, Trash2, GripVertical, ListMusic, History,
    Search, Download, Save,
    Zap, Clock, Filter
} from 'lucide-react';
import { formatDuration, parseDuration } from '../../utils/formatters';
import { motion, AnimatePresence } from 'framer-motion';
import { useUI } from '../../contexts/UIContext';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
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

interface SortableItemProps {
    track: any;
    index: number;
    curIdx: number;
    playTrack: any;
    removeFromQueue: any;
    originalQueue: any[];
}

const SortableTrackItem: React.FC<SortableItemProps> = ({ track, index, curIdx, playTrack, removeFromQueue, originalQueue }) => {
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

    return (
        <motion.div
            ref={setNodeRef}
            style={style}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`group flex items-center gap-5 p-3 rounded-2xl bg-white/2 hover:bg-white/5 transition-all border border-transparent hover:border-white/5 relative ${isDragging ? 'opacity-50 shadow-2xl bg-white/10' : ''}`}
        >
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-dominant rounded-r-full opacity-0 group-hover:opacity-100 transition-opacity"></div>

            <div className="text-[10px] font-black text-white/10 w-6 text-center group-hover:hidden font-mono">
                {(index + 1).toString().padStart(2, '0')}
            </div>
            <button
                onClick={() => playTrack(track, originalQueue)}
                className="hidden group-hover:flex w-6 h-6 items-center justify-center text-dominant bg-dominant/10 rounded-lg hover:bg-dominant/20 transition-all"
            >
                <Play size={14} fill="currentColor" />
            </button>

            <div className="w-12 h-12 rounded-xl overflow-hidden bg-white/5 flex-shrink-0 border border-white/5 group-hover:border-white/10 transition-colors shadow-lg">
                <ArtworkImage details={track.artworks?.track_artwork?.[0] || track.artworks?.album_artwork?.[0]} />
            </div>

            <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white truncate group-hover:text-dominant-light transition-colors">{track.metadata?.title || track.logic.track_name}</div>
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
        </motion.div>
    );
};

export const QueueView: React.FC = () => {
    const {
        state: playerState,
        getProgress,
        removeFromQueue,
        playTrack,
        clearQueue,
        reorderQueue,
        setAutoplay,
        saveQueueAsPlaylist
    } = usePlayer();
    const { showToast } = useUI();

    const [activeTab, setActiveTab] = useState<'queue' | 'history'>('queue');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<'index' | 'duration' | 'name'>('index');

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const currentTrack = playerState.currentTrack;
    const queue = playerState.queue;
    const history = playerState.history;

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
                t.metadata?.artists?.some(a => a.toLowerCase().includes(q)) ||
                t.metadata?.genre?.toLowerCase().includes(q)
            );
        }

        if (sortBy === 'duration') {
            items.sort((a, b) => parseDuration(a.audio_specs?.duration) - parseDuration(b.audio_specs?.duration));
        } else if (sortBy === 'name') {
            items.sort((a, b) => (a.metadata?.title || '').localeCompare(b.metadata?.title || ''));
        }

        return items;
    }, [nextTracksRaw, searchQuery, sortBy]);

    const queueWithTime = useMemo(() => {
        let cumulativeTime = 0;
        const currentProgress = getProgress();
        const currentDuration = currentTrack ? parseDuration(currentTrack.audio_specs?.duration) : 0;
        const remainingCurrent = Math.max(0, currentDuration - currentProgress);
        cumulativeTime = remainingCurrent;

        return filteredQueue.map((item) => {
            const startTime = cumulativeTime;
            cumulativeTime += parseDuration(item.audio_specs?.duration);
            return { ...item, startTimeSeconds: startTime };
        });
    }, [filteredQueue, currentTrack, getProgress]);

    const totalQueueDuration = useMemo(() => {
        return nextTracksRaw.reduce((sum, t) => sum + parseDuration(t.audio_specs?.duration), 0);
    }, [nextTracksRaw]);

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = filteredQueue.findIndex((item) => item.id === active.id);
            const newIndex = filteredQueue.findIndex((item) => item.id === over.id);

            // Map filtered indexes back to original queue indexes
            const absoluteOldIndex = curIdx + 1 + filteredQueue[oldIndex].originalIndex;
            const absoluteNewIndex = curIdx + 1 + filteredQueue[newIndex].originalIndex;

            reorderQueue(absoluteOldIndex, absoluteNewIndex);
            showToast('Queue reordered', 'info');
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
        showToast('Queue exported successfully', 'success');
    };

    const handleSaveAsPlaylist = () => {
        const name = prompt('Enter playlist name:', 'My Queue');
        if (name) {
            saveQueueAsPlaylist(name);
            showToast(`Saved ${queue.length} tracks to playlist "${name}"`, 'success');
        }
    };

    return (
        <div className="h-full flex flex-col p-6 pt-24 overflow-hidden relative z-10 bg-surface-primary">
            {/* Header ... */}
            <div className="flex flex-col gap-6 mb-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-4xl font-black tracking-tighter text-white">Playback Control</h1>
                        <p className="text-gray-500 text-sm mt-1 flex items-center gap-4">
                            <span className="flex items-center gap-1.5"><ListMusic size={14} /> {nextTracksRaw.length} tracks upcoming</span>
                            <span className="flex items-center gap-1.5"><Clock size={14} /> {formatDuration(totalQueueDuration)} remaining</span>
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={handleExport} title="Export Queue" className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/5 text-gray-400 hover:text-white h-10 w-10 flex items-center justify-center">
                            <Download size={18} />
                        </button>
                        <button onClick={handleSaveAsPlaylist} title="Save as Playlist" className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/5 text-gray-400 hover:text-white h-10 w-10 flex items-center justify-center">
                            <Save size={18} />
                        </button>
                        <button onClick={clearQueue} className="flex items-center justify-center gap-2 px-5 py-2 hover:bg-red-500/20 rounded-xl text-sm font-bold transition-all border border-transparent hover:border-red-500/20 text-red-500 ml-2 h-10">
                            <Trash2 size={16} />
                            Clear Queue
                        </button>
                    </div>
                </div>

                {/* Tabs & Filters ... */}
                <div className="flex items-center justify-between gap-4">
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

                    <div className="flex-1 max-w-md relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-dominant transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder="Filter queue..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white/5 border border-white/5 rounded-2xl py-2 pl-12 pr-4 text-sm text-white outline-none focus:border-dominant focus:bg-white/10 transition-all font-medium h-12"
                        />
                    </div>

                    <div className="flex items-center gap-2">
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
                            onClick={() => setAutoplay(!playerState.autoplay)}
                            className={`flex items-center justify-center gap-2 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all border h-12 ${playerState.autoplay ? 'bg-green-500/10 border-green-500/30 text-green-500' : 'bg-white/5 border-white/5 text-gray-500'}`}
                        >
                            Autoplay: {playerState.autoplay ? 'ON' : 'OFF'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-20">
                <AnimatePresence mode="popLayout">
                    {activeTab === 'queue' ? (
                        <motion.div
                            key="queue-list"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-8"
                        >
                            {/* Now Playing */}
                            {currentTrack && (
                                <section>
                                    <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 mb-4 px-2">Now Spinning</h2>
                                    <div className="bg-white/5 border border-white/10 rounded-3xl p-6 flex items-center gap-8 shadow-2xl overflow-hidden relative group">
                                        <div className="absolute inset-0 bg-dominant/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                        <div className="w-24 h-24 rounded-2xl overflow-hidden shadow-2xl flex-shrink-0 ring-1 ring-white/10 relative z-10">
                                            <ArtworkImage details={currentTrack.artworks?.track_artwork?.[0] || currentTrack.artworks?.album_artwork?.[0]} />
                                        </div>
                                        <div className="flex-1 min-w-0 relative z-10">
                                            <h3 className="text-3xl font-black text-white truncate leading-tight">{currentTrack.metadata?.title || currentTrack.logic.track_name}</h3>
                                            <p className="text-dominant-light text-lg font-bold truncate mt-1.5 flex items-center gap-3">
                                                {currentTrack.metadata?.artists?.join(', ')}
                                                <span className="w-1.5 h-1.5 rounded-full bg-white/20"></span>
                                                <span className="text-gray-500 text-sm font-medium">{currentTrack.metadata?.album}</span>
                                            </p>
                                        </div>
                                        <div className="flex flex-col items-end gap-1 relative z-10">
                                            <div className="flex items-end gap-1.5 h-8">
                                                {[...Array(5)].map((_, i) => (
                                                    <motion.div
                                                        key={i}
                                                        animate={{ height: ['40%', '100%', '60%', '90%', '50%'] }}
                                                        transition={{ duration: 0.5 + i * 0.1, repeat: Infinity, ease: "easeInOut" }}
                                                        className="w-1.5 bg-dominant rounded-full"
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            )}

                            {/* Next Up with DND */}
                            <section>
                                <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 mb-4 px-2">Next up in list</h2>
                                {queueWithTime.length === 0 ? (
                                    <div className="h-64 flex flex-col items-center justify-center text-gray-500 border-2 border-dashed border-white/5 rounded-3xl">
                                        <ListMusic size={64} className="opacity-10 mb-4" />
                                        <p className="text-xl font-bold text-white/20">Queue empty</p>
                                    </div>
                                ) : (
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
                                                    />
                                                ))}
                                            </div>
                                        </SortableContext>
                                    </DndContext>
                                )}
                            </section>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="history-list"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-4"
                        >
                            {/* History view logic remains same ... */}
                            <div className="flex items-center justify-between mb-2">
                                <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 px-2">Recently Played</h2>
                                <button className="text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-red-400 transition-colors">Clear History</button>
                            </div>
                            <div className="space-y-1">
                                {history.map((track, index) => (
                                    <div
                                        key={`${track.logic.hash_sha256}-${index}`}
                                        className="group flex items-center gap-4 p-3 rounded-2xl bg-white/2 hover:bg-white/5 transition-all border border-transparent hover:border-white/5 cursor-pointer"
                                        onClick={() => playTrack(track)}
                                    >
                                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-white/5 flex-shrink-0 border border-white/5">
                                            <ArtworkImage details={track.artworks?.track_artwork?.[0] || track.artworks?.album_artwork?.[0]} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-bold text-white truncate">{track.metadata?.title || track.logic.track_name}</div>
                                            <div className="text-xs text-gray-500 truncate">{track.metadata?.artists?.join(', ')}</div>
                                        </div>
                                        <div className="text-xs text-gray-500 font-mono">{track.audio_specs?.duration}</div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};
