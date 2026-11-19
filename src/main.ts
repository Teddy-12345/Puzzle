import {checkPuzzleUpdate} from './updates';
import {isTauri} from '@tauri-apps/api/core';
import {getCurrentWindow} from '@tauri-apps/api/window';
import * as kernel from './game/rules.js';
import Difficulty from './game/difficulty.js';
import {TableMusic} from './music';
import {GameVoice,cardVoice,type Voice} from './voice';
import {RobAuction} from './game/auction';
import {selectionPlayable,hasReply} from './game/selection';
import {loadProfile,saveProfile,escapeHTML,AVATARS,type Profile} from './profile';
import './style.css';
import {UISound} from './ui-sound';
const isAndroidApp=isTauri()&&/Android/i.test(navigator.userAgent);
const music=new TableMusic(),voice=new GameVoice(()=>{});voice.setMuted(music.muted);
const sfx=new UISound(()=>voice.enabled&&!music.muted);
const rules:any=kernel,root=document.querySelector<HTMLDivElement>('#app')!;
const asset=(p:string)=>'/assets/image/'+p;
const uiAssets=import.meta.glob('./assets/ui/*.png',{eager:true,query:'?url',import:'default'}) as Record<string,string>;
const uiImage=(n:string)=>'<img src="'+uiAssets['./assets/ui/'+n+'.png']+'" alt="" draggable="false">';
const lobbyImage=(n:string)=>'<img src="'+asset('大厅UI/'+n+'.png')+'" alt="">';
const icon=(n:string)=>{if(n==='window_minimize')return '<svg viewBox="0 0 192 192" aria-hidden="true" class="minimize-glyph"><path d="M51 96H141" fill="none" stroke="currentColor" stroke-width="13" stroke-linecap="round"/></svg>';const map:Record<string,string>={arrow_left:'back',close:'close',settings:'settings',sound:'sound',mute:'mute',info:'hint'};return map[n]?uiImage(map[n]):'<img src="/icons/'+n+'.svg" alt="">';};
const button=(id:string,n:string,label:string,extra='')=>'<button id="'+id+'" class="control '+extra+'" aria-label="'+label+'">'+icon(n)+'</button>';
const capsule=(id:string,label:string,gold=false)=>'<button id="'+id+'" class="control capsule '+(gold?'gold':'blue')+'" aria-label="'+label+'"><span>'+label+'</span></button>';
let profile=loadProfile(),page='home',game:any,auction:RobAuction,selected=new Set<number>();
let robotAvatars:string[]=[];
const flyingSeats=new Set<number>();
let tablePlays:(number[]|null)[]=[null,null,null],lastPlayedSeat=-1,lastDragRange='';
let bubbles=['','',''],effect='',generation=0,seq=0;
let timer:ReturnType<typeof setTimeout>|undefined,effectTimer:ReturnType<typeof setTimeout>|undefined;
const pending=new Map<number,(r:any)=>void>(),worker=new Worker(new URL('./game/ai/engine.worker.js',import.meta.url),{type:'module'});
worker.onmessage=({data})=>{if(data.type==='result'||data.type==='error'){pending.get(data.seq)?.(data);pending.delete(data.seq);}};
worker.onerror=()=>{for(const done of pending.values())done(null);pending.clear();};
function decide(seat:number):Promise<any>{return new Promise(resolve=>{const id=++seq;pending.set(id,resolve);worker.postMessage({type:'decide',seq:id,level:3,hand:game.hands[seat],lastPlay:game.lastPlay,ctx:rules.aiContext(game,seat)});});}
function isModalOpen(){return !!document.querySelector('dialog[open]');}
function hat(seat:number){return game.landlord<0?'':'<i class="identity-hat" aria-label="'+(game.landlord===seat?'地主':'农民')+'">'+uiImage(game.landlord===seat?'landlord':'farmer')+'</i>';}
function bubble(seat:number){return seat!==0&&bubbles[seat]?'<div class="speech seat-bubble-'+seat+'"><span>'+bubbles[seat]+'</span></div>':'';}
function profileChip(){return '<button class="profile-chip" id="profile" aria-label="个人信息">'+(profile.avatar?'<img class="chip-avatar" src="'+profile.avatar+'" alt="">':'<span class="empty-avatar" aria-hidden="true"></span>')+'<span>'+escapeHTML(profile.name)+'</span></button>';}
function chrome(){return (isAndroidApp?'':'<div class="drag" data-tauri-drag-region></div>')+(page!=='table'?profileChip():'')+(page!=='home'?button('back','arrow_left','返回'):'')+'<div class="game-tools">'+button('settings','settings','设置')+button('sound',music.muted?'mute':'sound',music.muted?'开启声音':'静音')+'</div>'+(isAndroidApp?'':'<div class="window-actions">'+button('min','window_minimize','最小化')+button('close','close','关闭')+'</div>');}
function tile(name:string,color:string,target:string,unavailable=false,art?:string){if(page!=='home')return '<button class="tile complete-secondary" data-page="'+target+'" data-unavailable="'+unavailable+'" aria-label="'+name+'"><img src="'+asset('二级完整按钮/'+name+'.png')+'" alt="" draggable="false"></button>';return '<button class="tile '+(unavailable?'unavailable':'')+'" data-page="'+target+'" data-unavailable="'+unavailable+'" aria-label="'+name+'" style="--base:url('+asset('大厅UI/tile-'+color+'.png')+')"><span class="tile-art '+(art?'clean':'')+'">'+(art?lobbyImage(art):'<img src="'+asset('button/'+name+'.png')+'" alt="">')+'</span><span class="tile-label">'+name+'</span></button>';}
function leaveTable(){document.querySelectorAll('.flight-layer').forEach(el=>el.remove());flyingSeats.clear();cancelHandGesture();generation++;clearTimeout(timer);clearTimeout(effectTimer);effect='';lastDragRange='';tablePlays=[null,null,null];lastPlayedSeat=-1;voice.stop();music.welcome();selected.clear();page=page==='table'?'poker':'home';render();}
function bindChrome(){
 document.getElementById('profile')?.addEventListener('click',openProfile);
 document.getElementById('settings')?.addEventListener('click',openSettings);
 document.getElementById('sound')?.addEventListener('click',()=>{music.setMuted(!music.muted);voice.setMuted(music.muted);render();});
 document.getElementById('back')?.addEventListener('click',()=>page==='table'?confirmAction('退出游戏','是否确认退出本局游戏？',leaveTable):leaveTable());
 document.getElementById('min')?.addEventListener('click',()=>{if(isTauri())void getCurrentWindow().minimize().catch(console.error);});
 document.getElementById('close')?.addEventListener('click',()=>confirmAction('关闭游戏','是否确认关闭游戏？',()=>{if(isTauri())void getCurrentWindow().close().catch(console.error);}));
}
let toastBusy=false;
const toast=document.createElement('div');toast.className='coming-toast';toast.setAttribute('role','status');document.body.append(toast);
function comingSoon(){if(toastBusy)return;sfx.play('hold');toastBusy=true;toast.textContent='敬请期待';toast.classList.add('visible');setTimeout(()=>{toast.classList.remove('visible');setTimeout(()=>{toastBusy=false;toast.textContent='';},350);},1200);}
const confirmDialog=document.createElement('dialog');confirmDialog.className='settings-dialog confirm-dialog';confirmDialog.setAttribute('aria-labelledby','confirm-title');document.body.append(confirmDialog);
let confirmed:(()=>void)|null=null;
function confirmAction(title:string,message:string,action:()=>void){sfx.play('popup');clearTimeout(timer);confirmed=action;confirmDialog.innerHTML='<div class="settings-heading"><h2 id="confirm-title">'+title+'</h2></div><p class="confirm-message">'+message+'</p><div class="confirm-actions">'+capsule('confirm-yes','确认',true)+capsule('confirm-no','取消')+'</div>';confirmDialog.querySelector('#confirm-yes')!.addEventListener('click',()=>{const fn=confirmed;confirmed=null;confirmDialog.close();fn?.();});confirmDialog.querySelector('#confirm-no')!.addEventListener('click',()=>confirmDialog.close());confirmDialog.showModal();(confirmDialog.querySelector('#confirm-no') as HTMLElement).focus();}
confirmDialog.addEventListener('close',()=>{confirmed=null;if(page==='table')schedule();});
const profileDialog=document.createElement('dialog');profileDialog.className='settings-dialog profile-dialog';profileDialog.setAttribute('aria-labelledby','profile-title');document.body.append(profileDialog);
let draft:Profile;
let profileRevision=0;
function openProfile(){sfx.play('popup');clearTimeout(timer);++profileRevision;draft={...profile};profileDialog.innerHTML='<div class="settings-heading"><h2 id="profile-title">个人信息</h2>'+button('profile-close','close','关闭个人信息')+'</div><div class="profile-body"><label class="nickname-row">昵称<input id="nickname" maxlength="32" value="'+escapeHTML(draft.name)+'" autocomplete="off" aria-label="昵称"></label><div class="avatar-picker" role="group" aria-label="选择头像">'+AVATARS.map((url,i)=>'<button class="avatar-option" data-avatar="'+url+'" aria-label="头像'+(i+1)+'" aria-pressed="'+(draft.avatar===url)+'"><img src="'+url+'" alt="" draggable="false"></button>').join('')+'</div><p class="profile-error" role="status"></p><div class="confirm-actions">'+capsule('profile-save','保存',true)+capsule('profile-cancel','取消')+'</div></div>';
 profileDialog.querySelectorAll<HTMLButtonElement>('[data-avatar]').forEach(el=>el.onclick=()=>{draft.avatar=el.dataset.avatar!;profileDialog.querySelectorAll<HTMLElement>('[data-avatar]').forEach(option=>option.setAttribute('aria-pressed',String(option===el)));});
 const close=()=>profileDialog.close();profileDialog.querySelector('#profile-close')!.addEventListener('click',close);profileDialog.querySelector('#profile-cancel')!.addEventListener('click',close);profileDialog.querySelector('#profile-save')!.addEventListener('click',()=>{try{draft.name=(profileDialog.querySelector('#nickname') as HTMLInputElement).value;profile=saveProfile(draft);profileDialog.close();render();}catch{profileDialog.querySelector('.profile-error')!.textContent='保存失败';}});profileDialog.showModal();}
profileDialog.addEventListener('close',()=>{++profileRevision;if(page==='table')schedule();});
const settingsDialog=document.createElement('dialog');settingsDialog.className='settings-dialog';settingsDialog.setAttribute('aria-labelledby','settings-title');
settingsDialog.innerHTML='<div class="settings-heading"><h2 id="settings-title">声音设置</h2>'+button('settings-close','close','关闭设置')+'</div><section class="settings-body"><label class="setting-row toggle-row"><span>音乐</span><input id="music-enabled" type="checkbox" role="switch" aria-label="音乐"><i class="toggle-track" aria-hidden="true"></i></label><label class="setting-row toggle-row"><span>音效</span><input id="effects-enabled" type="checkbox" role="switch" aria-label="音效"><i class="toggle-track" aria-hidden="true"></i></label><fieldset class="voice-options"><legend>播报声音</legend><label><input type="radio" name="voice" value="Man"><span>男声</span></label><label><input type="radio" name="voice" value="Woman"><span>女声</span></label></fieldset></section>';
document.body.append(settingsDialog);
settingsDialog.querySelector('h2')!.textContent='设置';
settingsDialog.querySelector('.settings-body')!.insertAdjacentHTML('beforeend','<div class="setting-row">'+capsule('check-update','检查更新')+'</div>');
settingsDialog.querySelector('#check-update')!.addEventListener('click',()=>{settingsDialog.close();void checkPuzzleUpdate(false);});
settingsDialog.querySelector('#settings-close')!.addEventListener('click',()=>settingsDialog.close());
settingsDialog.addEventListener('click',e=>{const b=settingsDialog.getBoundingClientRect();if(e.target===settingsDialog&&(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom))settingsDialog.close();});
settingsDialog.addEventListener('close',()=>{if(page==='table')schedule();document.getElementById('settings')?.focus();});
function settingsValues(){(settingsDialog.querySelector('#music-enabled') as HTMLInputElement).checked=music.enabled;(settingsDialog.querySelector('#effects-enabled') as HTMLInputElement).checked=voice.enabled;settingsDialog.querySelectorAll<HTMLInputElement>('input[name=voice]').forEach(el=>el.checked=el.value===voice.gender);}
function openSettings(){sfx.play('popup');clearTimeout(timer);settingsValues();if(!settingsDialog.open)settingsDialog.showModal();}
settingsDialog.querySelector('#music-enabled')!.addEventListener('change',e=>music.setEnabled((e.target as HTMLInputElement).checked));
settingsDialog.querySelector('#effects-enabled')!.addEventListener('change',e=>voice.setEnabled((e.target as HTMLInputElement).checked));
settingsDialog.querySelectorAll<HTMLInputElement>('input[name=voice]').forEach(el=>el.addEventListener('change',()=>voice.setGender(el.value as Voice)));

let turnNotice='';
function render() {
 const retainedHand=page==='table'?root.querySelector<HTMLElement>('.hand'):null;
 const handKey=page==='table'?generation+':'+game.hands[0].join(','):'';
 const keepHand=retainedHand?.dataset.handKey===handKey;
 if(page==='table'&&game.phase==='playing'&&game.turn===0&&!game.over){const key=generation+':'+game.log.length;if(key!==turnNotice){turnNotice=key;sfx.play('turn',300);}}
 root.className=(page==='table'?'in-table':'in-lobby')+(isAndroidApp?' android-app':'');
 let content='';
 if(page==='table')content=table();
 else if(page==='home')content='<main class="home-menu"><div class="primary-menu">'+tile('扑克','purple','poker')+tile('麻将','green','mahjong')+'</div><div class="secondary-menu">'+tile('象棋','orange','chess',true,'chess')+tile('黑白棋','green','go',true,'go')+tile('其他','purple','other',true,'controller')+'</div></main>';
 else if(page==='poker')content='<main class="menu poker-menu">'+tile('斗地主','orange','table')+tile('德州扑克','blue','texas',true)+'</main>';
 else content='<main class="menu many">'+['四川麻将','广东麻将','东北麻将','上海麻将','台湾麻将','国际麻将','武汉麻将','日本麻将','湖南麻将','香港麻将'].map(n=>tile(n,'green','mahjong-game',true)).join('')+'</main>';
 root.innerHTML=chrome()+content;if(page==='table'){const next=root.querySelector<HTMLElement>('.hand')!;if(keepHand&&retainedHand)next.replaceWith(retainedHand);else next.dataset.handKey=handKey;}root.querySelectorAll('img').forEach(img=>{img.draggable=false;img.onerror=()=>{const panel=img.closest('.result,.hand-effect');if(panel){panel.classList.add('art-unavailable');panel.setAttribute('data-fallback',panel.getAttribute('aria-label')||'');img.remove();}};});
 bindChrome();
 document.querySelectorAll<HTMLButtonElement>('[data-page]').forEach(el=>el.onclick=()=>{if(el.dataset.unavailable==='true'){comingSoon();return;}page=el.dataset.page!;if(page==='table') start();else render();});
 if(page==='table') { document.querySelectorAll<HTMLElement>('.hand .card').forEach((el,i)=>el.style.setProperty('--index',String(i))); bindTable(); }
}
function card(id: number, selectable=false) {
 const rank=rules.rankOf(id), suit=rules.suitOf(id), red=suit===1||suit===3||id===53;
 const point=rank>=13?'JOKER':rules.RANK_NAMES[rank];
 const flower=['黑桃','红桃','梅花','方块'][suit];
 return '<'+(selectable?'button':'div')+' class="card '+(selected.has(id)&&selectable?'selected':'')+' '+(rank>=13?'joker':rank===7?'rank-ten':'')+'" '+(selectable?'data-card="'+id+'" aria-label="'+rules.cardLabel(id)+'" aria-pressed="'+selected.has(id)+'"':'')+'><img class="card-base" src="'+asset('扑克/牌底/空白牌面.png')+'" alt="">'+(rank===7?'<span class="point ten-point"><img class="ten-one" src="'+asset('扑克/点数/'+(red?'红':'黑')+'/10.png')+'?v=3" alt=""><img class="ten-zero" src="'+asset('扑克/点数/'+(red?'红':'黑')+'/10.png')+'?v=3" alt=""></span>':'<img class="point" src="'+asset('扑克/点数/'+(red?'红':'黑')+'/'+point+'.png')+'" alt="">')+(rank<13?'<img class="suit" src="'+asset('扑克/花色/'+flower+'.png')+'" alt=""><img class="large-suit" src="'+asset('扑克/花色/'+flower+'.png')+'" alt="">':'<img class="joker-art" src="'+asset('扑克/大小王/'+(id===53?'大王金熊':'小王银熊')+'.png')+'" alt="">')+'</'+(selectable?'button':'div')+'>';
}
function backCard() {return '<div class="card"><img class="card-base" src="'+asset('扑克/牌底/蓝熊牌背.png')+'" alt=""></div>';}
function playerZone(seat:number){const names=[profile.name,'电脑1','电脑2'],images=[profile.avatar,robotAvatars[0],robotAvatars[1]];return '<div class="player-zone player-'+seat+'"><div class="player-portrait">'+(images[seat]?'<img class="portrait-image" src="'+images[seat]+'" alt="">':'<span class="empty-avatar" aria-hidden="true"></span>')+'</div><span class="player-name">'+escapeHTML(names[seat])+'</span>'+hat(seat)+'</div>';}
function seat(s:number){const active=(game.phase==='bidding'?game.bidTurn:game.turn)===s&&!game.over;return playerZone(s)+'<div class="opponent seat-'+s+' '+(active?'thinking':'')+'"><div class="opponent-hand">'+backCard()+backCard()+backCard()+'</div><span class="count">'+game.hands[s].length+'</span></div>'+bubble(s);}
function seatPlays(){return tablePlays.map((cards,seat)=>cards?'<div class="played played-seat-'+seat+(flyingSeats.has(seat)?' await-flight':'')+'" data-play-seat="'+seat+'">'+cards.map(c=>card(c)).join('')+'</div>':'').join('');}
function tracker(){const own=rules.countsOf(game.hands[0]);return '<div class="card-tracker" aria-label="记牌器：其他玩家及未揭晓底牌中剩余的点数"><span class="tracker-label">记牌器</span><div class="tracker-values">'+Array.from({length:15},(_,index)=>14-index).map(rank=>{const number=Math.max(0,rules.TOTAL_OF_RANK[rank]-own[rank]-game.playedCounts[rank]);return '<div class="tracker-rank '+(rank>=13?'joker-rank':'')+'"><b>'+(['小','大'][rank-13]||rules.RANK_NAMES[rank])+'</b><span>'+number+'</span></div>';}).join('')+'</div></div>';}

function table() {
 const human=game.phase==='bidding'?game.bidTurn===0:game.turn===0;
 let actions='';
 if(game.over&&!effect) actions=capsule('restart','再来一局',true)+capsule('lobby','返回大厅');
 else if(game.over) actions='';
 else if(game.phase==='bidding') actions=capsule('call',auction.phase==='calling'?'叫地主':'抢地主',true)+capsule('no-call',auction.phase==='calling'?'不叫':'不抢');
 else actions=capsule('pass','不出')+capsule('hint','提示')+capsule('play','出牌',true);
 const win=game.over && (game.landlord===0?game.landlordWin:!game.landlordWin);
 return '<main class="game-table" data-phase="'+game.phase+'"><div class="table-stage"><div class="table-plinth"></div><div class="felt"></div></div>'+tracker()+'<div class="bottom-cards">'+game.bottom.map((c:number)=>game.phase==='bidding'?backCard():card(c)).join('')+'</div>'+seat(2)+seat(1)+seatPlays()+(game.over&&!effect?'<div class="result '+(win?'win':'lose')+'" aria-label="'+(win?'胜利':'失败')+'">'+uiImage(win?'win':'lose')+'</div>':'')+'<div class="actions">'+actions+'</div><div class="hand" style="--n:'+game.hands[0].length+'">'+[...game.hands[0]].sort((a:number,b:number)=>b-a).map((c:number)=>card(c,true)).join('')+'</div>'+playerZone(0)+(effect?'<div class="hand-effect" role="status" aria-label="牌型提示">'+uiImage(effect)+'</div>':'')+'<div class="notice" role="status" aria-live="polite"></div></main>';
}

function bindTable() {
 const human=game.phase==='bidding'?game.bidTurn===0:game.turn===0;
 bindHandGesture();
 const on=(id:string,fn:()=>void)=>document.getElementById(id)?.addEventListener('click',fn);
 on('call',()=>bid(0,true));on('no-call',()=>bid(0,false));on('restart',()=>start());on('lobby',()=>document.getElementById('back')?.click());
 on('pass',()=>commit(0,null));on('play',()=>commit(0,[...selected]));
 on('hint',async()=>{const gen=generation;if(!human||game.over)return;const res=await decide(0);if(gen!==generation||!res||game.turn!==0||game.over)return;const pick=Difficulty.pickMove(res.candidates,3);const cards=pick?.cards?.length?pick.cards:res.candidates.find((c:any)=>c.cards?.length)?.cards;selected=new Set(cards||[]);render();});
 if(!human&&!game.over) document.querySelectorAll<HTMLButtonElement>('.actions button').forEach(b=>b.disabled=true);
 updateActionState();
}
function updateActionState(){
 const active=page==='table'&&game.phase==='playing'&&!game.over&&game.turn===0&&!isModalOpen();
 const playable=active&&selected.size>0;
 const hint=document.querySelector<HTMLButtonElement>('#hint');if(hint)hint.disabled=!active||!hasReply(game.hands[0],game.lastPlay);
 const play=document.querySelector<HTMLButtonElement>('#play');if(play)play.disabled=!playable;
 const pass=document.querySelector<HTMLButtonElement>('#pass');if(pass)pass.disabled=!active||!game.lastPlay;
}
function paintSelection(){document.querySelectorAll<HTMLElement>('.hand .card').forEach(el=>{const on=selected.has(Number(el.dataset.card));el.classList.toggle('selected',on);el.setAttribute('aria-pressed',String(on));});updateActionState();}
let cancelHandGesture=()=>{};
let boundHand:HTMLElement|null=null;
function bindHandGesture(){
 const hand=document.querySelector<HTMLElement>('.hand')!;
 if(boundHand===hand){paintSelection();return;}
 cancelHandGesture();
 boundHand=hand;
 const nodes=Array.from(hand.querySelectorAll<HTMLElement>('[data-card]'));
 const ids=nodes.map(node=>Number(node.dataset.card));
 type Gesture={pointerId:number;start:number;end:number;x:number;y:number;before:number[];moved:boolean;armed:boolean;cancelled:boolean;holdTimer:ReturnType<typeof setTimeout>|null};
 let gesture:Gesture|null=null;
 const indexAt=(x:number)=>{
  for(let i=nodes.length-1;i>=0;i--){const rect=nodes[i].getBoundingClientRect();if(x>=rect.left&&x<=rect.right)return i;}
  let best=0;for(let i=0;i<nodes.length;i++)if(x>=nodes[i].getBoundingClientRect().left)best=i;return best;
 };
 const preview=()=>{
  nodes.forEach((node,i)=>{
   const inRange=!!gesture?.armed&&i>=Math.min(gesture.start,gesture.end)&&i<=Math.max(gesture.start,gesture.end);
   node.classList.toggle('range-preview',inRange);
   node.classList.toggle('gesture-hold',!!gesture?.armed&&i===gesture.start);
  });
  hand.classList.toggle('gesture-ready',!!gesture?.armed);
 };
 const arm=(current:Gesture)=>{
  if(gesture!==current||current.cancelled)return;
  current.armed=true;current.holdTimer=null;preview();
 };
 const move=(e:PointerEvent)=>{
  if(!gesture||e.pointerId!==gesture.pointerId)return;
  e.preventDefault();
  const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;
  if(!gesture.armed){
   if(Math.hypot(dx,dy)>12){gesture.cancelled=true;if(gesture.holdTimer)clearTimeout(gesture.holdTimer);gesture.holdTimer=null;}
   return;
  }
  gesture.end=indexAt(e.clientX);
  gesture.moved ||=Math.hypot(dx,dy)>3||gesture.end!==gesture.start;
  preview();
 };
 const up=(e:PointerEvent)=>{
  if(!gesture||e.pointerId!==gesture.pointerId)return;
  const current=gesture;
  if(current.holdTimer)clearTimeout(current.holdTimer);
  if(current.armed){gesture.end=indexAt(e.clientX);gesture.moved ||=gesture.end!==gesture.start;}
  gesture=null;preview();
  if(current.cancelled)return;
  selected=new Set(current.before);
  if(current.moved&&current.armed){
   const range=ids.slice(Math.min(current.start,current.end),Math.max(current.start,current.end)+1);
   const lower=range.every(id=>selected.has(id));
   range.forEach(id=>lower?selected.delete(id):selected.add(id));
   sfx.play(lower?'tick':'lift');
  }else if(!current.moved){
   const id=ids[current.start];selected.has(id)?selected.delete(id):selected.add(id);
  }else return;
  lastDragRange='';paintSelection();
 };
 const cancel=()=>{if(gesture?.holdTimer)clearTimeout(gesture.holdTimer);gesture=null;preview();};
 hand.onpointerdown=e=>{
  if(game.over||game.phase!=='playing'||game.turn!==0||isModalOpen()||gesture||(e.pointerType==='mouse'&&e.button!==0))return;
  e.preventDefault();
  const start=indexAt(e.clientX);
  const current:Gesture={pointerId:e.pointerId,start,end:start,x:e.clientX,y:e.clientY,before:[...selected],moved:false,armed:e.pointerType==='mouse',cancelled:false,holdTimer:null};
  gesture=current;
  if(current.armed)preview();
  else current.holdTimer=setTimeout(()=>arm(current),180);
 };
 hand.oncontextmenu=e=>e.preventDefault();
 window.addEventListener('pointermove',move,{passive:false});
 window.addEventListener('pointerup',up);
 window.addEventListener('pointercancel',cancel);
 window.addEventListener('blur',cancel);
 cancelHandGesture=()=>{cancel();boundHand=null;hand.onpointerdown=null;hand.oncontextmenu=null;window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancel);window.removeEventListener('blur',cancel);};
 nodes.forEach(el=>el.onkeydown=e=>{
  if(!['Enter',' '].includes(e.key)||game.over||game.phase!=='playing'||game.turn!==0)return;
  e.preventDefault();const id=Number(el.dataset.card);selected.has(id)?selected.delete(id):selected.add(id);lastDragRange='';paintSelection();
 });
}

function flyCards(cards:number[],seat:number,origins:(DOMRect|null)[]=[]){
 const destination=document.querySelector<HTMLElement>('.played-seat-'+seat);
 if(!destination||matchMedia('(prefers-reduced-motion: reduce)').matches){flyingSeats.delete(seat);destination?.classList.remove('await-flight');return;}
 const source=document.querySelector<HTMLElement>(seat===0?'.hand':'.seat-'+seat)?.getBoundingClientRect();if(!source){flyingSeats.delete(seat);destination.classList.remove('await-flight');return;}
 const layer=document.createElement('div');layer.className='flight-layer';document.body.append(layer);const gen=generation;
 const animations=cards.map((id,i)=>{const target=destination.children[i] as HTMLElement,targetRect=target.getBoundingClientRect();const origin=origins[i];const width=origin?.width??targetRect.width,height=origin?.height??targetRect.height;const x=origin?.left??source.left,y=origin?.top??source.top;const wrap=document.createElement('div');wrap.innerHTML=card(id);const el=wrap.firstElementChild as HTMLElement;Object.assign(el.style,{position:'fixed',left:x+'px',top:y+'px',width:width+'px',height:height+'px',transformOrigin:'0 0'});layer.append(el);return el.animate([{transform:'translate(0,0) scale(1,1)'},{transform:'translate('+(targetRect.left-x)+'px,'+(targetRect.top-y)+'px) scale('+(targetRect.width/width)+','+(targetRect.height/height)+')'}],{duration:240,easing:'cubic-bezier(.22,.65,.35,1)',fill:'forwards'}).finished;});
 let finished=false;const finish=()=>{if(finished)return;finished=true;layer.remove();if(gen!==generation)return;flyingSeats.delete(seat);document.querySelector('.played-seat-'+seat)?.classList.remove('await-flight');};const cleanupTimer=setTimeout(finish,280);void Promise.all(animations).then(()=>{clearTimeout(cleanupTimer);finish();},()=>{clearTimeout(cleanupTimer);finish();});
}
function start() {robotAvatars=[...AVATARS].sort(()=>Math.random()-.5).slice(0,2);flyingSeats.clear();document.querySelectorAll('.flight-layer').forEach(el=>el.remove());sfx.play('lift');generation++;clearTimeout(timer);clearTimeout(effectTimer);effect='';bubbles=['','',''];tablePlays=[null,null,null];lastPlayedSeat=-1;lastDragRange='';voice.stop();music.newRound();
 game=rules.createGame();rules.deal(game);auction=new RobAuction(game.bidTurn);selected.clear();render();schedule();}
function bid(seat:number,accept:boolean) {
 if(game.phase!=='bidding'||isModalOpen())return;
 const calling=auction.phase==='calling', clip=accept?(calling?'Order':'Rob'+Math.min(3,auction.robs+1)):(calling?'NoOrder':'NoRob');
 const res=auction.act(seat,accept);if(!res.legal)return;
 voice.say(clip);bubbles[seat]=accept?(calling?'叫地主':'抢地主'):(calling?'不叫':'不抢');
 if(res.redeal){rules.deal(game);auction=new RobAuction(game.bidTurn);bubbles=['','',''];music.newRound();}
 else if(res.done){game.landlord=auction.winner;game.highestBid=1;rules.startPlay(game);game.multiplier=auction.multiplier;bubbles=['','',''];}
 else game.bidTurn=auction.turn;
 render();schedule();
}

function commit(seat:number,cards:number[]|null) {
 if(seat===0&&(isModalOpen()||game.over||game.turn!==0||game.phase!=='playing'))return;
 if(seat===0&&cards&&!selectionPlayable(game.hands[0],cards,game.lastPlay)){selected.clear();lastDragRange='';paintSelection();return;}
 // The kernel removes cards by rank; remap to the exact selected IDs so the visible suits stay consistent.
 const origins=seat===0&&cards?cards.map(id=>document.querySelector<HTMLElement>('[data-card="'+id+'"]')?.getBoundingClientRect()??null):[];
 const previousSeat=cards&&lastPlayedSeat!==seat?lastPlayedSeat:-1,previousCards=previousSeat>=0?tablePlays[previousSeat]:null;
 const before=[...game.hands[seat]];
 const res=cards?rules.play(game,seat,cards):rules.pass(game,seat);
 if(!res.legal)return;
 if(cards){sfx.play('play');game.hands[seat]=before.filter(c=>!cards.includes(c));tablePlays[seat]=cards.slice();lastPlayedSeat=seat;}lastDragRange='';
 if(cards){voice.say(cardVoice(game.lastPlay.type,game.lastPlay.rank));const left=game.hands[seat].length;if(!game.over&&(left===1||left===2))voice.say('baojing'+left);}else voice.say('buyao'+(1+Math.floor(Math.random()*4)));
 bubbles[seat]=cards?'':'不出';
 if(cards){const type=game.lastPlay.type;const effects:Record<string,string>={bomb:'bomb',rocket:'rocket',plane:'plane',plane_solo:'plane',plane_pair:'plane',straight:'straight',pair_straight:'pairs'};if(effects[type])showEffect(effects[type]);}
 selected.clear();
 if(game.over){const spring=game.landlordWin?game.playCount.every((n:number,i:number)=>i===game.landlord||n===0):game.playCount[game.landlord]<=1;if(spring)showEffect('spring');music.finish(game.landlord===0?game.landlordWin:!game.landlordWin);}
 else if(cards) music.afterPlay(game, game.lastPlay);
 if(cards)flyingSeats.add(seat);render();if(cards){flyCards(cards,seat,origins);if(previousSeat>=0){const gen=generation;setTimeout(()=>{if(gen===generation&&tablePlays[previousSeat]===previousCards){tablePlays[previousSeat]=null;if(page==='table')document.querySelector('.played-seat-'+previousSeat)?.remove();}},matchMedia('(prefers-reduced-motion: reduce)').matches?0:240);}}schedule();
}
function showEffect(name:string) {clearTimeout(effectTimer);effect=name;const gen=generation;effectTimer=setTimeout(()=>{if(gen===generation&&page==='table'){effect='';if(game.over)render();else document.querySelector('.hand-effect')?.remove();}},2200);}
function schedule() {clearTimeout(timer);if(page!=='table'||game.over||isModalOpen())return;const seat=game.phase==='bidding'?game.bidTurn:game.turn;if(seat===0)return;const gen=generation;
 timer=setTimeout(async()=>{if(gen!==generation||isModalOpen())return;if(game.phase==='bidding'){const c=rules.countsOf(game.hands[seat]);const pts=c[12]*2+c[13]*3+c[14]*3+c[11];bid(seat,pts>=(auction.phase==='calling'?5:7));return;}const res=await decide(seat);if(gen!==generation||page!=='table'||isModalOpen())return;const pick=res?.candidates?Difficulty.pickMove(res.candidates,3):null;let cards=pick?.cards||null;if(!cards&&!game.lastPlay)cards=rules.generateMoves(game.hands[seat],null)[0]?.cards;commit(seat,cards);},650);
}
document.addEventListener('dragstart',e=>e.preventDefault());
document.addEventListener('click',e=>{const b=(e.target as HTMLElement).closest('button');if(!b||b.disabled||b.closest('.hand')||b.dataset.unavailable==='true')return;sfx.play(b.id==='profile-save'?'save':b.id.includes('confirm')?'confirm':['settings','profile','settings-close','profile-close'].includes(b.id)?'popup':'click');},true);
document.addEventListener('change',e=>{if((e.target as HTMLElement).matches('input[role=switch],input[name=voice]'))sfx.play('toggle');});
music.welcome();
window.addEventListener('keydown',e=>{if(isModalOpen())return;if(page==='table'&&game.turn===0&&game.phase==='playing'){if(e.key==='Enter'&&!(e.target as HTMLElement).closest('button'))commit(0,[...selected]);if(e.key==='Escape')commit(0,null);}});
render();

