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

if (typeof window !== 'undefined') {
    if ('serviceWorker' in navigator) {
        const isLocalhost = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
        const shouldRegisterServiceWorker = import.meta.env.PROD && !isLocalhost;

        window.addEventListener('load', () => {
            if (shouldRegisterServiceWorker) {
                navigator.serviceWorker
                    .register(`${import.meta.env.BASE_URL}sw.js`)
                    .catch(() => {
                        // Ignore service-worker registration errors in unsupported environments.
                    });
                return;
            }

            // In local/dev contexts, clear old registrations and caches to avoid stale blank screens.
            navigator.serviceWorker.getRegistrations().then((registrations) => {
                registrations.forEach((registration) => {
                    registration.unregister().catch(() => {
                        // Ignore cleanup failures.
                    });
                });
            }).catch(() => {
                // Ignore cleanup failures.
            });

            if ('caches' in window) {
                caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))).catch(() => {
                    // Ignore cache cleanup failures.
                });
            }
        });
    }

    if ('storage' in navigator && 'persist' in navigator.storage) {
        navigator.storage.persist().catch(() => {
            // Persistence is best-effort.
        });
    }
}
