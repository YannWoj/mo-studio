"use strict";

import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = 8016;
const debugPort = 9349;
const url = `http://127.0.0.1:${port}/`;
const edge = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const profile = await mkdtemp(path.join(os.tmpdir(), "mo-dictionary-placement-"));
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
async function search(query) {
   await evaluate(`(() => { if(activeView!=='search') setView('search'); return launchDictionarySearch(${JSON.stringify(query)}); })()`);
   const response = await waitFor(async () => {
      const result = await evaluate(`srch.search && srch.search.query.display === ${JSON.stringify(query)} ? ({
         results: srch.search.results.map((item) => ({
            id:item.entry.id, hz:item.entry.simplified, traditional:item.entry.traditional,
            pinyin:(item.entry.pinyin||[]).map((p)=>p.numbered), fr:item.entry.definitionsFr,
            en:item.entry.definitionsEn, types:item.entry.visualEntryTypes||[item.entry.entryType],
            group:item.entry.visualGroup||[], hsk:(item.entry.hskVerified||[]).map((h)=>h.firstHskLevel),
            status:typeof dictionaryVariantStatus==='function'?dictionaryVariantStatus(item.entry):''
         })), merged:srch.search.visualDuplicatesMerged||0, html:document.querySelector('#dresults').textContent
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
   assert(face.results.some((item) => item.traditional === "麵" && item.status !== "modern"), "traditional script collision not explained");
   pass("面 : mot moderne prioritaire, sens HSK distincts, variante reléguée, doublon fusionné");

   await evaluate("openSearchDictionaryDetail(srch.search.results[0].entry, false)");
   const detail = await waitFor(async () => {
      const value = await evaluate(`document.querySelector('#dd-related')?.getAttribute('aria-busy')==='false' ? ({
         text:document.querySelector('#sheet').textContent,
         englishOpen:document.querySelector('.dd-definitions.english')?.open,
         hsk:document.querySelectorAll('.dd-hsk-source-item').length,
         add:!!document.querySelector('#dd-addcard')
      }) : null`);
      return value;
   }, "detail/related words failed");
   for (const word of ["面粉", "面条", "方面", "见面"]) assert(detail.text.includes(word), `related word missing: ${word}`);
   assert(detail.englishOpen === false && detail.hsk === 2 && detail.add, "detail sections/actions are unclear");
   await click("#dd-close");
   pass("fiche détaillée structurée, anglais replié, deux sens HSK et mots associés issus des données");

   const flour = await search("面粉");
   const noodles = await search("面条");
   assert(flour.results[0].fr.includes("farine") && noodles.results[0].fr.includes("nouilles"), "verified French compound definitions missing");
   const marked = await search("miàn");
   const numbered = await search("mian4");
   assert(marked.results[0].pinyin.includes("mian4") && numbered.results[0].pinyin.includes("mian4"), "toned/numbered exact pinyin ranking failed");
   pass("面粉, 面条, miàn et mian4 correctement retrouvés et classés");

   const homograph = await search("行");
   const pronunciations = new Set(homograph.results.filter((item)=>item.hz==='行').flatMap((item)=>item.pinyin));
   assert([...pronunciations].some((p)=>p.startsWith('xing2')) && [...pronunciations].some((p)=>p.startsWith('hang2')), "homograph pronunciations were merged");
   const traditional = await search("麵");
   assert(traditional.results.some((item)=>item.hz==='麵'||item.traditional==='麵'), "traditional query missing");
   pass("homographes/prononciations distincts et recherche traditionnelle conservés");

   await evaluate("openDictionaryAddToWords(window.__cai)");
   for (const width of [360, 430, 1024]) {
      await cdp.send("Emulation.setDeviceMetricsOverride", { width, height: 820, deviceScaleFactor: 1, mobile: width <= 430 });
      const layout = await evaluate(`({overflow:document.documentElement.scrollWidth>innerWidth+1,short:[...document.querySelectorAll('#sheet button,#sheet label')].filter(n=>getComputedStyle(n).display!=='none').map(n=>({text:n.textContent.trim().slice(0,24),height:n.getBoundingClientRect().height})).filter(n=>n.height>0&&n.height<43),dialog:document.querySelector('#sheet').getAttribute('role'),modal:document.querySelector('#sheet').getAttribute('aria-modal')})`);
      assert(!layout.overflow && !layout.short.length && layout.dialog === "dialog" && layout.modal === "true", `responsive/a11y failed at ${width}: ${JSON.stringify(layout)}`);
   }
   await cdp.send("Input.dispatchKeyEvent", { type:"keyDown", key:"Escape", code:"Escape", windowsVirtualKeyCode:27 });
   await cdp.send("Input.dispatchKeyEvent", { type:"keyUp", key:"Escape", code:"Escape", windowsVirtualKeyCode:27 });
   assert(!(await evaluate("sheetOpen()")), "Escape did not close modal");
   pass("360/430/1024 px, cibles tactiles, absence de scroll horizontal, dialogue et fermeture clavier");

   assert(!cdp.errors.length, "runtime errors: " + cdp.errors.join(" | "));
   console.log(`RESULT ${version.Browser} — placement et dictionnaire validés`);
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
