"use strict";

import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = 8016;
const debugPort = 9349;
const url = `http://127.0.0.1:${port}/`;
const edge = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const profile = await mkdtemp(path.join(os.tmpdir(), "mo-dictionary-placement-"));
const visualProofs = {
   placement: path.join(os.tmpdir(), "mo-studio-placement-430.png"),
   paging: path.join(os.tmpdir(), "mo-studio-paging-360.png"),
   dictionaryStroke360: path.join(os.tmpdir(), "mo-studio-dictionary-strokes-360.png"),
   dictionaryStroke1440: path.join(os.tmpdir(), "mo-studio-dictionary-strokes-1440.png"),
   dictionaryStrokeSteps360: path.join(os.tmpdir(), "mo-studio-dictionary-strokes-steps-360.png"),
   dictionaryStrokeSteps1440: path.join(os.tmpdir(), "mo-studio-dictionary-strokes-steps-1440.png"),
   dictionaryStrokePractice360: path.join(os.tmpdir(), "mo-studio-dictionary-strokes-practice-360.png"),
   dictionaryStrokePractice1440: path.join(os.tmpdir(), "mo-studio-dictionary-strokes-practice-1440.png"),
   sequenceStroke360: path.join(os.tmpdir(), "mo-studio-sequence-strokes-360.png"),
   sequenceStroke1440: path.join(os.tmpdir(), "mo-studio-sequence-strokes-1440.png"),
   sequenceStrokeSteps360: path.join(os.tmpdir(), "mo-studio-sequence-strokes-steps-360.png"),
   sequenceStrokeSteps1440: path.join(os.tmpdir(), "mo-studio-sequence-strokes-steps-1440.png"),
   sequenceStrokePractice360: path.join(os.tmpdir(), "mo-studio-sequence-strokes-practice-360.png"),
   sequenceStrokePractice1440: path.join(os.tmpdir(), "mo-studio-sequence-strokes-practice-1440.png"),
};
let server, browser, cdp;

function assert(value, message) { if (!value) throw new Error(message); }
function pass(message) { console.log("PASS " + message); }
async function waitFor(fn, message, timeout = 30000) {
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
         } else if (message.method === "Runtime.exceptionThrown") {
            this.errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
         }
      };
   }
   static async connect(ws) {
      const socket = new WebSocket(ws);
      await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
      return new Cdp(socket);
   }
   send(method, params = {}) {
      const id = ++this.id;
      return new Promise((resolve, reject) => {
         this.pending.set(id, { resolve, reject });
         this.socket.send(JSON.stringify({ id, method, params }));
      });
   }
}

async function evaluate(expression) {
   const result = await cdp.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: true });
   if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
   return result.result.value;
}
async function navigate() {
   await cdp.send("Page.navigate", { url });
   await waitFor(() => evaluate("document.readyState === 'complete' && typeof openDictionaryAddToWords === 'function' && typeof personalLibraryInit === 'function'"), "application init failed");
}
async function click(selector) {
   return evaluate(`(() => { const node=document.querySelector(${JSON.stringify(selector)}); if(!node) throw new Error('missing ${selector}'); node.click(); return true; })()`);
}
async function captureStrokeNavigation(stageSelector, screenshotPath) {
   const clip = await evaluate(`(async () => {
      const stage=document.querySelector(${JSON.stringify(stageSelector)}),panel=stage?.querySelector('.stroke-tab-panel:not([hidden])'),visual=panel?.querySelector('.mizi') || panel?.querySelector('.stroke-gallery'),previous=stage?.querySelector(':scope > .character-nav-previous'),next=stage?.querySelector(':scope > .character-nav-next');
      if(!stage||!visual||!previous||!next)throw new Error('incomplete stroke navigation capture');
      visual.scrollIntoView({block:'center',inline:'center'});
      await new Promise((resolve)=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      const v=visual.getBoundingClientRect(),p=previous.getBoundingClientRect(),n=next.getBoundingClientRect(),padding=12;
      const left=Math.max(0,Math.min(p.left,v.left)-padding),top=Math.max(0,Math.min(p.top,v.top)-padding),right=Math.min(innerWidth,Math.max(n.right,v.right)+padding),bottom=Math.min(innerHeight,Math.max(p.bottom,n.bottom,v.bottom)+padding);
      return {x:left+scrollX,y:top+scrollY,width:right-left,height:bottom-top,scale:1};
   })()`);
   const screenshot = await cdp.send("Page.captureScreenshot", { format:"png", fromSurface:true, captureBeyondViewport:false, clip });
   await writeFile(screenshotPath, Buffer.from(screenshot.data, "base64"));
}
async function pointerGesture(selector, { deltaX = 0, deltaY = 0, pointerType = "touch", pointerId = 41 } = {}) {
   return evaluate(`(async()=>{
      const node=document.querySelector(${JSON.stringify(selector)});
      if(!node) throw new Error('missing ${selector}');
      const rect=node.getBoundingClientRect(),x=rect.left+rect.width/2,y=rect.top+rect.height/2;
      const emit=(type,clientX,clientY)=>node.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,composed:true,pointerId:${pointerId},pointerType:${JSON.stringify(pointerType)},isPrimary:true,button:0,buttons:type==='pointerup'?0:1,clientX,clientY}));
      emit('pointerdown',x,y); await new Promise(r=>setTimeout(r,18));
      emit('pointermove',x+${deltaX},y+${deltaY}); await new Promise(r=>setTimeout(r,18));
      emit('pointerup',x+${deltaX},y+${deltaY});
      await new Promise(r=>setTimeout(r,260));
      return {character:ddChar,selection:String(getSelection()),offset:getComputedStyle(document.querySelector('.character-swipe-zone')).getPropertyValue('--character-swipe-offset')};
   })()`);
}
async function search(query) {
   await evaluate(`(() => { if(activeView!=='search') setView('search'); return launchDictionarySearch(${JSON.stringify(query)}); })()`);
   const response = await waitFor(async () => {
      const result = await evaluate(`srch.search && srch.search.query.display === ${JSON.stringify(query)} ? ({
         results: srch.search.results.map((item) => ({
            id:item.entry.id, hz:item.entry.simplified, traditional:item.entry.traditional,
            pinyin:(item.entry.pinyin||[]).map((p)=>p.numbered), fr:item.entry.definitionsFr,
            en:item.entry.definitionsEn, types:item.entry.visualEntryTypes||[item.entry.entryType],
            group:item.entry.visualGroup||[], hsk:(item.entry.hskVerified||[]).map((h)=>h.firstHskLevel),
            variants:(item.entry.visualVariants||[]).map((variant)=>({id:variant.id,hz:variant.simplified,traditional:variant.traditional,pinyin:(variant.pinyin||[]).map((p)=>p.numbered),fr:variant.definitionsFr,en:variant.definitionsEn})),
            status:typeof dictionaryVariantStatus==='function'?dictionaryVariantStatus(item.entry):''
         })), merged:srch.search.visualDuplicatesMerged||0, grouped:srch.search.visualVariantsGrouped||0, html:document.querySelector('#dresults').textContent
      }) : document.querySelector('.search-empty.error') ? ({error:document.querySelector('.search-empty.error').textContent}) : null`);
      return result;
   }, `search failed: ${query}`);
   if (response.error) throw new Error(`search failed: ${query}: ${response.error}`);
   return response;
}

async function main() {
   server = spawn("python", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore", windowsHide: true });
   await waitFor(async () => (await fetch(url)).ok, "server failed");
   browser = spawn(edge, ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-extensions", "--no-first-run", `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore", windowsHide: true });
   const version = await waitFor(async () => { try { const response = await fetch(`http://127.0.0.1:${debugPort}/json/version`); return response.ok && response.json(); } catch (_) { return false; } }, "browser failed");
   const pages = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
   cdp = await Cdp.connect(pages.find((item) => item.type === "page").webSocketDebuggerUrl);
   await Promise.all([cdp.send("Page.enable"), cdp.send("Runtime.enable")]);
   await navigate();
   await evaluate(`(async()=>{ if(personalDbHandle) personalDbHandle.close(); await new Promise(r=>{const q=indexedDB.deleteDatabase(PERSONAL_DB_NAME);q.onsuccess=q.onerror=q.onblocked=r}); localStorage.clear(); })()`);
   await navigate();

   await evaluate(`(() => {
      const assimil=createPersonalPack('Assimil');
      const lesson1=createPersonalCategory(assimil.id,'Leçon 1');
      const lesson2=createPersonalCategory(assimil.id,'Leçon 2');
      const first=createPersonalPack('Premiers mots');
      createPersonalCategory(first.id,'Leçon 1');
      window.__placement={assimil:assimil.id,lesson1:lesson1.id,lesson2:lesson2.id,first:first.id};
   })()`);
   await evaluate(`(async()=>{window.__cai=await findDictionaryEntryByHanzi('菜');openDictionaryAddToWords(window.__cai)})()`);
   assert(await evaluate("!!document.querySelector('.dd-pack-block') && !!document.querySelector('#dd-add-confirm')"), "placement modal missing");
   await click(`[data-dd-add-category="${await evaluate("window.__placement.lesson1")}"]`);
   await click("#dd-add-confirm");
   let placement = await evaluate(`(() => {const cards=db.cards.filter(c=>c.hz==='菜'),card=cards[0];card.lvl=4;card.due=1900000000000;card.reviewHistory=[{grade:'good'}];save();return {cards:cards.length,memberships:categoriesForCard(card.id).map(c=>c.id),id:card.id}})()`);
   assert(placement.cards === 1 && placement.memberships.length === 1, "菜 was not placed in Assimil / Leçon 1");
   pass("菜 ajouté directement dans Assimil → Leçon 1");

   await evaluate("openDictionaryAddToWords(window.__cai)");
   assert((await evaluate("document.querySelector('#sheet').textContent")).includes("Déjà dans Mes mots"), "existing-card state absent");
   await click(`[data-dd-add-category="${await evaluate("window.__placement.lesson2")}"]`);
   await click("#dd-add-confirm");
   placement = await evaluate(`(() => {const cards=db.cards.filter(c=>c.hz==='菜'),card=cards[0];return {cards:cards.length,memberships:categoriesForCard(card.id).length,id:card.id,lvl:card.lvl,due:card.due,history:card.reviewHistory.length}})()`);
   assert(placement.cards === 1 && placement.memberships === 2 && placement.id && placement.lvl === 4 && placement.due === 1900000000000 && placement.history === 1, "unique card/SRS/multi-membership failed");
   pass("une carte, deux memberships, une progression SRS");

   await evaluate("openDictionaryAddToWords(window.__cai)");
   await click(`[data-dd-add-category="${await evaluate("window.__placement.lesson1")}"]`);
   await click("#dd-add-confirm");
   placement = await evaluate(`(() => {const card=db.cards.find(c=>c.hz==='菜');return {cards:db.cards.filter(c=>c.hz==='菜').length,memberships:categoriesForCard(card.id).map(c=>c.name),lvl:card.lvl}})()`);
   assert(placement.cards === 1 && placement.memberships.length === 1 && placement.memberships[0] === "Leçon 2" && placement.lvl === 4, "membership removal damaged card");
   pass("retrait d’une membership sans suppression de carte");

   await evaluate("openDictionaryAddToWords(window.__cai)");
   await evaluate("document.querySelector('#dd-add-pack-name').value='Cours express'");
   const oldPackButton = await evaluate("document.querySelector('#dd-add-pack-create').outerHTML");
   assert(oldPackButton.includes("Créer le pack"), "quick pack creation absent");
   await evaluate("(() => { const button=document.querySelector('#dd-add-pack-create'); button.click(); button.click(); })()");
   const newPack = await evaluate("db.packs.find(p=>p.name==='Cours express')?.id");
   assert(newPack && await evaluate(`db.packs.filter(p=>p.name==='Cours express').length===1 && document.querySelector('[data-dd-add-pack="${newPack}"]').checked`), "new pack not selected or double-click duplicated it");
   await evaluate(`document.querySelector('[data-dd-category-name="${newPack}"]').value='Leçon rapide'`);
   await click(`[data-dd-category-create="${newPack}"]`);
   const rapid = await evaluate(`categoriesForPack('${newPack}').find(c=>c.name==='Leçon rapide')?.id`);
   assert(rapid && await evaluate(`document.querySelector('[data-dd-add-category="${rapid}"]').checked`), "new category not selected");
   const duplicateCount = await evaluate(`(() => {const input=document.querySelector('[data-dd-category-name="${newPack}"]');input.value='Leçon rapide';document.querySelector('[data-dd-category-create="${newPack}"]').click();return categoriesForPack('${newPack}').filter(c=>c.name==='Leçon rapide').length})()`);
   assert(duplicateCount === 1, "duplicate subcategory created");
   await click("#dd-add-cancel");
   pass("création rapide de pack/sous-catégorie, sélection automatique et doublon bloqué");

   const beforeCancel = await evaluate("JSON.stringify({cards:db.cards,memberships:db.memberships})");
   await evaluate(`(async()=>{window.__menu=await findDictionaryEntryByHanzi('菜单');openDictionaryAddToWords(window.__menu)})()`);
   await click(`[data-dd-add-category="${rapid}"]`);
   await click("#dd-add-cancel");
   assert(beforeCancel === await evaluate("JSON.stringify({cards:db.cards,memberships:db.memberships})"), "cancel mutated card/memberships");
   pass("annulation sans changement de carte ou membership");

   await evaluate("openDictionaryAddToWords(window.__cai)");
   await click(`[data-dd-add-pack="${newPack}"]`);
   assert((await evaluate("document.querySelector('#sheet').textContent")).includes("Ajouter sans sous-catégorie"), "explicit no-category decision absent");
   const beforeUndecided = await evaluate("db.memberships.length");
   await click("#dd-add-confirm");
   assert(await evaluate("sheetOpen() && !document.querySelector('#dd-placement-error').hidden") && beforeUndecided === await evaluate("db.memberships.length"), "undecided pack was silently accepted");
   await click(`[data-dd-without-category="${newPack}"]`);
   await click("#dd-add-confirm");
   assert(await evaluate(`categoriesForCard(db.cards.find(c=>c.hz==='菜').id).some(c=>c.packId==='${newPack}'&&c.name==='Tous les mots')`), "explicit no-category placement failed");
   await evaluate(`(async()=>{window.__tea=await findDictionaryEntryByHanzi('茶');openDictionaryAddToWords(window.__tea)})()`);
   assert(await evaluate(`document.querySelector('[data-dd-add-category="'+categoriesForPack('${newPack}').find(c=>c.name==='Tous les mots').id+'"]').checked`), "last placement was not remembered");
   await click("#dd-add-cancel");
   pass("ajout explicite sans sous-catégorie et dernière sélection mémorisée sans ajout automatique");

   const face = await search("面");
   assert(face.results[0].id === "word-453e719c9edd4078aac555e3", `wrong 面 primary: ${JSON.stringify(face.results.slice(0,4))}`);
   assert(face.results[0].hsk.includes(2) && face.results[0].hsk.includes(5), "distinct HSK senses missing");
   assert(face.results[0].group.length === 2 && face.merged >= 1, "character/word visual duplicate not merged");
   assert(!face.results[0].en.some((value) => /^flour$/i.test(value)), "flour incorrectly became the main 面 definition");
   assert(face.html.includes("Traduction française indisponible") && face.html.includes("Sens anglais de référence"), "French/English fallback labeling unclear");
   assert(face.results[0].variants.some((item) => item.traditional === "麵") && face.results[0].variants.some((item) => item.traditional === "麪") && face.grouped >= 2, "traditional variants were not grouped under the modern entry");
   assert(await evaluate("document.querySelectorAll('.dict-result:first-of-type .dict-result-meta .b').length <= 2 && !document.querySelector('.dict-result:first-of-type .dict-result-meta').textContent.includes('mot + caractère')"), "result badges are not compact");
   assert(await evaluate("document.querySelector('.dict-result:first-of-type .dict-result-variants:not([open])')?.textContent.includes('2 variantes traditionnelles')"), "variant disclosure is not collapsed or clear");
   assert(await evaluate("[...document.querySelectorAll('.dict-result-meta')].every((meta)=>meta.querySelectorAll('.b').length<=3)"), "a result exceeds the badge limit");
   const cachedFace = await search("面");
   assert(cachedFace.results[0].variants.length === face.results[0].variants.length, "cached search lost its visual variant group");
   pass("面 : mot moderne prioritaire, sens HSK distincts, variante reléguée, doublon fusionné");

   await evaluate("openSearchDictionaryDetail(srch.search.results[0].entry, false)");
   const detail = await waitFor(async () => {
      const value = await evaluate(`document.querySelector('#dd-related')?.getAttribute('aria-busy')==='false' ? ({
         text:document.querySelector('#sheet').textContent,
         englishOpen:document.querySelector('.dd-definitions.english')?.open,
         hsk:document.querySelectorAll('.dd-hsk-source-item').length,
         add:!!document.querySelector('#dd-addcard'),
         order:(()=>{const selectors=['.dd-definitions:not(.english)','.dd-hsk-source','.dd-card-actions','.dd-character-interaction','.dd-definitions.english','.dd-sources','#dd-related'];return selectors.map((selector)=>[...document.querySelector('.dd-entry').children].indexOf(document.querySelector(selector)));})(),
         englishHeight:document.querySelector('.dd-definitions.english')?.getBoundingClientRect().height
      }) : null`);
      return value;
   }, "detail/related words failed");
   for (const word of ["面粉", "面条", "方面", "见面"]) assert(detail.text.includes(word), `related word missing: ${word}`);
   assert(detail.englishOpen === false && detail.englishHeight <= 48 && detail.hsk === 2 && detail.add && detail.order.every((position,index,values)=>index===0||position>values[index-1]), "detail sections/actions are unclear");
   await click("#dd-close");
   pass("fiche détaillée structurée, anglais replié, deux sens HSK et mots associés issus des données");

   const flour = await search("面粉");
   const noodles = await search("面条");
   const bread = await search("面包");
   assert(flour.results[0].fr.includes("farine") && noodles.results[0].fr.includes("nouilles"), "verified French compound definitions missing");
   assert(bread.results.length && bread.results[0].hz === "面包" && !bread.results[0].variants.length, "variant grouping altered the distinct modern word 面包");
   const marked = await search("miàn");
   const numbered = await search("mian4");
   assert(marked.results[0].pinyin.includes("mian4") && numbered.results[0].pinyin.includes("mian4"), "toned/numbered exact pinyin ranking failed");
   assert(marked.grouped >= 2 && numbered.grouped >= 2 && marked.results.some((item)=>item.variants.length >= 2) && numbered.results.some((item)=>item.variants.length >= 2), `pinyin variant grouping failed: ${JSON.stringify({marked:marked.results.slice(0,8),numbered:numbered.results.slice(0,8),markedGrouped:marked.grouped,numberedGrouped:numbered.grouped})}`);
   pass("面粉, 面条, miàn et mian4 correctement retrouvés et classés");

   const homograph = await search("行");
   const pronunciations = new Set(homograph.results.filter((item)=>item.hz==='行').flatMap((item)=>item.pinyin));
   assert([...pronunciations].some((p)=>p.startsWith('xing2')) && [...pronunciations].some((p)=>p.startsWith('hang2')), "homograph pronunciations were merged");
   const traditional = await search("麵");
   assert(traditional.results.some((item)=>item.hz==='麵'||item.traditional==='麵') && traditional.results[0].traditional === "麵", "exact traditional query did not keep 麵 at the first level");
   await click("#dresults .dict-result-primary");
   await waitFor(() => evaluate("document.querySelector('.dd-entry .cd-hz')?.textContent.trim()==='麵'"), "exact 麵 detail did not preserve the chosen form");
   const variantDetailFrench = await evaluate("[...document.querySelectorAll('.dd-definitions:not(.english) li')].map((item)=>item.textContent.trim()).join(' ; ')");
   await click("#dd-addcard");
   const variantPlacement = await evaluate("({hanzi:document.querySelector('.dd-add-word > b')?.textContent.trim(),identity:document.querySelector('.dd-add-word small')?.textContent||'',definition:document.querySelector('#dd-add-fr')?.value||''})");
   assert(variantPlacement.hanzi==='麵' && variantPlacement.definition===variantDetailFrench && (variantPlacement.identity.includes('Traditionnel') || variantPlacement.identity.includes('Variante')), `add modal mixed the modern entry with the selected variant: ${JSON.stringify(variantPlacement)}`);
   await click("#dd-add-cancel");
   await click("#dd-close");
   const ordinary = await search("菜");
   assert(!ordinary.results[0].variants.length, "variant grouping created an artificial group for an ordinary word");
   pass("homographes/prononciations distincts et recherche traditionnelle conservés");

   await evaluate("openDictionaryAddToWords(window.__cai)");
   for (const width of [360, 430, 768, 1024, 1440]) {
      await cdp.send("Emulation.setDeviceMetricsOverride", { width, height: 820, deviceScaleFactor: 1, mobile: width <= 430 });
      const layout = await evaluate(`(() => {
         const measure=(selector)=>{const node=document.querySelector(selector),rect=node?.getBoundingClientRect();return node?{client:node.clientWidth,scroll:node.scrollWidth,left:rect.left,right:rect.right,width:rect.width,center:rect.left+rect.width/2}:null};
         return {viewport:innerWidth,root:measure('html'),sheet:measure('#sheet'),card:measure('.sheet-card'),words:measure('.dd-add-words'),actions:measure('.dd-placement-actions'),actionsPosition:getComputedStyle(document.querySelector('.dd-placement-actions')).position,actionsBottom:getComputedStyle(document.querySelector('.dd-placement-actions')).bottom,overflow:document.documentElement.scrollWidth>innerWidth+1,short:[...document.querySelectorAll('#sheet button,#sheet label')].filter(n=>getComputedStyle(n).display!=='none').map(n=>({text:n.textContent.trim().slice(0,24),height:n.getBoundingClientRect().height})).filter(n=>n.height>0&&n.height<43),dialog:document.querySelector('#sheet').getAttribute('role'),modal:document.querySelector('#sheet').getAttribute('aria-modal')};
      })()`);
      console.log(`AUDIT placement ${width}px ${JSON.stringify(layout)}`);
      const exactWidths = [layout.root, layout.sheet, layout.card, layout.words].every((item) => item && item.scroll === item.client);
      const centered = width < 768 || Math.abs(layout.card.center - width / 2) < 0.25;
      assert(!layout.overflow && exactWidths && centered && layout.actionsPosition === "sticky" && layout.actionsBottom === "0px" && !layout.short.length && layout.dialog === "dialog" && layout.modal === "true", `responsive/a11y failed at ${width}: ${JSON.stringify(layout)}`);
   }
   await cdp.send("Emulation.setDeviceMetricsOverride", { width:430, height:820, deviceScaleFactor:1, mobile:true });
   await evaluate("document.querySelector('.dd-placement-actions').scrollIntoView({block:'end'})");
   const placementScreenshot = await cdp.send("Page.captureScreenshot", {format:"png",fromSurface:true});
   await writeFile(visualProofs.placement, Buffer.from(placementScreenshot.data, "base64"));
   await cdp.send("Input.dispatchKeyEvent", { type:"keyDown", key:"Escape", code:"Escape", windowsVirtualKeyCode:27 });
   await cdp.send("Input.dispatchKeyEvent", { type:"keyUp", key:"Escape", code:"Escape", windowsVirtualKeyCode:27 });
   assert(!(await evaluate("sheetOpen()")), "Escape did not close modal");
   pass("360/430/768/1024/1440 px, cibles tactiles, absence de scroll horizontal, dialogue et fermeture clavier");

   await evaluate("ddStrokeTab='animation';openDictDetail(normalizeDetailEntry({hz:'你好',py:'nǐ hǎo',fr:'bonjour'}))");
   await waitFor(() => evaluate("ddChar==='你' && !!document.querySelector('#dd-target svg')"), "long dictionary detail did not load");
   for (const width of [360, 430, 768, 1024, 1440]) {
      await cdp.send("Emulation.setDeviceMetricsOverride", { width, height: 820, deviceScaleFactor: 1, mobile: width <= 430 });
      const detailLayout = await evaluate(`(() => {
         const measure=(selector)=>{const node=document.querySelector(selector),rect=node?.getBoundingClientRect();return node?{client:node.clientWidth,scroll:node.scrollWidth,left:rect.left,right:rect.right,width:rect.width,center:rect.left+rect.width/2,height:rect.height}:null};
         return {viewport:innerWidth,root:measure('html'),sheet:measure('#sheet'),card:measure('.sheet-card'),entry:measure('.dd-entry'),stage:measure('.stroke-character-stage'),overflow:document.documentElement.scrollWidth>innerWidth};
      })()`);
      const exactWidths = [detailLayout.root, detailLayout.sheet, detailLayout.card, detailLayout.entry].every((item)=>item && item.client===item.scroll);
      const centered = width < 768 || Math.abs(detailLayout.card.center-width/2)<0.25;
      assert(exactWidths && centered && !detailLayout.overflow && detailLayout.card.height <= 820-(width>=768?48:0)+1, `detail overflow/centering failed at ${width}: ${JSON.stringify(detailLayout)}`);
   }
   await cdp.send("Emulation.setDeviceMetricsOverride", { width:360, height:820, deviceScaleFactor:1, mobile:true });
   await waitFor(() => evaluate(`(() => {const m=document.querySelector('#stroke-panel-animation .mizi')?.getBoundingClientRect(),p=document.querySelector('#dd-character-prev')?.getBoundingClientRect(),n=document.querySelector('#dd-character-next')?.getBoundingClientRect();return !!m&&!!p&&!!n&&Math.abs(p.top+p.height/2-(m.top+m.height/2))<1&&Math.abs(n.top+n.height/2-(m.top+m.height/2))<1&&Math.abs(m.left-p.right-8)<1&&Math.abs(n.left-m.right-8)<1;})()`), "chevrons did not settle around the animation grid after resize");
   const stage = await evaluate(`(() => {const m=document.querySelector('#stroke-panel-animation .mizi').getBoundingClientRect(),p=document.querySelector('#dd-character-prev').getBoundingClientRect(),n=document.querySelector('#dd-character-next').getBoundingClientRect();return {pair:document.querySelectorAll('#dd-character-prev,#dd-character-next').length,direct:document.querySelector('#dd-character-prev').parentElement.id==='dd-character-stage'&&document.querySelector('#dd-character-next').parentElement.id==='dd-character-stage',sizes:[p.width,p.height,n.width,n.height],vertical:[Math.abs(p.top+p.height/2-(m.top+m.height/2)),Math.abs(n.top+n.height/2-(m.top+m.height/2))],edgeGaps:[m.left-p.right,n.left-m.right],overflow:document.querySelector('.sheet-card').scrollWidth!==document.querySelector('.sheet-card').clientWidth};})()`);
   assert(stage.pair===2 && stage.direct && stage.sizes.every((size)=>size>=44) && stage.vertical.every((gap)=>gap<10) && stage.edgeGaps.every((gap)=>Math.abs(gap-8)<1) && !stage.overflow, `chevrons are not wrapped around the grid: ${JSON.stringify(stage)}`);
   await evaluate("document.querySelector('#dd-character-stage').scrollIntoView({block:'center'})");
   const pagingScreenshot = await cdp.send("Page.captureScreenshot", {format:"png",fromSurface:true});
   await writeFile(visualProofs.paging, Buffer.from(pagingScreenshot.data, "base64"));

   await pointerGesture("#dd-target svg", {deltaX:-38,deltaY:2,pointerType:"touch",pointerId:51});
   assert(await evaluate("ddChar==='好'"), "38px touch swipe on Hanzi Writer did not advance");
   await pointerGesture(".dd-character-study-hanzi", {pointerType:"touch",pointerId:52});
   await pointerGesture(".dd-character-study-hanzi", {deltaX:10,deltaY:1,pointerType:"touch",pointerId:53});
   await pointerGesture(".dd-character-study-hanzi", {deltaX:5,deltaY:90,pointerType:"touch",pointerId:54});
   assert(await evaluate("ddChar==='好'"), "tap, 10px move, or vertical gesture changed character");
   await pointerGesture(".dd-character-study-hanzi", {deltaX:38,deltaY:2,pointerType:"touch",pointerId:55});
   assert(await evaluate("ddChar==='你'"), "38px touch swipe on large character did not return");
   await pointerGesture("#dd-anim", {deltaX:-100,deltaY:1,pointerType:"touch",pointerId:56});
   assert(await evaluate("ddChar==='你'"), "swipe starting on a button navigated");
   await pointerGesture(".dd-character-study-hanzi", {deltaX:38,deltaY:1,pointerType:"touch",pointerId:57});
   assert(await evaluate("ddChar==='你'"), "swipe crossed the first-character boundary");
   await pointerGesture("#dd-target svg", {deltaX:-52,deltaY:1,pointerType:"mouse",pointerId:58});
   assert(await evaluate("ddChar==='好'"), "52px mouse swipe did not advance");
   await pointerGesture("#dd-target svg", {deltaX:40,deltaY:1,pointerType:"pen",pointerId:59});
   assert(await evaluate("ddChar==='你'"), "40px pen swipe did not return");
   await click('[data-stroke-tab="steps"]');
   await waitFor(() => evaluate("document.querySelector('[data-stroke-tab=steps]').getAttribute('aria-selected')==='true' && !!document.querySelector('#dd-gallery')"), "steps mode did not activate");
   await evaluate("if(!document.querySelector('#dd-gallery .stroke-panel')){const panel=document.createElement('button');panel.className='stroke-panel';panel.type='button';panel.textContent='Étape de test';document.querySelector('#dd-gallery').append(panel)}");
   await pointerGesture("#dd-gallery .stroke-panel", {deltaX:-38,deltaY:1,pointerType:"touch",pointerId:60});
   assert(await evaluate("ddChar==='好' && document.querySelector('[data-stroke-tab=steps]').getAttribute('aria-selected')==='true'"), "steps swipe failed or lost its tab");
   await click('[data-stroke-tab="practice"]');
   await pointerGesture("#dd-practice-target", {deltaX:100,deltaY:2,pointerType:"touch",pointerId:61});
   await evaluate("document.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}))");
   await click('#dd-picker .hzchip:first-child');
   assert(await evaluate("ddChar==='好' && [...document.querySelectorAll('#dd-picker .hzchip')].every((button)=>button.disabled)"), "practice allowed swipe, keyboard, or chip navigation");
   await click('#dd-character-prev');
   await waitFor(() => evaluate("ddChar==='你' && ddWriterTarget?.id==='dd-practice-target'"), "practice chevron did not remain available");
   assert(await evaluate("document.querySelectorAll('#dd-target svg,#dd-practice-target svg').length===1"), "rapid paging left an obsolete writer instance");
   await click('#dd-close');
   assert(!(await evaluate("sheetOpen()")), "long detail did not close");
   pass("fiche longue mesurée sur cinq largeurs, chevrons autour de la grille et Pointer Events touch/pen/mouse validés");

   async function assertStrokeNavigationLayout(stageSelector, width, tab, screenshotPath) {
      await cdp.send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width <= 430 });
      await click(`[data-stroke-tab="${tab}"]`);
      if (tab === "steps")
         await waitFor(() => evaluate("document.querySelectorAll('#dd-gallery .stroke-panel').length > 0"), "stroke gallery did not render");
      await waitFor(() => evaluate(`document.querySelector(${JSON.stringify(stageSelector)})?.classList.contains('is-navigation-positioned')`), "stroke navigation was not measured");
      const layout = await evaluate(`(() => {
         const stage=document.querySelector(${JSON.stringify(stageSelector)}),previous=stage?.querySelector(':scope > .character-nav-previous'),next=stage?.querySelector(':scope > .character-nav-next');
         const panel=document.querySelector('.stroke-tab-panel:not([hidden])'),visual=panel?.querySelector('.mizi') || panel?.querySelector('.stroke-gallery');
         if(!stage||!previous||!next||!visual)return null;
         const s=stage.getBoundingClientRect(),p=previous.getBoundingClientRect(),n=next.getBoundingClientRect(),v=visual.getBoundingClientRect(),style=getComputedStyle(stage),previousStyle=getComputedStyle(previous),nextStyle=getComputedStyle(next);
         return {stagePosition:style.position,positions:[previousStyle.position,nextStyle.position],visibility:[previousStyle.visibility,nextStyle.visibility],variables:['--nav-center-y','--nav-left','--nav-right'].map((property)=>style.getPropertyValue(property).trim()),vertical:[Math.abs(p.top+p.height/2-(v.top+v.height/2)),Math.abs(n.top+n.height/2-(v.top+v.height/2))],edgeGaps:[Math.abs(p.right-v.left),Math.abs(n.left-v.right)],ordered:p.left<v.left&&n.right>v.right,buttonsInViewport:p.left>=0&&n.right<=innerWidth,inside:s.left>=0&&s.right<=innerWidth,overflow:document.documentElement.scrollWidth>innerWidth};
      })()`);
      assert(layout && layout.stagePosition === "relative" && layout.positions.every((position) => position === "absolute") && layout.visibility.every((value) => value === "visible") && layout.variables.every(Boolean) && layout.vertical.every((gap) => gap < 1) && layout.edgeGaps.every((gap) => Math.abs(gap - 8) < 1) && layout.ordered && layout.buttonsInViewport && layout.inside && !layout.overflow, `${stageSelector} ${tab} layout failed at ${width}px: ${JSON.stringify(layout)}`);
      if (screenshotPath) await captureStrokeNavigation(stageSelector, screenshotPath);
   }

   await evaluate("ddStrokeTab='animation';openDictDetail(normalizeDetailEntry({hz:'\u4f60\u597d',py:'ni hao',fr:'bonjour'}))");
   await waitFor(() => evaluate("ddChar==='\u4f60' && !!document.querySelector('#dd-target svg')"), "dictionary layout detail did not load");
   for (const width of [360, 1440])
      for (const tab of ["animation", "steps", "practice"])
         await assertStrokeNavigationLayout(
            "#dd-character-stage",
            width,
            tab,
            visualProofs[`dictionaryStroke${tab === "animation" ? "" : tab[0].toUpperCase() + tab.slice(1)}${width}`],
         );
   await click('#dd-close');

   await evaluate("ddStrokeTab='animation';openSequence(Array.from('\u9762\u5305'))");
   await waitFor(() => evaluate("seq?.chars.join('')==='\u9762\u5305' && ddChar==='\u9762' && !!document.querySelector('#dd-target svg')"), "mianbao sequence did not load");
   for (const width of [360, 1440])
      for (const tab of ["animation", "steps", "practice"])
         await assertStrokeNavigationLayout(
            "#seq-stage",
            width,
            tab,
            visualProofs[`sequenceStroke${tab === "animation" ? "" : tab[0].toUpperCase() + tab.slice(1)}${width}`],
         );
   await evaluate("closeSequence({fromHistory:true})");

   await evaluate("ddStrokeTab='animation';openDictDetail(normalizeDetailEntry({hz:'\u9762',py:'mian',fr:'face'}))");
   await waitFor(() => evaluate("ddChar==='\u9762' && !!document.querySelector('#dd-target svg')"), "single-character detail did not load");
   const singleCharacterLayout = await evaluate(`(() => {const stage=document.querySelector('#dd-character-stage'),mizi=stage.querySelector('.mizi'),s=stage.getBoundingClientRect(),m=mizi.getBoundingClientRect();return {buttons:stage.querySelectorAll(':scope > .character-nav-button').length,inside:m.left>=s.left&&m.right<=s.right,overflow:document.documentElement.scrollWidth>innerWidth};})()`);
   assert(singleCharacterLayout.buttons === 0 && singleCharacterLayout.inside && !singleCharacterLayout.overflow, `single-character layout failed: ${JSON.stringify(singleCharacterLayout)}`);
   await click('#dd-close');
   pass("stroke navigation in all tabs at 360/1440 px, dictionary, mianbao sequence, and single character");

   assert(!cdp.errors.length, "runtime errors: " + cdp.errors.join(" | "));
   console.log(`RESULT ${version.Browser} — placement et dictionnaire validés · captures ${Object.values(visualProofs).join(" · ")}`);
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
