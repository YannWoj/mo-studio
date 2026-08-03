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
            const selOpt = (arr, cur) =>
               arr
                  .map(
                     (o) =>
                        '<option value="' +
                        o[0] +
                        '"' +
                        (cur === o[0] ? " selected" : "") +
                        ">" +
                        o[1] +
                        "</option>",
                  )
                  .join("");
            openSheet(
               '<h3 class="sh-t">设 · Réglages</h3>' +
                  '<div class="eyebrow" style="margin-top:6px">Séance « Continuer »</div>' +
                  '<label class="f-lab">Taille maximale<select class="search" id="st-size">' +
                  selOpt(
                     [
                        [10, "10 cartes"],
                        [15, "15 cartes"],
                        [20, "20 cartes"],
                        [30, "30 cartes"],
                        [0, "Tout ce qui est dû"],
                     ],
                     s.sessionSize,
                  ) +
                  "</select></label>" +
                  '<label class="f-lab">Nouvelles cartes par séance<select class="search" id="st-new">' +
                  selOpt(
                     [
                        [0, "0"],
                        [3, "3"],
                        [5, "5"],
                        [10, "10"],
                     ],
                     s.newPerSession,
                  ) +
                  "</select></label>" +
                  '<div class="eyebrow">Pinyin</div>' +
                  '<div class="chips" id="st-py">' +
                  pyChip("always", "Toujours") +
                  pyChip("reveal", "Au verso") +
                  pyChip("never", "Jamais") +
                  "</div>" +
                  '<label class="ck" style="margin-top:8px"><input type="checkbox" id="st-col"' +
                  (s.toneColors ? " checked" : "") +
                  "> Colorer les tons</label>" +
                  '<div class="eyebrow">Audio</div>' +
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
                  '<div class="eyebrow">Exercices écrits</div>' +
                  '<label class="ck"><input type="checkbox" id="wm-py"' +
                  (s.writeModes.pinyin ? " checked" : "") +
                  "> Taper le pinyin</label>" +
                  '<label class="ck"><input type="checkbox" id="wm-fr"' +
                  (s.writeModes.fr ? " checked" : "") +
                  "> Taper le français</label>" +
                  '<label class="ck"><input type="checkbox" id="wm-tr"' +
                  (s.writeModes.trace ? " checked" : "") +
                  "> Tracer les caractères</label>" +
                  '<div class="eyebrow">Données</div>' +
                  '<div class="sh-btns">' +
                  '<button class="btn" id="st-export">Exporter</button>' +
                  '<button class="btn" id="st-import">Importer</button>' +
                  '<button class="btn ghost" id="st-format">Format JSON</button>' +
                  '<button class="btn ghost" id="st-dictionary-sources">Sources du dictionnaire</button>' +
                  "</div>" +
                  (backup
                     ? '<button class="btn wide" id="st-restore">Restaurer la sauvegarde du ' +
                       fmtDate(backup.ts) +
                       "</button>"
                     : "") +
                  '<button class="btn danger wide" id="st-reset">Tout effacer</button>' +
                  '<button class="btn ghost wide" id="st-close">Fermer</button>',
            );
            $("st-size").onchange = (e) => {
               s.sessionSize = +e.target.value;
               save();
            };
            $("st-new").onchange = (e) => {
               s.newPerSession = +e.target.value;
               save();
            };
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
