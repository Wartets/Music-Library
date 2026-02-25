import React from 'react';
import { ViewType } from '../layout/AppLayout';
import { Clock, Play, MoreHorizontal, ArrowUpDown } from 'lucide-react';
import { useLibrary } from '../../contexts/LibraryContext';
import { usePlayer } from '../../contexts/PlayerContext';
import { TrackItem } from '../../types/music';
import { VirtualList } from '../shared/VirtualList';
import { persistenceService } from '../../services/persistence';
import { ArtworkImage } from '../shared/ArtworkImage';


interface HistoryViewProps {
    onNavigate: (view: ViewType, data?: any) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = () => {
    const { state: libState } = useLibrary();
    const { state: playerState, playTrack } = usePlayer();

    // Map history IDs to actual tracks
    const historyTracks = React.useMemo(() => {
        const historyIds = persistenceService.getHistoryIds();
        return historyIds.map(id => libState.tracks.find(t => t.logic.hash_sha256 === id)).filter((t): t is TrackItem => !!t);
    }, [libState.tracks, playerState.history]);

    const handlePlay = (track: TrackItem) => {
        playTrack(track, historyTracks);
    };

    const renderHeader = () => {
        const columns = libState.columnConfig.filter(c => c.visible);
        return (
            <div className="flex px-4 py-2 border-b border-white/5 bg-white/5 backdrop-blur-md rounded-t-xl">
                {columns.map(col => (
                    <div
                        key={col.id}
                        className={`text-[10px] font-black uppercase tracking-widest text-gray-500 ${col.width === 0 ? 'flex-1' : ''}`}
                        style={col.width !== 0 ? { width: col.width } : {}}
                    >
                        {col.label}
                    </div>
                ))}
                <div className="w-10"></div>
            </div>
        );
    };

    const renderRow = (track: TrackItem, index: number) => {
        const columns = libState.columnConfig.filter(c => c.visible);
        const isPlaying = playerState.currentTrack?.logic.hash_sha256 === track.logic.hash_sha256;

        return (
            <div
                key={`${track.logic.hash_sha256}-${index}`}
                className={`flex items-center px-4 py-2 hover:bg-white/5 group transition-all cursor-pointer border-b border-white/[0.02] last:border-0 ${isPlaying ? 'bg-dominant/10' : ''}`}
                onDoubleClick={() => handlePlay(track)}
            >
                {columns.map(col => (
                    <div
                        key={col.id}
                        className={`text-xs truncate pr-4 ${col.width === 0 ? 'flex-1' : ''} ${isPlaying ? 'text-dominant font-bold' : 'text-gray-400'}`}
                        style={col.width !== 0 ? { width: col.width } : {}}
                    >
                        {(() => {
                            switch (col.id) {
                                case 'number': return index + 1;
                                case 'artwork':
                                    const art = track.artworks?.track_artwork?.[0] || track.artworks?.album_artwork?.[0];
                                    return (
                                        <div className="w-8 h-8 rounded-md bg-white/5 overflow-hidden">
                                            {art ? (
                                                <ArtworkImage details={art} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-[10px]">?</div>
                                            )}
                                        </div>
                                    );
                                case 'title':
                                    return (
                                        <div className="flex flex-col">
                                            <span className={`truncate ${isPlaying ? 'text-white' : 'text-gray-200'}`}>{track.metadata?.title || track.logic.track_name}</span>
                                            <span className="text-[10px] opacity-60 truncate">{track.metadata?.artists?.join(', ') || 'Unknown Artist'}</span>
                                        </div>
                                    );
                                case 'album': return track.metadata?.album || '-';
                                case 'year': return track.metadata?.year || '-';
                                case 'genre': return track.metadata?.genre || '-';
                                case 'duration': return track.audio_specs.duration;
                                case 'bitrate': return track.audio_specs.bitrate + ' kbps';
                                case 'size': return track.file.size_mb.toFixed(1) + ' MB';
                                default: return '-';
                            }
                        })()}
                    </div>
                ))}

                <div className="w-10 flex justify-end opacity-0 group-hover:opacity-100">
                    <button className="p-1 hover:text-white"><MoreHorizontal size={14} /></button>
                </div>
            </div>
        );
    };

    return (
        <div className="h-full flex flex-col pt-24 px-6 pb-0 overflow-hidden">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                        <Clock className="text-dominant" /> Playback History
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">Tracks you've listened to recently across all sessions.</p>
                </div>

                <div className="flex items-center gap-2">
                    <button className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-black uppercase tracking-widest text-gray-400 hover:text-white transition-all border border-white/5">
                        <ArrowUpDown size={14} /> Sort
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-dominant text-on-dominant rounded-xl text-xs font-black uppercase tracking-widest hover:bg-dominant-light transition-all shadow-lg shadow-dominant/10">
                        <Play size={14} /> Clear History
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col bg-[#111]/40 rounded-t-2xl border-x border-t border-white/5">
                {renderHeader()}
                <div className="flex-1 overflow-hidden">
                    <VirtualList
                        items={historyTracks}
                        rowHeight={56}
                        renderRow={(track: TrackItem, idx: number) => renderRow(track, idx)}
                    />
                </div>
            </div>
        </div>
    );
};
