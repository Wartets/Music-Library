import React from 'react';
import { useLibrary } from '../../../contexts/LibraryContext';
import { usePlayer } from '../../../contexts/PlayerContext';
import type { MetadataWriteTarget } from '../../../services/persistence';
import { useSettingsView } from '../SettingsViewContext';

export const MetadataSettingsTab: React.FC = () => {
    const { setEditingTracks } = useLibrary();
    const { state: playerState } = usePlayer();
    const {
        metadataCandidates,
        metadataSearch,
        metadataWriteTarget,
        openMetadataEditor,
        selectedHashes,
        setMetadataSearch,
        setMetadataWriteTarget,
        setSelectedHashes,
        toggleTrackSelection
    } = useSettingsView();

    return (
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
                                onClick={() => setMetadataWriteTarget(option.id as MetadataWriteTarget)}
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
                                onClick={() => setSelectedHashes(new Set(metadataCandidates.map(track => track.logic.hash_sha256)))}
                                className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-all active:scale-95"
                            >
                                Select visible
                            </button>
                            <button
                                onClick={() => setSelectedHashes(new Set())}
                                className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-white/5 text-gray-500 hover:text-gray-300 hover:bg-white/10 transition-all active:scale-95"
                            >
                                Clear
                            </button>
                        </div>
                    </div>
                    <input
                        type="text"
                        value={metadataSearch}
                        onChange={(event) => setMetadataSearch(event.target.value)}
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
                                        <div className="text-[10px] text-gray-500 uppercase tracking-widest truncate">
                                            {track.metadata?.artists?.join(', ') || 'Unknown Artist'} | {track.metadata?.album || 'Unknown Album'}
                                        </div>
                                    </div>
                                    <div className={`w-4 h-4 rounded border ${checked ? 'bg-dominant border-dominant' : 'border-white/20'}`} />
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
    );
};
