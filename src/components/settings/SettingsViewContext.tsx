import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLibrary } from '../../contexts/LibraryContext';
import { usePlayer } from '../../contexts/PlayerContext';
import { useTheme } from '../../contexts/ThemeContext';
import { audioEngine } from '../../services/audioEngine';
import { persistenceService } from '../../services/persistence';
import type { MetadataWriteTarget, ShuffleMode } from '../../services/persistence';
import type { TrackItem } from '../../types/music';
import type { MaintenanceTabId, SettingsStatCard, SettingsTabId } from './settingsTypes';

interface DuplicateGroups {
    exact: TrackItem[][];
    probable: TrackItem[][];
}

interface HealthIssues {
    lowBitrate: TrackItem[];
    missingMetadata: TrackItem[];
}

interface SettingsViewContextValue {
    activeTab: SettingsTabId;
    setActiveTab: React.Dispatch<React.SetStateAction<SettingsTabId>>;
    maintenanceTab: MaintenanceTabId;
    setMaintenanceTab: React.Dispatch<React.SetStateAction<MaintenanceTabId>>;
    metadataWriteTarget: MetadataWriteTarget;
    setMetadataWriteTarget: (target: MetadataWriteTarget) => void;
    metadataSearch: string;
    setMetadataSearch: React.Dispatch<React.SetStateAction<string>>;
    selectedHashes: Set<string>;
    setSelectedHashes: React.Dispatch<React.SetStateAction<Set<string>>>;
    uiGlowEnabled: boolean;
    setUiGlowEnabled: React.Dispatch<React.SetStateAction<boolean>>;
    uiCompactPlayerEnabled: boolean;
    setUiCompactPlayerEnabled: React.Dispatch<React.SetStateAction<boolean>>;
    uiNowPlayingNotificationsEnabled: boolean;
    setUiNowPlayingNotificationsEnabled: React.Dispatch<React.SetStateAction<boolean>>;
    eqEnabled: boolean;
    setEqEnabled: React.Dispatch<React.SetStateAction<boolean>>;
    eqBands: number[];
    setEqBands: React.Dispatch<React.SetStateAction<number[]>>;
    crossfadeEnabled: boolean;
    setCrossfadeEnabled: React.Dispatch<React.SetStateAction<boolean>>;
    crossfadeDuration: number;
    setCrossfadeDuration: React.Dispatch<React.SetStateAction<number>>;
    normalizationEnabled: boolean;
    setNormalizationEnabled: React.Dispatch<React.SetStateAction<boolean>>;
    normalizationStrength: number;
    setNormalizationStrength: React.Dispatch<React.SetStateAction<number>>;
    freqs: string[];
    presets: Record<string, number[]>;
    eqZeroSnapThreshold: number;
    commitEqBandValue: (index: number, value: number) => number;
    handleBandChange: (index: number, value: number) => void;
    duplicateGroups: DuplicateGroups;
    healthIssues: HealthIssues;
    metadataCandidates: TrackItem[];
    statsCards: SettingsStatCard[];
    setInterfacePreference: (key: string, value: boolean) => void;
    requestNowPlayingNotifications: () => Promise<boolean>;
    setShuffleModePreference: (mode: ShuffleMode) => void;
    toggleTrackSelection: (hash: string) => void;
    handleExport: () => void;
    clearHistory: () => void;
    openMetadataEditor: () => void;
}

const DEFAULT_ACTIVE_TAB: SettingsTabId = 'interface';
const DEFAULT_MAINTENANCE_TAB: MaintenanceTabId = 'duplicates';
const EQ_ZERO_SNAP_THRESHOLD = 0.5;
const EQ_FREQUENCIES = ['32', '64', '125', '250', '500', '1K', '2K', '4K', '8K', '16K'];
const EQ_PRESETS: Record<string, number[]> = {
    Flat: Array(10).fill(0),
    'Bass Boost': [6, 5, 4, 2, 0, 0, 0, 0, 0, 0],
    Electronic: [4, 3, 1, 0, 0, 1, 2, 4, 5, 4],
    Rock: [5, 3, 2, 1, 0, 0, 1, 2, 3, 4],
    Pop: [-1, 0, 2, 4, 5, 4, 2, 0, -1, -2],
    Classical: [0, 0, 0, 0, 0, 0, -1, -2, -3, -4],
    'Vocal Boost': [-2, -3, -3, 0, 2, 4, 4, 2, 0, -1],
    Jazz: [4, 3, 1, 2, -2, -2, 0, 1, 3, 4],
    Dubstep: [6, 5, 2, 0, -2, -2, 0, 2, 5, 6],
    Party: [5, 4, 0, 0, 0, 0, 0, 0, 4, 5],
    'Bass Reducer': [-6, -5, -4, -2, 0, 0, 0, 0, 0, 0],
    'Treble Boost': [0, 0, 0, 0, 0, 0, 2, 4, 5, 6],
    'Treble Reducer': [0, 0, 0, 0, 0, 0, -2, -4, -5, -6]
};

const SettingsViewContext = createContext<SettingsViewContextValue | undefined>(undefined);

const resolveInitialTab = (initialTab?: string): SettingsTabId => {
    if (initialTab === 'maintenance') return 'maintenance';
    if (initialTab === 'audio') return 'audio';
    if (initialTab === 'metadata') return 'metadata';
    if (initialTab === 'stats') return 'stats';
    if (initialTab === 'credentials') return 'credentials';
    return DEFAULT_ACTIVE_TAB;
};

const normalizeEqBands = (bands: number[] | undefined): number[] => {
    const nextBands = bands || Array(10).fill(0);
    if (nextBands.length < 10) {
        return [...nextBands, ...Array(10 - nextBands.length).fill(0)];
    }
    return nextBands.slice(0, 10);
};

export const SettingsViewProvider: React.FC<React.PropsWithChildren<{ initialTab?: string }>> = ({ children, initialTab }) => {
    const { state: libraryState, setEditingTracks } = useLibrary();
    const { setShuffleMode } = usePlayer();
    useTheme();

    const [activeTab, setActiveTab] = useState<SettingsTabId>(() => resolveInitialTab(initialTab));
    const [maintenanceTab, setMaintenanceTab] = useState<MaintenanceTabId>(DEFAULT_MAINTENANCE_TAB);
    const [metadataWriteTarget, setMetadataWriteTargetState] = useState<MetadataWriteTarget>(() => (
        persistenceService.getPreferences().metadataWriteTarget || 'musicbib'
    ));
    const [metadataSearch, setMetadataSearch] = useState('');
    const [selectedHashes, setSelectedHashes] = useState<Set<string>>(new Set());
    const [uiGlowEnabled, setUiGlowEnabled] = useState(() => persistenceService.get('ui_glow') !== false);
    const [uiCompactPlayerEnabled, setUiCompactPlayerEnabled] = useState(() => persistenceService.get('ui_compact_player') === true);
    const [uiNowPlayingNotificationsEnabled, setUiNowPlayingNotificationsEnabled] = useState(() => persistenceService.get('ui_now_playing_notifications') === true);
    const [eqEnabled, setEqEnabled] = useState(() => persistenceService.getPreferences().eqEnabled);
    const [eqBands, setEqBands] = useState<number[]>(() => normalizeEqBands(persistenceService.getPreferences().eqBands));
    const [crossfadeEnabled, setCrossfadeEnabled] = useState(() => persistenceService.getPreferences().crossfadeEnabled || false);
    const [crossfadeDuration, setCrossfadeDuration] = useState(() => persistenceService.getPreferences().crossfadeDuration || 3);
    const [normalizationEnabled, setNormalizationEnabled] = useState(() => persistenceService.getPreferences().normalizationEnabled || false);
    const [normalizationStrength, setNormalizationStrength] = useState(() => persistenceService.getPreferences().normalizationStrength || 45);

    useEffect(() => {
        if (eqBands.length !== 10) return;

        audioEngine.setEqEnabled(eqEnabled, eqBands);
        persistenceService.updatePreferences({
            eqEnabled,
            eqBands,
            crossfadeEnabled,
            crossfadeDuration,
            normalizationEnabled,
            normalizationStrength
        });
    }, [crossfadeDuration, crossfadeEnabled, eqBands, eqEnabled, normalizationEnabled, normalizationStrength]);

    useEffect(() => {
        audioEngine.setVolumeNormalization(normalizationEnabled, normalizationStrength);
    }, [normalizationEnabled, normalizationStrength]);

    useEffect(() => {
        const syncInterfaceSettingsFromStorage = () => {
            setUiGlowEnabled(persistenceService.get('ui_glow') !== false);
            setUiCompactPlayerEnabled(persistenceService.get('ui_compact_player') === true);
            setUiNowPlayingNotificationsEnabled(persistenceService.get('ui_now_playing_notifications') === true);
        };

        window.addEventListener('storage', syncInterfaceSettingsFromStorage);
        return () => window.removeEventListener('storage', syncInterfaceSettingsFromStorage);
    }, []);

    const duplicateGroups = useMemo<DuplicateGroups>(() => {
        const hashGroups: Record<string, TrackItem[]> = {};
        const fuzzyGroups: Record<string, TrackItem[]> = {};

        libraryState.tracks.forEach(track => {
            const hash = track.logic.hash_sha256;
            if (!hashGroups[hash]) hashGroups[hash] = [];
            hashGroups[hash].push(track);

            const fuzzyKey = `${(track.metadata?.title || '').toLowerCase().trim()}|${(track.metadata?.artists?.[0] || '').toLowerCase().trim()}`;
            if (fuzzyKey.length <= 5) return;

            if (!fuzzyGroups[fuzzyKey]) fuzzyGroups[fuzzyKey] = [];
            fuzzyGroups[fuzzyKey].push(track);
        });

        return {
            exact: Object.values(hashGroups).filter(group => group.length > 1),
            probable: Object.values(fuzzyGroups).filter(group => {
                if (group.length <= 1) return false;
                const hashes = new Set(group.map(track => track.logic.hash_sha256));
                return hashes.size > 1;
            })
        };
    }, [libraryState.tracks]);

    const healthIssues = useMemo<HealthIssues>(() => {
        const lowBitrate = libraryState.tracks.filter(track => {
            const bitrate = parseInt(track.audio_specs?.bitrate || '0', 10);
            return bitrate > 0 && bitrate < 128;
        });
        const missingMetadata = libraryState.tracks.filter(track => !track.metadata?.genre || !track.metadata?.year || !track.metadata?.album);

        return { lowBitrate, missingMetadata };
    }, [libraryState.tracks]);

    const metadataCandidates = useMemo(() => {
        const query = metadataSearch.trim().toLowerCase();
        const candidates = libraryState.tracks.filter(track => {
            if (!query) return true;

            const title = (track.metadata?.title || track.logic.track_name || '').toLowerCase();
            const artist = (track.metadata?.artists?.join(' ') || '').toLowerCase();
            const album = (track.metadata?.album || '').toLowerCase();
            return title.includes(query) || artist.includes(query) || album.includes(query);
        });

        return candidates.slice(0, 80);
    }, [libraryState.tracks, metadataSearch]);

    const statsCards = useMemo<SettingsStatCard[]>(() => ([
        { label: 'Tracks', value: libraryState.stats.totalTracks.toLocaleString() },
        { label: 'Duration', value: `${Math.round(libraryState.stats.totalDuration / 60).toLocaleString()} min` },
        { label: 'Size', value: `${libraryState.stats.totalSizeMb.toFixed(1)} MB` },
        { label: 'Lossless', value: libraryState.tracks.filter(track => track.audio_specs?.is_lossless).length.toLocaleString() }
    ]), [libraryState.stats.totalDuration, libraryState.stats.totalSizeMb, libraryState.stats.totalTracks, libraryState.tracks]);

    const setMetadataWriteTarget = useCallback((target: MetadataWriteTarget) => {
        setMetadataWriteTargetState(target);
        persistenceService.updatePreferences({ metadataWriteTarget: target });
    }, []);

    const setInterfacePreference = useCallback((key: string, value: boolean) => {
        persistenceService.set(key, value);
        window.dispatchEvent(new Event('storage'));
    }, []);

    const requestNowPlayingNotifications = useCallback(async () => {
        if (!('Notification' in window)) {
            alert('Notifications are not supported in this browser.');
            return false;
        }

        if (Notification.permission === 'denied') {
            alert('Notifications are blocked for this site. Please re-enable them in browser settings.');
            return false;
        }

        if (Notification.permission === 'default') {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                return false;
            }
        }

        return true;
    }, []);

    const setShuffleModePreference = useCallback((mode: ShuffleMode) => {
        setShuffleMode(mode);
    }, [setShuffleMode]);

    const snapEqBandValue = useCallback((value: number) => {
        const rounded = Math.round(value * 10) / 10;
        return Math.abs(rounded) <= EQ_ZERO_SNAP_THRESHOLD ? 0 : rounded;
    }, []);

    const commitEqBandValue = useCallback((index: number, value: number) => {
        const snapped = snapEqBandValue(value);
        setEqBands(previous => {
            const nextBands = [...previous];
            nextBands[index] = snapped;
            return nextBands;
        });

        if (eqEnabled) {
            audioEngine.setEqBand(index, snapped);
        }

        return snapped;
    }, [eqEnabled, snapEqBandValue]);

    const handleBandChange = useCallback((index: number, value: number) => {
        commitEqBandValue(index, value);
    }, [commitEqBandValue]);

    const toggleTrackSelection = useCallback((hash: string) => {
        setSelectedHashes(previous => {
            const next = new Set(previous);
            if (next.has(hash)) {
                next.delete(hash);
            } else {
                next.add(hash);
            }
            return next;
        });
    }, []);

    const handleExport = useCallback(() => {
        const data = persistenceService.getData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `library_backup_${new Date().toISOString().split('T')[0]}.json`;
        anchor.click();
        URL.revokeObjectURL(url);
    }, []);

    const clearHistory = useCallback(() => {
        if (!window.confirm('Are you sure you want to clear your playback history and play counts?')) {
            return;
        }

        persistenceService.clearHistory();
        window.alert('History cleared.');
    }, []);

    const openMetadataEditor = useCallback(() => {
        const selectedTracks = libraryState.tracks.filter(track => selectedHashes.has(track.logic.hash_sha256));
        if (selectedTracks.length === 0) return;

        persistenceService.updatePreferences({ metadataWriteTarget });
        setEditingTracks(selectedTracks);
    }, [libraryState.tracks, metadataWriteTarget, selectedHashes, setEditingTracks]);

    const value = useMemo<SettingsViewContextValue>(() => ({
        activeTab,
        setActiveTab,
        maintenanceTab,
        setMaintenanceTab,
        metadataWriteTarget,
        setMetadataWriteTarget,
        metadataSearch,
        setMetadataSearch,
        selectedHashes,
        setSelectedHashes,
        uiGlowEnabled,
        setUiGlowEnabled,
        uiCompactPlayerEnabled,
        setUiCompactPlayerEnabled,
        uiNowPlayingNotificationsEnabled,
        setUiNowPlayingNotificationsEnabled,
        eqEnabled,
        setEqEnabled,
        eqBands,
        setEqBands,
        crossfadeEnabled,
        setCrossfadeEnabled,
        crossfadeDuration,
        setCrossfadeDuration,
        normalizationEnabled,
        setNormalizationEnabled,
        normalizationStrength,
        setNormalizationStrength,
        freqs: EQ_FREQUENCIES,
        presets: EQ_PRESETS,
        eqZeroSnapThreshold: EQ_ZERO_SNAP_THRESHOLD,
        commitEqBandValue,
        handleBandChange,
        duplicateGroups,
        healthIssues,
        metadataCandidates,
        statsCards,
        setInterfacePreference,
        requestNowPlayingNotifications,
        setShuffleModePreference,
        toggleTrackSelection,
        handleExport,
        clearHistory,
        openMetadataEditor
    }), [
        activeTab,
        clearHistory,
        commitEqBandValue,
        crossfadeDuration,
        crossfadeEnabled,
        duplicateGroups,
        eqBands,
        eqEnabled,
        handleBandChange,
        handleExport,
        healthIssues,
        maintenanceTab,
        metadataCandidates,
        metadataSearch,
        metadataWriteTarget,
        normalizationEnabled,
        normalizationStrength,
        openMetadataEditor,
        requestNowPlayingNotifications,
        selectedHashes,
        setInterfacePreference,
        setMetadataWriteTarget,
        setShuffleModePreference,
        statsCards,
        toggleTrackSelection,
        uiCompactPlayerEnabled,
        uiGlowEnabled,
        uiNowPlayingNotificationsEnabled
    ]);

    return (
        <SettingsViewContext.Provider value={value}>
            {children}
        </SettingsViewContext.Provider>
    );
};

export const useSettingsView = () => {
    const context = useContext(SettingsViewContext);
    if (!context) {
        throw new Error('useSettingsView must be used within SettingsViewProvider');
    }
    return context;
};
