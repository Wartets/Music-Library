import React from 'react';
import { ViewType } from './AppLayout';
import { Calendar, FileAudio, FolderOpen, Grid3X3, Heart, Home, LayoutGrid, ListMusic, Mic2, MoreHorizontal, PlaySquare, Settings, Tags } from 'lucide-react';

interface MobileTabBarProps {
    currentView: ViewType;
    onNavigate: (view: ViewType) => void;
}

const tabs: { id: ViewType; label: string; icon: React.ReactNode }[] = [
    { id: 'Dashboard', label: 'Home', icon: <Home size={18} /> },
    { id: 'AllTracks', label: 'Tracks', icon: <ListMusic size={18} /> },
    { id: 'Albums', label: 'Albums', icon: <LayoutGrid size={18} /> },
    { id: 'Artists', label: 'Artists', icon: <Mic2 size={18} /> },
    { id: 'Queue', label: 'Queue', icon: <PlaySquare size={18} /> },
];

const extraTabs: { id: ViewType; label: string; icon: React.ReactNode }[] = [
    { id: 'Genres', label: 'Genres', icon: <Tags size={16} /> },
    { id: 'Years', label: 'Years', icon: <Calendar size={16} /> },
    { id: 'Folders', label: 'Folders', icon: <FolderOpen size={16} /> },
    { id: 'Formats', label: 'Formats', icon: <FileAudio size={16} /> },
    { id: 'Playlists', label: 'Playlists', icon: <Grid3X3 size={16} /> },
    { id: 'Favorites', label: 'Favorites', icon: <Heart size={16} /> },
    { id: 'DetailedHistory', label: 'History', icon: <ListMusic size={16} /> },
    { id: 'Settings', label: 'Settings', icon: <Settings size={16} /> },
];

const getTabFromView = (view: ViewType): ViewType => {
    if (view === 'AlbumDetail') return 'Albums';
    if (view === 'ArtistDetail') return 'Artists';
    if (view === 'SongDetail') return 'AllTracks';
    return tabs.some(tab => tab.id === view) ? view : 'Dashboard';
};

export const MobileTabBar: React.FC<MobileTabBarProps> = ({ currentView, onNavigate }) => {
    const activeTab = getTabFromView(currentView);
    const [isMoreOpen, setIsMoreOpen] = React.useState(false);
    const isMoreActive = extraTabs.some(tab => tab.id === currentView);

    return (
        <>
            {isMoreOpen && (
                <div className="md:hidden fixed inset-0 z-[75] bg-black/70 backdrop-blur-sm" onClick={() => setIsMoreOpen(false)}>
                    <div
                        className="absolute left-3 right-3 bottom-[calc(4rem+env(safe-area-inset-bottom)+0.5rem)] rounded-2xl bg-[#121212]/95 border border-white/10 p-3 shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2 px-1">More views</div>
                        <div className="grid grid-cols-2 gap-2">
                            {extraTabs.map(tab => {
                                const isActive = currentView === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => {
                                            onNavigate(tab.id);
                                            setIsMoreOpen(false);
                                        }}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-colors ${isActive ? 'bg-dominant/25 text-white' : 'bg-white/5 text-gray-300 hover:bg-white/10'}`}
                                    >
                                        {tab.icon}
                                        <span className="text-xs font-bold">{tab.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
            <nav
                className="md:hidden fixed bottom-0 left-0 right-0 z-[70] border-t border-white/10 bg-black/85 backdrop-blur-2xl pb-[env(safe-area-inset-bottom)]"
                role="navigation"
                aria-label="Mobile tabs"
            >
                <div className="h-16 grid grid-cols-6">
                    {tabs.map(tab => {
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => onNavigate(tab.id)}
                                className={`flex flex-col items-center justify-center gap-1 transition-colors ${isActive ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
                            >
                                <span className={isActive ? 'drop-shadow-[0_0_12px_rgba(255,255,255,0.35)]' : ''}>
                                    {tab.icon}
                                </span>
                                <span className="text-[10px] font-bold tracking-wide uppercase">
                                    {tab.label}
                                </span>
                            </button>
                        );
                    })}
                    <button
                        onClick={() => setIsMoreOpen(prev => !prev)}
                        className={`flex flex-col items-center justify-center gap-1 transition-colors ${(isMoreOpen || isMoreActive) ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        <MoreHorizontal size={18} />
                        <span className="text-[10px] font-bold tracking-wide uppercase">More</span>
                    </button>
                </div>
            </nav>
        </>
    );
};
