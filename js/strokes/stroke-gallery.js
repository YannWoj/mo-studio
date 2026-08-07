"use strict";

const STROKE_SVG_VIEWBOX = "0 0 1024 1024";
let strokeGalleryObserver = null;
let strokeFocusState = null;

function strokeGallerySettings() {
   if (!db.settings.strokeGallery || typeof db.settings.strokeGallery !== "object")
      db.settings.strokeGallery = {};
   const settings = db.settings.strokeGallery;
   delete settings.showGhost;
   if (typeof settings.showFuture !== "boolean") settings.showFuture = true;
   if (typeof settings.showGrid !== "boolean") settings.showGrid = true;
   if (typeof settings.highlightRadical !== "boolean") settings.highlightRadical = false;
   return settings;
}

function strokeGridSvg() {
   return (
      '<g class="stroke-grid-lines" aria-hidden="true">' +
      '<rect class="stroke-grid-border" x="16" y="16" width="992" height="992" rx="24"></rect>' +
      '<path class="stroke-grid-center" d="M16 512H1008 M512 16V1008"></path>' +
      '<path class="stroke-grid-diagonal" d="M16 16L1008 1008 M1008 16L16 1008"></path>' +
      "</g>"
   );
}

function strokePathsSvg(data, activeIndex, settings) {
   const parts = [];
   const radicalIndexes = new Set(data.radicalStrokeIndexes || []);
   data.strokes.forEach((path, index) => {
      const radical = settings.highlightRadical && radicalIndexes.has(index);
      const radicalClass = radical ? " stroke-radical" : "";
      const radicalAttribute = radical ? ' data-radical-stroke="true"' : "";
      if (index < activeIndex) {
         parts.push('<path class="stroke-path stroke-complete' + radicalClass + '" data-path-index="' + index + '"' + radicalAttribute + ' d="' + esc(path) + '"></path>');
      } else if (index === activeIndex) {
         parts.push('<path class="stroke-path stroke-current' + radicalClass + '" data-path-index="' + index + '"' + radicalAttribute + ' d="' + esc(path) + '"></path>');
      } else if (settings.showFuture) {
         parts.push('<path class="stroke-path stroke-future' + radicalClass + '" data-path-index="' + index + '"' + radicalAttribute + ' d="' + esc(path) + '"></path>');
      }
   });
   return '<g transform="translate(0 900) scale(1 -1)">' + parts.join("") + "</g>";
}

function strokePanelSvg(data, activeIndex, settings, labelledBy) {
   return (
      '<svg class="stroke-panel-svg" viewBox="' + STROKE_SVG_VIEWBOX + '" role="img" aria-labelledby="' +
      esc(labelledBy) + '">' +
      (settings.showGrid ? strokeGridSvg() : "") +
      strokePathsSvg(data, activeIndex, settings) +
      "</svg>"
   );
}

function materializeStrokePanel(panel, data, settings) {
   if (!panel || panel.dataset.rendered === "true") return;
   const index = Number(panel.dataset.strokeIndex);
   const labelId = panel.querySelector(".stroke-panel-label").id;
   panel.querySelector(".stroke-panel-visual").innerHTML = strokePanelSvg(
      data,
      index,
      settings,
      labelId,
   );
   panel.dataset.rendered = "true";
}

function closeStrokeFocus() {
   if (!strokeFocusState) return;
   const { root, opener, sheetWasInert } = strokeFocusState;
   strokeFocusState = null;
   root.remove();
   $("sheet").inert = sheetWasInert;
   document.body.style.overflow = sheetOpen() || seq ? "hidden" : "";
   if (opener && opener.isConnected) opener.focus();
}

function updateStrokeFocus(index) {
   if (!strokeFocusState) return;
   const state = strokeFocusState;
   state.index = Math.max(0, Math.min(index, state.data.strokeCount - 1));
   const number = state.index + 1;
   const label = `Trait ${number} sur ${state.data.strokeCount}`;
   state.root.querySelector(".stroke-focus-title").textContent =
      `${state.data.character} · ${label}`;
   state.root.querySelector(".stroke-focus-visual").innerHTML = strokePanelSvg(
      state.data,
      state.index,
      state.settings,
      "stroke-focus-title",
   );
   state.root.querySelector(".stroke-focus-position").textContent =
      `${number} / ${state.data.strokeCount}`;
   state.root.querySelector(".stroke-focus-prev").disabled = state.index === 0;
   state.root.querySelector(".stroke-focus-next").disabled =
      state.index === state.data.strokeCount - 1;
}

function openStrokeFocus(data, index, settings, opener) {
   closeStrokeFocus();
   const sheetWasInert = $("sheet").inert;
   $("sheet").inert = true;
   const root = document.createElement("div");
   root.className = "stroke-focus-backdrop";
   root.innerHTML =
      '<section class="stroke-focus" role="dialog" aria-modal="true" aria-labelledby="stroke-focus-title">' +
      '<header><h3 class="stroke-focus-title" id="stroke-focus-title"></h3>' +
      '<button class="stroke-focus-close" type="button" aria-label="Fermer la vue agrandie">×</button></header>' +
      '<div class="stroke-focus-visual"></div>' +
      '<footer><button class="btn ghost stroke-focus-prev" type="button">← Trait précédent</button>' +
      '<span class="stroke-focus-position" aria-live="polite"></span>' +
      '<button class="btn primary stroke-focus-next" type="button">Trait suivant →</button></footer></section>';
   document.body.appendChild(root);
   document.body.style.overflow = "hidden";
   strokeFocusState = { root, data, index, settings, opener, sheetWasInert };
   root.querySelector(".stroke-focus-close").onclick = closeStrokeFocus;
   root.querySelector(".stroke-focus-prev").onclick = () =>
      updateStrokeFocus(strokeFocusState.index - 1);
   root.querySelector(".stroke-focus-next").onclick = () =>
      updateStrokeFocus(strokeFocusState.index + 1);
   root.onclick = (event) => {
      if (event.target === root) closeStrokeFocus();
   };
   updateStrokeFocus(index);
   root.querySelector(".stroke-focus-close").focus();
}

function renderStrokeGallery(data) {
   const gallery = $("dd-gallery");
   const status = $("dd-gallery-status");
   if (!gallery || !status) return;
   if (strokeGalleryObserver) strokeGalleryObserver.disconnect();
   strokeGalleryObserver = null;
   const settings = strokeGallerySettings();
   const radicalToggle = $("dd-highlight-radical");
   if (radicalToggle) {
      const available = Array.isArray(data.radicalStrokeIndexes) && data.radicalStrokeIndexes.length > 0;
      radicalToggle.disabled = !available;
      radicalToggle.checked = available && settings.highlightRadical;
      const label = radicalToggle.closest("label");
      if (label) {
         label.classList.toggle("is-unavailable", !available);
         label.title = available
            ? "Mettre les traits de la clé en évidence"
            : "Aucun trait de clé indiqué par Hanzi Writer";
      }
   }
   gallery.classList.remove("is-loading");
   gallery.setAttribute("aria-busy", "false");
   gallery.onscroll = null;
   status.textContent = `${data.character} · ${data.strokeCount} traits réels`;
   gallery.innerHTML = Array.from({ length: data.strokeCount }, (_, index) => {
      const number = index + 1;
      const labelId = `stroke-panel-label-${number}`;
      return (
         '<button class="stroke-panel" type="button" data-stroke-index="' + index +
         '" data-rendered="false" aria-label="Agrandir : Trait ' + number + " sur " + data.strokeCount + '">' +
         '<span class="stroke-panel-number" aria-hidden="true">' + number + "</span>" +
         '<span class="stroke-panel-visual" aria-hidden="true"></span>' +
         '<span class="stroke-panel-label" id="' + labelId + '">Trait ' + number + " sur " + data.strokeCount + "</span>" +
         "</button>"
      );
   }).join("");

   const panels = Array.from(gallery.querySelectorAll(".stroke-panel"));
   panels.forEach((panel, index) => {
      panel.onclick = () => openStrokeFocus(data, index, settings, panel);
      if (index < 8 || !("IntersectionObserver" in window)) {
         materializeStrokePanel(panel, data, settings);
      }
   });
   if ("IntersectionObserver" in window && panels.length > 8) {
      strokeGalleryObserver = new IntersectionObserver(
         (entries) => entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            materializeStrokePanel(entry.target, data, settings);
            strokeGalleryObserver.unobserve(entry.target);
         }),
         { root: null, rootMargin: "240px" },
      );
      panels.slice(8).forEach((panel) => strokeGalleryObserver.observe(panel));
   }
}

function renderStrokeGalleryError(character, error) {
   const gallery = $("dd-gallery");
   const status = $("dd-gallery-status");
   if (status) status.textContent = `${character} · données de traits indisponibles`;
   if (gallery) {
      gallery.classList.remove("is-loading");
      gallery.setAttribute("aria-busy", "false");
      gallery.innerHTML =
         '<div class="stroke-gallery-error" role="alert">Aucune galerie inventée : ' +
         esc(error && error.message ? error.message : "données réelles introuvables") +
         ".</div>";
   }
}

document.addEventListener(
   "keydown",
   (event) => {
      if (!strokeFocusState) return;
      if (event.key === "Escape") {
         event.preventDefault();
         event.stopImmediatePropagation();
         closeStrokeFocus();
      } else if (event.key === "ArrowLeft") {
         event.preventDefault();
         event.stopImmediatePropagation();
         updateStrokeFocus(strokeFocusState.index - 1);
      } else if (event.key === "ArrowRight") {
         event.preventDefault();
         event.stopImmediatePropagation();
         updateStrokeFocus(strokeFocusState.index + 1);
      }
   },
   true,
);
