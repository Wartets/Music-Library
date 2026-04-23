export interface GroupedTracks<T> {
    key: string;
    name: string;
    tracks: T[];
    isUnknown?: boolean;
}

interface GroupTracksOptions<T> {
    getValues: (item: T) => string | string[] | null | undefined;
    unknownLabel: string;
    unknownKey?: string;
    normalizeKey?: (value: string) => string;
    isUnknownValue?: (value: string) => boolean;
}

const toArray = (value: string | string[] | null | undefined): string[] => {
    if (Array.isArray(value)) {
        return value;
    }
    if (typeof value === 'string') {
        return [value];
    }
    return [];
};

const defaultNormalizeKey = (value: string) => value.toLowerCase();

export const groupTracks = <T>(items: T[], options: GroupTracksOptions<T>): GroupedTracks<T>[] => {
    const {
        getValues,
        unknownLabel,
        unknownKey = '__unknown__',
        normalizeKey = defaultNormalizeKey,
        isUnknownValue
    } = options;

    const groups: Record<string, GroupedTracks<T>> = {};
    const unknownTracks: T[] = [];

    items.forEach(item => {
        const rawValues = toArray(getValues(item))
            .map(value => value.trim())
            .filter(Boolean);

        const normalizedValues = Array.from(new Set(rawValues));
        const validValues = normalizedValues.filter(value => !isUnknownValue?.(value));

        if (validValues.length === 0) {
            unknownTracks.push(item);
            return;
        }

        validValues.forEach(value => {
            const key = normalizeKey(value);
            if (!groups[key]) {
                groups[key] = {
                    key,
                    name: value,
                    tracks: []
                };
            }
            groups[key].tracks.push(item);
        });
    });

    if (unknownTracks.length > 0) {
        groups[unknownKey] = {
            key: unknownKey,
            name: unknownLabel,
            tracks: unknownTracks,
            isUnknown: true
        };
    }

    return Object.values(groups);
};
