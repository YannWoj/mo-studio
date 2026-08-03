"use strict";

/* ================= écoute (听) ================= */
         // vraies paires minimales : la synthèse lit un caractère chinois, jamais du pinyin latin
         const TONE_SETS = [
            {
               syl: "ma",
               items: [
                  ["妈", "mā", "maman"],
                  ["麻", "má", "le chanvre"],
                  ["马", "mǎ", "le cheval"],
                  ["骂", "mà", "gronder"],
               ],
            },
            {
               syl: "ba",
               items: [
                  ["八", "bā", "huit"],
                  ["拔", "bá", "arracher"],
                  ["把", "bǎ", "saisir"],
                  ["爸", "bà", "papa"],
               ],
            },
            {
               syl: "shu",
               items: [
                  ["书", "shū", "le livre"],
                  ["熟", "shú", "cuit, mûr"],
                  ["属", "shǔ", "appartenir à"],
                  ["树", "shù", "l'arbre"],
               ],
            },
            {
               syl: "tang",
               items: [
                  ["汤", "tāng", "la soupe"],
                  ["糖", "táng", "le sucre"],
                  ["躺", "tǎng", "s'allonger"],
                  ["烫", "tàng", "brûlant"],
               ],
            },
            {
               syl: "yao",
               items: [
                  ["腰", "yāo", "la taille (du corps)"],
                  ["摇", "yáo", "secouer"],
                  ["咬", "yǎo", "mordre"],
                  ["药", "yào", "le médicament"],
               ],
            },
            {
               syl: "wen",
               items: [
                  ["温", "wēn", "tiède"],
                  ["文", "wén", "l'écrit"],
                  ["吻", "wěn", "le baiser"],
                  ["问", "wèn", "demander"],
               ],
            },
            {
               syl: "yan",
               items: [
                  ["烟", "yān", "la fumée"],
                  ["盐", "yán", "le sel"],
                  ["眼", "yǎn", "l'œil"],
                  ["厌", "yàn", "détester"],
               ],
            },
            {
               syl: "qing",
               items: [
                  ["清", "qīng", "clair, pur"],
                  ["情", "qíng", "le sentiment"],
                  ["请", "qǐng", "s'il te plaît"],
                  ["庆", "qìng", "fêter"],
               ],
            },
         ];
         let toneRound = null,
            wordRound = null;
         function renderListen() {
            const root = $("view");
            const enough = db.cards.length >= 4;
            const lvlChip = (v, l) =>
               '<button class="chip" data-llvl="' +
               v +
               '" aria-pressed="' +
               String(db.settings.listenLevel === v) +
               '">' +
               l +
               "</button>";
            root.innerHTML =
               '<section class="card pad">' +
               '<h2 class="v-t">听 · Le drill des tons</h2>' +
               '<p class="muted">Écoute un vrai caractère et retrouve son ton : <span class="tn t1">ā</span> <span class="tn t2">á</span> <span class="tn t3">ǎ</span> <span class="tn t4">à</span>.</p>' +
               '<div class="listen-center"><button class="seal lg" id="tone-play" aria-label="Écouter">听</button></div>' +
               '<div class="opts" id="tone-grid"></div>' +
               '<div class="w-note" id="tone-note" style="text-align:center"></div>' +
               '<div class="drill-foot"><button class="btn primary" id="tone-go" hidden>Continuer</button></div>' +
               "</section>" +
               '<section class="card pad">' +
               '<h2 class="v-t">Reconnaître les mots</h2>' +
               (enough
                  ? '<p class="muted">Écoute puis retrouve le mot. Choisis ton niveau d\'aide :</p>' +
                    '<div class="chips" style="margin-bottom:6px">' +
                    lvlChip(1, "汉字 + FR") +
                    lvlChip(2, "汉字 seuls") +
                    lvlChip(3, "Français seul") +
                    "</div>" +
                    '<div class="listen-center"><button class="seal lg" id="word-play" aria-label="Écouter">听</button></div>' +
                    '<div class="opts" id="word-grid"></div>' +
                    '<div class="w-note" id="word-note" style="text-align:center"></div>' +
                    '<div class="drill-foot"><button class="btn primary" id="word-go" hidden>Continuer</button></div>'
                  : '<p class="sh-p">Il te faut au moins 4 cartes pour cet exercice.</p>') +
               "</section>";
            newToneRound(false);
            $("tone-play").onclick = () => {
               if (toneRound) speak(toneRound.target[0]);
            };
            if (enough) {
               document.querySelectorAll("[data-llvl]").forEach(
                  (b) =>
                     (b.onclick = () => {
                        db.settings.listenLevel = +b.dataset.llvl;
                        save();
                        renderListen();
                     }),
               );
               newWordRound(false);
               $("word-play").onclick = () => {
                  if (wordRound) speak(wordRound.target.hz);
               };
            }
         }
         function newToneRound(play) {
            const grid = $("tone-grid");
            if (!grid) return;
            const set = TONE_SETS[Math.floor(Math.random() * TONE_SETS.length)];
            const tone = 1 + Math.floor(Math.random() * 4);
            toneRound = { set, tone, target: set.items[tone - 1], done: false };
            grid.innerHTML = [1, 2, 3, 4]
               .map(
                  (t) =>
                     '<button class="opt" data-t="' +
                     t +
                     '"><span class="tn t' +
                     t +
                     '">' +
                     numToAccent(set.syl + t) +
                     "</span></button>",
               )
               .join("");
            $("tone-note").textContent =
               "Appuie sur le sceau, puis choisis le ton entendu.";
            $("tone-go").hidden = true;
            grid.querySelectorAll(".opt").forEach(
               (b) =>
                  (b.onclick = () => {
                     if (toneRound.done) return;
                     toneRound.done = true;
                     const t = +b.dataset.t;
                     const okBtn = grid.querySelector(
                        '[data-t="' + toneRound.tone + '"]',
                     );
                     if (okBtn) okBtn.classList.add("ok");
                     const tg = toneRound.target;
                     if (t === toneRound.tone)
                        $("tone-note").textContent =
                           "✓ Juste ! C'était " +
                           tg[0] +
                           " " +
                           tg[1] +
                           " — " +
                           tg[2] +
                           ".";
                     else {
                        b.classList.add("ko");
                        $("tone-note").textContent =
                           "✗ C'était le ton " +
                           toneRound.tone +
                           " : " +
                           tg[0] +
                           " " +
                           tg[1] +
                           " — " +
                           tg[2] +
                           ".";
                     }
                     $("tone-go").hidden = false;
                  }),
            );
            $("tone-go").onclick = () => newToneRound(true);
            if (play) speak(toneRound.target[0]);
         }
         function pickDistractors(target, pool) {
            // pièges intelligents : syllabes proches, même initiale, même nombre de syllabes
            const sylCount = (s) =>
               String(s || "")
                  .trim()
                  .split(/\s+/)
                  .filter(Boolean).length;
            const tN = sylCount(target.py);
            const tIni = (flatten(target.py) || "")[0] || "";
            const tSyls = new Set(
               String(target.py || "")
                  .toLowerCase()
                  .split(/\s+/)
                  .map((x) => flatten(x))
                  .filter(Boolean),
            );
            return pool
               .filter((c) => c.id !== target.id)
               .map((c) => {
                  let s = Math.random();
                  if (sylCount(c.py) === tN) s += 2;
                  if (((flatten(c.py) || "")[0] || "") === tIni) s += 2;
                  if (
                     String(c.py || "")
                        .toLowerCase()
                        .split(/\s+/)
                        .some((x) => tSyls.has(flatten(x)))
                  )
                     s += 1.5;
                  if (c.cat && c.cat === target.cat) s += 1;
                  return [s, c];
               })
               .sort((a, b) => b[0] - a[0])
               .slice(0, 6)
               .map((x) => x[1])
               .sort(() => Math.random() - 0.5)
               .slice(0, 3);
         }
         function newWordRound(play) {
            const grid = $("word-grid");
            if (!grid || db.cards.length < 4) return;
            const target =
               db.cards[Math.floor(Math.random() * db.cards.length)];
            const opts = shuffle(
               [target].concat(pickDistractors(target, db.cards)),
            );
            wordRound = { target, done: false };
            const lvl = db.settings.listenLevel;
            grid.innerHTML = opts
               .map(
                  (c) =>
                     '<button class="opt" data-id="' +
                     c.id +
                     '">' +
                     (lvl !== 3
                        ? '<span class="o-hz">' + esc(c.hz) + "</span>"
                        : '<span class="o-hz" style="font-size:16px;font-family:var(--ui)">' +
                          esc(c.fr) +
                          "</span>") +
                     (lvl === 1
                        ? '<span class="o-fr">' + esc(c.fr) + "</span>"
                        : "") +
                     "</button>",
               )
               .join("");
            $("word-note").textContent =
               "Appuie sur le sceau, puis choisis le mot entendu.";
            $("word-go").hidden = true;
            grid.querySelectorAll(".opt").forEach(
               (b) =>
                  (b.onclick = () => {
                     if (wordRound.done) return;
                     wordRound.done = true;
                     const okBtn = grid.querySelector(
                        '[data-id="' + wordRound.target.id + '"]',
                     );
                     if (okBtn) okBtn.classList.add("ok");
                     const tg = wordRound.target;
                     if (b.dataset.id === tg.id)
                        $("word-note").textContent =
                           "✓ Juste ! " + tg.hz + " (" + tg.py + ") · " + tg.fr;
                     else {
                        b.classList.add("ko");
                        const picked = db.cards.find(
                           (c) => c.id === b.dataset.id,
                        );
                        $("word-note").textContent =
                           "✗ C'était " +
                           tg.hz +
                           " (" +
                           tg.py +
                           ") · " +
                           tg.fr +
                           (picked
                              ? " — tu as choisi " +
                                picked.hz +
                                " (" +
                                picked.py +
                                ")."
                              : ".");
                     }
                     $("word-go").hidden = false;
                  }),
            );
            $("word-go").onclick = () => newWordRound(true);
            if (play) speak(target.hz);
         }
