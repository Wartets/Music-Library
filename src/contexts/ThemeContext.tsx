import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { extractDominantColors, limitSaturation, ensureContrast, lightenColor, darkenColor, hexWithAlpha } from '../utils/colorUtils';
export type ThemeMode = 'adaptive' | 'fixed' | 'genre' | 'neutral';

export interface ThemeSettings {
    mode: ThemeMode;
    applyToNonEssentialsOnly: boolean;
    limitAggressiveColors: boolean;
    enforceContrast: boolean;
    manualHueOverride: number | null;
}

export interface Palette {
    dominant: string;
    dominantLight: string;
    dominantDark: string;
    onDominant: string;

    surfacePrimary: string;
    surfaceSecondary: string;
    surfaceElevated: string;
    surfaceHover: string;
    surfaceActive: string;

    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    textAccent: string;

    borderSubtle: string;
    borderDefault: string;
    borderAccent: string;

    badgeBg: string;
    badgeText: string;
    scrollbar: string;
}

interface ThemeContextProps {
    settings: ThemeSettings;
    updateSettings: (newSettings: Partial<ThemeSettings>) => void;
    applyArtworkColors: (artworkUrl: string | null) => Promise<void>;
    currentPalette: Palette;
    reportBadPalette: () => void;
}

const defaultSettings: ThemeSettings = {
    mode: 'adaptive',
    applyToNonEssentialsOnly: false,
    limitAggressiveColors: true,
    enforceContrast: true,
    manualHueOverride: null,
};

const DEFAULT_PALETTE: Palette = {
    dominant: '#444444',
    dominantLight: '#666666',
    dominantDark: '#222222',
    onDominant: '#ffffff',

    surfacePrimary: '#000000',
    surfaceSecondary: '#0a0a0a',
    surfaceElevated: '#141414',
    surfaceHover: 'rgba(255,255,255,0.05)',
    surfaceActive: 'rgba(255,255,255,0.1)',

    textPrimary: '#ffffff',
    textSecondary: '#a1a1aa', // zinc-400
    textMuted: '#52525b', // zinc-600
    textAccent: '#ffffff',

    borderSubtle: 'rgba(255,255,255,0.05)',
    borderDefault: 'rgba(255,255,255,0.1)',
    borderAccent: 'rgba(255,255,255,0.2)',

    badgeBg: 'rgba(255,255,255,0.1)',
    badgeText: '#ffffff',
    scrollbar: 'rgba(255,255,255,0.1)',
};

const ThemeContext = createContext<ThemeContextProps | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [settings, setSettings] = useState<ThemeSettings>(defaultSettings);
    const [currentPalette, setCurrentPalette] = useState<Palette>(DEFAULT_PALETTE);

    useEffect(() => {
        const root = document.documentElement;

        root.style.setProperty('--color-dominant', currentPalette.dominant);
        root.style.setProperty('--color-dominant-light', currentPalette.dominantLight);
        root.style.setProperty('--color-dominant-dark', currentPalette.dominantDark);
        root.style.setProperty('--color-on-dominant', currentPalette.onDominant);

        root.style.setProperty('--color-surface-primary', currentPalette.surfacePrimary);
        root.style.setProperty('--color-surface-secondary', currentPalette.surfaceSecondary);
        root.style.setProperty('--color-surface-elevated', currentPalette.surfaceElevated);
        root.style.setProperty('--color-surface-hover', currentPalette.surfaceHover);
        root.style.setProperty('--color-surface-active', currentPalette.surfaceActive);

        root.style.setProperty('--color-text-primary', currentPalette.textPrimary);
        root.style.setProperty('--color-text-secondary', currentPalette.textSecondary);
        root.style.setProperty('--color-text-muted', currentPalette.textMuted);
        root.style.setProperty('--color-text-accent', currentPalette.textAccent);

        root.style.setProperty('--color-border-subtle', currentPalette.borderSubtle);
        root.style.setProperty('--color-border-default', currentPalette.borderDefault);
        root.style.setProperty('--color-border-accent', currentPalette.borderAccent);

        root.style.setProperty('--color-badge-bg', currentPalette.badgeBg);
        root.style.setProperty('--color-badge-text', currentPalette.badgeText);
        root.style.setProperty('--color-scrollbar', currentPalette.scrollbar);

    }, [currentPalette]);

    const updateSettings = (newSettings: Partial<ThemeSettings>) => {
        setSettings(prev => ({ ...prev, ...newSettings }));
    };

    const applyArtworkColors = async (artworkUrl: string | null) => {
        if (!artworkUrl || settings.mode === 'neutral') {
            setCurrentPalette(DEFAULT_PALETTE);
            return;
        }

        if (settings.mode === 'fixed') {
            if (settings.manualHueOverride === null) return;
        }

        try {
            const colors = await extractDominantColors(artworkUrl, 1);
            let primary = colors[0] || DEFAULT_PALETTE.dominant;

            if (settings.limitAggressiveColors) {
                primary = limitSaturation(primary, 60);
            }

            let light = lightenColor(primary, 20);
            let dark = darkenColor(primary, 30);
            let textOnDom = '#ffffff';

            if (settings.enforceContrast) {
                primary = ensureContrast('#000000', primary, 2.5);
                textOnDom = ensureContrast(primary, '#ffffff', 4.5);
                light = ensureContrast('#000000', light, 4.5);
            }

            // Adjust semantic tokens based on primary color
            const surfaceSecondary = settings.applyToNonEssentialsOnly ? '#0a0a0a' : hexWithAlpha(dark, 0.3);
            const surfaceElevated = settings.applyToNonEssentialsOnly ? '#141414' : hexWithAlpha(dark, 0.6);

            setCurrentPalette({
                dominant: primary,
                dominantLight: light,
                dominantDark: dark,
                onDominant: textOnDom,

                surfacePrimary: '#000000',
                surfaceSecondary: surfaceSecondary,
                surfaceElevated: surfaceElevated,
                surfaceHover: hexWithAlpha(primary, 0.15),
                surfaceActive: hexWithAlpha(primary, 0.25),

                textPrimary: '#ffffff',
                textSecondary: '#a1a1aa',
                textMuted: '#52525b',
                textAccent: light, // Using lightened dominant for readable links/accents

                borderSubtle: 'rgba(255,255,255,0.05)',
                borderDefault: 'rgba(255,255,255,0.1)',
                borderAccent: hexWithAlpha(primary, 0.4),

                badgeBg: hexWithAlpha(primary, 0.2),
                badgeText: light,
                scrollbar: 'rgba(255,255,255,0.1)'
            });

        } catch (e) {
            console.error("Theme extraction failed", e);
            setCurrentPalette(DEFAULT_PALETTE);
        }
    };

    const reportBadPalette = () => {
        console.warn("User reported bad palette for current track.", currentPalette);
        alert("Thanks for the feedback. Fallback to default palette applied.");
        setCurrentPalette(DEFAULT_PALETTE);
    };

    return (
        <ThemeContext.Provider value={{
            settings, updateSettings, applyArtworkColors, currentPalette, reportBadPalette
        }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) throw new Error('useTheme must be used within ThemeProvider');
    return context;
};
