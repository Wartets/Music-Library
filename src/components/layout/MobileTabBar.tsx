import React from 'react';
import { ViewType } from './AppLayout';
import { Home, LayoutGrid, ListMusic, Mic2, PlaySquare } from 'lucide-react';

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

const getTabFromView = (view: ViewType): ViewType => {
    if (view === 'AlbumDetail') return 'Albums';
    if (view === 'ArtistDetail') return 'Artists';
    if (view === 'SongDetail') return 'AllTracks';
    if (view === 'DetailedHistory') return 'Queue';
    return tabs.some(tab => tab.id === view) ? view : 'Dashboard';
};

export const MobileTabBar: React.FC<MobileTabBarProps> = ({ currentView, onNavigate }) => {
    const activeTab = getTabFromView(currentView);

    return (
        <nav
            className="md:hidden fixed bottom-0 left-0 right-0 z-[70] border-t border-white/10 bg-black/85 backdrop-blur-2xl pb-[env(safe-area-inset-bottom)]"
            role="navigation"
            aria-label="Mobile tabs"
        >
            <div className="h-16 grid grid-cols-5">
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
            </div>
        </nav>
    );
};
