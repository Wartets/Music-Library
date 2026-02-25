import React, { useEffect, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';

export interface ContextMenuItem {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    danger?: boolean;
    divider?: boolean;
    disabled?: boolean;
    subItems?: ContextMenuItem[];
}

interface ContextMenuProps {
    x: number;
    y: number;
    items: ContextMenuItem[];
    onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose }) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const [activeSubMenu, setActiveSubMenu] = useState<{ items: ContextMenuItem[], y: number, x: number } | null>(null);
    const subMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
                (!subMenuRef.current || !subMenuRef.current.contains(e.target as Node))) {
                onClose();
            }
        };
        const handleScroll = () => onClose();

        window.addEventListener('mousedown', handleClickOutside);
        window.addEventListener('wheel', handleScroll);
        window.addEventListener('scroll', handleScroll);

        return () => {
            window.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('wheel', handleScroll);
            window.removeEventListener('scroll', handleScroll);
        };
    }, [onClose]);

    // Adjust position to stay within viewport
    const menuWidth = 220;
    const adjustedX = Math.min(x, window.innerWidth - menuWidth - 10);
    const adjustedY = Math.min(y, window.innerHeight - (items.length * 36 + 20));

    const handleMouseEnter = (item: ContextMenuItem, _index: number, e: React.MouseEvent) => {
        if (item.subItems) {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            setActiveSubMenu(prev => {
                if (prev?.items === item.subItems) return prev;
                return {
                    items: item.subItems!,
                    y: rect.top,
                    x: rect.right
                };
            });
        } else {
            setActiveSubMenu(null);
        }
    };

    const handleMenuMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
        const related = e.relatedTarget as Node | null;
        if (related && subMenuRef.current?.contains(related)) {
            return;
        }
        setActiveSubMenu(null);
    };

    const handleSubMenuMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
        const related = e.relatedTarget as Node | null;
        if (related && menuRef.current?.contains(related)) {
            return;
        }
        setActiveSubMenu(null);
    };

    return (
        <>
            <div
                ref={menuRef}
                className="fixed z-[100] w-56 bg-[#1a1a1a]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl py-2 overflow-y-auto custom-scrollbar"
                style={{
                    left: adjustedX,
                    top: adjustedY,
                    maxHeight: 'calc(100vh - 40px)'
                }}
                onMouseLeave={handleMenuMouseLeave}
            >
                {items.map((item, idx) => (
                    <React.Fragment key={idx}>
                        {item.divider && <div className="h-px bg-white/5 my-1.5 mx-3" />}
                        {!item.divider && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (item.subItems) return;
                                    if (!item.disabled) {
                                        item.onClick();
                                        onClose();
                                    }
                                }}
                                onMouseEnter={(e) => handleMouseEnter(item, idx, e)}
                                disabled={item.disabled}
                                className={`
                                    w-full flex items-center gap-3 px-3 py-2 text-xs font-bold transition-colors relative group
                                    ${item.danger ? 'text-red-400 hover:bg-red-500/10' : 'text-gray-300 hover:bg-white/10 hover:text-white'}
                                    ${item.disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}
                                `}
                            >
                                {item.icon && <span className={`text-gray-400 group-hover:text-white transition-colors ${item.danger ? 'group-hover:text-red-400' : ''}`}>{item.icon}</span>}
                                <span className="flex-1 text-left truncate">{item.label}</span>
                                {item.subItems && <ChevronRight size={14} className="text-gray-500 group-hover:text-white" />}
                                {activeSubMenu && items[idx].subItems === activeSubMenu.items && (
                                    <div className="absolute left-0 top-0 w-1 h-full bg-dominant"></div>
                                )}
                            </button>
                        )}
                    </React.Fragment>
                ))}
            </div>

            {activeSubMenu && (
                <div
                    ref={subMenuRef}
                    className="fixed z-[101] w-56 bg-[#1a1a1a]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl py-2 overflow-y-auto custom-scrollbar"
                    style={{
                        left: Math.min(activeSubMenu.x - 4, window.innerWidth - menuWidth - 10),
                        top: Math.min(activeSubMenu.y, window.innerHeight - (activeSubMenu.items.length * 36 + 20)),
                        maxHeight: 'calc(100vh - 40px)'
                    }}
                    onMouseLeave={handleSubMenuMouseLeave}
                >
                    {activeSubMenu.items.map((sub, sidx) => (
                        <button
                            key={sidx}
                            onClick={(e) => {
                                e.stopPropagation();
                                sub.onClick();
                                onClose();
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold text-gray-300 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                        >
                            <span className="flex-1 text-left truncate">{sub.label}</span>
                        </button>
                    ))}
                </div>
            )}
        </>
    );
};
