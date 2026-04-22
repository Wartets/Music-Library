import React from 'react';

interface ImmersiveVisualizerProps {
    accentColor?: string;
    secondaryColor?: string | null;
    className?: string;
}

/**
 * Placeholder kept intentionally for future immersive background experiments.
 * Currently disabled by design.
 */
export const ImmersiveVisualizer: React.FC<ImmersiveVisualizerProps> = () => null;
