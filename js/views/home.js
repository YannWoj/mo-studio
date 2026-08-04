"use strict";

/* ================= hub (Réviser) ================= */
         let hub = {
            flt: "all",
            pack: "",
            cat: "",
            includeAcquired: false,
            freeOpen: false,
         };

         function scopeCards() {
            let list = db.cards.slice();
            if (hub.flt === "due") list = list.filter(isDue);
            else if (hub.flt === "fav") list = list.filter((c) => c.fav);
            else if (hub.flt === "acq") list = list.filter((c) => c.acquired);
            if (hub.pack) {
               if (hub.pack.startsWith("unit:")) {
                  const u = +hub.pack.slice(5);
                  list = list.filter((c) => c.unit === u);
               } else {
                  const p = db.packs.find((p) => p.id === hub.pack);
                  const set = new Set(p ? p.cardIds : []);
                  list = list.filter((c) => set.has(c.id));
               }
            }
            if (hub.cat) list = list.filter((c) => c.cat === hub.cat);
            if (!hub.includeAcquired && hub.flt !== "acq")
               list = list.filter((c) => !c.acquired);
            return list;
         }
         function scopeLabel() {
            const parts = [];
            if (hub.flt === "due") parts.push("À revoir");
            else if (hub.flt === "fav") parts.push("Favoris");
            else if (hub.flt === "acq") parts.push("Acquises");
            if (hub.pack) {
               if (hub.pack.startsWith("unit:"))
                  parts.push(unitName(+hub.pack.slice(5)));
               else {
                  const p = db.packs.find((p) => p.id === hub.pack);
                  if (p) parts.push(p.name);
               }
            }
            if (hub.cat) parts.push(hub.cat);
            return parts.join(" · ") || "Tout";
         }

         /* -------- file intelligente pour « Continuer » -------- */
         function smartQueue() {
            const pool = db.cards.filter((c) => !c.acquired);
            const due = pool.filter(isDue).sort((a, b) => a.due - b.due);
            const fresh = pool.filter((c) => c.due == null).sort(unitSort);
            const size = db.settings.sessionSize; // 0 = tout
            const newTake = Math.min(db.settings.newPerSession, fresh.length);
            let dueTake = size > 0 ? Math.max(0, size - newTake) : due.length;
            dueTake = Math.min(dueTake, due.length);
            let q = due.slice(0, dueTake).concat(fresh.slice(0, newTake));
            if (size > 0) q = q.slice(0, size);
            const planned = pool
               .filter((c) => c.due != null && c.due > now())
               .sort((a, b) => a.due - b.due);
            return {
               q: shuffle(q),
               dueN: Math.min(due.length, dueTake),
               dueTotal: due.length,
               freshN: Math.min(
                  newTake,
                  Math.max(0, size > 0 ? size : Infinity),
               ),
               freshUnit: fresh.length ? fresh[0].unit : null,
               nextDue: planned.length ? planned[0].due : null,
            };
         }
         function startSmartSession() {
            const sq = smartQueue();
            if (!sq.q.length) {
               toast("Rien à réviser pour le moment.");
               return;
            }
            startCardsWith(sq.q, "Ma révision", "cards");
         }
         function startCardsWith(cards, label, mode) {
            session = {
               active: true,
               mode: mode || "cards",
               cards,
               index: 0,
               states: new Array(cards.length).fill(null),
               live: { marked: 0, acquired: 0 },
               scopeLabel: label,
            };
            document.body.classList.add("in-session");
            renderSession();
            window.scrollTo(0, 0);
         }
         function startFreeSession(mode) {
            let cards = shuffle(scopeCards());
            if (!cards.length) {
               toast("Aucune carte dans cette sélection.");
               return;
            }
            const size = db.settings.freeSize;
            if (size > 0) cards = cards.slice(0, size);
            startCardsWith(cards, scopeLabel(), mode);
         }

         /* -------- écrans du hub -------- */
         function emptyHtml() {
            return (
               '<section class="card pad empty">' +
               '<div class="empty-hz">学</div>' +
               '<h2 class="empty-t">Ta collection est vide</h2>' +
               '<p class="empty-p">Crée ta première carte pour commencer à construire ta collection.</p>' +
               '<div class="empty-btns">' +
               '<button class="btn primary" id="btn-e-add">Créer une carte</button>' +
               "</div></section>"
            );
         }
         function wireEmpty() {
            if ($("btn-e-add"))
               $("btn-e-add").onclick = () => openCardForm(null);
         }

         function renderLearn() {
            document.body.classList.toggle("in-session", session.active);
            if (session.active) {
               renderSession();
               return;
            }
            if (session.summary) {
               renderSummary();
               return;
            }
            const root = $("view");
            const heroTop =
               '<section class="hero"><div class="hero-hz ink-in">墨室</div><div class="hero-sub">Mò Studio — ton atelier de chinois</div></section>';
            if (!db.cards.length) {
               root.innerHTML = heroTop + emptyHtml();
               wireEmpty();
               return;
            }
            // garde-fous sur les filtres
            if (
               hub.pack &&
               !hub.pack.startsWith("unit:") &&
               !db.packs.some((p) => p.id === hub.pack)
            )
               hub.pack = "";
            if (hub.cat && !db.cards.some((c) => c.cat === hub.cat))
               hub.cat = "";

            const total = db.cards.length;
            const dueN = db.cards.filter(isDue).length;
            const fav = db.cards.filter((c) => c.fav).length;
            const acq = db.cards.filter((c) => c.acquired).length;
            const sq = smartQueue();
            const mins = Math.max(1, Math.round((sq.q.length * 25) / 60));
            const resume = loadSavedSession();

            // bouton principal
            let cta;
            if (sq.q.length) {
               const sub =
                  sq.dueTotal +
                  " à revoir · " +
                  sq.freshN +
                  " nouvelle" +
                  (sq.freshN > 1 ? "s" : "");
               const uline =
                  sq.freshN > 0 && sq.freshUnit != null
                     ? '<span class="u-line">Unité ' +
                       sq.freshUnit +
                       " · " +
                       esc(unitName(sq.freshUnit)) +
                       "</span>"
                     : "";
               cta =
                  '<button class="cta ink-in" id="btn-continue"><b>Continuer ma révision</b><span>' +
                  sq.q.length +
                  " carte" +
                  (sq.q.length > 1 ? "s" : "") +
                  " · ~" +
                  mins +
                  " min — " +
                  sub +
                  "</span>" +
                  uline +
                  "</button>";
            } else {
               cta =
                  '<button class="cta" disabled><b>Tout est à jour 完</b><span>' +
                  (sq.nextDue
                     ? "Prochaine révision : " + fmtDate(sq.nextDue)
                     : "Ajoute ou importe de nouvelles cartes") +
                  "</span></button>";
            }

            const statBtn = (flt, val, lab) =>
               '<button class="stat" data-flt="' +
               flt +
               '"><b>' +
               val +
               "</b><span>" +
               lab +
               "</span></button>";
            const dirChip = (v, lab) =>
               '<button class="chip" data-dir="' +
               v +
               '" aria-pressed="' +
               String(db.settings.direction === v) +
               '">' +
               lab +
               "</button>";
            const fltChip = (v, lab) =>
               '<button class="chip" data-hflt="' +
               v +
               '" aria-pressed="' +
               String(hub.flt === v) +
               '">' +
               lab +
               "</button>";
            const sizeChip = (v, lab) =>
               '<button class="chip" data-size="' +
               v +
               '" aria-pressed="' +
               String(db.settings.freeSize === v) +
               '">' +
               lab +
               "</button>";
            const cats = Array.from(
               new Set(db.cards.map((c) => c.cat).filter(Boolean)),
            ).sort((a, b) => a.localeCompare(b, "fr"));
            const unitIds = Array.from(
               new Set(db.cards.map((c) => c.unit).filter((u) => u != null)),
            ).sort((a, b) => a - b);
            const n = scopeCards().length;
            const dis = n === 0 ? "disabled" : "";

            root.innerHTML =
               heroTop +
               (resume
                  ? '<div class="resume"><span>Séance en cours · ' +
                    Math.min(resume.snap.index + 1, resume.cards.length) +
                    " / " +
                    resume.cards.length +
                    '</span><span style="display:flex;gap:6px"><button class="btn sm primary" id="btn-resume">Reprendre</button><button class="btn sm ghost" id="btn-resume-x">✕</button></span></div>'
                  : "") +
               cta +
               '<div class="stats">' +
               statBtn("all", total, "Cartes") +
               statBtn("due", dueN, "À revoir") +
               statBtn("fav", fav, "Favoris") +
               statBtn("acq", acq, "Acquises") +
               "</div>" +
               '<details class="free" id="free-panel"' +
               (hub.freeOpen ? " open" : "") +
               ">" +
               '<summary><span class="free-hz">选</span>Séance libre & filtres</summary>' +
               '<div class="free-body">' +
               '<div class="eyebrow" style="margin-top:4px">Sens de révision</div>' +
               '<div class="chips">' +
               dirChip("zh2fr", "中文 → FR") +
               dirChip("fr2zh", "FR → 中文") +
               dirChip("mix", "Mixte") +
               "</div>" +
               '<div class="eyebrow">Sélection — ' +
               n +
               " carte" +
               (n > 1 ? "s" : "") +
               "</div>" +
               '<div class="chips">' +
               fltChip("all", "Tout") +
               fltChip("due", "À revoir") +
               fltChip("fav", "♥ Favoris") +
               fltChip("acq", "✓ Acquises") +
               "</div>" +
               '<div class="selects">' +
               '<select class="search" id="hub-pack"><option value="">Unité / pack : tous</option>' +
               (unitIds.length
                  ? '<optgroup label="Unités">' +
                    unitIds
                       .map(
                          (u) =>
                             '<option value="unit:' +
                             u +
                             '"' +
                             (hub.pack === "unit:" + u ? " selected" : "") +
                             ">U" +
                             u +
                             " · " +
                             esc(unitName(u)) +
                             "</option>",
                       )
                       .join("") +
                    "</optgroup>"
                  : "") +
               (db.packs.length
                  ? '<optgroup label="Packs">' +
                    db.packs
                       .map(
                          (p) =>
                             '<option value="' +
                             p.id +
                             '"' +
                             (hub.pack === p.id ? " selected" : "") +
                             ">" +
                             esc(p.name) +
                             "</option>",
                       )
                       .join("") +
                    "</optgroup>"
                  : "") +
               "</select>" +
               '<select class="search" id="hub-cat"><option value="">Catégorie : toutes</option>' +
               cats
                  .map(
                     (c) =>
                        '<option value="' +
                        esc(c) +
                        '"' +
                        (hub.cat === c ? " selected" : "") +
                        ">" +
                        esc(c) +
                        "</option>",
                  )
                  .join("") +
               "</select>" +
               "</div>" +
               '<label class="ck" style="margin-top:8px"><input type="checkbox" id="inc-acq"' +
               (hub.includeAcquired ? " checked" : "") +
               "> Inclure les cartes acquises</label>" +
               '<div class="eyebrow">Taille de la séance</div>' +
               '<div class="chips">' +
               sizeChip(10, "10") +
               sizeChip(20, "20") +
               sizeChip(50, "50") +
               sizeChip(0, "Tout") +
               "</div>" +
               '<div class="eyebrow">Lancer</div>' +
               '<div class="modes">' +
               '<button class="mode" data-mode="cards" ' +
               dis +
               '><span class="m-hz">卡</span><span><b>Cartes</b><span>Retourne, note-toi : le planning se règle tout seul</span></span></button>' +
               '<button class="mode" data-mode="written" ' +
               dis +
               '><span class="m-hz">笔</span><span><b>Écrit</b><span>Tape le pinyin ou le français, trace les 汉字</span></span></button>' +
               '<button class="mode" data-mode="discover" ' +
               dis +
               '><span class="m-hz">览</span><span><b>Découverte</b><span>Tout est visible, parcours tranquillement</span></span></button>' +
               "</div>" +
               '<div class="lib-foot"><button class="btn ghost" id="btn-packs">Gérer les packs</button></div>' +
               "</div>" +
               "</details>";

            if ($("btn-resume")) $("btn-resume").onclick = resumeSession;
            if ($("btn-resume-x"))
               $("btn-resume-x").onclick = () => {
                  clearSavedSession();
                  renderLearn();
               };
            if ($("btn-continue"))
               $("btn-continue").onclick = startSmartSession;
            root.querySelectorAll("[data-flt]").forEach(
               (b) =>
                  (b.onclick = () => {
                     hub.flt = b.dataset.flt;
                     if (hub.flt === "acq") hub.includeAcquired = true;
                     hub.freeOpen = true;
                     renderLearn();
                  }),
            );
            const panel = $("free-panel");
            panel.addEventListener("toggle", () => {
               hub.freeOpen = panel.open;
            });
            root.querySelectorAll("[data-dir]").forEach(
               (b) =>
                  (b.onclick = () => {
                     db.settings.direction = b.dataset.dir;
                     save();
                     renderLearn();
                  }),
            );
            root.querySelectorAll("[data-hflt]").forEach(
               (b) =>
                  (b.onclick = () => {
                     hub.flt = b.dataset.hflt;
                     if (hub.flt === "acq") hub.includeAcquired = true;
                     renderLearn();
                  }),
            );
            root.querySelectorAll("[data-size]").forEach(
               (b) =>
                  (b.onclick = () => {
                     db.settings.freeSize = +b.dataset.size;
                     save();
                     renderLearn();
                  }),
            );
            $("hub-pack").onchange = (e) => {
               hub.pack = e.target.value;
               renderLearn();
            };
            $("hub-cat").onchange = (e) => {
               hub.cat = e.target.value;
               renderLearn();
            };
            $("inc-acq").onchange = (e) => {
               hub.includeAcquired = e.target.checked;
               renderLearn();
            };
            root
               .querySelectorAll("[data-mode]")
               .forEach(
                  (b) => (b.onclick = () => startFreeSession(b.dataset.mode)),
               );
            $("btn-packs").onclick = openPacksSheet;
         }
