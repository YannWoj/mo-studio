"use strict";

const CHARACTER_COMPOSITION_REVISION = "bddc96d41bef78427ed0e034e9f7e31d71fd1b92";

// Le nom français écrit à la main (data/source/character-components-fr.json,
// fusionné au build) prime sur la définition anglaise de Make Me a Hanzi. La clé
// n'est pas toujours une feuille de l'arbre : elle porte son propre nom.
function compositionComponentFr(character, record) {
   return (
      record.components?.[character]?.definitionFr ||
      (record.radical === character ? record.radicalFr : "") ||
      ""
   );
}

function compositionComponentHtml(character, record, extraClass, definitionOverride) {
   const component = record.components?.[character] || {};
   const definition = definitionOverride === undefined
      ? compositionComponentFr(character, record) || component.definition || ""
      : definitionOverride || "";
   const pinyin = Array.isArray(component.pinyin) ? component.pinyin.filter(Boolean).join(", ") : "";
   const title = [character, pinyin, definition].filter(Boolean).join(" · ");
   return (
      '<button type="button" class="composition-component' +
      (extraClass ? " " + extraClass : "") +
      '" data-composition-character="' + esc(character) + '"' +
      (title ? ' title="' + esc(title) + '"' : "") + ">" +
      '<b lang="zh-Hans">' + esc(character) + "</b>" +
      (definition ? "<small>" + esc(definition) + "</small>" : "") +
      "</button>"
   );
}

function compositionTreeHtml(node, record, nested) {
   if (node?.u === true)
      return '<span class="composition-unknown" aria-label="Composant non identifié"><span aria-hidden="true">?</span></span>';
   if (node?.c && typeof node.c === "string")
      return compositionComponentHtml(node.c, record, "");
   if (!node || !Array.isArray(node.c) || !node.c.length) return "";
   const children = node.c.map((child) => compositionTreeHtml(child, record, true));
   const content = children.join('<span class="composition-plus" aria-hidden="true">+</span>');
   return nested
      ? '<span class="composition-group"><span aria-hidden="true">(</span>' + content + '<span aria-hidden="true">)</span></span>'
      : content;
}

function compositionRoleHtml(character, role, record, useDefinition) {
   if (!character || character === "？") return "";
   const roleDefinition = useDefinition
      ? compositionComponentFr(character, record) || record.components?.[character]?.definition || ""
      : "";
   const value = Array.from(character).length === 1 && /^\p{Script=Han}$/u.test(character)
      ? compositionComponentHtml(
           character,
           record,
           "composition-role-component",
           roleDefinition,
        )
      : '<b class="composition-role-text">' + esc(character) + "</b>";
   return '<span class="composition-role">' + value + '<span aria-hidden="true">→</span><em>' + role + "</em></span>";
}

function compositionOriginHtml(record) {
   const english = record.etymology?.hint || "";
   if (!english) return "";
   const french = record.etymology?.hintFr || "";
   const value = french || english;
   return (
      '<div class="composition-origin"><span class="eyebrow">Origine du dessin</span>' +
      (french ? "" : '<span class="search-fallback">anglais</span>') +
      '<span class="composition-origin-text" lang="' + (french ? "fr" : "en") +
      '" title="' + esc(value) + '">' + esc(value) + "</span></div>"
   );
}

function characterCompositionShellHtml(extraClass) {
   return (
      '<section class="character-composition is-loading' +
      (extraClass ? " " + extraClass : "") +
      '" aria-label="Composition et origine du caractère" aria-busy="true">' +
      '<span class="sr-only">Chargement de la composition</span></section>'
   );
}

function characterCompositionHtml(record) {
   if (!record) return "";
   const hasComposition = Boolean(record.tree);
   const pictophonetic = record.etymology?.type === "pictophonetic";
   const roles = hasComposition && pictophonetic
      ? [
           compositionRoleHtml(record.etymology.semantic, "sens", record, true),
           compositionRoleHtml(record.etymology.phonetic, "son", record, false),
        ].filter(Boolean)
      : [];
   const sourceTitle =
      "Source : Make Me a Hanzi dictionary.txt · LGPL v3+ · révision " +
      CHARACTER_COMPOSITION_REVISION +
      (record.sourceLine ? " · ligne " + record.sourceLine : "");
   return (
      (hasComposition
         ? '<div class="composition-primary"><span class="eyebrow">Composition</span>' +
           '<span class="composition-formula">' + compositionTreeHtml(record.tree, record, false) + "</span></div>"
         : "") +
      compositionOriginHtml(record) +
      (hasComposition
         ? '<div class="composition-secondary">' +
           (roles.length ? '<span class="composition-roles">' + roles.join('<span class="composition-dot" aria-hidden="true">·</span>') + "</span>" : "") +
           '<span class="cd-cat composition-radical"><span>Clé</span>' +
           compositionComponentHtml(record.radical, record, "composition-radical-character") +
           "</span>" +
           '<abbr class="composition-source" title="' + esc(sourceTitle) + '">MMH</abbr></div>'
         : "")
   );
}

function characterCompositionTargets(scope) {
   if (!scope) return [];
   if (typeof scope === "string") return Array.from(document.querySelectorAll(scope));
   if (scope.matches && scope.matches(".character-composition")) return [scope];
   return scope.querySelectorAll
      ? Array.from(scope.querySelectorAll(".character-composition"))
      : [];
}

function setCharacterCompositionLoading(character, scope) {
   characterCompositionTargets(scope).forEach((target) => {
      target.hidden = false;
      target.classList.add("is-loading");
      target.classList.remove("is-hint-only");
      target.setAttribute("aria-busy", "true");
      target.dataset.character = character;
      target.innerHTML = '<span class="sr-only">Chargement de la composition de ' + esc(character) + "</span>";
   });
}

function renderCharacterComposition(record, scope) {
   characterCompositionTargets(scope).forEach((target) => {
      target.classList.remove("is-loading");
      target.setAttribute("aria-busy", "false");
      if (!record) {
         target.hidden = true;
         target.classList.remove("is-hint-only");
         target.innerHTML = "";
         return;
      }
      target.hidden = false;
      target.classList.toggle("is-hint-only", !record.tree);
      target.dataset.character = record.character;
      target.innerHTML = characterCompositionHtml(record);
      target.querySelectorAll("[data-composition-character]").forEach((button) => {
         button.onclick = (event) => {
            event.preventDefault();
            event.stopPropagation();
            openCompositionCharacter(button.dataset.compositionCharacter);
         };
      });
   });
}

async function openCompositionCharacter(character) {
   if (!character || !/^\p{Script=Han}$/u.test(character)) return;
   let entry = null;
   try {
      if (typeof dictionaryCharacterStudyEntry === "function")
         entry = await dictionaryCharacterStudyEntry(character);
      else if (typeof findDictionaryEntryByHanzi === "function")
         entry = await findDictionaryEntryByHanzi(character);
   } catch (error) {
      entry = null;
   }
   entry ||= typeof normalizeDetailEntry === "function"
      ? normalizeDetailEntry({ hz: character })
      : null;
   if (!entry) return;
   if (
      typeof openSearchDictionaryDetail === "function" &&
      typeof activeView !== "undefined" &&
      activeView === "search"
   ) openSearchDictionaryDetail(entry, true);
   else if (typeof openDictDetail === "function") openDictDetail(entry);
}
