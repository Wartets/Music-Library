import { TrackItem } from '../types/music';
import { dbService } from './db';

/**
 * Audio Engine Service
 * Manages HTML5 Audio / Web Audio API operations with bit-perfect ambition.
 * Handles play, pause, volume, gapless playback, and audio manipulations.
 */

export type AudioPlaybackErrorCode =
    | 'media_aborted'
    | 'media_network'
    | 'media_decode'
    | 'format_unsupported'
    | 'autoplay_blocked'
    | 'playback_interrupted'
    | 'unknown';

export class AudioPlaybackError extends Error {
    public readonly code: AudioPlaybackErrorCode;

    constructor(code: AudioPlaybackErrorCode, message: string) {
        super(message);
        this.name = 'AudioPlaybackError';
        this.code = code;
    }
}

export class AudioEngine {
    private audioContext: AudioContext | null = null;
    private audioElement: HTMLAudioElement;
    private secondaryAudioElement: HTMLAudioElement;
    private gainNode: GainNode | null = null;
    private analyserNode: AnalyserNode | null = null;
    private eqBands: BiquadFilterNode[] = [];
    private secondaryGainNode: GainNode | null = null;
    private currentTrack: TrackItem | null = null;
    private nextTrackPreloaded: TrackItem | null = null;
    private activeAudioElement: 1 | 2 = 1;
    private normalizationEnabled: boolean = false;
    private normalizationStrength: number = 45;
    private normalizationMultiplier: number = 1;
    private normalizationBuffer: Uint8Array | null = null;
    private lastNormalizationAt: number = 0;
    private userVolume: number = 1;

    public getAnalyser(): AnalyserNode | null {
        return this.analyserNode;
    }

    // Callbacks for UI updates
    public onTimeUpdate?: (currentTime: number, duration: number) => void;
    public onEnded?: () => void;
    public onPlay?: () => void;
    public onPause?: () => void;
    public onError?: (error: Error) => void;

    constructor() {
        // Initialize HTML5 Audio elements
        this.audioElement = new Audio();
        this.audioElement.crossOrigin = "anonymous";

        this.secondaryAudioElement = new Audio();
        this.secondaryAudioElement.crossOrigin = "anonymous";

        this.setupListeners();
    }

    private setupListeners() {
        const setupForElement = (el: HTMLAudioElement) => {
            el.addEventListener('timeupdate', () => {
                if (this.getActiveElement() === el) {
                    this.updateNormalization();
                    if (this.onTimeUpdate) {
                        this.onTimeUpdate(el.currentTime, el.duration || 0);
                    }
                }
            });

            el.addEventListener('ended', () => {
                if (this.getActiveElement() === el && this.onEnded) {
                    this.onEnded();
                }
            });

            el.addEventListener('play', () => {
                if (this.getActiveElement() === el && this.onPlay) this.onPlay();
            });

            el.addEventListener('pause', () => {
                if (this.getActiveElement() === el && this.onPause) this.onPause();
            });

            el.addEventListener('error', () => {
                if (this.getActiveElement() === el && this.onError) {
                    this.onError(this.createMediaError(el.error));
                }
            });
        };

        setupForElement(this.audioElement);
        setupForElement(this.secondaryAudioElement);
    }

    private clamp(value: number, min: number, max: number): number {
        return Math.max(min, Math.min(max, value));
    }

    private getEffectiveVolume(): number {
        const normalization = this.normalizationEnabled ? this.normalizationMultiplier : 1;
        return this.clamp(this.userVolume * normalization, 0, 1);
    }

    private applyOutputVolume(): void {
        const effective = this.getEffectiveVolume();
        this.audioElement.volume = effective;
        this.secondaryAudioElement.volume = effective;

        if (this.gainNode) {
            this.gainNode.gain.setValueAtTime(effective, this.audioContext?.currentTime || 0);
        }
        if (this.secondaryGainNode) {
            this.secondaryGainNode.gain.setValueAtTime(effective, this.audioContext?.currentTime || 0);
        }
    }

    private updateNormalization(): void {
        if (!this.normalizationEnabled) {
            if (this.normalizationMultiplier !== 1) {
                this.normalizationMultiplier = 1;
                this.applyOutputVolume();
            }
            return;
        }

        const now = Date.now();
        if (now - this.lastNormalizationAt < 220) return;
        this.lastNormalizationAt = now;

        if (!this.analyserNode) return;
        if (!this.normalizationBuffer || this.normalizationBuffer.length !== this.analyserNode.fftSize) {
            this.normalizationBuffer = new Uint8Array(this.analyserNode.fftSize);
        }

        this.analyserNode.getByteTimeDomainData(this.normalizationBuffer as any);

        let sumSquares = 0;
        for (let i = 0; i < this.normalizationBuffer.length; i++) {
            const normalized = (this.normalizationBuffer[i] - 128) / 128;
            sumSquares += normalized * normalized;
        }
        const rms = Math.sqrt(sumSquares / this.normalizationBuffer.length);
        if (!Number.isFinite(rms)) return;

        const targetRms = 0.13;
        const desired = rms > 0.01 ? this.clamp(targetRms / rms, 0.65, 1.5) : 1;
        const strengthFactor = this.clamp(this.normalizationStrength / 100, 0, 1);
        const weightedDesired = 1 + (desired - 1) * strengthFactor;
        const smoothing = 0.12;
        this.normalizationMultiplier = this.clamp(
            this.normalizationMultiplier + (weightedDesired - this.normalizationMultiplier) * smoothing,
            0.55,
            1.6
        );

        this.applyOutputVolume();
    }

    private getActiveElement(): HTMLAudioElement {
        return this.activeAudioElement === 1 ? this.audioElement : this.secondaryAudioElement;
    }

    private getInactiveElement(): HTMLAudioElement {
        return this.activeAudioElement === 1 ? this.secondaryAudioElement : this.audioElement;
    }

    private getActiveGainNode(): GainNode | null {
        return this.activeAudioElement === 1 ? this.gainNode : this.secondaryGainNode;
    }

    private buildCompatibleFallbackSrc(track: TrackItem): string | null {
        const ext = (track.file?.ext || '').toLowerCase();
        if (ext !== 'm4a') return null;
        const path = track.file?.path || '';
        if (!path || /_compatible_aac\.m4a$/i.test(path)) return null;
        const compatiblePath = path.replace(/\.m4a$/i, '_compatible_aac.m4a');
        return dbService.getRelativePath(compatiblePath);
    }

    private async playElement(el: HTMLAudioElement, track?: TrackItem): Promise<void> {
        try {
            await el.play();
            return;
        } catch (e) {
            const playbackError = this.normalizePlaybackException(e);
            if (playbackError.code === 'format_unsupported' && track) {
                const fallbackSrc = this.buildCompatibleFallbackSrc(track);
                if (fallbackSrc && el.src !== fallbackSrc) {
                    const previousSrc = el.src;
                    try {
                        el.src = fallbackSrc;
                        await el.play();
                        return;
                    } catch (fallbackError) {
                        el.src = previousSrc;
                        const normalizedFallbackError = this.normalizePlaybackException(fallbackError);
                        if (this.onError) this.onError(normalizedFallbackError);
                        throw normalizedFallbackError;
                    }
                }
            }

            if (this.onError) this.onError(playbackError);
            throw playbackError;
        }
    }


    private initAudioContext() {
        if (!this.audioContext && typeof window !== 'undefined') {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            this.audioContext = ctx;
            const source1 = ctx.createMediaElementSource(this.audioElement);
            const source2 = ctx.createMediaElementSource(this.secondaryAudioElement);

            this.gainNode = ctx.createGain();
            this.secondaryGainNode = ctx.createGain();

            this.analyserNode = ctx.createAnalyser();
            this.analyserNode.fftSize = 256;

            // Setup 10-band EQ (32Hz to 16kHz)
            const freqs = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
            this.eqBands = freqs.map((freq, index) => {
                const filter = ctx.createBiquadFilter();
                if (index === 0) filter.type = 'lowshelf';
                else if (index === freqs.length - 1) filter.type = 'highshelf';
                else filter.type = 'peaking';
                filter.frequency.value = freq;
                filter.gain.value = 0; // default flat
                return filter;
            });

            // Connect EQ in series
            for (let i = 0; i < this.eqBands.length - 1; i++) {
                this.eqBands[i].connect(this.eqBands[i + 1]);
            }

            // Routing
            source1.connect(this.gainNode);
            source2.connect(this.secondaryGainNode);

            this.gainNode.connect(this.eqBands[0]);
            this.secondaryGainNode.connect(this.eqBands[0]);

            this.eqBands[this.eqBands.length - 1].connect(this.analyserNode);
            this.analyserNode.connect(ctx.destination);
        }
    }

    private createMediaError(error: MediaError | null): AudioPlaybackError {
        if (!error) {
            return new AudioPlaybackError('unknown', 'Unknown audio error.');
        }

        switch (error.code) {
            case error.MEDIA_ERR_ABORTED:
                return new AudioPlaybackError('media_aborted', 'Playback was interrupted before completion.');
            case error.MEDIA_ERR_NETWORK:
                return new AudioPlaybackError('media_network', 'Network or file access error while loading audio.');
            case error.MEDIA_ERR_DECODE:
                return new AudioPlaybackError('media_decode', 'This file could not be decoded by the audio engine.');
            case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
                return new AudioPlaybackError('format_unsupported', 'This audio format is not supported in your browser.');
            default:
                return new AudioPlaybackError('unknown', 'Unknown audio error.');
        }
    }

    private normalizePlaybackException(error: unknown): AudioPlaybackError {
        if (error instanceof AudioPlaybackError) return error;
        if (error instanceof DOMException) {
            if (error.name === 'NotAllowedError') {
                return new AudioPlaybackError('autoplay_blocked', 'Playback is blocked by browser autoplay policy.');
            }
            if (error.name === 'AbortError') {
                return new AudioPlaybackError('playback_interrupted', 'Playback request was interrupted.');
            }
            if (error.name === 'NotSupportedError') {
                return new AudioPlaybackError('format_unsupported', 'This file format is not supported.');
            }
        }
        if (error instanceof Error) {
            return new AudioPlaybackError('unknown', error.message || 'Unknown playback failure.');
        }
        return new AudioPlaybackError('unknown', 'Unknown playback failure.');
    }

    /**
     * Set gain for a specific EQ band (0-4)
     */
    setEqBand(index: number, value: number) {
        if (this.eqBands[index]) {
            this.eqBands[index].gain.value = value;
        }
    }

    /**
     * Enable or disable EQ (flat vs bands)
     */
    setEqEnabled(enabled: boolean, savedBands: number[]) {
        if (!this.audioContext) return;
        this.eqBands.forEach((band, index) => {
            band.gain.value = enabled ? savedBands[index] : 0;
        });
    }

    /**
     * Starts or resumes playback of the current track, optionally with crossfade.
     */
    async play(track?: TrackItem, useCrossfade: boolean = false, crossfadeDuration: number = 2): Promise<void> {
        if (track) {
            const isDifferentTrack = this.currentTrack?.logic.hash_sha256 !== track.logic.hash_sha256;
            const isPreloaded = this.nextTrackPreloaded?.logic.hash_sha256 === track.logic.hash_sha256;

            if (isDifferentTrack) {
                if (!this.audioContext) {
                    this.initAudioContext();
                }

                if (isPreloaded) {
                    // Optimized: Use the preloaded element
                    const fadeOutEl = this.getActiveElement();
                    const fadeOutGain = this.getActiveGainNode();

                    this.activeAudioElement = this.activeAudioElement === 1 ? 2 : 1;
                    const fadeInEl = this.getActiveElement();
                    const fadeInGain = this.getActiveGainNode();

                    this.currentTrack = track;
                    this.nextTrackPreloaded = null;

                    if (useCrossfade && this.audioContext && fadeOutGain && fadeInGain) {
                        const now = this.audioContext.currentTime;
                        const maxVol = fadeInEl.volume;

                        fadeOutGain.gain.cancelScheduledValues(now);
                        fadeOutGain.gain.setValueAtTime(maxVol, now);
                        fadeOutGain.gain.linearRampToValueAtTime(0.01, now + crossfadeDuration);

                        fadeInGain.gain.cancelScheduledValues(now);
                        fadeInGain.gain.setValueAtTime(0.01, now);
                        fadeInGain.gain.linearRampToValueAtTime(maxVol, now + crossfadeDuration);

                        setTimeout(() => { fadeOutEl.pause(); }, crossfadeDuration * 1000);
                    } else {
                        fadeOutEl.pause();
                        if (this.audioContext && fadeInGain) {
                            fadeInGain.gain.setValueAtTime(fadeInEl.volume, this.audioContext.currentTime);
                        }
                    }

                    await this.playElement(fadeInEl, track);
                } else {
                    // Normal play (not preloaded)
                    const relativePath = dbService.getRelativePath(track.file.path);

                    if (useCrossfade && this.currentTrack && !this.getActiveElement().paused) {
                        const fadeOutEl = this.getActiveElement();
                        const fadeOutGain = this.getActiveGainNode();

                        this.activeAudioElement = this.activeAudioElement === 1 ? 2 : 1;
                        const fadeInEl = this.getActiveElement();
                        const fadeInGain = this.getActiveGainNode();

                        fadeInEl.src = relativePath;
                        this.currentTrack = track;

                        if (this.audioContext && fadeOutGain && fadeInGain) {
                            const now = this.audioContext.currentTime;
                            const maxVol = fadeInEl.volume;

                            fadeOutGain.gain.cancelScheduledValues(now);
                            fadeOutGain.gain.setValueAtTime(maxVol, now);
                            fadeOutGain.gain.linearRampToValueAtTime(0.01, now + crossfadeDuration);

                            fadeInGain.gain.cancelScheduledValues(now);
                            fadeInGain.gain.setValueAtTime(0.01, now);
                            fadeInGain.gain.linearRampToValueAtTime(maxVol, now + crossfadeDuration);

                            setTimeout(() => { fadeOutEl.pause(); }, crossfadeDuration * 1000);
                        }

                        await this.playElement(fadeInEl, track);
                    } else {
                        const activeEl = this.getActiveElement();
                        const activeGain = this.getActiveGainNode();
                        activeEl.src = relativePath;
                        this.currentTrack = track;

                        if (this.audioContext && activeGain) {
                            activeGain.gain.setValueAtTime(activeEl.volume, this.audioContext.currentTime);
                        }

                        await this.playElement(activeEl, track);
                    }
                }
            } else {
                // Same track, just resume
                await this.playElement(this.getActiveElement(), track);
            }
        } else {
            // General resume
            await this.playElement(this.getActiveElement(), this.currentTrack || undefined);
        }

        if (this.audioContext && this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
    }

    /**
     * Loads a track without playing it, setting the position.
     * Useful for restoring state on load.
     */
    load(track: TrackItem, position: number = 0): void {
        this.currentTrack = track;
        const relativePath = dbService.getRelativePath(track.file.path);
        const activeEl = this.getActiveElement();
        activeEl.src = relativePath;
        activeEl.currentTime = position;
    }

    /**
     * Pauses the current playback.
     */
    pause(): void {
        this.getActiveElement().pause();
    }

    /**
     * Sets the master volume of the audio engine.
     * @param level - Volume level between 0.0 and 1.0
     */
    setVolume(level: number): void {
        this.userVolume = this.clamp(level, 0, 1);
        this.applyOutputVolume();
    }

    setVolumeNormalization(enabled: boolean, strength: number): void {
        this.normalizationEnabled = enabled;
        this.normalizationStrength = this.clamp(strength, 0, 100);
        if (!enabled) {
            this.normalizationMultiplier = 1;
        }
        this.applyOutputVolume();
    }

    /**
     * Seeks to a specific timestamp in the current track.
     * @param time - Time in seconds to seek to
     */
    seek(time: number): void {
        this.getActiveElement().currentTime = time;
    }

    /**
     * Stops playback entirely — pauses and resets to beginning.
     */
    stop(): void {
        const el = this.getActiveElement();
        el.pause();
        el.currentTime = 0;
    }

    /**
     * Seeks relative to the current position.
     * @param seconds - Positive for forward, negative for rewind
     */
    seekRelative(seconds: number): void {
        const el = this.getActiveElement();
        const target = Math.max(0, Math.min(el.duration || 0, el.currentTime + seconds));
        el.currentTime = target;
    }

    /**
     * Prepares the next track in a secondary buffer to ensure gapless playback.
     * @param nextTrack - The track to preload 5 seconds before current ends
     */
    prepareGapless(nextTrack: TrackItem): void {
        if (!nextTrack) return;
        this.nextTrackPreloaded = nextTrack;
        const relativePath = dbService.getRelativePath(nextTrack.file.path);

        // We preload into the currently inactive element
        const inactiveEl = this.getInactiveElement();
        inactiveEl.src = relativePath;
        inactiveEl.preload = 'auto';
    }

    /**
     * Fisher-Yates array shuffle implementation.
     */
    shuffleArray<T>(array: T[]): T[] {
        const result = [...array];
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    }
}

export const audioEngine = new AudioEngine();
