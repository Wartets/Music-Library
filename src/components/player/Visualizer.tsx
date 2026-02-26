import React, { useEffect, useRef } from 'react';
import { audioEngine } from '../../services/audioEngine';
import { usePlayer } from '../../contexts/PlayerContext';

export const Visualizer: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { state } = usePlayer();
    const rafRef = useRef<number | null>(null);
    const dataRef = useRef<Uint8Array | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let width = canvas.clientWidth;
        let height = canvas.clientHeight;
        canvas.width = width;
        canvas.height = height;

        const computedStyle = getComputedStyle(document.documentElement);
        const dominantVar = computedStyle.getPropertyValue('--color-dominant').trim();
        const baseColor = dominantVar ? `rgb(${dominantVar})` : 'rgba(255, 255, 255, 0.7)';

        let lastFrame = 0;
        const draw = (ts: number) => {
            if (!state.isPlaying) {
                rafRef.current = null;
                return;
            }

            const analyser = audioEngine.getAnalyser();
            if (!analyser) {
                rafRef.current = requestAnimationFrame(draw);
                return;
            }

            if (ts - lastFrame < 33) {
                rafRef.current = requestAnimationFrame(draw);
                return;
            }
            lastFrame = ts;

            // Only clear and draw if context is active
            ctx.clearRect(0, 0, width, height);

            const bufferLength = analyser.frequencyBinCount;
            if (!dataRef.current || dataRef.current.length !== bufferLength) {
                dataRef.current = new Uint8Array(bufferLength);
            }
            analyser.getByteFrequencyData(dataRef.current as any);

            const maxBars = Math.min(64, bufferLength);
            const step = Math.max(1, Math.floor(bufferLength / maxBars));
            const barWidth = width / maxBars;
            let x = 0;

            ctx.fillStyle = baseColor;

            for (let i = 0; i < bufferLength; i += step) {
                const val = dataRef.current[i];
                const barHeight = (val / 255) * height;

                ctx.globalAlpha = 0.4 + (val / 255) * 0.4;
                ctx.fillRect(x, height - barHeight, Math.max(1, barWidth - 1), barHeight);

                x += barWidth;
            }

            rafRef.current = requestAnimationFrame(draw);
        };

        if (state.isPlaying) {
            rafRef.current = requestAnimationFrame(draw);
        }

        const handleResize = () => {
            width = canvas.clientWidth;
            height = canvas.clientHeight;
            canvas.width = width;
            canvas.height = height;
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
            }
        };
    }, [state.isPlaying]);

    return (
        <canvas
            ref={canvasRef}
            className="w-full h-16 pointer-events-none opacity-80 block transition-opacity duration-300"
            style={{ width: '100%' }}
        />
    );
};
