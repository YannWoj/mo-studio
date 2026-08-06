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
   assert(await evaluate("document.querySelectorAll('[data-review-stroke-character]').length===3&&document.querySelector('#review-stroke-count').textContent.trim()==='1 / 3'"), "multi-character stroke selector failed");
   assert(await evaluate("document.querySelector('#s-prev').disabled&&document.querySelector('#s-next').textContent.includes('Passer')"), "first card navigation failed");
   await evaluate("window.__previousReviewWriter=reviewStrokeWriter;true"); await click("#review-stroke-replay"); assert(await evaluate("!!reviewStrokeWriter&&reviewStrokeWriter!==window.__previousReviewWriter"), "replay did not recreate animation"); pass("ordre des traits · Animation et Rejouer");
   await click('[data-review-stroke-tab="steps"]'); await waitFor(() => evaluate("document.querySelectorAll('.review-stroke-step').length===reviewStrokeData?.strokeCount"), "stroke steps missing"); pass("ordre des traits · Étapes");
   await click("#review-stroke-character-next"); await waitFor(() => evaluate("reviewStrokeData?.character==='好'"), "second character did not load"); assert(await evaluate("document.querySelector('#review-stroke-count').textContent.trim()==='2 / 3'"), "second character counter failed");
   await cdp.send("Emulation.setDeviceMetricsOverride", { width:360, height:800, deviceScaleFactor:2, mobile:true });
   await click("#review-stroke-practice");
   await waitFor(() => evaluate("!!document.querySelector('.writing-practice-backdrop')&&document.querySelector('#review-writing-canvas')?.width>1"), "review writing practice did not open");
   const practiceLayout = await evaluate(`(() => {
      const sheet=document.querySelector('.writing-practice-dialog'),rect=sheet.getBoundingClientRect(),canvas=document.querySelector('#review-writing-canvas'),model=document.querySelector('#review-writing-model'),surface=document.querySelector('#review-writing-surface'),surfaceRect=surface.getBoundingClientRect();
      return {character:document.querySelector('.review-writing-practice').dataset.reviewWritingCharacter,word:document.querySelector('.review-writing-practice').dataset.writingPracticeWord,characters:document.querySelectorAll('[data-writing-practice-character]').length,model:model.textContent.trim(),sheetHeight:rect.height,viewport:innerHeight,top:rect.top,width:rect.width,surfaceSize:[surfaceRect.width,surfaceRect.height],surfaceMinHeight:getComputedStyle(surface).minHeight,overflow:document.documentElement.scrollWidth>innerWidth,canvasTouch:getComputedStyle(canvas).touchAction,grids:document.querySelectorAll('.review-writing-practice [data-writing-grid]').length,widthControl:!!document.querySelector('#review-writing-width'),undo:!!document.querySelector('#review-writing-undo'),touchTargets:[...document.querySelectorAll('.review-writing-practice button,.review-writing-practice input')].every((node)=>node.type==='range'||node.type==='checkbox'||node.getBoundingClientRect().height>=44),session:{active:session.active,index:session.index,card:currentCard().id,stroke:getState(session.index).strokeCharacterIndex,tab:reviewStrokeTab},inert:document.querySelector('#view').inert};
   })()`);
   assert(practiceLayout.character==='好'&&practiceLayout.word==='你好吗'&&practiceLayout.characters===3&&practiceLayout.model==='好'&&practiceLayout.sheetHeight<=practiceLayout.viewport-16+1&&practiceLayout.top>0&&practiceLayout.width<practiceLayout.viewport&&Math.abs(practiceLayout.surfaceSize[0]-practiceLayout.surfaceSize[1])<1&&!practiceLayout.overflow&&practiceLayout.canvasTouch==='none'&&practiceLayout.grids===4&&practiceLayout.widthControl&&practiceLayout.undo&&practiceLayout.touchTargets&&practiceLayout.session.active&&practiceLayout.session.index===0&&practiceLayout.session.card==='c1'&&practiceLayout.session.stroke===1&&practiceLayout.session.tab==='steps'&&practiceLayout.inert, `compact review writing layout/state failed: ${JSON.stringify(practiceLayout)}`);
   await click("#review-writing-model-visible");
   assert(await evaluate("document.querySelector('#review-writing-model').hidden"), "review writing model toggle did not hide the guide");
   await click("#review-writing-model-visible");
   await evaluate("(() => {const input=document.querySelector('#review-writing-opacity');input.value='31';input.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('[data-writing-grid=mi]').click();})()");
   const practiceGesture = await evaluate(`(() => {
      const canvas=document.querySelector('#review-writing-canvas'),rect=canvas.getBoundingClientRect(),x=rect.left+rect.width*.35,y=rect.top+rect.height*.35,init={bubbles:true,cancelable:true,isPrimary:true,pointerId:71,pointerType:'touch',button:0};
      canvas.dispatchEvent(new PointerEvent('pointerdown',{...init,clientX:x,clientY:y}));
      canvas.dispatchEvent(new PointerEvent('pointermove',{...init,clientX:x+32,clientY:y+22}));
      canvas.dispatchEvent(new PointerEvent('pointermove',{...init,clientX:x+64,clientY:y+48}));
      canvas.dispatchEvent(new PointerEvent('pointerup',{...init,clientX:x+64,clientY:y+48}));
      return {selection:getSelection().toString(),clearDisabled:document.querySelector('#review-writing-clear').disabled,grid:document.querySelector('#review-writing-surface').dataset.grid,opacity:document.querySelector('#review-writing-opacity-value').textContent,modelHidden:document.querySelector('#review-writing-model').hidden};
   })()`);
   assert(!practiceGesture.selection&&!practiceGesture.clearDisabled&&practiceGesture.grid==='mi'&&practiceGesture.opacity==='31%'&&!practiceGesture.modelHidden, `review writing controls/touch failed: ${JSON.stringify(practiceGesture)}`);
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
   const listenerCount = await evaluate("reviewStrokeWriterListeners.length"); await click("#s-next"); assert(await evaluate("session.index===1&&reviewStrokeWriter===null&&reviewStrokeWriterListeners.length===0"), "writer was not destroyed on card change"); await click("#s-flip"); await waitFor(() => evaluate("reviewStrokeData?.character==='书'"), "next card stroke data did not load"); assert((await evaluate("reviewStrokeWriterListeners.length")) <= Math.max(listenerCount, 2), "writer listeners leaked"); assert(await evaluate("document.querySelector('#s-next').textContent.includes('Terminer')&&!document.querySelector('#s-prev').disabled"), "last card navigation failed"); await click("#s-prev"); assert((await evaluate("session.index")) === 0, "previous navigation failed"); pass("nettoyage Hanzi Writer et barre Précédent / Passer / Terminer");
   await evaluate("session={active:false};clearSavedSession();destroyReviewStrokeWorkspace();startCardsWith([{id:'latin',hz:'hello',py:'',fr:'bonjour',lvl:0,due:null,acquired:false}],'Sans hanzi','cards')"); await click("#s-flip"); assert(!(await evaluate("!!document.querySelector('#review-strokes')")), "stroke block shown without Han character"); await evaluate("session={active:false};clearSavedSession();destroyReviewStrokeWorkspace();renderLearn()"); pass("verso sans caractère chinois");

   async function dragCard(dx, dy, selector = "#flash") {
      const point = await evaluate(`(() => { const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return {x:${JSON.stringify(selector)}==='#flash'?r.left+18:r.left+r.width/2,y:r.top+r.height/2}; })()`);
      await cdp.send("Input.dispatchMouseEvent", { type:"mousePressed", x:point.x, y:point.y, button:"left", buttons:1, clickCount:1 });
      await cdp.send("Input.dispatchMouseEvent", { type:"mouseMoved", x:point.x+dx, y:point.y+dy, button:"left", buttons:1 });
      await cdp.send("Input.dispatchMouseEvent", { type:"mouseReleased", x:point.x+dx, y:point.y+dy, button:"left", buttons:0, clickCount:1 });
   }
   await evaluate("startCardsWith([db.cards.find(c=>c.id==='c1'),db.cards.find(c=>c.id==='c2'),db.cards.find(c=>c.id==='c3')],'Gestes','cards')");
   await dragCard(-120, 4); assert((await evaluate("session.index")) === 1, "left swipe failed"); await dragCard(120, 3); assert((await evaluate("session.index")) === 0, "right swipe failed");
   await dragCard(2, 1); assert((await evaluate("session.index")) === 0, "simple touch changed card");
   await evaluate("getState(0).revealed=false;renderSession()");
   await dragCard(3, 110); assert(await evaluate("session.index===0&&getComputedStyle(document.querySelector('#flash')).touchAction==='pan-y'"), "vertical gesture blocked or changed card");
   await click("#s-flip"); await dragCard(-120, 0, "#a-fav"); assert((await evaluate("session.index")) === 0, "interactive control triggered swipe"); assert(await evaluate("!document.querySelector('#flash').classList.contains('is-session-dragging')&&(getSelection().isCollapsed||!String(getSelection()))"), "drag state or text selection remained"); pass("swipes gauche/droite, toucher simple, scroll vertical et contrôles protégés");
   await evaluate("session={active:false};clearSavedSession();destroyReviewStrokeWorkspace();renderLearn()");

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
      const layout = await evaluate(`({overflow:document.documentElement.scrollWidth>innerWidth+1,flash:document.querySelector('#flash').getBoundingClientRect().width,viewport:innerWidth,controls:[...document.querySelectorAll('.review-strokes button,.session-nav button,.grades button')].every(button=>button.getBoundingClientRect().height>=44),overlap:document.querySelector('.session-nav').getBoundingClientRect().left<0})`);
      assert(!layout.overflow&&layout.flash<=layout.viewport&&layout.controls&&!layout.overlap, `session layout ${width} failed: ${JSON.stringify(layout)}`);
      await evaluate("session={active:false};clearSavedSession();destroyReviewStrokeWorkspace();renderLearn()");
   }
   pass("session responsive 360, 430 et 1024 px sans chevauchement");

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
