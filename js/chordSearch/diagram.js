// Independent extension of the local chordDiagram snapshot: preserve its string geometry.
import {chordFormMarks} from '../chordDiagram.js';
const esc=text=>String(text).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
export function createChordDiagram(form,analysis){
 if(!analysis.valid)throw Error('Unverified pitch data');
 const start=analysis.startFret,marks=chordFormMarks(form).map(m=>({...m,y:m.fret>0?56+(m.fret-start+.5)*44:28}));
 const description=form.name+'、6弦から1弦：'+form.frets.map(f=>f===null?'×':f).join('・')+'。表示は'+start+'フレットから。'+marks.map(m=>m.string+'弦は'+(m.kind==='muted'?'鳴らさない':m.kind==='open'?'開放弦':m.fret+'フレット')).join('、');
 let svg='<svg xmlns="http://www.w3.org/2000/svg" class="chord-diagram" viewBox="0 0 240 264" role="img" aria-label="'+esc(description)+'"><title>'+esc(description)+'</title>';
 for(let f=0;f<=4;f++){const y=56+f*44;svg+='<line x1="40" x2="200" y1="'+y+'" y2="'+y+'" stroke="currentColor" stroke-width="'+(f===0&&start===1?4:1)+'"/>';if(f<4)svg+='<text x="19" y="'+(84+f*44)+'" text-anchor="middle" fill="currentColor" font-size="12">'+(start+f)+'</text>';}
 for(const m of marks)svg+='<line x1="'+m.x+'" x2="'+m.x+'" y1="56" y2="232" stroke="currentColor" stroke-opacity=".65"/>';
 for(const b of form.barres||[]){const y=56+(b.fret-start+.5)*44;svg+='<line data-barre="'+b.fret+'" x1="'+(40+(6-b.fromString)*32)+'" x2="'+(40+(6-b.toString)*32)+'" y1="'+y+'" y2="'+y+'" stroke="currentColor" stroke-width="18" stroke-linecap="round"/>';}
 for(const [i,m]of marks.entries()){
  if(m.kind==='fretted'){svg+='<circle data-string="'+m.string+'" data-fret="'+m.fret+'" cx="'+m.x+'" cy="'+m.y+'" r="10" fill="currentColor"/>';if(form.fingers?.[i])svg+='<text class="finger-number" x="'+m.x+'" y="'+(m.y+4)+'" text-anchor="middle" font-size="11">'+form.fingers[i]+'</text>';}
  else svg+='<text data-string="'+m.string+'" data-kind="'+m.kind+'" x="'+m.x+'" y="34" text-anchor="middle" fill="currentColor" font-size="22">'+(m.kind==='muted'?'×':'○')+'</text>';
  svg+='<text x="'+m.x+'" y="253" text-anchor="middle" fill="currentColor" font-size="12">'+m.string+'</text>';
 }
 return svg+'</svg>';
}
