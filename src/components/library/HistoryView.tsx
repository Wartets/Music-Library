import React from 'react';
import { ViewType } from '../layout/AppLayout';
import { Clock, Play, MoreHorizontal, ArrowUpDown } from 'lucide-react';
import { useLibrary } from '../../contexts/LibraryContext';
import { usePlayer } from '../../contexts/PlayerContext';
import { TrackItem } from '../../types/music';
import { VirtualList } from '../shared/VirtualList';
import { persistenceService } from '../../services/persistence';
import { ArtworkImage } from '../shared/ArtworkImage';
import { useTrackContextMenu } from '../../hooks/useTrackContextMenu';


interface HistoryViewProps {
    onNavigate: (view: ViewType, data?: any) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = () => {
    const { state: libState } = useLibrary();
    const { state: playerState, playTrack } = usePlayer();
    const { openTrackContextMenu } = useTrackContextMenu();
    const [isMobile, setIsMobile] = React.useState(() => window.innerWidth < 768);

    React.useEffect(() => {
        const media = window.matchMedia('(max-width: 767px)');
        const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
        setIsMobile(media.matches);
        media.addEventListener('change', onChange);
        return () => media.removeEventListener('change', onChange);
    }, []);

    // Map history IDs to actual tracks
    const historyTracks = React.useMemo(() => {
        const historyIds = persistenceService.getHistoryIds();
        const trackMap = new Map<string, TrackItem>();
        libState.tracks.forEach(track => {
            trackMap.set(track.logic.hash_sha256, track);
        });
        return historyIds
            .map(id => {
                const primaryId = libState.versionToPrimaryMap[id] || id;
                return trackMap.get(primaryId) || null;
            })
            .filter((t): t is TrackItem => !!t);
    }, [libState.tracks, libState.versionToPrimaryMap, playerState.history]);

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
                        className={`text-[10px] font-black uppercase tracking-widest text-gray-500 ${col.width === 0 ? 'flex-1' : ''} ${['album', 'genre', 'year', 'bitrate', 'size'].includes(col.id) ? 'hidden md:block' : ''}`}
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
                onContextMenu={(e) => openTrackContextMenu(e, track, historyTracks, undefined)}
            >
                {columns.map(col => (
                    <div
                        key={col.id}
                        className={`text-xs truncate pr-4 ${col.width === 0 ? 'flex-1' : ''} ${isPlaying ? 'text-dominant font-bold' : 'text-gray-400'} ${['album', 'genre', 'year', 'bitrate', 'size'].includes(col.id) ? 'hidden md:block' : ''}`}
                        style={col.width !== 0 ? { width: col.width } : {}}
                    >
                        {(() => {
                            switch (col.id) {
                                case 'number': return index + 1;
                                case 'artwork':
                                    const fallbackVersionWithArtwork = track.versions?.find(v =>
                                        v.artworks?.track_artwork?.[0] || v.artworks?.album_artwork?.[0]
                                    );
                                    const art = track.artworks?.track_artwork?.[0]
                                        || track.artworks?.album_artwork?.[0]
                                        || fallbackVersionWithArtwork?.artworks?.track_artwork?.[0]
                                        || fallbackVersionWithArtwork?.artworks?.album_artwork?.[0];
                                    return (
                                        <div className="w-11 h-11 rounded-md bg-white/5 overflow-hidden">
                                            {art ? (
                                                <ArtworkImage details={art} alt={track.metadata?.title || track.logic.track_name} className="w-full h-full object-cover" />
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
                    <button className="p-1.5 sm:p-1 min-w-8 min-h-8 sm:min-w-auto sm:min-h-auto flex items-center justify-center hover:text-white"><MoreHorizontal size={14} /></button>
                </div>
            </div>
        );
    };

    if (isMobile) {
        return (
            <div className="h-full overflow-y-auto custom-scrollbar pt-14 px-2 pb-28 bg-surface-primary">
                <div className="mb-3 flex items-center justify-between gap-2">
                    <div>
                        <h1 className="text-lg font-black tracking-tight flex items-center gap-2">
                            <Clock size={18} className="text-dominant" /> Playback History
                        </h1>
                        <p className="text-gray-500 text-[11px] mt-1">Recent tracks across all sessions.</p>
                    </div>

                    <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-wider text-gray-300 transition-all border border-white/10">
                        <ArrowUpDown size={12} /> Sort
                    </button>
                </div>

                <div className="mb-3 flex items-center justify-between">
                    <span className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">{historyTracks.length} tracks</span>
                    <button className="flex items-center gap-1.5 px-3 py-1.5 bg-dominant text-on-dominant rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-dominant-light transition-all">
                        <Play size={12} /> Clear
                    </button>
                </div>

                <div className="space-y-1.5">
                    {historyTracks.map((track, index) => {
                        const isPlaying = playerState.currentTrack?.logic.hash_sha256 === track.logic.hash_sha256;
                        const fallbackVersionWithArtwork = track.versions?.find(v =>
                            v.artworks?.track_artwork?.[0] || v.artworks?.album_artwork?.[0]
                        );
                        const art = track.artworks?.track_artwork?.[0]
                            || track.artworks?.album_artwork?.[0]
                            || fallbackVersionWithArtwork?.artworks?.track_artwork?.[0]
                            || fallbackVersionWithArtwork?.artworks?.album_artwork?.[0];

                        return (
                            <div
                                key={`${track.logic.hash_sha256}-${index}`}
                                className={`flex items-center gap-2.5 p-2.5 rounded-xl border border-white/10 transition-colors ${isPlaying ? 'ring-1 ring-dominant/60 bg-dominant/10' : 'bg-white/[0.02] hover:bg-white/5'}`}
                                onDoubleClick={() => handlePlay(track)}
                                onContextMenu={(e) => openTrackContextMenu(e, track, historyTracks, undefined)}
                            >
                                <div className="w-12 h-12 rounded-lg bg-white/5 overflow-hidden border border-white/10 flex-shrink-0">
                                    {art ? (
                                        <ArtworkImage details={art} alt={track.metadata?.title || track.logic.track_name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-[10px]">?</div>
                                    )}
                                </div>

                                <div className="min-w-0 flex-1">
                                    <div className={`text-xs font-bold truncate ${isPlaying ? 'text-dominant-light' : 'text-white'}`}>
                                        {track.metadata?.title || track.logic.track_name}
                                    </div>
                                    <div className="text-[10px] text-gray-500 truncate">{track.metadata?.artists?.join(', ') || 'Unknown Artist'}</div>
                                </div>

                                <div className="text-[10px] text-gray-400 font-mono text-right">
                                    {track.audio_specs.duration || '0:00'}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    return (
            <div className="h-full flex flex-col pt-14 md:pt-20 px-3 md:px-6 pb-0 overflow-hidden">
            <div className="mb-4 md:mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-3">
                        <Clock className="text-dominant" /> Playback History
                    </h1>
                    <p className="text-gray-500 text-xs md:text-sm mt-1">Tracks you've listened to recently across all sessions.</p>
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
                        rowHeight={isMobile ? 48 : 56}
                        renderRow={(track: TrackItem, idx: number) => renderRow(track, idx)}
                        overscan={isMobile ? 3 : 5}
                    />
                </div>
            </div>
        </div>
    );
};
