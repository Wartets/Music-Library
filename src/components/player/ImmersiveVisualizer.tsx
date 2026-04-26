import React from 'react';
import type { TrackItem } from '../../types/music';
import { hexToRgb, hslToRgb, rgbToHex, rgbToHsl } from '../../utils/colorUtils';

interface ImmersiveVisualizerProps {
    track?: TrackItem | null;
    className?: string;
}

const DEFAULT_COLORS = ['#2B1E3D', '#12334A', '#3F2B1C'];

const HEX_COLOR_REGEX = /^#([0-9a-f]{6})$/i;

const normalizeHex = (value?: string | null): string | null => {
    if (!value) return null;
    const normalized = value.trim();
    if (!HEX_COLOR_REGEX.test(normalized)) return null;
    return normalized.toUpperCase();
};

const blendHex = (a: string, b: string, ratio: number): string => {
    const rgbA = hexToRgb(a);
    const rgbB = hexToRgb(b);
    if (!rgbA || !rgbB) return a;
    const t = Math.max(0, Math.min(1, ratio));
    const r = Math.round(rgbA.r + (rgbB.r - rgbA.r) * t);
    const g = Math.round(rgbA.g + (rgbB.g - rgbA.g) * t);
    const bCh = Math.round(rgbA.b + (rgbB.b - rgbA.b) * t);
    return rgbToHex(r, g, bCh);
};

const shiftColor = (hex: string, hueShift: number, saturationDelta: number, lightnessDelta: number): string => {
    const rgb = hexToRgb(hex);
    if (!rgb) return hex;

    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    const safeHueShift = Math.max(-12, Math.min(12, hueShift));
    const safeSatDelta = Math.max(-16, Math.min(16, saturationDelta));
    const safeLightDelta = Math.max(-16, Math.min(16, lightnessDelta));
    const shiftedHue = ((hsl.h + safeHueShift) % 360 + 360) % 360;
    const shiftedSaturation = Math.max(14, Math.min(90, hsl.s + safeSatDelta));
    const shiftedLightness = Math.max(10, Math.min(80, hsl.l + safeLightDelta));
    const shiftedRgb = hslToRgb(shiftedHue, shiftedSaturation, shiftedLightness);
    return rgbToHex(shiftedRgb.r, shiftedRgb.g, shiftedRgb.b);
};

const hashText = (value: string): number => {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
        hash = (hash << 5) - hash + value.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
};

const unit = (seed: number, offset: number): number => {
    const value = Math.sin((seed + offset) * 12.9898) * 43758.5453;
    return value - Math.floor(value);
};

const extractTrackPalette = (track?: TrackItem | null): string[] => {
    if (!track) return DEFAULT_COLORS;

    const fromArtwork = [
        ...(track.artworks?.track_artwork || []).map(art => art?.dominant_color),
        ...(track.artworks?.album_artwork || []).map(art => art?.dominant_color)
    ]
        .map(color => normalizeHex(color))
        .filter((color): color is string => Boolean(color));

    const unique = Array.from(new Set(fromArtwork));
    const selected = unique.slice(0, 4);

    if (selected.length === 0) {
        const fallbackSeed = track.logic?.hash_sha256 || track.logic?.track_name || track.metadata?.title || 'track';
        const hue = hashText(fallbackSeed) % 360;
        const seedRgb = hslToRgb(hue, 42, 34);
        const seedHex = rgbToHex(seedRgb.r, seedRgb.g, seedRgb.b);
        return [seedHex, shiftColor(seedHex, 28, -4, -10), shiftColor(seedHex, -22, 8, 8)];
    }

    while (selected.length < 4) {
        const source = selected[selected.length - 1] || selected[0] || DEFAULT_COLORS[0];
        selected.push(shiftColor(source, selected.length * 21, 4 - selected.length * 2, selected.length % 2 === 0 ? -8 : 7));
    }

    return selected;
};

const buildRecipeLayers = (palette: string[], seed: number): {
    base: string;
    mesh: string;
    blobsA: string;
    blobsB: string;
    conic: string;
    glow: string;
} => {
    const c0 = palette[0] || DEFAULT_COLORS[0];
    const c1 = palette[1] || DEFAULT_COLORS[1];
    const c2 = palette[2] || DEFAULT_COLORS[2];
    const c3 = palette[3] || shiftColor(c0, 34, 5, -3);
    const c4 = blendHex(c0, c1, 0.5);
    const c5 = blendHex(c1, c2, 0.5);

    const a1x = 8 + Math.round(unit(seed, 1) * 24);
    const a1y = 10 + Math.round(unit(seed, 2) * 22);
    const a2x = 68 + Math.round(unit(seed, 3) * 24);
    const a2y = 10 + Math.round(unit(seed, 4) * 24);
    const a3x = 12 + Math.round(unit(seed, 5) * 25);
    const a3y = 66 + Math.round(unit(seed, 6) * 24);
    const a4x = 62 + Math.round(unit(seed, 7) * 25);
    const a4y = 60 + Math.round(unit(seed, 8) * 25);

    const b1x = 30 + Math.round(unit(seed, 9) * 35);
    const b1y = 22 + Math.round(unit(seed, 10) * 30);
    const b2x = 14 + Math.round(unit(seed, 11) * 62);
    const b2y = 40 + Math.round(unit(seed, 12) * 48);

    const recipe = seed % 4;
    if (recipe === 0) {
        return {
            base: `linear-gradient(${120 + (seed % 60)}deg, ${shiftColor(c0, 8, 24, -8)} 0%, ${shiftColor(c1, 26, 8, -12)} 38%, ${shiftColor(c2, -18, 20, -8)} 72%, ${shiftColor(c3, 34, 10, -10)} 100%)`,
            mesh: `linear-gradient(${35 + (seed % 80)}deg, ${shiftColor(c4, 0, 12, 10)}44 0%, transparent 38%), linear-gradient(${220 + (seed % 90)}deg, ${shiftColor(c5, 0, 12, 8)}36 0%, transparent 40%)`,
            blobsA: `radial-gradient(ellipse at ${a1x}% ${a1y}%, ${shiftColor(c0, 24, 24, 12)}CC 0%, transparent 50%), radial-gradient(ellipse at ${a2x}% ${a2y}%, ${shiftColor(c2, -26, 20, 10)}B8 0%, transparent 54%), radial-gradient(ellipse at ${a3x}% ${a3y}%, ${shiftColor(c4, 18, 24, 12)}A8 0%, transparent 56%)`,
            blobsB: `radial-gradient(circle at ${a4x}% ${a4y}%, ${shiftColor(c5, -10, 22, 14)}92 0%, transparent 45%), radial-gradient(circle at ${b1x}% ${b1y}%, ${shiftColor(c1, 36, 18, 14)}8A 0%, transparent 46%)`,
            conic: `conic-gradient(from ${seed % 360}deg at 50% 50%, ${shiftColor(c0, 30, 16, 12)}34, transparent 24%, ${shiftColor(c2, -30, 18, 14)}36 48%, transparent 74%, ${shiftColor(c4, 8, 22, 10)}34 100%)`,
            glow: `linear-gradient(${22 + (seed % 80)}deg, transparent 8%, ${shiftColor(c3, 10, 22, 18)}52 45%, transparent 86%)`
        };
    }

    if (recipe === 1) {
        return {
            base: `linear-gradient(${145 + (seed % 42)}deg, ${shiftColor(c1, 18, 20, -10)} 0%, ${shiftColor(c0, 8, 18, -10)} 34%, ${shiftColor(c3, 36, 12, -8)} 70%, ${shiftColor(c4, 20, 20, -12)} 100%)`,
            mesh: `linear-gradient(${12 + (seed % 120)}deg, ${shiftColor(c5, -4, 20, 14)}3A 0%, transparent 44%), linear-gradient(${172 + (seed % 120)}deg, ${shiftColor(c2, 24, 18, 12)}34 0%, transparent 46%)`,
            blobsA: `radial-gradient(circle at ${a2x}% ${a1y}%, ${shiftColor(c1, 20, 26, 14)}CC 0%, transparent 50%), radial-gradient(ellipse at ${a3x}% ${a4y}%, ${shiftColor(c2, -22, 18, 12)}AA 0%, transparent 55%), radial-gradient(ellipse at ${b2x}% ${b1y}%, ${shiftColor(c4, 36, 18, 12)}96 0%, transparent 58%)`,
            blobsB: `radial-gradient(circle at ${b1x}% ${b2y}%, ${shiftColor(c0, 30, 18, 12)}92 0%, transparent 46%), radial-gradient(circle at ${a1x}% ${a3y}%, ${shiftColor(c5, -16, 24, 10)}8A 0%, transparent 48%)`,
            conic: `conic-gradient(from ${seed % 360}deg at 50% 50%, transparent 0deg, ${shiftColor(c0, 40, 24, 14)}3A 18%, transparent 42%, ${shiftColor(c4, 12, 18, 14)}34 58%, transparent 86%, ${shiftColor(c2, -24, 20, 14)}36 100%)`,
            glow: `linear-gradient(${240 + (seed % 60)}deg, transparent 4%, ${shiftColor(c3, 8, 24, 18)}4A 44%, transparent 88%)`
        };
    }

    if (recipe === 2) {
        return {
            base: `linear-gradient(${102 + (seed % 86)}deg, ${shiftColor(c2, 10, 24, -8)} 0%, ${shiftColor(c3, 18, 10, -10)} 35%, ${shiftColor(c0, 30, 22, -8)} 66%, ${shiftColor(c5, -12, 22, -8)} 100%)`,
            mesh: `linear-gradient(${70 + (seed % 120)}deg, ${shiftColor(c0, 30, 20, 12)}32 0%, transparent 42%), linear-gradient(${290 + (seed % 120)}deg, ${shiftColor(c4, 0, 18, 12)}36 0%, transparent 44%)`,
            blobsA: `radial-gradient(ellipse at ${a1x}% ${a4y}%, ${shiftColor(c2, -24, 24, 14)}C8 0%, transparent 52%), radial-gradient(ellipse at ${a2x}% ${a3y}%, ${shiftColor(c1, 28, 20, 12)}A8 0%, transparent 56%), radial-gradient(circle at ${b2x}% ${a2y}%, ${shiftColor(c5, -28, 26, 12)}96 0%, transparent 50%)`,
            blobsB: `radial-gradient(circle at ${a3x}% ${b2y}%, ${shiftColor(c4, 26, 18, 12)}92 0%, transparent 48%), radial-gradient(circle at ${b1x}% ${a1y}%, ${shiftColor(c0, 36, 20, 12)}84 0%, transparent 46%)`,
            conic: `conic-gradient(from ${220 + (seed % 120)}deg at 50% 52%, transparent 0deg, ${shiftColor(c3, -10, 24, 16)}34 20%, transparent 46%, ${shiftColor(c5, -30, 20, 14)}38 70%, transparent 100%)`,
            glow: `linear-gradient(${198 + (seed % 45)}deg, transparent 0%, ${shiftColor(c3, -16, 24, 18)}56 42%, transparent 82%)`
        };
    }

    return {
        base: `linear-gradient(${126 + (seed % 70)}deg, ${shiftColor(c3, 12, 22, -10)} 0%, ${shiftColor(c0, 6, 20, -8)} 30%, ${shiftColor(c1, 24, 18, -8)} 64%, ${shiftColor(c4, 10, 24, -12)} 100%)`,
        mesh: `linear-gradient(${35 + (seed % 100)}deg, ${shiftColor(c2, -10, 22, 12)}34 0%, transparent 42%), linear-gradient(${210 + (seed % 100)}deg, ${shiftColor(c5, 8, 20, 12)}34 0%, transparent 44%)`,
        blobsA: `radial-gradient(ellipse at ${a4x}% ${a1y}%, ${shiftColor(c0, 18, 26, 14)}C2 0%, transparent 50%), radial-gradient(ellipse at ${a2x}% ${a4y}%, ${shiftColor(c2, -14, 22, 14)}A6 0%, transparent 55%), radial-gradient(circle at ${a1x}% ${a3y}%, ${shiftColor(c4, 22, 20, 12)}92 0%, transparent 49%)`,
        blobsB: `radial-gradient(circle at ${b1x}% ${a2y}%, ${shiftColor(c5, -24, 22, 12)}8A 0%, transparent 47%), radial-gradient(circle at ${b2x}% ${b2y}%, ${shiftColor(c1, 36, 18, 12)}82 0%, transparent 46%)`,
        conic: `conic-gradient(from ${210 + (seed % 120)}deg at 50% 55%, transparent 0deg, ${shiftColor(c1, 40, 18, 14)}34 22%, transparent 48%, ${shiftColor(c4, 16, 20, 14)}38 72%, transparent 100%)`,
        glow: `linear-gradient(${8 + (seed % 120)}deg, transparent 4%, ${shiftColor(c3, 26, 24, 16)}4A 44%, transparent 88%)`
    };
};

export const ImmersiveVisualizer: React.FC<ImmersiveVisualizerProps> = React.memo(({ track, className }) => {
    const seed = React.useMemo(() => {
        const base = track?.logic?.hash_sha256 || track?.logic?.track_name || track?.metadata?.title || 'no-track';
        return hashText(base);
    }, [track?.logic?.hash_sha256, track?.logic?.track_name, track?.metadata?.title]);

    const palette = React.useMemo(() => extractTrackPalette(track), [track]);
    const layers = React.useMemo(() => buildRecipeLayers(palette, seed), [palette, seed]);

    return (
        <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className || ''}`} aria-hidden="true">
            <div className="absolute inset-0" style={{ background: layers.base }} />
            <div className="absolute inset-0" style={{ background: layers.mesh, opacity: 0.88, mixBlendMode: 'color-dodge' }} />
            <div className="absolute inset-[-12%] immersive-gradient-drift-slow" style={{ background: layers.blobsA, mixBlendMode: 'screen' }} />
            <div className="absolute inset-[-18%] immersive-gradient-drift-fast" style={{ background: layers.blobsB, mixBlendMode: 'lighten' }} />
            <div className="absolute inset-[-15%] immersive-gradient-rotate" style={{ background: layers.conic, mixBlendMode: 'soft-light' }} />
            <div className="absolute inset-[-20%] immersive-gradient-drift-fast" style={{ background: layers.glow, mixBlendMode: 'plus-lighter' }} />
            <div className="absolute inset-0 immersive-grain" />
            <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.06),rgba(0,0,0,0.18))]" />
        </div>
    );
});
