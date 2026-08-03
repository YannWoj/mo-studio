"use strict";

/* ================= grammaire (法) ================= */
         function GX(hz, py, fr) {
            return (
               '<button class="gx" data-say="' +
               hz +
               '"><span class="gx-hz">' +
               hz +
               '</span><span class="gx-py">' +
               py +
               '</span><span class="gx-fr">' +
               fr +
               "</span></button>"
            );
         }
         // quiz : la 1re option de opts est toujours la bonne (mélangée à l'affichage)
         const GRAMMAR = [
            {
               hz: "序",
               t: "L'ordre des mots : Sujet + Verbe + Objet",
               body:
                  "Comme en français, la phrase de base suit l'ordre Sujet-Verbe-Objet. Pas de conjugaison, pas d'accord : le verbe ne change jamais." +
                  GX("我喝茶。", "wǒ hē chá.", "Je bois du thé.") +
                  GX("他看书。", "tā kàn shū.", "Il lit un livre."),
               quiz: [
                  {
                     q: "Quelle phrase est correcte ?",
                     hz: true,
                     opts: ["我喝茶。", "茶喝我。", "喝我茶。"],
                  },
                  {
                     q: "« Il lit un livre » se dit…",
                     hz: true,
                     opts: ["他看书。", "书看他。", "看他书。"],
                  },
                  {
                     q: "Le verbe chinois…",
                     opts: [
                        "ne se conjugue jamais",
                        "s'accorde avec le sujet",
                        "change au pluriel",
                     ],
                  },
               ],
            },
            {
               hz: "是",
               t: "是 « être » : seulement pour A = B",
               body:
                  "是 (shì) relie deux noms : « je suis étudiant », « c'est mon ami ». On ne l'utilise pas devant un adjectif." +
                  GX("我是学生。", "wǒ shì xué sheng.", "Je suis étudiant.") +
                  GX(
                     "她是我的老师。",
                     "tā shì wǒ de lǎo shī.",
                     "C'est ma professeure.",
                  ),
               quiz: [
                  {
                     q: "« Je suis étudiant » :",
                     hz: true,
                     opts: ["我是学生。", "我很学生。", "我学生是。"],
                  },
                  {
                     q: "是 s'utilise…",
                     opts: [
                        "entre deux noms",
                        "devant un adjectif",
                        "pour dire l'heure",
                     ],
                  },
                  {
                     q: "« C'est mon ami » :",
                     hz: true,
                     opts: ["他是我的朋友。", "他很我的朋友。", "他的是朋友。"],
                  },
               ],
            },
            {
               hz: "很",
               t: "很 devant l'adjectif",
               body:
                  "Devant un adjectif, on met 很 (hěn) au lieu de 是. Il est quasi obligatoire, et son sens « très » est affaibli : 我很好 veut surtout dire « je vais bien », pas « je vais TRÈS bien »." +
                  GX("我很好。", "wǒ hěn hǎo.", "Je vais bien.") +
                  GX("中国很大。", "zhōng guó hěn dà.", "La Chine est grande."),
               quiz: [
                  {
                     q: "« La Chine est grande » :",
                     hz: true,
                     opts: ["中国很大。", "中国是大。", "中国大很。"],
                  },
                  {
                     q: "Devant un adjectif, on met…",
                     opts: ["很", "是", "的"],
                  },
                  {
                     q: "我很好 signifie surtout…",
                     opts: [
                        "je vais bien",
                        "je suis extrêmement bon",
                        "je suis le meilleur",
                     ],
                  },
               ],
            },
            {
               hz: "不",
               t: "La négation : 不 et 没(有)",
               body:
                  "不 (bù) nie le présent, l'habitude et les verbes 是 / 会 / 能. La construction 没(有) + verbe nie « avoir » et les actions passées : 我没吃 = je n'ai pas mangé. Attention : devant un 4ᵉ ton, 不 se prononce bú." +
                  GX("我不去。", "wǒ bú qù.", "Je n'y vais pas.") +
                  GX("我没有钱。", "wǒ méi yǒu qián.", "Je n'ai pas d'argent."),
               quiz: [
                  {
                     q: "« Je n'y vais pas » :",
                     hz: true,
                     opts: ["我不去。", "我没去不。", "我去不。"],
                  },
                  {
                     q: "« Je n'ai pas d'argent » :",
                     hz: true,
                     opts: ["我没有钱。", "我不有钱。", "我钱没有。"],
                  },
                  {
                     q: "Devant un 4ᵉ ton, 不 se prononce…",
                     opts: ["bú", "bù", "bǔ"],
                  },
               ],
            },
            {
               hz: "吗",
               t: "Poser une question avec 吗",
               body:
                  "Ajoute 吗 (ma) à la fin d'une phrase affirmative : elle devient une question oui/non. Rien d'autre ne bouge." +
                  GX(
                     "你是学生吗？",
                     "nǐ shì xué sheng ma?",
                     "Es-tu étudiant ?",
                  ) +
                  GX("你喝茶吗？", "nǐ hē chá ma?", "Bois-tu du thé ?"),
               quiz: [
                  { q: "你是学生___？", hz: true, opts: ["吗", "的", "了"] },
                  {
                     q: "吗 se place…",
                     opts: ["en fin de phrase", "au début", "après le sujet"],
                  },
                  {
                     q: "« Bois-tu du thé ? » :",
                     hz: true,
                     opts: ["你喝茶吗？", "吗你喝茶？", "你吗喝茶？"],
                  },
               ],
            },
            {
               hz: "什",
               t: "Les mots interrogatifs restent en place",
               body:
                  "什么 (quoi), 谁 (qui), 哪儿 (où)… se mettent exactement là où serait la réponse. On ne les déplace pas en début de phrase." +
                  GX(
                     "你叫什么名字？",
                     "nǐ jiào shén me míng zi?",
                     "Comment t'appelles-tu ?",
                  ) +
                  GX("他是谁？", "tā shì shéi?", "Qui est-ce ?") +
                  GX("你在哪儿？", "nǐ zài nǎr?", "Où es-tu ?"),
               quiz: [
                  {
                     q: "« Où es-tu ? » :",
                     hz: true,
                     opts: ["你在哪儿？", "哪儿你在？", "在哪儿你？"],
                  },
                  {
                     q: "什么 se place…",
                     opts: [
                        "à la place de la réponse",
                        "toujours au début",
                        "toujours à la fin",
                     ],
                  },
                  {
                     q: "« Qui est-ce ? » :",
                     hz: true,
                     opts: ["他是谁？", "谁他是？", "他谁是？"],
                  },
               ],
            },
            {
               hz: "的",
               t: "的 : la possession",
               body:
                  "的 (de) se place entre le possesseur et la chose possédée : « moi 的 livre » = mon livre. Avec la famille proche, on peut l'omettre (我妈妈)." +
                  GX("我的书", "wǒ de shū", "mon livre") +
                  GX("妈妈的猫", "mā ma de māo", "le chat de maman"),
               quiz: [
                  {
                     q: "« mon livre » :",
                     hz: true,
                     opts: ["我的书", "书的我", "我书的"],
                  },
                  {
                     q: "« le chat de maman » :",
                     hz: true,
                     opts: ["妈妈的猫", "猫的妈妈", "妈妈猫的"],
                  },
                  {
                     q: "Avec la famille proche, 的…",
                     opts: [
                        "peut se supprimer (我妈妈)",
                        "est obligatoire",
                        "devient 了",
                     ],
                  },
               ],
            },
            {
               hz: "个",
               t: "Les classificateurs : 个, 本, 只",
               body:
                  "Entre un nombre et un nom, il faut un classificateur. 个 (gè) est le passe-partout, 本 (běn) pour les livres, 只 (zhī) pour les petits animaux. Pour dire « deux » choses, on utilise 两 (liǎng), pas 二." +
                  GX("三个人", "sān gè rén", "trois personnes") +
                  GX("两本书", "liǎng běn shū", "deux livres") +
                  GX("一只猫", "yī zhī māo", "un chat"),
               quiz: [
                  {
                     q: "« trois personnes » :",
                     hz: true,
                     opts: ["三个人", "三人个", "三本人"],
                  },
                  {
                     q: "« deux livres » :",
                     hz: true,
                     opts: ["两本书", "二本书", "两书"],
                  },
                  {
                     q: "« un chat » :",
                     hz: true,
                     opts: ["一只猫", "一本猫", "一猫"],
                  },
               ],
            },
            {
               hz: "天",
               t: "Le temps se place avant le verbe",
               body:
                  "今天, 明天, 现在… se placent après le sujet (ou en tout début de phrase), jamais à la fin comme en français." +
                  GX(
                     "我今天去学校。",
                     "wǒ jīn tiān qù xué xiào.",
                     "Aujourd'hui je vais à l'école.",
                  ) +
                  GX("他明天来。", "tā míng tiān lái.", "Il vient demain."),
               quiz: [
                  {
                     q: "« Il vient demain » :",
                     hz: true,
                     opts: ["他明天来。", "他来明天。", "明天来他。"],
                  },
                  {
                     q: "今天 se place…",
                     opts: [
                        "après le sujet (ou tout au début)",
                        "à la fin de la phrase",
                        "après le verbe",
                     ],
                  },
                  {
                     q: "« Aujourd'hui je vais à l'école » :",
                     hz: true,
                     opts: [
                        "我今天去学校。",
                        "我去学校今天。",
                        "今天学校我去。",
                     ],
                  },
               ],
            },
            {
               hz: "了",
               t: "了 : action accomplie ou changement",
               body:
                  "了 (le) après le verbe ou en fin de phrase indique qu'une action est accomplie ou que la situation a changé : 下雨了 = « voilà qu'il pleut ». Attention : ce n'est pas exactement un passé à la française." +
                  GX("我吃了。", "wǒ chī le.", "J'ai mangé.") +
                  GX("他来了。", "tā lái le.", "Il est arrivé.") +
                  GX(
                     "下雨了。",
                     "xià yǔ le.",
                     "Il pleut (ça vient de commencer).",
                  ),
               quiz: [
                  {
                     q: "« J'ai mangé » :",
                     hz: true,
                     opts: ["我吃了。", "我了吃。", "我吃的。"],
                  },
                  {
                     q: "了 indique…",
                     opts: [
                        "une action accomplie ou un changement",
                        "exactement le passé français",
                        "le futur",
                     ],
                  },
                  {
                     q: "« Il pleut (ça y est) » :",
                     hz: true,
                     opts: ["下雨了。", "了下雨。", "雨下的。"],
                  },
               ],
            },
            {
               hz: "在",
               t: "在 : le lieu et l'action en cours",
               body:
                  "在 (zài) indique où l'on se trouve. Devant un verbe, il exprime aussi une action en train de se faire (« être en train de »)." +
                  GX("我在家。", "wǒ zài jiā.", "Je suis à la maison.") +
                  GX(
                     "他在打电话。",
                     "tā zài dǎ diàn huà.",
                     "Il est en train de téléphoner.",
                  ),
               quiz: [
                  {
                     q: "« Je suis à la maison » :",
                     hz: true,
                     opts: ["我在家。", "我是家。", "我家在。"],
                  },
                  {
                     q: "« Il est en train de téléphoner » :",
                     hz: true,
                     opts: ["他在打电话。", "他打在电话。", "在他打电话。"],
                  },
                  {
                     q: "在 devant un verbe exprime…",
                     opts: ["une action en cours", "le passé", "une question"],
                  },
               ],
            },
            {
               hz: "声",
               t: "Les 4 tons : la mélodie des mots",
               body:
                  "Le ton fait partie du mot : la même syllabe « ma » change de sens selon la mélodie. 1ᵉʳ haut et plat, 2ᵉ montant, 3ᵉ descend puis remonte, 4ᵉ tombe sèchement." +
                  GX("妈 mā", "ton 1 — haut et plat", "maman") +
                  GX("麻 má", "ton 2 — montant", "chanvre") +
                  GX("马 mǎ", "ton 3 — creusé", "cheval") +
                  GX("骂 mà", "ton 4 — descendant", "gronder") +
                  GX("妈妈骂马。", "mā ma mà mǎ.", "Maman gronde le cheval."),
               quiz: [
                  {
                     q: "mǎ (3ᵉ ton) veut dire…",
                     opts: ["cheval", "maman", "gronder"],
                  },
                  {
                     q: "Le 4ᵉ ton…",
                     opts: ["tombe sèchement", "monte", "reste plat"],
                  },
                  {
                     q: "mā, má, mǎ, mà : combien de mots différents ?",
                     opts: ["quatre", "un seul", "deux"],
                  },
               ],
            },
         ];
         function quizHtml(gi) {
            const g = GRAMMAR[gi];
            return (
               '<div class="qz"><div class="qz-t">Mini-quiz</div>' +
               g.quiz
                  .map((qq, qi) => {
                     const opts = shuffle(qq.opts.map((o, i) => [o, i === 0]));
                     return (
                        '<div class="qz-q">' +
                        (qi + 1) +
                        ". " +
                        (qq.hz ? '<span class="qhz">' : "") +
                        esc(qq.q) +
                        (qq.hz ? "</span>" : "") +
                        "</div>" +
                        '<div class="qz-opts" data-g="' +
                        gi +
                        '" data-q="' +
                        qi +
                        '">' +
                        opts
                           .map(
                              (o) =>
                                 '<button class="chip' +
                                 (qq.hz ? " hz" : "") +
                                 '" data-ok="' +
                                 o[1] +
                                 '">' +
                                 esc(o[0]) +
                                 "</button>",
                           )
                           .join("") +
                        "</div>"
                     );
                  })
                  .join("") +
               '<div class="qz-score" id="qz-score-' +
               gi +
               '"></div></div>'
            );
         }
         function renderGrammar() {
            $("view").innerHTML =
               '<section style="padding:6px 2px 10px"><h2 class="v-t" style="margin:0">法 · Les règles du jeu</h2><p class="muted">L\'essentiel de la grammaire HSK 1, en fiches. Touche un exemple pour l\'écouter, puis teste-toi.</p></section>' +
               GRAMMAR.map(
                  (g, i) =>
                     '<details class="gcard"' +
                     (i === 0 ? " open" : "") +
                     '><summary><span class="g-hz">' +
                     g.hz +
                     "</span>" +
                     g.t +
                     '</summary><div class="g-body">' +
                     g.body +
                     quizHtml(i) +
                     "</div></details>",
               ).join("");
            document.querySelectorAll(".qz-opts").forEach((box) => {
               const gi = +box.dataset.g;
               box.querySelectorAll(".chip").forEach(
                  (b) =>
                     (b.onclick = () => {
                        if (box.dataset.done) return;
                        box.dataset.done = "1";
                        const good = box.querySelector('[data-ok="true"]');
                        if (good) good.classList.add("ok");
                        if (b.dataset.ok !== "true") b.classList.add("ko");
                        // score de la fiche
                        const boxes = Array.from(
                           document.querySelectorAll(
                              '.qz-opts[data-g="' + gi + '"]',
                           ),
                        );
                        const done = boxes.filter((x) => x.dataset.done).length;
                        const right = boxes.filter(
                           (x) =>
                              x.dataset.done && !x.querySelector(".chip.ko"),
                        ).length;
                        const sc = $("qz-score-" + gi);
                        if (sc)
                           sc.textContent =
                              done === boxes.length
                                 ? "Score : " +
                                   right +
                                   " / " +
                                   boxes.length +
                                   (right === boxes.length ? " — 漂亮 !" : "")
                                 : "";
                     }),
               );
            });
         }
