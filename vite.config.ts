import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync, existsSync } from 'node:fs';
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

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
    base: mode === 'production' ? '/Music-Library/' : '/',
    plugins: [react(), copyMusicBibJson()],
    server: {
        fs: {
            strict: false,
        },
    },
    worker: {
        format: 'es',
    },
}));
