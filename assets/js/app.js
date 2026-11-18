/* Al Zaad Cars — framework-free, static-host compatible. */
(() => {
  "use strict";
  const cfg = window.ALZAAD;
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const esc = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const number = (n) => new Intl.NumberFormat("en-AE").format(Number(n) || 0);
  const money = (n) =>
    Number(n) > 0 ? `<small>AED</small> ${number(n)}` : "Price on request";
  const title = (c) => `${c.year} ${c.make} ${c.model}`;
  const wa = (message) =>
    `https://wa.me/${cfg.whatsapp}?text=${encodeURIComponent(message || "Hello Al Zaad Cars, I would like to know more about your available cars.")}`;
  const carLink = (c) => `car.html?id=${encodeURIComponent(c.id)}`;
  const normalizeGoogleDriveUrl = (raw) => {
    if (!raw || typeof raw !== "string") return "";
    const trimmed = raw.trim();
    if (trimmed === "CellImage" || trimmed.toLowerCase().includes("cellimage")) {
      return "";
    }
    const driveMatch = trimmed.match(
      /(?:drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=view&)?id=)|lh3\.google(?:usercontent)?\.com\/(?:u\/\d+\/)?d\/)([a-zA-Z0-9_-]{25,})/,
    );
    if (driveMatch && driveMatch[1]) {
      return `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;
    }
    return trimmed;
  };
  const safeImage = (raw) => {
    const normalized = normalizeGoogleDriveUrl(raw);
    if (!normalized) return "assets/images/placeholder.svg";
    try {
      const url = new URL(normalized, document.baseURI);
      if (
        url.protocol === "https:" ||
        (url.origin === location.origin &&
          ["http:", "file:"].includes(url.protocol))
      )
        return url.href;
    } catch (_) {
      /* Show placeholder. */
    }
    return "assets/images/placeholder.svg";
  };
  const apiConfigured =
    /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(
      cfg.apiUrl,
    );
  let cars = [],
    busy = false,
    visibleCount = 9,
    loaded = false;
  let activeFilters = Object.fromEntries(new URLSearchParams(location.search));
  const filters = $("#filters");
  const uid = () =>
    crypto.randomUUID
      ? crypto.randomUUID()
      : [...crypto.getRandomValues(new Uint8Array(16))]
        .map((v) => v.toString(16).padStart(2, "0"))
        .join("");
  const links = {
    phone: `tel:${cfg.phoneRaw}`,
    email: `mailto:${cfg.email}`,
    whatsapp: wa(),
    maps: cfg.maps,
    instagram: cfg.instagram,
    facebook: cfg.facebook,
    channel: cfg.channel,
  };
  $$("[data-contact]").forEach((a) => {
    a.href = links[a.dataset.contact];
    if (a.dataset.contact === "whatsapp") {
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    }
  });
  $$("[data-year]").forEach(
    (el) => (el.textContent = new Date().getFullYear()),
  );
  $$("[data-page]", $("#main-nav")).forEach((a) => {
    if (a.dataset.page === document.body.dataset.page)
      a.setAttribute("aria-current", "page");
  });
  const menu = $(".menu-toggle"),
    nav = $("#main-nav");
  menu.addEventListener("click", () => {
    const open = menu.getAttribute("aria-expanded") !== "true";
    menu.setAttribute("aria-expanded", String(open));
    nav.classList.toggle("open", open);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      nav.classList.remove("open");
      menu.setAttribute("aria-expanded", "false");
    }
  });
  nav.addEventListener("click", () => {
    nav.classList.remove("open");
    menu.setAttribute("aria-expanded", "false");
  });
  document.addEventListener(
    "error",
    (e) => {
      if (
        e.target.tagName === "IMG" &&
        !e.target.src.endsWith("/placeholder.svg")
      ) {
        e.target.src = "assets/images/placeholder.svg";
        e.target.alt = "Photo coming soon";
      }
    },
    true,
  );

  function notice(message) {
    $$(".inventory-notice").forEach((el) => (el.textContent = message));
  }
  function card(c) {
    return `<article class="car-card"><a class="car-image" href="${carLink(c)}" aria-label="View ${esc(title(c))}"><img src="${esc(safeImage(c.image))}" alt="${esc(title(c))}${cfg.demoMode ? " — representative photo" : ""}" loading="lazy" width="600" height="420"><span class="badge">${esc(c.body || "Car")}</span>${c.status !== "Available" ? `<span class="badge status">${esc(c.status)}</span>` : ""}</a><div class="car-info"><p class="car-make">${esc(c.make)}</p><h3><a href="${carLink(c)}">${esc(c.model)}</a></h3><dl class="specs">${[
      ["Year", c.year],
      ["Mileage", `${number(c.mileage)} km`],
      ["Specs", c.specs || "Ask us"],
      ["Gearbox", c.transmission || "Ask us"],
    ]
      .map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`)
      .join(
        "",
      )}</dl><div class="car-bottom"><p class="price">${money(c.price)}</p><a class="round-link" href="${carLink(c)}" aria-label="View ${esc(title(c))}"><svg class="arrow-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true" focusable="false"><path d="M6 18L18 6M6 6h12v12"/></svg></a></div></div></article>`;
  }
  function setOptions(select, values) {
    const before = select.value;
    const label = select.options[0].text;
    select.replaceChildren(
      new Option(label, ""),
      ...values.filter(Boolean).map((v) => new Option(v, v)),
    );
    if ([...select.options].some((o) => o.value === before))
      select.value = before;
  }
  function populateFilters() {
    if (!filters) return;
    $$("[data-options]", filters).forEach((select) => {
      const key = select.dataset.options;
      const make = filters.elements.make?.value;
      const source =
        key === "model" && make ? cars.filter((c) => c.make === make) : cars;
      const values = [...new Set(source.map((c) => c[key]))];
      values.sort(key === "year" ? (a, b) => Number(b) - Number(a) : undefined);
      setOptions(select, values);
    });
  }
  function syncForm() {
    if (!filters) return;
    populateFilters();
    for (const [k, v] of Object.entries(activeFilters)) {
      if (filters.elements[k]) filters.elements[k].value = v;
    }
    populateFilters();
    if (activeFilters.model) filters.elements.model.value = activeFilters.model;
  }
  function renderResults() {
    if (!$("#all-cars")) return;
    const f = activeFilters;
    let list = cars.filter(
      (c) =>
        (!f.q ||
          `${title(c)} ${c.id}`
            .toLowerCase()
            .includes(f.q.trim().toLowerCase())) &&
        [
          "make",
          "model",
          "body",
          "specs",
          "transmission",
          "fuel",
          "status",
        ].every((key) => !f[key] || c[key] === f[key]) &&
        (!f.maxPrice ||
          (Number(c.price) > 0 && Number(c.price) <= Number(f.maxPrice))) &&
        (!f.year || Number(c.year) === Number(f.year)) &&
        (!f.minYear || Number(c.year) >= Number(f.minYear)) &&
        (!f.maxMileage || Number(c.mileage) <= Number(f.maxMileage)),
    );
    const sort = $("#sort").value;
    if (sort === "price-asc")
      list.sort(
        (a, b) => (Number(a.price) || Infinity) - (Number(b.price) || Infinity),
      );
    if (sort === "price-desc")
      list.sort((a, b) => Number(b.price) - Number(a.price));
    if (sort === "year-desc")
      list.sort((a, b) => Number(b.year) - Number(a.year));
    $("#result-count").textContent =
      `${list.length} ${list.length === 1 ? "vehicle" : "vehicles"} in the collection`;
    $("#all-cars").innerHTML = list.length
      ? list.slice(0, visibleCount).map(card).join("")
      : '<div class="empty"><h2>No matching cars.</h2><p>Try another filter, or tell us what you’re looking for.</p><a class="button primary" href="about-contact.html#contact">Speak with our team <svg class="arrow-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true" focusable="false"><path d="M6 18L18 6M6 6h12v12"/></svg></a></div>';
    $("#load-more").hidden = list.length <= visibleCount;
  }
  function renderDetail() {
    const root = $("#car-detail");
    if (!root) return;
    const id = new URLSearchParams(location.search).get("id");
    const c = cars.find((c) => c.id === id);
    if (!c) {
      root.innerHTML =
        '<div class="empty"><h1>Vehicle unavailable.</h1><p>This listing may have been removed. Please browse the current collection.</p><a class="button primary" href="cars.html">View cars <svg class="arrow-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true" focusable="false"><path d="M6 18L18 6M6 6h12v12"/></svg></a></div>';
      $("#enquire").hidden = true;
      return;
    }
    document.title = `${title(c)} | Al Zaad Cars`;
    const images = [
      ...new Set(
        [c.image, ...String(c.images || "").split("|")].filter(Boolean),
      ),
    ];
    if (!images.length) images.push("assets/images/placeholder.svg");
    const vals = [
      ["Year", c.year],
      ["Mileage", `${number(c.mileage)} km`],
      ["Specifications", c.specs || "Ask us"],
      ["Transmission", c.transmission || "Ask us"],
      ["Fuel", c.fuel || "Ask us"],
      ["Body type", c.body || "Ask us"],
      ["Colour", c.color || "Ask us"],
      ["Status", c.status],
    ];
    root.innerHTML = `<div class="detail-heading"><div><p class="eyebrow blue">${esc(c.make)} · REF ${esc(c.id)}</p><h1>${esc(c.model)}</h1><p>${esc(c.year)} · ${esc(c.specs || "Specifications on request")} · ${esc(c.status)}</p></div><p class="price">${money(c.price)}</p></div><div class="detail-layout"><div><div class="gallery-main"><img id="gallery-image" src="${esc(safeImage(images[0]))}" alt="${esc(title(c))}" width="1000" height="700"></div><div class="gallery-thumbs" aria-label="Vehicle photos">${images.map((img, i) => `<button type="button" data-photo="${i}" aria-label="Show photo ${i + 1}" aria-pressed="${i === 0}"><img src="${esc(safeImage(img))}" alt="" loading="lazy"></button>`).join("")}</div></div><aside class="detail-summary"><h3>At a glance</h3><dl class="specs">${vals.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl><a class="button primary" target="_blank" rel="noopener" href="${esc(wa(`Hello Al Zaad Cars, I’m asking about ${title(c)} (ref ${c.id}). Please confirm its availability and details.`))}">Ask on WhatsApp <svg class="arrow-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true" focusable="false"><path d="M6 18L18 6M6 6h12v12"/></svg></a>${c.status === "Available" ? '<a class="button bordered" href="#enquire">Arrange a viewing <svg class="arrow-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true" focusable="false"><path d="M6 18L18 6M6 6h12v12"/></svg></a>' : ""}<p class="field-help">${cfg.demoMode ? "Demo listing only. Not confirmed showroom stock." : "Availability, specifications, condition and the final price must be confirmed with the showroom. No online payment is taken."}</p></aside></div><div class="car-description"><h2>About this car</h2><p>${esc(c.description || "Contact our team for more details about this vehicle.")}</p>${c.features
        ? `<h2>Features</h2><ul class="features">${String(c.features)
          .split("|")
          .filter(Boolean)
          .map((f) => `<li>${esc(f)}</li>`)
          .join("")}</ul>`
        : ""
      }</div>`;
    $$("[data-photo]", root).forEach((button) =>
      button.addEventListener("click", () => {
        $("#gallery-image").src = safeImage(
          images[Number(button.dataset.photo)],
        );
        $$("[data-photo]", root).forEach((b) =>
          b.setAttribute("aria-pressed", String(b === button)),
        );
      }),
    );
    $("#enquire").hidden = c.status !== "Available";
    if (c.status === "Available") {
      const form = $("[data-enquiry]");
      if (!form.dataset.vehicleSet) {
        if (form.elements.carId) form.elements.carId.value = c.id;
        form.elements.type.value = "Test drive";
        form.dataset.vehicleSet = "true";
        toggleVehicle(form);
      }
    }
  }
  function renderAll() {
    if ($("#featured-cars")) {
      const featured = cars.filter(
        (c) => c.featured && c.status === "Available",
      );
      const list = [
        ...featured,
        ...cars.filter(
          (c) => c.status === "Available" && !featured.includes(c),
        ),
      ];
      $("#featured-cars").innerHTML = list.length
        ? list.slice(0, 4).map(card).join("")
        : '<div class="empty"><h2>A new drive is on its way.</h2><p>Contact our team for the latest availability.</p></div>';
    }
    if ($("#brand-list"))
      $("#brand-list").innerHTML = [...new Set(cars.map((c) => c.make))]
        .sort()
        .map(
          (make) =>
            `<a href="cars.html?make=${encodeURIComponent(make)}">${esc(make)}<small>${cars.filter((c) => c.make === make).length} listed</small></a>`,
        )
        .join("");
    populateFilters();
    renderResults();
    $$("[data-vehicle-select]").forEach((select) => {
      const old = select.value;
      select.replaceChildren(
        new Option("Not decided yet", ""),
        ...cars
          .filter((c) => c.status === "Available")
          .map((c) => new Option(`${title(c)} (${c.id})`, c.id)),
      );
      select.value = old;
    });
    renderDetail();
  }
  function loadJSONP() {
    return new Promise((resolve, reject) => {
      const callback = `alzaad_cb_${uid().replace(/-/g, "")}`,
        script = document.createElement("script");
      const cleanup = () => {
        clearTimeout(timer);
        script.remove();
        delete window[callback];
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error("Inventory request timed out."));
      }, 20000);
      window[callback] = (data) => {
        cleanup();
        data?.ok && Array.isArray(data.cars)
          ? resolve(data.cars)
          : reject(new Error("Inventory unavailable."));
      };
      script.onerror = () => {
        cleanup();
        reject(new Error("Inventory request failed."));
      };
      script.src = `${cfg.apiUrl}?action=inventory&callback=${callback}&t=${Date.now()}`;
      document.head.appendChild(script);
    });
  }
  const CACHE_KEY = "alzaad_inventory_cache_v2";
  function getCachedCars() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.cars) && parsed.cars.length > 0) {
        return parsed;
      }
    } catch (_) { }
    return null;
  }
  function setCachedCars(carsList) {
    try {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          timestamp: Date.now(),
          cars: carsList,
        }),
      );
    } catch (_) { }
  }
  async function loadCars() {
    if (busy) return;
    busy = true;
    try {
      if (cfg.demoMode) {
        cars = window.DEMO_CARS;
        notice(
          "Preview catalogue · Sample listings and representative photos. These are not confirmed Al Zaad stock.",
        );
        if (!loaded) {
          syncForm();
          loaded = true;
        }
        renderAll();
      } else {
        if (!apiConfigured) throw new Error("Not configured");

        // 1. FAST PATH: Instant display from localStorage cache (<10ms)
        const cached = getCachedCars();
        if (cached && cached.cars && cached.cars.length > 0) {
          cars = cached.cars;
          if (!loaded) {
            syncForm();
            loaded = true;
          }
          renderAll();
          notice("");
        }

        // 2. BACKGROUND REVALIDATION: Fetch fresh data from Apps Script
        try {
          const freshCars = (await loadJSONP()).filter(
            (c) =>
              c &&
              c.id &&
              c.make &&
              c.model &&
              ["Available", "Reserved", "Sold"].includes(c.status),
          );

          const changed =
            !cached ||
            JSON.stringify(freshCars) !== JSON.stringify(cached.cars);

          if (changed && freshCars.length > 0) {
            cars = freshCars;
            setCachedCars(cars);
            if (!loaded) {
              syncForm();
              loaded = true;
            }
            renderAll();
          }
          notice("");
        } catch (fetchErr) {
          // If network failed but we had cached cars, keep showing them!
          if (!cars || cars.length === 0) {
            throw fetchErr;
          }
        }
      }
    } catch (_) {
      if (!cars || cars.length === 0) {
        cars = [];
        renderAll();
        notice(
          "The live collection is temporarily unavailable. Please call or WhatsApp us to confirm stock.",
        );
        if ($("#result-count"))
          $("#result-count").textContent = "Inventory unavailable";
        const root = $("#all-cars") || $("#featured-cars") || $("#car-detail");
        if (root)
          root.innerHTML =
            '<div class="empty"><h2>Let’s check for you.</h2><p>We couldn’t load the latest inventory.</p><button type="button" id="retry-inventory" class="button primary">Try again</button></div>';
        $("#retry-inventory")?.addEventListener("click", loadCars);
      }
    } finally {
      busy = false;
    }
  }
  if (filters) {
    if (filters.elements.make) {
      filters.elements.make.addEventListener("change", () => {
        if (filters.elements.model) filters.elements.model.value = "";
        populateFilters();
      });
    }
    const moreBtn = $("#more-filters-btn");
    const morePanel = $("#more-filters-panel");
    if (moreBtn && morePanel) {
      moreBtn.addEventListener("click", () => {
        const expanded = moreBtn.getAttribute("aria-expanded") === "true";
        moreBtn.setAttribute("aria-expanded", String(!expanded));
        morePanel.hidden = expanded;
      });
    }
    if ($("#all-cars")) {
      filters.addEventListener("change", (e) => {
        if (e.target.name === "make") {
          if (filters.elements.model) filters.elements.model.value = "";
          populateFilters();
        }
        activeFilters = Object.fromEntries(new FormData(filters));
        visibleCount = 9;
        const query = new URLSearchParams(
          Object.entries(activeFilters).filter(([, v]) => v),
        );
        history.replaceState(
          null,
          "",
          `${location.pathname}${query.size ? "?" + query : ""}`,
        );
        renderResults();
      });
      filters.addEventListener("submit", (e) => {
        e.preventDefault();
        activeFilters = Object.fromEntries(new FormData(filters));
        visibleCount = 9;
        const query = new URLSearchParams(
          Object.entries(activeFilters).filter(([, v]) => v),
        );
        history.replaceState(
          null,
          "",
          `${location.pathname}${query.size ? "?" + query : ""}`,
        );
        renderResults();
      });
      filters.addEventListener("reset", () => {
        setTimeout(() => {
          activeFilters = {};
          populateFilters();
          visibleCount = 9;
          history.replaceState(null, "", location.pathname);
          renderResults();
        }, 0);
      });
        $("#sort")?.addEventListener("change", renderResults);
        $("#load-more")?.addEventListener("click", () => {
          visibleCount += 9;
          renderResults();
        });
      }
  }
    function toggleVehicle(form) {
      const enabled = ["Sell", "Trade"].includes(form.elements.type.value);
      $(".vehicle-fields", form).hidden = !enabled;
      $$("input", $(".vehicle-fields", form)).forEach((input) => {
        input.disabled = !enabled;
        input.required =
          enabled &&
          [
            "vehicleMake",
            "vehicleModel",
            "vehicleYear",
            "vehicleMileage",
            "expectedPrice",
          ].includes(input.name);
      });
    }
    function resetRequest(form) {
      form.elements.requestId.value = uid();
      form.elements.startedAt.value = String(Date.now());
    }
    $$("[data-enquiry]").forEach((form) => {
      resetRequest(form);
      toggleVehicle(form);
      form.elements.type.addEventListener("change", () => toggleVehicle(form));
      form.addEventListener("input", () => {
        form.elements.requestId.value = uid();
      });
      if (!cfg.demoMode && apiConfigured) {
        form.action = cfg.apiUrl;
        $("button[type=submit]", form).disabled = false;
        $(".form-note", form).textContent = "";
      }
      form.addEventListener("submit", (e) => {
        if (cfg.demoMode || !apiConfigured) {
          e.preventDefault();
          return;
        }
        if (
          cfg.turnstileSiteKey &&
          !new FormData(form).get("cf-turnstile-response")
        ) {
          e.preventDefault();
          $(".form-status", form).textContent =
            "Please complete the anti-spam check.";
          return;
        }
        $(".form-status", form).textContent =
          "The confirmation opens in a new tab. Check that receipt to confirm whether your enquiry was saved.";
        // Native HTTPS form POST: the Google receipt is authoritative; no opaque fetch success claims.
        setTimeout(() => {
          if (window.turnstile && form.dataset.widget)
            window.turnstile.reset(form.dataset.widget);
        }, 1500);
      });
    });
    function setIntentFromHash() {
      if (document.body.dataset.page !== "services") return;
      const form = $("[data-enquiry]");
      if (["#sell", "#trade"].includes(location.hash)) {
        form.elements.type.value = location.hash === "#trade" ? "Trade" : "Sell";
        toggleVehicle(form);
      }
    }
    setIntentFromHash();
    window.addEventListener("hashchange", setIntentFromHash);
    if (cfg.turnstileSiteKey && !cfg.demoMode && apiConfigured) {
      window.alzaadTurnstileReady = () => {
        $$("[data-enquiry]").forEach((form) => {
          form.dataset.widget = window.turnstile.render(
            $(".captcha-slot", form),
            { sitekey: cfg.turnstileSiteKey, theme: "light" },
          );
        });
      };
      const script = document.createElement("script");
      script.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=alzaadTurnstileReady&render=explicit";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    const needsInventory = Boolean(
      $("#all-cars") ||
      $("#featured-cars") ||
      $("#car-detail") ||
      $("[data-vehicle-select]"),
    );
    if (needsInventory) {
      loadCars();
      if (!cfg.demoMode) {
        setInterval(
          () => {
            if (document.visibilityState === "visible") loadCars();
          },
          Math.max(60, cfg.refreshSeconds) * 1000,
        );
      }
    } else if (!cfg.demoMode && apiConfigured && !getCachedCars()) {
      // Warm cache in background so clicking "All cars" opens instantly
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(() => loadCars(), { timeout: 3000 });
      } else {
        setTimeout(loadCars, 2000);
      }
    }
  }) ();
