const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'storage.test.cjs'),'utf8'),read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const boot=vm.runInNewContext(source.slice(0,source.indexOf("for (const failure of ['getItem"))+'\nboot;',{require,__dirname,Blob,TextEncoder,AbortController,setImmediate});
const FORM='https://docs.google.com/forms/d/e/1FAIpQLSdgux5-18JyWXd4balvcrvm2F_bMoCkfRXrYoHWeN1Ku8j_Xg/viewform?usp=publish-editor';
const GOOGLE='https://policies.google.com/privacy?hl=ja';
const clean=html=>html.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
function open(){const h=boot();h.assertReady();h.nodes.get('openPrivacyBtn').dispatch('click');const html=h.nodes.get('infoModalBody').innerHTML;return{h,html,text:clean(html),sections:[...html.matchAll(/<h4[^>]*>([^<]+)<\/h4>\s*<p[^>]*>([\s\S]*?)<\/p>/g)].map(m=>({title:m[1],text:clean(m[2])}))};}
const includes=(text,items)=>{for(const item of items)assert.ok(text.includes(item),item);};
test('ポリシーを既存のスクロール可能な情報モーダルへ9見出しで表示する',()=>{
 const {h,html,sections}=open();assert.equal(h.nodes.get('infoModalTitle').innerText,'プライバシーポリシー');assert.equal(h.nodes.get('infoModal').classList.contains('hidden'),false);
 assert.equal(sections.length,9);assert.match(html,/max-height: 55vh; overflow-y: auto/);assert.deepEqual(sections.map(s=>s.title.split('.')[0]),['1','2','3','4','5','6','7','8','9']);
});
test('登録不要の基本機能・マイク用途・許可条件と拒否時の利用範囲を説明する',()=>{
 const {sections}=open();includes(sections[0].text,['無料','ユーザー登録なし','外部サービス']);
 includes(sections[1].text,['録音','チューナー','録音練習の開始時','弦を選んだとき','必要に応じて','許可しない場合','譜面閲覧・通常練習・メトロノーム','ブラウザ内で処理','運営側サーバーへアップロードする処理はありません']);
});
test('録音の一時保持・再生・破棄・復元不可・別途保存の扱いを説明する',()=>{
 const {sections}=open();includes(sections[2].text,['メモリ内に一時保持','確認・再生','自動で端末へ永続保存する機能はありません','練習画面を閉じる','教材を切り替える','次の練習・録音を開始','録音結果を閉じる','一時URLを破棄','ページの再読み込み','タブを閉じた後','復元する機能はありません','別途保存したファイル']);
});
test('LocalStorageの説明は実装の3キーと教材別回数に対応し、録音保存を含めない',()=>{
 const app=read('js/app.js'),tokens=[...app.matchAll(/localStorage\.(?:getItem|setItem)\(([^,)]+)/g)].map(m=>m[1].trim());
 const key=app.match(/const TUTORIAL_COMPLETION_STORAGE_KEY = "([^"]+)"/)[1];
 const actual=[...new Set(tokens.map(token=>token==='TUTORIAL_COMPLETION_STORAGE_KEY'?key:token.replace(/^"|"$/g,'')))].sort();
 const progress=read('js/practiceProgress.js');
 const countKey=progress.match(/export const PRACTICE_COUNT_STORAGE_KEY = "([^"]+)"/)[1];
 assert.deepEqual([...actual,countKey].sort(),['chogita_metro_vol','chogita_practice_counts_v1','chogita_tutorial_completed']);
 assert.match(progress,/getItem\(PRACTICE_COUNT_STORAGE_KEY\)/);assert.match(progress,/setItem\(PRACTICE_COUNT_STORAGE_KEY/);
 includes(open().sections[3].text,['メトロノームの音量','チュートリアルの完了状態','LocalStorage','録音音声はここへ保存しません','サイトデータを削除','クロマチック練習','コード練習','フォーム別・キー別','コードタイプ別・フォーム別・ルート別','同じブラウザでの次回利用','別端末・別ブラウザには自動同期されません','ログインは不要']);
 assert.doesNotMatch(open().sections[3].text,/BPMを保存|教材の選択を保存|録音を保存/);
});
test('フォームの入力項目・任意メール・利用目的・Google経由・録音との分離を説明する',()=>{
 includes(open().sections[4].text,['Googleフォーム','お問い合わせの種類','使用端末・ブラウザ','該当教材','問い合わせ本文','返信用メールアドレスの入力は任意','お問い合わせへの対応やサービス改善','Googleのサービスを通じて','録音とは別の情報','録音を自動的にフォームへ送信することはありません']);
});
test('実際のCDN参照先と一致するライブラリ・接続情報の説明を表示する',()=>{
 const html=read('index.html'),urls=[...html.matchAll(/<script[^>]+src="(https:[^"]+)"/g)].map(m=>m[1]);
 assert.deepEqual(urls,['https://cdn.jsdelivr.net/npm/@coderline/alphatab@1.8.4/dist/alphaTab.js','https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js']);
 includes(open().sections[5].text,['alphaTab','JSZip','jsDelivr','cdnjs','読み込む際','外部サービスへの通信','IPアドレス','接続情報']);
});
test('YouTubeは動画を開いた時点の通信と提供元のCookie等の扱いを説明する',()=>{
 includes(open().sections[6].text,['動画を開いたとき','youtube-nocookie.com','この時点で','通信が発生','外部リンク','Cookie','アクセス情報','Google・YouTubeの方針']);
 assert.doesNotMatch(open().text,/絶対安全|漏えいは一切ない|Cookieを一切|音声データが外部のサーバーに送信・蓄積されることは一切ありません/);
});
test('独自広告・解析タグは未設置とし、外部サービス側の計測と区別する',()=>{
 includes(open().sections[7].text,['当アプリ独自','現在設置していません','広告スペースは表示枠','外部サービス側の計測','今後導入する場合']);
 assert.doesNotMatch(read('index.html')+read('js/app.js'),/googletagmanager\.com|google-analytics\.com|pagead2\.googlesyndication\.com|static\.cloudflareinsights\.com/);
});
test('リンクは確定フォームとGoogle方針のみで、個人情報・未確定サイトURLを掲載しない',()=>{
 const {html,text}=open(),links=[...html.matchAll(/<a\b([^>]*)>/g)].map(m=>Object.fromEntries([...m[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(a=>[a[1],a[2]])));
 assert.deepEqual(links.map(l=>l.href),[FORM,GOOGLE]);for(const link of links){assert.equal(link.target,'_blank');assert.equal(link.rel,'noopener noreferrer');}
 assert.doesNotMatch(text,/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|ここに記載|pages\.dev|localhost|住所：|電話番号：/i);
 assert.doesNotMatch(html,/<(?:form|input|textarea|iframe|script)\b|\*\*/i);
});
test('再表示・閉じる・背景クリックで重複せず、保存や処理タイマーを増やさない',()=>{
 const {h,html}=open(),timers=h.timers.size,writes=h.writes.length,modal=h.nodes.get('infoModal');
 h.nodes.get('closeInfoModalBtn').dispatch('click');assert.equal(modal.classList.contains('hidden'),true);
 h.nodes.get('openPrivacyBtn').dispatch('click');assert.equal(h.nodes.get('infoModalBody').innerHTML,html);modal.dispatch('click');assert.equal(modal.classList.contains('hidden'),true);
 assert.equal(h.timers.size,timers);assert.equal(h.writes.length,writes);h.assertReady();
});
