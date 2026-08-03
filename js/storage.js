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
            sessionSize: 20, // taille max de « Continuer » (0 = tout)
            newPerSession: 5, // nouvelles cartes par séance
            freeSize: 20, // taille des séances libres (0 = tout)
            listenLevel: 1, // 1 = 汉字+FR, 2 = 汉字, 3 = FR
            strokeSpeed: 1, // vitesse d'animation du tracé (0.25 à 2×)
            strokeGallery: {
               showFuture: true,
               showGrid: true,
               showGhost: false,
            },
         });
         function normalizeCard(c, keepId) {
            // nettoie une carte (import ou stockage) ; hz + fr obligatoires
            if (!c || typeof c !== "object") return null;
            const hz = String(c.hz || "").trim();
            const fr = String(c.fr || "").trim();
            if (!hz || !fr) return null;
            let py = String(c.py || "").trim();
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
               note: String(c.note || "").trim(),
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
                  const s = Object.assign(defaultSettings(), d.settings || {});
                  s.writeModes = Object.assign(
                     { pinyin: true, fr: true, trace: true },
                     (d.settings && d.settings.writeModes) || {},
                  );
                  s.strokeGallery = Object.assign(
                     { showFuture: true, showGrid: true, showGhost: false },
                     (d.settings && d.settings.strokeGallery) || {},
                  );
                  return {
                     cards: Array.isArray(d.cards)
                        ? d.cards
                             .map((c) => normalizeCard(c, true))
                             .filter(Boolean)
                        : [],
                     packs: Array.isArray(d.packs)
                        ? d.packs.filter(
                             (p) =>
                                p && p.id && p.name && Array.isArray(p.cardIds),
                          )
                        : [],
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
               units: {},
               settings: defaultSettings(),
            };
         }
         let db = load();
         function save() {
            try {
               localStorage.setItem(DB_KEY, JSON.stringify(db));
            } catch (e) {
               toast("Impossible d'enregistrer (stockage plein ?).");
            }
         }
         function makeBackup() {
            try {
               localStorage.setItem(
                  BACKUP_KEY,
                  JSON.stringify({
                     ts: Date.now(),
                     cards: db.cards,
                     packs: db.packs,
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
