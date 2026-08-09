"use strict";

/* ================= « connu » : monotone, dérivé du réel ================= */
function learningPathSufficientProgress(card) {
   // acquired : bouton "Maîtrisé" (js/views/library.js). lvl>=2 : au moins une note
   // correct/facile (js/state.js applyGrade). reviewHistory : plus haut niveau jamais atteint —
   // indispensable car applyGrade fait retomber lvl sur une note "difficile"/"raté" sans tenir
   // compte du niveau précédent ; un composant acquis ne doit jamais se reperdre.
   return (
      card.acquired === true ||
      (card.lvl || 0) >= 2 ||
      (card.reviewHistory || []).some((entry) => (entry.level || 0) >= 2)
   );
}

function learningPathKnownComponents(cards, completedLessons, unitsIndex, graph) {
   const known = new Map(); // composant -> "lesson" | "card"
   const unitById = new Map(unitsIndex.map((unit) => [unit.id, unit]));
   Object.keys(completedLessons).forEach((unitId) => {
      const unit = unitById.get(unitId);
      if (unit) known.set(unit.component, "lesson");
   });
   cards.forEach((card) => {
      if (!learningPathSufficientProgress(card)) return;
      Array.from(String(card.hz || ""))
         .filter((character) => HAN_PATTERN.test(character))
         .forEach((character) => {
            if (!known.has(character)) known.set(character, "card");
            (graph.prerequisites[character] || []).forEach((component) => {
               if (!known.has(component)) known.set(component, "card");
            });
         });
   });
   return known;
}

/* ================= périmètre ================= */
function learningPathScopeCharacters(scope, { cards, unitsIndex, hskChars }) {
   if (scope.mode === "all") {
      const all = new Set();
      unitsIndex.forEach((unit) => unit.memberCharacters.forEach((character) => all.add(character)));
      return all;
   }
   if (scope.mode === "hsk") return hskChars || new Set();
   const characters = new Set(); // "personal" (défaut)
   cards.forEach((card) =>
      Array.from(String(card.hz || ""))
         .filter((character) => HAN_PATTERN.test(character))
         .forEach((character) => characters.add(character)),
   );
   return characters;
}

/* ================= annotation des unités ================= */
function learningPathAnnotateUnits(unitsInScope, known, completedLessons) {
   return unitsInScope.map((unit) => {
      const completed = Object.prototype.hasOwnProperty.call(completedLessons, unit.id);
      const missing = completed ? [] : unit.prerequisites.filter((component) => !known.has(component));
      return { unit, completed, missing, available: !completed && missing.length === 0 };
   });
}

function learningPathPickRecommended(annotated) {
   const candidates = annotated.filter((entry) => entry.available);
   if (!candidates.length) return null;
   return candidates
      .slice()
      .sort(
         (a, b) =>
            b.unit.utilityScore - a.unit.utilityScore ||
            a.unit.component.localeCompare(b.unit.component, "zh") ||
            a.unit.id.localeCompare(b.unit.id),
      )[0].unit;
}

/* ================= la carte : regroupée par composant, jamais par unité brute ================= */
function learningPathBuckets(annotated, known) {
   const byComponent = new Map();
   annotated.forEach((entry) => {
      if (!byComponent.has(entry.unit.component)) byComponent.set(entry.unit.component, []);
      byComponent.get(entry.unit.component).push(entry);
   });
   const acquis = [];
   const disponibles = [];
   const bientot = [];
   const verrouillees = [];
   byComponent.forEach((entries, component) => {
      const remaining = entries.filter((entry) => !entry.completed);
      if (known.has(component)) {
         const bestUnit = remaining.length
            ? remaining.slice().sort((a, b) => b.unit.utilityScore - a.unit.utilityScore)[0].unit
            : null;
         acquis.push({ component, remainingCount: remaining.length, bestUnit });
         return;
      }
      if (!remaining.length) return; // ne se produit jamais : terminer une unité rend son composant connu
      const missing = remaining[0].missing; // identique pour toutes les parts d'un même composant (vérifié)
      const bestUnit = remaining.slice().sort((a, b) => b.unit.utilityScore - a.unit.utilityScore)[0].unit;
      const charactersWaiting = new Set(remaining.flatMap((entry) => entry.unit.memberCharacters)).size;
      const row = { component, missing, bestUnit, charactersWaiting };
      if (missing.length === 0) disponibles.push(row);
      else if (missing.length === 1) bientot.push(row);
      else verrouillees.push(row);
   });
   const byComponentLocale = (a, b) => a.component.localeCompare(b.component, "zh");
   acquis.sort(byComponentLocale);
   disponibles.sort((a, b) => b.bestUnit.utilityScore - a.bestUnit.utilityScore || byComponentLocale(a, b));
   bientot.sort(
      (a, b) =>
         b.charactersWaiting - a.charactersWaiting ||
         b.bestUnit.utilityScore - a.bestUnit.utilityScore ||
         byComponentLocale(a, b),
   );
   verrouillees.sort(
      (a, b) => a.missing.length - b.missing.length || b.bestUnit.utilityScore - a.bestUnit.utilityScore || byComponentLocale(a, b),
   );
   return { acquis, disponibles, bientot, verrouillees };
}

/* ================= point d'entrée ================= */
async function computeLearningPath(scopeOverride) {
   const scope = scopeOverride || getCourseScope();
   const [unitsIndex, graph, hskChars] = await Promise.all([
      loadLearningUnitsIndex(),
      loadLearningUnitsGraph(),
      scope.mode === "hsk" ? loadHskCumulativeCharacters(scope.hskLevel) : Promise.resolve(null),
   ]);
   const known = learningPathKnownComponents(db.cards, courseProgress.completedLessons, unitsIndex, graph);
   const scopeCharacters = learningPathScopeCharacters(scope, { cards: db.cards, unitsIndex, hskChars });
   const unitsInScope = unitsIndex.filter((unit) => unit.memberCharacters.some((character) => scopeCharacters.has(character)));
   const annotated = learningPathAnnotateUnits(unitsInScope, known, courseProgress.completedLessons);
   return {
      scope,
      scopeCharacterCount: scopeCharacters.size,
      recommended: learningPathPickRecommended(annotated),
      buckets: learningPathBuckets(annotated, known),
      progress: {
         completed: annotated.filter((entry) => entry.completed).length,
         total: annotated.length,
      },
   };
}
