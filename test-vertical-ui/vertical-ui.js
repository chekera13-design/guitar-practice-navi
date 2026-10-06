(() => {
  const config = window.verticalUiConfig;
  const $ = (selector) => document.querySelector(selector);
  const apiRoot = $("#alphaTabSource");
  const isTest01Mode = config.scoreMode === "test01";
  const barCount = 8;
  let currentBarIndex = Math.max(0, Math.min(barCount - 1, (Number(config.initialMeasure) || 1) - 1));
  let api = null;
  let verticalApi = null;
  let verticalRenderHost = null;
  const extractedBars = new Set();
  let swipeStart = null;
  let alphaTabStyleDiagnosticsLogged = false;
  let wheelBlockedUntil = 0;
  let autoplayTimer = null;
  let test01LayoutLogged = false;
  let test01RenderSize = null;

  $("#fileName").textContent = config.scoreFileName;
  const scoreSelect = $("#scoreSelect");
  if (scoreSelect) {
    scoreSelect.value = config.scoreMode;
    scoreSelect.addEventListener("change", () => {
      const nextMode = scoreSelect.value === "ex01" ? "ex01" : "test01";
      const nextUrl = new URL(window.location.href);
      if (nextMode === "ex01") nextUrl.searchParams.delete("score");
      else nextUrl.searchParams.set("score", "test01");
      window.location.assign(nextUrl);
    });
  }

  if (isTest01Mode) {
    $("#pageTitle").textContent = "alphaTab system break検証";
    $("#pageIntro").textContent = "test01.mxlのMusicXML改行指定をalphaTabが認識し、1小節ごとにsystemを分けるか確認します。";
    $("#verticalPanel").hidden = true;
    $("#originalTitle").textContent = "test01.mxl / alphaTab Original";
    $("#originalDescription").textContent = "alphaTabの元レンダリング";
    $("#originalPanel").parentElement.insertBefore($("#originalPanel"), $("#verticalPanel"));
    $(".debug-panel").hidden = true;
  } else {
    $("#pageTitle").textContent = "全8小節 SVG切り出しテスト";
    $("#pageIntro").textContent = "MXLをalphaTabで描画し、各小節を個別SVGとして縦に表示します。";
    $("#originalTitle").textContent = "Original alphaTab";
    $("#originalDescription").textContent = "EX1 全体";
  }

  function setLoadState(state, message = "") {
    const success = state === "success";
    const failed = state === "failed";
    $("#loadState").textContent = success ? "MXL / Score 読み込み成功" : failed ? "MXL読み込み失敗" : "MXLを読み込み中";
    $("#loadDot").className = `load-dot ${success ? "success" : failed ? "error" : "loading"}`;
    $("#loadError").hidden = !failed;
    $("#loadError").textContent = message;
  }

  function asArray(value) {
    try { return Array.from(value || []); } catch { return []; }
  }

  function getBarNumberVisibility(targetApi) {
    const elements = targetApi?.settings?.notation?.elements;
    const barNumberKey = window.alphaTab?.NotationElement?.BarNumber;
    if (barNumberKey !== undefined && typeof elements?.get === "function") return elements.get(barNumberKey);
    return elements?.barNumber ?? (barNumberKey !== undefined ? elements?.[barNumberKey] : undefined) ?? "unavailable";
  }

  function getBoundsLookup() {
    const renderApi = verticalApi || api;
    return renderApi?.boundsLookup || renderApi?.renderer?.boundsLookup || null;
  }

  function getMasterBarBounds(index) {
    const lookup = getBoundsLookup();
    const renderApi = verticalApi || api;
    const masterBar = renderApi?.score?.masterBars?.[index];
    return lookup?._masterBarLookup?.get(index)
      || (masterBar && lookup?.findMasterBar?.(masterBar))
      || lookup?.findMasterBarByIndex?.(index)
      || asArray(lookup?.staffSystems).flatMap((system) => asArray(system?.bars)).find((item) => item?.index === index)
      || null;
  }

  function getRenderSize(args) {
    const svg = typeof args?.renderResult === "string"
      ? new DOMParser().parseFromString(args.renderResult, "image/svg+xml").documentElement
      : args?.renderResult;
    const attrNumber = (name) => Number.parseFloat(svg?.getAttribute?.(name)) || 0;
    return {
      width: Number(args?.width) > 0 ? Number(args.width) : attrNumber("width"),
      height: Number(args?.height) > 0 ? Number(args.height) : attrNumber("height"),
    };
  }

  function reportTest01Layout(args = null, source = "render") {
    if (!isTest01Mode || test01LayoutLogged) return;
    const score = api?.score;
    const lookup = getBoundsLookup();
    if (!score || !lookup) return;
    const systems = asArray(lookup.staffSystems);
    if (lookup.isFinished === false || systems.length === 0) return;

    const size = getRenderSize(args);
    if (size.width > 0 || size.height > 0) test01RenderSize = size;
    console.group("[TEST01] alphaTab layout report");
    console.log("[TEST01] score loaded");
    console.log("[TEST01] masterBars =", score.masterBars?.length ?? 0);
    console.log("[TEST01] tracks =", score.tracks?.length ?? 0);
    console.log("[TEST01] render width =", test01RenderSize?.width ?? 0);
    console.log("[TEST01] render height =", test01RenderSize?.height ?? 0);
    console.log("[TEST01] staffSystems =", systems.length, systems);
    for (let index = 0; index < (score.masterBars?.length ?? 0); index += 1) {
      const bounds = getMasterBarBounds(index);
      const scoreMasterBar = score.masterBars[index];
      console.group(`[TEST01] measure ${index + 1}`);
      console.log("masterBar index =", index);
      console.log("isFirstOfLine =", bounds?.isFirstOfLine ?? scoreMasterBar?.isFirstOfLine);
      console.log("staffSystemBounds =", bounds?.staffSystemBounds ?? null);
      console.log("visualBounds =", bounds?.visualBounds ?? null);
      console.groupEnd();
    }
    console.log("[TEST01] layout source =", source);
    console.groupEnd();
    test01LayoutLogged = true;
  }

  function handleTest01PartialRender(args) {
    if (args?.firstMasterBarIndex < 0 || args?.lastMasterBarIndex < 0) return;
    const size = getRenderSize(args);
    if (size.width > 0 || size.height > 0) test01RenderSize = size;
    console.log("[TEST01] partialRenderFinished", {
      firstMasterBarIndex: args?.firstMasterBarIndex,
      lastMasterBarIndex: args?.lastMasterBarIndex,
      width: test01RenderSize.width,
      height: test01RenderSize.height,
      renderResultType: typeof args?.renderResult,
    });
    reportTest01Layout(args, "partialRenderFinished");
  }

  function ownAndPrototypeKeys(value) {
    if (!value || (typeof value !== "object" && typeof value !== "function")) return [];
    const keys = new Set();
    for (let current = value; current && current !== Object.prototype; current = Object.getPrototypeOf(current)) {
      for (const key of Object.getOwnPropertyNames(current)) keys.add(key);
    }
    return [...keys];
  }

  function rectToXYWH(value) {
    if (!value || typeof value !== "object") return null;
    const number = (...candidates) => candidates.find((candidate) => typeof candidate === "number" && Number.isFinite(candidate));
    const left = number(value.x, value.left);
    const top = number(value.y, value.top);
    let width = number(value.width, value.w);
    let height = number(value.height, value.h);
    const right = number(value.right);
    const bottom = number(value.bottom);
    if (width === undefined && left !== undefined && right !== undefined) width = right - left;
    if (height === undefined && top !== undefined && bottom !== undefined) height = bottom - top;
    if (left === undefined || top === undefined || width === undefined || height === undefined || width <= 0 || height <= 0) return null;
    return { x: left, y: top, width, height };
  }

  function describeRect(rect) {
    const normalized = rectToXYWH(rect);
    return normalized ? { ...normalized, valid: true } : {
      x: rect?.x, y: rect?.y, width: rect?.width, height: rect?.height,
      left: rect?.left, top: rect?.top, right: rect?.right, bottom: rect?.bottom,
      w: rect?.w, h: rect?.h, valid: false,
    };
  }

  function reportMasterBarBounds(index) {
    const lookup = getBoundsLookup();
    const masterBar = getMasterBarBounds(index);
    const boundsState = $("#boundsState");
    if (boundsState) boundsState.textContent = lookup ? "OK" : "未取得";
    if (!masterBar) {
      console.warn(`[縦型TAB UI] masterBar ${index} bounds are not available yet`);
      return null;
    }

    const result = {
      visualBounds: masterBar.visualBounds,
      realBounds: masterBar.realBounds,
      lineAlignedBounds: masterBar.lineAlignedBounds,
      masterBar,
    };
    if (index === currentBarIndex) {
      console.log("[縦型TAB UI] masterBar 2 bounds detail =", masterBar);
      console.log("[縦型TAB UI] masterBar 2 bounds keys =", ownAndPrototypeKeys(masterBar));
      console.log("[縦型TAB UI] visualBounds detail =", masterBar.visualBounds);
      console.log("[縦型TAB UI] visualBounds keys =", ownAndPrototypeKeys(masterBar.visualBounds));
      console.log("[縦型TAB UI] visualBounds JSON =", JSON.stringify(masterBar.visualBounds, null, 2));
      console.log("[縦型TAB UI] realBounds detail =", masterBar.realBounds);
      console.log("[縦型TAB UI] realBounds keys =", ownAndPrototypeKeys(masterBar.realBounds));
      console.log("[縦型TAB UI] lineAlignedBounds detail =", masterBar.lineAlignedBounds);
      console.log("[縦型TAB UI] lineAlignedBounds keys =", ownAndPrototypeKeys(masterBar.lineAlignedBounds));
      const debugInfo = $("#debugInfo");
      if (debugInfo) debugInfo.textContent = [
        "Target: MasterBar index 2 (3小節目)",
      `visualBounds: ${JSON.stringify(describeRect(result.visualBounds))}`,
      `realBounds: ${JSON.stringify(describeRect(result.realBounds))}`,
      `lineAlignedBounds: ${JSON.stringify(describeRect(result.lineAlignedBounds))}`,
      ].join("\n");
    }
    return result;
  }

  function readSvgResult(result) {
    if (typeof result === "string") {
      const doc = new DOMParser().parseFromString(result, "image/svg+xml");
      const parserError = doc.querySelector("parsererror");
      if (parserError) throw new Error(`SVG parse error: ${parserError.textContent}`);
      if (doc.documentElement?.localName !== "svg") throw new Error("renderResult string root is not <svg>");
      return doc.documentElement;
    }
    if (result?.nodeType === Node.ELEMENT_NODE && result.localName === "svg") return result;
    if (result instanceof Document && result.documentElement?.localName === "svg") return result.documentElement;
    throw new Error(`Unsupported renderResult type: ${typeof result} (${result?.constructor?.name || "unknown"})`);
  }

  function getSvgViewBox(svg) {
    const box = svg.viewBox?.baseVal;
    if (box && box.width > 0 && box.height > 0) return { x: box.x, y: box.y, width: box.width, height: box.height };
    const width = Number.parseFloat(svg.getAttribute("width")) || 0;
    const height = Number.parseFloat(svg.getAttribute("height")) || 0;
    if (width > 0 && height > 0) return { x: 0, y: 0, width, height };
    throw new Error("SVG has no usable viewBox or width/height");
  }

  function findMusicGlyph(svg) {
    return [...(svg?.querySelectorAll?.(".at") || [])]
      .find((element) => element.querySelector("text"))
      || svg?.querySelector?.(".at text")
      || null;
  }

  function getSourceMusicFont(sourceSvg) {
    const probe = document.createElement("div");
    probe.className = "alphaTabSurface at-surface";
    Object.assign(probe.style, {
      position: "fixed", left: "-100000px", top: "0", width: "1420px",
      height: "145px", visibility: "hidden", pointerEvents: "none",
    });
    const probeSvg = document.importNode(sourceSvg, true);
    probe.append(probeSvg);
    document.body.append(probe);
    const glyph = findMusicGlyph(probeSvg);
    const fontFamily = glyph ? getComputedStyle(glyph).fontFamily : "";
    const glyphText = glyph?.querySelector("text")?.textContent || "";
    const glyphCodes = [...glyphText].slice(0, 8).map((char) => `U+${char.codePointAt(0).toString(16).toUpperCase()}`);
    const fontLoaded = fontFamily && document.fonts?.check?.(`16px ${fontFamily}`);
    console.log("[縦型TAB UI] source SVG music font =", fontFamily || "computed font unavailable");
    console.log("[縦型TAB UI] source SVG music glyph =", glyphCodes);
    console.log("[縦型TAB UI] source SVG font loaded =", fontLoaded);
    console.log("[縦型TAB UI] source SVG styles / defs =", {
      styles: probeSvg.querySelectorAll("style").length,
      defs: probeSvg.querySelectorAll("defs").length,
    });
    probe.remove();
    return fontFamily;
  }

  function findAlphaTabStylesheet() {
    return [...document.querySelectorAll("style")].find((style) => {
      const css = style.textContent || "";
      return /@font-face/i.test(css) && /alphaTab/i.test(css)
        && /font-family\s*:/i.test(css);
    }) || null;
  }

  function preserveAlphaTabStyles(sourceSvg, extractedSvg, sourceMusicFont) {
    const inlineStyles = [...sourceSvg.querySelectorAll("style")];
    const hasEmbeddedMusicFont = inlineStyles.some((style) =>
      /@font-face/i.test(style.textContent || "") && /alphaTab/i.test(style.textContent || ""));
    const alphaTabStylesheet = findAlphaTabStylesheet();
    if (!alphaTabStyleDiagnosticsLogged) {
      const css = alphaTabStylesheet?.textContent || "";
      const declaredFamilies = [...css.matchAll(/font-family\s*:\s*(['"]?)([^;'"}\s]+)\1/gi)].map((match) => match[2]);
      console.log("[縦型TAB UI] alphaTab stylesheet source =", {
        found: Boolean(alphaTabStylesheet),
        id: alphaTabStylesheet?.id || null,
        fontFamilies: [...new Set(declaredFamilies)],
        sourceMusicFont,
      });
      alphaTabStyleDiagnosticsLogged = true;
    }
    if (!hasEmbeddedMusicFont && alphaTabStylesheet) {
      const styleCopy = document.createElementNS("http://www.w3.org/2000/svg", "style");
      styleCopy.setAttribute("type", "text/css");
      styleCopy.textContent = alphaTabStylesheet.textContent;
      extractedSvg.insertBefore(styleCopy, extractedSvg.firstChild);
      console.log("[縦型TAB UI] preserved alphaTab SVG styles");
    } else if (hasEmbeddedMusicFont) {
      console.log("[縦型TAB UI] preserved alphaTab SVG styles");
    } else {
      console.warn("[縦型TAB UI] alphaTab font stylesheet was not found; source computed font is applied to .at glyph groups");
    }

    const sourceDefsCount = sourceSvg.querySelectorAll("defs").length;
    const extractedDefsCount = extractedSvg.querySelectorAll("defs").length;
    if (sourceDefsCount > 0 && extractedDefsCount >= sourceDefsCount) {
      console.log("[縦型TAB UI] preserved alphaTab SVG defs", extractedDefsCount);
    }

    if (sourceMusicFont) {
      for (const glyphGroup of extractedSvg.querySelectorAll(".at")) {
        glyphGroup.style.fontFamily = sourceMusicFont;
      }
    }
  }

  function removePrivateUseGlyphs(svg) {
    const isPrivateUse = (codePoint) =>
      (codePoint >= 0xe000 && codePoint <= 0xf8ff)
      || (codePoint >= 0xf0000 && codePoint <= 0xffffd)
      || (codePoint >= 0x100000 && codePoint <= 0x10fffd);
    let removed = 0;
    for (const textElement of svg.querySelectorAll("text")) {
      const walker = document.createTreeWalker(textElement, NodeFilter.SHOW_TEXT);
      const textNodes = [];
      while (walker.nextNode()) textNodes.push(walker.currentNode);
      for (const textNode of textNodes) {
        const original = textNode.nodeValue || "";
        const filtered = [...original].filter((char) => !isPrivateUse(char.codePointAt(0))).join("");
        if (filtered !== original) {
          removed += [...original].length - [...filtered].length;
          textNode.nodeValue = filtered;
        }
      }
      if (!textElement.textContent) textElement.remove();
    }
    if (removed) console.log("[縦型TAB UI] removed private-use music glyphs from extracted SVG =", removed);
    return removed;
  }

  function extractMasterBarSvg(sourceSvg, renderArgs, boundsInfo, masterBarIndex, sourceMusicFont) {
    const rect = rectToXYWH(boundsInfo.visualBounds)
      || rectToXYWH(boundsInfo.realBounds)
      || rectToXYWH(boundsInfo.lineAlignedBounds);
    if (!rect) throw new Error(`MasterBar index ${masterBarIndex} has no usable bounds`);

    const sourceBox = getSvgViewBox(sourceSvg);
    const resultOffsetX = Number.isFinite(renderArgs?.x) ? renderArgs.x : 0;
    const resultOffsetY = Number.isFinite(renderArgs?.y) ? renderArgs.y : 0;
    const paddingX = 1;
    const paddingTop = 20;
    const paddingBottom = 10;
    const rawX = rect.x - resultOffsetX - paddingX;
    const rawY = rect.y - resultOffsetY - paddingTop;
    const x = Math.max(sourceBox.x, rawX);
    const y = Math.max(sourceBox.y, rawY);
    const right = Math.min(sourceBox.x + sourceBox.width, rect.x - resultOffsetX + rect.width + paddingX);
    const bottom = Math.min(sourceBox.y + sourceBox.height, rect.y - resultOffsetY + rect.height + paddingBottom);
    const cropWidth = right - x;
    const cropHeight = bottom - y;
    if (!(cropWidth > 0 && cropHeight > 0)) throw new Error(`Bar ${masterBarIndex + 1} crop is outside the SVG viewBox (x=${x}, y=${y}, width=${cropWidth}, height=${cropHeight})`);

    const clippedSvg = sourceSvg.cloneNode(true);
    preserveAlphaTabStyles(sourceSvg, clippedSvg, sourceMusicFont);
    removePrivateUseGlyphs(clippedSvg);
    clippedSvg.setAttribute("viewBox", `${x} ${y} ${cropWidth} ${cropHeight}`);
    clippedSvg.setAttribute("preserveAspectRatio", sourceSvg.getAttribute("preserveAspectRatio") || "xMidYMid meet");
    clippedSvg.setAttribute("width", String(cropWidth));
    clippedSvg.setAttribute("height", String(cropHeight));
    clippedSvg.setAttribute("role", "img");
    clippedSvg.setAttribute("aria-label", `${config.scoreFileName} ${masterBarIndex + 1}小節目のTAB譜`);
    const extractedRect = { x, y, width: cropWidth, height: cropHeight };
    console.log(`[縦型TAB UI] extracted bar ${masterBarIndex + 1} rect =`, extractedRect);
    return { svg: clippedSvg, crop: extractedRect, sourceBox };
  }

  function getCarouselStepPitch(viewport) {
    const nearbyCards = [...document.querySelectorAll("#verticalBars .bar-card")]
      .filter((card) => Math.abs(Number(card.dataset.masterBarIndex) - currentBarIndex) <= 1);
    const tallestCard = nearbyCards.reduce((height, card) => Math.max(height, card.offsetHeight), 0);
    const maxScaleHeight = tallestCard * 1.08;
    const roomForNeighbor = Math.max(0, (viewport.clientHeight - maxScaleHeight) / 2);
    return roomForNeighbor > 0
      ? Math.min(viewport.clientHeight / 2.45, roomForNeighbor)
      : viewport.clientHeight / 2.8;
  }

  function renderCarouselPosition(animate = true, dragSteps = 0) {
    const viewport = $("#carouselViewport");
    const track = $("#verticalBars");
    if (!viewport || !track) return;

    const pitch = getCarouselStepPitch(viewport);
    const cards = [...track.querySelectorAll(".bar-card")];
    for (const card of cards) {
      const index = Number(card.dataset.masterBarIndex);
      const relativePosition = index - currentBarIndex + dragSteps;
      const distance = Math.abs(relativePosition);
      const isCurrent = distance < 0.5;
      const scale = 1;
      const opacity = isCurrent ? 1 : 0.58;
      card.classList.toggle("is-current", isCurrent);
      card.classList.toggle("is-above", relativePosition < 0);
      card.classList.toggle("is-below", relativePosition > 0);
      const visibleDistance = Math.abs(dragSteps) > 0.001 ? 1.05 : 1;
      card.hidden = distance > visibleDistance;
      card.dataset.distance = String(distance);
      card.style.setProperty("--card-y", `${relativePosition * pitch}px`);
      card.style.setProperty("--card-scale", String(scale));
      card.style.setProperty("--card-opacity", String(opacity));
      card.style.zIndex = String(20 - Math.round(distance * 4));
      card.setAttribute("aria-hidden", distance > visibleDistance ? "true" : "false");
      card.setAttribute("aria-current", index === currentBarIndex ? "step" : "false");
      const heading = card.querySelector(".bar-card-title");
      if (heading) heading.textContent = `小節 ${index + 1}${isCurrent ? " · 現在小節" : ""}`;
    }

    track.classList.toggle("is-animating", animate);
    updateBarControls();
    if (Math.abs(dragSteps) < 0.001) {
      console.log(`[縦型TAB UI] currentBarIndex = ${currentBarIndex}`);
      console.log(`[縦型TAB UI] center bar = ${currentBarIndex + 1}`);
    }
  }

  function setCurrentBarIndex(nextIndex) {
    setCurrentBarIndexFrom(nextIndex, "program");
  }

  function setCurrentBarIndexFrom(nextIndex, source) {
    const boundedIndex = Math.max(0, Math.min(barCount - 1, nextIndex));
    if (boundedIndex === currentBarIndex) {
      console.log(`[縦型TAB UI] ${source} bar unchanged = ${currentBarIndex + 1}`);
      return;
    }
    const previousBarIndex = currentBarIndex;
    currentBarIndex = boundedIndex;
    console.log(`[縦型TAB UI] ${source} bar change = ${previousBarIndex + 1} → ${currentBarIndex + 1}`);
    renderCarouselPosition(true);
    if (source === "autoplay" && currentBarIndex === barCount - 1) {
      stopAutoplayTimer();
      config.autoplayEnabled = false;
      updateBarControls();
      console.log("[縦型TAB UI] autoplay stopped at final bar");
    }
  }

  function updateBarControls() {
    const previousButton = $("#previousBarButton");
    const nextButton = $("#nextBarButton");
    const autoplayButton = $("#autoplayButton");
    const speedSelect = $("#autoplaySpeed");
    const barsReady = extractedBars.size > 0;
    if (previousButton) previousButton.disabled = !barsReady || currentBarIndex <= 0;
    if (nextButton) nextButton.disabled = !barsReady || currentBarIndex >= barCount - 1;
    if (autoplayButton) {
      autoplayButton.disabled = extractedBars.size < barCount;
      autoplayButton.setAttribute("aria-pressed", config.autoplayEnabled ? "true" : "false");
      autoplayButton.textContent = config.autoplayEnabled ? "⏸ 自動スクロール停止" : "▶ 自動スクロール";
    }
    if (speedSelect) speedSelect.value = String(config.autoplaySeconds ?? 2);
  }

  function stopAutoplayTimer() {
    if (autoplayTimer !== null) {
      window.clearInterval(autoplayTimer);
      autoplayTimer = null;
    }
  }

  function startAutoplayTimer() {
    stopAutoplayTimer();
    const intervalMs = Number(config.autoplaySeconds) * 1000;
    if (!config.autoplayEnabled || extractedBars.size < barCount || !Number.isFinite(intervalMs) || intervalMs <= 0) return;
    if (currentBarIndex >= barCount - 1) {
      config.autoplayEnabled = false;
      updateBarControls();
      console.log("[縦型TAB UI] autoplay stopped at final bar");
      return;
    }
    autoplayTimer = window.setInterval(() => {
      if (swipeStart) return;
      if (currentBarIndex >= barCount - 1) {
        stopAutoplayTimer();
        config.autoplayEnabled = false;
        updateBarControls();
        console.log("[縦型TAB UI] autoplay stopped at final bar");
        return;
      }
      setCurrentBarIndexFrom(currentBarIndex + 1, "autoplay");
    }, intervalMs);
    console.log(`[縦型TAB UI] autoplay enabled; interval = ${intervalMs}ms`);
  }

  function bindCarouselSwipe() {
    const viewport = $("#carouselViewport");
    if (!viewport) return;
    viewport.style.setProperty("--carousel-duration", `${Math.max(0, Number(config.animationMs) || 220)}ms`);

    $("#previousBarButton")?.addEventListener("click", () => {
      stopAutoplayTimer();
      setCurrentBarIndexFrom(currentBarIndex - 1, "button");
      startAutoplayTimer();
    });
    $("#nextBarButton")?.addEventListener("click", () => {
      stopAutoplayTimer();
      setCurrentBarIndexFrom(currentBarIndex + 1, "button");
      startAutoplayTimer();
    });
    $("#autoplayButton")?.addEventListener("click", () => {
      config.autoplayEnabled = !config.autoplayEnabled;
      if (config.autoplayEnabled) startAutoplayTimer();
      else stopAutoplayTimer();
      updateBarControls();
      console.log(`[縦型TAB UI] autoplay ${config.autoplayEnabled ? "enabled" : "disabled"}`);
    });
    $("#autoplaySpeed")?.addEventListener("change", (event) => {
      config.autoplaySeconds = Number(event.currentTarget.value);
      console.log(`[縦型TAB UI] autoplay interval = ${config.autoplaySeconds}s`);
      if (config.autoplayEnabled) startAutoplayTimer();
    });

    function cancelSwipe() {
      if (!swipeStart) return;
      swipeStart = null;
      viewport.classList.remove("is-dragging");
      renderCarouselPosition(true);
      startAutoplayTimer();
    }

    viewport.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      stopAutoplayTimer();
      swipeStart = { x: event.clientX, y: event.clientY, pointerId: event.pointerId, startIndex: currentBarIndex };
      viewport.classList.add("is-dragging");
      viewport.setPointerCapture?.(event.pointerId);
    });
    viewport.addEventListener("pointermove", (event) => {
      if (!swipeStart || swipeStart.pointerId !== event.pointerId) return;
      const deltaX = event.clientX - swipeStart.x;
      const deltaY = event.clientY - swipeStart.y;
      if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) <= 4) return;
      if (swipeStart.axis === undefined) swipeStart.axis = Math.abs(deltaY) >= Math.abs(deltaX) ? "vertical" : "horizontal";
      if (swipeStart.axis !== "vertical") return;
      const dragSteps = Math.max(-0.85, Math.min(0.85, deltaY / getCarouselStepPitch(viewport)));
      renderCarouselPosition(false, dragSteps);
    });
    viewport.addEventListener("pointerup", (event) => {
      if (!swipeStart || swipeStart.pointerId !== event.pointerId) return;
      const deltaX = event.clientX - swipeStart.x;
      const deltaY = event.clientY - swipeStart.y;
      const startIndex = swipeStart.startIndex;
      swipeStart = null;
      viewport.classList.remove("is-dragging");
      const threshold = Math.max(1, Number(config.swipeThreshold) || 38);
      if (Math.abs(deltaY) < threshold || Math.abs(deltaY) <= Math.abs(deltaX)) {
        renderCarouselPosition(true);
        startAutoplayTimer();
        return;
      }
      const step = deltaY < 0 ? 1 : -1;
      const previousIndex = currentBarIndex;
      setCurrentBarIndexFrom(startIndex + step, "swipe");
      if (previousIndex === currentBarIndex) renderCarouselPosition(true);
      startAutoplayTimer();
    });
    viewport.addEventListener("pointercancel", () => {
      cancelSwipe();
    });
    viewport.addEventListener("lostpointercapture", cancelSwipe);
    viewport.addEventListener("wheel", (event) => {
      event.preventDefault();
      const now = performance.now();
      if (now < wheelBlockedUntil || Math.abs(event.deltaY) < 8) return;
      wheelBlockedUntil = now + 420;
      setCurrentBarIndexFrom(currentBarIndex + (event.deltaY > 0 ? 1 : -1), "wheel");
      startAutoplayTimer();
    }, { passive: false });
    window.addEventListener("resize", () => renderCarouselPosition(false));
  }

  function logRenderEvent(args) {
    console.log("[縦型TAB UI] partialRenderFinished", args);
    console.log("[縦型TAB UI] firstMasterBarIndex =", args?.firstMasterBarIndex);
    console.log("[縦型TAB UI] lastMasterBarIndex =", args?.lastMasterBarIndex);
    console.log("[縦型TAB UI] x =", args?.x);
    console.log("[縦型TAB UI] y =", args?.y);
    console.log("[縦型TAB UI] width =", args?.width);
    console.log("[縦型TAB UI] height =", args?.height);
    console.log("[縦型TAB UI] renderResult =", args?.renderResult);
    console.log("[縦型TAB UI] renderResult type =", typeof args?.renderResult);
  }

  function handlePartialRender(args) {
    logRenderEvent(args);
    if (!Number.isFinite(args?.firstMasterBarIndex) || !Number.isFinite(args?.lastMasterBarIndex)) return;
    if (args.firstMasterBarIndex < 0 || args.lastMasterBarIndex < 0) {
      console.log("[縦型TAB UI] skip non-score partial render", args.firstMasterBarIndex, args.lastMasterBarIndex);
      return;
    }
    try {
      const sourceSvg = readSvgResult(args.renderResult);
      const sourceMusicFont = getSourceMusicFont(sourceSvg);
      const verticalBars = $("#verticalBars");
      if (!verticalBars) throw new Error("#verticalBars test container is missing");

      const startIndex = Math.max(0, args.firstMasterBarIndex);
      const endIndex = Math.min(barCount - 1, args.lastMasterBarIndex);
      for (let masterBarIndex = startIndex; masterBarIndex <= endIndex; masterBarIndex += 1) {
        if (extractedBars.has(masterBarIndex)) continue;
        try {
          const boundsInfo = reportMasterBarBounds(masterBarIndex);
          if (!boundsInfo) throw new Error(`BoundsLookup did not provide MasterBar index ${masterBarIndex}`);
          const { svg, crop, sourceBox } = extractMasterBarSvg(sourceSvg, args, boundsInfo, masterBarIndex, sourceMusicFont);
          const card = document.createElement("article");
          card.className = "bar-card";
          card.id = `bar-${masterBarIndex}`;
          card.dataset.masterBarIndex = String(masterBarIndex);
          card.setAttribute("aria-current", "false");
          const heading = document.createElement("h3");
          heading.className = "bar-card-title";
          heading.textContent = `小節 ${masterBarIndex + 1}`;
          card.append(heading, document.importNode(svg, true));
          verticalBars.querySelector("#extractMessage")?.remove();
          const nextCard = [...verticalBars.children].find((child) => Number(child.dataset.masterBarIndex) > masterBarIndex);
          verticalBars.insertBefore(card, nextCard || null);
          extractedBars.add(masterBarIndex);
          console.log(`[縦型TAB UI] extracted bar ${masterBarIndex + 1} success`, crop);
          if (masterBarIndex === 0) {
            const extractedGlyph = findMusicGlyph(card);
            const extractedMusicFont = extractedGlyph ? getComputedStyle(extractedGlyph).fontFamily : "";
            console.log("[縦型TAB UI] extracted SVG music font =", extractedMusicFont || "computed font unavailable");
            console.log("[縦型TAB UI] extracted SVG music glyph =", [...(extractedGlyph?.querySelector("text")?.textContent || "")].slice(0, 8).map((char) => `U+${char.codePointAt(0).toString(16).toUpperCase()}`));
            console.log("[縦型TAB UI] extracted SVG styles / defs =", {
              styles: svg.querySelectorAll("style").length,
              defs: svg.querySelectorAll("defs").length,
            });
            console.log("[縦型TAB UI] alphaTab font availability =", document.fonts?.check?.(`16px ${sourceMusicFont}`));
          }
          if (masterBarIndex === currentBarIndex) {
            const debugInfo = $("#debugInfo");
            if (debugInfo) debugInfo.textContent += [
              "",
              `partialRender range: ${args.firstMasterBarIndex}–${args.lastMasterBarIndex}`,
              `source SVG viewBox: ${JSON.stringify(sourceBox)}`,
              `render args offset: x=${args.x}, y=${args.y}`,
              `Extracted Bar 3 viewBox: ${JSON.stringify(crop)}`,
            ].join("\n");
          }
        } catch (error) {
          console.error(`[縦型TAB UI] extracted bar ${masterBarIndex + 1} failed`, error);
        }
      }

      renderCarouselPosition(false);
      startAutoplayTimer();
      const bar3Status = $("#bar3Status");
      if (bar3Status) bar3Status.textContent = `${extractedBars.size}/${barCount}小節を表示`;
    } catch (error) {
      console.error("[縦型TAB UI] partial SVG processing failed", error);
      const bar3Status = $("#bar3Status");
      if (bar3Status) bar3Status.textContent = "抽出失敗";
    }
  }

  function fail(error) {
    console.error("[縦型TAB UI] MXL / alphaTab error", error);
    const message = `${error?.message || error}\n\nfile:// で開いている場合は、ローカルHTTPサーバーから開くか、ローカルファイル読み込みに対応したページからMXLを選択してください。`;
    if ($("#loadState") && $("#loadDot") && $("#loadError")) setLoadState("failed", message);
    const bar3Status = $("#bar3Status");
    if (bar3Status) bar3Status.textContent = "読込失敗";
    const extractMessage = $("#extractMessage");
    if (extractMessage) extractMessage.textContent = error?.message || String(error);
  }

  function init() {
    if (!window.alphaTab?.AlphaTabApi) return fail(new Error("alphaTab CDNを読み込めません。"));
    try {
      if (!isTest01Mode) bindCarouselSwipe();
      const createSettings = (showBarNumbers) => ({
        core: { engine: "svg", useWorkers: false },
        display: { layoutMode: "horizontal", staveProfile: "Tab", scale: 1 },
        notation: { elements: { trackNames: false, guitarTuning: false, scoreTitle: false, scoreSubTitle: false, chordDiagrams: false, barNumber: showBarNumbers } },
        player: { enablePlayer: false, enableUserInteraction: false },
      });
      // Original alphaTab keeps bar numbers. A separate offscreen renderer supplies
      // the cropped vertical cards with bar numbers disabled at render time.
      api = new alphaTab.AlphaTabApi(apiRoot, createSettings(true));
      if (!isTest01Mode) {
        verticalRenderHost = document.createElement("div");
        verticalRenderHost.id = "verticalAlphaTabSource";
        verticalRenderHost.className = "vertical-render-source";
        verticalRenderHost.setAttribute("aria-hidden", "true");
        verticalRenderHost.style.width = `${Math.max(1, apiRoot.parentElement?.clientWidth || apiRoot.clientWidth || 390)}px`;
        document.body.append(verticalRenderHost);
        verticalApi = new alphaTab.AlphaTabApi(verticalRenderHost, createSettings(false));
        console.log("[縦型TAB UI] vertical renderer barNumber =", getBarNumberVisibility(verticalApi));
        console.log("[Original alphaTab] barNumber =", getBarNumberVisibility(api));
        verticalApi.scoreLoaded.on((score) => {
          console.log("[縦型TAB UI] vertical renderer scoreLoaded", {
            masterBars: score?.masterBars?.length,
            tracks: score?.tracks?.length,
          });
        });
        verticalApi.renderFinished.on((args) => {
          console.log("[縦型TAB UI] vertical renderer renderFinished", {
            width: args?.width,
            height: args?.height,
            boundsLookup: verticalApi?.boundsLookup || verticalApi?.renderer?.boundsLookup,
          });
        });
        verticalApi.postRenderFinished?.on?.(() => {
          console.log("[縦型TAB UI] vertical renderer postRenderFinished", {
            extractedBars: extractedBars.size,
            boundsLookup: verticalApi?.boundsLookup || verticalApi?.renderer?.boundsLookup,
          });
        });
      }

      api.error.on(fail);
      verticalApi?.error?.on?.(fail);
      api.scoreLoaded.on((score) => {
        if (isTest01Mode) {
          console.log("[TEST01] score loaded", score);
          console.log("[TEST01] masterBars =", score?.masterBars?.length ?? 0);
          console.log("[TEST01] tracks =", score?.tracks?.length ?? 0);
        } else {
          console.log("[縦型TAB UI] scoreLoaded", score);
          console.log("[縦型TAB UI] masterBars =", score?.masterBars?.length);
          console.log("[縦型TAB UI] tracks =", score?.tracks?.length);
        }
        $("#barCount").textContent = String(score?.masterBars?.length ?? "—");
        $("#trackCount").textContent = String(score?.tracks?.length ?? 0);
        if (score?.masterBars?.length) setLoadState("success");
      });

      const renderApi = verticalApi || api;
      const renderer = renderApi.renderer;
      console.log("[縦型TAB UI] render engine =", renderApi.settings?.core?.engine);
      console.log("[縦型TAB UI] renderer =", renderer);
      if (renderer?.partialLayoutFinished?.on) {
        renderer.partialLayoutFinished.on((args) => {
          console.log("[縦型TAB UI] partialLayoutFinished", args);
          if (!args?.id || typeof renderer.renderResult !== "function") {
            console.error("[縦型TAB UI] Cannot request laid-out render chunk", {
              id: args?.id,
              renderResultAvailable: typeof renderer.renderResult === "function",
            });
            return;
          }
          // alphaTab 1.2.3+ separates layout from chunk rendering. Defer the
          // request until the current partialLayoutFinished dispatch completes.
          window.setTimeout(() => {
            try {
              console.log("[縦型TAB UI] request renderer.renderResult id =", args.id);
              renderer.renderResult(args.id);
            } catch (error) {
              console.error("[縦型TAB UI] renderer.renderResult failed", { id: args.id, error });
            }
          }, 0);
        });
      }
      if (renderer?.partialRenderFinished?.on) {
        renderer.partialRenderFinished.on(isTest01Mode ? handleTest01PartialRender : handlePartialRender);
      }
      else console.warn("[縦型TAB UI] partialRenderFinished event is unavailable");

      api.renderFinished.on((args) => {
        if (isTest01Mode) {
          console.log("[TEST01] renderFinished", args);
          reportTest01Layout(args, "renderFinished");
          return;
        }
        console.log("[縦型TAB UI] renderFinished; SVG extraction uses partialRenderFinished instead", args);
        const lookup = api?.boundsLookup || api?.renderer?.boundsLookup;
        console.log("[縦型TAB UI] BoundsLookup =", lookup);
        console.log("[縦型TAB UI] _masterBarLookup =", lookup?._masterBarLookup);
      });

      api.postRenderFinished?.on?.(() => {
        if (isTest01Mode) {
          console.log("[TEST01] postRenderFinished");
          reportTest01Layout(null, "postRenderFinished");
          return;
        }
        console.log("[縦型TAB UI] postRenderFinished");
      });

      console.log("[縦型TAB UI] alphaTab.load()", config.scoreUrl);
      api.load(config.scoreUrl);
      if (verticalApi) {
        console.log("[縦型TAB UI] vertical alphaTab.load()", config.scoreUrl);
        verticalApi.load(config.scoreUrl);
      }
    } catch (error) {
      fail(error);
    }
  }

  init();
})();
