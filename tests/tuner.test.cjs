const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const app = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
const tunerState = app.slice(app.indexOf('let isTuning ='), app.indexOf('// インフォモーダルDOM'));
const tunerCode = app.slice(app.indexOf('function isCurrentTunerSession('), app.indexOf('// ★ 運営情報モーダル'));
const practiceStart = app.slice(app.indexOf('async function startPractice('), app.indexOf('// 周回をまたいでも'));
const engine = fs.readFileSync(path.join(__dirname, '../js/audioEngine.js'), 'utf8');
const microphoneCode = engine.slice(engine.indexOf('export async function setupMicrophoneStream('), engine.indexOf('// --- メトロノーム音生成')).replace(/export /g, '');

function deferred() {
    let resolve, reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
}
function element() {
    const classes = new Set(['hidden']);
    return { innerText: '', attributes: {}, style: {}, dataset: {},
        classList: { add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c),
            toggle(c, value) { if (value) classes.add(c); else classes.delete(c); } },
        setAttribute(key, value) { this.attributes[key] = value; }, removeAttribute(key) { delete this.attributes[key]; },
        addEventListener(name, fn) { this[name] = fn; },
    };
}
function harness(options = {}) {
    const streams = [], sources = [], frames = new Map(), alerts = [], updates = [], filters = [];
    let nextFrame = 0, micRequests = 0, audioRequests = 0, setupRequests = 0, reads = 0;
    const makeStream = name => {
        const tracks = Array.from({ length: 3 }, () => ({ readyState: 'live', stops: 0,
            stop() { this.stops++; this.readyState = 'ended'; } }));
        const stream = { name, getTracks: () => tracks }; streams.push(stream); return stream;
    };
    const node = () => ({ connected: false, disconnects: 0,
        connect() { this.connected = true; }, disconnect() { this.connected = false; this.disconnects++; } });
    const summary = element(), details = element(); details.open = true; details.querySelector = () => summary;
    const c = { isPracticing: false, isStartingPractice: false, isFinalizingRecording: false,
        microphoneStream: null, activeMicStream: null, micSourceNode: null, analyser: null, audioBuffer: null,
        tunerDetails: details, tunerHud: element(), tunerTargetLabel: element(), tunerStatusText: element(),
        tunerMeterPointer: element(), tunerHzDisplay: element(),
        tunerStringBtns: [6, 5, 4, 3, 2, 1].map((stringNum, i) => {
            const button = element(); button.dataset = { string: String(stringNum), midi: String([40, 45, 50, 55, 59, 64][i]), note: ['E', 'A', 'D', 'G', 'B', 'E'][i] }; return button;
        }),
        unlockAudioContext: async () => { const i = audioRequests++; if (options.unlock) await options.unlock(i); },
        navigator: { mediaDevices: { getUserMedia: async () => {
            const i = micRequests++; return options.microphone ? options.microphone(i) : makeStream('mic-' + i);
        } } },
        audioContext: { currentTime: 0, sampleRate: 48000,
            createMediaStreamSource(stream) {
                if (options.sourceFail) throw Error('source failed');
                const source = node(); source.stream = stream; sources.push(source); return source;
            },
            createBiquadFilter() {
                const filter = node(); filter.frequency = { setValueAtTime() {} }; filters.push(filter); return filter;
            },
            createAnalyser() {
                if (options.analyserFail) throw Error('analyser failed');
                return { ...node(), getFloatTimeDomainData(buffer) { reads++; buffer.fill(options.sample || 0); } };
            },
        },
        requestAnimationFrame(fn) { const id = nextFrame++; frames.set(id, fn); return id; },
        cancelAnimationFrame(id) { frames.delete(id); },
        alert: message => alerts.push(message), resetTunerSmoothing() {}, playTunerPing() {},
        midiToFrequency: midi => 440 * Math.pow(2, (midi - 69) / 12), autoCorrelate: () => 110,
        updateTunerUI: update => updates.push(update), stopStandaloneMetronome() {},
        stopPractice() { c.isPracticing = false; c.isStartingPractice = false; c.isFinalizingRecording = false; },
        // 実際の練習開始関数で、待機中チューナーからのマイク所有権移行を検証する。
        practiceModal: { classList: { contains: () => false } },
        practiceStartGeneration: 0, preparedScore: { generation: 1, bars: 4 }, practiceSession: null,
        pendingPracticeMode: null, practiceRepeatSelect: { value: '3' }, isScoreReadyForPractice: () => true,
        currentStage: { timeSignature: [4, 4], countInBars: 1 }, currentBpm: 60, api: {},
        resetPracticeBar() {}, discardRecordingSession() {}, clearRecordingResult() {}, showPracticeStatus() {},
        updatePracticeControls() {}, collapseVolumeBar() {}, requestWakeLock: async () => {},
        document: { querySelector: () => null }, resetScoreFocusState() {}, buildScoreBarLayouts() {},
        setupMediaRecorder(stream) { c.recordingStream = stream; }, runPracticeScheduler() { c.practiceRan = true; },
        failPractice(message, error) { throw error; },
    };
    vm.createContext(c); vm.runInContext(microphoneCode + tunerState + tunerCode + practiceStart, c);
    const realSetup = c.setupMicrophoneStream;
    c.setupMicrophoneStream = async stream => {
        const i = setupRequests++, result = await realSetup(stream);
        if (options.setup) await options.setup(i);
        return result;
    };
    const read = expression => vm.runInContext(expression, c);
    const select = stringNum => { const b = c.tunerStringBtns.find(b => Number(b.dataset.string) === stringNum); return c.selectTunerString(stringNum, Number(b.dataset.midi), b.dataset.note); };
    const flush = () => new Promise(r => setImmediate(r));
    const close = () => { summary.click(); details.open = false; details.toggle(); };
    const frame = () => { const [id, fn] = frames.entries().next().value; frames.delete(id); fn(); };
    return { c, options, streams, sources, filters, frames, alerts, updates, makeStream, read, select, flush, close, frame, summary,
        micRequests: () => micRequests, audioRequests: () => audioRequests, setupRequests: () => setupRequests, reads: () => reads };
}
const ended = stream => stream.getTracks().every(track => track.readyState === 'ended' && track.stops > 0);

test('通常起動は実際の音声接続処理を使い、停止ですべてのTrack・接続・RAFを解除', async () => {
    const h = harness({ sample: 0.01 }); await h.select(5);
    assert.equal(h.read('isTuning'), true); assert.equal(h.read('isStartingTuner'), false);
    assert.equal(h.micRequests(), 1); assert.equal(h.setupRequests(), 1); assert.equal(h.frames.size, 1);
    assert.equal(h.sources.length, 1); assert.equal(h.sources[0].connected, true);
    assert.equal(h.filters.length, 2); assert.equal(h.updates[0].tunerTargetFreq, 110);
    for (let i = 0; i < 10; i++) { h.frame(); assert.equal(h.frames.size, 1); }
    h.c.stopTuner(); assert.equal(ended(h.streams[0]), true); assert.equal(h.sources[0].connected, false);
    assert.equal(h.c.analyser, null); assert.equal(h.c.audioBuffer, null); assert.equal(h.c.activeMicStream, null);
    assert.equal(h.c.microphoneStream, null); assert.equal(h.frames.size, 0); assert.equal(h.read('tunerSession'), null);
    assert.equal(h.c.tunerHud.classList.contains('hidden'), true); assert.equal(h.c.tunerHud.attributes['aria-busy'], undefined);
});

for (const action of ['stop', 'close', 'same-string']) {
    test('マイク許可待ち中の' + action + '後に成功しても全Trackを即停止して接続しない', async () => {
        const pending = deferred(), h = harness({ microphone: () => pending.promise });
        const start = h.select(6); await h.flush(); assert.equal(h.micRequests(), 1);
        if (action === 'stop') h.c.stopTuner(); else if (action === 'close') h.close(); else await h.select(6);
        const stream = h.makeStream('late'); pending.resolve(stream); await start;
        assert.equal(ended(stream), true); assert.equal(h.sources.length, 0); assert.equal(h.setupRequests(), 0);
        assert.equal(h.frames.size, 0); assert.equal(h.read('isTuning'), false); assert.equal(h.read('isStartingTuner'), false);
        assert.equal(h.c.tunerHud.classList.contains('hidden'), true); assert.equal(h.c.microphoneStream, null);
    });
}

for (const order of ['old-first', 'new-first']) {
    test('6弦→5弦でマイク成功が' + order + 'でも5弦だけが有効', async () => {
        const a = deferred(), b = deferred(), h = harness({ microphone: i => [a, b][i].promise });
        const old = h.select(6); await h.flush(); const next = h.select(5); await h.flush();
        const oldStream = h.makeStream('six'), nextStream = h.makeStream('five');
        if (order === 'old-first') {
            a.resolve(oldStream); await old; assert.equal(h.read('isStartingTuner'), true); assert.equal(h.frames.size, 0);
            b.resolve(nextStream); await next;
        } else {
            b.resolve(nextStream); await next; a.resolve(oldStream); await old;
        }
        assert.equal(ended(oldStream), true); assert.equal(ended(nextStream), false);
        assert.equal(h.read('currentTunerStringNum'), 5); assert.equal(h.read('tunerTargetFreq'), 110);
        assert.equal(h.c.microphoneStream, nextStream); assert.equal(h.c.activeMicStream, nextStream);
        assert.equal(h.sources.length, 1); assert.equal(h.sources[0].stream, nextStream); assert.equal(h.frames.size, 1);
        assert.match(h.c.tunerTargetLabel.innerText, /5弦/);
    });
}

test('同一弦の連打は開始→取消→新しい開始となり、古いストリーム・ループを残さない', async () => {
    const a = deferred(), b = deferred(), h = harness({ microphone: i => [a, b][i].promise });
    const old = h.select(6); await h.flush(); await h.select(6);
    const next = h.select(6); await h.flush(); assert.equal(h.micRequests(), 2);
    const latest = h.makeStream('latest'), obsolete = h.makeStream('obsolete');
    b.resolve(latest); await next; a.resolve(obsolete); await old;
    assert.equal(ended(obsolete), true); assert.equal(ended(latest), false); assert.equal(h.sources.length, 1); assert.equal(h.frames.size, 1);
    await h.select(6); assert.equal(h.read('isTuning'), false); assert.equal(h.micRequests(), 2); assert.equal(h.frames.size, 0);
});

test('複数弦の素早い連打は音声初期化後に最終選択だけがマイク取得へ進む', async () => {
    const h = harness();
    const starts = [6, 5, 4, 3, 2, 1].map(s => h.select(s)); await Promise.all(starts);
    assert.equal(h.audioRequests(), 6); assert.equal(h.micRequests(), 1); assert.equal(h.sources.length, 1);
    assert.equal(h.frames.size, 1); assert.equal(h.read('currentTunerStringNum'), 1);
    assert.equal(h.c.tunerStringBtns.filter(b => b.classList.contains('active')).length, 1);
});

for (const action of ['stop', 'close']) {
    test('音声初期化待ち中の' + action + 'では後からマイク取得へ進まない', async () => {
        const pending = deferred(), h = harness({ unlock: () => pending.promise }); const start = h.select(6);
        if (action === 'stop') h.c.stopTuner(); else h.close(); pending.resolve(); await start;
        assert.equal(h.micRequests(), 0); assert.equal(h.sources.length, 0); assert.equal(h.frames.size, 0);
        assert.equal(h.read('isStartingTuner'), false); assert.equal(h.c.tunerHud.classList.contains('hidden'), true);
    });
}

for (const result of ['resolve', 'reject']) {
    test('閉じてすぐ開き直した新しいセッションに古いマイクの' + result + 'が干渉しない', async () => {
        const a = deferred(), h = harness({ microphone: i => i === 0 ? a.promise : h.makeStream('new') });
        const old = h.select(6); await h.flush(); h.close(); h.c.tunerDetails.open = true; await h.select(5);
        const stream = h.c.microphoneStream, frameId = h.read('tunerAnimFrameId');
        if (result === 'resolve') { const oldStream = h.makeStream('old'); a.resolve(oldStream); await old; assert.equal(ended(oldStream), true); }
        else { a.reject(Error('old denial')); await old; }
        assert.equal(h.c.microphoneStream, stream); assert.equal(ended(stream), false); assert.equal(h.c.activeMicStream, stream);
        assert.equal(h.read('isTuning'), true); assert.equal(h.read('currentTunerStringNum'), 5);
        assert.equal(h.read('tunerAnimFrameId'), frameId); assert.equal(h.frames.size, 1); assert.equal(h.alerts.length, 0);
    });
}

test('閉じる→開くでtoggleイベントがまとめられても、summaryクリック時に待機要求を取消', async () => {
    const pending = deferred(), h = harness({ microphone: () => pending.promise });
    const old = h.select(6); await h.flush(); h.summary.click();
    h.c.tunerDetails.open = false; h.c.tunerDetails.open = true; h.c.tunerDetails.toggle();
    const stream = h.makeStream('late'); pending.resolve(stream); await old;
    assert.equal(ended(stream), true); assert.equal(h.read('isTuning'), false); assert.equal(h.frames.size, 0);
    assert.equal(h.c.tunerHud.classList.contains('hidden'), true);
});

for (const cause of ['NotAllowedError', 'NotFoundError', 'NotReadableError']) {
    test('現在のマイク取得失敗 ' + cause + 'は既存表示へ戻し再試行可能', async () => {
        const h = harness({ microphone: async () => { const error = Error(cause); error.name = cause; throw error; } });
        await h.select(6); assert.deepEqual(h.alerts, ['マイクの利用を許可してください。']);
        assert.equal(h.read('isTuning'), false); assert.equal(h.read('isStartingTuner'), false); assert.equal(h.frames.size, 0);
        h.options.microphone = null; await h.select(5); assert.equal(h.read('isTuning'), true); assert.equal(h.frames.size, 1);
    });
}

test('停止後の古いマイク取得失敗はエラー表示も状態変更もしない', async () => {
    const pending = deferred(), h = harness({ microphone: () => pending.promise });
    const old = h.select(6); await h.flush(); h.c.stopTuner(); pending.reject(Error('late denial')); await old;
    assert.equal(h.alerts.length, 0); assert.equal(h.read('isTuning'), false); assert.equal(h.frames.size, 0);
});

test('古い音声初期化失敗も新しいセッションに干渉しない', async () => {
    const pending = deferred(), h = harness({ unlock: i => i === 0 ? pending.promise : Promise.resolve() });
    const old = h.select(6); await h.select(5); pending.reject(Error('old resume failure')); await old;
    assert.equal(h.read('isTuning'), true); assert.equal(h.read('currentTunerStringNum'), 5); assert.equal(h.alerts.length, 0);
    assert.equal(h.micRequests(), 1); assert.equal(h.frames.size, 1);
});

for (const cause of ['sourceFail', 'analyserFail']) {
    test('接続初期化失敗 ' + cause + 'でも取得済みマイク・部分接続を解放する', async () => {
        const h = harness({ [cause]: true }); await h.select(6);
        assert.equal(ended(h.streams[0]), true); assert.equal(h.c.activeMicStream, null); assert.equal(h.c.analyser, null);
        assert.equal(h.sources.filter(s => s.connected).length, 0); assert.equal(h.frames.size, 0); assert.equal(h.alerts.length, 1);
    });
}

for (const result of ['resolve', 'reject']) {
    test('接続後の古いPromiseの' + result + 'も新しいマイク接続・RAFに触れない', async () => {
        const pending = deferred(), h = harness({ setup: i => i === 0 ? pending.promise : Promise.resolve() });
        const old = h.select(6); await h.flush(); const oldStream = h.c.microphoneStream;
        await h.select(5); const newStream = h.c.microphoneStream;
        if (result === 'resolve') pending.resolve(); else pending.reject(Error('old setup failure'));
        await old;
        assert.equal(ended(oldStream), true); assert.equal(ended(newStream), false); assert.equal(h.c.activeMicStream, newStream);
        assert.equal(h.sources.filter(s => s.connected).length, 1); assert.equal(h.frames.size, 1); assert.equal(h.alerts.length, 0);
    });
}

test('接続直後・開始完了待ち中の停止もストリームとAudioNodeを解除する', async () => {
    const pending = deferred(), h = harness({ setup: () => pending.promise });
    const start = h.select(6); await h.flush(); const stream = h.c.microphoneStream;
    h.c.stopTuner(); pending.resolve(); await start;
    assert.equal(ended(stream), true); assert.equal(h.sources[0].connected, false); assert.equal(h.c.activeMicStream, null);
    assert.equal(h.frames.size, 0); assert.equal(h.read('isTuning'), false);
});

test('取消後に古いRAFを配送しても新しい検出ループを重複させない', async () => {
    const h = harness(); await h.select(6); const old = [...h.frames.values()][0]; await h.select(5);
    const frameId = h.read('tunerAnimFrameId'), reads = h.reads(); old();
    assert.equal(h.frames.size, 1); assert.equal(h.read('tunerAnimFrameId'), frameId); assert.equal(h.reads(), reads);
    h.frame(); assert.equal(h.frames.size, 1); h.c.stopTuner();
    old(); assert.equal(h.frames.size, 0);
});

for (const mode of ['practice', 'record']) {
    test('実際の' + mode + '開始が待機チューナーを取消し、古いマイクを渡さない', async () => {
        const pending = deferred(), h = harness({ microphone: i => i === 0 ? pending.promise : h.makeStream('record') });
        const old = h.select(6); await h.flush(); await h.c.startPractice(mode);
        const current = h.c.microphoneStream, source = h.c.micSourceNode;
        const late = h.makeStream('obsolete-tuner'); pending.resolve(late); await old;
        assert.equal(ended(late), true); assert.equal(h.read('isTuning'), false); assert.equal(h.c.isPracticing, true);
        assert.equal(h.c.microphoneStream, current); assert.equal(h.c.micSourceNode, source); assert.equal(h.frames.size, 0);
        if (mode === 'record') { assert.equal(ended(current), false); assert.equal(h.c.recordingStream, current); }
        else assert.equal(h.sources.length, 0);
    });
}

test('閉じたチューナーでは開始要求・マイク取得を実行しない', async () => {
    const h = harness(); h.c.tunerDetails.open = false; await h.select(6);
    assert.equal(h.audioRequests(), 0); assert.equal(h.micRequests(), 0); assert.equal(h.frames.size, 0);
});
