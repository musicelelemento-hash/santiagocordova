/**
 * hapticAudioService.ts — Ultra-Luxury Zero-Bandwidth Procedural Audio Engine
 * =========================================================================
 * Apple-tier tactile audio synthesis using the native Web Audio API.
 * Generates ultrasonic clicks, crystal resonance hums, and success chimes
 * in real-time with 0 KB download overhead.
 */

class HapticAudioService {
    private ctx: AudioContext | null = null;
    private enabled: boolean = false;

    constructor() {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('sc_haptic_sound');
            this.enabled = saved === '1';
        }
    }

    private initContext(): AudioContext | null {
        if (typeof window === 'undefined') return null;
        if (!this.ctx) {
            const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            if (AudioContextClass) {
                this.ctx = new AudioContextClass();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }
        return this.ctx;
    }

    public isSoundEnabled(): boolean {
        return this.enabled;
    }

    public toggleSound(): boolean {
        this.enabled = !this.enabled;
        if (typeof window !== 'undefined') {
            localStorage.setItem('sc_haptic_sound', this.enabled ? '1' : '0');
        }
        if (this.enabled) {
            this.initContext();
            this.playCrystalResonance();
        }
        return this.enabled;
    }

    public setSoundEnabled(val: boolean): void {
        this.enabled = val;
        if (typeof window !== 'undefined') {
            localStorage.setItem('sc_haptic_sound', val ? '1' : '0');
        }
        if (val) {
            this.initContext();
        }
    }

    /**
     * Tactile Ultrasonic Click (Corona digital / haptic feedback)
     */
    public playClick(freq = 1100): void {
        if (!this.enabled) return;
        try {
            const ctx = this.initContext();
            if (!ctx) return;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(320, ctx.currentTime + 0.022);

            gain.gain.setValueAtTime(0.12, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.022);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start();
            osc.stop(ctx.currentTime + 0.023);
        } catch {
            // Audio context safely ignored if blocked by browser policy
        }
    }

    /**
     * 3D Obsidian / Crystal Resonance (880 Hz harmonic quartz hum)
     */
    public playCrystalResonance(): void {
        if (!this.enabled) return;
        try {
            const ctx = this.initContext();
            if (!ctx) return;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.19);

            gain.gain.setValueAtTime(0.18, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start();
            osc.stop(ctx.currentTime + 0.21);
        } catch {
            // Safe fallback
        }
    }

    /**
     * SRI Validation Success Chord (E-Major arpeggio: E5, G#5, B5)
     */
    public playSuccessChord(): void {
        if (!this.enabled) return;
        try {
            const ctx = this.initContext();
            if (!ctx) return;

            const notes = [659.25, 830.61, 987.77]; // E5, G#5, B5
            notes.forEach((freq, idx) => {
                const startTime = ctx.currentTime + idx * 0.055;
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, startTime);

                gain.gain.setValueAtTime(0.1, startTime);
                gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.24);

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start(startTime);
                osc.stop(startTime + 0.25);
            });
        } catch {
            // Safe fallback
        }
    }
}

export const hapticAudio = new HapticAudioService();
