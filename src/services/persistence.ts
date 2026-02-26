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
        shuffleMode: 'standard',
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

    constructor() {
        this.data = this.loadData();
    }

    private loadData(): UserDataStore {
        if (typeof window === 'undefined') return DEFAULT_DATA;
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (!stored) return DEFAULT_DATA;
            const parsed = JSON.parse(stored) as Partial<UserDataStore>;
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
        } catch (e) {
            console.error("Failed to load user data", e);
            return DEFAULT_DATA;
        }
    }

    private saveData() {
        if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
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
