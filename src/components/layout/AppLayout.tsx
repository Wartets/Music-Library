import React, { useState, useEffect } from 'react';
import { usePlayer } from '../../contexts/PlayerContext';
import { Sidebar } from './Sidebar';
import { MainView } from './MainView';
import { PlayerBar } from './PlayerBar';
import { MetadataEditor } from '../shared/MetadataEditor';
import { ContextPanel } from './ContextPanel';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ContextMenu } from '../shared/ContextMenu';
import { UIProvider, useUI } from '../../contexts/UIContext';
import { ThemeProvider, useTheme } from '../../contexts/ThemeContext';

export type ViewType = 'Dashboard' | 'AllTracks' | 'DetailedHistory' | 'Albums' | 'Artists' | 'Genres' | 'Years' | 'Folders' | 'Formats' | 'Favorites' | 'Playlists' | 'Settings' | 'AlbumDetail' | 'ArtistDetail' | 'SongDetail' | 'BigScreen' | 'Queue';

export const AppLayout: React.FC = () => {
    const [history, setHistory] = useState<{ view: ViewType, data: any }[]>(() => {
        const saved = localStorage.getItem('nav_history');
        return saved ? JSON.parse(saved) : [{ view: 'Dashboard', data: null }];
    });
    const [historyIndex, setHistoryIndex] = useState(() => {
        const saved = localStorage.getItem('nav_history_index');
        return saved ? parseInt(saved) : 0;
    });
    const [showContext, setShowContext] = useState(false);

    const currentView = history[historyIndex].view;
    const viewData = history[historyIndex].data;

    useEffect(() => {
        localStorage.setItem('nav_history', JSON.stringify(history));
        localStorage.setItem('nav_history_index', historyIndex.toString());
    }, [history, historyIndex]);

    const navigate = (view: ViewType, data: any = null) => {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push({ view, data });
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    };

    const goBack = () => {
        if (historyIndex > 0) setHistoryIndex(historyIndex - 1);
    };

    const goForward = () => {
        if (historyIndex < history.length - 1) setHistoryIndex(historyIndex + 1);
    };

    return (
        <UIProvider>
            <ThemeProvider>
                <AppContent
                    history={history}
                    historyIndex={historyIndex}
                    currentView={currentView}
                    viewData={viewData}
                    navigate={navigate}
                    goBack={goBack}
                    goForward={goForward}
                    showContext={showContext}
                    setShowContext={setShowContext}
                />
            </ThemeProvider>
        </UIProvider>
    );
};

const AppContent: React.FC<any> = ({
    history, historyIndex, currentView, viewData, navigate, goBack, goForward, showContext, setShowContext
}) => {
    const { contextMenu, closeContextMenu, showToast } = useUI();
    const { togglePlay, playNext, playPrevious, state: playerState } = usePlayer();
    const { applyArtworkColors } = useTheme();

    useEffect(() => {
        // Trigger theme update when track changes or component mounts
        const currentArtworks = playerState.currentTrack?.artworks?.track_artwork;
        if (currentArtworks && currentArtworks.length > 0) {
            applyArtworkColors('file://' + currentArtworks[0].path);
        } else {
            applyArtworkColors(null);
        }
    }, [playerState.currentTrack?.logic.hash_sha256]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            switch (e.code) {
                case 'Space':
                    e.preventDefault();
                    togglePlay();
                    break;
                case 'KeyN':
                    playNext();
                    showToast('Next Track');
                    break;
                case 'KeyP':
                    playPrevious();
                    showToast('Previous Track');
                    break;
                case 'KeyQ':
                    navigate('Queue');
                    break;
                case 'KeyF':
                    e.preventDefault();
                    const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
                    if (searchInput) searchInput.focus();
                    break;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [togglePlay, playNext, playPrevious, navigate, showToast]);


    return (
        <div className="h-screen w-full flex flex-col overflow-hidden bg-dominant-dark text-white selection:bg-dominant-light selection:text-white">
            <div className="flex flex-1 overflow-hidden relative">
                <Sidebar currentView={currentView} onNavigate={(v) => navigate(v, null)} />
                <div className="flex-1 flex flex-col overflow-hidden relative">
                    {/* Navigation Bar - Superimposed, no background, fixed position */}
                    {currentView !== 'BigScreen' && (
                        <div className="fixed top-6 left-72 z-40 flex items-center gap-2 pointer-events-none">
                            <button
                                onClick={goBack}
                                disabled={historyIndex === 0}
                                className={`p-2 rounded-full transition-all pointer-events-auto ${historyIndex === 0 ? 'opacity-20 cursor-not-allowed text-gray-400' : 'hover:bg-white/10 active:scale-95 text-white'}`}
                                title="Go Back"
                            >
                                <ChevronLeft size={24} />
                            </button>
                            <button
                                onClick={goForward}
                                disabled={historyIndex === history.length - 1}
                                className={`p-2 rounded-full transition-all pointer-events-auto ${historyIndex === history.length - 1 ? 'opacity-20 cursor-not-allowed text-gray-400' : 'hover:bg-white/10 active:scale-95 text-white'}`}
                                title="Go Forward"
                            >
                                <ChevronRight size={24} />
                            </button>
                        </div>
                    )}
                    <MainView currentView={currentView} viewData={viewData} onNavigate={navigate} />
                </div>
                {showContext && <ContextPanel isOpen={showContext} onClose={() => setShowContext(false)} />}
            </div>
            {currentView !== 'BigScreen' && (
                <PlayerBar onNavigate={navigate} onToggleContext={() => setShowContext(!showContext)} />
            )}
            <MetadataEditor />

            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    items={contextMenu.items}
                    onClose={closeContextMenu}
                />
            )}
        </div>
    );
};
