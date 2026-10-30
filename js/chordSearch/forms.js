import {CHORD_FORMS} from '../config/chordForms.js';
import {parseChord,analyzeVoicing} from './theory.js';
const barre=(fret,fromString,toString)=>({fret,fromString,toString});
const book='https://www.oolimo.com/en/chord-types/barre-chords';
const minorBook='https://www.oolimo.com/en/chord-types/minor';
const fa=type=>'https://www.fachords.com/guitar-chord/c/'+type+'/textual/';
const entry=(name,frets,source,extra={})=>({id:parseChord(name).id+'-representative',chordId:parseChord(name).id,name,frets,barres:[],fingers:null,role:'representative',validation:{pitch:'required-at-load',reference:'checked',instrument:'not-tested'},source, ...extra});
const copied=CHORD_FORMS.map(form=>entry(form.name,[...form.frets],'reference/chordForms.js',{id:form.id,referenceNote:'既存8コードの独立コピー。指番号は未指定。'}));
// Explicit, reviewed list: no runtime generation of every quality × root × shape.
export const FORMS=[...copied,
 entry('D♭',[null,4,6,6,6,4],book,{barres:[barre(4,5,1)]}),
 entry('E♭',[null,6,8,8,8,6],book,{barres:[barre(6,5,1)]}),
 entry('F',[1,3,3,2,1,1],book,{barres:[barre(1,6,1)]}),
 entry('F♯',[2,4,4,3,2,2],book,{barres:[barre(2,6,1)]}),
 entry('A♭',[4,6,6,5,4,4],book,{barres:[barre(4,6,1)]}),
 entry('B♭',[null,1,3,3,3,1],book,{barres:[barre(1,5,1)]}),
 entry('B',[null,2,4,4,4,2],book,{barres:[barre(2,5,1)]}),
 entry('Cm',[null,3,5,5,4,3],minorBook,{barres:[barre(3,5,1)]}),
 entry('D♭m',[null,4,6,6,5,4],minorBook,{barres:[barre(4,5,1)]}),
 entry('E♭m',[null,6,8,8,7,6],minorBook,{barres:[barre(6,5,1)]}),
 entry('Fm',[1,3,3,1,1,1],minorBook,{barres:[barre(1,6,1)]}),
 entry('F♯m',[2,4,4,2,2,2],minorBook,{barres:[barre(2,6,1)]}),
 entry('Gm',[3,5,5,3,3,3],minorBook,{barres:[barre(3,6,1)]}),
 entry('A♭m',[4,6,6,4,4,4],minorBook,{barres:[barre(4,6,1)]}),
 entry('B♭m',[null,1,3,3,2,1],minorBook,{barres:[barre(1,5,1)]}),
 entry('Bm',[null,2,4,4,3,2],minorBook,{barres:[barre(2,5,1)]}),
 entry('C5',[null,3,5,5,null,null],'https://www.tabs4acoustic.com/en/C5-guitar-chord%2C7.html',{fingers:[null,1,3,4,null,null]}),
 entry('Csus2',[null,3,5,5,3,3],fa('sus2'),{barres:[barre(3,5,1)],fingers:[null,1,3,4,1,1],referenceNote:'Position 1'}),
 entry('Csus4',[null,3,3,0,1,null],fa('sus4'),{fingers:[null,3,4,null,1,null],referenceNote:'Position 1'}),
 entry('C7sus2',[null,3,5,3,3,3],'https://chords.gock.net/chords/dominant-seventh-suspended-second',{barres:[barre(3,5,1)]}),
 entry('C7sus4',[null,3,5,3,6,3],fa('7sus4'),{barres:[barre(3,5,1)],fingers:[null,1,3,1,4,1],referenceNote:'Position 2'}),
 entry('C6',[null,3,2,2,1,0],fa('6'),{fingers:[null,4,2,3,1,null],omissionReason:'完全5度は省略可能。ルート・3度・6度を保持。',referenceNote:'Position 1'}),
 entry('Cm6',[null,3,1,2,1,3],'https://gtrlib.com/chords/Cm6',{barres:[barre(1,4,2)],fingers:[null,3,1,2,1,4],referenceNote:'Shape x31213'}),
 entry('C7',[null,3,2,3,1,0],fa('7'),{fingers:[null,3,2,4,1,null],omissionReason:'完全5度は省略可能。ルート・3度・b7を保持。',referenceNote:'Position 1'}),
 entry('CM7',[null,3,2,0,0,0],fa('maj7'),{fingers:[null,3,2,null,null,null],referenceNote:'Position 1'}),
 entry('Cm7',[null,3,1,3,1,null],fa('m7'),{barres:[barre(1,4,2)],fingers:[null,3,1,4,1,null],omissionReason:'完全5度は省略可能。ルート・b3・b7を保持。',referenceNote:'Position 1'}),
 entry('Cm(maj7)',[8,null,9,8,8,null],'https://chords.gock.net/chords/minor-major-seventh',{barres:[barre(8,3,2)],referenceNote:'8x988x。候補を実音で照合し、同ページの異なる構成音の候補は採用していません。'}),
 entry('Cm7b5',[null,3,4,3,4,null],fa('m7b5'),{fingers:[null,1,3,2,4,null],referenceNote:'Position 1'}),
 entry('Cdim',[null,3,4,5,4,null],fa('dim'),{fingers:[null,1,2,3,4,null],referenceNote:'Position 1・減三和音'}),
 entry('Cdim7',[null,6,7,5,7,null],fa('dim7'),{fingers:[null,2,3,1,4,null],referenceNote:'Position 2。最低音E♭の転回形。'}),
 entry('Caug',[null,3,2,1,1,null],fa('aug'),{barres:[barre(1,3,2)],fingers:[null,3,2,1,1,null],referenceNote:'Position 1'}),
 entry('Cadd9',[null,3,2,0,3,3],fa('add9'),{fingers:[null,2,1,null,3,4],referenceNote:'Position 1'}),
 entry('C9',[null,3,2,3,3,null],'https://www.fachords.com/guitar-chord/c/9/',{fingers:[null,2,1,3,4,null],omissionReason:'完全5度は省略可能。ルート・3度・b7・9度を保持。',referenceNote:'Position 1'}),
 entry('Cm9',[null,3,1,3,3,null],fa('m9'),{fingers:[null,2,1,3,4,null],omissionReason:'完全5度は省略可能。ルート・b3・b7・9度を保持。',referenceNote:'Position 1'}),
 entry('C13',[null,3,2,3,3,5],'https://www.tabs4acoustic.com/en/C13-guitar-chord%2C18.html',{barres:[barre(3,3,2)],fingers:[null,2,1,3,3,4],omissionReason:'5度・11度を省略。ルート・3度・b7・9度・13度を保持。'}),
 entry('C7(♭9)',[null,3,2,3,2,3],'https://chords.gock.net/chords/dominant-seventh-flat-ninth',{barres:[barre(2,4,2)]}),
 entry('C7(♯9)',[null,3,2,3,4,null],'https://chordoptions.com/chord/c/7sharp9/',{omissionReason:'完全5度を省略。長3度と♯9を両方残す。'})
];
// Future additional shapes append another entry with a new form id, keeping chordId unchanged.
export function getForms(chord){return FORMS.filter(f=>f.chordId===chord.id).map(form=>({form,analysis:analyzeVoicing(chord,form)}));}
