const state = {
  projects: [],
  category: "All",
  query: "",
};

const grid = document.querySelector("#projectsGrid");
const filters = document.querySelector("#categoryFilters");
const searchInput = document.querySelector("#searchInput");
const emptyState = document.querySelector("#emptyState");

document.querySelector("#year").textContent = new Date().getFullYear();

async function loadProjects() {
  const response = await fetch("projects.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Could not load projects.json");
  }
  state.projects = await response.json();
  document.querySelector("#projectCount").textContent = state.projects.length;
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
}

function mixHexWithWhite(hex, whiteAmount = 0.42) {
  const normalized = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return "#ffffff";

  const value = Number.parseInt(normalized, 16);
  const rgb = [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  const mixed = rgb.map((channel) => Math.round(channel * (1 - whiteAmount) + 255 * whiteAmount));

  return `rgb(${mixed[0]}, ${mixed[1]}, ${mixed[2]})`;
}

function renderProjectCard(project, index) {
  const accent = project.accent || ["#102a43", "#2563eb"];
  const accentSoft = mixHexWithWhite(accent[1]);
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
    <article class="project-card" style="--accent-a: ${accent[0]}; --accent-b: ${accent[1]}; --accent-soft: ${accentSoft};">
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
