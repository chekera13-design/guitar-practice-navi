// Presentation only. Values come from the existing progress store; no reads or writes here.
export function renderPracticeCount(element, count) {
    const value = String(count), done = count > 0;
    element.textContent = "この練習：" + value + "回";
    element.dataset.practiced = String(done);
    element.setAttribute("aria-label", (done ? "完走済み、" : "未練習、") + "この練習：" + value + "回");
    element.setAttribute("aria-atomic", "true");
}

export function renderPracticeTotal(element, value, scope) {
    element.textContent = "合計 " + value + "回";
    element.title = scope;
    element.setAttribute("aria-label", scope + "：" + value + "回");
}
