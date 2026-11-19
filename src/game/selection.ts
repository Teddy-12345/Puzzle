import * as raw from './rules.js';
const rules:any=raw;
/** Only use touched cards. Prefer an exact legal shape, then longest normal shape;
 * responding never upgrades to a bomb when a normal reply exists. */
export function smartSelection(touched:number[], lastPlay:any=null, fullHand:number[]=touched):number[]{
 const cards=[...new Set(touched)];if(!cards.length)return [];
 const exact=rules.classify(cards);
 if(exact&&(!lastPlay||rules.beats(exact,lastPlay)))return cards;
 const moves=rules.generateMoves(cards,lastPlay,{wingChoices:3,maxMoves:1200});
 const full=rules.countsOf(fullHand);
 const brokenBomb=(m:any)=>{const used=rules.countsOf(m.cards);return full.reduce((n:number,count:number,rank:number)=>n+(count===4&&used[rank]>0&&used[rank]<4?1:0),0);};
 moves.sort((a:any,b:any)=>Number(rules.isBombLike(a))-Number(rules.isBombLike(b))||brokenBomb(a)-brokenBomb(b)||b.cards.length-a.cards.length||a.rank-b.rank);
 return moves[0]?.cards||[];
}
export function selectionPlayable(hand:number[], selected:number[], lastPlay:any=null):boolean{
 if(!selected.length||new Set(selected).size!==selected.length||selected.some(c=>!hand.includes(c)))return false;
 const shape=rules.classify(selected);return !!shape&&(!lastPlay||rules.beats(shape,lastPlay));
}
export function hasReply(hand:number[],lastPlay:any=null):boolean{return rules.generateMoves(hand,lastPlay).length>0;}
/** Resolve only after release. Repeating the exact range lowers its prior legal selection. */
export function resolveDragSelection(touched:number[],before:number[],lastPlay:any,fullHand:number[],previousRange:string){
 const range=[...new Set(touched)].sort((a,b)=>a-b).join(',');
 const chosen=smartSelection(touched,lastPlay,fullHand);
 const lowering=range===previousRange&&chosen.length>0&&chosen.every(c=>before.includes(c));
 return {cards:lowering?before.filter(c=>!chosen.includes(c)):chosen,range};
}
