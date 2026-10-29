const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'storage.test.cjs'),'utf8');
const boot=vm.runInNewContext(source.slice(0,source.indexOf("for (const failure of ['getItem"))+'\nboot;',{
 require,__dirname,Blob,TextEncoder,AbortController,setImmediate
});
const FORM='https://docs.google.com/forms/d/e/1FAIpQLSdgux5-18JyWXd4balvcrvm2F_bMoCkfRXrYoHWeN1Ku8j_Xg/viewform?usp=publish-editor';
const YOUTUBE='https://www.youtube.com/channel/UC8621xM8_QL6DzDRYIqcPOA';
const links=html=>[...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map(m=>({
 attrs:Object.fromEntries([...m[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(a=>[a[1],a[2]])),label:m[2].trim()
}));
const text=html=>html.replace(/<!--[\s\S]*?-->/g,'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
function open(id){
 const h=boot();h.assertReady();h.nodes.get(id).dispatch('click');
 assert.equal(h.nodes.get('infoModal').classList.contains('hidden'),false);
 return {h,html:h.nodes.get('infoModalBody').innerHTML,title:h.nodes.get('infoModalTitle').innerText};
}
function external(link,url){
 assert.ok(link);assert.equal(link.attrs.href,url);assert.equal(link.attrs.target,'_blank');assert.equal(link.attrs.rel,'noopener noreferrer');
}
test('お問い合わせは確定Googleフォームへ、新しいタブと安全なrelで誘導する',()=>{
 const view=open('openContactBtn');assert.equal(view.title,'お問い合わせ');const all=links(view.html);assert.equal(all.length,1);
 external(all[0],FORM);assert.ok(all[0].label.includes('お問い合わせフォームを開く'));
});
test('お問い合わせはGoogleフォームの利用と新しいタブを明示する',()=>{
 const value=text(open('openContactBtn').html);
 assert.ok(value.includes('不具合のご報告、ご質問、ご要望などは、Googleフォームからお送りください。'));
 assert.ok(value.includes('Googleフォームが新しいタブで開きます。'));assert.doesNotMatch(value,/SNS|GitHub|DM|Issue|ここに|リンクを入れる/);
});
test('運営者情報は正式サイト名・公開運営者名・説明を表示する',()=>{
 const view=open('openAboutBtn'),value=text(view.html);assert.equal(view.title,'運営者情報');
 for(const s of ['サイト名','ギター練習.com','運営','Guitar Practice Channel','公式YouTubeチャンネル','ギターの練習をサポートする無料のWebアプリ','初心者から楽しめる練習教材'])assert.ok(value.includes(s),s);
 assert.doesNotMatch(value,/ギター練習ドットコム 運営事務局|Webオーディオ技術/);
});
test('運営者情報のYouTubeリンクは確定チャンネルURLと一致する',()=>{
 const all=links(open('openAboutBtn').html),channel=all.filter(l=>l.attrs.href===YOUTUBE);
 assert.equal(channel.length,1);external(channel[0],YOUTUBE);assert.equal(channel[0].label,'Guitar Practice Channel');
});
test('運営者情報のお問い合わせも同じ確定フォームを使用する',()=>{
 const all=links(open('openAboutBtn').html),form=all.filter(l=>l.attrs.href===FORM);
 assert.equal(form.length,1);external(form[0],FORM);assert.equal(form[0].label,'専用フォーム');
 assert.ok(text(open('openAboutBtn').html).includes('からお願いいたします。'));
});
test('仮の公式サイトURL欄・仮リンク・開発URLを表示しない',()=>{
 for(const id of ['openAboutBtn','openContactBtn']){
  const view=open(id);assert.doesNotMatch(text(view.html),/公式URL|ここに記載|ここにGoogle|未設定|pages\.dev|localhost|127\.0\.0\.1/);
  for(const link of links(view.html))assert.ok([FORM,YOUTUBE].includes(link.attrs.href));
 }
});
test('公開指定外の個人情報欄やアプリ内の入力・収集機能を追加しない',()=>{
 for(const id of ['openAboutBtn','openContactBtn']){
  const html=open(id).html;assert.doesNotMatch(html,/<(?:form|input|textarea|iframe|script)\b/i);
  assert.doesNotMatch(text(html),/メールアドレス|プロフィール|住所|電話番号|本名|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  assert.ok(links(html).every(l=>!/^mailto:|^tel:/i.test(l.attrs.href)));
 }
});
test('情報切替・閉じるボタン・背景クリックは既存の開閉経路を維持する',()=>{
 const {h}=open('openAboutBtn'),modal=h.nodes.get('infoModal'),body=h.nodes.get('infoModalBody');
 assert.equal(links(body.innerHTML).length,2);h.nodes.get('openContactBtn').dispatch('click');assert.equal(links(body.innerHTML).length,1);
 assert.doesNotMatch(body.innerHTML,/公式YouTubeチャンネル/);h.nodes.get('closeInfoModalBtn').dispatch('click');assert.equal(modal.classList.contains('hidden'),true);
 h.nodes.get('openAboutBtn').dispatch('click');modal.dispatch('click');assert.equal(modal.classList.contains('hidden'),true);
});
test('案内の表示で保存・タイマー・教材登録に変更を加えない',()=>{
 const h=boot();h.assertReady();const timers=h.timers.size,writes=h.writes.length;
 for(const id of ['openAboutBtn','openContactBtn']){h.nodes.get(id).dispatch('click');h.nodes.get('closeInfoModalBtn').dispatch('click');}
 assert.equal(h.timers.size,timers);assert.equal(h.writes.length,writes);assert.equal(h.cards.length,10);assert.equal(h.tutorialCards.length,3);assert.equal(h.soloCards.length,3);h.assertReady();
});
