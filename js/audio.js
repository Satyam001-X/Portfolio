/**
 * CyberHUD Audio Synthesizer (Web Audio API)
 * Zero external audio files required - 100% reliable synthesized sound FX
 */
class SoundEngine {
    constructor() {
        this.ctx = null;
        this.soundEnabled = true;
        this.ambientNode = null;
        this.ambientGain = null;
        this.currentAmbientType = null;
        
        // Restore sound preference
        const saved = localStorage.getItem('cyberhud_sound_enabled');
        if (saved !== null) {
            this.soundEnabled = JSON.parse(saved);
        }
    }

    init() {
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                this.ctx = new AudioCtx();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    toggleSound(forceState = null) {
        this.soundEnabled = forceState !== null ? forceState : !this.soundEnabled;
        localStorage.setItem('cyberhud_sound_enabled', JSON.stringify(this.soundEnabled));
        if (!this.soundEnabled && this.ambientNode) {
            this.stopAmbient();
        }
        return this.soundEnabled;
    }

    // High tech UI click
    playClick() {
        if (!this.soundEnabled) return;
        this.init();
        if (!this.ctx) return;

        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1200, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(400, this.ctx.currentTime + 0.04);
            
            gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);
            
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            
            osc.start();
            osc.stop(this.ctx.currentTime + 0.05);
        } catch (e) {
            console.warn('Audio play error', e);
        }
    }

    // Hover blip
    playHover() {
        if (!this.soundEnabled) return;
        this.init();
        if (!this.ctx) return;

        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(800, this.ctx.currentTime);
            osc.frequency.setValueAtTime(1000, this.ctx.currentTime + 0.02);
            
            gain.gain.setValueAtTime(0.03, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.03);
            
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            
            osc.start();
            osc.stop(this.ctx.currentTime + 0.03);
        } catch (e) {}
    }

    // Success / Arc Reactor charge
    playSuccess() {
        if (!this.soundEnabled) return;
        this.init();
        if (!this.ctx) return;

        try {
            const now = this.ctx.currentTime;
            const osc1 = this.ctx.createOscillator();
            const osc2 = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(523.25, now); // C5
            osc1.frequency.setValueAtTime(659.25, now + 0.08); // E5
            osc1.frequency.setValueAtTime(783.99, now + 0.16); // G5
            osc1.frequency.setValueAtTime(1046.50, now + 0.24); // C6

            osc2.type = 'triangle';
            osc2.frequency.setValueAtTime(261.63, now); // C4
            osc2.frequency.linearRampToValueAtTime(523.25, now + 0.35);

            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(this.ctx.destination);

            osc1.start();
            osc2.start();
            osc1.stop(now + 0.45);
            osc2.stop(now + 0.45);
        } catch (e) {}
    }

    // Timer / Warning Alarm
    playAlarm() {
        if (!this.soundEnabled) return;
        this.init();
        if (!this.ctx) return;

        try {
            const now = this.ctx.currentTime;
            for (let i = 0; i < 3; i++) {
                const startTime = now + i * 0.18;
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();

                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(880, startTime);
                osc.frequency.linearRampToValueAtTime(1760, startTime + 0.08);

                gain.gain.setValueAtTime(0.15, startTime);
                gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.12);

                osc.connect(gain);
                gain.connect(this.ctx.destination);

                osc.start(startTime);
                osc.stop(startTime + 0.13);
            }
        } catch (e) {}
    }

    // Exam start chime / HUD boot
    playBoot() {
        if (!this.soundEnabled) return;
        this.init();
        if (!this.ctx) return;

        try {
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const filter = this.ctx.createBiquadFilter();
            const gain = this.ctx.createGain();

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(110, now);
            osc.frequency.exponentialRampToValueAtTime(440, now + 0.3);

            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(200, now);
            filter.frequency.exponentialRampToValueAtTime(3000, now + 0.3);

            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + 0.4);
        } catch (e) {}
    }

    // Question navigation blip
    playNav() {
        if (!this.soundEnabled) return;
        this.init();
        if (!this.ctx) return;

        try {
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(900, now);
            osc.frequency.setValueAtTime(1200, now + 0.04);

            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + 0.09);
        } catch (e) {}
    }

    // Ambient Sound Generator (Binaural 40Hz, Deep Space, Sci-Fi Hum, Cosmic Noise)
    startAmbient(type) {
        if (!this.soundEnabled) return;
        this.init();
        if (!this.ctx) return;

        this.stopAmbient();
        this.currentAmbientType = type;

        try {
            this.ambientGain = this.ctx.createGain();
            this.ambientGain.gain.setValueAtTime(0.01, this.ctx.currentTime);
            this.ambientGain.gain.linearRampToValueAtTime(0.08, this.ctx.currentTime + 1.0);
            this.ambientGain.connect(this.ctx.destination);

            if (type === 'binaural') {
                // 40Hz Gamma Focus Beat (left 200Hz, right 240Hz)
                const oscLeft = this.ctx.createOscillator();
                const oscRight = this.ctx.createOscillator();
                const merger = this.ctx.createChannelMerger(2);

                oscLeft.type = 'sine';
                oscLeft.frequency.value = 200;
                oscRight.type = 'sine';
                oscRight.frequency.value = 240;

                oscLeft.connect(merger, 0, 0);
                oscRight.connect(merger, 0, 1);
                merger.connect(this.ambientGain);

                oscLeft.start();
                oscRight.start();
                this.ambientNode = {
                    stop: () => {
                        try {
                            oscLeft.stop();
                            oscRight.stop();
                        } catch (e) {}
                    }
                };
            } else if (type === 'scifihum') {
                // Low Iron Man Arc Core hum
                const osc = this.ctx.createOscillator();
                const oscSub = this.ctx.createOscillator();
                const filter = this.ctx.createBiquadFilter();

                osc.type = 'sawtooth';
                osc.frequency.value = 65.4; // C2
                oscSub.type = 'sine';
                oscSub.frequency.value = 32.7; // C1

                filter.type = 'lowpass';
                filter.frequency.value = 180;

                osc.connect(filter);
                oscSub.connect(filter);
                filter.connect(this.ambientGain);

                osc.start();
                oscSub.start();
                this.ambientNode = {
                    stop: () => {
                        try {
                            osc.stop();
                            oscSub.stop();
                        } catch (e) {}
                    }
                };
            } else if (type === 'cosmic' || type === 'rain') {
                // White noise buffer with filter
                const bufferSize = this.ctx.sampleRate * 2;
                const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    data[i] = Math.random() * 2 - 1;
                }

                const noise = this.ctx.createBufferSource();
                noise.buffer = buffer;
                noise.loop = true;

                const filter = this.ctx.createBiquadFilter();
                filter.type = type === 'rain' ? 'lowpass' : 'bandpass';
                filter.frequency.value = type === 'rain' ? 800 : 400;
                filter.Q.value = 1.2;

                noise.connect(filter);
                filter.connect(this.ambientGain);

                noise.start();
                this.ambientNode = {
                    stop: () => {
                        try {
                            noise.stop();
                        } catch (e) {}
                    }
                };
            }
        } catch (e) {
            console.error('Ambient audio error', e);
        }
    }

    stopAmbient() {
        if (this.ambientNode && this.ambientGain && this.ctx) {
            try {
                this.ambientGain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.5);
                setTimeout(() => {
                    if (this.ambientNode) {
                        this.ambientNode.stop();
                        this.ambientNode = null;
                    }
                    this.ambientGain = null;
                    this.currentAmbientType = null;
                }, 500);
            } catch (e) {
                this.ambientNode = null;
            }
        }
    }
}

// Global instance
window.soundFX = new SoundEngine();
