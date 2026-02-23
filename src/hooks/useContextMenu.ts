import { useState, useCallback, useEffect } from 'react';

export interface ContextMenuPosition {
    x: number;
    y: number;
}

export const useContextMenu = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [position, setPosition] = useState<ContextMenuPosition>({ x: 0, y: 0 });
    const [contextData, setContextData] = useState<any>(null);

    const openContextMenu = useCallback((e: React.MouseEvent, data?: any) => {
        e.preventDefault();
        setPosition({ x: e.clientX, y: e.clientY });
        setContextData(data);
        setIsOpen(true);
    }, []);

    const closeContextMenu = useCallback(() => {
        setIsOpen(false);
    }, []);

    useEffect(() => {
        if (isOpen) {
            const handleGlobalClick = () => closeContextMenu();
            window.addEventListener('click', handleGlobalClick);
            return () => window.removeEventListener('click', handleGlobalClick);
        }
    }, [isOpen, closeContextMenu]);

    return { isOpen, position, contextData, openContextMenu, closeContextMenu };
};
