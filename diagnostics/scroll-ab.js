import { ScrollABCapture, SCROLL_AB_CONDITIONS, SCROLL_AB_SEQUENCE,
    applyDecorationCondition, observeCountInDecorations } from './scroll-ab-core.js';
import { BASIC_STAGES } from '../js/config.js';

const iframe = document.getElementById('app');
const status = document.getElementById('status');
const select = document.getElementById('condition');
const arm = document.getElementById('arm');
const cancel = document.getElementById('cancel');
const output = document.getElementById('output');
const results = [];
const expectedStage = BASIC_STAGES.find(stage => stage.id === 5);
let child, doc, state, capture, context, seenBusy = false;
let endDecorationCheck = () => {};
const observedAudio = new WeakSet();

// このstyleは診断iframeだけに注入する。色・寸法・配置・ハイライトは変更しない。
export const decorationOverride = `
#practiceModal.scroll-ab-no-decoration,
#practiceModal.scroll-ab-no-backdrop { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
#practiceModal.scroll-ab-no-decoration #visualMetronomeBox,
#practiceModal.scroll-ab-no-metronome #visualMetronomeBox { box-shadow: none !important; transition: none !important; }
#practiceModal.scroll-ab-no-decoration .beat-dot,
#practiceModal.scroll-ab-no-metronome .beat-dot { box-shadow: none !important; transform: none !important; transition: none !important; }
`;

function decorations(condition = 'A') {
    applyDecorationCondition(doc?.getElementById('practiceModal'), condition);
}
function refresh() {
    const busy = !!state?.busy;
    select.disabled = busy;
    arm.disabled = busy || !state?.ready || !state?.modalOpen || !!(capture && !capture.stopped);
    cancel.disabled = busy || !capture || capture.stopped;
    for (const id of ['copy', 'save', 'show']) document.getElementById(id).disabled = busy || !results.length;
}
function finishIfStopped() {
    if (!capture || !capture.stopped || capture.exported || state?.busy) return;
    capture.exported = true;
    endDecorationCheck('practice-stopped');
    const result = capture.result(); // 並べ替え・JSON化は練習停止後に限定。
    results.push(result);
    decorations();
    output.value = JSON.stringify({ schema: 'tab-scroll-ab-series-v1',
        diagnosticRevision: 'decoration-isolation-v1', recommendedSequence: SCROLL_AB_SEQUENCE, results }, null, 2);
    const validResults = results.filter(item => item.validComparison);
    const validCount = validResults.length;
    const inOrder = validResults.every((item, index) => item.condition === SCROLL_AB_SEQUENCE[index]);
    const nextCondition = SCROLL_AB_SEQUENCE[validCount];
    status.textContent = `${results.length}件目 ${result.condition}：${result.validComparison ? '30秒計測完了' : '比較無効：' + result.invalidReasons.join(' / ')}。` +
        (!inOrder ? '推奨順序と異なります。測定した条件はJSONへ保存されています。'
            : nextCondition ? `次の推奨条件：${nextCondition}（条件欄で選択）。` : '推奨7回分を取得しました。JSONを保存してください。');
    refresh();
}
function invalidate(reason) {
    if (capture && !capture.stopped && capture.phase !== 'captured') capture.invalidate(reason);
}
function phaseChanged(phase) {
    const messages = { waiting: 'カウントイン終了。音声経過3秒まで待機…',
        measuring: '計測中：音声経過3～33秒。画面を操作せず待ってください。',
        captured: '30秒分を取得しました。アプリの「練習を終了」を押してください。',
        invalid: '比較無効：' + (capture?.reasons.join(' / ') || '') + '。練習を停止してください。' };
    if (messages[phase]) status.textContent = messages[phase];
}
function snapshot() {
    const wrapper = doc.querySelector('.score-wrapper');
    const bar = doc.getElementById('visualMetronomeBox');
    const dot = doc.querySelector('.beat-dot');
    const modal = doc.getElementById('practiceModal');
    // 開始準備時だけ取得。測定RAFではcomputedStyleやbboxを取得しない。
    const barStyle = child.getComputedStyle(bar), dotStyle = child.getComputedStyle(dot);
    return {
        url: child.location.href, userAgent: child.navigator.userAgent,
        hardwareConcurrency: child.navigator.hardwareConcurrency ?? null,
        deviceMemory: child.navigator.deviceMemory ?? null,
        devicePixelRatio: child.devicePixelRatio,
        viewport: { width: child.innerWidth, height: child.innerHeight,
            visualWidth: child.visualViewport?.width, visualHeight: child.visualViewport?.height,
            visualScale: child.visualViewport?.scale, orientation: child.screen.orientation?.type },
        screen: { width: child.screen.width, height: child.screen.height },
        scrollArea: { clientWidth: wrapper.clientWidth, clientHeight: wrapper.clientHeight,
            scrollWidth: wrapper.scrollWidth, scrollHeight: wrapper.scrollHeight },
        stage: { category: 'basic', id: state.stage.id, file: state.stage.file,
            bpm: 60, timeSignature: state.stage.timeSignature, actualBars: state.score?.masterBars?.length },
        alphaTab: { version: child.alphaTab?.meta?.version || null,
            commit: child.alphaTab?.meta?.commit || null, pinned: '1.8.4 build 34',
            scriptUrl: [...doc.scripts].find(script => /alphatab/i.test(script.src))?.src || null },
        renderGeneration: state.renderGeneration,
        decoration: { condition: select.value, conditionName: SCROLL_AB_CONDITIONS[select.value].name,
            requested: { backdropDisabled: SCROLL_AB_CONDITIONS[select.value].backdropDisabled,
                metronomeDisabled: SCROLL_AB_CONDITIONS[select.value].metronomeDisabled },
            activeDiagnosticClasses: ['scroll-ab-no-decoration', 'scroll-ab-no-backdrop', 'scroll-ab-no-metronome']
                .filter(name => modal.classList.contains(name)),
            beatCheck: {}, modalBackdrop: child.getComputedStyle(modal).backdropFilter,
            barShadow: barStyle.boxShadow, barTransition: barStyle.transition,
            dotShadow: dotStyle.boxShadow, dotTransform: dotStyle.transform, dotTransition: dotStyle.transition },
        sampling: { capacity: 8192, extraRAF: 0, extraPeriodicTimers: 0,
            extraScrollLeftReadPerWrite: 1, dimensionsTimedEveryFrames: 8,
            geometryReadsOutsideMeasurement: true }
    };
}
function armCapture() {
    if (state?.busy) return;
    if (!state?.ready || !state.modalOpen || state.stage?.id !== expectedStage?.id ||
        state.stage?.file !== expectedStage?.file || Number(doc.getElementById('modalBpmBadge')?.textContent) !== 60) {
        status.textContent = '基礎編EX5を開き、60 BPM・繰り返し1回にしてください。'; return;
    }
    const wrapper = doc.querySelector('.score-wrapper');
    if (doc.getElementById('practiceModal')?.classList.contains('vertical-tab-active') ||
        child.getComputedStyle(wrapper).display === 'none' || wrapper.clientWidth >= wrapper.scrollWidth) {
        status.textContent = '横スクロールする横型TABで測定してください。スマホは横向きにします。'; return;
    }
    if (doc.getElementById('practiceRepeatSelect')?.value !== '1' ||
        doc.getElementById('standaloneMetroBtn')?.classList.contains('active')) {
        status.textContent = '繰り返し1回にし、単独クリックを停止してください。'; return;
    }
    endDecorationCheck('new-preparation');
    decorations(select.value);
    capture = new ScrollABCapture(select.value, snapshot(), phaseChanged, () => child.performance.now());
    endDecorationCheck = observeCountInDecorations(child, doc, select.value, capture.metadata.decoration.beatCheck);
    context = { stage: state.stage, api: state.api, score: state.score, renderGeneration: state.renderGeneration };
    seenBusy = false;
    output.hidden = true;
    status.textContent = `${select.value}を準備しました。アプリの「練習」を押してください（カウントイン後に自動計測）。`;
    document.getElementById('panel').open = false;
    refresh();
}

function install() {
    child = iframe.contentWindow;
    doc = iframe.contentDocument;
    if (child.__TAB_SCROLL_AB_DIAGNOSTIC__) return;
    const style = doc.createElement('style');
    style.textContent = decorationOverride;
    doc.head.append(style);
    child.__TAB_SCROLL_AB_DIAGNOSTIC__ = {
        practiceState(next) {
            state = next;
            if (next.audio && !observedAudio.has(next.audio)) {
                observedAudio.add(next.audio);
                next.audio.addEventListener('statechange', () => {
                    if (state?.busy && next.audio.state !== 'running') invalidate('audio-context-' + next.audio.state);
                });
            }
            if (capture && !capture.stopped) {
                if (!next.modalOpen) invalidate('modal-closed');
                if (next.stage !== context.stage || next.api !== context.api || next.score !== context.score ||
                    next.renderGeneration !== context.renderGeneration) invalidate('stage-api-score-or-render-changed');
                if (next.busy) {
                    seenBusy = true;
                    if (next.mode !== 'practice' || next.bpm !== 60) invalidate('requires-normal-practice-at-60BPM');
                    if (next.session) {
                        capture.metadata.session = { generation: next.session.generation,
                            bpm: next.session.bpm, mode: next.session.mode, repeatCount: next.session.repeatCount,
                            countInBeats: next.session.countInBeats, practiceBars: next.session.practiceBars };
                    }
                } else if (seenBusy || !next.modalOpen) capture.stop('practice-stopped-or-closed');
            }
            if (!next.modalOpen) { endDecorationCheck('modal-closed'); decorations(); }
            finishIfStopped();
            refresh();
        },
        scrollStart(info) {
            endDecorationCheck('scroll-start-before-measurement');
            if (!capture || capture.stopped) return null;
            if (info.api !== context.api || info.score !== context.score) invalidate('api-score-replaced');
            const probe = capture.start(info);
            if (!probe) return null;
            // 診断の例外が練習のRAFへ伝播しないよう、診断メソッドだけを保護する。
            const failure = error => probe.invalidate('diagnostic-error:' + String(error));
            const safe = {
                beginFrame(now, audio, display) { try { probe.beginFrame(now, audio, display); } catch (error) { failure(error); } },
                afterDimensions(start, scrollReads, clientReads) { try { probe.afterDimensions(start, scrollReads, clientReads); } catch (error) { failure(error); } },
                afterWrite(actual) { try { probe.afterWrite(actual); } catch (error) { failure(error); } },
                endFrame(duration) { try { probe.endFrame(duration); } catch (error) { failure(error); } }
            };
            Object.defineProperties(safe, { measuring: { get: () => probe.measuring },
                sampleDimensions: { get: () => probe.sampleDimensions } });
            return safe;
        },
        scrollStop(reason) {
            if (capture?.started && !capture.stopped) { endDecorationCheck(reason); capture.stop(reason); }
        },
        fault(error) { invalidate('diagnostic-hook-error:' + error); }
    };
    for (const event of ['resize', 'orientationchange', 'pagehide']) {
        child.addEventListener(event, () => invalidate(event));
    }
    child.visualViewport?.addEventListener('resize', () => invalidate('visual-viewport-resize'));
    doc.addEventListener('visibilitychange', () => { if (doc.hidden) invalidate('document-hidden'); });
    doc.addEventListener('pointerdown', event => {
        if (['waiting', 'measuring'].includes(capture?.phase) && event.target.closest('.score-wrapper')) invalidate('manual-score-interaction');
    }, true);
    doc.addEventListener('wheel', () => invalidate('wheel-input'), { passive: true });
    doc.addEventListener('keydown', event => {
        if (['ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End'].includes(event.key)) invalidate('scroll-key-input');
    }, true);
    status.textContent = '基礎編EX5を開き、60 BPM・1回・横型で「次の練習を計測」を押してください。';
}
iframe.addEventListener('load', install);
if (iframe.contentDocument?.readyState === 'complete' && iframe.contentDocument.getElementById('practiceModal')) install();
arm.addEventListener('click', armCapture);
select.addEventListener('change', () => {
    if (state?.busy) return;
    if (capture && !capture.stopped) { capture.stop('condition-changed-before-start'); finishIfStopped(); }
    endDecorationCheck('condition-changed');
    decorations();
    status.textContent = `${select.value}を選択しました。「次の練習を計測」で準備します。`;
    refresh();
});
cancel.addEventListener('click', () => {
    if (state?.busy) return;
    capture?.stop('diagnostic-cancelled');
    endDecorationCheck('diagnostic-cancelled');
    finishIfStopped(); decorations(); refresh();
});
document.getElementById('show').addEventListener('click', () => { output.hidden = !output.hidden; });
document.getElementById('copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(output.value); status.textContent = '診断結果をコピーしました。'; }
    catch { output.hidden = false; output.select(); status.textContent = '結果欄を選択しました。長押し等でコピーしてください。'; }
});
document.getElementById('save').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([output.value], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url; link.download = `EX5-scroll-AB-${Date.now()}.json`; link.click(); URL.revokeObjectURL(url);
});
