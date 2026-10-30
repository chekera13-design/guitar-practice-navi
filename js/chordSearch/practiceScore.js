import {parseChord,analyzeVoicing} from './theory.js';
import {FORMS} from './forms.js';
import {CHORD_FORMS} from '../config/chordForms.js';
const esc=text=>String(text).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const natural={C:0,D:2,E:4,F:5,G:7,A:9,B:11};
export function getPracticeData(name,formId){
 const chord=parseChord(name),form=FORMS.find(f=>f.id===formId&&f.chordId===chord.id);
 if(!form||form.validation?.reference!=='checked')throw Error('練習できる確認済み運指を選んでください。');
 const analysis=analyzeVoicing(chord,form);if(!analysis.valid)throw Error('運指と構成音が一致しません。');
 const original=CHORD_FORMS.findIndex(f=>f.id===form.id);
 return{chord,form,analysis,originalFile:original<0?null:'scores/chords/ex'+String(original+1).padStart(2,'0')+'.mxl'};
}
export function buildPracticeXml(data){
 const {chord,analysis}=data;if(!analysis.valid)throw Error('未確認の運指です。');
 const notes=analysis.notes.map((n,i)=>{const tone=chord.tones.find(t=>t.pc===n.pc),octave=(n.midi-natural[tone.letter]-tone.alter)/12-1;if(!Number.isInteger(octave))throw Error('音高が不正です。');return'<note>'+(i?'<chord/>':'')+'<pitch><step>'+tone.letter+'</step>'+(tone.alter?'<alter>'+tone.alter+'</alter>':'')+'<octave>'+octave+'</octave></pitch><duration>4</duration><voice>1</voice><type>whole</type><notations><technical><string>'+n.string+'</string><fret>'+n.fret+'</fret></technical></notations></note>';}).join('');
 const tuning=[['E',2],['A',2],['D',3],['G',3],['B',3],['E',4]].map(([step,octave],i)=>'<staff-tuning line="'+(i+1)+'"><tuning-step>'+step+'</tuning-step><tuning-octave>'+octave+'</tuning-octave></staff-tuning>').join('');
 return'<?xml version="1.0" encoding="UTF-8"?><score-partwise version="4.0"><part-list><score-part id="P1"><part-name>'+esc(chord.name)+'</part-name></score-part></part-list><part id="P1"><measure number="1"><attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>TAB</sign></clef><staff-details><staff-lines>6</staff-lines>'+tuning+'</staff-details></attributes>'+notes+'</measure><measure number="2">'+notes+'</measure></part></score-partwise>';
}
export function createPracticeStage(name,formId){
 const data=getPracticeData(name,formId);let objectUrl=null;
 const file=data.originalFile||(objectUrl=URL.createObjectURL(new Blob([buildPracticeXml(data)],{type:'application/vnd.recordare.musicxml+xml'})))+'#chord-search.musicxml';
 // Auxiliary search stages never enter the persistent progress catalogs, including the original eight.
 const stage={id:'chord-search-'+data.form.id,practiceType:'chord-search',stageBadge:'コード検索・単体練習',title:data.chord.name+'コード',desc:'各小節の1拍目に鳴らして4拍伸ばす、2小節練習です。回数は保存しません。',bpm:70,timeSignature:[4,4],countInBars:1,practiceBars:2,available:true,file,
 guide:{title:'押さえ方を確認して練習',content:'6弦→1弦：'+data.form.frets.map(f=>f===null?'×':f).join('・'),points:['カウントイン4拍のあとに演奏を始めます。','×の弦は鳴らさず、1拍目の音を4拍伸ばしましょう。','録音練習は1周固定。先行1拍と終了後の余韻は既存の動作を使います。']}};
 return{...data,stage,revoke(){if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl=null;}}};
}
