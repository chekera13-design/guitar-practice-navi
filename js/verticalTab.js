const SVG_NS = "http://www.w3.org/2000/svg";

function readSvgResult(result) {
    if (typeof result === "string") {
        const doc = new DOMParser().parseFromString(result, "image/svg+xml");
        if (doc.querySelector("parsererror") || doc.documentElement?.localName !== "svg") {
            throw new Error("alphaTab returned an invalid SVG chunk");
        }
        return doc.documentElement;
    }
    if (result?.nodeType === Node.ELEMENT_NODE && result.localName === "svg") return result;
    throw new Error(`Unsupported alphaTab renderResult: ${typeof result}`);
}

function rectToXYWH(rect) {
    if (!rect) return null;
    const x = Number.isFinite(rect.x) ? rect.x : rect.left;
    const y = Number.isFinite(rect.y) ? rect.y : rect.top;
    const width = Number.isFinite(rect.w) ? rect.w : rect.width;
    const height = Number.isFinite(rect.h) ? rect.h : rect.height;
    return [x, y, width, height].every(Number.isFinite) && width > 0 && height > 0
        ? { x, y, width, height }
        : null;
}

function removePrivateUseGlyphs(svg) {
    const isPrivateUse = (codePoint) =>
        (codePoint >= 0xe000 && codePoint <= 0xf8ff)
        || (codePoint >= 0xf0000 && codePoint <= 0xffffd)
        || (codePoint >= 0x100000 && codePoint <= 0x10fffd);

    for (const text of svg.querySelectorAll("text")) {
        const walker = document.createTreeWalker(text, NodeFilter.SHOW_TEXT);
        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        for (const node of nodes) {
            node.nodeValue = [...(node.nodeValue || "")]
                .filter((char) => !isPrivateUse(char.codePointAt(0)))
                .join("");
        }
        if (!text.textContent) text.remove();
    }
}

function preserveAlphaTabStyles(sourceSvg, extractedSvg) {
    const hasEmbeddedFont = [...sourceSvg.querySelectorAll("style")]
        .some((style) => /@font-face/i.test(style.textContent || ""));
    if (hasEmbeddedFont) return;

    const fontStyle = [...document.querySelectorAll("style")]
        .find((style) => /@font-face/i.test(style.textContent || "")
            && /alphaTab/i.test(style.textContent || ""));
    if (!fontStyle) return;

    const style = document.createElementNS(SVG_NS, "style");
    style.textContent = fontStyle.textContent;
    extractedSvg.insertBefore(style, extractedSvg.firstChild);
}

export class VerticalTabController {
    constructor(wrapper, { animationMs = 220, onError = console.error, onBarChange = () => {} } = {}) {
        this.wrapper = wrapper;
        this.animationMs = animationMs;
        this.onError = onError;
        this.onBarChange = onBarChange;
        this.api = null;
        this.scoreUrl = null;
        this.barCount = 0;
        this.currentBarIndex = 0;
        this.isLoading = false;
        this.extractedBars = new Set();
        this.loadPromise = Promise.resolve(false);
        this.swipe = null;
        this.renderHost = document.createElement("div");
        this.renderHost.className = "vertical-tab-render-source";
        this.renderHost.setAttribute("aria-hidden", "true");
        this.renderHost.style.width = `${Math.max(1400, wrapper.clientWidth || window.innerWidth)}px`;
        document.body.append(this.renderHost);

        this.viewport = wrapper.querySelector(".vertical-tab-viewport");
        this.track = wrapper.querySelector(".vertical-tab-cards");
        this.previousButton = wrapper.querySelector("[data-action='previous']");
        this.nextButton = wrapper.querySelector("[data-action='next']");
        this.bindControls();
        this.setMessage("譜面を読み込み中です。");
    }

    bindControls() {
        this.previousButton?.addEventListener("click", () => this.setCurrentBar(this.currentBarIndex - 1, "button"));
        this.nextButton?.addEventListener("click", () => this.setCurrentBar(this.currentBarIndex + 1, "button"));
        if (!this.viewport) return;

        this.viewport.style.setProperty("--vertical-tab-animation", `${this.animationMs}ms`);
        this.viewport.addEventListener("pointerdown", (event) => {
            if (event.pointerType === "mouse" && event.button !== 0) return;
            this.swipe = { x: event.clientX, y: event.clientY, id: event.pointerId, axis: null };
            this.viewport.classList.add("is-dragging");
            this.viewport.setPointerCapture?.(event.pointerId);
        });
        this.viewport.addEventListener("pointermove", (event) => {
            if (!this.swipe || this.swipe.id !== event.pointerId) return;
            const dx = event.clientX - this.swipe.x;
            const dy = event.clientY - this.swipe.y;
            if (Math.max(Math.abs(dx), Math.abs(dy)) < 5) return;
            this.swipe.axis ??= Math.abs(dy) >= Math.abs(dx) ? "vertical" : "horizontal";
            if (this.swipe.axis === "vertical") {
                const nextIndex = this.currentBarIndex + (dy < 0 ? 1 : -1);
                if (nextIndex < 0 || nextIndex >= this.barCount) {
                    // At either end, keep the stack fixed instead of allowing a rubber-band drag.
                    this.renderPosition(false);
                    return;
                }
                const pitch = Math.max(100, this.viewport.clientHeight / 2.6);
                const drag = Math.max(-0.75, Math.min(0.75, dy / pitch));
                this.renderPosition(false, drag);
            }
        });
        this.viewport.addEventListener("pointerup", (event) => {
            if (!this.swipe || this.swipe.id !== event.pointerId) return;
            const { x, y } = this.swipe;
            this.swipe = null;
            this.viewport.classList.remove("is-dragging");
            const dx = event.clientX - x;
            const dy = event.clientY - y;
            if (Math.abs(dy) >= 38 && Math.abs(dy) > Math.abs(dx)) {
                const nextIndex = this.currentBarIndex + (dy < 0 ? 1 : -1);
                if (nextIndex >= 0 && nextIndex < this.barCount) {
                    this.setCurrentBar(nextIndex, "swipe");
                } else {
                    this.renderPosition(true);
                }
            } else {
                this.renderPosition(true);
            }
        });
        const cancel = () => {
            if (!this.swipe) return;
            this.swipe = null;
            this.viewport.classList.remove("is-dragging");
            this.renderPosition(true);
        };
        this.viewport.addEventListener("pointercancel", cancel);
        this.viewport.addEventListener("lostpointercapture", cancel);
    }

    ensureApi() {
        if (this.api) return this.api;
        if (!window.alphaTab?.AlphaTabApi) throw new Error("alphaTab is not available");

        this.api = new alphaTab.AlphaTabApi(this.renderHost, {
            core: { engine: "svg", useWorkers: false },
            display: { layoutMode: "horizontal", staveProfile: "Tab", scale: 1 },
            notation: { elements: {
                trackNames: false,
                guitarTuning: false,
                scoreTitle: false,
                scoreSubTitle: false,
                chordDiagrams: false,
                barNumber: false,
            } },
            player: { enablePlayer: false, enableUserInteraction: false },
        });

        const renderer = this.api.renderer;
        renderer.partialLayoutFinished?.on?.((args) => {
            if (!args?.id || typeof renderer.renderResult !== "function") {
                this.onError("縦型TAB: alphaTab renderResult IDを取得できません", args);
                return;
            }
            window.setTimeout(() => {
                try {
                    renderer.renderResult(args.id);
                } catch (error) {
                    this.onError("縦型TAB: SVGチャンクの描画に失敗しました", error);
                }
            }, 0);
        });
        renderer.preRender?.on?.(() => {
            this.extractedBars.clear();
            this.track?.replaceChildren();
            this.setMessage("譜面を描画中です。");
        });
        renderer.partialRenderFinished?.on?.((args) => this.handlePartialRender(args));
        this.api.scoreLoaded.on((score) => {
            this.isLoading = false;
            this.barCount = score?.masterBars?.length || 0;
            this.currentBarIndex = Math.max(0, Math.min(this.barCount - 1, this.currentBarIndex));
            this.updateControls();
            console.info("[縦型TAB] score loaded", { bars: this.barCount, tracks: score?.tracks?.length || 0 });
        });
        this.api.error.on((error) => {
            this.isLoading = false;
            this.onError("縦型TAB alphaTab error", error);
            this.setMessage("譜面を表示できませんでした。");
        });
        return this.api;
    }

    load(scoreUrl) {
        if (!scoreUrl) return Promise.resolve(false);
        if (this.scoreUrl === scoreUrl && (this.api?.score || this.isLoading)) return this.loadPromise;
        this.scoreUrl = scoreUrl;
        this.isLoading = true;
        this.currentBarIndex = 0;
        this.extractedBars.clear();
        this.track?.replaceChildren();
        this.setMessage("譜面を読み込み中です。");
        try {
            const api = this.ensureApi();
            this.loadPromise = Promise.resolve(api.load(scoreUrl));
        } catch (error) {
            this.isLoading = false;
            this.loadPromise = Promise.reject(error);
            this.loadPromise.catch((loadError) => this.onError("縦型TABを初期化できません", loadError));
        }
        return this.loadPromise;
    }

    getBoundsLookup() {
        return this.api?.boundsLookup || this.api?.renderer?.boundsLookup || null;
    }

    getMasterBarBounds(index) {
        const lookup = this.getBoundsLookup();
        return lookup?._masterBarLookup?.get(index)
            || lookup?.findMasterBarByIndex?.(index)
            || null;
    }

    handlePartialRender(args) {
        if (!Number.isFinite(args?.firstMasterBarIndex) || args.firstMasterBarIndex < 0
            || !Number.isFinite(args?.lastMasterBarIndex) || args.lastMasterBarIndex < 0) return;
        try {
            const sourceSvg = readSvgResult(args.renderResult);
            const viewBox = sourceSvg.viewBox?.baseVal;
            const sourceWidth = viewBox?.width || Number.parseFloat(sourceSvg.getAttribute("width"));
            const sourceHeight = viewBox?.height || Number.parseFloat(sourceSvg.getAttribute("height"));
            if (!(sourceWidth > 0 && sourceHeight > 0)) throw new Error("SVG bounds are missing");

            for (let index = Math.max(0, args.firstMasterBarIndex); index <= Math.min(this.barCount - 1, args.lastMasterBarIndex); index += 1) {
                if (this.extractedBars.has(index)) continue;
                const bounds = this.getMasterBarBounds(index);
                const rect = rectToXYWH(bounds?.visualBounds)
                    || rectToXYWH(bounds?.realBounds)
                    || rectToXYWH(bounds?.lineAlignedBounds);
                if (!rect) throw new Error(`MasterBar ${index} bounds are not available`);

                const offsetX = Number.isFinite(args.x) ? args.x : 0;
                const offsetY = Number.isFinite(args.y) ? args.y : 0;
                const x = Math.max(0, rect.x - offsetX - 1);
                const y = Math.max(0, rect.y - offsetY - 20);
                const right = Math.min(sourceWidth, rect.x - offsetX + rect.width + 1);
                const bottom = Math.min(sourceHeight, rect.y - offsetY + rect.height + 10);
                const width = right - x;
                const height = bottom - y;
                if (!(width > 0 && height > 0)) throw new Error(`Invalid crop for MasterBar ${index}`);

                const svg = sourceSvg.cloneNode(true);
                preserveAlphaTabStyles(sourceSvg, svg);
                removePrivateUseGlyphs(svg);
                svg.setAttribute("viewBox", `${x} ${y} ${width} ${height}`);
                svg.setAttribute("width", String(width));
                svg.setAttribute("height", String(height));
                svg.setAttribute("preserveAspectRatio", sourceSvg.getAttribute("preserveAspectRatio") || "xMidYMid meet");
                svg.setAttribute("role", "img");
                svg.setAttribute("aria-label", `小節 ${index + 1} のTAB譜`);

                const card = document.createElement("article");
                card.className = "vertical-tab-card";
                card.dataset.barIndex = String(index);
                const heading = document.createElement("h3");
                heading.className = "vertical-tab-card-title";
                heading.textContent = `小節 ${index + 1}`;
                card.append(heading, document.importNode(svg, true));
                this.track.append(card);
                this.extractedBars.add(index);
                console.info(`[縦型TAB] extracted bar ${index + 1}`, { x, y, width, height });
            }
            this.setMessage("");
            this.renderPosition(false);
        } catch (error) {
            this.onError("縦型TAB小節SVGの抽出に失敗しました", error);
            this.setMessage("譜面を表示できませんでした。");
        }
    }

    setMessage(message) {
        const element = this.wrapper.querySelector(".vertical-tab-message");
        if (element) {
            element.textContent = message;
            element.hidden = !message;
        }
    }

    setCurrentBar(index, source = "practice") {
        if (!this.barCount) {
            this.currentBarIndex = Math.max(0, index);
            return;
        }
        const next = Math.max(0, Math.min(this.barCount - 1, Math.trunc(index)));
        if (next === this.currentBarIndex) return;
        const previous = this.currentBarIndex;
        this.currentBarIndex = next;
        this.onBarChange(next, source);
        console.info(`[縦型TAB] ${source}: ${previous + 1} → ${next + 1}`);
        this.renderPosition(true);
    }

    resetToFirstBar() {
        this.setCurrentBar(0, "reset");
        this.currentBarIndex = 0;
        this.renderPosition(true);
    }

    renderPosition(animate = true, drag = 0) {
        const pitch = Math.max(110, (this.viewport?.clientHeight || 360) / 2.7);
        for (const card of this.track?.querySelectorAll(".vertical-tab-card") || []) {
            const index = Number(card.dataset.barIndex);
            const relative = index - this.currentBarIndex + drag;
            const visible = Math.abs(relative) <= 1.05;
            const current = Math.abs(relative) < 0.5;
            card.hidden = !visible;
            card.classList.toggle("is-current", current);
            card.classList.toggle("is-before", relative < 0);
            card.classList.toggle("is-after", relative > 0);
            card.style.setProperty("--bar-y", `${relative * pitch}px`);
            card.style.setProperty("--bar-opacity", current ? "1" : "0.58");
            card.style.zIndex = current ? "3" : "2";
            card.setAttribute("aria-current", current ? "step" : "false");
        }
        if (animate) this.viewport?.classList.remove("is-dragging");
        this.updateControls();
    }

    updateControls() {
        if (this.previousButton) this.previousButton.disabled = !this.barCount || this.currentBarIndex <= 0;
        if (this.nextButton) this.nextButton.disabled = !this.barCount || this.currentBarIndex >= this.barCount - 1;
    }

    destroy() {
        try { this.api?.destroy(); } catch (error) { this.onError("縦型TAB renderer destroy failed", error); }
        this.api = null;
        this.renderHost.remove();
        this.track?.replaceChildren();
        this.extractedBars.clear();
    }
}
