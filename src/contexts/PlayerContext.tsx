import React, { createContext, useContext, useState, ReactNode, useEffect, useRef, useCallback } from 'react';
import { PlayerState, TrackItem } from '../types/music';
import { audioEngine, AudioPlaybackError } from '../services/audioEngine';
import { persistenceService } from '../services/persistence';
import { useLibrary } from './LibraryContext';
import { useUI } from './UIContext';
import { rankTrackVersions } from '../utils/versionUtils';

interface PlayTrackOptions {
    skipHistoryPush?: boolean;
    suppressHistoryLog?: boolean;
    recoveryAttempt?: boolean;
}

interface PlayerContextProps {
    state: PlayerState;
    playTrack: (track: TrackItem, queue?: TrackItem[]) => void;
    togglePlay: () => void;
    playNext: () => void;
    playPrevious: () => void;
    setVolume: (level: number) => void;
    seek: (time: number) => void;
    getProgress: () => number;
    stop: () => void;
    seekForward: () => void;
    seekBackward: () => void;
    toggleShuffle: () => void;
    setRepeat: (mode: 'none' | 'all' | 'one') => void;
    reorderQueue: (startIndex: number, endIndex: number) => void;
    removeFromQueue: (index: number) => void;
    addToQueue: (track: TrackItem) => void;
    addToNext: (track: TrackItem) => void;
    clearQueue: () => void;
    setAutoplay: (enabled: boolean) => void;
    setQueueLimit: (limit: number) => void;
    setShuffleMode: (mode: import('../services/persistence').ShuffleMode) => void;
    saveQueueAsPlaylist: (name: string) => void;
}

const PlayerContext = createContext<PlayerContextProps | undefined>(undefined);

export const PlayerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [state, setState] = useState<PlayerState>(() => {
        const initialPrefs = persistenceService.getPreferences();
        const savedState = persistenceService.getPlaybackState();

        return {
            currentTrack: null, // Will be hydrated in useEffect
            isPlaying: false,
            volume: savedState?.volume ?? initialPrefs.volume,
            queue: [], // Will be hydrated
            history: [], // Will be hydrated
            shuffle: initialPrefs.shuffle,
            shuffleMode: initialPrefs.shuffleMode,
            repeat: initialPrefs.repeat,
            autoplay: true,
            queueLimit: 0, // 0 means no limit
        };
    });

    // Use ref to access latest state in event listeners without recreating them
    const stateRef = useRef(state);
    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    const progressRef = useRef(0);
    const getProgress = useCallback(() => {
        const value = Number(progressRef.current);
        return Number.isFinite(value) ? value : 0;
    }, []);
    const playTrackLogicRef = useRef<(track: TrackItem, queue?: TrackItem[], options?: PlayTrackOptions) => void>(() => { });
    const handlePlaybackFailureRef = useRef<(error: Error, failedTrack?: TrackItem | null) => void>(() => { });
    const recoveryRef = useRef<{ attempted: Set<string>; lastErrorAt: number; lastErrorKey: string }>({
        attempted: new Set(),
        lastErrorAt: 0,
        lastErrorKey: ''
    });

    // Handle initial state restoration from persistence
    const [isRestored, setIsRestored] = useState(false);
    const { state: libState } = useLibrary();
    const { showToast } = useUI();

    const resetRecoveryState = useCallback(() => {
        recoveryRef.current.attempted.clear();
        recoveryRef.current.lastErrorAt = 0;
        recoveryRef.current.lastErrorKey = '';
    }, []);

    const resolveVersionGroup = useCallback((track: TrackItem): TrackItem[] => {
        const hash = track.logic?.hash_sha256;
        const primaryHash = libState.versionToPrimaryMap[hash] || hash;
        const primary = libState.tracks.find(t => t.logic.hash_sha256 === primaryHash) || track;
        const versions = primary.versions && primary.versions.length > 0 ? primary.versions : [primary];
        return rankTrackVersions(versions);
    }, [libState.tracks, libState.versionToPrimaryMap]);

    useEffect(() => {
        if (libState.isLoading || isRestored) return;

        const saved = persistenceService.getPlaybackState();
        if (saved) {
            const toPrimaryId = (id: string | null | undefined) => id ? (libState.versionToPrimaryMap[id] || id) : null;
            const findTrackByAnyId = (id: string | null | undefined) => {
                const primaryId = toPrimaryId(id);
                if (!primaryId) return null;
                return libState.tracks.find((t: TrackItem) => t.logic.hash_sha256 === primaryId) || null;
            };

            const track = findTrackByAnyId(saved.trackId);
            const queue = saved.queueIds
                .map((id: string) => findTrackByAnyId(id))
                .filter(Boolean) as TrackItem[];
            const history = saved.historyIds
                .map((id: string) => findTrackByAnyId(id))
                .filter(Boolean) as TrackItem[];

            setState(prev => ({
                ...prev,
                currentTrack: track || null,
                queue,
                history,
                volume: saved.volume ?? prev.volume,
            }));

            if (track) {
                audioEngine.setVolume(saved.volume ?? state.volume);
                const savedPosition = Number(saved.position);
                const safePosition = Number.isFinite(savedPosition) ? Math.max(0, savedPosition) : 0;
                audioEngine.load(track, safePosition);
                progressRef.current = safePosition;
            }
        }
        setIsRestored(true);
    }, [libState.isLoading, libState.tracks, libState.versionToPrimaryMap, isRestored]);

    // Save state effect
    useEffect(() => {
        if (!isRestored) return;
        const timer = setInterval(() => {
            const cur = stateRef.current;
            persistenceService.setPlaybackState({
                trackId: cur.currentTrack?.logic.hash_sha256 || null,
                queueIds: cur.queue.map(t => t.logic.hash_sha256),
                historyIds: cur.history.map(t => t.logic.hash_sha256),
                position: progressRef.current,
                volume: cur.volume
            });
        }, 5000); // Every 5 seconds
        return () => clearInterval(timer);
    }, [isRestored]);

    const playTrackLogic = useCallback((track: TrackItem, queue?: TrackItem[], options: PlayTrackOptions = {}) => {
        const currentState = stateRef.current;
        const newQueue = queue || currentState.queue;
        const { skipHistoryPush = false, suppressHistoryLog = false, recoveryAttempt = false } = options;

        const history = [...currentState.history];
        if (!skipHistoryPush && currentState.currentTrack && currentState.currentTrack.logic.hash_sha256 !== track.logic.hash_sha256) {
            history.push(currentState.currentTrack);
        }

        if (!recoveryAttempt) {
            resetRecoveryState();
        }

        progressRef.current = 0;

        setState(prev => ({
            ...prev,
            currentTrack: track,
            queue: newQueue,
            history,
        }));

        if (!suppressHistoryLog) {
            persistenceService.addToHistory(track.logic.hash_sha256);
        }

        audioEngine.play(track).catch((err) => {
            handlePlaybackFailureRef.current(err as Error, track);
        });
    }, [resetRecoveryState]);

    useEffect(() => {
        playTrackLogicRef.current = playTrackLogic;
    }, [playTrackLogic]);

    const describePlaybackError = useCallback((error: Error): { title: string; message: string } => {
        if (error instanceof AudioPlaybackError) {
            switch (error.code) {
                case 'autoplay_blocked':
                    return {
                        title: 'Playback blocked',
                        message: 'Browser autoplay policy blocked playback. Click Play again to continue.'
                    };
                case 'format_unsupported':
                    return {
                        title: 'Unsupported format',
                        message: 'This file format is not supported here. Trying an alternative when available.'
                    };
                case 'media_network':
                    return {
                        title: 'Source unavailable',
                        message: 'The audio file could not be reached. Trying another version.'
                    };
                case 'media_decode':
                    return {
                        title: 'Decode failed',
                        message: 'The file appears corrupted or unreadable. Trying another version.'
                    };
                case 'playback_interrupted':
                    return {
                        title: 'Playback interrupted',
                        message: 'Playback was interrupted unexpectedly. Retrying on another source.'
                    };
                default:
                    return {
                        title: 'Playback error',
                        message: error.message || 'An unknown playback error occurred.'
                    };
            }
        }

        const lower = (error.message || '').toLowerCase();
        if (lower.includes('network')) {
            return { title: 'Network issue', message: 'Could not access the audio source. Trying fallback track.' };
        }
        if (lower.includes('decode')) {
            return { title: 'Decode issue', message: 'Audio decode failed. Trying fallback track.' };
        }
        if (lower.includes('not supported')) {
            return { title: 'Unsupported format', message: 'Format unsupported. Trying another version if possible.' };
        }

        return { title: 'Playback error', message: error.message || 'Unexpected playback failure.' };
    }, []);

    const handlePlaybackFailure = useCallback((error: Error, failedTrack?: TrackItem | null) => {
        const cur = stateRef.current;
        const failed = failedTrack || cur.currentTrack;

        if (!failed) {
            const fallback = describePlaybackError(error);
            showToast(fallback.message, 'error', { title: fallback.title });
            return;
        }

        const failedHash = failed.logic.hash_sha256;
        const now = Date.now();
        const errKey = `${failedHash}|${error.name}|${error.message}`;
        if (
            recoveryRef.current.lastErrorKey === errKey &&
            now - recoveryRef.current.lastErrorAt < 1200
        ) {
            return;
        }
        recoveryRef.current.lastErrorKey = errKey;
        recoveryRef.current.lastErrorAt = now;
        recoveryRef.current.attempted.add(failedHash);

        const versions = resolveVersionGroup(failed);
        const nextVersion = versions.find(version => {
            const hash = version.logic.hash_sha256;
            return hash !== failedHash && !recoveryRef.current.attempted.has(hash);
        });

        if (nextVersion) {
            recoveryRef.current.attempted.add(nextVersion.logic.hash_sha256);
            showToast(
                `${failed.metadata?.title || failed.logic.track_name} failed, trying another version.`,
                'warning',
                { title: 'Playback issue', subtle: true, dedupeKey: `version-fallback-${failedHash}`, durationMs: 2000 }
            );
            playTrackLogicRef.current(nextVersion, cur.queue, {
                skipHistoryPush: true,
                suppressHistoryLog: true,
                recoveryAttempt: true
            });
            return;
        }

        const currentIndex = cur.currentTrack
            ? cur.queue.findIndex(t => t.logic.hash_sha256 === cur.currentTrack?.logic.hash_sha256)
            : -1;
        const nextQueueTrack = cur.queue
            .slice(currentIndex + 1)
            .find(track => !recoveryRef.current.attempted.has(track.logic.hash_sha256));

        if (nextQueueTrack) {
            recoveryRef.current.attempted.add(nextQueueTrack.logic.hash_sha256);
            showToast(
                `${failed.metadata?.title || failed.logic.track_name} is unavailable, skipping to next track.`,
                'warning',
                { title: 'Track skipped', subtle: true, dedupeKey: `queue-skip-${failedHash}`, durationMs: 2200 }
            );
            playTrackLogicRef.current(nextQueueTrack, cur.queue, {
                skipHistoryPush: true,
                suppressHistoryLog: true,
                recoveryAttempt: true
            });
            return;
        }

        const fallback = describePlaybackError(error);
        showToast(
            `${fallback.message} No playable fallback was found.`,
            'error',
            { title: fallback.title, dedupeKey: `playback-stop-${failedHash}`, durationMs: 4500 }
        );
        audioEngine.pause();
        setState(prev => ({ ...prev, isPlaying: false }));
    }, [describePlaybackError, resolveVersionGroup, showToast]);

    useEffect(() => {
        handlePlaybackFailureRef.current = handlePlaybackFailure;
    }, [handlePlaybackFailure]);

    useEffect(() => {
        // Tie to audioEngine events
        audioEngine.onTimeUpdate = (currentTime) => {
            const safeTime = Number(currentTime);
            progressRef.current = Number.isFinite(safeTime) ? Math.max(0, safeTime) : 0;
        };

        audioEngine.onEnded = () => {
            const cur = stateRef.current;
            if (cur.repeat === 'one' && cur.currentTrack) {
                audioEngine.seek(0);
                audioEngine.play().catch(err => {
                    handlePlaybackFailureRef.current(err as Error, cur.currentTrack);
                });
                return;
            }

            if (cur.queue.length > 0 && cur.currentTrack) {
                const nextTrackIndex = cur.queue.findIndex(t => t.logic.hash_sha256 === cur.currentTrack?.logic.hash_sha256) + 1;

                if (nextTrackIndex < cur.queue.length) {
                    playTrackLogic(cur.queue[nextTrackIndex], cur.queue);
                } else if (cur.repeat === 'all') {
                    playTrackLogic(cur.queue[0], cur.queue);
                } else if (cur.autoplay) {
                    audioEngine.pause();
                }
            }
        };

        audioEngine.onPlay = () => {
            resetRecoveryState();
            setState(prev => ({ ...prev, isPlaying: true }));
        };
        audioEngine.onPause = () => setState(prev => ({ ...prev, isPlaying: false }));

        audioEngine.onError = (error) => {
            handlePlaybackFailureRef.current(error, stateRef.current.currentTrack);
        };
    }, [playTrackLogic, resetRecoveryState]);

    const playTrack = useCallback((track: TrackItem, queue?: TrackItem[]) => {
        playTrackLogic(track, queue);
    }, [playTrackLogic]);

    const togglePlay = useCallback(() => {
        const cur = stateRef.current;
        if (cur.isPlaying) {
            audioEngine.pause();
        } else if (cur.currentTrack) {
            audioEngine.play().catch(err => {
                handlePlaybackFailureRef.current(err as Error, cur.currentTrack);
            });
        }
    }, []);

    const playNext = useCallback(() => {
        const cur = stateRef.current;

        if (cur.repeat === 'one' && cur.currentTrack) {
            audioEngine.seek(0);
            audioEngine.play().catch(err => {
                handlePlaybackFailureRef.current(err as Error, cur.currentTrack);
            });
            return;
        }

        if (cur.queue.length > 0 && cur.currentTrack) {
            const nextTrackIndex = cur.queue.findIndex(t => t.logic.hash_sha256 === cur.currentTrack?.logic.hash_sha256) + 1;

            if (nextTrackIndex < cur.queue.length) {
                playTrackLogic(cur.queue[nextTrackIndex], cur.queue);
            } else if (cur.repeat === 'all') {
                playTrackLogic(cur.queue[0], cur.queue);
            } else {
                audioEngine.pause();
            }
        }
    }, [playTrackLogic]);

    const playPrevious = useCallback(() => {
        const cur = stateRef.current;
        if (progressRef.current > 3) {
            audioEngine.seek(0);
            progressRef.current = 0;
        } else if (cur.history.length > 0) {
            const newHistory = [...cur.history];
            const prevTrack = newHistory.pop()!;

            progressRef.current = 0;
            const queue = cur.queue;
            setState(prev => ({
                ...prev,
                currentTrack: prevTrack,
                queue,
                history: newHistory
            }));
            audioEngine.play(prevTrack).catch(err => {
                handlePlaybackFailureRef.current(err as Error, prevTrack);
            });
        }
    }, []);

    const setVolume = useCallback((level: number) => {
        audioEngine.setVolume(level);
        setState(prev => ({ ...prev, volume: level }));
        persistenceService.updatePreferences({ volume: level });
    }, []);

    const seek = useCallback((time: number) => {
        audioEngine.seek(time);
        progressRef.current = time;
    }, []);

    const weightedShuffle = (tracks: TrackItem[], getWeight: (t: TrackItem) => number): TrackItem[] => {
        const result: TrackItem[] = [];
        const pool = [...tracks];
        const weights = pool.map(getWeight);

        while (pool.length > 0) {
            const totalWeight = weights.reduce((acc, w) => acc + w, 0);
            let r = Math.random() * totalWeight;

            for (let i = 0; i < pool.length; i++) {
                r -= weights[i];
                if (r <= 0) {
                    result.push(pool[i]);
                    pool.splice(i, 1);
                    weights.splice(i, 1);
                    break;
                }
            }
        }
        return result;
    };

    const applyShuffle = useCallback((tracks: TrackItem[], mode: import('../services/persistence').ShuffleMode): TrackItem[] => {
        if (tracks.length <= 1) return tracks;

        const currentTrack = stateRef.current.currentTrack;
        const remaining = currentTrack
            ? tracks.filter(t => t.logic.hash_sha256 !== currentTrack.logic.hash_sha256)
            : [...tracks];

        let shuffled: TrackItem[] = [];

        switch (mode) {
            case 'weighted': {
                const ratings = persistenceService.getAllRatings();
                shuffled = weightedShuffle(remaining, (t) => (ratings[t.logic.hash_sha256] || 0) + 1);
                break;
            }
            case 'discovery': {
                const counts = persistenceService.getAllPlayCounts();
                shuffled = weightedShuffle(remaining, (t) => 1 / ((counts[t.logic.hash_sha256] || 0) + 1));
                break;
            }
            case 'recent': {
                shuffled = remaining.sort((a, b) => (b.file?.epoch_created || 0) - (a.file?.epoch_created || 0));
                const topRecent = shuffled.slice(0, 10);
                const others = shuffled.slice(10);
                shuffled = [...audioEngine.shuffleArray(topRecent), ...audioEngine.shuffleArray(others)];
                break;
            }
            default:
                shuffled = audioEngine.shuffleArray(remaining);
        }

        return currentTrack ? [currentTrack, ...shuffled] : shuffled;
    }, []);

    const toggleShuffle = useCallback(() => {
        setState(prev => {
            const newShuffle = !prev.shuffle;
            let newQueue = [...prev.queue];
            if (newShuffle) {
                newQueue = applyShuffle(newQueue, prev.shuffleMode);
            }
            persistenceService.updatePreferences({ shuffle: newShuffle });
            return { ...prev, shuffle: newShuffle, queue: newQueue };
        });
    }, [applyShuffle]);

    const setShuffleMode = useCallback((mode: import('../services/persistence').ShuffleMode) => {
        setState(prev => {
            const next = { ...prev, shuffleMode: mode };
            if (prev.shuffle) {
                next.queue = applyShuffle([...prev.queue], mode);
            }
            persistenceService.updatePreferences({ shuffleMode: mode });
            return next;
        });
    }, [applyShuffle]);

    const setRepeat = useCallback((mode: 'none' | 'all' | 'one') => {
        setState(prev => ({ ...prev, repeat: mode }));
        persistenceService.updatePreferences({ repeat: mode });
    }, []);

    const reorderQueue = useCallback((startIndex: number, endIndex: number) => {
        setState(prev => {
            const newQueue = Array.from(prev.queue);
            const [removed] = newQueue.splice(startIndex, 1);
            newQueue.splice(endIndex, 0, removed);
            return { ...prev, queue: newQueue };
        });
    }, []);

    const removeFromQueue = useCallback((index: number) => {
        setState(prev => {
            const newQueue = Array.from(prev.queue);
            newQueue.splice(index, 1);
            return { ...prev, queue: newQueue };
        });
    }, []);

    const addToQueue = useCallback((track: TrackItem) => {
        setState(prev => {
            if (prev.queue.some(t => t.logic.hash_sha256 === track.logic.hash_sha256)) return prev;
            return { ...prev, queue: [...prev.queue, track] };
        });
    }, []);

    const addToNext = useCallback((track: TrackItem) => {
        setState(prev => {
            const newQueue = [...prev.queue];
            const currentIdx = prev.currentTrack
                ? newQueue.findIndex(t => t.logic.hash_sha256 === prev.currentTrack?.logic.hash_sha256)
                : -1;

            const existingIdx = newQueue.findIndex(t => t.logic.hash_sha256 === track.logic.hash_sha256);
            if (existingIdx !== -1) newQueue.splice(existingIdx, 1);

            newQueue.splice(currentIdx + 1, 0, track);
            return { ...prev, queue: newQueue };
        });
    }, []);

    const clearQueue = useCallback(() => {
        setState(prev => ({ ...prev, queue: prev.currentTrack ? [prev.currentTrack] : [] }));
    }, []);

    const setAutoplay = useCallback((enabled: boolean) => {
        setState(prev => ({ ...prev, autoplay: enabled }));
    }, []);

    const setQueueLimit = useCallback((limit: number) => {
        setState(prev => ({ ...prev, queueLimit: limit }));
    }, []);

    const saveQueueAsPlaylist = useCallback((name: string) => {
        const cur = stateRef.current;
        if (cur.queue.length === 0) return;
        const newPl = persistenceService.createPlaylist(name);
        cur.queue.forEach(track => {
            persistenceService.addTrackToPlaylist(newPl.id, track.logic.hash_sha256);
        });
    }, []);

    const stop = useCallback(() => {
        audioEngine.stop();
        progressRef.current = 0;
        setState(prev => ({ ...prev, isPlaying: false }));
    }, []);

    const seekForward = useCallback(() => {
        audioEngine.seekRelative(10);
    }, []);

    const seekBackward = useCallback(() => {
        audioEngine.seekRelative(-10);
    }, []);

    return (
        <PlayerContext.Provider value={{
            state, playTrack, togglePlay, playNext, playPrevious,
            setVolume, seek, getProgress, stop, seekForward, seekBackward,
            toggleShuffle, setRepeat, setShuffleMode,
            reorderQueue, removeFromQueue, clearQueue,
            addToQueue, addToNext, setAutoplay, setQueueLimit, saveQueueAsPlaylist
        }}>
            {children}
        </PlayerContext.Provider>
    );
};

export const usePlayer = () => {
    const context = useContext(PlayerContext);
    if (!context) throw new Error('usePlayer must be used within PlayerProvider');
    return context;
};
