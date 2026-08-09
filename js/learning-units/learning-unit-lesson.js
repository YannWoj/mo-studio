"use strict";

/* ================= état de la leçon ================= */
let lesson = null;
let lessonRenderTokenSeq = 0;
let lessonFamilyRenderToken = 0;
let lessonWordsRenderToken = 0;

function lessonHistoryPayload() {
   return {
      moStudioUnits: true,
      mode: "lesson",
      unitId: lesson?.unit?.id || null,
      step: lesson?.step,
      historyDepth: lesson?.historyDepth || 1,
      moStudioView: lesson?.openedFromView || "units",
   };
}

/* ================= filtrage des membres : variantes traditionnelles ================= */
async function dictionaryWordEntriesForCharacter(character) {
   try {
      const index = await loadDictionaryIndex("exactHanzi", false);
      const references = index[character] || [];
      if (!references.length) return [];
      const entries = await loadDictionaryEntriesByReferences(references);
      return entries.filter((entry) => entry.entryType === "word" && entry.simplified === character);
   } catch (error) {
      return [];
   }
}

function simplifiedTraditionalPairFor(character, entries) {
   const wordSelf = entries.find((entry) => entry.traditional && entry.traditional !== character);
   return wordSelf ? wordSelf.traditional : null;
}

async function prepareLessonMembers(unit) {
   const characters = unit.members.map((member) => member.character);
   const pairs = await Promise.all(
      characters.map(async (character) => {
         const entries = await dictionaryWordEntriesForCharacter(character);
         return simplifiedTraditionalPairFor(character, entries);
      }),
   );
   const excluded = new Set();
   characters.forEach((character, i) => {
      if (pairs[i] && characters.includes(pairs[i])) excluded.add(pairs[i]);
   });
   return unit.members.filter((member) => !excluded.has(member.character));
}

/* ================= composant autonome (portail de création de carte) ================= */
function meaningfulDictionarySenses(values) {
   return (values || [])
      .flatMap((definition) => String(definition || "").split(/\s*;\s*/u))
      .map((sense) => sense.trim())
      .filter(
         (sense) =>
            sense &&
            !/radical/i.test(sense) &&
            !/^see also\b/i.test(sense) &&
            !/^also pr\./i.test(sense) &&
            !/^also (written|spelled)\b/i.test(sense) &&
            !/^(old|archaic|variant) (form|writing) of\b/i.test(sense) &&
            !/^abbr\. for\b/i.test(sense),
      );
}

async function hasIndependentDictionaryMeaning(character) {
   try {
      const index = await loadDictionaryIndex("exactHanzi", false);
      const references = index[character] || [];
      if (!references.length) return false;
      const entries = (await loadDictionaryEntriesByReferences(references)).filter(
         (entry) => entry.simplified === character,
      );
      return entries.some(
         (entry) =>
            meaningfulDictionarySenses(entry.definitionsFr).length ||
            meaningfulDictionarySenses(entry.definitionsEn).length,
      );
   } catch (error) {
      return false;
   }
}

/* ================= entrée / sortie ================= */
function lessonLoadingShellHtml() {
   return (
      '<section class="sess lesson-sess"><div class="dictionary-loading"><span class="ink-loader"></span>' +
      "<b>Chargement de la leçon…</b></div></section>"
   );
}

function lessonErrorShellHtml() {
   return (
      '<section class="sess lesson-sess"><div class="path-error" role="alert"><b>Leçon indisponible.</b>' +
      '<button class="btn" id="lesson-error-back" type="button">Retour à la liste</button></div></section>'
   );
}

async function openLesson(unitId, options) {
   const settings = options || {};
   destroyStrokeWorkspace();
   lesson = {
      unit: null,
      step: 1,
      historyDepth: 1,
      openedFromView: activeView,
      membersPromise: null,
      members: null,
      compositions: null,
      selectedWords: null,
      quizQuestions: null,
      preview: null,
      renderToken: ++lessonRenderTokenSeq,
   };
   document.body.classList.add("in-lesson");
   if (!settings.fromHistory) history.pushState(lessonHistoryPayload(), "");
   $("view").innerHTML = lessonLoadingShellHtml();
   const token = lesson.renderToken;
   const unit = await loadLearningUnit(unitId);
   if (!lesson || lesson.renderToken !== token) return;
   if (!unit) {
      $("view").innerHTML = lessonErrorShellHtml();
      if ($("lesson-error-back")) $("lesson-error-back").onclick = () => closeLesson();
      return;
   }
   lesson.unit = unit;
   if (!settings.fromHistory) history.replaceState(lessonHistoryPayload(), "");
   lesson.membersPromise = prepareLessonMembers(unit)
      .catch(() => unit.members)
      .then((members) => {
         if (!lesson || lesson.renderToken !== token) return;
         lesson.members = members;
         if (lesson.step !== 1) renderLesson();
      });
   renderLesson();
   window.scrollTo(0, 0);
}

function goToLessonStep(step) {
   if (!lesson) return;
   lesson.step = step;
   lesson.historyDepth++;
   history.pushState(lessonHistoryPayload(), "");
   renderLesson();
   window.scrollTo(0, 0);
}

function teardownLesson() {
   destroyStrokeWorkspace();
   lesson = null;
   document.body.classList.remove("in-lesson");
}

function closeLesson(options) {
   const settings = options || {};
   if (!settings.fromHistory && lesson && history.state && history.state.mode === "lesson") {
      history.go(-lesson.historyDepth);
      return;
   }
   teardownLesson();
   render();
   window.scrollTo(0, 0);
}

function renderLesson() {
   if (!lesson || !lesson.unit) return;
   if (lesson.step === 1) renderLessonStepComponent();
   else if (lesson.step === 2) renderLessonStepFamily();
   else if (lesson.step === 3) renderLessonStepWords();
   else if (lesson.step === 4) renderLessonStepQuiz();
   else renderLessonRecap();
}

/* ================= coquille commune ================= */
function lessonShellHtml(unit, bodyHtml) {
   return (
      '<section class="sess lesson-sess" id="lesson-sess">' +
      '<div class="s-top"><button class="s-x" id="lesson-exit" aria-label="Quitter la leçon">×</button>' +
      '<div class="s-scope">' +
      esc(unit.component) +
      (unit.componentPinyin ? " · " + esc(unit.componentPinyin) : "") +
      '</div><div class="s-count">' +
      lesson.step +
      " / 4</div></div>" +
      '<div class="s-bar"><i style="width:' +
      ((lesson.step / 4) * 100).toFixed(1) +
      '%"></i></div>' +
      bodyHtml +
      lessonStepNavHtml() +
      "</section>"
   );
}

function lessonStepNavHtml() {
   return (
      '<nav class="session-nav" aria-label="Navigation dans la leçon">' +
      '<button type="button" class="session-nav-button previous" id="lesson-prev"' +
      (lesson.step === 1 ? ' disabled aria-disabled="true"' : "") +
      ">‹ <span>Précédent</span></button>" +
      '<button type="button" class="session-nav-button next" id="lesson-next"><span>' +
      (lesson.step === 4 ? "Récapitulatif" : "Suivant") +
      "</span> ›</button></nav>"
   );
}

function lessonRecapShellHtml(unit, bodyHtml) {
   return (
      '<section class="sess lesson-sess" id="lesson-sess">' +
      '<div class="s-top"><button class="s-x" id="lesson-exit" aria-label="Quitter la leçon">×</button>' +
      '<div class="s-scope">' +
      esc(unit.component) +
      (unit.componentPinyin ? " · " + esc(unit.componentPinyin) : "") +
      '</div><div class="s-count">Récapitulatif</div></div>' +
      '<div class="s-bar"><i style="width:100%"></i></div>' +
      bodyHtml +
      "</section>"
   );
}

function wireLessonNav() {
   if ($("lesson-exit")) $("lesson-exit").onclick = () => closeLesson();
   const prev = $("lesson-prev");
   if (prev) prev.onclick = () => {
      if (!prev.disabled) history.back();
   };
   const next = $("lesson-next");
   if (next) next.onclick = () => {
      goToLessonStep(lesson.step >= 4 ? "recap" : lesson.step + 1);
   };
}

/* ================= étape 1/4 — le composant ================= */
function componentIntroHtml(unit) {
   return (
      '<div class="lesson-component-intro">' +
      '<div class="hanzi ink-in" data-say="' +
      esc(unit.component) +
      '">' +
      esc(unit.component) +
      "</div>" +
      (unit.componentPinyin ? '<div class="pinyin">' + colorPinyin(unit.componentPinyin) + "</div>" : "") +
      (unit.componentGloss ? '<div class="fr">' + esc(unit.componentGloss) + "</div>" : "") +
      "</div>"
   );
}

function renderLessonStepComponent() {
   const unit = lesson.unit;
   $("view").innerHTML = lessonShellHtml(
      unit,
      '<div class="flash card lesson-card">' +
         componentIntroHtml(unit) +
         '<div class="eyebrow">Ordre des traits</div>' +
         strokeCharacterStageHtml("lesson-cmp", unit.component, 0, 1, false) +
         "</div>",
   );
   wireLessonNav();
   wireStrokeWorkspace();
   loadDDChar(unit.component, [unit.component]);
}

/* ================= étape 2/4 — la famille en un coup d'œil ================= */
function lessonFamilySkeletonRowHtml() {
   return '<div class="unit-family-row unit-family-row-skeleton" aria-hidden="true"><span class="ink-loader"></span></div>';
}

function lessonFamilyRowHtml(member, index) {
   return (
      '<details class="unit-family-row" id="unit-family-row-' +
      index +
      '"><summary class="unit-family-head">' +
      '<button class="seal" type="button" data-say="' +
      esc(member.character) +
      '" aria-label="Écouter ' +
      esc(member.character) +
      '">听</button>' +
      '<b class="unit-family-hz">' +
      esc(member.character) +
      "</b>" +
      '<span class="unit-family-main">' +
      (member.pinyin ? '<span class="unit-family-pinyin">' + colorPinyin(member.pinyin) + "</span>" : "") +
      (member.gloss ? '<span class="unit-family-gloss">' + esc(member.gloss) + "</span>" : "") +
      "</span>" +
      '<span class="unit-family-badges" id="unit-family-badges-' +
      index +
      '" aria-live="polite"></span>' +
      '<span class="unit-family-chevron" aria-hidden="true">⌄</span>' +
      "</summary>" +
      characterCompositionShellHtml("unit-family-detail-" + index) +
      "</details>"
   );
}

function lessonFamilyBodyHtml(unit, members) {
   const intro =
      unit.type === "phonetic"
         ? "Ces caractères partagent le son de " + esc(unit.component) + "."
         : "Ces caractères partagent le radical " + esc(unit.component) + ".";
   return (
      '<p class="lesson-family-intro">' +
      intro +
      "</p>" +
      '<div class="unit-family-grid">' +
      members.map((member, index) => lessonFamilyRowHtml(member, index)).join("") +
      "</div>"
   );
}

function lessonFamilyBadgeHtml(unit, record) {
   if (!record) return "";
   const pictophonetic = record.etymology?.type === "pictophonetic" && record.etymology.phonetic === unit.component;
   if (pictophonetic) {
      const semantic = record.etymology.semantic;
      return (
         '<span class="unit-family-tag son">son · ' +
         esc(unit.component) +
         "</span>" +
         (semantic ? '<span class="unit-family-tag sens">sens · ' + esc(semantic) + "</span>" : "")
      );
   }
   if (record.radical) return '<span class="unit-family-tag key">clé · ' + esc(record.radical) + "</span>";
   return "";
}

function paintLessonFamilyBadges(index, unit, record) {
   const slot = $("unit-family-badges-" + index);
   if (slot) slot.innerHTML = lessonFamilyBadgeHtml(unit, record);
}

function wireLessonFamilyRows(members) {
   document.querySelectorAll(".unit-family-row [data-say]").forEach((button) => {
      button.addEventListener("click", (event) => event.preventDefault());
   });
   members.forEach((member, index) => {
      const row = $("unit-family-row-" + index);
      if (!row) return;
      row.ontoggle = () => {
         if (!row.open || row.dataset.rendered) return;
         row.dataset.rendered = "1";
         const record = lesson.compositions ? lesson.compositions.get(member.character) : null;
         renderCharacterComposition(record, ".unit-family-detail-" + index);
      };
   });
}

function renderLessonStepFamily() {
   const unit = lesson.unit;
   if (!lesson.members) {
      $("view").innerHTML = lessonShellHtml(
         unit,
         '<p class="lesson-family-intro">Préparation de la famille de caractères…</p>' +
            '<div class="unit-family-grid" aria-busy="true">' +
            unit.members.map(lessonFamilySkeletonRowHtml).join("") +
            "</div>",
      );
      wireLessonNav();
      return;
   }
   $("view").innerHTML = lessonShellHtml(unit, lessonFamilyBodyHtml(unit, lesson.members));
   wireLessonNav();
   wireLessonFamilyRows(lesson.members);
   const token = ++lessonFamilyRenderToken;
   loadCharacterCompositions(lesson.members.map((member) => member.character)).then((compositions) => {
      if (!lesson || lesson.step !== 2 || token !== lessonFamilyRenderToken) return;
      lesson.compositions = compositions;
      lesson.members.forEach((member, index) => paintLessonFamilyBadges(index, unit, compositions.get(member.character)));
   });
}

/* ================= étape 3/4 — mots réels ================= */
function resolveLessonWords(members, hsk1Set) {
   const byHanzi = new Map();
   members.forEach((member) => {
      (member.exampleWords || []).forEach((word) => {
         if (!word || !word.hanzi || !word.pinyin || !word.gloss) return;
         if (word.hanzi === member.character || byHanzi.has(word.hanzi)) return;
         byHanzi.set(word.hanzi, {
            hanzi: word.hanzi,
            pinyin: word.pinyin,
            gloss: word.gloss,
            sourceUtility: member.utilityScore,
         });
      });
   });
   const tierOf = (word) =>
      findReusableCard({ chinese: word.hanzi, pinyin: word.pinyin, translation: word.gloss })
         ? 0
         : hsk1Set.has(word.hanzi)
           ? 1
           : 2;
   return Array.from(byHanzi.values())
      .map((word) => ({ ...word, tier: tierOf(word) }))
      .sort(
         (a, b) =>
            a.tier - b.tier ||
            b.sourceUtility - a.sourceUtility ||
            Array.from(a.hanzi).length - Array.from(b.hanzi).length ||
            a.hanzi.localeCompare(b.hanzi, "zh"),
      )
      .slice(0, 5);
}

async function ensureLessonWordSelection() {
   if (lesson.selectedWords) return lesson.selectedWords;
   const hsk1Set = await loadHsk1RootHanziSet();
   lesson.selectedWords = resolveLessonWords(lesson.members, hsk1Set);
   return lesson.selectedWords;
}

function lessonWordRowHtml(word) {
   return (
      '<div class="unit-word-row"><button class="seal" type="button" data-say="' +
      esc(word.hanzi) +
      '" aria-label="Écouter ' +
      esc(word.hanzi) +
      '">听</button>' +
      '<b class="unit-word-hz">' +
      esc(word.hanzi) +
      "</b>" +
      '<span class="unit-word-main"><span class="unit-word-pinyin">' +
      colorPinyin(word.pinyin) +
      '</span><span class="unit-word-gloss">' +
      esc(word.gloss) +
      "</span></span></div>"
   );
}

async function renderLessonStepWords() {
   const unit = lesson.unit;
   $("view").innerHTML = lessonShellHtml(
      unit,
      '<div class="unit-word-list" aria-busy="true"><span class="ink-loader"></span></div>',
   );
   wireLessonNav();
   if (!lesson.members) return; // renderLesson() sera rappelé par membersPromise, puis cette fonction à nouveau
   const token = ++lessonWordsRenderToken;
   const words = await ensureLessonWordSelection();
   if (!lesson || lesson.step !== 3 || token !== lessonWordsRenderToken) return;
   $("view").innerHTML = lessonShellHtml(
      unit,
      words.length
         ? '<div class="unit-word-list">' + words.map(lessonWordRowHtml).join("") + "</div>"
         : '<p class="unit-word-empty">Aucun mot réel disponible pour cette leçon dans le dictionnaire.</p>',
   );
   wireLessonNav();
}

/* ================= étape 4/4 — mini-quiz ================= */
function lessonQuizQuestions(members) {
   const questionMembers = members
      .slice()
      .sort((a, b) => b.utilityScore - a.utilityScore)
      .slice(0, 4);
   return questionMembers.map((member) => ({
      gloss: member.gloss,
      correct: member.character,
      options: shuffle([
         member.character,
         ...shuffle(members.filter((m) => m !== member).map((m) => m.character)).slice(0, 3),
      ]),
   }));
}

function lessonQuizQuestionHtml(question, qi) {
   return (
      '<div class="qz-q">' +
      (qi + 1) +
      ". Lequel de ces caractères veut dire « " +
      esc(question.gloss) +
      ' » ?</div><div class="qz-opts" data-q="' +
      qi +
      '">' +
      question.options
         .map(
            (option) =>
               '<button class="chip hz" data-ok="' +
               String(option === question.correct) +
               '">' +
               esc(option) +
               "</button>",
         )
         .join("") +
      "</div>"
   );
}

function wireLessonQuiz() {
   document.querySelectorAll(".lesson-quiz .qz-opts").forEach((box) => {
      box.querySelectorAll(".chip").forEach((button) => {
         button.onclick = () => {
            if (box.dataset.done) return;
            box.dataset.done = "1";
            const good = box.querySelector('[data-ok="true"]');
            if (good) good.classList.add("ok");
            if (button.dataset.ok !== "true") button.classList.add("ko");
            const boxes = Array.from(document.querySelectorAll(".lesson-quiz .qz-opts"));
            const done = boxes.filter((b) => b.dataset.done).length;
            const right = boxes.filter((b) => b.dataset.done && !b.querySelector(".chip.ko")).length;
            const score = $("lesson-quiz-score");
            if (score) score.textContent = done === boxes.length ? "Score : " + right + " / " + boxes.length : "";
         };
      });
   });
}

function renderLessonStepQuiz() {
   const unit = lesson.unit;
   if (!lesson.quizQuestions) lesson.quizQuestions = lessonQuizQuestions(lesson.members);
   $("view").innerHTML = lessonShellHtml(
      unit,
      '<div class="qz lesson-quiz"><div class="qz-t">Mini-quiz</div>' +
         lesson.quizQuestions.map(lessonQuizQuestionHtml).join("") +
         '<div class="qz-score" id="lesson-quiz-score" aria-live="polite"></div></div>',
   );
   wireLessonNav();
   wireLessonQuiz();
}

/* ================= récapitulatif et validation ================= */
function lessonCategoryName(unit) {
   const type = unit.type === "phonetic" ? "phonétique" : "sémantique";
   const part = unit.partCount > 1 ? " " + unit.partIndex + "/" + unit.partCount : "";
   return unit.component + (unit.componentPinyin ? " · " + unit.componentPinyin : "") + " (" + type + part + ")";
}

async function buildLessonImportPayload(unit, members) {
   const byHanzi = new Map();
   const add = (chinese, pinyin, translation) => {
      if (!chinese || !pinyin || !translation || byHanzi.has(chinese)) return;
      byHanzi.set(chinese, { chinese, pinyin, translation, tags: ["parcours"] });
   };
   if (await hasIndependentDictionaryMeaning(unit.component)) add(unit.component, unit.componentPinyin, unit.componentGloss);
   members.forEach((member) => add(member.character, member.pinyin, member.gloss));
   (await ensureLessonWordSelection()).forEach((word) => add(word.hanzi, word.pinyin, word.gloss));
   return {
      pack: {
         name: "Parcours",
         description: "Cartes créées depuis les leçons du Parcours.",
         categories: [{ name: lessonCategoryName(unit), words: Array.from(byHanzi.values()) }],
      },
   };
}

function lessonRecapRowHtml(word) {
   return (
      '<div class="lesson-recap-row"><b>' +
      esc(word.chinese) +
      "</b><span>" +
      colorPinyin(word.pinyin) +
      " · " +
      esc(word.translation) +
      '</span><span class="lesson-recap-state">' +
      (word.existingCardId ? "déjà dans vos cartes" : "nouvelle carte") +
      "</span></div>"
   );
}

function lessonRecapBodyHtml(preview) {
   const words = preview.packs[0]?.categories[0]?.words || [];
   if (!words.length) {
      return (
         '<div class="card pad lesson-recap">' +
         "<p>Aucun mot ni caractère de cette leçon ne peut être ajouté à Mes mots pour l’instant.</p>" +
         '<div class="lesson-recap-actions"><button class="btn primary wide" id="lesson-finish">Terminer</button></div></div>'
      );
   }
   const newCount = words.filter((word) => !word.existingCardId).length;
   const reuseCount = words.length - newCount;
   return (
      '<div class="card pad lesson-recap"><div class="lesson-recap-list">' +
      words.map(lessonRecapRowHtml).join("") +
      '</div><p class="lesson-recap-total">' +
      words.length +
      (words.length > 1 ? " cartes" : " carte") +
      " — " +
      newCount +
      " nouvelle" +
      (newCount > 1 ? "s" : "") +
      ", " +
      reuseCount +
      " déjà présente" +
      (reuseCount > 1 ? "s" : "") +
      '</p><div class="lesson-recap-actions"><button class="btn primary wide" id="lesson-finish">Ajouter ' +
      words.length +
      (words.length > 1 ? " mots" : " mot") +
      " à Mes mots</button></div></div>"
   );
}

function wireLessonRecap() {
   if ($("lesson-exit")) $("lesson-exit").onclick = () => closeLesson();
   if ($("lesson-finish")) $("lesson-finish").onclick = () => commitLesson();
}

async function renderLessonRecap() {
   const unit = lesson.unit;
   $("view").innerHTML = lessonRecapShellHtml(
      unit,
      '<div class="dictionary-loading"><span class="ink-loader"></span><b>Préparation du récapitulatif…</b></div>',
   );
   if ($("lesson-exit")) $("lesson-exit").onclick = () => closeLesson();
   const token = lesson.renderToken;
   const payload = await buildLessonImportPayload(unit, lesson.members);
   const preview = await buildPackImportPreview(payload, "json");
   if (!lesson || lesson.renderToken !== token || lesson.step !== "recap") return;
   lesson.preview = preview;
   $("view").innerHTML = lessonRecapShellHtml(unit, lessonRecapBodyHtml(preview));
   wireLessonRecap();
}

function commitLesson() {
   const preview = lesson && lesson.preview;
   const unit = lesson && lesson.unit;
   const words = preview && preview.packs[0]?.categories[0]?.words;
   if (!words || !words.length) {
      if (unit) recordLessonCompletion(unit.id);
      closeLesson();
      return;
   }
   const result = applyPackImport(preview, { mode: "merge", importMissing: true });
   if (unit) recordLessonCompletion(unit.id);
   toast(
      result.added +
         " nouvelle" +
         (result.added > 1 ? "s" : "") +
         " carte" +
         (result.added > 1 ? "s" : "") +
         ", " +
         result.reused +
         " déjà présente" +
         (result.reused > 1 ? "s" : "") +
         " — ajoutées à « Parcours ».",
   );
   closeLesson();
}
