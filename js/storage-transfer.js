"use strict";

/* ================= import / export ================= */
         function exportData() {
            const data = {
               app: "mo-studio",
               version: 3,
               exported: new Date().toISOString(),
               units: db.units,
               cards: db.cards,
               packs: db.packs,
               categories: db.categories,
               memberships: db.memberships,
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
            if (
               data &&
               typeof data === "object" &&
               (data.pack || (Array.isArray(data.packs) && data.packs.some((pack) => Array.isArray(pack.categories))))
            ) {
               openSheet('<h3 class="sh-t">Analyse de la sauvegarde</h3><p class="sh-p">Préparation d’un aperçu non destructif…</p><div class="import-loading"></div>');
               buildPackImportPreview(data, "json")
                  .then(openPackImportPreview)
                  .catch((error) => toast(error.message));
               return;
            }
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
               db.categories =
                  !Array.isArray(data) && Array.isArray(data.categories)
                     ? data.categories.filter((category) => category && category.id && category.packId && category.name)
                     : [];
               db.memberships =
                  !Array.isArray(data) && Array.isArray(data.memberships)
                     ? data.memberships.filter((membership) => membership && membership.cardId && membership.categoryId)
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
         const FORMAT_CARD_EXAMPLE =
            '{\n  "chinese": "你好",\n  "pinyin": "nǐ hǎo",\n  "translation": "bonjour"\n}';
         const FORMAT_PACK_EXAMPLE = PACK_JSON_EXAMPLE;

         async function copyFormatExample() {
            try {
               if (!navigator.clipboard || !navigator.clipboard.writeText)
                  throw new Error("Clipboard unavailable");
               await navigator.clipboard.writeText(FORMAT_PACK_EXAMPLE);
               toast("Exemple copié.");
            } catch (error) {
               toast("Copie impossible ici — sélectionne le texte à la main.");
            }
         }

         function openFormatSheet() {
            openSheet(
               '<h3 class="sh-t">Format JSON des packs</h3>' +
                  '<p class="sh-p">Chaque mot demande uniquement <code>chinese</code>. <code>pinyin</code>, <code>translation</code>, <code>notes</code>, <code>favorite</code>, <code>difficult</code> et <code>tags</code> sont optionnels. Les données manquantes sont recherchées dans le dictionnaire sans jamais être inventées.</p>' +
                  '<div class="eyebrow">Exemple minimal valide</div>' +
                  '<pre class="fmt" id="fmt-card-example">' +
                  esc(FORMAT_CARD_EXAMPLE) +
                  "</pre>" +
                  '<p class="sh-p">Un pack contient des <code>categories</code>, chacune avec un tableau <code>words</code>. Le format historique reste accepté depuis Réglages → Données.</p>' +
                  '<div class="eyebrow">Exemple de pack</div>' +
                  '<pre class="fmt" id="fmt-pack-example">' +
                  esc(FORMAT_PACK_EXAMPLE) +
                  "</pre>" +
                  '<div class="sh-btns">' +
                  '<button class="btn" id="fmt-copy">Copier l\'exemple</button>' +
                  '<button class="btn ghost" id="fmt-close" data-sheet-close>Fermer</button>' +
                  "</div>",
            );
            $("fmt-copy").onclick = copyFormatExample;
            $("fmt-close").onclick = closeSheet;
         }
