// キー選択の開閉だけを担当。選択内容・保存・譜面・練習時計には触れない。
export function createKeyDisclosure(button, panel, { closedLabel, openLabel }) {
    let expanded = false, destroyed = false;
    function setExpanded(value) {
        if (destroyed) return;
        expanded = Boolean(value);
        if (!expanded && panel.contains(panel.ownerDocument?.activeElement)) button.focus();
        panel.hidden = !expanded;
        button.setAttribute("aria-expanded", String(expanded));
        button.setAttribute("aria-controls", panel.id);
        button.textContent = expanded ? openLabel : closedLabel;
    }
    const toggle = () => setExpanded(!expanded);
    button.addEventListener("click", toggle); // Enter/Spaceはbuttonの標準動作に任せる。
    setExpanded(false);
    return {
        get expanded() { return expanded; },
        close() { setExpanded(false); },
        destroy() {
            setExpanded(false); destroyed = true;
            button.removeEventListener("click", toggle);
        }
    };
}
