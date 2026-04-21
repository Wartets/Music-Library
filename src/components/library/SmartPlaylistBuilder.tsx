import React, { useState } from 'react';
import { SmartRule, SmartPlaylistDefinition, Operator, LogicCondition } from '../../utils/smartPlaylistEvaluator';
import { persistenceService } from '../../services/persistence';
import { Plus, Trash2 } from 'lucide-react';

interface SmartPlaylistBuilderProps {
    onSave?: (playlist: SmartPlaylistDefinition) => void;
    onCancel?: () => void;
}

const FIELD_OPTIONS = [
    { value: 'metadata.title', label: 'Title' },
    { value: 'metadata.artists.0', label: 'Artist' },
    { value: 'metadata.album', label: 'Album' },
    { value: 'metadata.genre', label: 'Genre' },
    { value: 'metadata.year', label: 'Year' },
    { value: 'audio_specs.is_lossless', label: 'Is Lossless' },
    { value: 'audio_specs.bitrate', label: 'Bitrate' }
];

const OPERATOR_OPTIONS = [
    { value: 'equals', label: 'Equals' },
    { value: 'contains', label: 'Contains' },
    { value: 'startsWith', label: 'Starts With' },
    { value: 'endsWith', label: 'Ends With' },
    { value: 'greaterThan', label: 'Greater Than' },
    { value: 'lessThan', label: 'Less Than' }
];

export const SmartPlaylistBuilder: React.FC<SmartPlaylistBuilderProps> = ({ onSave, onCancel }) => {
    const [name, setName] = useState('New Smart Playlist');
    const [condition, setCondition] = useState<LogicCondition>('AND');
    const [rules, setRules] = useState<SmartRule[]>([
        { field: 'metadata.year', operator: 'greaterThan', value: '2020' }
    ]);

    const handleAddRule = () => {
        setRules([...rules, { field: 'metadata.genre', operator: 'equals', value: 'Rock' }]);
    };

    const handleRemoveRule = (index: number) => {
        setRules(rules.filter((_, i) => i !== index));
    };

    const handleChangeRule = (index: number, changes: Partial<SmartRule>) => {
        const newRules = [...rules];
        newRules[index] = { ...newRules[index], ...changes };
        setRules(newRules);
    };

    const handleSave = () => {
        const def: SmartPlaylistDefinition = {
            id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(),
            name,
            group: {
                condition,
                rules
            }
        };

        persistenceService.saveSmartPlaylist(def);
        if (onSave) onSave(def);
    };

    return (
        <div className="w-full max-w-full sm:max-w-lg bg-[#1a1a1a] text-white rounded-xl sm:rounded-2xl p-4 sm:p-6 overflow-y-auto custom-scrollbar">
            <h2 className="text-xl sm:text-2xl font-black mb-4 sm:mb-6 mt-0">Create Smart Playlist</h2>

            <div className="mb-4 sm:mb-5">
                <label className="block text-[10px] sm:text-xs font-black uppercase tracking-widest text-gray-400 mb-2">
                    Playlist Name
                </label>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-base text-white placeholder:text-gray-500 outline-none focus:border-dominant min-h-12"
                    placeholder="Playlist Name"
                />
            </div>

            <div className="mb-4 sm:mb-5 flex flex-wrap items-center gap-2 sm:gap-3">
                <span className="text-xs sm:text-sm text-gray-400 font-bold">Match</span>
                <select 
                    value={condition} 
                    onChange={(e) => setCondition(e.target.value as LogicCondition)}
                    className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-dominant min-h-11"
                >
                    <option value="AND">ALL</option>
                    <option value="OR">ANY</option>
                </select>
                <span className="text-xs sm:text-sm text-gray-400 font-bold">of the following rules:</span>
            </div>

            <div className="flex flex-col gap-3 mb-5 sm:mb-6 bg-white/5 rounded-xl border border-white/5 p-3 sm:p-4">
                {rules.map((rule, idx) => (
                    <div key={idx} className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-stretch sm:items-center">
                        <select
                            value={rule.field}
                            onChange={(e) => handleChangeRule(idx, { field: e.target.value })}
                            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs sm:text-sm text-white outline-none focus:border-dominant min-h-11"
                        >
                            {FIELD_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>

                        <select
                            value={rule.operator}
                            onChange={(e) => handleChangeRule(idx, { operator: e.target.value as Operator })}
                            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs sm:text-sm text-white outline-none focus:border-dominant min-h-11"
                        >
                            {OPERATOR_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>

                        <input
                            type="text"
                            value={rule.value as string}
                            onChange={(e) => handleChangeRule(idx, { value: e.target.value })}
                            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs sm:text-sm text-white placeholder:text-gray-500 outline-none focus:border-dominant min-h-11"
                            placeholder="Value"
                        />

                        <button
                            onClick={() => handleRemoveRule(idx)}
                            className="p-2.5 sm:p-2 min-h-11 min-w-11 flex items-center justify-center text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
                            aria-label="Remove rule"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                ))}

                <button
                    onClick={handleAddRule}
                    className="w-full py-2.5 min-h-11 flex items-center justify-center gap-2 text-xs sm:text-sm font-bold text-gray-400 hover:text-white border border-dashed border-white/20 hover:border-dominant rounded-xl transition-colors"
                >
                    <Plus size={16} /> Add Rule
                </button>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
                <button 
                    onClick={onCancel} 
                    className="px-5 py-3 min-h-12 rounded-xl text-xs sm:text-sm font-black uppercase tracking-widest text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                    Cancel
                </button>
                <button 
                    onClick={handleSave} 
                    className="px-5 py-3 min-h-12 rounded-xl text-xs sm:text-sm font-black uppercase tracking-widest bg-green-500 text-black hover:bg-green-400 transition-colors"
                >
                    Save Playlist
                </button>
            </div>
        </div>
    );
};