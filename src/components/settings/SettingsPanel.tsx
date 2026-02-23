import React, { useState, useEffect } from 'react';
import { persistenceService } from '../../services/persistence';

export const SettingsPanel: React.FC = () => {
    const [theme, setTheme] = useState<'dark' | 'light' | 'system'>('system');
    const [visualizerFps, setVisualizerFps] = useState<'high' | 'low'>('high');

    useEffect(() => {
        // Assume persistenceService has these or we provide sane defaults
        const prefs = (persistenceService as any).getPreferences?.() || {};
        if (prefs.theme) setTheme(prefs.theme);
        if (prefs.visualizerFps) setVisualizerFps(prefs.visualizerFps);
    }, []);

    const handleThemeChange = (newTheme: 'dark' | 'light' | 'system') => {
        setTheme(newTheme);
        if ((persistenceService as any).updatePreferences) {
            (persistenceService as any).updatePreferences({ theme: newTheme });
        }
    };

    const handleFpsChange = (newFps: 'high' | 'low') => {
        setVisualizerFps(newFps);
        if ((persistenceService as any).updatePreferences) {
            (persistenceService as any).updatePreferences({ visualizerFps: newFps });
        }
    };

    const handleResetDb = () => {
        if (window.confirm("Are you sure you want to completely reset the application state? This will clear all local data including history and playlists.")) {
            localStorage.clear();
            window.location.reload();
        }
    };

    const sectionStyle = "bg-white/5 p-6 rounded-xl border border-white/10 mb-6";
    const labelStyle = "flex justify-between items-center mb-4";

    return (
        <div className="p-8 max-w-3xl mx-auto text-white">
            <h1 className="text-3xl font-bold mb-8 tracking-tight">Settings</h1>

            <div className={sectionStyle}>
                <h2 className="text-xl font-semibold mb-6 text-dominant">Appearance</h2>

                <div className={labelStyle}>
                    <div>
                        <div className="font-medium">Theme Mode</div>
                        <div className="text-sm text-gray-400">Override system dark/light mode preference.</div>
                    </div>
                    <select
                        value={theme}
                        onChange={(e) => handleThemeChange(e.target.value as any)}
                        className="bg-black/40 border border-white/10 rounded px-3 py-2 outline-none focus:border-dominant"
                    >
                        <option value="system">System Default</option>
                        <option value="dark">Dark Mode</option>
                        <option value="light">Light Mode</option>
                    </select>
                </div>
            </div>

            <div className={sectionStyle}>
                <h2 className="text-xl font-semibold mb-6 text-dominant">Performance</h2>

                <div className={labelStyle}>
                    <div>
                        <div className="font-medium">Visualizer FPS Limit</div>
                        <div className="text-sm text-gray-400">Lower FPS can improve performance on older devices.</div>
                    </div>
                    <select
                        value={visualizerFps}
                        onChange={(e) => handleFpsChange(e.target.value as any)}
                        className="bg-black/40 border border-white/10 rounded px-3 py-2 outline-none focus:border-dominant"
                    >
                        <option value="high">High (60 FPS)</option>
                        <option value="low">Low (30 FPS)</option>
                    </select>
                </div>
            </div>

            <div className={sectionStyle}>
                <h2 className="text-xl font-semibold mb-6 text-red-500">Danger Zone</h2>

                <div className={labelStyle}>
                    <div>
                        <div className="font-medium">Reset Database</div>
                        <div className="text-sm text-gray-400">Clears all play history, custom playlists, and cached settings.</div>
                    </div>
                    <button
                        onClick={handleResetDb}
                        className="bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 px-4 py-2 rounded transition-colors font-medium cursor-pointer"
                    >
                        Reset Application State
                    </button>
                </div>
            </div>
        </div>
    );
};
