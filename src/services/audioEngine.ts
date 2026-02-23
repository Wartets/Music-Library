import { TrackItem } from '../types/music';
import { dbService } from './db';

/**
 * Audio Engine Service
 * Manages HTML5 Audio / Web Audio API operations with bit-perfect ambition.
 * Handles play, pause, volume, gapless playback, and audio manipulations.
 */

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
                    const error = el.error;
                    let message = 'Unknown audio error';
                    if (error) {
                        switch (error.code) {
                            case error.MEDIA_ERR_ABORTED: message = 'Fetching process aborted'; break;
                            case error.MEDIA_ERR_NETWORK: message = 'A network error occurred while fetching the audio'; break;
                            case error.MEDIA_ERR_DECODE: message = 'An error occurred while decoding the audio'; break;
                            case error.MEDIA_ERR_SRC_NOT_SUPPORTED: message = 'The audio format is not supported by your browser (e.g. ALAC)'; break;
                        }
                    }
                    this.onError(new Error(message));
                }
            });
        };

        setupForElement(this.audioElement);
        setupForElement(this.secondaryAudioElement);
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

                    try {
                        await fadeInEl.play();
                    } catch (e) {
                        console.error("AudioEngine play error (preloaded):", e);
                        throw e;
                    }
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

                        try {
                            await fadeInEl.play();
                        } catch (e) {
                            console.error("AudioEngine play error (crossfade):", e);
                            throw e;
                        }
                    } else {
                        const activeEl = this.getActiveElement();
                        const activeGain = this.getActiveGainNode();
                        activeEl.src = relativePath;
                        this.currentTrack = track;

                        if (this.audioContext && activeGain) {
                            activeGain.gain.setValueAtTime(activeEl.volume, this.audioContext.currentTime);
                        }

                        try {
                            await activeEl.play();
                        } catch (e) {
                            console.error("AudioEngine play error (normal):", e);
                            throw e;
                        }
                    }
                }
            } else {
                // Same track, just resume
                try {
                    await this.getActiveElement().play();
                } catch (e) {
                    console.error("AudioEngine play error (resume same):", e);
                    throw e;
                }
            }
        } else {
            // General resume
            try {
                await this.getActiveElement().play();
            } catch (e) {
                console.error("AudioEngine play error (general resume):", e);
                throw e;
            }
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
        this.audioElement.volume = level;
        this.secondaryAudioElement.volume = level;

        // When not crossfading, keep gain nodes at sync with volume level
        // (If crossfading, gain Nodes are being changed by AudioParam ramps, so we don't immediately override)
        if (this.gainNode) {
            this.gainNode.gain.setValueAtTime(level, this.audioContext?.currentTime || 0);
        }
        if (this.secondaryGainNode) {
            this.secondaryGainNode.gain.setValueAtTime(level, this.audioContext?.currentTime || 0);
        }
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
