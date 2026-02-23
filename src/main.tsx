import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/shared/ErrorBoundary';
import { ThemeProvider } from './contexts/ThemeContext';
import { LibraryProvider } from './contexts/LibraryContext';
import { PlayerProvider } from './contexts/PlayerContext';
import './index.css';

// Note: PlayerProvider must be a parent of ThemeProvider because ThemeProvider uses usePlayer()
ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <ErrorBoundary>
            <LibraryProvider>
                <PlayerProvider>
                    <ThemeProvider>
                        <App />
                    </ThemeProvider>
                </PlayerProvider>
            </LibraryProvider>
        </ErrorBoundary>
    </React.StrictMode>
);
