import { MusicDatabase, TrackItem } from '../types/music';

const ABSOLUTE_URL_REGEX = /^[a-z][a-z0-9+.-]*:\/\//i;

/**
 * Database Service
 * Parses 'musicBib.json' and prepares the application for in-memory DB operations.
 */
export class DatabaseService {
    private database: MusicDatabase | null = null;
    private trackMap: Map<string, TrackItem> = new Map();
    private readonly appBaseUrl = this.normalizeBaseUrl(import.meta.env.BASE_URL || '/');
    private readonly mediaBaseUrl = this.normalizeBaseUrl(import.meta.env.VITE_MEDIA_BASE_URL || '');

    private normalizeBaseUrl(base: string): string {
        const trimmed = (base || '').trim();
        if (!trimmed) return '';
        if (trimmed === '/') return '/';
        return trimmed.replace(/\/+$/, '');
    }

    private safeEncodeSegment(segment: string): string {
        if (!segment) return segment;
        try {
            return encodeURIComponent(decodeURIComponent(segment)).replace(/%3A/g, ':');
        } catch {
            return encodeURIComponent(segment).replace(/%3A/g, ':');
        }
    }

    private toEncodedUrlPath(pathValue: string): string {
        return pathValue
            .split('/')
            .map(segment => this.safeEncodeSegment(segment))
            .join('/');
    }

    private toRelativeLibraryPath(rawPath: string): string {
        const normalizedRaw = rawPath.replace(/^file:\/\//i, '').replace(/\\/g, '/').trim();
        if (!normalizedRaw) return '';

        if (ABSOLUTE_URL_REGEX.test(normalizedRaw)) {
            try {
                const parsed = new URL(normalizedRaw);
                return parsed.pathname.replace(/^\/+/, '');
            } catch {
                return normalizedRaw.replace(/^\/+/, '');
            }
        }

        const withoutDrive = normalizedRaw.replace(/^[A-Za-z]:\//, '');
        const libraryAnchorMatch = withoutDrive.match(/(Album\s+\d[^/]*|Single|save)\/.*/i);
        if (libraryAnchorMatch) {
            return libraryAnchorMatch[0].replace(/^\/+/, '');
        }

        const repoAnchor = '/Music-Library/';
        const repoAnchorIndex = withoutDrive.toLowerCase().indexOf(repoAnchor.toLowerCase());
        if (repoAnchorIndex >= 0) {
            return withoutDrive.slice(repoAnchorIndex + repoAnchor.length).replace(/^\/+/, '');
        }

        return withoutDrive.replace(/^\/+/, '');
    }

    private joinBaseAndPath(base: string, encodedRelativePath: string): string {
        if (!base || base === '/') {
            return `/${encodedRelativePath}`;
        }
        return `${base}/${encodedRelativePath}`;
    }

    /**
     * Converts the absolute path from the indexation batch script to a consumable URL.
     */
    getRelativePath(rawPath: string): string {
        if (!rawPath) return '';

        const normalizedRaw = rawPath.replace(/^file:\/\//i, '').replace(/\\/g, '/').trim();
        if (!normalizedRaw) return '';

        if (ABSOLUTE_URL_REGEX.test(normalizedRaw)) {
            return normalizedRaw;
        }

        const relativePath = this.toRelativeLibraryPath(normalizedRaw);
        if (!relativePath) return '';

        const encodedRelativePath = this.toEncodedUrlPath(relativePath);
        const preferredBase = this.mediaBaseUrl || this.appBaseUrl;
        return this.joinBaseAndPath(preferredBase, encodedRelativePath);
    }

    /**
     * Loads and parses the initial musicBib.json file into the internal structure.
     */
    async loadInitialDatabase(): Promise<MusicDatabase | null> {
        if (this.database) {
            return this.database;
        }

        try {
            const response = await fetch(`${import.meta.env.BASE_URL}musicBib.json`);
            if (!response.ok) {
                throw new Error(`Failed to load musicBib.json: ${response.statusText}`);
            }

            const data: MusicDatabase = await response.json();

            // Normalize data: ensure metadata exists and artists is an array
            if (data.items && Array.isArray(data.items)) {
                for (const track of data.items) {
                    if (!track.metadata) {
                        track.metadata = {} as any;
                    }
                    if (typeof track.metadata.artists === 'string') {
                        track.metadata.artists = [track.metadata.artists];
                    } else if (!Array.isArray(track.metadata.artists)) {
                        track.metadata.artists = [];
                    }

                    // Ensure audio_specs exists and populate codec
                    if (!track.audio_specs) {
                        track.audio_specs = { is_lossless: false } as any;
                    }
                    if (!track.audio_specs.codec && track.file && track.file.ext) {
                        track.audio_specs.codec = track.file.ext;
                    }

                    // Normalize artwork paths as relative keys in the dataset.
                    if (track.artworks) {
                        if (track.artworks.track_artwork) {
                            track.artworks.track_artwork.forEach(art => {
                                if (art.path) {
                                    const normalized = art.path.replace(/^file:\/\//i, '').replace(/\\/g, '/').trim();
                                    if (ABSOLUTE_URL_REGEX.test(normalized)) {
                                        art.path = normalized;
                                    } else {
                                        const relativePath = this.toRelativeLibraryPath(art.path);
                                        art.path = relativePath ? `/${relativePath}` : '';
                                    }
                                }
                            });
                        }
                        if (track.artworks.album_artwork) {
                            track.artworks.album_artwork.forEach(art => {
                                if (art.path) {
                                    const normalized = art.path.replace(/^file:\/\//i, '').replace(/\\/g, '/').trim();
                                    if (ABSOLUTE_URL_REGEX.test(normalized)) {
                                        art.path = normalized;
                                    } else {
                                        const relativePath = this.toRelativeLibraryPath(art.path);
                                        art.path = relativePath ? `/${relativePath}` : '';
                                    }
                                }
                            });
                        }
                    }
                }
            }

            this.database = data;

            this.trackMap.clear();
            if (data.items && Array.isArray(data.items)) {
                for (const track of data.items) {
                    if (track.logic && track.logic.hash_sha256) {
                        this.trackMap.set(track.logic.hash_sha256, track);
                    }
                }
            }

            return this.database;
        } catch (error) {
            console.error("Error loading music library database:", error);
            return null;
        }
    }

    async getTrackByHash(hash: string): Promise<TrackItem | null> {
        if (!this.database) {
            await this.loadInitialDatabase();
        }
        return this.trackMap.get(hash) || null;
    }

    updateTrackMetadata(hash: string, metadataPatch: Partial<TrackItem['metadata']>): boolean {
        if (!this.database) return false;
        const track = this.trackMap.get(hash);
        if (!track) return false;
        track.metadata = {
            ...track.metadata,
            ...metadataPatch
        };
        return true;
    }

    exportDatabaseJson(): string | null {
        if (!this.database) return null;
        return JSON.stringify(this.database, null, 2);
    }

    async loadUserDataStore(): Promise<any> {
        return {};
    }

    getAllTracks(): TrackItem[] {
        return this.database ? this.database.items : [];
    }
}

export const dbService = new DatabaseService();
