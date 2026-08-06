"use strict";

/* ================= réglages ================= */
         function openSettings() {
            refreshVoices();
            const s = db.settings;
            const backup = getBackup();
            const vopts =
               '<option value="">Voix automatique</option>' +
               voices
                  .map(
                     (v) =>
                        '<option value="' +
                        esc(v.voiceURI) +
                        '"' +
                        (s.voice === v.voiceURI ? " selected" : "") +
                        ">" +
                        esc(v.name) +
                        "</option>",
                  )
                  .join("");
            const pyChip = (v, l) =>
               '<button class="chip" data-py="' +
               v +
               '" aria-pressed="' +
               String(s.pinyin === v) +
               '">' +
               l +
               "</button>";
            openSheet(
               '<h3 class="sh-t">设 · Réglages</h3>' +
                  '<section class="settings-group" aria-labelledby="settings-review-title">' +
                  '<div class="eyebrow" id="settings-review-title">Pendant la révision</div>' +
                  '<p class="sh-note settings-group-help">Ce qui s’affiche et ce qu’on te demande de faire sur chaque carte pendant une révision.</p>' +
                  '<div class="settings-field-title">Pinyin</div>' +
                  '<div class="chips" id="st-py">' +
                  pyChip("always", "Toujours") +
                  pyChip("reveal", "Au verso") +
                  pyChip("never", "Jamais") +
                  "</div>" +
                  '<label class="ck settings-tone-colors"><input type="checkbox" id="st-col"' +
                  (s.toneColors ? " checked" : "") +
                  "> Colorer les tons</label>" +
                  '<div class="settings-field-title">Exercices écrits</div>' +
                  '<label class="ck"><input type="checkbox" id="wm-py"' +
                  (s.writeModes.pinyin ? " checked" : "") +
                  "> Taper le pinyin</label>" +
                  '<label class="ck"><input type="checkbox" id="wm-fr"' +
                  (s.writeModes.fr ? " checked" : "") +
                  "> Taper le français</label>" +
                  '<label class="ck"><input type="checkbox" id="wm-tr"' +
                  (s.writeModes.trace ? " checked" : "") +
                  "> Tracer les caractères</label>" +
                  "</section>" +
                  '<section class="settings-group" aria-labelledby="settings-audio-title">' +
                  '<div class="eyebrow" id="settings-audio-title">Audio</div>' +
                  '<p class="sh-note settings-group-help">Utilisé partout où tu vois le bouton 听 (écouter).</p>' +
                  '<label class="f-lab">Vitesse · <span id="rate-lab">' +
                  s.rate.toFixed(2) +
                  '×</span><input type="range" id="st-rate" min="0.5" max="1.2" step="0.05" value="' +
                  s.rate +
                  '"></label>' +
                  '<label class="f-lab">Voix chinoise<select class="search" id="st-voice">' +
                  vopts +
                  "</select></label>" +
                  (voices.length
                     ? ""
                     : '<p class="sh-note">Aucune voix chinoise détectée. Installe une voix « Chinois (Chine) » dans ton système pour activer l\'audio.</p>') +
                  "</section>" +
                  '<section class="settings-group" aria-labelledby="settings-data-title">' +
                  '<div class="eyebrow" id="settings-data-title">Données</div>' +
                  '<p class="sh-note settings-group-help">Sauvegarde ou recharge tes mots et packs personnels.</p>' +
                  '<div class="sh-btns settings-data-actions">' +
                  '<button class="btn" id="st-import">Importer</button>' +
                  '<button class="btn" id="st-export">Exporter</button>' +
                  '<button class="btn ghost" id="st-format">Voir le format JSON</button>' +
                  '<button class="btn ghost" id="st-dictionary-sources">Sources du dictionnaire</button>' +
                  "</div>" +
                  (backup
                     ? '<button class="btn wide" id="st-restore">Restaurer la sauvegarde du ' +
                       fmtDate(backup.ts) +
                       "</button>"
                     : "") +
                  "</section>" +
                  '<section class="settings-group settings-danger-zone" aria-labelledby="settings-danger-title">' +
                  '<div class="eyebrow" id="settings-danger-title">Zone dangereuse</div>' +
                  '<p class="sh-note settings-group-help">Supprime tes cartes, packs et progression. Une sauvegarde de secours est créée automatiquement et restera restaurable ici.</p>' +
                  '<button class="btn danger wide" id="st-reset">Tout effacer</button>' +
                  "</section>" +
                  '<button class="btn ghost wide settings-close" id="st-close">Fermer</button>',
            );
            document.querySelectorAll("#st-py .chip").forEach(
               (b) =>
                  (b.onclick = () => {
                     s.pinyin = b.dataset.py;
                     save();
                     document
                        .querySelectorAll("#st-py .chip")
                        .forEach((x) =>
                           x.setAttribute(
                              "aria-pressed",
                              String(x.dataset.py === s.pinyin),
                           ),
                        );
                  }),
            );
            $("st-col").onchange = (e) => {
               s.toneColors = e.target.checked;
               save();
            };
            $("st-rate").oninput = (e) => {
               s.rate = +e.target.value;
               $("rate-lab").textContent = s.rate.toFixed(2) + "×";
               save();
            };
            $("st-voice").onchange = (e) => {
               s.voice = e.target.value;
               save();
               speak("你好");
            };
            ["wm-py", "wm-fr", "wm-tr"].forEach((id) => {
               $(id).onchange = () => {
                  const py = $("wm-py").checked,
                     fr = $("wm-fr").checked,
                     tr = $("wm-tr").checked;
                  if (!py && !fr && !tr) {
                     $(id).checked = true;
                     toast("Garde au moins un type d'exercice écrit.");
                     return;
                  }
                  s.writeModes = { pinyin: py, fr: fr, trace: tr };
                  save();
               };
            });
            $("st-export").onclick = exportData;
            $("st-import").onclick = () => $("file-global").click();
            $("st-format").onclick = openFormatSheet;
            $("st-dictionary-sources").onclick = openDictionarySources;
            if ($("st-restore"))
               $("st-restore").onclick = () => {
                  const b = getBackup();
                  if (!b) {
                     toast("Aucune sauvegarde trouvée.");
                     return;
                  }
                  if (
                     !confirm(
                        "Restaurer la sauvegarde du " +
                           fmtDate(b.ts) +
                           " ? Ta collection actuelle sera remplacée.",
                     )
                  )
                     return;
                  db.cards = b.cards
                     .map((c) => normalizeCard(c, true))
                     .filter(Boolean);
                  db.packs = Array.isArray(b.packs) ? b.packs : [];
                  db.categories = Array.isArray(b.categories) ? b.categories : [];
                  db.memberships = Array.isArray(b.memberships) ? b.memberships : [];
                  db.units =
                     b.units && typeof b.units === "object" ? b.units : {};
                  session = { active: false };
                  clearSavedSession();
                  invalidateDictIndex();
                  save();
                  closeSheet();
                  refreshActive();
                  toast("Sauvegarde restaurée.");
               };
            $("st-reset").onclick = () => {
               if (
                  !confirm(
                     "Tout effacer ? Cartes, packs et progression seront supprimés (réglages conservés).\nUne sauvegarde sera gardée, restaurable depuis les réglages.",
                  )
               )
                  return;
               makeBackup();
               db.cards = [];
               db.packs = [];
               db.categories = [];
               db.memberships = [];
               db.units = {};
               hub = {
                  flt: "all",
                  pack: "",
                  cat: "",
                  includeAcquired: false,
                  freeOpen: false,
               };
               session = { active: false };
               clearSavedSession();
               invalidateDictIndex();
               save();
               closeSheet();
               refreshActive();
               toast(
                  "Collection effacée (sauvegarde disponible dans les réglages).",
               );
            };
            $("st-close").onclick = () => {
               closeSheet();
               refreshActive();
            };
         }
