import React, { useState, useMemo, useCallback } from 'react';
import { useLibrary } from '../../contexts/LibraryContext';
import { usePlayer } from '../../contexts/PlayerContext';
import { VirtualList } from '../shared/VirtualList';
import { TrackItem } from '../../types/music';
import { formatSizeMb } from '../../utils/formatters';
import {
    ChevronDown, ChevronRight, Folder, Play, SlidersHorizontal, ChevronUp, Shuffle
} from 'lucide-react';
import { ArtworkImage } from '../shared/ArtworkImage';
import { useTrackContextMenu } from '../../hooks/useTrackContextMenu';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { getTrackCollectionLabel } from '../../utils/collectionLabels';
import { useLibraryBrowserColumns } from './useLibraryBrowserColumns';
import { useLibraryBrowserSort } from './useLibraryBrowserSort';

const HighlightText: React.FC<{ text: string, query: string }> = ({ text, query }) => {
    if (!query.trim()) return <>{text}</>;
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return (
        <>
            {parts.map((part, i) =>
                part.toLowerCase() === query.toLowerCase() ? (
                    <mark key={i} className="bg-dominant/30 text-white rounded-sm px-0.5">{part}</mark>
                ) : (
                    part
                )
            )}
        </>
    );
};

interface LibraryBrowserProps {
    title: string;
    tracks: TrackItem[];
    onNavigate: (view: any, data?: any) => void;
    headerIcon?: React.ReactNode;
    subtitle?: string;
    onShufflePlay?: () => void;
    artworkPath?: string;
    description?: string;
}

export const LibraryBrowser: React.FC<LibraryBrowserProps> = ({
    title,
    tracks,
    onNavigate,
    headerIcon,
    subtitle,
    onShufflePlay,
    artworkPath,
    description
}) => {
    const { state: libraryState, setSortBy, updateColumnConfig } = useLibrary();
    const { playTrack, state: playerState } = usePlayer();
    const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
    const [showColumnConfig, setShowColumnConfig] = useState(false);
    const isMobile = useIsMobile();
    const columnConfigRef = React.useRef<HTMLDivElement>(null);
    const { visibleColumns, gridTemplate } = useLibraryBrowserColumns(libraryState.columnConfig);
    const { handleSortColumn, isColumnSorted, getSortDirection } = useLibraryBrowserSort(
        libraryState.sortBy,
        libraryState.sortOrder,
        setSortBy,
    );

    const moveColumn = useCallback((index: number, direction: number) => {
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= libraryState.columnConfig.length) return;
        const newConfig = [...libraryState.columnConfig];
        const [moved] = newConfig.splice(index, 1);
        newConfig.splice(newIndex, 0, moved);
        updateColumnConfig(newConfig);
    }, [libraryState.columnConfig, updateColumnConfig]);

    const toggleFolder = useCallback((folderKey: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedFolders(prev => ({
            ...prev,
            [folderKey]: !prev[folderKey]
        }));
    }, []);

    const flatList = useMemo(() => {
        const flat: any[] = [];
        tracks.forEach(track => {
            const hasVersions = track.versions && track.versions.length > 1;
            const groupKey = `${track.logic.hierarchy.folder || 'nofolder'}###${track.logic.track_name}`;
            const isExpanded = expandedFolders[groupKey] || false;

            flat.push({
                ...track,
                _isMain: true,
                _hasVersions: hasVersions,
                _isExpanded: isExpanded,
                _versionCount: track.versions?.length || 0,
                _folderKey: groupKey
            });

            if (hasVersions && isExpanded) {
                track.versions!.forEach((v, i) => {
                    flat.push({
                        ...v,
                        _isVersion: true,
                        _versionIndex: i + 1,
                        _folderKey: groupKey
                    });
                });
            }
        });
        return flat;
    }, [tracks, expandedFolders]);

    const { openTrackContextMenu } = useTrackContextMenu();

    const onRightClick = useCallback((e: React.MouseEvent, item: TrackItem) => {
        openTrackContextMenu(e, item, tracks, onNavigate);
    }, [openTrackContextMenu, tracks, onNavigate]);

    const LibraryRow = React.memo(({ item, index, isPlaying, libraryState, gridTemplate, playTrack, tracks, onRightClick, toggleFolder }: any) => {
        const isVersion = item._isVersion;

        return (
            <div
                className={`grid items-center px-6 py-2 min-h-[52px] hover:bg-white/5 cursor-pointer border-b border-white/5 group transition-all duration-200 ${isPlaying ? 'bg-dominant/10' : ''} ${isVersion ? 'bg-black/20' : ''}`}
                style={{ gridTemplateColumns: gridTemplate, gap: '1.5rem' }}
                onClick={() => playTrack(item, tracks)}
                onContextMenu={(e) => onRightClick(e, item)}
            >
                {visibleColumns.map((col: any) => {
                    const isRightAligned = ['year', 'bpm', 'duration', 'bitrate', 'size'].includes(col.id);
                    const responsiveClass =
                        col.id === 'bitrate' || col.id === 'size' ? 'hidden xl:flex' :
                            col.id === 'bpm' || col.id === 'genre' ? 'hidden lg:flex' :
                                col.id === 'year' ? 'hidden md:flex' : 'flex';

                    switch (col.id) {
                        case 'number':
                            return (
                                <div key={col.id} className={`${responsiveClass} text-gray-500 text-[10px] font-mono flex-shrink-0 text-center justify-center`}>
                                    {isVersion ? '' : index + 1}
                                </div>
                            );
                        case 'artwork':
                            return (
                                <div key={col.id} className={`${responsiveClass} w-12 h-12 rounded-lg bg-white/5 flex-shrink-0 overflow-hidden border border-white/5 group-hover:border-white/20 transition-all`}>
                                    <ArtworkImage
                                        details={item.artworks?.track_artwork?.[0] || item.artworks?.album_artwork?.[0]}
                                        alt={item.metadata?.title || item.logic?.track_name}
                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                    />
                                </div>
                            );
                        case 'title':
                            return (
                                <div key={col.id} className={`${responsiveClass} min-w-0 items-center gap-2 ${isVersion ? 'pl-8' : ''}`}>
                                    {item._hasVersions && (
                                        <button
                                            onClick={(e) => toggleFolder(item._folderKey, e)}
                                            className="p-2 min-w-10 min-h-10 flex items-center justify-center hover:bg-white/10 rounded transition-colors text-gray-400 hover:text-white active:scale-95"
                                            aria-label={item._isExpanded ? 'Collapse versions' : 'Expand versions'}
                                        >
                                            {item._isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                        </button>
                                    )}
                                    <div className="flex flex-col min-w-0 flex-1">
                                        <div className={`truncate font-bold text-sm flex items-center gap-2 ${isPlaying ? 'text-dominant-light' : 'text-white'}`}>
                                            <span className="truncate">
                                                {isVersion ? (
                                                    <HighlightText text={item.logic.version_name || item.file.name} query={libraryState.searchQuery} />
                                                ) : (
                                                    <>
                                                        <HighlightText text={item.logic.track_name || item.metadata?.title || 'Unknown'} query={libraryState.searchQuery} />
                                                        {item.logic.version_name && (
                                                            <span className="text-white/20 font-medium ml-1.5 text-[10px]">({item.logic.version_name})</span>
                                                        )}
                                                    </>
                                                )}
                                            </span>
                                            {item._hasVersions && !item._isExpanded && (
                                                <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-gray-500 font-bold uppercase tracking-wider flex-shrink-0">
                                                    {item._versionCount} vers.
                                                </span>
                                            )}
                                        </div>
                                        <div className="truncate text-[11px] text-gray-500 group-hover:text-gray-400 transition-colors">
                                            <HighlightText text={item.metadata?.artists?.join(', ') || 'Unknown Artist'} query={libraryState.searchQuery} />
                                        </div>
                                    </div>
                                </div>
                            );
                        case 'album':
                            return (
                                <div key={col.id} className={`${responsiveClass} truncate text-xs text-gray-500 pr-2 group-hover:text-gray-300 transition-colors`}>
                                    <HighlightText text={getTrackCollectionLabel(item)} query={libraryState.searchQuery} />
                                </div>
                            );
                        case 'genre':
                            return (
                                <div key={col.id} className={`${responsiveClass} truncate text-[11px] text-gray-400 italic pr-2 ${isRightAligned ? 'justify-end' : ''}`}>
                                    <HighlightText text={item.metadata?.genre || '-'} query={libraryState.searchQuery} />
                                </div>
                            );
                        case 'year':
                            return (
                                <div key={col.id} className={`${responsiveClass} text-xs text-gray-400 pr-2 font-mono ${isRightAligned ? 'justify-end' : ''}`}>
                                    <HighlightText text={item.metadata?.year || '-'} query={libraryState.searchQuery} />
                                </div>
                            );
                        case 'bpm':
                            return (
                                <div key={col.id} className={`${responsiveClass} text-xs text-gray-400 pr-2 font-mono ${isRightAligned ? 'justify-end' : ''}`}>
                                    {item.metadata?.bpm || '-'}
                                </div>
                            );
                        case 'duration':
                            return (
                                <div key={col.id} className={`${responsiveClass} text-xs text-gray-300 pr-2 font-mono font-bold ${isRightAligned ? 'justify-end' : ''}`}>
                                    {item.audio_specs?.duration || '0:00'}
                                </div>
                            );
                        case 'bitrate':
                            return (
                                <div key={col.id} className={`${responsiveClass} text-[10px] text-gray-600 pr-2 font-mono group-hover:text-gray-400 transition-colors ${isRightAligned ? 'justify-end' : ''}`}>
                                    {item.audio_specs?.bitrate?.replace(' Kbits/s', '') || '-'}
                                </div>
                            );
                        case 'size':
                            return (
                                <div key={col.id} className={`${responsiveClass} text-[10px] text-gray-600 font-mono group-hover:text-gray-400 transition-colors ${isRightAligned ? 'justify-end' : ''}`}>
                                    {formatSizeMb(item.file?.size_bytes)}
                                </div>
                            );
                        default:
                            return null;
                    }
                })}
            </div>
        );
    });

    const renderRow = useCallback((item: any, index: number) => {
        const isPlaying = playerState.currentTrack?.logic.hash_sha256 === item.logic.hash_sha256;

        return (
            <LibraryRow
                key={item.logic.hash_sha256 + (item._isVersion ? '-v' : '')}
                item={item}
                index={index}
                isPlaying={isPlaying}
                libraryState={libraryState}
                gridTemplate={gridTemplate}
                playTrack={playTrack}
                tracks={tracks}
                onRightClick={onRightClick}
                toggleFolder={toggleFolder}
            />
        );
    }, [playerState.currentTrack?.logic.hash_sha256, libraryState, gridTemplate, playTrack, tracks, onRightClick, toggleFolder]);

    const mobileRowHeight = 76;
    const desktopRowHeight = 52;

    const renderVirtualizedList = (rowHeight: number) => (
        <VirtualList
            items={flatList}
            rowHeight={rowHeight}
            renderRow={renderRow}
            overscan={isMobile ? 4 : 8}
        />
    );

    if (isMobile) {
        return (
            <div className="h-full flex flex-col overflow-hidden pt-14 px-3 sm:px-4 pb-0 bg-surface-primary">
                <div className="mb-3 flex items-center gap-3">
                    {artworkPath ? (
                        <div className="w-14 h-14 rounded-xl overflow-hidden shadow-lg flex-shrink-0 border border-white/10 relative">
                            <ArtworkImage
                                src={artworkPath}
                                alt={title}
                                className="w-full h-full object-cover"
                            />
                        </div>
                    ) : headerIcon ? (
                        <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-dominant border border-white/5 shadow-lg">
                            {headerIcon}
                        </div>
                    ) : (
                        <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-dominant border border-white/5 shadow-lg">
                            <Folder size={18} />
                        </div>
                    )}

                    <div className="min-w-0 flex-1">
                        <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-dominant/70 truncate">
                            {subtitle || 'Collection'}
                        </span>
                        <h1 className="text-lg font-black tracking-tight text-white truncate">
                            {title}
                        </h1>
                    </div>
                </div>

                {description && (
                    <p className="text-gray-400 text-[11px] mb-3 font-medium leading-relaxed line-clamp-2">
                        {description}
                    </p>
                )}

                <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => {
                                if (tracks.length > 0) {
                                    const shuffled = [...tracks].sort(() => Math.random() - 0.5);
                                    playTrack(shuffled[0], shuffled);
                                }
                            }}
                            className="flex items-center gap-2 px-3 py-3 bg-white/10 text-gray-300 rounded-xl text-[10px] font-black uppercase tracking-[0.14em] active:scale-95 hover:bg-white/15 min-h-11"
                            aria-label="Shuffle play"
                        >
                            <Shuffle size={14} /> Shuffle
                        </button>
                        <button
                            onClick={onShufflePlay || (() => playTrack(tracks[0], tracks))}
                            className="flex items-center gap-2 px-3.5 py-3 bg-dominant text-on-dominant rounded-xl text-[10px] font-black uppercase tracking-[0.14em] active:scale-95 min-h-11"
                            aria-label="Play all in order"
                        >
                            <Play size={14} fill="currentColor" /> Play All
                        </button>
                    </div>
                    <span className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">
                        {tracks.length} tracks
                    </span>
                </div>

                <div className="flex-1 min-h-0 overflow-hidden">
                    {renderVirtualizedList(mobileRowHeight)}
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col pt-14 md:pt-20 px-3 md:px-6 pb-0 bg-surface-primary">
            {/* Header */}
            <div className={`mb-4 md:mb-8 flex flex-col sm:flex-row items-center sm:items-end gap-4 md:gap-8 ${artworkPath ? 'md:mb-10' : 'md:mb-6'}`}>
                {artworkPath ? (
                    <div className="w-20 h-20 md:w-56 md:h-56 rounded-2xl overflow-hidden shadow-2xl flex-shrink-0 border border-white/10 group relative">
                        <ArtworkImage
                            src={artworkPath}
                            alt={title}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors"></div>
                    </div>
                ) : headerIcon ? (
                    <div className="w-12 h-12 md:w-20 md:h-20 bg-white/5 rounded-2xl flex items-center justify-center text-dominant border border-white/5 shadow-xl">
                        {headerIcon}
                    </div>
                ) : <div className="w-12 h-12 md:w-20 md:h-20 bg-white/5 rounded-2xl flex items-center justify-center text-dominant border border-white/5 shadow-xl">
                    <Folder size={32} />
                </div>}

                <div className="flex-1 flex flex-col items-center sm:items-start text-center sm:text-left">
                    <span className="text-xs font-black uppercase tracking-[0.3em] text-dominant mb-3 opacity-60">
                        {subtitle || 'Collection'}
                    </span>
                    <h1 className="text-2xl md:text-5xl font-black tracking-tighter text-white mb-2 md:mb-3">
                        {title}
                    </h1>
                    {description && (
                        <p className="text-gray-400 text-xs md:text-base max-w-2xl mb-3 md:mb-5 font-medium leading-relaxed">
                            {description}
                        </p>
                    )}
                    <div className="flex items-center gap-2 md:gap-4">
                        <button
                            onClick={onShufflePlay || (() => playTrack(tracks[0], tracks))}
                            className="flex items-center gap-2 md:gap-3 px-5 md:px-8 py-3 md:py-3 bg-dominant text-on-dominant rounded-xl text-sm md:text-xs font-black uppercase tracking-[0.16em] md:tracking-[0.2em] hover:bg-dominant-light transition-all shadow-xl shadow-dominant/10 active:scale-95 min-h-12 md:min-h-11"
                        >
                            <Play size={16} fill="currentColor" /> Play All
                        </button>
                        <span className="hidden sm:block text-gray-600 font-mono text-xs uppercase tracking-widest pl-2">
                            {tracks.length} tracks • {(() => {
                                let totalS = 0;
                                tracks.forEach(t => {
                                    const p = (t.audio_specs?.duration || '0:00').split(':');
                                    let s = 0, m = 1;
                                    while (p.length > 0) { s += m * parseInt(p.pop() || '0'); m *= 60; }
                                    totalS += s;
                                });
                                const h = Math.floor(totalS / 3600);
                                const min = Math.floor((totalS % 3600) / 60);
                                return h > 0 ? `${h}h ${min}m` : `${min}m`;
                            })()}
                        </span>
                    </div>
                </div>
            </div>

            {/* Table Header */}
            <div
                className="grid px-3 md:px-6 py-2.5 md:py-3 text-[10px] font-black text-white/20 uppercase tracking-[0.26em] md:tracking-[0.3em] border-b border-white/10 select-none items-center bg-white/2"
                style={{ gridTemplateColumns: gridTemplate, gap: '1.5rem' }}
            >
                {visibleColumns.map(col => {
                    const isRightAligned = ['year', 'bpm', 'duration', 'bitrate', 'size'].includes(col.id);
                    const responsiveClass =
                        col.id === 'bitrate' || col.id === 'size' ? 'hidden xl:flex' :
                            col.id === 'bpm' || col.id === 'genre' ? 'hidden lg:flex' :
                                col.id === 'year' ? 'hidden md:flex' : 'flex';

                    return (
                        <div
                            key={col.id}
                            className={`${responsiveClass} items-center ${isRightAligned ? 'justify-end' : ''} ${col.sortable ? 'cursor-pointer hover:text-white transition-colors' : ''} pr-2`}
                            onClick={() => handleSortColumn(col)}
                        >
                            <span className="truncate">{col.label}</span>
                            {isColumnSorted(col.id) && getSortDirection(col.id) && (
                                <span className="ml-1 text-dominant/70">
                                    {getSortDirection(col.id) === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                </span>
                            )}
                        </div>
                    );
                })}

                {/* Column Config Button */}
                <div className="relative" ref={columnConfigRef}>
                    <button
                        onClick={() => setShowColumnConfig(!showColumnConfig)}
                        className="flex items-center justify-center p-1 text-white/20 hover:text-white/60 transition-colors rounded hover:bg-white/5"
                        title="Configure columns"
                    >
                        <SlidersHorizontal size={12} />
                    </button>

                    {showColumnConfig && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowColumnConfig(false)} />
                            <div className="absolute right-0 top-full mt-2 w-56 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden py-2" onClick={e => e.stopPropagation()}>
                                <div className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-gray-500 border-b border-white/5 flex justify-between items-center">
                                    <span>Visible Columns</span>
                                </div>
                                <div className="max-h-96 overflow-y-auto custom-scrollbar">
                                    {libraryState.columnConfig.map((col, idx) => (
                                        <div key={col.id} className="flex items-center group px-2 py-0.5">
                                            <button
                                                onClick={() => {
                                                    if (col.id === 'title') return;
                                                    const newConfig = libraryState.columnConfig.map(c =>
                                                        c.id === col.id ? { ...c, visible: !c.visible } : c
                                                    );
                                                    updateColumnConfig(newConfig);
                                                }}
                                                className={`flex flex-1 items-center justify-between px-2 py-2 text-xs transition-colors rounded-lg ${col.id === 'title' ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/5 cursor-pointer'} ${col.visible ? 'text-white font-bold' : 'text-gray-500'}`}
                                            >
                                                <span>{col.label || (col.id === 'artwork' ? 'Artwork' : col.id)}</span>
                                                <div className={`w-8 h-4 rounded-full transition-all relative flex-shrink-0 ml-2 border border-black/20 ${col.visible ? 'bg-dominant' : 'bg-white/10'}`}>
                                                    <div className={`absolute top-[1px] w-3 h-3 rounded-full bg-white shadow-sm transition-all ${col.visible ? 'left-[17px]' : 'left-[1px]'}`} />
                                                </div>
                                            </button>
                                            <div className="flex flex-col ml-1 opacity-100 md:opacity-0 md:lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); moveColumn(idx, -1); }}
                                                    disabled={idx === 0}
                                                    className="p-0.5 text-gray-500 hover:text-white disabled:opacity-20 transition-colors"
                                                    title="Move Up"
                                                >
                                                    <ChevronUp size={14} />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); moveColumn(idx, 1); }}
                                                    disabled={idx === libraryState.columnConfig.length - 1}
                                                    className="p-0.5 text-gray-500 hover:text-white disabled:opacity-20 transition-colors"
                                                    title="Move Down"
                                                >
                                                    <ChevronDown size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-hidden relative">
                {renderVirtualizedList(desktopRowHeight)}
            </div>
        </div>
    );
};
