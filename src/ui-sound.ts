export class UISound {
 private context:AudioContext|undefined;
 private cache=new Map<string,Promise<AudioBuffer>>();
 private last=new Map<string,number>();
 constructor(private enabled:()=>boolean){}
 play(name:string,gap=65){if(!this.enabled())return;const now=performance.now();if(now-(this.last.get(name)??-1000)<gap)return;this.last.set(name,now);this.context??=new AudioContext();const ctx=this.context;void ctx.resume();let buffer=this.cache.get(name);if(!buffer){buffer=fetch('/assets/Sound/UI/'+name+'.wav?v=2').then(r=>{if(!r.ok)throw Error('audio');return r.arrayBuffer();}).then(b=>ctx.decodeAudioData(b));this.cache.set(name,buffer);}void buffer.then(b=>{if(!this.enabled())return;const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=b;gain.gain.value=1;source.connect(gain).connect(ctx.destination);source.start();}).catch(()=>{});}
}
