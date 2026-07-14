const state = {
  projects: [],
  category: "All",
  query: "",
};

const grid = document.querySelector("#projectsGrid");
const filters = document.querySelector("#categoryFilters");
const searchInput = document.querySelector("#searchInput");
const emptyState = document.querySelector("#emptyState");
const projectCount = document.querySelector("#projectCount");
const cvRequest = document.querySelector("#cvRequest");
const cvRequestButton = document.querySelector("#cvRequestButton");
const cvRequestPanel = document.querySelector("#cvRequestPanel");
const cvRequestEmail = document.querySelector("#cvRequestEmail");
const cvRequestFrame = document.querySelector("#cvRequestFrame");
const cvRequestSubmit = cvRequestPanel?.querySelector("button[type='submit']");
const introGate = document.querySelector("#introGate");
const introTitle = document.querySelector("#introTitle");
const introEnter = document.querySelector("#introEnter");
const introInkCanvas = document.querySelector("#introInkCanvas");
const introTextCanvas = document.querySelector("#introTextCanvas");
let cvRequestSubmitted = false;
let cvRequestResetTimer;
let cvRequestSubmitFallbackTimer;
let projectCountAnimationStarted = false;
let introFluid = null;
let introBubbles = null;
let pendingProjectCount = null;
let mainIntroAnimationStarted = false;
let pendingProjectCardsAnimation = false;

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const canAnimate = !prefersReducedMotion && typeof window.anime === "function";
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
const compactIntroViewport = window.matchMedia("(max-width: 640px)");
const introTextMetricsCache = new Map();

if (canAnimate) {
  document.documentElement.classList.add("anime-ready", "intro-pending");
} else {
  document.documentElement.classList.remove("intro-pending");
}

const year = document.querySelector("#year");
if (year) year.textContent = new Date().getFullYear();

function setupHeaderScrollState() {
  const header = document.querySelector(".site-header");
  if (!header) return;

  let ticking = false;
  const update = () => {
    header.classList.toggle("is-scrolled", window.scrollY > 14);
    ticking = false;
  };

  update();
  window.addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    },
    { passive: true }
  );
}

function setupProjectCardSpotlight() {
  if (!finePointer || !grid) return;

  let activeCard = null;
  let latestEvent = null;
  let frame = 0;

  const updateSpotlight = () => {
    frame = 0;
    if (!activeCard || !latestEvent) return;
    const rect = activeCard.getBoundingClientRect();
    const x = ((latestEvent.clientX - rect.left) / rect.width) * 100;
    const y = ((latestEvent.clientY - rect.top) / rect.height) * 100;
    activeCard.style.setProperty("--spotlight-x", `${x.toFixed(2)}%`);
    activeCard.style.setProperty("--spotlight-y", `${y.toFixed(2)}%`);
  };

  grid.addEventListener(
    "pointermove",
    (event) => {
      const card = event.target.closest(".project-card");
      if (!card) return;
      activeCard = card;
      latestEvent = event;
      if (frame) return;
      frame = window.requestAnimationFrame(updateSpotlight);
    },
    { passive: true }
  );

  grid.addEventListener("pointerleave", () => {
    activeCard = null;
    latestEvent = null;
    if (frame) {
      window.cancelAnimationFrame(frame);
      frame = 0;
    }
  });
}

function setupProjectCardNavigation() {
  if (!grid) return;

  grid.addEventListener("click", (event) => {
    if (event.target.closest("a, button, input, textarea, select")) return;
    const card = event.target.closest(".project-card");
    if (!card || !grid.contains(card)) return;
    const url = card.dataset.projectUrl;
    if (!url) return;
    window.location.href = url;
  });
}

function setupActiveNav() {
  const projectLink = document.querySelector('.nav-links a[href="#projects"]');
  const projectsSection = document.querySelector("#projects");
  if (!projectLink || !projectsSection) return;

  const observer = new IntersectionObserver(
    (entries) => {
      const isActive = entries.some((entry) => entry.isIntersecting);
      projectLink.classList.toggle("is-active", isActive);
    },
    { threshold: 0.3, rootMargin: "-18% 0px -62% 0px" }
  );
  observer.observe(projectsSection);
}

function closeIntroGate() {
  if (!introGate || !introTitle) return;
  document.body.classList.remove("intro-active");
  introGate.classList.add("is-hidden");
  introFluid?.stop();
  introBubbles?.stop();
  runIntroAnimation();
  if (pendingProjectCardsAnimation || grid?.querySelector(".project-card")) {
    pendingProjectCardsAnimation = false;
    animateProjectCards();
  }
  startProjectCountWhenVisible();
}

function fitCanvas(canvas, rect) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  const pixelWidth = Math.round(width * dpr);
  const pixelHeight = Math.round(height * dpr);

  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, width, height, dpr };
}

function getIntroTextLayout(width, height, lines) {
  const isSingle = lines.length === 1;
  const fontSize = isSingle
    ? Math.min(width * 0.19, height * 0.58, 132)
    : Math.min(width * 0.092, height * 0.32, 108);
  const centerY = height * (isSingle ? 0.52 : 0.51);
  const spacing = fontSize * 1.45;
  const yPositions = isSingle ? [centerY] : [centerY - spacing * 0.5, centerY + spacing * 0.5];

  return {
    font: `900 ${fontSize}px Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`,
    maxWidth: width * 0.94,
    yPositions,
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function isCompactIntro() {
  return compactIntroViewport.matches;
}

function getIntroFrameInterval() {
  return 33;
}

function shouldSkipIntro() {
  const params = new URLSearchParams(window.location.search);
  return params.get("skipIntro") === "1" || window.location.hash === "#projects";
}

function getIntroLineMetrics(ctx, line, maxWidth) {
  const cacheKey = `${ctx.font}|${line}|${Math.round(maxWidth)}`;
  const cached = introTextMetricsCache.get(cacheKey);
  if (cached) return cached;

  if (introTextMetricsCache.size > 80) introTextMetricsCache.clear();

  const chars = Array.from(line);
  const widths = chars.map((char) => ctx.measureText(char).width);
  const textWidth = Math.max(widths.reduce((sum, width) => sum + width, 0), 1);
  const scale = Math.min(1, maxWidth / textWidth);
  const metrics = { chars, scale, textWidth, widths };
  introTextMetricsCache.set(cacheKey, metrics);
  return metrics;
}

function getIntroLineReveal(progress, index, lineCount) {
  const stagger = lineCount > 1 ? 0.42 : 0;
  const available = 1 - stagger * (lineCount - 1);
  return clamp((progress - stagger * index) / available, 0, 1);
}

function easeIntroLetter(value) {
  return 1 - Math.pow(1 - clamp(value, 0, 1), 3);
}

function drawIntroRevealedLine(ctx, line, x, y, maxWidth, revealProgress) {
  const { chars, scale, textWidth, widths } = getIntroLineMetrics(ctx, line, maxWidth);
  const visibleUnits = revealProgress * chars.length;
  const fullChars = Math.floor(visibleUnits);
  const partial = easeIntroLetter(visibleUnits - fullChars);

  ctx.save();
  ctx.translate(x - (textWidth * scale) / 2, y);
  ctx.scale(scale, 1);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  let cursor = 0;
  chars.forEach((char, index) => {
    const charWidth = widths[index];
    if (index < fullChars) {
      ctx.fillText(char, cursor, 0);
    } else if (index === fullChars && partial > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(cursor - 1, -200, charWidth * partial + 2, 400);
      ctx.clip();
      ctx.fillText(char, cursor, 0);
      ctx.restore();
    }
    cursor += charWidth;
  });

  ctx.restore();
}

function getIntroRevealFocus(ctx, width, height, lines, revealProgress) {
  const layout = getIntroTextLayout(width, height, lines);
  ctx.save();
  ctx.font = layout.font;

  let focus = { x: width * 0.5, y: height * 0.5, active: false };

  lines.forEach((line, index) => {
    const lineReveal = getIntroLineReveal(revealProgress, index, lines.length);
    if (lineReveal <= 0 || (focus.active && lineReveal >= 1)) return;

    const { scale, textWidth } = getIntroLineMetrics(ctx, line, layout.maxWidth);
    const visibleWidth = textWidth * scale * clamp(lineReveal, 0, 1);
    const left = width * 0.5 - (textWidth * scale) / 2;
    focus = {
      x: left + visibleWidth,
      y: layout.yPositions[index],
      active: lineReveal < 1,
    };
  });

  ctx.restore();
  return focus;
}

function fillMovingIntroBand(ctx, width, height, centerX, colors) {
  const bandWidth = width * 0.34;
  const gradient = ctx.createLinearGradient(centerX - bandWidth, 0, centerX + bandWidth, 0);
  gradient.addColorStop(0, "rgba(255,255,255,0)");
  gradient.addColorStop(0.22, colors.edge);
  gradient.addColorStop(0.5, colors.core);
  gradient.addColorStop(0.78, colors.edge);
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(centerX - bandWidth, 0, bandWidth * 2, height);
}

function drawFlowingIntroGradient(ctx, width, height, time) {
  const baseGradient = ctx.createLinearGradient(0, 0, width, height);
  baseGradient.addColorStop(0, "rgba(207,250,254,0.7)");
  baseGradient.addColorStop(0.26, "rgba(186,230,253,0.74)");
  baseGradient.addColorStop(0.5, "rgba(255,255,255,0.9)");
  baseGradient.addColorStop(0.74, "rgba(251,207,232,0.76)");
  baseGradient.addColorStop(1, "rgba(255,228,230,0.74)");
  ctx.fillStyle = baseGradient;
  ctx.fillRect(0, 0, width, height);

  const period = width * 1.65;
  const blueX = ((time * 0.13) % period) - width * 0.32;
  const pinkX = width * 1.32 - ((time * 0.11) % period);
  const blue = {
    core: "rgba(0,174,255,0.98)",
    edge: "rgba(45,212,191,0.68)",
  };
  const pink = {
    core: "rgba(236,72,153,0.94)",
    edge: "rgba(251,113,133,0.62)",
  };

  [-period, 0, period].forEach((offset) => {
    fillMovingIntroBand(ctx, width, height, blueX + offset, blue);
    fillMovingIntroBand(ctx, width, height, pinkX + offset, pink);
  });
}

function drawIntroGlassHighlights(ctx, width, height, time, pointer) {
  ctx.save();
  ctx.globalCompositeOperation = "screen";

  const sweepPeriod = width * 1.4;
  const sweepX = ((time * 0.09) % sweepPeriod) - width * 0.2 + pointer.x * 20;
  const sweep = ctx.createLinearGradient(sweepX - width * 0.18, 0, sweepX + width * 0.18, height);
  sweep.addColorStop(0, "rgba(255,255,255,0)");
  sweep.addColorStop(0.42, "rgba(255,255,255,0.08)");
  sweep.addColorStop(0.5, "rgba(255,255,255,0.62)");
  sweep.addColorStop(0.58, "rgba(125,249,255,0.2)");
  sweep.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sweep;
  ctx.fillRect(sweepX - width * 0.2, 0, width * 0.4, height);

  for (let i = 0; i < 4; i += 1) {
    const phase = time * (0.0007 + i * 0.00008) + i * 1.8;
    const x = width * (0.18 + i * 0.22 + Math.sin(phase) * 0.08) + pointer.x * 16;
    const y = height * (0.22 + (i % 2) * 0.42 + Math.cos(phase * 1.4) * 0.08) + pointer.y * 12;
    const radius = Math.max(width, height) * (0.08 + i * 0.012);
    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
    glow.addColorStop(0, "rgba(255,255,255,0.64)");
    glow.addColorStop(0.18, "rgba(255,255,255,0.26)");
    glow.addColorStop(0.36, "rgba(45,212,191,0.16)");
    glow.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.ellipse(x, y, radius * 1.1, radius * 0.5, phase, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawIntroTextMask(ctx, width, height, lines, time, revealProgress = 1) {
  const layout = getIntroTextLayout(width, height, lines);
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.font = layout.font;
  ctx.fillStyle = "#fff";
  lines.forEach((line, index) => {
    const wave = Math.sin(time * 0.0012 + index * 1.7) * 2.2;
    const lineReveal = getIntroLineReveal(revealProgress, index, lines.length);
    drawIntroRevealedLine(ctx, line, width * 0.5, layout.yPositions[index] + wave, layout.maxWidth, lineReveal);
  });
  ctx.restore();
}

function drawIntroTextDepth(ctx, width, height, lines, time, revealProgress = 1) {
  const layout = getIntroTextLayout(width, height, lines);
  ctx.save();
  ctx.font = layout.font;
  ctx.shadowColor = "rgba(15, 42, 67, 0.28)";
  ctx.shadowBlur = 34;
  ctx.shadowOffsetY = 18;
  ctx.fillStyle = "rgba(15, 42, 67, 0.18)";
  lines.forEach((line, index) => {
    const wave = Math.sin(time * 0.0012 + index * 1.7) * 2.2;
    const lineReveal = getIntroLineReveal(revealProgress, index, lines.length);
    drawIntroRevealedLine(ctx, line, width * 0.5, layout.yPositions[index] + wave, layout.maxWidth, lineReveal);
  });
  ctx.restore();

  ctx.save();
  ctx.font = layout.font;
  ctx.globalCompositeOperation = "screen";
  ctx.shadowColor = "rgba(255, 255, 255, 0.42)";
  ctx.shadowBlur = 10;
  ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
  lines.forEach((line, index) => {
    const wave = Math.sin(time * 0.0012 + index * 1.7) * 2.2;
    const lineReveal = getIntroLineReveal(revealProgress, index, lines.length);
    drawIntroRevealedLine(ctx, line, width * 0.5, layout.yPositions[index] + wave - 1.5, layout.maxWidth, lineReveal);
  });
  ctx.restore();
}

function drawIntroText(canvas, lines, time, pointer, revealProgress = 1) {
  const rect = canvas.getBoundingClientRect();
  const { ctx, width, height, dpr } = fitCanvas(canvas, rect);
  const mask = drawIntroText.mask || (drawIntroText.mask = document.createElement("canvas"));
  const paint = drawIntroText.paint || (drawIntroText.paint = document.createElement("canvas"));
  const pixelWidth = Math.round(width * dpr);
  const pixelHeight = Math.round(height * dpr);

  [mask, paint].forEach((layer) => {
    if (layer.width !== pixelWidth || layer.height !== pixelHeight) {
      layer.width = pixelWidth;
      layer.height = pixelHeight;
    }
  });

  const maskCtx = mask.getContext("2d");
  const paintCtx = paint.getContext("2d");
  maskCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  paintCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

  drawIntroTextMask(maskCtx, width, height, lines, time, revealProgress);

  ctx.clearRect(0, 0, width, height);
  drawIntroTextDepth(ctx, width, height, lines, time, revealProgress);

  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.filter = "blur(18px)";
  ctx.drawImage(mask, 0, 0, width, height);
  ctx.restore();

  paintCtx.clearRect(0, 0, width, height);
  drawFlowingIntroGradient(paintCtx, width, height, time);
  paintCtx.globalCompositeOperation = "screen";

  const colors = [
    "rgba(45,212,191,0.38)",
    "rgba(14,165,233,0.34)",
    "rgba(255,255,255,0.48)",
    "rgba(251,113,133,0.28)",
    "rgba(56,189,248,0.3)",
  ];

  for (let i = 0; i < 9; i += 1) {
    const phase = time * (0.00018 + i * 0.000006) + i * 1.37;
    const px = width * (0.5 + Math.sin(phase) * 0.46) + pointer.x * 24;
    const py = height * (0.5 + Math.cos(phase * 1.18) * 0.38) + pointer.y * 18;
    const radius = Math.max(width, height) * (0.16 + ((i % 5) * 0.022));
    const blob = paintCtx.createRadialGradient(px, py, 0, px, py, radius);
    blob.addColorStop(0, colors[i % colors.length]);
    blob.addColorStop(0.58, colors[(i + 2) % colors.length].replace(/0\.\d+\)/, "0.24)"));
    blob.addColorStop(1, "rgba(255,255,255,0)");
    paintCtx.fillStyle = blob;
    paintCtx.beginPath();
    paintCtx.ellipse(px, py, radius * 1.22, radius * 0.74, phase, 0, Math.PI * 2);
    paintCtx.fill();
  }

  drawIntroGlassHighlights(paintCtx, width, height, time, pointer);

  paintCtx.globalCompositeOperation = "destination-in";
  paintCtx.drawImage(mask, 0, 0, width, height);
  paintCtx.globalCompositeOperation = "source-over";

  ctx.save();
  ctx.globalAlpha = 0.98;
  ctx.drawImage(paint, 0, 0, width, height);
  ctx.restore();

  const focus = getIntroRevealFocus(maskCtx, width, height, lines, revealProgress);
  if (focus.active) {
    paintCtx.clearRect(0, 0, width, height);
    const shimmer = paintCtx.createRadialGradient(focus.x, focus.y, 0, focus.x, focus.y, Math.max(width, height) * 0.16);
    shimmer.addColorStop(0, "rgba(255,255,255,0.95)");
    shimmer.addColorStop(0.2, "rgba(255,255,255,0.54)");
    shimmer.addColorStop(0.42, "rgba(45,212,191,0.24)");
    shimmer.addColorStop(1, "rgba(255,255,255,0)");
    paintCtx.fillStyle = shimmer;
    paintCtx.fillRect(0, 0, width, height);

    const streak = paintCtx.createLinearGradient(focus.x - width * 0.08, 0, focus.x + width * 0.08, height);
    streak.addColorStop(0, "rgba(255,255,255,0)");
    streak.addColorStop(0.5, "rgba(255,255,255,0.42)");
    streak.addColorStop(1, "rgba(255,255,255,0)");
    paintCtx.fillStyle = streak;
    paintCtx.fillRect(focus.x - width * 0.08, 0, width * 0.16, height);
    paintCtx.globalCompositeOperation = "destination-in";
    paintCtx.drawImage(mask, 0, 0, width, height);
    paintCtx.globalCompositeOperation = "source-over";

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.9;
    ctx.drawImage(paint, 0, 0, width, height);
    ctx.restore();
  }

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = 0.18;
  ctx.filter = "blur(2px)";
  ctx.drawImage(mask, 0, -1, width, height);
  ctx.restore();
}

function drawIntroInk(canvas, time, pointer) {
  const rect = canvas.getBoundingClientRect();
  const { ctx, width, height } = fitCanvas(canvas, rect);
  ctx.clearRect(0, 0, width, height);

  const wash = ctx.createLinearGradient(0, 0, width, height);
  wash.addColorStop(0, "rgba(255,247,237,0.12)");
  wash.addColorStop(0.28, "rgba(236,254,255,0.08)");
  wash.addColorStop(0.58, "rgba(255,228,240,0.1)");
  wash.addColorStop(1, "rgba(219,234,254,0.12)");
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const palette = [
    "rgba(45,212,191,0.56)",
    "rgba(14,165,233,0.5)",
    "rgba(244,114,182,0.46)",
    "rgba(251,146,60,0.34)",
    "rgba(255,255,255,0.46)",
  ];

  for (let i = 0; i < 18; i += 1) {
    const phase = time * (0.00008 + i * 0.000005) + i * 0.72;
    const x = width * (0.5 + Math.sin(phase * 1.12) * 0.54) + pointer.x * 34;
    const y = height * (0.5 + Math.cos(phase) * 0.46) + pointer.y * 28;
    const radius = Math.max(width, height) * (0.14 + (i % 6) * 0.03);
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, palette[i % palette.length]);
    gradient.addColorStop(0.66, palette[(i + 1) % palette.length].replace(/0\.\d+\)/, "0.24)"));
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(x, y, radius * 1.55, radius * 0.62, phase, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function setupIntroFluid() {
  if (!introGate || !introTextCanvas || !introTitle) return null;

  const pointer = { x: 0, y: 0 };
  const reveal = { progress: canAnimate ? 0 : 1 };
  let lines = (introTitle.dataset.lines || "Fatih Berker Akyildiz|Project Portfolio").split("|");
  let running = true;
  let lastDrawTime = performance.now();
  let lastTickDrawTime = 0;
  let frame = 0;

  const draw = (time = 0) => {
    if (!running) return;
    lastDrawTime = time;
    drawIntroText(introTextCanvas, lines, time, pointer, reveal.progress);
  };

  const tick = (time = performance.now()) => {
    if (!running) return;
    const minFrameMs = getIntroFrameInterval();
    if (time - lastTickDrawTime >= minFrameMs) {
      draw(time);
      lastTickDrawTime = time;
    }
    frame = window.requestAnimationFrame(tick);
  };

  const handlePointer = (event) => {
    const rect = introGate.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    pointer.y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
  };

  const handleResize = () => draw(performance.now());

  introGate.addEventListener("pointermove", handlePointer, { passive: true });
  window.addEventListener("resize", handleResize);
  window.visualViewport?.addEventListener("resize", handleResize);

  if ("fonts" in document) {
    document.fonts.ready.then(() => draw(performance.now()));
  }
  draw(performance.now());
  if (canAnimate) frame = window.requestAnimationFrame(tick);

  return {
    setLines(nextLines) {
      lines = nextLines;
      reveal.progress = canAnimate ? 0 : 1;
      draw(performance.now());
    },
    playReveal(duration = 1500) {
      if (!canAnimate) {
        reveal.progress = 1;
        draw(performance.now());
        return;
      }

      window.anime.remove(reveal);
      reveal.progress = 0;
      window.anime({
        targets: reveal,
        progress: [0, 1],
        duration,
        easing: "easeInOutCubic",
        update: () => {
          const now = performance.now();
          if (now - lastTickDrawTime >= getIntroFrameInterval()) {
            draw(now);
            lastTickDrawTime = now;
          }
        },
        complete: () => {
          const now = performance.now();
          draw(now);
          lastTickDrawTime = now;
        },
      });
    },
    redraw() {
      draw(lastDrawTime);
    },
    stop() {
      running = false;
      if (frame) window.cancelAnimationFrame(frame);
      window.anime?.remove(reveal);
      introGate.removeEventListener("pointermove", handlePointer);
      window.removeEventListener("resize", handleResize);
      window.visualViewport?.removeEventListener("resize", handleResize);
    },
  };
}

function setupIntroBubbles() {
  if (!introGate || prefersReducedMotion) return null;

  const compact = isCompactIntro();
  const elements = [...introGate.querySelectorAll(".intro-glass-shape")];
  if (!elements.length) return null;

  let frame = 0;
  let lastTime = performance.now();
  let lastBubbleDrawTime = 0;
  let running = true;
  let bubbles = [];

  const positionBubbles = () => {
    const bounds = introGate.getBoundingClientRect();
    bubbles = elements.map((element, index) => {
      const rect = element.getBoundingClientRect();
      const size = Math.min(rect.width, rect.height);
      const speedBase = compact ? 28 : 86;
      const angle = ((index * 73 + 28) * Math.PI) / 180;
      const x = clamp(rect.left - bounds.left, 8, Math.max(8, bounds.width - rect.width - 8));
      const y = clamp(rect.top - bounds.top, 8, Math.max(8, bounds.height - rect.height - 8));

      element.style.left = "0px";
      element.style.top = "0px";
      element.style.right = "auto";
      element.style.bottom = "auto";
      element.style.setProperty("--bubble-squash-x", "1");
      element.style.setProperty("--bubble-squash-y", "1");

      return {
        element,
        radius: compact ? size * 0.5 : size / 2,
        height: rect.height,
        width: rect.width,
        x,
        y,
        vx: Math.cos(angle) * (speedBase + index * 8),
        vy: Math.sin(angle) * (speedBase + index * 7),
      };
    });
  };

  const render = () => {
    for (const bubble of bubbles) {
      bubble.element.style.transform =
        `translate3d(${bubble.x.toFixed(1)}px, ${bubble.y.toFixed(1)}px, 0) ` +
        `scale(var(--bubble-squash-x, 1), var(--bubble-squash-y, 1))`;
    }
  };

  const bounce = (bubble, axis) => {
    bubble.element.classList.remove("is-bouncing-x", "is-bouncing-y");
    bubble.element.style.setProperty("--bubble-squash-x", axis === "x" ? "0.97" : "1.03");
    bubble.element.style.setProperty("--bubble-squash-y", axis === "x" ? "1.03" : "0.97");
    bubble.element.style.setProperty("--bubble-impact-x", axis === "x" ? "7%" : "2%");
    bubble.element.style.setProperty("--bubble-impact-y", axis === "x" ? "-2%" : "7%");
    bubble.element.classList.add(axis === "x" ? "is-bouncing-x" : "is-bouncing-y");
    window.setTimeout(() => {
      bubble.element.style.setProperty("--bubble-squash-x", "1");
      bubble.element.style.setProperty("--bubble-squash-y", "1");
      bubble.element.classList.remove("is-bouncing-x", "is-bouncing-y");
    }, 320);
  };

  const tick = (time) => {
    if (!running) return;
    const minFrameMs = compact ? 33 : 16;
    if (time - lastBubbleDrawTime < minFrameMs) {
      frame = window.requestAnimationFrame(tick);
      return;
    }

    const bounds = introGate.getBoundingClientRect();
    const dt = Math.min((time - lastTime) / 1000, 0.032);
    lastTime = time;
    lastBubbleDrawTime = time;

    for (const bubble of bubbles) {
      bubble.x += bubble.vx * dt;
      bubble.y += bubble.vy * dt;

      if (bubble.x <= 0) {
        bubble.x = 0;
        bubble.vx = Math.abs(bubble.vx);
        bounce(bubble, "x");
      } else if (bubble.x + bubble.width >= bounds.width) {
        bubble.x = bounds.width - bubble.width;
        bubble.vx = -Math.abs(bubble.vx);
        bounce(bubble, "x");
      }

      if (bubble.y <= 0) {
        bubble.y = 0;
        bubble.vy = Math.abs(bubble.vy);
        bounce(bubble, "y");
      } else if (bubble.y + bubble.height >= bounds.height) {
        bubble.y = bounds.height - bubble.height;
        bubble.vy = -Math.abs(bubble.vy);
        bounce(bubble, "y");
      }
    }

    const collisionIterations = compact ? 1 : 2;
    for (let iteration = 0; iteration < collisionIterations; iteration += 1) {
      for (let i = 0; i < bubbles.length; i += 1) {
        for (let j = i + 1; j < bubbles.length; j += 1) {
          const a = bubbles[i];
          const b = bubbles[j];
          const ax = a.x + a.width / 2;
          const ay = a.y + a.height / 2;
          const bx = b.x + b.width / 2;
          const by = b.y + b.height / 2;
          const dx = bx - ax;
          const dy = by - ay;
          const distance = Math.hypot(dx, dy) || 1;
          const minDistance = compact ? a.radius + b.radius + 4 : a.radius + b.radius + 12;

          if (distance >= minDistance) continue;

          const nx = dx / distance;
          const ny = dy / distance;
          const overlap = (minDistance - distance) / 2;
          a.x -= nx * overlap;
          a.y -= ny * overlap;
          b.x += nx * overlap;
          b.y += ny * overlap;

          if (iteration > 0) continue;

          const tangentX = -ny;
          const tangentY = nx;
          const aNormal = a.vx * nx + a.vy * ny;
          const bNormal = b.vx * nx + b.vy * ny;
          const aTangent = a.vx * tangentX + a.vy * tangentY;
          const bTangent = b.vx * tangentX + b.vy * tangentY;
          const damping = 0.94;

          a.vx = (bNormal * nx + aTangent * tangentX) * damping;
          a.vy = (bNormal * ny + aTangent * tangentY) * damping;
          b.vx = (aNormal * nx + bTangent * tangentX) * damping;
          b.vy = (aNormal * ny + bTangent * tangentY) * damping;

          bounce(a, Math.abs(nx) > Math.abs(ny) ? "x" : "y");
          bounce(b, Math.abs(nx) > Math.abs(ny) ? "x" : "y");
        }
      }
    }

    render();
    frame = window.requestAnimationFrame(tick);
  };

  const handleResize = () => {
    positionBubbles();
    render();
  };

  positionBubbles();
  render();
  window.addEventListener("resize", handleResize);
  window.visualViewport?.addEventListener("resize", handleResize);
  frame = window.requestAnimationFrame(tick);

  return {
    stop() {
      running = false;
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", handleResize);
      window.visualViewport?.removeEventListener("resize", handleResize);
    },
  };
}

function setupIntroGate() {
  if (!introGate || !introTitle || !introEnter) return;
  if (shouldSkipIntro()) {
    closeIntroGate();
    return;
  }

  document.body.classList.add("intro-active");
  introFluid = setupIntroFluid();
  introBubbles = setupIntroBubbles();
  introFluid?.playReveal(1750);

  if (canAnimate) {
    window.anime.set([".intro-title", ".intro-enter"], {
      opacity: 0,
      translateY: 18,
    });
    window.anime({
      targets: [".intro-title", ".intro-enter"],
      opacity: [0, 1],
      translateY: [18, 0],
      delay: window.anime.stagger(90),
      duration: 820,
      easing: "easeOutCubic",
    });
  }

  introEnter.addEventListener("click", () => {
    introEnter.disabled = true;
    introGate.classList.add("is-welcome");
    introTitle.setAttribute("aria-label", "Welcome");
    introTitle.dataset.lines = "Welcome";
    const titleCopy = introTitle.querySelector(".intro-title-copy");
    if (titleCopy) titleCopy.textContent = "Welcome";
    introFluid?.setLines(["Welcome"]);
    introFluid?.playReveal(850);
    window.scrollTo({ top: 0, behavior: "auto" });

    if (!canAnimate) {
      window.setTimeout(closeIntroGate, 900);
      return;
    }

    window.anime
      .timeline({
        easing: "easeOutCubic",
      })
      .add({
        targets: ".intro-title",
        opacity: [0.86, 1],
        translateY: [18, 0],
        scale: [0.94, 1],
        duration: 620,
      })
      .add(
        {
          targets: ".intro-enter",
          opacity: [1, 0],
          translateY: [0, 10],
          duration: 260,
        },
        "-=380"
      )
      .add({
        targets: ".intro-gate",
        opacity: [1, 0],
        scale: [1, 1.018],
        duration: 420,
        complete: closeIntroGate,
      }, "+=100");
  });
}

function renderProjectSkeletons(count = 6) {
  if (!grid) return;
  grid.innerHTML = Array.from({ length: count }, () => '<article class="project-skeleton" aria-hidden="true"></article>').join("");
}

setupHeaderScrollState();
setupProjectCardSpotlight();
setupProjectCardNavigation();
setupActiveNav();
setupIntroGate();

function runIntroAnimation() {
  if (!canAnimate || mainIntroAnimationStarted) return;
  mainIntroAnimationStarted = true;

  const introTargets = [
    ".site-header",
    ".hero-copy .eyebrow",
    ".hero-copy h1",
    ".hero-text",
    ".hero-actions",
    ".hero-panel",
  ];

  window.anime.set(introTargets, {
    opacity: 0,
    translateY: 22,
  });
  document.documentElement.classList.remove("intro-pending");

  window.anime
    .timeline({
      easing: "easeOutCubic",
      duration: 720,
    })
    .add({
      targets: ".site-header",
      opacity: [0, 1],
      translateY: [-12, 0],
      duration: 560,
    })
    .add(
      {
        targets: [".hero-copy .eyebrow", ".hero-copy h1", ".hero-text", ".hero-actions"],
        opacity: [0, 1],
        translateY: [22, 0],
        delay: window.anime.stagger(85),
      },
      "-=260"
    )
    .add(
      {
        targets: ".hero-panel",
        opacity: [0, 1],
        translateY: [26, 0],
        scale: [0.985, 1],
      },
      "-=520"
    );
}

function setProjectCount(value) {
  if (!projectCount) return;
  if (!canAnimate) {
    projectCount.textContent = value;
    return;
  }

  projectCount.textContent = "0";
  pendingProjectCount = value;
  if (introGate && !introGate.classList.contains("is-hidden")) return;
  startProjectCountWhenVisible();
}

function startProjectCountWhenVisible() {
  if (!projectCount || pendingProjectCount === null || projectCountAnimationStarted) return;

  const value = pendingProjectCount;
  pendingProjectCount = null;
  const countTrigger = projectCount.closest(".metric-card") || projectCount;
  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting) || projectCountAnimationStarted) return;
      projectCountAnimationStarted = true;
      observer.disconnect();
      animateProjectCount(value);
    },
    { threshold: 0.5 }
  );
  observer.observe(countTrigger);
}

function animateProjectCount(value) {
  const countState = { value: 0 };
  window.anime({
    targets: countState,
    value,
    round: 1,
    delay: 700,
    duration: 1400,
    easing: "easeOutCubic",
    update: () => {
      projectCount.textContent = countState.value;
    },
    complete: () => {
      projectCount.textContent = value;
    },
  });
}

function animateProjectCards() {
  if (!canAnimate) return;
  if (introGate && !introGate.classList.contains("is-hidden")) {
    pendingProjectCardsAnimation = true;
    return;
  }

  const cards = grid.querySelectorAll(".project-card");
  if (!cards.length) return;
  window.anime.remove(cards);
  window.anime.set(cards, {
    opacity: 0,
    translateY: 24,
    scale: 0.985,
  });
  window.anime({
    targets: cards,
    opacity: [0, 1],
    translateY: [24, 0],
    scale: [0.985, 1],
    delay: window.anime.stagger(55),
    duration: 620,
    easing: "easeOutCubic",
  });
}

if (!introGate) runIntroAnimation();
renderProjectSkeletons();

function closeCvRequestPanel() {
  if (!cvRequest || !cvRequestPanel || !cvRequestButton) return;
  if (cvRequest.classList.contains("is-submitting")) return;
  cvRequest.classList.remove("is-open", "is-sent");
  cvRequestPanel.hidden = true;
  cvRequestButton.setAttribute("aria-expanded", "false");
}

function showCvRequestSent() {
  if (!cvRequest || !cvRequestPanel || !cvRequestButton) return;
  window.clearTimeout(cvRequestResetTimer);
  window.clearTimeout(cvRequestSubmitFallbackTimer);
  cvRequestSubmitted = false;
  cvRequest.classList.remove("is-open", "is-submitting");
  cvRequest.classList.add("is-sent");
  cvRequestPanel.hidden = true;
  cvRequestButton.setAttribute("aria-expanded", "false");
  cvRequestPanel.reset();
  if (cvRequestSubmit) cvRequestSubmit.textContent = "Send";

  cvRequestResetTimer = window.setTimeout(() => {
    cvRequest.classList.remove("is-sent");
  }, 1500);
}

if (cvRequestButton && cvRequestPanel) {
  cvRequestButton.addEventListener("click", () => {
    const isOpen = !cvRequestPanel.hidden;
    cvRequest?.classList.remove("is-sent");
    cvRequest?.classList.toggle("is-open", !isOpen);
    cvRequestPanel.hidden = isOpen;
    cvRequestButton.setAttribute("aria-expanded", String(!isOpen));
    if (isOpen) return;
    window.setTimeout(() => cvRequestEmail?.focus(), 40);
  });

  document.addEventListener("click", (event) => {
    if (!cvRequest || cvRequest.contains(event.target)) return;
    closeCvRequestPanel();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeCvRequestPanel();
      cvRequestButton.focus({ preventScroll: true });
    }
  });

  cvRequestPanel.addEventListener("submit", () => {
    window.clearTimeout(cvRequestSubmitFallbackTimer);
    cvRequestSubmitted = true;
    cvRequest?.classList.add("is-submitting");
    if (cvRequestSubmit) cvRequestSubmit.textContent = "Sending";

    cvRequestSubmitFallbackTimer = window.setTimeout(() => {
      if (!cvRequestSubmitted) return;
      showCvRequestSent();
    }, 900);
  });

  cvRequestFrame?.addEventListener("load", () => {
    if (!cvRequestSubmitted) return;
    showCvRequestSent();
  });
}

async function loadProjects() {
  const response = await fetch("projects.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Could not load projects.json");
  }
  state.projects = await response.json();
  setProjectCount(state.projects.length);
  renderFilters();
  renderProjects();
}

function renderFilters() {
  const categories = ["All", ...new Set(state.projects.map((project) => project.category))];
  filters.innerHTML = categories
    .map(
      (category) => `
        <button class="filter-button ${category === state.category ? "active" : ""}" data-category="${category}">
          ${category}
        </button>
      `
    )
    .join("");
}

function projectMatches(project) {
  const query = state.query.trim().toLowerCase();
  const categoryMatch = state.category === "All" || project.category === state.category;
  if (!categoryMatch) return false;
  if (!query) return true;

  const searchable = [
    project.title,
    project.category,
    project.year,
    project.summary,
    ...(project.tags || []),
    ...(project.stack || []),
  ]
    .join(" ")
    .toLowerCase();

  return searchable.includes(query);
}

function renderProjects() {
  const visibleProjects = state.projects.filter(projectMatches);
  emptyState.hidden = visibleProjects.length > 0;
  grid.innerHTML = visibleProjects.map(renderProjectCard).join("");
  animateProjectCards();
}

function mixHexWithWhite(hex, whiteAmount = 0.42) {
  const normalized = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return "#ffffff";

  const value = Number.parseInt(normalized, 16);
  const rgb = [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  const mixed = rgb.map((channel) => Math.round(channel * (1 - whiteAmount) + 255 * whiteAmount));

  return `rgb(${mixed[0]}, ${mixed[1]}, ${mixed[2]})`;
}

function hexToRgba(hex, alpha = 0.72) {
  const normalized = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return `rgba(255, 255, 255, ${alpha})`;

  const value = Number.parseInt(normalized, 16);
  const rgb = [(value >> 16) & 255, (value >> 8) & 255, value & 255];

  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

function renderProjectCard(project, index) {
  const accent = project.accent || ["#102a43", "#2563eb"];
  const primaryLink = (project.links || [])[0]?.url || "";
  const accentSoft = mixHexWithWhite(accent[1]);
  const accentAGlass = hexToRgba(accent[0], 0.72);
  const accentBGlass = hexToRgba(accent[1], 0.66);
  const accentSoftGlass = hexToRgba(accent[1], 0.28);
  const tags = [...(project.tags || []), ...(project.stack || [])]
    .slice(0, 8)
    .map((tag) => `<span class="tag">${tag}</span>`)
    .join("");
  const links = (project.links || [])
    .map((link, linkIndex) => {
      const isGitHub = link.label === "GitHub" || link.url.includes("github.com");
      const opensNewTab = isGitHub || link.variant === "demo";
      const targetAttrs = opensNewTab ? ' target="_blank" rel="noreferrer"' : "";
      const className = [
        link.variant === "demo" ? "demo-link" : linkIndex === 0 ? "primary-link" : "",
        isGitHub ? "github-logo-button project-github-link" : "",
      ]
        .filter(Boolean)
        .join(" ");
      const label = isGitHub
        ? `<img src="assets/githublogo.png" alt="GitHub" />`
        : link.label;

      return `
        <a class="${className}" href="${link.url}"${targetAttrs} aria-label="${isGitHub ? `Open ${project.title} on GitHub` : link.label}">
          ${label}
        </a>
      `;
    })
    .join("");

  return `
    <article class="project-card" data-project-url="${primaryLink}" style="--accent-a: ${accent[0]}; --accent-b: ${accent[1]}; --accent-soft: ${accentSoft}; --accent-a-glass: ${accentAGlass}; --accent-b-glass: ${accentBGlass}; --accent-soft-glass: ${accentSoftGlass};">
      <div class="project-top">
        <div class="meta">${String(index + 1).padStart(2, "0")} · ${project.year} · ${project.category}</div>
        <h3>${project.title}</h3>
      </div>
      <div class="project-body">
        <p>${project.summary}</p>
        <div class="tags" aria-label="${project.title} tags">${tags}</div>
        <div class="link-row">${links}</div>
      </div>
    </article>
  `;
}

filters.addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  state.category = button.dataset.category;
  renderFilters();
  renderProjects();
});

searchInput.addEventListener("input", (event) => {
  state.query = event.target.value;
  renderProjects();
});

loadProjects().catch((error) => {
  grid.innerHTML = `
    <section class="empty-state">
      <h3>Portfolio data could not load</h3>
      <p>${error.message}</p>
    </section>
  `;
});
