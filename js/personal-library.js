"use strict";

/* ================= bibliothèque personnelle IndexedDB ================= */
const PERSONAL_DB_NAME = "mo-studio-personal-library";
const PERSONAL_DB_VERSION = 1;
const PERSONAL_SCHEMA_VERSION = 3;
let personalDbHandle = null;
let personalPersistTimer = 0;
let personalPersistChain = Promise.resolve();

function uniqueStrings(values) {
   return Array.from(new Set((values || []).map(String).filter(Boolean)));
}

function normalizePinyinIdentity(value) {
   let normalized = String(value || "").replace(/u:/gi, "ü");
   if (/[0-9]/.test(normalized)) normalized = numToAccent(normalized);
   return flatten(normalized);
}

function normalizeMeaningIdentity(value) {
   return flatten(String(value || ""));
}

function personalCardKey(card) {
   return [
      String(card.hz || card.chinese || "").trim(),
      normalizePinyinIdentity(card.py || card.pinyin),
      String(normalizeMeaningIdentity(card.fr || card.translation) || card.senseId || "").trim(),
   ].join("§");
}

function categoryById(id) {
   return db.categories.find((category) => category.id === id) || null;
}

function categoriesForPack(packId) {
   return db.categories.filter((category) => category.packId === packId);
}

function categoryCardIds(categoryId) {
   return uniqueStrings(
      db.memberships
         .filter((membership) => membership.categoryId === categoryId)
         .map((membership) => membership.cardId),
   );
}

function cardsForCategory(categoryId) {
   const ids = new Set(categoryCardIds(categoryId));
   return db.cards.filter((card) => ids.has(card.id));
}

function packCardIds(packId) {
   const categoryIds = new Set(categoriesForPack(packId).map((category) => category.id));
   return uniqueStrings(
      db.memberships
         .filter((membership) => categoryIds.has(membership.categoryId))
         .map((membership) => membership.cardId),
   );
}

function cardsForPack(packId) {
   const ids = new Set(packCardIds(packId));
   return db.cards.filter((card) => ids.has(card.id));
}

function categoriesForCard(cardId) {
   const ids = new Set(
      db.memberships
         .filter((membership) => membership.cardId === cardId)
         .map((membership) => membership.categoryId),
   );
   return db.categories.filter((category) => ids.has(category.id));
}

function syncLegacyPackCardIds() {
   db.packs.forEach((pack) => {
      pack.cardIds = packCardIds(pack.id);
   });
}

function ensurePersonalLibraryShape() {
   if (!Array.isArray(db.categories)) db.categories = [];
   if (!Array.isArray(db.memberships)) db.memberships = [];
   if (!Array.isArray(db.packs)) db.packs = [];
   if (!Array.isArray(db.cards)) db.cards = [];

   const cardIds = new Set(db.cards.map((card) => String(card.id)));
   const validPacks = new Set(db.packs.map((pack) => String(pack.id)));
   db.categories = db.categories
      .filter((category) => category && category.id && validPacks.has(String(category.packId)))
      .map((category) => ({
         id: String(category.id),
         packId: String(category.packId),
         name: String(category.name || "Sans titre").trim() || "Sans titre",
         created: typeof category.created === "number" ? category.created : Date.now(),
         updated: typeof category.updated === "number" ? category.updated : Date.now(),
      }));

   // Migration idempotente des anciens packs plats. Une catégorie historique
   // n'est créée que lorsqu'une appartenance n'existe pas encore.
   db.packs.forEach((pack) => {
      pack.id = String(pack.id);
      pack.name = String(pack.name || "Pack sans titre").trim() || "Pack sans titre";
      pack.description = String(pack.description || "");
      const legacyIds = uniqueStrings(pack.cardIds).filter((id) => cardIds.has(id));
      legacyIds.forEach((cardId) => {
         const alreadyLinked = db.memberships.some((membership) => {
            const category = categoryById(membership.categoryId);
            return membership.cardId === cardId && category && category.packId === pack.id;
         });
         if (alreadyLinked) return;
         const card = db.cards.find((item) => item.id === cardId);
         const name = (card && card.cat) || "Tous les mots";
         let category = db.categories.find(
            (item) => item.packId === pack.id && item.name.toLocaleLowerCase("fr") === name.toLocaleLowerCase("fr"),
         );
         if (!category) {
            category = { id: uid(), packId: pack.id, name, created: Date.now(), updated: Date.now() };
            db.categories.push(category);
         }
         db.memberships.push({ id: category.id + "§" + cardId, categoryId: category.id, cardId });
      });
   });

   const categoryIds = new Set(db.categories.map((category) => category.id));
   const seenMemberships = new Set();
   db.memberships = db.memberships.filter((membership) => {
      if (!membership || !cardIds.has(String(membership.cardId)) || !categoryIds.has(String(membership.categoryId)))
         return false;
      membership.cardId = String(membership.cardId);
      membership.categoryId = String(membership.categoryId);
      membership.id = membership.categoryId + "§" + membership.cardId;
      if (seenMemberships.has(membership.id)) return false;
      seenMemberships.add(membership.id);
      return true;
   });
   syncLegacyPackCardIds();
   return db;
}

function openPersonalDatabase() {
   if (!globalThis.indexedDB) return Promise.resolve(null);
   return new Promise((resolve, reject) => {
      const request = indexedDB.open(PERSONAL_DB_NAME, PERSONAL_DB_VERSION);
      request.onupgradeneeded = () => {
         const database = request.result;
         ["cards", "packs", "categories", "memberships", "meta"].forEach((name) => {
            if (!database.objectStoreNames.contains(name)) database.createObjectStore(name, { keyPath: "id" });
         });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("IndexedDB indisponible."));
      request.onblocked = () => reject(new Error("La bibliothèque est ouverte dans un autre onglet."));
   });
}

function idbRequest(request) {
   return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
   });
}

function idbTransactionDone(transaction) {
   return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onabort = transaction.onerror = () => reject(transaction.error || new Error("Transaction IndexedDB annulée."));
   });
}

async function readPersonalDatabase() {
   if (!personalDbHandle) return null;
   const transaction = personalDbHandle.transaction(
      ["cards", "packs", "categories", "memberships", "meta"],
      "readonly",
   );
   const [cards, packs, categories, memberships, meta] = await Promise.all([
      idbRequest(transaction.objectStore("cards").getAll()),
      idbRequest(transaction.objectStore("packs").getAll()),
      idbRequest(transaction.objectStore("categories").getAll()),
      idbRequest(transaction.objectStore("memberships").getAll()),
      idbRequest(transaction.objectStore("meta").get("library")),
   ]);
   return { cards, packs, categories, memberships, meta };
}

async function persistPersonalLibraryNow() {
   if (!personalDbHandle) return;
   ensurePersonalLibraryShape();
   const snapshot = {
      cards: structuredClone(db.cards),
      packs: structuredClone(db.packs),
      categories: structuredClone(db.categories),
      memberships: structuredClone(db.memberships),
   };
   const transaction = personalDbHandle.transaction(
      ["cards", "packs", "categories", "memberships", "meta"],
      "readwrite",
   );
   ["cards", "packs", "categories", "memberships"].forEach((name) => {
      const store = transaction.objectStore(name);
      store.clear();
      snapshot[name].forEach((item) => store.put(item));
   });
   transaction.objectStore("meta").put({
      id: "library",
      schemaVersion: PERSONAL_SCHEMA_VERSION,
      migratedFrom: DB_KEY,
      updated: db.personalLibraryUpdated || Date.now(),
   });
   await idbTransactionDone(transaction);
}

function schedulePersonalLibraryPersist() {
   if (!personalDbHandle) return;
   clearTimeout(personalPersistTimer);
   personalPersistTimer = setTimeout(() => {
      personalPersistChain = personalPersistChain
         .then(persistPersonalLibraryNow)
         .catch((error) => console.error("Échec de sauvegarde IndexedDB", error));
   }, 40);
}

async function flushPersonalLibrary() {
   clearTimeout(personalPersistTimer);
   personalPersistChain = personalPersistChain.then(persistPersonalLibraryNow);
   return personalPersistChain;
}

async function personalLibraryInit() {
   ensurePersonalLibraryShape();
   try {
      personalDbHandle = await openPersonalDatabase();
      if (!personalDbHandle) return;
      const stored = await readPersonalDatabase();
      const hasStoredData = stored && stored.meta && stored.meta.schemaVersion >= PERSONAL_SCHEMA_VERSION;
      const localIsNewer = hasStoredData &&
         Number(db.personalLibraryUpdated || 0) > Number(stored.meta.updated || 0);
      if (hasStoredData && !localIsNewer) {
         // IndexedDB est autoritaire pour les données personnelles. Les réglages
         // et unités restent issus du contrat historique localStorage.
         db.cards = stored.cards.map((card) => normalizeCard(card, true)).filter(Boolean);
         db.packs = stored.packs;
         db.categories = stored.categories;
         db.memberships = stored.memberships;
         ensurePersonalLibraryShape();
         localStorage.setItem(DB_KEY, JSON.stringify(db));
      } else {
         // La transaction n'efface jamais la source locale. En cas d'échec,
         // l'application continue avec les anciennes données intactes.
         await persistPersonalLibraryNow();
      }
   } catch (error) {
      personalDbHandle = null;
      console.error("Migration IndexedDB non destructive échouée", error);
   }
}

function createPersonalPack(name, description) {
   const pack = {
      id: uid(),
      name: String(name || "").trim(),
      description: String(description || "").trim(),
      cardIds: [],
      created: Date.now(),
      updated: Date.now(),
   };
   if (!pack.name) return null;
   db.packs.push(pack);
   save();
   return pack;
}

function createPersonalCategory(packId, name) {
   if (!db.packs.some((pack) => pack.id === packId)) return null;
   const cleanName = String(name || "").trim();
   if (!cleanName) return null;
   if (
      db.categories.some(
         (category) =>
            category.packId === packId &&
            category.name.localeCompare(cleanName, "fr", { sensitivity: "accent" }) === 0,
      )
   ) return null;
   const category = {
      id: uid(), packId, name: cleanName, created: Date.now(), updated: Date.now(),
   };
   db.categories.push(category);
   save();
   return category;
}

// Compatibilité avec l’ancien import plat : il devient un pack doté d’une
// sous-catégorie « Tous les mots », sans dupliquer les cartes.
function upsertPack(name, cardIds) {
   const cleanName = String(name || "").trim();
   if (!cleanName) return null;
   let pack = db.packs.find((item) => item.name.toLocaleLowerCase("fr") === cleanName.toLocaleLowerCase("fr"));
   if (!pack) pack = createPersonalPack(cleanName);
   let category = categoriesForPack(pack.id).find((item) => item.name === "Tous les mots");
   if (!category) category = createPersonalCategory(pack.id, "Tous les mots");
   uniqueStrings(cardIds).forEach((cardId) => addCardMembership(cardId, category.id));
   syncLegacyPackCardIds();
   save();
   return pack;
}

function addCardMembership(cardId, categoryId) {
   if (!db.cards.some((card) => card.id === cardId) || !categoryById(categoryId)) return false;
   const id = categoryId + "§" + cardId;
   if (db.memberships.some((membership) => membership.id === id)) return false;
   db.memberships.push({ id, categoryId, cardId });
   syncLegacyPackCardIds();
   return true;
}

function removeCardMembership(cardId, categoryId) {
   const before = db.memberships.length;
   db.memberships = db.memberships.filter(
      (membership) => membership.cardId !== cardId || membership.categoryId !== categoryId,
   );
   if (db.memberships.length === before) return false;
   syncLegacyPackCardIds();
   return true;
}

function setCardMemberships(cardId, categoryIds) {
   if (!db.cards.some((card) => card.id === cardId)) return false;
   const validCategoryIds = new Set(db.categories.map((category) => category.id));
   const wanted = new Set(uniqueStrings(categoryIds).filter((id) => validCategoryIds.has(id)));
   db.memberships = db.memberships.filter(
      (membership) => membership.cardId !== cardId || wanted.has(membership.categoryId),
   );
   wanted.forEach((categoryId) => addCardMembership(cardId, categoryId));
   syncLegacyPackCardIds();
   return true;
}

function removeCardsFromLibrary(cardIds) {
   const ids = new Set(cardIds);
   db.cards = db.cards.filter((card) => !ids.has(card.id));
   db.memberships = db.memberships.filter((membership) => !ids.has(membership.cardId));
   syncLegacyPackCardIds();
   invalidateDictIndex();
   save();
}

function deletePersonalCategory(categoryId) {
   db.categories = db.categories.filter((category) => category.id !== categoryId);
   db.memberships = db.memberships.filter((membership) => membership.categoryId !== categoryId);
   syncLegacyPackCardIds();
   save();
}

function deletePersonalPack(packId) {
   const categoryIds = new Set(categoriesForPack(packId).map((category) => category.id));
   db.packs = db.packs.filter((pack) => pack.id !== packId);
   db.categories = db.categories.filter((category) => category.packId !== packId);
   db.memberships = db.memberships.filter((membership) => !categoryIds.has(membership.categoryId));
   syncLegacyPackCardIds();
   save();
}

function jsonErrorWithLocation(error, source) {
   const match = /position\s+(\d+)/i.exec(error.message || "");
   if (!match) return "JSON invalide : " + error.message;
   const position = Number(match[1]);
   const before = source.slice(0, position);
   const line = before.split(/\r?\n/).length;
   const column = position - Math.max(before.lastIndexOf("\n"), before.lastIndexOf("\r"));
   return "JSON invalide à la ligne " + line + ", colonne " + column + " : " + error.message;
}

function parsePackJson(source) {
   let payload;
   try {
      payload = typeof source === "string" ? JSON.parse(source) : source;
   } catch (error) {
      throw new Error(jsonErrorWithLocation(error, String(source || "")));
   }
   return payload;
}

function parseCsvRows(source) {
   const rows = [];
   let row = [], field = "", quoted = false;
   const text = String(source || "").replace(/^\uFEFF/, "");
   for (let index = 0; index < text.length; index++) {
      const char = text[index];
      if (quoted) {
         if (char === '"' && text[index + 1] === '"') { field += '"'; index++; }
         else if (char === '"') quoted = false;
         else field += char;
      } else if (char === '"') quoted = true;
      else if (char === ",") { row.push(field); field = ""; }
      else if (char === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
      else field += char;
   }
   if (quoted) throw new Error("CSV invalide : guillemet non fermé.");
   if (field || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
   return rows.filter((item) => item.some((value) => String(value).trim()));
}

function csvToPackPayload(source) {
   const rows = parseCsvRows(source);
   if (!rows.length) throw new Error("Le fichier CSV est vide.");
   const supported = ["pack", "category", "chinese", "pinyin", "translation", "notes", "tags"];
   const first = rows[0].map((value) => value.trim().toLowerCase());
   const hasHeader = first.includes("chinese");
   const headers = hasHeader ? first : supported;
   const dataRows = hasHeader ? rows.slice(1) : rows;
   if (!headers.includes("chinese")) throw new Error("CSV invalide : colonne chinese manquante.");
   const packs = new Map();
   dataRows.forEach((row, rowIndex) => {
      const record = Object.fromEntries(headers.map((header, index) => [header, String(row[index] || "").trim()]));
      if (!record.chinese) throw new Error("CSV invalide : chinese manquant à la ligne " + (rowIndex + (hasHeader ? 2 : 1)) + ".");
      const packName = record.pack || "Pack importé";
      const categoryName = record.category || "Sans catégorie";
      if (!packs.has(packName)) packs.set(packName, new Map());
      const categories = packs.get(packName);
      if (!categories.has(categoryName)) categories.set(categoryName, []);
      categories.get(categoryName).push({
         chinese: record.chinese,
         pinyin: record.pinyin,
         translation: record.translation,
         notes: record.notes,
         tags: record.tags ? record.tags.split(/[;|]/).map((tag) => tag.trim()).filter(Boolean) : [],
      });
   });
   return {
      version: 1,
      packs: Array.from(packs, ([name, categories]) => ({
         name,
         categories: Array.from(categories, ([categoryName, words]) => ({ name: categoryName, words })),
      })),
      sourceType: "csv",
   };
}

function validatePackPayload(payload) {
   const errors = [];
   if (!payload || typeof payload !== "object" || Array.isArray(payload))
      return { errors: ["La racine doit être un objet JSON."], packs: [] };
   let packs = [];
   if (payload.pack) packs = [payload.pack];
   else if (Array.isArray(payload.packs)) packs = payload.packs;
   else errors.push("Champ obligatoire manquant : pack (ou packs pour une sauvegarde). ");
   if (Array.isArray(payload.unclassifiedWords) && payload.unclassifiedWords.length) {
      packs = packs.concat([{
         name: "Cartes non classées",
         description: "Cartes conservées hors pack dans la sauvegarde",
         __unclassified: true,
         categories: [{ name: "Sans catégorie", words: payload.unclassifiedWords }],
      }]);
   }
   packs.forEach((pack, packIndex) => {
      if (!pack || typeof pack !== "object") { errors.push("pack[" + packIndex + "] doit être un objet."); return; }
      if (!String(pack.name || "").trim()) errors.push("pack[" + packIndex + "].name est obligatoire.");
      if (!Array.isArray(pack.categories)) { errors.push("pack[" + packIndex + "].categories doit être un tableau."); return; }
      pack.categories.forEach((category, categoryIndex) => {
         const path = "pack[" + packIndex + "].categories[" + categoryIndex + "]";
         if (!category || typeof category !== "object") { errors.push(path + " doit être un objet."); return; }
         if (!String(category.name || "").trim()) errors.push(path + ".name est obligatoire.");
         if (!Array.isArray(category.words)) { errors.push(path + ".words doit être un tableau."); return; }
         category.words.forEach((word, wordIndex) => {
            if (!word || typeof word !== "object") errors.push(path + ".words[" + wordIndex + "] doit être un objet.");
            else if (!String(word.chinese || word.hz || "").trim()) errors.push(path + ".words[" + wordIndex + "].chinese est obligatoire.");
         });
      });
   });
   return { errors, packs };
}

async function dictionaryCompletion(chinese) {
   try {
      const index = await loadDictionaryIndex("exactHanzi", false);
      const references = index[chinese] || [];
      if (!references.length) return null;
      const entries = await loadDictionaryPreviewsByReferences(references.slice(0, 8));
      const exact = entries.filter((entry) => entry.simplified === chinese || entry.traditional === chinese);
      if (!exact.length) return null;
      const entry = exact[0];
      return {
         pinyin: entry.pinyin && entry.pinyin[0] ? entry.pinyin[0].marked : "",
         translation: entry.definitionsFr && entry.definitionsFr[0] ? entry.definitionsFr[0] : "",
         dictionaryId: entry.id,
      };
   } catch (error) {
      console.error("Complétion dictionnaire impossible", error);
      return null;
   }
}

async function dictionaryCompletions(chineseValues) {
   try {
      const index = await loadDictionaryIndex("exactHanzi", false);
      const wanted = uniqueStrings(chineseValues);
      const refs = uniqueStrings(wanted.flatMap((chinese) => (index[chinese] || []).slice(0, 8))).map(Number);
      const entries = await loadDictionaryPreviewsByReferences(refs);
      const output = new Map();
      wanted.forEach((chinese) => {
         const entry = entries.find((item) => item.simplified === chinese || item.traditional === chinese);
         if (!entry) return;
         output.set(chinese, {
            pinyin: entry.pinyin && entry.pinyin[0] ? entry.pinyin[0].marked : "",
            translation: entry.definitionsFr && entry.definitionsFr[0] ? entry.definitionsFr[0] : "",
            dictionaryId: entry.id,
         });
      });
      return output;
   } catch (error) {
      console.error("Complétion groupée du dictionnaire impossible", error);
      return new Map();
   }
}

async function buildPackImportPreview(payload, sourceType) {
   const validation = validatePackPayload(payload);
   const preview = {
      payload,
      sourceType: sourceType || payload.sourceType || "json",
      errors: validation.errors,
      packs: [],
      categoryCount: 0,
      wordCount: 0,
      duplicates: 0,
      existing: 0,
      missingDictionary: 0,
      incomplete: 0,
   };
   if (preview.errors.length) return preview;
   const chineseValues = validation.packs.flatMap((rawPack) =>
      rawPack.categories.flatMap((rawCategory) =>
         rawCategory.words.map((rawWord) => String(rawWord.chinese || rawWord.hz || "").trim()),
      ),
   );
   const dictionaryMatches = await dictionaryCompletions(chineseValues);
   const seenIncoming = new Map();
   const existingCards = db.cards.slice();
   for (const rawPack of validation.packs) {
      const pack = { name: String(rawPack.name).trim(), description: String(rawPack.description || "").trim(), unclassified: !!rawPack.__unclassified, categories: [] };
      for (const rawCategory of rawPack.categories) {
         const category = { name: String(rawCategory.name).trim(), words: [] };
         for (const rawWord of rawCategory.words) {
            const chinese = String(rawWord.chinese || rawWord.hz || "").trim();
            let pinyin = String(rawWord.pinyin || rawWord.py || "").trim();
            let translation = String(rawWord.translation || rawWord.fr || "").trim();
            const dictionary = dictionaryMatches.get(chinese) || null;
            if (!dictionary) preview.missingDictionary++;
            if (!pinyin && dictionary) pinyin = dictionary.pinyin;
            if (!translation && dictionary) translation = dictionary.translation;
            const word = {
               chinese, pinyin, translation,
               notes: String(rawWord.notes || rawWord.note || "").trim(),
               favorite: !!(rawWord.favorite || rawWord.fav),
               difficult: !!rawWord.difficult,
               tags: Array.isArray(rawWord.tags) ? rawWord.tags : typeof rawWord.tags === "string" ? rawWord.tags.split(/[;,]/) : [],
               senseId: rawWord.senseId ? String(rawWord.senseId) : "",
               incomplete: !pinyin || !translation,
               dictionaryId: dictionary ? dictionary.dictionaryId : "",
               sourceId: rawWord.id ? String(rawWord.id) : "",
               srs: rawWord.srs && typeof rawWord.srs === "object" ? rawWord.srs : null,
            };
            if (word.incomplete) preview.incomplete++;
            const key = personalCardKey({ hz: chinese, py: pinyin, fr: translation, senseId: word.senseId });
            const exactExisting = existingCards.find((card) => personalCardKey(card) === key);
            word.existingCardId = exactExisting ? exactExisting.id : "";
            if (exactExisting) preview.existing++;
            if (seenIncoming.has(key)) { preview.duplicates++; word.duplicateOf = seenIncoming.get(key); }
            else seenIncoming.set(key, word);
            category.words.push(word);
            preview.wordCount++;
         }
         pack.categories.push(category);
         preview.categoryCount++;
      }
      preview.packs.push(pack);
   }
   return preview;
}

function findReusableCard(word) {
   if (word.sourceId) {
      const byId = db.cards.find((card) => card.id === word.sourceId);
      if (byId) return byId;
   }
   const key = personalCardKey({ hz: word.chinese, py: word.pinyin, fr: word.translation, senseId: word.senseId });
   return db.cards.find((card) => personalCardKey(card) === key) || null;
}

function createCardFromImportedWord(word) {
   const sameHanziAndPinyin = db.cards.filter(
      (card) => card.hz === word.chinese && normalizePinyinIdentity(card.py) === normalizePinyinIdentity(word.pinyin),
   );
   const differentSense = sameHanziAndPinyin.some(
      (card) => normalizeMeaningIdentity(card.fr) !== normalizeMeaningIdentity(word.translation),
   );
   const card = normalizeCard({
      id: word.sourceId || undefined,
      hz: word.chinese,
      py: word.pinyin,
      fr: word.translation,
      note: word.notes,
      fav: word.favorite,
      difficult: word.difficult,
      tags: word.tags,
      incomplete: word.incomplete,
      senseId: word.senseId || (differentSense ? "sense-" + normalizeMeaningIdentity(word.translation || uid()) : ""),
      lvl: word.srs ? word.srs.level : 0,
      acquired: word.srs ? word.srs.acquired : false,
      due: word.srs ? word.srs.due : null,
      created: word.srs ? word.srs.created : Date.now(),
      updated: word.srs ? word.srs.updated : Date.now(),
      lastReviewed: word.srs ? word.srs.lastReviewed : null,
      reviewHistory: word.srs ? word.srs.reviewHistory : [],
   }, !!word.sourceId);
   db.cards.push(card);
   return card;
}

function applyPackImport(preview, options) {
   if (!preview || preview.errors.length) throw new Error("L'aperçu contient des erreurs.");
   const settings = Object.assign({ mode: "new", targetPackId: "", skipDuplicates: true, replaceStructure: false, importMissing: true }, options || {});
   makeBackup();
   const results = { added: 0, reused: 0, memberships: 0, packs: 0, categories: 0, skipped: 0 };
   const importWord = (word, category) => {
      if (word.incomplete && !settings.importMissing) { results.skipped++; return; }
      let card = findReusableCard(word);
      if (card) {
         results.reused++;
         card.fav = card.fav || word.favorite;
         card.difficult = card.difficult || word.difficult;
         card.tags = uniqueStrings([...(card.tags || []), ...(word.tags || [])]);
         if (!card.note && word.notes) card.note = word.notes;
      } else {
         card = createCardFromImportedWord(word);
         results.added++;
      }
      if (category && addCardMembership(card.id, category.id)) results.memberships++;
   };
   preview.packs.forEach((incomingPack, packIndex) => {
      if (incomingPack.unclassified) {
         incomingPack.categories.forEach((category) =>
            category.words.forEach((word) => importWord(word, null)),
         );
         return;
      }
      let pack = null;
      if (settings.mode === "merge" && settings.targetPackId)
         pack = db.packs.find((item) => item.id === settings.targetPackId) || null;
      if (!pack) pack = db.packs.find((item) => item.name.toLocaleLowerCase("fr") === incomingPack.name.toLocaleLowerCase("fr")) || null;
      if (!pack || settings.mode === "new") {
         pack = createPersonalPack(incomingPack.name, incomingPack.description);
         results.packs++;
      } else if (incomingPack.description && !pack.description) pack.description = incomingPack.description;

      if (settings.replaceStructure) {
         const oldCategoryIds = new Set(categoriesForPack(pack.id).map((category) => category.id));
         db.categories = db.categories.filter((category) => category.packId !== pack.id);
         db.memberships = db.memberships.filter((membership) => !oldCategoryIds.has(membership.categoryId));
      }

      incomingPack.categories.forEach((incomingCategory) => {
         let category = db.categories.find(
            (item) => item.packId === pack.id && item.name.toLocaleLowerCase("fr") === incomingCategory.name.toLocaleLowerCase("fr"),
         );
         if (!category) {
            category = { id: uid(), packId: pack.id, name: incomingCategory.name, created: Date.now(), updated: Date.now() };
            db.categories.push(category);
            results.categories++;
         }
         incomingCategory.words.forEach((word) => {
            importWord(word, category);
         });
      });
   });
   syncLegacyPackCardIds();
   invalidateDictIndex();
   save();
   return results;
}

function packExportObject(pack) {
   return {
      id: pack.id,
      name: pack.name,
      description: pack.description || "",
      created: pack.created,
      updated: pack.updated,
      categories: categoriesForPack(pack.id).map((category) => ({
         id: category.id,
         name: category.name,
         created: category.created,
         updated: category.updated,
         words: cardsForCategory(category.id).map((card) => ({
            id: card.id,
            chinese: card.hz,
            pinyin: card.py,
            translation: card.fr,
            notes: card.note,
            favorite: card.fav,
            difficult: card.difficult,
            tags: card.tags || [],
            incomplete: card.incomplete,
            senseId: card.senseId || "",
            srs: {
               level: card.lvl,
               acquired: card.acquired,
               due: card.due,
               created: card.created,
               updated: card.updated,
               lastReviewed: card.lastReviewed,
               reviewHistory: card.reviewHistory || [],
            },
         })),
      })),
   };
}

function buildLibraryExport(packIds) {
   const wanted = packIds ? new Set(packIds) : null;
   const packs = db.packs.filter((pack) => !wanted || wanted.has(pack.id));
   const includedCardIds = new Set(packs.flatMap((pack) => packCardIds(pack.id)));
   if (!wanted) db.cards.forEach((card) => includedCardIds.add(card.id));
   return {
      app: "mo-studio",
      type: wanted && wanted.size === 1 ? "pack" : "personal-library-backup",
      version: 3,
      exported: new Date().toISOString(),
      packs: packs.map(packExportObject),
      unclassifiedWords: db.cards.filter((card) => includedCardIds.has(card.id) && !categoriesForCard(card.id).length).map((card) => ({
         id: card.id, chinese: card.hz, pinyin: card.py, translation: card.fr, notes: card.note,
         favorite: card.fav, difficult: card.difficult, tags: card.tags || [], senseId: card.senseId || "",
         srs: { level: card.lvl, acquired: card.acquired, due: card.due, created: card.created, updated: card.updated, lastReviewed: card.lastReviewed, reviewHistory: card.reviewHistory || [] },
      })),
      settings: db.settings,
      units: db.units,
   };
}

function downloadJson(data, filename) {
   const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
   const link = document.createElement("a");
   link.href = URL.createObjectURL(blob);
   link.download = filename;
   document.body.appendChild(link);
   link.click();
   link.remove();
   setTimeout(() => URL.revokeObjectURL(link.href), 5000);
}

const PACK_JSON_EXAMPLE = `{
  "version": 1,
  "pack": {
    "name": "Livres",
    "description": "Vocabulaire de mes livres",
    "categories": [
      {
        "name": "Chapitre 1",
        "words": [
          { "chinese": "你好", "pinyin": "nǐ hǎo", "translation": "bonjour" },
          { "chinese": "朋友", "translation": "ami" }
        ]
      }
    ]
  }
}`;
