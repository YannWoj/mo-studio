"use strict";

let reviewStrokeWriter = null;
let reviewStrokeWriterTarget = null;
let reviewStrokeWriterListeners = [];
let reviewStrokeLoadToken = 0;
let reviewStrokeData = null;
let reviewStrokeTab = "animation";
let reviewStrokeExpanded = false;

function reviewHanzi(value) {
   return Array.from(String(value || "")).filter((character) =>
      /^\p{Script=Han}$/u.test(character),
   );
}

function removeReviewStrokeWriterListeners() {
   reviewStrokeWriterListeners.forEach(({ type, listener, options }) =>
      document.removeEventListener(type, listener, options),
   );
   reviewStrokeWriterListeners = [];
}

function destroyReviewStrokeWriter() {
   if (reviewStrokeWriter && typeof reviewStrokeWriter.cancelAnimation === "function") {
      try { reviewStrokeWriter.cancelAnimation(); } catch (error) {}
   }
   if (reviewStrokeWriter && typeof reviewStrokeWriter.cancelQuiz === "function") {
      try { reviewStrokeWriter.cancelQuiz(); } catch (error) {}
   }
   if (reviewStrokeWriterTarget) reviewStrokeWriterTarget.innerHTML = "";
   removeReviewStrokeWriterListeners();
   reviewStrokeWriter = null;
   reviewStrokeWriterTarget = null;
}

function destroyReviewStrokeWorkspace() {
   reviewStrokeLoadToken++;
   destroyReviewStrokeWriter();
   reviewStrokeData = null;
}

function resetReviewStrokeSession() {
   destroyReviewStrokeWorkspace();
   reviewStrokeTab = "animation";
   reviewStrokeExpanded =
      typeof matchMedia === "function" && matchMedia("(min-width: 601px)").matches;
}

function managedReviewStrokeWriter(target, character, options) {
   const captured = [];
   const originalAddEventListener = document.addEventListener;
   document.addEventListener = function (type, listener, listenerOptions) {
      if (type === "mouseup" || type === "touchend")
         captured.push({ type, listener, options: listenerOptions });
      return originalAddEventListener.call(this, type, listener, listenerOptions);
   };
   try {
      const writer = HanziWriter.create(target, character, options);
      reviewStrokeWriterListeners = captured;
      return writer;
   } catch (error) {
      captured.forEach(({ type, listener, options: listenerOptions }) =>
         document.removeEventListener(type, listener, listenerOptions),
      );
      throw error;
   } finally {
      document.addEventListener = originalAddEventListener;
   }
}

function reviewStrokeBlockHtml(c, st) {
   const characters = reviewHanzi(c.hz);
   if (!characters.length) return "";
   const selected = Math.max(0, Math.min(Number(st.strokeCharacterIndex) || 0, characters.length - 1));
   st.strokeCharacterIndex = selected;
   const pills = characters.map((character, index) =>
      '<button type="button" class="review-stroke-character" data-review-stroke-character="' + index + '" aria-pressed="' + String(index === selected) + '" aria-label="Afficher ' + esc(character) + '">' + esc(character) + "</button>",
   ).join("");
   // Le nombre de traits et les deux actions (rejouer, s'entraîner) sont
   // regroupés avec le compteur de caractères et les onglets : sur mobile, la
   // section dépliée doit tenir sur un écran sans qu'aucune information ne
   // disparaisse. Sur un mot d'un seul caractère, la rangée de navigation ne
   // porterait que deux chevrons inertes et un « 1 / 1 » : seul le nombre de
   // traits est conservé, sur une ligne.
   const single = characters.length === 1;
   return (
      '<details class="review-strokes" id="review-strokes"' + (reviewStrokeExpanded ? " open" : "") + ' data-no-session-tap>' +
      '<summary><span>Écriture du caractère</span><small>Voir l’ordre des traits</small></summary>' +
      '<div class="review-stroke-content">' +
      (single
         ? '<span class="review-stroke-meta review-stroke-meta-solo" role="status" aria-live="polite">' +
           '<span class="review-stroke-strokes" id="review-stroke-status">Chargement…</span></span>'
         : '<div class="review-stroke-character-nav">' +
           '<button type="button" class="review-stroke-chevron" id="review-stroke-character-prev" aria-label="Caractère précédent"' + (selected === 0 ? " disabled" : "") + '>‹</button>' +
           '<div class="review-stroke-characters" aria-label="Caractères du mot">' + pills + "</div>" +
           '<button type="button" class="review-stroke-chevron" id="review-stroke-character-next" aria-label="Caractère suivant"' + (selected === characters.length - 1 ? " disabled" : "") + '>›</button>' +
           '<span class="review-stroke-meta" role="status" aria-live="polite">' +
           '<span class="review-stroke-count" id="review-stroke-count">' + (selected + 1) + " / " + characters.length + "</span>" +
           '<span class="review-stroke-strokes" id="review-stroke-status">Chargement…</span></span></div>') +
      '<div class="review-stroke-actions"><div class="review-stroke-tabs" role="tablist" aria-label="Affichage de l’ordre des traits">' +
      '<button type="button" role="tab" data-review-stroke-tab="animation" aria-selected="' + String(reviewStrokeTab === "animation") + '">Animation</button>' +
      '<button type="button" role="tab" data-review-stroke-tab="steps" aria-selected="' + String(reviewStrokeTab === "steps") + '">Étapes</button></div>' +
      '<button type="button" class="stroke-icon-button" id="review-stroke-replay" aria-label="Rejouer l’animation" title="Rejouer l’animation">' + strokeReplayIconHtml() + "</button>" +
      '<button type="button" class="stroke-icon-button review-stroke-practice" id="review-stroke-practice" aria-label="S’entraîner à écrire" title="S’entraîner à écrire">' + strokeWriteIconHtml() + "</button></div>" +
      '<div class="review-stroke-panel" id="review-stroke-animation"' + (reviewStrokeTab === "animation" ? "" : " hidden") + '><div class="review-stroke-grid"><div id="review-stroke-target"></div></div></div>' +
      '<div class="review-stroke-panel" id="review-stroke-steps"' + (reviewStrokeTab === "steps" ? "" : " hidden") + '><div class="review-stroke-steps-list" id="review-stroke-steps-list" aria-label="Étapes des traits"></div></div>' +
      characterCompositionShellHtml("review-character-composition") +
      "</div></details>"
   );
}

// Depuis une séance, l'entraînement est un exercice de rappel : modèle masqué,
// consigne en pinyin, arrière-plan flouté (voir js/writing-practice-sheet.js).
function openReviewWritingPractice(c, initialIndex) {
   if (!c || typeof openWritingPracticeSheet !== "function") return;
   openWritingPracticeSheet(c.hz, { mode: "review", pinyin: c.py, initialIndex });
}

function setReviewStrokeCountLabel(text) {
   // Le compteur de traits vit désormais hors du panneau Animation : il reste
   // donc visible sous l'onglet Étapes et doit être mis à jour dans les deux cas.
   const status = $("review-stroke-status");
   if (status) status.textContent = text;
}

function renderReviewStrokeSteps(data) {
   const target = $("review-stroke-steps-list");
   if (!target || !data || typeof strokePanelSvg !== "function") return;
   target.innerHTML = Array.from({ length: data.strokeCount }, (_, index) => {
      const labelId = "review-stroke-step-label-" + index;
      return '<div class="review-stroke-step"><span class="review-stroke-step-number">' + (index + 1) + '</span><span id="' + labelId + '" class="sr-only">Trait ' + (index + 1) + " sur " + data.strokeCount + '</span>' + strokePanelSvg(data, index, { showFuture: false, showGrid: true }, labelId) + "</div>";
   }).join("");
}

function createReviewStrokeAnimation(data, autoplay) {
   destroyReviewStrokeWriter();
   const target = $("review-stroke-target");
   const status = $("review-stroke-status");
   if (!target || typeof HanziWriter === "undefined") return;
   const size = Math.min(164, target.parentElement.clientWidth || 164);
   target.style.width = size + "px";
   target.style.height = size + "px";
   reviewStrokeWriterTarget = target;
   try {
      reviewStrokeWriter = managedReviewStrokeWriter(target, data.character, {
         width: size,
         height: size,
         padding: 10,
         showCharacter: true,
         showOutline: true,
         strokeColor: "#17140F",
         outlineColor: "#CDBFA1",
         charDataLoader: () => data,
         ...(typeof speedOpts === "function" ? speedOpts(db.settings.strokeSpeed) : {}),
      });
      if (status) status.textContent = data.strokeCount + " traits";
      const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (autoplay && !reduced) reviewStrokeWriter.animateCharacter();
   } catch (error) {
      destroyReviewStrokeWriter();
      const root = $("review-strokes");
      if (root) root.hidden = true;
   }
}

async function loadReviewStrokeCharacter(character, autoplay, characters) {
   const token = ++reviewStrokeLoadToken;
   destroyReviewStrokeWriter();
   reviewStrokeData = null;
   setReviewStrokeCountLabel("Chargement…");
   setCharacterCompositionLoading(character, ".review-character-composition");
   if (typeof loadCharacterCompositions === "function") {
      loadCharacterCompositions(characters || [character]).then((compositions) => {
         if (
            token !== reviewStrokeLoadToken ||
            !$("review-strokes")?.open ||
            !session.active
         ) return;
         renderCharacterComposition(
            compositions.get(character) || null,
            ".review-character-composition",
         );
      }).catch(() => {
         if (token === reviewStrokeLoadToken)
            renderCharacterComposition(null, ".review-character-composition");
      });
   } else renderCharacterComposition(null, ".review-character-composition");
   try {
      if (typeof loadStrokeCharacterData !== "function") throw new Error("stroke data unavailable");
      const data = await loadStrokeCharacterData(character);
      if (token !== reviewStrokeLoadToken || !$("review-strokes") || !session.active) return;
      reviewStrokeData = data;
      setReviewStrokeCountLabel(data.strokeCount + " traits");
      if (reviewStrokeTab === "steps") renderReviewStrokeSteps(data);
      else createReviewStrokeAnimation(data, autoplay);
   } catch (error) {
      if (token !== reviewStrokeLoadToken) return;
      const root = $("review-strokes");
      if (root) root.hidden = true;
   }
}

function activateReviewStrokeTab(tab) {
   if (!["animation", "steps"].includes(tab)) return;
   reviewStrokeTab = tab;
   document.querySelectorAll("[data-review-stroke-tab]").forEach((button) =>
      button.setAttribute("aria-selected", String(button.dataset.reviewStrokeTab === tab)),
   );
   const animation = $("review-stroke-animation");
   const steps = $("review-stroke-steps");
   if (animation) animation.hidden = tab !== "animation";
   if (steps) steps.hidden = tab !== "steps";
   if (!reviewStrokeData) return;
   if (tab === "steps") {
      destroyReviewStrokeWriter();
      renderReviewStrokeSteps(reviewStrokeData);
   } else createReviewStrokeAnimation(reviewStrokeData, false);
}

function wireReviewStrokeBlock(c, st) {
   const root = $("review-strokes");
   if (!root) return;
   const characters = reviewHanzi(c.hz);
   const selectCharacter = (nextIndex) => {
      if (!root.isConnected) return;
      const index = Math.max(0, Math.min(nextIndex, characters.length - 1));
      st.strokeCharacterIndex = index;
      root.querySelectorAll("[data-review-stroke-character]").forEach((button) =>
         button.setAttribute("aria-pressed", String(Number(button.dataset.reviewStrokeCharacter) === index)),
      );
      const previous = root.querySelector("#review-stroke-character-prev");
      const next = root.querySelector("#review-stroke-character-next");
      const count = root.querySelector("#review-stroke-count");
      if (previous) previous.disabled = index === 0;
      if (next) next.disabled = index === characters.length - 1;
      if (count) count.textContent = (index + 1) + " / " + characters.length;
      loadReviewStrokeCharacter(characters[index], true, characters);
      if (characters[index + 1] && typeof preloadStrokeCharacterData === "function")
         preloadStrokeCharacterData(characters[index + 1]);
   };
   root.ontoggle = () => {
      if (!root.isConnected) return;
      reviewStrokeExpanded = root.open;
      if (root.open) selectCharacter(st.strokeCharacterIndex || 0);
      else destroyReviewStrokeWorkspace();
   };
   root.querySelectorAll("[data-review-stroke-character]").forEach((button) =>
      button.onclick = () => selectCharacter(Number(button.dataset.reviewStrokeCharacter)),
   );
   // absents sur un mot d'un seul caractère
   const previousCharacter = $("review-stroke-character-prev");
   const nextCharacter = $("review-stroke-character-next");
   if (previousCharacter) previousCharacter.onclick = () => selectCharacter((st.strokeCharacterIndex || 0) - 1);
   if (nextCharacter) nextCharacter.onclick = () => selectCharacter((st.strokeCharacterIndex || 0) + 1);
   root.querySelectorAll("[data-review-stroke-tab]").forEach((button) =>
      button.onclick = () => activateReviewStrokeTab(button.dataset.reviewStrokeTab),
   );
   $("review-stroke-practice").onclick = () => {
      const index = Math.max(0, Math.min(Number(st.strokeCharacterIndex) || 0, characters.length - 1));
      openReviewWritingPractice(c, index);
   };
   $("review-stroke-replay").onclick = () => {
      if (!reviewStrokeData) return;
      // le bouton partage désormais la ligne des onglets : depuis « Étapes », il
      // ramène d'abord sur l'animation plutôt que de rejouer dans un panneau masqué
      if (reviewStrokeTab !== "animation") activateReviewStrokeTab("animation");
      createReviewStrokeAnimation(reviewStrokeData, true);
   };
   if (root.open) selectCharacter(st.strokeCharacterIndex || 0);
}

/* ================= séance ================= */
         // Deux filtres, deux conflits différents.
         // TAP (retourner la carte) : le grand caractère lit son audio, la section
         // d'écriture se manipule — ni l'un ni l'autre ne doit retourner la carte.
         const SESSION_INTERACTIVE_SELECTOR =
            "button, input, select, textarea, a, label, summary, [data-say], [data-no-session-tap], .acts, .grades, .session-nav, .s-foot";
         // GESTE (changer de carte) : seuls les contrôles réellement actionnables et
         // les zones qui défilent horizontalement d'elles-mêmes bloquent un glissement.
         // Le caractère et le corps de la section d'écriture sont, eux, des zones de
         // glissement : c'est là que le pouce se pose naturellement.
         const SESSION_SWIPE_BLOCKING_SELECTOR =
            "button, input, select, textarea, a, label, summary, canvas, .mizi, " +
            ".review-stroke-characters, .review-stroke-steps-list, .composition-formula, .composition-roles";
         const SWIPE_HINT_KEY = "mo-studio-session-swipe-hint-seen-v1";
         let sessionSwipeHintSeen = (() => {
            try { return localStorage.getItem(SWIPE_HINT_KEY) === "1"; } catch (e) { return true; }
         })();
         function markSwipeHintSeen() {
            sessionSwipeHintSeen = true;
            try { localStorage.setItem(SWIPE_HINT_KEY, "1"); } catch (e) {}
         }
         const currentCard = () => session.cards[session.index];
         function getState(i) {
            if (!session.states[i])
               session.states[i] = {
                  revealed: false,
                  everRevealed: false,
                  checked: false,
                  ok: null,
                  front: null,
                  task: null,
                  traceOk: false,
                  traceReady: false,
                  skipped: false,
                  note: "",
                  grade: null,
               };
            return session.states[i];
         }
         function frontOf(c, st) {
            // recto de la carte : zh ou fr, stable pendant toute la séance
            if (st.front) return st.front;
            const d = db.settings.direction;
            st.front =
               d === "mix"
                  ? Math.random() < 0.5
                     ? "zh"
                     : "fr"
                  : d === "fr2zh"
                    ? "fr"
                    : "zh";
            return st.front;
         }
         function pickWriteTask(c, st) {
            // choisit une tâche écrite selon les réglages et le sens de révision
            const wm = db.settings.writeModes;
            const front = frontOf(c, st);
            const zhSide = front === "zh";
            const frSide = front === "fr";
            const canTrace =
               Array.from(c.hz).some((ch) => /[\u4e00-\u9fff]/.test(ch)) &&
               c.hz.length <= 3;
            const opts = [];
            if (wm.fr && zhSide) opts.push("fr");
            if (wm.pinyin && zhSide && c.py) opts.push("py-read");
            if (wm.pinyin && frSide && c.py) opts.push("py-prod");
            if (wm.trace && frSide && canTrace) opts.push("trace");
            // Garde une consigne cohérente avec le sens même lorsque les
            // préférences avancées excluent tous les exercices compatibles.
            if (!opts.length && zhSide)
               opts.push(c.fr ? "fr" : "py-read");
            if (!opts.length && frSide)
               opts.push(c.py ? "py-prod" : canTrace ? "trace" : "fr");
            return opts[Math.floor(Math.random() * opts.length)];
         }

         function exampleHtml(c) {
            return (
               '<div class="ex" data-say="' +
               esc(c.exHz) +
               '">' +
               '<div class="ex-hz">' +
               esc(c.exHz) +
               "</div>" +
               (c.exPy
                  ? '<div class="ex-py">' + colorPinyin(c.exPy) + "</div>"
                  : "") +
               (c.exFr ? '<div class="ex-fr">' + esc(c.exFr) + "</div>" : "") +
               "</div>"
            );
         }
         function noteHtml(c) {
            return c.note
               ? '<div class="note"><strong>Note ·</strong> ' + esc(c.note) + "</div>"
               : "";
         }
         function reviewFavoriteIconHtml() {
            return (
               '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
               '<path d="M12 20.3 4.7 13a4.55 4.55 0 0 1 6.44-6.43l.86.86.86-.86A4.55 4.55 0 0 1 19.3 13Z"></path>' +
               "</svg>"
            );
         }
         function reviewScheduleIconHtml() {
            return (
               '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
               '<path d="M4.5 6h15v13.5h-15zM4.5 10.5h15M8.5 3.5v5M15.5 3.5v5"></path>' +
               '<path d="M12 13v2.6l1.8 1.1"></path>' +
               "</svg>"
            );
         }
         function reviewMasteredIconHtml() {
            return (
               '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
               '<circle cx="12" cy="12" r="8.6"></circle>' +
               '<path d="m8.1 12.3 2.7 2.7 5.1-5.6"></path>' +
               "</svg>"
            );
         }
         // Actions secondaires : trois icônes compactes plutôt qu'une ligne pleine
         // largeur de boutons texte. Le favori reste bien visible, la date et la
         // maîtrise restent discrètes mais gardent un libellé accessible.
         function actionIconHtml(id, label, icon, variant, pressed) {
            return (
               '<button type="button" class="act-icon' +
               (variant ? " " + variant : "") +
               (pressed === true ? " on" : "") +
               '" id="' +
               id +
               '"' +
               (pressed == null ? "" : ' aria-pressed="' + String(pressed) + '"') +
               ' aria-label="' +
               esc(label) +
               '" title="' +
               esc(label) +
               '">' +
               icon +
               "</button>"
            );
         }
         function actionsHtml(c) {
            return (
               '<div class="acts acts-compact">' +
               actionIconHtml(
                  "a-fav",
                  c.fav ? "Retirer des favoris" : "Ajouter aux favoris",
                  reviewFavoriteIconHtml(),
                  "fav",
                  !!c.fav,
               ) +
               actionIconHtml(
                  "a-hard",
                  "Choisir la date de révision",
                  reviewScheduleIconHtml(),
                  "",
                  null,
               ) +
               actionIconHtml(
                  "a-acq",
                  c.acquired ? "Ne plus considérer comme maîtrisée" : "Marquer comme maîtrisée",
                  reviewMasteredIconHtml(),
                  "jade",
                  !!c.acquired,
               ) +
               "</div>"
            );
         }
         const inputHtml = (ph) =>
            '<div class="w-in"><input id="w-input" class="search" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="' +
            esc(ph) +
            '"></div>';

         function writtenPromptHtml(c, st) {
            const t = st.task;
            const pyLine =
               db.settings.pinyin === "always" && c.py
                  ? '<div class="pinyin">' + colorPinyin(c.py) + "</div>"
                  : "";
            if (t === "fr")
               return (
                  '<div class="w-lab">Traduis en français</div><div class="hanzi ink-in" data-say="' +
                  esc(c.hz) +
                  '">' +
                  esc(c.hz) +
                  "</div>" +
                  pyLine +
                  inputHtml("ta réponse en français")
               );
            if (t === "py-read")
               return (
                  '<div class="w-lab">Écris le pinyin</div><div class="hanzi ink-in" data-say="' +
                  esc(c.hz) +
                  '">' +
                  esc(c.hz) +
                  "</div>" +
                  inputHtml("ni3 hao3 ou nǐ hǎo")
               );
            if (t === "py-prod")
               return (
                  '<div class="w-lab">Écris le pinyin</div><div class="fr-big ink-in">' +
                  esc(c.fr) +
                  "</div>" +
                  inputHtml("ni3 hao3 ou nǐ hǎo")
               );
            return (
               '<div class="w-lab">Trace en caractères chinois</div><div class="fr-big ink-in">' +
               esc(c.fr) +
               "</div>" +
               pyLine +
               '<div class="mizi"><div id="s-writer"></div><div id="s-ghost" class="ghost" hidden>' +
               esc(c.hz) +
               '</div><canvas id="s-canvas" hidden></canvas></div>' +
               '<div class="w-note" id="s-tracenote">Trace chaque caractère, trait par trait.</div>' +
               '<div class="t-btns" id="t-btns" hidden><button class="btn" id="t-no">Raté</button><button class="btn primary" id="t-ok">Réussi</button></div>'
            );
         }

         function gradesHtml(c, options) {
            const iv = gradeIv(c);
            const b = (g, lab) =>
               '<button class="gr ' +
               g +
               '" data-grade="' +
               g +
               '">' +
               lab +
               "<small>" +
               fmtIv(iv[g]) +
               "</small></button>";
            return (
               '<div class="grades">' +
               b("again", "Raté") +
               b("hard", "Difficile") +
               b("good", "Correct") +
               b("easy", "Facile") +
               "</div>" + sessionNavigationHtml(options)
            );
         }
         // Rangée discrète : le balayage horizontal fait déjà précédent/suivant, cette
         // barre sert la découvrabilité et le desktop. En Découverte elle porte la seule
         // action d'avancement de l'écran, elle reprend donc un gabarit plein format.
         function sessionNavigationHtml(options) {
            const { flip = false, solo = false } = options || {};
            const last = session.index >= session.cards.length - 1;
            return (
               '<nav class="session-nav' + (solo ? " solo" : "") + '" aria-label="Navigation dans la séance">' +
               '<button type="button" class="session-nav-button previous" id="s-prev"' +
               (session.index === 0 ? " disabled aria-disabled=\"true\"" : "") +
               '>‹ <span>Précédent</span></button>' +
               (flip
                  ? '<button type="button" class="session-nav-button flip" id="s-flip" aria-label="Revoir le recto" title="Revoir le recto">↺ <span>Recto</span></button>'
                  : "") +
               '<button type="button" class="session-nav-button next" id="s-next"><span>' +
               (last ? "Terminer" : "Suivant") +
               "</span> ›</button></nav>"
            );
         }
         function sessionFooterHtml(c, st) {
            if (session.mode === "discover") {
               return sessionNavigationHtml({ solo: true });
            }
            if (session.mode === "cards") {
               if (!st.revealed)
                  return '<div class="s-foot"><button class="btn primary big" id="s-flip" type="button">Retourner</button></div>';
               // le bouton de retournement reste disponible au verso, mais en retrait
               // par rapport à la notation SRS pour ne jamais se substituer à elle : il
               // rejoint la rangée de navigation, sous les quatre boutons de note.
               return gradesHtml(c, { flip: true });
            }
            if (session.mode === "written" && !st.checked)
               return '<div class="s-foot"><button class="btn ghost" id="s-skip">Voir la réponse</button><button class="btn primary" id="s-check">Vérifier</button></div>';
            // verso (cartes) ou réponse vérifiée (écrit) : boutons de notation SRS
            return gradesHtml(c);
         }
         // Crayon du recto : s'entraîner avant d'avoir vu la réponse. Il n'ouvre que la
         // modale — pas de retournement, pas de changement de st.revealed.
         function sessionPracticeButtonHtml() {
            return (
               '<button type="button" class="stroke-icon-button fl-practice" id="s-practice" ' +
               'aria-label="S’entraîner à écrire" title="S’entraîner à écrire">' +
               strokeWriteIconHtml() +
               "</button>"
            );
         }
         function sessionSwipeHintHtml() {
            return (
               '<div class="session-swipe-hint" role="status" aria-live="polite">' +
               "Glisse à gauche ou à droite pour changer de carte — ça ne note rien.</div>"
            );
         }

         function renderSession() {
            cancelSessionSwipe();
            destroyReviewStrokeWorkspace();
            const c = currentCard();
            if (!c) {
               endSession();
               return;
            }
            document.body.classList.add("in-session");
            const st = getState(session.index);
            if (session.mode === "discover") st.revealed = true;
            if (session.mode === "written" && !st.task)
               st.task = pickWriteTask(c, st);
            const front = session.mode === "cards" ? frontOf(c, st) : "zh";
            // Les flashcards révèlent toujours le pinyin au verso, quel que
            // soit le sens choisi. Les autres modes conservent leur réglage.
            const showPyBack =
               session.mode === "cards" || db.settings.pinyin !== "never";
            const hideSay =
               (session.mode === "cards" && front === "fr" && !st.revealed) ||
               (session.mode === "written" && !st.checked && st.front === "fr");

            let body = "";
            if (session.mode === "written" && !st.checked) {
               body = writtenPromptHtml(c, st);
            } else if (session.mode === "cards" && !st.revealed) {
               body =
                  front === "zh"
                     ? '<div class="hanzi ink-in" data-say="' +
                       esc(c.hz) +
                       '">' +
                       esc(c.hz) +
                       "</div>" +
                       '<div class="hint">Appuie pour retourner</div>'
                     : '<div class="fr-big ink-in">' +
                       esc(c.fr) +
                       '</div><div class="hint">Appuie pour retourner</div>';
            } else {
               let verdict = "";
               if (session.mode === "written" && st.checked) {
                  const lab = st.ok
                     ? "Juste !"
                     : st.skipped
                       ? "Réponse affichée"
                       : "✗ Raté";
                  verdict =
                     '<div class="verdict ' +
                     (st.ok ? "ok" : "ko") +
                     '">' +
                     lab +
                     (st.note ? " <span>· " + esc(st.note) + "</span>" : "") +
                     "</div>";
               }
               // ordre du verso : le caractère et son pinyin, les actions secondaires
               // compactes, puis le sens, l'exemple, la note et l'écriture.
               body =
                  verdict +
                  '<div class="hanzi ink-in" data-say="' +
                  esc(c.hz) +
                  '">' +
                  esc(c.hz) +
                  "</div>" +
                  (showPyBack && c.py
                     ? '<div class="pinyin">' + colorPinyin(c.py) + "</div>"
                     : "") +
                  (session.mode === "discover" ? "" : actionsHtml(c)) +
                  (session.mode !== "cards" || front === "zh"
                     ? '<div class="sep"></div><div class="fr">' + esc(c.fr) + "</div>"
                     : "") +
                  (c.exHz ? exampleHtml(c) : "") +
                  noteHtml(c) +
                  (session.mode === "cards" ? reviewStrokeBlockHtml(c, st) : "");
            }

            const modeName = {
               cards: "Cartes",
               written: "Écrit",
               discover: "Découverte",
            }[session.mode];
            const showSwipeHint =
               session.mode === "cards" && session.index === 0 && !sessionSwipeHintSeen;
            if (showSwipeHint) markSwipeHintSeen();
            // le verso garde son propre accès dans « Écriture du caractère »
            const showPracticeButton =
               session.mode === "cards" && !st.revealed && reviewHanzi(c.hz).length > 0;
            $("view").innerHTML =
               '<section class="sess" id="sess">' +
               '<div class="s-top">' +
               '<button class="s-x" id="s-exit" aria-label="Quitter">×</button>' +
               '<div class="s-scope">' +
               esc(session.scopeLabel) +
               " · " +
               modeName +
               "</div>" +
               '<div class="s-count">' +
               (session.index + 1) +
               " / " +
               session.cards.length +
               "</div>" +
               "</div>" +
               '<div class="s-bar"><i style="width:' +
               (((session.index + 1) / session.cards.length) * 100).toFixed(1) +
               '%"></i></div>' +
               // la carte occupe toute la hauteur restante : une barre d'outils en
               // haut, puis une zone centrée qui défile d'elle-même si le verso
               // déplié dépasse — la page, elle, ne défile pas. L'astuce de balayage
               // flotte au-dessus du bas de la carte, sans rien pousser.
               '<div class="flash card" id="flash">' +
               '<div class="fl-tools">' +
               '<button class="seal fl-seal" data-say="' +
               esc(c.hz) +
               '"' +
               (hideSay ? ' style="visibility:hidden"' : "") +
               ' aria-label="Écouter">听</button>' +
               "</div>" +
               '<div class="fl-body"><div class="fl-inner">' +
               body +
               "</div></div>" +
               (showPracticeButton ? sessionPracticeButtonHtml() : "") +
               (showSwipeHint ? sessionSwipeHintHtml() : "") +
               "</div>" +
               sessionFooterHtml(c, st) +
               "</section>";
            wireSession(c, st);
            if (session.mode === "cards" && st.revealed)
               wireReviewStrokeBlock(c, st);
            persistSession();
         }

         function advance() {
            if (session.index >= session.cards.length - 1) endSession();
            else {
               session.index++;
               renderSession();
            }
         }
         function previousCard() {
            if (session.index <= 0) return;
            session.index--;
            renderSession();
         }
         const SESSION_SWIPE_LOCK_SLOP = 6;
         const SESSION_SWIPE_HORIZONTAL_RATIO = 1.18;
         const SESSION_SWIPE_DISTANCE_RATIO = 0.28;
         const SESSION_SWIPE_MIN_FLICK_DISTANCE = 28;
         const SESSION_SWIPE_FLICK_VELOCITY = 0.55;
         const SESSION_SWIPE_VELOCITY_WINDOW = 110;
         const SESSION_SWIPE_SETTLE_DURATION = 180;
         const SESSION_SWIPE_COMMIT_DURATION = 190;
         const SESSION_SWIPE_BOUNDARY_RESISTANCE = 0.28;
         const SESSION_SWIPE_ANIMATION_FALLBACK = 80;
         let sessionSwipeCleanup = null;

         function cancelSessionSwipe() {
            const cleanup = sessionSwipeCleanup;
            sessionSwipeCleanup = null;
            if (cleanup) cleanup();
         }

         function wireSessionSwipe(card) {
            // Une seule machine de geste vit sur la carte recréée par renderSession().
            // La capture n'arrive qu'après le verrou horizontal : un appui ordinaire ne
            // change donc jamais la cible du clic natif.
            if (!card || session.mode !== "cards" || !("PointerEvent" in window)) return;
            const listeners = new AbortController();
            const state = {
               pointerId: null,
               axis: "idle",
               dragging: false,
               animation: null,
               suppressNextClick: false,
               startX: 0,
               startY: 0,
               latestX: 0,
               latestY: 0,
               startTime: 0,
               latestTime: 0,
               velocityX: 0,
               samples: [],
               cardWidth: 1,
               cardIndex: -1,
               sessionCard: null,
               token: 0,
               timer: null,
               transitionHandler: null,
            };
            let disposed = false;

            const eventTime = (event) =>
               Number.isFinite(event.timeStamp) ? event.timeStamp : performance.now();
            const reducedMotion = () =>
               typeof matchMedia === "function" &&
               matchMedia("(prefers-reduced-motion: reduce)").matches;
            const clearSelection = () => {
               const selection = typeof getSelection === "function" ? getSelection() : null;
               if (selection && typeof selection.removeAllRanges === "function")
                  selection.removeAllRanges();
            };
            const clearAnimationWatch = () => {
               if (state.timer !== null) clearTimeout(state.timer);
               state.timer = null;
               if (state.transitionHandler) {
                  card.removeEventListener("transitionend", state.transitionHandler);
                  state.transitionHandler = null;
               }
            };
            const clearVisual = () => {
               card.classList.remove(
                  "is-session-dragging",
                  "is-session-drag-left",
                  "is-session-drag-right",
                  "is-session-settling",
                  "is-session-committing",
               );
               card.style.removeProperty("transform");
               card.style.removeProperty("transition");
               card.style.removeProperty("will-change");
            };
            const releaseCapture = (pointerId) => {
               if (pointerId == null || !card.hasPointerCapture) return;
               try {
                  if (card.hasPointerCapture(pointerId)) card.releasePointerCapture(pointerId);
               } catch (error) {}
            };
            const resetPointer = () => {
               const pointerId = state.pointerId;
               state.pointerId = null;
               state.axis = "idle";
               state.dragging = false;
               state.samples = [];
               releaseCapture(pointerId);
            };
            const cleanup = () => {
               if (disposed) return;
               disposed = true;
               state.token++;
               clearAnimationWatch();
               resetPointer();
               state.animation = null;
               state.suppressNextClick = false;
               clearVisual();
               listeners.abort();
               if (sessionSwipeCleanup === cleanup) sessionSwipeCleanup = null;
            };
            sessionSwipeCleanup = cleanup;

            const samplePointer = (event) => {
               const time = eventTime(event);
               state.latestX = event.clientX;
               state.latestY = event.clientY;
               state.latestTime = time;
               state.samples.push({ x: event.clientX, time });
               const cutoff = time - SESSION_SWIPE_VELOCITY_WINDOW;
               while (state.samples.length > 1 && state.samples[1].time <= cutoff)
                  state.samples.shift();
               const oldest = state.samples[0];
               const elapsed = time - oldest.time;
               state.velocityX = elapsed >= 8 ? (event.clientX - oldest.x) / elapsed : 0;
            };
            const transformFor = (x) => {
               const width = state.cardWidth;
               const rotation = Math.max(-2.5, Math.min(2.5, (x / width) * 2.5));
               return `translate3d(${x}px, 0, 0) rotate(${rotation}deg)`;
            };
            const stillCurrent = (index, sessionCard) =>
               !disposed &&
               session.active &&
               session.mode === "cards" &&
               session.index === index &&
               currentCard() === sessionCard &&
               card.isConnected &&
               $("flash") === card;

            const animate = (kind, target, duration, complete) => {
               clearAnimationWatch();
               const token = ++state.token;
               const actualDuration = reducedMotion() ? 0 : duration;
               state.animation = kind;
               state.dragging = false;
               state.axis = "idle";
               card.classList.remove("is-session-dragging");
               card.classList.add(`is-session-${kind}`);
               card.style.willChange = "transform";
               // Fige le transform courant avant d'installer la transition de retour
               // ou de sortie. Ce read n'arrive qu'à la fin du geste, jamais au move.
               card.getBoundingClientRect();
               card.style.transition = actualDuration
                  ? `transform ${actualDuration}ms cubic-bezier(.22,.72,.2,1), box-shadow ${actualDuration}ms ease`
                  : "none";
               card.style.transform = target;

               const finish = () => {
                  if (disposed || state.token !== token || state.animation !== kind) return;
                  clearAnimationWatch();
                  complete();
               };
               state.transitionHandler = (event) => {
                  if (
                     event.target === card &&
                     event.propertyName === "transform" &&
                     state.token === token
                  )
                     finish();
               };
               card.addEventListener("transitionend", state.transitionHandler);
               state.timer = setTimeout(
                  finish,
                  actualDuration ? actualDuration + SESSION_SWIPE_ANIMATION_FALLBACK : 0,
               );
            };
            const settle = () => {
               animate(
                  "settling",
                  "translate3d(0, 0, 0) rotate(0deg)",
                  SESSION_SWIPE_SETTLE_DURATION,
                  () => {
                     state.animation = null;
                     clearVisual();
                  },
               );
            };
            const commit = (direction, index, sessionCard) => {
               const width = state.cardWidth;
               const distance =
                  direction * (Math.max(window.innerWidth, width) + width);
               animate(
                  "committing",
                  transformFor(distance),
                  SESSION_SWIPE_COMMIT_DURATION,
                  () => {
                     if (!stillCurrent(index, sessionCard)) {
                        cleanup();
                        return;
                     }
                     // Le changement de vue rappellera cancelSessionSwipe() avant de
                     // détruire cette carte. L'état navigating rend aussi le fallback
                     // et un transitionend tardif inertes.
                     state.animation = "navigating";
                     if (direction < 0) advance();
                     else previousCard();
                  },
               );
            };
            const finishPointer = (event, cancelled) => {
               if (state.pointerId == null || event.pointerId !== state.pointerId) return;
               const horizontal = state.axis === "horizontal";
               if (!cancelled) samplePointer(event);
               const dx = state.latestX - state.startX;
               const dy = state.latestY - state.startY;
               const index = state.cardIndex;
               const sessionCard = state.sessionCard;
               const pointerId = state.pointerId;
               state.pointerId = null;
               state.dragging = false;
               releaseCapture(pointerId);

               // Un appui ou une intention verticale conserve entièrement son chemin
               // natif (clic, audio ou scroll interne).
               if (!horizontal) {
                  state.axis = "idle";
                  state.samples = [];
                  return;
               }
               state.axis = "idle";
               state.samples = [];
               state.suppressNextClick = true;
               clearSelection();
               if (cancelled) {
                  settle();
                  return;
               }

               const direction = dx < 0 ? -1 : 1;
               const available = direction < 0 || index > 0;
               const horizontalEnough =
                  Math.abs(dx) > Math.abs(dy) * SESSION_SWIPE_HORIZONTAL_RATIO;
               const distanceComplete =
                  Math.abs(dx) >=
                  state.cardWidth * SESSION_SWIPE_DISTANCE_RATIO;
               const velocityComplete =
                  Math.abs(dx) >= SESSION_SWIPE_MIN_FLICK_DISTANCE &&
                  Math.abs(state.velocityX) >= SESSION_SWIPE_FLICK_VELOCITY &&
                  Math.sign(state.velocityX) === direction;
               if (
                  available &&
                  horizontalEnough &&
                  (distanceComplete || velocityComplete)
               )
                  commit(direction, index, sessionCard);
               else settle();
            };
            const movePointer = (event) => {
               if (
                  state.pointerId == null ||
                  event.pointerId !== state.pointerId ||
                  state.animation
               )
                  return;
               samplePointer(event);
               const dx = state.latestX - state.startX;
               const dy = state.latestY - state.startY;
               const absX = Math.abs(dx);
               const absY = Math.abs(dy);
               if (state.axis === "vertical") return;
               if (state.axis === "undecided") {
                  if (Math.max(absX, absY) < SESSION_SWIPE_LOCK_SLOP) return;
                  if (absX > absY * SESSION_SWIPE_HORIZONTAL_RATIO) {
                     state.axis = "horizontal";
                     state.dragging = true;
                     state.suppressNextClick = true;
                     card.classList.add("is-session-dragging");
                     card.style.willChange = "transform";
                     card.style.transition = "none";
                     clearSelection();
                     try { card.setPointerCapture(event.pointerId); } catch (error) {}
                  } else if (absY > absX * SESSION_SWIPE_HORIZONTAL_RATIO) {
                     state.axis = "vertical";
                     return;
                  } else return;
               }
               if (state.axis !== "horizontal") return;
               if (event.cancelable) event.preventDefault();
               // Toujours depuis pointerdown : aucun seuil n'est soustrait et la carte
               // rejoint le doigt dès que l'axe est décidé.
               const visualX =
                  state.cardIndex === 0 && dx > 0
                     ? dx * SESSION_SWIPE_BOUNDARY_RESISTANCE
                     : dx;
               card.style.transform = transformFor(visualX);
               card.classList.toggle("is-session-drag-left", visualX < -2);
               card.classList.toggle("is-session-drag-right", visualX > 2);
            };

            card.addEventListener(
               "click",
               (event) => {
                  if (!state.suppressNextClick) return;
                  state.suppressNextClick = false;
                  event.preventDefault();
                  event.stopImmediatePropagation();
               },
               { capture: true, signal: listeners.signal },
            );
            card.addEventListener(
               "pointerdown",
               (event) => {
                  if (
                     disposed ||
                     state.pointerId != null ||
                     state.animation ||
                     event.isPrimary === false ||
                     (event.pointerType === "mouse" && event.button !== 0)
                  )
                     return;
                  // Une nouvelle intention explicite ne doit jamais être bloquée par
                  // l'absence éventuelle du clic synthétique du geste précédent.
                  state.suppressNextClick = false;
                  if (event.target.closest(SESSION_SWIPE_BLOCKING_SELECTOR)) return;
                  state.pointerId = event.pointerId;
                  state.axis = "undecided";
                  state.dragging = false;
                  state.animation = null;
                  state.startX = state.latestX = event.clientX;
                  state.startY = state.latestY = event.clientY;
                  state.startTime = state.latestTime = eventTime(event);
                  state.velocityX = 0;
                  state.samples = [{ x: event.clientX, time: state.startTime }];
                  state.cardWidth = Math.max(1, card.getBoundingClientRect().width);
                  state.cardIndex = session.index;
                  state.sessionCard = currentCard();
               },
               { signal: listeners.signal },
            );
            card.addEventListener("pointermove", movePointer, {
               passive: false,
               signal: listeners.signal,
            });
            card.addEventListener(
               "pointerup",
               (event) => finishPointer(event, false),
               { signal: listeners.signal },
            );
            card.addEventListener(
               "pointercancel",
               (event) => finishPointer(event, true),
               { signal: listeners.signal },
            );
            card.addEventListener(
               "lostpointercapture",
               (event) => {
                  // Le transfert de la capture tactile implicite d'un enfant vers la
                  // carte émet aussi un lostpointercapture qui remonte : seule la perte
                  // de la capture détenue par la carte annule le geste.
                  if (event.target === card) finishPointer(event, true);
               },
               { signal: listeners.signal },
            );
         }
         function wireSession(c, st) {
            $("s-exit").onclick = endSession;
            const flip = () => {
               const revealing = !st.revealed;
               st.revealed = revealing;
               renderSession();
               if (revealing && !st.everRevealed) {
                  st.everRevealed = true;
                  if (frontOf(c, st) === "fr") speak(c.hz);
               }
            };
            if ($("s-flip")) $("s-flip").onclick = flip;
            const fl = $("flash");
            // Toute la surface non interactive retourne la carte sur son clic natif.
            const tapCard = (target) => {
               if (session.mode !== "cards") return;
               if (!target || !fl.contains(target) || target.closest(SESSION_INTERACTIVE_SELECTOR)) return;
               flip();
            };
            if (session.mode === "cards") {
               wireSessionSwipe(fl);
               fl.style.cursor = "pointer";
               fl.onclick = (e) => tapCard(e.target);
            }
            if ($("s-practice"))
               $("s-practice").onclick = () => openReviewWritingPractice(c, 0);
            if ($("s-next")) $("s-next").onclick = advance;
            if ($("s-prev"))
               $("s-prev").onclick = previousCard;
            if ($("s-check")) $("s-check").onclick = checkWritten;
            if ($("s-skip"))
               $("s-skip").onclick = () => {
                  st.checked = true;
                  st.ok = false;
                  st.skipped = true;
                  renderSession();
                  speak(c.hz);
               };
            document.querySelectorAll("[data-grade]").forEach(
               (b) =>
                  (b.onclick = () => {
                     const g = b.dataset.grade;
                     st.grade = g;
                     applyGrade(c, g);
                     if (typeof maybeShowConfusablePairTest === "function" && maybeShowConfusablePairTest(c, advance))
                        return;
                     advance();
                  }),
            );
            if ($("a-fav"))
               $("a-fav").onclick = () => {
                  c.fav = !c.fav;
                  save();
                  renderSession();
               };
            if ($("a-hard"))
               $("a-hard").onclick = () =>
                  openDelaySheet(c, (marked) => {
                     if (marked) session.live.marked++;
                     if (session.active) renderSession();
                  });
            if ($("a-acq"))
               $("a-acq").onclick = () => {
                  c.acquired = !c.acquired;
                  if (c.acquired) {
                     c.due = null;
                     session.live.acquired++;
                  }
                  save();
                  renderSession();
               };
            const wi = $("w-input");
            if (wi) {
               if (st.task !== "fr") {
                  wi.addEventListener("input", () => {
                     // conversion ni3 -> nǐ à la volée
                     const v = numToAccent(wi.value);
                     if (v !== wi.value) wi.value = v;
                  });
               }
               setTimeout(() => wi.focus(), 60);
            }
            if (
               session.mode === "written" &&
               !st.checked &&
               st.task === "trace"
            )
               setupSessionTrace(c, st);
         }

         /* -------- vérification du mode écrit -------- */
         function pyMatch(target, given) {
            const t = numToAccent(String(target || "")).toLowerCase();
            const g = numToAccent(String(given || "")).toLowerCase();
            const keep = (s) =>
               s
                  .normalize("NFC")
                  .replace(/[^a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü]/g, "");
            if (keep(t) === keep(g) && keep(g)) return { ok: true, note: "" };
            if (flatten(t) === flatten(g) && flatten(g))
               return {
                  ok: false,
                  note: "Bonnes syllabes, mais vérifie les tons.",
               };
            return { ok: false, note: "" };
         }
         function normFr(s) {
            const base = String(s || "")
               .toLowerCase()
               .replace(/\(.*?\)/g, " ")
               .replace(/[’']/g, " ")
               .normalize("NFD")
               .replace(/[\u0300-\u036f]/g, "");
            const clean = (x) => x.replace(/[^a-z]+/g, "");
            // retire les articles, mais garde le mot si tout disparaît (ex : « un »)
            return (
               clean(
                  base.replace(
                     /\b(le|la|les|l|un|une|des|du|de|d|au|aux)\b/g,
                     " ",
                  ),
               ) || clean(base)
            );
         }
         function frMatch(target, given) {
            const g = normFr(given);
            if (!g) return false;
            const segs = String(target || "")
               .split(/[,;/·]/)
               .map(normFr)
               .filter(Boolean);
            if (segs.includes(g)) return true;
            return segs.some(
               (seg) =>
                  (g.length >= 4 && seg.includes(g)) ||
                  (seg.length >= 4 && g.includes(seg)),
            );
         }
         function checkWritten() {
            if (!session.active) return;
            const c = currentCard();
            const st = getState(session.index);
            if (!c || !st || st.checked || session.mode !== "written") return;
            let ok = false,
               note = "";
            if (st.task === "trace") {
               if (!st.traceOk && !st.traceReady) {
                  toast("Termine ton tracé d'abord (ou « Voir la réponse »).");
                  return;
               }
               ok = !!st.traceOk;
            } else {
               const given = ($("w-input") ? $("w-input").value : "").trim();
               if (!given) {
                  toast("Écris ta réponse d'abord.");
                  return;
               }
               if (st.task === "fr") ok = frMatch(c.fr, given);
               else {
                  const r = pyMatch(c.py, given);
                  ok = r.ok;
                  note = r.note;
               }
            }
            st.checked = true;
            st.ok = ok;
            st.note = note;
            renderSession();
            speak(c.hz);
         }

         /* -------- tracé pendant la séance -------- */
         function setupSessionTrace(c, st) {
            const target = $("s-writer");
            if (!target) return;
            const chars = Array.from(c.hz).filter((ch) =>
               /[\u4e00-\u9fff]/.test(ch),
            );
            if (!chars.length || typeof HanziWriter === "undefined") {
               fallbackTrace(c, st);
               return;
            }
            const size = Math.min(280, target.parentElement.clientWidth || 280);
            target.style.width = size + "px";
            target.style.height = size + "px";
            const note = $("s-tracenote");
            let i = 0;
            st.traceOk = false;
            st.traceReady = false;
            const runOne = () => {
               if (
                  !session.active ||
                  currentCard() !== c ||
                  getState(session.index).checked
               )
                  return;
               target.innerHTML = "";
               if (note)
                  note.textContent =
                     chars.length > 1
                        ? "Caractère " + (i + 1) + " / " + chars.length
                        : "Trace le caractère, trait par trait.";
               const writer = HanziWriter.create(target, chars[i], {
                  width: size,
                  height: size,
                  padding: 10,
                  showCharacter: false,
                  showOutline: true,
                  showHintAfterMisses: 2,
                  strokeColor: "#17140F",
                  outlineColor: "#CDBFA1",
                  drawingColor: "#9E2B25",
                  onLoadCharDataError: () => {
                     if (
                        session.active &&
                        currentCard() === c &&
                        !getState(session.index).checked
                     )
                        fallbackTrace(c, st);
                  },
               });
               writer.quiz({
                  onComplete: () => {
                     i++;
                     if (i < chars.length) setTimeout(runOne, 450);
                     else {
                        st.traceOk = true;
                        st.traceReady = true;
                        if (note)
                           note.textContent =
                              "Tracé terminé — appuie sur Vérifier.";
                     }
                  },
               });
            };
            runOne();
         }
         function fallbackTrace(c, st) {
            // repli si les données de traits ne chargent pas : tracé libre auto-évalué
            const target = $("s-writer"),
               ghost = $("s-ghost"),
               canvas = $("s-canvas"),
               btns = $("t-btns"),
               note = $("s-tracenote");
            if (!target || !ghost || !canvas) return;
            target.hidden = true;
            ghost.hidden = false;
            canvas.hidden = false;
            if (btns) btns.hidden = false;
            if (note)
               note.textContent =
                  "Tracé libre : recopie le modèle, puis évalue-toi.";
            const box = ghost.parentElement;
            const size = Math.min(280, box.clientWidth || 280);
            canvas.width = size;
            canvas.height = size;
            const len = Array.from(c.hz).length;
            ghost.style.fontSize =
               (len >= 3 ? 80 : len === 2 ? 125 : 200) + "px";
            paintPad(canvas);
            st.traceReady = true;
            if ($("t-ok"))
               $("t-ok").onclick = () => {
                  st.traceOk = true;
                  checkWritten();
               };
            if ($("t-no"))
               $("t-no").onclick = () => {
                  st.traceOk = false;
                  checkWritten();
               };
         }
         function paintPad(canvas) {
            const ctx = canvas.getContext("2d");
            ctx.lineWidth = 7;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.strokeStyle = "#17140F";
            let drawing = false;
            const pos = (e) => {
               const r = canvas.getBoundingClientRect();
               return [
                  ((e.clientX - r.left) * canvas.width) / r.width,
                  ((e.clientY - r.top) * canvas.height) / r.height,
               ];
            };
            canvas.onpointerdown = (e) => {
               drawing = true;
               canvas.setPointerCapture(e.pointerId);
               const p = pos(e);
               ctx.beginPath();
               ctx.moveTo(p[0], p[1]);
            };
            canvas.onpointermove = (e) => {
               if (!drawing) return;
               const p = pos(e);
               ctx.lineTo(p[0], p[1]);
               ctx.stroke();
            };
            canvas.onpointerup = canvas.onpointercancel = () => {
               drawing = false;
            };
         }

         /* -------- fin de séance -------- */
         function endSession() {
            cancelSessionSwipe();
            destroyReviewStrokeWorkspace();
            const sts = session.states.filter(Boolean);
            const seen = sts.filter(
               (s) => s.everRevealed || s.checked || s.grade,
            ).length;
            const checkedN = sts.filter((s) => s.checked).length;
            const right = sts.filter((s) => s.checked && s.ok === true).length;
            const gCount = (g) => sts.filter((s) => s.grade === g).length;
            const errIds = [];
            session.states.forEach((s, i) => {
               if (!s) return;
               if (s.grade === "again" || (s.checked && s.ok === false)) {
                  const id = session.cards[i] && session.cards[i].id;
                  if (id && !errIds.includes(id)) errIds.push(id);
               }
            });
            session.summary = {
               total: session.cards.length,
               seen,
               right,
               checked: checkedN,
               again: gCount("again"),
               hard: gCount("hard"),
               good: gCount("good"),
               easy: gCount("easy"),
               marked: session.live.marked,
               acquired: session.live.acquired,
               errIds,
               mode: session.mode,
            };
            session.active = false;
            clearSavedSession();
            document.body.classList.remove("in-session");
            renderLearn();
         }
         function renderSummary() {
            const s = session.summary;
            const graded = s.again + s.hard + s.good + s.easy;
            const errCards = s.errIds
               .map((id) => db.cards.find((c) => c.id === id))
               .filter(Boolean);
            const errList = errCards.length
               ? '<div class="eyebrow" style="text-align:center">À retravailler</div><div class="err-list">' +
                 errCards
                    .map(
                       (c) =>
                          '<div class="err-row"><b data-say="' +
                          esc(c.hz) +
                          '" style="cursor:pointer">' +
                          esc(c.hz) +
                          "</b><span>" +
                          colorPinyin(c.py) +
                          " · " +
                          esc(c.fr) +
                          "</span></div>",
                    )
                    .join("") +
                 "</div>"
               : "";
            $("view").innerHTML =
               '<section class="card pad summary">' +
               '<div class="sum-hz ink-in">完</div>' +
               '<h2 class="sum-t">Séance terminée</h2>' +
               '<div class="sum-rows">' +
               '<div class="sum-row"><span>Cartes vues</span><b>' +
               s.seen +
               " / " +
               s.total +
               "</b></div>" +
               (graded
                  ? '<div class="sum-row"><span>Réussies (Correct + Facile)</span><b>' +
                    (s.good + s.easy) +
                    " / " +
                    graded +
                    "</b></div>"
                  : "") +
               (s.mode === "written"
                  ? '<div class="sum-row"><span>Réponses écrites justes</span><b>' +
                    s.right +
                    " / " +
                    s.checked +
                    "</b></div>"
                  : "") +
               (s.again
                  ? '<div class="sum-row"><span>Ratées (reviennent vite)</span><b>' +
                    s.again +
                    "</b></div>"
                  : "") +
               (s.marked
                  ? '<div class="sum-row"><span>Programmées à la main</span><b>' +
                    s.marked +
                    "</b></div>"
                  : "") +
               (s.acquired
                  ? '<div class="sum-row"><span>Passées en maîtrisées</span><b>' +
                    s.acquired +
                    "</b></div>"
                  : "") +
               "</div>" +
               errList +
               '<div class="sum-btns">' +
               (errCards.length
                  ? '<button class="btn primary big" id="btn-redo-err">Revoir mes ' +
                    errCards.length +
                    " erreur" +
                    (errCards.length > 1 ? "s" : "") +
                    "</button>"
                  : "") +
               '<button class="btn' +
               (errCards.length ? " ghost" : " primary big") +
               '" id="btn-back-hub">Retour à l\'atelier</button>' +
               "</div>" +
               "</section>";
            if ($("btn-redo-err"))
               $("btn-redo-err").onclick = () => {
                  const cards = shuffle(errCards);
                  session = { active: false };
                  startCardsWith(cards, "Mes erreurs", "cards");
               };
            $("btn-back-hub").onclick = () => {
               session = { active: false };
               renderLearn();
            };
         }

         /* -------- programmation manuelle -------- */
         function delayTargets() {
            const t = now();
            const tonight = new Date();
            tonight.setHours(20, 0, 0, 0);
            if (tonight.getTime() <= t) tonight.setDate(tonight.getDate() + 1);
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(9, 0, 0, 0);
            return [
               ["10 minutes", t + 10 * 60e3],
               ["1 heure", t + 3600e3],
               ["3 heures", t + 3 * 3600e3],
               ["Ce soir · 20 h", tonight.getTime()],
               ["Demain · 9 h", tomorrow.getTime()],
               ["3 jours", t + 3 * 86400e3],
               ["1 semaine", t + 7 * 86400e3],
            ];
         }
         function openDelaySheet(c, after) {
            const opts = delayTargets()
               .map(
                  (o) =>
                     '<button class="btn" data-d="' +
                     o[1] +
                     '">' +
                     o[0] +
                     "</button>",
               )
               .join("");
            openSheet(
               '<h3 class="sh-t">Revoir « ' +
                  esc(c.hz) +
                  " » dans…</h3>" +
                  (c.due != null
                     ? '<p class="sh-p">Actuellement programmée : ' +
                       fmtDate(c.due) +
                       "</p>"
                     : "") +
                  '<div class="delay-grid">' +
                  opts +
                  "</div>" +
                  '<div class="dl-custom"><input type="datetime-local" id="dl-dt" class="search"><button class="btn" id="dl-ok">OK</button></div>' +
                  (c.due != null
                     ? '<button class="btn ghost wide" id="dl-cancel">Annuler la programmation actuelle</button>'
                     : "") +
                  '<button class="btn ghost wide" id="dl-close">Fermer</button>',
            );
            const setDue = (ts) => {
               c.due = ts;
               c.acquired = false;
               save();
               closeSheet();
               toast("« " + c.hz + " » reviendra le " + fmtDate(ts) + ".");
               if (after) after(true);
            };
            document
               .querySelectorAll("#sheet [data-d]")
               .forEach((b) => (b.onclick = () => setDue(+b.dataset.d)));
            $("dl-ok").onclick = () => {
               const v = $("dl-dt").value;
               if (!v) {
                  toast("Choisis une date et une heure.");
                  return;
               }
               const ts = new Date(v).getTime();
               if (!ts || ts <= now()) {
                  toast("Choisis un moment dans le futur.");
                  return;
               }
               setDue(ts);
            };
            if ($("dl-cancel"))
               $("dl-cancel").onclick = () => {
                  c.due = null;
                  save();
                  closeSheet();
                  toast("Programmation annulée.");
                  if (after) after(false);
               };
            $("dl-close").onclick = closeSheet;
         }
