import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/shared/ErrorBoundary';
import { ThemeProvider } from './contexts/ThemeContext';
import { LibraryProvider } from './contexts/LibraryContext';
import { PlayerProvider } from './contexts/PlayerContext';
import { UIProvider } from './contexts/UIContext';
import './index.css';

// Note: UIProvider must be at the top level to allow other providers to show toasts
// Note: PlayerProvider must be a parent of ThemeProvider because ThemeProvider uses usePlayer()
ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <ErrorBoundary>
            <UIProvider>
                <LibraryProvider>
                    <PlayerProvider>
                        <ThemeProvider>
                            <App />
                        </ThemeProvider>
                    </PlayerProvider>
                </LibraryProvider>
            </UIProvider>
        </ErrorBoundary>
    </React.StrictMode>
);
