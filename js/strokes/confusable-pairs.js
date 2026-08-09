"use strict";

const CONFUSABLE_PAIRS_DISPLAY_LIMIT = 2; // jamais plus de 2 partenaires affichés, quel que soit le nombre réel dans l'index
const CONFUSABLE_PAIR_MINI_SETTINGS = { showGrid: false, showFuture: true, highlightRadical: false };

function confusablePairsShellHtml() {
   return '<section class="confusable-pairs" id="dd-confusable-pairs" hidden aria-label="Caractères à ne pas confondre"></section>';
}

function confusablePairMiniSvg(strokeCharacterData, diffIndex, labelledBy) {
   if (!strokeCharacterData || !Number.isInteger(diffIndex)) return "";
   return strokePanelSvg(strokeCharacterData, diffIndex, CONFUSABLE_PAIR_MINI_SETTINGS, labelledBy);
}

function confusablePairItemHtml(character, item, strokeData, index) {
   const partnerCharacter = item.partner.character;
   const labelId = "confusable-pair-label-" + index;
   const selfSvg = confusablePairMiniSvg(strokeData.get(character), item.selfDiffIndex, labelId);
   const partnerSvg = confusablePairMiniSvg(strokeData.get(partnerCharacter), item.partnerDiffIndex, labelId);
   const hasDiagram = Boolean(selfSvg && partnerSvg);
   return (
      '<div class="confusable-pair-item">' +
      (hasDiagram
         ? '<span class="confusable-pair-mini" aria-hidden="true">' + selfSvg + "</span>" +
           '<span class="confusable-pair-versus" aria-hidden="true">≠</span>'
         : "") +
      '<button type="button" class="chip hzchip confusable-pair-chip" data-confusable-character="' +
      esc(partnerCharacter) + '" id="' + labelId + '" aria-label="Voir la fiche de ' + esc(partnerCharacter) + '">' +
      (hasDiagram ? '<span class="confusable-pair-mini" aria-hidden="true">' + partnerSvg + "</span>" : "") +
      '<span class="confusable-pair-chip-hanzi" lang="zh-Hans">' + esc(partnerCharacter) + "</span>" +
      "</button></div>"
   );
}

function confusablePairsHtml(character, items, strokeData) {
   if (!items.length) return "";
   return (
      '<div class="eyebrow">À ne pas confondre</div>' +
      '<div class="confusable-pairs-list">' +
      items.map((item, index) => confusablePairItemHtml(character, item, strokeData, index)).join("") +
      "</div>"
   );
}

async function renderConfusablePairs(character, selector) {
   const targets = Array.from(document.querySelectorAll(selector || "#dd-confusable-pairs"));
   if (!targets.length) return;
   let record = null;
   try {
      const ownMap = await loadConfusablePairs(character);
      record = ownMap.get(character);
   } catch (error) {
      record = null;
   }
   if (!record || !record.partners.length) {
      targets.forEach((target) => {
         target.hidden = true;
         target.innerHTML = "";
      });
      return;
   }

   const shown = record.partners.slice(0, CONFUSABLE_PAIRS_DISPLAY_LIMIT);
   let partnerRecords = new Map();
   try {
      partnerRecords = await loadConfusablePairs(shown.map((partner) => partner.character));
   } catch (error) {
      partnerRecords = new Map();
   }
   const strokeCharacters = [character, ...shown.map((partner) => partner.character)];
   const strokeData = new Map();
   await Promise.all(
      strokeCharacters.map(async (value) => {
         try {
            strokeData.set(value, await loadStrokeCharacterData(value));
         } catch (error) {
            strokeData.set(value, null);
         }
      }),
   );

   const items = shown.map((partner) => {
      const partnerRecord = partnerRecords.get(partner.character);
      const partnerOwnEntry = partnerRecord?.partners.find((entry) => entry.character === character);
      return {
         partner,
         selfDiffIndex: partner.diffStrokeIndex,
         partnerDiffIndex: partnerOwnEntry ? partnerOwnEntry.diffStrokeIndex : null,
      };
   });

   targets.forEach((target) => {
      target.hidden = false;
      target.innerHTML = confusablePairsHtml(character, items, strokeData);
      target.querySelectorAll("[data-confusable-character]").forEach((button) => {
         button.onclick = (event) => {
            event.preventDefault();
            event.stopPropagation();
            openCompositionCharacter(button.dataset.confusableCharacter);
         };
      });
   });
}
