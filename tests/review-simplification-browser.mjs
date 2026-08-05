import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = 8012;
const debugPort = 9345;
const url = `http://127.0.0.1:${port}/`;
const edge = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const profile = await mkdtemp(path.join(os.tmpdir(), "mo-review-simple-"));
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

async function choose(selector, value) {
   return evaluate(`(() => { const node=document.querySelector(${JSON.stringify(selector)}); node.value=${JSON.stringify(value)}; node.dispatchEvent(new Event('change',{bubbles:true})); return true; })()`);
}

async function main() {
   server = spawn("python", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore", windowsHide: true });
   await waitFor(async () => (await fetch(url)).ok, "server failed");
   browser = spawn(edge, ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-extensions", "--no-first-run", `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore", windowsHide: true });
   const version = await waitFor(async () => { try { const response = await fetch(`http://127.0.0.1:${debugPort}/json/version`); return response.ok && response.json(); } catch (_) { return false; } }, "browser failed");
   const pages = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
   cdp = await Cdp.connect(pages.find((item) => item.type === "page").webSocketDebuggerUrl);
   await Promise.all([cdp.send("Page.enable"), cdp.send("Runtime.enable"), cdp.send("Log.enable")]);
   await cdp.send("Page.navigate", { url });
   await waitFor(() => evaluate("document.readyState==='complete' && document.querySelector('#view')?.children.length"), "application init failed");

   const seeded = await evaluate(`(async () => {
      db.cards=[];db.packs=[];db.categories=[];db.memberships=[];
      const pack=createPersonalPack('Livres'); const chapter=createPersonalCategory(pack.id,'Chapitre 1'); const chapter2=createPersonalCategory(pack.id,'Chapitre 2'); const empty=createPersonalCategory(pack.id,'Chapitre vide');
      const cards=[
         normalizeCard({id:'c1',hz:'你好',py:'nǐ hǎo',fr:'bonjour',fav:true,lvl:4,due:Date.now()-1000,created:1},true),
         normalizeCard({id:'c2',hz:'朋友',py:'péngyou',fr:'ami',difficult:true,lvl:0,due:null,created:2},true),
         normalizeCard({id:'c3',hz:'书',py:'shū',fr:'livre',lvl:2,due:Date.now()+86400000,created:3},true),
         normalizeCard({id:'c4',hz:'会',py:'huì',fr:'savoir',lvl:6,acquired:true,due:null,created:4},true)
      ];
      db.cards.push(...cards); cards.slice(0,2).forEach(card=>addCardMembership(card.id,chapter.id)); cards.slice(2).forEach(card=>addCardMembership(card.id,chapter2.id)); syncLegacyPackCardIds(); save(); await flushPersonalLibrary();
      return {packId:pack.id,categoryId:chapter.id,category2Id:chapter2.id,emptyId:empty.id,srs:JSON.stringify(cards.map(c=>({id:c.id,lvl:c.lvl,due:c.due,acquired:c.acquired,history:c.reviewHistory}))),structure:JSON.stringify({packs:db.packs,categories:db.categories,memberships:db.memberships})};
   })()`);

   await evaluate("setView('lib',{fromHistory:true});lib.level='all';renderLib()");
   async function openDetail() {
      await evaluate(`(() => { const opener=document.querySelector('[data-word-open="c1"]'); opener.focus({preventScroll:true}); opener.click(); })()`);
      await waitFor(() => evaluate("sheetOpen() && !!document.querySelector('#card-close')"), "card detail did not open");
   }
   async function closedCorrectly(label) {
      const state = await evaluate(`({open:sheetOpen(),empty:!document.querySelector('#sheet .sheet-card').children.length,overflow:document.body.style.overflow,focus:document.activeElement?.dataset.wordOpen,controller:sheetAbortController,scrollMatches:window.scrollY===sheetScrollPosition.y})`);
      assert(!state.open && state.empty && state.overflow === "" && state.focus === "c1" && state.controller == null && state.scrollMatches, label + " cleanup failed: " + JSON.stringify(state));
   }

   await evaluate("document.body.style.minHeight='1800px';window.scrollTo(0,240)");
   await openDetail(); await click("#card-close"); await closedCorrectly("bottom close"); pass("23 Annuler/Fermer et restauration focus/scroll");
   await openDetail(); await click(".sheet-x"); await closedCorrectly("top close"); pass("croix de fermeture");
   await openDetail(); await evaluate("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))"); await closedCorrectly("escape"); pass("24 touche Échap");
   await openDetail(); await click("#sheet"); await closedCorrectly("backdrop"); pass("25 clic extérieur");
   await openDetail(); await click(".cd-head"); assert(await evaluate("sheetOpen()"), "inside click closed dialog"); await click("#card-close"); pass("26 clic intérieur sans fermeture");
   for (let index=0; index<5; index++) { await openDetail(); await click(index % 2 ? ".sheet-x" : "#card-close"); await closedCorrectly("repeat " + index); }
   pass("non-régression ouvertures et fermetures répétées");

   await evaluate("setView('learn',{fromHistory:true});reviewExtraFilters={newOnly:false,favoritesOnly:false,difficultOnly:false,includeLearned:false};reviewSelectionMode='all';renderLearn()");
   assert((await evaluate("reviewSelectedCards().length")) === 3, "all failed"); pass("1 Tous mes mots");
   await click('[data-review-scope="due"]'); assert((await evaluate("reviewSelectedCards().length")) === 1, "due failed"); pass("2 Cartes dues");
   await click('[data-review-scope="pack"]'); assert(await evaluate("!!document.querySelector('[data-review-pack-option]')&&!document.querySelector('[data-review-category-option]')"), "conditional pack list failed"); await click(`[data-review-pack-option="${seeded.packId}"]`); assert((await evaluate("reviewSelectedCards().length")) === 3, "pack cards failed"); pass("3 sélection d’un pack");
   await click('[data-review-scope="category"]'); await click(`[data-review-category-pack-option="${seeded.packId}"]`); await click(`[data-review-category-option="${seeded.categoryId}"]`); assert((await evaluate("reviewSelectedCards().length")) === 2, "single category failed"); pass("4 sélection d’une sous-catégorie");
   await click(`[data-review-category-option="${seeded.category2Id}"]`); assert((await evaluate("reviewSelectedCards().length")) === 3, "multiple categories failed"); await click("#review-categories-clear"); assert((await evaluate("reviewSelectedCards().length")) === 0, "clear categories failed"); await click("#review-categories-all"); assert((await evaluate("reviewCategoryIds.size")) === 3, "select all categories failed"); pass("5 sélection multiple, Tout sélectionner et Effacer");

   await evaluate("setView('lib',{fromHistory:true});lib.level='packs';renderLib()"); await click(`[data-pack-review="${seeded.packId}"]`); assert(await evaluate(`reviewSelectionMode==='pack'&&reviewPackId===${JSON.stringify(seeded.packId)}&&document.querySelector('[data-review-pack-option][aria-pressed="true"]')?.dataset.reviewPackOption===${JSON.stringify(seeded.packId)}`), "open from pack failed"); pass("6 ouverture depuis Réviser ce pack");
   await evaluate(`setView('lib',{fromHistory:true});lib.level='category';lib.packId=${JSON.stringify(seeded.packId)};lib.categoryId=${JSON.stringify(seeded.categoryId)};renderLib()`); await click("#category-review"); assert(await evaluate(`reviewSelectionMode==='category'&&reviewCategoryIds.has(${JSON.stringify(seeded.categoryId)})&&document.querySelector('[data-review-category-option]:checked')?.dataset.reviewCategoryOption===${JSON.stringify(seeded.categoryId)}`), "open from category failed"); pass("7 ouverture depuis Réviser cette sous-catégorie");
   await evaluate("setView('lib',{fromHistory:true});lib.level='all';lib.selected=new Set(['c1','c2']);renderLib()"); await click("#selected-review"); assert(await evaluate("reviewSelectionMode==='manual'&&manualReviewIds.size===2&&document.querySelector('#review-conditional').textContent.includes('2 mots choisis depuis Mes mots')&&!document.querySelector('[data-review-scope=manual]')"), "open from manual failed"); pass("8 ouverture depuis des mots cochés sans option abstraite");

   await evaluate("reviewSelectionMode='all';reviewExtraFilters={newOnly:false,favoritesOnly:false,difficultOnly:false,includeLearned:true};renderLearn()");
   await click('[data-review-mode="cards"]'); await click("#btn-continue"); assert(await evaluate("session.active&&session.mode==='cards'"), "cards mode failed"); await evaluate("session={active:false};clearSavedSession();renderLearn()"); pass("9 mode Cartes");
   await click('[data-review-mode="written"]'); await click("#btn-continue"); assert(await evaluate("session.active&&session.mode==='written'&&!!getState(0).task"), "written mode failed"); await evaluate("session={active:false};clearSavedSession();renderLearn()"); pass("10 mode Écriture");
   const beforeDiscovery = await evaluate("JSON.stringify(db.cards.map(c=>({id:c.id,lvl:c.lvl,due:c.due,acquired:c.acquired,history:c.reviewHistory})))");
   await click('[data-review-mode="discover"]'); await click("#btn-continue"); assert(await evaluate("session.mode==='discover'&&!document.querySelector('#a-hard')&&!document.querySelector('[data-grade]')"), "discovery exposes SRS actions");
   await evaluate("while(session.active){ if(session.index>=session.cards.length-1){endSession();break;} advance(); } session={active:false};renderLearn()");
   assert((await evaluate("JSON.stringify(db.cards.map(c=>({id:c.id,lvl:c.lvl,due:c.due,acquired:c.acquired,history:c.reviewHistory})))")) === beforeDiscovery, "discovery changed SRS"); pass("11 mode Découverte sans modification SRS");

   async function startDirection(value) {
      await click(`[data-review-direction="${value}"]`);
      assert((await evaluate("JSON.parse(localStorage.getItem(DB_KEY)).settings.direction")) === value, "direction not persisted");
      await evaluate("reviewSelectionMode='all';reviewMode='cards';reviewExtraFilters={newOnly:false,favoritesOnly:false,difficultOnly:false,includeLearned:true};renderLearn()");
      await click("#btn-continue");
   }
   await startDirection("zh2fr");
   const zhFront = await evaluate(`({front:getState(0).front,hanzi:!!document.querySelector('.flash .hanzi'),pinyin:!!document.querySelector('.flash .pinyin'),fr:!!document.querySelector('.flash .fr')})`);
   assert(zhFront.front === "zh" && zhFront.hanzi && !zhFront.pinyin && !zhFront.fr, "zh front wrong"); await click("#s-flip"); assert(await evaluate("!!document.querySelector('.flash .pinyin')&&!!document.querySelector('.flash .fr')"), "zh back wrong"); await evaluate("session={active:false};clearSavedSession();reviewMode='written';renderLearn()"); await click("#btn-continue"); assert(await evaluate("getState(0).front==='zh'&&['fr','py-read'].includes(getState(0).task)"), "zh written prompt wrong"); await evaluate("session={active:false};clearSavedSession();renderLearn()"); pass("12 中文 → Français");
   await startDirection("fr2zh");
   const frFront = await evaluate(`({front:getState(0).front,french:!!document.querySelector('.flash .fr-big'),hanzi:!!document.querySelector('.flash .hanzi')})`);
   assert(frFront.front === "fr" && frFront.french && !frFront.hanzi, "fr front wrong"); await click("#s-flip"); assert(await evaluate("!!document.querySelector('.flash .hanzi')&&!!document.querySelector('.flash .pinyin')&&!document.querySelector('.flash .fr')"), "fr back wrong"); await evaluate("session={active:false};clearSavedSession();reviewMode='written';renderLearn()"); await click("#btn-continue"); assert(await evaluate("getState(0).front==='fr'&&['py-prod','trace'].includes(getState(0).task)"), "fr written prompt wrong"); await evaluate("session={active:false};clearSavedSession();renderLearn()"); pass("13 Français → 中文");
   await startDirection("mix");
   const mixed = await evaluate(`(() => { const original=Math.random; let n=0; Math.random=()=>n++%2?0.9:0.1; const first=session.cards.map((card,index)=>frontOf(card,getState(index))); const second=session.cards.map((card,index)=>frontOf(card,getState(index))); Math.random=original; return {first,second,unique:new Set(session.cards.map(c=>c.id)).size,total:session.cards.length}; })()`);
   assert(JSON.stringify(mixed.first) === JSON.stringify(mixed.second) && mixed.first.includes("zh") && mixed.first.includes("fr") && mixed.unique === mixed.total, "mixed direction unstable or duplicated"); await evaluate("session={active:false};clearSavedSession();renderLearn()"); pass("14 Mélanger les deux, sens stable et aucune carte dupliquée");

   await evaluate("reviewSelectionMode='all';reviewMode='written';reviewExtraFilters={newOnly:false,favoritesOnly:false,difficultOnly:false,includeLearned:false};reviewOptionsOpen=false;renderLearn()");
   assert(!(await evaluate("document.querySelector('#review-options').open")), "options not closed by default"); await click("#review-options summary");
   await click('[data-review-filter="newOnly"]'); assert((await evaluate("reviewSelectedCards().map(c=>c.id).join(',')")) === "c2", "new filter failed");
   await click('[data-review-filter="newOnly"]'); await click('[data-review-filter="favoritesOnly"]'); assert((await evaluate("reviewSelectedCards().map(c=>c.id).join(',')")) === "c1", "favorite filter failed");
   await click('[data-review-filter="favoritesOnly"]'); await click('[data-review-filter="difficultOnly"]'); assert((await evaluate("reviewSelectedCards().map(c=>c.id).join(',')")) === "c2", "difficult filter failed");
   await click('[data-review-filter="difficultOnly"]'); await click('[data-review-filter="includeLearned"]'); assert((await evaluate("reviewSelectedCards().length")) === 4, "learned filter failed"); assert(await evaluate("document.querySelectorAll('[data-writing-setting]').length===3"), "writing settings missing"); pass("15 réglages avancés et options d’écriture");

   await evaluate(`reviewSelectionMode='category';reviewCategoryPackId=${JSON.stringify(seeded.packId)};reviewCategoryIds=new Set([${JSON.stringify(seeded.emptyId)}]);reviewExtraFilters={newOnly:false,favoritesOnly:false,difficultOnly:false,includeLearned:false};renderLearn()`);
   assert(await evaluate("document.querySelector('#btn-continue').disabled&&document.querySelector('.review-empty-message').textContent.includes('Aucune carte')"), "empty selection state failed"); pass("16 aucune carte disponible");
   await evaluate("reviewSelectionMode='all';reviewExtraFilters={newOnly:false,favoritesOnly:false,difficultOnly:false,includeLearned:false};renderLearn()"); const summaryBefore=await evaluate("document.querySelector('.review-compact-summary').textContent"); await click('[data-review-scope="due"]'); const summaryAfter=await evaluate("document.querySelector('.review-compact-summary').textContent"); assert(summaryBefore!==summaryAfter&&summaryAfter.includes('1 carte'),"live summary failed"); pass("17 résumé mis à jour immédiatement");

   await evaluate("reviewSelectionMode='all';reviewExtraFilters={newOnly:false,favoritesOnly:false,difficultOnly:false,includeLearned:false};renderLearn()");
   for (const width of [360,430,1024]) {
      await cdp.send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width <= 430 });
      await evaluate("renderLearn()");
      const layout = await evaluate(`(() => { const start=document.querySelector('#btn-continue'); start.scrollIntoView({block:'center'}); const nav=document.querySelector('.nav').getBoundingClientRect(); const rect=start.getBoundingClientRect(); return {blocks:document.querySelectorAll('.review-block').length,overflow:document.documentElement.scrollWidth>innerWidth+1,max:document.querySelector('.review-page').getBoundingClientRect().width,buttons:[...document.querySelectorAll('.review-page button')].every(b=>b.getBoundingClientRect().height>=44),navFixed:getComputedStyle(document.querySelector('.nav')).position==='fixed',notMasked:rect.bottom<=nav.top+1,height:document.querySelector('.review-page').scrollHeight}; })()`);
      assert(layout.blocks===4&&!layout.overflow&&layout.max<=820&&layout.buttons&&layout.navFixed&&layout.notMasked&&layout.height<1400, `layout ${width} failed: ${JSON.stringify(layout)}`);
   }
   pass("18 affichage 360 px"); pass("19 affichage 430 px"); pass("20 affichage 1024 px"); pass("21 aucun scroll horizontal");

   const finalState = await evaluate("({srs:JSON.stringify(db.cards.map(c=>({id:c.id,lvl:c.lvl,due:c.due,acquired:c.acquired,history:c.reviewHistory}))),structure:JSON.stringify({packs:db.packs,categories:db.categories,memberships:db.memberships})})");
   assert(finalState.srs === seeded.srs && finalState.structure === seeded.structure, "packs or SRS changed"); pass("22 aucune perte de packs ou progression");
   assert(!cdp.errors.length, "runtime errors: " + cdp.errors.join(" | "));
   console.log(`RESULT ${version.Browser} — 26 scénarios validés`);
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
