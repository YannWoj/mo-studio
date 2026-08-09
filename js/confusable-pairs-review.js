"use strict";

/* ================= « connu raisonnablement bien », pour ce test précis ================= */
// Volontairement plus strict que learningPathSufficientProgress (js/learning-units/
// learning-path-engine.js) : celle-ci débloque du contenu neuf, une erreur n'y coûte
// qu'un délai. Ici, une erreur signifie montrer un caractère peut-être mal maîtrisé
// dans un test à risque d'interférence — donc au moins deux réussites enregistrées,
// pas une seule (une réussite isolée peut être un coup de chance), ou le drapeau
// manuel "Maîtrisée". Prédicat autonome plutôt qu'une réutilisation paramétrée, pour
// ne jamais risquer d'assouplir accidentellement l'usage Parcours.
function wellKnownForConfusablePairs(card) {
   if (!card) return false;
   if (card.acquired === true) return true;
   const successCount = (card.reviewHistory || []).filter(
      (entry) => entry.grade === "good" || entry.grade === "easy",
   ).length;
   return successCount >= 2;
}

// Signal exact de "jamais étudié" : lastReviewed n'est écrit que par applyGrade
// (js/state.js) et n'est jamais réinitialisé ailleurs.
function confusablePairEverStudied(card) {
   return !!card && card.lastReviewed != null;
}

// Règle de sécurité pédagogique non négociable : un caractère jamais étudié —
// carte absente ou jamais notée — ne doit jamais apparaître dans ce test, même si
// l'autre caractère de la paire est parfaitement connu.
function confusablePairCandidate(c) {
   if (!c || !c.hz || typeof reviewHanzi !== "function" || reviewHanzi(c.hz).length !== 1) return null;
   if (!session || !session.active || !session.live || session.live.confusableShown) return null;
   const record = typeof confusablePairsCached === "function" ? confusablePairsCached(c.hz) : undefined;
   if (!record) return null; // pas de partenaire connu, ou pas encore préchargé — jamais deviné
   const activePartners = record.partners.filter((partner) => partner.activeTier);
   if (!activePartners.length) return null;
   const selfWellKnown = wellKnownForConfusablePairs(c);
   for (const partner of activePartners) {
      const twinCard = db.cards.find((card) => card.hz === partner.character);
      if (!confusablePairEverStudied(twinCard)) continue;
      if (!selfWellKnown && !wellKnownForConfusablePairs(twinCard)) continue;
      return { partner, twinCard };
   }
   return null;
}

/* ================= sheet du test ================= */

function confusableTestChoiceHtml(character) {
   return (
      '<button type="button" class="confusable-test-choice" data-confusable-choice="' +
      esc(character) + '" lang="zh-Hans" aria-label="Répondre ' + esc(character) + '">' +
      esc(character) +
      "</button>"
   );
}

function confusableTestPromptHtml(c, leftCharacter, rightCharacter) {
   return (
      '<h3 class="sh-t">Lequel signifie…</h3>' +
      '<p class="confusable-test-prompt">« ' + esc(c.fr) + " »</p>" +
      '<div class="confusable-test confusable-test-choices">' +
      confusableTestChoiceHtml(leftCharacter) +
      confusableTestChoiceHtml(rightCharacter) +
      "</div>"
   );
}

function confusableTestVerdictHtml(correct, chosenCharacter, correctCharacter) {
   return (
      '<div class="confusable-test">' +
      '<div class="confusable-test-choice ' + (correct ? "ok" : "ko") + '" lang="zh-Hans">' + esc(chosenCharacter) + "</div>" +
      '<p class="confusable-test-verdict ' + (correct ? "ok" : "ko") + '">' +
      (correct
         ? "Correct."
         : "« " + esc(correctCharacter) + " », pas « " + esc(chosenCharacter) + " ». « " + esc(correctCharacter) + " » revient plus tôt en révision.") +
      "</p></div>" +
      '<button type="button" class="btn primary wide" id="confusable-test-continue">Continuer</button>'
   );
}

// Interstitiel mi-séance sur le modèle exact d'openDelaySheet (js/views/review.js) :
// ouvre un sheet lié à la carte courante, et ne reprend la séance que via le
// callback after() une fois l'utilisateur passé à l'écran suivant.
function maybeShowConfusablePairTest(c, after) {
   const candidate = confusablePairCandidate(c);
   if (!candidate) return false;
   session.live.confusableShown = (session.live.confusableShown || 0) + 1;

   const twinCharacter = candidate.partner.character;
   const swapSides = Math.random() < 0.5;
   const leftCharacter = swapSides ? twinCharacter : c.hz;
   const rightCharacter = swapSides ? c.hz : twinCharacter;

   openSheet(confusableTestPromptHtml(c, leftCharacter, rightCharacter));

   const finish = (chosenCharacter) => {
      const correct = chosenCharacter === c.hz;
      // Le test s'ajoute à la notation déjà faite, il ne la remplace pas : pas de
      // changement de c.lvl, pas d'entrée dans c.reviewHistory (réservé aux quatre
      // boutons de note). Seule la programmation change, exactement comme le fait
      // déjà openDelaySheet's setDue pour un ajustement manuel — donc rien
      // d'invisible : un toast explique le changement, comme ailleurs dans l'app.
      if (!correct) {
         c.due = now() + INTERVALS[0];
         if (c.acquired) c.acquired = false;
         save();
         toast("« " + c.hz + " » reprogrammé plus tôt — confusion avec « " + twinCharacter + " ».");
      }
      openSheet(confusableTestVerdictHtml(correct, chosenCharacter, c.hz));
      $("confusable-test-continue").onclick = () => {
         closeSheet();
         after();
      };
   };
   document.querySelectorAll("#sheet [data-confusable-choice]").forEach((button) => {
      button.onclick = () => finish(button.dataset.confusableChoice);
   });
   return true;
}
