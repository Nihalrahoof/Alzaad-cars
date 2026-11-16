/* Presentation only: does not read or write inventory, form data or API settings. */
(() => {
  "use strict";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [
    ...root.querySelectorAll(selector),
  ];
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const icon = (path) =>
    `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="${path}"/></svg>`;

  // Animate only when visible. Content stays readable if this enhancement fails.
  const seen = new WeakSet();
  const activeAnimations = new Set();
  const animate = (element, frames, options) => {
    if (motion.matches || !element.animate) return;
    const animation = element.animate(frames, options);
    activeAnimations.add(animation);
    const finish = () => activeAnimations.delete(animation);
    animation.addEventListener("finish", finish, { once: true });
    animation.addEventListener("cancel", finish, { once: true });
  };
  const reveal = (element) =>
    animate(
      element,
      [
        { opacity: 0, transform: "translateY(22px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      {
        duration: 700,
        delay: Number(element.dataset.revealDelay || 0),
        easing: "cubic-bezier(.2,.7,.2,1)",
        fill: "backwards",
      },
    );
  const observer =
    "IntersectionObserver" in window
      ? new IntersectionObserver(
          (entries) => {
            entries.forEach(({ target, isIntersecting }) => {
              if (!isIntersecting) return;
              observer.unobserve(target);
              reveal(target);
            });
          },
          { threshold: 0.08 },
        )
      : null;
  const discover = () => {
    $$(
      ".section-heading, .car-card, .service-card, .confidence-grid > div, .principles article, .visit > div, .buy-intro > *, .enquiry-layout > div, .brand-list, .final-cta .wrap",
    ).forEach((element) => {
      if (seen.has(element)) return;
      seen.add(element);
      if (element.matches(".car-card, .service-card")) {
        element.dataset.revealDelay = String(
          Math.min(
            [...element.parentElement.children].indexOf(element) % 4,
            3,
          ) * 65,
        );
      }
      observer?.observe(element);
    });
    enhanceGallery();
  };
  motion.addEventListener("change", () => {
    if (motion.matches)
      activeAnimations.forEach((animation) => animation.cancel());
  });
  $$(".hero-inner > :not(.hero-caption), .subhero .wrap > *").forEach(
    (element, index) => {
      animate(
        element,
        [
          { opacity: 0, transform: "translateY(20px)" },
          { opacity: 1, transform: "translateY(0)" },
        ],
        {
          duration: 850,
          delay: Math.min(index, 4) * 100,
          easing: "cubic-bezier(.2,.7,.2,1)",
          fill: "backwards",
        },
      );
    },
  );
  const heroImage = $(".hero-image");
  if (heroImage)
    animate(
      heroImage,
      [{ transform: "scale(1.045)" }, { transform: "scale(1)" }],
      { duration: 2200, easing: "ease-out" },
    );

  const header = $(".header");
  const progress = document.createElement("div");
  progress.className = "reading-progress";
  progress.setAttribute("aria-hidden", "true");
  header?.append(progress);
  const backTop = document.createElement("button");
  backTop.type = "button";
  backTop.className = "back-top";
  backTop.setAttribute("aria-label", "Back to top");
  backTop.innerHTML = icon("M6 12l6-6 6 6M12 6v13");
  document.body.append(backTop);
  backTop.addEventListener("click", () => {
    window.scrollTo({
      top: 0,
      behavior: motion.matches ? "instant" : "smooth",
    });
    const homeLink = $(".header .brand");
    homeLink?.focus({ preventScroll: true });
  });
  let framePending = false;
  const updateScroll = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    progress.style.transform = `scaleX(${max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0})`;
    header?.classList.toggle("is-scrolled", scrollY > 24);
    backTop.classList.toggle("is-visible", scrollY > 650);
    framePending = false;
  };
  const requestScrollUpdate = () => {
    if (!framePending) {
      framePending = true;
      requestAnimationFrame(updateScroll);
    }
  };
  addEventListener("scroll", requestScrollUpdate, { passive: true });
  addEventListener("resize", requestScrollUpdate, { passive: true });
  updateScroll();

  // Collapse the existing filters on phones without changing their names or behavior.
  const filters = $(".filter-form");
  if (filters) {
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "filter-toggle";
    toggle.setAttribute("aria-controls", filters.id);
    toggle.setAttribute("aria-expanded", "false");
    toggle.innerHTML = `<span>Filter the collection</span>${icon("M6 9l6 6 6-6")}`;
    filters.before(toggle);
    filters.classList.add("has-toggle", "is-collapsed");
    toggle.addEventListener("click", () => {
      const expanded = toggle.getAttribute("aria-expanded") !== "true";
      toggle.setAttribute("aria-expanded", String(expanded));
      filters.classList.toggle("is-collapsed", !expanded);
    });
    filters.addEventListener("submit", () => {
      if (!matchMedia("(max-width: 800px)").matches) return;
      toggle.setAttribute("aria-expanded", "false");
      filters.classList.add("is-collapsed");
      toggle.focus({ preventScroll: true });
      $(".results")?.scrollIntoView({
        behavior: motion.matches ? "instant" : "smooth",
        block: "start",
      });
    });
  }

  // A native modal provides focus trapping and Escape support, including keyboard users.
  let viewer,
    photoList = [],
    photoIndex = 0,
    opener;
  function buildViewer() {
    if (viewer) return;
    viewer = document.createElement("dialog");
    viewer.className = "photo-viewer";
    viewer.setAttribute("aria-labelledby", "viewer-title");
    viewer.innerHTML = `<div class="viewer-top"><h2 id="viewer-title" class="viewer-title">Vehicle photos</h2><button class="viewer-close" type="button" aria-label="Close photo viewer" autofocus>${icon("M6 6l12 12M18 6L6 18")}</button></div><div class="viewer-stage"><img alt=""></div><div class="viewer-controls"><button type="button" data-direction="-1" aria-label="Previous photo">${icon("M14 6l-6 6 6 6")}</button><p class="viewer-count" aria-live="polite" aria-atomic="true"></p><button type="button" data-direction="1" aria-label="Next photo">${icon("M10 6l6 6-6 6")}</button></div>`;
    document.body.append(viewer);
    $(".viewer-close", viewer).addEventListener("click", () => viewer.close());
    $$("[data-direction]", viewer).forEach((button) =>
      button.addEventListener("click", () =>
        showPhoto(photoIndex + Number(button.dataset.direction)),
      ),
    );
    viewer.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        showPhoto(photoIndex + (event.key === "ArrowLeft" ? -1 : 1));
      }
    });
    viewer.addEventListener("click", (event) => {
      if (event.target !== viewer) return;
      const rect = viewer.getBoundingClientRect();
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      )
        viewer.close();
    });
    viewer.addEventListener("close", () => {
      document.documentElement.classList.remove("viewer-is-open");
      if (opener?.isConnected) opener.focus({ preventScroll: true });
      else $(".gallery-open")?.focus({ preventScroll: true });
    });
  }
  function showPhoto(index) {
    photoIndex = (index + photoList.length) % photoList.length;
    const img = $(".viewer-stage img", viewer);
    img.src = photoList[photoIndex];
    img.alt = `${$("#gallery-image")?.alt || "Vehicle"} — photo ${photoIndex + 1}`;
    $(".viewer-count", viewer).textContent =
      `${photoIndex + 1} / ${photoList.length}`;
    $$("[data-direction]", viewer).forEach(
      (button) => (button.disabled = photoList.length < 2),
    );
  }
  function enhanceGallery() {
    const gallery = $(".gallery-main");
    if (
      !gallery ||
      $(".gallery-open", gallery) ||
      typeof HTMLDialogElement === "undefined"
    )
      return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "gallery-open";
    button.setAttribute("aria-label", "Open full-screen vehicle photos");
    button.innerHTML = `<span>${icon("M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5")}View photos</span>`;
    gallery.append(button);
    button.addEventListener("click", () => {
      photoList = $$(".gallery-thumbs img").map((img) => img.src);
      if (!photoList.length && $("#gallery-image")?.src)
        photoList = [$("#gallery-image").src];
      if (!photoList.length) return;
      opener = button;
      buildViewer();
      const selected = $('.gallery-thumbs button[aria-pressed="true"]');
      showPhoto(Math.max(0, Number(selected?.dataset.photo || 0)));
      viewer.showModal();
      document.documentElement.classList.add("viewer-is-open");
    });
  }
  discover();
  // Inventory can refresh or filter after initial render; enhance newly inserted cards.
  const inventoryRoot = $("#main");
  if (inventoryRoot)
    new MutationObserver((records) => {
      if (records.some((record) => record.addedNodes.length)) {
        discover();
        requestScrollUpdate();
      }
    }).observe(inventoryRoot, { childList: true, subtree: true });
})();
