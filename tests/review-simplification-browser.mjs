import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = 8012;
const debugPort = 9345;
const url = `http://127.0.0.1:${port}/`;
const edge = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const profile = await mkdtemp(path.join(os.tmpdir(), "mo-review-simple-"));
const reviewWritingScreenshot = path.join(os.tmpdir(), "mo-review-writing-practice-360.png");
const reviewHubMobileScreenshot = path.join(os.tmpdir(), "mo-review-hub-390.png");
const reviewHubDesktopScreenshot = path.join(os.tmpdir(), "mo-review-hub-1440.png");
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
      const secondPack=createPersonalPack('Cours'); const secondCategory=createPersonalCategory(secondPack.id,'Leçon 1');
      const cards=[
         normalizeCard({id:'c1',hz:'你好吗',py:'nǐ hǎo ma',fr:'comment vas-tu ?',fav:true,lvl:4,due:Date.now()-1000,created:1},true),
         normalizeCard({id:'c2',hz:'朋友',py:'péngyou',fr:'ami',difficult:true,lvl:0,due:null,created:2},true),
         normalizeCard({id:'c3',hz:'书',py:'shū',fr:'livre',lvl:2,due:Date.now()+86400000,created:3},true),
         normalizeCard({id:'c4',hz:'会',py:'huì',fr:'savoir',lvl:6,acquired:true,due:null,created:4},true)
      ];
      db.cards.push(...cards); cards.slice(0,2).forEach(card=>addCardMembership(card.id,chapter.id)); cards.slice(2).forEach(card=>addCardMembership(card.id,chapter2.id)); addCardMembership(cards[0].id,secondCategory.id); syncLegacyPackCardIds(); save(); await flushPersonalLibrary();
      return {packId:pack.id,secondPackId:secondPack.id,categoryId:chapter.id,category2Id:chapter2.id,emptyId:empty.id,srs:JSON.stringify(cards.map(c=>({id:c.id,lvl:c.lvl,due:c.due,acquired:c.acquired,history:c.reviewHistory}))),structure:JSON.stringify({packs:db.packs,categories:db.categories,memberships:db.memberships})};
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
   await openDetail(); await click("#card-close-top"); await closedCorrectly("top close"); pass("croix de fermeture");
   await openDetail(); await evaluate("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))"); await closedCorrectly("escape"); pass("24 touche Échap");
   await openDetail(); await click("#sheet"); await closedCorrectly("backdrop"); pass("25 clic extérieur");
   await openDetail(); await click(".cd-head"); assert(await evaluate("sheetOpen()"), "inside click closed dialog"); await click("#card-close"); pass("26 clic intérieur sans fermeture");
   for (let index=0; index<5; index++) { await openDetail(); await click(index % 2 ? "#card-close-top" : "#card-close"); await closedCorrectly("repeat " + index); }
   pass("non-régression ouvertures et fermetures répétées");

   await evaluate("setView('learn',{fromHistory:true});reviewExtraFilters={newOnly:false,favoritesOnly:false,difficultOnly:false,includeLearned:false};reviewSelectionMode='all';renderLearn()");
   assert(await evaluate("document.querySelectorAll('.review-block').length===3&&document.querySelectorAll('.review-preferences-block').length===1&&document.querySelectorAll('[data-review-mode]').length===3&&document.querySelectorAll('[data-review-direction]').length===3&&document.querySelector('.review-mode-description').textContent.includes('auto-évalue')"), "compact Mode/Sens structure failed");
   assert((await evaluate("reviewSelectedCards().length")) === 3, "all failed"); pass("1 Tous mes mots");
   await click('[data-review-scope="due"]'); assert((await evaluate("reviewSelectedCards().length")) === 1, "due failed"); assert(await evaluate("document.querySelector('[data-review-scope=due]').textContent.includes('À revoir aujourd’hui')&&document.querySelector('[data-review-scope=due] small').textContent==='Cartes prévues par ton système de révision.'"), "due wording failed"); pass("2 À revoir aujourd’hui et aide contextuelle");
   await click('[data-review-scope="pack"]'); assert(await evaluate("!!document.querySelector('[data-review-pack-option]')&&!document.querySelector('[data-review-category-option]')"), "conditional pack list failed"); await click(`[data-review-pack-option="${seeded.packId}"]`); assert((await evaluate("reviewSelectedCards().length")) === 3, "pack cards failed"); await click(`[data-review-pack-option="${seeded.secondPackId}"]`); assert(await evaluate("reviewPackIds.size===2&&reviewSelectedCards().length===3&&document.querySelector('.review-category-list-head').textContent.includes('2 sélectionnés')"), "multiple packs or deduplication failed"); await click("#review-packs-clear"); assert((await evaluate("reviewSelectedCards().length")) === 0, "clear packs failed"); await click(`[data-review-pack-option="${seeded.packId}"]`); pass("3 sélection multiple de packs et déduplication");
   await click('[data-review-scope="category"]'); await click(`[data-review-category-pack-option="${seeded.packId}"]`); await click(`[data-review-category-option="${seeded.categoryId}"]`); assert((await evaluate("reviewSelectedCards().length")) === 2, "single category failed"); pass("4 sélection d’une sous-catégorie");
   await click(`[data-review-category-option="${seeded.category2Id}"]`); assert((await evaluate("reviewSelectedCards().length")) === 3, "multiple categories failed"); await click("#review-categories-clear"); assert((await evaluate("reviewSelectedCards().length")) === 0, "clear categories failed"); await click("#review-categories-all"); assert((await evaluate("reviewCategoryIds.size")) === 3, "select all categories failed"); pass("5 sélection multiple, Tout sélectionner et Effacer");

   await evaluate("setView('lib',{fromHistory:true});lib.level='packs';renderLib()"); await click(`[data-pack-review="${seeded.packId}"]`); assert(await evaluate(`reviewSelectionMode==='pack'&&reviewPackIds.has(${JSON.stringify(seeded.packId)})&&document.querySelector('[data-review-pack-option]:checked')?.dataset.reviewPackOption===${JSON.stringify(seeded.packId)}`), "open from pack failed"); pass("6 ouverture depuis Réviser ce pack");
   await evaluate(`setView('lib',{fromHistory:true});lib.level='category';lib.packId=${JSON.stringify(seeded.packId)};lib.categoryId=${JSON.stringify(seeded.categoryId)};renderLib()`); await click("#category-review"); assert(await evaluate(`reviewSelectionMode==='category'&&reviewCategoryIds.has(${JSON.stringify(seeded.categoryId)})&&document.querySelector('[data-review-category-option]:checked')?.dataset.reviewCategoryOption===${JSON.stringify(seeded.categoryId)}`), "open from category failed"); pass("7 ouverture depuis Réviser cette sous-catégorie");
   await evaluate("setView('lib',{fromHistory:true});lib.level='all';lib.selected=new Set(['c1','c2']);renderLib()"); await click("#selected-review"); assert(await evaluate("reviewSelectionMode==='manual'&&manualReviewIds.size===2&&document.querySelector('#review-conditional').textContent.includes('2 mots choisis depuis Mes mots')&&!document.querySelector('[data-review-scope=manual]')"), "open from manual failed"); pass("8 ouverture depuis des mots cochés sans option abstraite");

   await evaluate("reviewSelectionMode='all';reviewExtraFilters={newOnly:false,favoritesOnly:false,difficultOnly:false,includeLearned:true};renderLearn()");
   await click('[data-review-mode="cards"]'); assert(await evaluate("document.querySelector('[data-review-mode=cards]').getAttribute('aria-pressed')==='true'"), "cards segment selection failed"); await click("#btn-continue"); assert(await evaluate("session.active&&session.mode==='cards'"), "cards mode failed");
   await click("#s-flip"); if (!(await evaluate("document.querySelector('#review-strokes').open"))) await click("#review-strokes summary"); await click("#review-stroke-practice"); await waitFor(() => evaluate("!!document.querySelector('.writing-practice-backdrop')"), "cards mode writing practice did not open"); assert(await evaluate("session.active&&session.mode==='cards'&&document.querySelector('.writing-practice-dialog').dataset.writingPracticeWord===currentCard().hz"), "cards mode writing practice changed the session"); await click(".writing-practice-close"); assert(await evaluate("session.active&&session.mode==='cards'&&!document.querySelector('.writing-practice-backdrop')"), "cards mode writing practice did not restore the session"); await evaluate("session={active:false};clearSavedSession();renderLearn()"); pass("9 mode Cartes et entraînement d’écriture en modale");
   await click('[data-review-mode="written"]'); assert(await evaluate("document.querySelector('[data-review-mode=written]').getAttribute('aria-pressed')==='true'&&document.querySelector('.review-mode-description').textContent.includes('écris')"), "written segment selection failed"); await click("#btn-continue"); assert(await evaluate("session.active&&session.mode==='written'&&!!getState(0).task"), "written mode failed"); await evaluate("session={active:false};clearSavedSession();renderLearn()"); pass("10 mode Écriture");
   const beforeDiscovery = await evaluate("JSON.stringify(db.cards.map(c=>({id:c.id,lvl:c.lvl,due:c.due,acquired:c.acquired,history:c.reviewHistory})))");
   await click('[data-review-mode="discover"]'); assert(await evaluate("document.querySelector('[data-review-mode=discover]').getAttribute('aria-pressed')==='true'&&document.querySelector('.review-mode-description').textContent.includes('progression')"), "discover segment selection failed"); await click("#btn-continue"); assert(await evaluate("session.mode==='discover'&&!document.querySelector('#a-hard')&&!document.querySelector('[data-grade]')"), "discovery exposes SRS actions");
   await evaluate("while(session.active){ if(session.index>=session.cards.length-1){endSession();break;} advance(); } session={active:false};renderLearn()");
   assert((await evaluate("JSON.stringify(db.cards.map(c=>({id:c.id,lvl:c.lvl,due:c.due,acquired:c.acquired,history:c.reviewHistory})))")) === beforeDiscovery, "discovery changed SRS"); pass("11 mode Découverte sans modification SRS");

   async function startDirection(value) {
      await click(`[data-review-direction="${value}"]`);
      assert((await evaluate("JSON.parse(localStorage.getItem(DB_KEY)).settings.direction")) === value && (await evaluate(`document.querySelector('[data-review-direction="${value}"]').getAttribute('aria-pressed')`)) === "true", "direction not selected or persisted");
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

   await evaluate("startCardsWith([db.cards.find(c=>c.id==='c1'),db.cards.find(c=>c.id==='c3')],'Test des traits','cards')");
   assert(await evaluate("document.querySelector('#s-prev')===null"), "navigation should stay below grades before reveal");
   await click("#s-flip");
   if (!(await evaluate("document.querySelector('#review-strokes').open"))) await click("#review-strokes summary");
   await waitFor(() => evaluate("reviewStrokeData?.character==='你'&&!!document.querySelector('#review-stroke-target svg')"), "stroke animation did not load");
   await waitFor(() => evaluate("document.querySelector('.review-character-composition')?.dataset.character==='\u4f60'&&!document.querySelector('.review-character-composition').hidden"), "review composition did not load inside the expanded stroke block");
   assert(await evaluate("document.querySelector('#review-strokes .review-stroke-content > .review-character-composition')!==null&&document.querySelectorAll('.review-character-composition .composition-role').length===0"), "review composition escaped the collapsible stroke content or invented roles");
   assert(await evaluate("document.querySelectorAll('[data-review-stroke-character]').length===3&&document.querySelector('#review-stroke-count').textContent.trim()==='1 / 3'"), "multi-character stroke selector failed");
   const reviewCompositionBeforeDetail = await evaluate(`(() => {
      const composition=document.querySelector('.review-character-composition');
      const opener=composition.querySelector('.composition-radical-character');
      window.__reviewCompositionNode=composition;
      return {
         html:composition.innerHTML,
         character:composition.dataset.character,
         formula:composition.querySelector('.composition-formula')?.textContent.trim(),
         origin:composition.querySelector('.composition-origin-text')?.textContent.trim()||'',
         keyCharacter:opener?.dataset.compositionCharacter,
         keyText:opener?.textContent.trim(),
         componentCount:composition.querySelectorAll('[data-composition-character]').length,
         sessionIndex:session.index,
         revealed:getState(session.index).revealed,
         strokeTab:reviewStrokeTab,
         expanded:reviewStrokeExpanded&&document.querySelector('#review-strokes').open,
      };
   })()`);
   assert(reviewCompositionBeforeDetail.keyCharacter && reviewCompositionBeforeDetail.componentCount > 0, `review composition key missing: ${JSON.stringify(reviewCompositionBeforeDetail)}`);
   await evaluate(`(() => {const opener=document.querySelector('.review-character-composition .composition-radical-character');opener.focus({preventScroll:true});opener.click();})()`);
   await waitFor(() => evaluate(`sheetOpen()&&document.querySelector('.dd-entry .cd-hz')?.textContent.trim()===${JSON.stringify(reviewCompositionBeforeDetail.keyCharacter)}`), "review composition key detail did not open");
   assert(await evaluate("!document.querySelector('#dd-close')&&document.querySelector('#dd-close-top')?.getAttribute('aria-label')==='Fermer la fiche'"), "non-search dictionary detail kept the redundant bottom close or lost its accessible top close");
   await waitFor(() => evaluate("!!document.querySelector('#sheet .stroke-workspace .character-composition:not(.is-loading)')"), "component detail composition did not finish loading");
   const reviewCompositionWhileOpen = await evaluate(`(() => {const composition=document.querySelector('.review-character-composition');return {sameNode:composition===window.__reviewCompositionNode,html:composition.innerHTML,character:composition.dataset.character};})()`);
   assert(reviewCompositionWhileOpen.sameNode&&reviewCompositionWhileOpen.html===reviewCompositionBeforeDetail.html&&reviewCompositionWhileOpen.character===reviewCompositionBeforeDetail.character, "dictionary workspace rewrote the mounted Review composition");
   await click("#dd-close-top");
   await waitFor(() => evaluate("!sheetOpen()"), "component detail did not close from its top close");
   await new Promise((resolve) => setTimeout(resolve, 180));
   const reviewCompositionAfterDetail = await evaluate(`(() => {
      const composition=document.querySelector('.review-character-composition');
      const opener=composition.querySelector('.composition-radical-character');
      return {
         sameNode:composition===window.__reviewCompositionNode,
         html:composition.innerHTML,
         character:composition.dataset.character,
         formula:composition.querySelector('.composition-formula')?.textContent.trim(),
         origin:composition.querySelector('.composition-origin-text')?.textContent.trim()||'',
         keyCharacter:opener?.dataset.compositionCharacter,
         keyText:opener?.textContent.trim(),
         componentCount:composition.querySelectorAll('[data-composition-character]').length,
         sessionIndex:session.index,
         revealed:getState(session.index).revealed,
         strokeTab:reviewStrokeTab,
         expanded:reviewStrokeExpanded&&document.querySelector('#review-strokes').open,
         focusRestored:document.activeElement===opener,
      };
   })()`);
   for (const key of ['html','character','formula','origin','keyCharacter','keyText','componentCount','sessionIndex','revealed','strokeTab','expanded'])
      assert(reviewCompositionAfterDetail[key]===reviewCompositionBeforeDetail[key], `review state changed after component detail (${key}): ${JSON.stringify({before:reviewCompositionBeforeDetail,after:reviewCompositionAfterDetail})}`);
   assert(reviewCompositionAfterDetail.sameNode&&reviewCompositionAfterDetail.focusRestored, "component detail replaced the Review composition node or lost focus restoration");
   pass("fiche d’un composant : composition et état de la flashcard isolés, fermeture haute et focus restauré");
   assert(await evaluate("document.querySelector('#s-prev').disabled&&document.querySelector('#s-next').textContent.includes('Suivant')"), "first card navigation failed");
   await evaluate("window.__previousReviewWriter=reviewStrokeWriter;true"); await click("#review-stroke-replay"); assert(await evaluate("!!reviewStrokeWriter&&reviewStrokeWriter!==window.__previousReviewWriter"), "replay did not recreate animation"); pass("ordre des traits · Animation et Rejouer");
   await click('[data-review-stroke-tab="steps"]'); await waitFor(() => evaluate("document.querySelectorAll('.review-stroke-step').length===reviewStrokeData?.strokeCount"), "stroke steps missing"); pass("ordre des traits · Étapes");
   await click("#review-stroke-character-next"); await waitFor(() => evaluate("reviewStrokeData?.character==='好'"), "second character did not load"); assert(await evaluate("document.querySelector('#review-stroke-count').textContent.trim()==='2 / 3'"), "second character counter failed");
   await waitFor(() => evaluate("document.querySelector('.review-character-composition')?.dataset.character==='\u597d'"), "second review composition did not load");
   await cdp.send("Emulation.setDeviceMetricsOverride", { width:360, height:800, deviceScaleFactor:2, mobile:true });
   await click("#review-stroke-practice");
   await waitFor(() => evaluate("!!document.querySelector('.writing-practice-backdrop')&&document.querySelector('#review-writing-canvas')?.width>1"), "review writing practice did not open");
   const practiceLayout = await evaluate(`(() => {
      const sheet=document.querySelector('.writing-practice-dialog'),rect=sheet.getBoundingClientRect(),canvas=document.querySelector('#review-writing-canvas'),model=document.querySelector('#review-writing-model'),surface=document.querySelector('#review-writing-surface'),surfaceRect=surface.getBoundingClientRect();
      const undersizedTargets=[...document.querySelectorAll('.review-writing-practice button,.review-writing-practice input')].filter((node)=>node.type!=='range'&&node.type!=='checkbox'&&node.getBoundingClientRect().height<44).map((node)=>({id:node.id,className:node.className,height:node.getBoundingClientRect().height}));
      return {character:document.querySelector('.review-writing-practice').dataset.reviewWritingCharacter,word:document.querySelector('.review-writing-practice').dataset.writingPracticeWord,characters:document.querySelectorAll('[data-writing-practice-character]').length,model:model.textContent.trim(),sheetHeight:rect.height,viewport:innerHeight,top:rect.top,width:rect.width,surfaceSize:[surfaceRect.width,surfaceRect.height],surfaceMinHeight:getComputedStyle(surface).minHeight,overflow:document.documentElement.scrollWidth>innerWidth,canvasTouch:getComputedStyle(canvas).touchAction,grids:document.querySelectorAll('.review-writing-practice [data-writing-grid]').length,widthControl:!!document.querySelector('#review-writing-width'),undo:!!document.querySelector('#review-writing-undo'),touchTargets:undersizedTargets.length===0,undersizedTargets,session:{active:session.active,index:session.index,card:currentCard().id,stroke:getState(session.index).strokeCharacterIndex,tab:reviewStrokeTab},inert:document.querySelector('#view').inert};
   })()`);
   assert(practiceLayout.character==='好'&&practiceLayout.word==='你好吗'&&practiceLayout.characters===3&&practiceLayout.model==='好'&&practiceLayout.sheetHeight<=practiceLayout.viewport-16+1&&practiceLayout.top>0&&practiceLayout.width<practiceLayout.viewport&&Math.abs(practiceLayout.surfaceSize[0]-practiceLayout.surfaceSize[1])<1&&!practiceLayout.overflow&&practiceLayout.canvasTouch==='none'&&practiceLayout.grids===4&&practiceLayout.widthControl&&practiceLayout.undo&&practiceLayout.touchTargets&&practiceLayout.session.active&&practiceLayout.session.index===0&&practiceLayout.session.card==='c1'&&practiceLayout.session.stroke===1&&practiceLayout.session.tab==='steps'&&practiceLayout.inert, `compact review writing layout/state failed: ${JSON.stringify(practiceLayout)}`);
   // Ouverte depuis une séance, la modale est un exercice de rappel : le modèle part
   // masqué et c'est l'utilisateur qui décide de le révéler.
   assert(await evaluate("document.querySelector('#review-writing-model').hidden&&document.querySelector('#review-writing-model-visible').getAttribute('aria-pressed')==='false'&&document.querySelector('.writing-practice-backdrop').classList.contains('writing-practice-backdrop-review')"), "review writing practice revealed the model or skipped the blurred backdrop");
   await click("#review-writing-model-visible");
   assert(await evaluate("!document.querySelector('#review-writing-model').hidden&&document.querySelector('#review-writing-model').textContent==='好'"), "review writing model toggle did not reveal the guide");
   await click("#review-writing-model-visible");
   assert(await evaluate("document.querySelector('#review-writing-model').hidden"), "review writing model toggle did not hide the guide again");
   await evaluate("(() => {const input=document.querySelector('#review-writing-opacity');input.value='31';input.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('[data-writing-grid=mi]').click();})()");
   const practiceGesture = await evaluate(`(() => {
      const canvas=document.querySelector('#review-writing-canvas'),rect=canvas.getBoundingClientRect(),x=rect.left+rect.width*.35,y=rect.top+rect.height*.35,init={bubbles:true,cancelable:true,isPrimary:true,pointerId:71,pointerType:'touch',button:0};
      canvas.dispatchEvent(new PointerEvent('pointerdown',{...init,clientX:x,clientY:y}));
      canvas.dispatchEvent(new PointerEvent('pointermove',{...init,clientX:x+32,clientY:y+22}));
      canvas.dispatchEvent(new PointerEvent('pointermove',{...init,clientX:x+64,clientY:y+48}));
      canvas.dispatchEvent(new PointerEvent('pointerup',{...init,clientX:x+64,clientY:y+48}));
      return {selection:getSelection().toString(),clearDisabled:document.querySelector('#review-writing-clear').disabled,grid:document.querySelector('#review-writing-surface').dataset.grid,opacity:document.querySelector('#review-writing-opacity-value').textContent,modelHidden:document.querySelector('#review-writing-model').hidden};
   })()`);
   assert(!practiceGesture.selection&&!practiceGesture.clearDisabled&&practiceGesture.grid==='mi'&&practiceGesture.opacity==='31%'&&practiceGesture.modelHidden, `review writing controls/touch failed: ${JSON.stringify(practiceGesture)}`);
   await evaluate("document.querySelector('.review-writing-practice .sheet-x').focus({preventScroll:true});document.querySelector('.writing-practice-dialog').scrollTop=0");
   await new Promise((resolve) => setTimeout(resolve, 300));
   const practiceImage = await cdp.send("Page.captureScreenshot", { format:"png", fromSurface:true });
   await writeFile(reviewWritingScreenshot, Buffer.from(practiceImage.data, "base64"));
   await click("#review-writing-clear");
   assert(await evaluate("document.querySelector('#review-writing-clear').disabled"), "review writing restart did not clear the disposable drawing");
   await click(".review-writing-practice .sheet-x");
   assert(await evaluate("!document.querySelector('.writing-practice-backdrop')&&!sheetOpen()&&session.active&&session.index===0&&currentCard().id==='c1'&&getState(0).strokeCharacterIndex===1&&reviewStrokeTab==='steps'&&document.querySelector('[data-review-stroke-character=\"1\"]').getAttribute('aria-pressed')==='true'"), "closing review writing practice changed the review session");
   await click("#review-stroke-practice");
   await waitFor(() => evaluate("!!document.querySelector('.writing-practice-backdrop')&&!!document.querySelector('#review-writing-clear')"), "review writing practice did not reopen");
   assert(await evaluate("document.querySelector('#review-writing-clear').disabled&&document.querySelector('.review-writing-practice').dataset.reviewWritingCharacter==='好'"), "review writing drawing persisted after close");
   await evaluate("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))");
   await waitFor(() => evaluate("!document.querySelector('.writing-practice-backdrop')&&!sheetOpen()&&session.active&&session.index===0"), "Escape left the review writing practice or session open incorrectly");
   pass(`essai tactile jetable sur le caractère sélectionné, sheet compacte 360 px · capture ${reviewWritingScreenshot}`);
   await click('[data-review-stroke-character="2"]'); await waitFor(() => evaluate("reviewStrokeData?.character==='吗'"), "third character did not load"); assert(await evaluate(`document.querySelector('#review-stroke-count').textContent.trim()==='3 / 3'&&document.querySelector('[data-review-stroke-character="2"]').getAttribute('aria-pressed')==='true'`), "third character state failed"); pass("navigation entre 你, 好 et 吗");
   const listenerCount = await evaluate("reviewStrokeWriterListeners.length"); await click("#s-next"); assert(await evaluate("session.index===1&&reviewStrokeWriter===null&&reviewStrokeWriterListeners.length===0"), "writer was not destroyed on card change"); await click("#s-flip"); await waitFor(() => evaluate("reviewStrokeData?.character==='书'"), "next card stroke data did not load"); assert((await evaluate("reviewStrokeWriterListeners.length")) <= Math.max(listenerCount, 2), "writer listeners leaked"); assert(await evaluate("document.querySelector('#s-next').textContent.includes('Terminer')&&!document.querySelector('#s-prev').disabled"), "last card navigation failed"); await click("#s-prev"); assert((await evaluate("session.index")) === 0, "previous navigation failed"); pass("nettoyage Hanzi Writer et barre Précédent / Suivant / Terminer");
   await evaluate("session={active:false};clearSavedSession();destroyReviewStrokeWorkspace();startCardsWith([{id:'latin',hz:'hello',py:'',fr:'bonjour',lvl:0,due:null,acquired:false}],'Sans hanzi','cards')"); await click("#s-flip"); assert(!(await evaluate("!!document.querySelector('#review-strokes')")), "stroke block shown without Han character"); await evaluate("session={active:false};clearSavedSession();destroyReviewStrokeWorkspace();renderLearn()"); pass("verso sans caractère chinois");

   async function dragCard(dx, dy, selector = "#flash", options = {}) {
      const { duration = 80, steps = 4 } = options;
      const point = await evaluate(`(() => { const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
      await cdp.send("Input.dispatchMouseEvent", { type:"mousePressed", x:point.x, y:point.y, button:"left", buttons:1, clickCount:1 });
      for (let step = 1; step <= steps; step++) {
         if (duration) await new Promise((resolve) => setTimeout(resolve, duration / steps));
         await cdp.send("Input.dispatchMouseEvent", { type:"mouseMoved", x:point.x+(dx*step)/steps, y:point.y+(dy*step)/steps, button:"left", buttons:1 });
      }
      await cdp.send("Input.dispatchMouseEvent", { type:"mouseReleased", x:point.x+dx, y:point.y+dy, button:"left", buttons:0, clickCount:1 });
   }
   const swipeVisualClean = () => evaluate(`(() => {const card=document.querySelector('#flash');return !!card&&!card.matches('.is-session-dragging,.is-session-settling,.is-session-committing')&&!card.style.transform&&!card.style.transition&&!card.style.willChange&&(getSelection().isCollapsed||!String(getSelection()));})()`);
   async function waitForCard(index, message = "swipe navigation did not finish") {
      await waitFor(() => evaluate(`session.active&&session.index===${index}&&!!document.querySelector('#flash')`), message);
   }
   async function waitForRest(index, message = "card did not settle cleanly") {
      await waitFor(async () => (await evaluate(`session.active&&session.index===${index}`)) && (await swipeVisualClean()), message);
   }
   await cdp.send("Emulation.setEmulatedMedia", { features:[{ name:"prefers-reduced-motion", value:"no-preference" }] });
   await evaluate("startCardsWith([db.cards.find(c=>c.id==='c1'),db.cards.find(c=>c.id==='c2'),db.cards.find(c=>c.id==='c3')],'Gestes','cards')");
   await dragCard(-120, 4, "#flash", { duration: 300, steps: 6 });
   const exitState = await evaluate("({index:session.index,classes:document.querySelector('#flash').className,transform:document.querySelector('#flash').style.transform,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,revealed:getState(session.index).revealed})");
   assert(exitState.index===0&&exitState.classes.includes('is-session-committing'), `left swipe navigated before its exit animation: ${JSON.stringify(exitState)}`);
   await waitForCard(1, "left swipe failed");
   await dragCard(120, 3, "#flash", { duration: 300, steps: 6 }); await waitForCard(0, "right swipe failed");
   await evaluate("getState(0).revealed=false;renderSession()");
   await dragCard(3, 110); await waitForRest(0); assert(await evaluate("getComputedStyle(document.querySelector('#flash')).touchAction==='pan-y'"), "vertical gesture blocked or changed card");
   await evaluate("getState(0).revealed=true;renderSession()"); await dragCard(-120, 0, "#a-fav"); assert((await evaluate("session.index")) === 0, "interactive control triggered swipe"); assert(await swipeVisualClean(), "drag state or text selection remained"); pass("swipes gauche/droite animés, scroll vertical et contrôles protégés");

   // Première carte : déplacement résisté, aucun retour arrière et aucun clic résiduel.
   await evaluate("session.index=0;getState(0).revealed=false;renderSession()");
   const boundaryPoint = await evaluate("(() => {const r=document.querySelector('#flash').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()");
   await cdp.send("Input.dispatchMouseEvent", { type:"mousePressed", x:boundaryPoint.x, y:boundaryPoint.y, button:"left", buttons:1, clickCount:1 });
   await cdp.send("Input.dispatchMouseEvent", { type:"mouseMoved", x:boundaryPoint.x+120, y:boundaryPoint.y+2, button:"left", buttons:1 });
   const resistedX = await evaluate("new DOMMatrix(getComputedStyle(document.querySelector('#flash')).transform).m41");
   assert(resistedX>20&&resistedX<55, `first-card resistance missing: ${resistedX}`);
   await cdp.send("Input.dispatchMouseEvent", { type:"mouseReleased", x:boundaryPoint.x+120, y:boundaryPoint.y+2, button:"left", buttons:0, clickCount:1 });
   await waitForRest(0);
   assert(await evaluate("session.index===0&&getState(0).revealed===false"), "first-card right drag navigated or flipped");

   // Un drag lent et court revient ; un flick court mais franc part ; un minuscule
   // mouvement rapide reste sous le garde-fou de distance minimale.
   await dragCard(-44, 2, "#flash", { duration: 320, steps: 8 });
   await waitForRest(0);
   assert(await evaluate("session.index===0&&getState(0).revealed===false"), "short rejected drag navigated or flipped");
   await dragCard(-70, 2, "#flash", { duration: 24, steps: 3 });
   await waitForCard(1, "short fast flick did not navigate");
   await evaluate("session.index=0;getState(0).revealed=false;renderSession()");
   await dragCard(-16, 1, "#flash", { duration: 16, steps: 2 });
   await waitForRest(0);
   assert(await evaluate("session.index===0&&getState(0).revealed===false"), "tiny fast movement navigated or flipped");
   pass("seuil proportionnel, flick récent et distance minimale de sécurité");

   await dragCard(-120, 44, "#flash", { duration: 180, steps: 6 });
   await waitForCard(1, "mostly-horizontal diagonal did not swipe");
   await evaluate("session.index=0;getState(0).revealed=false;renderSession()");
   await dragCard(-40, 120, "#flash", { duration: 180, steps: 6 });
   await waitForRest(0);
   assert((await evaluate("session.index")) === 0, "mostly-vertical diagonal navigated");
   pass("verrou directionnel diagonal horizontal/vertical");

   async function terminatePointer(type, pointerId) {
      await evaluate(`(() => {
         const card=document.querySelector('#flash'),r=card.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,target=card.querySelector('.hanzi')||card;
         const init={bubbles:true,cancelable:true,composed:true,isPrimary:true,pointerId:${pointerId},pointerType:'touch',button:0,buttons:1};
         target.dispatchEvent(new PointerEvent('pointerdown',{...init,clientX:x,clientY:y}));
         target.dispatchEvent(new PointerEvent('pointermove',{...init,clientX:x-72,clientY:y+2}));
         card.dispatchEvent(new PointerEvent(${JSON.stringify(type)},{...init,buttons:0,clientX:x-72,clientY:y+2}));
      })()`);
      await waitForRest(0, `${type} did not settle the card`);
   }
   await evaluate("session.index=0;getState(0).revealed=false;renderSession()");
   await terminatePointer("pointercancel", 701);
   assert(await evaluate("session.index===0&&getState(0).revealed===false"), "pointer cancellation navigated or flipped");
   await terminatePointer("lostpointercapture", 702);
   assert(await evaluate("session.index===0&&getState(0).revealed===false"), "lost capture navigated or flipped");
   pass("pointercancel et lostpointercapture reviennent sans état résiduel");

   // Un rendu externe pendant la sortie invalide son token : l'ancien callback ne
   // peut pas avancer une seconde fois.
   await evaluate("session.index=0;getState(0).front='zh';getState(0).revealed=false;renderSession()");
   await dragCard(-120, 2, "#flash", { duration: 80, steps: 4 });
   assert(await evaluate("session.index===0&&document.querySelector('#flash').classList.contains('is-session-committing')"), "external-navigation setup did not enter commit animation");
   await evaluate("advance()");
   await new Promise((resolve) => setTimeout(resolve, 360));
   assert(await evaluate("session.index===1&&document.querySelector('#flash')&&!document.querySelector('#flash').matches('.is-session-dragging,.is-session-settling,.is-session-committing')"), "stale exit callback navigated twice or left state behind");
   await evaluate("session.index=0;getState(0).revealed=false;renderSession()");
   await click("#s-flip");
   await dragCard(-120, 2, ".hanzi", { duration: 100, steps: 5 });
   await waitForCard(1, "swipe immediately after flip failed");
   pass("rerender externe sans double navigation, swipe immédiatement après flip");

   // Sans verrou horizontal, le clic reste entièrement natif et retourne la carte.
   async function tapCard(fractionY) {
      const point = await evaluate(`(() => { const r=document.querySelector('#flash').getBoundingClientRect(); return {x:r.left+r.width*0.5,y:r.top+r.height*${fractionY}}; })()`);
      await cdp.send("Input.dispatchMouseEvent", { type:"mousePressed", x:point.x, y:point.y, button:"left", buttons:1, clickCount:1 });
      await cdp.send("Input.dispatchMouseEvent", { type:"mouseReleased", x:point.x, y:point.y, button:"left", buttons:0, clickCount:1 });
   }
   async function tapSelector(selector) {
      const point = await evaluate(`(() => { const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
      await cdp.send("Input.dispatchMouseEvent", { type:"mousePressed", x:point.x, y:point.y, button:"left", buttons:1, clickCount:1 });
      await cdp.send("Input.dispatchMouseEvent", { type:"mouseReleased", x:point.x, y:point.y, button:"left", buttons:0, clickCount:1 });
   }
   // recto 中文 imposé : avec le sens « Mélanger », un recto français masque le sceau
   // audio (hideSay) et le point visé retomberait sur la carte elle-même.
   for (const fractionY of [0.08, 0.94]) {
      await evaluate("session.index=0;getState(0).front='zh';getState(0).revealed=false;renderSession()");
      await tapCard(fractionY);
      assert(await evaluate("getState(0).revealed===true"), `tap at ${fractionY * 100}% of the enlarged card did not flip it`);
   }
   await evaluate("window.__reviewOriginalSpeak=speak;window.__reviewSpeakCalls=[];speak=(value)=>window.__reviewSpeakCalls.push(value);getState(0).front='zh';getState(0).revealed=false;renderSession()");
   await tapSelector(".hanzi");
   assert(await evaluate("getState(0).revealed===false&&window.__reviewSpeakCalls.length===1"), "large Hanzi tap did not speak exactly once or flipped the card");
   await evaluate("getState(0).front='zh';getState(0).revealed=false;renderSession()");
   await evaluate(`(() => { const r=document.querySelector('.fl-seal').getBoundingClientRect(); const point={x:r.left+r.width/2,y:r.top+r.height/2}; window.__sealPoint=point; return true; })()`);
   const sealPoint = await evaluate("window.__sealPoint");
   await cdp.send("Input.dispatchMouseEvent", { type:"mousePressed", x:sealPoint.x, y:sealPoint.y, button:"left", buttons:1, clickCount:1 });
   await cdp.send("Input.dispatchMouseEvent", { type:"mouseReleased", x:sealPoint.x, y:sealPoint.y, button:"left", buttons:0, clickCount:1 });
   assert(await evaluate("getState(0).revealed===false&&window.__reviewSpeakCalls.length===2"), "the audio seal flipped the card or did not speak exactly once");
   pass("appui natif, Hanzi et sceau audio exactement une fois");

   // Le grand caractère (data-say) et le corps de la section d'écriture sont exclus du
   // TAP mais doivent rester des zones de GLISSEMENT : c'est là que le pouce se pose.
   await evaluate("getState(0).front='zh';getState(0).revealed=true;reviewStrokeExpanded=true;renderSession()");
   await waitFor(() => evaluate("!!document.querySelector('.review-stroke-grid')&&!!document.querySelector('.hanzi')"), "expanded verso did not render for the swipe surface check");
   for (const [selector, label] of [[".hanzi", "le grand caractère"], [".review-stroke-grid", "la zone d’écriture"]]) {
      await evaluate("session.index=0;getState(0).front='zh';getState(0).revealed=true;renderSession()");
      await waitFor(() => evaluate(`!!document.querySelector(${JSON.stringify(selector)})`), "swipe origin missing: " + selector);
      await evaluate("window.__reviewSpeakCalls=[]");
      await dragCard(-110, 5, selector);
      await waitForCard(1, `swipe from ${label} did not finish`);
      assert(await evaluate("session.index===1&&getState(1).revealed===false&&window.__reviewSpeakCalls.length===0"), `swipe from ${label} changed, flipped or spoke incorrectly`);
   }
   await evaluate("speak=window.__reviewOriginalSpeak;delete window.__reviewOriginalSpeak;delete window.__reviewSpeakCalls");
   // les zones qui défilent horizontalement gardent la main sur le geste
   await evaluate("session.index=0;getState(0).front='zh';getState(0).revealed=true;reviewStrokeExpanded=true;renderSession()");
   await waitFor(() => evaluate("!!document.querySelector('.review-stroke-characters')"), "character pills missing");
   await dragCard(-110, 5, ".review-stroke-characters");
   assert((await evaluate("session.index")) === 0, "horizontal scroller handed its gesture to the card swipe");
   pass("glissement depuis le caractère et la zone d’écriture, défileurs horizontaux préservés");

   // Les commandes restent natives et ne sont jamais confondues avec la navigation.
   const controlBefore = await evaluate("({fav:currentCard().fav,acquired:currentCard().acquired,due:currentCard().due,live:session.live.acquired})");
   await click("#a-fav");
   assert((await evaluate("currentCard().fav")) !== controlBefore.fav, "Favorite did not toggle once");
   await click("#a-fav");
   assert((await evaluate("currentCard().fav")) === controlBefore.fav, "Favorite did not restore on its second click");
   await click("#a-hard");
   assert(await evaluate("sheetOpen()&&!!document.querySelector('#dl-close')&&session.index===0"), "Date control did not open its sheet");
   await click("#dl-close");
   await click("#a-acq");
   assert((await evaluate("currentCard().acquired")) !== controlBefore.acquired, "Maîtrisée did not toggle once");
   await evaluate(`currentCard().acquired=${JSON.stringify(controlBefore.acquired)};currentCard().due=${JSON.stringify(controlBefore.due)};session.live.acquired=${controlBefore.live};save();renderSession()`);
   assert(await evaluate("session.index===0&&!sheetOpen()"), "card controls changed navigation state");

   await evaluate("window.__reviewOriginalApplyGrade=applyGrade;window.__reviewGradeCalls=[];applyGrade=(card,grade)=>window.__reviewGradeCalls.push({id:card.id,grade});window.__reviewOriginalPairTest=maybeShowConfusablePairTest;maybeShowConfusablePairTest=()=>false;getState(0).revealed=true;renderSession()");
   await click('[data-grade="good"]');
   assert(await evaluate("session.index===1&&session.states[0].grade==='good'&&window.__reviewGradeCalls.length===1&&window.__reviewGradeCalls[0].grade==='good'"), "grade button did not apply its existing grade exactly once");
   await evaluate("applyGrade=window.__reviewOriginalApplyGrade;maybeShowConfusablePairTest=window.__reviewOriginalPairTest;delete window.__reviewOriginalApplyGrade;delete window.__reviewOriginalPairTest;delete window.__reviewGradeCalls");
   pass("Favorite, Date, Maîtrisée et note SRS restent des contrôles natifs uniques");

   // Le helper et l'indication sont absents de tous les modes non-cartes.
   await evaluate("sessionSwipeHintSeen=false;session={active:false};clearSavedSession();startCardsWith([db.cards.find(c=>c.id==='c1'),db.cards.find(c=>c.id==='c2')],'Écrit isolé','written');getState(0).task='fr';renderSession()");
   assert(await evaluate("session.mode==='written'&&sessionSwipeCleanup===null&&!document.querySelector('.session-swipe-hint')&&!!document.querySelector('#w-input')"), "written mode gained swipe state or lost its input");
   await dragCard(-130, 2);
   await new Promise((resolve) => setTimeout(resolve, 280));
   assert(await evaluate("session.index===0&&!!document.querySelector('#w-input')&&!document.querySelector('#flash').matches('.is-session-dragging,.is-session-settling,.is-session-committing')"), "written input area became draggable");
   await evaluate("getState(0).task='trace';renderSession()");
   assert(await evaluate("sessionSwipeCleanup===null&&!!document.querySelector('#s-writer')&&!!document.querySelector('.mizi')"), "written tracing gained swipe state or lost its writer");
   await dragCard(-130, 2);
   assert((await evaluate("session.index")) === 0, "written tracing navigated by drag");
   await evaluate("session={active:false};clearSavedSession();startCardsWith([db.cards.find(c=>c.id==='c1'),db.cards.find(c=>c.id==='c2')],'Découverte isolée','discover')");
   assert(await evaluate("session.mode==='discover'&&sessionSwipeCleanup===null&&!document.querySelector('.session-swipe-hint')"), "discover mode gained swipe state or hint");
   await dragCard(-130, 2);
   assert((await evaluate("session.index")) === 0, "discover mode navigated by drag");
   pass("modes écrit, tracé et découverte isolés du geste");

   await cdp.send("Emulation.setEmulatedMedia", { features:[{ name:"prefers-reduced-motion", value:"reduce" }] });
   await evaluate("session={active:false};clearSavedSession();startCardsWith([db.cards.find(c=>c.id==='c1'),db.cards.find(c=>c.id==='c2')],'Mouvement réduit','cards')");
   await dragCard(-120, 2, "#flash", { duration: 100, steps: 4 });
   await waitForCard(1, "reduced-motion swipe did not navigate deterministically");
   assert(await swipeVisualClean(), "reduced-motion swipe left visual state behind");
   await cdp.send("Emulation.setEmulatedMedia", { features:[{ name:"prefers-reduced-motion", value:"no-preference" }] });

   for (const width of [320, 375, 390, 430]) {
      await cdp.send("Emulation.setDeviceMetricsOverride", { width, height:844, deviceScaleFactor:2, mobile:true });
      await evaluate("session={active:false};clearSavedSession();startCardsWith([db.cards.find(c=>c.id==='c1'),db.cards.find(c=>c.id==='c2')],'Largeurs mobiles','cards')");
      const distance = await evaluate("Math.ceil(document.querySelector('#flash').getBoundingClientRect().width*.34)");
      await dragCard(-distance, 3, "#flash", { duration: 220, steps: 6 });
      await waitForCard(1, `swipe failed at ${width}px`);
      assert(await evaluate("document.documentElement.scrollWidth<=innerWidth+1"), `swipe created overflow at ${width}px`);
   }
   pass("mouvement réduit et largeurs mobiles 320, 375, 390 et 430 px");

   await cdp.send("Emulation.setDeviceMetricsOverride", { width:1024, height:800, deviceScaleFactor:1, mobile:false });
   await evaluate("session={active:false};clearSavedSession();startCardsWith([db.cards.find(c=>c.id==='c1'),db.cards.find(c=>c.id==='c2'),db.cards.find(c=>c.id==='c3')],'Clavier','cards');getState(0).revealed=true;renderSession();document.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}))");
   assert((await evaluate("session.index")) === 1, "desktop ArrowRight navigation regressed");
   await evaluate("getState(1).revealed=true;renderSession();document.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}))");
   assert((await evaluate("session.index")) === 0, "desktop ArrowLeft navigation regressed");
   await evaluate("session={active:false};clearSavedSession();startCardsWith([db.cards.find(c=>c.id==='c1'),db.cards.find(c=>c.id==='c2')],'Dernière carte','cards');session.index=1;getState(1).revealed=true;renderSession()");
   await dragCard(-220, 2, ".hanzi", { duration: 180, steps: 6 });
   await waitFor(() => evaluate("!session.active"), "last-card swipe did not preserve session completion");
   pass("clavier desktop et fin de séance sur swipe de la dernière carte");

   // Régression du glissement tactile. Les événements souris ne reproduisent pas le
   // bug : seul le compositeur tactile revendique le geste. .fl-body défile
   // verticalement ; sans touch-action explicite il vaut `auto`, le compositeur
   // s'attribue aussi l'horizontal et annule le pointeur (pointercancel) — plus aucun
   // balayage ne part. On rejoue donc la séquence exacte en vrai tactile.
   await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
   await cdp.send("Emulation.setDeviceMetricsOverride", { width:390, height:600, deviceScaleFactor:2, mobile:true });
   await evaluate("session={active:false};clearSavedSession();destroyReviewStrokeWorkspace();startCardsWith([db.cards.find(c=>c.id==='c1'),db.cards.find(c=>c.id==='c2')],'Scroll tactile','cards');getState(0).front='zh';getState(0).revealed=true;reviewStrokeExpanded=true;renderSession()");
   await waitFor(() => evaluate("document.querySelector('.fl-body').scrollHeight>document.querySelector('.fl-body').clientHeight+30"), "expanded card was not internally scrollable");
   const scrollPoint = await evaluate("(() => {const body=document.querySelector('.fl-body'),r=body.getBoundingClientRect();body.scrollTop=0;return {x:r.left+r.width*.55,y:r.bottom-50};})()");
   await cdp.send("Input.dispatchTouchEvent", { type:"touchStart", touchPoints:[{ x:scrollPoint.x, y:scrollPoint.y, id:9 }] });
   for (let step=1; step<=5; step++)
      await cdp.send("Input.dispatchTouchEvent", { type:"touchMove", touchPoints:[{ x:scrollPoint.x+3, y:scrollPoint.y-step*24, id:9 }] });
   await cdp.send("Input.dispatchTouchEvent", { type:"touchEnd", touchPoints:[] });
   await new Promise((resolve) => setTimeout(resolve, 260));
   assert(await evaluate("session.index===0&&document.querySelector('.fl-body').scrollTop>10&&!document.querySelector('#flash').matches('.is-session-dragging,.is-session-settling,.is-session-committing')"), "vertical touch did not preserve internal .fl-body scrolling");
   pass("défilement tactile vertical interne à .fl-body");

   async function touchSwipe(dx) {
      const point = await evaluate(`(() => { const r=document.querySelector('#flash').getBoundingClientRect(); return {x:Math.round(r.left+r.width*0.5), y:Math.round(r.top+r.height*0.35)}; })()`);
      await cdp.send("Input.dispatchTouchEvent", { type:"touchStart", touchPoints:[{ x:point.x, y:point.y, id:1 }] });
      for (let step = 1; step <= 6; step++)
         await cdp.send("Input.dispatchTouchEvent", { type:"touchMove", touchPoints:[{ x:point.x + (dx*step)/6, y:point.y + (dx < 0 ? 5 : -5)*step/6, id:1 }] });
      const during = await evaluate("({classes:document.querySelector('#flash').className,transform:document.querySelector('#flash').style.transform})");
      await cdp.send("Input.dispatchTouchEvent", { type:"touchEnd", touchPoints:[] });
      await new Promise((resolve) => setTimeout(resolve, 320));
      return during;
   }
   let reviewTouchPointerId = 20;
   async function touchCardPath({ x=.5, y=.5, selector="#flash", moves=[], settle=80 } = {}) {
      const point = await evaluate(`(() => {const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:Math.round(r.left+r.width*${x}),y:Math.round(r.top+r.height*${y})};})()`);
      await evaluate(`(() => {
         if (!window.__reviewTouchTraceInstalled) {
            window.__reviewTouchTraceInstalled=true;
            const describe=(node)=>node?.nodeType===1?node.tagName.toLowerCase()+(node.id?'#'+node.id:'')+(node.classList?.length?'.'+[...node.classList].join('.'):'' ):node===document?'document':node===window?'window':node?.nodeName||'';
            document.addEventListener('pointerdown',(event)=>{
               const trace=window.__reviewTouchTrace;if(!trace)return;
               trace.down={target:describe(event.target),path:event.composedPath().map(describe).filter(Boolean),blocked:!!event.target.closest(SESSION_SWIPE_BLOCKING_SELECTOR),practice:!!event.target.closest(SESSION_SWIPE_TAP_OR_DRAG_SELECTOR),x:event.clientX,y:event.clientY};
            },true);
            document.addEventListener('pointercancel',(event)=>{if(window.__reviewTouchTrace)window.__reviewTouchTrace.cancelled=true;},true);
            document.addEventListener('gotpointercapture',(event)=>{if(window.__reviewTouchTrace)window.__reviewTouchTrace.capture.push({type:event.type,target:describe(event.target)});},true);
            document.addEventListener('lostpointercapture',(event)=>{if(window.__reviewTouchTrace)window.__reviewTouchTrace.capture.push({type:event.type,target:describe(event.target)});},true);
         }
         window.__reviewTouchTrace={down:null,cancelled:false,capture:[]};
      })()`);
      const pointerId=reviewTouchPointerId++;
      await cdp.send("Input.dispatchTouchEvent", {type:"touchStart",touchPoints:[{x:point.x,y:point.y,id:pointerId,radiusX:6,radiusY:6,force:1}]});
      for (const move of moves) {
         if (move.delay) await new Promise((resolve)=>setTimeout(resolve,move.delay));
         await cdp.send("Input.dispatchTouchEvent", {type:"touchMove",touchPoints:[{x:point.x+move.dx,y:point.y+move.dy,id:pointerId,radiusX:6,radiusY:6,force:1}]});
      }
      const during=await evaluate(`(() => {const card=document.querySelector('#flash');return {index:session.index,classes:card.className,transform:card.style.transform};})()`);
      await cdp.send("Input.dispatchTouchEvent", {type:"touchEnd",touchPoints:[]});
      await new Promise((resolve)=>setTimeout(resolve,settle));
      return {point,during,trace:await evaluate("window.__reviewTouchTrace"),after:await evaluate(`(() => {const card=document.querySelector('#flash');return {active:session.active,index:session.index,revealed:getState(session.index)?.revealed,classes:card?.className||'',transform:card?.style.transform||'',dialogs:document.querySelectorAll('.writing-practice-dialog').length};})()`)};
   }
   const thumbPath = (direction, distance, style) => {
      if (style === "fast") return [{dx:direction*distance*.45,dy:2,delay:4},{dx:direction*distance,dy:4,delay:4}];
      if (style === "diagonal") return [{dx:direction*3,dy:9,delay:12},{dx:direction*22,dy:12,delay:12},{dx:direction*58,dy:14,delay:12},{dx:direction*distance,dy:17,delay:12}];
      return Array.from({length:8},(_,index)=>({dx:direction*distance*((index+1)/8),dy:4*((index+1)/8),delay:8}));
   };
   await evaluate("session={active:false};clearSavedSession();destroyReviewStrokeWorkspace();startCardsWith([db.cards.find(c=>c.id==='c1'),db.cards.find(c=>c.id==='c2'),db.cards.find(c=>c.id==='c3'),db.cards.find(c=>c.id==='c4')],'Tactile','cards')");
   assert((await evaluate("getComputedStyle(document.querySelector('.fl-body')).touchAction")) === "pan-y", "the card scroll container no longer declares touch-action: pan-y");
   const srsBeforeTouch = await evaluate("JSON.stringify(db.cards.map(c=>({id:c.id,lvl:c.lvl,due:c.due,h:c.reviewHistory,last:c.lastReviewed})))");
   const touchPath = [];
   const touchDuring = [];
   for (const step of ["next", "next", "previous", "next", "previous", "previous", "next"]) {
      touchDuring.push(await touchSwipe(step === "next" ? -110 : 110));
      touchPath.push(await evaluate("session.index"));
   }
   assert(JSON.stringify(touchPath) === JSON.stringify([1, 2, 1, 2, 1, 0, 1]), `touch swipe sequence drifted: ${JSON.stringify(touchPath)} ${JSON.stringify(touchDuring)}`);
   // la séquence laisse l'index à 1 ; deux glissements de plus atteignent la dernière
   // carte des quatre sans terminer la séance (advance() y appellerait endSession).
   for (let index = 0; index < 2; index++) await touchSwipe(-110);
   assert((await evaluate("session.index")) === 3 && (await evaluate("session.active")) === true, "repeated forward touch swipes stalled");
   assert((await evaluate("JSON.stringify(db.cards.map(c=>({id:c.id,lvl:c.lvl,due:c.due,h:c.reviewHistory,last:c.lastReviewed})))")) === srsBeforeTouch, "a swipe graded a card");
   assert(await evaluate("session.states.filter(Boolean).every((state)=>!state.grade)"), "a swipe recorded a grade in the session state");

   // Régression exacte du pouce posé bas : le premier mouvement est un peu plus
   // vertical (3 × 9 px), puis l'intention devient franchement horizontale. La
   // matrice couvre bas gauche/centre/droit et les quatre largeurs mobiles.
   await cdp.send("Emulation.setEmulatedMedia", {features:[{name:"prefers-reduced-motion",value:"reduce"}]});
   for (const width of [320,360,390,430]) {
      await cdp.send("Emulation.setDeviceMetricsOverride", {width,height:844,deviceScaleFactor:2,mobile:true});
      for (const y of [.75,.85,.92]) {
         for (const x of [.2,.5,.8]) {
            const direction=x===.2?1:-1,startIndex=direction>0?1:0,distance=Math.min(120,width*.34);
            await evaluate(`session.index=${startIndex};getState(session.index).front='zh';getState(session.index).revealed=false;renderSession()`);
            const gesture=await touchCardPath({x,y,moves:thumbPath(direction,distance,"diagonal")});
            const expected=startIndex-direction;
            assert(gesture.trace.down&&!gesture.trace.cancelled&&gesture.after.index===expected&&gesture.during.classes.includes('is-session-dragging')&&gesture.during.transform, `bottom-front diagonal swipe failed at ${width}px x=${x} y=${y}: ${JSON.stringify(gesture)}`);
         }
      }
      for (const style of ["slow","fast"]) {
         for (const x of [.2,.5,.8]) {
            const direction=x===.2?1:-1,startIndex=direction>0?1:0,distance=Math.min(120,width*.34);
            await evaluate(`session.index=${startIndex};getState(session.index).front='zh';getState(session.index).revealed=false;renderSession()`);
            const gesture=await touchCardPath({x,y:.85,moves:thumbPath(direction,distance,style)});
            assert(gesture.after.index===startIndex-direction&&!gesture.trace.cancelled, `bottom-front ${style} swipe failed at ${width}px x=${x}: ${JSON.stringify(gesture)}`);
         }
      }
      // Le verso neutre reste navigable avec le même départ diagonal bas.
      for (const x of [.2,.5,.8]) {
         const direction=x===.2?1:-1,startIndex=direction>0?1:0,distance=Math.min(120,width*.34);
         await evaluate(`session.index=${startIndex};getState(session.index).front='zh';getState(session.index).revealed=true;reviewStrokeExpanded=false;renderSession()`);
         const gesture=await touchCardPath({x,y:.85,moves:thumbPath(direction,distance,"diagonal")});
         assert(gesture.after.index===startIndex-direction&&!gesture.trace.cancelled, `bottom-back diagonal swipe failed at ${width}px x=${x}: ${JSON.stringify(gesture)}`);
      }
   }
   pass("matrice tactile basse 320/360/390/430 : gauche, centre, droite, lent, rapide et intention diagonale");

   // #s-practice arbitre désormais son tap et le glissement de la carte. Le tap
   // ouvre une seule fois ; le drag est repris, ne clique pas et ne retourne rien.
   await cdp.send("Emulation.setDeviceMetricsOverride", {width:390,height:844,deviceScaleFactor:2,mobile:true});
   await evaluate("session.index=0;getState(0).front='zh';getState(0).revealed=false;getState(1).revealed=false;renderSession();window.__practiceTouchClicks=0;document.querySelector('#s-practice').addEventListener('click',()=>window.__practiceTouchClicks++)");
   const practiceTap=await touchCardPath({selector:"#s-practice",settle:140});
   assert(await evaluate("window.__practiceTouchClicks===1&&document.querySelectorAll('.writing-practice-dialog').length===1&&session.index===0&&getState(0).revealed===false"), `practice touch tap did not open exactly once: ${JSON.stringify(practiceTap)}`);
   await click(".writing-practice-close");
   await evaluate("window.__practiceTouchClicks=0");
   const practiceDrag=await touchCardPath({selector:"#s-practice",moves:thumbPath(-1,120,"diagonal"),settle:100});
   assert(practiceDrag.trace.down?.practice&&practiceDrag.trace.down?.blocked&&practiceDrag.during.classes.includes('is-session-dragging')&&practiceDrag.after.index===1&&practiceDrag.after.revealed===false&&!practiceDrag.after.dialogs&&(await evaluate("window.__practiceTouchClicks"))===0, `practice drag was not reclaimed or left a click: ${JSON.stringify(practiceDrag)}`);

   // Les vrais contrôles gardent leur exclusivité tactile au verso.
   await evaluate("session.index=0;getState(0).revealed=true;renderSession();window.__favBeforeTouch=currentCard().fav");
   const favoriteDrag=await touchCardPath({selector:"#a-fav",moves:thumbPath(-1,120,"fast"),settle:100});
   assert(favoriteDrag.trace.down?.blocked&&!favoriteDrag.trace.down?.practice&&favoriteDrag.after.index===0&&(await evaluate("currentCard().fav===window.__favBeforeTouch")), `interactive favorite drag navigated or clicked: ${JSON.stringify(favoriteDrag)}`);
   pass("arbitrage tactile du bouton d’écriture et contrôles interactifs exclusifs");

   // Un vrai tap neutre conserve le retournement natif exactement une fois.
   await evaluate("getState(0).front='zh';getState(0).revealed=false;renderSession()");
   const neutralTap=await touchCardPath({x:.5,y:.85,settle:140});
   assert(neutralTap.after.index===0&&neutralTap.after.revealed===true&&!neutralTap.after.dialogs, `neutral touch tap no longer flipped exactly once: ${JSON.stringify(neutralTap)}`);
   await cdp.send("Emulation.setEmulatedMedia", {features:[{name:"prefers-reduced-motion",value:"no-preference"}]});
   assert((await evaluate("JSON.stringify(db.cards.map(c=>({id:c.id,lvl:c.lvl,due:c.due,h:c.reviewHistory,last:c.lastReviewed})))")) === srsBeforeTouch, "lower touch matrix or practice arbitration changed SRS history");
   await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: false });
   pass("glissement tactile : séquence suivant/précédent fiable, aucune note enregistrée");
   await evaluate("session={active:false};clearSavedSession();destroyReviewStrokeWorkspace();renderLearn()");

   // Entraînement à l'écriture depuis le recto : exercice de rappel, pas de réponse.
   // « leaks » ne retient que les caractères du mot révisé : les noms de grille
   // (田字格, 米字格) sont des libellés fixes, ils ne donnent aucune réponse.
   const practiceAudit = (answer) => `(() => {
      const dialog=document.querySelector('.writing-practice-dialog'),strings=[],answer=[...${JSON.stringify(answer)}];
      dialog.querySelectorAll('*').forEach((node)=>{
         if (node.hidden||node.closest('[hidden]')) return;
         for (const attribute of ['aria-label','title','alt','placeholder'])
            if (node.hasAttribute(attribute)) strings.push(node.getAttribute(attribute));
         const own=[...node.childNodes].filter((child)=>child.nodeType===3).map((child)=>child.nodeValue).join('');
         if (own.trim()&&!node.closest('[aria-hidden="true"]')) strings.push(own);
      });
      return {mode:dialog.dataset.writingPracticeMode,title:document.querySelector('#writing-practice-title').textContent.trim(),
         canvas:document.querySelector('#review-writing-canvas').getAttribute('aria-label'),
         pills:[...document.querySelectorAll('[data-writing-practice-character]')].map((button)=>button.textContent),
         modelHidden:document.querySelector('#review-writing-model').hidden,
         blurred:document.querySelector('.writing-practice-backdrop').classList.contains('writing-practice-backdrop-review'),
         leaks:strings.filter((value)=>answer.some((character)=>value.includes(character)))};
   })()`;
   await evaluate("session={active:false};clearSavedSession();destroyReviewStrokeWorkspace();startCardsWith([db.cards.find(c=>c.id==='c1'),db.cards.find(c=>c.id==='c2')],'Recto','cards')");
   const preferenceBefore = await evaluate("JSON.stringify(JSON.parse(localStorage.getItem(DB_KEY)).settings.writingBoard)");
   assert(await evaluate("!!document.querySelector('#s-practice')&&getState(0).revealed===false"), "front-of-card practice entry missing");
   await evaluate("(() => {const button=document.querySelector('#s-practice');button.focus({preventScroll:true});button.click();})()");
   await waitFor(() => evaluate("!!document.querySelector('.writing-practice-backdrop')&&document.querySelector('#review-writing-canvas')?.width>1"), "front-of-card writing practice did not open");
   const fromFront = await evaluate(practiceAudit('你好吗'));
   assert(fromFront.mode==='review'&&fromFront.modelHidden&&fromFront.blurred&&fromFront.title==='Tracer nǐ'&&fromFront.canvas==='Zone d’essai pour nǐ'&&JSON.stringify(fromFront.pills)===JSON.stringify(['nǐ','hǎo','ma'])&&!fromFront.leaks.length, `front-of-card practice leaked the answer: ${JSON.stringify(fromFront)}`);
   await evaluate("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))");
   await waitFor(() => evaluate("!document.querySelector('.writing-practice-backdrop')"), "front-of-card practice did not close");
   assert(await evaluate("session.active&&session.index===0&&getState(0).revealed===false&&!!document.querySelector('#s-practice')&&document.activeElement===document.querySelector('#s-practice')"), "front-of-card practice flipped the card or lost focus");
   assert((await evaluate("JSON.stringify(JSON.parse(localStorage.getItem(DB_KEY)).settings.writingBoard)")) === preferenceBefore, "review practice wrote the hidden model into the saved preferences");
   // pinyin non alignable sur les caractères (朋友 · « péngyou ») : ni pinyin inventé, ni caractère en repli
   await evaluate("advance()"); // le recto n'expose pas #s-next : la barre de navigation vit sous les notes
   await evaluate("(() => {const button=document.querySelector('#s-practice');button.focus({preventScroll:true});button.click();})()");
   await waitFor(() => evaluate("!!document.querySelector('.writing-practice-backdrop')"), "second front-of-card practice did not open");
   const withoutPinyin = await evaluate(practiceAudit('朋友'));
   assert(withoutPinyin.title==='Tracer'&&JSON.stringify(withoutPinyin.pills)===JSON.stringify(['1','2'])&&withoutPinyin.canvas==='Zone d’essai'&&!withoutPinyin.leaks.length, `unaligned pinyin fallback failed: ${JSON.stringify(withoutPinyin)}`);
   await click(".writing-practice-close");
   // l'atelier des traits garde son comportement : modèle visible, caractère au titre, pas de flou
   await evaluate("openWritingPracticeSheet('你')");
   await waitFor(() => evaluate("!!document.querySelector('.writing-practice-backdrop')&&document.querySelector('#review-writing-canvas')?.width>1"), "search-mode writing practice did not open");
   const fromSearch = await evaluate(practiceAudit(''));
   assert(fromSearch.mode==='search'&&!fromSearch.modelHidden&&!fromSearch.blurred&&fromSearch.title==='Tracer 你'&&fromSearch.canvas==='Zone d’essai pour 你', `search-mode writing practice changed: ${JSON.stringify(fromSearch)}`);
   await click(".writing-practice-close");
   await evaluate("session={active:false};clearSavedSession();destroyReviewStrokeWorkspace();renderLearn()");
   pass("entraînement contextuel : rappel en révision, atelier des traits inchangé");

   await evaluate("document.body.style.minHeight='';reviewSelectionMode='all';reviewMode='cards';reviewExtraFilters={newOnly:false,favoritesOnly:false,difficultOnly:false,includeLearned:false};reviewOptionsOpen=false;clearSavedSession();renderLearn()");
   for (const [width,height,screenshot] of [[390,844,reviewHubMobileScreenshot],[1440,900,reviewHubDesktopScreenshot]]) {
      await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: width === 390 ? 2 : 1, mobile: width === 390 });
      await evaluate("reviewOptionsOpen=false;renderLearn();scrollTo(0,0)");
      const layout = await evaluate(`(() => { const page=document.querySelector('.review-page'),start=document.querySelector('#btn-continue'),nav=document.querySelector('.nav').getBoundingClientRect(),pageRect=page.getBoundingClientRect(),startRect=start.getBoundingClientRect(),requiredScroll=Math.max(0,startRect.bottom-nav.top); return {blocks:document.querySelectorAll('.review-block').length,combined:document.querySelectorAll('.review-preferences-block').length,modes:document.querySelectorAll('[data-review-mode]').length,directions:document.querySelectorAll('[data-review-direction]').length,modeRows:new Set([...document.querySelectorAll('[data-review-mode]')].map(button=>Math.round(button.getBoundingClientRect().top))).size,directionRows:new Set([...document.querySelectorAll('[data-review-direction]')].map(button=>Math.round(button.getBoundingClientRect().top))).size,overflow:document.documentElement.scrollWidth>innerWidth+1,max:pageRect.width,buttons:[...document.querySelectorAll('.review-page button')].every(button=>button.getBoundingClientRect().height>=44),navFixed:getComputedStyle(document.querySelector('.nav')).position==='fixed',startVisible:startRect.bottom<=nav.top+1,requiredScroll,span:startRect.bottom-pageRect.top,documentHeight:document.documentElement.scrollHeight,viewport:innerHeight,optionsClosed:!document.querySelector('#review-options').open,scrollY}; })()`);
      assert(layout.blocks===3&&layout.combined===1&&layout.modes===3&&layout.directions===3&&layout.modeRows===1&&layout.directionRows===1&&!layout.overflow&&layout.max<=820&&layout.buttons&&layout.navFixed&&layout.optionsClosed&&layout.scrollY===0&&(width===1440?layout.startVisible&&layout.documentHeight<=layout.viewport+1:layout.requiredScroll<=layout.viewport*.5&&layout.span<=layout.viewport*1.5), `compact hub layout ${width}x${height} failed: ${JSON.stringify(layout)}`);
      const image = await cdp.send("Page.captureScreenshot", { format:"png", fromSurface:true, clip:{x:0,y:0,width,height,scale:1} });
      await writeFile(screenshot, Buffer.from(image.data,"base64"));
   }
   pass(`18 hub compact 390 × 844 · capture ${reviewHubMobileScreenshot}`); pass(`19 hub complet 1440 × 900 sans scroll · capture ${reviewHubDesktopScreenshot}`); pass("20 segments Mode/Sens sur une ligne"); pass("21 aucun scroll horizontal");

   for (const width of [360,430,1024]) {
      await cdp.send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width <= 430 });
      await evaluate("startCardsWith([db.cards.find(c=>c.id==='c1')],'Responsive','cards');getState(0).revealed=true;reviewStrokeExpanded=true;renderSession()");
      await waitFor(() => evaluate("!!document.querySelector('#review-strokes')"), "responsive stroke block missing");
      // Les puces de composition (.composition-component) sont des jetons de texte
      // partagés avec le dictionnaire, dimensionnés sur la ligne : la règle des 44 px
      // vise les commandes de la séance.
      const layout = await evaluate(`(() => {const flash=document.querySelector('#flash').getBoundingClientRect(),grades=document.querySelector('.grades').getBoundingClientRect();return {overflow:document.documentElement.scrollWidth>innerWidth+1,flash:flash.width,viewport:innerWidth,controls:[...document.querySelectorAll('.review-strokes button:not(.composition-component),.session-nav button,.grades button')].every(button=>button.getBoundingClientRect().height>=44),overlap:document.querySelector('.session-nav').getBoundingClientRect().left<0,pageScroll:document.documentElement.scrollHeight>innerHeight+1,gapUnderCard:Math.round(grades.top-flash.bottom),cardTop:Math.round(flash.top),cardScrolls:getComputedStyle(document.querySelector('.fl-body')).overflowY==='auto'};})()`);
      assert(!layout.overflow&&layout.flash<=layout.viewport&&layout.controls&&!layout.overlap, `session layout ${width} failed: ${JSON.stringify(layout)}`);
      // la carte descend jusqu'aux boutons de notation, et c'est elle qui défile
      assert(!layout.pageScroll&&layout.cardScrolls&&layout.gapUnderCard<=14&&layout.cardTop<=90, `session full-height layout ${width} failed: ${JSON.stringify(layout)}`);
      await evaluate("session={active:false};clearSavedSession();destroyReviewStrokeWorkspace();renderLearn()");
   }
   pass("session responsive 360, 430 et 1024 px sans chevauchement");
   pass("carte pleine hauteur : aucun défilement de page, défilement interne à la carte");

   await cdp.send("Emulation.setDeviceMetricsOverride", { width:390, height:844, deviceScaleFactor:2, mobile:true });
   await evaluate("writingState.mode='free';writingState.free={actions:[],redo:[]};setView('write',{fromHistory:true});renderWriting()");
   await waitFor(() => evaluate("document.querySelector('#writing-canvas')?.width>1&&!!writingCanvasController"), "shared writing canvas did not initialize on the Écrire page");
   const sharedCanvas = await evaluate(`(() => {const canvas=document.querySelector('#writing-canvas'),rect=canvas.getBoundingClientRect(),x=rect.left+rect.width*.4,y=rect.top+rect.height*.3,init={bubbles:true,cancelable:true,isPrimary:true,pointerId:72,pointerType:'pen',pressure:.7,button:0};canvas.dispatchEvent(new PointerEvent('pointerdown',{...init,clientX:x,clientY:y}));canvas.dispatchEvent(new PointerEvent('pointermove',{...init,clientX:x+45,clientY:y+40}));canvas.dispatchEvent(new PointerEvent('pointerup',{...init,clientX:x+45,clientY:y+40}));return {actions:writingState.free.actions.length,points:writingState.free.actions.at(-1)?.points.length,touch:getComputedStyle(canvas).touchAction};})()`);
   assert(sharedCanvas.actions===1&&sharedCanvas.points>=2&&sharedCanvas.touch==='none', `shared writing canvas regressed: ${JSON.stringify(sharedCanvas)}`);
   await evaluate("setView('learn',{fromHistory:true});renderLearn()");
   pass("moteur de canevas partagé sans régression sur la page Écrire");

   const finalState = await evaluate("({srs:JSON.stringify(db.cards.map(c=>({id:c.id,lvl:c.lvl,due:c.due,acquired:c.acquired,history:c.reviewHistory}))),structure:JSON.stringify({packs:db.packs,categories:db.categories,memberships:db.memberships})})");
   assert(finalState.srs === seeded.srs && finalState.structure === seeded.structure, "packs or SRS changed"); pass("22 aucune perte de packs ou progression");
   assert(!cdp.errors.length, "runtime errors: " + cdp.errors.join(" | "));
   console.log(`RESULT ${version.Browser} — expérience Réviser et flashcards validée`);
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
