import React, { useState, useRef } from 'react';
import { SmartRule, SmartPlaylistDefinition, Operator, LogicCondition, RuleRangeValue } from '../../utils/smartPlaylistEvaluator';
import { persistenceService } from '../../services/persistence';
import { Plus, Trash2 } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface SmartPlaylistBuilderProps {
    onSave?: (playlist: SmartPlaylistDefinition) => void;
    onCancel?: () => void;
}

type FieldDataType = 'text' | 'number' | 'boolean' | 'duration';

interface FieldOption {
    value: string;
    label: string;
    dataType: FieldDataType;
}

const FIELD_OPTIONS = [
    { value: 'metadata.title', label: 'Title', dataType: 'text' },
    { value: 'metadata.artists.0', label: 'Artist', dataType: 'text' },
    { value: 'metadata.album', label: 'Album', dataType: 'text' },
    { value: 'metadata.genre', label: 'Genre', dataType: 'text' },
    { value: 'metadata.tags', label: 'Custom Tags', dataType: 'text' },
    { value: 'metadata.year', label: 'Year', dataType: 'number' },
    { value: 'metadata.bpm', label: 'BPM', dataType: 'number' },
    { value: 'audio_specs.codec', label: 'Codec', dataType: 'text' },
    { value: 'audio_specs.bitrate', label: 'Bitrate (kbps)', dataType: 'number' },
    { value: 'audio_specs.duration', label: 'Duration', dataType: 'duration' },
    { value: 'audio_specs.is_lossless', label: 'Is Lossless', dataType: 'boolean' }
] as const satisfies readonly FieldOption[];

const TEXT_OPERATORS: ReadonlyArray<{ value: Operator; label: string }> = [
    { value: 'equals', label: 'Equals' },
    { value: 'contains', label: 'Contains' },
    { value: 'startsWith', label: 'Starts With' },
    { value: 'endsWith', label: 'Ends With' }
];

const NUMBER_OPERATORS: ReadonlyArray<{ value: Operator; label: string }> = [
    { value: 'equals', label: 'Equals' },
    { value: 'greaterThan', label: 'Greater Than' },
    { value: 'lessThan', label: 'Less Than' },
    { value: 'between', label: 'Between' }
];

const BOOLEAN_OPERATORS: ReadonlyArray<{ value: Operator; label: string }> = [
    { value: 'equals', label: 'Equals' }
];

const getFieldOption = (field: string): FieldOption => {
    return FIELD_OPTIONS.find(option => option.value === field) || FIELD_OPTIONS[0];
};

const getOperatorOptions = (dataType: FieldDataType): ReadonlyArray<{ value: Operator; label: string }> => {
    if (dataType === 'boolean') return BOOLEAN_OPERATORS;
    if (dataType === 'number' || dataType === 'duration') return NUMBER_OPERATORS;
    return TEXT_OPERATORS;
};

const createDefaultRule = (field: string = 'metadata.genre'): SmartRule => {
    const fieldOption = getFieldOption(field);

    if (fieldOption.dataType === 'boolean') {
        return { field, operator: 'equals', value: 'true' };
    }

    if (fieldOption.dataType === 'number') {
        return { field, operator: 'greaterThan', value: '0' };
    }

    if (fieldOption.dataType === 'duration') {
        return { field, operator: 'between', value: { min: '0:30', max: '5:00' } };
    }

    return { field, operator: 'contains', value: '' };
};

const isRangeValue = (value: SmartRule['value']): value is RuleRangeValue => {
    return typeof value === 'object' && value !== null && 'min' in value && 'max' in value;
};

export const SmartPlaylistBuilder: React.FC<SmartPlaylistBuilderProps> = ({ onSave, onCancel }) => {
    const [name, setName] = useState('New Smart Playlist');
    const [condition, setCondition] = useState<LogicCondition>('AND');
    const [rules, setRules] = useState<SmartRule[]>([createDefaultRule('metadata.year')]);
    const titleInputRef = useRef<HTMLInputElement>(null);
    const { containerRef, handleKeyDown } = useFocusTrap<HTMLDivElement>({
        active: true,
        onEscape: onCancel,
        initialFocusRef: titleInputRef,
    });

    const handleAddRule = () => {
        setRules([...rules, createDefaultRule()]);
    };

    const handleRemoveRule = (index: number) => {
        setRules(rules.filter((_, i) => i !== index));
    };

    const handleChangeRule = (index: number, changes: Partial<SmartRule>) => {
        const newRules = [...rules];
        newRules[index] = { ...newRules[index], ...changes };
        setRules(newRules);
    };

    const handleFieldChange = (index: number, field: string) => {
        const baseRule = createDefaultRule(field);
        const currentRule = rules[index];
        const newRules = [...rules];

        newRules[index] = {
            ...baseRule,
            value: currentRule?.value ?? baseRule.value
        };

        const operatorOptions = getOperatorOptions(getFieldOption(field).dataType).map(option => option.value);
        if (!operatorOptions.includes(currentRule.operator)) {
            newRules[index].operator = baseRule.operator;
            newRules[index].value = baseRule.value;
        }

        setRules(newRules);
    };

    const handleOperatorChange = (index: number, operator: Operator) => {
        const currentRule = rules[index];
        const fieldOption = getFieldOption(currentRule.field);

        if (operator === 'between') {
            const existingRange = isRangeValue(currentRule.value)
                ? currentRule.value
                : {
                    min: fieldOption.dataType === 'duration' ? '0:30' : '0',
                    max: fieldOption.dataType === 'duration' ? '5:00' : '120'
                };

            handleChangeRule(index, { operator, value: existingRange });
            return;
        }

        if (fieldOption.dataType === 'boolean') {
            handleChangeRule(index, { operator, value: String(currentRule.value ?? 'true') === 'true' ? 'true' : 'false' });
            return;
        }

        handleChangeRule(index, {
            operator,
            value: isRangeValue(currentRule.value) ? String(currentRule.value.min ?? '') : String(currentRule.value ?? '')
        });
    };

    const handleRangeChange = (index: number, part: 'min' | 'max', value: string) => {
        const currentRule = rules[index];
        const currentRange = isRangeValue(currentRule.value) ? currentRule.value : { min: '', max: '' };
        handleChangeRule(index, {
            value: {
                ...currentRange,
                [part]: value
            }
        });
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
        <div
            ref={containerRef}
            className="w-full max-w-full sm:max-w-lg bg-[#1a1a1a] text-white rounded-xl sm:rounded-2xl p-4 sm:p-6 overflow-y-auto custom-scrollbar"
            role="dialog"
            aria-modal="true"
            aria-labelledby="smart-playlist-builder-title"
            tabIndex={-1}
            onKeyDown={handleKeyDown}
        >
            <h2 id="smart-playlist-builder-title" className="text-xl sm:text-2xl font-black mb-4 sm:mb-6 mt-0">Create Smart Playlist</h2>

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
                        {(() => {
                            const fieldOption = getFieldOption(rule.field);
                            const operatorOptions = getOperatorOptions(fieldOption.dataType);
                            const isRangeOperator = rule.operator === 'between';
                            const currentRange = isRangeValue(rule.value) ? rule.value : { min: '', max: '' };
                            const inputType = fieldOption.dataType === 'number' ? 'number' : 'text';
                            const singleValue = isRangeValue(rule.value) ? String(rule.value.min ?? '') : String(rule.value ?? '');

                            return (
                                <>
                        <select
                            value={rule.field}
                            onChange={(e) => handleFieldChange(idx, e.target.value)}
                            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs sm:text-sm text-white outline-none focus:border-dominant min-h-11"
                        >
                            {FIELD_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>

                        <select
                            value={rule.operator}
                            onChange={(e) => handleOperatorChange(idx, e.target.value as Operator)}
                            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs sm:text-sm text-white outline-none focus:border-dominant min-h-11"
                        >
                            {operatorOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>

                        {fieldOption.dataType === 'boolean' ? (
                            <select
                                value={String(rule.value ?? 'true') === 'true' ? 'true' : 'false'}
                                onChange={(e) => handleChangeRule(idx, { value: e.target.value })}
                                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs sm:text-sm text-white outline-none focus:border-dominant min-h-11"
                            >
                                <option value="true">True</option>
                                <option value="false">False</option>
                            </select>
                        ) : isRangeOperator ? (
                            <div className="flex-1 grid grid-cols-2 gap-2">
                                <input
                                    type={inputType}
                                    value={String(currentRange.min ?? '')}
                                    onChange={(e) => handleRangeChange(idx, 'min', e.target.value)}
                                    className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs sm:text-sm text-white placeholder:text-gray-500 outline-none focus:border-dominant min-h-11"
                                    placeholder={fieldOption.dataType === 'duration' ? 'Min (m:ss)' : 'Min'}
                                />
                                <input
                                    type={inputType}
                                    value={String(currentRange.max ?? '')}
                                    onChange={(e) => handleRangeChange(idx, 'max', e.target.value)}
                                    className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs sm:text-sm text-white placeholder:text-gray-500 outline-none focus:border-dominant min-h-11"
                                    placeholder={fieldOption.dataType === 'duration' ? 'Max (m:ss)' : 'Max'}
                                />
                            </div>
                        ) : (
                            <input
                                type={inputType}
                                value={singleValue}
                                onChange={(e) => handleChangeRule(idx, { value: e.target.value })}
                                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs sm:text-sm text-white placeholder:text-gray-500 outline-none focus:border-dominant min-h-11"
                                placeholder={fieldOption.dataType === 'duration' ? 'Duration (m:ss)' : 'Value'}
                            />
                        )}

                        <button
                            onClick={() => handleRemoveRule(idx)}
                            className="p-2.5 sm:p-2 min-h-11 min-w-11 flex items-center justify-center text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
                            aria-label="Remove rule"
                        >
                            <Trash2 size={16} />
                        </button>
                                </>
                            );
                        })()}
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