"use strict";

function dictionarySourceHtml(source) {
   const isCc = source.source_id === "CC-CEDICT";
   const license = isCc
      ? "Creative Commons Attribution-ShareAlike 4.0 International"
      : "Creative Commons Attribution-ShareAlike 3.0";
   const attribution = isCc
      ? "Projet CC-CEDICT, publié par MDBG. Le fichier cite aussi CEDICT, © 1997–1998 Paul Andrew Denisowski."
      : "CFDICT, Chine-Informations.com (2010), fondateur David Houstin. Le fichier demande de mentionner le site officiel et de partager les versions redistribuées sous la même licence.";
   return (
      '<div class="card pad" style="box-shadow:none;margin-top:10px">' +
      '<h3 class="v-t" style="font-size:20px">' +
      esc(source.project_name) +
      "</h3>" +
      '<p class="sh-p">' +
      esc(attribution) +
      "</p>" +
      '<p class="sh-note">Licence indiquée dans le fichier source : ' +
      esc(license) +
      " · " +
      Number(source.raw_entry_count).toLocaleString("fr-FR") +
      " entrées.</p></div>"
   );
}

function openDictionarySources() {
   openSheet(
      '<h3 class="sh-t">Sources du dictionnaire</h3>' +
         '<p class="sh-p">Chargement des attributions vérifiées…</p>' +
         '<div class="w-note" id="dict-source-status" role="status">Chargement…</div>' +
         '<div class="sh-btns"><button class="btn ghost wide" id="dict-source-close">Fermer</button></div>',
   );
   $("dict-source-close").onclick = closeSheet;
   loadDictionaryAttribution(false)
      .then(({ manifest, attribution }) => {
         const card = $("sheet").querySelector(".sheet-card");
         card.innerHTML =
            '<h3 class="sh-t">Sources du dictionnaire</h3>' +
            '<p class="sh-p">Les données globales restent séparées de tes cartes et de ta progression.</p>' +
            attribution.sources.map(dictionarySourceHtml).join("") +
            '<div class="card pad" style="box-shadow:none;margin-top:10px"><h3 class="v-t" style="font-size:20px">Données de traits</h3>' +
            '<p class="sh-p">Hanzi Writer Data 2.0.1, dérivé de Make Me a Hanzi et des fontes Arphic indiquées par le projet.</p>' +
            '<p class="sh-note">Licence publique Arphic · copie intégrale dans data/generated/hanzi-writer/2.0.1/ARPHICPL.TXT. Moteur Hanzi Writer 3.7.3 sous licence MIT.</p></div>' +
            '<p class="sh-note">Build ' +
            esc(manifest.buildId.slice(0, 12)) +
            " · " +
            Number(manifest.counts.words).toLocaleString("fr-FR") +
            " entrées lexicales · " +
            Number(manifest.counts.characters).toLocaleString("fr-FR") +
            " caractères.</p>" +
            '<button class="btn wide" id="dict-rebuild">Reconstruire l’index du dictionnaire</button>' +
            '<div class="w-note" id="dict-source-status" role="status" style="text-align:center"></div>' +
            '<button class="btn ghost wide" id="dict-source-close">Fermer</button>';
         $("dict-source-close").onclick = closeSheet;
         $("dict-rebuild").onclick = async () => {
            const button = $("dict-rebuild");
            const status = $("dict-source-status");
            button.disabled = true;
            try {
               await rebuildDictionaryIndex((state, message) => {
                  status.textContent = message;
                  status.dataset.state = state;
               });
            } catch (error) {
               // L'état d'erreur est déjà rendu par le contrôleur.
            } finally {
               button.disabled = false;
            }
         };
      })
      .catch((error) => {
         const status = $("dict-source-status");
         if (status) {
            status.textContent = "Impossible de charger les sources · " + error.message;
            status.dataset.state = "error";
         }
      });
}
