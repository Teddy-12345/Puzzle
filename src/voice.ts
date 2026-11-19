export type Voice = 'Man' | 'Woman';
export function cardVoice(type: string, rank: number) {
  // Audio IDs use A=1, 2=2, 3..K=3..13, small/big joker=14/15.
  const number = rank === 11 ? 1 : rank === 12 ? 2 : rank >= 13 ? rank + 1 : rank + 3;
  const special: Record<string,string> = {straight:'shunzi',pair_straight:'liandui',plane:'feiji',plane_solo:'feiji',plane_pair:'feiji',trio_solo:'sandaiyi',trio_pair:'sandaiyidui',four_solo:'sidaier',four_pair:'sidailiangdui',bomb:'zhadan',rocket:'wangzha'};
  if (type === 'solo') return String(number);
  if (type === 'pair') return 'dui' + number;
  if (type === 'trio') return 'tuple' + number;
  return special[type] || null;
}

/** One speech channel, bounded queue; old round speech never leaks into a new round. */
export class GameVoice {
  private audio = new Audio();
  private queue: string[] = [];
  private busy = false;
  private release: (()=>void) | undefined;
  private selected: Voice = 'Woman';
  private level = 1;
  private active = true;
  private masterMuted = false;
  get enabled(){return this.active;}
  setEnabled(enabled:boolean){this.active=enabled;this.setMuted(this.masterMuted);try{localStorage.setItem('gamebox-effects-enabled',String(enabled));}catch{}}
  get gender() { return this.selected; }
  get volume() { return this.level; }
  constructor(private duck: (active:boolean)=>void) {
    try { this.selected=localStorage.getItem('gamebox-voice')==='Man'?'Man':'Woman';this.active=localStorage.getItem('gamebox-effects-enabled')!=='false'; } catch {}
    this.audio.volume=this.level;this.setMuted(false);
  }
  setGender(gender:Voice) { this.stop();this.selected=gender;try{localStorage.setItem('gamebox-voice',gender);}catch{} }
  setVolume(volume:number) { this.level=Math.max(0,Math.min(1,volume));this.audio.volume=this.level;try{localStorage.setItem('gamebox-voice-volume',String(this.level));}catch{} }
  setMuted(muted:boolean) { this.masterMuted=muted;this.audio.muted=muted||!this.active;if(this.audio.muted)this.stop(); }
  say(clip:string|null) { if(!clip||this.audio.muted||this.level===0)return;this.queue.push(clip);if(this.queue.length>3)this.queue.shift();this.next(); }
  stop() { this.queue=[];this.release?.();this.audio.pause();this.audio.currentTime=0;this.busy=false;this.duck(false); }
  private next() {
    if(this.busy)return;const clip=this.queue.shift();if(!clip){this.duck(false);return;}
    this.busy=true;this.duck(true);this.audio.src='/assets/Sound/'+this.selected+'/'+this.selected+'_'+clip+'.ogg';
    let watchdog: ReturnType<typeof setTimeout>;
    let completed=false;
    const finish=()=>{if(completed)return;completed=true;clearTimeout(watchdog);this.audio.onended=null;this.audio.onerror=null;this.release=undefined;this.busy=false;this.next();};
    this.release=finish;this.audio.onended=finish;this.audio.onerror=finish;
    watchdog=setTimeout(finish,8000);
    void this.audio.play().catch(finish);
  }
}
