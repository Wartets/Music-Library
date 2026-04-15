import React from 'react';
import { Play } from 'lucide-react';
import { ArtworkImage } from '../shared/ArtworkImage';
import { useLibrary } from '../../contexts/LibraryContext';

export interface GridItem {
    id: string;
    title: string;
    subtitle: string;
    imageDetails?: any;
    icon?: React.ReactNode;
    visualToken?: {
        symbol?: React.ReactNode;
        label?: string;
        style?: React.CSSProperties;
        symbolClassName?: string;
        labelClassName?: string;
    };
    onClick: () => void;
    onContextMenu: (e: React.MouseEvent) => void;
    isTextIcon?: boolean;
}

interface CollectionGridViewProps {
    title: string;
    subtitle: string;
    items: GridItem[];
    sortOptions: { id: string; label: string; icon: React.ReactNode }[];
    currentSort: string;
    onSortChange: (sortId: string) => void;
}

export const CollectionGridView: React.FC<CollectionGridViewProps> = ({
    title,
    subtitle,
    items,
    sortOptions,
    currentSort,
    onSortChange
}) => {
    const { state: libraryState } = useLibrary(); // local require to avoid circular deps if any

    const HighlightText: React.FC<{ text: string, query: string }> = ({ text, query }) => {
        if (!query.trim()) return <>{text}</>;
        const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
        return (
            <>
                {parts.map((part, i) =>
                    part.toLowerCase() === query.toLowerCase() ? (
                        <mark key={i} className="bg-dominant/30 text-white rounded-sm px-0.5">{part}</mark>
                    ) : (
                        part
                    )
                )}
            </>
        );
    };

    return (
        <div className="h-full flex flex-col p-3 md:p-6 pt-14 md:pt-20 overflow-y-auto custom-scrollbar bg-surface-primary">
            <div className="flex flex-col md:flex-row items-start md:items-end justify-between mb-4 md:mb-10 gap-3 md:gap-4">
                <div>
                    <h1 className="text-2xl md:text-4xl font-black tracking-tighter text-white">{title}</h1>
                    <p className="text-gray-500 font-bold uppercase tracking-widest text-xs mt-1">{subtitle}</p>
                </div>
                {sortOptions.length > 0 && (
                    <div className="flex items-center gap-2 self-start md:self-auto">
                        <div className="flex bg-white/5 rounded-xl border border-white/5 p-1 overflow-x-auto no-scrollbar max-w-full">
                            {sortOptions.map(opt => (
                                <button
                                    key={opt.id}
                                    onClick={() => onSortChange(opt.id)}
                                    className={`px-3 md:px-4 py-2 flex-shrink-0 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${currentSort === opt.id ? 'bg-white/10 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}
                                >
                                    {opt.icon} {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3 md:gap-6 pb-24 md:pb-28">
                {items.map((item) => {
                    const usesVisualToken = !item.isTextIcon && !item.imageDetails && !!item.visualToken;
                    const visualToken = item.visualToken;
                    return (
                        <div
                            key={item.id}
                            className="group flex flex-col cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]"
                            onClick={item.onClick}
                            onContextMenu={item.onContextMenu}
                        >
                            <div
                                className="relative aspect-square rounded-2xl overflow-hidden shadow-2xl bg-white/5 border border-white/5 group-hover:border-white/20 transition-all flex items-center justify-center mb-3"
                                style={usesVisualToken ? visualToken?.style : undefined}
                            >
                                {item.isTextIcon ? (
                                <>
                                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    <span className="text-4xl font-black text-white/20 group-hover:text-dominant transition-colors group-hover:scale-110 duration-700 select-none">
                                        {item.imageDetails}
                                    </span>
                                </>
                            ) : item.imageDetails ? (
                                <ArtworkImage
                                    details={item.imageDetails}
                                    alt={item.title}
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                />
                            ) : usesVisualToken ? (
                                <>
                                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/25"></div>
                                    <div className="relative z-10 flex flex-col items-center justify-center px-3 text-center gap-2">
                                        <div className={visualToken?.symbolClassName || 'text-4xl font-black text-white/70 group-hover:text-white transition-colors duration-500'}>
                                            {visualToken?.symbol}
                                        </div>
                                        {visualToken?.label && (
                                            <span className={visualToken.labelClassName || 'text-[10px] font-bold uppercase tracking-[0.18em] text-white/65'}>
                                                {visualToken.label}
                                            </span>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    {item.icon || <div className="w-12 h-12 bg-white/10 rounded-full"></div>}
                                </>
                            )}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                                <Play size={32} fill="currentColor" className="text-white drop-shadow-2xl translate-y-2 group-hover:translate-y-0 transition-transform duration-500" />
                            </div>
                            </div>
                            <div className="min-w-0 pr-1 px-1">
                                <h3 className="font-bold text-sm text-white truncate group-hover:text-dominant-light transition-colors">
                                    <HighlightText text={item.title} query={libraryState.searchQuery} />
                                </h3>
                                <p className="text-[11px] text-gray-500 font-bold truncate mt-0.5 uppercase tracking-tighter">
                                    <HighlightText text={item.subtitle} query={libraryState.searchQuery} />
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
