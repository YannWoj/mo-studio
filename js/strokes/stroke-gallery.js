"use strict";

const STROKE_SVG_VIEWBOX = "0 0 1024 1024";
let strokeGalleryObserver = null;
let strokeFocusState = null;

function strokeGallerySettings() {
   if (!db.settings.strokeGallery || typeof db.settings.strokeGallery !== "object") {
      db.settings.strokeGallery = {
         showFuture: true,
         showGrid: true,
         showGhost: false,
      };
   } else {
      if (typeof db.settings.strokeGallery.showFuture !== "boolean")
         db.settings.strokeGallery.showFuture = true;
      if (typeof db.settings.strokeGallery.showGrid !== "boolean")
         db.settings.strokeGallery.showGrid = true;
      if (typeof db.settings.strokeGallery.showGhost !== "boolean")
         db.settings.strokeGallery.showGhost = false;
   }
   return db.settings.strokeGallery;
}

function strokeGridSvg() {
   return (
      '<g class="stroke-grid-lines" aria-hidden="true">' +
      '<rect x="16" y="16" width="992" height="992" rx="24"></rect>' +
      '<path d="M16 512H1008 M512 16V1008 M16 16L1008 1008 M1008 16L16 1008"></path>' +
      "</g>"
   );
}

function strokePathsSvg(data, activeIndex, settings) {
   const parts = [];
   if (settings.showGhost) {
      data.strokes.forEach((path) => {
         parts.push('<path class="stroke-path stroke-ghost" d="' + esc(path) + '"></path>');
      });
   }
   data.strokes.forEach((path, index) => {
      if (index < activeIndex) {
         parts.push('<path class="stroke-path stroke-complete" data-path-index="' + index + '" d="' + esc(path) + '"></path>');
      } else if (index === activeIndex) {
         parts.push('<path class="stroke-path stroke-current" data-path-index="' + index + '" d="' + esc(path) + '"></path>');
      } else if (settings.showFuture) {
         parts.push('<path class="stroke-path stroke-future" data-path-index="' + index + '" d="' + esc(path) + '"></path>');
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

function updateStrokeGalleryPosition(gallery, indicator) {
   if (!gallery || !indicator) return;
   const center = gallery.scrollLeft + gallery.clientWidth / 2;
   let closest = 0;
   let distance = Infinity;
   gallery.querySelectorAll(".stroke-panel").forEach((panel, index) => {
      const panelCenter = panel.offsetLeft + panel.offsetWidth / 2;
      const nextDistance = Math.abs(panelCenter - center);
      if (nextDistance < distance) {
         distance = nextDistance;
         closest = index;
      }
   });
   indicator.textContent = `${closest + 1} / ${gallery.children.length}`;
}

function renderStrokeGallery(data) {
   const gallery = $("dd-gallery");
   const status = $("dd-gallery-status");
   if (!gallery || !status) return;
   if (strokeGalleryObserver) strokeGalleryObserver.disconnect();
   strokeGalleryObserver = null;
   const settings = strokeGallerySettings();
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
         { root: gallery, rootMargin: "240px" },
      );
      panels.slice(8).forEach((panel) => strokeGalleryObserver.observe(panel));
   }
   const indicator = $("dd-gallery-position");
   gallery.onscroll = () => updateStrokeGalleryPosition(gallery, indicator);
   updateStrokeGalleryPosition(gallery, indicator);
}

function renderStrokeGalleryError(character, error) {
   const gallery = $("dd-gallery");
   const status = $("dd-gallery-status");
   if (status) status.textContent = `${character} · données de traits indisponibles`;
   if (gallery) {
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
