import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = 8011;
const debugPort = 9344;
const url = `http://127.0.0.1:${port}/`;
const edge = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const profile = await mkdtemp(path.join(os.tmpdir(), "mo-packs-test-"));
const cardDetailScreenshots = {
   mobile: path.join(os.tmpdir(), "mo-library-card-detail-390.png"),
   actions: path.join(os.tmpdir(), "mo-library-stroke-actions-390.png"),
   desktop: path.join(os.tmpdir(), "mo-library-card-detail-1024.png"),
};
const importPreviewScreenshots = {
   mobile: path.join(os.tmpdir(), "mo-pack-import-preview-390.png"),
   unknownMobile: path.join(os.tmpdir(), "mo-pack-import-preview-unknown-390.png"),
   desktop: path.join(os.tmpdir(), "mo-pack-import-preview-1024.png"),
};
const cardCreationScreenshots = {
   mobile: path.join(os.tmpdir(), "mo-card-dictionary-search-390.png"),
   desktop: path.join(os.tmpdir(), "mo-card-dictionary-selection-1024.png"),
};
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

   const dictionarySenseCheck = await evaluate(`(async () => {
      const what = await dictionaryCompletion("\\u4ec0\\u4e48");
      const want = await dictionaryCompletion("\\u8981");
      const absent = await dictionaryCompletion("\\u9fa5\\u9fa5");
      const imported = await buildPackImportPreview(parsePackJson(JSON.stringify({version:1,pack:{name:"Sens",categories:[{name:"A",words:[{chinese:"\\u4ec0\\u4e48"}]}]}})), "json");
      const old = {hz:"\\u4ec0\\u4e48",py:what && what.pinyin,fr:"que"};
      const enriched = {hz:"\\u4ec0\\u4e48",py:what && what.pinyin,fr:what && what.translation};
      const draft = dictionaryEntryCardDraft(await loadDictionaryEntryById(what.dictionaryId));
      return {what, want, absent, draft:draft.fr, imported:imported.packs[0].categories[0].words[0].translation, equivalent:personalCardEquivalent(old,enriched)};
   })()`);
   assert(dictionarySenseCheck.what && dictionarySenseCheck.what.translation.split(";").length===6, `dictionary completion lost 什么 senses: ${JSON.stringify(dictionarySenseCheck.what)}`);
   assert(dictionarySenseCheck.draft.split(";").length===6, "card draft did not preview every dictionary sense");
   assert(dictionarySenseCheck.want && dictionarySenseCheck.want.translation.split(";").length===12, `dictionary completion did not keep the 12-sense limit: ${JSON.stringify(dictionarySenseCheck.want)}`);
   assert(dictionarySenseCheck.absent===null, "missing dictionary completion changed behavior");
   assert(dictionarySenseCheck.imported.split(";").length===6 && dictionarySenseCheck.equivalent, "import completion or enriched-card deduplication failed");
   pass("complétions dictionnaire: tous les sens, limite, absence et ancienne traduction abrégée");

   const addWordCategoryId = await evaluate("categoriesForPack(db.packs[0].id).find((category)=>category.name==='Chapitre 2').id");
   await cdp.send("Emulation.setDeviceMetricsOverride", {width:390,height:844,deviceScaleFactor:1,mobile:true});
   await evaluate(`setView('lib');lib.level='category';lib.packId=db.packs[0].id;lib.categoryId=${JSON.stringify(addWordCategoryId)};lib.q='';renderLib()`);
   await click('#word-add');
   assert(await evaluate("!!document.querySelector('#word-dictionary-query')&&!document.querySelector('#word-hz')&&document.querySelector('#word-manual-start').textContent.includes('créer à la main')"), "new card did not open on dictionary search");
   const searchInCardForm = async (query, expectedText) => {
      await evaluate(`(() => {const input=document.querySelector('#word-dictionary-query');input.value=${JSON.stringify(query)};input.dispatchEvent(new Event('input',{bubbles:true}))})()`);
      await waitFor(() => evaluate(`!document.querySelector('#word-dictionary-suggestions').hidden&&document.querySelector('#word-dictionary-suggestions').textContent.includes(${JSON.stringify(expectedText)})`), `card-form search failed for ${query}`);
   };
   await searchInCardForm('面','面');
   await evaluate("document.querySelector('#word-dictionary-query').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}))");
   assert(await evaluate("document.querySelector('#word-dictionary-suggestions [aria-selected=true]')?.dataset.suggestionIndex==='0'&&document.querySelector('#word-dictionary-query').getAttribute('aria-activedescendant')==='word-dictionary-option-0'"), "shared suggestion keyboard navigation failed in card form");
   await searchInCardForm('mian4','面');
   await searchInCardForm('bonjour','你好');
   await evaluate("document.querySelector('.word-dictionary-search').scrollIntoView({block:'start'})");
   const cardSearchImage = await cdp.send("Page.captureScreenshot",{format:"png",fromSurface:true});
   await writeFile(cardCreationScreenshots.mobile,Buffer.from(cardSearchImage.data,"base64"));
   await searchInCardForm('面','面');
   await click('#word-dictionary-suggestions [data-suggestion-index="0"]');
   await waitFor(()=>evaluate("!!document.querySelector('#word-hz')"),"dictionary selection did not open the editable card form");
   const selectedDictionaryWord = await evaluate(`(() => ({hz:document.querySelector('#word-hz').value,py:document.querySelector('#word-py').value,fr:document.querySelector('#word-fr').value,choice:document.querySelector('.word-dictionary-choice').textContent,currentCategory:document.querySelector('[data-card-category=${addWordCategoryId}]').checked,sourceButton:document.querySelector('#word-save').textContent,searchAbsent:!document.querySelector('#word-dictionary-query')}))()`);
   assert(selectedDictionaryWord.hz==='面'&&selectedDictionaryWord.py.includes('miàn')&&selectedDictionaryWord.fr&&selectedDictionaryWord.choice.includes('面')&&selectedDictionaryWord.choice.includes('Changer de mot')&&selectedDictionaryWord.currentCategory&&selectedDictionaryWord.sourceButton==='Enregistrer'&&selectedDictionaryWord.searchAbsent, `dictionary selection did not prefill card fields/category: ${JSON.stringify(selectedDictionaryWord)}`);
   await cdp.send("Emulation.setDeviceMetricsOverride",{width:1024,height:900,deviceScaleFactor:1,mobile:false});
   const selectedDesktopImage=await cdp.send("Page.captureScreenshot",{format:"png",fromSurface:true});
   await writeFile(cardCreationScreenshots.desktop,Buffer.from(selectedDesktopImage.data,"base64"));
   await evaluate("document.querySelector('#word-note').value='Note choisie';document.querySelector('#word-tags').value='dictionnaire, test'");
   await click('#word-save');
   const firstDictionarySave = await evaluate(`(() => {const card=db.cards.find((item)=>item.hz==='面');return {id:card?.id,source:card?.dictionaryEntryId,note:card?.note,tags:card?.tags,membership:db.memberships.some((membership)=>membership.cardId===card?.id&&membership.categoryId===${JSON.stringify(addWordCategoryId)})};})()`);
   assert(firstDictionarySave.id&&/^(word-|char-)/.test(firstDictionarySave.source)&&firstDictionarySave.note==='Note choisie'&&firstDictionarySave.tags.includes('dictionnaire')&&firstDictionarySave.membership, `dictionary card was not linked/saved in current category: ${JSON.stringify(firstDictionarySave)}`);

   await click('#word-add');
   await searchInCardForm('面','Déjà dans Mes mots');
   assert(await evaluate("document.querySelector('.dictionary-suggestion-personal')?.textContent==='Déjà dans Mes mots'"), "existing personal word badge missing from suggestions");
   await click('#word-dictionary-suggestions [data-suggestion-index="0"]');
   await waitFor(()=>evaluate("!!document.querySelector('#word-save')"),"existing dictionary selection did not open the placement form");
   assert(await evaluate(`document.querySelector('.word-dictionary-existing')?.textContent==='Déjà dans Mes mots'&&document.querySelector('#word-save').textContent==='Ranger le mot'&&document.querySelector('[data-card-category="${addWordCategoryId}"]').checked`), "selected existing word did not explain placement-only reuse");
   const cardCountBeforeReuse=await evaluate("db.cards.length");
   await click('#word-save');
   assert((await evaluate("db.cards.length"))===cardCountBeforeReuse,"selecting an existing dictionary word created a duplicate");

   await click('#word-add');
   await searchInCardForm('䨻䨻','Aucun résultat');
   await click('#word-manual-empty');
   assert(await evaluate(`document.querySelector('#word-hz').value==='䨻䨻'&&document.querySelector('[data-card-category=${addWordCategoryId}]').checked&&!!document.querySelector('#word-back-dictionary')`), "unknown Hanzi did not enter manual creation prefilled in the current category");
   await evaluate("document.querySelector('#word-py').value='biáng';document.querySelector('#word-fr').value='caractère rare de test'");
   await click('#word-save');
   const manualCardId=await evaluate("db.cards.find((card)=>card.hz==='䨻䨻').id");

   await evaluate(`lib.level='category';lib.categoryId=${JSON.stringify(addWordCategoryId)};lib.q='';renderLib()`);
   await click(`[data-word-open="${firstDictionarySave.id}"]`);
   await waitFor(()=>evaluate("!!document.querySelector('#card-edit')"),"saved dictionary card detail did not open");
   await click('#card-edit');
   assert(await evaluate("!!document.querySelector('#word-hz')&&!document.querySelector('#word-dictionary-query')&&document.querySelector('.sh-t').textContent==='Modifier le mot'"),"Modifier incorrectly reopened dictionary search");
   await evaluate("document.querySelector('#word-fr').value='visage modifié'");
   await click('#word-save');
   assert(await evaluate(`db.cards.find((card)=>card.id===${JSON.stringify(firstDictionarySave.id)}).fr==='visage modifié'`),"direct card edit no longer saves");
   await evaluate(`(() => {const ids=new Set([${JSON.stringify(firstDictionarySave.id)},${JSON.stringify(manualCardId)}]);db.memberships=db.memberships.filter((membership)=>!ids.has(membership.cardId));db.cards=db.cards.filter((card)=>!ids.has(card.id));save();renderLib();})()`);
   pass(`ajout guidé par dictionnaire hanzi/pinyin/français, catégorie courante, doublon, création manuelle et édition directe · captures ${cardCreationScreenshots.mobile} · ${cardCreationScreenshots.desktop}`);

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

   const detailCategories = await evaluate(`(() => {const pack=db.packs.find((item)=>item.name==='Import JSON'),categories=categoriesForPack(pack.id);return {single:categories.find((item)=>item.name==='Chapitre 1').id,multiple:categories.find((item)=>item.name==='Chapitre 2').id};})()`);
   await evaluate(`(() => {db.cards.filter((item)=>item.hz==='你好'||item.hz==='朋友').forEach((card)=>card.note='Note personnelle');save();})()`);
   await evaluate(`lib.level='category';lib.packId=db.packs.find((item)=>item.name==='Import JSON').id;lib.categoryId=${JSON.stringify(detailCategories.multiple)};lib.q='';lib.flt='all'`);
   await evaluate("setView('lib');renderLib()");
   assert((await evaluate("document.querySelectorAll('[data-word-open]').length")) === 2, "multi-word category did not render two cards");
   await click("[data-word-open]");
   await waitFor(() => evaluate("!!ddCharacterData && !!document.querySelector('#card-stage.is-navigation-positioned')"), "personal card stroke workspace did not load");
   await waitFor(() => evaluate("document.querySelector('.card-detail-strokes .stroke-tab-panel:not([hidden]) .character-composition')?.dataset.character===ddChar"), "personal card composition did not load in the shared stroke workspace");
   const firstDetailId = await evaluate("document.querySelector('.card-detail-sheet').dataset.cardId");
   for (const width of [390, 1024]) {
      await cdp.send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width <= 430 });
      await waitFor(() => evaluate(`(() => {const stage=document.querySelector('#card-stage'),visual=stage?.querySelector('.stroke-tab-panel:not([hidden]) .mizi'),previous=stage?.querySelector(':scope > .character-nav-previous'),next=stage?.querySelector(':scope > .character-nav-next');if(!stage||!visual||!previous||!next)return false;const v=visual.getBoundingClientRect(),p=previous.getBoundingClientRect(),n=next.getBoundingClientRect();return Math.abs(v.left-p.right-8)<1&&Math.abs(n.left-v.right-8)<1&&Math.abs(p.top+p.height/2-v.top-v.height/2)<1;})()`), `card stroke navigation did not settle at ${width}px`);
      const layout = await evaluate(`(() => {const sheet=document.querySelector('.sheet-card'),detail=document.querySelector('.card-detail-sheet'),head=detail.querySelector('.cd-head'),strokes=detail.querySelector('.card-detail-strokes'),chips=detail.querySelector('.acts'),note=detail.querySelector('.note'),membership=[...detail.querySelectorAll('.eyebrow')].find((item)=>item.textContent.trim()==='Présent dans'),buttons=detail.querySelector(':scope > .sh-btns'),square=strokes.querySelector('.mizi'),listen=detail.querySelector('.seal'),close=document.querySelector('#card-close-top'),previous=document.querySelector('#card-prev'),next=document.querySelector('#card-next'),a=listen.getBoundingClientRect(),b=close.getBoundingClientRect(),s=sheet.getBoundingClientRect(),h=head.getBoundingClientRect(),q=square.getBoundingClientRect(),follows=(first,second)=>!!(first.compareDocumentPosition(second)&Node.DOCUMENT_POSITION_FOLLOWING);return {overlap:!(a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top),sizes:[a.width,a.height,b.width,b.height],obsoleteWordButtons:!!document.querySelector('#card-word-prev,#card-word-next'),characterButtons:!!previous&&!!next,characterState:[previous.disabled,next.disabled],wordPosition:document.querySelector('#card-word-position').textContent.trim(),actions:['card-favorite','card-difficult','card-mastered','card-review-one','card-edit','card-delete','card-close','dd-write'].every((id)=>!!document.getElementById(id)),membershipHandlers:[...document.querySelectorAll('[data-card-category]')].every((input)=>typeof input.onchange==='function'),order:follows(head,strokes)&&follows(strokes,chips)&&follows(chips,note)&&follows(note,membership)&&follows(membership,buttons),firstScreen:h.top>=s.top-1&&q.top>=s.top-1&&q.bottom<=Math.min(s.bottom,innerHeight)+1,square:{top:q.top,bottom:q.bottom,size:q.width},viewport:{top:s.top,bottom:Math.min(s.bottom,innerHeight)},scrollTop:sheet.scrollTop,overflow:sheet.scrollWidth>sheet.clientWidth||document.documentElement.scrollWidth>innerWidth};})()`);
      assert(!layout.overlap && layout.sizes.every((size)=>size>=43.9) && !layout.obsoleteWordButtons && layout.characterButtons && layout.characterState[0] && !layout.characterState[1] && /1 \/ 2$/.test(layout.wordPosition) && layout.actions && layout.membershipHandlers && layout.order && (width!==390||layout.firstScreen) && layout.scrollTop===0 && !layout.overflow, `personal card detail layout/actions failed at ${width}px: ${JSON.stringify(layout)}`);
      await evaluate("document.querySelector('.sheet-card').scrollTop=0");
      const screenshot = await cdp.send("Page.captureScreenshot", { format:"png", fromSurface:true });
      await writeFile(width === 390 ? cardDetailScreenshots.mobile : cardDetailScreenshots.desktop, Buffer.from(screenshot.data, "base64"));
      if (width === 390) {
         const actionRect = await evaluate(`(() => {const rect=document.querySelector('.stroke-animation-actions').getBoundingClientRect();return {x:Math.max(0,rect.left-8),y:Math.max(0,rect.top-8),width:Math.min(innerWidth,rect.width+16),height:rect.height+16};})()`);
         const actionScreenshot = await cdp.send("Page.captureScreenshot", { format:"png", fromSurface:true, clip:{...actionRect,scale:1} });
         await writeFile(cardDetailScreenshots.actions, Buffer.from(actionScreenshot.data, "base64"));
      }
   }
   const activeWritingCharacter = await evaluate("ddChar");
   await click("#dd-write");
   await waitFor(() => evaluate("!!document.querySelector('.writing-practice-backdrop')"), "shared writing practice did not open from a personal card");
   assert(await evaluate(`document.querySelector('.writing-practice-dialog').dataset.reviewWritingCharacter===${JSON.stringify(activeWritingCharacter)}&&document.querySelector('#sheet').inert`), "personal-card writing practice did not use the active character or isolate the sheet");
   await click(".writing-practice-close");
   await waitFor(() => evaluate("!document.querySelector('.writing-practice-backdrop')&&sheetOpen()&&!document.querySelector('#sheet').inert"), "personal card was not restored after writing practice");
   const favoriteBefore = await evaluate("db.cards.find((card)=>card.id===document.querySelector('.card-detail-sheet').dataset.cardId).fav");
   await click("#card-favorite");
   await waitFor(() => evaluate(`document.querySelector('.card-detail-sheet')?.dataset.cardId===${JSON.stringify(firstDetailId)}&&!!document.querySelector('#card-stage.is-navigation-positioned')`), "favorite rerender lost the card detail");
   assert((await evaluate("db.cards.find((card)=>card.id===document.querySelector('.card-detail-sheet').dataset.cardId).fav")) !== favoriteBefore && /1 \/ 2$/.test(await evaluate("document.querySelector('#card-word-position').textContent.trim()")) && await evaluate(`(() => {const detail=document.querySelector('.card-detail-sheet'),strokes=detail.querySelector('.card-detail-strokes'),chips=detail.querySelector('.acts');return ddChar===${JSON.stringify(activeWritingCharacter)}&&!!(strokes.compareDocumentPosition(chips)&Node.DOCUMENT_POSITION_FOLLOWING)&&document.querySelector('.sheet-card').scrollTop===0;})()`), "favorite action lost state, order, or list context");
   await click("#card-favorite");
   await waitFor(() => evaluate("!!document.querySelector('#card-stage.is-navigation-positioned')"), "favorite restore did not reload strokes");
   await click("#card-next");
   assert(await evaluate("document.querySelector('#card-position').textContent.trim().endsWith('2 / 2') && !document.querySelector('#card-next').disabled"), "next character stopped at the word boundary");
   await click("#card-next");
   await waitFor(() => evaluate(`document.querySelector('.card-detail-sheet')?.dataset.cardId!==${JSON.stringify(firstDetailId)}&&!!ddCharacterData&&!!document.querySelector('#card-stage.is-navigation-positioned')`), "next word did not load its strokes");
   assert(await evaluate("!document.querySelector('#card-prev').disabled&&document.querySelector('#card-position').textContent.trim().endsWith('1 / 2')&&document.querySelector('#card-word-position').textContent.trim().endsWith('2 / 2')"), "next-word boundary state is wrong");
   await click('[data-stroke-tab="steps"]');
   await waitFor(() => evaluate("document.querySelectorAll('#dd-gallery .stroke-panel').length>0"), "personal card stroke steps did not render");
   await click('[data-stroke-tab="practice"]');
   await waitFor(() => evaluate("ddWriterTarget?.id==='dd-practice-target'||!document.querySelector('#dd-practice-target')?.hidden"), "personal card practice did not initialize");
   await click('[data-stroke-tab="animation"]');
   await waitFor(() => evaluate("ddWriterTarget?.id==='dd-target'"), "personal card animation did not return");
   await click("#card-close-top");
   assert(!(await evaluate("sheetOpen()")), "personal card top close did not close the sheet");

   await evaluate(`(() => {
      const samples = [
         { id:'nav-hello', hz:'\u4f60\u597d', py:'ni hao', fr:'bonjour' },
         { id:'nav-question', hz:'\u4f60\u597d\u5417', py:'ni hao ma', fr:'comment vas-tu' },
         { id:'nav-single', hz:'\u4e2d', py:'zhong', fr:'milieu' },
         { id:'nav-last', hz:'\u9762\u5305', py:'mian bao', fr:'pain' },
      ].map((card) => normalizeCard(card, true));
      db.cards.push(...samples.filter((sample) => !db.cards.some((card) => card.id === sample.id)));
      openCardDetail('nav-hello', { cardIds:samples.map((card) => card.id) });
   })()`);
   await waitFor(() => evaluate("ddChar==='\u4f60' && !!document.querySelector('#card-stage.is-navigation-positioned')"), "continuous card navigation did not start");
   assert(await evaluate(`(() => ({
      word:document.querySelector('#card-word-position').textContent.trim(),
      character:document.querySelector('#card-position').textContent.trim(),
      previous:document.querySelector('#card-prev').disabled,
      next:document.querySelector('#card-next').disabled,
      obsolete:!!document.querySelector('#card-word-prev,#card-word-next'),
   }))()` ).then((state) => state.word.endsWith("1 / 4") && state.character.endsWith("1 / 2") && state.previous && !state.next && !state.obsolete), "continuous navigation initial state is wrong");
   await click("#card-next");
   assert(await evaluate("ddChar==='\u597d' && document.querySelector('#card-position').textContent.trim().endsWith('2 / 2') && !document.querySelector('#card-next').disabled"), "same-word next navigation failed");
   await evaluate("document.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}))");
   await waitFor(() => evaluate("document.querySelector('.card-detail-sheet')?.dataset.cardId==='nav-question' && ddChar==='\u4f60'"), "keyboard next did not cross the word boundary");
   assert(await evaluate("document.querySelector('#card-word-position').textContent.trim().endsWith('2 / 4') && document.querySelector('#card-position').textContent.trim().endsWith('1 / 3')"), "next word did not start on its first character");
   await click("#card-next");
   assert(await evaluate("ddChar==='\u597d' && document.querySelector('#card-position').textContent.trim().endsWith('2 / 3')"), "continuous next sequence is wrong");
   await click("#card-next");
   await click("#card-next");
   await waitFor(() => evaluate("document.querySelector('.card-detail-sheet')?.dataset.cardId==='nav-single' && ddChar==='\u4e2d'"), "single-character word was not reached");
   assert(await evaluate("document.querySelector('#card-position').textContent.trim().endsWith('1 / 1') && !document.querySelector('#card-prev').disabled && !document.querySelector('#card-next').disabled"), "single-character word did not keep continuous navigation available");
   await click("#card-prev");
   await waitFor(() => evaluate("document.querySelector('.card-detail-sheet')?.dataset.cardId==='nav-question' && ddChar==='\u5417'"), "previous word did not open on its last character");
   assert(await evaluate("document.querySelector('#card-position').textContent.trim().endsWith('3 / 3')"), "initialCharacterIndex -1 sentinel failed");
   await click('[data-stroke-tab="practice"]');
   await evaluate("document.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}))");
   assert(await evaluate("ddChar==='\u5417'"), "practice mode keyboard guard regressed in personal cards");
   await click('[data-stroke-tab="animation"]');
   await evaluate("openCardDetail('nav-last',{cardIds:['nav-hello','nav-question','nav-single','nav-last'],initialCharacterIndex:-1})");
   await waitFor(() => evaluate("ddChar==='\u5305' && !!document.querySelector('#card-stage.is-navigation-positioned')"), "last card sentinel did not load");
   assert(await evaluate("document.querySelector('#card-position').textContent.trim().endsWith('2 / 2') && !document.querySelector('#card-prev').disabled && document.querySelector('#card-next').disabled"), "last character/list boundary is wrong");
   await click("#card-close-top");
   await evaluate("db.cards = db.cards.filter((card) => !card.id.startsWith('nav-'))");
   pass("progression continue mot/caractère, clavier, sentinelle -1, mot d’un caractère et bornes");

   await evaluate(`lib.level='category';lib.categoryId=${JSON.stringify(detailCategories.single)};lib.q='';lib.flt='all';renderLib()`);
   assert((await evaluate("document.querySelectorAll('[data-word-open]').length")) === 1, "single-word category did not render one card");
   await click("[data-word-open]");
   await waitFor(() => evaluate("!!document.querySelector('#card-stage.is-navigation-positioned')"), "single-category card strokes did not load");
   assert(await evaluate("!document.querySelector('.card-detail-word-nav')&&!!document.querySelector('#card-close')"), "single-word category rendered word navigation");
   await click("#card-close");
   assert(!(await evaluate("sheetOpen()")), "personal card bottom close did not close the sheet");

   await evaluate(`lib.level='category';lib.categoryId=${JSON.stringify(detailCategories.multiple)};lib.q='ami';lib.flt='all';renderLib()`);
   assert((await evaluate("document.querySelectorAll('[data-word-open]').length")) === 1, "library search did not narrow the detail context");
   await click("[data-word-open]");
   await waitFor(() => evaluate("!!document.querySelector('#card-stage.is-navigation-positioned')"), "filtered card strokes did not load");
   assert(await evaluate("!document.querySelector('.card-detail-word-nav')"), "filtered single result rendered word navigation");
   await click("#card-close-top");
   await evaluate("lib.q='';lib.flt='all'");
   pass(`fiche Mes mots complète, navigation contextualisée, traits et responsive · captures ${cardDetailScreenshots.mobile} · ${cardDetailScreenshots.actions} · ${cardDetailScreenshots.desktop}`);

   const invalidSource = '{\n "pack": [}';
   const invalid = await evaluate(`(() => { try { parsePackJson(${JSON.stringify(invalidSource)}); return ''; } catch(e) { return e.message; } })()`);
   assert(/ligne|JSON invalide/.test(invalid), "invalid JSON location missing");
   const csvResult = await evaluate(`(async () => { const payload=csvToPackPayload('pack,category,chinese,pinyin,translation,notes,tags\\nCSV,Leçon,谢谢,xièxie,merci,,politesse'); const p=await buildPackImportPreview(payload,'csv'); const before=JSON.stringify(db); const result=applyPackImport(p,{mode:'new'}); return {source:p.sourceType, words:p.wordCount, added:result.added, previewWasSafe:before!==JSON.stringify(db)}; })()`);
   assert(csvResult.source === "csv" && csvResult.words === 1 && csvResult.added === 1, "CSV import failed");
   pass("JSON invalide localisé et import CSV");

   await evaluate("setView('lib'); lib.level='packs'; renderLib()");
   await click("#lib-import");
   assert(await evaluate("!!document.querySelector('#pack-file-json') && !!document.querySelector('#pack-file-csv') && !!document.querySelector('#import-paste')"), "import sources missing");
   const pasteJson = JSON.stringify({ version: 1, pack: { name: "Collé", categories: [{ name: "Direct", words: [{ chinese: "你好", pinyin: "nǐ hǎo", translation: "bonjour" }] }] } });
   await cdp.send("Emulation.setDeviceMetricsOverride", { width:390, height:844, deviceScaleFactor:2, mobile:true });
   await evaluate(`document.querySelector('#import-paste').value=${JSON.stringify(pasteJson)}`);
   await click("#import-paste-preview");
   await waitFor(() => evaluate("!!document.querySelector('#import-confirm')"), "pasted JSON preview missing");
   const cleanPreviewUi = await evaluate(`(() => ({
      name:document.querySelector('.import-summary-sentence').textContent,
      legacyStats:!!document.querySelector('.import-stats'),
      problems:document.querySelectorAll('.import-preview-notices p').length,
      chips:document.querySelectorAll('.import-summary-chip').length,
      modes:document.querySelectorAll('[name=import-mode]').length,
      targetHidden:document.querySelector('#import-target-field').hidden,
      replaceHidden:document.querySelector('#import-replace-field').hidden,
      advancedAbsent:!document.querySelector('#import-advanced,#import-skip'),
      unknownAbsent:!document.querySelector('#import-unknown-words')&&document.querySelectorAll('[name=import-missing]').length===0,
      confirm:document.querySelector('#import-confirm').textContent,
      note:document.querySelector('.sh-note').textContent,
      overflow:document.querySelector('.sheet-card').scrollWidth>document.querySelector('.sheet-card').clientWidth||document.documentElement.scrollWidth>innerWidth,
   }))()`);
   assert(cleanPreviewUi.name.includes('1 mot dans « Collé »')&&cleanPreviewUi.name.includes('progression est conservée')&&!cleanPreviewUi.legacyStats&&cleanPreviewUi.problems===0&&cleanPreviewUi.chips>=3&&cleanPreviewUi.modes===2&&cleanPreviewUi.targetHidden&&cleanPreviewUi.replaceHidden&&cleanPreviewUi.advancedAbsent&&cleanPreviewUi.unknownAbsent&&cleanPreviewUi.confirm==='Créer le pack « Collé » (1 mot)'&&cleanPreviewUi.note.includes('Aucune donnée')&&!cleanPreviewUi.overflow, `clean import preview failed: ${JSON.stringify(cleanPreviewUi)}`);
   await click('[name="import-mode"][value="merge"]');
   assert(await evaluate("!document.querySelector('#import-target-field').hidden&&document.querySelector('#import-replace-field').hidden&&document.querySelector('#import-confirm').textContent.includes('Choisir le pack')"), "merge target did not appear progressively or structure choice appeared without a target");
   await click('[name="import-mode"][value="new"]');
   assert(await evaluate("document.querySelector('#import-target-field').hidden&&document.querySelector('#import-replace-field').hidden&&document.querySelector('#import-confirm').textContent==='Créer le pack « Collé » (1 mot)'"), "new mode did not hide merge-only controls");
   await evaluate("document.querySelector('#toast').classList.remove('show');document.querySelector('.sheet-card').scrollTop=0");
   const cleanPreviewImage = await cdp.send("Page.captureScreenshot", { format:"png", fromSurface:true });
   await writeFile(importPreviewScreenshots.mobile, Buffer.from(cleanPreviewImage.data,"base64"));
   await click("#import-confirm");
   await waitFor(() => evaluate("!sheetOpen()&&db.packs.some((pack)=>pack.name==='Collé')"), "clean preview creation did not apply");
   assert(await evaluate("categoriesForPack(db.packs.find((pack)=>pack.name==='Collé').id).some((category)=>category.name==='Direct')&&document.querySelector('#toast').textContent.includes('nouvelle(s) carte(s)')"), "clean UI import changed its result toast or structure");

   const duplicateOnlyJson = JSON.stringify({ version:1, pack:{ name:"Doublons", categories:[{ name:"Répétitions", words:[
      { chinese:"你好", pinyin:"nǐ hǎo", translation:"bonjour" },
      { chinese:"你好", pinyin:"nǐ hǎo", translation:"bonjour" }
   ] }] } });
   await evaluate(`(async()=>{const preview=await buildPackImportPreview(parsePackJson(${JSON.stringify(duplicateOnlyJson)}),'json');openPackImportPreview(preview)})()`);
   await waitFor(() => evaluate("!!document.querySelector('#import-confirm')"), "duplicate-only preview missing");
   const duplicatePreviewUi = await evaluate(`(() => ({
      notices:[...document.querySelectorAll('.import-preview-notices p')].map((item)=>item.textContent),
      unknownAbsent:!document.querySelector('#import-unknown-words'),
      advancedAbsent:!document.querySelector('#import-advanced,#import-skip'),
      confirm:document.querySelector('#import-confirm').textContent,
   }))()`);
   assert(duplicatePreviewUi.notices.length===1&&duplicatePreviewUi.notices[0]==='Le fichier contient 1 doublon : il sera fusionné automatiquement.'&&duplicatePreviewUi.unknownAbsent&&duplicatePreviewUi.advancedAbsent&&duplicatePreviewUi.confirm==='Créer le pack « Doublons » (1 mot)', `duplicate-only preview failed: ${JSON.stringify(duplicatePreviewUi)}`);
   await click("#import-cancel");

   const problematicJson = JSON.stringify({ version:1, pack:{ name:"Ajouts guidés", categories:[{ name:"Cas limites", words:[
      { chinese:"谢谢", pinyin:"xièxie", translation:"merci" },
      { chinese:"谢谢", pinyin:"xièxie", translation:"merci" },
      { chinese:"䨻䨻" }
   ] }] } });
   const mergeTargetId = await evaluate("db.packs.find((pack)=>pack.name==='Livres').id");
   await evaluate(`(async()=>{const preview=await buildPackImportPreview(parsePackJson(${JSON.stringify(problematicJson)}),'json');openPackImportPreview(preview)})()`);
   await waitFor(() => evaluate("!!document.querySelector('#import-confirm')&&!!document.querySelector('#import-unknown-words')"), "problematic preview missing its unknown-word choice");
   const problemMobileUi = await evaluate(`(() => {
      const choices=[...document.querySelectorAll('.import-unknown-choice')];
      return {
         confirm:document.querySelector('#import-confirm').textContent,
         stacked:choices.length===2&&choices[1].getBoundingClientRect().top>choices[0].getBoundingClientRect().bottom,
         touchTargets:choices.every((choice)=>choice.getBoundingClientRect().height>=44),
         overflow:document.querySelector('.sheet-card').scrollWidth>document.querySelector('.sheet-card').clientWidth||document.documentElement.scrollWidth>innerWidth,
      };
   })()`);
   assert(problemMobileUi.confirm==='Créer le pack « Ajouts guidés » (2 mots)'&&problemMobileUi.stacked&&problemMobileUi.touchTargets&&!problemMobileUi.overflow, `problematic mobile preview failed: ${JSON.stringify(problemMobileUi)}`);
   await evaluate("document.querySelector('#toast').classList.remove('show');document.querySelector('.sheet-card').scrollTop=0");
   const problemMobileImage = await cdp.send("Page.captureScreenshot", { format:"png", fromSurface:true });
   await writeFile(importPreviewScreenshots.unknownMobile, Buffer.from(problemMobileImage.data,"base64"));
   await cdp.send("Emulation.setDeviceMetricsOverride", { width:1024, height:900, deviceScaleFactor:1, mobile:false });
   await click('[name="import-mode"][value="merge"]');
   await evaluate(`(() => {const select=document.querySelector('#import-target');select.value=${JSON.stringify(mergeTargetId)};select.dispatchEvent(new Event('change',{bubbles:true}))})()`);
   const problemPreviewUi = await evaluate(`(() => ({
      explanations:[...document.querySelectorAll('.import-preview-notices p')].map((item)=>item.textContent),
      targetVisible:!document.querySelector('#import-target-field').hidden,
      replaceVisible:!document.querySelector('#import-replace-field').hidden,
      structureQuestion:document.querySelector('#import-structure-question').textContent,
      keepHelp:document.querySelector('#import-structure-keep-help').textContent,
      replaceHelp:document.querySelector('#import-structure-replace-help').textContent,
      structureOptions:document.querySelectorAll('[name=import-structure]').length,
      defaultStructure:document.querySelector('[name=import-structure][value=keep]').checked,
      confirm:document.querySelector('#import-confirm').textContent,
      advancedAbsent:!document.querySelector('#import-advanced,#import-skip'),
      unknownText:document.querySelector('#import-unknown-words').textContent,
      unknownExamples:[...document.querySelectorAll('#import-unknown-words strong')].map((item)=>item.textContent),
      radioCount:document.querySelectorAll('[name=import-missing]').length,
      defaultMissing:document.querySelector('[name=import-missing][value=yes]').checked,
      recognizedText:document.querySelector('#import-recognized-count').textContent,
      overflow:document.querySelector('.sheet-card').scrollWidth>document.querySelector('.sheet-card').clientWidth||document.documentElement.scrollWidth>innerWidth,
   }))()`);
   assert(problemPreviewUi.explanations.length===1&&problemPreviewUi.explanations[0].includes('fusionné automatiquement')&&problemPreviewUi.targetVisible&&problemPreviewUi.replaceVisible&&problemPreviewUi.structureQuestion==='Comment ranger ces mots dans « Livres » ?'&&problemPreviewUi.keepHelp.includes('« Chapitre 1 »')&&problemPreviewUi.keepHelp.includes('« Chapitre 30 »')&&problemPreviewUi.keepHelp.includes('« Cas limites »')&&problemPreviewUi.replaceHelp.includes('sont supprimées et remplacées')&&problemPreviewUi.replaceHelp.includes('ne seront plus rangés dans ce pack')&&problemPreviewUi.structureOptions===2&&problemPreviewUi.defaultStructure&&problemPreviewUi.confirm==='Ajouter 2 mots à « Livres »'&&problemPreviewUi.advancedAbsent&&problemPreviewUi.radioCount===2&&problemPreviewUi.defaultMissing&&problemPreviewUi.recognizedText==='Seul le mot reconnu sera importé.'&&problemPreviewUi.unknownText.includes('1 mot du fichier n’est pas dans le dictionnaire')&&problemPreviewUi.unknownExamples.some((line)=>line.includes('䨻䨻'))&&!problemPreviewUi.overflow, `problematic merge preview failed: ${JSON.stringify(problemPreviewUi)}`);
   await click('[name="import-missing"][value="no"]');
   assert(await evaluate("document.querySelector('#import-confirm').textContent==='Ajouter 1 mot à « Livres »'&&document.querySelector('#import-recognized-count').textContent==='Seul le mot reconnu sera importé.'"), "excluding unknown words did not update the merge count");
   await click('[name="import-missing"][value="yes"]');
   assert(await evaluate("document.querySelector('#import-confirm').textContent==='Ajouter 2 mots à « Livres »'"), "restoring unknown words did not restore the merge count");
   await evaluate("document.querySelector('#toast').classList.remove('show');document.querySelector('.sheet-card').scrollTop=0");
   const problemPreviewImage = await cdp.send("Page.captureScreenshot", { format:"png", fromSurface:true });
   await writeFile(importPreviewScreenshots.desktop, Buffer.from(problemPreviewImage.data,"base64"));
   await click("#import-confirm");
   await waitFor(() => evaluate("!sheetOpen()&&categoriesForPack(db.packs.find((pack)=>pack.name==='Livres').id).some((category)=>category.name==='Cas limites')"), "problematic merge preview did not apply");
   assert(await evaluate(`(() => {const pack=db.packs.find((item)=>item.name==='Livres'),category=categoriesForPack(pack.id).find((item)=>item.name==='Cas limites'),words=cardsForCategory(category.id);return words.filter((card)=>card.hz==='谢谢').length===1&&words.some((card)=>card.hz==='䨻䨻'&&card.incomplete);})()`), "merge UI changed duplicate or personal-card import behavior");

   const organizationTargets = await evaluate(`(() => {
      const organized=createPersonalPack('Assimil test','Organisation à remplacer');
      const lesson1=createPersonalCategory(organized.id,'Leçon 1');
      createPersonalCategory(organized.id,'Leçon 2');
      const survivor=normalizeCard({id:'replace-survivor',hz:'旧词',py:'jiù cí',fr:'ancien mot',lvl:4,due:1900000000000,reviewHistory:[{at:1800000000000,grade:'good'}]},true);
      db.cards.push(survivor);addCardMembership(survivor.id,lesson1.id);
      const empty=createPersonalPack('Pack vide','Sans sous-catégorie');save();
      return {organized:organized.id,empty:empty.id,survivor:survivor.id};
   })()`);
   const organizationJson = JSON.stringify({version:1,pack:{name:'Organisation fichier',categories:[
      {name:'Leçon 2',words:[{chinese:'你好',pinyin:'nǐ hǎo',translation:'bonjour'}]},
      {name:'Leçon 3',words:[{chinese:'朋友',pinyin:'péngyou',translation:'ami'}]},
   ]}});
   await evaluate(`(async()=>{const preview=await buildPackImportPreview(parsePackJson(${JSON.stringify(organizationJson)}),'json');openPackImportPreview(preview)})()`);
   await click('[name="import-mode"][value="merge"]');
   await evaluate(`(() => {const select=document.querySelector('#import-target');select.value=${JSON.stringify(organizationTargets.organized)};select.dispatchEvent(new Event('change',{bubbles:true}))})()`);
   for (const width of [390,1024]) {
      await cdp.send("Emulation.setDeviceMetricsOverride", {width,height:900,deviceScaleFactor:1,mobile:width===390});
      const structureLayout = await evaluate(`(() => {const group=document.querySelector('#import-replace-field'),choices=[...document.querySelectorAll('.import-structure-choice')];return {
         visible:!group.hidden,
         question:document.querySelector('#import-structure-question').textContent,
         keep:document.querySelector('#import-structure-keep-help').textContent,
         replace:document.querySelector('#import-structure-replace-help').textContent,
         stacked:choices[1].getBoundingClientRect().top>choices[0].getBoundingClientRect().bottom,
         touchTargets:choices.every((choice)=>choice.querySelector('input').getBoundingClientRect().width>=20&&choice.getBoundingClientRect().height>=44),
         overflow:document.querySelector('.sheet-card').scrollWidth>document.querySelector('.sheet-card').clientWidth||document.documentElement.scrollWidth>innerWidth,
      };})()`);
      assert(structureLayout.visible&&structureLayout.question==='Comment ranger ces mots dans « Assimil test » ?'&&structureLayout.keep.includes('« Leçon 1 »')&&structureLayout.keep.includes('« Leçon 2 »')&&structureLayout.keep.includes('« Leçon 3 »')&&structureLayout.replace.includes('« Leçon 1 »')&&structureLayout.replace.includes('« Leçon 2 »')&&structureLayout.replace.includes('« Leçon 3 »')&&(width!==390||structureLayout.stacked)&&structureLayout.touchTargets&&!structureLayout.overflow, `structure choice layout/text failed at ${width}px: ${JSON.stringify(structureLayout)}`);
   }
   await evaluate(`(() => {const select=document.querySelector('#import-target');select.value=${JSON.stringify(organizationTargets.empty)};select.dispatchEvent(new Event('change',{bubbles:true}))})()`);
   assert(await evaluate("document.querySelector('#import-replace-field').hidden&&document.querySelector('[name=import-structure][value=keep]').checked&&document.querySelector('#import-confirm').textContent==='Ajouter 2 mots à « Pack vide »'"), "empty target displayed a meaningless structure choice");
   await evaluate(`(() => {const select=document.querySelector('#import-target');select.value=${JSON.stringify(organizationTargets.organized)};select.dispatchEvent(new Event('change',{bubbles:true}))})()`);
   assert(await evaluate("!document.querySelector('#import-replace-field').hidden&&document.querySelector('[name=import-structure][value=keep]').checked"), "changing back to an organized target did not restore the safe default");
   await click('[name="import-structure"][value="replace"]');
   const destructiveChoice = await evaluate(`(() => {const button=document.querySelector('#import-confirm'),choice=document.querySelector('.import-structure-choice-danger');return {label:button.textContent,danger:button.classList.contains('danger')&&!button.classList.contains('primary'),choiceColor:getComputedStyle(choice.querySelector('strong')).color,normalColor:getComputedStyle(document.querySelector('.import-structure-choice strong')).color};})()`);
   assert(destructiveChoice.label==='Remplacer l’organisation et ajouter 2 mots'&&destructiveChoice.danger&&destructiveChoice.choiceColor!==destructiveChoice.normalColor, `destructive selection was not reflected visually: ${JSON.stringify(destructiveChoice)}`);
   await click('#import-confirm');
   await waitFor(() => evaluate("!sheetOpen()"), "structure replacement did not close the preview");
   const replacementResult = await evaluate(`(() => {const pack=db.packs.find((item)=>item.id===${JSON.stringify(organizationTargets.organized)}),categoryNames=categoriesForPack(pack.id).map((item)=>item.name),survivor=db.cards.find((item)=>item.id===${JSON.stringify(organizationTargets.survivor)});return {categoryNames,survivor:!!survivor,level:survivor?.lvl,due:survivor?.due,history:survivor?.reviewHistory.length,stillInPack:categoriesForCard(survivor.id).some((category)=>category.packId===pack.id)};})()`);
   assert(replacementResult.categoryNames.length===2&&replacementResult.categoryNames.includes('Leçon 2')&&replacementResult.categoryNames.includes('Leçon 3')&&replacementResult.survivor&&replacementResult.level===4&&replacementResult.due===1900000000000&&replacementResult.history===1&&!replacementResult.stillInPack, `structure replacement did not match its explanation: ${JSON.stringify(replacementResult)}`);
   await evaluate(`(() => {const packIds=new Set([${JSON.stringify(organizationTargets.organized)},${JSON.stringify(organizationTargets.empty)}]),categoryIds=new Set(db.categories.filter((category)=>packIds.has(category.packId)).map((category)=>category.id));db.memberships=db.memberships.filter((membership)=>!categoryIds.has(membership.categoryId));db.categories=db.categories.filter((category)=>!packIds.has(category.packId));db.packs=db.packs.filter((pack)=>!packIds.has(pack.id));db.cards=db.cards.filter((card)=>card.id!==${JSON.stringify(organizationTargets.survivor)});save();})()`);
   pass("choix explicite de rangement, noms réels, cible vide, remplacement destructif et progression conservée");

   await evaluate("openPackImportPreview({packs:[],sourceType:'json',categoryCount:0,wordCount:0,duplicates:0,existing:0,missingDictionary:0,incomplete:0,errors:['Le champ pack est obligatoire.']})");
   assert(await evaluate("document.querySelector('.import-error').firstElementChild.textContent==='Ce fichier ne peut pas être importé tel quel :'&&!document.querySelector('#import-confirm')"), "structural error introduction is unclear");
   await click("#import-cancel");
   pass(`fichiers JSON/CSV, création et fusion guidées, aperçus propre/problématique · captures ${importPreviewScreenshots.mobile} · ${importPreviewScreenshots.unknownMobile} · ${importPreviewScreenshots.desktop}`);

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
      reviewCategoryIds=new Set([cats[0].id]); reviewCategoryPackId=pack.id; reviewSelectionMode='category'; const one=reviewSelectedCards().length;
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
