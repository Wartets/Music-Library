export interface ImmersiveTuning {
    color: {
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
    };
    gradient: {
        darkBoostThreshold: number;
        darkBoostAmount: number;
        meshOpacity: number;
        streakOpacity: number;
        textureOpacity: number;
    };
    grain: {
        overallStrength: number;
        coarseBaseFrequency: number;
        coarseFrequencyJitter: number;
        coarseOctaves: number;
        coarseOpacity: number;
        midBaseFrequency: number;
        midFrequencyJitter: number;
        midOctaves: number;
        midOpacity: number;
        fineBaseFrequency: number;
        fineFrequencyJitter: number;
        fineOctaves: number;
        fineOpacity: number;
        patchOpacity: number;
        coarseContrast: number;
        coarseBrightness: number;
        midContrast: number;
        midBrightness: number;
        fineContrast: number;
        fineBrightness: number;
        coarseAnimationMs: number;
        midAnimationMs: number;
        fineAnimationMs: number;
    };
    transition: {
        crossfadeMs: number;
    };
}

export const DEFAULT_IMMERSIVE_TUNING: ImmersiveTuning = {
    color: {
        // Multiplies requested hue shifts before clamping. Lower = closer to artwork colors.
        hueScale: 0.2,
        // Hard clamp for hue shift in degrees (applied after scale).
        hueLimit: 2,
        // Multiplies requested saturation delta before clamping.
        saturationScale: 0.72,
        // Absolute clamp for saturation delta.
        saturationLimit: 12,
        // Multiplies requested lightness delta before clamping.
        lightnessScale: 0.3,
        // Absolute clamp for lightness delta.
        lightnessLimit: 12,
        // Floor/ceiling after color transforms.
        minSaturation: 18,
        maxSaturation: 84,
        minLightness: 12,
        maxLightness: 60
    },
    gradient: {
        // If average palette luminance is below this, dark-scene boost is applied.
        darkBoostThreshold: 0.22,
        // Multiplier for highlight strength on dark artwork.
        darkBoostAmount: 1.2,
        // Opacity for mesh overlay layer.
        meshOpacity: 0.84,
        // Opacity for streak overlay.
        streakOpacity: 0.86,
        // Opacity for texture overlay.
        textureOpacity: 0.66
    },
    grain: {
        // Global intensity multiplier for all grain layers.
        overallStrength: 1,
        // Coarse grain turbulence settings.
        coarseBaseFrequency: 10.72,
        coarseFrequencyJitter: 7.2,
        coarseOctaves: 4,
        coarseOpacity: 0.8,
        // Mid grain turbulence settings.
        midBaseFrequency: 1.18,
        midFrequencyJitter: 0.24,
        midOctaves: 3,
        midOpacity: 0.28,
        // Fine grain turbulence settings (sub-pixel micro-grain feel).
        fineBaseFrequency: 1.95,
        fineFrequencyJitter: 0.34,
        fineOctaves: 2,
        fineOpacity: 0.22,
        // Patch mask opacity controls where grain is emphasized.
        patchOpacity: 0.2,
        // Color filters for each layer.
        coarseContrast: 188,
        coarseBrightness: 126,
        midContrast: 204,
        midBrightness: 122,
        fineContrast: 218,
        fineBrightness: 118,
        // Animation speed for grain motion.
        coarseAnimationMs: 720,
        midAnimationMs: 620,
        fineAnimationMs: 480
    },
    transition: {
        // Track-change crossfade duration in ms.
        crossfadeMs: 3000
    }
};

const STORAGE_KEY = 'music-library:immersive-tuning';

const mergeObject = <T extends Record<string, any>>(base: T, incoming?: Partial<T>): T => {
    if (!incoming) return base;
    const output: Record<string, any> = { ...base };

    for (const key of Object.keys(incoming)) {
        const baseValue = base[key];
        const incomingValue = incoming[key];

        if (incomingValue === undefined) continue;
        if (baseValue && typeof baseValue === 'object' && !Array.isArray(baseValue) && typeof incomingValue === 'object' && !Array.isArray(incomingValue)) {
            output[key] = mergeObject(baseValue, incomingValue as any);
        } else {
            output[key] = incomingValue;
        }
    }

    return output as T;
};

declare global {
    interface Window {
        __IMMERSIVE_TUNING__?: Partial<ImmersiveTuning>;
    }
}

export const getImmersiveTuning = (): ImmersiveTuning => {
    let fromStorage: Partial<ImmersiveTuning> | undefined;

    if (typeof window !== 'undefined') {
        try {
            const raw = window.localStorage.getItem(STORAGE_KEY);
            if (raw) {
                fromStorage = JSON.parse(raw) as Partial<ImmersiveTuning>;
            }
        } catch {
            fromStorage = undefined;
        }
    }

    const withStorage = mergeObject(DEFAULT_IMMERSIVE_TUNING, fromStorage);

    if (typeof window !== 'undefined' && window.__IMMERSIVE_TUNING__) {
        return mergeObject(withStorage, window.__IMMERSIVE_TUNING__);
    }

    return withStorage;
};

export const IMMERSIVE_TUNING_STORAGE_KEY = STORAGE_KEY;
