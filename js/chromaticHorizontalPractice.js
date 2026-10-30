import { renderPracticeCount, renderPracticeTotal } from "./practiceCountDisplay.js";

// Selection only. The existing modal, scheduler, recorder and completion observer handle practice.
export function initChromaticHorizontalPractice(root, lesson, openStage, progress = null) {
    if (!root || !lesson?.variants?.length) return null;
    const variants = lesson.variants;
    const patterns = [...new Set(variants.map(stage => stage.fingering))];
    const strings = [...new Set(variants.map(stage => stage.stringNumber))];
    root.innerHTML = '<article id="chromatic-horizontal-card" class="practice-type-card chromatic-practice-card practice-count-card" data-chromatic-card="horizontal" aria-labelledby="chromaticHorizontalTitle">'
        + '<header class="practice-type-header"><h3 id="chromaticHorizontalTitle">' + lesson.title + '</h3><span class="practice-type-total" data-horizontal-total></span></header>'
        + '<label class="chromatic-pattern-label" for="chromaticHorizontalPatternSelect">練習内容</label>'
        + '<div class="chromatic-navigation chromatic-horizontal-navigation" role="group" aria-label="運指と弦の切り替え">'
        + '<button type="button" class="chromatic-step" data-horizontal-previous aria-label="前の運指" aria-controls="chromaticHorizontalPatternSelect"><span aria-hidden="true">←</span></button>'
        + '<select id="chromaticHorizontalPatternSelect" data-horizontal-pattern aria-label="運指パターン" aria-controls="chromaticHorizontalSelection">'
        + patterns.map((pattern, index) => '<option value="' + pattern + '">No.' + String(index + 1).padStart(2, '0') + ' | ' + pattern + '</option>').join('') + '</select>'
        + '<select id="chromaticHorizontalStringSelect" data-horizontal-string aria-label="練習する弦" aria-controls="chromaticHorizontalSelection">'
        + strings.map(string => '<option value="' + string + '">' + string + '弦</option>').join('') + '</select>'
        + '<button type="button" class="chromatic-step" data-horizontal-next aria-label="次の運指" aria-controls="chromaticHorizontalPatternSelect"><span aria-hidden="true">→</span></button></div>'
        + '<div id="chromaticHorizontalSelection" class="chromatic-selection" role="region" aria-label="選択中の横移動練習">'
        + '<p data-horizontal-meta></p><p data-horizontal-frets></p>'
        + '<p class="practice-key-summary practice-current-count" data-horizontal-count aria-live="polite"></p>'
        + '<button type="button" class="ex-start-btn" data-horizontal-start>▶ 練習する</button></div>'
        + '<p class="chromatic-selection-status" data-horizontal-status role="status"></p>'
        + variants.map(stage => '<span id="' + stage.progressId + '" hidden aria-hidden="true"></span>').join('') + '</article>';
    const field = name => root.querySelector('[data-horizontal-' + name + ']');
    const pattern = field('pattern'), string = field('string'), previous = field('previous'), next = field('next');
    let selected = null, destroyed = false;
    function refreshCounts() {
        if (destroyed || !selected) return;
        renderPracticeCount(field('count'), progress?.getCount(selected) || 0);
        const total = variants.reduce((sum, stage) => sum + BigInt(progress?.getCount(stage) || 0), 0n);
        renderPracticeTotal(field('total'), total, "このカードの24運指・6弦全体の練習合計");
    }
    function select(stage, { navigate = false } = {}) {
        if (destroyed || !variants.includes(stage)) return;
        selected = stage;
        pattern.value = stage.fingering; string.value = String(stage.stringNumber);
        const index = patterns.indexOf(stage.fingering);
        previous.disabled = index === 0; next.disabled = index === patterns.length - 1;
        field('meta').textContent = "BPM " + stage.bpm + "・" + stage.timeSignature.join('/') + "・" + stage.practiceBars + "小節・8分音符";
        field('frets').textContent = "運指：" + stage.fretOrder.join(' → ') + "（各位置2回）";
        field('status').textContent = "No." + String(stage.patternNumber).padStart(2, '0') + "、運指" + stage.fingering + "、" + stage.stringNumber + "弦を選択";
        field('start').disabled = !stage.available;
        refreshCounts();
        if (navigate && window.location.hash !== '#' + stage.progressId) window.history.pushState(null, '', '#' + stage.progressId);
    }
    const changed = () => select(variants.find(stage => stage.fingering === pattern.value && String(stage.stringNumber) === string.value) || selected, { navigate: true });
    pattern.addEventListener('change', changed); string.addEventListener('change', changed);
    const step = delta => {
        if (destroyed || !selected) return;
        const index = patterns.indexOf(selected.fingering) + delta;
        if (index < 0 || index >= patterns.length) return;
        pattern.value = patterns[index]; pattern.dispatchEvent(new Event('change', { bubbles: true }));
    };
    previous.addEventListener('click', () => step(-1)); next.addEventListener('click', () => step(1));
    field('start').addEventListener('click', () => { if (!destroyed && selected?.available) openStage(selected); });
    const fromHash = () => select(variants.find(stage => '#' + stage.progressId === window.location.hash));
    select(variants[0]); fromHash();
    const unsubscribe = progress?.subscribe(refreshCounts);
    window.addEventListener('hashchange', fromHash); window.addEventListener('popstate', fromHash);
    return {
        get selected() { return selected; }, selectStage: select,
        destroy() { destroyed = true; unsubscribe?.(); window.removeEventListener('hashchange', fromHash); window.removeEventListener('popstate', fromHash); }
    };
}
