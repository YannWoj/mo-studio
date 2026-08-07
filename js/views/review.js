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
   return (
      '<details class="review-strokes" id="review-strokes"' + (reviewStrokeExpanded ? " open" : "") + ' data-no-session-swipe>' +
      '<summary><span>Écriture du caractère</span><small>Voir l’ordre des traits</small></summary>' +
      '<div class="review-stroke-content">' +
      '<div class="review-stroke-character-nav">' +
      '<button type="button" class="review-stroke-chevron" id="review-stroke-character-prev" aria-label="Caractère précédent"' + (selected === 0 ? " disabled" : "") + '>‹</button>' +
      '<div class="review-stroke-characters" aria-label="Caractères du mot">' + pills + "</div>" +
      '<button type="button" class="review-stroke-chevron" id="review-stroke-character-next" aria-label="Caractère suivant"' + (selected === characters.length - 1 ? " disabled" : "") + '>›</button>' +
      '<span class="review-stroke-count" id="review-stroke-count" aria-live="polite">' + (selected + 1) + " / " + characters.length + "</span></div>" +
      '<div class="review-stroke-actions"><div class="review-stroke-tabs" role="tablist" aria-label="Affichage de l’ordre des traits">' +
      '<button type="button" role="tab" data-review-stroke-tab="animation" aria-selected="' + String(reviewStrokeTab === "animation") + '">Animation</button>' +
      '<button type="button" role="tab" data-review-stroke-tab="steps" aria-selected="' + String(reviewStrokeTab === "steps") + '">Étapes</button></div>' +
      '<button type="button" class="review-stroke-practice" id="review-stroke-practice">S’entraîner</button></div>' +
      '<div class="review-stroke-panel" id="review-stroke-animation"' + (reviewStrokeTab === "animation" ? "" : " hidden") + '><div class="review-stroke-grid"><div id="review-stroke-target"></div></div><div class="review-stroke-animation-meta"><span id="review-stroke-status" role="status" aria-live="polite">Chargement…</span><button type="button" class="btn sm ghost" id="review-stroke-replay">Rejouer</button></div></div>' +
      '<div class="review-stroke-panel" id="review-stroke-steps"' + (reviewStrokeTab === "steps" ? "" : " hidden") + '><div class="review-stroke-steps-list" id="review-stroke-steps-list" aria-label="Étapes des traits"></div></div>' +
      "</div></details>"
   );
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

async function loadReviewStrokeCharacter(character, autoplay) {
   const token = ++reviewStrokeLoadToken;
   destroyReviewStrokeWriter();
   reviewStrokeData = null;
   const status = $("review-stroke-status");
   if (status) status.textContent = "Chargement…";
   try {
      if (typeof loadStrokeCharacterData !== "function") throw new Error("stroke data unavailable");
      const data = await loadStrokeCharacterData(character);
      if (token !== reviewStrokeLoadToken || !$("review-strokes") || !session.active) return;
      reviewStrokeData = data;
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
      loadReviewStrokeCharacter(characters[index], true);
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
   $("review-stroke-character-prev").onclick = () => selectCharacter((st.strokeCharacterIndex || 0) - 1);
   $("review-stroke-character-next").onclick = () => selectCharacter((st.strokeCharacterIndex || 0) + 1);
   root.querySelectorAll("[data-review-stroke-tab]").forEach((button) =>
      button.onclick = () => activateReviewStrokeTab(button.dataset.reviewStrokeTab),
   );
   $("review-stroke-practice").onclick = () => {
      const index = Math.max(0, Math.min(Number(st.strokeCharacterIndex) || 0, characters.length - 1));
      openWritingPracticeSheet(c.hz, { initialIndex: index });
   };
   $("review-stroke-replay").onclick = () => {
      if (reviewStrokeData) createReviewStrokeAnimation(reviewStrokeData, true);
   };
   if (root.open) selectCharacter(st.strokeCharacterIndex || 0);
}

/* ================= séance ================= */
         const currentCard = () => session.cards[session.index];
         function getState(i) {
            if (!session.states[i])
               session.states[i] = {
                  revealed: false,
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
         function actionsHtml(c) {
            return (
               '<div class="acts">' +
               '<button class="act' +
               (c.fav ? " on" : "") +
               '" id="a-fav">Favori</button>' +
               '<button class="act" id="a-hard">Choisir la date</button>' +
               '<button class="act' +
               (c.acquired ? " on jade" : "") +
               '" id="a-acq">Maîtrisée</button>' +
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

         function gradesHtml(c) {
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
               "</div>" + sessionNavigationHtml()
            );
         }
         function sessionNavigationHtml() {
            const last = session.index >= session.cards.length - 1;
            return (
               '<nav class="session-nav" aria-label="Navigation dans la séance">' +
               '<button type="button" class="session-nav-button previous" id="s-prev"' +
               (session.index === 0 ? " disabled aria-disabled=\"true\"" : "") +
               '>‹ <span>Précédent</span></button>' +
               '<button type="button" class="session-nav-button next" id="s-next"><span>' +
               (last ? "Terminer" : "Passer") +
               "</span> ›</button></nav>"
            );
         }
         function sessionFooterHtml(c, st) {
            if (session.mode === "discover") {
               return sessionNavigationHtml();
            }
            if (session.mode === "cards" && !st.revealed)
               return '<div class="s-foot"><button class="btn primary big" id="s-flip">Retourner</button></div>';
            if (session.mode === "written" && !st.checked)
               return '<div class="s-foot"><button class="btn ghost" id="s-skip">Voir la réponse</button><button class="btn primary" id="s-check">Vérifier</button></div>';
            // verso (cartes) ou réponse vérifiée (écrit) : boutons de notation SRS
            return gradesHtml(c);
         }

         function renderSession() {
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
                  (session.mode !== "cards" || front === "zh"
                     ? '<div class="sep"></div><div class="fr">' + esc(c.fr) + "</div>"
                     : "") +
                  (c.exHz ? exampleHtml(c) : "") +
                  noteHtml(c) +
                  (session.mode === "discover" ? "" : actionsHtml(c)) +
                  (session.mode === "cards" ? reviewStrokeBlockHtml(c, st) : "");
            }

            const modeName = {
               cards: "Cartes",
               written: "Écrit",
               discover: "Découverte",
            }[session.mode];
            $("view").innerHTML =
               '<section class="sess">' +
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
               '<div class="flash card" id="flash">' +
               '<button class="seal fl-seal" data-say="' +
               esc(c.hz) +
               '"' +
               (hideSay ? ' style="visibility:hidden"' : "") +
               ' aria-label="Écouter">听</button>' +
               body +
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
         function wireSessionSwipe(flash) {
            if (!flash || !("PointerEvent" in window)) return;
            const interactive = "button, input, select, textarea, a, label, summary, [data-say], [data-no-session-swipe], .acts, .grades, .session-nav";
            let gesture = null;
            const finish = (event, cancelled) => {
               if (!gesture || event.pointerId !== gesture.pointerId) return;
               const current = gesture;
               gesture = null;
               flash.classList.remove("is-session-dragging");
               flash.style.removeProperty("--session-drag-x");
               if (flash.hasPointerCapture && flash.hasPointerCapture(event.pointerId))
                  flash.releasePointerCapture(event.pointerId);
               if (cancelled) {
                  flash._suppressSessionClickUntil = Date.now() + 500;
                  return;
               }
               if (!current.horizontal) return;
               const dx = event.clientX - current.x;
               const dy = event.clientY - current.y;
               if (Math.abs(dx) < 72 || Math.abs(dx) <= Math.abs(dy) * 1.25) return;
               const selection = typeof getSelection === "function" ? getSelection() : null;
               if (selection && typeof selection.removeAllRanges === "function") selection.removeAllRanges();
               if (dx < 0) advance();
               else previousCard();
            };
            flash.onpointerdown = (event) => {
               if (event.button !== 0 || event.target.closest(interactive)) return;
               gesture = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, horizontal: false };
               if (flash.setPointerCapture) flash.setPointerCapture(event.pointerId);
            };
            flash.onpointermove = (event) => {
               if (!gesture || event.pointerId !== gesture.pointerId) return;
               const dx = event.clientX - gesture.x;
               const dy = event.clientY - gesture.y;
               if (!gesture.horizontal) {
                  if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) {
                     finish(event, true);
                     return;
                  }
                  if (Math.abs(dx) < 16 || Math.abs(dx) <= Math.abs(dy) * 1.2) return;
                  gesture.horizontal = true;
                  flash.classList.add("is-session-dragging");
               }
               if (event.cancelable) event.preventDefault();
               flash.style.setProperty("--session-drag-x", Math.max(-38, Math.min(38, dx)) + "px");
            };
            flash.onpointerup = (event) => finish(event, false);
            flash.onpointercancel = (event) => finish(event, true);
            flash.onlostpointercapture = (event) => {
               if (gesture && event.pointerId === gesture.pointerId) finish(event, true);
            };
         }
         function wireSession(c, st) {
            $("s-exit").onclick = endSession;
            const flip = () => {
               st.revealed = true;
               renderSession();
               if (frontOf(c, st) === "fr") speak(c.hz);
            };
            if ($("s-flip")) $("s-flip").onclick = flip;
            const fl = $("flash");
            wireSessionSwipe(fl);
            if (session.mode === "cards" && !st.revealed) {
               fl.style.cursor = "pointer";
               fl.onclick = (e) => {
                  if (Date.now() < (fl._suppressSessionClickUntil || 0)) return;
                  if (
                     e.target.closest("[data-say]") ||
                     e.target.closest("button")
                  )
                     return;
                  flip();
               };
            }
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
            destroyReviewStrokeWorkspace();
            const sts = session.states.filter(Boolean);
            const seen = sts.filter(
               (s) => s.revealed || s.checked || s.grade,
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
