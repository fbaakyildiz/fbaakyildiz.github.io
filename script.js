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
let cvRequestSubmitted = false;
let cvRequestResetTimer;
let cvRequestSubmitFallbackTimer;
let projectCountAnimationStarted = false;

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const canAnimate = !prefersReducedMotion && typeof window.anime === "function";
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

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

function renderProjectSkeletons(count = 6) {
  if (!grid) return;
  grid.innerHTML = Array.from({ length: count }, () => '<article class="project-skeleton" aria-hidden="true"></article>').join("");
}

setupHeaderScrollState();
setupProjectCardSpotlight();
setupProjectCardNavigation();
setupActiveNav();

function runIntroAnimation() {
  if (!canAnimate) return;

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

  const cards = grid.querySelectorAll(".project-card");
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

runIntroAnimation();
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
