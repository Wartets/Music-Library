import { useEffect } from 'react';
import { usePlayer } from '../contexts/PlayerContext';

export const useGlobalShortcuts = () => {
    const { togglePlay, playNext, playPrevious, seek, getProgress } = usePlayer();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if focus is in an input, textarea, or contenteditable
            const target = e.target as HTMLElement;
            if (
                ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
                target.isContentEditable
            ) {
                return;
            }

            switch (e.key) {
                case ' ':
                    e.preventDefault();
                    togglePlay();
                    break;
                case 'ArrowRight':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        playNext();
                    } else {
                        e.preventDefault();
                        seek(getProgress() + 5);
                    }
                    break;
                case 'ArrowLeft':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        playPrevious();
                    } else {
                        e.preventDefault();
                        seek(Math.max(0, getProgress() - 5));
                    }
                    break;
                case 'f':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        const searchInput = document.querySelector('input[placeholder="Search..."]') as HTMLInputElement;
                        if (searchInput) {
                            searchInput.focus();
                        }
                    }
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [togglePlay, playNext, playPrevious, seek, getProgress]);
};
