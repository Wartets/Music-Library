// Persistence Service for Music Library

export type ShuffleMode = 'standard' | 'weighted' | 'discovery' | 'recent';
export type MetadataWriteTarget = 'musicbib' | 'file' | 'both';

export interface Playlist {
    id: string;
    name: string;
    trackIds: string[]; // using hash_sha256
    description?: string;
    customImage?: string; // URL or base64 string
}

export interface UserPreferences {
    volume: number;
    shuffle: boolean;
    shuffleMode: ShuffleMode;
    repeat: 'none' | 'all' | 'one';
    eqEnabled: boolean;
    eqBands: number[]; // [32Hz, 64Hz, 125Hz, 250Hz, 500Hz, 1kHz, 2kHz, 4kHz, 8kHz, 16kHz]
    crossfadeEnabled: boolean;
    crossfadeDuration: number;
    normalizationEnabled: boolean;
    normalizationStrength: number;
    metadataWriteTarget: MetadataWriteTarget;
}

export interface PlaybackState {
    trackId: string | null;
    queueIds: string[];
    historyIds: string[];
    position: number;
    volume: number;
}

const STORAGE_KEY = 'music_library_userdata';
const STORAGE_INDEX_KEY = `${STORAGE_KEY}:index`;
const STORAGE_SECTION_PREFIX = `${STORAGE_KEY}:section:`;
const STORAGE_LOCK_KEY = `${STORAGE_KEY}:lock`;
const STORAGE_CHUNK_SIZE = 90_000;
const STORAGE_LOCK_TTL_MS = 1500;
const STORAGE_LOCK_WAIT_MS = 200;

const PERSISTED_SECTIONS = [
    'history',
    'playlists',
    'smartPlaylists',
    'preferences',
    'playCounts',
    'metadataOverrides',
    'artworkOverrides',
    'ratings',
    'favorites',
    'hiddenTrackIds',
    'playbackState'
] as const;

type PersistedSection = typeof PERSISTED_SECTIONS[number];

interface SectionMeta {
    chunkCount: number;
    compressed: boolean;
}

interface StorageIndex {
    version: number;
    updatedAt: number;
    sections: Partial<Record<PersistedSection, SectionMeta>>;
}

interface UserDataStore {
    history: string[]; // array of hash_sha256
    playlists: Playlist[];
    smartPlaylists: import('../utils/smartPlaylistEvaluator').SmartPlaylistDefinition[];
    preferences: UserPreferences;
    playCounts: Record<string, number>; // hash_sha256 -> count
    metadataOverrides: Record<string, Partial<import('../types/music').TrackMetadata>>;
    artworkOverrides: Record<string, import('../types/music').ImageDetails[]>; // hash_sha256 -> artworks
    ratings: Record<string, number>; // hash_sha256 -> 0-5 stars
    favorites: string[]; // array of hash_sha256
    hiddenTrackIds: string[]; // temporarily hidden track hashes
    playbackState?: PlaybackState;
}

const DEFAULT_DATA: UserDataStore = {
    history: [],
    playlists: [],
    smartPlaylists: [],
    preferences: {
        volume: 1.0,
        shuffle: false,
        shuffleMode: 'recent',
        repeat: 'none',
        eqEnabled: false,
        eqBands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        crossfadeEnabled: false,
        crossfadeDuration: 3,
        normalizationEnabled: false,
        normalizationStrength: 45,
        metadataWriteTarget: 'musicbib'
    },
    playCounts: {},
    metadataOverrides: {},
    artworkOverrides: {},
    ratings: {},
    favorites: [],
    hiddenTrackIds: []
};

class PersistenceService {
    private data: UserDataStore;
    private sectionHashes: Record<PersistedSection, string>;
    private storageLockOwner: string;
    private shouldMigrateLegacy: boolean = false;

    private static readonly COMPRESSION_TOKENS: Array<[string, string]> = [
        ['"metadataOverrides":', '"!mo":'],
        ['"artworkOverrides":', '"!ao":'],
        ['"smartPlaylists":', '"!sp":'],
        ['"playbackState":', '"!ps":'],
        ['"hiddenTrackIds":', '"!hi":'],
        ['"preferences":', '"!pr":'],
        ['"playCounts":', '"!pc":'],
        ['"favorites":', '"!fv":'],
        ['"history":', '"!hs":'],
        ['"playlists":', '"!pl":'],
        ['"ratings":', '"!rt":'],
    ];

    constructor() {
        this.storageLockOwner = `lock_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        this.data = this.loadData();
        this.sectionHashes = this.computeSectionHashes(this.data);

        if (this.shouldMigrateLegacy && typeof window !== 'undefined') {
            this.saveData(PERSISTED_SECTIONS);
            localStorage.removeItem(STORAGE_KEY);
        }
    }

    private normalizeLoadedData(parsed: Partial<UserDataStore>): UserDataStore {
        return {
            ...DEFAULT_DATA,
            ...parsed,
            preferences: {
                ...DEFAULT_DATA.preferences,
                ...(parsed.preferences || {})
            },
            history: parsed.history || [],
            playlists: parsed.playlists || [],
            smartPlaylists: parsed.smartPlaylists || [],
            playCounts: parsed.playCounts || {},
            metadataOverrides: parsed.metadataOverrides || {},
            artworkOverrides: parsed.artworkOverrides || {},
            ratings: parsed.ratings || {},
            favorites: parsed.favorites || [],
            hiddenTrackIds: parsed.hiddenTrackIds || []
        };
    }

    private readStorageIndex(): StorageIndex {
        if (typeof window === 'undefined') {
            return { version: 2, updatedAt: Date.now(), sections: {} };
        }

        try {
            const raw = localStorage.getItem(STORAGE_INDEX_KEY);
            if (!raw) {
                return { version: 2, updatedAt: Date.now(), sections: {} };
            }
            const parsed = JSON.parse(raw) as StorageIndex;
            if (!parsed || typeof parsed !== 'object') {
                return { version: 2, updatedAt: Date.now(), sections: {} };
            }
            return {
                version: typeof parsed.version === 'number' ? parsed.version : 2,
                updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
                sections: parsed.sections || {}
            };
        } catch {
            return { version: 2, updatedAt: Date.now(), sections: {} };
        }
    }

    private getSectionStorageKey(section: PersistedSection): string {
        return `${STORAGE_SECTION_PREFIX}${section}`;
    }

    private compressPayload(raw: string): string {
        let result = raw;
        for (const [from, to] of PersistenceService.COMPRESSION_TOKENS) {
            result = result.split(from).join(to);
        }
        return result;
    }

    private decompressPayload(raw: string): string {
        let result = raw;
        for (let i = PersistenceService.COMPRESSION_TOKENS.length - 1; i >= 0; i--) {
            const [from, to] = PersistenceService.COMPRESSION_TOKENS[i];
            result = result.split(to).join(from);
        }
        return result;
    }

    private writeChunked(baseKey: string, payload: string, previousChunkCount: number = 0): number {
        if (typeof window === 'undefined') return 0;

        const chunkCount = Math.max(1, Math.ceil(payload.length / STORAGE_CHUNK_SIZE));
        for (let i = 0; i < chunkCount; i++) {
            const chunk = payload.slice(i * STORAGE_CHUNK_SIZE, (i + 1) * STORAGE_CHUNK_SIZE);
            localStorage.setItem(`${baseKey}:chunk:${i}`, chunk);
        }

        for (let i = chunkCount; i < previousChunkCount; i++) {
            localStorage.removeItem(`${baseKey}:chunk:${i}`);
        }

        return chunkCount;
    }

    private readChunked(baseKey: string, chunkCount: number): string {
        if (typeof window === 'undefined') return '';
        let combined = '';
        for (let i = 0; i < chunkCount; i++) {
            combined += localStorage.getItem(`${baseKey}:chunk:${i}`) || '';
        }
        return combined;
    }

    private loadSegmentedData(): UserDataStore | null {
        if (typeof window === 'undefined') return null;

        const index = this.readStorageIndex();
        const hasSections = Object.keys(index.sections || {}).length > 0;
        if (!hasSections) {
            return null;
        }

        const reconstructed: Partial<UserDataStore> = {};

        try {
            for (const section of PERSISTED_SECTIONS) {
                const meta = index.sections[section];
                if (!meta || meta.chunkCount <= 0) continue;

                const serialized = this.readChunked(this.getSectionStorageKey(section), meta.chunkCount);
                if (!serialized) continue;

                const decompressed = meta.compressed ? this.decompressPayload(serialized) : serialized;
                (reconstructed as any)[section] = JSON.parse(decompressed);
            }

            return this.normalizeLoadedData(reconstructed);
        } catch (e) {
            console.error('Failed to load segmented user data', e);
            return null;
        }
    }

    private hashValue(value: unknown): string {
        const source = JSON.stringify(value ?? null);
        let hash = 0;
        for (let i = 0; i < source.length; i++) {
            hash = (hash * 31 + source.charCodeAt(i)) | 0;
        }
        return String(hash);
    }

    private computeSectionHashes(data: UserDataStore): Record<PersistedSection, string> {
        const hashes = {} as Record<PersistedSection, string>;
        PERSISTED_SECTIONS.forEach(section => {
            hashes[section] = this.hashValue((data as any)[section]);
        });
        return hashes;
    }

    private acquireStorageLock(): () => void {
        if (typeof window === 'undefined') return () => { };

        const start = Date.now();

        while (Date.now() - start < STORAGE_LOCK_WAIT_MS) {
            const now = Date.now();
            const existingRaw = localStorage.getItem(STORAGE_LOCK_KEY);

            let canAcquire = false;
            if (!existingRaw) {
                canAcquire = true;
            } else {
                try {
                    const existing = JSON.parse(existingRaw) as { owner: string; expiresAt: number };
                    if (!existing || typeof existing.expiresAt !== 'number' || existing.expiresAt <= now || existing.owner === this.storageLockOwner) {
                        canAcquire = true;
                    }
                } catch {
                    canAcquire = true;
                }
            }

            if (canAcquire) {
                const lockPayload = JSON.stringify({
                    owner: this.storageLockOwner,
                    expiresAt: now + STORAGE_LOCK_TTL_MS
                });
                localStorage.setItem(STORAGE_LOCK_KEY, lockPayload);

                const checkRaw = localStorage.getItem(STORAGE_LOCK_KEY);
                if (checkRaw) {
                    try {
                        const check = JSON.parse(checkRaw) as { owner: string };
                        if (check.owner === this.storageLockOwner) {
                            return () => {
                                const currentRaw = localStorage.getItem(STORAGE_LOCK_KEY);
                                if (!currentRaw) return;
                                try {
                                    const current = JSON.parse(currentRaw) as { owner: string };
                                    if (current.owner === this.storageLockOwner) {
                                        localStorage.removeItem(STORAGE_LOCK_KEY);
                                    }
                                } catch {
                                    localStorage.removeItem(STORAGE_LOCK_KEY);
                                }
                            };
                        }
                    } catch {
                        // Continue looping.
                    }
                }
            }
        }

        return () => { };
    }

    private loadData(): UserDataStore {
        if (typeof window === 'undefined') return DEFAULT_DATA;

        const segmentedData = this.loadSegmentedData();
        if (segmentedData) {
            return segmentedData;
        }

        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (!stored) return DEFAULT_DATA;
            const parsed = JSON.parse(stored) as Partial<UserDataStore>;
            this.shouldMigrateLegacy = true;
            return this.normalizeLoadedData(parsed);
        } catch (e) {
            console.error("Failed to load user data", e);
            return DEFAULT_DATA;
        }
    }

    private saveData(forceSections?: readonly PersistedSection[]) {
        if (typeof window === 'undefined') return;

        const changedSections = (forceSections && forceSections.length > 0)
            ? [...forceSections]
            : PERSISTED_SECTIONS.filter(section => this.sectionHashes[section] !== this.hashValue((this.data as any)[section]));

        if (changedSections.length === 0) {
            return;
        }

        const release = this.acquireStorageLock();

        try {
            const index = this.readStorageIndex();

            changedSections.forEach(section => {
                const raw = JSON.stringify((this.data as any)[section]);
                const compressed = this.compressPayload(raw);
                const previousChunkCount = index.sections[section]?.chunkCount || 0;
                const chunkCount = this.writeChunked(this.getSectionStorageKey(section), compressed, previousChunkCount);

                index.sections[section] = {
                    chunkCount,
                    compressed: true
                };

                this.sectionHashes[section] = this.hashValue((this.data as any)[section]);
            });

            index.updatedAt = Date.now();
            index.version = 2;
            localStorage.setItem(STORAGE_INDEX_KEY, JSON.stringify(index));
        } catch (e) {
            console.error('Failed to save user data', e);
        } finally {
            release();
        }
    }

    // -- Preferences
    getPreferences(): UserPreferences {
        return this.data.preferences;
    }

    updatePreferences(prefs: Partial<UserPreferences>) {
        this.data.preferences = { ...this.data.preferences, ...prefs };
        this.saveData();
    }

    // -- Playback State
    getPlaybackState(): PlaybackState | null {
        return this.data.playbackState || null;
    }

    setPlaybackState(state: PlaybackState) {
        this.data.playbackState = state;
        this.saveData();
    }

    // -- History
    getHistoryIds(): string[] {
        return this.data.history;
    }

    clearHistory() {
        this.data.history = [];
        this.data.playCounts = {};
        this.saveData();
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('music-history-cleared'));
        }
    }

    addToHistory(hash_sha256: string) {
        this.data.history = this.data.history.filter(id => id !== hash_sha256);
        this.data.history.unshift(hash_sha256);
        if (this.data.history.length > 100) {
            this.data.history.pop();
        }

        // Also increment play count
        this.data.playCounts[hash_sha256] = (this.data.playCounts[hash_sha256] || 0) + 1;
        this.saveData();
    }

    // -- Play Counts
    getPlayCount(hash_sha256: string): number {
        return this.data.playCounts[hash_sha256] || 0;
    }

    getAllPlayCounts(): Record<string, number> {
        return this.data.playCounts || {};
    }

    getTopTracks(limit: number = 5): string[] {
        return Object.entries(this.data.playCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([hash]) => hash);
    }

    // -- Metadata Overrides
    getMetadataOverrides() {
        return this.data.metadataOverrides;
    }

    setMetadataOverride(hash_sha256: string, override: Partial<import('../types/music').TrackMetadata>) {
        this.data.metadataOverrides[hash_sha256] = {
            ...(this.data.metadataOverrides[hash_sha256] || {}),
            ...override
        };
        this.saveData();
    }

    // -- Artwork Overrides
    getArtworkOverrides() {
        return this.data.artworkOverrides || {};
    }

    getData() {
        return this.data;
    }

    setArtworkOverride(hash_sha256: string, artworks: import('../types/music').ImageDetails[]) {
        if (!this.data.artworkOverrides) this.data.artworkOverrides = {};
        this.data.artworkOverrides[hash_sha256] = artworks;
        this.saveData();
    }

    // -- Playlists
    getPlaylists(): Playlist[] {
        return this.data.playlists;
    }

    createPlaylist(name: string, description?: string): Playlist {
        const id = 'pl_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
        const newPlaylist: Playlist = { id, name, description, trackIds: [] };
        this.data.playlists.push(newPlaylist);
        this.saveData();
        return newPlaylist;
    }

    updatePlaylist(playlistId: string, updates: Partial<Playlist>) {
        const pl = this.data.playlists.find(p => p.id === playlistId);
        if (pl) {
            Object.assign(pl, updates);
            this.saveData();
        }
    }

    deletePlaylist(id: string) {
        this.data.playlists = this.data.playlists.filter(p => p.id !== id);
        this.saveData();
    }

    // -- Smart Playlists
    getSmartPlaylists() {
        return this.data.smartPlaylists || [];
    }

    saveSmartPlaylist(def: import('../utils/smartPlaylistEvaluator').SmartPlaylistDefinition) {
        if (!this.data.smartPlaylists) this.data.smartPlaylists = [];
        const existingIndex = this.data.smartPlaylists.findIndex(p => p.id === def.id);
        if (existingIndex >= 0) {
            this.data.smartPlaylists[existingIndex] = def;
        } else {
            this.data.smartPlaylists.push(def);
        }
        this.saveData();
    }

    deleteSmartPlaylist(id: string) {
        if (!this.data.smartPlaylists) return;
        this.data.smartPlaylists = this.data.smartPlaylists.filter(p => p.id !== id);
        this.saveData();
    }

    addTrackToPlaylist(playlistId: string, trackHash: string) {
        const pl = this.data.playlists.find(p => p.id === playlistId);
        if (pl && !pl.trackIds.includes(trackHash)) {
            pl.trackIds.push(trackHash);
            this.saveData();
        }
    }

    removeFromPlaylist(playlistId: string, trackHash: string) {
        const pl = this.data.playlists.find(p => p.id === playlistId);
        if (pl) {
            pl.trackIds = pl.trackIds.filter(id => id !== trackHash);
            this.saveData();
        }
    }

    // -- Ratings (0-5 stars)
    getRating(hash_sha256: string): number {
        return this.data.ratings?.[hash_sha256] || 0;
    }

    setRating(hash_sha256: string, rating: number) {
        if (!this.data.ratings) this.data.ratings = {};
        this.data.ratings[hash_sha256] = Math.max(0, Math.min(5, rating));
        this.saveData();
    }

    getAllRatings(): Record<string, number> {
        return this.data.ratings || {};
    }

    // -- Favorites
    isFavorite(hash_sha256: string): boolean {
        return (this.data.favorites || []).includes(hash_sha256);
    }

    toggleFavorite(hash_sha256: string): boolean {
        if (!this.data.favorites) this.data.favorites = [];
        const idx = this.data.favorites.indexOf(hash_sha256);
        if (idx >= 0) {
            this.data.favorites.splice(idx, 1);
            this.saveData();
            return false;
        } else {
            this.data.favorites.push(hash_sha256);
            this.saveData();
            return true;
        }
    }

    getFavorites(): string[] {
        return this.data.favorites || [];
    }

    getHiddenTrackIds(): string[] {
        return this.data.hiddenTrackIds || [];
    }

    hideTrack(hash_sha256: string): void {
        if (!this.data.hiddenTrackIds) this.data.hiddenTrackIds = [];
        if (!this.data.hiddenTrackIds.includes(hash_sha256)) {
            this.data.hiddenTrackIds.push(hash_sha256);
            this.saveData();
        }
    }

    unhideTrack(hash_sha256: string): void {
        if (!this.data.hiddenTrackIds) return;
        this.data.hiddenTrackIds = this.data.hiddenTrackIds.filter(id => id !== hash_sha256);
        this.saveData();
    }

    // -- Generic store (for UI preferences like columns)
    get(key: string): any {
        if (typeof window === 'undefined') return null;
        const stored = localStorage.getItem(`music_library_ui_${key}`);
        return stored ? JSON.parse(stored) : null;
    }

    set(key: string, value: any) {
        if (typeof window === 'undefined') return;
        localStorage.setItem(`music_library_ui_${key}`, JSON.stringify(value));
    }
}

export const persistenceService = new PersistenceService();
