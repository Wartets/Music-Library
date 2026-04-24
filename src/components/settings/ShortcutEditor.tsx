import React, { useCallback, useEffect, useState } from 'react';
import { DEFAULT_KEYBOARD_SHORTCUTS, persistenceService } from '../../services/persistence';
import type { KeyboardShortcuts, ShortcutConfig } from '../../services/persistence';

type ActionKey = keyof KeyboardShortcuts;

const actionDefinitions: Record<ActionKey, { label: string; description: string }> = {
    togglePlay: { label: 'Play/Pause', description: 'Toggle playback' },
    seekForward: { label: 'Seek Forward', description: 'Seek forward by 5 seconds' },
    seekBackward: { label: 'Seek Backward', description: 'Seek backward by 5 seconds' },
    playNext: { label: 'Next Track', description: 'Skip to next track' },
    playPrevious: { label: 'Previous Track', description: 'Go to previous track' },
    focusSearch: { label: 'Focus Search', description: 'Focus the search input' }
};

const formatShortcut = (shortcut: ShortcutConfig): string => {
    const parts: string[] = [];
    if (shortcut.ctrl) parts.push('Ctrl');
    if (shortcut.meta) parts.push('Meta');
    if (shortcut.alt) parts.push('Alt');
    if (shortcut.shift) parts.push('Shift');

    let key = shortcut.key;
    if (key === ' ') key = 'Space';
    else if (key === 'ArrowRight') key = 'Right';
    else if (key === 'ArrowLeft') key = 'Left';
    else if (key.length === 1) key = key.toUpperCase();

    parts.push(key);
    return parts.join('+');
};

export const ShortcutEditor: React.FC = () => {
    const [shortcuts, setShortcuts] = useState<KeyboardShortcuts>(() => {
        const prefs = persistenceService.getPreferences();
        return prefs.keyboardShortcuts || DEFAULT_KEYBOARD_SHORTCUTS;
    });
    const [recordingAction, setRecordingAction] = useState<ActionKey | null>(null);

    useEffect(() => {
        const handleStorage = () => {
            const prefs = persistenceService.getPreferences();
            setShortcuts(prefs.keyboardShortcuts || DEFAULT_KEYBOARD_SHORTCUTS);
        };

        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    const captureShortcut = useCallback((event: KeyboardEvent) => {
        if (!recordingAction) return;
        if (['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        const nextShortcut: ShortcutConfig = {
            key: event.key,
            ctrl: event.ctrlKey,
            meta: event.metaKey,
            shift: event.shiftKey,
            alt: event.altKey
        };

        setShortcuts(previous => {
            const updated = { ...previous, [recordingAction]: nextShortcut };
            persistenceService.updatePreferences({ keyboardShortcuts: updated });
            return updated;
        });
        setRecordingAction(null);
    }, [recordingAction]);

    useEffect(() => {
        if (!recordingAction) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            captureShortcut(event);
        };

        window.addEventListener('keydown', handleKeyDown, { capture: true });
        return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
    }, [captureShortcut, recordingAction]);

    const resetToDefault = () => {
        setShortcuts(DEFAULT_KEYBOARD_SHORTCUTS);
        persistenceService.updatePreferences({ keyboardShortcuts: DEFAULT_KEYBOARD_SHORTCUTS });
    };

    return (
        <div className="space-y-3">
            {(Object.keys(actionDefinitions) as ActionKey[]).map(action => (
                <div key={action} className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-white/5">
                    <div>
                        <div className="font-bold text-sm text-white">{actionDefinitions[action].label}</div>
                        <div className="text-[10px] text-gray-500">{actionDefinitions[action].description}</div>
                    </div>
                    <button
                        onClick={() => setRecordingAction(action)}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${recordingAction === action ? 'bg-red-500/20 text-red-500 border border-red-500/50' : 'bg-white/5 text-gray-300 hover:bg-white/10'}`}
                    >
                        {recordingAction === action ? 'Press keys...' : formatShortcut(shortcuts[action])}
                    </button>
                </div>
            ))}
            <div className="flex justify-end">
                <button onClick={resetToDefault} className="text-xs text-gray-500 hover:text-white uppercase tracking-widest">
                    Reset to defaults
                </button>
            </div>
        </div>
    );
};
