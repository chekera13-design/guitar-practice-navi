// フォームから表示と読み上げ情報を導出。左手の指番号は推測しない。
export function chordFormMarks(form) {
    return form.frets.map((fret, index) => ({
        string: 6 - index, fret, kind: fret === null ? "muted" : fret === 0 ? "open" : "fretted",
        x: 40 + index * 32, y: fret > 0 ? 56 + (fret - 0.5) * 44 : 28
    }));
}

export function chordFormText(form) {
    return form.frets.map(fret => fret === null ? "x" : String(fret)).join("");
}

export function createChordDiagram(form) {
    const escape = text => String(text).replaceAll("&", "&amp;").replaceAll('"', "&quot;")
        .replaceAll("<", "&lt;").replaceAll(">", "&gt;");
    const marks = chordFormMarks(form);
    const description = form.name + "、6弦から1弦のフォーム " + chordFormText(form) + "。"
        + marks.map(mark => mark.string + "弦は" + (mark.kind === "muted" ? "鳴らさない"
            : mark.kind === "open" ? "開放弦" : mark.fret + "フレット")).join("、");
    let svg = '<svg xmlns="http://www.w3.org/2000/svg" class="chord-diagram" viewBox="0 0 240 264" role="img" aria-label="'
        + escape(description) + '"><title>' + escape(description) + '</title>';
    for (let fret = 0; fret <= 4; fret++) {
        const y = 56 + fret * 44;
        svg += '<line x1="40" x2="200" y1="' + y + '" y2="' + y
            + '" stroke="currentColor" stroke-width="' + (fret === 0 ? 4 : 1) + '"/>';
        if (fret < 4) svg += '<text x="19" y="' + (84 + fret * 44)
            + '" text-anchor="middle" fill="currentColor" font-size="12">' + (fret + 1) + '</text>';
    }
    for (const mark of marks) {
        svg += '<line x1="' + mark.x + '" x2="' + mark.x + '" y1="56" y2="232" stroke="currentColor" stroke-opacity=".65"/>';
        if (mark.kind === "fretted") svg += '<circle data-string="' + mark.string + '" data-fret="' + mark.fret
            + '" cx="' + mark.x + '" cy="' + mark.y + '" r="10" fill="currentColor"/>';
        else svg += '<text data-string="' + mark.string + '" data-kind="' + mark.kind + '" x="' + mark.x
            + '" y="34" text-anchor="middle" fill="currentColor" font-size="22">'
            + (mark.kind === "muted" ? "×" : "○") + '</text>';
        svg += '<text x="' + mark.x + '" y="253" text-anchor="middle" fill="currentColor" font-size="12">'
            + mark.string + '</text>';
    }
    return svg + '</svg>';
}
