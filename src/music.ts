export type Track = 'Welcome' | 'Normal' | 'Normal-Exciting' | 'fight' | 'Win' | 'Lose';
interface MusicState {
  playCount: number[];
  hands: number[][];
}

/** Persistent player: early play is protected; intensity only rises within a round. */
export class TableMusic {
  private audio = new Audio();
  private track: Track | null = null;
  private stage = 0;
  private baseVolume = 0.5;
  private masterMuted = false;
  private active = true;
  get enabled() {return this.active;}
  setEnabled(enabled:boolean) {this.active=enabled;this.applyMuted();try{localStorage.setItem('gamebox-music-enabled',String(enabled));}catch{}}
  private applyMuted(){this.audio.muted=this.masterMuted||!this.active;}
  setDucked(_active:boolean) {}
  private applyVolume() {this.audio.volume=this.baseVolume;}
  get muted() { return this.masterMuted; }
  get volume() { return this.baseVolume; }
  setMuted(muted: boolean) { this.masterMuted = muted; this.applyMuted(); try { localStorage.setItem('gamebox-muted',String(muted)); } catch {} }
  setVolume(volume: number) { this.baseVolume = Math.max(0,Math.min(1,volume)); this.applyVolume(); try { localStorage.setItem('gamebox-volume',String(this.baseVolume)); } catch {} }
  private retry = () => {
    if (this.track && this.audio.paused && !this.audio.ended) void this.audio.play().catch(() => {});
  };

  constructor() {
    this.audio.volume = 0.5;
    try {this.masterMuted=localStorage.getItem('gamebox-muted')==='true';this.active=localStorage.getItem('gamebox-music-enabled')!=='false';} catch {}
    this.applyMuted();
    this.audio.preload = 'auto';
    document.addEventListener('pointerdown', this.retry);
    document.addEventListener('keydown', this.retry);
  }

  newRound() { this.stage = 0; this.play('Normal', true); }
  welcome() { this.stage = 0; this.play('Welcome', true); }

  /** Called only after a legal card play, never on selection, hints or passes. */
  afterPlay(game: MusicState, move: { type: string; len: number }) {
    const played = game.playCount.reduce((sum, count) => sum + count, 0);
    if (played < 6) return;
    const explosive = ['bomb', 'rocket', 'plane', 'plane_solo', 'plane_pair'].includes(move.type);
    const longPairs = move.type === 'pair_straight' && move.len >= 4;
    const endgame = game.hands.some(hand => hand.length <= 3);
    this.stage = Math.max(this.stage, explosive || longPairs || endgame ? 2 : 1);
    this.play(this.stage === 2 ? 'fight' : 'Normal-Exciting', true);
  }

  finish(won: boolean) { this.play(won ? 'Win' : 'Lose', false); }
  stop() { this.audio.pause(); this.audio.currentTime = 0; this.track = null; }

  private play(track: Track, loop: boolean) {
    if (this.track === track && this.audio.loop === loop) return;
    this.audio.pause();
    this.track = track;
    this.audio.src = '/assets/Sound/MusicEx/' + track + '.ogg';
    this.audio.loop = loop;
    void this.audio.play().catch(() => {});
  }
}

