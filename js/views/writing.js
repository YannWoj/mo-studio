"use strict";

/* ================= tableau d'écriture (写) ================= */
const WRITING_GRIDS = ["blank", "square", "tian", "mi"];
const WRITING_COLORS = ["#17140f", "#9e2b25", "#2e6b57", "#2f5480"];
let writingResizeObserver = null;
let writingRenderFrame = 0;
let writingPointerId = null;
let writingState = {
   mode: "free",
   word: "",
   characters: [],
   index: 0,
   tool: "pen",
   free: { actions: [], redo: [] },
   practice: {},
};

function writingPreferences() {
   const prefs = db.settings.writingBoard || {};
   prefs.color = /^#[0-9a-f]{6}$/i.test(prefs.color || "")
      ? prefs.color
      : "#17140f";
   prefs.width = Math.max(1, Math.min(24, Number(prefs.width) || 5));
   prefs.grid = WRITING_GRIDS.includes(prefs.grid) ? prefs.grid : "tian";
   prefs.opacity = Math.max(0.04, Math.min(0.45, Number(prefs.opacity) || 0.18));
   prefs.modelVisible = prefs.modelVisible !== false;
   db.settings.writingBoard = prefs;
   return prefs;
}

function saveWritingPreferences() {
   writingPreferences();
   save();
}

function writingDrawingKey() {
   const character = writingState.characters[writingState.index] || "";
   return writingState.word + "§" + writingState.index + "§" + character;
}

function writingDrawingSlot() {
   if (writingState.mode === "free") return writingState.free;
   const key = writingDrawingKey();
   if (!writingState.practice[key])
      writingState.practice[key] = { actions: [], redo: [] };
   return writingState.practice[key];
}

function writingChevron(direction) {
   const path =
      direction === "left" ? "M14.5 6.5 9 12l5.5 5.5" : "M9.5 6.5 15 12l-5.5 5.5";
   return (
      '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="' +
      path +
      '"></path></svg>'
   );
}

function writingModeHtml() {
   return (
      '<div class="writing-modes" role="group" aria-label="Mode du tableau">' +
      '<button class="writing-mode" type="button" data-writing-mode="free" aria-pressed="' +
      String(writingState.mode === "free") +
      '"><span>白</span><b>Tableau libre</b></button>' +
      '<button class="writing-mode" type="button" data-writing-mode="practice" aria-pressed="' +
      String(writingState.mode === "practice") +
      '"><span>习</span><b>Entraînement</b></button></div>'
   );
}

function writingPracticeHtml(prefs) {
   if (writingState.mode !== "practice") return "";
   const hasCharacters = writingState.characters.length > 0;
   const character = hasCharacters ? writingState.characters[writingState.index] : "";
   return (
      '<section class="writing-practice-controls" aria-label="Mot à écrire">' +
      '<form class="writing-word-form" id="writing-word-form"><label for="writing-word">Caractère ou mot</label>' +
      '<div><input class="search" id="writing-word" value="' +
      esc(writingState.word) +
      '" placeholder="Ex. 你好" autocomplete="off" inputmode="text">' +
      '<button class="btn primary" type="submit">Afficher</button></div></form>' +
      (hasCharacters
         ? '<div class="writing-character-nav" id="writing-character-nav" aria-label="Glisser ou utiliser les chevrons pour changer de caractère">' +
           '<button class="character-nav-button" id="writing-prev" type="button" aria-label="Caractère précédent"' +
           (writingState.index <= 0 ? " disabled" : "") +
           ">" + writingChevron("left") + "</button>" +
           '<strong id="writing-position" role="status" aria-live="polite">' +
           esc(character) +
           " · " +
           (writingState.index + 1) +
           " / " +
           writingState.characters.length +
           "</strong>" +
           '<button class="character-nav-button" id="writing-next" type="button" aria-label="Caractère suivant"' +
           (writingState.index >= writingState.characters.length - 1 ? " disabled" : "") +
           ">" + writingChevron("right") + "</button></div>" +
           '<div class="writing-model-controls"><label class="ck"><input type="checkbox" id="writing-model-visible"' +
           (prefs.modelVisible ? " checked" : "") +
           '> Afficher le modèle</label><label for="writing-opacity">Opacité <output id="writing-opacity-value">' +
           Math.round(prefs.opacity * 100) +
           '%</output></label><input id="writing-opacity" type="range" min="4" max="45" step="1" value="' +
           Math.round(prefs.opacity * 100) +
           '"></div>'
         : '<p class="writing-practice-empty">Choisis un caractère ou un mot pour afficher un modèle en transparence.</p>') +
      "</section>"
   );
}

function writingGridButtonsHtml(prefs) {
   const labels = {
      blank: "Feuille blanche",
      square: "Grille carrée",
      tian: "田字格",
      mi: "米字格",
   };
   return WRITING_GRIDS.map(
      (grid) =>
         '<button class="writing-grid-option" type="button" data-writing-grid="' +
         grid +
         '" aria-pressed="' +
         String(prefs.grid === grid) +
         '"><span class="writing-grid-preview" data-grid-preview="' +
         grid +
         '" aria-hidden="true"></span><span class="writing-grid-name">' +
         labels[grid] +
         "</span></button>",
   ).join("");
}

function writingGridSelectorHtml(prefs) {
   return (
      '<section class="writing-grid-selector" aria-labelledby="writing-grid-title">' +
      '<div class="writing-grid-selector-head"><h3 id="writing-grid-title">Grille du papier</h3><span>Le dessin reste intact</span></div>' +
      '<div class="writing-grid-options">' +
      writingGridButtonsHtml(prefs) +
      "</div></section>"
   );
}

function writingToolbarHtml(prefs) {
   return (
      '<section class="writing-tools" aria-label="Outils de dessin"><div class="writing-tool-row writing-ink-tools">' +
      '<div class="writing-colors" role="group" aria-label="Couleur du trait">' +
      WRITING_COLORS.map(
         (color) =>
            '<button class="writing-color" type="button" data-writing-color="' +
            color +
            '" aria-label="Choisir la couleur ' +
            color +
            '" aria-pressed="' +
            String(prefs.color.toLowerCase() === color) +
            '" style="--writing-color:' +
            color +
            '"></button>',
      ).join("") +
      '<label class="writing-color-custom" title="Couleur personnalisée"><span>Couleur</span><input id="writing-color" type="color" value="' +
      esc(prefs.color) +
      '"></label></div>' +
      '<label class="writing-width" for="writing-width">Épaisseur <output id="writing-width-value">' +
      prefs.width +
      ' px</output><input id="writing-width" type="range" min="1" max="24" step="1" value="' +
      prefs.width +
      '"></label></div>' +
      '<div class="writing-tool-row writing-action-tools" role="group" aria-label="Actions du tableau">' +
      '<button class="btn sm writing-tool" id="writing-pen" type="button" aria-pressed="' +
      String(writingState.tool === "pen") +
      '">Pinceau</button><button class="btn sm writing-tool" id="writing-eraser" type="button" aria-pressed="' +
      String(writingState.tool === "eraser") +
      '">Gomme</button><button class="btn sm" id="writing-undo" type="button">Annuler</button>' +
      '<button class="btn sm" id="writing-redo" type="button">Rétablir</button>' +
      '<button class="btn sm danger" id="writing-clear" type="button">Tout effacer</button>' +
      '<button class="btn sm ghost writing-fullscreen-button" id="writing-fullscreen" type="button">Plein écran</button></div></section>'
   );
}

function renderWriting() {
   document.body.classList.remove("in-seq");
   destroyWritingBoard();
   const prefs = writingPreferences();
   const character = writingState.characters[writingState.index] || "";
   $("view").innerHTML =
      '<section class="writing-page" aria-labelledby="writing-title"><header class="writing-header"><div class="writing-mark">写</div><div><h2 class="v-t" id="writing-title">写 · Écrire</h2><p class="muted">Un papier d\'entraînement toujours prêt, à la souris, au toucher ou au stylet.</p></div></header>' +
      writingModeHtml() +
      writingPracticeHtml(prefs) +
      '<section class="card writing-workspace" id="writing-workspace">' +
      writingToolbarHtml(prefs) +
      '<div class="writing-surface" id="writing-surface" data-grid="' +
      prefs.grid +
      '"><div class="writing-model" id="writing-model" aria-hidden="true" style="opacity:' +
      prefs.opacity +
      '"' +
      (writingState.mode === "practice" && character && prefs.modelVisible ? "" : " hidden") +
      ">" +
      esc(character) +
      '</div><canvas id="writing-canvas" aria-label="Zone de dessin" tabindex="0"></canvas></div>' +
      writingGridSelectorHtml(prefs) +
      '<p class="writing-note">Le tracé reste sur cet appareil pendant cette visite. Aucune reconnaissance d’écriture n’est effectuée.</p></section></section>';
   wireWritingView();
}

function setWritingCharacters(value) {
   const visible = String(value || "").trim();
   const characters = Array.from(visible).filter((character) => HAN_PATTERN.test(character));
   if (!characters.length) {
      toast("Entre au moins un caractère chinois.");
      return false;
   }
   writingState.word = visible;
   writingState.characters = characters;
   writingState.index = 0;
   return true;
}

function openWritingWord(value) {
   if (!setWritingCharacters(value)) return;
   writingState.mode = "practice";
   closeSheet();
   setView("write");
}

function moveWritingCharacter(delta) {
   const next = writingState.index + delta;
   if (next < 0 || next >= writingState.characters.length) return;
   writingState.index = next;
   renderWriting();
}

function wireWritingSwipe() {
   const target = $("writing-character-nav");
   if (!target) return;
   let start = null;
   target.addEventListener("pointerdown", (event) => {
      if (event.target.closest("button")) return;
      start = { x: event.clientX, y: event.clientY, id: event.pointerId };
   });
   target.addEventListener("pointerup", (event) => {
      if (!start || event.pointerId !== start.id) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      start = null;
      if (Math.abs(dx) < 34 || Math.abs(dx) <= Math.abs(dy)) return;
      moveWritingCharacter(dx < 0 ? 1 : -1);
   });
   target.addEventListener("pointercancel", () => (start = null));
}

function wireWritingView() {
   document.querySelectorAll("[data-writing-mode]").forEach((button) => {
      button.onclick = () => {
         writingState.mode = button.dataset.writingMode;
         renderWriting();
      };
   });
   if ($("writing-word-form"))
      $("writing-word-form").onsubmit = (event) => {
         event.preventDefault();
         if (setWritingCharacters($("writing-word").value)) renderWriting();
      };
   if ($("writing-prev")) $("writing-prev").onclick = () => moveWritingCharacter(-1);
   if ($("writing-next")) $("writing-next").onclick = () => moveWritingCharacter(1);
   wireWritingSwipe();

   document.querySelectorAll("[data-writing-color]").forEach((button) => {
      button.onclick = () => {
         const prefs = writingPreferences();
         prefs.color = button.dataset.writingColor;
         writingState.tool = "pen";
         saveWritingPreferences();
         renderWriting();
      };
   });
   $("writing-color").oninput = (event) => {
      writingPreferences().color = event.target.value;
      writingState.tool = "pen";
      saveWritingPreferences();
      document.querySelectorAll("[data-writing-color]").forEach((button) =>
         button.setAttribute("aria-pressed", "false"),
      );
      updateWritingToolState();
   };
   $("writing-width").oninput = (event) => {
      writingPreferences().width = Number(event.target.value);
      $("writing-width-value").textContent = event.target.value + " px";
      saveWritingPreferences();
   };
   document.querySelectorAll("[data-writing-grid]").forEach((button) => {
      button.onclick = () => {
         const prefs = writingPreferences();
         prefs.grid = button.dataset.writingGrid;
         saveWritingPreferences();
         $("writing-surface").dataset.grid = prefs.grid;
         document.querySelectorAll("[data-writing-grid]").forEach((item) =>
            item.setAttribute("aria-pressed", String(item === button)),
         );
      };
   });
   if ($("writing-model-visible"))
      $("writing-model-visible").onchange = (event) => {
         writingPreferences().modelVisible = event.target.checked;
         saveWritingPreferences();
         $("writing-model").hidden = !event.target.checked;
      };
   if ($("writing-opacity"))
      $("writing-opacity").oninput = (event) => {
         const opacity = Number(event.target.value) / 100;
         writingPreferences().opacity = opacity;
         $("writing-opacity-value").textContent = event.target.value + "%";
         $("writing-model").style.opacity = opacity;
         saveWritingPreferences();
      };

   $("writing-pen").onclick = () => {
      writingState.tool = "pen";
      updateWritingToolState();
   };
   $("writing-eraser").onclick = () => {
      writingState.tool = "eraser";
      updateWritingToolState();
   };
   $("writing-undo").onclick = undoWritingAction;
   $("writing-redo").onclick = redoWritingAction;
   $("writing-clear").onclick = clearWritingCanvas;
   $("writing-fullscreen").onclick = toggleWritingFullscreen;
   document.addEventListener("fullscreenchange", writingFullscreenChanged);
   wireWritingCanvas();
   updateWritingToolState();
   updateWritingHistoryButtons();
}

function updateWritingToolState() {
   const pen = $("writing-pen");
   const eraser = $("writing-eraser");
   if (pen) pen.setAttribute("aria-pressed", String(writingState.tool === "pen"));
   if (eraser)
      eraser.setAttribute("aria-pressed", String(writingState.tool === "eraser"));
}

function updateWritingHistoryButtons() {
   const slot = writingDrawingSlot();
   if ($("writing-undo")) $("writing-undo").disabled = !slot.actions.length;
   if ($("writing-redo")) $("writing-redo").disabled = !slot.redo.length;
}

function undoWritingAction() {
   const slot = writingDrawingSlot();
   if (!slot.actions.length) return;
   slot.redo.push(slot.actions.pop());
   renderWritingCanvas();
   updateWritingHistoryButtons();
}

function redoWritingAction() {
   const slot = writingDrawingSlot();
   if (!slot.redo.length) return;
   slot.actions.push(slot.redo.pop());
   renderWritingCanvas();
   updateWritingHistoryButtons();
}

function clearWritingCanvas() {
   const slot = writingDrawingSlot();
   if (!slot.actions.length) return;
   slot.actions.push({ type: "clear" });
   slot.redo = [];
   renderWritingCanvas();
   updateWritingHistoryButtons();
}

function writingPoint(event, canvas) {
   const rect = canvas.getBoundingClientRect();
   return {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
      pressure:
         event.pointerType === "pen" && event.pressure > 0
            ? Math.max(0.35, event.pressure)
            : 1,
   };
}

function wireWritingCanvas() {
   const canvas = $("writing-canvas");
   const surface = $("writing-surface");
   if (!canvas || !surface) return;
   const finish = (event) => {
      if (event.pointerId !== writingPointerId) return;
      writingPointerId = null;
      try {
         canvas.releasePointerCapture(event.pointerId);
      } catch (error) {}
      updateWritingHistoryButtons();
   };
   canvas.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      event.preventDefault();
      writingPointerId = event.pointerId;
      try {
         canvas.setPointerCapture(event.pointerId);
      } catch (error) {}
      const prefs = writingPreferences();
      const slot = writingDrawingSlot();
      slot.actions.push({
         type: "stroke",
         tool: writingState.tool,
         color: prefs.color,
         width: prefs.width,
         points: [writingPoint(event, canvas)],
      });
      slot.redo = [];
      scheduleWritingCanvasRender();
   });
   canvas.addEventListener("pointermove", (event) => {
      if (event.pointerId !== writingPointerId) return;
      event.preventDefault();
      const slot = writingDrawingSlot();
      const stroke = slot.actions[slot.actions.length - 1];
      if (!stroke || stroke.type !== "stroke") return;
      const coalesced = event.getCoalescedEvents ? event.getCoalescedEvents() : [];
      const events = coalesced.length ? coalesced : [event];
      events.forEach((item) => stroke.points.push(writingPoint(item, canvas)));
      scheduleWritingCanvasRender();
   });
   canvas.addEventListener("pointerup", finish);
   canvas.addEventListener("pointercancel", finish);
   writingResizeObserver = new ResizeObserver(resizeWritingCanvas);
   writingResizeObserver.observe(surface);
   resizeWritingCanvas();
}

function resizeWritingCanvas() {
   const canvas = $("writing-canvas");
   if (!canvas) return;
   const rect = canvas.getBoundingClientRect();
   const ratio = Math.max(1, window.devicePixelRatio || 1);
   const width = Math.max(1, Math.round(rect.width * ratio));
   const height = Math.max(1, Math.round(rect.height * ratio));
   if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      renderWritingCanvas();
   }
}

function scheduleWritingCanvasRender() {
   if (writingRenderFrame) return;
   writingRenderFrame = requestAnimationFrame(() => {
      writingRenderFrame = 0;
      renderWritingCanvas();
   });
}

function drawWritingStroke(context, canvas, stroke) {
   const points = stroke.points || [];
   if (!points.length) return;
   const ratio = Math.max(1, window.devicePixelRatio || 1);
   const cssWidth = canvas.width / ratio;
   const cssHeight = canvas.height / ratio;
   context.save();
   context.globalCompositeOperation =
      stroke.tool === "eraser" ? "destination-out" : "source-over";
   context.strokeStyle = stroke.tool === "eraser" ? "rgba(0,0,0,1)" : stroke.color;
   context.fillStyle = context.strokeStyle;
   context.lineCap = "round";
   context.lineJoin = "round";
   context.lineWidth = stroke.width * (stroke.tool === "eraser" ? 2.6 : 1);
   if (points.length === 1) {
      const point = points[0];
      context.beginPath();
      context.arc(
         point.x * cssWidth,
         point.y * cssHeight,
         Math.max(0.75, context.lineWidth * point.pressure * 0.5),
         0,
         Math.PI * 2,
      );
      context.fill();
   } else {
      context.beginPath();
      context.moveTo(points[0].x * cssWidth, points[0].y * cssHeight);
      for (let index = 1; index < points.length - 1; index += 1) {
         const point = points[index];
         const next = points[index + 1];
         context.quadraticCurveTo(
            point.x * cssWidth,
            point.y * cssHeight,
            ((point.x + next.x) / 2) * cssWidth,
            ((point.y + next.y) / 2) * cssHeight,
         );
      }
      const last = points[points.length - 1];
      context.lineTo(last.x * cssWidth, last.y * cssHeight);
      context.stroke();
   }
   context.restore();
}

function renderWritingCanvas() {
   const canvas = $("writing-canvas");
   if (!canvas) return;
   const context = canvas.getContext("2d");
   const ratio = Math.max(1, window.devicePixelRatio || 1);
   context.setTransform(ratio, 0, 0, ratio, 0, 0);
   context.clearRect(0, 0, canvas.width / ratio, canvas.height / ratio);
   writingDrawingSlot().actions.forEach((action) => {
      if (action.type === "clear")
         context.clearRect(0, 0, canvas.width / ratio, canvas.height / ratio);
      else if (action.type === "stroke") drawWritingStroke(context, canvas, action);
   });
}

async function toggleWritingFullscreen() {
   const workspace = $("writing-workspace");
   if (!workspace) return;
   try {
      if (workspace.classList.contains("writing-fullscreen-fallback")) {
         workspace.classList.remove("writing-fullscreen-fallback");
         document.body.classList.remove("writing-fullscreen-open");
         writingFullscreenChanged();
      } else if (document.fullscreenElement) await document.exitFullscreen();
      else if (workspace.requestFullscreen) await workspace.requestFullscreen();
      else {
         workspace.classList.toggle("writing-fullscreen-fallback");
         document.body.classList.toggle(
            "writing-fullscreen-open",
            workspace.classList.contains("writing-fullscreen-fallback"),
         );
         writingFullscreenChanged();
      }
   } catch (error) {
      workspace.classList.add("writing-fullscreen-fallback");
      document.body.classList.add("writing-fullscreen-open");
      writingFullscreenChanged();
   }
}

function writingFullscreenChanged() {
   const button = $("writing-fullscreen");
   const workspace = $("writing-workspace");
   if (button)
      button.textContent =
         document.fullscreenElement ||
         (workspace && workspace.classList.contains("writing-fullscreen-fallback"))
            ? "Quitter le plein écran"
            : "Plein écran";
   requestAnimationFrame(resizeWritingCanvas);
}

function destroyWritingBoard() {
   if (writingResizeObserver) writingResizeObserver.disconnect();
   writingResizeObserver = null;
   if (writingRenderFrame) cancelAnimationFrame(writingRenderFrame);
   writingRenderFrame = 0;
   writingPointerId = null;
   document.removeEventListener("fullscreenchange", writingFullscreenChanged);
   document.body.classList.remove("writing-fullscreen-open");
}
