import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = 8018;
const debugPort = 9351;
const url = `http://127.0.0.1:${port}/`;
const edge = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const profile = await mkdtemp(path.join(os.tmpdir(), "mo-confusable-pairs-"));
const ficheScreenshot = path.join(os.tmpdir(), "mo-confusable-pairs-fiche-390.png");
const testScreenshot = path.join(os.tmpdir(), "mo-confusable-pairs-test-390.png");
let server, browser, cdp;

function assert(value, message) { if (!value) throw new Error(message); }
function pass(name) { console.log("PASS " + name); }
async function waitFor(fn, message, timeout = 20000) {
   const end = Date.now() + timeout;
   while (Date.now() < end) {
      try { const value = await fn(); if (value) return value; } catch (_) {}
      await new Promise((resolve) => setTimeout(resolve, 80));
   }
   throw new Error(message);
}

class Cdp {
   constructor(socket) {
      this.socket = socket; this.id = 0; this.pending = new Map(); this.errors = [];
      socket.onmessage = ({ data }) => {
         const message = JSON.parse(data);
         if (message.id) {
            const pending = this.pending.get(message.id); this.pending.delete(message.id);
            if (message.error) pending.reject(new Error(message.error.message)); else pending.resolve(message.result);
         } else if (message.method === "Runtime.exceptionThrown")
            this.errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
      };
   }
   static async connect(ws) { const socket = new WebSocket(ws); await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; }); return new Cdp(socket); }
   send(method, params = {}) { const id = ++this.id; return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.socket.send(JSON.stringify({ id, method, params })); }); }
}

async function evaluate(expression) {
   const result = await cdp.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: true });
   if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
   return result.result.value;
}

async function click(selector) {
   return evaluate(`(() => { const node=document.querySelector(${JSON.stringify(selector)}); if(!node) throw new Error('missing ${selector}'); node.click(); return true; })()`);
}

async function main() {
   server = spawn("python", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore", windowsHide: true });
   await waitFor(async () => (await fetch(url)).ok, "server failed");
   browser = spawn(edge, ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-extensions", "--no-first-run", `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore", windowsHide: true });
   const version = await waitFor(async () => { try { const response = await fetch(`http://127.0.0.1:${debugPort}/json/version`); return response.ok && response.json(); } catch (_) { return false; } }, "browser failed");
   const pages = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
   cdp = await Cdp.connect(pages.find((item) => item.type === "page").webSocketDebuggerUrl);
   await Promise.all([cdp.send("Page.enable"), cdp.send("Runtime.enable"), cdp.send("Log.enable")]);
   await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
   await cdp.send("Page.navigate", { url });
   await waitFor(() => evaluate("document.readyState==='complete' && document.querySelector('#view')?.children.length"), "application init failed");

   /* ================= Partie B : fiche ================= */

   await evaluate("openDictDetail(normalizeDetailEntry({ hz: '未' }))");
   await waitFor(() => evaluate("!document.getElementById('dd-confusable-pairs')?.hidden"), "la section paires confusables n'apparaît pas sur la fiche de 未");
   const ficheState = await evaluate(`(() => {
      const section = document.getElementById('dd-confusable-pairs');
      const items = Array.from(section.querySelectorAll('[data-confusable-character]')).map((b) => b.dataset.confusableCharacter);
      const rect = section.getBoundingClientRect();
      const strokeOrder = document.querySelector('.dd-character-interaction').getBoundingClientRect();
      return { items, below: rect.top > strokeOrder.top, overflow: document.documentElement.scrollWidth > innerWidth + 1 };
   })()`);
   assert(ficheState.items.includes("末"), "末 n'apparaît pas comme partenaire de 未 : " + JSON.stringify(ficheState));
   assert(ficheState.below, "la section paires confusables n'est pas sous l'ordre des traits");
   assert(!ficheState.overflow, "la section paires confusables provoque un débordement horizontal à 390px");
   pass("fiche : ligne « à ne pas confondre » sous l'ordre des traits, sans débordement horizontal");

   await evaluate("document.getElementById('dd-confusable-pairs').scrollIntoView({block:'center'})");
   await new Promise((resolve) => setTimeout(resolve, 250));
   const ficheImage = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true, clip: { x: 0, y: 0, width: 390, height: 844, scale: 1 } });
   await writeFile(ficheScreenshot, Buffer.from(ficheImage.data, "base64"));
   pass(`capture fiche 390 × 844 · ${ficheScreenshot}`);

   await click('[data-confusable-character="末"]');
   await waitFor(() => evaluate("document.querySelector('.cd-hz')?.textContent==='末'"), "le clic sur le partenaire ne navigue pas vers sa fiche");
   pass("clic sur le partenaire navigue vers sa propre fiche (末)");
   await evaluate("closeSheet()");

   await evaluate("openDictDetail(normalizeDetailEntry({ hz: '你' }))");
   await new Promise((resolve) => setTimeout(resolve, 300));
   assert(await evaluate("document.getElementById('dd-confusable-pairs')?.hidden !== false"), "la section apparaît pour un caractère sans partenaire connu (你)");
   pass("aucune section affichée pour un caractère sans partenaire connu");
   await evaluate("closeSheet()");

   /* ================= Partie C : révision — garde-fous ================= */

   const now0 = await evaluate(`(async () => {
      db.cards = [];
      const now0 = Date.now();
      const cardMo = normalizeCard({ hz: '末', py: 'mò', fr: 'bout, fin' }, false);
      cardMo.lastReviewed = now0 - 50000;
      cardMo.reviewHistory = [{ at: now0 - 50000, grade: 'good', level: 2, due: now0 }];
      cardMo.lvl = 2;
      cardMo.due = now0;
      db.cards.push(cardMo);
      save();
      await preloadConfusablePairs(['末']);
      return now0;
   })()`);

   // Garde-fou non négociable (1/2) : le jumeau (未) n'a aucune carte du tout.
   await evaluate("startCardsWith([db.cards.find((c) => c.hz === '末')], 'g1', 'cards')");
   await click("#s-flip");
   await click('[data-grade="good"]');
   await new Promise((resolve) => setTimeout(resolve, 250));
   assert(!(await evaluate("sheetOpen() && !!document.querySelector('.confusable-test-choices')")), "le test s'est déclenché alors que le jumeau n'a aucune carte");
   pass("garde-fou : aucun test si le jumeau (未) n'a jamais eu de carte");
   await evaluate("session={active:false};");

   // Garde-fou non négociable (2/2) : le jumeau a une carte, mais jamais notée
   // (lastReviewed === null) — « jamais vu » même si le caractère revu, lui, est
   // bien connu.
   await evaluate(`(() => {
      const cardWei = normalizeCard({ hz: '未', py: 'wèi', fr: 'pas encore' }, false);
      db.cards.push(cardWei); // lastReviewed reste null : carte jamais notée
      const cardMo = db.cards.find((c) => c.hz === '末');
      cardMo.due = Date.now();
      save();
   })()`);
   await evaluate("preloadConfusablePairs(['未','末'])");
   await evaluate("startCardsWith([db.cards.find((c) => c.hz === '末')], 'g2', 'cards')");
   await click("#s-flip");
   await click('[data-grade="good"]');
   await new Promise((resolve) => setTimeout(resolve, 250));
   assert(!(await evaluate("sheetOpen() && !!document.querySelector('.confusable-test-choices')")), "le test s'est déclenché alors que la carte du jumeau n'a jamais été notée");
   assert((await evaluate("db.cards.find((c) => c.hz === '未').lastReviewed")) === null, "le jumeau ne devrait toujours pas avoir été noté à ce stade du scénario");
   pass("garde-fou : aucun test si la carte du jumeau existe mais n'a jamais été notée (lastReviewed null)");
   await evaluate("session={active:false};");

   /* ================= Partie C : déclenchement normal, capture, effets ================= */

   await evaluate(`(() => {
      const now0 = Date.now();
      const cardWei = db.cards.find((c) => c.hz === '未');
      cardWei.lastReviewed = now0 - 100000;
      cardWei.reviewHistory = [
         { at: now0 - 200000, grade: 'good', level: 2, due: now0 },
         { at: now0 - 100000, grade: 'good', level: 3, due: now0 },
      ];
      cardWei.lvl = 3;
      const cardMo = db.cards.find((c) => c.hz === '末');
      cardMo.due = now0;
      save();
      return true;
   })()`);
   await evaluate("preloadConfusablePairs(['未','末'])");
   await evaluate("startCardsWith([db.cards.find((c) => c.hz === '末'), db.cards.find((c) => c.hz === '未')], 'g3', 'cards')");
   await click("#s-flip");
   await click('[data-grade="good"]');
   await waitFor(() => evaluate("!!document.querySelector('.confusable-test-choices')"), "le test ne se déclenche pas pour une paire éligible (jumeau étudié et bien connu)");
   pass("le test se déclenche pour une paire éligible");
   // Capturé après la notation « good » elle-même (qui, légitimement, change lvl
   // et reviewHistory) mais avant la réponse au test : c'est cet instantané, pas
   // l'état d'avant-notation, qui isole l'effet propre du test de discrimination.
   const before = await evaluate(`(() => {
      const c = db.cards.find((c) => c.hz === '末');
      return { lvl: c.lvl, historyLength: c.reviewHistory.length };
   })()`);

   await new Promise((resolve) => setTimeout(resolve, 200));
   const testImage = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true, clip: { x: 0, y: 0, width: 390, height: 844, scale: 1 } });
   await writeFile(testScreenshot, Buffer.from(testImage.data, "base64"));
   pass(`capture test de discrimination 390 × 844 · ${testScreenshot}`);

   await evaluate(`(() => {
      const wrong = Array.from(document.querySelectorAll('[data-confusable-choice]')).find((b) => b.dataset.confusableChoice !== '末');
      wrong.click();
   })()`);
   await new Promise((resolve) => setTimeout(resolve, 200));
   const after = await evaluate(`(() => {
      const c = db.cards.find((c) => c.hz === '末');
      return {
         lvl: c.lvl,
         historyLength: c.reviewHistory.length,
         dueDeltaMinutes: Math.round((c.due - Date.now()) / 60000),
         verdictClass: document.querySelector('.confusable-test-verdict')?.className || '',
         toastShown: document.getElementById('toast')?.classList.contains('show'),
      };
   })()`);
   assert(after.lvl === before.lvl, "une réponse fausse a changé le niveau SRS : " + JSON.stringify({ before, after }));
   assert(after.historyLength === before.historyLength, "une réponse fausse a ajouté une entrée à reviewHistory : " + JSON.stringify({ before, after }));
   assert(after.dueDeltaMinutes >= 9 && after.dueDeltaMinutes <= 11, "la reprogrammation n'est pas d'environ 10 minutes : " + JSON.stringify(after));
   assert(after.verdictClass.includes("ko"), "le verdict d'une réponse fausse n'est pas stylé comme incorrect");
   assert(after.toastShown, "aucun toast affiché après une réponse fausse");
   pass("réponse fausse : due reprogrammée à +10 min, niveau et historique de notation inchangés, toast affiché");

   await click("#confusable-test-continue");
   await waitFor(() => evaluate("!sheetOpen()"), "« Continuer » ne ferme pas le sheet");
   pass("« Continuer » ferme le sheet et reprend la séance (pas de fermeture automatique)");

   // Fréquence limitée : la seconde carte éligible de la même séance (未) ne doit
   // pas redéclencher le test.
   assert((await evaluate("session.active && session.live.confusableShown")) === 1, "le compteur de déclenchement n'est pas à 1");
   await click("#s-flip");
   await new Promise((resolve) => setTimeout(resolve, 100));
   const gradeExists = await evaluate("!!document.querySelector('[data-grade=\"good\"]')");
   if (gradeExists) await click('[data-grade="good"]');
   await new Promise((resolve) => setTimeout(resolve, 200));
   assert(!(await evaluate("sheetOpen() && !!document.querySelector('.confusable-test-choices')")), "le test s'est redéclenché une deuxième fois dans la même séance");
   pass("fréquence limitée : au plus un test par séance");
   await evaluate("session={active:false};");

   assert(!cdp.errors.length, "erreurs d'exécution : " + cdp.errors.join(" | "));
   console.log(`RESULT ${version.Browser} — paires confusables (fiche + révision) validées`);
}

try { await main(); }
catch (error) { console.error("FAIL " + (error.stack || error.message)); process.exitCode = 1; }
finally {
   if (cdp?.socket) cdp.socket.close();
   if (browser && !browser.killed) browser.kill();
   if (server && !server.killed) server.kill();
   await new Promise((resolve) => setTimeout(resolve, 250));
   await rm(profile, { recursive: true, force: true }).catch(() => {});
}
