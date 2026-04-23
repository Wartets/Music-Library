import React from 'react';
import { ViewType } from '../layout/AppLayout';
import { Clock, Play, ArrowUpDown } from 'lucide-react';
import { useLibrary } from '../../contexts/LibraryContext';
import { usePlayer } from '../../contexts/PlayerContext';
import { TrackItem } from '../../types/music';
import { VirtualList } from '../shared/VirtualList';
import { persistenceService } from '../../services/persistence';
import { useTrackContextMenu } from '../../hooks/useTrackContextMenu';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { TrackRow } from '../shared/TrackRow';


interface HistoryViewProps {
    onNavigate: (view: ViewType, data?: any) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = () => {
    const { state: libState } = useLibrary();
    const { state: playerState, playTrack } = usePlayer();
    const { openTrackContextMenu } = useTrackContextMenu();
    const isMobile = useIsMobile();

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
        const isPlaying = playerState.currentTrack?.logic.hash_sha256 === track.logic.hash_sha256;

        return (
            <TrackRow
                key={`${track.logic.hash_sha256}-${index}`}
                track={track}
                index={index}
                isPlaying={isPlaying}
                list={historyTracks}
                query={undefined}
                showIndex={true}
                showArtwork={true}
                showCollection={false}
                showRating={false}
                showDuration
                onPlay={(t) => handlePlay(t)}
                onContextMenu={(e, t) => openTrackContextMenu(e, t, historyTracks, undefined)}
                className={`border-b border-white/[0.02] last:border-0 rounded-none px-4 py-2 ${isPlaying ? 'bg-dominant/10' : ''}`}
                artworkClassName="w-11 h-11 rounded-md"
                subtitleClassName="opacity-60"
            />
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
                        return (
                            <TrackRow
                                key={`${track.logic.hash_sha256}-${index}`}
                                track={track}
                                index={index}
                                isPlaying={isPlaying}
                                list={historyTracks}
                                showIndex={false}
                                showArtwork={true}
                                showCollection={false}
                                showRating={false}
                                showDuration
                                onPlay={(t) => handlePlay(t)}
                                onContextMenu={(e, t) => openTrackContextMenu(e, t, historyTracks, undefined)}
                                className={`rounded-xl border border-white/10 transition-colors ${isPlaying ? 'ring-1 ring-dominant/60 bg-dominant/10' : 'bg-white/[0.02] hover:bg-white/5'}`}
                            />
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
