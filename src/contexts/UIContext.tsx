import React, { createContext, useContext, useState, ReactNode } from 'react';
import { ContextMenuItem } from '../components/shared/ContextMenu';

interface UIContextProps {
    showContextMenu: (x: number, y: number, items: ContextMenuItem[]) => void;
    closeContextMenu: () => void;
    contextMenu: { x: number, y: number, items: ContextMenuItem[] } | null;
    showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
    toast: { message: string, type: 'success' | 'error' | 'info' } | null;
}

const UIContext = createContext<UIContextProps | undefined>(undefined);

export const UIProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, items: ContextMenuItem[] } | null>(null);
    const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);

    const showContextMenu = (x: number, y: number, items: ContextMenuItem[]) => {
        setContextMenu({ x, y, items });
    };

    const closeContextMenu = () => {
        setContextMenu(null);
    };

    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    return (
        <UIContext.Provider value={{ showContextMenu, closeContextMenu, contextMenu, showToast, toast }}>
            {children}
            {toast && (
                <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-full shadow-2xl backdrop-blur-xl border border-white/10 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300 ${toast.type === 'success' ? 'bg-green-500/20 text-green-400' :
                        toast.type === 'error' ? 'bg-red-500/20 text-red-400' :
                            'bg-dominant/20 text-dominant-light'
                    }`}>
                    <span className="text-sm font-bold tracking-tight">{toast.message}</span>
                </div>
            )}
        </UIContext.Provider>
    );
};

export const useUI = () => {
    const context = useContext(UIContext);
    if (!context) throw new Error('useUI must be used within UIProvider');
    return context;
};
