import React from 'react';
import { ViewType } from './viewRouting';
import { LayoutGrid, Library, Mic2, ListMusic, Settings, Search, History, Tags, Calendar, Heart, FolderOpen, FileAudio, Disc3 } from 'lucide-react';
import { ArtworkImage } from '../shared/ArtworkImage';
import { useLibrary } from '../../contexts/LibraryContext';
import { usePlayer } from '../../contexts/PlayerContext';
import { useTheme } from '../../contexts/ThemeContext';
import { audioEngine } from '../../services/audioEngine';
import { persistenceService } from '../../services/persistence';

interface NavItem {
    id: ViewType;
    label: string;
    icon: React.ReactNode;
}

interface SidebarProps {
    currentView: ViewType;
    onNavigate: (view: ViewType, data?: unknown) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate }) => {
    const { state: libState, setSearchQuery } = useLibrary();
    const { playTrack, state: playerState } = usePlayer();
    const { currentPalette } = useTheme();
    const [isFocused, setIsFocused] = React.useState(false);
    const [activeSearchIndex, setActiveSearchIndex] = React.useState(-1);
    const [discScratch, setDiscScratch] = React.useState(false);
    const searchInputRef = React.useRef<HTMLInputElement>(null);
    const blurTimeoutRef = React.useRef<number | null>(null);
    const discScratchTimeoutRef = React.useRef<number | null>(null);
    const discRotationFrameRef = React.useRef<number | null>(null);
    const lastRotationTickRef = React.useRef<number>(0);
    const discRotationRef = React.useRef<number>(0);
    const discSpinnerRef = React.useRef<HTMLDivElement>(null);
    const isDiscSpinning = Boolean(playerState.currentTrack && playerState.isPlaying);
    const visibleResults = React.useMemo(() => libState.filteredTracks.slice(0, 5), [libState.filteredTracks]);
    const hasMoreSearchResults = libState.filteredTracks.length > visibleResults.length;
    const maxKeyboardIndex = visibleResults.length > 0
        ? visibleResults.length - 1 + (hasMoreSearchResults ? 1 : 0)
        : -1;

    const clearBlurTimeout = React.useCallback(() => {
        if (blurTimeoutRef.current) {
            window.clearTimeout(blurTimeoutRef.current);
            blurTimeoutRef.current = null;
        }
    }, []);

    const cancelDiscFrame = React.useCallback(() => {
        if (discRotationFrameRef.current) {
            window.cancelAnimationFrame(discRotationFrameRef.current);
            discRotationFrameRef.current = null;
        }
    }, []);

    const trackHashes = React.useMemo(
        () => new Set(libState.tracks.map(track => track.logic.hash_sha256)),
        [libState.tracks]
    );

    React.useEffect(() => {
        return () => {
            clearBlurTimeout();
            if (discScratchTimeoutRef.current) {
                window.clearTimeout(discScratchTimeoutRef.current);
            }
            cancelDiscFrame();
        };
    }, [cancelDiscFrame, clearBlurTimeout]);

    React.useEffect(() => {
        cancelDiscFrame();

        if (!isDiscSpinning) {
            lastRotationTickRef.current = 0;
            return;
        }

        const spinMsPerRevolution = 16000;
        let disposed = false;

        const tick = (timestamp: number) => {
            if (disposed) {
                return;
            }

            if (!lastRotationTickRef.current) {
                lastRotationTickRef.current = timestamp;
            }

            const delta = timestamp - lastRotationTickRef.current;
            lastRotationTickRef.current = timestamp;

            discRotationRef.current = (discRotationRef.current + (360 * delta / spinMsPerRevolution)) % 360;
            if (discSpinnerRef.current) {
                discSpinnerRef.current.style.transform = `rotate(${discRotationRef.current}deg)`;
            }
            discRotationFrameRef.current = window.requestAnimationFrame(tick);
        };

        discRotationFrameRef.current = window.requestAnimationFrame(tick);

        return () => {
            disposed = true;
            cancelDiscFrame();
            lastRotationTickRef.current = 0;
        };
    }, [cancelDiscFrame, isDiscSpinning]);

    const triggerDiscScratch = React.useCallback(() => {
        setDiscScratch(true);
        if (discScratchTimeoutRef.current) {
            window.clearTimeout(discScratchTimeoutRef.current);
        }
        discScratchTimeoutRef.current = window.setTimeout(() => {
            setDiscScratch(false);
            discScratchTimeoutRef.current = null;
        }, 160);
    }, []);

    const handleDiscClick = React.useCallback(() => {
        if (!isDiscSpinning) return;
        triggerDiscScratch();
        audioEngine.triggerDjBurst();
    }, [isDiscSpinning, triggerDiscScratch]);

    const hasFavorites = React.useMemo(() => {
        return persistenceService.getFavorites().some(id => {
            const primaryId = libState.versionToPrimaryMap[id] || id;
            return trackHashes.has(primaryId);
        });
    }, [libState.versionToPrimaryMap, trackHashes]);

    const hasHistory = React.useMemo(
        () => playerState.history.length > 0 || persistenceService.getHistoryIds().length > 0,
        [playerState.history.length]
    );

    const navItems = React.useMemo<NavItem[]>(() => [
        { id: 'Dashboard', label: 'Home', icon: <Library size={20} /> },
        { id: 'AllTracks', label: 'All Tracks', icon: <ListMusic size={20} /> },
        { id: 'Albums', label: 'Albums', icon: <LayoutGrid size={20} /> },
        { id: 'Artists', label: 'Artists', icon: <Mic2 size={20} /> },
        { id: 'Genres', label: 'Genres', icon: <Tags size={20} /> },
        { id: 'Years', label: 'Years', icon: <Calendar size={20} /> },
        { id: 'Folders', label: 'Folders', icon: <FolderOpen size={20} /> },
        { id: 'Formats', label: 'Formats', icon: <FileAudio size={20} /> },
        ...(hasFavorites ? [{ id: 'Favorites', label: 'Favorites', icon: <Heart size={20} /> } as NavItem] : []),
        ...(hasHistory ? [{ id: 'DetailedHistory', label: 'History', icon: <History size={20} /> } as NavItem] : []),
        { id: 'Playlists', label: 'Playlists', icon: <ListMusic size={20} /> },
        { id: 'Queue', label: 'Queue', icon: <ListMusic size={20} /> },
    ], [hasFavorites, hasHistory]);

    const bottomItems = React.useMemo<NavItem[]>(() => [
        { id: 'Settings', label: 'Settings', icon: <Settings size={20} /> },
    ], []);

    const openSearchResults = React.useCallback((query: string) => {
        const normalizedQuery = query.trim();
        if (!normalizedQuery) {
            return;
        }

        onNavigate('SearchResults', { query: normalizedQuery, sourceView: currentView });
        setSearchQuery('');
        setActiveSearchIndex(-1);
        setIsFocused(false);
    }, [currentView, onNavigate, setSearchQuery]);

    const playSearchResult = React.useCallback((track: typeof visibleResults[number]) => {
        playTrack(track, libState.filteredTracks);
        setSearchQuery('');
        setActiveSearchIndex(-1);
        setIsFocused(false);
    }, [libState.filteredTracks, playTrack, setSearchQuery]);

    const handleInputFocus = React.useCallback(() => {
        clearBlurTimeout();
        setIsFocused(true);
    }, [clearBlurTimeout]);

    const handleInputBlur = React.useCallback(() => {
        clearBlurTimeout();
        blurTimeoutRef.current = window.setTimeout(() => {
            setIsFocused(false);
            setActiveSearchIndex(-1);
            blurTimeoutRef.current = null;
        }, 150);
    }, [clearBlurTimeout]);

    React.useEffect(() => {
        if (!isFocused || !libState.searchQuery.trim()) {
            setActiveSearchIndex(-1);
        }
    }, [isFocused, libState.searchQuery]);

    const NavButton = ({ item }: { item: any }) => {
        const isActive = currentView === item.id;
        return (
            <button
                onClick={() => onNavigate(item.id as ViewType)}
                className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg text-left transition-colors duration-300 ${isActive
                    ? 'bg-dominant/30 text-white font-bold border-l-4 border-dominant-light'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-white/5 border-l-4 border-transparent'
                    }`}
            >
                <div className={`${isActive ? 'text-dominant-light' : 'text-gray-400'}`}>
                    {item.icon}
                </div>
                <span className="hidden lg:block">{item.label}</span>
            </button>
        );
    };

    return (
        <aside
            className="hidden md:flex w-20 lg:w-64 flex-shrink-0 backdrop-blur-3xl border-r border-white/5 flex-col z-10 transition-all duration-1000 relative overflow-hidden"
            style={{ backgroundColor: `${currentPalette.dominantDark}22` }}
        >
            {/* Subtle side glow */}
            <div
                className="absolute top-0 left-0 w-1 h-full opacity-30 transition-colors duration-1000"
                style={{ backgroundColor: currentPalette.dominant }}
            ></div>

            <div className="p-4 lg:p-6 pb-2 relative z-10">
                <div className="flex flex-col items-center gap-4 mb-10">
                    <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl overflow-hidden flex-shrink-0 transition-all duration-700 group cursor-pointer active:scale-95 relative"
                        onClick={handleDiscClick}
                        style={{
                            background: `linear-gradient(135deg, ${currentPalette.dominant} 0%, ${currentPalette.dominantDark} 100%)`,
                            boxShadow: `0 10px 30px -10px ${currentPalette.dominant}88`
                        }}
                    >
                        {discScratch && (
                            <div
                                className="absolute inset-0 rounded-2xl animate-pulse"
                                style={{ backgroundColor: `${currentPalette.dominantLight}2d` }}
                            />
                        )}
                        <div
                            ref={discSpinnerRef}
                            className="absolute inset-0 flex items-center justify-center"
                            style={{
                                transform: 'rotate(0deg)',
                                willChange: 'transform'
                            }}
                        >
                            <Disc3
                                className={`text-white transition-transform duration-100 ${discScratch ? 'scale-110' : ''}`}
                                size={28}
                                style={{
                                    transformOrigin: 'center',
                                    transform: discScratch ? 'rotate(22deg)' : 'rotate(0deg)'
                                }}
                            />
                        </div>
                    </div>
                    <div className="flex flex-col">
                        <h1 className="text-xl font-black tracking-tighter text-white hidden lg:block leading-none">Music Library</h1>
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-dominant hidden lg:block mt-1 opacity-80">Web player</span>
                    </div>
                </div>

                <div
                    className="mb-8 relative group hidden lg:block"
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                >
                    <div className="absolute -inset-1 bg-gradient-to-r from-dominant/20 to-dominant-light/20 blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-700"></div>
                    <Search
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-dominant-light transition-all duration-300 z-10"
                        size={16}
                    />
                    <input
                        ref={searchInputRef}
                        type="text"
                        value={libState.searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setActiveSearchIndex(-1);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                                e.preventDefault();
                                setIsFocused(false);
                                setActiveSearchIndex(-1);
                                return;
                            }

                            if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && isFocused && libState.searchQuery.trim()) {
                                e.preventDefault();
                                if (maxKeyboardIndex < 0) {
                                    return;
                                }

                                setActiveSearchIndex((prevIndex) => {
                                    if (prevIndex < 0) {
                                        return e.key === 'ArrowDown' ? 0 : maxKeyboardIndex;
                                    }

                                    if (e.key === 'ArrowDown') {
                                        return prevIndex >= maxKeyboardIndex ? 0 : prevIndex + 1;
                                    }

                                    return prevIndex <= 0 ? maxKeyboardIndex : prevIndex - 1;
                                });
                                return;
                            }

                            if (e.key === 'Enter') {
                                e.preventDefault();

                                if (activeSearchIndex >= 0 && activeSearchIndex < visibleResults.length) {
                                    playSearchResult(visibleResults[activeSearchIndex]);
                                    return;
                                }

                                if (hasMoreSearchResults && activeSearchIndex === visibleResults.length) {
                                    openSearchResults(libState.searchQuery);
                                    return;
                                }

                                openSearchResults(libState.searchQuery);
                            }
                        }}
                        placeholder="Search library..."
                        aria-expanded={isFocused && Boolean(libState.searchQuery)}
                        aria-controls="sidebar-search-results"
                        aria-autocomplete="list"
                        className="relative z-10 w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-11 pr-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-dominant/50 focus:bg-white/10 transition-all font-medium shadow-2xl backdrop-blur-xl"
                    />
                    <div className="absolute bottom-0 left-6 right-6 h-[1px] bg-gradient-to-r from-transparent via-dominant/50 to-transparent scale-x-0 group-focus-within:scale-x-100 transition-transform duration-500 z-20"></div>
                    {isFocused && libState.searchQuery && (
                        <div
                            id="sidebar-search-results"
                            className="absolute top-full left-0 right-0 mt-3 bg-[#111]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden z-[100] animate-in fade-in slide-in-from-top-2 duration-300"
                            role="listbox"
                            aria-label="Search suggestions"
                        >
                            {libState.filteredTracks.length > 0 ? (
                                <>
                                    <div className="px-4 py-1.5 text-[10px] font-black text-gray-500 uppercase tracking-widest bg-white/5 border-b border-white/5">Results</div>
                                    <div className="max-h-64 overflow-y-auto custom-scrollbar">
                                        {visibleResults.map((track, index) => (
                                            <button
                                                key={track.logic.hash_sha256}
                                                type="button"
                                                role="option"
                                                aria-selected={index === activeSearchIndex}
                                                className={`w-full text-left p-3 cursor-pointer flex items-center gap-3 transition-colors border-b border-white/5 last:border-0 ${index === activeSearchIndex ? 'bg-dominant/20' : 'hover:bg-dominant/10'} active:scale-[0.995]`}
                                                onClick={() => {
                                                    playSearchResult(track);
                                                }}
                                            >
                                                <div className="w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 bg-white/5">
                                                    <ArtworkImage details={track.artworks?.track_artwork?.[0] || track.artworks?.album_artwork?.[0]} alt={track.metadata?.title || track.logic.track_name} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-white text-xs font-bold truncate">{track.metadata?.title || track.logic.track_name}</div>
                                                    <div className="text-gray-500 text-[10px] truncate">{track.metadata?.artists?.[0] || 'Unknown Artist'}</div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                    {hasMoreSearchResults && (
                                        <button
                                            type="button"
                                            className={`w-full p-3 text-center text-[10px] font-black text-dominant uppercase tracking-[0.2em] transition-all active:scale-95 ${activeSearchIndex === visibleResults.length ? 'bg-white/10' : 'hover:bg-white/5'}`}
                                            onClick={() => openSearchResults(libState.searchQuery)}
                                        >
                                            View all {libState.filteredTracks.length} results
                                        </button>
                                    )}
                                </>
                            ) : (
                                <div className="p-8 text-center">
                                    <div className="text-gray-500 text-xs font-medium italic">No matches for "{libState.searchQuery}"</div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-2 custom-scrollbar">
                <nav className="space-y-1">
                    {navItems.map(item => <NavButton key={item.id} item={item} />)}
                </nav>
            </div>

            <div className="mt-auto p-4 border-t border-white/5">
                <nav className="space-y-1">
                    {bottomItems.map(item => <NavButton key={item.id} item={item} />)}
                </nav>
            </div>
        </aside>
    );
};

