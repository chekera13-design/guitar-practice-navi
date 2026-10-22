const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');
const videoModule = import(pathToFileURL(path.join(__dirname, '../js/guideVideo.js')).href);
const configModule = import(pathToFileURL(path.join(__dirname, '../js/config.js')).href);
const guideVideo = { youtubeId: 'qgk136u2e4M', title: 'チュートリアル EX1 攻略動画' };

// 既存の実際の開始・停止・画面遷移処理へ、動画UIを接続して検証する。
function fixture(file, marker) {
    const source = fs.readFileSync(path.join(__dirname, file), 'utf8');
    return vm.runInNewContext(source.slice(0, source.indexOf(marker)) + '\nharness;',
        { require, __dirname, Blob, TextEncoder, AbortController, setImmediate });
}
const practice = fixture('practice.test.cjs', 'for (const repeats of');
const score = fixture('score-loading.test.cjs', "for (const state of ['idle'");
const metro = fixture('standalone-metronome.test.cjs', "test('開始関数");

async function ui(stage = { guideVideo }) {
    const created = [];
    const document = { createElement(tag) { const node = element(tag); created.push(node); return node; } };
    function element(tag) {
        return { tagName: tag.toUpperCase(), ownerDocument: document, hidden: false, disabled: false,
            attributes: {}, children: [], parentElement: null,
            setAttribute(k, v) { this.attributes[k] = v; }, getAttribute(k) { return this.attributes[k] ?? null; },
            replaceChildren(...children) {
                this.children.forEach(child => { child.parentElement = null; });
                this.children = children; children.forEach(child => { child.parentElement = this; });
            },
        };
    }
    const section = element('section'), button = element('button'), panel = element('div');
    const controller = (await videoModule).createGuideVideo(section, button, panel);
    controller.setStage(stage);
    return { section, button, panel, controller, created };
}

test('有効なguideVideoのときだけボタン領域を表示し、初期状態でiframeを生成しない', async () => {
    const h = await ui();
    assert.equal(h.section.hidden, false); assert.equal(h.panel.hidden, true);
    assert.equal(h.created.length, 0); assert.equal(h.panel.children.length, 0);
    assert.equal(h.button.getAttribute('aria-expanded'), 'false');
    assert.equal(h.button.textContent, '▶ 攻略動画を見る');
});

for (const youtubeId of [undefined, '', 'short', 'https://youtu.be/qgk136u2e4M', '../qgk136u2e4M', 'abc"onload=', '<script>x</script>']) {
    test('不正ID ' + JSON.stringify(youtubeId) + ' は領域ごと非表示で通信を作らない', async () => {
        const h = await ui({ guideVideo: { youtubeId } }); h.controller.toggle();
        assert.equal(h.section.hidden, true); assert.equal(h.created.length, 0);
    });
}

test('開いた時だけnocookie iframeを作り、インライン再生・タイトル・全画面を設定する', async () => {
    const h = await ui(); h.controller.toggle();
    const frame = h.panel.children[0], url = new URL(frame.src);
    assert.equal(url.origin, 'https://www.youtube-nocookie.com');
    assert.equal(url.pathname, '/embed/qgk136u2e4M'); assert.equal(url.searchParams.get('playsinline'), '1');
    assert.equal(url.searchParams.has('autoplay'), false); assert.equal(frame.title, guideVideo.title);
    assert.equal(frame.getAttribute('allowfullscreen'), ''); assert.match(frame.getAttribute('allow'), /encrypted-media/);
    assert.equal(frame.referrerPolicy, 'strict-origin-when-cross-origin');
    assert.equal(h.panel.hidden, false); assert.equal(h.button.getAttribute('aria-expanded'), 'true');
    assert.equal(h.button.textContent, '▲ 攻略動画を閉じる');
});

test('再タップでiframeを切り離し、再展開では新しいiframeを1つだけ生成する', async () => {
    const h = await ui(); h.controller.toggle(); const first = h.panel.children[0];
    h.controller.toggle(); assert.equal(h.panel.children.length, 0); assert.equal(first.parentElement, null);
    assert.equal(h.panel.hidden, true); assert.equal(h.button.getAttribute('aria-expanded'), 'false');
    h.controller.toggle(); assert.equal(h.panel.children.length, 1); assert.notEqual(h.panel.children[0], first);
});

test('動画なしステージへの切替はiframeと余白領域を消し、前の動画を再開しない', async () => {
    const h = await ui(); h.controller.toggle(); h.controller.setStage({ id: 2 });
    assert.equal(h.panel.children.length, 0); assert.equal(h.section.hidden, true);
    h.controller.toggle(); assert.equal(h.panel.children.length, 0);
    h.controller.setStage({ guideVideo }); assert.equal(h.section.hidden, false);
    assert.equal(h.panel.hidden, true); assert.equal(h.button.getAttribute('aria-expanded'), 'false');
});

test('disabled中は動画を閉じ、開き直しを受け付けず、解除後は開ける', async () => {
    const h = await ui(); h.controller.toggle(); h.controller.setDisabled(true); h.controller.toggle();
    assert.equal(h.panel.children.length, 0); assert.equal(h.button.disabled, true);
    h.controller.setDisabled(false); h.controller.toggle(); assert.equal(h.panel.children.length, 1);
});

for (const seconds of [0, 12.8, -1, Infinity, NaN, '20']) {
    test('任意startSeconds ' + String(seconds) + ' は有効な正数のみ秒単位で使用', async () => {
        const h = await ui({ guideVideo: { ...guideVideo, startSeconds: seconds } }); h.controller.toggle();
        assert.equal(new URL(h.panel.children[0].src).searchParams.get('start'), seconds === 12.8 ? '12' : null);
    });
}

test('実configのTutorial EX1〜3・Basic EX1〜10は登録動画を表示し、動画なしSoloは非表示', async () => {
    const { TUTORIAL_STAGES, BASIC_STAGES, SOLO_STAGES } = await configModule;
    assert.deepEqual(TUTORIAL_STAGES.filter(stage => stage.guideVideo).map(stage => stage.id), [1, 2, 3]);
    assert.deepEqual(BASIC_STAGES.filter(stage => stage.guideVideo).map(stage => stage.id), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    // 本番configを実際のUIコントローラーへ渡す。動画IDを教材と別の固定一覧で管理しない。
    for (const stage of [...TUTORIAL_STAGES, ...BASIC_STAGES]) {
        const video = stage.guideVideo;
        assert.equal(typeof video.youtubeId, 'string');
        assert.match(video.youtubeId, /^[A-Za-z0-9_-]{11}$/);
        assert.equal(typeof video.title, 'string'); assert.ok(video.title.trim());
        const h = await ui(stage);
        assert.equal(h.section.hidden, false); assert.equal(h.panel.hidden, true);
        assert.equal(h.panel.children.length, 0); assert.equal(h.created.length, 0);
        assert.equal(h.button.getAttribute('aria-expanded'), 'false');
        h.controller.toggle();
        assert.equal(h.panel.children.length, 1);
        const frame = h.panel.children[0], url = new URL(frame.src);
        assert.equal(url.origin, 'https://www.youtube-nocookie.com');
        assert.equal(url.pathname, `/embed/${video.youtubeId}`);
        assert.equal(frame.title, video.title);
        assert.equal(h.button.getAttribute('aria-expanded'), 'true');
        h.controller.close();
        assert.equal(frame.parentElement, null); assert.equal(h.panel.children.length, 0);
        assert.equal(h.button.getAttribute('aria-expanded'), 'false');
    }
    assert.ok(SOLO_STAGES.length > 0);
    for (const stage of SOLO_STAGES) {
        assert.equal(stage.guideVideo, undefined);
        const h = await ui(stage); h.controller.toggle();
        assert.equal(h.section.hidden, true); assert.equal(h.panel.children.length, 0);
        assert.equal(h.created.length, 0);
    }
});

test('動画領域は縦/横TABの後、録音結果と既存ガイドの前で、HTMLにiframeはない', () => {
    const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
    const videoAt = html.indexOf('id="guideVideoSection"');
    assert.ok(videoAt > html.indexOf('id="verticalTabWrapper"'));
    assert.ok(videoAt < html.indexOf('id="recordResultCard"'));
    assert.match(html, /id="guideVideoToggleBtn"[^>]*aria-expanded="false"[^>]*aria-controls="guideVideoPanel"/);
    assert.doesNotMatch(html, /<iframe\b/i);
});

test('実モーダルを閉じる・再度開く・別EXへ移ると動画を破棄して閉じた状態へ戻す', async () => {
    const h = score(), video = await ui(), c = h.c; c.guideVideo = video.controller;
    const stage = { ...h.stage, guideVideo };
    await h.open(stage); video.controller.toggle(); assert.equal(video.panel.children.length, 1);
    c.closePracticeModal(); assert.equal(video.panel.children.length, 0);
    await h.open(stage); assert.equal(video.panel.hidden, true);
    video.controller.toggle(); await h.open({ ...stage, id: 2, guideVideo: undefined });
    assert.equal(video.section.hidden, true); assert.equal(video.panel.children.length, 0);
    c.closePracticeModal();
});

for (const mode of ['practice', 'record']) {
    test(mode + '開始で動画を破棄し、終了まで動画ボタンを無効化する', async () => {
        const h = practice({ bars: 1 }), video = await ui(), c = h.context; c.guideVideo = video.controller;
        video.controller.toggle(); await c.startPractice(mode);
        assert.equal(video.panel.children.length, 0); assert.equal(video.button.disabled, true);
        video.controller.toggle(); assert.equal(video.panel.children.length, 0);
        c.stopPractice(); assert.equal(video.button.disabled, false);
    });
}

test('単体メトロノーム開始で動画を破棄し、停止で動画ボタンを再度操作できる', async () => {
    const h = metro(), video = await ui(), c = h.c; c.guideVideo = video.controller;
    video.controller.toggle(); await c.startStandaloneMetronome();
    assert.equal(video.panel.children.length, 0); assert.equal(video.button.disabled, true);
    c.stopStandaloneMetronome(); assert.equal(video.button.disabled, false);
});
