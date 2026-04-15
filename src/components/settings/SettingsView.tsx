import React, { useState, useEffect, useMemo } from 'react';
import { useLibrary } from '../../contexts/LibraryContext';
import { MetadataWriteTarget, persistenceService } from '../../services/persistence';
import { audioEngine } from '../../services/audioEngine';
import { useTheme, ThemeMode } from '../../contexts/ThemeContext';
import { usePlayer } from '../../contexts/PlayerContext';
import { TrackItem } from '../../types/music';
import {
    Sparkles, Volume2, Database, ShieldAlert,
    Download, RefreshCcw, FileWarning, Zap,
    Sliders, Monitor, Palette, BarChart3, FileText
} from 'lucide-react';

export const SettingsView: React.FC<{ initialTab?: string }> = ({ initialTab }) => {
    const { state: libState, setEditingTracks } = useLibrary();
    const { state: playerState, setShuffleMode } = usePlayer();
    const { settings: themeSettings, updateSettings, currentPalette, reportBadPalette } = useTheme();

    const [activeTab, setActiveTab] = useState<'interface' | 'audio' | 'metadata' | 'maintenance' | 'stats'>(() => {
        if (initialTab === 'maintenance') return 'maintenance';
        if (initialTab === 'audio') return 'audio';
        if (initialTab === 'metadata') return 'metadata';
        if (initialTab === 'stats') return 'stats';
        return 'interface';
    });
    const [maintenanceTab, setMaintenanceTab] = useState<'duplicates' | 'health' | 'data'>('duplicates');
    const [metadataWriteTarget, setMetadataWriteTarget] = useState<MetadataWriteTarget>(() => persistenceService.getPreferences().metadataWriteTarget || 'musicbib');
    const [metadataSearch, setMetadataSearch] = useState('');
    const [selectedHashes, setSelectedHashes] = useState<Set<string>>(new Set());

    // --- Audio Settings State ---
    const [eqEnabled, setEqEnabled] = useState(() => persistenceService.getPreferences().eqEnabled);
    const [eqBands, setEqBands] = useState<number[]>(() => {
        const bands = persistenceService.getPreferences().eqBands || Array(10).fill(0);
        if (bands.length < 10) {
            return [...bands, ...Array(10 - bands.length).fill(0)];
        }
        return bands.slice(0, 10);
    });
    const [crossfadeEnabled, setCrossfadeEnabled] = useState(() => persistenceService.getPreferences().crossfadeEnabled || false);
    const [crossfadeDuration, setCrossfadeDuration] = useState(() => persistenceService.getPreferences().crossfadeDuration || 3);
    const [normalizationEnabled, setNormalizationEnabled] = useState(() => persistenceService.getPreferences().normalizationEnabled || false);
    const [normalizationStrength, setNormalizationStrength] = useState(() => persistenceService.getPreferences().normalizationStrength || 45);

    const freqs = ['32', '64', '125', '250', '500', '1K', '2K', '4K', '8K', '16K'];
    const presets = {
        'Flat': Array(10).fill(0),
        'Bass Boost': [6, 5, 4, 2, 0, 0, 0, 0, 0, 0],
        'Electronic': [4, 3, 1, 0, 0, 1, 2, 4, 5, 4],
        'Rock': [5, 3, 2, 1, 0, 0, 1, 2, 3, 4],
        'Pop': [-1, 0, 2, 4, 5, 4, 2, 0, -1, -2],
        'Classical': [0, 0, 0, 0, 0, 0, -1, -2, -3, -4],
        'Vocal Boost': [-2, -3, -3, 0, 2, 4, 4, 2, 0, -1],
        'Jazz': [4, 3, 1, 2, -2, -2, 0, 1, 3, 4],
        'Dubstep': [6, 5, 2, 0, -2, -2, 0, 2, 5, 6],
        'Party': [5, 4, 0, 0, 0, 0, 0, 0, 4, 5],
        'Bass Reducer': [-6, -5, -4, -2, 0, 0, 0, 0, 0, 0],
        'Treble Boost': [0, 0, 0, 0, 0, 0, 2, 4, 5, 6],
        'Treble Reducer': [0, 0, 0, 0, 0, 0, -2, -4, -5, -6]
    };

    useEffect(() => {
        if (eqBands.length === 10) {
            audioEngine.setEqEnabled(eqEnabled, eqBands);
            persistenceService.updatePreferences({
                eqEnabled,
                eqBands,
                crossfadeEnabled,
                crossfadeDuration,
                normalizationEnabled,
                normalizationStrength
            });
        }
    }, [eqEnabled, eqBands, crossfadeEnabled, crossfadeDuration, normalizationEnabled, normalizationStrength]);

    useEffect(() => {
        audioEngine.setVolumeNormalization(normalizationEnabled, normalizationStrength);
    }, [normalizationEnabled, normalizationStrength]);

    const handleBandChange = (index: number, value: number) => {
        const newBands = [...eqBands];
        newBands[index] = value;
        setEqBands(newBands);
        if (eqEnabled) audioEngine.setEqBand(index, value);
    };

    // --- Maintenance Logic ---
    const duplicateGroups = useMemo(() => {
        const hashGroups: Record<string, TrackItem[]> = {};
        const fuzzyGroups: Record<string, TrackItem[]> = {};

        libState.tracks.forEach(track => {
            const h = track.logic.hash_sha256;
            if (!hashGroups[h]) hashGroups[h] = [];
            hashGroups[h].push(track);

            const fuzzyKey = `${(track.metadata?.title || '').toLowerCase().trim()}|${(track.metadata?.artists?.[0] || '').toLowerCase().trim()}`;
            if (fuzzyKey.length > 5) {
                if (!fuzzyGroups[fuzzyKey]) fuzzyGroups[fuzzyKey] = [];
                fuzzyGroups[fuzzyKey].push(track);
            }
        });

        const exact = Object.values(hashGroups).filter(g => g.length > 1);
        const probable = Object.values(fuzzyGroups).filter(g => {
            if (g.length <= 1) return false;
            const hashes = new Set(g.map(t => t.logic.hash_sha256));
            return hashes.size > 1;
        });

        return { exact, probable };
    }, [libState.tracks]);

    const healthIssues = useMemo(() => {
        const lowBitrate = libState.tracks.filter(t => {
            const br = parseInt(t.audio_specs?.bitrate || '0');
            return br > 0 && br < 128;
        });
        const missingMetadata = libState.tracks.filter(t => !t.metadata?.genre || !t.metadata?.year || !t.metadata?.album);
        return { lowBitrate, missingMetadata };
    }, [libState.tracks]);

    const metadataCandidates = useMemo(() => {
        const query = metadataSearch.trim().toLowerCase();
        const list = libState.tracks.filter(t => {
            if (!query) return true;
            const title = (t.metadata?.title || t.logic.track_name || '').toLowerCase();
            const artist = (t.metadata?.artists?.join(' ') || '').toLowerCase();
            const album = (t.metadata?.album || '').toLowerCase();
            return title.includes(query) || artist.includes(query) || album.includes(query);
        });
        return list.slice(0, 80);
    }, [libState.tracks, metadataSearch]);

    const handleExport = () => {
        const data = persistenceService.getData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `library_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
    };

    const clearHistory = () => {
        if (confirm('Are you sure you want to clear your playback history and play counts?')) {
            persistenceService.clearHistory();
            alert('History cleared.');
        }
    };

    const toggleTrackSelection = (hash: string) => {
        setSelectedHashes(prev => {
            const next = new Set(prev);
            if (next.has(hash)) {
                next.delete(hash);
            } else {
                next.add(hash);
            }
            return next;
        });
    };

    const openMetadataEditor = () => {
        const selected = libState.tracks.filter(t => selectedHashes.has(t.logic.hash_sha256));
        if (selected.length === 0) return;
        persistenceService.updatePreferences({ metadataWriteTarget });
        setEditingTracks(selected);
    };

    return (
        <div className="h-full flex flex-col p-3 md:p-8 pt-16 md:pt-24 bg-surface-primary overflow-hidden">
            <div className="max-w-7xl mx-auto w-full flex flex-col h-full">
                {/* Header */}
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between mb-4 md:mb-8">
                    <div>
                        <h1 className="text-2xl md:text-4xl font-black tracking-tighter text-white">Settings</h1>
                        <p className="text-gray-500 font-bold uppercase tracking-widest text-xs mt-1 md:mt-2">Personalize your experience</p>
                    </div>

                    {/* Main Tabs */}
                    <div className="flex w-full md:w-auto bg-white/5 rounded-2xl p-1 border border-white/5 shadow-2xl overflow-x-auto no-scrollbar">
                        {[
                            { id: 'interface', label: 'Interface', icon: <Palette size={16} /> },
                            { id: 'audio', label: 'Audio Engine', icon: <Volume2 size={16} /> },
                            { id: 'metadata', label: 'Metadata', icon: <FileText size={16} /> },
                            { id: 'stats', label: 'Stats', icon: <BarChart3 size={16} /> },
                            { id: 'maintenance', label: 'Maintenance', icon: <Database size={16} /> }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex items-center gap-2 px-3 md:px-6 py-2 md:py-2.5 rounded-xl text-[10px] md:text-xs font-black transition-all uppercase tracking-widest whitespace-nowrap ${activeTab === tab.id ? 'bg-dominant text-on-dominant shadow-dominant/20 shadow-xl' : 'text-gray-500 hover:text-gray-300'}`}
                            >
                                {tab.icon}
                                <span className="hidden md:inline">{tab.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-20">
                    {activeTab === 'interface' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {/* Theme Engine */}
                            <div className="bg-white/5 border border-white/10 rounded-3xl p-8 shadow-2xl backdrop-blur-md relative overflow-hidden">
                                <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full blur-[100px] opacity-10 pointer-events-none" style={{ backgroundColor: currentPalette.dominant }}></div>
                                <h2 className="text-2xl font-black text-white mb-2 flex items-center gap-3">
                                    <Sparkles className="text-dominant" size={24} />
                                    Dynamic Theming
                                </h2>
                                <p className="text-sm text-gray-500 mb-8">Control how the UI reacts to your music using WCAG-compliant color extraction.</p>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                                    <div className="space-y-6">
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Color Mode</label>
                                            <div className="flex bg-black/40 rounded-xl p-1 border border-white/5">
                                                {(['adaptive', 'neutral'] as ThemeMode[]).map(mode => (
                                                    <button
                                                        key={mode}
                                                        onClick={() => updateSettings({ mode })}
                                                        className={`flex-1 py-2 text-xs font-black uppercase rounded-lg transition-all ${themeSettings.mode === mode ? 'bg-dominant text-on-dominant shadow-lg' : 'text-gray-500 hover:text-white'}`}
                                                    >
                                                        {mode}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className={`space-y-4 ${themeSettings.mode !== 'adaptive' ? 'opacity-30 pointer-events-none' : ''}`}>
                                            {[
                                                { id: 'enforceContrast', label: 'Accessibility Contrast', desc: 'Ensures text is always legible against dominant colors.' },
                                                { id: 'limitAggressiveColors', label: 'Limit Saturation', desc: 'Softens overly bright colors for better comfort.' },
                                                { id: 'applyToNonEssentialsOnly', label: 'Minimalist Accents', desc: 'Keep backgrounds dark, only theme buttons/highlights.' }
                                            ].map(opt => (
                                                <div key={opt.id} className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-white/5">
                                                    <div>
                                                        <div className="font-bold text-sm text-white">{opt.label}</div>
                                                        <div className="text-[10px] text-gray-500">{opt.desc}</div>
                                                    </div>
                                                    <button
                                                        onClick={() => updateSettings({ [opt.id]: !themeSettings[opt.id as keyof typeof themeSettings] })}
                                                        className={`w-12 h-6 rounded-full transition-all relative ${themeSettings[opt.id as keyof typeof themeSettings] ? 'bg-dominant' : 'bg-white/10'}`}
                                                    >
                                                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${themeSettings[opt.id as keyof typeof themeSettings] ? 'left-7 bg-black' : 'left-1'}`}></div>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="bg-black/40 rounded-3xl p-8 border border-white/5 flex flex-col justify-between">
                                        <div>
                                            <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-6">Aesthetic Preview</h3>
                                            <div
                                                className="p-6 rounded-2xl transition-all duration-1000 mb-6 border border-white/5"
                                                style={{ backgroundColor: themeSettings.applyToNonEssentialsOnly ? '#111' : currentPalette.dominantDark, color: currentPalette.onDominant }}
                                            >
                                                <h4 className="font-black text-xl mb-2">Visual Fidelity</h4>
                                                <p className="text-xs opacity-70 mb-6 leading-relaxed">This is how your current theme settings interact with the playing track.</p>
                                                <div className="flex gap-3">
                                                    <button className="px-5 py-2 rounded-xl text-[10px] font-black uppercase shadow-xl" style={{ backgroundColor: currentPalette.dominant, color: currentPalette.onDominant }}>Action</button>
                                                    <button className="px-5 py-2 rounded-xl text-[10px] font-black uppercase border border-current opacity-60">Ghost</button>
                                                </div>
                                            </div>
                                        </div>
                                        <button onClick={reportBadPalette} className="text-[10px] font-black text-gray-500 hover:text-red-400 uppercase tracking-widest transition-colors self-end">Report Poor Contrast</button>
                                    </div>
                                </div>
                            </div>

                            {/* UI Customization */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="bg-white/5 border border-white/10 rounded-3xl p-8">
                                    <h3 className="text-lg font-black text-white mb-6 flex items-center gap-3">
                                        <Monitor className="text-dominant" size={20} />
                                        Layout
                                    </h3>
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-white/5">
                                            <div>
                                                <div className="font-bold text-sm text-white">Progress Glow</div>
                                                <div className="text-[10px] text-gray-500">Adds an atmospheric glow to the player seek bar.</div>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    const current = persistenceService.get('ui_glow') !== false;
                                                    persistenceService.set('ui_glow', !current);
                                                    window.dispatchEvent(new Event('storage'));
                                                }}
                                                className={`w-12 h-6 rounded-full transition-all relative ${persistenceService.get('ui_glow') !== false ? 'bg-dominant' : 'bg-white/10'}`}
                                            >
                                                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${persistenceService.get('ui_glow') !== false ? 'left-7 bg-black' : 'left-1'}`}></div>
                                            </button>
                                        </div>
                                        <div className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-white/5">
                                            <div>
                                                <div className="font-bold text-sm text-white">Compact Player</div>
                                                <div className="text-[10px] text-gray-500">Minimizes the vertical footprint of the player bar.</div>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    const current = persistenceService.get('ui_compact_player') === true;
                                                    persistenceService.set('ui_compact_player', !current);
                                                    window.dispatchEvent(new Event('storage'));
                                                }}
                                                className={`w-12 h-6 rounded-full transition-all relative ${persistenceService.get('ui_compact_player') === true ? 'bg-dominant' : 'bg-white/10'}`}
                                            >
                                                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${persistenceService.get('ui_compact_player') === true ? 'left-7 bg-black' : 'left-1'}`}></div>
                                            </button>
                                        </div>
                                        <div className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-white/5">
                                            <div>
                                                <div className="font-bold text-sm text-white">Now Playing Notifications</div>
                                                <div className="text-[10px] text-gray-500">Show track notifications while the app is in background.</div>
                                            </div>
                                            <button
                                                onClick={async () => {
                                                    const current = persistenceService.get('ui_now_playing_notifications') === true;
                                                    if (current) {
                                                        persistenceService.set('ui_now_playing_notifications', false);
                                                        window.dispatchEvent(new Event('storage'));
                                                        return;
                                                    }

                                                    if (!('Notification' in window)) {
                                                        alert('Notifications are not supported in this browser.');
                                                        return;
                                                    }

                                                    if (Notification.permission === 'denied') {
                                                        alert('Notifications are blocked for this site. Please re-enable them in browser settings.');
                                                        return;
                                                    }

                                                    if (Notification.permission === 'default') {
                                                        const permission = await Notification.requestPermission();
                                                        if (permission !== 'granted') {
                                                            return;
                                                        }
                                                    }

                                                    persistenceService.set('ui_now_playing_notifications', true);
                                                    window.dispatchEvent(new Event('storage'));
                                                }}
                                                className={`w-12 h-6 rounded-full transition-all relative ${persistenceService.get('ui_now_playing_notifications') === true ? 'bg-dominant' : 'bg-white/10'}`}
                                            >
                                                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${persistenceService.get('ui_now_playing_notifications') === true ? 'left-7 bg-black' : 'left-1'}`}></div>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'audio' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {/* Equalizer */}
                            <div className="bg-white/5 border border-white/10 rounded-3xl p-8 shadow-2xl">
                                <div className="flex flex-col lg:flex-row gap-12">
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-8">
                                            <div>
                                                <h2 className="text-2xl font-black text-white flex items-center gap-3">
                                                    <Sliders className="text-dominant" size={24} />
                                                    Parametric EQ
                                                </h2>
                                                <p className="text-sm text-gray-500">Customize the acoustic signature of your output.</p>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <select
                                                    className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-black uppercase outline-none focus:border-dominant"
                                                    onChange={(e) => setEqBands(presets[e.target.value as keyof typeof presets])}
                                                    value={Object.entries(presets).find(([_, v]) => JSON.stringify(v) === JSON.stringify(eqBands))?.[0] || 'Custom'}
                                                >
                                                    <option value="Custom" disabled>Custom</option>
                                                    {Object.keys(presets).map(p => <option key={p} value={p}>{p}</option>)}
                                                </select>
                                                <button
                                                    onClick={() => setEqEnabled(!eqEnabled)}
                                                    className={`px-5 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all ${eqEnabled ? 'bg-dominant text-on-dominant' : 'bg-white/5 text-gray-500'}`}
                                                >
                                                    {eqEnabled ? 'ACTIVE' : 'BYPASS'}
                                                </button>
                                            </div>
                                        </div>

                                        <div className={`flex justify-between h-48 items-end gap-3 px-2 ${eqEnabled ? '' : 'opacity-20 grayscale'}`}>
                                            {eqBands.map((val, idx) => (
                                                <div key={idx} className="flex-1 flex flex-col items-center h-full group">
                                                    <div className="relative flex-1 w-full flex items-center justify-center py-2 group cursor-pointer">
                                                        <div className="absolute top-0 bottom-0 w-1 bg-white/5 rounded-full group-hover:bg-white/10 transition-colors"></div>
                                                        <div className="absolute top-1/2 w-4 h-[1px] bg-white/10"></div>
                                                        <input
                                                            type="range" min="-12" max="12" step="0.1" value={val}
                                                            onChange={(e) => handleBandChange(idx, parseFloat(e.target.value))}
                                                            className="absolute opacity-0 cursor-pointer z-20 vertical-range"
                                                            style={{
                                                                width: 168,
                                                                height: 36,
                                                                left: '50%',
                                                                top: '50%',
                                                                transform: 'translate(-50%, -50%) rotate(-90deg)'
                                                            }}
                                                        />
                                                        <div className="absolute w-1.5 bg-dominant rounded-full shadow-[0_0_15px_rgba(var(--color-dominant-rgb),0.5)]"
                                                            style={{ height: `${(Math.abs(val) / 24) * 100}%`, bottom: val >= 0 ? '50%' : `calc(50% + ${(val / 24) * 100}%)`, top: val < 0 ? '50%' : 'auto' }}
                                                        ></div>
                                                        <div className="absolute w-3.5 h-3.5 bg-white rounded-full border-2 border-dominant shadow-xl pointer-events-none z-10"
                                                            style={{ bottom: `calc(50% + ${(val / 24) * 100}%)`, transform: 'translateY(50%)' }}
                                                        ></div>
                                                    </div>
                                                    <span className="text-[10px] font-black text-gray-500 mt-4 group-hover:text-dominant">{freqs[idx]}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="w-[1px] bg-white/5 self-stretch hidden lg:block"></div>

                                    <div className="w-full lg:w-72 space-y-10">
                                        <div>
                                            <h3 className="text-xl font-black text-white mb-2">Crossfade</h3>
                                            <p className="text-sm text-gray-500 mb-6">Gapless track transitions.</p>
                                            <div className="flex items-center justify-between mb-6">
                                                <span className="text-xs font-bold text-gray-300">Enabled</span>
                                                <button
                                                    onClick={() => setCrossfadeEnabled(!crossfadeEnabled)}
                                                    className={`w-12 h-6 rounded-full transition-all relative ${crossfadeEnabled ? 'bg-dominant' : 'bg-white/10'}`}
                                                >
                                                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${crossfadeEnabled ? 'left-7' : 'left-1'}`}></div>
                                                </button>
                                            </div>
                                            <div className={`space-y-4 ${crossfadeEnabled ? '' : 'opacity-20 pointer-events-none'}`}>
                                                <div className="flex justify-between items-end">
                                                    <span className="text-[10px] font-black text-gray-500 uppercase">Duration</span>
                                                    <span className="text-lg font-black text-dominant">{crossfadeDuration}s</span>
                                                </div>
                                                <input
                                                    type="range" min="1" max="15" step="1" value={crossfadeDuration}
                                                    onChange={(e) => setCrossfadeDuration(parseInt(e.target.value))}
                                                    className="w-full accent-dominant h-1.5 bg-white/5 rounded-full"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <h3 className="text-xl font-black text-white mb-2">Volume Normalization</h3>
                                            <p className="text-sm text-gray-500 mb-6">Smoothly levels loud and quiet tracks during playback.</p>
                                            <div className="flex items-center justify-between mb-6">
                                                <span className="text-xs font-bold text-gray-300">Enabled</span>
                                                <button
                                                    onClick={() => setNormalizationEnabled(!normalizationEnabled)}
                                                    className={`w-12 h-6 rounded-full transition-all relative ${normalizationEnabled ? 'bg-dominant' : 'bg-white/10'}`}
                                                >
                                                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${normalizationEnabled ? 'left-7' : 'left-1'}`}></div>
                                                </button>
                                            </div>
                                            <div className={`space-y-4 ${normalizationEnabled ? '' : 'opacity-20 pointer-events-none'}`}>
                                                <div className="flex justify-between items-end">
                                                    <span className="text-[10px] font-black text-gray-500 uppercase">Strength</span>
                                                    <span className="text-lg font-black text-dominant">{normalizationStrength}%</span>
                                                </div>
                                                <input
                                                    type="range" min="5" max="100" step="1" value={normalizationStrength}
                                                    onChange={(e) => setNormalizationStrength(parseInt(e.target.value))}
                                                    className="w-full accent-dominant h-1.5 bg-white/5 rounded-full"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4">Shuffle Intelligence</h3>
                                            <div className="space-y-2">
                                                <div className="grid grid-cols-2 gap-2">
                                                    {[
                                                        { id: 'standard', name: 'Standard', desc: 'Random' },
                                                        { id: 'weighted', name: 'Weighted', desc: 'Favorites' },
                                                        { id: 'discovery', name: 'Discovery', desc: 'New' },
                                                        { id: 'recent', name: 'Freshness', desc: 'Recent' }
                                                    ].map(mode => (
                                                        <button
                                                            key={mode.id}
                                                            onClick={() => setShuffleMode(mode.id as any)}
                                                            className={`p-3 rounded-xl border transition-all text-center ${playerState.shuffleMode === mode.id ? 'bg-dominant/20 border-dominant text-white ring-2 ring-dominant/20' : 'bg-black/20 border-white/5 text-gray-500 hover:bg-white/5'}`}
                                                        >
                                                            <div className="font-black text-[10px] uppercase tracking-tighter">{mode.name}</div>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'metadata' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="bg-white/5 border border-white/10 rounded-3xl p-8 shadow-2xl">
                                <h2 className="text-2xl font-black text-white mb-3">Advanced Metadata Editing</h2>
                                <p className="text-sm text-gray-500 mb-8">Select how edits are applied, then select tracks and launch the full editor.</p>

                                <div className="mb-8">
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Default Write Target</label>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        {[
                                            { id: 'musicbib', label: 'musicBib.json', desc: 'Apply edits into the working library snapshot export.' },
                                            { id: 'file', label: 'Audio File', desc: 'Apply edits as persistent file-level overrides.' },
                                            { id: 'both', label: 'Both', desc: 'Apply both workflows in one operation.' }
                                        ].map(option => (
                                            <button
                                                key={option.id}
                                                onClick={() => {
                                                    const target = option.id as MetadataWriteTarget;
                                                    setMetadataWriteTarget(target);
                                                    persistenceService.updatePreferences({ metadataWriteTarget: target });
                                                }}
                                                className={`text-left p-4 rounded-2xl border transition-all ${metadataWriteTarget === option.id ? 'bg-dominant/20 border-dominant text-white' : 'bg-black/20 border-white/10 text-gray-300 hover:bg-white/5'}`}
                                            >
                                                <div className="font-black text-sm mb-1">{option.label}</div>
                                                <div className="text-[10px] text-gray-500">{option.desc}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <div className="flex items-center justify-between gap-3 mb-2">
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Track Selection</label>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setSelectedHashes(new Set(metadataCandidates.map(t => t.logic.hash_sha256)))}
                                                className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                                            >
                                                Select visible
                                            </button>
                                            <button
                                                onClick={() => setSelectedHashes(new Set())}
                                                className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-white/5 text-gray-500 hover:text-gray-300 hover:bg-white/10 transition-all"
                                            >
                                                Clear
                                            </button>
                                        </div>
                                    </div>
                                    <input
                                        type="text"
                                        value={metadataSearch}
                                        onChange={(e) => setMetadataSearch(e.target.value)}
                                        placeholder="Search by title, artist, album..."
                                        className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-dominant"
                                    />
                                </div>

                                <div className="max-h-80 overflow-y-auto custom-scrollbar border border-white/10 rounded-2xl bg-black/20">
                                    {metadataCandidates.map(track => {
                                        const hash = track.logic.hash_sha256;
                                        const checked = selectedHashes.has(hash);
                                        return (
                                            <button
                                                key={hash}
                                                onClick={() => toggleTrackSelection(hash)}
                                                className={`w-full text-left px-4 py-3 border-b border-white/5 last:border-b-0 transition-colors ${checked ? 'bg-dominant/15' : 'hover:bg-white/5'}`}
                                            >
                                                <div className="flex items-center justify-between gap-4">
                                                    <div className="min-w-0">
                                                        <div className="text-sm font-bold text-white truncate">{track.metadata?.title || track.logic.track_name}</div>
                                                        <div className="text-[10px] text-gray-500 uppercase tracking-widest truncate">{track.metadata?.artists?.join(', ') || 'Unknown Artist'} • {track.metadata?.album || 'Unknown Album'}</div>
                                                    </div>
                                                    <div className={`w-4 h-4 rounded border ${checked ? 'bg-dominant border-dominant' : 'border-white/20'}`}></div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="mt-6 flex items-center justify-between gap-4">
                                    <p className="text-xs text-gray-500">{selectedHashes.size} track(s) selected</p>
                                    <div className="flex items-center gap-2">
                                        {playerState.currentTrack && (
                                            <button
                                                onClick={() => {
                                                    setSelectedHashes(new Set([playerState.currentTrack!.logic.hash_sha256]));
                                                    setEditingTracks([playerState.currentTrack!]);
                                                }}
                                                className="px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all bg-white/5 text-gray-300 hover:bg-white/10"
                                            >
                                                Edit Now Playing
                                            </button>
                                        )}
                                        <button
                                            onClick={openMetadataEditor}
                                            disabled={selectedHashes.size === 0}
                                            className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${selectedHashes.size === 0 ? 'bg-white/5 text-gray-600 cursor-not-allowed' : 'bg-dominant text-on-dominant hover:bg-dominant-light'}`}
                                        >
                                            Open Advanced Editor
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'maintenance' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {/* Maintenance Header Tabs */}
                            <div className="flex gap-4 mb-4">
                                {(['duplicates', 'health', 'data'] as const).map(tab => (
                                    <button
                                        key={tab}
                                        onClick={() => setMaintenanceTab(tab)}
                                        className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${maintenanceTab === tab ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </div>

                            {maintenanceTab === 'duplicates' && (
                                <div className="space-y-8">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="bg-white/5 border border-white/5 p-8 rounded-3xl">
                                            <h3 className="text-lg font-black text-white mb-2 flex items-center gap-2">
                                                <Zap className="text-red-500" size={20} />
                                                Exact Hash Matches
                                                <span className="ml-auto text-xs px-2 py-0.5 bg-red-500/10 text-red-500 rounded-md">{duplicateGroups.exact.length}</span>
                                            </h3>
                                            <p className="text-xs text-gray-500 mb-6">Files with identical audio data hashes. Safe to remove duplicates.</p>
                                            <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar pr-2">
                                                {duplicateGroups.exact.slice(0, 10).map((g, i) => (
                                                    <div key={i} className="p-4 bg-black/20 rounded-2xl border border-white/5 flex flex-col gap-2">
                                                        <div className="font-bold text-xs text-white truncate">{g[0].metadata?.title || g[0].logic.track_name}</div>
                                                        <div className="space-y-1">
                                                            {g.map(t => <div key={t.id} className="text-[10px] text-gray-500 truncate opacity-60 font-mono italic">{t.file.path}</div>)}
                                                        </div>
                                                    </div>
                                                ))}
                                                {duplicateGroups.exact.length === 0 && <div className="p-8 text-center text-xs text-gray-500 italic">No exact duplicates found.</div>}
                                            </div>
                                        </div>
                                        <div className="bg-white/5 border border-white/5 p-8 rounded-3xl">
                                            <h3 className="text-lg font-black text-white mb-2 flex items-center gap-2">
                                                <ShieldAlert className="text-yellow-500" size={20} />
                                                Probable Duplicates
                                                <span className="ml-auto text-xs px-2 py-0.5 bg-yellow-500/10 text-yellow-500 rounded-md">{duplicateGroups.probable.length}</span>
                                            </h3>
                                            <p className="text-xs text-gray-500 mb-6">Different files with matching Title and Artist tags.</p>
                                            <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar pr-2">
                                                {duplicateGroups.probable.slice(0, 10).map((g, i) => (
                                                    <div key={i} className="p-4 bg-black/20 rounded-2xl border border-white/5 flex flex-col gap-2">
                                                        <div className="font-bold text-xs text-white truncate">{g[0].metadata?.title}</div>
                                                        <div className="text-[10px] text-gray-500 uppercase tracking-widest font-black">{g[0].metadata?.artists?.[0]}</div>
                                                    </div>
                                                ))}
                                                {duplicateGroups.probable.length === 0 && <div className="p-8 text-center text-xs text-gray-500 italic">No fuzzy duplicates found.</div>}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {maintenanceTab === 'health' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="bg-white/5 border border-white/5 p-8 rounded-3xl">
                                        <h3 className="text-lg font-black text-white mb-2 flex items-center gap-2">
                                            <BarChart3 className="text-dominant" size={20} />
                                            Low Bitrate
                                            <span className="ml-auto text-xs px-2 py-0.5 bg-dominant/10 text-dominant rounded-md">{healthIssues.lowBitrate.length}</span>
                                        </h3>
                                        <p className="text-xs text-gray-500 mb-6">Audio quality under 128kbps.</p>
                                        <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar pr-2">
                                            {healthIssues.lowBitrate.map(t => (
                                                <div key={t.id} className="flex justify-between items-center p-3 bg-black/20 rounded-xl border border-white/5">
                                                    <span className="text-[10px] text-white font-bold truncate pr-4">{t.metadata?.title || t.logic.track_name}</span>
                                                    <span className="text-[10px] font-black text-gray-500 uppercase whitespace-nowrap">{t.audio_specs.bitrate} kbps</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="bg-white/5 border border-white/5 p-8 rounded-3xl">
                                        <h3 className="text-lg font-black text-white mb-2 flex items-center gap-2">
                                            <FileWarning className="text-orange-500" size={20} />
                                            Incomplete Metadata
                                            <span className="ml-auto text-xs px-2 py-0.5 bg-orange-500/10 text-orange-500 rounded-md">{healthIssues.missingMetadata.length}</span>
                                        </h3>
                                        <p className="text-xs text-gray-500 mb-6">Tracks missing Genre, Year or Album tags.</p>
                                        <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar pr-2">
                                            {healthIssues.missingMetadata.map(t => (
                                                <div key={t.id} className="p-3 bg-black/20 rounded-xl border border-white/5">
                                                    <div className="text-[10px] text-white font-bold truncate mb-1">{t.metadata?.title || t.logic.track_name}</div>
                                                    <div className="flex gap-2">
                                                        {!t.metadata?.genre && <span className="text-[8px] bg-white/5 px-1 rounded text-orange-400">GENRE</span>}
                                                        {!t.metadata?.year && <span className="text-[8px] bg-white/5 px-1 rounded text-orange-400">YEAR</span>}
                                                        {!t.metadata?.album && <span className="text-[8px] bg-white/5 px-1 rounded text-orange-400">ALBUM</span>}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {maintenanceTab === 'data' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="bg-white/5 border border-white/5 p-8 rounded-3xl relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-dominant/5 blur-3xl -z-10 transition-all group-hover:bg-dominant/10"></div>
                                        <h3 className="text-xl font-black text-white mb-6">Library Backup</h3>
                                        <p className="text-xs text-gray-500 mb-8 leading-relaxed">Save all your playlists, ratings, and metadata overrides into a portable JSON file.</p>
                                        <button onClick={handleExport} className="w-full flex items-center justify-center gap-3 py-4 bg-dominant text-black rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-dominant-light transition-all shadow-xl shadow-dominant/20 active:scale-95">
                                            <Download size={16} /> Export JSON
                                        </button>
                                        <button className="w-full mt-3 flex items-center justify-center gap-3 py-4 bg-white/5 text-gray-400 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all border border-white/5">
                                            <RefreshCcw size={16} /> Restore Backup
                                        </button>
                                        <div className="mt-4 p-3 rounded-xl border border-white/10 bg-black/20">
                                            <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Codec Compatibility Helper</div>
                                            <p className="text-[10px] text-gray-500 mb-2">Generate AAC-compatible copies (keeps originals) for unsupported ALAC tracks.</p>
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText('powershell -ExecutionPolicy Bypass -File .\\scripts\\fix_codecs.ps1');
                                                    alert('PowerShell command copied. Run it from the project root.');
                                                }}
                                                className="w-full py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                                            >
                                                Copy Fix Command
                                            </button>
                                        </div>
                                    </div>

                                    <div className="bg-white/5 border border-white/5 p-8 rounded-3xl">
                                        <h3 className="text-xl font-black text-white mb-6">Danger Zone</h3>
                                        <div className="space-y-4">
                                            <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-2xl">
                                                <div className="font-bold text-xs text-red-500 mb-1">Clear Playback History</div>
                                                <p className="text-[10px] text-gray-500 mb-4">Removes recently played list and play counts.</p>
                                                <button onClick={clearHistory} className="px-4 py-2 bg-red-500/10 text-red-500 rounded-lg text-[10px] font-black uppercase hover:bg-red-500/20 transition-all">Execute Wipe</button>
                                            </div>
                                            <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-2xl">
                                                <div className="font-bold text-xs text-red-500 mb-1">Reset All Application Data</div>
                                                <p className="text-[10px] text-gray-500 mb-4">Wipe EVERYTHING (playlists, ratings, overrides).</p>
                                                <button className="px-4 py-2 bg-white/5 text-red-500 opacity-30 hover:opacity-100 rounded-lg text-[10px] font-black uppercase transition-all">Full Reset</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'stats' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="bg-white/5 border border-white/10 rounded-3xl p-8 shadow-2xl backdrop-blur-md">
                                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
                                    <div>
                                        <h2 className="text-2xl font-black text-white flex items-center gap-3">
                                            <BarChart3 className="text-dominant" size={24} />
                                            Library Stats
                                        </h2>
                                        <p className="text-sm text-gray-500">A compact view of your collection health and scale.</p>
                                    </div>
                                    <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                                        Updated from the loaded library snapshot
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                    {[
                                        { label: 'Tracks', value: libState.stats.totalTracks.toLocaleString() },
                                        { label: 'Duration', value: `${Math.round(libState.stats.totalDuration / 60).toLocaleString()} min` },
                                        { label: 'Size', value: `${libState.stats.totalSizeMb.toFixed(1)} MB` },
                                        { label: 'Lossless', value: libState.tracks.filter(t => t.audio_specs?.is_lossless).length.toLocaleString() },
                                    ].map(card => (
                                        <div key={card.label} className="p-5 rounded-2xl bg-black/25 border border-white/5">
                                            <div className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">{card.label}</div>
                                            <div className="text-2xl font-black text-white truncate">{card.value}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
