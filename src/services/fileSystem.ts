/**
 * File System Service Stub
 * Handles path resolution and translations between the absolute paths
 * returned by indexation.bat and web-friendly relative paths.
 */

import { dbService } from './db';

export class FileSystemService {
    /**
     * Converts a physical path to a viable local web URL or blob reference.
     * @param absolutePath - The 'path' property from TrackFile
     * @returns Resolvable local URL
     */
    resolveAudioPath(absolutePath: string): string {
        return dbService.getRelativePath(absolutePath);
    }

    resolveAudioPathCandidates(absolutePath: string): string[] {
        return dbService.getAssetCandidates(absolutePath);
    }

    /**
     * Resolves the artwork image path, applying fallbacks if missing.
     * @param artworkPath - The image path from ImageDetails
     * @returns Resolvable image URL
     */
    resolveArtworkPath(artworkPath: string | undefined): string {
        if (!artworkPath) return '';
        return dbService.getRelativePath(artworkPath);
    }

    resolveArtworkPathCandidates(artworkPath: string | undefined): string[] {
        if (!artworkPath) return [];
        return dbService.getAssetCandidates(artworkPath);
    }

    /**
     * Stub for triggering physical file system operations (if running in Electron/Tauri)
     */
    physicallyMoveFile(oldPath: string, newPath: string): boolean {
        console.log(`Moving file from ${oldPath} to ${newPath}`);
        return false;
    }
}

export const fileSystemService = new FileSystemService();
