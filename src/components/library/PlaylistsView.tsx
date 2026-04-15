import React, { useState } from 'react';
import { persistenceService, Playlist } from '../../services/persistence';
import { useLibrary } from '../../contexts/LibraryContext';
import { usePlayer } from '../../contexts/PlayerContext';
import { useUI } from '../../contexts/UIContext';
import { TrackItem } from '../../types/music';
import { Play, ListPlus, ListMinus, Trash2, FolderPlus, ListMusic, ScanSearch, Pencil, Plus, Edit3, Clock, Database, Copy, Download } from 'lucide-react';
import { useTrackContextMenu } from '../../hooks/useTrackContextMenu';
import { ArtworkImage } from '../shared/ArtworkImage';
import { SmartPlaylistBuilder } from './SmartPlaylistBuilder';
import { PlaylistEditor } from './PlaylistEditor';
import { evaluateSmartPlaylist, SmartPlaylistDefinition } from '../../utils/smartPlaylistEvaluator';

interface PlaylistsViewProps {
    onNavigate?: (view: any, data?: any) => void;
}

export const PlaylistsView: React.FC<PlaylistsViewProps> = ({ onNavigate }) => {
    const { state, setEditingTracks, refresh } = useLibrary();
    const { playTrack } = usePlayer();
    const { showContextMenu, showToast } = useUI();
    const { openTrackContextMenu } = useTrackContextMenu();
    const [playlists, setPlaylists] = useState<Playlist[]>(persistenceService.getPlaylists());
    const [smartPlaylists, setSmartPlaylists] = useState<SmartPlaylistDefinition[]>(persistenceService.getSmartPlaylists());
    const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | SmartPlaylistDefinition | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [isCreatingSmart, setIsCreatingSmart] = useState(false);
    const [newPlaylistName, setNewPlaylistName] = useState('');
    const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null);

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newPlaylistName.trim()) return;
        const newPl = persistenceService.createPlaylist(newPlaylistName.trim());
        setPlaylists(persistenceService.getPlaylists());
        setNewPlaylistName('');
        setIsCreating(false);
        setSelectedPlaylist(newPl);
        showToast(`Playlist "${newPl.name}" created`, 'success');
    };

    const onRightClickTrack = (e: React.MouseEvent, track: TrackItem, playlist: Playlist) => {
        openTrackContextMenu(e, track, state.tracks, onNavigate, [
            { divider: true, label: '', onClick: () => { } },
            {
                label: 'Remove from Playlist',
                icon: <ListMinus size={14} />,
                danger: true,
                onClick: () => {
                    persistenceService.removeFromPlaylist(playlist.id, track.logic.hash_sha256);
                    const updated = persistenceService.getPlaylists();
                    setPlaylists(updated);
                    const refreshed = updated.find(p => p.id === playlist.id);
                    if (refreshed) setSelectedPlaylist(refreshed);
                    showToast('Track removed from playlist');
                    refresh();
                }
            }
        ]);
    };

    const onRightClickPlaylist = (e: React.MouseEvent, pl: Playlist) => {
        e.preventDefault();
        e.stopPropagation();

        showContextMenu(e.clientX, e.clientY, [
            {
                label: `Play ${pl.name}`,
                icon: <Play size={14} fill="currentColor" />,
                onClick: () => {
                    const tracks = pl.trackIds.map(h => state.tracks.find(t => t.logic.hash_sha256 === h)).filter(Boolean) as TrackItem[];
                    if (tracks.length > 0) playTrack(tracks[0], tracks);
                }
            },
            { divider: true, label: '', onClick: () => { } },
            {
                label: 'Export as M3U',
                icon: <ListMusic size={14} />,
                onClick: () => {
                    const tracks = pl.trackIds.map(h => state.tracks.find(t => t.logic.hash_sha256 === h)).filter(Boolean) as TrackItem[];
                    let m3u = '#EXTM3U\n';
                    tracks.forEach(t => {
                        const dur = t.audio_specs?.duration || '0';
                        const secs = dur.split(':').reduce((acc, v) => acc * 60 + parseFloat(v), 0);
                        m3u += `#EXTINF:${Math.round(secs)},${t.metadata?.artists?.[0] || 'Unknown'} - ${t.metadata?.title || t.logic.track_name}\n`;
                        m3u += `${t.file?.path || ''}\n`;
                    });
                    const blob = new Blob([m3u], { type: 'audio/x-mpegurl' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${pl.name}.m3u`;
                    a.click();
                    URL.revokeObjectURL(url);
                    showToast(`Exported "${pl.name}.m3u"`, 'success');
                }
            },
            { divider: true, label: '', onClick: () => { } },
            {
                label: 'Edit Playlist',
                icon: <Pencil size={14} />,
                onClick: () => setEditingPlaylist(pl)
            },
            {
                label: 'Duplicate Playlist',
                icon: <Copy size={14} />,
                onClick: () => {
                    const clone = persistenceService.createPlaylist(`${pl.name} (Copy)`, pl.description);
                    pl.trackIds.forEach(hash => persistenceService.addTrackToPlaylist(clone.id, hash));
                    if (pl.customImage) {
                        persistenceService.updatePlaylist(clone.id, { customImage: pl.customImage });
                    }
                    setPlaylists(persistenceService.getPlaylists());
                    showToast('Playlist duplicated', 'success');
                }
            },
            {
                label: 'Clear Tracks',
                icon: <ListMinus size={14} />,
                onClick: () => {
                    if (!confirm(`Remove all tracks from \"${pl.name}\"?`)) return;
                    persistenceService.updatePlaylist(pl.id, { trackIds: [] });
                    const updated = persistenceService.getPlaylists();
                    setPlaylists(updated);
                    const refreshed = updated.find(p => p.id === pl.id);
                    if (refreshed) setSelectedPlaylist(refreshed);
                    showToast('Playlist cleared', 'success');
                }
            },
            {
                label: 'Export as JSON',
                icon: <Download size={14} />,
                onClick: () => {
                    const payload = JSON.stringify(pl, null, 2);
                    const blob = new Blob([payload], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${pl.name}.playlist.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                    showToast(`Exported \"${pl.name}.playlist.json\"`, 'success');
                }
            },
            {
                label: 'Delete Playlist',
                icon: <Trash2 size={14} />,
                danger: true,
                onClick: () => {
                    if (confirm(`Delete playlist "${pl.name}"?`)) {
                        persistenceService.deletePlaylist(pl.id);
                        setPlaylists(persistenceService.getPlaylists());
                        if (selectedPlaylist?.id === pl.id) setSelectedPlaylist(null);
                        showToast('Playlist deleted');
                    }
                }
            }
        ]);
    };

    const togglePlaylist = (pl: Playlist | SmartPlaylistDefinition) => {
        setSelectedPlaylist(selectedPlaylist?.id === pl.id ? null : pl);
    };

    const isSmartPlaylist = (pl: any): pl is SmartPlaylistDefinition => {
        return 'group' in pl;
    };

    const getActiveTrackIds = (): string[] => {
        if (!selectedPlaylist) return [];
        if (isSmartPlaylist(selectedPlaylist)) {
            const evaluated = evaluateSmartPlaylist(state.tracks, selectedPlaylist);
            return evaluated.map(t => t.logic.hash_sha256);
        }
        return selectedPlaylist.trackIds;
    };

    const activeTrackIds = getActiveTrackIds();

    const getTrackByHash = (hash: string): TrackItem | undefined => {
        return state.tracks.find(t => t.logic.hash_sha256 === hash);
    };

    return (
        <div className="h-full flex flex-col p-3 md:p-6 pt-16 md:pt-24 overflow-hidden relative z-10 bg-surface-primary">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4 md:mb-10">
                <div>
                    <h1 className="text-2xl md:text-4xl font-black tracking-tighter text-white">Playlists</h1>
                    <p className="text-gray-500 font-bold uppercase tracking-widest text-xs mt-1">{playlists.length + smartPlaylists.length} user collections</p>
                </div>
                <div className="flex gap-2 md:gap-4">
                    <button
                        onClick={() => { setIsCreating(false); setIsCreatingSmart(true); }}
                        className="bg-white/5 border border-white/10 text-white px-3 md:px-6 py-2.5 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all shadow-lg flex items-center gap-2"
                    >
                        <ScanSearch size={16} /> Smart Playlist
                    </button>
                    <button
                        onClick={() => { setIsCreatingSmart(false); setIsCreating(true); }}
                        className="bg-dominant text-on-dominant px-3 md:px-6 py-2.5 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest hover:bg-dominant-light transition-all shadow-lg"
                    >
                        + Create New
                    </button>
                </div>
            </div>

            {isCreatingSmart && (
                <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in">
                    <SmartPlaylistBuilder
                        onSave={(def) => {
                            setSmartPlaylists(persistenceService.getSmartPlaylists());
                            setIsCreatingSmart(false);
                            setSelectedPlaylist(def);
                            showToast(`Smart Playlist "${def.name}" created`, 'success');
                        }}
                        onCancel={() => setIsCreatingSmart(false)}
                    />
                </div>
            )}

            {editingPlaylist && (
                <PlaylistEditor
                    playlist={editingPlaylist}
                    onSave={(updated) => {
                        setPlaylists(persistenceService.getPlaylists());
                        if (selectedPlaylist?.id === updated.id) setSelectedPlaylist(updated);
                        setEditingPlaylist(null);
                        showToast('Playlist updated', 'success');
                    }}
                    onCancel={() => setEditingPlaylist(null)}
                    onDelete={(id) => {
                        persistenceService.deletePlaylist(id);
                        setPlaylists(persistenceService.getPlaylists());
                        if (selectedPlaylist?.id === id) setSelectedPlaylist(null);
                        setEditingPlaylist(null);
                        showToast('Playlist deleted', 'success');
                    }}
                />
            )}

            {isCreating && (
                <form onSubmit={handleCreate} className="mb-8 bg-white/5 p-6 rounded-3xl border border-white/10 flex gap-4 items-center animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-dominant">
                        <FolderPlus size={24} />
                    </div>
                    <input
                        type="text"
                        value={newPlaylistName}
                        onChange={e => setNewPlaylistName(e.target.value)}
                        placeholder="Name your masterpiece..."
                        className="bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white flex-1 outline-none focus:border-dominant transition-all font-bold"
                        autoFocus
                    />
                    <button type="submit" className="bg-dominant text-on-dominant font-black px-8 py-3 rounded-xl hover:bg-dominant-light transition-all uppercase tracking-widest text-xs">
                        Create
                    </button>
                    <button type="button" onClick={() => setIsCreating(false)} className="text-gray-400 font-bold hover:text-white px-4 py-3 transition-colors text-xs uppercase tracking-widest">
                        Discard
                    </button>
                </form>
            )}

            <div className="flex-1 flex flex-col md:flex-row gap-4 md:gap-10 overflow-hidden">
                {/* Left: List of Playlists */}
                <div className="w-full md:w-80 max-h-[40vh] md:max-h-none flex flex-col gap-3 overflow-y-auto custom-scrollbar pr-1 md:pr-2 pb-4 md:pb-8">
                    {playlists.length === 0 && smartPlaylists.length === 0 && !isCreating ? (
                        <div className="text-gray-600 font-bold uppercase tracking-widest text-[10px] flex flex-col h-48 items-center justify-center border-2 border-dashed border-white/5 rounded-3xl gap-4">
                            <FolderPlus size={32} className="opacity-20" />
                            Your library is quiet.
                        </div>
                    ) : (
                        <>
                            {smartPlaylists.map(pl => (
                                <button
                                    key={pl.id}
                                    onClick={() => togglePlaylist(pl)}
                                    className={`text-left p-5 rounded-2xl transition-all border block w-full group ${selectedPlaylist?.id === pl.id ? 'bg-dominant border-dominant shadow-2xl shadow-dominant/20' : 'bg-white/2 border-white/5 hover:bg-white/5 hover:border-white/10'}`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 border border-white/10 text-dominant">
                                            <ScanSearch size={20} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className={`font-black truncate text-base ${selectedPlaylist?.id === pl.id ? 'text-on-dominant' : 'text-white'}`}>{pl.name}</h3>
                                            <div className="flex items-center justify-between mt-1">
                                                <p className={`text-[10px] font-bold uppercase tracking-widest ${selectedPlaylist?.id === pl.id ? 'text-on-dominant/70' : 'text-gray-500'}`}>Smart Filter</p>
                                                <Play size={12} className={`${selectedPlaylist?.id === pl.id ? 'text-on-dominant' : 'text-transparent group-hover:text-dominant'} transition-colors`} fill="currentColor" />
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            ))}
                            {playlists.map(pl => (
                                <button
                                    key={pl.id}
                                    onClick={() => togglePlaylist(pl)}
                                    onContextMenu={(e) => onRightClickPlaylist(e, pl)}
                                    className={`text-left p-5 rounded-2xl transition-all border block w-full group ${selectedPlaylist?.id === pl.id ? 'bg-dominant border-dominant shadow-2xl shadow-dominant/20' : 'bg-white/2 border-white/5 hover:bg-white/5 hover:border-white/10'}`}
                                >
                                    <div className="flex items-center gap-4">
                                        {pl.customImage ? (
                                            <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-white/5 border border-white/10">
                                                <ArtworkImage src={pl.customImage} alt={pl.name} className="w-full h-full object-cover" />
                                            </div>
                                        ) : (
                                            <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 border border-white/10 text-white/20">
                                                <ListMusic size={20} />
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <h3 className={`font-black truncate text-base ${selectedPlaylist?.id === pl.id ? 'text-on-dominant' : 'text-white'}`}>{pl.name}</h3>
                                            <div className="flex items-center justify-between mt-1">
                                                <p className={`text-[10px] font-bold uppercase tracking-widest ${selectedPlaylist?.id === pl.id ? 'text-on-dominant/70' : 'text-gray-500'}`}>{pl.trackIds.length} tracks</p>
                                                <Play size={12} className={`${selectedPlaylist?.id === pl.id ? 'text-on-dominant' : 'text-transparent group-hover:text-dominant'} transition-colors`} fill="currentColor" />
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </>
                    )}
                </div>

                {/* Right: Selected Playlist Details */}
                <div className="flex-1 overflow-hidden relative min-h-0">
                    <AnimatePresence mode="wait">
                        {selectedPlaylist ? (
                            <div key={selectedPlaylist.id} className="h-full flex flex-col animate-in fade-in slide-in-from-right-4 duration-500">
                                <div className="mb-4 md:mb-10 flex flex-col md:flex-row items-start md:items-end gap-4 md:gap-8 pb-4 md:pb-10 border-b border-white/5 relative group">
                                    <div className="w-28 h-28 md:w-48 md:h-48 rounded-3xl overflow-hidden shadow-2xl border border-white/10 bg-white/5 flex-shrink-0 relative">
                                        {(selectedPlaylist as Playlist).customImage || isSmartPlaylist(selectedPlaylist) ? (
                                            <ArtworkImage
                                                src={isSmartPlaylist(selectedPlaylist) ? undefined : (selectedPlaylist as Playlist).customImage}
                                                alt={selectedPlaylist.name}
                                                className={`w-full h-full object-cover ${isSmartPlaylist(selectedPlaylist) ? 'opacity-0' : ''}`}
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-white/10">
                                                <ListMusic size={64} />
                                            </div>
                                        )}
                                        {isSmartPlaylist(selectedPlaylist) && (
                                            <div className="absolute inset-0 flex items-center justify-center text-dominant">
                                                <ScanSearch size={64} />
                                            </div>
                                        )}
                                        {!isSmartPlaylist(selectedPlaylist) && (
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <button
                                                    onClick={() => setEditingPlaylist(selectedPlaylist as Playlist)}
                                                    className="bg-white/20 hover:bg-white/30 p-3 rounded-full text-white backdrop-blur-md transition-transform hover:scale-110"
                                                >
                                                    <Edit3 size={24} />
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="px-2 py-0.5 bg-dominant/20 text-dominant text-[10px] font-black uppercase tracking-widest rounded-md">
                                                {isSmartPlaylist(selectedPlaylist) ? 'Smart Collection' : 'Curated Playlist'}
                                            </span>
                                            {isSmartPlaylist(selectedPlaylist) && (
                                                <span className="flex items-center gap-1 text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                                                    <Clock size={10} /> Live Evaluation
                                                </span>
                                            )}
                                        </div>
                                        <h2 className="text-3xl md:text-6xl font-black text-white tracking-tighter mb-2 md:mb-4 truncate leading-none">{selectedPlaylist.name}</h2>

                                        {!isSmartPlaylist(selectedPlaylist) && (selectedPlaylist as Playlist).description && (
                                            <p className="text-gray-400 font-medium text-sm max-w-2xl mb-6 line-clamp-2 italic">
                                                "{(selectedPlaylist as Playlist).description}"
                                            </p>
                                        )}

                                        <div className="flex items-center gap-6">
                                            <div className="flex items-center gap-2 text-gray-500 font-bold uppercase tracking-[0.2em] text-[10px]">
                                                <Database size={12} className="text-dominant" />
                                                <span>{activeTrackIds.length} tracks</span>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => {
                                                        const tracks = activeTrackIds.map(h => state.tracks.find(t => t.logic.hash_sha256 === h)).filter(Boolean) as TrackItem[];
                                                        if (tracks.length > 0) playTrack(tracks[0], tracks);
                                                    }}
                                                    className="flex items-center gap-2 px-4 md:px-8 py-2.5 md:py-3 bg-dominant text-on-dominant rounded-xl text-[10px] md:text-xs font-black hover:bg-dominant-light transition-all shadow-xl shadow-dominant/20 uppercase tracking-widest"
                                                >
                                                    <Play size={14} fill="currentColor" /> Play Mix
                                                </button>

                                                {!isSmartPlaylist(selectedPlaylist) && (
                                                    <button
                                                        onClick={() => setEditingPlaylist(selectedPlaylist as Playlist)}
                                                        className="flex items-center gap-2 px-4 md:px-6 py-2.5 md:py-3 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest text-white transition-all border border-white/10"
                                                    >
                                                        <Pencil size={14} /> Edit Details
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                                    {activeTrackIds.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-center text-gray-600 gap-4">
                                            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center">
                                                <ListMusic size={32} className="opacity-20" />
                                            </div>
                                            <p className="font-black uppercase tracking-[0.2em] text-xs">This collection is currently empty</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2 pb-20">
                                            {activeTrackIds.map((hash, idx) => {
                                                const track = getTrackByHash(hash);
                                                if (!track) return null;
                                                return (
                                                    <div
                                                        key={`${hash}-${idx}`}
                                                        className="flex items-center justify-between p-4 bg-white/2 border border-transparent rounded-2xl group hover:bg-white/5 hover:border-white/5 transition-all cursor-pointer relative"
                                                        onClick={() => playTrack(track, state.tracks)}
                                                        onContextMenu={(e) => {
                                                            if (!isSmartPlaylist(selectedPlaylist)) {
                                                                onRightClickTrack(e, track, selectedPlaylist as Playlist);
                                                            } else {
                                                                // For smart playlists, maybe just standard track context menu (play, queue)
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                showContextMenu(e.clientX, e.clientY, [
                                                                    { label: 'Play Now', icon: <Play size={14} fill="currentColor" />, onClick: () => playTrack(track, state.tracks) },
                                                                    { label: 'Add to Queue', icon: <ListPlus size={14} />, onClick: () => showToast('Added to queue') },
                                                                    { divider: true, label: '', onClick: () => { } },
                                                                    { label: 'Edit Metadata', icon: <Pencil size={14} />, onClick: () => setEditingTracks([track]) }
                                                                ]);
                                                            }
                                                        }}
                                                    >
                                                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-dominant rounded-r-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                                        <div className="flex items-center min-w-0 flex-1 gap-5">
                                                            <div className="w-12 h-12 rounded-xl bg-black/50 overflow-hidden flex items-center justify-center text-xs text-white/30 flex-shrink-0 border border-white/10 group-hover:border-white/20 transition-all">
                                                                <ArtworkImage details={track.artworks?.track_artwork?.[0] || track.artworks?.album_artwork?.[0]} alt={track.metadata?.title || track.logic.track_name} />
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <h4 className="text-white font-black text-sm truncate group-hover:text-dominant-light transition-colors">{track.metadata?.title || track.logic.track_name}</h4>
                                                                <p className="text-gray-500 font-bold text-[10px] uppercase tracking-tighter truncate mt-1">{track.metadata?.artists?.join(', ')}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-4 text-xs font-bold text-gray-600 font-mono">
                                                            {track.audio_specs?.duration}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center text-gray-500 select-none animate-in fade-in duration-700">
                                <div className="w-32 h-32 rounded-full bg-white/5 mb-8 flex items-center justify-center relative">
                                    <div className="absolute inset-0 bg-dominant/5 blur-3xl rounded-full"></div>
                                    <Plus size={48} className="opacity-10" />
                                </div>
                                <h2 className="text-xl font-black text-white/20 uppercase tracking-[0.4em]">Select a Collection</h2>
                                <p className="mt-4 text-xs font-bold uppercase tracking-widest text-gray-600">to view and manage your curated tracks</p>
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};

const AnimatePresence: React.FC<{ children: React.ReactNode, mode?: string }> = ({ children }) => <>{children}</>;
