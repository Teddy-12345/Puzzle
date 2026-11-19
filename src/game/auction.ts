/** Call/rob auction. Seats that already declined calling cannot rob later. */
export class RobAuction {
  caller = -1;
  winner = -1;
  robs = 0;
  turn: number;
  phase: 'calling' | 'robbing' | 'counter' | 'done' = 'calling';
  private remaining: number[];
  constructor(first: number) { this.turn=first;this.remaining=[(first+1)%3,(first+2)%3]; }
  act(seat:number, accept:boolean) {
    if(seat!==this.turn||this.phase==='done')return {legal:false,done:false,redeal:false};
    if(this.phase==='calling'&&accept){this.caller=seat;this.winner=seat;this.phase='robbing';}
    else if(this.phase!=='calling'&&accept){this.winner=seat;this.robs++;}
    if(this.phase==='counter'){this.phase='done';return {legal:true,done:true,redeal:false};}
    const next=this.remaining.shift();
    if(next!==undefined){this.turn=next;return {legal:true,done:false,redeal:false};}
    if(this.caller<0)return {legal:true,done:false,redeal:true};
    if(this.winner!==this.caller){this.turn=this.caller;this.phase='counter';return {legal:true,done:false,redeal:false};}
    this.phase='done';return {legal:true,done:true,redeal:false};
  }
  get multiplier(){return 2**this.robs;}
}
