export type SettingsTabId = 'interface' | 'audio' | 'metadata' | 'maintenance' | 'stats' | 'credentials';

export type MaintenanceTabId = 'duplicates' | 'health' | 'data';

export interface SettingsStatCard {
    label: string;
    value: string;
}
