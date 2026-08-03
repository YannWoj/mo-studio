"use strict";

/* ================= import / export ================= */
         function exportData() {
            const data = {
               app: "mo-studio",
               version: 2,
               exported: new Date().toISOString(),
               units: db.units,
               cards: db.cards,
               packs: db.packs,
               settings: db.settings,
            };
            const blob = new Blob([JSON.stringify(data, null, 2)], {
               type: "application/json",
            });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = "mo-studio-export.json";
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(a.href), 5000);
            toast("Export téléchargé.");
         }
         function openImportSheet(data) {
            const rawCards = Array.isArray(data)
               ? data
               : Array.isArray(data.cards)
                 ? data.cards
                 : [];
            const incoming = rawCards
               .map((c) => normalizeCard(c, false))
               .filter(Boolean);
            if (!incoming.length) {
               toast(
                  "Aucune carte valide dans ce fichier (hz et fr obligatoires).",
               );
               return;
            }
            const name =
               !Array.isArray(data) && typeof data.name === "string"
                  ? data.name.trim()
                  : "";
            const existing = new Set(db.cards.map(cardKey));
            const fresh = incoming.filter((c) => !existing.has(cardKey(c)));
            const dupN = incoming.length - fresh.length;
            openSheet(
               '<h3 class="sh-t">Importer ' +
                  incoming.length +
                  " carte" +
                  (incoming.length > 1 ? "s" : "") +
                  "</h3>" +
                  '<p class="sh-p">' +
                  fresh.length +
                  " nouvelle" +
                  (fresh.length > 1 ? "s" : "") +
                  " · " +
                  dupN +
                  " déjà présente" +
                  (dupN > 1 ? "s" : "") +
                  " (mêmes 汉字 + pinyin).</p>" +
                  (name
                     ? '<label class="ck"><input type="checkbox" id="im-pack" checked> Créer / compléter le pack « ' +
                       esc(name) +
                       " »</label>"
                     : "") +
                  '<div class="sh-btns">' +
                  '<button class="btn primary" id="im-merge">Fusionner</button>' +
                  '<button class="btn danger" id="im-replace">Remplacer tout</button>' +
                  '<button class="btn ghost" id="im-cancel">Annuler</button>' +
                  "</div>" +
                  '<p class="sh-note">« Fusionner » ajoute seulement les nouvelles cartes. « Remplacer tout » écrase cartes et packs (réglages conservés, sauvegarde automatique avant).</p>',
            );
            $("im-cancel").onclick = closeSheet;
            $("im-merge").onclick = () =>
               doImport(data, incoming, fresh, name, false);
            $("im-replace").onclick = () => {
               if (
                  confirm(
                     "Remplacer toute ta collection ? (une sauvegarde sera gardée)",
                  )
               )
                  doImport(data, incoming, fresh, name, true);
            };
         }
         function doImport(data, incoming, fresh, name, replace) {
            const wantPack = !!(name && $("im-pack") && $("im-pack").checked);
            session = { active: false };
            clearSavedSession();
            hub.pack = "";
            hub.cat = "";
            const inUnits =
               !Array.isArray(data) &&
               data.units &&
               typeof data.units === "object" &&
               !Array.isArray(data.units)
                  ? data.units
                  : null;
            if (replace) {
               makeBackup();
               const raw = Array.isArray(data)
                  ? incoming
                  : Array.isArray(data.cards)
                    ? data.cards
                    : incoming;
               let cards = raw
                  .map((c) => normalizeCard(c, true))
                  .filter(Boolean);
               const seen = new Set();
               cards = cards.filter((c) => {
                  const k = cardKey(c);
                  if (seen.has(k)) return false;
                  seen.add(k);
                  return true;
               });
               db.cards = cards;
               const ids = new Set(cards.map((c) => c.id));
               db.packs =
                  !Array.isArray(data) && Array.isArray(data.packs)
                     ? data.packs
                          .filter(
                             (p) => p && p.name && Array.isArray(p.cardIds),
                          )
                          .map((p) => ({
                             id: String(p.id || uid()),
                             name: String(p.name),
                             cardIds: p.cardIds.filter((i) => ids.has(i)),
                          }))
                     : [];
               db.units = inUnits || {};
            } else {
               db.cards = db.cards.concat(fresh);
               if (inUnits) db.units = Object.assign({}, db.units, inUnits);
            }
            const added = replace ? db.cards.length : fresh.length;
            if (wantPack) {
               const byKey = new Map(db.cards.map((c) => [cardKey(c), c.id]));
               const idsForPack = incoming
                  .map((c) => byKey.get(cardKey(c)))
                  .filter(Boolean);
               upsertPack(name, idsForPack);
            }
            invalidateDictIndex();
            save();
            closeSheet();
            refreshActive();
            toast(
               replace
                  ? "Collection remplacée (" + added + " cartes)."
                  : added
                    ? added +
                      " carte" +
                      (added > 1 ? "s" : "") +
                      " ajoutée" +
                      (added > 1 ? "s" : "") +
                      "."
                    : "Rien à ajouter — tout existait déjà.",
            );
         }
         const FORMAT_EXAMPLE =
            '{\n  "version": 2,\n  "name": "HSK 2",\n  "units": { "1": "Ma première unité" },\n  "cards": [\n    {\n      "hz": "唱歌",\n      "py": "chang4 ge1",\n      "fr": "chanter",\n      "cat": "Verbes",\n      "unit": 1,\n      "order": 1,\n      "exHz": "我喜欢唱歌。",\n      "exPy": "wo3 xi3 huan5 chang4 ge1.",\n      "exFr": "J\'aime chanter.",\n      "note": ""\n    }\n  ]\n}';
         function openFormatSheet() {
            openSheet(
               '<h3 class="sh-t">Format JSON des packs</h3>' +
                  "<p class=\"sh-p\"><b>hz</b> et <b>fr</b> sont obligatoires. <b>py</b> accepte les tons en chiffres (ai4) ou en accents (ài). <b>cat</b>, <b>exHz</b>, <b>exPy</b>, <b>exFr</b>, <b>note</b> sont optionnels. <b>unit</b> + <b>order</b> définissent l'ordre d'apprentissage (les nouvelles cartes arrivent dans cet ordre), et <b>units</b> donne un nom à chaque unité. Le champ <b>name</b> crée le pack automatiquement à l'import.</p>" +
                  '<pre class="fmt" id="fmt-pre">' +
                  esc(FORMAT_EXAMPLE) +
                  "</pre>" +
                  '<div class="sh-btns">' +
                  '<button class="btn" id="fmt-copy">Copier l\'exemple</button>' +
                  '<button class="btn ghost" id="fmt-close">Fermer</button>' +
                  "</div>",
            );
            $("fmt-copy").onclick = () => {
               const done = () => toast("Exemple copié.");
               if (navigator.clipboard && navigator.clipboard.writeText)
                  navigator.clipboard
                     .writeText(FORMAT_EXAMPLE)
                     .then(done, () => toast("Copie impossible ici."));
               else
                  toast(
                     "Copie impossible ici — sélectionne le texte à la main.",
                  );
            };
            $("fmt-close").onclick = closeSheet;
         }
