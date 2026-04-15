import { MusicDatabase, TrackItem } from '../types/music';
import { resolveAssetCandidates, resolvePreferredAssetUrl, resolveRepositoryRelativePath } from './assetResolver';

/**
 * Database Service
 * Parses 'musicBib.json' and prepares the application for in-memory DB operations.
 */
export class DatabaseService {
    private database: MusicDatabase | null = null;
    private trackMap: Map<string, TrackItem> = new Map();

    /**
     * Converts the absolute path from the indexation batch script to a relative URL.
     */
    getRelativePath(absolutePath: string): string {
        return resolvePreferredAssetUrl(absolutePath);
    }

    getAssetCandidates(assetPath: string): string[] {
        return resolveAssetCandidates(assetPath);
    }

    getRepositoryRelativePath(assetPath: string): string {
        return resolveRepositoryRelativePath(assetPath);
    }

    /**
     * Loads and parses the initial musicBib.json file into the internal structure.
     */
    async loadInitialDatabase(): Promise<MusicDatabase | null> {
        if (this.database) {
            return this.database;
        }

        try {
            const manifestCandidates = resolveAssetCandidates('musicBib.json');
            let response: Response | null = null;

            for (const candidate of manifestCandidates) {
                try {
                    const candidateResponse = await fetch(candidate);
                    if (candidateResponse.ok) {
                        response = candidateResponse;
                        break;
                    }
                } catch {
                    // Try next location.
                }
            }

            if (!response) {
                throw new Error('Failed to load musicBib.json from GitHub or local fallback.');
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

                    // Normalize artwork paths
                    if (track.artworks) {
                        if (track.artworks.track_artwork) {
                            track.artworks.track_artwork.forEach(art => {
                                if (art.path) art.path = '/' + art.path.split('\\').join('/').replace(/^\/+/, '');
                            });
                        }
                        if (track.artworks.album_artwork) {
                            track.artworks.album_artwork.forEach(art => {
                                if (art.path) art.path = '/' + art.path.split('\\').join('/').replace(/^\/+/, '');
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
