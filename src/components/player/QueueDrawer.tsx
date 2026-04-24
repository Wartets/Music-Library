import React from 'react';
import { usePlayer } from '../../contexts/PlayerContext';
import { TrackItem } from '../../types/music';
import { ArtworkImage } from '../shared/ArtworkImage';
import { getBestArtwork } from '../../utils/artworkResolver';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    TouchSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableTrackProps {
    track: TrackItem;
    index: number;
    onRemove: (index: number) => void;
    onPlay: (track: TrackItem) => void;
    isCurrent: boolean;
}

const SortableTrackRow: React.FC<SortableTrackProps> = ({ track, index, onRemove, onPlay, isCurrent }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id: track.logic.hash_sha256 });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        padding: '10px',
        margin: '6px 0',
        backgroundColor: isCurrent ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        color: '#fff',
        cursor: 'default',
        minHeight: '56px'
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes}>
            <div
                {...listeners}
                style={{ cursor: 'grab', opacity: 0.5, userSelect: 'none', padding: '8px', minWidth: '36px', minHeight: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Drag to reorder"
            >
                ☰
            </div>
            <div
                style={{ flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', cursor: 'pointer' }}
                onClick={() => onPlay(track)}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '6px', overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
                        <ArtworkImage
                            details={getBestArtwork(track)}
                            alt={track.metadata?.title || track.logic.track_name}
                            className="w-full h-full object-cover"
                        />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: isCurrent ? 'bold' : 'normal' }}>
                            {track.metadata?.title || track.logic.track_name}
                        </div>
                        <div style={{ fontSize: '0.8em', opacity: 0.7 }}>
                            {track.metadata?.artists?.[0] || 'Unknown Artist'}
                        </div>
                    </div>
                </div>
            </div>
            <button
                onClick={(e) => { e.stopPropagation(); onRemove(index); }}
                style={{
                    background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer',
                    padding: '8px', borderRadius: '4px', minWidth: '36px', minHeight: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
                title="Remove from queue"
            >
                ✕
            </button>
        </div>
    );
};

interface QueueDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

export const QueueDrawer: React.FC<QueueDrawerProps> = ({ isOpen, onClose }) => {
    const { state, playTrack, reorderQueue, removeFromQueue, clearQueue } = usePlayer();

    // Compute queue display locally  (read-only, just for rendering)
    const queueDisplay = React.useMemo(() => {
        const currentTrack = state.currentTrack;
        const queue = state.queue;
        const curIdx = currentTrack ? queue.findIndex(t => t.logic.hash_sha256 === currentTrack.logic.hash_sha256) : -1;
        const nextTracksRaw = curIdx !== -1 ? queue.slice(curIdx + 1) : queue;

        return nextTracksRaw.map((track, i) => ({
            ...track,
            originalIndex: i,
            id: track.logic.hash_sha256 + '-' + i,
            startTimeSeconds: 0
        }));
    }, [state.currentTrack, state.queue]);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (active.id !== over?.id) {
            const oldIndex = state.queue.findIndex((t) => t.logic.hash_sha256 === active.id);
            const newIndex = state.queue.findIndex((t) => t.logic.hash_sha256 === over?.id);
            if (oldIndex !== -1 && newIndex !== -1) {
                reorderQueue(oldIndex, newIndex);
            }
        }
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0, right: 0, bottom: 0,
            width: '350px',
            backgroundColor: '#1a1a1a',
            borderLeft: '1px solid #333',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '-4px 0 15px rgba(0,0,0,0.5)',
            fontFamily: 'sans-serif'
        }}>
            <div style={{ padding: '16px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, color: '#fff', fontSize: '1.2rem' }}>Up Next</h2>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={clearQueue}
                        style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                    >
                        Clear
                    </button>
                    <button
                        onClick={onClose}
                        style={{ background: 'none', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}
                    >
                        ✕
                    </button>
                </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                {queueDisplay.length === 0 ? (
                    <div style={{ color: '#888', textAlign: 'center', marginTop: '20px' }}>
                        Queue is empty
                    </div>
                ) : (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={state.queue.map(t => t.logic.hash_sha256)}
                            strategy={verticalListSortingStrategy}
                        >
                            {state.queue.map((track, index) => (
                                <SortableTrackRow
                                    key={track.logic.hash_sha256}
                                    track={track}
                                    index={index}
                                    onRemove={removeFromQueue}
                                    onPlay={(t) => playTrack(t, state.queue)}
                                    isCurrent={state.currentTrack?.logic.hash_sha256 === track.logic.hash_sha256}
                                />
                            ))}
                        </SortableContext>
                    </DndContext>
                )}
            </div>
        </div>
    );
};
