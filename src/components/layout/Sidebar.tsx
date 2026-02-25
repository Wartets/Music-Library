import React from 'react';
import { ViewType } from './AppLayout';
import { LayoutGrid, Library, Mic2, ListMusic, Settings, Search, History, Tags, Calendar, Heart, FolderOpen, FileAudio, Disc3 } from 'lucide-react';
import { ArtworkImage } from '../shared/ArtworkImage';
import { useLibrary } from '../../contexts/LibraryContext';
import { usePlayer } from '../../contexts/PlayerContext';
import { useTheme } from '../../contexts/ThemeContext';
import { persistenceService } from '../../services/persistence';

interface SidebarProps {
    currentView: ViewType;
    onNavigate: (view: ViewType) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate }) => {
    const { state: libState, setSearchQuery } = useLibrary();
    const { playTrack, state: playerState } = usePlayer();
    const { currentPalette } = useTheme();
    const [isFocused, React_setIsFocused] = React.useState(false);
    const trackHashes = new Set(libState.tracks.map(track => track.logic.hash_sha256));
    const hasFavorites = persistenceService.getFavorites().some(id => {
        const primaryId = libState.versionToPrimaryMap[id] || id;
        return trackHashes.has(primaryId);
    });
    const hasHistory = playerState.history.length > 0 || persistenceService.getHistoryIds().length > 0;

    const navItems = [
        { id: 'Dashboard', label: 'Home', icon: <Library size={20} /> },
        { id: 'AllTracks', label: 'All Tracks', icon: <ListMusic size={20} /> },
        { id: 'Albums', label: 'Albums', icon: <LayoutGrid size={20} /> },
        { id: 'Artists', label: 'Artists', icon: <Mic2 size={20} /> },
        { id: 'Genres', label: 'Genres', icon: <Tags size={20} /> },
        { id: 'Years', label: 'Years', icon: <Calendar size={20} /> },
        { id: 'Folders', label: 'Folders', icon: <FolderOpen size={20} /> },
        { id: 'Formats', label: 'Formats', icon: <FileAudio size={20} /> },
        ...(hasFavorites ? [{ id: 'Favorites', label: 'Favorites', icon: <Heart size={20} /> }] : []),
        ...(hasHistory ? [{ id: 'DetailedHistory', label: 'History', icon: <History size={20} /> }] : []),
        { id: 'Playlists', label: 'Playlists', icon: <ListMusic size={20} /> },
        { id: 'Queue', label: 'Queue', icon: <ListMusic size={20} /> },
    ];

    const bottomItems = [
        { id: 'Settings', label: 'Settings', icon: <Settings size={20} /> },
    ];

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
                        style={{
                            background: `linear-gradient(135deg, ${currentPalette.dominant} 0%, ${currentPalette.dominantDark} 100%)`,
                            boxShadow: `0 10px 30px -10px ${currentPalette.dominant}88`
                        }}
                    >
                        <Disc3 className="text-white animate-[spin_8s_linear_infinite] group-hover:animate-[spin_2s_linear_infinite]" size={28} />
                    </div>
                    <div className="flex flex-col">
                        <h1 className="text-xl font-black tracking-tighter text-white hidden lg:block leading-none">Music Library</h1>
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-dominant hidden lg:block mt-1 opacity-80">Local player</span>
                    </div>
                </div>

                <div
                    className="mb-8 relative group hidden lg:block"
                    onFocus={() => React_setIsFocused(true)}
                    onBlur={() => setTimeout(() => React_setIsFocused(false), 200)}
                >
                    <div className="absolute -inset-1 bg-gradient-to-r from-dominant/20 to-dominant-light/20 blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-700"></div>
                    <Search
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-dominant-light transition-all duration-300 z-10"
                        size={16}
                    />
                    <input
                        type="text"
                        value={libState.searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search library..."
                        className="relative z-10 w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-11 pr-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-dominant/50 focus:bg-white/10 transition-all font-medium shadow-2xl backdrop-blur-xl"
                    />
                    <div className="absolute bottom-0 left-6 right-6 h-[1px] bg-gradient-to-r from-transparent via-dominant/50 to-transparent scale-x-0 group-focus-within:scale-x-100 transition-transform duration-500 z-20"></div>
                    {isFocused && libState.searchQuery && (
                        <div className="absolute top-full left-0 right-0 mt-3 bg-[#111]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden z-[100] animate-in fade-in slide-in-from-top-2 duration-300">
                            {libState.filteredTracks.length > 0 ? (
                                <>
                                    <div className="px-4 py-1.5 text-[10px] font-black text-gray-500 uppercase tracking-widest bg-white/5 border-b border-white/5">Results</div>
                                    <div className="max-h-64 overflow-y-auto custom-scrollbar">
                                        {libState.filteredTracks.slice(0, 5).map(track => (
                                            <div
                                                key={track.logic.hash_sha256}
                                                className="p-3 hover:bg-dominant/10 cursor-pointer flex items-center gap-3 transition-colors border-b border-white/5 last:border-0"
                                                onClick={() => {
                                                    playTrack(track, libState.filteredTracks);
                                                    setSearchQuery('');
                                                }}
                                            >
                                                <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 bg-white/5">
                                                    <ArtworkImage details={track.artworks?.track_artwork?.[0] || track.artworks?.album_artwork?.[0]} alt={track.metadata?.title || track.logic.track_name} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-white text-xs font-bold truncate">{track.metadata?.title || track.logic.track_name}</div>
                                                    <div className="text-gray-500 text-[10px] truncate">{track.metadata?.artists?.[0] || 'Unknown Artist'}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    {libState.filteredTracks.length > 5 && (
                                        <div
                                            className="p-3 text-center text-[10px] font-black text-dominant uppercase tracking-[0.2em] cursor-pointer hover:bg-white/5 transition-colors"
                                            onClick={() => onNavigate('AllTracks')}
                                        >
                                            View all {libState.filteredTracks.length} results
                                        </div>
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

