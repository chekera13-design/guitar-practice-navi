// URLに ?score=test01 を指定するとsystem break検証モードを開けます。
const scoreMode = new URLSearchParams(window.location.search).get("score") === "test01" ? "test01" : "ex01";

// 実験用の設定。譜面ファイルと操作感の調整値をここにまとめています。
window.verticalUiConfig = {
  scoreMode,
  scoreUrl: `../scores/basic/${scoreMode}.mxl`,
  scoreFileName: `${scoreMode}.mxl`,
  initialMeasure: 1,
  visibleNeighbors: 1,
  swipeThreshold: 38,
  animationMs: 220,
  autoplayEnabled: false,
  autoplaySeconds: 2,
};
