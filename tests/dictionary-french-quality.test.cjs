"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const generated = path.join(root, "data", "generated", "dictionary");
const readJson = (filename) => JSON.parse(fs.readFileSync(filename, "utf8"));
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const stableWordId = (traditional, simplified, numbered) =>
   "word-" + sha256(JSON.stringify([traditional, simplified, numbered])).slice(0, 24);
const charChunk = (id) => sha256(id).slice(0, 2);
const wordChunk = (id) => id.slice(5, 7);
const entryById = (id) => {
   const key = id.startsWith("word-") ? wordChunk(id) : charChunk(id);
   return readJson(path.join(generated, "entries", `${key}.json`)).entries.find((entry) => entry.id === id);
};
const word = (traditional, simplified, numbered) => entryById(stableWordId(traditional, simplified, numbered));
const character = (hanzi) => entryById(`char-${hanzi}`);
const reading = (hanzi, numbered) =>
   character(hanzi).readings.find((item) => item.pinyin.numbered === numbered);

const manifest = readJson(path.join(generated, "manifest.json"));
const audit = readJson(path.join(generated, "french-audit-report.json"));
const overridesPath = path.join(root, "data", "source", "dictionary-fr-overrides.json");
const overrides = readJson(overridesPath);
const decisionsPath = path.join(root, "data", "source", "dictionary-fr-editorial-decisions.json");
const decisions = readJson(decisionsPath);

assert.equal(manifest.schemaVersion, 5);
assert.equal(manifest.frenchEditorialPolicy.entryCount, 36);
assert.equal(manifest.frenchEditorialPolicy.sha256, sha256(fs.readFileSync(overridesPath)));
assert.equal(manifest.frenchEditorialDecisions.entryCount, 6);
assert.equal(manifest.frenchEditorialDecisions.schemaVersion, 2);
assert.equal(manifest.frenchEditorialDecisions.sha256, sha256(fs.readFileSync(decisionsPath)));
assert.equal(audit.status, "PASS");
assert.deepEqual(audit.criticalIssues, []);
assert.equal(audit.corrections.verifiedOverrideCount, 35);
assert.equal(audit.corrections.changedEntryCount, 36);
assert.equal(audit.quarantine.entryCount, 1);
assert.equal(audit.potentialAnomalies.count, 36);
assert.deepEqual(audit.potentialAnomalies.countsByType, {
   "english-fragment": 33,
   "german-fragment": 3,
});
assert.equal(audit.englishWithoutVerifiedFrench.count, audit.englishWithoutVerifiedFrench.items.length);
assert.equal(audit.coverage.overallWordsBeforePolicy.covered, 60424);
assert.equal(audit.coverage.overallWordsAfterPolicy.covered, 60441);
assert.deepEqual(audit.characterFrenchAttachment.allCharacters, {
   total: 14426,
   withFrenchBefore: 8371,
   withoutFrenchBefore: 6055,
   recoveredByExplicitSimplifiedTraditionalAttachment: 2503,
   withFrenchAfter: 10874,
   remainingWithoutFrench: 3552,
});
assert.equal(audit.frenchEditorialDecisions.appliedCount, 6);
assert.equal(audit.frenchEditorialDecisions.conflictCount, 0);
assert.equal(audit.characterFrenchAttachment.manyToOneCollisions.characterCount, 351);
assert.equal(audit.characterFrenchAttachment.recoveredCharacters.length, 2503);
assert.equal(audit.hskFrenchReuse.automaticImportCount, 10);
assert.equal(audit.hskFrenchReuse.automaticImports.length, 10);
assert.equal(audit.hskFrenchReuse.reviewQueueCount, 210);
assert.deepEqual(audit.hskFrenchReuse.statusCounts, {
   ambiguous: 82,
   "duplicate-sense": 126,
   exact: 5132,
   "normalized-pinyin": 57,
   "source-only": 2,
});
assert.deepEqual(audit.hskFrenchReuse.translationLanguageCounts, { en: 5098, fr: 301 });
assert(audit.hskFrenchReuse.automaticImports.every((item) => item.dictionaryLinkStatus === "exact"));
assert(audit.hskFrenchReuse.reviewQueue.every((item) => !["exact", "normalized-pinyin"].includes(item.dictionaryLinkStatus)));

const importedHskWords = [
   ["\u5403", "\u5403", "chi1", ["manger"]],
   ["\u6b4c", "\u6b4c", "ge1", ["chanson"]],
   ["\u500b", "\u4e2a", "ge4", ["CL: classificateur de gens etd'objets en g\u00e9n\u00e9ral"]],
   ["\u597d\u5403", "\u597d\u5403", "hao3 chi1", ["d\u00e9licieux \u2022 savoureux"]],
   ["\u548c", "\u548c", "he2", ["et"]],
   ["\u53eb", "\u53eb", "jiao4", ["s'appeler"]],
   ["\u9eb5\u689d\u5152", "\u9762\u6761\u513f", "mian4 tiao2 r5", ["nouilles"]],
   ["\u5343", "\u5343", "qian1", ["mille"]],
   ["\u662f", "\u662f", "shi4", ["\u00eatre \u2022 oui, si"]],
   ["\u600e\u9ebc", "\u600e\u4e48", "zen3 me5", ["comment?"]],
];
for (const [traditional, simplified, numbered, definitionsFr] of importedHskWords) {
   const entry = word(traditional, simplified, numbered);
   assert.deepEqual(entry.definitionsFr, definitionsFr);
   assert(entry.sources.includes("HSK3-CHINESIMPLE-FR-L1-2026"));
   const hskSense = entry.senses.find((sense) => sense.sources.includes("HSK3-CHINESIMPLE-FR-L1-2026"));
   assert(hskSense, `${simplified} ${numbered}: missing explicit HSK sense`);
   assert.deepEqual(hskSense.definitionsFr, definitionsFr);
   assert.equal(hskSense.alignment.lexicalIdentity.traditional, traditional);
   assert.equal(hskSense.alignment.lexicalIdentity.simplified, simplified);
   assert.equal(hskSense.alignment.lexicalIdentity.pinyinNumbered, numbered);
   assert.equal(hskSense.frenchProvenance[0].sourceTranslation, definitionsFr.join(" \u2022 "));
   assert.equal(hskSense.frenchProvenance[0].sourceDocument.translationLanguage, "fr");
}

const auditedCorrections = [
   ["親子", "亲子", "qin1 zi3", "parents et enfants", "parents et enfantsparent and child"],
   ["離合悲歡", "离合悲欢", "li2 he2 bei1 huan1", "séparations et retrouvailles", "la vie est faite de joies et de peines (life is intermingled with joy and sorrow)"],
   ["柳葉刀", "柳叶刀", "liu3 ye4 dao1", "lancette", "the lancet"],
   ["車裂", "车裂", "che1 lie4", "supplice de l’écartèlement", "Hanged, drawn and quartered"],
   ["不速之客", "不速之客", "bu4 su4 zhi1 ke4", "visiteur inattendu", "the visitor"],
   ["乙狀結腸", "乙状结肠", "yi3 zhuang4 jie2 chang2", "côlon sigmoïde", "CÃ´lon sigmoÃ¯de"],
   ["霙", "霙", "ying1", "flocon de neige", "Neige mouillÃ©e"],
   ["晶片", "晶片", "jing1 pian4", "puce électronique", "Circuit intÃ©grÃ©"],
   ["蜎", "蜎", "yuan1", "larve de moustique", "LÃ©mure"],
   ["孔林", "孔林", "kong3 lin2", "cimetière de Confucius à Qufu", "CimetiÃ¨re de Confucius"],
   ["瓊州海峽", "琼州海峡", "qiong2 zhou1 hai3 xia2", "détroit de Qiongzhou", "DÃ©troit de Qiongzhou"],
   ["臺獨", "台独", "tai2 du2", "indépendance de Taïwan", "IndÃ©pendance de Taiwan"],
   ["坐標", "坐标", "zuo4 biao1", "système de coordonnées", "SystÃ¨me de coordonnÃ©es"],
   ["大亞灣", "大亚湾", "da4 ya4 wan1", "baie de Daya", "Baie de DÃ yÃ"],
   ["異化", "异化", "yi4 hua4", "aliénation (philosophie)", "AliÃ©nation"],
   ["展覽館", "展览馆", "zhan3 lan3 guan3", "hall d’exposition", "Palais des congrÃ¨s"],
   ["內源", "内源", "nei4 yuan2", "origine interne", "EndogÃ¨ne"],
   ["城鐵", "城铁", "cheng2 tie3", "réseau ferroviaire urbain", "MÃ©tro"],
   ["斬殺", "斩杀", "zhan3 sha1", "décapiter", "DÃ©capitation"],
   ["陶藝", "陶艺", "tao2 yi4", "art céramique", "CÃ©ramiste"],
   ["推定", "推定", "tui1 ding4", "présomption", "PrÃ©somption"],
   ["交通部", "交通部", "jiao1 tong1 bu4", "ministère des Transports", "MinistÃ¨re des Transports"],
   ["癥", "癥", "zheng1", "masse abdominale pathologique", "SymptÃ´me"],
   ["篲", "篲", "hui4", "comète", "ComÃ¨te"],
];
for (const [traditional, simplified, numbered, expectedFragment, quarantined] of auditedCorrections) {
   const entry = word(traditional, simplified, numbered);
   assert(entry, `${traditional}/${simplified}/${numbered}: corrected entry missing`);
   assert(entry.definitionsFr.some((definition) => definition.includes(expectedFragment)), `${traditional}/${numbered}: verified correction missing`);
   assert(entry.frenchProvenance.some((provenance) =>
      (provenance.quarantinedDefinitionsFr || []).includes(quarantined)
   ), `${traditional}/${numbered}: prior gloss was not quarantined`);
   assert(!audit.potentialAnomalies.items.some((item) => item.entryId === entry.id), `${traditional}/${numbered}: corrected anomaly still reported`);
}

for (const [traditional, simplified, numbered] of [
   ["骷髏會", "骷髅会", "ku1 lou2 hui4"],
   ["艾維斯", "艾维斯", "ai4 wei2 si1"],
   ["明鏡", "明镜", "ming2 jing4"],
]) {
   const entry = word(traditional, simplified, numbered);
   assert(audit.potentialAnomalies.items.some((item) => item.entryId === entry.id), `${traditional}/${numbered}: reviewed proper-name false positive disappeared unexpectedly`);
}

const preservedLove = word("\u611b", "\u7231", "ai4");
assert.deepEqual(preservedLove.definitionsFr, ["amour", "aimer", "affection", "\u00eatre fan de", "adorer"]);
assert(!preservedLove.sources.some((source) => source.startsWith("HSK3-")));
assert(audit.hskFrenchReuse.sourceConflicts.some((item) => item.dictionaryEntryId === preservedLove.id));

const duplicateSenseWithoutFrench = word("\u9762", "\u9762", "mian4");
assert.deepEqual(duplicateSenseWithoutFrench.definitionsFr, []);
assert(audit.hskFrenchReuse.reviewQueue.some((item) =>
   item.dictionaryEntryId === duplicateSenseWithoutFrench.id && item.dictionaryLinkStatus === "duplicate-sense"));
for (const hanzi of ["习", "冲", "决", "冻", "净", "凉", "发"])
   assert(audit.characterFrenchAttachment.recoveredCharacters.includes(hanzi), `${hanzi} missing from recovered characters`);

assert.equal(sha256(fs.readFileSync(path.join(root, "data", "source", "cfdict.u8"))), "e1e2891a7bedb347e7a39888274727368a529ab9600262a5290085ef8a61d3f4");
assert.equal(sha256(fs.readFileSync(path.join(root, "data", "source", "cc-cedict.u8"))), "36062be89f98c5730eb0bdb6dcc7a874c088975a960ee21c5231827aedb89b2a");

const mao = word("毛", "毛", "mao2");
assert(mao.definitionsFr.includes("poil") && mao.definitionsFr.includes("plume") && mao.definitionsFr.includes("laine"));
assert(!mao.definitionsFr.includes("Torr"));

const tuo = word("乇", "乇", "tuo1");
const zhe = word("乇", "乇", "zhe2");
assert.deepEqual(tuo.definitionsFr, ["ancienne variante de 托"]);
assert.deepEqual(zhe.definitionsFr, ["composant graphique « brin d’herbe »"]);
assert(!zhe.definitionsFr.includes("Torr"));

const zhong = word("乑", "乑", "zhong4");
assert.deepEqual(zhong.definitionsFr, ["se tenir côte à côte", "variante de 眾/众"]);
const alkene = word("烯", "烯", "xi1");
assert.deepEqual(alkene.definitionsFr, ["alcène"]);
assert(!alkene.definitionsFr.some((definition) => /blaze|glorieux/iu.test(definition)));
const jue = word("叕", "叕", "jue2");
assert.deepEqual(jue.definitionsFr, []);
assert.equal(jue.frenchStatus, "unavailable");

const zheCharacter = character("乇");
assert.deepEqual(zheCharacter.pinyin.map((item) => item.numbered), ["tuo1"]);
assert.deepEqual(zheCharacter.definitionsFr, ["ancienne variante de 托"]);
assert.deepEqual(zheCharacter.readings.map((reading) => reading.pinyin.numbered), ["tuo1", "zhe2"]);
assert(zheCharacter.readings.find((reading) => reading.pinyin.numbered === "zhe2").definitionsFr.includes("composant graphique « brin d’herbe »"));
const duoCharacter = character("叕");
assert.equal(duoCharacter.readings.find((reading) => reading.pinyin.numbered === "jue2").frenchStatus, "unavailable");

const expectedRecoveredReadings = [
   ["习", "xi2", "xí", ["étudier", "habitude", "s'exercer", "s'habituer"]],
   ["冲", "chong1", "chōng", ["verser de l’eau pour mélanger ou préparer ; infuser", "rincer ; laver à l’eau", "heurter ou emporter sous l’effet de l’eau", "s’élever rapidement", "voie de passage ; carrefour", "se précipiter ; foncer", "heurter ; entrer en collision", "attaquer ; charger", "heurter ou offenser par ses paroles ou son comportement"]],
   ["冲", "chong4", "chòng", ["vers ; en direction de", "à cause de ; eu égard à", "fort ; puissant ; vigoureux", "âcre ; piquant (odeur ou goût)", "brusque ; agressif (propos ou comportement)"]],
   ["决", "jue2", "jué", ["absolument", "décider", "déterminer"]],
   ["冻", "dong4", "dòng", ["gelée", "geler", "congeler", "avoir froid"]],
   ["净", "jing4", "jìng", ["variante graphique de 淨/净", "seulement", "simplement", "propre", "net"]],
   ["凉", "liang2", "liáng", ["frais", "Liáng — nom de plusieurs États chinois historiques, dont les cinq Liang des Seize Royaumes", "Liáng — nom de famille"]],
   ["凉", "liang4", "liàng", ["laisser refroidir ; mettre à refroidir", "aider ; assister (sens littéraire)"]],
   ["凄", "qi1", "qī", ["très froid ; glacial", "triste ; affligé", "désolé ; morne", "variante graphique de 淒/凄", "triste", "solitaire"]],
   ["准", "zhun3", "zhǔn", ["autoriser ; permettre", "approuver ; accorder", "selon ; conformément à", "déterminer ; fixer", "exact ; précis", "certainement ; à coup sûr", "critère ; norme ; standard", "futur ; sur le point de devenir", "quasi- ; para-"]],
   ["凇", "song1", "sōng", ["givre", "dépôt de cristaux de glace formé lorsque des gouttelettes d’eau en surfusion gèlent sur une surface, notamment dans le brouillard givrant"]],
   ["凈", "jing4", "jìng", ["variante graphique de 淨/净"]],
   ["冼", "xian3", "xiǎn", ["nom de famille Xian"]],
   ["冰", "bing1", "bīng", ["glace"]],
];
for (const [hanzi, numbered, marked, definitionsFr] of expectedRecoveredReadings) {
   const item = reading(hanzi, numbered);
   assert(item, `${hanzi} ${numbered} reading missing`);
   assert.equal(item.pinyin.marked, marked);
   assert.deepEqual(item.definitionsFr, definitionsFr);
   assert(item.wordIds.length === item.lexicalEntries.length && item.wordIds.length > 0);
   assert.deepEqual(item.wordIds, item.lexicalEntries.map((entry) => entry.wordId));
   assert(item.lexicalEntries.every((entry) => hanzi === entry.traditional || hanzi === entry.simplified));
}

const xi = reading("习", "xi2");
assert(xi.lexicalEntries.some((entry) => entry.traditional === "習" && entry.simplified === "习"));
assert(xi.sourceRefs.some((reference) => reference.source === "CFDICT" && reference.lines.includes(2731)));
assert.equal(xi.frenchStatus, "source");

const chong = character("冲");
assert.deepEqual(chong.readings.map((item) => item.pinyin.numbered), ["chong1", "chong4"]);
assert(reading("冲", "chong1").lexicalEntries.some((entry) => entry.traditional === "沖"));
assert(reading("冲", "chong1").lexicalEntries.some((entry) => entry.traditional === "衝"));

const cool = character("凉");
assert.deepEqual(cool.readings.map((item) => item.pinyin.numbered), ["liang2", "liang4"]);
assert(reading("凉", "liang4").definitionsFr.includes("laisser refroidir ; mettre à refroidir"));
assert(reading("凉", "liang4").definitionsEn.includes("to let sth cool down"));

const exactIce = word("冰", "冰", "bing1");
assert.deepEqual(exactIce.definitionsFr, ["glace"]);
assert.equal(exactIce.frenchStatus, "verified");
assert(exactIce.frenchProvenance.some((item) => item.verifiedAt === "2026-08-11"));

const waterChong = word("沖", "冲", "chong1");
const movementChong = word("衝", "冲", "chong1");
const directedChong = word("衝", "冲", "chong4");
assert(waterChong.definitionsFr.some((definition) => definition.includes("infuser")));
assert(!movementChong.definitionsFr.some((definition) => /infuser|rincer|ajout d’eau/iu.test(definition)));
assert(movementChong.definitionsFr.some((definition) => definition.includes("foncer")));
assert(directedChong.definitionsFr.some((definition) => definition.includes("en direction de")));
assert(!directedChong.definitionsFr.some((definition) => definition.includes("coup de poing")));

const exactZhun = word("准", "准", "zhun3");
const standardZhun = word("準", "准", "zhun3");
assert(exactZhun.definitionsFr.some((definition) => definition.includes("autoriser")));
assert(!standardZhun.definitionsFr.some((definition) => /autoriser|permettre/iu.test(definition)));
assert(standardZhun.definitionsFr.some((definition) => definition.includes("norme")));

const rime = word("凇", "凇", "song1");
assert(rime.definitionsFr.includes("givre"));
assert(!rime.definitionsFr.includes("stalactite"));
const graphicJing = word("凈", "净", "jing4");
assert.deepEqual(graphicJing.definitionsFr, ["variante graphique de 淨/净"]);
const xianSurname = word("冼", "冼", "xian3");
assert.deepEqual(xianSurname.definitionsFr, ["nom de famille Xian"]);
assert(!xianSurname.definitionsFr.some((definition) => /laver|洗/iu.test(definition)));

const liangNoun = word("涼", "凉", "liang2");
const liangAdjectiveSense = liangNoun.senses.find((sense) => sense.definitionsFr.includes("frais"));
const liangProperSense = liangNoun.senses.find((sense) => sense.definitionsFr.some((definition) => definition.startsWith("Liáng —")));
assert(liangAdjectiveSense && liangProperSense && liangAdjectiveSense.id !== liangProperSense.id);
assert.deepEqual(word("涼", "凉", "liang4").definitionsFr, ["laisser refroidir ; mettre à refroidir", "aider ; assister (sens littéraire)"]);

const iceRadicalCharacters = [..."冫习冰冱冲决况冶冷冻冼冽净凄准凇凈凉凋凌凍减凑凛凜凝"];
const iceRadicalEntries = iceRadicalCharacters.map(character);
assert.equal(iceRadicalEntries.filter(Boolean).length, 26);
assert.equal(iceRadicalEntries.flatMap((entry) => entry.readings).length, 28);
assert(iceRadicalEntries.every((entry) => entry.readings.every((item) => item.definitionsFr.length)));
assert(iceRadicalEntries.flatMap((entry) => entry.readings.flatMap((item) => item.definitionsFr)).every((definition) =>
   !/[�]|(?:Ã.|Â.|â€)/u.test(definition) && !/\b(?:ice|cold|surname|variant of|to let|Stalaktit)\b/iu.test(definition)
));

const simplifiedHair = character("发");
assert.deepEqual(simplifiedHair.readings.map((item) => item.pinyin.numbered), ["fa1", "fa4"]);
assert(reading("发", "fa1").definitionsFr.includes("envoyer"));
assert.deepEqual(reading("发", "fa4").definitionsFr, ["cheveux"]);
assert(reading("发", "fa1").lexicalEntries.every((entry) => entry.traditional === "發"));
assert(reading("发", "fa4").lexicalEntries.every((entry) => entry.traditional === "髮"));
assert.deepEqual(character("發").readings.map((item) => item.pinyin.numbered), ["fa1"]);
assert(character("發").definitionsFr.includes("envoyer") && !character("發").definitionsFr.includes("cheveux"));
assert.deepEqual(character("髮").readings.map((item) => item.pinyin.numbered), ["fa4"]);
assert.deepEqual(character("髮").definitionsFr, ["cheveux"]);

assert(!character("毛").definitionsFr.includes("Torr"));
assert.deepEqual(character("乇").readings.map((item) => item.pinyin.numbered), ["tuo1", "zhe2"]);
assert(character("乇").readings.every((item) => !item.definitionsFr.includes("Torr")));
assert(character("乇").readings.every((item) => item.frenchProvenance.length));
assert.deepEqual(reading("叕", "jue2").definitionsFr, []);
assert.equal(reading("叕", "jue2").frenchStatus, "unavailable");

const locations = readJson(path.join(generated, "entry-locations.json"));
const frenchIndex = readJson(path.join(generated, "french-index.json"));
const jueReference = locations.findIndex(([id]) => id === jue.id);
assert(!((frenchIndex.vitesse || []).includes(jueReference)));
const duoReference = locations.findIndex(([id]) => id === "char-叕");
assert(!((frenchIndex.vitesse || []).includes(duoReference)));
const hairReferences = new Set(frenchIndex.cheveux || []);
assert(hairReferences.has(locations.findIndex(([id]) => id === "char-发")));
assert(hairReferences.has(locations.findIndex(([id]) => id === "char-髮")));
assert(!hairReferences.has(locations.findIndex(([id]) => id === "char-發")));
assert(overrides.entries.every((entry) => entry.justification && entry.references.length && /^\d{4}-\d{2}-\d{2}$/.test(entry.verifiedAt)));
assert.equal(decisions.schemaVersion, 2);
assert(decisions.entries.every((entry) => entry.state === "verified" && entry.reason && entry.references.length >= 2 && /^\d{4}-\d{2}-\d{2}$/.test(entry.verifiedAt)));

console.log("dictionary French quality data tests: PASS");
