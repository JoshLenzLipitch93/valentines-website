import "./style.css";
import puzzleFullUrl from "./assets/puzzle-full.png";

// Served from `public/IMG_8016.MOV` (works with Vite base URL / GitHub Pages).
const loveVideoUrl = `${import.meta.env.BASE_URL}IMG_8016.MOV`;

const slideshowModules = import.meta.glob("./assets/slideshow/*.{png,PNG,jpg,JPG,jpeg,JPEG,webp,WEBP,gif,GIF}", {
  eager: true,
  import: "default",
});
const slideshowUrls = Object.entries(slideshowModules)
  .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
  .map(([, url]) => /** @type {string} */ (url));

const N = 3;
const SHUFFLE_MOVES = 25;
// ---- Music (MP3) ----
const bgMusicUrl = `${import.meta.env.BASE_URL}reu-confesso.mp3`;
const bgMusicEl = document.getElementById("bgMusic");
let musicStarted = false;

function startMusicOnUserGesture() {
  if (musicStarted) return;
  musicStarted = true;
  if (!(bgMusicEl instanceof HTMLAudioElement)) return;

  bgMusicEl.src = bgMusicUrl;
  bgMusicEl.loop = true;
  bgMusicEl.preload = "auto";
  bgMusicEl.volume = 0.85;
  // Ensure new src is loaded.
  bgMusicEl.load();
  bgMusicEl.play().catch(() => {});
}

/** @param {number} min @param {number} max */
function rand(min, max) {
  return min + Math.random() * (max - min);
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} count
 * @param {{
 *  color?: string,
 *  sizeMin?: number, sizeMax?: number,
 *  dxMin?: number, dxMax?: number,
 *  dyMin?: number, dyMax?: number,
 *  durMin?: number, durMax?: number,
 *  rotMin?: number, rotMax?: number,
 *  scaleMin?: number, scaleMax?: number,
 * }} [opts]
 */
function burstHearts(x, y, count, opts = {}) {
  const layer = document.getElementById("heartsLayer");
  if (!layer) return;

  const {
    color = "#FF5891",
    sizeMin = 30,
    sizeMax = 54,
    dxMin = -220,
    dxMax = 220,
    dyMin = 360,
    dyMax = 720,
    durMin = 1800,
    durMax = 3200,
    rotMin = -30,
    rotMax = 30,
    scaleMin = 1.0,
    scaleMax = 1.45,
  } = opts;

  for (let i = 0; i < count; i++) {
    const el = document.createElement("div");
    el.className = "heart";
    el.textContent = Math.random() < 0.5 ? "❤" : "♥";
    el.style.color = color;

    const size = rand(sizeMin, sizeMax);
    const dx = rand(dxMin, dxMax);
    const dy = rand(dyMin, dyMax);
    const dur = rand(durMin, durMax);
    const rot0 = `${rand(rotMin, rotMax).toFixed(1)}deg`;
    const rot1 = `${rand(rotMin * 1.15, rotMax * 1.15).toFixed(1)}deg`;
    const scale = rand(scaleMin, scaleMax);

    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.fontSize = `${size}px`;
    el.style.setProperty("--dx", `${dx.toFixed(0)}px`);
    el.style.setProperty("--dy", `${dy.toFixed(0)}px`);
    el.style.setProperty("--dur", `${dur.toFixed(0)}ms`);
    el.style.setProperty("--rot0", rot0);
    el.style.setProperty("--rot1", rot1);
    el.style.setProperty("--scale", `${scale.toFixed(2)}`);

    layer.appendChild(el);
    el.addEventListener("animationend", () => el.remove(), { once: true });
  }
}

function idxToRC(idx, n) {
  return { r: Math.floor(idx / n), c: idx % n };
}

function rcToIdx(r, c, n) {
  return r * n + c;
}

function neighborsOfEmpty(emptyIdx, n) {
  const { r, c } = idxToRC(emptyIdx, n);
  /** @type {number[]} */
  const out = [];
  if (r > 0) out.push(rcToIdx(r - 1, c, n));
  if (r < n - 1) out.push(rcToIdx(r + 1, c, n));
  if (c > 0) out.push(rcToIdx(r, c - 1, n));
  if (c < n - 1) out.push(rcToIdx(r, c + 1, n));
  return out;
}

function makeSolvedBoard(n) {
  const arr = Array.from({ length: n * n }, (_, i) => i + 1);
  arr[arr.length - 1] = 0;
  return arr;
}

function shuffleByRandomMoves(board, n, moves = 120) {
  let emptyIdx = board.indexOf(0);
  for (let i = 0; i < moves; i++) {
    const choices = neighborsOfEmpty(emptyIdx, n);
    const pick = choices[(Math.random() * choices.length) | 0];
    board[emptyIdx] = board[pick];
    board[pick] = 0;
    emptyIdx = pick;
  }
}

function isSolved(board) {
  for (let i = 0; i < board.length - 1; i++) {
    if (board[i] !== i + 1) return false;
  }
  return board[board.length - 1] === 0;
}

function setRightUiSolved(solved) {
  const incompleteMsg = document.getElementById("incompleteMsg");
  const completeUi = document.getElementById("completeUi");
  if (incompleteMsg) incompleteMsg.hidden = solved;
  if (completeUi) completeUi.hidden = !solved;
  if (completeUi) completeUi.classList.remove("phase-line", "phase-full");
}

function setSizingVarsFromCard(cardEl, n) {
  const figCard = 566;
  const figPad = 35.89;
  // Reduce the maroon border around the tile grid (requested), while keeping
  // the tile sizes the same. We do that by:
  // - computing tile size from the *original* padding
  // - then shrinking the card and padding together to reduce the border
  // Target: make the remaining border ~2/3 of the current one.
  const PAD_TRIM_PX_AT_FIGMA_SIZE = 19;
  const figGap = 1; // 1px gap at design width

  // Use viewport width as the "base" size so we don't get feedback loops from
  // setting `--card-size` (which would change cardEl's measured width).
  const vw = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
  const vh = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
  // Keep the card within the viewport width (accounting for page padding).
  // Avoid hard minimums that can cause horizontal overflow on small phones.
  const sidePad = vw < 480 ? 16 : 24;
  const maxCardByWidth = Math.floor(vw - sidePad * 2);

  // On mobile (stacked layout), keep the puzzle within roughly half the viewport height
  // so the right-side text can remain vertically centered in its half.
  const stacked = window.matchMedia?.("(max-width: 1100px)")?.matches ?? false;
  const maxCardByHeight = stacked ? Math.floor(vh * 0.46) : Number.POSITIVE_INFINITY;

  const baseCardSize = Math.min(figCard, Math.max(240, Math.min(maxCardByWidth, maxCardByHeight)));

  const basePad = (figPad / figCard) * baseCardSize;
  // Keep at least 1px so there's a tiny space between tiles.
  const gap = Math.max(1, (figGap / figCard) * baseCardSize);
  const baseInner = baseCardSize - basePad * 2; // == board size
  const tile = (baseInner - gap * (n - 1)) / n;

  const trimPx = (PAD_TRIM_PX_AT_FIGMA_SIZE / figCard) * baseCardSize;
  const pad = Math.max(12, basePad - trimPx);
  const cardSize = baseInner + pad * 2;

  const root = document.documentElement;
  root.style.setProperty("--card-size", `${cardSize}px`);
  root.style.setProperty("--inner-pad", `${pad}px`);
  root.style.setProperty("--gap", `${gap}px`);
  root.style.setProperty("--tile", `${tile}px`);
  root.style.setProperty("--n", `${n}`);
  // When we shrink each tile by 1px, we expand internal gaps so the outer edges stay flush.
  // Extra gap per internal seam = n/(n-1) px (e.g. n=3 -> 1.5px).
  root.style.setProperty("--gap-bump", `${n / (n - 1)}px`);
}

/**
 * @param {HTMLElement} boardEl
 * @param {number} n
 * @param {{ onSolved?: (() => void) }} [opts]
 */
function createPuzzle(boardEl, n, opts = {}) {
  let board = makeSolvedBoard(n);
  shuffleByRandomMoves(board, n, SHUFFLE_MOVES);

  // Use the full image as the source for all tiles, cropped via background-position.
  boardEl.style.setProperty("--puzzle-img", `url("${puzzleFullUrl}")`);

  // Full merged image overlay (fades in when solved).
  const fullImg = document.createElement("img");
  fullImg.className = "puzzle-full";
  fullImg.src = puzzleFullUrl;
  fullImg.alt = "";
  fullImg.loading = "eager";
  fullImg.decoding = "async";
  fullImg.setAttribute("aria-hidden", "true");
  boardEl.appendChild(fullImg);

  /** @type {Map<number, HTMLButtonElement>} */
  const tiles = new Map();
  let lastSolved = false;
  let suppressClicks = false;

  function canInteract() {
    return !boardEl.classList.contains("is-complete");
  }

  /**
   * Swap a specific tile index with the empty if adjacent.
   * @param {number} tileIdx
   */
  function trySwapWithEmpty(tileIdx) {
    if (!canInteract()) return false;
    const emptyIdx = board.indexOf(0);
    const allowed = neighborsOfEmpty(emptyIdx, n);
    if (!allowed.includes(tileIdx)) return false;
    board[emptyIdx] = board[tileIdx];
    board[tileIdx] = 0;
    render();
    return true;
  }

  /**
   * Move by swipe direction (tiles slide in that direction).
   * @param {"left"|"right"|"up"|"down"} dir
   */
  function tryMoveByDirection(dir) {
    if (!canInteract()) return false;
    const emptyIdx = board.indexOf(0);
    const { r, c } = idxToRC(emptyIdx, n);
    // Swipe direction describes how the tiles should move. That means:
    // - swipe left  -> move the tile to the RIGHT of empty into empty
    // - swipe right -> move the tile to the LEFT of empty into empty
    // - swipe up    -> move the tile BELOW empty into empty
    // - swipe down  -> move the tile ABOVE empty into empty
    let tr = r;
    let tc = c;
    if (dir === "left") tc = c + 1;
    if (dir === "right") tc = c - 1;
    if (dir === "up") tr = r + 1;
    if (dir === "down") tr = r - 1;
    if (tr < 0 || tr >= n || tc < 0 || tc >= n) return false;
    const tileIdx = rcToIdx(tr, tc, n);
    if (board[tileIdx] === 0) return false;
    return trySwapWithEmpty(tileIdx);
  }

  // Create tile elements once (1..n*n-1)
  for (let tileNum = 1; tileNum <= n * n - 1; tileNum++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tile";
    btn.setAttribute("aria-label", `Tile ${tileNum}`);
    btn.dataset.tile = String(tileNum);

    // Solved (source) position for this tile's image region.
    const { r: sr, c: sc } = idxToRC(tileNum - 1, n);
    btn.style.setProperty("--sr", String(sr));
    btn.style.setProperty("--sc", String(sc));

    btn.addEventListener("click", () => {
      if (suppressClicks) return;
      const tileIdx = board.indexOf(tileNum);
      trySwapWithEmpty(tileIdx);
    });

    tiles.set(tileNum, btn);
    boardEl.appendChild(btn);
  }

  // Swipe/drag gestures (mobile + trackpads)
  // We use pointer events so it works for touch + mouse.
  /** @type {{active: boolean, id: number|null, x0: number, y0: number, fired: boolean}} */
  const swipe = { active: false, id: null, x0: 0, y0: 0, fired: false };

  function getSwipeThresholdPx() {
    const cs = getComputedStyle(boardEl);
    const tileSize =
      parseFloat(cs.getPropertyValue("--tile-size")) ||
      parseFloat(cs.getPropertyValue("--tile")) ||
      120;
    return Math.max(22, Math.min(60, tileSize * 0.22));
  }

  function clearSwipe() {
    swipe.active = false;
    swipe.id = null;
    swipe.fired = false;
  }

  boardEl.addEventListener(
    "pointerdown",
    (e) => {
      if (!canInteract()) return;
      // Only left click for mouse; allow touch/pen.
      if (e.pointerType === "mouse" && e.button !== 0) return;
      swipe.active = true;
      swipe.id = e.pointerId;
      swipe.x0 = e.clientX;
      swipe.y0 = e.clientY;
      swipe.fired = false;
      suppressClicks = false;
      if (e.pointerType !== "mouse") e.preventDefault();
    },
    { passive: false },
  );

  boardEl.addEventListener(
    "pointermove",
    (e) => {
      if (!swipe.active || swipe.id !== e.pointerId) return;
      if (swipe.fired) {
        if (e.pointerType !== "mouse") e.preventDefault();
        return;
      }
      const dx = e.clientX - swipe.x0;
      const dy = e.clientY - swipe.y0;
      const thr = getSwipeThresholdPx();
      if (Math.abs(dx) < thr && Math.abs(dy) < thr) return;

      /** @type {"left"|"right"|"up"|"down"} */
      const dir =
        Math.abs(dx) >= Math.abs(dy)
          ? dx > 0
            ? "right"
            : "left"
          : dy > 0
            ? "down"
            : "up";

      // Fire one move per swipe.
      swipe.fired = true;
      suppressClicks = true;
      tryMoveByDirection(dir);
      if (e.pointerType !== "mouse") e.preventDefault();
    },
    { passive: false },
  );

  boardEl.addEventListener(
    "pointerup",
    (e) => {
      if (swipe.id === e.pointerId) {
        // Let the next tap click normally unless we swiped.
        if (suppressClicks) window.setTimeout(() => (suppressClicks = false), 0);
        clearSwipe();
      }
    },
    { passive: true },
  );

  boardEl.addEventListener(
    "pointercancel",
    (e) => {
      if (swipe.id === e.pointerId) {
        suppressClicks = false;
        clearSwipe();
      }
    },
    { passive: true },
  );

  function render() {
    for (let tileNum = 1; tileNum <= n * n - 1; tileNum++) {
      const el = tiles.get(tileNum);
      if (!el) continue;
      const idx = board.indexOf(tileNum);
      const { r, c } = idxToRC(idx, n);
      el.style.transform = `translate(calc(${c} * var(--step)), calc(${r} * var(--step)))`;
    }

    const solved = isSolved(board);
    if (solved !== lastSolved) {
      lastSolved = solved;
      boardEl.classList.toggle("is-complete", solved);
      setRightUiSolved(solved);
      const result = document.getElementById("result");
      if (result) result.textContent = "";
      if (solved) opts.onSolved?.();
    }
  }

  render();

  return {
    reset() {
      board = makeSolvedBoard(n);
      shuffleByRandomMoves(board, n, SHUFFLE_MOVES);
      lastSolved = false;
      boardEl.classList.remove("is-complete");
      // If caller is using delayed UI reveal, they should clear their timers.
      setRightUiSolved(false);
      render();
    },
  };
}

const puzzleCard = document.querySelector(".puzzle-card");
if (puzzleCard) setSizingVarsFromCard(puzzleCard, N);

if (puzzleCard) {
  // ResizeObserver is widely supported, but add a small fallback so the layout
  // still works on older browsers.
  if (typeof window.ResizeObserver === "function") {
    const ro = new ResizeObserver(() => setSizingVarsFromCard(puzzleCard, N));
    ro.observe(puzzleCard);
  } else {
    window.addEventListener("resize", () => setSizingVarsFromCard(puzzleCard, N), {
      passive: true,
    });
  }
}

const puzzleEl = document.getElementById("puzzle");
const completeUi = document.getElementById("completeUi");
/** @type {number[]} */
let completionTimers = [];
function clearCompletionTimers() {
  for (const t of completionTimers) window.clearTimeout(t);
  completionTimers = [];
}

function revealPhaseFullWithSmoothSlide() {
  if (!completeUi) return;
  const line = document.getElementById("completeLine");
  if (!line) {
    completeUi.classList.add("phase-full");
    return;
  }

  // FLIP: capture current position, apply layout change, then animate to new position.
  const first = line.getBoundingClientRect();
  completeUi.classList.add("phase-full");

  requestAnimationFrame(() => {
    const last = line.getBoundingClientRect();
    const dy = first.top - last.top;
    if (!dy) return;

    // Jump back to where it was, then let CSS transition carry it to the new spot.
    line.style.transition = "none";
    line.style.transform = `translateY(${dy}px)`;
    // Force reflow.
    line.getBoundingClientRect();
    line.style.transition = "";
    line.style.transform = "";
  });
}

const game = puzzleEl
  ? createPuzzle(puzzleEl, N, {
      onSolved: () => {
        if (!puzzleEl) return;
        const r = puzzleEl.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        // Hearts first, then reveal the right-side UI.
        const HEARTS_MS = 1800;
        const COMPLETE_LINE_EARLY_MS = 450;
        const COMPLETE_LINE_DELAY_MS = Math.max(0, HEARTS_MS - COMPLETE_LINE_EARLY_MS);
        burstHearts(cx, cy, 18, {
          sizeMin: 26,
          sizeMax: 46,
          dxMin: -210,
          dxMax: 210,
          dyMin: 360,
          dyMax: 640,
          durMin: HEARTS_MS,
          durMax: HEARTS_MS,
          scaleMin: 1.0,
          scaleMax: 1.35,
        });

        clearCompletionTimers();
        if (!completeUi) return;
        completeUi.classList.remove("phase-line", "phase-full");

        // Show "...you complete me!" a bit before the hearts finish.
        completionTimers.push(
          window.setTimeout(() => {
            completeUi.classList.add("phase-line");
          }, COMPLETE_LINE_DELAY_MS),
        );

        // Two seconds later, fade in the prompt + buttons.
        completionTimers.push(
          window.setTimeout(() => {
            revealPhaseFullWithSmoothSlide();
          }, COMPLETE_LINE_DELAY_MS + 2000),
        );
      },
    })
  : null;
setRightUiSolved(false);

const yesBtn = document.getElementById("yesBtn");
const noBtn = document.getElementById("noBtn");
const result = document.getElementById("result");
const valentinePrompt = document.getElementById("valentinePrompt");
const loveOverlay = document.getElementById("loveOverlay");
const loveCopy = document.getElementById("loveCopy");
const leftLoveVideo = document.getElementById("leftLoveVideo");
const leftSlideshow = document.getElementById("leftSlideshow");
const leftSlideImg = document.getElementById("leftSlideImg");

let celebrationStarted = false;

if (yesBtn && result) {
  yesBtn.addEventListener("click", () => {
    if (celebrationStarted) return;
    celebrationStarted = true;

    let slideshowStarted = false;
    /** @type {number | null} */
    let slideshowTimer = null;
    let slideIdx = 0;

    function showVideo() {
      if (leftSlideshow) leftSlideshow.hidden = true;
      if (leftLoveVideo instanceof HTMLVideoElement) leftLoveVideo.hidden = false;
    }

    function showSlideshow() {
      if (leftLoveVideo instanceof HTMLVideoElement) leftLoveVideo.hidden = true;
      if (leftSlideshow) leftSlideshow.hidden = false;
    }

    function setSlide(url) {
      if (!(leftSlideImg instanceof HTMLImageElement)) return;
      leftSlideImg.classList.add("is-fading");
      window.setTimeout(() => {
        leftSlideImg.src = url;
      }, 220);
    }

    function startSlideshow() {
      if (slideshowStarted) return;
      slideshowStarted = true;

      if (!slideshowUrls.length) return;
      showSlideshow();

      if (leftSlideImg instanceof HTMLImageElement) {
        leftSlideImg.addEventListener(
          "load",
          () => {
            leftSlideImg.classList.remove("is-fading");
          },
          { passive: true },
        );
      }

      // Kick off first slide.
      slideIdx = 0;
      setSlide(slideshowUrls[slideIdx]);

      // Then advance.
      slideshowTimer = window.setInterval(() => {
        slideIdx = (slideIdx + 1) % slideshowUrls.length;
        setSlide(slideshowUrls[slideIdx]);
      }, 2600);
    }

    // Full-screen love mode.
    document.body.classList.add("celebrate");
    if (loveOverlay) loveOverlay.hidden = false;
    startMusicOnUserGesture();
    const loveText =
      "I’m so happy you chose me. Você é o meu chroí e o meu tudo. I love you.";
    if (loveCopy) loveCopy.textContent = loveText;
    if (valentinePrompt) valentinePrompt.textContent = loveText;
    result.textContent = loveText;

    if (leftLoveVideo instanceof HTMLVideoElement) {
      // Autoplay on mobile requires muted + playsInline.
      showVideo();
      leftLoveVideo.src = loveVideoUrl;
      leftLoveVideo.muted = true;
      leftLoveVideo.volume = 0;
      leftLoveVideo.loop = false;
      leftLoveVideo.autoplay = true;
      leftLoveVideo.playsInline = true;
      leftLoveVideo.preload = "auto";
      // Ensure updated src is applied before play.
      leftLoveVideo.load();

      leftLoveVideo.addEventListener("ended", () => startSlideshow(), { once: true });
      leftLoveVideo.addEventListener("error", () => startSlideshow(), { once: true });

      leftLoveVideo
        .play()
        // Some browsers may still block autoplay; user already clicked, but ignore just in case.
        .catch(() => {});
    } else {
      // If the video element isn't available for any reason, just start the slideshow.
      startSlideshow();
    }

    // Initial burst from the Yes button (even though it disappears right after).
    const r = yesBtn.getBoundingClientRect();
    burstHearts(r.left + r.width / 2, r.top + r.height / 2, 26, {
      sizeMin: 34,
      sizeMax: 62,
      dxMin: -240,
      dxMax: 240,
      dyMin: 560,
      dyMax: 980,
      durMin: 6500,
      durMax: 10500,
      scaleMin: 1.0,
      scaleMax: 1.55,
    });

    // Continuous hearts all over the screen.
    window.setInterval(() => {
      const w = window.innerWidth || document.documentElement.clientWidth;
      const h = window.innerHeight || document.documentElement.clientHeight;
      for (let i = 0; i < 4; i++) {
        const x = rand(16, w - 16);
        const y = rand(h * 0.35, h + 40);
        burstHearts(x, y, 1, {
          sizeMin: 34,
          sizeMax: 62,
          dxMin: -240,
          dxMax: 240,
          dyMin: 560,
          dyMax: 980,
          durMin: 6500,
          durMax: 10500,
          scaleMin: 1.0,
          scaleMax: 1.55,
        });
      }
    }, 520);
  });
}

if (noBtn && result) {
  // Make the "No" button dodge the cursor and change text.
  const NO_HOVER_TEXTS = ["Please", "Say yes", "C’mon", "Pretty please", "Just say yes"];
  let noHoverCount = 0;
  let currentDx = 0;
  let currentDy = 0;
  let lastMoveAt = 0;

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function getVisibleViewportRect() {
    // Prefer Visual Viewport when available (mobile browser UI, pinch zoom, etc.)
    // Coordinates are in the layout viewport coordinate space, same as getBoundingClientRect().
    const vv = window.visualViewport;
    if (vv) {
      const left = vv.offsetLeft;
      const top = vv.offsetTop;
      return {
        left,
        top,
        right: left + vv.width,
        bottom: top + vv.height,
        width: vv.width,
        height: vv.height,
      };
    }
    const width = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
    const height = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
    return { left: 0, top: 0, right: width, bottom: height, width, height };
  }

  function normalizeRange(min, max) {
    if (max >= min) return { min, max };
    const mid = (min + max) / 2;
    return { min: mid, max: mid };
  }

  function nudgeNoButtonBackOnScreen() {
    // If the UI is hidden (display:none), measurements are meaningless—do nothing.
    if (noBtn.offsetParent === null) return;

    const rect = noBtn.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const vp = getVisibleViewportRect();
    const margin = 10;

    let dxAdjust = 0;
    let dyAdjust = 0;

    if (rect.left < vp.left + margin) dxAdjust += vp.left + margin - rect.left;
    if (rect.right > vp.right - margin) dxAdjust -= rect.right - (vp.right - margin);
    if (rect.top < vp.top + margin) dyAdjust += vp.top + margin - rect.top;
    if (rect.bottom > vp.bottom - margin) dyAdjust -= rect.bottom - (vp.bottom - margin);

    if (!dxAdjust && !dyAdjust) return;
    currentDx += dxAdjust;
    currentDy += dyAdjust;
    noBtn.style.transform = `translate(${currentDx}px, ${currentDy}px)`;
  }

  function moveNoButton() {
    const now = performance.now();
    // Prevent re-trigger loops if the button moves under the cursor.
    if (now - lastMoveAt < 140) return;
    lastMoveAt = now;

    const rect = noBtn.getBoundingClientRect();
    const vp = getVisibleViewportRect();
    const margin = 10;

    // Infer the "base" (untranslated) position from current rect and translation state.
    const baseLeft = rect.left - currentDx;
    const baseTop = rect.top - currentDy;

    // Allowed translation ranges that keep the button on-screen.
    let minDxAllowed = vp.left + margin - baseLeft;
    let maxDxAllowed = vp.right - margin - rect.width - baseLeft;
    let minDyAllowed = vp.top + margin - baseTop;
    let maxDyAllowed = vp.bottom - margin - rect.height - baseTop;

    ({ min: minDxAllowed, max: maxDxAllowed } = normalizeRange(minDxAllowed, maxDxAllowed));
    ({ min: minDyAllowed, max: maxDyAllowed } = normalizeRange(minDyAllowed, maxDyAllowed));

    // Larger jumps, per request (best-effort on tiny screens).
    const MIN_JUMP = 200;
    const MAX_JUMP = 400;

    let nextDx = currentDx;
    let nextDy = currentDy;
    let best = { dx: currentDx, dy: currentDy, dist: 0 };

    for (let i = 0; i < 24; i++) {
      const angle = Math.random() * Math.PI * 2;
      const mag = MIN_JUMP + Math.random() * (MAX_JUMP - MIN_JUMP);
      const targetDx = currentDx + Math.round(Math.cos(angle) * mag);
      const targetDy = currentDy + Math.round(Math.sin(angle) * mag);

      const clampedDx = clamp(targetDx, minDxAllowed, maxDxAllowed);
      const clampedDy = clamp(targetDy, minDyAllowed, maxDyAllowed);
      const dist = Math.hypot(clampedDx - currentDx, clampedDy - currentDy);

      if (dist > best.dist) best = { dx: clampedDx, dy: clampedDy, dist };
      // Accept if we got roughly the requested jump (clamping can reduce it).
      if (dist >= MIN_JUMP * 0.9) {
        nextDx = clampedDx;
        nextDy = clampedDy;
        break;
      }
    }

    // Fallback: use the farthest candidate we found.
    if (nextDx === currentDx && nextDy === currentDy && best.dist > 0) {
      nextDx = best.dx;
      nextDy = best.dy;
    }

    currentDx = nextDx;
    currentDy = nextDy;
    noBtn.style.transform = `translate(${currentDx}px, ${currentDy}px)`;

    const nextText = NO_HOVER_TEXTS[noHoverCount % NO_HOVER_TEXTS.length];
    noBtn.textContent = nextText;
    noHoverCount++;

    // Final safety: after layout/paint, ensure it's still fully visible.
    requestAnimationFrame(() => nudgeNoButtonBackOnScreen());
  }

  // Trigger on click (not hover).
  noBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    moveNoButton();
  });

  // If the visible viewport changes (resize, mobile browser chrome, zoom), keep it on-screen.
  const keepInView = () => requestAnimationFrame(() => nudgeNoButtonBackOnScreen());
  window.addEventListener("resize", keepInView);
  window.visualViewport?.addEventListener("resize", keepInView);
  window.visualViewport?.addEventListener("scroll", keepInView);
}

