import { TrackItem } from '../types/music';

export type Operator = 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'greaterThan' | 'lessThan';
export type LogicCondition = 'AND' | 'OR';

export interface SmartRule {
    field: string; // e.g., 'metadata.year', 'audio_specs.is_lossless'
    operator: Operator;
    value: string | number | boolean;
}

export interface RuleGroup {
    condition: LogicCondition;
    rules: (SmartRule | RuleGroup)[];
}

export interface SmartPlaylistDefinition {
    id: string;
    name: string;
    group: RuleGroup;
}

const getFieldValue = (track: TrackItem, path: string): any => {
    let value = path.split('.').reduce((acc, part) => acc && acc[part], track as any);

    // If it's an array (like genre or artists), we usually just want to match against the first one
    // or join them for a 'contains' check. We'll join them.
    if (Array.isArray(value)) {
        return value.join(', ');
    }
    return value;
};

const evaluateRule = (track: TrackItem, rule: SmartRule): boolean => {
    const fieldValue = getFieldValue(track, rule.field);

    let fw = fieldValue;
    let rv = rule.value;

    // Type coercion for loose comparisons
    if (typeof fw === 'string' && typeof rv === 'string') {
        fw = String(fw).toLowerCase();
        rv = String(rv).toLowerCase();
    }

    // Handle boolean check if value is string 'true'/'false'
    if (typeof fw === 'boolean' && typeof rv === 'string') {
        rv = rv === 'true';
    }

    switch (rule.operator) {
        case 'equals': return fw == rv;
        case 'contains': return typeof fw === 'string' && fw.includes(String(rv));
        case 'startsWith': return typeof fw === 'string' && fw.startsWith(String(rv));
        case 'endsWith': return typeof fw === 'string' && fw.endsWith(String(rv));
        case 'greaterThan': return Number(fw) > Number(rv);
        case 'lessThan': return Number(fw) < Number(rv);
        default: return false;
    }
};

export const evaluateRuleGroup = (track: TrackItem, group: RuleGroup): boolean => {
    if (group.rules.length === 0) return true;

    if (group.condition === 'AND') {
        return group.rules.every(ruleOrGroup => {
            if ('condition' in ruleOrGroup) {
                return evaluateRuleGroup(track, ruleOrGroup as RuleGroup);
            } else {
                return evaluateRule(track, ruleOrGroup as SmartRule);
            }
        });
    } else {
        return group.rules.some(ruleOrGroup => {
            if ('condition' in ruleOrGroup) {
                return evaluateRuleGroup(track, ruleOrGroup as RuleGroup);
            } else {
                return evaluateRule(track, ruleOrGroup as SmartRule);
            }
        });
    }
};

export const evaluateSmartPlaylist = (tracks: TrackItem[], config: SmartPlaylistDefinition): TrackItem[] => {
    return tracks.filter(track => evaluateRuleGroup(track, config.group));
};
