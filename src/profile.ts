export interface Profile { name:string; avatar:string; badge:string }
export const AVATARS=Array.from({length:36},(_,i)=>'/assets/image/头像/avatar-'+String(i+1).padStart(2,'0')+'.png');
export const defaultProfile:Profile={name:'玩家',avatar:'',badge:''};
function safeImage(value:unknown,fallback:string){return typeof value==='string'&&(AVATARS.includes(value)||/^data:image\/(png|jpeg|webp);base64,/.test(value))?value:fallback;}
export function loadProfile():Profile{try{const p=JSON.parse(localStorage.getItem('gamebox-profile')||'null');if(p)return {name:cleanName(p.name),avatar:safeImage(p.avatar,defaultProfile.avatar),badge:safeImage(p.badge,defaultProfile.badge)};}catch{}return {...defaultProfile};}
export function cleanName(name:unknown){return Array.from(typeof name==='string'?name.trim():'').slice(0,16).join('')||'玩家';}
export function saveProfile(profile:Profile){const p={...profile,name:cleanName(profile.name)};localStorage.setItem('gamebox-profile',JSON.stringify(p));return p;}
export function escapeHTML(value:string){return value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));}
