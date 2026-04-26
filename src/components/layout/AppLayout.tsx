import React, { useState, useEffect } from 'react';
import { usePlayer } from '../../contexts/PlayerContext';
import { Sidebar } from './Sidebar';
import { MainView } from './MainView';
import { PlayerBar } from './PlayerBar';
import { MetadataEditor } from '../shared/MetadataEditor';
import { ContextPanel } from './ContextPanel';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ContextMenu } from '../shared/ContextMenu';
import { useUI } from '../../contexts/UIContext';
import { useTheme } from '../../contexts/ThemeContext';
import { MobileTabBar } from './MobileTabBar';
import { useIsMobile } from '../../hooks/useMediaQuery';
import {
    DEFAULT_VIEW,
    NavigationEntry,
    ViewType,
    isViewType,
    normalizeHistoryEntries,
    resolveViewType
} from './viewRouting';

export type { ViewType } from './viewRouting';

const getInitialHistory = (): NavigationEntry[] => {
    try {
        const saved = localStorage.getItem('nav_history');
        if (!saved) {
            return [{ view: DEFAULT_VIEW, data: null }];
        }

        const parsed = JSON.parse(saved);
        return normalizeHistoryEntries(parsed);
    } catch {
        return [{ view: DEFAULT_VIEW, data: null }];
    }
};

const getInitialHistoryIndex = (historyLength: number): number => {
    try {
        const saved = localStorage.getItem('nav_history_index');
        const parsed = saved ? parseInt(saved, 10) : 0;

        if (Number.isNaN(parsed)) {
            return 0;
        }

        return Math.min(Math.max(parsed, 0), Math.max(historyLength - 1, 0));
    } catch {
        return 0;
    }
};

export const AppLayout: React.FC = () => {
    const initialHistory = getInitialHistory();
    const [history, setHistory] = useState<NavigationEntry[]>(initialHistory);
    const [historyIndex, setHistoryIndex] = useState(() => getInitialHistoryIndex(initialHistory.length));
    const [showContext, setShowContext] = useState(false);

    const safeHistoryIndex = Math.min(Math.max(historyIndex, 0), Math.max(history.length - 1, 0));
    const currentEntry = history[safeHistoryIndex] ?? { view: DEFAULT_VIEW, data: null };
    const currentView = resolveViewType(currentEntry.view);
    const viewData = currentEntry.data;
    const showShellChrome = currentView !== 'BigScreen';

    useEffect(() => {
        localStorage.setItem('nav_history', JSON.stringify(history));
        localStorage.setItem('nav_history_index', safeHistoryIndex.toString());
    }, [history, safeHistoryIndex]);

    const navigate = (view: ViewType, data: unknown = null) => {
        const safeView = resolveViewType(view);
        if (!isViewType(view)) {
            console.warn(`Invalid view requested: ${String(view)}. Falling back to ${DEFAULT_VIEW}.`);
        }

        const newHistory = history.slice(0, safeHistoryIndex + 1);
        newHistory.push({ view: safeView, data });
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    };

    const goBack = () => {
        if (safeHistoryIndex > 0) setHistoryIndex(safeHistoryIndex - 1);
    };

    const goForward = () => {
        if (safeHistoryIndex < history.length - 1) setHistoryIndex(safeHistoryIndex + 1);
    };

    return (
        <AppContent
            history={history}
            historyIndex={safeHistoryIndex}
            currentView={currentView}
            viewData={viewData}
            navigate={navigate}
            goBack={goBack}
            goForward={goForward}
            showContext={showContext}
            setShowContext={setShowContext}
            showShellChrome={showShellChrome}
        />
    );
};

interface AppContentProps {
    history: NavigationEntry[];
    historyIndex: number;
    currentView: ViewType;
    viewData: unknown;
    navigate: (view: ViewType, data?: unknown) => void;
    goBack: () => void;
    goForward: () => void;
    showContext: boolean;
    setShowContext: React.Dispatch<React.SetStateAction<boolean>>;
    showShellChrome: boolean;
}

const AppContent: React.FC<AppContentProps> = ({
    history, historyIndex, currentView, viewData, navigate, goBack, goForward, showContext, setShowContext, showShellChrome
}) => {
    const { contextMenu, closeContextMenu, showToast } = useUI();
    const { togglePlay, playNext, playPrevious, state: playerState } = usePlayer();
    const { applyArtworkColors } = useTheme();
    const isMobile = useIsMobile();

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
            const target = e.target as HTMLElement;
            const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;

            // Spacebar: ONLY play/pause, always
            if (e.code === 'Space') {
                if (!isInput) {
                    e.preventDefault();
                    e.stopPropagation();
                    togglePlay();
                }
                return;
            }

            // Other shortcuts only if not in input
            if (isInput) return;

            switch (e.code) {
                case 'KeyN':
                    e.preventDefault();
                    playNext();
                    showToast('Next Track');
                    break;
                case 'KeyP':
                    e.preventDefault();
                    playPrevious();
                    showToast('Previous Track');
                    break;
                case 'KeyQ':
                    e.preventDefault();
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
                <Sidebar currentView={currentView} onNavigate={navigate} />
                <div className={`flex-1 flex flex-col overflow-hidden relative ${showShellChrome && isMobile ? 'pb-[10.25rem]' : 'pb-0'}`}>
                    {/* Navigation Bar - Superimposed inside content area */}
                    {showShellChrome && !isMobile && (
                        <div className="flex absolute top-4 left-4 z-40 items-center gap-2 pointer-events-none">
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
            {showShellChrome && (
                <>
                    <PlayerBar onNavigate={navigate} onToggleContext={() => setShowContext(!showContext)} />
                    <MobileTabBar currentView={currentView} onNavigate={(view, data) => navigate(view, data ?? null)} />
                </>
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
