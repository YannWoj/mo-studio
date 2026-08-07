"use strict";

/* ================= données ================= */
         const DB_KEY = "mo-studio-v1";
         const SESSION_KEY = "mo-studio-session";
         const BACKUP_KEY = "mo-studio-backup";
         const defaultSettings = () => ({
            pinyin: "always", // always | reveal | never
            toneColors: true,
            rate: 0.85,
            voice: "",
            direction: "zh2fr", // zh2fr | fr2zh | mix
            writeModes: { pinyin: true, fr: true, trace: true },
            freeSize: 20, // taille des séances libres (0 = tout)
            listenLevel: 1, // 1 = 汉字+FR, 2 = 汉字, 3 = FR
            strokeSpeed: 1, // vitesse d'animation du tracé (0.25 à 2×)
            strokeGallery: {
               showFuture: true,
               showGrid: true,
            },
            writingBoard: {
               color: "#17140f",
               width: 5,
               grid: "tian",
               opacity: 0.18,
               modelVisible: true,
            },
         });
         function normalizeCard(c, keepId) {
            // Une carte personnelle exige uniquement les caractères chinois. Les
            // champs manquants restent explicitement incomplets : ils ne sont
            // jamais inventés pendant un import.
            if (!c || typeof c !== "object") return null;
            const hz = String(c.hz || c.chinese || "").trim();
            const fr = String(c.fr || c.translation || "").trim();
            if (!hz) return null;
            let py = String(c.py || c.pinyin || "").trim();
            if (/[0-9]/.test(py)) py = numToAccent(py);
            let exPy = String(c.exPy || "").trim();
            if (/[0-9]/.test(exPy)) exPy = numToAccent(exPy);
            return {
               id: keepId && c.id ? String(c.id) : uid(),
               hz,
               py,
               fr,
               cat: String(c.cat || "").trim(),
               exHz: String(c.exHz || "").trim(),
               exPy,
               exFr: String(c.exFr || "").trim(),
               note: String(c.note || c.notes || "").trim(),
               tags: Array.isArray(c.tags)
                  ? Array.from(new Set(c.tags.map((tag) => String(tag).trim()).filter(Boolean)))
                  : typeof c.tags === "string"
                    ? c.tags.split(/[;,]/).map((tag) => tag.trim()).filter(Boolean)
                    : [],
               difficult: !!c.difficult,
               incomplete: c.incomplete == null ? !py || !fr : !!c.incomplete,
               senseId: c.senseId ? String(c.senseId) : "",
               dictionaryEntryId: c.dictionaryEntryId ? String(c.dictionaryEntryId) : "",
               traditional: String(c.traditional || "").trim(),
               unit:
                  Number.isFinite(+c.unit) && c.unit !== "" && c.unit != null
                     ? +c.unit
                     : null,
               order:
                  Number.isFinite(+c.order) && c.order !== "" && c.order != null
                     ? +c.order
                     : null,
               lvl: Number.isFinite(+c.lvl)
                  ? Math.max(0, Math.min(MAXLVL, +c.lvl))
                  : 0,
               fav: !!c.fav,
               acquired: !!c.acquired,
               due: typeof c.due === "number" ? c.due : null,
               created: typeof c.created === "number" ? c.created : Date.now(),
               updated: typeof c.updated === "number" ? c.updated : Date.now(),
               lastReviewed:
                  typeof c.lastReviewed === "number" ? c.lastReviewed : null,
               reviewHistory: Array.isArray(c.reviewHistory)
                  ? c.reviewHistory.filter((item) => item && typeof item === "object")
                  : [],
            };
         }
         const cardKey = (c) =>
            c.hz +
            "§" +
            String(c.py || "")
               .toLowerCase()
               .normalize("NFC")
               .replace(/[^a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü]/g, "");
         function load() {
            let raw = null;
            try {
               raw = localStorage.getItem(DB_KEY);
               if (raw) {
                  const d = JSON.parse(raw);
                  const storedSettings =
                     d.settings && typeof d.settings === "object"
                        ? Object.assign({}, d.settings)
                        : {};
                  // Anciennes sauvegardes : ces options de séance ne sont plus
                  // utilisées. Elles restent acceptées, mais ne sont pas chargées.
                  delete storedSettings.sessionSize;
                  delete storedSettings.newPerSession;
                  const s = Object.assign(defaultSettings(), storedSettings);
                  s.writeModes = Object.assign(
                     { pinyin: true, fr: true, trace: true },
                     (d.settings && d.settings.writeModes) || {},
                  );
                  const storedStrokeGallery =
                     d.settings && d.settings.strokeGallery &&
                     typeof d.settings.strokeGallery === "object"
                        ? d.settings.strokeGallery
                        : {};
                  s.strokeGallery = {
                     showFuture:
                        typeof storedStrokeGallery.showFuture === "boolean"
                           ? storedStrokeGallery.showFuture
                           : true,
                     showGrid:
                        typeof storedStrokeGallery.showGrid === "boolean"
                           ? storedStrokeGallery.showGrid
                           : true,
                  };
                  s.writingBoard = Object.assign(
                     {
                        color: "#17140f",
                        width: 5,
                        grid: "tian",
                        opacity: 0.18,
                        modelVisible: true,
                     },
                     (d.settings && d.settings.writingBoard) || {},
                  );
                  return {
                     cards: Array.isArray(d.cards)
                        ? d.cards
                             .map((c) => normalizeCard(c, true))
                             .filter(Boolean)
                        : [],
                     packs: Array.isArray(d.packs)
                        ? d.packs.filter((p) => p && p.id && p.name).map((p) => ({
                             id: String(p.id),
                             name: String(p.name),
                             description: String(p.description || ""),
                             cardIds: Array.isArray(p.cardIds) ? p.cardIds.map(String) : [],
                             created: typeof p.created === "number" ? p.created : Date.now(),
                             updated: typeof p.updated === "number" ? p.updated : Date.now(),
                          }))
                        : [],
                     categories: Array.isArray(d.categories)
                        ? d.categories.filter((c) => c && c.id && c.packId && c.name)
                        : [],
                     memberships: Array.isArray(d.memberships)
                        ? d.memberships.filter((m) => m && m.cardId && m.categoryId)
                        : [],
                     personalLibraryUpdated:
                        typeof d.personalLibraryUpdated === "number"
                           ? d.personalLibraryUpdated
                           : 0,
                     units:
                        d.units &&
                        typeof d.units === "object" &&
                        !Array.isArray(d.units)
                           ? d.units
                           : {},
                     settings: s,
                  };
               }
            } catch (e) {
               // données corrompues : on les met de côté au lieu de les perdre
               try {
                  if (raw) localStorage.setItem(BACKUP_KEY + "-corrupt", raw);
               } catch (e2) {}
            }
            return {
               cards: [],
               packs: [],
               categories: [],
               memberships: [],
               personalLibraryUpdated: 0,
               units: {},
               settings: defaultSettings(),
            };
         }
         let db = load();
         function save() {
            if (typeof ensurePersonalLibraryShape === "function")
               ensurePersonalLibraryShape();
            db.personalLibraryUpdated = Date.now();
            try {
               localStorage.setItem(DB_KEY, JSON.stringify(db));
            } catch (e) {
               toast("Impossible d'enregistrer (stockage plein ?).");
            }
            if (typeof schedulePersonalLibraryPersist === "function")
               schedulePersonalLibraryPersist();
         }
         function makeBackup() {
            try {
               localStorage.setItem(
                  BACKUP_KEY,
                  JSON.stringify({
                     ts: Date.now(),
                     cards: db.cards,
                     packs: db.packs,
                     categories: db.categories,
                     memberships: db.memberships,
                     units: db.units,
                  }),
               );
            } catch (e) {}
         }
         function getBackup() {
            try {
               const b = JSON.parse(localStorage.getItem(BACKUP_KEY));
               if (b && Array.isArray(b.cards)) return b;
            } catch (e) {}
            return null;
         }
         function unitName(u) {
            if (u == null) return "";
            return db.units[String(u)] || "Unité " + u;
         }

         /* -------- sauvegarde / reprise de séance -------- */
         function persistSession() {
            try {
               if (!session.active) {
                  localStorage.removeItem(SESSION_KEY);
                  return;
               }
               localStorage.setItem(
                  SESSION_KEY,
                  JSON.stringify({
                     ts: Date.now(),
                     mode: session.mode,
                     ids: session.cards.map((c) => c.id),
                     index: session.index,
                     states: session.states,
                     live: session.live,
                     scopeLabel: session.scopeLabel,
                  }),
               );
            } catch (e) {}
         }
         function clearSavedSession() {
            try {
               localStorage.removeItem(SESSION_KEY);
            } catch (e) {}
         }
         function loadSavedSession() {
            try {
               const s = JSON.parse(localStorage.getItem(SESSION_KEY));
               if (
                  !s ||
                  !Array.isArray(s.ids) ||
                  Date.now() - s.ts > 24 * 3600e3
               )
                  return null;
               const cards = s.ids
                  .map((id) => db.cards.find((c) => c.id === id))
                  .filter(Boolean);
               if (cards.length < 2) return null;
               return { snap: s, cards };
            } catch (e) {
               return null;
            }
         }
         function resumeSession() {
            const r = loadSavedSession();
            if (!r) {
               clearSavedSession();
               renderLearn();
               return;
            }
            const st = Array.isArray(r.snap.states) ? r.snap.states : [];
            session = {
               active: true,
               mode: r.snap.mode || "cards",
               cards: r.cards,
               index: Math.min(r.snap.index || 0, r.cards.length - 1),
               states: r.cards.map((c, i) => st[i] || null),
               live: r.snap.live || { marked: 0, acquired: 0 },
               scopeLabel: r.snap.scopeLabel || "Séance",
            };
            renderSession();
         }
