(() => {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hasAnime = typeof window.anime === "function";
  const canAnimate = !prefersReducedMotion && hasAnime;

  injectSharedMotionStyles();
  setupHeaderScrollState();

  if (!canAnimate) {
    document.documentElement.classList.remove("project-motion-pending");
    return;
  }

  const findTargets = (selectors) =>
    selectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)));
  const uniqueTargets = (targets) => Array.from(new Set(targets));

  const introTargets = uniqueTargets(findTargets([
    ".site-header",
    ".hero > div:first-child .eyebrow",
    ".hero > div:first-child h1",
    ".hero-text",
    ".hero-actions",
    ".hero > aside",
    ".hero-visual",
    ".panel",
  ]));

  if (introTargets.length) {
    window.anime.set(introTargets, {
      opacity: 0,
      translateY: 22,
    });

    window.anime
      .timeline({
        easing: "easeOutCubic",
        duration: 700,
      })
      .add({
        targets: ".site-header",
        opacity: [0, 1],
        translateY: [-12, 0],
        duration: 520,
      })
      .add(
        {
          targets: [
            ".hero > div:first-child .eyebrow",
            ".hero > div:first-child h1",
            ".hero-text",
            ".hero-actions",
          ],
          opacity: [0, 1],
          translateY: [22, 0],
          delay: window.anime.stagger(80),
        },
        "-=240"
      )
      .add(
        {
          targets: [".hero > aside", ".hero-visual", ".panel"],
          opacity: [0, 1],
          translateY: [28, 0],
          scale: [0.985, 1],
        },
        "-=520"
      );
  }

  const revealTargets = uniqueTargets(findTargets([
    ".section-heading",
    ".steps-grid article",
    ".loop-grid article",
    ".experiment-grid article",
    ".download-list a",
    ".glass-card",
    ".role-card",
    ".screen-card",
    ".snippet",
    ".metric-panel",
    ".panel-grid div",
    ".signal-card",
    ".feature-card",
    ".agent-card",
    ".concept-panel",
    ".meta-card",
  ])).filter((target) => !target.closest(".hero"));

  window.anime.set(revealTargets, {
    opacity: 0,
    translateY: 24,
  });
  document.documentElement.classList.remove("project-motion-pending");

  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        window.anime({
          targets: entry.target,
          opacity: [0, 1],
          translateY: [24, 0],
          duration: 650,
          easing: "easeOutCubic",
        });
      });
    },
    { threshold: 0.18, rootMargin: "0px 0px -8% 0px" }
  );

  revealTargets.forEach((target) => revealObserver.observe(target));

  const numericTargets = findTargets([
    ".metric span",
    ".metric-tile span",
    ".steps-grid article > span",
    ".loop-index",
  ]).filter((target) => /^\d+(?:[.,]\d+)?%?$/.test(target.textContent.trim()));

  const countObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        animateNumber(entry.target);
      });
    },
    { threshold: 0.45 }
  );

  numericTargets.forEach((target) => countObserver.observe(target));

  function animateNumber(target) {
    const raw = target.textContent.trim();
    const hasPercent = raw.endsWith("%");
    const numericText = hasPercent ? raw.slice(0, -1) : raw;
    const decimalPlaces = numericText.includes(".") || numericText.includes(",")
      ? numericText.split(/[.,]/)[1].length
      : 0;
    const padLength = decimalPlaces === 0 && numericText.startsWith("0") ? numericText.length : 0;
    const value = Number(numericText.replace(",", "."));
    if (!Number.isFinite(value)) return;

    const state = { value: 0 };
    window.anime({
      targets: state,
      value,
      duration: 1100,
      easing: "easeOutCubic",
      update: () => {
        let next = decimalPlaces ? state.value.toFixed(decimalPlaces) : String(Math.round(state.value));
        if (padLength) next = next.padStart(padLength, "0");
        target.textContent = `${next}${hasPercent ? "%" : ""}`;
      },
      complete: () => {
        target.textContent = raw;
      },
    });
  }

  function injectSharedMotionStyles() {
    if (document.querySelector("[data-page-motion-styles]")) return;
    const style = document.createElement("style");
    style.dataset.pageMotionStyles = "true";
    style.textContent = `
      .site-header {
        transition: background 240ms ease, box-shadow 240ms ease, backdrop-filter 240ms ease, border-color 240ms ease;
      }

      .site-header.is-scrolled {
        border-color: rgba(255, 255, 255, 0.72);
        background:
          linear-gradient(135deg, rgba(255, 255, 255, 0.82), rgba(236, 253, 245, 0.56)),
          rgba(255, 255, 255, 0.68);
        box-shadow: 0 22px 58px rgba(15, 23, 42, 0.14);
        backdrop-filter: blur(22px) saturate(1.22);
      }
    `;
    document.head.appendChild(style);
  }

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
})();
