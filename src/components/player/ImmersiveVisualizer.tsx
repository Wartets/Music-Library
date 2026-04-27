import React from 'react';
import type { TrackItem } from '../../types/music';
import { hexToRgb, hslToRgb, rgbToHex, rgbToHsl } from '../../utils/colorUtils';
import { getImmersiveTuning, type ImmersiveTuning } from './immersiveTuning';

interface ImmersiveVisualizerProps {
    track?: TrackItem | null;
    className?: string;
}

interface VisualRecipe {
    key: string;
    base: string;
    mesh: string;
    blobsA: string;
    blobsB: string;
    conic: string;
    glow: string;
    streaks: string;
    texture: string;
    grainPatchMask: string;
    grainLayerCoarse: string;
    grainLayerMid: string;
    grainLayerFine: string;
}

interface ColorTransformConfig {
    hueScale: number;
    hueLimit: number;
    saturationScale: number;
    saturationLimit: number;
    lightnessScale: number;
    lightnessLimit: number;
    minSaturation: number;
    maxSaturation: number;
    minLightness: number;
    maxLightness: number;
}

let colorTransformConfig: ColorTransformConfig = {
    hueScale: 0.36,
    hueLimit: 5,
    saturationScale: 0.72,
    saturationLimit: 12,
    lightnessScale: 0.62,
    lightnessLimit: 12,
    minSaturation: 18,
    maxSaturation: 84,
    minLightness: 12,
    maxLightness: 74
};

const applyColorTransformConfig = (nextConfig: ImmersiveTuning['color']) => {
    colorTransformConfig = {
        hueScale: Math.max(0, Math.min(1.2, nextConfig.hueScale)),
        hueLimit: Math.max(0, Math.min(16, nextConfig.hueLimit)),
        saturationScale: Math.max(0.2, Math.min(1.4, nextConfig.saturationScale)),
        saturationLimit: Math.max(2, Math.min(22, nextConfig.saturationLimit)),
        lightnessScale: Math.max(0.2, Math.min(1.4, nextConfig.lightnessScale)),
        lightnessLimit: Math.max(2, Math.min(22, nextConfig.lightnessLimit)),
        minSaturation: Math.max(0, Math.min(100, nextConfig.minSaturation)),
        maxSaturation: Math.max(0, Math.min(100, nextConfig.maxSaturation)),
        minLightness: Math.max(0, Math.min(100, nextConfig.minLightness)),
        maxLightness: Math.max(0, Math.min(100, nextConfig.maxLightness))
    };
};

const HEX_COLOR_REGEX = /^#([0-9a-f]{6})$/i;

const normalizeHex = (value?: string | null): string | null => {
    if (!value) return null;
    const normalized = value.trim();
    if (!HEX_COLOR_REGEX.test(normalized)) return null;
    return normalized.toUpperCase();
};

const rgbStringToHex = (value?: string | null): string | null => {
    if (!value) return null;
    const match = value.trim().match(/^rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (!match) return null;
    const r = Math.max(0, Math.min(255, Number(match[1])));
    const g = Math.max(0, Math.min(255, Number(match[2])));
    const b = Math.max(0, Math.min(255, Number(match[3])));
    return rgbToHex(r, g, b);
};

const toRgba = (hex: string, alpha: number): string => {
    const rgb = hexToRgb(hex);
    if (!rgb) return `rgba(255,255,255,${Math.max(0, Math.min(1, alpha))})`;
    const a = Math.max(0, Math.min(1, alpha));
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
};

const colorLuminance = (hex: string): number => {
    const rgb = hexToRgb(hex);
    if (!rgb) return 0;

    const normalize = (channel: number) => {
        const value = channel / 255;
        return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
    };

    const r = normalize(rgb.r);
    const g = normalize(rgb.g);
    const b = normalize(rgb.b);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const softBlob = (shape: 'circle' | 'ellipse', x: number, y: number, color: string, intensity: number, spread: number): string => {
    const i = Math.max(0.35, Math.min(1.5, intensity));
    const safeSpread = Math.max(58, Math.min(92, spread));
    const warm = shiftColor(color, 6, 8, 10);
    const cool = shiftColor(color, -6, 4, 4);
    return `${shape === 'ellipse' ? 'radial-gradient(ellipse at' : 'radial-gradient(circle at'} ${x}% ${y}%, ${toRgba(warm, 0.78 * i)} 0%, ${toRgba(cool, 0.5 * i)} 34%, ${toRgba(color, 0.22 * i)} ${Math.max(48, safeSpread - 18)}%, transparent ${safeSpread}%)`;
};

const buildGrainPatchMask = (palette: string[], seed: number, patchOpacity: number): string => {
    const c0 = palette[0];
    const c1 = palette[2] || palette[0];
    const c2 = palette[4] || palette[1] || palette[0];
    const opacity = Math.max(0.04, Math.min(0.5, patchOpacity));

    const p1x = 14 + Math.round(unit(seed, 210) * 72);
    const p1y = 16 + Math.round(unit(seed, 211) * 68);
    const p2x = 10 + Math.round(unit(seed, 212) * 74);
    const p2y = 14 + Math.round(unit(seed, 213) * 72);
    const p3x = 10 + Math.round(unit(seed, 214) * 76);
    const p3y = 14 + Math.round(unit(seed, 215) * 70);

    return `radial-gradient(ellipse at ${p1x}% ${p1y}%, ${toRgba(c0, opacity)} 0%, ${toRgba(c0, opacity * 0.54)} 36%, transparent 74%), radial-gradient(ellipse at ${p2x}% ${p2y}%, ${toRgba(c1, opacity * 0.92)} 0%, ${toRgba(c1, opacity * 0.48)} 34%, transparent 72%), radial-gradient(ellipse at ${p3x}% ${p3y}%, ${toRgba(c2, opacity * 0.84)} 0%, ${toRgba(c2, opacity * 0.42)} 38%, transparent 76%)`;
};

const buildNoiseTextureDataUri = (
    seed: number,
    offset: number,
    options: {
        baseFrequency: number;
        frequencyJitter: number;
        octaves: number;
        opacity: number;
        color: string;
        mode?: 'fractalNoise' | 'turbulence';
        size?: number;
    }
): string => {
    const size = options.size || 256;
    const frequency = (options.baseFrequency + (unit(seed, offset) - 0.5) * options.frequencyJitter).toFixed(3);
    const octaves = Math.max(1, Math.min(6, Math.round(options.octaves)));
    const rgb = hexToRgb(options.color) || { r: 255, g: 255, b: 255 };
    const alpha = Math.max(0.04, Math.min(0.92, options.opacity));
    const noiseType = options.mode || 'fractalNoise';

    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${size} ${size}' preserveAspectRatio='none'><filter id='n' x='0' y='0' width='${size}' height='${size}' filterUnits='userSpaceOnUse'><feTurbulence type='${noiseType}' baseFrequency='${frequency}' numOctaves='${octaves}' seed='${(seed + offset) % 2147483647}' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/><feComponentTransfer><feFuncR type='gamma' amplitude='1.12' exponent='0.88' offset='0'/><feFuncG type='gamma' amplitude='1.12' exponent='0.88' offset='0'/><feFuncB type='gamma' amplitude='1.12' exponent='0.88' offset='0'/></feComponentTransfer><feColorMatrix type='matrix' values='0 0 0 0 ${rgb.r / 255} 0 0 0 0 ${rgb.g / 255} 0 0 0 0 ${rgb.b / 255} 0 0 0 ${alpha} 0'/></filter><rect width='${size}' height='${size}' filter='url(%23n)'/></svg>`;

    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
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
    const tunedHueShift = hueShift * colorTransformConfig.hueScale;
    const tunedSatDelta = saturationDelta * colorTransformConfig.saturationScale;
    const tunedLightDelta = lightnessDelta * colorTransformConfig.lightnessScale;

    const safeHueShift = Math.max(-colorTransformConfig.hueLimit, Math.min(colorTransformConfig.hueLimit, tunedHueShift));
    const safeSatDelta = Math.max(-colorTransformConfig.saturationLimit, Math.min(colorTransformConfig.saturationLimit, tunedSatDelta));
    const safeLightDelta = Math.max(-colorTransformConfig.lightnessLimit, Math.min(colorTransformConfig.lightnessLimit, tunedLightDelta));
    const shiftedHue = ((hsl.h + safeHueShift) % 360 + 360) % 360;
    const shiftedSaturation = Math.max(colorTransformConfig.minSaturation, Math.min(colorTransformConfig.maxSaturation, hsl.s + safeSatDelta));
    const shiftedLightness = Math.max(colorTransformConfig.minLightness, Math.min(colorTransformConfig.maxLightness, hsl.l + safeLightDelta));
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

const extractArtworkColors = (track: TrackItem): string[] => {
    const baseArtworkColors = [
        ...(track.artworks?.track_artwork || []).map(art => art?.dominant_color),
        ...(track.artworks?.album_artwork || []).map(art => art?.dominant_color)
    ];

    const versionArtworkColors = (track.versions || []).flatMap(version => [
        ...(version.artworks?.track_artwork || []).map(art => art?.dominant_color),
        ...(version.artworks?.album_artwork || []).map(art => art?.dominant_color)
    ]);

    return [...baseArtworkColors, ...versionArtworkColors]
        .map(color => normalizeHex(color))
        .filter((color): color is string => Boolean(color));
};

const extractTrackPalette = (track?: TrackItem | null): string[] | null => {
    if (!track) return null;

    const fromArtwork = extractArtworkColors(track);

    const unique = Array.from(new Set(fromArtwork));
    const selected = unique.slice(0, 6);

    if (selected.length === 0) {
        return null;
    }

    while (selected.length < 6) {
        const source = selected[selected.length - 1] || selected[0];
        const darker = shiftColor(source, 0, -8 + (selected.length % 3), -24 + (selected.length % 4) * 3);
        const lighter = shiftColor(source, 0, 6, 18 - (selected.length % 3) * 2);
        selected.push(selected.length % 2 === 0 ? darker : lighter);
    }

    return selected;
};

const getThemeDominantColor = (): string | null => {
    if (typeof window === 'undefined') return null;
    const cssValue = window.getComputedStyle(document.documentElement).getPropertyValue('--color-dominant')?.trim();
    return normalizeHex(cssValue) || rgbStringToHex(cssValue);
};

const buildRecipeLayers = (palette: string[], seed: number, tuning: ImmersiveTuning): {
    base: string;
    mesh: string;
    blobsA: string;
    blobsB: string;
    conic: string;
    glow: string;
    streaks: string;
    texture: string;
} => {
    const c0 = palette[0];
    const c1 = palette[1];
    const c2 = palette[2];
    const c3 = palette[3];
    const c4 = palette[4] || blendHex(c0, c1, 0.5);
    const c5 = palette[5] || blendHex(c1, c2, 0.5);

    const c0Dark = shiftColor(c0, 0, -12, -28);
    const c1Dark = shiftColor(c1, 0, -10, -24);
    const c2Dark = shiftColor(c2, 0, -10, -26);
    const c3Dark = shiftColor(c3, 0, -8, -22);
    const c4Light = shiftColor(c4, 0, 8, 14);
    const c5Light = shiftColor(c5, 0, 10, 16);
    const averageLuminance = [c0, c1, c2, c3, c4, c5].reduce((acc, color) => acc + colorLuminance(color), 0) / 6;
    const darkBoost = averageLuminance < tuning.gradient.darkBoostThreshold ? tuning.gradient.darkBoostAmount : 1;

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

    const streakAngleA = 18 + Math.round(unit(seed, 13) * 130);
    const streakAngleB = 180 + Math.round(unit(seed, 14) * 140);
    const textureAngle = 40 + Math.round(unit(seed, 15) * 130);

    const recipe = seed % 4;
    if (recipe === 0) {
        return {
            base: `linear-gradient(${120 + (seed % 60)}deg, ${c0Dark} 0%, ${shiftColor(c1, 12, 20, -10)} 26%, ${shiftColor(c2, -10, 18, -6)} 52%, ${shiftColor(c3, 10, 14, -12)} 78%, ${c1Dark} 100%)`,
            mesh: `linear-gradient(${35 + (seed % 80)}deg, ${toRgba(c4Light, 0.28)} 0%, transparent 40%), linear-gradient(${220 + (seed % 90)}deg, ${toRgba(c5Light, 0.22)} 0%, transparent 42%)`,
            blobsA: `${softBlob('ellipse', a1x, a1y, shiftColor(c0, 24, 24, 12), 1.02 * darkBoost, 82)}, ${softBlob('ellipse', a2x, a2y, shiftColor(c2, -22, 20, 10), 0.96 * darkBoost, 84)}, ${softBlob('ellipse', a3x, a3y, shiftColor(c4, 16, 20, 10), 0.9 * darkBoost, 86)}`,
            blobsB: `${softBlob('circle', a4x, a4y, shiftColor(c5, -10, 22, 12), 0.84 * darkBoost, 78)}, ${softBlob('circle', b1x, b1y, shiftColor(c1, 30, 18, 12), 0.8 * darkBoost, 80)}`,
            conic: `conic-gradient(from ${seed % 360}deg at 50% 50%, ${shiftColor(c0, 30, 16, 12)}34, transparent 24%, ${shiftColor(c2, -30, 18, 14)}36 48%, transparent 74%, ${shiftColor(c4, 8, 22, 10)}34 100%)`,
            glow: `linear-gradient(${22 + (seed % 80)}deg, transparent 8%, ${toRgba(shiftColor(c3, 10, 22, 18), 0.38 * darkBoost)} 45%, transparent 86%)`,
            streaks: `linear-gradient(${streakAngleA}deg, transparent 2%, ${toRgba(shiftColor(c4, 18, 18, 12), 0.28 * darkBoost)} 22%, transparent 46%, ${toRgba(shiftColor(c2, -12, 20, 12), 0.26 * darkBoost)} 62%, transparent 86%), linear-gradient(${streakAngleB}deg, transparent 8%, ${toRgba(shiftColor(c0, 10, 18, 10), 0.2 * darkBoost)} 34%, transparent 66%)`,
            texture: `repeating-conic-gradient(from ${seed % 360}deg at 52% 50%, ${toRgba(shiftColor(c1, 14, 18, 8), 0.12)} 0deg 8deg, transparent 8deg 18deg)`
        };
    }

    if (recipe === 1) {
        return {
            base: `linear-gradient(${145 + (seed % 42)}deg, ${c2Dark} 0%, ${shiftColor(c0, 6, 20, -12)} 24%, ${shiftColor(c1, 14, 16, -8)} 54%, ${shiftColor(c4, 8, 18, -10)} 78%, ${c3Dark} 100%)`,
            mesh: `linear-gradient(${12 + (seed % 120)}deg, ${toRgba(c5Light, 0.26)} 0%, transparent 46%), linear-gradient(${172 + (seed % 120)}deg, ${toRgba(c4Light, 0.24)} 0%, transparent 48%)`,
            blobsA: `${softBlob('circle', a2x, a1y, shiftColor(c1, 20, 24, 14), 0.96 * darkBoost, 82)}, ${softBlob('ellipse', a3x, a4y, shiftColor(c2, -18, 18, 12), 0.9 * darkBoost, 84)}, ${softBlob('ellipse', b2x, b1y, shiftColor(c4, 30, 18, 10), 0.84 * darkBoost, 88)}`,
            blobsB: `${softBlob('circle', b1x, b2y, shiftColor(c0, 28, 18, 12), 0.82 * darkBoost, 80)}, ${softBlob('circle', a1x, a3y, shiftColor(c5, -14, 22, 10), 0.78 * darkBoost, 82)}`,
            conic: `conic-gradient(from ${seed % 360}deg at 50% 50%, transparent 0deg, ${shiftColor(c0, 40, 24, 14)}3A 18%, transparent 42%, ${shiftColor(c4, 12, 18, 14)}34 58%, transparent 86%, ${shiftColor(c2, -24, 20, 14)}36 100%)`,
            glow: `linear-gradient(${240 + (seed % 60)}deg, transparent 4%, ${toRgba(shiftColor(c3, 8, 24, 18), 0.34 * darkBoost)} 44%, transparent 88%)`,
            streaks: `linear-gradient(${streakAngleA}deg, transparent 0%, ${toRgba(shiftColor(c5, 20, 22, 14), 0.22 * darkBoost)} 28%, transparent 54%, ${toRgba(shiftColor(c1, -10, 20, 10), 0.18 * darkBoost)} 70%, transparent 100%), linear-gradient(${streakAngleB}deg, transparent 10%, ${toRgba(shiftColor(c0, 24, 18, 10), 0.2 * darkBoost)} 36%, transparent 72%)`,
            texture: `repeating-linear-gradient(${textureAngle}deg, ${toRgba(shiftColor(c2, 10, 8, 8), 0.12)} 0px, ${toRgba(shiftColor(c2, 10, 8, 8), 0.12)} 2px, transparent 2px, transparent 11px)`
        };
    }

    if (recipe === 2) {
        return {
            base: `linear-gradient(${102 + (seed % 86)}deg, ${c1Dark} 0%, ${shiftColor(c3, 10, 16, -8)} 30%, ${shiftColor(c0, 16, 20, -10)} 56%, ${shiftColor(c5, 4, 18, -8)} 78%, ${c0Dark} 100%)`,
            mesh: `linear-gradient(${70 + (seed % 120)}deg, ${toRgba(c4Light, 0.24)} 0%, transparent 44%), linear-gradient(${290 + (seed % 120)}deg, ${toRgba(c5Light, 0.24)} 0%, transparent 46%)`,
            blobsA: `${softBlob('ellipse', a1x, a4y, shiftColor(c2, -22, 24, 14), 1 * darkBoost, 84)}, ${softBlob('ellipse', a2x, a3y, shiftColor(c1, 26, 20, 12), 0.86 * darkBoost, 86)}, ${softBlob('circle', b2x, a2y, shiftColor(c5, -22, 22, 10), 0.82 * darkBoost, 82)}`,
            blobsB: `${softBlob('circle', a3x, b2y, shiftColor(c4, 22, 16, 10), 0.78 * darkBoost, 80)}, ${softBlob('circle', b1x, a1y, shiftColor(c0, 30, 20, 12), 0.74 * darkBoost, 78)}`,
            conic: `conic-gradient(from ${220 + (seed % 120)}deg at 50% 52%, transparent 0deg, ${shiftColor(c3, -10, 24, 16)}34 20%, transparent 46%, ${shiftColor(c5, -30, 20, 14)}38 70%, transparent 100%)`,
            glow: `linear-gradient(${198 + (seed % 45)}deg, transparent 0%, ${toRgba(shiftColor(c3, -14, 24, 18), 0.36 * darkBoost)} 42%, transparent 82%)`,
            streaks: `linear-gradient(${streakAngleA}deg, transparent 4%, ${toRgba(shiftColor(c4, 14, 20, 12), 0.26 * darkBoost)} 30%, transparent 58%, ${toRgba(shiftColor(c1, -12, 18, 8), 0.2 * darkBoost)} 76%, transparent 100%), linear-gradient(${streakAngleB}deg, transparent 0%, ${toRgba(shiftColor(c0, 18, 20, 10), 0.22 * darkBoost)} 28%, transparent 64%)`,
            texture: `repeating-radial-gradient(circle at 48% 52%, ${toRgba(shiftColor(c2, 8, 10, 6), 0.1)} 0px, transparent 3px, transparent 15px)`
        };
    }

    return {
        base: `linear-gradient(${126 + (seed % 70)}deg, ${c3Dark} 0%, ${shiftColor(c0, 8, 16, -10)} 24%, ${shiftColor(c2, -8, 18, -8)} 54%, ${shiftColor(c4, 12, 18, -10)} 76%, ${c2Dark} 100%)`,
        mesh: `linear-gradient(${35 + (seed % 100)}deg, ${toRgba(c4Light, 0.24)} 0%, transparent 44%), linear-gradient(${210 + (seed % 100)}deg, ${toRgba(c5Light, 0.22)} 0%, transparent 46%)`,
        blobsA: `${softBlob('ellipse', a4x, a1y, shiftColor(c0, 18, 24, 14), 0.96 * darkBoost, 84)}, ${softBlob('ellipse', a2x, a4y, shiftColor(c2, -12, 22, 14), 0.86 * darkBoost, 86)}, ${softBlob('circle', a1x, a3y, shiftColor(c4, 20, 18, 10), 0.8 * darkBoost, 82)}`,
        blobsB: `${softBlob('circle', b1x, a2y, shiftColor(c5, -20, 22, 10), 0.76 * darkBoost, 80)}, ${softBlob('circle', b2x, b2y, shiftColor(c1, 30, 16, 10), 0.72 * darkBoost, 78)}`,
        conic: `conic-gradient(from ${210 + (seed % 120)}deg at 50% 55%, transparent 0deg, ${shiftColor(c1, 40, 18, 14)}34 22%, transparent 48%, ${shiftColor(c4, 16, 20, 14)}38 72%, transparent 100%)`,
        glow: `linear-gradient(${8 + (seed % 120)}deg, transparent 4%, ${toRgba(shiftColor(c3, 22, 22, 16), 0.34 * darkBoost)} 44%, transparent 88%)`,
        streaks: `linear-gradient(${streakAngleA}deg, transparent 3%, ${toRgba(shiftColor(c1, 18, 18, 10), 0.22 * darkBoost)} 30%, transparent 56%, ${toRgba(shiftColor(c4, -10, 16, 10), 0.18 * darkBoost)} 72%, transparent 100%), linear-gradient(${streakAngleB}deg, transparent 12%, ${toRgba(shiftColor(c5, 14, 18, 10), 0.18 * darkBoost)} 38%, transparent 72%)`,
        texture: `repeating-linear-gradient(${textureAngle}deg, ${toRgba(shiftColor(c0, 10, 10, 6), 0.1)} 0px, ${toRgba(shiftColor(c0, 10, 10, 6), 0.1)} 1px, transparent 1px, transparent 10px)`
    };
};

const buildVisualRecipe = (track: TrackItem | null | undefined, tuning: ImmersiveTuning): VisualRecipe | null => {
    if (!track) return null;

    applyColorTransformConfig(tuning.color);

    const key = track.logic?.hash_sha256 || track.logic?.track_name || track.metadata?.title || 'no-track';
    const seed = hashText(key);
    const palette = extractTrackPalette(track) || (() => {
        const themeColor = getThemeDominantColor();
        if (!themeColor) return null;
        return [
            themeColor,
            shiftColor(themeColor, 0, 5, 10),
            shiftColor(themeColor, 0, -5, -10),
            shiftColor(themeColor, 4, 6, 8),
            shiftColor(themeColor, -4, 6, 8),
            shiftColor(themeColor, 0, -6, -16)
        ];
    })();
    if (!palette) return null;

    const layers = buildRecipeLayers(palette, seed, tuning);

    const overall = Math.max(0.2, Math.min(2.2, tuning.grain.overallStrength));
    const grainPatchMask = buildGrainPatchMask(palette, seed, tuning.grain.patchOpacity * overall);

    const grainLayerCoarse = buildNoiseTextureDataUri(seed, 260, {
        baseFrequency: tuning.grain.coarseBaseFrequency,
        frequencyJitter: tuning.grain.coarseFrequencyJitter,
        octaves: tuning.grain.coarseOctaves,
        opacity: tuning.grain.coarseOpacity * overall,
        color: palette[0],
        mode: 'fractalNoise',
        size: 320
    });

    const grainLayerMid = buildNoiseTextureDataUri(seed, 1240, {
        baseFrequency: tuning.grain.midBaseFrequency,
        frequencyJitter: tuning.grain.midFrequencyJitter,
        octaves: tuning.grain.midOctaves,
        opacity: tuning.grain.midOpacity * overall,
        color: palette[2] || palette[1] || palette[0],
        mode: 'fractalNoise',
        size: 256
    });

    const grainLayerFine = buildNoiseTextureDataUri(seed, 2280, {
        baseFrequency: tuning.grain.fineBaseFrequency,
        frequencyJitter: tuning.grain.fineFrequencyJitter,
        octaves: tuning.grain.fineOctaves,
        opacity: tuning.grain.fineOpacity * overall,
        color: palette[4] || palette[3] || palette[0],
        mode: 'turbulence',
        size: 192
    });

    return {
        key,
        ...layers,
        grainPatchMask,
        grainLayerCoarse,
        grainLayerMid,
        grainLayerFine
    };
};

export const ImmersiveVisualizer: React.FC<ImmersiveVisualizerProps> = React.memo(({ track, className }) => {
    const tuning = React.useMemo(() => getImmersiveTuning(), []);
    const transitionDurationMs = tuning.transition.crossfadeMs;
    const trackKey = track?.logic?.hash_sha256 || track?.logic?.track_name || track?.metadata?.title || null;
    const nextRecipe = React.useMemo(() => buildVisualRecipe(track, tuning), [trackKey, tuning]);

    const [currentRecipe, setCurrentRecipe] = React.useState<VisualRecipe | null>(nextRecipe);
    const [previousRecipe, setPreviousRecipe] = React.useState<VisualRecipe | null>(null);
    const [isCrossfadeActive, setIsCrossfadeActive] = React.useState(false);
    const frameRef = React.useRef<number | null>(null);
    const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    React.useEffect(() => {
        if (frameRef.current !== null) {
            cancelAnimationFrame(frameRef.current);
            frameRef.current = null;
        }
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }

        if (!nextRecipe) {
            setCurrentRecipe(null);
            setPreviousRecipe(null);
            setIsCrossfadeActive(false);
            return;
        }

        setCurrentRecipe((activeRecipe) => {
            if (!activeRecipe) {
                setPreviousRecipe(null);
                setIsCrossfadeActive(false);
                return nextRecipe;
            }

            if (activeRecipe.key === nextRecipe.key) {
                return activeRecipe;
            }

            setPreviousRecipe(activeRecipe);
            setIsCrossfadeActive(false);

            frameRef.current = requestAnimationFrame(() => {
                setIsCrossfadeActive(true);
            });

            timeoutRef.current = setTimeout(() => {
                setPreviousRecipe(null);
                setIsCrossfadeActive(false);
                timeoutRef.current = null;
            }, transitionDurationMs + 180);

            return nextRecipe;
        });
    }, [nextRecipe]);

    React.useEffect(() => {
        return () => {
            if (frameRef.current !== null) {
                cancelAnimationFrame(frameRef.current);
            }
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    if (!currentRecipe) {
        return null;
    }

    const renderRecipe = (recipe: VisualRecipe) => (
        <>
            <div className="absolute inset-0" style={{ background: recipe.base }} />
            <div className="absolute inset-0" style={{ background: recipe.mesh, opacity: tuning.gradient.meshOpacity, mixBlendMode: 'color-dodge' }} />
            <div className="absolute inset-[-30%] immersive-gradient-drift-slow" style={{ background: recipe.blobsA, mixBlendMode: 'screen' }} />
            <div className="absolute inset-[-36%] immersive-gradient-drift-fast" style={{ background: recipe.blobsB, mixBlendMode: 'lighten' }} />
            <div className="absolute inset-[-30%] immersive-gradient-rotate" style={{ background: recipe.conic, mixBlendMode: 'soft-light' }} />
            <div className="absolute inset-[-34%] immersive-gradient-drift-fast" style={{ background: recipe.glow, mixBlendMode: 'plus-lighter' }} />
            <div className="absolute inset-[-22%] immersive-gradient-drift-slow" style={{ background: recipe.streaks, mixBlendMode: 'screen', opacity: tuning.gradient.streakOpacity }} />
            <div className="absolute inset-[-10%] immersive-gradient-rotate" style={{ background: recipe.texture, mixBlendMode: 'soft-light', opacity: tuning.gradient.textureOpacity }} />
            <div
                className="absolute inset-0 immersive-grain-patch"
                style={{
                    backgroundImage: recipe.grainPatchMask,
                    filter: 'saturate(118%)'
                }}
            />
            <div
                className="absolute inset-0 immersive-grain"
                style={{
                    backgroundImage: recipe.grainLayerCoarse,
                    filter: `contrast(${tuning.grain.coarseContrast}%) brightness(${tuning.grain.coarseBrightness}%)`,
                    opacity: Math.max(0.06, Math.min(0.9, tuning.grain.coarseOpacity * tuning.grain.overallStrength)),
                    animationDuration: `${Math.max(250, tuning.grain.coarseAnimationMs)}ms`
                }}
            />
            <div
                className="absolute inset-0 immersive-grain-mid"
                style={{
                    backgroundImage: recipe.grainLayerMid,
                    filter: `contrast(${tuning.grain.midContrast}%) brightness(${tuning.grain.midBrightness}%)`,
                    opacity: Math.max(0.04, Math.min(0.8, tuning.grain.midOpacity * tuning.grain.overallStrength)),
                    animationDuration: `${Math.max(220, tuning.grain.midAnimationMs)}ms`
                }}
            />
            <div
                className="absolute inset-0 immersive-grain-fine"
                style={{
                    backgroundImage: recipe.grainLayerFine,
                    filter: `contrast(${tuning.grain.fineContrast}%) brightness(${tuning.grain.fineBrightness}%)`,
                    opacity: Math.max(0.03, Math.min(0.72, tuning.grain.fineOpacity * tuning.grain.overallStrength)),
                    animationDuration: `${Math.max(180, tuning.grain.fineAnimationMs)}ms`
                }}
            />
            <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.03),rgba(0,0,0,0.16))]" />
        </>
    );

    return (
        <div className={`absolute inset-0 overflow-hidden pointer-events-none isolate ${className || ''}`} aria-hidden="true">
            {previousRecipe && (
                <div
                    className="absolute inset-0 transition-opacity ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[opacity]"
                    style={{
                        opacity: isCrossfadeActive ? 0 : 1,
                        transitionDuration: `${transitionDurationMs}ms`
                    }}
                >
                    {renderRecipe(previousRecipe)}
                </div>
            )}
            <div
                className="absolute inset-0 transition-opacity ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[opacity]"
                style={{
                    opacity: previousRecipe ? (isCrossfadeActive ? 1 : 0) : 1,
                    transitionDuration: `${transitionDurationMs}ms`
                }}
            >
                {renderRecipe(currentRecipe)}
            </div>
        </div>
    );
});
