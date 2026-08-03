"use strict";

/* ================= bibliothèque (库) ================= */
         let lib = { q: "", flt: "all", cat: "", sort: "unit" };
         function libFiltered() {
            let list = db.cards.slice();
            const q = lib.q.trim();
            if (q) {
               const fq = flatten(q);
               list = list.filter(
                  (c) =>
                     c.hz.includes(q) ||
                     (fq &&
                        (flatten(c.py).includes(fq) ||
                           flatten(c.fr).includes(fq) ||
                           flatten(c.cat).includes(fq))),
               );
            }
            if (lib.flt === "fav") list = list.filter((c) => c.fav);
            else if (lib.flt === "due")
               list = list.filter((c) => c.due != null);
            else if (lib.flt === "acq") list = list.filter((c) => c.acquired);
            else if (lib.flt === "notacq")
               list = list.filter((c) => !c.acquired);
            if (lib.cat) list = list.filter((c) => c.cat === lib.cat);
            if (lib.sort === "unit") list.sort(unitSort);
            else if (lib.sort === "old")
               list.sort((a, b) => a.created - b.created);
            else if (lib.sort === "hz")
               list.sort((a, b) => a.hz.localeCompare(b.hz, "zh"));
            else if (lib.sort === "py")
               list.sort((a, b) => flatten(a.py).localeCompare(flatten(b.py)));
            else if (lib.sort === "fr")
               list.sort((a, b) => flatten(a.fr).localeCompare(flatten(b.fr)));
            else list.sort((a, b) => b.created - a.created);
            return list;
         }
         function rowHtml(c) {
            return (
               '<button class="row" data-id="' +
               c.id +
               '">' +
               '<span class="row-hz">' +
               esc(c.hz) +
               "</span>" +
               '<span class="row-mid"><span class="row-py">' +
               colorPinyin(c.py) +
               '</span><span class="row-fr">' +
               esc(c.fr) +
               "</span></span>" +
               '<span class="row-badges">' +
               (c.unit != null ? '<i class="b u">U' + c.unit + "</i>" : "") +
               (c.fav ? '<i class="b red">♥</i>' : "") +
               (c.due != null ? '<i class="b gold">⏱</i>' : "") +
               (c.acquired ? '<i class="b jade">✓</i>' : "") +
               "</span></button>"
            );
         }
         function updateLibList() {
            if (!$("lib-list")) return;
            const list = libFiltered();
            $("lib-count").textContent =
               list.length + " carte" + (list.length > 1 ? "s" : "");
            $("lib-list").innerHTML =
               list.map(rowHtml).join("") ||
               '<p class="sh-p">Rien ne correspond à ta recherche.</p>';
            document
               .querySelectorAll("#lib-list .row")
               .forEach(
                  (r) => (r.onclick = () => openCardDetail(r.dataset.id)),
               );
         }
         function renderLib() {
            const root = $("view");
            const cats = Array.from(
               new Set(db.cards.map((c) => c.cat).filter(Boolean)),
            ).sort((a, b) => a.localeCompare(b, "fr"));
            if (!db.cards.length) {
               root.innerHTML =
                  '<section class="lib-head" style="padding:6px 2px"><h2 class="v-t" style="margin:0">库 · Tes cartes</h2></section>' +
                  emptyHtml();
               wireEmpty();
               return;
            }
            const fltChip = (v, l) =>
               '<button class="chip" data-lflt="' +
               v +
               '" aria-pressed="' +
               String(lib.flt === v) +
               '">' +
               l +
               "</button>";
            root.innerHTML =
               '<section class="card pad">' +
               '<div class="lib-head"><h2 class="v-t" style="margin:0">库 · Tes cartes</h2><button class="seal-btn add" id="btn-add" aria-label="Nouvelle carte">加</button></div>' +
               '<input class="search" id="lib-q" placeholder="Rechercher (汉字, pinyin, français…)" value="' +
               esc(lib.q) +
               '" autocomplete="off">' +
               '<div class="chips" style="margin-top:10px">' +
               fltChip("all", "Tout") +
               fltChip("fav", "♥") +
               fltChip("due", "⏱") +
               fltChip("acq", "✓ Acquises") +
               fltChip("notacq", "À apprendre") +
               "</div>" +
               '<div class="selects">' +
               '<select class="search" id="lib-cat"><option value="">Toutes catégories</option>' +
               cats
                  .map(
                     (c) =>
                        '<option value="' +
                        esc(c) +
                        '"' +
                        (lib.cat === c ? " selected" : "") +
                        ">" +
                        esc(c) +
                        "</option>",
                  )
                  .join("") +
               "</select>" +
               '<select class="search" id="lib-sort">' +
               [
                  ["unit", "Ordre du cours"],
                  ["new", "Plus récentes"],
                  ["old", "Plus anciennes"],
                  ["hz", "汉字"],
                  ["py", "Pinyin A→Z"],
                  ["fr", "Français A→Z"],
               ]
                  .map(
                     (o) =>
                        '<option value="' +
                        o[0] +
                        '"' +
                        (lib.sort === o[0] ? " selected" : "") +
                        ">" +
                        o[1] +
                        "</option>",
                  )
                  .join("") +
               "</select>" +
               "</div>" +
               '<div class="eyebrow" id="lib-count"></div>' +
               '<div id="lib-list"></div>' +
               '<div class="lib-foot"><button class="btn ghost" id="btn-packs2">Gérer les packs</button></div>' +
               "</section>";
            $("btn-add").onclick = () => openCardForm(null);
            $("lib-q").oninput = (e) => {
               lib.q = e.target.value;
               updateLibList();
            };
            document.querySelectorAll("[data-lflt]").forEach(
               (b) =>
                  (b.onclick = () => {
                     lib.flt = b.dataset.lflt;
                     renderLib();
                  }),
            );
            $("lib-cat").onchange = (e) => {
               lib.cat = e.target.value;
               renderLib();
            };
            $("lib-sort").onchange = (e) => {
               lib.sort = e.target.value;
               renderLib();
            };
            $("btn-packs2").onclick = openPacksSheet;
            updateLibList();
         }

         /* -------- fiche carte -------- */
         function openCardDetail(id) {
            const c = db.cards.find((x) => x.id === id);
            if (!c) return;
            const status = [];
            if (c.acquired)
               status.push('<span class="b jade">✓ acquise</span>');
            else if (c.due != null)
               status.push(
                  '<span class="b gold">⏱ ' + fmtDate(c.due) + "</span>",
               );
            else status.push('<span class="b">à apprendre</span>');
            status.push('<span class="b u">Niveau ' + (c.lvl || 0) + "</span>");
            const packCk = db.packs.length
               ? '<div class="eyebrow">Packs</div>' +
                 db.packs
                    .map(
                       (p) =>
                          '<label class="ck"><input type="checkbox" data-pk="' +
                          p.id +
                          '"' +
                          (p.cardIds.includes(c.id) ? " checked" : "") +
                          "> " +
                          esc(p.name) +
                          "</label>",
                    )
                    .join("")
               : "";
            openSheet(
               '<div class="cd-head"><div class="cd-hz" data-say="' +
                  esc(c.hz) +
                  '">' +
                  esc(c.hz) +
                  '</div><button class="seal" data-say="' +
                  esc(c.hz) +
                  '" aria-label="Écouter">听</button></div>' +
                  (c.py
                     ? '<div class="cd-py">' + colorPinyin(c.py) + "</div>"
                     : "") +
                  '<div class="cd-fr">' +
                  esc(c.fr) +
                  "</div>" +
                  "<div>" +
                  (c.cat
                     ? '<span class="cd-cat">' + esc(c.cat) + "</span>"
                     : "") +
                  (c.unit != null
                     ? '<span class="cd-cat">U' +
                       c.unit +
                       " · " +
                       esc(unitName(c.unit)) +
                       "</span>"
                     : "") +
                  "</div>" +
                  (c.exHz ? exampleHtml(c) : "") +
                  noteHtml(c) +
                  '<div class="cd-status">' +
                  status.join(" ") +
                  "</div>" +
                  '<div class="acts" style="justify-content:flex-start">' +
                  '<button class="act' +
                  (c.fav ? " on" : "") +
                  '" id="cd-fav">♥ Favori</button>' +
                  '<button class="act" id="cd-hard">⏱ Programmer</button>' +
                  '<button class="act' +
                  (c.acquired ? " on jade" : "") +
                  '" id="cd-acq">✓ Acquise</button>' +
                  "</div>" +
                  packCk +
                  '<div class="sh-btns">' +
                  '<button class="btn" id="cd-edit">Modifier</button>' +
                  '<button class="btn danger" id="cd-del">Supprimer</button>' +
                  '<button class="btn ghost" id="cd-close">Fermer</button>' +
                  "</div>",
            );
            $("cd-fav").onclick = () => {
               c.fav = !c.fav;
               save();
               openCardDetail(id);
               updateLibList();
            };
            $("cd-acq").onclick = () => {
               c.acquired = !c.acquired;
               if (c.acquired) c.due = null;
               save();
               openCardDetail(id);
               updateLibList();
            };
            $("cd-hard").onclick = () =>
               openDelaySheet(c, () => {
                  openCardDetail(id);
                  updateLibList();
               });
            $("cd-edit").onclick = () => openCardForm(c);
            $("cd-del").onclick = () => {
               if (!confirm("Supprimer « " + c.hz + " » ?")) return;
               db.cards = db.cards.filter((x) => x.id !== id);
               db.packs.forEach((p) => {
                  p.cardIds = p.cardIds.filter((i) => i !== id);
               });
               invalidateDictIndex();
               save();
               closeSheet();
               refreshActive();
               toast("Carte supprimée.");
            };
            $("cd-close").onclick = closeSheet;
            document.querySelectorAll("#sheet [data-pk]").forEach(
               (ck) =>
                  (ck.onchange = (e) => {
                     const p = db.packs.find((p) => p.id === ck.dataset.pk);
                     if (!p) return;
                     if (e.target.checked) {
                        if (!p.cardIds.includes(c.id)) p.cardIds.push(c.id);
                     } else p.cardIds = p.cardIds.filter((i) => i !== c.id);
                     save();
                  }),
            );
         }

         /* -------- formulaire carte -------- */
         function openCardForm(c) {
            const existing = c ? db.cards.find((card) => card.id === c.id) : null;
            const cats = Array.from(
               new Set(db.cards.map((x) => x.cat).filter(Boolean)),
            ).sort((a, b) => a.localeCompare(b, "fr"));
            const val = (k) => esc(c ? (c[k] ?? "") : "");
            openSheet(
               '<h3 class="sh-t">' +
                  (existing ? "Modifier la carte" : "Nouvelle carte") +
                  "</h3>" +
                  '<label class="f-lab">Caractères 汉字 *<input class="search" id="fm-hz" value="' +
                  val("hz") +
                  '"></label>' +
                  '<label class="f-lab">Pinyin<input class="search" id="fm-py" value="' +
                  val("py") +
                  '" placeholder="ni3 hao3 ou nǐ hǎo" autocapitalize="off"></label>' +
                  '<label class="f-lab">Français *<input class="search" id="fm-fr" value="' +
                  val("fr") +
                  '"></label>' +
                  '<label class="f-lab">Catégorie<input class="search" id="fm-cat" list="cats-dl" value="' +
                  val("cat") +
                  '"><datalist id="cats-dl">' +
                  cats.map((x) => '<option value="' + esc(x) + '">').join("") +
                  "</datalist></label>" +
                  '<label class="f-lab">Exemple 中文<input class="search" id="fm-exhz" value="' +
                  val("exHz") +
                  '"></label>' +
                  '<label class="f-lab">Exemple pinyin<input class="search" id="fm-expy" value="' +
                  val("exPy") +
                  '" autocapitalize="off"></label>' +
                  '<label class="f-lab">Exemple français<input class="search" id="fm-exfr" value="' +
                  val("exFr") +
                  '"></label>' +
                  '<label class="f-lab">Note (prononciation, nuance…)<input class="search" id="fm-note" value="' +
                  val("note") +
                  '"></label>' +
                  '<div class="sh-btns"><button class="btn primary" id="fm-save">Enregistrer</button><button class="btn ghost" id="fm-cancel">Annuler</button></div>',
            );
            $("fm-cancel").onclick = closeSheet;
            $("fm-save").onclick = () => {
               const hz = $("fm-hz").value.trim();
               const fr = $("fm-fr").value.trim();
               if (!hz || !fr) {
                  toast("Caractères et français sont obligatoires.");
                  return;
               }
               const py = numToAccent($("fm-py").value.trim());
               const key = hz + "§" + flatten(py);
               const dup = db.cards.find(
                  (x) => cardKey(x) === key && (!c || x.id !== c.id),
               );
               if (dup) {
                  toast(
                     "« " +
                        hz +
                        " » (" +
                        (py || "sans pinyin") +
                        ") existe déjà.",
                  );
                  return;
               }
               const fields = {
                  hz,
                  fr,
                  py,
                  cat: $("fm-cat").value.trim(),
                  exHz: $("fm-exhz").value.trim(),
                  exPy: numToAccent($("fm-expy").value.trim()),
                  exFr: $("fm-exfr").value.trim(),
                  note: $("fm-note").value.trim(),
               };
               if (existing) Object.assign(existing, fields);
               else db.cards.push(normalizeCard(fields, false));
               invalidateDictIndex();
               save();
               closeSheet();
               refreshActive();
               toast(existing ? "Carte modifiée." : "Carte ajoutée.");
            };
         }

         /* -------- packs -------- */
         function upsertPack(name, ids) {
            let p = db.packs.find(
               (p) => p.name.toLowerCase() === name.toLowerCase(),
            );
            if (!p) {
               p = { id: uid(), name, cardIds: [] };
               db.packs.push(p);
            }
            const set = new Set(p.cardIds);
            ids.forEach((id) => set.add(id));
            p.cardIds = Array.from(set);
            return p;
         }
         function openPacksSheet() {
            const rows =
               db.packs
                  .map((p) => {
                     const n = p.cardIds.filter((id) =>
                        db.cards.some((c) => c.id === id),
                     ).length;
                     return (
                        '<div class="pk-row">' +
                        '<div class="pk-info"><b>' +
                        esc(p.name) +
                        "</b><span>" +
                        n +
                        " carte" +
                        (n > 1 ? "s" : "") +
                        "</span></div>" +
                        '<div class="pk-btns">' +
                        '<button class="btn sm" data-rev="' +
                        p.id +
                        '">Réviser</button>' +
                        '<button class="btn sm ghost" data-ren="' +
                        p.id +
                        '">Renommer</button>' +
                        '<button class="btn sm danger" data-del="' +
                        p.id +
                        '">✕</button>' +
                        "</div></div>"
                     );
                  })
                  .join("") ||
               "<p class=\"sh-p\">Aucun pack pour l'instant. Importe un fichier JSON avec un « name », ou crée un pack ici puis coche-le depuis la fiche d'une carte.</p>";
            openSheet(
               '<h3 class="sh-t">Packs</h3>' +
                  rows +
                  '<div class="pk-new"><input class="search" id="pk-name" placeholder="Nom du nouveau pack"><button class="btn" id="pk-create">Créer</button></div>' +
                  '<button class="btn ghost wide" id="pk-close">Fermer</button>',
            );
            document.querySelectorAll("#sheet [data-rev]").forEach(
               (b) =>
                  (b.onclick = () => {
                     hub.pack = b.dataset.rev;
                     hub.flt = "all";
                     hub.freeOpen = true;
                     closeSheet();
                     setView("learn");
                  }),
            );
            document.querySelectorAll("#sheet [data-ren]").forEach(
               (b) =>
                  (b.onclick = () => {
                     const p = db.packs.find((p) => p.id === b.dataset.ren);
                     if (!p) return;
                     const name = prompt("Nouveau nom du pack :", p.name);
                     if (name && name.trim()) {
                        p.name = name.trim();
                        save();
                        openPacksSheet();
                     }
                  }),
            );
            document.querySelectorAll("#sheet [data-del]").forEach(
               (b) =>
                  (b.onclick = () => {
                     const p = db.packs.find((p) => p.id === b.dataset.del);
                     if (!p) return;
                     if (
                        !confirm(
                           "Supprimer le pack « " +
                              p.name +
                              " » ? (les cartes sont conservées)",
                        )
                     )
                        return;
                     db.packs = db.packs.filter((x) => x.id !== p.id);
                     if (hub.pack === p.id) hub.pack = "";
                     save();
                     openPacksSheet();
                  }),
            );
            $("pk-create").onclick = () => {
               const name = $("pk-name").value.trim();
               if (!name) {
                  toast("Donne un nom au pack.");
                  return;
               }
               if (
                  db.packs.some(
                     (p) => p.name.toLowerCase() === name.toLowerCase(),
                  )
               ) {
                  toast("Ce pack existe déjà.");
                  return;
               }
               db.packs.push({ id: uid(), name, cardIds: [] });
               save();
               openPacksSheet();
            };
            $("pk-close").onclick = closeSheet;
         }
