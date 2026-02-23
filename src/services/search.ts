import React, { createContext, useContext, useState, ReactNode, useEffect, useRef } from 'react';
import { TrackItem } from '../types/music';

/**
 * Search Service
 * Integrates search engine using a Web Worker to ensure the UI thread remains unblocked.
 */
export class SearchService {
    private worker: Worker | null = null;
    private searchCallbacks: Map<number, (results: TrackItem[]) => void> = new Map();
    private currentSearchId: number = 0;
    private isReady: boolean = false;
    private onReadyCallbacks: (() => void)[] = [];

    constructor() {
        this.initWorker();
    }

    private initWorker() {
        if (typeof window !== 'undefined' && window.Worker) {
            // Correct Vite Web Worker instantiation
            this.worker = new Worker(
                new URL('../workers/searchWorker.ts', import.meta.url),
                { type: 'module' }
            );

            this.worker.onmessage = (e: MessageEvent) => {
                const { type, payload } = e.data;
                if (type === 'INIT_DONE') {
                    this.isReady = true;
                    this.onReadyCallbacks.forEach(cb => cb());
                    this.onReadyCallbacks = [];
                } else if (type === 'SEARCH_DONE') {
                    const cb = this.searchCallbacks.get(payload.id);
                    if (cb) {
                        cb(payload.results);
                        this.searchCallbacks.delete(payload.id);
                    }
                }
            };
        }
    }

    /**
     * Initializes the search index using the full library data.
     */
    buildIndex(tracks: TrackItem[]): void {
        if (this.worker) {
            this.isReady = false;
            this.worker.postMessage({ type: 'INIT', payload: tracks });
        }
    }

    /**
     * Waits until the worker is initialized with the dataset.
     */
    async waitForReady(): Promise<void> {
        if (this.isReady) return;
        return new Promise((resolve) => {
            this.onReadyCallbacks.push(resolve);
        });
    }

    /**
     * Performs an instant "As You Type" search query across the library.
     * @param query - The user's input string
     * @returns Promise of Array of matched tracks
     */
    async search(query: string): Promise<TrackItem[]> {
        if (!this.worker) {
            return [];
        }

        await this.waitForReady();

        return new Promise((resolve) => {
            const id = ++this.currentSearchId;
            this.searchCallbacks.set(id, resolve);
            this.worker!.postMessage({ type: 'SEARCH', payload: { query, id } });
        });
    }

    evaluateSmartQuery(criteria: string): TrackItem[] {
        return [];
    }
}

export const searchService = new SearchService();
