import React from 'react';
import { BarChart3 } from 'lucide-react';
import { useSettingsView } from '../SettingsViewContext';

export const StatsSettingsTab: React.FC = () => {
    const { statsCards } = useSettingsView();

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white/5 border border-white/10 rounded-3xl p-8 shadow-2xl backdrop-blur-md">
                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
                    <div>
                        <h2 className="text-2xl font-black text-white flex items-center gap-3">
                            <BarChart3 className="text-dominant" size={24} />
                            Library Stats
                        </h2>
                        <p className="text-sm text-gray-500">A compact view of your collection health and scale.</p>
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                        Updated from the loaded library snapshot
                    </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {statsCards.map(card => (
                        <div key={card.label} className="p-5 rounded-2xl bg-black/25 border border-white/5">
                            <div className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">{card.label}</div>
                            <div className="text-2xl font-black text-white truncate">{card.value}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
