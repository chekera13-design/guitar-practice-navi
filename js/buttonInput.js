// Touch taps are handled directly; mouse and keyboard retain native click activation.
export function bindButtonActivation(button, activate, { signal, touchEnabled = () => true } = {}) {
    if (!button) return;
    let tap = null;
    let lastTouchActivation = -Infinity;
    const options = { signal, passive: true };

    button.addEventListener("touchstart", (event) => {
        tap = null;
        if (button.disabled || !touchEnabled() || event.touches.length !== 1) return;
        const touch = event.touches[0];
        tap = { id: touch.identifier, x: touch.clientX, y: touch.clientY, moved: false };
    }, options);

    button.addEventListener("touchmove", (event) => {
        if (!tap) return;
        const touch = Array.from(event.touches).find(item => item.identifier === tap.id);
        if (!touch || event.touches.length !== 1
            || Math.hypot(touch.clientX - tap.x, touch.clientY - tap.y) > 10) {
            tap.moved = true;
        }
    }, options);

    button.addEventListener("touchcancel", () => { tap = null; }, options);

    button.addEventListener("touchend", (event) => {
        const gesture = tap;
        tap = null;
        if (!gesture || gesture.moved || button.disabled || !touchEnabled()) return;
        const touch = Array.from(event.changedTouches).find(item => item.identifier === gesture.id);
        if (!touch || event.touches.length > 0
            || Math.hypot(touch.clientX - gesture.x, touch.clientY - gesture.y) > 10) return;
        const bounds = button.getBoundingClientRect();
        if (touch.clientX < bounds.left || touch.clientX > bounds.right
            || touch.clientY < bounds.top || touch.clientY > bounds.bottom) return;

        event.preventDefault();
        lastTouchActivation = performance.now();
        button.focus({ preventScroll: true });
        activate(event);
    }, { signal, passive: false });

    button.addEventListener("click", (event) => {
        if (button.disabled) return;
        // Guard against browsers that still emit a compatibility click after touchend.
        if (event.detail > 0 && event.pointerType !== "mouse"
            && performance.now() - lastTouchActivation < 700) {
            event.preventDefault();
            return;
        }
        activate(event);
    }, { signal });
}
