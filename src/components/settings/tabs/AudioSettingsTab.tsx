import React from 'react';
import { Sliders } from 'lucide-react';
import { usePlayer } from '../../../contexts/PlayerContext';
import { useSettingsView } from '../SettingsViewContext';

export const AudioSettingsTab: React.FC = () => {
    const { state: playerState } = usePlayer();
    const {
        commitEqBandValue,
        crossfadeDuration,
        crossfadeEnabled,
        eqBands,
        eqEnabled,
        eqZeroSnapThreshold,
        freqs,
        handleBandChange,
        normalizationEnabled,
        normalizationStrength,
        presets,
        setCrossfadeDuration,
        setCrossfadeEnabled,
        setEqBands,
        setEqEnabled,
        setNormalizationEnabled,
        setNormalizationStrength,
        setShuffleModePreference
    } = useSettingsView();

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white/5 border border-white/10 rounded-3xl p-8 shadow-2xl">
                <div className="flex flex-col lg:flex-row gap-12">
                    <div className="flex-1">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h2 className="text-2xl font-black text-white flex items-center gap-3">
                                    <Sliders className="text-dominant" size={24} />
                                    Parametric EQ
                                </h2>
                                <p className="text-sm text-gray-500">Customize the acoustic signature of your output.</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <select
                                    className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-black uppercase outline-none focus:border-dominant"
                                    onChange={(event) => setEqBands(presets[event.target.value] || eqBands)}
                                    value={Object.entries(presets).find(([, value]) => JSON.stringify(value) === JSON.stringify(eqBands))?.[0] || 'Custom'}
                                >
                                    <option value="Custom" disabled>Custom</option>
                                    {Object.keys(presets).map(preset => (
                                        <option key={preset} value={preset}>{preset}</option>
                                    ))}
                                </select>
                                <button
                                    onClick={() => setEqEnabled(previous => !previous)}
                                    className={`px-5 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all ${eqEnabled ? 'bg-dominant text-on-dominant' : 'bg-white/5 text-gray-500'}`}
                                >
                                    {eqEnabled ? 'ACTIVE' : 'BYPASS'}
                                </button>
                            </div>
                        </div>

                        <div className={`flex justify-between h-48 items-end gap-3 px-2 ${eqEnabled ? '' : 'opacity-20 grayscale'}`}>
                            {eqBands.map((value, index) => (
                                <div key={freqs[index]} className="flex-1 flex flex-col items-center h-full group">
                                    <div className="relative flex-1 w-full flex items-center justify-center py-2 group cursor-pointer">
                                        <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-1 bg-white/5 rounded-full group-hover:bg-white/10 transition-colors" />
                                        <div className={`absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 w-4 h-[1px] bg-white/10 transition-all duration-150 ease-out ${Math.abs(value) <= eqZeroSnapThreshold ? 'bg-dominant/70 shadow-[0_0_10px_rgba(var(--color-dominant-rgb),0.35)]' : ''}`} />
                                        <div
                                            className={`absolute left-1/2 top-1/2 h-5 w-5 rounded-full border pointer-events-none transition-all duration-150 ease-out ${Math.abs(value) <= eqZeroSnapThreshold ? 'opacity-100 scale-100 border-dominant/60 bg-dominant/15 shadow-[0_0_26px_rgba(var(--color-dominant-rgb),0.38)]' : 'opacity-0 scale-50 border-transparent bg-transparent'}`}
                                            style={{
                                                transform: 'translate(-50%, -50%)'
                                            }}
                                        />
                                        <input
                                            type="range"
                                            min="-12"
                                            max="12"
                                            step="0.1"
                                            value={value}
                                            onChange={(event) => handleBandChange(index, parseFloat(event.target.value))}
                                            onMouseUp={(event) => commitEqBandValue(index, parseFloat((event.currentTarget as HTMLInputElement).value))}
                                            onTouchEnd={(event) => commitEqBandValue(index, parseFloat((event.currentTarget as HTMLInputElement).value))}
                                            onPointerUp={(event) => commitEqBandValue(index, parseFloat((event.currentTarget as HTMLInputElement).value))}
                                            className="absolute cursor-pointer z-20 vertical-range"
                                            style={{
                                                width: 72,
                                                height: 72,
                                                left: '50%',
                                                top: '50%',
                                                transform: 'translate(-50%, -50%) rotate(-90deg)',
                                                opacity: 0,
                                                touchAction: 'none'
                                            }}
                                        />
                                        <div
                                            className="absolute w-1.5 bg-dominant rounded-full shadow-[0_0_15px_rgba(var(--color-dominant-rgb),0.5)] transition-all duration-150 ease-out"
                                            style={{
                                                height: `${(Math.abs(value) / 24) * 100}%`,
                                                bottom: value >= 0 ? '50%' : `calc(50% + ${(value / 24) * 100}%)`,
                                                top: value < 0 ? '50%' : 'auto',
                                                opacity: Math.abs(value) <= eqZeroSnapThreshold ? 0.9 : 1
                                            }}
                                        />
                                        <div
                                            className="absolute w-3.5 h-3.5 bg-white rounded-full border-2 border-dominant shadow-xl pointer-events-none z-10 transition-all duration-150 ease-out"
                                            style={{
                                                bottom: `calc(50% + ${(value / 24) * 100}%)`,
                                                transform: `translateY(50%) scale(${Math.abs(value) <= eqZeroSnapThreshold ? 1.22 : 1})`,
                                                boxShadow: Math.abs(value) <= eqZeroSnapThreshold
                                                    ? '0 0 0 4px rgba(var(--color-dominant-rgb), 0.18), 0 0 22px rgba(var(--color-dominant-rgb), 0.45)'
                                                    : '0 10px 18px rgba(0,0,0,0.35)'
                                            }}
                                        />
                                    </div>
                                    <span className="text-[10px] font-black text-gray-500 mt-4 group-hover:text-dominant">{freqs[index]}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="w-[1px] bg-white/5 self-stretch hidden lg:block" />

                    <div className="w-full lg:w-72 space-y-10">
                        <div>
                            <h3 className="text-xl font-black text-white mb-2">Crossfade</h3>
                            <p className="text-sm text-gray-500 mb-6">Gapless track transitions.</p>
                            <div className="flex items-center justify-between mb-6">
                                <span className="text-xs font-bold text-gray-300">Enabled</span>
                                <button
                                    onClick={() => setCrossfadeEnabled(previous => !previous)}
                                    className={`w-12 h-6 rounded-full transition-all relative ${crossfadeEnabled ? 'bg-dominant' : 'bg-white/10'}`}
                                >
                                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${crossfadeEnabled ? 'left-7' : 'left-1'}`} />
                                </button>
                            </div>
                            <div className={`space-y-4 ${crossfadeEnabled ? '' : 'opacity-20 pointer-events-none'}`}>
                                <div className="flex justify-between items-end">
                                    <span className="text-[10px] font-black text-gray-500 uppercase">Duration</span>
                                    <span className="text-lg font-black text-dominant">{crossfadeDuration}s</span>
                                </div>
                                <input
                                    type="range"
                                    min="1"
                                    max="15"
                                    step="1"
                                    value={crossfadeDuration}
                                    onChange={(event) => setCrossfadeDuration(parseInt(event.target.value, 10))}
                                    className="w-full accent-dominant h-2 sm:h-1.5 bg-white/5 rounded-full cursor-pointer"
                                />
                            </div>
                        </div>

                        <div>
                            <h3 className="text-xl font-black text-white mb-2">Volume Normalization</h3>
                            <p className="text-sm text-gray-500 mb-6">Smoothly levels loud and quiet tracks during playback.</p>
                            <div className="flex items-center justify-between mb-6">
                                <span className="text-xs font-bold text-gray-300">Enabled</span>
                                <button
                                    onClick={() => setNormalizationEnabled(previous => !previous)}
                                    className={`w-12 h-6 rounded-full transition-all relative ${normalizationEnabled ? 'bg-dominant' : 'bg-white/10'}`}
                                >
                                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${normalizationEnabled ? 'left-7' : 'left-1'}`} />
                                </button>
                            </div>
                            <div className={`space-y-4 ${normalizationEnabled ? '' : 'opacity-20 pointer-events-none'}`}>
                                <div className="flex justify-between items-end">
                                    <span className="text-[10px] font-black text-gray-500 uppercase">Strength</span>
                                    <span className="text-lg font-black text-dominant">{normalizationStrength}%</span>
                                </div>
                                <input
                                    type="range"
                                    min="5"
                                    max="100"
                                    step="1"
                                    value={normalizationStrength}
                                    onChange={(event) => setNormalizationStrength(parseInt(event.target.value, 10))}
                                    className="w-full accent-dominant h-2 sm:h-1.5 bg-white/5 rounded-full cursor-pointer"
                                />
                            </div>
                        </div>

                        <div>
                            <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4">Shuffle Intelligence</h3>
                            <div className="space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { id: 'standard', name: 'Standard' },
                                        { id: 'weighted', name: 'Weighted' },
                                        { id: 'discovery', name: 'Discovery' },
                                        { id: 'recent', name: 'Freshness' }
                                    ].map(mode => (
                                        <button
                                            key={mode.id}
                                            onClick={() => setShuffleModePreference(mode.id as typeof playerState.shuffleMode)}
                                            className={`p-3 rounded-xl border transition-all text-center ${playerState.shuffleMode === mode.id ? 'bg-dominant/20 border-dominant text-white ring-2 ring-dominant/20' : 'bg-black/20 border-white/5 text-gray-500 hover:bg-white/5'}`}
                                        >
                                            <div className="font-black text-[10px] uppercase tracking-tighter">{mode.name}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
