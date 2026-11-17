/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private motorOsc: OscillatorNode | null = null;
  private motorGain: GainNode | null = null;
  private lidarOsc: OscillatorNode | null = null;
  private lidarGain: GainNode | null = null;
  public isMuted = false;

  private initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public startMotorSound() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    if (!this.motorOsc) {
      try {
        this.motorOsc = this.ctx.createOscillator();
        this.motorOsc.type = 'sawtooth';
        this.motorOsc.frequency.setValueAtTime(60, this.ctx.currentTime);

        this.motorGain = this.ctx.createGain();
        this.motorGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(450, this.ctx.currentTime);

        this.motorOsc.connect(filter);
        filter.connect(this.motorGain);
        this.motorGain.connect(this.ctx.destination);

        this.motorOsc.start();
      } catch (e) {
        console.warn('Audio not allowed yet:', e);
      }
    }

    if (!this.lidarOsc) {
      try {
        this.lidarOsc = this.ctx.createOscillator();
        this.lidarOsc.type = 'sine';
        this.lidarOsc.frequency.setValueAtTime(140, this.ctx.currentTime);

        this.lidarGain = this.ctx.createGain();
        this.lidarGain.gain.setValueAtTime(0.015, this.ctx.currentTime);

        this.lidarOsc.connect(this.lidarGain);
        this.lidarGain.connect(this.ctx.destination);
        this.lidarOsc.start();
      } catch (e) {}
    }
  }

  public updateMotorSound(rpm: number) {
    if (this.isMuted || !this.ctx || !this.motorOsc || !this.motorGain) return;
    const absRpm = Math.abs(rpm);
    const targetFreq = 70 + absRpm * 1.8;
    const targetGain = absRpm > 5 ? Math.min(0.08, (absRpm / 200) * 0.08) : 0;

    const t = this.ctx.currentTime;
    this.motorOsc.frequency.setTargetAtTime(targetFreq, t, 0.05);
    this.motorGain.gain.setTargetAtTime(targetGain, t, 0.05);
  }

  public playObstacleAlert() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, this.ctx.currentTime); // A5 note
      osc.frequency.exponentialRampToValueAtTime(1320, this.ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.16);
    } catch (e) {}
  }

  public playClick() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(400, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(150, this.ctx.currentTime + 0.04);

      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.06);
    } catch (e) {}
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.isMuted && this.motorGain && this.ctx) {
      this.motorGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.01);
      if (this.lidarGain) this.lidarGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.01);
    } else if (!this.isMuted && this.lidarGain && this.ctx) {
      this.lidarGain.gain.setTargetAtTime(0.015, this.ctx.currentTime, 0.01);
    }
    return this.isMuted;
  }
}

export const soundEngine = new SoundEngine();
