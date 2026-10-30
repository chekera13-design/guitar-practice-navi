import {QUALITIES} from './qualities.js';
const LETTERS=['C','D','E','F','G','A','B'],NATURAL=[0,2,4,5,7,9,11];
export const ROOTS=[['c','C'],['db','D♭'],['d','D'],['eb','E♭'],['e','E'],['f','F'],['fs','F♯'],['g','G'],['ab','A♭'],['a','A'],['bb','B♭'],['b','B']].map(([id,label],pc)=>({id,label,pc}));
export const TUNING=[40,45,50,55,59,64]; // E2 A2 D3 G3 B3 E4, strings 6 to 1.
export const mod=n=>(n%12+12)%12;
const normalize=text=>String(text).normalize('NFKC').replaceAll('♭','b').replaceAll('♯','#').replaceAll('𝄫','bb').replaceAll('𝄪','##').replaceAll('−','-').replace(/\s+/g,'');
const suffix=text=>normalize(text).replace(/[(),]/g,'');
const aliases=new Map();for(const q of QUALITIES)for(const value of [q.symbol,...q.aliases]){const key=suffix(value);if(aliases.has(key)&&aliases.get(key)!==q.id)throw Error('Ambiguous alias '+key);aliases.set(key,q.id);}
export function parseRoot(input){const match=/^([A-Ga-g])([#b]{0,2})$/.exec(normalize(input));if(!match)throw Error('ルート音を確認してください。');const letter=match[1].toUpperCase(),alter=[...match[2]].reduce((n,a)=>n+(a==='#'?1:-1),0),pc=mod(NATURAL[LETTERS.indexOf(letter)]+alter);return{...ROOTS[pc],letter,alter,label:letter+(alter<0?'♭'.repeat(-alter):'♯'.repeat(alter))};}
export function degreeSemitones(degree){const m=/^(b*|#*)(\d+)$/.exec(degree);if(!m||Number(m[2])<1)throw Error('Invalid degree');const n=Number(m[2])-1;return NATURAL[n%7]+12*Math.floor(n/7)+[...m[1]].reduce((v,c)=>v+(c==='#'?1:-1),0);}
export function spellNote(root,degree){const n=Number(degree.match(/\d+/)[0])-1,index=(LETTERS.indexOf(root.letter)+n)%7,pc=mod(root.pc+degreeSemitones(degree));let alter=mod(pc-NATURAL[index]+6)-6;return{degree,pc,letter:LETTERS[index],alter,name:LETTERS[index]+(alter<0?'♭'.repeat(-alter):'♯'.repeat(alter))};}
export function buildChord(rootName,qualityId,bassName=null){const root=parseRoot(rootName),quality=QUALITIES.find(q=>q.id===qualityId);if(!quality)throw Error('未対応のコード種類です。');const bass=bassName?parseRoot(bassName):null;return{id:root.id+':'+quality.id+(bass?':bass-'+bass.id:''),root,quality,bass,name:root.label+quality.symbol+(bass?'/'+bass.label:''),tones:quality.degrees.map(d=>spellNote(root,d)),tensionChoices:(quality.tensionChoices||[]).map(d=>spellNote(root,d)),required:quality.required,optional:quality.optional};}
export function parseChord(input){let value=normalize(input);if(!value||value.length>80)throw Error('コード名を入力してください。');let bass=null;const slash=/\/([A-Ga-g](?:#{1,2}|b{1,2})?)$/.exec(value);if(slash){bass=slash[1];value=value.slice(0,slash.index);}const match=/^([A-Ga-g](?:#{1,2}|b{1,2})?)(.*)$/.exec(value);if(!match)throw Error('コード名を確認してください。例：C、Cm7、F♯、C6/9');const qualityId=aliases.get(suffix(match[2]));if(!qualityId)throw Error('未対応のコード名です。コード種類の一覧から選んでください。');return buildChord(match[1],qualityId,bass);}
export function analyzeVoicing(chord,form){
 const errors=[];if(!Array.isArray(form.frets)||form.frets.length!==6)return{valid:false,errors:['6弦分のフレットが必要です。']};
 const validFret=f=>f===null||Number.isInteger(f)&&f>=0&&f<=24;
 if(form.frets.some(f=>!validFret(f)))return{valid:false,errors:['フレットはnullまたは0〜24の整数です。']};
 const notes=form.frets.flatMap((f,i)=>f===null?[]:[{string:6-i,fret:f,midi:TUNING[i]+f,pc:mod(TUNING[i]+f)}]);
 const allowed=new Set(chord.tones.map(t=>t.pc)),present=new Set(notes.map(n=>n.pc)),missing=chord.tones.filter(t=>!present.has(t.pc)),omitted=missing.map(t=>t.degree);
 const required=chord.quality.required.filter(deg=>!present.has(mod(chord.root.pc+degreeSemitones(deg))));
 if(!notes.length)errors.push('発音弦がありません。');
 if(chord.quality.kind!=='fixed')errors.push('構成音が一意でないコードです。');
 if(notes.some(n=>!allowed.has(n.pc)))errors.push('構成音外の音があります。');
 if(required.length)errors.push('必須音がありません：'+required.join(' '));
 if(omitted.length&&(!form.omissionReason||omitted.some(d=>!chord.optional.includes(d))))errors.push('省略音の方針・理由が不明です。');
 const bass=notes.reduce((a,b)=>!a||b.midi<a.midi?b:a,null);
 if(chord.bass&&bass?.pc!==chord.bass.pc)errors.push('指定された最低音と一致しません。');
 for(const barre of form.barres||[]){const {fret,fromString:from,toString:to}=barre;if(!Number.isInteger(fret)||fret<1||from<to||from>6||to<1||from===to){errors.push('セーハ情報が不正です。');continue;}for(let s=to;s<=from;s++)if(form.frets[6-s]===null||form.frets[6-s]<fret)errors.push('セーハが開放弦・ミュート弦・低いフレットと競合します。');if(form.frets[6-from]!==fret||form.frets[6-to]!==fret)errors.push('セーハの端点が一致しません。');}
 if(form.fingers){if(form.fingers.length!==6||form.fingers.some((f,i)=>form.frets[i]>0? !Number.isInteger(f)||f<1||f>4:f!==null))errors.push('指番号がフレット情報と一致しません。');for(let finger=1;finger<=4;finger++){const indexes=form.fingers.flatMap((f,i)=>f===finger?[i]:[]);if(indexes.length>1){const fret=form.frets[indexes[0]];if(indexes.some(i=>form.frets[i]!==fret)||(form.barres||[]).every(b=>b.fret!==fret||6-indexes[0]>b.fromString||6-indexes.at(-1)<b.toString))errors.push('複数弦の指番号に対応するセーハ情報がありません。');}}}
 const frets=notes.map(n=>n.fret),pressed=frets.filter(f=>f>0),min=frets.length?Math.min(...frets):null,max=frets.length?Math.max(...frets):null,startFret=pressed.length&&Math.max(...pressed)>4?Math.min(...pressed):1;
 if(form.startFret!==undefined&&(form.startFret<1||pressed.some(f=>f<form.startFret||f>form.startFret+3)))errors.push('表示フレット枠から押弦がはみ出します。');
 return{valid:!errors.length,errors,notes:notes.map(n=>{const tone=chord.tones.find(t=>t.pc===n.pc),octave=tone?(n.midi-NATURAL[LETTERS.indexOf(tone.letter)]-tone.alter)/12-1:null;return{...n,name:(tone?.name||'?')+(octave??''),degree:tone?.degree||'?'};}),omitted,rootPresent:present.has(chord.root.pc),bass,minFret:min,maxFret:max,startFret,openStrings:notes.filter(n=>n.fret===0).map(n=>n.string),mutedStrings:form.frets.flatMap((f,i)=>f===null?[6-i]:[])};
}
