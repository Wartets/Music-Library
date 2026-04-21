import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function copyMusicBibJson() {
    return {
        name: 'copy-musicbib-json',
        apply: 'build',
        closeBundle() {
            const source = resolve(__dirname, 'musicBib.json');
            const destination = resolve(__dirname, 'dist', 'musicBib.json');

            if (!existsSync(source)) {
                this.warn('musicBib.json not found at project root; dist/musicBib.json was not generated.');
                return;
            }

            copyFileSync(source, destination);
        },
    };
}

function musicFilesMiddleware() {
    return {
        name: 'music-files-middleware',
        configureServer(server) {
            server.middlewares.use(async (req, res, next) => {
                const url = req.url || '';
                if (!url || !url.includes('/Album')) {
                    return next();
                }

                const urlPath = url.split('?')[0].replace(/%2F/g, '/').replace(/%5C/g, '/');
                const musicPath = urlPath.replace(/^\/+/, '');
                const localPath = resolve(__dirname, '..', 'Music-Library', musicPath);
                const altLocalPath = resolve(__dirname, musicPath);

                let filePath = '';
                if (existsSync(localPath)) {
                    filePath = localPath;
                } else if (existsSync(altLocalPath)) {
                    filePath = altLocalPath;
                }

                if (!filePath) {
                    return next();
                }

                try {
                    const content = readFileSync(filePath);
                    const ext = musicPath.toLowerCase().split('.').pop();
                    const contentType = ext === 'm4a' ? 'audio/mp4' 
                        : ext === 'mp3' ? 'audio/mpeg'
                        : ext === 'wav' ? 'audio/wav'
                        : ext === 'flac' ? 'audio/flac'
                        : ext === 'ogg' ? 'audio/ogg'
                        : 'application/octet-stream';
                    
                    res.setHeader('Content-Type', contentType);
                    res.setHeader('Accept-Ranges', 'bytes');
                    res.setHeader('Cache-Control', 'public, max-age=3600');
                    res.end(content);
                } catch {
                    next();
                }
            });
        },
    };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
    base: mode === 'production' ? '/Music-Library/' : '/',
    plugins: [react(), copyMusicBibJson(), musicFilesMiddleware()],
    server: {
        fs: {
            strict: false,
            allow: ['..'],
        },
    },
    worker: {
        format: 'es',
    },
}));
