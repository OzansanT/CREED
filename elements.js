export function getElements() {
  return {
    canvas: document.getElementById("canvas"), world: document.getElementById("world"), originCard: document.getElementById("originCard"), jsonComponentCard: document.getElementById("jsonComponentCard"),
    sidebar: document.getElementById("sidebar"), canvasMenuBtn: document.getElementById("canvasMenuBtn"), infiniteCanvasMenuBtn: document.getElementById("infiniteCanvasMenuBtn"), componentsMenuBtn: document.getElementById("componentsMenuBtn"), canvasControlsPanel: document.getElementById("canvasControlsPanel"), infiniteCanvasPanel: document.getElementById("infiniteCanvasPanel"), componentsPanel: document.getElementById("componentsPanel"), addJsonCardBtn: document.getElementById("addJsonCardBtn"), openJsonFileBtn: document.getElementById("openJsonFileBtn"),
    grids: { 1: document.getElementById("grid1"), 2: document.getElementById("grid2"), 4: document.getElementById("grid4"), 8: document.getElementById("grid8") },
    zoomRange: document.getElementById("zoomRange"), zoomReadout: document.getElementById("zoomReadout"), lodBadge: document.getElementById("lodBadge"), zoomInBtn: document.getElementById("zoomInBtn"), zoomOutBtn: document.getElementById("zoomOutBtn"),
    setAnchorBtn: document.getElementById("setAnchorBtn"), goAnchorBtn: document.getElementById("goAnchorBtn"), clearAnchorBtn: document.getElementById("clearAnchorBtn"), anchorMarker: document.getElementById("anchorMarker"),
    homeBtn: document.getElementById("homeBtn"), resetBtn: document.getElementById("resetBtn"),
    xStat: document.getElementById("xStat"), yStat: document.getElementById("yStat"), zoomStat: document.getElementById("zoomStat"), orderStat: document.getElementById("orderStat"), toast: document.getElementById("toast"),
    lodRows: [...document.querySelectorAll(".lod-row")]
  };
}
