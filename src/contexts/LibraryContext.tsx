import React, { createContext, useContext, useState, ReactNode, useEffect, useRef } from 'react';
import { TrackItem, LibraryState, ColumnConfig } from '../types/music';
import { dbService } from '../services/db';
import { searchService } from '../services/search';
import { persistenceService } from '../services/persistence';
import { TrackMetadata } from '../types/music';

interface LibraryContextProps {
    state: LibraryState;
    setSearchQuery: (query: string) => void;
    setSortBy: (sortBy: string) => void;
    updateTrackMetadata: (hash_sha256: string, override: Partial<TrackMetadata>) => void;
    updateArtworkOverride: (hash_sha256: string, artwork: import('../types/music').ImageDetails[]) => void;
    updateColumnConfig: (config: ColumnConfig[]) => void;
    editingTracks: TrackItem[] | null;
    setEditingTracks: (tracks: TrackItem[] | null) => void;
    refresh: () => void;
}

const LibraryContext = createContext<LibraryContextProps | undefined>(undefined);

const DEFAULT_COLUMNS: ColumnConfig[] = [
    { id: 'number', label: '#', width: 40, visible: true, sortable: false },
    { id: 'artwork', label: '', width: 56, visible: true, sortable: false },
    { id: 'title', label: 'Title', width: 0, visible: true, sortable: true }, // 0 means flex-1
    { id: 'album', label: 'Album', width: 160, visible: true, sortable: true },
    { id: 'genre', label: 'Genre', width: 80, visible: true, sortable: true },
    { id: 'year', label: 'Year', width: 64, visible: true, sortable: true },
    { id: 'bpm', label: 'BPM', width: 48, visible: true, sortable: true },
    { id: 'duration', label: 'Time', width: 56, visible: true, sortable: true },
    { id: 'bitrate', label: 'kbps', width: 64, visible: true, sortable: true },
    { id: 'size', label: 'Size', width: 80, visible: true, sortable: true },
];

export const LibraryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [state, setState] = useState<LibraryState>(() => {
        const saved = persistenceService.get('library_columns');
        return {
            tracks: [],
            filteredTracks: [],
            isLoading: true,
            searchQuery: '',
            sortBy: 'date',
            sortOrder: 'desc',
            filterBy: {},
            columnConfig: saved || DEFAULT_COLUMNS,
            versionToPrimaryMap: {},
            stats: { totalDuration: 0, totalTracks: 0, totalSizeMb: 0 }
        };
    });

    useEffect(() => {
        const loadDb = async () => {
            const db = await dbService.loadInitialDatabase();
            if (db && db.items) {
                const overrides = persistenceService.getMetadataOverrides();
                const artworkOverrides = persistenceService.getArtworkOverrides();

                const rawTracks = db.items.map((t: TrackItem) => {
                    const hash = t.logic?.hash_sha256;
                    let track = { ...t };
                    if (hash && overrides[hash]) {
                        track.metadata = {
                            ...track.metadata,
                            ...overrides[hash]
                        };
                    }
                    if (hash && artworkOverrides[hash]) {
                        track.artworks = {
                            ...track.artworks,
                            track_artwork: artworkOverrides[hash]
                        };
                    }
                    return track;
                });

                // Group tracks by track_name and folder
                const groupedMap = new Map<string, TrackItem[]>();
                rawTracks.forEach(t => {
                    const key = `${t.logic?.track_name || 'unknown'}-${t.logic?.hierarchy?.folder || 'root'}`;
                    if (!groupedMap.has(key)) {
                        groupedMap.set(key, []);
                    }
                    groupedMap.get(key)!.push(t);
                });

                const tracks: TrackItem[] = Array.from(groupedMap.values()).map(versions => {
                    // Sort versions by modified date descending
                    const sorted = [...versions].sort((a, b) =>
                        (b.file?.epoch_modified || 0) - (a.file?.epoch_modified || 0)
                    );
                    const primary = { ...sorted[0] };
                    primary.versions = sorted;
                    return primary;
                });

                searchService.buildIndex(tracks);

                // Calculate stats
                const totalTracks = tracks.length;
                let totalSizeMb = 0;
                let totalDuration = 0;

                tracks.forEach(t => {
                    totalSizeMb += t.file?.size_mb || 0;
                    if (t.audio_specs?.duration) {
                        const [mins, secs] = t.audio_specs.duration.split(':').map(Number);
                        if (!isNaN(mins) && !isNaN(secs)) {
                            totalDuration += (mins * 60) + secs;
                        }
                    }
                });

                // Calculate version to primary mapping
                const versionToPrimaryMap: Record<string, string> = {};
                tracks.forEach(primary => {
                    primary.versions?.forEach(v => {
                        versionToPrimaryMap[v.logic.hash_sha256] = primary.logic.hash_sha256;
                    });
                });

                setState(prev => ({
                    ...prev,
                    tracks,
                    filteredTracks: tracks,
                    isLoading: false,
                    versionToPrimaryMap,
                    stats: { totalTracks, totalSizeMb, totalDuration }
                }));
            } else {
                setState(prev => ({ ...prev, isLoading: false }));
            }
        };
        loadDb();
    }, []);

    const sortTracks = (tracks: TrackItem[], sortBy: string, sortOrder: 'asc' | 'desc'): TrackItem[] => {
        const sorted = tracks.sort((a, b) => {
            let res = 0;
            if (sortBy === 'title') {
                res = (a.metadata?.title || a.logic?.track_name || '').localeCompare(b.metadata?.title || b.logic?.track_name || '');
            } else if (sortBy === 'artist') {
                const artistA = a.metadata?.artists?.[0] || '';
                const artistB = b.metadata?.artists?.[0] || '';
                res = artistA.localeCompare(artistB);
            } else if (sortBy === 'album') {
                const albumA = a.metadata?.album || '';
                const albumB = b.metadata?.album || '';
                res = albumA.localeCompare(albumB);
            } else if (sortBy === 'date' || sortBy === 'year') {
                const dateA = Number(a.metadata?.year) || 0;
                const dateB = Number(b.metadata?.year) || 0;
                res = dateA - dateB;
            } else if (sortBy === 'genre') {
                res = (a.metadata?.genre || '').localeCompare(b.metadata?.genre || '');
            } else if (sortBy === 'bpm') {
                const bpmA = Number(a.metadata?.bpm) || 0;
                const bpmB = Number(b.metadata?.bpm) || 0;
                res = bpmA - bpmB;
            } else if (sortBy === 'duration') {
                const parseDur = (d: string) => {
                    const p = d.split(':').map(Number);
                    return p.length === 2 ? p[0] * 60 + p[1] : 0;
                };
                res = parseDur(a.audio_specs?.duration || '0:00') - parseDur(b.audio_specs?.duration || '0:00');
            } else if (sortBy === 'bitrate') {
                const brA = parseInt(a.audio_specs?.bitrate || '0');
                const brB = parseInt(b.audio_specs?.bitrate || '0');
                res = brA - brB;
            } else if (sortBy === 'size') {
                res = (a.file?.size_bytes || 0) - (b.file?.size_bytes || 0);
            }
            return res;
        });

        return sortOrder === 'desc' ? sorted.reverse() : sorted;
    }

    const currentSearchQueryRef = useRef(state.searchQuery);

    useEffect(() => {
        currentSearchQueryRef.current = state.searchQuery;

        const timer = setTimeout(() => {
            const performSearch = async () => {
                if (!state.searchQuery.trim()) {
                    // If no search, we sort tracks
                    const sorted = sortTracks([...state.tracks], state.sortBy, state.sortOrder);
                    setState(prev => ({ ...prev, filteredTracks: sorted }));
                    return;
                }

                const querySnapshot = state.searchQuery;
                const results = await searchService.search(querySnapshot);

                // Prevent race conditions: only update if this is still the active search
                if (currentSearchQueryRef.current !== querySnapshot) {
                    return;
                }

                const sorted = sortTracks([...results], state.sortBy, state.sortOrder);
                setState(prev => ({ ...prev, filteredTracks: sorted }));
            };

            if (!state.isLoading) {
                performSearch();
            }
        }, 300); // 300ms debounce

        return () => clearTimeout(timer);
    }, [state.searchQuery, state.sortBy, state.sortOrder, state.isLoading, state.tracks]);


    const setSearchQuery = (query: string) => {
        setState(prev => ({ ...prev, searchQuery: query }));
    };

    const setSortBy = (sortBy: string) => {
        setState(prev => {
            const isSame = prev.sortBy === sortBy;
            const newOrder = isSame ? (prev.sortOrder === 'asc' ? 'desc' : 'asc') : (sortBy === 'date' || sortBy === 'year' ? 'desc' : 'asc');
            return { ...prev, sortBy, sortOrder: newOrder };
        });
    };

    const updateTrackMetadata = (hash_sha256: string, override: Partial<TrackMetadata>) => {
        persistenceService.setMetadataOverride(hash_sha256, override);

        setState(prev => {
            const updateTracksArray = (tracks: TrackItem[]) => tracks.map(t => {
                if (t.logic?.hash_sha256 === hash_sha256) {
                    return { ...t, metadata: { ...t.metadata, ...override } as TrackMetadata };
                }
                return t;
            });

            const newTracks = updateTracksArray(prev.tracks);
            const newFiltered = updateTracksArray(prev.filteredTracks);

            return {
                ...prev,
                tracks: newTracks,
                filteredTracks: newFiltered
            };
        });
    };

    const updateArtworkOverride = (hash_sha256: string, artwork: import('../types/music').ImageDetails[]) => {
        persistenceService.setArtworkOverride(hash_sha256, artwork);
        setState(prev => {
            const updateTracksArray = (tracks: TrackItem[]) => tracks.map(t => {
                if (t.logic?.hash_sha256 === hash_sha256) {
                    return { ...t, artworks: { ...t.artworks, track_artwork: artwork } };
                }
                return t;
            });

            return {
                ...prev,
                tracks: updateTracksArray(prev.tracks),
                filteredTracks: updateTracksArray(prev.filteredTracks)
            };
        });
    }

    const [editingTracks, setEditingTracks] = useState<TrackItem[] | null>(null);

    const updateColumnConfig = (config: ColumnConfig[]) => {
        persistenceService.set('library_columns', config);
        setState(prev => ({ ...prev, columnConfig: config }));
    };

    const refresh = () => {
        setState(prev => ({ ...prev }));
    };

    return (
        <LibraryContext.Provider value={{
            state,
            setSearchQuery,
            setSortBy,
            updateTrackMetadata,
            updateArtworkOverride,
            updateColumnConfig,
            editingTracks,
            setEditingTracks,
            refresh
        }}>
            {children}
        </LibraryContext.Provider>
    );
};

export const useLibrary = () => {
    const context = useContext(LibraryContext);
    if (!context) throw new Error('useLibrary must be used within LibraryProvider');
    return context;
};
