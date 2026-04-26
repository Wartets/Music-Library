import React from 'react';
import { BarChart3 } from 'lucide-react';
import { useSettingsView } from '../SettingsViewContext';

export const StatsSettingsTab: React.FC = () => {
    const { statsCards, detailedStats } = useSettingsView();

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

                <div className="mt-8 space-y-3">
                    <div className="flex justify-between items-center"><span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Total Playtime</span><span className="text-sm font-black text-dominant">{detailedStats.totalPlaytimeMinutes} min</span></div>
                    <div className="flex justify-between items-center"><span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Avg. Quality</span><span className="text-sm font-black text-white">{detailedStats.averageBitrate} kbps</span></div>
                    <div className="flex justify-between items-center"><span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Avg. Duration</span><span className="text-sm font-black text-white">{detailedStats.averageDurationMinutes.toFixed(1)} min</span></div>
                    <div className="flex justify-between items-center"><span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Library Size</span><span className="text-sm font-black text-white">{detailedStats.totalSizeGb.toFixed(2)} GB</span></div>
                    <div className="flex justify-between items-center"><span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Albums</span><span className="text-sm font-black text-white">{detailedStats.totalAlbums}</span></div>
                    <div className="flex justify-between items-center"><span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Artists</span><span className="text-sm font-black text-white">{detailedStats.totalArtists}</span></div>
                    <div className="flex justify-between items-center"><span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Genres</span><span className="text-sm font-black text-white">{detailedStats.totalGenres}</span></div>
                    <div className="flex justify-between items-center"><span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Folders</span><span className="text-sm font-black text-white">{detailedStats.totalFolders}</span></div>
                    <div className="flex justify-between items-center"><span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Versions</span><span className="text-sm font-black text-white">{detailedStats.totalVersions}</span></div>
                    <div className="flex justify-between items-center"><span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Singles</span><span className="text-sm font-black text-white">{detailedStats.singlesCount}</span></div>
                    <div className="flex justify-between items-center"><span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Top Codec</span><span className="text-sm font-black text-white">{detailedStats.topCodec}</span></div>
                    <div className="flex justify-between items-center"><span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Avg. Sample Rate</span><span className="text-sm font-black text-white">{detailedStats.averageSampleRateKhz.toFixed(1)} kHz</span></div>
                    <div className="flex justify-between items-center"><span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Year Range</span><span className="text-sm font-black text-white">{detailedStats.oldestYear && detailedStats.newestYear ? `${detailedStats.oldestYear}-${detailedStats.newestYear}` : '-'}</span></div>
                    <div className="flex justify-between items-center"><span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Lossless</span><span className="text-sm font-black text-white">{detailedStats.losslessCount} ({detailedStats.totalTracks > 0 ? Math.round((detailedStats.losslessCount / detailedStats.totalTracks) * 100) : 0}%)</span></div>
                    <div className="flex justify-between items-center"><span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Rated Tracks</span><span className="text-sm font-black text-white">{detailedStats.ratedTracksCount} {detailedStats.ratedTracksCount > 0 ? `(${detailedStats.averageRating.toFixed(1)}★)` : ''}</span></div>
                    <div className="flex justify-between items-center"><span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">History Entries</span><span className="text-sm font-black text-white">{detailedStats.historyCount}</span></div>
                    <div className="flex justify-between items-center"><span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Favorites</span><span className="text-sm font-black text-white">{detailedStats.favoritesCount}</span></div>
                </div>

                <div className="mt-8 pt-6 border-t border-white/5">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-600 mb-4">Genre Mix</h3>
                    <div className="space-y-3">
                        {detailedStats.genreDistribution.map(([genre, count]) => (
                            <div key={genre} className="space-y-1.5">
                                <div className="flex justify-between text-[10px] font-bold">
                                    <span className="text-gray-400">{genre}</span>
                                    <span className="text-gray-600">{count}</span>
                                </div>
                                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-dominant/40 transition-all duration-700"
                                        style={{ width: `${(count / detailedStats.maxGenreCount) * 100}%` }}
                                    ></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
