import React, { useState } from 'react';
import { SmartRule, SmartPlaylistDefinition, Operator, LogicCondition } from '../../utils/smartPlaylistEvaluator';
import { persistenceService } from '../../services/persistence';

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

        // Save to persistence
        persistenceService.saveSmartPlaylist(def);
        if (onSave) onSave(def);
    };

    const inputStyle = { padding: '6px', backgroundColor: '#333', color: '#fff', border: '1px solid #555', borderRadius: '4px' };

    return (
        <div style={{ padding: '24px', backgroundColor: '#1a1a1a', color: '#fff', borderRadius: '8px', maxWidth: '600px' }}>
            <h2 style={{ marginTop: 0 }}>Create Smart Playlist</h2>

            <div style={{ marginBottom: '20px' }}>
                <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={{ ...inputStyle, width: '100%', fontSize: '1.2rem', padding: '10px' }}
                    placeholder="Playlist Name"
                />
            </div>

            <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>Match</span>
                <select value={condition} onChange={(e) => setCondition(e.target.value as LogicCondition)} style={inputStyle}>
                    <option value="AND">ALL</option>
                    <option value="OR">ANY</option>
                </select>
                <span>of the following rules:</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px', backgroundColor: '#2a2a2a', padding: '16px', borderRadius: '6px' }}>
                {rules.map((rule, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <select
                            value={rule.field}
                            onChange={(e) => handleChangeRule(idx, { field: e.target.value })}
                            style={inputStyle}
                        >
                            {FIELD_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>

                        <select
                            value={rule.operator}
                            onChange={(e) => handleChangeRule(idx, { operator: e.target.value as Operator })}
                            style={inputStyle}
                        >
                            {OPERATOR_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>

                        <input
                            value={rule.value as string}
                            onChange={(e) => handleChangeRule(idx, { value: e.target.value })}
                            style={{ ...inputStyle, flex: 1 }}
                            placeholder="Value"
                        />

                        <button
                            onClick={() => handleRemoveRule(idx)}
                            style={{ background: 'none', border: 'none', color: '#ff4444', fontSize: '1.2rem', cursor: 'pointer' }}
                        >
                            ✕
                        </button>
                    </div>
                ))}

                <div>
                    <button
                        onClick={handleAddRule}
                        style={{ ...inputStyle, cursor: 'pointer', backgroundColor: 'transparent', border: '1px dashed #555' }}
                    >
                        + Add Rule
                    </button>
                </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button onClick={onCancel} style={{ ...inputStyle, cursor: 'pointer', backgroundColor: 'transparent' }}>
                    Cancel
                </button>
                <button onClick={handleSave} style={{ ...inputStyle, cursor: 'pointer', backgroundColor: '#1DB954', border: 'none', color: '#000', fontWeight: 'bold' }}>
                    Save Playlist
                </button>
            </div>
        </div>
    );
};
