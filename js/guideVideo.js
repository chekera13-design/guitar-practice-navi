// 表示先と現在ステージだけを受け持つ、小さなインライン動画UI。
export function createGuideVideo(section, button, panel) {
    let video = null;

    function close() {
        // 非表示だけでは動画音声が続くため、iframe自体を破棄する。
        panel.replaceChildren();
        panel.hidden = true;
        button.textContent = "▶ 攻略動画を見る";
        button.setAttribute("aria-expanded", "false");
    }

    function setStage(stage) {
        close();
        const candidate = stage?.guideVideo;
        video = typeof candidate?.youtubeId === "string"
            && /^[A-Za-z0-9_-]{11}$/.test(candidate.youtubeId) ? candidate : null;
        section.hidden = !video;
    }

    function toggle() {
        if (!video || section.hidden || button.disabled) return;
        if (!panel.hidden) {
            close();
            return;
        }
        const url = new URL(`https://www.youtube-nocookie.com/embed/${video.youtubeId}`);
        url.searchParams.set("playsinline", "1");
        if (Number.isFinite(video.startSeconds) && video.startSeconds > 0) {
            url.searchParams.set("start", String(Math.floor(video.startSeconds)));
        }
        const frame = panel.ownerDocument.createElement("iframe");
        frame.src = url.href;
        frame.title = typeof video.title === "string" && video.title.trim()
            ? video.title : "攻略動画";
        frame.setAttribute("allowfullscreen", "");
        frame.setAttribute("allow", "accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share");
        frame.referrerPolicy = "strict-origin-when-cross-origin";
        panel.replaceChildren(frame);
        panel.hidden = false;
        button.textContent = "▲ 攻略動画を閉じる";
        button.setAttribute("aria-expanded", "true");
    }

    function setDisabled(disabled) {
        button.disabled = disabled;
        if (disabled) close();
    }

    setStage(null);
    return { setStage, toggle, close, setDisabled };
}
