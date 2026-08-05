import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = 8011;
const debugPort = 9344;
const url = `http://127.0.0.1:${port}/`;
const edge = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const profile = await mkdtemp(path.join(os.tmpdir(), "mo-packs-test-"));
let server, browser, cdp;

function assert(value, message) { if (!value) throw new Error(message); }
function pass(name) { console.log("PASS " + name); }
async function waitFor(fn, message, timeout = 20000) {
   const end = Date.now() + timeout;
   while (Date.now() < end) {
      try { const value = await fn(); if (value) return value; } catch (_) {}
      await new Promise((resolve) => setTimeout(resolve, 100));
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
         } else if (message.method === "Runtime.exceptionThrown") this.errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
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

async function navigate() {
   await cdp.send("Page.navigate", { url });
   await waitFor(() => evaluate("document.readyState === 'complete' && typeof personalLibraryInit === 'function' && document.querySelector('#view')?.children.length"), "application init failed");
}

async function click(selector) {
   return evaluate(`(() => { const node = document.querySelector(${JSON.stringify(selector)}); if (!node) throw new Error('missing ${selector}'); node.click(); return true; })()`);
}

async function main() {
   server = spawn("python", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore", windowsHide: true });
   await waitFor(async () => (await fetch(url)).ok, "server failed");
   browser = spawn(edge, ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-extensions", "--no-first-run", `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore", windowsHide: true });
   const version = await waitFor(async () => { try { const response = await fetch(`http://127.0.0.1:${debugPort}/json/version`); return response.ok && response.json(); } catch (_) { return false; } }, "browser failed");
   const pages = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
   cdp = await Cdp.connect(pages.find((item) => item.type === "page").webSocketDebuggerUrl);
   await Promise.all([cdp.send("Page.enable"), cdp.send("Runtime.enable"), cdp.send("Log.enable")]);
   await navigate();

   await evaluate(`(async () => {
      if (personalDbHandle) personalDbHandle.close();
      await new Promise((resolve) => { const request = indexedDB.deleteDatabase(PERSONAL_DB_NAME); request.onsuccess = request.onerror = request.onblocked = resolve; });
      localStorage.setItem(DB_KEY, JSON.stringify({
         cards: [{ id: 'legacy-card', hz: '旧', py: 'jiù', fr: 'ancien', cat: 'Archive', lvl: 3, due: 1893456000000, created: 1 }],
         packs: [{ id: 'legacy-pack', name: 'Ancien pack', cardIds: ['legacy-card'] }],
         units: {}, settings: {}
      }));
   })()`);
   await navigate();
   const migrated = await evaluate(`({ cards: db.cards.length, packs: db.packs.length, categories: db.categories.length, memberships: db.memberships.length, level: db.cards[0].lvl })`);
   assert(migrated.cards === 1 && migrated.packs === 1 && migrated.categories === 1 && migrated.memberships === 1 && migrated.level === 3, "legacy migration lost data");
   await navigate();
   assert((await evaluate("db.memberships.length")) === 1, "migration was not idempotent");
   pass("migration sûre, ancienne carte/pack/progression et idempotence");

   await evaluate(`(async () => { db.cards=[]; db.packs=[]; db.categories=[]; db.memberships=[]; save(); await flushPersonalLibrary(); })()`);
   await evaluate(`(() => { const pack=createPersonalPack('Livres','Vocabulaire de mes livres'); for(let i=1;i<=30;i++) createPersonalCategory(pack.id,'Chapitre '+i); return pack.id; })()`);
   const structure = await evaluate(`({ packs: db.packs.length, categories: categoriesForPack(db.packs[0].id).length })`);
   assert(structure.packs === 1 && structure.categories === 30, "pack / 30 categories creation failed");
   pass("création d’un pack et de 30 sous-catégories");

   const json = JSON.stringify({ version: 1, pack: { name: "Import JSON", description: "Test", categories: [
      { name: "Chapitre 1", words: [{ chinese: "你好", pinyin: "nǐ hǎo", translation: "bonjour", favorite: true }] },
      { name: "Chapitre 2", words: [{ chinese: "你好", pinyin: "nǐ hǎo", translation: "bonjour" }, { chinese: "朋友", translation: "ami", difficult: true }] }
   ] } });
   const preview = await evaluate(`(async () => { const before=JSON.stringify(db); const p=await buildPackImportPreview(parsePackJson(${JSON.stringify(json)}),'json'); return { stats:{categories:p.categoryCount,words:p.wordCount,duplicates:p.duplicates,incomplete:p.incomplete}, untouched:before===JSON.stringify(db), errors:p.errors }; })()`);
   assert(preview.untouched && !preview.errors.length && preview.stats.categories === 2 && preview.stats.words === 3 && preview.stats.duplicates === 1, "JSON preview failed");
   await evaluate(`(async () => { const p=await buildPackImportPreview(parsePackJson(${JSON.stringify(json)}),'json'); window.__importResult=applyPackImport(p,{mode:'new',skipDuplicates:true,importMissing:true}); await flushPersonalLibrary(); })()`);
   const imported = await evaluate(`(() => { const card=db.cards.find(c=>c.hz==='你好'); const cats=categoriesForCard(card.id); return { unique:db.cards.filter(c=>c.hz==='你好').length, memberships:cats.length, favorite:card.fav, friend:db.cards.find(c=>c.hz==='朋友') }; })()`);
   assert(imported.unique === 1 && imported.memberships === 2 && imported.favorite && imported.friend.difficult, "dedup/multi-membership failed");
   pass("import JSON, aperçu sans mutation, doublon partagé et favoris/difficiles");

   const invalidSource = '{\n "pack": [}';
   const invalid = await evaluate(`(() => { try { parsePackJson(${JSON.stringify(invalidSource)}); return ''; } catch(e) { return e.message; } })()`);
   assert(/ligne|JSON invalide/.test(invalid), "invalid JSON location missing");
   const csvResult = await evaluate(`(async () => { const payload=csvToPackPayload('pack,category,chinese,pinyin,translation,notes,tags\\nCSV,Leçon,谢谢,xièxie,merci,,politesse'); const p=await buildPackImportPreview(payload,'csv'); const before=JSON.stringify(db); const result=applyPackImport(p,{mode:'new'}); return {source:p.sourceType, words:p.wordCount, added:result.added, previewWasSafe:before!==JSON.stringify(db)}; })()`);
   assert(csvResult.source === "csv" && csvResult.words === 1 && csvResult.added === 1, "CSV import failed");
   pass("JSON invalide localisé et import CSV");

   await evaluate("setView('lib'); lib.level='packs'; renderLib()");
   await click("#lib-import");
   assert(await evaluate("!!document.querySelector('#pack-file-json') && !!document.querySelector('#pack-file-csv') && !!document.querySelector('#import-paste')"), "import sources missing");
   const pasteJson = JSON.stringify({ version: 1, pack: { name: "Collé", categories: [{ name: "Direct", words: [{ chinese: "书", translation: "livre" }] }] } });
   await evaluate(`document.querySelector('#import-paste').value=${JSON.stringify(pasteJson)}`);
   await click("#import-paste-preview");
   await waitFor(() => evaluate("!!document.querySelector('#import-confirm')"), "pasted JSON preview missing");
   assert((await evaluate("document.querySelector('#sheet').textContent")).includes("Collé"), "pasted pack name absent");
   await click("#import-cancel");
   pass("fichiers JSON/CSV, collage direct et aperçu UI");

   const srs = await evaluate(`(async () => {
      const card=db.cards.find(c=>c.hz==='你好'); const id=card.id; card.lvl=5; card.due=1900000000000; card.reviewHistory=[{at:1800000000000,grade:'good'}]; save();
      const p=await buildPackImportPreview(parsePackJson(${JSON.stringify(json)}),'json'); applyPackImport(p,{mode:'merge',targetPackId:db.packs.find(x=>x.name==='Import JSON').id});
      const after=db.cards.filter(c=>c.hz==='你好'); return {count:after.length,same:after[0].id===id,level:after[0].lvl,due:after[0].due,history:after[0].reviewHistory.length};
   })()`);
   assert(srs.count === 1 && srs.same && srs.level === 5 && srs.due === 1900000000000 && srs.history === 1, "SRS was not preserved on reimport");
   pass("progression SRS commune et conservée au réimport");

   const senses = await evaluate(`(async () => {
      const payload={version:1,pack:{name:'Sens',categories:[{name:'Nuances',words:[{chinese:'你好',pinyin:'ni3 hao3',translation:'salut'}]}]}};
      let p=await buildPackImportPreview(payload,'json'); applyPackImport(p,{mode:'new'});
      p=await buildPackImportPreview(payload,'json'); applyPackImport(p,{mode:'merge',targetPackId:db.packs.find(x=>x.name==='Sens').id});
      return db.cards.filter(c=>c.hz==='你好').map(c=>({fr:c.fr,senseId:c.senseId}));
   })()`);
   assert(senses.length === 2 && senses.some((item) => item.fr === "salut" && item.senseId), "distinct senses or senseId failed");
   pass("sens distincts avec senseId sans duplication au réimport");

   const selections = await evaluate(`(() => {
      const pack=db.packs.find(p=>p.name==='Import JSON'); const cats=categoriesForPack(pack.id);
      reviewExtraFilters={newOnly:false,favoritesOnly:false,difficultOnly:false,includeLearned:true};
      reviewPackId=pack.id; reviewSelectionMode='pack'; const whole=reviewSelectedCards().length;
      reviewCategoryId=cats[0].id; reviewCategoryPackId=pack.id; reviewSelectionMode='category'; const one=reviewSelectedCards().length;
      manualReviewIds=new Set(db.cards.slice(0,2).map(c=>c.id)); reviewSelectionMode='manual'; const manual=reviewSelectedCards().length;
      reviewSelectionMode='all'; reviewExtraFilters.favoritesOnly=true; const favorite=reviewSelectedCards().length;
      reviewExtraFilters.favoritesOnly=false; reviewExtraFilters.difficultOnly=true; const difficult=reviewSelectedCards().length;
      return {whole,one,manual,favorite,difficult};
   })()`);
   assert(selections.whole === 2 && selections.one === 1 && selections.manual === 2 && selections.favorite >= 1 && selections.difficult >= 1, "review scopes failed");
   pass("sélection pack, sous-catégorie, manuelle et filtres supplémentaires");

   const exports = await evaluate(`(() => { db.cards.push(normalizeCard({hz:'独',py:'dú',fr:'seul',note:'hors pack'},false)); const pack=db.packs.find(p=>p.name==='Import JSON'); const one=buildLibraryExport([pack.id]); const all=buildLibraryExport(); return {onePacks:one.packs.length,oneWords:one.packs[0].categories.reduce((n,c)=>n+c.words.length,0),allPacks:all.packs.length,unclassified:all.unclassifiedWords.length,srs:one.packs[0].categories.flatMap(c=>c.words).find(w=>w.chinese==='你好').srs.level}; })()`);
   assert(exports.onePacks === 1 && exports.oneWords === 3 && exports.allPacks >= 3 && exports.unclassified === 1 && exports.srs === 5, "exports incomplete");
   const restore = await evaluate(`(async () => {
      const backup=buildLibraryExport(); const before={cards:db.cards.length,packs:db.packs.length,categories:db.categories.length};
      db.cards=[];db.packs=[];db.categories=[];db.memberships=[];
      const p=await buildPackImportPreview(backup,'json'); applyPackImport(p,{mode:'new'});
      const card=db.cards.find(c=>c.hz==='你好'); return {before,after:{cards:db.cards.length,packs:db.packs.length,categories:db.categories.length},level:card.lvl,history:card.reviewHistory.length,orphan:db.cards.some(c=>c.hz==='独'&&!categoriesForCard(c.id).length)};
   })()`);
   assert(JSON.stringify(restore.before) === JSON.stringify(restore.after) && restore.level === 5 && restore.history === 1 && restore.orphan, "full restore lost data");
   pass("export d’un pack, export complet et réimport sans perte");

   for (const width of [360, 430, 1024]) {
      await cdp.send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width <= 430 });
      for (const view of ["lib", "learn"]) {
         await evaluate(`setView('${view}', {fromHistory:true})`);
         const layout = await evaluate(`({overflow:document.documentElement.scrollWidth>innerWidth+1, scrollWidth:document.documentElement.scrollWidth, innerWidth, short:[...document.querySelectorAll('#view button:not(.lib-crumb)')].filter(b=>getComputedStyle(b).display!=='none'&&!b.closest('.review-compat')).map(b=>({text:b.textContent.trim().slice(0,30),height:b.getBoundingClientRect().height})).filter(x=>x.height<43)})`);
         assert(!layout.overflow && !layout.short.length, `${view} layout failed at ${width}px: ${JSON.stringify(layout)}`);
      }
   }
   pass("interfaces 360 px, 430 px et 1024 px sans scroll horizontal et commandes tactiles");

   const hskIsolation = await evaluate(`({personal:db.cards.length, hskPersonal:db.cards.filter(c=>c.hsk30||c.hskLegacy).length, runtimeEntries:typeof HSK_TOTAL_ENTRIES==='undefined'?5399:HSK_TOTAL_ENTRIES})`);
   assert(hskIsolation.personal < 5399 && hskIsolation.hskPersonal === 0, "HSK data leaked into personal library");
   pass("aucun ajout automatique des 5 399 entrées HSK");
   assert(!cdp.errors.length, "runtime errors: " + cdp.errors.join(" | "));
   console.log(`RESULT ${version.Browser} — 20 scénarios couverts`);
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
