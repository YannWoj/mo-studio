# Rapport de liaison HSK ↔ dictionnaire

## Méthode

La recherche part exclusivement du mot chinois exact présent dans les fichiers HSK 1 à 6. Aucune variante graphique, segmentation ou correction approximative n’est utilisée pour trouver un mot.

Le pinyin est comparé après normalisation Unicode, casse, espaces, apostrophes, tirets et représentation des tons. Une liaison exacte exige le même pinyin avec les mêmes tons. Une différence mineure est retenue uniquement lorsque la forme sans tons est strictement identique ; aucun candidat n’est choisi si cette condition échoue.

Dictionnaire analysé : build `a3638e42e5c11264ab7fec39b592e6c6f8507d489ab6d8ed344ea908f66f384c`, 145213 entrées.

## Résumé

| Niveau | Entrées | Liens exacts | Écart mineur | Pinyin non résolu | Absents | Prononciations multiples |
|---|---|---|---|---|---|---|
| HSK 1 | 301 | 292 | 9 | 0 | 0 | 45 |
| HSK 2 | 200 | 191 | 9 | 0 | 0 | 33 |
| HSK 3 | 500 | 482 | 18 | 0 | 0 | 38 |
| HSK 4 | 1000 | 976 | 23 | 1 | 0 | 65 |
| HSK 5 | 1600 | 1577 | 22 | 1 | 0 | 74 |
| HSK 6 | 1800 | 1763 | 35 | 0 | 2 | 90 |

Total : **5401 entrées HSK**, dont **5281 liaisons exactes**, **116 différences mineures de pinyin**, **2 pinyins non résolus** et **2 absences du dictionnaire**.

Les quatre catégories exact / écart mineur / pinyin non résolu / absent forment une partition des entrées HSK. La catégorie « prononciations multiples » est transversale.

## Mots liés exactement au dictionnaire

La liste structurée complète, avec tous les identifiants candidats et les prononciations correspondantes, se trouve dans `exact_dictionary_links` du rapport JSON.

### HSK 1 (292)

爱 (ài), 八 (bā), 爸爸 (bàba), 吧 (ba), 白天 (báitiān), 百 (bǎi), 半 (bàn), 包子 (bāozi), 杯子 (bēizi), 本 (běn), 边 (biān), 病 (bìng), 不 (bù), 菜 (cài), 茶 (chá), 唱 (chàng), 超市 (chāoshì), 车 (chē), 吃 (chī), 出租车 (chūzūchē), 穿 (chuān), 打电话 (dǎdiànhuà), 大 (dà), 大家 (dàjiā), 大学 (dàxué), 大学生 (dàxuéshēng), 到 (dào), 的 (de), 第 (dì), 弟弟 (dìdi), 点 (diǎn), 店 (diàn), 电话 (diànhuà), 电脑 (diànnǎo), 电视 (diànshì), 电影 (diànyǐng), 电影院 (diànyǐngyuàn), 东西 (dōngxi), 都 (dōu), 读 (dú), 读书 (dúshū), 对 (duì), 对不起 (duìbuqǐ), 多 (duō), 多少 (duōshao), 儿子 (érzi), 二 (èr), 饭 (fàn), 饭店 (fàndiàn), 房间 (fángjiān), 非常 (fēicháng), 飞机 (fēijī), 分 (fēn), 分钟 (fēnzhōng), 高兴 (gāoxìng), 歌 (gē), 哥哥 (gēge), 个 (gè), 给 (gěi), 公司 (gōngsī), 工作 (gōngzuò), 狗 (gǒu), 贵 (guì), 国 (guó), 还 (hái), 孩子 (háizi), 汉语 (hànyǔ), 汉字 (hànzì), 好 (hǎo), 好吃 (hǎochī), 好看 (hǎokàn), 好听 (hǎotīng), 好玩儿 (hǎowánr), 号 (hào), 喝 (hē), 和 (hé), 很 (hěn), 后 (hòu), 回 (huí), 会 (huì).

火车 (huǒchē), 鸡蛋 (jīdàn), 几 (jǐ), 家 (jiā), 家人 (jiārén), 见 (jiàn), 件 (jiàn), 饺子 (jiǎozi), 叫 (jiào), 姐姐 (jiějie), 今年 (jīnnián), 今天 (jīntiān), 九 (jiǔ), 觉得 (juéde), 开 (kāi), 开车 (kāichē), 看 (kàn), 看病 (kànbìng), 看见 (kànjiàn), 可以 (kěyǐ), 课 (kè), 口 (kǒu), 块 (kuài), 来 (lái), 老师 (lǎoshī), 了 (le), 冷 (lěng), 里 (lǐ), 两 (liǎng), 零 (líng), 六 (liù), 妈妈 (māma), 吗 (ma), 买 (mǎi), 卖 (mài), 忙 (máng), 猫 (māo), 没 (méi), 没关系 (méiguānxi), 没事 (méishì), 没有 (méiyǒu), 妹妹 (mèimei), 们 (men), 米饭 (mǐfàn), 面包 (miànbāo), 面条儿 (miàntiáor), 明年 (míngnián), 明天 (míngtiān), 名字 (míngzi), 哪 (nǎ), 哪个 (nǎge), 哪里 (nǎlǐ), 哪儿 (nǎr), 哪些 (nǎxiē), 那 (nà), 那个 (nàge), 那儿 (nàr), 那些 (nàxiē), 男 (nán), 男朋友 (nánpéngyou), 呢 (ne), 能 (néng), 你 (nǐ), 你好 (nǐhǎo), 你们 (nǐmen), 年 (nián), 您 (nín), 牛奶 (niúnǎi), 女 (nǚ), 女儿 (nǚ'ér), 女朋友 (nǚpéngyou), 女士 (nǚshì), 朋友 (péngyou), 便宜 (piányi), 漂亮 (piàoliang), 苹果 (píngguǒ), 七 (qī), 起床 (qǐchuáng), 千 (qiān), 前 (qián).

钱 (qián), 请 (qǐng), 请问 (qǐngwèn), 去 (qù), 去年 (qùnián), 热 (rè), 人 (rén), 认识 (rènshi), 日 (rì), 三 (sān), 商店 (shāngdiàn), 上 (shàng), 上班 (shàngbān), 上课 (shàngkè), 上午 (shàngwǔ), 上学 (shàngxué), 少 (shǎo), 谁 (shéi), 什么 (shénme), 生病 (shēngbìng), 十 (shí), 时候 (shíhou), 时间 (shíjiān), 事 (shì), 是 (shì), 手机 (shǒujī), 书 (shū), 书店 (shūdiàn), 水 (shuǐ), 水果 (shuǐguǒ), 睡 (shuì), 睡觉 (shuìjiào), 说 (shuō), 说话 (shuōhuà), 四 (sì), 岁 (suì), 他 (tā), 它 (tā), 她 (tā), 他们 (tāmen), 它们 (tāmen), 她们 (tāmen), 太 (tài), 天 (tiān), 天气 (tiānqì), 听 (tīng), 听见 (tīngjiàn), 同学 (tóngxué), 外 (wài), 外边 (wàibian), 玩 (wán), 晚 (wǎn), 晚饭 (wǎnfàn), 晚上 (wǎnshang), 喂 (wèi), 问 (wèn), 问题 (wèntí), 我 (wǒ), 我们 (wǒmen), 五 (wǔ), 午饭 (wǔfàn), 喜欢 (xǐhuan), 下 (xià), 下班 (xiàbān), 下课 (xiàkè), 下午 (xiàwǔ), 下雨 (xiàyǔ), 先生 (xiānsheng), 现在 (xiànzài), 想 (xiǎng), 小 (xiǎo), 小时 (xiǎoshí), 小学 (xiǎoxué), 小学生 (xiǎoxuéshēng), 些 (xiē), 写 (xiě), 谢谢 (xièxie), 新 (xīn), 星期 (xīngqī), 星期日 (xīngqīrì).

星期天 (xīngqītiān), 休息 (xiūxi), 学 (xué), 学生 (xuésheng), 学习 (xuéxí), 学校 (xuéxiào), 雪 (xuě), 要 (yào), 也 (yě), 一 (yī), 衣服 (yīfu), 医生 (yīshēng), 医院 (yīyuàn), 椅子 (yǐzi), 有 (yǒu), 有的 (yǒude), 有点儿 (yǒudiǎnr), 有些 (yǒuxiē), 雨 (yǔ), 元 (yuán), 月 (yuè), 再 (zài), 在 (zài), 再见 (zàijiàn), 早 (zǎo), 早饭 (zǎofàn), 早上 (zǎoshang), 怎么 (zěnme), 怎么样 (zěnmeyàng), 找 (zhǎo), 这 (zhè), 这边 (zhèbiān), 这个 (zhège), 这里 (zhèlǐ), 这儿 (zhèr), 这些 (zhèxiē), 真 (zhēn), 正在 (zhèngzài), 知道 (zhīdào), 只 (zhī), 中国 (zhōngguó), 中文 (zhōngwén), 中午 (zhōngwǔ), 中学 (zhōngxué), 中学生 (zhōngxuéshēng), 住 (zhù), 桌子 (zhuōzi), 字 (zì), 昨天 (zuótiān), 坐 (zuò), 做 (zuò), 做饭 (zuòfàn).

### HSK 2 (191)

啊 (a), 爱好 (àihào), 白色 (báisè), 班 (bān), 帮 (bāng), 帮忙 (bāngmáng), 包 (bāo), 本子 (běnzi), 比 (bǐ), 笔 (bǐ), 别 (bié), 不好意思 (bùhǎoyìsi), 长 (cháng), 车站 (chēzhàn), 出 (chū), 出国 (chūguó), 出来 (chūlái), 出门 (chūmén), 出去 (chūqù), 床 (chuáng), 词 (cí), 次 (cì), 从 (cóng), 从小 (cóngxiǎo), 错 (cuò), 打 (dǎ), 打车 (dǎchē), 打开 (dǎkāi), 但 (dàn), 但是 (dànshì), 得 (de), 地 (de), 等 (děng), 地铁 (dìtiě), 点 (diǎn), 懂 (dǒng), 动 (dòng), 饭馆 (fànguǎn), 飞 (fēi), 高 (gāo), 高中 (gāozhōng), 告诉 (gàosu), 个子 (gèzi), 跟 (gēn), 公交车 (gōngjiāochē), 过 (guò), 过来 (guòlái), 过年 (guònián), 过去 (guòqù), 过 (guo), 还是 (háishi), 黑色 (hēisè), 红茶 (hóngchá), 红色 (hóngsè), 花 (huā), 花 (huā), 画 (huà), 坏 (huài), 机场 (jīchǎng), 机票 (jīpiào), 记得 (jìde), 间 (jiān), 教 (jiāo), 教室 (jiàoshì), 介绍 (jièshào), 进 (jìn), 近 (jìn), 进来 (jìnlái), 进去 (jìnqù), 经常 (jīngcháng), 酒店 (jiǔdiàn), 就 (jiù), 咖啡 (kāfēi), 开始 (kāishǐ), 开学 (kāixué), 考 (kǎo), 考试 (kǎoshì), 可能 (kěnéng), 裤子 (kùzi), 快 (kuài).

快乐 (kuàilè), 快要 (kuàiyào), 篮球 (lánqiú), 累 (lèi), 离 (lí), 里面 (lǐmiàn), 楼 (lóu), 路 (lù), 路上 (lùshang), 旅游 (lǚyóu), 绿茶 (lǜchá), 绿色 (lǜsè), 慢 (màn), 没意思 (méiyìsi), 每 (měi), 门 (mén), 门口 (ménkǒu), 门票 (ménpiào), 面 (miàn), 名 (míng), 拿 (ná), 那么 (nàme), 那样 (nàyàng), 奶茶 (nǎichá), 奶奶 (nǎinai), 男孩儿 (nánháir), 鸟 (niǎo), 女孩儿 (nǚháir), 旁边 (pángbiān), 跑 (pǎo), 跑步 (pǎobù), 票 (piào), 妻子 (qīzi), 前面 (qiánmiàn), 晴 (qíng), 球 (qiú), 让 (ràng), 肉 (ròu), 商场 (shāngchǎng), 上来 (shànglái), 上面 (shàngmiàn), 上去 (shàngqù), 上网 (shàngwǎng), 身体 (shēntǐ), 生日 (shēngrì), 时 (shí), 事情 (shìqing), 手 (shǒu), 手表 (shǒubiǎo), 书包 (shūbāo), 舒服 (shūfu), 送 (sòng), 虽然 (suīrán), 所以 (suǒyǐ), 疼 (téng), 踢 (tī), 题 (tí), 条 (tiáo), 跳舞 (tiàowǔ), 头 (tóu), 外国 (wàiguó), 外面 (wàimiàn), 完 (wán), 万 (wàn), 往 (wǎng), 忘 (wàng), 位 (wèi), 为什么 (wèishénme), 希望 (xīwàng), 洗 (xǐ), 洗手间 (xǐshǒujiān), 下面 (xiàmiàn), 下去 (xiàqù), 小孩儿 (xiǎoháir), 小时候 (xiǎoshíhou), 笑 (xiào), 姓 (xìng), 姓名 (xìngmíng), 颜色 (yánsè), 眼睛 (yǎnjing).

药 (yào), 药店 (yàodiàn), 爷爷 (yéye), 已经 (yǐjīng), 意思 (yìsi), 阴 (yīn), 因为 (yīnwèi), 游 (yóu), 游泳 (yóuyǒng), 有意思 (yǒuyìsi), 有时 (yǒushí), 右 (yòu), 右边 (yòubian), 鱼 (yú), 远 (yuǎn), 运动 (yùndòng), 站 (zhàn), 丈夫 (zhàngfu), 这么 (zhème), 这样 (zhèyàng), 着 (zhe), 正 (zhèng), 周 (zhōu), 准备 (zhǔnbèi), 自己 (zìjǐ), 走 (zǒu), 走路 (zǒulù), 足球 (zúqiú), 最 (zuì), 左 (zuǒ), 左边 (zuǒbian).

### HSK 3 (482)

阿姨 (āyí), 矮 (ǎi), 爱人 (àiren), 安静 (ānjìng), 安全 (ānquán), 把 (bǎ), 搬 (bān), 班级 (bānjí), 搬家 (bānjiā), 办 (bàn), 办法 (bànfǎ), 办公室 (bàngōngshì), 半天 (bàntiān), 帮助 (bāngzhù), 饱 (bǎo), 报纸 (bàozhǐ), 北 (běi), 北方 (běifāng), 被 (bèi), 笔记 (bǐjì), 比较 (bǐjiào), 笔记本 (bǐjìběn), 比如 (bǐrú), 比赛 (bǐsài), 必须 (bìxū), 变 (biàn), 遍 (biàn), 变成 (biànchéng), 变化 (biànhuà), 表演 (biǎoyǎn), 别的 (biéde), 宾馆 (bīnguǎn), 冰 (bīng), 冰激凌 (bīngjīlíng), 冰箱 (bīngxiāng), 病人 (bìngrén), 不同 (bùtóng), 不久 (bùjiǔ), 不行 (bùxíng), 才 (cái), 菜单 (càidān), 参加 (cānjiā), 草 (cǎo), 草地 (cǎodì), 层 (céng), 查 (chá), 差 (chà), 差不多 (chàbuduō), 尝 (cháng), 常 (cháng), 常见 (chángjiàn), 常用 (chángyòng), 常常 (chángcháng), 衬衫 (chènshān), 成绩 (chéngjì), 城市 (chéngshì), 迟到 (chídào), 出发 (chūfā), 出生 (chūshēng), 出院 (chūyuàn), 初中 (chūzhōng), 除了 (chúle), 船 (chuán), 春天 (chūntiān), 词典 (cídiǎn), 打扫 (dǎsǎo), 打算 (dǎsuàn), 大概 (dàgài), 大人 (dàren), 大小 (dàxiǎo), 大熊猫 (dàxióngmāo), 大衣 (dàyī), 带 (dài), 担心 (dānxīn), 蛋糕 (dàngāo), 当然 (dāngrán), 到处 (dàochù), 得 (dé), 得到 (dédào), 得分 (défēn).

的话 (dehuà), 得 (děi), 灯 (dēng), 地 (dì), 地点 (dìdiǎn), 地方 (dìfang), 地图 (dìtú), 电 (diàn), 电梯 (diàntī), 电子书 (diànzǐshū), 丢 (diū), 东 (dōng), 东北 (dōngběi), 东方 (dōngfāng), 东南 (dōngnán), 冬天 (dōngtiān), 懂得 (dǒngde), 动物 (dòngwù), 动物园 (dòngwùyuán), 短 (duǎn), 短裤 (duǎnkù), 段 (duàn), 锻炼 (duànliàn), 对话 (duìhuà), 饿 (è), 而且 (érqiě), 耳朵 (ěrduo), 耳机 (ěrjī), 发 (fā), 发烧 (fāshāo), 发生 (fāshēng), 发现 (fāxiàn), 发展 (fāzhǎn), 方便 (fāngbiàn), 方便面 (fāngbiànmiàn), 方法 (fāngfǎ), 方向 (fāngxiàng), 房子 (fángzi), 放 (fàng), 放假 (fàngjià), 放心 (fàngxīn), 放学 (fàngxué), 分开 (fēnkāi), 风 (fēng), 封 (fēng), 夫妻 (fūqī), 服务 (fúwù), 附近 (fùjìn), 复习 (fùxí), 该 (gāi), 干净 (gānjìng), 感兴趣 (gǎnxìngqù), 感到 (gǎndào), 感冒 (gǎnmào), 干 (gàn), 刚 (gāng), 刚才 (gāngcái), 高铁 (gāotiě), 根据 (gēnjù), 更 (gèng), 公斤 (gōngjīn), 公园 (gōngyuán), 工作日 (gōngzuòrì), 故事 (gùshi), 刮 (guā), 关 (guān), 关机 (guānjī), 关心 (guānxīn), 关于 (guānyú), 关注 (guānzhù), 国家 (guójiā), 过节 (guòjié), 过去 (guòqù), 海 (hǎi), 害怕 (hàipà), 好多 (hǎoduō), 好久 (hǎojiǔ), 好像 (hǎoxiàng), 号码 (hàomǎ), 河 (hé).

合适 (héshì), 黑板 (hēibǎn), 红绿灯 (hóng-lǜdēng), 后来 (hòulái), 后年 (hòunián), 后天 (hòutiān), 护照 (hùzhào), 花园 (huāyuán), 画家 (huàjiā), 欢迎 (huānyíng), 还 (huán), 环境 (huánjìng), 换 (huàn), 黄色 (huángsè), 回答 (huídá), 会 (huì), 会议 (huìyì), 或 (huò), 或者 (huòzhě), 鸡 (jī), 几乎 (jīhū), 机会 (jīhuì), 极 (jí), 急 (jí), 记 (jì), 季 (jì), 季节 (jìjié), 加 (jiā), 假期 (jiàqī), 坚持 (jiānchí), 检查 (jiǎnchá), 简单 (jiǎndān), 检票 (jiǎnpiào), 健康 (jiànkāng), 见面 (jiànmiàn), 讲 (jiǎng), 角 (jiǎo), 脚 (jiǎo), 接 (jiē), 街 (jiē), 节 (jié), 结婚 (jiéhūn), 节目 (jiémù), 节日 (jiérì), 结束 (jiéshù), 解决 (jiějué), 姐妹 (jiěmèi), 借 (jiè), 斤 (jīn), 经过 (jīngguò), 经理 (jīnglǐ), 久 (jiǔ), 酒 (jiǔ), 旧 (jiù), 句 (jù), 句子 (jùzi), 决定 (juédìng), 卡 (kǎ), 开花 (kāihuā), 开会 (kāihuì), 开机 (kāijī), 开心 (kāixīn), 可 (kě), 渴 (kě), 可爱 (kě’ài), 可是 (kěshì), 刻 (kè), 课本 (kèběn), 客人 (kèrén), 课文 (kèwén), 空调 (kōngtiáo), 哭 (kū), 筷子 (kuàizi), 矿泉水 (kuàngquánshuǐ), 来自 (láizì), 蓝 (lán), 老 (lǎo), 老人 (lǎorén), 离开 (líkāi), 礼物 (lǐwù).

历史 (lìshǐ), 脸 (liǎn), 练 (liàn), 练习 (liànxí), 凉快 (liángkuai), 辆 (liàng), 聊 (liáo), 聊天儿 (liáotiānr), 了解 (liǎojiě), 邻居 (línjū), 留学 (liúxué), 留学生 (liúxuéshēng), 楼梯 (lóutī), 路边 (lùbiān), 路口 (lùkǒu), 马 (mǎ), 马路 (mǎlù), 马上 (mǎshàng), 满意 (mǎnyì), 毛 (máo), 米 (mǐ), 面前 (miànqián), 明白 (míngbai), 名单 (míngdān), 名人 (míngrén), 南 (nán), 难 (nán), 南方 (nánfāng), 难过 (nánguò), 难看 (nánkàn), 男人 (nánrén), 男生 (nánshēng), 难题 (nántí), 难听 (nántīng), 年级 (niánjí), 年轻 (niánqīng), 牛 (niú), 努力 (nǔlì), 女人 (nǚrén), 女生 (nǚshēng), 爬 (pá), 怕 (pà), 拍照 (pāizhào), 盘子 (pánzi), 胖 (pàng), 啤酒 (píjiǔ), 平时 (píngshí), 瓶子 (píngzi), 骑 (qí), 奇怪 (qíguài), 其实 (qíshí), 其他 (qítā), 起 (qǐ), 起飞 (qǐfēi), 汽车 (qìchē), 铅笔 (qiānbǐ), 前年 (qiánnián), 前天 (qiántiān), 清楚 (qīngchu), 请假 (qǐngjià), 请客 (qǐngkè), 秋天 (qiūtiān), 球场 (qiúchǎng), 裙子 (qúnzi), 然后 (ránhòu), 热情 (rèqíng), 认得 (rènde), 认为 (rènwéi), 认真 (rènzhēn), 容易 (róngyì), 如果 (rúguǒ), 伞 (sǎn), 扫 (sǎo), 沙发 (shāfā), 山 (shān), 上衣 (shàngyī), 勺子 (sháozi), 身边 (shēnbiān), 身高 (shēngāo), 声 (shēng).

生活 (shēnghuó), 生气 (shēngqì), 声音 (shēngyīn), 市 (shì), 试 (shì), 室 (shì), 世界 (shìjiè), 收 (shōu), 收到 (shōudào), 受 (shòu), 瘦 (shòu), 受到 (shòudào), 叔叔 (shūshu), 树 (shù), 数学 (shùxué), 刷 (shuā), 双 (shuāng), 水平 (shuǐpíng), 司机 (sījī), 四季 (sìjì), 糖 (táng), 特别 (tèbié), 提高 (tígāo), 体育 (tǐyù), 体育馆 (tǐyùguǎn), 甜 (tián), 跳 (tiào), 听说 (tīngshuō), 挺 (tǐng), 同事 (tóngshì), 同意 (tóngyì), 头发 (tóufa), 突然 (tūrán), 图书馆 (túshūguǎn), 腿 (tuǐ), 外地 (wàidì), 外卖 (wàimài), 外语 (wàiyǔ), 完成 (wánchéng), 碗 (wǎn), 晚点 (wǎndiǎn), 晚会 (wǎnhuì), 网球 (wǎngqiú), 网站 (wǎngzhàn), 忘记 (wàngjì), 为 (wèi), 为了 (wèile), 卫生间 (wèishēngjiān), 文化 (wénhuà), 屋子 (wūzi), 西 (xī), 西北 (xīběi), 西方 (xīfāng), 西瓜 (xīguā), 西南 (xīnán), 习惯 (xíguàn), 喜爱 (xǐ’ài), 洗衣机 (xǐyījī), 洗澡 (xǐzǎo), 夏天 (xiàtiān), 先 (xiān), 香蕉 (xiāngjiāo), 相信 (xiāngxìn), 箱子 (xiāngzi), 向 (xiàng), 像 (xiàng), 相机 (xiàngjī), 小区 (xiǎoqū), 小心 (xiǎoxīn), 校园 (xiàoyuán), 校长 (xiàozhǎng), 鞋 (xié), 新年 (xīnnián), 新闻 (xīnwén), 新鲜 (xīnxiān), 信 (xìn), 信用卡 (xìnyòngkǎ), 行 (xíng), 行李 (xíngli), 兴趣 (xìngqù).

休假 (xiūjià), 需要 (xūyào), 选 (xuǎn), 选择 (xuǎnzé), 学期 (xuéqī), 牙 (yá), 牙刷 (yáshuā), 羊 (yáng), 养 (yǎng), 要求 (yāoqiú), 页 (yè), 以后 (yǐhòu), 以前 (yǐqián), 以上 (yǐshàng), 以外 (yǐwài), 以为 (yǐwéi), 以下 (yǐxià), 音乐 (yīnyuè), 银行 (yínháng), 银行卡 (yínhángkǎ), 饮料 (yǐnliào), 应该 (yīnggāi), 影响 (yǐngxiǎng), 用 (yòng), 邮件 (yóujiàn), 游客 (yóukè), 游戏 (yóuxì), 邮箱 (yóuxiāng), 有关 (yǒuguān), 有名 (yǒumíng), 有用 (yǒuyòng), 又 (yòu), 羽毛球 (yǔmáoqiú), 语言 (yǔyán), 雨衣 (yǔyī), 遇到 (yùdào), 遇见 (yùjiàn), 园 (yuán), 员 (yuán), 愿意 (yuànyì), 越 (yuè), 月亮 (yuèliang), 运动会 (yùndònghuì), 运动员 (yùndòngyuán), 咱们 (zánmen), 脏 (zāng), 怎么办 (zěnmebàn), 怎样 (zěnyàng), 站 (zhàn), 张 (zhāng), 长 (zhǎng), 着急 (zháojí), 照 (zhào), 照片 (zhàopiàn), 照相 (zhàoxiàng), 直到 (zhídào), 只 (zhǐ), 纸 (zhǐ), 只能 (zhǐnéng), 只是 (zhǐshì), 只要 (zhǐyào), 只有 (zhǐyǒu), 中 (zhōng), 中间 (zhōngjiān), 终于 (zhōngyú), 种 (zhǒng), 重要 (zhòngyào), 周末 (zhōumò), 主要 (zhǔyào), 注意 (zhùyì), 住院 (zhùyuàn), 字典 (zìdiǎn), 自行车 (zìxíngchē), 子 (zi), 总 (zǒng), 总是 (zǒngshì), 嘴 (zuǐ), 最好 (zuìhǎo), 最后 (zuìhòu), 最近 (zuìjìn).

做客 (zuòkè), 作业 (zuòyè).

### HSK 4 (976)

啊 (ā), 爱情 (àiqíng), 爱心 (àixīn), 安检 (ānjiǎn), 安排 (ānpái), 按 (àn), 按时 (ànshí), 按照 (ànzhào), 白酒 (báijiǔ), 办公 (bàngōng), 办理 (bànlǐ), 办事 (bànshì), 棒 (bàng), 保护 (bǎohù), 保证 (bǎozhèng), 抱 (bào), 报考 (bàokǎo), 报名 (bàomíng), 抱歉 (bàoqiàn), 背 (bēi), 背包 (bēibāo), 北部 (běibù), 倍 (bèi), 本科 (běnkē), 本来 (běnlái), 笨 (bèn), 鼻子 (bízi), 笔试 (bǐshì), 毕业 (bìyè), 毕业生 (bìyèshēng), 便于 (biànyú), 标准 (biāozhǔn), 表 (biǎo), 表格 (biǎogé), 表示 (biǎoshì), 表现 (biǎoxiàn), 表扬 (biǎoyáng), 饼干 (bǐnggān), 并 (bìng), 并且 (bìngqiě), 播放 (bōfàng), 博士 (bóshì), 步 (bù), 部 (bù), 不得不 (bùdébù), 部分 (bùfen), 不管 (bùguǎn), 不光 (bùguāng), 不仅 (bùjǐn), 不满 (bùmǎn), 部门 (bùmén), 不如 (bùrú), 擦 (cā), 猜 (cāi), 材料 (cáiliào), 参观 (cānguān), 参赛 (cānsài), 餐厅 (cāntīng), 操场 (cāochǎng), 厕所 (cèsuǒ), 查看 (chákàn), 茶叶 (cháyè), 查找 (cházhǎo), 差点儿 (chàdiǎnr), 产生 (chǎnshēng), 厂 (chǎng), 场 (chǎng), 超过 (chāoguò), 车速 (chēsù), 车位 (chēwèi), 城 (chéng), 乘 (chéng), 成功 (chénggōng), 乘客 (chéngkè), 诚实 (chéngshí), 成为 (chéngwéi), 乘坐 (chéngzuò), 吃惊 (chījīng), 迟 (chí), 重 (chóng).

重新 (chóngxīn), 出差 (chūchāi), 出口 (chūkǒu), 出现 (chūxiàn), 出行 (chūxíng), 出租 (chūzū), 厨房 (chúfáng), 厨师 (chúshī), 窗 (chuāng), 窗户 (chuānghu), 吹 (chuī), 词语 (cíyǔ), 此 (cǐ), 此次 (cǐcì), 此外 (cǐwài), 从此 (cóngcǐ), 从来 (cónglái), 从中 (cóngzhōng), 粗 (cū), 粗心 (cūxīn), 村 (cūn), 存 (cún), 错过 (cuòguò), 错误 (cuòwù), 答应 (dāying), 答 (dá), 答案 (dá’àn), 达到 (dádào), 打招呼 (dǎzhāohu), 打败 (dǎbài), 打工 (dǎgōng), 打扰 (dǎrǎo), 打印 (dǎyìn), 打印机 (dǎyìnjī), 打折 (dǎzhé), 打针 (dǎzhēn), 大巴 (dàbā), 大大 (dàdà), 大夫 (dàifu), 大量 (dàliàng), 大赛 (dàsài), 大厅 (dàtīng), 大约 (dàyuē), 大自然 (dàzìrán), 待 (dāi), 戴 (dài), 袋子 (dàizi), 单位 (dānwèi), 当 (dāng), 当时 (dāngshí), 刀 (dāo), 导游 (dǎoyóu), 倒 (dào), 道 (dào), 到底 (dàodǐ), 到来 (dàolái), 道路 (dàolù), 道歉 (dàoqiàn), 得意 (déyì), 登机 (dēngjī), 等 (děng), 等到 (děngdào), 低 (dī), 低价 (dījià), 低温 (dīwēn), 低于 (dīyú), 底 (dǐ), 底下 (dǐxia), 地球 (dìqiú), 地址 (dìzhǐ), 点名 (diǎnmíng), 点头 (diǎntóu), 电动车 (diàndòngchē), 电视剧 (diànshìjù), 掉 (diào), 调查 (diàochá), 订 (dìng), 定 (dìng), 东部 (dōngbù), 动车 (dòngchē).

动作 (dòngzuò), 读者 (dúzhě), 堵车 (dǔchē), 度假 (dùjià), 肚子 (dùzi), 短信 (duǎnxìn), 队 (duì), 对方 (duìfāng), 对面 (duìmiàn), 对于 (duìyú), 队员 (duìyuán), 队长 (duìzhǎng), 顿 (dùn), 多么 (duōme), 多数 (duōshù), 多样 (duōyàng), 而 (ér), 儿童 (értóng), 发出 (fāchū), 发送 (fāsòng), 法 (fǎ), 法律 (fǎlǜ), 翻译 (fānyì), 烦 (fán), 烦恼 (fánnǎo), 反对 (fǎnduì), 方面 (fāngmiàn), 方式 (fāngshì), 房东 (fángdōng), 房租 (fángzū), 放弃 (fàngqì), 放松 (fàngsōng), 费 (fèi), 分数 (fēnshù), 分为 (fēnwéi), 份 (fèn), 丰富 (fēngfù), 风景 (fēngjǐng), 否则 (fǒuzé), 幅 (fú), 符合 (fúhé), 付 (fù), 父母 (fùmǔ), 父女 (fùnǚ), 父亲 (fùqīn), 复印 (fùyìn), 复杂 (fùzá), 负责 (fùzé), 负责人 (fùzérén), 父子 (fùzǐ), 改 (gǎi), 改变 (gǎibiàn), 干 (gān), 干杯 (gānbēi), 赶 (gǎn), 敢 (gǎn), 感 (gǎn), 感动 (gǎndòng), 赶紧 (gǎnjǐn), 感觉 (gǎnjué), 赶快 (gǎnkuài), 感情 (gǎnqíng), 感人 (gǎnrén), 赶上 (gǎnshàng), 感受 (gǎnshòu), 感谢 (gǎnxiè), 干活儿 (gànhuór), 钢琴 (gāngqín), 高价 (gāojià), 高考 (gāokǎo), 高速 (gāosù), 高温 (gāowēn), 高于 (gāoyú), 胳膊 (gēbo), 歌声 (gēshēng), 歌手 (gēshǒu), 各 (gè), 各地 (gèdì), 各个 (gègè), 各位 (gèwèi).

各种 (gèzhǒng), 更加 (gèngjiā), 工厂 (gōngchǎng), 功夫 (gōngfu), 公共 (gōnggòng), 功课 (gōngkè), 公里 (gōnglǐ), 公路 (gōnglù), 工人 (gōngrén), 工资 (gōngzī), 共 (gòng), 共同 (gòngtóng), 够 (gòu), 购买 (gòumǎi), 购物 (gòuwù), 估计 (gūjì), 姑娘 (gūniang), 鼓励 (gǔlì), 顾客 (gùkè), 故意 (gùyì), 挂 (guà), 关键 (guānjiàn), 观看 (guānkàn), 观众 (guānzhòng), 管 (guǎn), 管理 (guǎnlǐ), 光 (guāng), 广播 (guǎngbō), 广告 (guǎnggào), 逛 (guàng), 规定 (guīdìng), 国籍 (guójí), 国际 (guójì), 果汁 (guǒzhī), 过程 (guòchéng), 海洋 (hǎiyáng), 害羞 (hàixiū), 寒假 (hánjià), 寒冷 (hánlěng), 喊 (hǎn), 汗 (hàn), 航班 (hángbān), 好好 (hǎohǎo), 好笑 (hǎoxiào), 合格 (hégé), 盒子 (hézi), 红包 (hóngbāo), 厚 (hòu), 后悔 (hòuhuǐ), 忽然 (hūrán), 互联网 (hùliánwǎng), 护士 (hùshi), 互相 (hùxiāng), 话剧 (huàjù), 怀疑 (huáiyí), 环保 (huánbǎo), 换乘 (huànchéng), 回复 (huífù), 回信 (huíxìn), 回忆 (huíyì), 会员 (huìyuán), 活 (huó), 活动 (huódòng), 火 (huǒ), 货 (huò), 获得 (huòdé), 获奖 (huòjiǎng), 获取 (huòqǔ), 基本 (jīběn), 基础 (jīchǔ), 激动 (jīdòng), 积极 (jījí), 积累 (jīlěi), 及时 (jíshí), 即使 (jíshǐ), 既 (jì), 寄 (jì), 计划 (jìhuà), 既然 (jìrán), 技术 (jìshù).

继续 (jìxù), 记者 (jìzhě), 加班 (jiābān), 家具 (jiājù), 加快 (jiākuài), 加强 (jiāqiáng), 加入 (jiārù), 加上 (jiāshàng), 家庭 (jiātíng), 家乡 (jiāxiāng), 加油 (jiāyóu), 加油站 (jiāyóuzhàn), 家长 (jiāzhǎng), 假 (jiǎ), 价格 (jiàgé), 假日 (jiàrì), 减 (jiǎn), 减轻 (jiǎnqīng), 减少 (jiǎnshǎo), 健身 (jiànshēn), 健身房 (jiànshēnfáng), 建议 (jiànyì), 江 (jiāng), 将 (jiāng), 将来 (jiānglái), 将要 (jiāngyào), 奖 (jiǎng), 奖金 (jiǎngjīn), 奖学金 (jiǎngxuéjīn), 降 (jiàng), 降低 (jiàngdī), 降价 (jiàngjià), 降落 (jiàngluò), 降温 (jiàngwēn), 交 (jiāo), 骄傲 (jiāo’ào), 交警 (jiāojǐng), 交流 (jiāoliú), 郊区 (jiāoqū), 交通 (jiāotōng), 教练 (jiàoliàn), 教师 (jiàoshī), 教授 (jiàoshòu), 教学 (jiàoxué), 教育 (jiàoyù), 叫作 (jiàozuò), 街道 (jiēdào), 接受 (jiēshòu), 接着 (jiēzhe), 结果 (jiéguǒ), 节假日 (jiéjiàrì), 节约 (jiéyuē), 结账 (jiézhàng), 解释 (jiěshì), 今后 (jīnhòu), 仅 (jǐn), 尽管 (jǐnguǎn), 仅仅 (jǐnjǐn), 紧张 (jǐnzhāng), 进入 (jìnrù), 进行 (jìnxíng), 禁止 (jìnzhǐ), 精彩 (jīngcǎi), 经济 (jīngjì), 京剧 (jīngjù), 经历 (jīnglì), 经验 (jīngyàn), 警察 (jǐngchá), 景点 (jǐngdiǎn), 景区 (jǐngqū), 景色 (jǐngsè), 竟然 (jìngrán), 竞争 (jìngzhēng), 镜子 (jìngzi), 究竟 (jiūjìng), 就是 (jiùshì), 举 (jǔ), 举办 (jǔbàn), 举例 (jǔlì), 举行 (jǔxíng).

聚 (jù), 聚餐 (jùcān), 聚会 (jùhuì), 拒绝 (jùjué), 距离 (jùlí), 剧院 (jùyuàn), 开玩笑 (kāiwánxiào), 看法 (kànfǎ), 烤 (kǎo), 考虑 (kǎolǜ), 考生 (kǎoshēng), 棵 (kē), 科技 (kējì), 科学 (kēxué), 咳 (ké), 咳嗽 (késou), 可惜 (kěxī), 克 (kè), 课程 (kèchéng), 客气 (kèqi), 课堂 (kètáng), 客厅 (kètīng), 肯定 (kěndìng), 空 (kōng), 空气 (kōngqì), 恐怕 (kǒngpà), 空 (kòng), 口语 (kǒuyǔ), 苦 (kǔ), 快餐 (kuàicān), 快递 (kuàidì), 快速 (kuàisù), 困 (kùn), 困难 (kùnnan), 拉 (lā), 垃圾 (lājī), 辣 (là), 来不及 (láibují), 来得及 (láidejí), 懒 (lǎn), 浪费 (làngfèi), 浪漫 (làngmàn), 老虎 (lǎohǔ), 老家 (lǎojiā), 老年 (lǎonián), 冷静 (lěngjìng), 理发 (lǐfà), 理解 (lǐjiě), 礼貌 (lǐmào), 理想 (lǐxiǎng), 厉害 (lìhai), 力气 (lìqi), 例如 (lìrú), 例子 (lìzi), 俩 (liǎ), 连 (lián), 联系 (liánxì), 凉 (liáng), 量 (liáng), 两 (liǎng), 亮 (liàng), 列 (liè), 零下 (língxià), 零花钱 (línghuāqián), 零钱 (língqián), 零食 (língshí), 另 (lìng), 另外 (lìngwài), 留 (liú), 流 (liú), 流利 (liúlì), 流行 (liúxíng), 路过 (lùguò), 旅馆 (lǚguǎn), 旅客 (lǚkè), 旅行 (lǚxíng), 律师 (lǜshī), 乱 (luàn), 落 (luò), 麻烦 (máfan).

馒头 (mántou), 满 (mǎn), 毛巾 (máojīn), 毛衣 (máoyī), 帽子 (màozi), 美 (měi), 美好 (měihǎo), 美景 (měijǐng), 美丽 (měilì), 美食 (měishí), 梦 (mèng), 梦想 (mèngxiǎng), 密码 (mìmǎ), 免费 (miǎnfèi), 面对 (miànduì), 面试 (miànshì), 秒 (miǎo), 民族 (mínzú), 末 (mò), 母女 (mǔnǚ), 母亲 (mǔqīn), 母子 (mǔzǐ), 目标 (mùbiāo), 目的 (mùdì), 目的地 (mùdìdì), 目前 (mùqián), 耐心 (nàixīn), 南部 (nánbù), 难道 (nándào), 男士 (nánshì), 难受 (nánshòu), 难忘 (nánwàng), 男性 (nánxìng), 内 (nèi), 内容 (nèiróng), 内心 (nèixīn), 能否 (néngfǒu), 能够 (nénggòu), 能力 (nénglì), 年底 (niándǐ), 年龄 (niánlíng), 农村 (nóngcūn), 弄 (nòng), 女性 (nǚxìng), 暖和 (nuǎnhuo), 偶尔 (ǒu’ěr), 拍 (pāi), 排 (pái), 牌 (pái), 排队 (páiduì), 排球 (páiqiú), 牌子 (páizi), 判断 (pànduàn), 陪 (péi), 批评 (pīpíng), 皮肤 (pífū), 脾气 (píqi), 皮鞋 (píxié), 篇 (piān), 片 (piàn), 乒乓球 (pīngpāngqiú), 平常 (píngcháng), 破 (pò), 葡萄 (pútao), 葡萄酒 (pútaojiǔ), 普遍 (pǔbiàn), 普通 (pǔtōng), 普通话 (pǔtōnghuà), 期 (qī), 期末 (qīmò), 期中 (qīzhōng), 其次 (qícì), 其中 (qízhōng), 起到 (qǐdào), 气 (qì), 气候 (qìhòu), 汽水 (qìshuǐ), 气温 (qìwēn), 千克 (qiānkè), 千万 (qiānwàn).

签证 (qiānzhèng), 前方 (qiánfāng), 前后 (qiánhòu), 强 (qiáng), 敲 (qiāo), 桥 (qiáo), 巧 (qiǎo), 巧克力 (qiǎokèlì), 亲戚 (qīnqi), 琴 (qín), 轻 (qīng), 青年 (qīngnián), 轻松 (qīngsōng), 情况 (qíngkuàng), 庆祝 (qìngzhù), 球队 (qiúduì), 球迷 (qiúmí), 区 (qū), 区别 (qūbié), 取 (qǔ), 取得 (qǔdé), 取消 (qǔxiāo), 全 (quán), 全部 (quánbù), 全都 (quándōu), 全球 (quánqiú), 全身 (quánshēn), 缺 (quē), 缺点 (quēdiǎn), 缺少 (quēshǎo), 却 (què), 确实 (quèshí), 然而 (rán’ér), 热闹 (rènao), 人生 (rénshēng), 人数 (rénshù), 人员 (rényuán), 任何 (rènhé), 任务 (rènwu), 扔 (rēng), 仍 (réng), 仍然 (réngrán), 日常 (rìcháng), 日记 (rìjì), 日期 (rìqī), 日子 (rìzi), 入 (rù), 入口 (rùkǒu), 入学 (rùxué), 入住 (rùzhù), 散步 (sànbù), 扫码 (sǎomǎ), 森林 (sēnlín), 商量 (shāngliang), 商品 (shāngpǐn), 伤心 (shāngxīn), 上门 (shàngmén), 稍 (shāo), 稍微 (shāowēi), 少见 (shǎojiàn), 少量 (shǎoliàng), 少数 (shǎoshù), 少年 (shàonián), 社会 (shèhuì), 摄氏度 (shèshìdù), 身 (shēn), 深 (shēn), 身份证 (shēnfènzhèng), 申请 (shēnqǐng), 甚至 (shènzhì), 生 (shēng), 生 (shēng), 生命 (shēngmìng), 生意 (shēngyi), 省 (shěng), 剩 (shèng), 失败 (shībài), 师傅 (shīfu), 失去 (shīqù), 师生 (shīshēng).

失望 (shīwàng), 十分 (shífēn), 实际 (shíjì), 时间表 (shíjiānbiǎo), 实际上 (shíjìshàng), 食品 (shípǐn), 食堂 (shítáng), 食物 (shíwù), 实在 (shízài), 十字路口 (shízìlùkǒu), 使 (shǐ), 使馆 (shǐguǎn), 使用 (shǐyòng), 市场 (shìchǎng), 是否 (shìfǒu), 适合 (shìhé), 世纪 (shìjì), 视频 (shìpín), 市区 (shìqū), 试题 (shìtí), 适应 (shìyìng), 收费 (shōufèi), 收入 (shōurù), 收拾 (shōushi), 收听 (shōutīng), 首 (shǒu), 首都 (shǒudū), 首先 (shǒuxiān), 售票员 (shòupiàoyuán), 受伤 (shòushāng), 输 (shū), 熟 (shú/shóu), 暑假 (shǔjià), 数 (shù), 数量 (shùliàng), 树林 (shùlín), 数字 (shùzì), 帅 (shuài), 顺便 (shùnbiàn), 顺利 (shùnlì), 顺序 (shùnxù), 说法 (shuōfǎ), 说明 (shuōmíng), 说明书 (shuōmíngshū), 硕士 (shuòshì), 死 (sǐ), 速度 (sùdù), 塑料 (sùliào), 酸 (suān), 酸奶 (suānnǎi), 算 (suàn), 随便 (suíbiàn), 随着 (suízhe), 孙女 (sūnnǚ), 孙子 (sūnzi), 所有 (suǒyǒu), 台 (tái), 抬 (tái), 抬头 (táitóu), 弹 (tán), 谈 (tán), 汤 (tāng), 躺 (tǎng), 趟 (tàng), 讨论 (tǎolùn), 讨厌 (tǎoyàn), 特点 (tèdiǎn), 提 (tí), 提出 (tíchū), 提到 (tídào), 提供 (tígōng), 提前 (tíqián), 提醒 (tíxǐng), 体检 (tǐjiǎn), 体温 (tǐwēn), 体重 (tǐzhòng), 填写 (tiánxiě), 条件 (tiáojiàn), 听力 (tīnglì), 听众 (tīngzhòng).

停 (tíng), 停车 (tíngchē), 停车场 (tíngchēchǎng), 停止 (tíngzhǐ), 通 (tōng), 通过 (tōngguò), 通知 (tōngzhī), 童年 (tóngnián), 同时 (tóngshí), 同样 (tóngyàng), 桶 (tǒng), 痛 (tòng), 头痛 (tóutòng), 图 (tú), 图片 (túpiàn), 土 (tǔ), 推 (tuī), 推迟 (tuīchí), 推出 (tuīchū), 脱 (tuō), 袜子 (wàzi), 外出 (wàichū), 外套 (wàitào), 完全 (wánquán), 晚安 (wǎn’ān), 晚餐 (wǎncān), 网购 (wǎnggòu), 往往 (wǎngwǎng), 网页 (wǎngyè), 网友 (wǎngyǒu), 网址 (wǎngzhǐ), 危险 (wēixiǎn), 为 (wéi), 味 (wèi), 卫生 (wèishēng), 温度 (wēndù), 闻 (wén), 文件 (wénjiàn), 文章 (wénzhāng), 文字 (wénzì), 污染 (wūrǎn), 无 (wú), 无法 (wúfǎ), 无聊 (wúliáo), 无论 (wúlùn), 午餐 (wǔcān), 误会 (wùhuì), 吸 (xī), 西部 (xībù), 西红柿 (xīhóngshì), 吸引 (xīyǐn), 细 (xì), 细心 (xìxīn), 下降 (xiàjiàng), 鲜 (xiān), 鲜花 (xiānhuā), 咸 (xián), 现金 (xiànjīn), 羡慕 (xiànmù), 线上 (xiànshàng), 线下 (xiànxià), 现有 (xiànyǒu), 香 (xiāng), 相比 (xiāngbǐ), 相反 (xiāngfǎn), 相互 (xiānghù), 相同 (xiāngtóng), 详细 (xiángxì), 响 (xiǎng), 想法 (xiǎngfǎ), 项 (xiàng), 消息 (xiāoxi), 小吃 (xiǎochī), 小伙子 (xiǎohuǒzi), 小说 (xiǎoshuō), 小组 (xiǎozǔ), 效果 (xiàoguǒ), 笑话 (xiàohua), 血 (xiě), 心 (xīn).

辛苦 (xīnkǔ), 心情 (xīnqíng), 信号 (xìnhào), 信息 (xìnxī), 信心 (xìnxīn), 兴奋 (xīngfèn), 星星 (xīngxing), 醒 (xǐng), 性 (xìng), 性别 (xìngbié), 幸福 (xìngfú), 性格 (xìnggé), 兄弟 (xiōngdì), 熊 (xióng), 修 (xiū), 修理 (xiūlǐ), 许多 (xǔduō), 学费 (xuéfèi), 学院 (xuéyuàn), 压 (yā), 压力 (yālì), 牙膏 (yágāo), 亚洲 (Yàzhōu), 烟 (yān), 盐 (yán), 严格 (yángé), 研究 (yánjiū), 研究生 (yánjiūshēng), 严重 (yánzhòng), 演 (yǎn), 演唱 (yǎnchàng), 演出 (yǎnchū), 眼镜 (yǎnjìng), 眼前 (yǎnqián), 演员 (yǎnyuán), 阳光 (yángguāng), 养成 (yǎngchéng), 样子 (yàngzi), 邀请 (yāoqǐng), 要是 (yàoshi), 钥匙 (yàoshi), 也许 (yěxǔ), 夜 (yè), 夜晚 (yèwǎn), 叶子 (yèzi), 已 (yǐ), 以内 (yǐnèi), 意见 (yìjiàn), 艺术 (yìshù), 因此 (yīncǐ), 引起 (yǐnqǐ), 印象 (yìnxiàng), 赢 (yíng), 赢得 (yíngdé), 应聘 (yìngpìn), 勇敢 (yǒnggǎn), 永远 (yǒngyuǎn), 用来 (yònglái), 用于 (yòngyú), 优点 (yōudiǎn), 幽默 (yōumò), 优秀 (yōuxiù), 由 (yóu), 油 (yóu), 尤其 (yóuqí), 游玩 (yóuwán), 由于 (yóuyú), 友好 (yǒuhǎo), 友情 (yǒuqíng), 有趣 (yǒuqù), 有效 (yǒuxiào), 友谊 (yǒuyì), 有着 (yǒuzhe), 愉快 (yúkuài), 于是 (yúshì), 与 (yǔ), 语法 (yǔfǎ), 预习 (yùxí), 原来 (yuánlái), 原谅 (yuánliàng).

原因 (yuányīn), 远离 (yuǎnlí), 院长 (yuànzhǎng), 院子 (yuànzi), 约 (yuē), 约会 (yuēhuì), 阅读 (yuèdú), 月份 (yuèfèn), 云 (yún), 允许 (yǔnxǔ), 杂志 (zázhì), 再次 (zàicì), 再说 (zàishuō), 暂时 (zànshí), 暂停 (zàntíng), 早餐 (zǎocān), 责任 (zérèn), 增加 (zēngjiā), 增长 (zēngzhǎng), 招聘 (zhāopìn), 着 (zháo), 着火 (zháohuǒ), 者 (zhě), 真正 (zhēnzhèng), 整 (zhěng), 整个 (zhěnggè), 整理 (zhěnglǐ), 证 (zhèng), 正常 (zhèngcháng), 正好 (zhènghǎo), 证件 (zhèngjiàn), 证明 (zhèngmíng), 正确 (zhèngquè), 正式 (zhèngshì), 之 (zhī), 支持 (zhīchí), 支付 (zhīfù), 之后 (zhīhòu), 之间 (zhījiān), 之前 (zhīqián), 知识 (zhīshi), 之中 (zhīzhōng), 值 (zhí), 直接 (zhíjiē), 植物 (zhíwù), 职业 (zhíyè), 指 (zhǐ), 指出 (zhǐchū), 只好 (zhǐhǎo), 纸巾 (zhǐjīn), 质量 (zhìliàng), 至少 (zhìshǎo), 中餐 (zhōngcān), 中年 (zhōngnián), 种 (zhòng), 重 (zhòng), 重点 (zhòngdiǎn), 重视 (zhòngshì), 周围 (zhōuwéi), 主意 (zhǔyi), 祝 (zhù), 祝贺 (zhùhè), 著名 (zhùmíng), 专门 (zhuānmén), 专业 (zhuānyè), 转 (zhuǎn), 转发 (zhuǎnfā), 转机 (zhuǎnjī), 赚 (zhuàn), 装 (zhuāng), 准 (zhǔn), 准确 (zhǔnquè), 准时 (zhǔnshí), 资料 (zīliào), 仔细 (zǐxì), 自 (zì), 自然 (zìrán), 自习 (zìxí), 自信 (zìxìn), 自学 (zìxué).

总结 (zǒngjié), 租 (zū), 组 (zǔ), 最终 (zuìzhōng), 尊重 (zūnzhòng), 左右 (zuǒyòu), 座 (zuò), 做法 (zuòfǎ), 作家 (zuòjiā), 做梦 (zuòmèng), 作品 (zuòpǐn), 作为 (zuòwéi), 座位 (zuòwèi), 作文 (zuòwén), 作用 (zuòyòng), 作者 (zuòzhě).

### HSK 5 (1577)

哎 (āi), 哎呀 (āiyā), 唉 (ài), 爱护 (àihù), 安 (ān), 安全带 (ānquándài), 安慰 (ānwèi), 安装 (ānzhuāng), 暗 (àn), 熬夜 (áoyè), 把握 (bǎwò), 白 (bái), 半夜 (bànyè), 傍晚 (bàngwǎn), 包裹 (bāoguǒ), 包含 (bāohán), 包括 (bāokuò), 包装 (bāozhuāng), 薄 (báo), 宝 (bǎo), 保 (bǎo), 保安 (bǎo’ān), 宝贝 (bǎobèi), 保持 (bǎochí), 保存 (bǎocún), 宝贵 (bǎoguì), 保留 (bǎoliú), 保险 (bǎoxiǎn), 保质期 (bǎozhìqī), 报到 (bàodào), 报道 (bàodào), 报告 (bàogào), 报警 (bàojǐng), 暴雨 (bàoyǔ), 抱怨 (bàoyuàn), 背 (bèi), 背后 (bèihòu), 背景 (bèijǐng), 被子 (bèizi), 本 (běn), 本地 (běndì), 本领 (běnlǐng), 本人 (běnrén), 本质 (běnzhì), 彼此 (bǐcǐ), 比分 (bǐfēn), 比例 (bǐlì), 比喻 (bǐyù), 必 (bì), 毕竟 (bìjìng), 避免 (bìmiǎn), 闭幕式 (bìmùshì), 必然 (bìrán), 必需 (bìxū), 必要 (bìyào), 便 (biàn), 变动 (biàndòng), 便利 (biànlì), 便利店 (biànlìdiàn), 标题 (biāotí), 标志 (biāozhì), 表达 (biǎodá), 表面 (biǎomiàn), 表明 (biǎomíng), 表情 (biǎoqíng), 别 (bié), 饼 (bǐng), 病房 (bìngfáng), 病情 (bìngqíng), 拨打 (bōdǎ), 玻璃 (bōli), 博物馆 (bówùguǎn), 补充 (bǔchōng), 不得了 (bùdéliǎo), 不符 (bùfú), 不良 (bùliáng), 不然 (bùrán), 步行 (bùxíng), 不足 (bùzú), 才 (cái).

裁判 (cáipàn), 采访 (cǎifǎng), 采取 (cǎiqǔ), 彩色 (cǎisè), 采用 (cǎiyòng), 参考 (cānkǎo), 餐饮 (cānyǐn), 参与 (cānyù), 藏 (cáng), 操作 (cāozuò), 册 (cè), 测 (cè), 测试 (cèshì), 曾 (céng), 曾经 (céngjīng), 插 (chā), 差别 (chābié), 差距 (chājù), 叉子 (chāzi), 拆 (chāi), 产 (chǎn), 产量 (chǎnliàng), 产品 (chǎnpǐn), 产业 (chǎnyè), 长处 (chángchù), 长度 (chángdù), 长久 (chángjiǔ), 长期 (chángqī), 常识 (chángshí), 尝试 (chángshì), 长途 (chángtú), 长远 (chángyuǎn), 场所 (chǎngsuǒ), 超 (chāo), 超出 (chāochū), 超级 (chāojí), 超速 (chāosù), 朝 (cháo), 吵 (chǎo), 炒 (chǎo), 车祸 (chēhuò), 车库 (chēkù), 车辆 (chēliàng), 车厢 (chēxiāng), 车主 (chēzhǔ), 彻底 (chèdǐ), 沉 (chén), 沉默 (chénmò), 称 (chēng), 称 (chēng), 称为 (chēngwéi), 称赞 (chēngzàn), 成本 (chéngběn), 承担 (chéngdān), 程度 (chéngdù), 成分 (chéngfèn), 成果 (chéngguǒ), 成就 (chéngjiù), 成立 (chénglì), 成年 (chéngnián), 城区 (chéngqū), 成人 (chéngrén), 承认 (chéngrèn), 承受 (chéngshòu), 成熟 (chéngshú), 乘务员 (chéngwùyuán), 程序 (chéngxù), 成员 (chéngyuán), 成长 (chéngzhǎng), 橙子 (chéngzi), 池 (chí), 持续 (chíxù), 尺子 (chǐzi), 翅膀 (chìbǎng), 冲 (chōng), 充电 (chōngdiàn), 充分 (chōngfèn), 充满 (chōngmǎn), 充值 (chōngzhí), 充足 (chōngzú).

重复 (chóngfù), 虫子 (chóngzi), 宠物 (chǒngwù), 抽 (chōu), 丑 (chǒu), 臭 (chòu), 初 (chū), 出版 (chūbǎn), 初级 (chūjí), 初期 (chūqī), 出色 (chūsè), 出售 (chūshòu), 出席 (chūxí), 出自 (chūzì), 除夕 (chúxī), 处 (chǔ), 处理 (chǔlǐ), 处于 (chǔyú), 处 (chù), 传 (chuán), 传播 (chuánbō), 传递 (chuándì), 传说 (chuánshuō), 传统 (chuántǒng), 窗台 (chuāngtái), 床单 (chuángdān), 创新 (chuàngxīn), 创业 (chuàngyè), 创造 (chuàngzào), 创作 (chuàngzuò), 词汇 (cíhuì), 辞职 (cízhí), 此后 (cǐhòu), 此前 (cǐqián), 此时 (cǐshí), 刺激 (cìjī), 从不 (cóngbù), 从而 (cóng’ér), 从前 (cóngqián), 从事 (cóngshì), 促进 (cùjìn), 促使 (cùshǐ), 促销 (cùxiāo), 催 (cuī), 存放 (cúnfàng), 存款 (cúnkuǎn), 存在 (cúnzài), 措施 (cuòshī), 达成 (dáchéng), 打扮 (dǎban), 打包 (dǎbāo), 打断 (dǎduàn), 打破 (dǎpò), 打听 (dǎting), 大胆 (dàdǎn), 大多 (dàduō), 大会 (dàhuì), 大力 (dàlì), 大妈 (dàmā), 大米 (dàmǐ), 大脑 (dànǎo), 大批 (dàpī), 大厦 (dàshà), 大事 (dàshì), 大象 (dàxiàng), 大型 (dàxíng), 大爷 (dàye), 大于 (dàyú), 大众 (dàzhòng), 代 (dài), 代表 (dàibiǎo), 带动 (dàidòng), 代替 (dàitì), 待遇 (dàiyù), 单 (dān), 单独 (dāndú), 担任 (dānrèn), 单一 (dānyī), 单元 (dānyuán), 胆小 (dǎnxiǎo).

淡 (dàn), 当地 (dāngdì), 当年 (dāngnián), 当前 (dāngqián), 当中 (dāngzhōng), 挡 (dǎng), 当 (dàng), 当成 (dàngchéng), 当作 (dàngzuò), 倒 (dǎo), 导演 (dǎoyǎn), 导致 (dǎozhì), 到达 (dàodá), 到期 (dàoqī), 登 (dēng), 灯光 (dēngguāng), 登记 (dēngjì), 登录 (dēnglù), 等待 (děngdài), 等候 (děnghòu), 等于 (děngyú), 低头 (dītóu), 的确 (díquè), 敌人 (dírén), 递 (dì), 地理 (dìlǐ), 地面 (dìmiàn), 地区 (dìqū), 地位 (dìwèi), 地下 (dìxià), 地震 (dìzhèn), 点心 (diǎnxin), 点赞 (diǎnzàn), 电池 (diànchí), 电动 (diàndòng), 电器 (diànqì), 电商 (diànshāng), 电视台 (diànshìtái), 电子版 (diànzǐbǎn), 调 (diào), 调研 (diàoyán), 定期 (dìngqī), 丢失 (diūshī), 冻 (dòng), 洞 (dòng), 动画 (dònghuà), 动人 (dòngrén), 动手 (dòngshǒu), 豆腐 (dòufu), 豆浆 (dòujiāng), 独立 (dúlì), 独特 (dútè), 读音 (dúyīn), 独自 (dúzì), 堵 (dǔ), 度 (dù), 短处 (duǎnchù), 短期 (duǎnqī), 断 (duàn), 堆 (duī), 对比 (duìbǐ), 对待 (duìdài), 对手 (duìshǒu), 对象 (duìxiàng), 吨 (dūn), 朵 (duǒ), 躲 (duǒ), 儿女 (érnǚ), 二手 (èrshǒu), 二维码 (èrwéimǎ), 发表 (fābiǎo), 发布 (fābù), 发达 (fādá), 发挥 (fāhuī), 发明 (fāmíng), 发起 (fāqǐ), 发言 (fāyán), 发音 (fāyīn), 罚 (fá), 罚款 (fákuǎn).

法院 (fǎyuàn), 翻 (fān), 番茄 (fānqié), 繁荣 (fánróng), 反 (fǎn), 反而 (fǎn’ér), 反复 (fǎnfù), 返回 (fǎnhuí), 反应 (fǎnyìng), 反映 (fǎnyìng), 反正 (fǎnzhèng), 范围 (fànwéi), 方 (fāng), 方案 (fāng’àn), 防 (fáng), 房屋 (fángwū), 防止 (fángzhǐ), 仿佛 (fǎngfú), 访问 (fǎngwèn), 飞行 (fēixíng), 飞行员 (fēixíngyuán), 非洲 (Fēizhōu), 分别 (fēnbié), 分布 (fēnbù), 纷纷 (fēnfēn), 分类 (fēnlèi), 分离 (fēnlí), 分配 (fēnpèi), 分手 (fēnshǒu), 分析 (fēnxī), 分享 (fēnxiǎng), 奋斗 (fèndòu), 丰富多彩 (fēngfù-duōcǎi), 风格 (fēnggé), 疯狂 (fēngkuáng), 风俗 (fēngsú), 风险 (fēngxiǎn), 否定 (fǒudìng), 否认 (fǒurèn), 夫妇 (fūfù), 扶 (fú), 福 (fú), 服装 (fúzhuāng), 副 (fù), 富 (fù), 付出 (fùchū), 负担 (fùdān), 妇女 (fùnǚ), 富有 (fùyǒu), 复制 (fùzhì), 改革 (gǎigé), 改进 (gǎijìn), 改善 (gǎishàn), 改天 (gǎitiān), 改正 (gǎizhèng), 盖 (gài), 概括 (gàikuò), 概念 (gàiniàn), 敢于 (gǎnyú), 刚好 (gānghǎo), 高大 (gāodà), 高档 (gāodàng), 高度 (gāodù), 高级 (gāojí), 高科技 (gāokējì), 高效 (gāoxiào), 搞 (gǎo), 告别 (gàobié), 歌词 (gēcí), 歌曲 (gēqǔ), 隔 (gé), 格外 (géwài), 个别 (gèbié), 各行各业 (gèháng-gèyè), 个人 (gèrén), 个性 (gèxìng), 各自 (gèzì), 根 (gēn), 根本 (gēnběn), 更换 (gēnghuàn).

更新 (gēngxīn), 公布 (gōngbù), 工程 (gōngchéng), 工程师 (gōngchéngshī), 工具 (gōngjù), 功能 (gōngnéng), 公平 (gōngpíng), 公务员 (gōngwùyuán), 恭喜 (gōngxǐ), 工业 (gōngyè), 工艺 (gōngyì), 公寓 (gōngyù), 贡献 (gòngxiàn), 共享 (gòngxiǎng), 沟通 (gōutōng), 构成 (gòuchéng), 古 (gǔ), 鼓 (gǔ), 古代 (gǔdài), 古老 (gǔlǎo), 鼓掌 (gǔzhǎng), 固定 (gùdìng), 故乡 (gùxiāng), 挂号 (guàhào), 怪 (guài), 关闭 (guānbì), 观察 (guānchá), 观点 (guāndiǎn), 观念 (guānniàn), 冠军 (guànjūn), 光临 (guānglín), 光明 (guāngmíng), 光线 (guāngxiàn), 广 (guǎng), 广场 (guǎngchǎng), 广大 (guǎngdà), 广泛 (guǎngfàn), 规律 (guīlǜ), 规模 (guīmó), 规则 (guīzé), 贵姓 (guìxìng), 柜子 (guìzi), 滚 (gǔn), 锅 (guō), 国画 (guóhuà), 国庆 (guóqìng), 果然 (guǒrán), 果实 (guǒshí), 过度 (guòdù), 过分 (guòfèn), 过敏 (guòmǐn), 过期 (guòqī), 过于 (guòyú), 哈 (hā), 海关 (hǎiguān), 海外 (hǎiwài), 海鲜 (hǎixiān), 含 (hán), 含量 (hánliàng), 含有 (hányǒu), 汗水 (hànshuǐ), 行 (háng), 行业 (hángyè), 好评 (hǎopíng), 好运 (hǎoyùn), 好转 (hǎozhuǎn), 好 (hào), 好奇 (hàoqí), 合 (hé), 合法 (héfǎ), 盒饭 (héfàn), 合理 (hélǐ), 河流 (héliú), 合影 (héyǐng), 合作 (hézuò), 黑 (hēi), 红 (hóng), 猴子 (hóuzi), 厚度 (hòudù), 后果 (hòuguǒ).

忽视 (hūshì), 呼吸 (hūxī), 湖 (hú), 蝴蝶 (húdié), 胡同 (hútòng), 互动 (hùdòng), 户外 (hùwài), 花费 (huāfèi), 滑 (huá), 划 (huá), 化 (huà), 话费 (huàfèi), 画面 (huàmiàn), 话题 (huàtí), 化学 (huàxué), 环节 (huánjié), 缓解 (huǎnjiě), 缓慢 (huǎnmàn), 黄瓜 (huángguā), 黄金 (huángjīn), 灰 (huī), 挥 (huī), 恢复 (huīfù), 灰色 (huīsè), 回收 (huíshōu), 汇率 (huìlǜ), 婚礼 (hūnlǐ), 伙 (huǒ), 伙伴 (huǒbàn), 火锅 (huǒguō), 或是 (huòshì), 货物 (huòwù), 或许 (huòxǔ), 机构 (jīgòu), 激烈 (jīliè), 机器 (jīqì), 机器人 (jīqìrén), 肌肉 (jīròu), 及 (jí), 级 (jí), 集 (jí), 疾病 (jíbìng), 及格 (jígé), 集合 (jíhé), 即将 (jíjiāng), 急忙 (jímáng), 极其 (jíqí), 集体 (jítǐ), 急需 (jíxū), 急诊 (jízhěn), 集中 (jízhōng), 挤 (jǐ), 系 (jì), 季度 (jìdù), 记录 (jìlù), 纪录 (jìlù), 纪录片 (jìlùpiàn), 技能 (jìnéng), 纪念 (jìniàn), 纪念日 (jìniànrì), 计算 (jìsuàn), 计算机 (jìsuànjī), 记忆 (jìyì), 记载 (jìzǎi), 嘉宾 (jiābīn), 家电 (jiādiàn), 加工 (jiāgōng), 加热 (jiārè), 加深 (jiāshēn), 加速 (jiāsù), 家务 (jiāwù), 甲 (jiǎ), 假如 (jiǎrú), 架 (jià), 驾驶 (jiàshǐ), 驾照 (jiàzhào), 价值 (jiàzhí), 艰苦 (jiānkǔ), 坚强 (jiānqiáng), 捡 (jiǎn).

剪 (jiǎn), 剪刀 (jiǎndāo), 减肥 (jiǎnféi), 简历 (jiǎnlì), 简直 (jiǎnzhí), 建 (jiàn), 键 (jiàn), 渐渐 (jiànjiàn), 建立 (jiànlì), 键盘 (jiànpán), 建设 (jiànshè), 建造 (jiànzào), 建筑 (jiànzhù), 将近 (jiāngjìn), 讲话 (jiǎnghuà), 讲究 (jiǎngjiu), 奖励 (jiǎnglì), 讲述 (jiǎngshù), 讲座 (jiǎngzuò), 降水 (jiàngshuǐ), 浇 (jiāo), 交换 (jiāohuàn), 交往 (jiāowǎng), 交易 (jiāoyì), 脚步 (jiǎobù), 角度 (jiǎodù), 较 (jiào), 教材 (jiàocái), 接触 (jiēchù), 接待 (jiēdài), 阶段 (jiēduàn), 接近 (jiējìn), 接收 (jiēshōu), 结 (jié), 结构 (jiégòu), 结合 (jiéhé), 结论 (jiélùn), 节省 (jiéshěng), 届 (jiè), 今日 (jīnrì), 紧 (jǐn), 紧急 (jǐnjí), 尽快 (jǐnkuài), 尽量 (jǐnliàng), 紧密 (jǐnmì), 谨慎 (jǐnshèn), 进步 (jìnbù), 近代 (jìndài), 进口 (jìnkǒu), 尽力 (jìnlì), 近年来 (jìnniánlái), 近期 (jìnqī), 近日 (jìnrì), 经典 (jīngdiǎn), 精力 (jīnglì), 精神 (jīngshen), 惊喜 (jīngxǐ), 经营 (jīngyíng), 静 (jìng), 酒吧 (jiǔbā), 久远 (jiǔyuǎn), 救 (jiù), 救护车 (jiùhùchē), 就业 (jiùyè), 居民 (jūmín), 居然 (jūrán), 居住 (jūzhù), 橘子 (júzi), 据 (jù), 距 (jù), 具备 (jùbèi), 剧场 (jùchǎng), 巨大 (jùdà), 据说 (jùshuō), 具体 (jùtǐ), 具有 (jùyǒu), 捐 (juān), 绝对 (juéduì), 决赛 (juésài), 角色 (juésè).

决心 (juéxīn), 开发 (kāifā), 开放 (kāifàng), 开幕 (kāimù), 开幕式 (kāimùshì), 开水 (kāishuǐ), 开通 (kāitōng), 开业 (kāiyè), 开展 (kāizhǎn), 看 (kān), 看望 (kànwàng), 看作 (kànzuò), 靠 (kào), 靠近 (kàojìn), 颗 (kē), 科研 (kēyán), 可见 (kějiàn), 可靠 (kěkào), 可怕 (kěpà), 克服 (kèfú), 客服 (kèfú), 客观 (kèguān), 客户 (kèhù), 空间 (kōngjiān), 空中 (kōngzhōng), 控制 (kòngzhì), 口味 (kǒuwèi), 库 (kù), 宽 (kuān), 宽度 (kuāndù), 亏 (kuī), 昆虫 (kūnchóng), 扩大 (kuòdà), 来源 (láiyuán), 劳动 (láodòng), 老百姓 (lǎobǎixìng), 老板 (lǎobǎn), 老公 (lǎogōng), 姥姥 (lǎolao), 姥爷 (lǎoye), 乐观 (lèguān), 乐趣 (lèqù), 泪 (lèi), 类 (lèi), 泪水 (lèishuǐ), 类似 (lèisì), 类型 (lèixíng), 梨 (lí), 离婚 (líhūn), 厘米 (límǐ), 离职 (lízhí), 理论 (lǐlùn), 里头 (lǐtou), 理由 (lǐyóu), 力 (lì), 立即 (lìjí), 立刻 (lìkè), 利润 (lìrùn), 利益 (lìyì), 利用 (lìyòng), 联合 (liánhé), 连接 (liánjiē), 连忙 (liánmáng), 连续 (liánxù), 脸色 (liǎnsè), 恋爱 (liàn’ài), 良好 (liánghǎo), 粮食 (liángshi), 量 (liàng), 了不起 (liǎobuqǐ), 列车 (lièchē), 临时 (línshí), 铃 (líng), 灵活 (línghuó), 领 (lǐng), 领带 (lǐngdài), 领导 (lǐngdǎo), 领取 (lǐngqǔ), 领先 (lǐngxiān), 领域 (lǐngyù).

令 (lìng), 流传 (liúchuán), 流感 (liúgǎn), 浏览 (liúlǎn), 留言 (liúyán), 龙 (lóng), 漏 (lòu), 录 (lù), 陆地 (lùdì), 录取 (lùqǔ), 路人 (lùrén), 路线 (lùxiàn), 陆续 (lùxù), 录音 (lùyīn), 旅行社 (lǚxíngshè), 论文 (lùnwén), 骂 (mà), 买卖 (mǎimai), 满足 (mǎnzú), 忙碌 (mánglù), 毛笔 (máobǐ), 毛病 (máobìng), 矛盾 (máodùn), 没法儿 (méifǎr), 媒体 (méitǐ), 美术 (měishù), 美味 (měiwèi), 魅力 (mèilì), 门诊 (ménzhěn), 迷 (mí), 迷路 (mílù), 秘密 (mìmì), 密切 (mìqiè), 秘书 (mìshū), 面 (miàn), 面积 (miànjī), 面临 (miànlín), 面向 (miànxiàng), 描述 (miáoshù), 敏感 (mǐngǎn), 名称 (míngchēng), 名牌 (míngpái), 名片 (míngpiàn), 明确 (míngquè), 明显 (míngxiǎn), 明星 (míngxīng), 命 (mìng), 命运 (mìngyùn), 摸 (mō), 模糊 (móhu), 模式 (móshì), 陌生 (mòshēng), 某 (mǒu), 目光 (mùguāng), 木头 (mùtou), 哪怕 (nǎpà), 难得 (nándé), 难度 (nándù), 难以 (nányǐ), 男子 (nánzǐ), 闹 (nào), 闹钟 (nàozhōng), 内部 (nèibù), 能干 (nénggàn), 年初 (niánchū), 年代 (niándài), 年纪 (niánjì), 年夜饭 (niányèfàn), 念 (niàn), 牛仔裤 (niúzǎikù), 浓 (nóng), 农民 (nóngmín), 农业 (nóngyè), 女子 (nǚzǐ), 哦 (ò), 欧洲 (Ōuzhōu), 偶然 (ǒurán), 拍摄 (pāishè), 排列 (páiliè), 派 (pài).

派出所 (pàichūsuǒ), 跑道 (pǎodào), 赔 (péi), 陪伴 (péibàn), 培训 (péixùn), 培养 (péiyǎng), 配 (pèi), 配合 (pèihé), 配送 (pèisòng), 盆 (pén), 碰 (pèng), 碰见 (pèngjiàn), 批 (pī), 批 (pī), 批准 (pīzhǔn), 匹 (pǐ), 骗 (piàn), 拼 (pīn), 拼音 (pīnyīn), 品 (pǐn), 品牌 (pǐnpái), 品质 (pǐnzhì), 品种 (pǐnzhǒng), 聘请 (pìnqǐng), 平 (píng), 评 (píng), 凭 (píng), 平安 (píng’ān), 平衡 (pínghéng), 评价 (píngjià), 凭借 (píngjiè), 平静 (píngjìng), 平均 (píngjūn), 屏幕 (píngmù), 平台 (píngtái), 破坏 (pòhuài), 普及 (pǔjí), 期待 (qīdài), 期间 (qījiān), 齐 (qí), 其 (qí), 奇迹 (qíjì), 其余 (qíyú), 企业 (qǐyè), 气球 (qìqiú), 汽油 (qìyóu), 签 (qiān), 签订 (qiāndìng), 签名 (qiānmíng), 签字 (qiānzì), 前进 (qiánjìn), 前来 (qiánlái), 前途 (qiántú), 前往 (qiánwǎng), 浅 (qiǎn), 欠 (qiàn), 墙 (qiáng), 强大 (qiángdà), 强调 (qiángdiào), 强度 (qiángdù), 强烈 (qiángliè), 抢 (qiǎng), 抢救 (qiǎngjiù), 悄悄 (qiāoqiāo), 切 (qiē), 亲 (qīn), 亲爱 (qīn’ài), 亲朋好友 (qīnpéng-hǎoyǒu), 亲切 (qīnqiè), 亲情 (qīnqíng), 亲人 (qīnrén), 亲自 (qīnzì), 勤奋 (qínfèn), 青 (qīng), 轻易 (qīngyì), 轻重 (qīngzhòng), 情感 (qínggǎn), 情景 (qíngjǐng), 情绪 (qíngxù), 请教 (qǐngjiào).

请求 (qǐngqiú), 穷 (qióng), 趋势 (qūshì), 区域 (qūyù), 去世 (qùshì), 权 (quán), 权利 (quánlì), 全力 (quánlì), 全面 (quánmiàn), 全体 (quántǐ), 全新 (quánxīn), 劝 (quàn), 缺乏 (quēfá), 确保 (quèbǎo), 确定 (quèdìng), 确认 (quèrèn), 群 (qún), 群体 (qúntǐ), 燃烧 (ránshāo), 绕 (rào), 热爱 (rè’ài), 热量 (rèliàng), 热烈 (rèliè), 热心 (rèxīn), 人才 (réncái), 人工 (réngōng), 人际 (rénjì), 人口 (rénkǒu), 人类 (rénlèi), 人力 (rénlì), 人民 (rénmín), 人民币 (rénmínbì), 人群 (rénqún), 人体 (réntǐ), 人物 (rénwù), 忍 (rěn), 认 (rèn), 日历 (rìlì), 日用品 (rìyòngpǐn), 如 (rú), 如此 (rúcǐ), 如何 (rúhé), 如今 (rújīn), 如同 (rútóng), 如下 (rúxià), 软 (ruǎn), 软件 (ruǎnjiàn), 弱 (ruò), 洒 (sǎ), 赛场 (sàichǎng), 色彩 (sècǎi), 沙漠 (shāmò), 沙子 (shāzi), 傻 (shǎ), 晒 (shài), 删 (shān), 扇 (shān), 删除 (shānchú), 山区 (shānqū), 擅长 (shàncháng), 善良 (shànliáng), 善于 (shànyú), 扇子 (shànzi), 伤 (shāng), 伤害 (shānghài), 商家 (shāngjiā), 商人 (shāngrén), 商务 (shāngwù), 商业 (shāngyè), 赏 (shǎng), 上传 (shàngchuán), 上升 (shàngshēng), 上下 (shàngxià), 上涨 (shàngzhǎng), 烧 (shāo), 烧烤 (shāokǎo), 蛇 (shé), 舍不得 (shěbude), 舍得 (shěde), 设备 (shèbèi).

设计 (shèjì), 设立 (shèlì), 社区 (shèqū), 设施 (shèshī), 摄影 (shèyǐng), 设置 (shèzhì), 伸 (shēn), 身材 (shēncái), 深度 (shēndù), 身份 (shēnfèn), 深厚 (shēnhòu), 深刻 (shēnkè), 深入 (shēnrù), 深远 (shēnyuǎn), 神话 (shénhuà), 神秘 (shénmì), 升 (shēng), 生产 (shēngchǎn), 生存 (shēngcún), 生动 (shēngdòng), 升级 (shēngjí), 升温 (shēngwēn), 生物 (shēngwù), 生肖 (shēngxiào), 生长 (shēngzhǎng), 省 (shěng), 省份 (shěngfèn), 省会 (shěnghuì), 胜 (shèng), 胜利 (shènglì), 诗 (shī), 湿 (shī), 失恋 (shīliàn), 失眠 (shīmián), 诗人 (shīrén), 失误 (shīwù), 失业 (shīyè), 时差 (shíchā), 时常 (shícháng), 时代 (shídài), 实践 (shíjiàn), 时刻 (shíkè), 实力 (shílì), 时期 (shíqī), 实施 (shíshī), 石头 (shítou), 实习 (shíxí), 实现 (shíxiàn), 实行 (shíxíng), 实验 (shíyàn), 实验室 (shíyànshì), 实用 (shíyòng), 食用 (shíyòng), 使得 (shǐde), 始终 (shǐzhōng), 式 (shì), 适当 (shìdàng), 似的 (shìde), 事故 (shìgù), 事件 (shìjiàn), 试卷 (shìjuàn), 市民 (shìmín), 事实 (shìshí), 视为 (shìwéi), 事物 (shìwù), 事先 (shìxiān), 试验 (shìyàn), 事业 (shìyè), 试用 (shìyòng), 适用 (shìyòng), 收获 (shōuhuò), 收集 (shōují), 收看 (shōukàn), 守 (shǒu), 首次 (shǒucì), 手段 (shǒuduàn), 手工 (shǒugōng), 手术 (shǒushù), 手套 (shǒutào), 手续 (shǒuxù).

手指 (shǒuzhǐ), 售价 (shòujià), 蔬菜 (shūcài), 书法 (shūfǎ), 书房 (shūfáng), 书架 (shūjià), 输入 (shūrù), 舒适 (shūshì), 熟练 (shúliàn), 熟人 (shúrén), 数 (shǔ), 鼠标 (shǔbiāo), 属于 (shǔyú), 束 (shù), 数据 (shùjù), 树木 (shùmù), 摔 (shuāi), 双方 (shuāngfāng), 水分 (shuǐfèn), 税 (shuì), 睡眠 (shuìmián), 顺 (shùn), 说不定 (shuōbudìng), 说服 (shuōfú), 思考 (sīkǎo), 私人 (sīrén), 思维 (sīwéi), 思想 (sīxiǎng), 四处 (sìchù), 似乎 (sìhū), 四周 (sìzhōu), 搜 (sōu), 搜索 (sōusuǒ), 宿舍 (sùshè), 酸甜苦辣 (suān-tián-kǔ-là), 随 (suí), 随后 (suíhòu), 随时 (suíshí), 随手 (suíshǒu), 随意 (suíyì), 碎 (suì), 损害 (sǔnhài), 损失 (sǔnshī), 缩短 (suōduǎn), 缩小 (suōxiǎo), 所 (suǒ), 锁 (suǒ), 他人 (tārén), 台灯 (táidēng), 台阶 (táijiē), 太太 (tàitai), 谈话 (tánhuà), 桃 (táo), 套 (tào), 特产 (tèchǎn), 特色 (tèsè), 特殊 (tèshū), 特有 (tèyǒu), 特征 (tèzhēng), 疼痛 (téngtòng), 提倡 (tíchàng), 提交 (tíjiāo), 题目 (tímù), 提起 (tíqǐ), 提升 (tíshēng), 提问 (tíwèn), 体会 (tǐhuì), 体力 (tǐlì), 体现 (tǐxiàn), 体验 (tǐyàn), 替 (tì), 天空 (tiānkōng), 天上 (tiānshàng), 填 (tián), 甜品 (tiánpǐn), 挑 (tiāo), 挑选 (tiāoxuǎn), 调 (tiáo), 调皮 (tiáopí), 调整 (tiáozhěng).

挑战 (tiǎozhàn), 跳高 (tiàogāo), 跳远 (tiàoyuǎn), 贴 (tiē), 铁路 (tiělù), 停留 (tíngliú), 通常 (tōngcháng), 通行 (tōngxíng), 同 (tóng), 同情 (tóngqíng), 同一 (tóngyī), 统计 (tǒngjì), 统一 (tǒngyī), 痛苦 (tòngkǔ), 投 (tóu), 投入 (tóurù), 头 (tou), 突出 (tūchū), 图画 (túhuà), 图书 (túshū), 土地 (tǔdì), 土豆 (tǔdòu), 兔子 (tùzi), 团 (tuán), 团队 (tuánduì), 推动 (tuīdòng), 推广 (tuīguǎng), 推荐 (tuījiàn), 推进 (tuījìn), 退 (tuì), 退出 (tuìchū), 退还 (tuìhuán), 退休 (tuìxiū), 拖鞋 (tuōxié), 外部 (wàibù), 外公 (wàigōng), 外观 (wàiguān), 外婆 (wàipó), 外形 (wàixíng), 弯 (wān), 玩具 (wánjù), 完美 (wánměi), 完善 (wánshàn), 完整 (wánzhěng), 万一 (wànyī), 往返 (wǎngfǎn), 网络 (wǎngluò), 危害 (wēihài), 微笑 (wēixiào), 威胁 (wēixié), 围 (wéi), 为 (wéi), 维持 (wéichí), 违法 (wéifǎ), 违反 (wéifǎn), 围巾 (wéijīn), 围绕 (wéirào), 维修 (wéixiū), 唯一 (wéiyī), 尾巴 (wěiba), 伟大 (wěidà), 胃 (wèi), 喂 (wèi), 未来 (wèilái), 位于 (wèiyú), 温暖 (wēnnuǎn), 文学 (wénxué), 稳定 (wěndìng), 问卷 (wènjuàn), 握 (wò), 卧室 (wòshì), 握手 (wòshǒu), 无关 (wúguān), 无奈 (wúnài), 无数 (wúshù), 无限 (wúxiàn), 无效 (wúxiào), 舞蹈 (wǔdǎo), 武术 (wǔshù), 舞台 (wǔtái).

五颜六色 (wǔyán-liùsè), 雾 (wù), 物价 (wùjià), 物理 (wùlǐ), 物品 (wùpǐn), 物业 (wùyè), 物质 (wùzhì), 西餐 (xīcān), 吸管 (xīguǎn), 吸收 (xīshōu), 西装 (xīzhuāng), 戏 (xì), 系 (xì), 细节 (xìjié), 戏剧 (xìjù), 系统 (xìtǒng), 先后 (xiānhòu), 先进 (xiānjìn), 闲 (xián), 显得 (xiǎnde), 显然 (xiǎnrán), 显示 (xiǎnshì), 县 (xiàn), 现场 (xiànchǎng), 现代 (xiàndài), 现代化 (xiàndàihuà), 线路 (xiànlù), 现实 (xiànshí), 现象 (xiànxiàng), 限制 (xiànzhì), 现状 (xiànzhuàng), 乡 (xiāng), 相处 (xiāngchǔ), 乡村 (xiāngcūn), 相当 (xiāngdāng), 相对 (xiāngduì), 相关 (xiāngguān), 相似 (xiāngsì), 想念 (xiǎngniàn), 响声 (xiǎngshēng), 享受 (xiǎngshòu), 想象 (xiǎngxiàng), 相册 (xiàngcè), 项目 (xiàngmù), 橡皮 (xiàngpí), 向上 (xiàngshàng), 象征 (xiàngzhēng), 消费 (xiāofèi), 消费者 (xiāofèizhě), 消化 (xiāohuà), 消极 (xiāojí), 销量 (xiāoliàng), 消失 (xiāoshī), 销售 (xiāoshòu), 小型 (xiǎoxíng), 小于 (xiǎoyú), 效率 (xiàolǜ), 斜 (xié), 协议 (xiéyì), 写作 (xiězuò), 新郎 (xīnláng), 心理 (xīnlǐ), 新娘 (xīnniáng), 新人 (xīnrén), 欣赏 (xīnshǎng), 心态 (xīntài), 新型 (xīnxíng), 信封 (xìnfēng), 信任 (xìnrèn), 信用 (xìnyòng), 行程 (xíngchéng), 形成 (xíngchéng), 行动 (xíngdòng), 行人 (xíngrén), 形容 (xíngróng), 形式 (xíngshì), 形势 (xíngshì), 行驶 (xíngshǐ), 行为 (xíngwéi), 形象 (xíngxiàng).

形状 (xíngzhuàng), 行走 (xíngzǒu), 幸运 (xìngyùn), 性质 (xìngzhì), 修改 (xiūgǎi), 修建 (xiūjiàn), 休闲 (xiūxián), 需 (xū), 需求 (xūqiú), 虚心 (xūxīn), 宣布 (xuānbù), 宣传 (xuānchuán), 选手 (xuǎnshǒu), 学分 (xuéfēn), 学科 (xuékē), 学历 (xuélì), 学年 (xuénián), 学术 (xuéshù), 学者 (xuézhě), 雪糕 (xuěgāo), 询问 (xúnwèn), 寻找 (xúnzhǎo), 训练 (xùnliàn), 迅速 (xùnsù), 呀 (yā), 押金 (yājīn), 压岁钱 (yāsuìqián), 鸭子 (yāzi), 牙齿 (yáchǐ), 沿 (yán), 延长 (yáncháng), 研发 (yánfā), 严肃 (yánsù), 研制 (yánzhì), 眼 (yǎn), 演讲 (yǎnjiǎng), 眼泪 (yǎnlèi), 阳台 (yángtái), 样式 (yàngshì), 腰 (yāo), 摇 (yáo), 咬 (yǎo), 要不 (yàobù), 药品 (yàopǐn), 药物 (yàowù), 夜间 (yèjiān), 夜市 (yèshì), 业务 (yèwù), 业余 (yèyú), 依据 (yījù), 依靠 (yīkào), 医疗 (yīliáo), 依然 (yīrán), 医学 (yīxué), 移 (yí), 移动 (yídòng), 遗憾 (yíhàn), 疑问 (yíwèn), 乙 (yǐ), 以 (yǐ), 以及 (yǐjí), 以来 (yǐlái), 亿 (yì), 意识 (yìshí), 意外 (yìwài), 意味着 (yìwèizhe), 义务 (yìwù), 意义 (yìyì), 因而 (yīn’ér), 音量 (yīnliàng), 因素 (yīnsù), 引进 (yǐnjìn), 饮食 (yǐnshí), 印刷 (yìnshuā), 应当 (yīngdāng), 迎 (yíng), 迎接 (yíngjiē), 营养 (yíngyǎng), 营业 (yíngyè), 影片 (yǐngpiàn).

影视 (yǐngshì), 硬 (yìng), 应对 (yìngduì), 硬件 (yìngjiàn), 应用 (yìngyòng), 拥抱 (yōngbào), 拥有 (yōngyǒu), 勇气 (yǒngqì), 用法 (yòngfǎ), 用户 (yònghù), 用力 (yònglì), 用品 (yòngpǐn), 用途 (yòngtú), 优惠 (yōuhuì), 悠久 (yōujiǔ), 优良 (yōuliáng), 优美 (yōuměi), 优势 (yōushì), 优质 (yōuzhì), 由此 (yóucǐ), 邮寄 (yóujì), 邮局 (yóujú), 游览 (yóulǎn), 邮票 (yóupiào), 油条 (yóutiáo), 犹豫 (yóuyù), 有害 (yǒuhài), 有力 (yǒulì), 有利 (yǒulì), 有限 (yǒuxiàn), 有益 (yǒuyì), 有助于 (yǒuzhùyú), 幼儿园 (yòu’éryuán), 娱乐 (yúlè), 语气 (yǔqì), 雨水 (yǔshuǐ), 语文 (yǔwén), 语音 (yǔyīn), 预报 (yùbào), 预测 (yùcè), 预订 (yùdìng), 预防 (yùfáng), 预计 (yùjì), 玉米 (yùmǐ), 预约 (yùyuē), 原 (yuán), 圆 (yuán), 原有 (yuányǒu), 元旦 (Yuándàn), 员工 (yuángōng), 原则 (yuánzé), 愿 (yuàn), 愿望 (yuànwàng), 约定 (yuēdìng), 运 (yùn), 运费 (yùnfèi), 运气 (yùnqi), 运输 (yùnshū), 运用 (yùnyòng), 在场 (zàichǎng), 在乎 (zàihu), 在内 (zàinèi), 在线 (zàixiàn), 在于 (zàiyú), 赞成 (zànchéng), 糟 (zāo), 糟糕 (zāogāo), 早期 (zǎoqī), 早晚 (zǎowǎn), 早已 (zǎoyǐ), 造 (zào), 造成 (zàochéng), 增 (zēng), 增进 (zēngjìn), 增强 (zēngqiáng), 赠 (zèng), 赠送 (zèngsòng), 炸 (zhá), 摘 (zhāi), 窄 (zhǎi).

展出 (zhǎnchū), 展开 (zhǎnkāi), 展览 (zhǎnlǎn), 展示 (zhǎnshì), 展现 (zhǎnxiàn), 占 (zhàn), 站台 (zhàntái), 占线 (zhànxiàn), 涨 (zhǎng), 涨价 (zhǎngjià), 掌声 (zhǎngshēng), 掌握 (zhǎngwò), 账号 (zhànghào), 账户 (zhànghù), 着凉 (zháoliáng), 召开 (zhàokāi), 折扣 (zhékòu), 哲学 (zhéxué), 真诚 (zhēnchéng), 针对 (zhēnduì), 珍贵 (zhēnguì), 真实 (zhēnshí), 珍惜 (zhēnxī), 诊断 (zhěnduàn), 阵 (zhèn), 争 (zhēng), 争取 (zhēngqǔ), 整齐 (zhěngqí), 整体 (zhěngtǐ), 整整 (zhěngzhěng), 挣 (zhèng), 政府 (zhèngfǔ), 证据 (zhèngjù), 正如 (zhèngrú), 证书 (zhèngshū), 政治 (zhèngzhì), 支 (zhī), 知名 (zhīmíng), 直 (zhí), 直播 (zhíbō), 职场 (zhíchǎng), 职工 (zhígōng), 执行 (zhíxíng), 止 (zhǐ), 指导 (zhǐdǎo), 至 (zhì), 治 (zhì), 制订 (zhìdìng), 制定 (zhìdìng), 制度 (zhìdù), 智慧 (zhìhuì), 至今 (zhìjīn), 治疗 (zhìliáo), 智能 (zhìnéng), 志愿者 (zhìyuànzhě), 制造 (zhìzào), 制作 (zhìzuò), 中华 (Zhōnghuá), 中级 (zhōngjí), 中介 (zhōngjiè), 中期 (zhōngqī), 中外 (zhōngwài), 中心 (zhōngxīn), 中药 (zhōngyào), 中医 (zhōngyī), 种类 (zhǒnglèi), 种子 (zhǒngzi), 重大 (zhòngdà), 众多 (zhòngduō), 重量 (zhòngliàng), 种植 (zhòngzhí), 周年 (zhōunián), 猪 (zhū), 逐步 (zhúbù), 逐渐 (zhújiàn), 竹子 (zhúzi), 煮 (zhǔ), 主持 (zhǔchí), 主动 (zhǔdòng), 主观 (zhǔguān).

主人 (zhǔrén), 主任 (zhǔrèn), 主食 (zhǔshí), 主题 (zhǔtí), 主席 (zhǔxí), 注册 (zhùcè), 住房 (zhùfáng), 住宿 (zhùsù), 住址 (zhùzhǐ), 注重 (zhùzhòng), 抓 (zhuā), 抓紧 (zhuājǐn), 专家 (zhuānjiā), 专心 (zhuānxīn), 转变 (zhuǎnbiàn), 转告 (zhuǎngào), 装饰 (zhuāngshì), 装修 (zhuāngxiū), 撞 (zhuàng), 状况 (zhuàngkuàng), 状态 (zhuàngtài), 追 (zhuī), 追求 (zhuīqiú), 资格 (zīgé), 资金 (zījīn), 姿势 (zīshì), 咨询 (zīxún), 资源 (zīyuán), 紫 (zǐ), 子女 (zǐnǚ), 自从 (zìcóng), 自动 (zìdòng), 自觉 (zìjué), 字母 (zìmǔ), 自身 (zìshēn), 自由 (zìyóu), 综合 (zōnghé), 总部 (zǒngbù), 总共 (zǒnggòng), 总数 (zǒngshù), 总体 (zǒngtǐ), 总统 (zǒngtǒng), 总之 (zǒngzhī), 租金 (zūjīn), 族 (zú), 足够 (zúgòu), 组成 (zǔchéng), 组合 (zǔhé), 阻止 (zǔzhǐ), 组织 (zǔzhī), 嘴巴 (zuǐba), 醉 (zuì), 最初 (zuìchū), 最佳 (zuìjiā), 尊敬 (zūnjìng), 遵守 (zūnshǒu), 作出 (zuòchū).

### HSK 6 (1763)

岸 (àn), 案例 (ànlì), 按摩 (ànmó), 暗示 (ànshì), 昂贵 (ángguì), 白白 (báibái), 白领 (báilǐng), 摆 (bǎi), 摆放 (bǎifàng), 百分点 (bǎifēndiǎn), 百货 (bǎihuò), 摆脱 (bǎituō), 败 (bài), 拜访 (bàifǎng), 拜年 (bàinián), 版 (bǎn), 版本 (bǎnběn), 伴随 (bànsuí), 扮演 (bànyǎn), 榜样 (bǎngyàng), 棒球 (bàngqiú), 保管 (bǎoguǎn), 保健 (bǎojiàn), 保暖 (bǎonuǎn), 保修 (bǎoxiū), 保障 (bǎozhàng), 爆 (bào), 爆发 (bàofā), 报刊 (bàokān), 暴力 (bàolì), 暴露 (bàolù), 报社 (bàoshè), 爆炸 (bàozhà), 悲观 (bēiguān), 悲剧 (bēijù), 悲伤 (bēishāng), 北极 (běijí), 北美洲 (Běiměizhōu), 被动 (bèidòng), 被迫 (bèipò), 背心 (bèixīn), 备用 (bèiyòng), 倍增 (bèizēng), 奔跑 (bēnpǎo), 本能 (běnnéng), 本身 (běnshēn), 本土 (běntǔ), 逼 (bī), 比方 (bǐfang), 比重 (bǐzhòng), 闭 (bì), 避 (bì), 必修 (bìxiū), 编 (biān), 编辑 (biānjí), 编写 (biānxiě), 遍地 (biàndì), 便捷 (biànjié), 变质 (biànzhì), 兵 (bīng), 病毒 (bìngdú), 播 (bō), 播种 (bōzhǒng), 博览会 (bólǎnhuì), 薄弱 (bóruò), 脖子 (bózi), 补 (bǔ), 捕 (bǔ), 补偿 (bǔcháng), 补课 (bǔkè), 补贴 (bǔtiē), 补习 (bǔxí), 布 (bù), 不安 (bù’ān), 不曾 (bùcéng), 不成 (bùchéng), 不得 (bùdé), 部队 (bùduì), 不禁 (bùjīn), 不时 (bùshí).

部位 (bùwèi), 不许 (bùxǔ), 不宜 (bùyí), 不已 (bùyǐ), 布置 (bùzhì), 不止 (bùzhǐ), 步骤 (bùzhòu), 猜测 (cāicè), 财产 (cáichǎn), 财富 (cáifù), 才华 (cáihuá), 才能 (cáinéng), 财务 (cáiwù), 财物 (cáiwù), 材质 (cáizhì), 踩 (cǎi), 采购 (cǎigòu), 彩虹 (cǎihóng), 采集 (cǎijí), 采纳 (cǎinà), 彩票 (cǎipiào), 参展 (cānzhǎn), 残疾 (cánjí), 仓库 (cāngkù), 草原 (cǎoyuán), 侧 (cè), 策划 (cèhuà), 测量 (cèliáng), 策略 (cèlüè), 层次 (céngcì), 层面 (céngmiàn), 叉 (chā), 差异 (chāyì), 插座 (chāzuò), 查询 (cháxún), 拆除 (chāichú), 产出 (chǎnchū), 产地 (chǎndì), 肠 (cháng), 长短 (chángduǎn), 常规 (chángguī), 常年 (chángnián), 长寿 (chángshòu), 常温 (chángwēn), 场次 (chǎngcì), 场地 (chǎngdì), 场馆 (chǎngguǎn), 场合 (chǎnghé), 厂家 (chǎngjiā), 场景 (chǎngjǐng), 场面 (chǎngmiàn), 厂商 (chǎngshāng), 畅通 (chàngtōng), 畅销 (chàngxiāo), 抄 (chāo), 超越 (chāoyuè), 朝代 (cháodài), 潮流 (cháoliú), 潮湿 (cháoshī), 嘲笑 (cháoxiào), 炒股 (chǎogǔ), 吵架 (chǎojià), 撤回 (chèhuí), 撤销 (chèxiāo), 沉重 (chénzhòng), 趁 (chèn), 撑 (chēng), 称号 (chēnghào), 称呼 (chēnghu), 称作 (chēngzuò), 成 (chéng), 乘 (chéng), 盛 (chéng), 承办 (chéngbàn), 惩罚 (chéngfá), 成交 (chéngjiāo), 承诺 (chéngnuò), 成千上万 (chéngqiān-shàngwàn), 呈现 (chéngxiàn), 成效 (chéngxiào).

诚信 (chéngxìn), 成语 (chéngyǔ), 城镇 (chéngzhèn), 持久 (chíjiǔ), 持有 (chíyǒu), 尺 (chǐ), 冲动 (chōngdòng), 冲击 (chōngjī), 充实 (chōngshí), 冲突 (chōngtū), 崇拜 (chóngbài), 重建 (chóngjiàn), 冲 (chòng), 抽奖 (chōujiǎng), 抽象 (chōuxiàng), 愁 (chóu), 筹备 (chóubèi), 初步 (chūbù), 出场 (chūchǎng), 初等 (chūděng), 出境 (chūjìng), 出力 (chūlì), 出名 (chūmíng), 出入 (chūrù), 出示 (chūshì), 出游 (chūyóu), 出于 (chūyú), 除 (chú), 除非 (chúfēi), 储存 (chǔcún), 处罚 (chǔfá), 储蓄 (chǔxù), 处处 (chùchù), 穿过 (chuānguò), 传承 (chuánchéng), 传达 (chuándá), 传染 (chuánrǎn), 传染病 (chuánrǎnbìng), 传授 (chuánshòu), 传输 (chuánshū), 传真 (chuánzhēn), 船只 (chuánzhī), 串 (chuàn), 窗口 (chuāngkǒu), 闯 (chuǎng), 创办 (chuàngbàn), 创建 (chuàngjiàn), 创立 (chuànglì), 创意 (chuàngyì), 垂直 (chuízhí), 纯 (chún), 瓷器 (cíqì), 此刻 (cǐkè), 刺 (cì), 次数 (cìshù), 匆匆 (cōngcōng), 匆忙 (cōngmáng), 从未 (cóngwèi), 从业 (cóngyè), 醋 (cù), 脆 (cuì), 脆弱 (cuìruò), 村庄 (cūnzhuāng), 存储 (cúnchǔ), 寸 (cùn), 挫折 (cuòzhé), 搭 (dā), 搭配 (dāpèi), 答复 (dáfù), 打动 (dǎdòng), 打击 (dǎjī), 打架 (dǎjià), 打卡 (dǎkǎ), 打雷 (dǎléi), 打造 (dǎzào), 打仗 (dǎzhàng), 大臣 (dàchén), 大地 (dàdì), 大都 (dàdū), 大方 (dàfang).

大幅 (dàfú), 大伙儿 (dàhuǒr), 大使 (dàshǐ), 大师 (dàshī), 大洋洲 (Dàyángzhōu), 大致 (dàzhì), 呆 (dāi), 待 (dài), 代价 (dàijià), 贷款 (dàikuǎn), 代理 (dàilǐ), 带领 (dàilǐng), 单纯 (dānchún), 单调 (dāndiào), 耽误 (dānwu), 担忧 (dānyōu), 蛋白质 (dànbáizhì), 诞生 (dànshēng), 当场 (dāngchǎng), 当初 (dāngchū), 当代 (dāngdài), 当今 (dāngjīn), 当面 (dāngmiàn), 当下 (dāngxià), 当选 (dāngxuǎn), 档案 (dàng’àn), 当天 (dàngtiān), 岛 (dǎo), 倒闭 (dǎobì), 倒车 (dǎochē), 导师 (dǎoshī), 道德 (dàodé), 得了 (déle), 得以 (déyǐ), 得知 (dézhī), 等级 (děngjí), 滴 (dī), 低碳 (dītàn), 抵达 (dǐdá), 抵抗 (dǐkàng), 地道 (dìdao), 地方 (dìfāng), 地形 (dìxíng), 地域 (dìyù), 地质 (dìzhì), 点击 (diǎnjī), 典礼 (diǎnlǐ), 点燃 (diǎnrán), 典型 (diǎnxíng), 电饭锅 (diànfànguō), 电力 (diànlì), 店铺 (diànpù), 电源 (diànyuán), 吊 (diào), 调动 (diàodòng), 钓鱼 (diàoyú), 跌 (diē), 顶 (dǐng), 订单 (dìngdān), 订婚 (dìnghūn), 定价 (dìngjià), 定时 (dìngshí), 定位 (dìngwèi), 定义 (dìngyì), 定制 (dìngzhì), 栋 (dòng), 动机 (dòngjī), 动力 (dònglì), 动漫 (dòngmàn), 动态 (dòngtài), 动听 (dòngtīng), 逗 (dòu), 斗争 (dòuzhēng), 都市 (dūshì), 毒 (dú), 渡 (dù), 端 (duān), 短缺 (duǎnquē), 对称 (duìchèn), 对接 (duìjiē).

对抗 (duìkàng), 对立 (duìlì), 对应 (duìyìng), 蹲 (dūn), 顿时 (dùnshí), 多才多艺 (duōcái-duōyì), 多亏 (duōkuī), 多媒体 (duōméitǐ), 多余 (duōyú), 多元 (duōyuán), 夺 (duó), 夺取 (duóqǔ), 躲避 (duǒbì), 恶劣 (èliè), 儿科 (érkē), 耳环 (ěrhuán), 二氧化碳 (èryǎnghuàtàn), 发病 (fābìng), 发愁 (fāchóu), 发电 (fādiàn), 发动 (fādòng), 发放 (fāfàng), 发光 (fāguāng), 发票 (fāpiào), 发行 (fāxíng), 发炎 (fāyán), 发育 (fāyù), 法定 (fǎdìng), 法官 (fǎguān), 法规 (fǎguī), 番 (fān), 繁忙 (fánmáng), 凡是 (fánshì), 繁殖 (fánzhí), 反馈 (fǎnkuì), 反思 (fǎnsī), 犯 (fàn), 方方面面 (fāngfāngmiànmiàn), 方位 (fāngwèi), 方言 (fāngyán), 妨碍 (fáng’ài), 房价 (fángjià), 防治 (fángzhì), 访谈 (fǎngtán), 放大 (fàngdà), 放飞 (fàngfēi), 飞速 (fēisù), 肥 (féi), 肥胖 (féipàng), 肥沃 (féiwò), 肺 (fèi), 肺炎 (fèiyán), 分工 (fēngōng), 分级 (fēnjí), 分期 (fēnqī), 分散 (fēnsàn), 氛围 (fēnwéi), 粉 (fěn), 愤怒 (fènnù), 封闭 (fēngbì), 风光 (fēngguāng), 风力 (fēnglì), 丰收 (fēngshōu), 风雨 (fēngyǔ), 奉献 (fèngxiàn), 服 (fú), 浮 (fú), 服从 (fúcóng), 幅度 (fúdù), 符号 (fúhào), 福利 (fúlì), 服用 (fúyòng), 辅导 (fǔdǎo), 辅助 (fǔzhù), 副 (fù), 覆盖 (fùgài), 附件 (fùjiàn), 负面 (fùmiàn), 富裕 (fùyù), 赋予 (fùyǔ).

该 (gāi), 改编 (gǎibiān), 改造 (gǎizào), 概率 (gàilǜ), 肝 (gān), 干脆 (gāncuì), 尴尬 (gāngà), 干旱 (gānhàn), 干扰 (gānrǎo), 干燥 (gānzào), 感激 (gǎnjī), 赶忙 (gǎnmáng), 感染 (gǎnrǎn), 感想 (gǎnxiǎng), 钢笔 (gāngbǐ), 港口 (gǎngkǒu), 岗位 (gǎngwèi), 高层 (gāocéng), 高超 (gāochāo), 高等 (gāoděng), 高端 (gāoduān), 高峰 (gāofēng), 高尚 (gāoshàng), 高手 (gāoshǒu), 高新技术 (gāoxīn-jìshù), 高原 (gāoyuán), 稿件 (gǎojiàn), 稿子 (gǎozi), 割 (gē), 歌唱 (gēchàng), 隔壁 (gébì), 革命 (gémìng), 个体 (gètǐ), 给予 (jǐyǔ), 跟前 (gēnqián), 跟随 (gēnsuí), 跟踪 (gēnzōng), 公 (gōng), 宫 (gōng), 公安 (gōng’ān), 工地 (gōngdì), 工夫 (gōngfu), 公告 (gōnggào), 供给 (gōngjǐ), 攻击 (gōngjī), 公开 (gōngkāi), 公民 (gōngmín), 公认 (gōngrèn), 功效 (gōngxiào), 工序 (gōngxù), 公益 (gōngyì), 供应 (gōngyìng), 公元 (gōngyuán), 公正 (gōngzhèng), 公众 (gōngzhòng), 公主 (gōngzhǔ), 巩固 (gǒnggù), 共计 (gòngjì), 沟 (gōu), 构造 (gòuzào), 孤独 (gūdú), 姑姑 (gūgu), 古典 (gǔdiǎn), 古迹 (gǔjì), 股票 (gǔpiào), 古人 (gǔrén), 股市 (gǔshì), 骨头 (gǔtou), 鼓舞 (gǔwǔ), 顾 (gù), 固体 (gùtǐ), 顾问 (gùwèn), 故障 (gùzhàng), 拐 (guǎi), 拐弯 (guǎiwān), 官 (guān), 关爱 (guān’ài), 官方 (guānfāng), 观光 (guānguāng), 关怀 (guānhuái).

关联 (guānlián), 观赏 (guānshǎng), 官员 (guānyuán), 管道 (guǎndào), 罐 (guàn), 广阔 (guǎngkuò), 归 (guī), 规范 (guīfàn), 规划 (guīhuà), 归还 (guīhuán), 规矩 (guīju), 轨道 (guǐdào), 跪 (guì), 贵重 (guìzhòng), 棍 (gùn), 国宝 (guóbǎo), 国产 (guóchǎn), 国歌 (guógē), 国旗 (guóqí), 国情 (guóqíng), 国王 (guówáng), 过渡 (guòdù), 过后 (guòhòu), 过时 (guòshí), 海内外 (hǎinèiwài), 海岸 (hǎi’àn), 海拔 (hǎibá), 海面 (hǎimiàn), 海域 (hǎiyù), 害 (hài), 寒冬 (hándōng), 含义 (hányì), 罕见 (hǎnjiàn), 旱灾 (hànzāi), 航空 (hángkōng), 毫不 (háobù), 毫无 (háowú), 毫米 (háomǐ), 毫升 (háoshēng), 好不 (hǎobù), 好感 (hǎogǎn), 好容易 (hǎoróngyì), 好客 (hàokè), 好学 (hàoxué), 号召 (hàozhào), 合并 (hébìng), 合成 (héchéng), 和平 (hépíng), 和谐 (héxié), 核心 (héxīn), 嘿 (hēi), 黑暗 (hēi’àn), 痕迹 (hénjì), 狠 (hěn), 恨 (hèn), 横 (héng), 衡量 (héngliáng), 宏大 (hóngdà), 洪水 (hóngshuǐ), 后代 (hòudài), 后期 (hòuqī), 后人 (hòurén), 后退 (hòutuì), 后者 (hòuzhě), 忽略 (hūlüè), 壶 (hú), 胡子 (húzi), 户 (hù), 互助 (hùzhù), 花朵 (huāduǒ), 花生 (huāshēng), 滑冰 (huábīng), 滑行 (huáxíng), 滑雪 (huáxuě), 划 (huà), 划分 (huàfēn), 化石 (huàshí), 话筒 (huàtǒng), 化妆 (huàzhuāng), 怀 (huái).

怀念 (huáiniàn), 怀孕 (huáiyùn), 欢乐 (huānlè), 环 (huán), 还原 (huányuán), 患 (huàn), 幻想 (huànxiǎng), 患者 (huànzhě), 黄 (huáng), 皇帝 (huángdì), 灰尘 (huīchén), 灰心 (huīxīn), 回报 (huíbào), 回顾 (huígù), 回头 (huítóu), 汇 (huì), 汇报 (huìbào), 绘画 (huìhuà), 会见 (huìjiàn), 汇款 (huìkuǎn), 婚姻 (hūnyīn), 混 (hùn), 混合 (hùnhé), 混乱 (hùnluàn), 活力 (huólì), 活跃 (huóyuè), 火柴 (huǒchái), 火灾 (huǒzāi), 货币 (huòbì), 货车 (huòchē), 击败 (jībài), 基地 (jīdì), 机动车 (jīdòngchē), 饥饿 (jī’è), 激发 (jīfā), 基金 (jījīn), 激励 (jīlì), 激情 (jīqíng), 机械 (jīxiè), 基因 (jīyīn), 机遇 (jīyù), 机制 (jīzhì), 即便 (jíbiàn), 极端 (jíduān), 急救 (jíjiù), 急切 (jíqiè), 集团 (jítuán), 极为 (jíwéi), 吉祥 (jíxiáng), 继承 (jìchéng), 季军 (jìjūn), 纪律 (jìlǜ), 寂寞 (jìmò), 技巧 (jìqiǎo), 技艺 (jìyì), 夹 (jiā), 加倍 (jiābèi), 家常 (jiācháng), 家家户户 (jiājiāhùhù), 加剧 (jiājù), 家居 (jiājū), 家属 (jiāshǔ), 加以 (jiāyǐ), 家园 (jiāyuán), 加重 (jiāzhòng), 假设 (jiǎshè), 嫁 (jià), 尖 (jiān), 肩膀 (jiānbǎng), 监测 (jiāncè), 坚定 (jiāndìng), 监督 (jiāndū), 坚固 (jiāngù), 坚决 (jiānjué), 艰难 (jiānnán), 艰辛 (jiānxīn), 坚硬 (jiānyìng), 兼职 (jiānzhí), 检测 (jiǎncè), 简化 (jiǎnhuà).

简介 (jiǎnjiè), 减弱 (jiǎnruò), 减压 (jiǎnyā), 检验 (jiǎnyàn), 剑 (jiàn), 箭 (jiàn), 鉴定 (jiàndìng), 间隔 (jiàngé), 间接 (jiànjiē), 健全 (jiànquán), 建筑物 (jiànzhùwù), 将军 (jiāngjūn), 讲解 (jiǎngjiě), 奖牌 (jiǎngpái), 奖品 (jiǎngpǐn), 酱 (jiàng), 酱油 (jiàngyóu), 胶带 (jiāodài), 焦点 (jiāodiǎn), 交际 (jiāojì), 焦虑 (jiāolǜ), 胶水 (jiāoshuǐ), 交谈 (jiāotán), 郊外 (jiāowài), 角落 (jiǎoluò), 脚印 (jiǎoyìn), 较为 (jiàowéi), 结 (jiē), 结果 (jiēguǒ), 接连 (jiēlián), 结实 (jiēshi), 街头 (jiētóu), 杰出 (jiéchū), 节能 (jiénéng), 结尾 (jiéwěi), 截至 (jiézhì), 截止 (jiézhǐ), 节奏 (jiézòu), 解 (jiě), 解答 (jiědá), 解读 (jiědú), 解放 (jiěfàng), 解说 (jiěshuō), 借鉴 (jièjiàn), 戒指 (jièzhi), 借助 (jièzhù), 金额 (jīn’é), 金牌 (jīnpái), 金钱 (jīnqián), 金融 (jīnróng), 金属 (jīnshǔ), 金子 (jīnzi), 尽 (jìn), 进而 (jìn’ér), 进度 (jìndù), 进化 (jìnhuà), 近来 (jìnlái), 近视 (jìnshì), 进展 (jìnzhǎn), 精美 (jīngměi), 精确 (jīngquè), 惊人 (jīngrén), 经商 (jīngshāng), 精通 (jīngtōng), 精心 (jīngxīn), 惊讶 (jīngyà), 精致 (jīngzhì), 精准 (jīngzhǔn), 井 (jǐng), 警告 (jǐnggào), 景观 (jǐngguān), 景象 (jǐngxiàng), 颈椎 (jǐngzhuī), 净 (jìng), 竞赛 (jìngsài), 镜头 (jìngtóu), 纠纷 (jiūfēn), 纠正 (jiūzhèng), 酒精 (jiǔjīng), 酒水 (jiǔshuǐ).

就读 (jiùdú), 舅舅 (jiùjiu), 救命 (jiùmìng), 就算 (jiùsuàn), 救援 (jiùyuán), 救灾 (jiùzāi), 救助 (jiùzhù), 局 (jú), 局 (jú), 菊花 (júhuā), 局面 (júmiàn), 局限 (júxiàn), 举动 (jǔdòng), 剧本 (jùběn), 聚集 (jùjí), 俱乐部 (jùlèbù), 剧烈 (jùliè), 捐款 (juānkuǎn), 捐赠 (juānzèng), 卷 (juǎn), 卷 (juàn), 决策 (juécè), 绝望 (juéwàng), 军队 (jūnduì), 军人 (jūnrén), 均匀 (jūnyún), 卡片 (kǎpiàn), 开创 (kāichuàng), 开关 (kāiguān), 开启 (kāiqǐ), 开设 (kāishè), 开头 (kāitóu), 砍 (kǎn), 看不起 (kànbuqǐ), 看待 (kàndài), 看得起 (kàndeqǐ), 看好 (kànhǎo), 看似 (kànsì), 看中 (kànzhòng), 看重 (kànzhòng), 康复 (kāngfù), 考察 (kǎochá), 考古 (kǎogǔ), 考核 (kǎohé), 考验 (kǎoyàn), 科 (kē), 科幻 (kēhuàn), 科目 (kēmù), 科普 (kēpǔ), 可口 (kěkǒu), 可怜 (kělián), 渴望 (kěwàng), 可行 (kěxíng), 客车 (kèchē), 课题 (kètí), 肯 (kěn), 恐惧 (kǒngjù), 空地 (kòngdì), 空闲 (kòngxián), 口感 (kǒugǎn), 口号 (kǒuhào), 口腔 (kǒuqiāng), 口头 (kǒutóu), 扣 (kòu), 枯燥 (kūzào), 酷 (kù), 夸 (kuā), 夸奖 (kuājiǎng), 夸张 (kuāzhāng), 会计 (kuàijì), 快捷 (kuàijié), 款 (kuǎn), 款式 (kuǎnshì), 亏损 (kuīsǔn), 困扰 (kùnrǎo), 扩展 (kuòzhǎn), 落 (là), 辣椒 (làjiāo), 啦 (la), 来临 (láilín).

来往 (láiwǎng), 赖 (lài), 拦 (lán), 栏 (lán), 兰花 (lánhuā), 烂 (làn), 狼 (láng), 朗读 (lǎngdú), 牢 (láo), 劳动力 (láodònglì), 老实 (lǎoshi), 老鼠 (lǎoshǔ), 老太太 (lǎotàitai), 乐于 (lèyú), 雷 (léi), 类别 (lèibié), 理 (lǐ), 理财 (lǐcái), 理科 (lǐkē), 理念 (lǐniàn), 理性 (lǐxìng), 立 (lì), 粒 (lì), 立场 (lìchǎng), 力度 (lìdù), 历经 (lìjīng), 历年 (lìnián), 例外 (lìwài), 利息 (lìxī), 联合国 (Liánhéguó), 联网 (liánwǎng), 联想 (liánxiǎng), 链接 (liànjiē), 两岸 (liǎng’àn), 两极 (liǎngjí), 晾 (liàng), 料 (liào), 料 (liào), 淋 (lín), 凌晨 (língchén), 流程 (liúchéng), 流动 (liúdòng), 浏览器 (liúlǎnqì), 流量 (liúliàng), 流入 (liúrù), 流通 (liútōng), 楼道 (lóudào), 露 (lòu), 漏洞 (lòudòng), 露 (lù), 路程 (lùchéng), 路况 (lùkuàng), 路面 (lùmiàn), 录像 (lùxiàng), 录用 (lùyòng), 录制 (lùzhì), 旅程 (lǚchéng), 旅途 (lǚtú), 履行 (lǚxíng), 率 (lǜ), 绿化 (lǜhuà), 轮 (lún), 轮船 (lúnchuán), 轮流 (lúnliú), 轮椅 (lúnyǐ), 轮子 (lúnzi), 论坛 (lùntán), 落地 (luòdì), 落后 (luòhòu), 马虎 (mǎhu), 码头 (mǎtóu), 蚂蚁 (mǎyǐ), 嘛 (ma), 埋 (mái), 迈 (mài), 麦克风 (màikèfēng), 漫长 (màncháng), 漫画 (mànhuà), 盲人 (mángrén), 冒 (mào).

冒险 (màoxiǎn), 贸易 (màoyì), 煤 (méi), 梅花 (méihuā), 眉毛 (méimao), 美观 (měiguān), 弥补 (míbǔ), 迷人 (mírén), 密 (mì), 密度 (mìdù), 蜜蜂 (mìfēng), 密集 (mìjí), 棉 (mián), 免 (miǎn), 勉强 (miǎnqiǎng), 免税 (miǎnshuì), 免疫 (miǎnyì), 面部 (miànbù), 面粉 (miànfěn), 面子 (miànzi), 描绘 (miáohuì), 描写 (miáoxiě), 妙 (miào), 灭 (miè), 民歌 (míngē), 民间 (mínjiān), 民俗 (mínsú), 民宿 (mínsù), 民众 (mínzhòng), 民主 (mínzhǔ), 名额 (míng’é), 明亮 (míngliàng), 明明 (míngmíng), 名气 (míngqi), 名胜 (míngshèng), 命令 (mìnglìng), 命名 (mìngmíng), 模仿 (mófǎng), 模拟 (mónǐ), 模特儿 (mótèr), 摩托车 (mótuōchē), 模型 (móxíng), 默默 (mòmò), 模样 (múyàng), 母 (mǔ), 母语 (mǔyǔ), 木材 (mùcái), 目录 (mùlù), 奶粉 (nǎifěn), 难点 (nándiǎn), 南极洲 (Nánjízhōu), 南美洲 (Nánměizhōu), 难免 (nánmiǎn), 脑袋 (nǎodai), 脑子 (nǎozi), 内涵 (nèihán), 内科 (nèikē), 内外 (nèiwài), 内衣 (nèiyī), 能量 (néngliàng), 能源 (néngyuán), 泥 (ní), 年度 (niándù), 年终 (niánzhōng), 念书 (niànshū), 扭 (niǔ), 农产品 (nóngchǎnpǐn), 浓厚 (nónghòu), 农田 (nóngtián), 暖 (nuǎn), 暖气 (nuǎnqì), 偶像 (ǒuxiàng), 排除 (páichú), 排放 (páifàng), 排练 (páiliàn), 排名 (páimíng), 盘 (pán), 盼望 (pànwàng), 庞大 (pángdà), 抛 (pāo).

泡 (pào), 赔偿 (péicháng), 陪同 (péitóng), 培育 (péiyù), 配备 (pèibèi), 佩服 (pèifú), 配套 (pèitào), 喷 (pēn), 捧 (pěng), 碰撞 (pèngzhuàng), 披 (pī), 皮 (pí), 疲劳 (píláo), 片刻 (piànkè), 片面 (piànmiàn), 骗子 (piànzi), 飘 (piāo), 漂 (piāo), 频道 (píndào), 频繁 (pínfán), 贫困 (pínkùn), 频率 (pínlǜ), 品尝 (pǐncháng), 平等 (píngděng), 平凡 (píngfán), 平方 (píngfāng), 平方米 (píngfāngmǐ), 评估 (pínggū), 评论 (pínglùn), 评选 (píngxuǎn), 坡 (pō), 泼 (pō), 破产 (pòchǎn), 迫切 (pòqiè), 扑 (pū), 铺 (pū), 扑灭 (pūmiè), 朴素 (pǔsù), 欺骗 (qīpiàn), 期望 (qīwàng), 期限 (qīxiàn), 其间 (qíjiān), 齐全 (qíquán), 棋子 (qízǐ), 起初 (qǐchū), 起点 (qǐdiǎn), 启动 (qǐdòng), 启发 (qǐfā), 启示 (qǐshì), 启事 (qǐshì), 起源 (qǐyuán), 气氛 (qìfēn), 气体 (qìtǐ), 气味 (qìwèi), 气质 (qìzhì), 恰当 (qiàdàng), 恰好 (qiàhǎo), 恰恰 (qiàqià), 牵 (qiān), 千家万户 (qiānjiā-wànhù), 谦虚 (qiānxū), 前景 (qiánjǐng), 潜力 (qiánlì), 前期 (qiánqī), 前提 (qiántí), 前者 (qiánzhě), 枪 (qiāng), 墙壁 (qiángbì), 强化 (qiánghuà), 强壮 (qiángzhuàng), 强迫 (qiǎngpò), 瞧 (qiáo), 桥梁 (qiáoliáng), 巧妙 (qiǎomiào), 切实 (qièshí), 亲密 (qīnmì), 亲属 (qīnshǔ), 勤劳 (qínláo), 清 (qīng), 清晨 (qīngchén).

青春 (qīngchūn), 青春期 (qīngchūnqī), 清淡 (qīngdàn), 清洁 (qīngjié), 清理 (qīnglǐ), 清扫 (qīngsǎo), 倾听 (qīngtīng), 清洗 (qīngxǐ), 清晰 (qīngxī), 倾向 (qīngxiàng), 清醒 (qīngxǐng), 情节 (qíngjié), 晴朗 (qínglǎng), 情形 (qíngxing), 求 (qiú), 求婚 (qiúhūn), 求救 (qiújiù), 求职 (qiúzhí), 求助 (qiúzhù), 区分 (qūfēn), 渠道 (qúdào), 曲 (qǔ), 娶 (qǔ), 取代 (qǔdài), 趣味 (qùwèi), 圈 (quān), 全程 (quánchéng), 权力 (quánlì), 券 (quàn), 缺陷 (quēxiàn), 确立 (quèlì), 群众 (qúnzhòng), 燃料 (ránliào), 染 (rǎn), 热点 (rèdiǎn), 热度 (rèdù), 热门 (rèmén), 热水器 (rèshuǐqì), 热线 (rèxiàn), 热议 (rèyì), 人工智能 (réngōngzhìnéng), 人家 (rénjia), 人均 (rénjūn), 人山人海 (rénshān-rénhǎi), 人士 (rénshì), 人事 (rénshì), 人为 (rénwéi), 人行道 (rénxíngdào), 忍受 (rěnshòu), 认错 (rèncuò), 认定 (rèndìng), 认可 (rènkě), 认同 (rèntóng), 认知 (rènzhī), 仍旧 (réngjiù), 日后 (rìhòu), 日前 (rìqián), 日夜 (rìyè), 日益 (rìyì), 融合 (rónghé), 融化 (rónghuà), 容量 (róngliàng), 融入 (róngrù), 荣誉 (róngyù), 柔软 (róuruǎn), 入境 (rùjìng), 入门 (rùmén), 入选 (rùxuǎn), 弱点 (ruòdiǎn), 撒 (sǎ), 塞 (sāi), 赛事 (sàishì), 散 (sǎn), 散文 (sǎnwén), 散 (sàn), 散发 (sànfā), 嗓子 (sǎngzi), 丧失 (sàngshī), 扫描 (sǎomiáo), 杀 (shā).

刹车 (shāchē), 鲨鱼 (shāyú), 筛选 (shāixuǎn), 山顶 (shāndǐng), 山峰 (shānfēng), 山坡 (shānpō), 闪 (shǎn), 闪电 (shǎndiàn), 扇 (shàn), 商标 (shāngbiāo), 伤口 (shāngkǒu), 伤亡 (shāngwáng), 伤员 (shāngyuán), 上当 (shàngdàng), 上级 (shàngjí), 上进 (shàngjìn), 上市 (shàngshì), 上述 (shàngshù), 上台 (shàngtái), 上旬 (shàngxún), 少儿 (shào’ér), 舌头 (shétou), 社 (shè), 射 (shè), 涉及 (shèjí), 射击 (shèjī), 摄像 (shèxiàng), 设想 (shèxiǎng), 摄像头 (shèxiàngtóu), 身心 (shēnxīn), 深夜 (shēnyè), 神 (shén), 神经 (shénjīng), 神奇 (shénqí), 审美 (shěnměi), 升 (shēng), 生成 (shēngchéng), 声调 (shēngdiào), 生命力 (shēngmìnglì), 生态 (shēngtài), 升学 (shēngxué), 剩余 (shèngyú), 诗词 (shīcí), 湿度 (shīdù), 师父 (shīfu), 诗歌 (shīgē), 狮子 (shīzi), 识 (shí), 拾 (shí), 识别 (shíbié), 时光 (shíguāng), 实话 (shíhuà), 实惠 (shíhuì), 时机 (shíjī), 时尚 (shíshàng), 实时 (shíshí), 时速 (shísù), 石油 (shíyóu), 食欲 (shíyù), 实质 (shízhì), 十足 (shízú), 使劲 (shǐjìn), 士兵 (shìbīng), 适度 (shìdù), 示范 (shìfàn), 释放 (shìfàng), 事后 (shìhòu), 视觉 (shìjué), 视力 (shìlì), 试图 (shìtú), 事务 (shìwù), 事项 (shìxiàng), 适宜 (shìyí), 收藏 (shōucáng), 收购 (shōugòu), 收取 (shōuqǔ), 收益 (shōuyì), 手臂 (shǒubì), 手法 (shǒufǎ), 手势 (shǒushì).

首要 (shǒuyào), 寿命 (shòumìng), 受灾 (shòuzāi), 输出 (shūchū), 书画 (shūhuà), 书籍 (shūjí), 书面 (shūmiàn), 输送 (shūsòng), 书写 (shūxiě), 属 (shǔ), 薯片 (shǔpiàn), 竖 (shù), 树立 (shùlì), 数目 (shùmù), 数字化 (shùzìhuà), 衰老 (shuāilǎo), 率领 (shuàilǐng), 率先 (shuàixiān), 水稻 (shuǐdào), 水库 (shuǐkù), 水流 (shuǐliú), 水面 (shuǐmiàn), 水泥 (shuǐní), 瞬间 (shùnjiān), 思路 (sīlù), 思念 (sīniàn), 死亡 (sǐwáng), 松 (sōng), 艘 (sōu), 搜集 (sōují), 塑造 (sùzào), 素质 (sùzhì), 算了 (suànle), 算是 (suànshì), 虽 (suī), 岁数 (suìshu), 岁月 (suìyuè), 损坏 (sǔnhuài), 损伤 (sǔnshāng), 所 (suǒ), 踏实 (tāshi), 塔 (tǎ), 台风 (táifēng), 台球 (táiqiú), 太空 (tàikōng), 太阳能 (tàiyángnéng), 谈论 (tánlùn), 谈判 (tánpàn), 弹性 (tánxìng), 探索 (tànsuǒ), 探讨 (tàntǎo), 汤圆 (tāngyuán), 糖果 (tángguǒ), 烫 (tàng), 掏 (tāo), 逃 (táo), 逃跑 (táopǎo), 淘气 (táoqì), 淘汰 (táotài), 套餐 (tàocān), 特 (tè), 特长 (tècháng), 特地 (tèdì), 特定 (tèdìng), 特性 (tèxìng), 特意 (tèyì), 题材 (tícái), 提取 (tíqǔ), 提示 (tíshì), 体操 (tǐcāo), 体积 (tǐjī), 体系 (tǐxì), 添 (tiān), 天才 (tiāncái), 添加 (tiānjiā), 天然 (tiānrán), 天然气 (tiānránqì), 天文 (tiānwén), 天下 (tiānxià), 天真 (tiānzhēn).

田 (tián), 田径 (tiánjìng), 调节 (tiáojié), 跳水 (tiàoshuǐ), 贴近 (tiējìn), 听话 (tīnghuà), 听觉 (tīngjué), 听取 (tīngqǔ), 通道 (tōngdào), 通风 (tōngfēng), 通话 (tōnghuà), 通信 (tōngxìn), 通讯 (tōngxùn), 通用 (tōngyòng), 铜 (tóng), 同伴 (tóngbàn), 同行 (tóngháng), 童话 (tónghuà), 同类 (tónglèi), 铜牌 (tóngpái), 痛快 (tòngkuài), 偷 (tōu), 偷偷 (tōutōu), 头脑 (tóunǎo), 投票 (tóupiào), 投诉 (tóusù), 投资 (tóuzī), 透 (tòu), 透过 (tòuguò), 透露 (tòulù), 透明 (tòumíng), 突发 (tūfā), 突破 (tūpò), 图案 (tú’àn), 图表 (túbiǎo), 徒弟 (túdì), 途径 (tújìng), 图像 (túxiàng), 吐 (tǔ), 土壤 (tǔrǎng), 吐 (tù), 团结 (tuánjié), 团体 (tuántǐ), 团圆 (tuányuán), 推测 (tuīcè), 推销 (tuīxiāo), 推行 (tuīxíng), 退税 (tuìshuì), 吞 (tūn), 拖 (tuō), 拖延 (tuōyán), 托运 (tuōyùn), 挖 (wā), 哇 (wā), 娃娃 (wáwa), 歪 (wāi), 外表 (wàibiǎo), 外交 (wàijiāo), 外界 (wàijiè), 外科 (wàikē), 外来 (wàilái), 弯曲 (wānqū), 顽强 (wánqiáng), 万物 (wànwù), 王子 (wángzǐ), 网 (wǎng), 往后 (wǎnghòu), 往来 (wǎnglái), 往年 (wǎngnián), 望 (wàng), 危机 (wēijī), 微小 (wēixiǎo), 违规 (wéiguī), 维护 (wéihù), 为难 (wéinán), 围棋 (wéiqí), 为期 (wéiqī), 维生素 (wéishēngsù), 为止 (wéizhǐ), 委屈 (wěiqu).

委托 (wěituō), 未 (wèi), 未必 (wèibì), 未成年人 (wèichéngniánrén), 为此 (wèicǐ), 为何 (wèihé), 味觉 (wèijué), 胃口 (wèikǒu), 温和 (wēnhé), 温柔 (wēnróu), 文档 (wéndàng), 文具 (wénjù), 文科 (wénkē), 文明 (wénmíng), 闻名 (wénmíng), 文物 (wénwù), 文献 (wénxiàn), 文艺 (wényì), 乌龟 (wūguī), 污水 (wūshuǐ), 无所谓 (wúsuǒwèi), 无疑 (wúyí), 武器 (wǔqì), 误 (wù), 误解 (wùjiě), 物体 (wùtǐ), 吸取 (xīqǔ), 媳妇 (xífu), 习俗 (xísú), 喜剧 (xǐjù), 喜事 (xǐshì), 洗漱 (xǐshù), 细胞 (xìbāo), 细菌 (xìjūn), 系列 (xìliè), 戏曲 (xìqǔ), 细致 (xìzhì), 吓 (xià), 下功夫 (xiàgōngfu), 下单 (xiàdān), 夏令营 (xiàlìngyíng), 下线 (xiàxiàn), 下旬 (xiàxún), 鲜明 (xiānmíng), 先前 (xiānqián), 鲜艳 (xiānyàn), 嫌 (xián), 显 (xiǎn), 险 (xiǎn), 显著 (xiǎnzhù), 限 (xiàn), 线 (xiàn), 现存 (xiàncún), 限度 (xiàndù), 现货 (xiànhuò), 陷入 (xiànrù), 线索 (xiànsuǒ), 限于 (xiànyú), 相差 (xiāngchà), 香肠 (xiāngcháng), 相传 (xiāngchuán), 相等 (xiāngděng), 相连 (xiānglián), 香水 (xiāngshuǐ), 相应 (xiāngyìng), 项链 (xiàngliàn), 象棋 (xiàngqí), 相声 (xiàngsheng), 向往 (xiàngwǎng), 消除 (xiāochú), 消毒 (xiāodú), 消防 (xiāofáng), 消耗 (xiāohào), 消灭 (xiāomiè), 小麦 (xiǎomài), 小偷儿 (xiǎotōur), 笑容 (xiàoróng), 效应 (xiàoyìng), 歇 (xiē), 携带 (xiédài).

协会 (xiéhuì), 协调 (xiétiáo), 协助 (xiézhù), 心爱 (xīn’ài), 心底 (xīndǐ), 新款 (xīnkuǎn), 心灵 (xīnlíng), 心目 (xīnmù), 心疼 (xīnténg), 新兴 (xīnxīng), 新颖 (xīnyǐng), 心愿 (xīnyuàn), 心脏 (xīnzàng), 信赖 (xìnlài), 信念 (xìnniàn), 兴起 (xīngqǐ), 型号 (xínghào), 形态 (xíngtài), 性价比 (xìngjiàbǐ), 性能 (xìngnéng), 胸 (xiōng), 修订 (xiūdìng), 修复 (xiūfù), 袖子 (xiùzi), 许可 (xǔkě), 叙述 (xùshù), 旋转 (xuánzhuǎn), 选拔 (xuǎnbá), 选修 (xuǎnxiū), 学会 (xuéhuì), 学位 (xuéwèi), 学员 (xuéyuán), 血管 (xuèguǎn), 血型 (xuèxíng), 血压 (xuèyā), 血液 (xuèyè), 循环 (xúnhuán), 寻求 (xúnqiú), 压缩 (yāsuō), 亚军 (yàjūn), 淹 (yān), 淹没 (yānmò), 严 (yán), 沿海 (yánhǎi), 严寒 (yánhán), 严禁 (yánjìn), 严厉 (yánlì), 延期 (yánqī), 炎热 (yánrè), 延伸 (yánshēn), 研讨 (yántǎo), 延续 (yánxù), 言语 (yányǔ), 炎症 (yánzhèng), 眼光 (yǎnguāng), 眼看 (yǎnkàn), 演奏 (yǎnzòu), 宴会 (yànhuì), 验证 (yànzhèng), 仰 (yǎng), 痒 (yǎng), 养老 (yǎnglǎo), 养老院 (yǎnglǎoyuàn), 氧气 (yǎngqì), 样 (yàng), 遥远 (yáoyuǎn), 要点 (yàodiǎn), 要么 (yàome), 要素 (yàosù), 野 (yě), 也好 (yěhǎo), 野生 (yěshēng), 野外 (yěwài), 业 (yè), 液体 (yètǐ), 依旧 (yījiù), 依赖 (yīlài), 一流 (yīliú), 衣食住行 (yī-shí-zhù-xíng), 医药 (yīyào).

一一 (yīyī), 姨 (yí), 遗产 (yíchǎn), 遗传 (yíchuán), 疑惑 (yíhuò), 移民 (yímín), 仪器 (yíqì), 仪式 (yíshì), 遗址 (yízhǐ), 以便 (yǐbiàn), 以免 (yǐmiǎn), 以往 (yǐwǎng), 异常 (yìcháng), 议论 (yìlùn), 艺人 (yìrén), 易于 (yìyú), 抑制 (yìzhì), 因 (yīn), 音节 (yīnjié), 银 (yín), 银牌 (yínpái), 引 (yǐn), 隐藏 (yǐncáng), 引导 (yǐndǎo), 引发 (yǐnfā), 引入 (yǐnrù), 隐私 (yǐnsī), 饮用水 (yǐnyòngshuǐ), 印 (yìn), 婴儿 (yīng’ér), 英雄 (yīngxióng), 影子 (yǐngzi), 拥挤 (yōngjǐ), 涌现 (yǒngxiàn), 勇于 (yǒngyú), 用餐 (yòngcān), 用功 (yònggōng), 用人 (yòngrén), 用心 (yòngxīn), 优化 (yōuhuà), 优先 (yōuxiān), 优异 (yōuyì), 由来 (yóulái), 游人 (yóurén), 犹如 (yóurú), 有机 (yǒujī), 有劲 (yǒujìn), 有序 (yǒuxù), 于 (yú), 余额 (yú’é), 与其 (yǔqí), 羽绒服 (yǔróngfú), 预定 (yùdìng), 预料 (yùliào), 预期 (yùqī), 浴室 (yùshì), 欲望 (yùwàng), 原本 (yuánběn), 原材料 (yuáncáiliào), 原理 (yuánlǐ), 原料 (yuánliào), 园林 (yuánlín), 圆满 (yuánmǎn), 原始 (yuánshǐ), 元素 (yuánsù), 原先 (yuánxiān), 元宵 (yuánxiāo), 源于 (yuányú), 远程 (yuǎnchéng), 远方 (yuǎnfāng), 约束 (yuēshù), 月光 (yuèguāng), 乐器 (yuèqì), 月球 (yuèqiú), 乐曲 (yuèqǔ), 晕 (yūn), 晕车 (yùnchē), 运送 (yùnsòng), 运行 (yùnxíng), 运营 (yùnyíng).

杂 (zá), 灾 (zāi), 灾害 (zāihài), 灾难 (zāinàn), 灾区 (zāiqū), 再三 (zàisān), 再生 (zàishēng), 在意 (zàiyì), 赞赏 (zànshǎng), 赞同 (zàntóng), 遭到 (zāodào), 遭受 (zāoshòu), 遭遇 (zāoyù), 噪声 (zàoshēng), 造型 (zàoxíng), 则 (zé), 扎 (zhā), 炸 (zhà), 粘 (zhān), 粘贴 (zhāntiē), 崭新 (zhǎnxīn), 占比 (zhànbǐ), 战斗 (zhàndòu), 占据 (zhànjù), 战胜 (zhànshèng), 占有 (zhànyǒu), 战争 (zhànzhēng), 章 (zhāng), 长辈 (zhǎngbèi), 障碍 (zhàng’ài), 账单 (zhàngdān), 招 (zhāo), 招待 (zhāodài), 招生 (zhāoshēng), 招手 (zhāoshǒu), 招收 (zhāoshōu), 照明 (zhàomíng), 折 (zhé), 针 (zhēn), 真相 (zhēnxiàng), 珍珠 (zhēnzhū), 枕头 (zhěntou), 镇 (zhèn), 阵雨 (zhènyǔ), 睁 (zhēng), 争吵 (zhēngchǎo), 争夺 (zhēngduó), 争论 (zhēnglùn), 征求 (zhēngqiú), 争议 (zhēngyì), 政策 (zhèngcè), 正规 (zhèngguī), 正面 (zhèngmiàn), 证实 (zhèngshí), 正义 (zhèngyì), 症状 (zhèngzhuàng), 支 (zhī), 枝 (zhī), 支撑 (zhīchēng), 支出 (zhīchū), 脂肪 (zhīfáng), 之所以 (zhīsuǒyǐ), 值班 (zhíbān), 职位 (zhíwèi), 职务 (zhíwù), 职员 (zhíyuán), 职责 (zhízé), 侄子 (zhízi), 只得 (zhǐdé), 指定 (zhǐdìng), 只顾 (zhǐgù), 指挥 (zhǐhuī), 指示 (zhǐshì), 指责 (zhǐzé), 制 (zhì), 至关重要 (zhìguān-zhòngyào), 智力 (zhìlì), 治理 (zhìlǐ), 制品 (zhìpǐn), 秩序 (zhìxù).

质疑 (zhìyí), 至于 (zhìyú), 中等 (zhōngděng), 终点 (zhōngdiǎn), 中断 (zhōngduàn), 终身 (zhōngshēn), 钟头 (zhōngtóu), 中旬 (zhōngxún), 中央 (zhōngyāng), 肿 (zhǒng), 中 (zhòng), 种地 (zhòngdì), 中毒 (zhòngdú), 中奖 (zhòngjiǎng), 众人 (zhòngrén), 中暑 (zhòngshǔ), 众所周知 (zhòngsuǒzhōuzhī), 重心 (zhòngxīn), 州 (zhōu), 粥 (zhōu), 周边 (zhōubiān), 周到 (zhōudào), 周期 (zhōuqī), 株 (zhū), 珠宝 (zhūbǎo), 诸多 (zhūduō), 主办 (zhǔbàn), 主播 (zhǔbō), 主导 (zhǔdǎo), 主管 (zhǔguǎn), 主角 (zhǔjué), 主流 (zhǔliú), 主演 (zhǔyǎn), 主张 (zhǔzhāng), 祝福 (zhùfú), 助理 (zhùlǐ), 助手 (zhùshǒu), 祝愿 (zhùyuàn), 住宅 (zhùzhái), 著作 (zhùzuò), 砖 (zhuān), 专科 (zhuānkē), 专利 (zhuānlì), 专题 (zhuāntí), 专用 (zhuānyòng), 专注 (zhuānzhù), 转换 (zhuǎnhuàn), 转交 (zhuǎnjiāo), 转让 (zhuǎnràng), 转身 (zhuǎnshēn), 转移 (zhuǎnyí), 转 (zhuàn), 转动 (zhuàndòng), 装备 (zhuāngbèi), 庄稼 (zhuāngjia), 追究 (zhuījiū), 捉 (zhuō), 资本 (zīběn), 资产 (zīchǎn), 自豪 (zìháo), 自来水 (zìláishuǐ), 自律 (zìlǜ), 字幕 (zìmù), 自杀 (zìshā), 自我 (zìwǒ), 自言自语 (zìyán-zìyǔ), 自愿 (zìyuàn), 自助 (zìzhù), 棕色 (zōngsè), 总裁 (zǒngcái), 总计 (zǒngjì), 总理 (zǒnglǐ), 总算 (zǒngsuàn), 粽子 (zòngzi), 走廊 (zǒuláng), 足 (zú), 足以 (zúyǐ), 阻碍 (zǔ’ài), 阻挡 (zǔdǎng), 祖国 (zǔguó).

祖先 (zǔxiān), 钻 (zuān), 罪 (zuì).

## Différences mineures de pinyin

| Entrée | Mot | Pinyin HSK | Pinyin dictionnaire |
|---|---|---|---|
| HSK 1 #13 | 不客气 | búkèqi | bù kè qi |
| HSK 1 #14 | 不要 | búyào | bù yào |
| HSK 1 #138 | 那边 | nàbiān | nà bian |
| HSK 1 #140 | 那里 | nàlǐ | nà li |
| HSK 1 #236 | 小朋友 | xiǎopéngyou | xiǎo péng yǒu |
| HSK 1 #259 | 一半 | yíbàn | yī bàn |
| HSK 1 #260 | 一下 | yíxià | yī xià |
| HSK 1 #262 | 一点儿 | yìdiǎnr | yī diǎn r |
| HSK 1 #263 | 一些 | yìxiē | yī xiē |
| HSK 2 #12 | 不错 | búcuò | bù cuò |
| HSK 2 #56 | 后面 | hòumiàn | hòu mian |
| HSK 2 #61 | 回来 | huílái | huí lai |
| HSK 2 #62 | 回去 | huíqù | huí qu |
| HSK 2 #118 | 起来 | qǐlái | qi lai, qǐ lai |
| HSK 2 #151 | 网上 | wǎngshang | wǎng shàng |
| HSK 2 #158 | 下来 | xiàlái | xià lai |
| HSK 2 #171 | 一会儿 | yíhuìr | yī huì r |
| HSK 2 #173 | 一起 | yìqǐ | yī qǐ |
| HSK 3 #32 | 别人 | biérén | bié ren |
| HSK 3 #38 | 不但 | búdàn | bù dàn |
| HSK 3 #39 | 不见 | bújiàn | bù jiàn |
| HSK 3 #40 | 不用 | búyòng | bù yòng |
| HSK 3 #70 | 聪明 | cōngmíng | cōng ming |
| HSK 3 #143 | 刚刚 | gānggāng | gāng gang |
| HSK 3 #154 | 关系 | guānxì | guān xi |
| HSK 3 #230 | 看来 | kànlái | kàn lai |
| HSK 3 #349 | 太阳 | tàiyáng | tài yang |
| HSK 3 #402 | 心里 | xīnlǐ | xīn li |
| HSK 3 #422 | 一定 | yídìng | yī dìng |
| HSK 3 #423 | 一共 | yígòng | yī gòng |
| HSK 3 #424 | 一块儿 | yíkuàir | yī kuài r |
| HSK 3 #425 | 一样 | yíyàng | yī yàng |
| HSK 3 #432 | 一般 | yìbān | yī bān |
| HSK 3 #433 | 一边 | yìbiān | yī biān |
| HSK 3 #434 | 一直 | yìzhí | yī zhí |
| HSK 3 #471 | 照顾 | zhàogù | zhào gu |
| HSK 4 #43 | 不必 | búbì | bù bì |
| HSK 4 #44 | 不便 | búbiàn | bù biàn |
| HSK 4 #45 | 不断 | búduàn | bù duàn |
| HSK 4 #46 | 不够 | búgòu | bù gòu |
| HSK 4 #47 | 不过 | búguò | bù guò |
| HSK 4 #48 | 不论 | búlùn | bù lùn |
| HSK 4 #200 | 费用 | fèiyong | fèi yòng |
| HSK 4 #290 | 好处 | hǎochù | hǎo chu, hǎo chǔ |
| HSK 4 #304 | 坏处 | huàichù | huài chu |
| HSK 4 #313 | 活泼 | huópō | huó po |
| HSK 4 #320 | 基本上 | jīběnshàng | jī běn shang |
| HSK 4 #347 | 价钱 | jiàqián | jià qian |
| HSK 4 #458 | 老是 | lǎoshì | lǎo shi |
| HSK 4 #485 | 留下 | liúxia | liú xià |
| HSK 4 #684 | 受不了 | shòubuliǎo | shòu bù liǎo |
| HSK 4 #689 | 熟悉 | shúxi | shú xī |
| HSK 4 #717 | 态度 | tàidù | tài du |
| HSK 4 #773 | 味道 | wèidào | wèi dao |
| HSK 4 #865 | 一切 | yíqiè | yī qiè |
| HSK 4 #869 | 一生 | yìshēng | yī shēng |
| HSK 4 #908 | 月饼 | yuèbing | yuè bǐng |
| HSK 4 #919 | 早晨 | zǎochen | zǎo chén |
| HSK 4 #947 | 值得 | zhídé | zhí de |
| HSK 5 #73 | 不利 | búlì | bù lì |
| HSK 5 #74 | 不幸 | búxìng | bù xìng |
| HSK 5 #75 | 不要紧 | búyàojǐn | bù yào jǐn |
| HSK 5 #257 | 道理 | dàolǐ | dào li |
| HSK 5 #308 | 队伍 | duìwu | duì wǔ |
| HSK 5 #479 | 合同 | hétóng | hé tong |
| HSK 5 #620 | 进一步 | jìnyíbù | jìn yī bù |
| HSK 5 #674 | 口袋 | kǒudai | kǒu dài |
| HSK 5 #688 | 老婆 | lǎopo | lǎo pó |
| HSK 5 #707 | 力量 | lìliàng | lì liang |
| HSK 5 #747 | 逻辑 | luójí | luó ji |
| HSK 5 #756 | 玫瑰 | méigui | méi guī |
| HSK 5 #1198 | 位置 | wèizhì | wèi zhi |
| HSK 5 #1230 | 下载 | xiàzài | xià zǎi |
| HSK 5 #1269 | 小姐 | xiǎojiě | xiǎo jie |
| HSK 5 #1339 | 要不是 | yàobúshì | yào bu shì |
| HSK 5 #1352 | 一次性 | yícìxìng | yī cì xìng |
| HSK 5 #1353 | 一代 | yídài | yī dài |
| HSK 5 #1354 | 一旦 | yídàn | yī dàn |
| HSK 5 #1357 | 一路 | yílù | yī lù |
| HSK 5 #1358 | 一路顺风 | yílù-shùnfēng | yī lù shùn fēng |
| HSK 5 #1360 | 一致 | yízhì | yī zhì |
| HSK 6 #67 | 不耐烦 | búnàifán | bù nài fán |
| HSK 6 #68 | 不顾 | búgù | bù gù |
| HSK 6 #69 | 不料 | búliào | bù liào |
| HSK 6 #70 | 不适 | búshì | bù shì |
| HSK 6 #71 | 不至于 | búzhìyú | bù zhì yú |
| HSK 6 #172 | 尺寸 | chǐcùn | chǐ cun |
| HSK 6 #236 | 打交道 | dǎjiāodao | dǎ jiāo dào |
| HSK 6 #245 | 大吃一惊 | dàchī-yìjīng | dà chī yī jīng |
| HSK 6 #281 | 倒是 | dàoshì | dào shi |
| HSK 6 #285 | 灯笼 | dēnglong | dēng lóng |
| HSK 6 #344 | 恶心 | ěxin | è xīn, ě xīn |
| HSK 6 #397 | 夫人 | fūrén | fū ren |
| HSK 6 #680 | 教训 | jiàoxùn | jiào xun |
| HSK 6 #1202 | 势力 | shìlì | shì li |
| HSK 6 #1356 | 外甥 | wàisheng | wài shēng |
| HSK 6 #1451 | 小气 | xiǎoqi | xiǎo qì |
| HSK 6 #1467 | 薪水 | xīnshui | xīn shuǐ |
| HSK 6 #1491 | 学问 | xuéwen | xué wèn |
| HSK 6 #1543 | 一辈子 | yíbèizi | yī bèi zi |
| HSK 6 #1546 | 一带 | yídài | yī dài |
| HSK 6 #1547 | 一道 | yídào | yī dào |
| HSK 6 #1548 | 一贯 | yíguàn | yī guàn |
| HSK 6 #1550 | 一律 | yílǜ | yī lǜ |
| HSK 6 #1554 | 一向 | yíxiàng | yī xiàng |
| HSK 6 #1555 | 一系列 | yíxìliè | yī xì liè |
| HSK 6 #1556 | 一再 | yízài | yī zài |
| HSK 6 #1557 | 一阵 | yízhèn | yī zhèn |
| HSK 6 #1563 | 益处 | yìchù | yì chu |
| HSK 6 #1564 | 一帆风顺 | yìfān-fēngshùn | yī fān fēng shùn |
| HSK 6 #1565 | 一口气 | yìkǒuqì | yī kǒu qì |
| HSK 6 #1567 | 一模一样 | yìmú-yíyàng | yī mú yī yàng |
| HSK 6 #1569 | 一身 | yìshēn | yī shēn |
| HSK 6 #1570 | 一时 | yìshí | yī shí |
| HSK 6 #1571 | 一同 | yìtóng | yī tóng |
| HSK 6 #1593 | 用处 | yòngchù | yòng chu |

## Prononciations multiples possibles

| Entrée | Mot | Pinyin HSK | Prononciations dictionnaire | Motif |
|---|---|---|---|---|
| HSK 1 #4 | 吧 | ba | ba, bā, biā | dictionary_multiple_pronunciations |
| HSK 1 #11 | 边 | biān | biān, bian | dictionary_multiple_pronunciations |
| HSK 1 #20 | 车 | chē | jū, chē | dictionary_multiple_pronunciations |
| HSK 1 #21 | 吃 | chī | chī, jí | dictionary_multiple_pronunciations |
| HSK 1 #25 | 大 | dà | dà, dài | dictionary_multiple_pronunciations |
| HSK 1 #30 | 的 | de | de, dì, dī, dí | dictionary_multiple_pronunciations |
| HSK 1 #40 | 东西 | dōngxi | dōng xi, dōng xī | dictionary_multiple_pronunciations |
| HSK 1 #41 | 都 | dōu | dōu, dū | dictionary_multiple_pronunciations |
| HSK 1 #42 | 读 | dú | dòu, dú | dictionary_multiple_pronunciations |
| HSK 1 #47 | 多少 | duōshao | duō shao, duō shǎo | dictionary_multiple_pronunciations |
| HSK 1 #55 | 分 | fēn | fèn, fēn | dictionary_multiple_pronunciations |
| HSK 1 #60 | 个 | gè | gè, gě | dictionary_multiple_pronunciations |
| HSK 1 #61 | 给 | gěi | gěi, jǐ | dictionary_multiple_pronunciations |
| HSK 1 #67 | 还 | hái | hái, huán | dictionary_multiple_pronunciations |
| HSK 1 #71 | 好 | hǎo | hào, hǎo | dictionary_multiple_pronunciations |
| HSK 1 #72 | 好吃 | hǎochī | hào chī, hǎo chī | dictionary_multiple_pronunciations |
| HSK 1 #76 | 号 | hào | hào, háo | dictionary_multiple_pronunciations |
| HSK 1 #77 | 喝 | hē | hè, hē | dictionary_multiple_pronunciations |
| HSK 1 #78 | 和 | hé | hè, hé, huò, hú, huó | dictionary_multiple_pronunciations |
| HSK 1 #82 | 会 | huì | kuài, huì | dictionary_multiple_pronunciations |
| HSK 1 #85 | 几 | jǐ | jī, jǐ | dictionary_multiple_pronunciations |
| HSK 1 #88 | 见 | jiàn | jiàn, xiàn | dictionary_multiple_pronunciations |
| HSK 1 #99 | 看 | kàn | kān, kàn | dictionary_multiple_pronunciations |
| HSK 1 #105 | 块 | kuài | kuāi, kuài | dictionary_multiple_pronunciations |
| HSK 1 #108 | 了 | le | le, liào, liǎo | dictionary_multiple_pronunciations |
| HSK 1 #113 | 六 | liù | liù, lù | dictionary_multiple_pronunciations |
| HSK 1 #115 | 吗 | ma | ma, má, mǎ | dictionary_multiple_pronunciations |
| HSK 1 #119 | 猫 | māo | māo, máo | dictionary_multiple_pronunciations |
| HSK 1 #120 | 没 | méi | méi, mò | dictionary_multiple_pronunciations |
| HSK 1 #132 | 哪 | nǎ | né, něi, nǎ, na | dictionary_multiple_pronunciations |
| HSK 1 #137 | 那 | nà | nā, nà, nuó, nǎ | dictionary_multiple_pronunciations |
| HSK 1 #145 | 呢 | ne | nī, ní, ne | dictionary_multiple_pronunciations |
| HSK 1 #153 | 女 | nǚ | nǚ, rǔ | dictionary_multiple_pronunciations |
| HSK 1 #158 | 便宜 | piányi | pián yi, biàn yí | dictionary_multiple_pronunciations |
| HSK 1 #176 | 上 | shàng | shǎng, shàng | dictionary_multiple_pronunciations |
| HSK 1 #181 | 少 | shǎo | shào, shǎo | dictionary_multiple_pronunciations |
| HSK 1 #182 | 谁 | shéi | shéi, shuí | dictionary_multiple_pronunciations |
| HSK 1 #197 | 说 | shuō | shuì, shuō | dictionary_multiple_pronunciations |
| HSK 1 #210 | 听 | tīng | yǐn, tīng, tìng | dictionary_multiple_pronunciations |
| HSK 1 #219 | 喂 | wèi | wèi, wéi | dictionary_multiple_pronunciations |
| HSK 1 #241 | 写 | xiě | xiè, xiě | dictionary_multiple_pronunciations |
| HSK 1 #253 | 要 | yào | yào, yāo | dictionary_multiple_pronunciations |
| HSK 1 #268 | 雨 | yǔ | yù, yǔ | dictionary_multiple_pronunciations |
| HSK 1 #280 | 这 | zhè | zhèi, zhè | dictionary_multiple_pronunciations |
| HSK 1 #289 | 只 | zhī | zhī, zhǐ | dictionary_multiple_pronunciations |
| HSK 2 #1 | 啊 | a | a, ā, ǎ, á, à | dictionary_multiple_pronunciations |
| HSK 2 #9 | 比 | bǐ | bǐ, bì, bī | dictionary_multiple_pronunciations |
| HSK 2 #11 | 别 | bié | bié, biè | dictionary_multiple_pronunciations |
| HSK 2 #14 | 长 | cháng | zhǎng, cháng | dictionary_multiple_pronunciations |
| HSK 2 #18 | 出来 | chūlái | chu lai, chū lái | dictionary_multiple_pronunciations |
| HSK 2 #24 | 从 | cóng | cōng, zòng, cóng | dictionary_multiple_pronunciations |
| HSK 2 #27 | 打 | dǎ | dǎ, dá | dictionary_multiple_pronunciations |
| HSK 2 #32 | 得 | de | dè, de, dé, děi | dictionary_multiple_pronunciations |
| HSK 2 #33 | 地 | de | de, dì | dictionary_multiple_pronunciations |
| HSK 2 #42 | 高中 | gāozhōng | gāo zhòng, gāo zhōng | dictionary_multiple_pronunciations |
| HSK 2 #43 | 告诉 | gàosu | gào su, gào sù | dictionary_multiple_pronunciations |
| HSK 2 #47 | 过 | guò | guò, guo, guō | dictionary_multiple_pronunciations |
| HSK 2 #48 | 过来 | guòlái | guò lai, guò lái | dictionary_multiple_pronunciations |
| HSK 2 #50 | 过去 | guòqù | guò qu, guò qù | dictionary_multiple_pronunciations |
| HSK 2 #51 | 过 | guo | guò, guo, guō | dictionary_multiple_pronunciations |
| HSK 2 #66 | 间 | jiān | jiān, jiàn | dictionary_multiple_pronunciations |
| HSK 2 #67 | 教 | jiāo | jiào, jiāo | dictionary_multiple_pronunciations |
| HSK 2 #88 | 累 | lèi | léi, lèi, lěi | dictionary_multiple_pronunciations |
| HSK 2 #89 | 离 | lí | chī, lí | dictionary_multiple_pronunciations |
| HSK 2 #111 | 鸟 | niǎo | diǎo, niǎo | dictionary_multiple_pronunciations |
| HSK 2 #114 | 跑 | pǎo | pǎo, páo | dictionary_multiple_pronunciations |
| HSK 2 #117 | 妻子 | qīzi | qī zi, qī zǐ | dictionary_multiple_pronunciations |
| HSK 2 #118 | 起来 | qǐlái | qi lai, qǐ lai | dictionary_multiple_pronunciations |
| HSK 2 #126 | 上面 | shàngmiàn | shàng mian, shàng miàn | dictionary_multiple_pronunciations |
| HSK 2 #145 | 头 | tóu | tóu, tou | dictionary_multiple_pronunciations |
| HSK 2 #147 | 外面 | wàimiàn | wài mian, wài miàn | dictionary_multiple_pronunciations |
| HSK 2 #149 | 万 | wàn | wàn, mò | dictionary_multiple_pronunciations |
| HSK 2 #150 | 往 | wǎng | wǎng, wàng | dictionary_multiple_pronunciations |
| HSK 2 #156 | 洗 | xǐ | xiǎn, xǐ | dictionary_multiple_pronunciations |
| HSK 2 #159 | 下面 | xiàmiàn | xià mian, xià miàn | dictionary_multiple_pronunciations |
| HSK 2 #184 | 远 | yuǎn | yuǎn, yuàn | dictionary_multiple_pronunciations |
| HSK 2 #190 | 着 | zhe | zhāo, zháo, zhuó, zhe, zhé | dictionary_multiple_pronunciations |
| HSK 2 #191 | 正 | zhèng | zhèng, zhēng | dictionary_multiple_pronunciations |
| HSK 3 #6 | 把 | bǎ | bǎ, bà | dictionary_multiple_pronunciations |
| HSK 3 #47 | 草 | cǎo | cǎo, cào | dictionary_multiple_pronunciations |
| HSK 3 #50 | 查 | chá | chá, zhā | dictionary_multiple_pronunciations |
| HSK 3 #51 | 差 | chà | chà, cī, chāi, chā | dictionary_multiple_pronunciations |
| HSK 3 #83 | 得 | dé | dè, de, dé, děi | dictionary_multiple_pronunciations |
| HSK 3 #87 | 得 | děi | dè, de, dé, děi | dictionary_multiple_pronunciations |
| HSK 3 #89 | 地 | dì | de, dì | dictionary_multiple_pronunciations |
| HSK 3 #91 | 地方 | dìfang | dì fang, dì fāng | dictionary_multiple_pronunciations |
| HSK 3 #95 | 电子书 | diànzǐshū | diàn zi shū, diàn zǐ shū | dictionary_multiple_pronunciations |
| HSK 3 #114 | 发 | fā | fà, fā | dictionary_multiple_pronunciations |
| HSK 3 #140 | 干 | gàn | gān, gàn | dictionary_multiple_pronunciations |
| HSK 3 #146 | 更 | gèng | gèng, gēng | dictionary_multiple_pronunciations |
| HSK 3 #150 | 故事 | gùshi | gù shi, gù shì | dictionary_multiple_pronunciations |
| HSK 3 #160 | 过去 | guòqù | guò qu, guò qù | dictionary_multiple_pronunciations |
| HSK 3 #178 | 还 | huán | hái, huán | dictionary_multiple_pronunciations |
| HSK 3 #183 | 会 | huì | kuài, huì | dictionary_multiple_pronunciations |
| HSK 3 #204 | 角 | jiǎo | jué, jiǎo | dictionary_multiple_pronunciations |
| HSK 3 #205 | 脚 | jiǎo | jué, jiǎo | dictionary_multiple_pronunciations |
| HSK 3 #208 | 节 | jié | jiē, jié | dictionary_multiple_pronunciations |
| HSK 3 #222 | 句 | jù | jù, gōu | dictionary_multiple_pronunciations |
| HSK 3 #225 | 卡 | kǎ | qiǎ, kǎ | dictionary_multiple_pronunciations |
| HSK 3 #231 | 可 | kě | kě, kè | dictionary_multiple_pronunciations |
| HSK 3 #274 | 南 | nán | nā, nán | dictionary_multiple_pronunciations |
| HSK 3 #275 | 难 | nán | nán, nàn | dictionary_multiple_pronunciations |
| HSK 3 #287 | 女人 | nǚrén | nǚ ren, nǚ rén | dictionary_multiple_pronunciations |
| HSK 3 #293 | 胖 | pàng | pàng, pán | dictionary_multiple_pronunciations |
| HSK 3 #297 | 骑 | qí | qí, jì | dictionary_multiple_pronunciations |
| HSK 3 #321 | 扫 | sǎo | sǎo, sào | dictionary_multiple_pronunciations |
| HSK 3 #344 | 刷 | shuā | shuā, shuà | dictionary_multiple_pronunciations |
| HSK 3 #375 | 为 | wèi | wèi, wéi | dictionary_multiple_pronunciations |
| HSK 3 #408 | 行 | xíng | xìng, háng, xíng, héng | dictionary_multiple_pronunciations |
| HSK 3 #421 | 页 | yè | yè, xié | dictionary_multiple_pronunciations |
| HSK 3 #463 | 脏 | zāng | zàng, zāng | dictionary_multiple_pronunciations |
| HSK 3 #468 | 长 | zhǎng | zhǎng, cháng | dictionary_multiple_pronunciations |
| HSK 3 #475 | 只 | zhǐ | zhī, zhǐ | dictionary_multiple_pronunciations |
| HSK 3 #481 | 中 | zhōng | zhòng, zhōng | dictionary_multiple_pronunciations |
| HSK 3 #484 | 种 | zhǒng | zhòng, zhǒng | dictionary_multiple_pronunciations |
| HSK 3 #492 | 子 | zi | zi, zǐ | dictionary_multiple_pronunciations |
| HSK 4 #1 | 啊 | ā | a, ā, ǎ, á, à | dictionary_multiple_pronunciations |
| HSK 4 #20 | 背 | bēi | bèi, bēi | dictionary_multiple_pronunciations |
| HSK 4 #39 | 并 | bìng | bìng, bīng | dictionary_multiple_pronunciations |
| HSK 4 #72 | 厂 | chǎng | hǎn, chǎng | dictionary_multiple_pronunciations |
| HSK 4 #73 | 场 | chǎng | cháng, chǎng | dictionary_multiple_pronunciations |
| HSK 4 #78 | 乘 | chéng | shèng, chéng | dictionary_multiple_pronunciations |
| HSK 4 #86 | 重 | chóng | chóng, zhòng | dictionary_multiple_pronunciations |
| HSK 4 #112 | 答 | dá | dá, dā | dictionary_multiple_pronunciations |
| HSK 4 #125 | 大夫 | dàifu | dài fu, dà fū | dictionary_multiple_pronunciations |
| HSK 4 #131 | 待 | dāi | dāi, dài | dictionary_multiple_pronunciations |
| HSK 4 #135 | 当 | dāng | dāng, dàng | dictionary_multiple_pronunciations |
| HSK 4 #136 | 当时 | dāngshí | dāng shí, dàng shí | dictionary_multiple_pronunciations |
| HSK 4 #139 | 倒 | dào | dào, dǎo | dictionary_multiple_pronunciations |
| HSK 4 #153 | 底 | dǐ | dǐ, de | dictionary_multiple_pronunciations |
| HSK 4 #220 | 干 | gān | gān, gàn | dictionary_multiple_pronunciations |
| HSK 4 #288 | 汗 | hàn | hàn, hán | dictionary_multiple_pronunciations |
| HSK 4 #290 | 好处 | hǎochù | hǎo chu, hǎo chǔ | dictionary_multiple_pronunciations |
| HSK 4 #345 | 假 | jiǎ | jià, jiǎ, gēi | dictionary_multiple_pronunciations |
| HSK 4 #356 | 将 | jiāng | jiàng, jiāng, qiāng | dictionary_multiple_pronunciations |
| HSK 4 #362 | 降 | jiàng | jiàng, xiáng | dictionary_multiple_pronunciations |
| HSK 4 #375 | 教授 | jiàoshòu | jiào shòu, jiāo shòu | dictionary_multiple_pronunciations |
| HSK 4 #376 | 教学 | jiàoxué | jiào xué, jiāo xué | dictionary_multiple_pronunciations |
| HSK 4 #382 | 结果 | jiéguǒ | jié guǒ, jiē guǒ | dictionary_multiple_pronunciations |
| HSK 4 #427 | 咳 | ké | ké, hāi | dictionary_multiple_pronunciations |
| HSK 4 #436 | 空 | kōng | kōng, kòng | dictionary_multiple_pronunciations |
| HSK 4 #439 | 空 | kòng | kōng, kòng | dictionary_multiple_pronunciations |
| HSK 4 #447 | 拉 | lā | là, lā, lá | dictionary_multiple_pronunciations |
| HSK 4 #468 | 俩 | liǎ | liǎng, liǎ | dictionary_multiple_pronunciations |
| HSK 4 #471 | 凉 | liáng | liàng, liáng | dictionary_multiple_pronunciations |
| HSK 4 #472 | 量 | liáng | liàng, liáng | dictionary_multiple_pronunciations |
| HSK 4 #493 | 落 | luò | lào, là, luò | dictionary_multiple_pronunciations |
| HSK 4 #513 | 末 | mò | mò, me | dictionary_multiple_pronunciations |
| HSK 4 #534 | 嗯 | ǹg | èn, ēn, en | dictionary_multiple_pronunciations |
| HSK 4 #538 | 弄 | nòng | lòng, nòng | dictionary_multiple_pronunciations |
| HSK 4 #543 | 排 | pái | pǎi, pái | dictionary_multiple_pronunciations |
| HSK 4 #555 | 片 | piàn | piàn, piān | dictionary_multiple_pronunciations |
| HSK 4 #579 | 强 | qiáng | jiàng, qiǎng, qiáng | dictionary_multiple_pronunciations |
| HSK 4 #593 | 区 | qū | qū, ōu | dictionary_multiple_pronunciations |
| HSK 4 #633 | 稍 | shāo | shào, shāo | dictionary_multiple_pronunciations |
| HSK 4 #649 | 生意 | shēngyi | shēng yi, shēng yì | dictionary_multiple_pronunciations |
| HSK 4 #650 | 省 | shěng | shěng, xǐng | dictionary_multiple_pronunciations |
| HSK 4 #688 | 熟 | shú/shóu | shú | hsk_multiple_pronunciations |
| HSK 4 #691 | 数 | shù | shù, shǔ, shuò | dictionary_multiple_pronunciations |
| HSK 4 #699 | 说法 | shuōfǎ | shuō fa, shuō fǎ | dictionary_multiple_pronunciations |
| HSK 4 #712 | 孙子 | sūnzi | sūn zi, sūn zǐ | dictionary_multiple_pronunciations |
| HSK 4 #714 | 台 | tái | tái, tāi | dictionary_multiple_pronunciations |
| HSK 4 #718 | 弹 | tán | tán, dàn | dictionary_multiple_pronunciations |
| HSK 4 #720 | 汤 | tāng | tāng, shāng | dictionary_multiple_pronunciations |
| HSK 4 #722 | 趟 | tàng | tàng, tāng | dictionary_multiple_pronunciations |
| HSK 4 #726 | 提 | tí | tí, dī | dictionary_multiple_pronunciations |
| HSK 4 #743 | 通 | tōng | tōng, tòng | dictionary_multiple_pronunciations |
| HSK 4 #771 | 为 | wéi | wèi, wéi | dictionary_multiple_pronunciations |
| HSK 4 #781 | 无 | wú | wú, mó | dictionary_multiple_pronunciations |
| HSK 4 #794 | 鲜 | xiān | xiǎn, xiān | dictionary_multiple_pronunciations |
| HSK 4 #817 | 笑话 | xiàohua | xiào huà, xiào hua | dictionary_multiple_pronunciations |
| HSK 4 #818 | 血 | xiě | xiě, xuè | dictionary_multiple_pronunciations |
| HSK 4 #839 | 压 | yā | yà, yā | dictionary_multiple_pronunciations |
| HSK 4 #897 | 与 | yǔ | yù, yǔ, yú | dictionary_multiple_pronunciations |
| HSK 4 #906 | 约 | yuē | yāo, yuē | dictionary_multiple_pronunciations |
| HSK 4 #924 | 着 | zháo | zhāo, zháo, zhuó, zhe, zhé | dictionary_multiple_pronunciations |
| HSK 4 #959 | 种 | zhòng | zhòng, zhǒng | dictionary_multiple_pronunciations |
| HSK 4 #960 | 重 | zhòng | chóng, zhòng | dictionary_multiple_pronunciations |
| HSK 4 #961 | 重点 | zhòngdiǎn | zhòng diǎn, chóng diǎn | dictionary_multiple_pronunciations |
| HSK 4 #970 | 转 | zhuǎn | zhuǎi, zhuǎn, zhuàn | dictionary_multiple_pronunciations |
| HSK 4 #973 | 赚 | zhuàn | zuàn, zhuàn | dictionary_multiple_pronunciations |
| HSK 5 #3 | 唉 | ài | ài, āi | dictionary_multiple_pronunciations |
| HSK 5 #19 | 薄 | báo | bó, báo, bò | dictionary_multiple_pronunciations |
| HSK 5 #36 | 背 | bèi | bèi, bēi | dictionary_multiple_pronunciations |
| HSK 5 #56 | 便 | biàn | biàn, pián | dictionary_multiple_pronunciations |
| HSK 5 #66 | 别 | bié | bié, biè | dictionary_multiple_pronunciations |
| HSK 5 #92 | 藏 | cáng | cáng, zàng | dictionary_multiple_pronunciations |
| HSK 5 #97 | 曾 | céng | zēng, céng | dictionary_multiple_pronunciations |
| HSK 5 #121 | 朝 | cháo | zhāo, cháo | dictionary_multiple_pronunciations |
| HSK 5 #132 | 称 | chēng | chēng, chèn, chèng | dictionary_multiple_pronunciations |
| HSK 5 #133 | 称 | chēng | chēng, chèn, chèng | dictionary_multiple_pronunciations |
| HSK 5 #158 | 冲 | chōng | chòng, chōng | dictionary_multiple_pronunciations |
| HSK 5 #169 | 臭 | chòu | xiù, chòu | dictionary_multiple_pronunciations |
| HSK 5 #179 | 处 | chǔ | chù, chǔ | dictionary_multiple_pronunciations |
| HSK 5 #182 | 处 | chù | chù, chǔ | dictionary_multiple_pronunciations |
| HSK 5 #183 | 传 | chuán | chuán, zhuàn | dictionary_multiple_pronunciations |
| HSK 5 #230 | 大爷 | dàye | dà ye, dà yé | dictionary_multiple_pronunciations |
| HSK 5 #238 | 单 | dān | shàn, chán, dān | dictionary_multiple_pronunciations |
| HSK 5 #246 | 当年 | dāngnián | dāng nián, dàng nián | dictionary_multiple_pronunciations |
| HSK 5 #249 | 挡 | dǎng | dàng, dǎng | dictionary_multiple_pronunciations |
| HSK 5 #250 | 当 | dàng | dāng, dàng | dictionary_multiple_pronunciations |
| HSK 5 #253 | 倒 | dǎo | dào, dǎo | dictionary_multiple_pronunciations |
| HSK 5 #284 | 调 | diào | diào, tiáo | dictionary_multiple_pronunciations |
| HSK 5 #289 | 洞 | dòng | tóng, dòng | dictionary_multiple_pronunciations |
| HSK 5 #300 | 度 | dù | duó, dù | dictionary_multiple_pronunciations |
| HSK 5 #381 | 盖 | gài | gě, gài | dictionary_multiple_pronunciations |
| HSK 5 #439 | 广 | guǎng | yǎn, guǎng | dictionary_multiple_pronunciations |
| HSK 5 #459 | 哈 | hā | hā, hàn, hǎ | dictionary_multiple_pronunciations |
| HSK 5 #467 | 行 | háng | xìng, háng, xíng, héng | dictionary_multiple_pronunciations |
| HSK 5 #472 | 好 | hào | hào, hǎo | dictionary_multiple_pronunciations |
| HSK 5 #474 | 合 | hé | gě, hé | dictionary_multiple_pronunciations |
| HSK 5 #483 | 红 | hóng | gōng, hóng | dictionary_multiple_pronunciations |
| HSK 5 #496 | 划 | huá | huà, huá | dictionary_multiple_pronunciations |
| HSK 5 #497 | 化 | huà | huā, huà | dictionary_multiple_pronunciations |
| HSK 5 #539 | 系 | jì | jì, xì | dictionary_multiple_pronunciations |
| HSK 5 #600 | 结 | jié | jié, jiē | dictionary_multiple_pronunciations |
| HSK 5 #609 | 尽快 | jǐnkuài | jǐn kuài, jìn kuài | dictionary_multiple_pronunciations |
| HSK 5 #610 | 尽量 | jǐnliàng | jìn liàng, jǐn liàng | dictionary_multiple_pronunciations |
| HSK 5 #623 | 精神 | jīngshen | jīng shen, jīng shén | dictionary_multiple_pronunciations |
| HSK 5 #636 | 据 | jù | jū, jù | dictionary_multiple_pronunciations |
| HSK 5 #654 | 开通 | kāitōng | kāi tong, kāi tōng | dictionary_multiple_pronunciations |
| HSK 5 #657 | 看 | kān | kān, kàn | dictionary_multiple_pronunciations |
| HSK 5 #686 | 老公 | lǎogōng | lǎo gong, lǎo gōng | dictionary_multiple_pronunciations |
| HSK 5 #719 | 量 | liàng | liàng, liáng | dictionary_multiple_pronunciations |
| HSK 5 #731 | 令 | lìng | lìng, lǐng, líng | dictionary_multiple_pronunciations |
| HSK 5 #749 | 买卖 | mǎimai | mǎi mài, mǎi mai | dictionary_multiple_pronunciations |
| HSK 5 #781 | 摸 | mō | mō, mó | dictionary_multiple_pronunciations |
| HSK 5 #807 | 哦 | ò | ó, é, ò, o | dictionary_multiple_pronunciations |
| HSK 5 #812 | 派 | pài | pā, pài | dictionary_multiple_pronunciations |
| HSK 5 #828 | 匹 | pǐ | pī, pǐ | dictionary_multiple_pronunciations |
| HSK 5 #867 | 浅 | qiǎn | qiǎn, jiān | dictionary_multiple_pronunciations |
| HSK 5 #874 | 抢 | qiǎng | qiǎng, qiāng | dictionary_multiple_pronunciations |
| HSK 5 #877 | 切 | qiē | qiè, qiē | dictionary_multiple_pronunciations |
| HSK 5 #878 | 亲 | qīn | qìng, qīn | dictionary_multiple_pronunciations |
| HSK 5 #949 | 扇 | shān | shān, shàn | dictionary_multiple_pronunciations |
| HSK 5 #969 | 蛇 | shé | shé, yí | dictionary_multiple_pronunciations |
| HSK 5 #998 | 省 | shěng | shěng, xǐng | dictionary_multiple_pronunciations |
| HSK 5 #1063 | 数 | shǔ | shù, shǔ, shuò | dictionary_multiple_pronunciations |
| HSK 5 #1128 | 挑 | tiāo | tiāo, tiǎo | dictionary_multiple_pronunciations |
| HSK 5 #1130 | 调 | tiáo | diào, tiáo | dictionary_multiple_pronunciations |
| HSK 5 #1141 | 同 | tóng | tòng, tóng | dictionary_multiple_pronunciations |
| HSK 5 #1149 | 头 | tou | tóu, tou | dictionary_multiple_pronunciations |
| HSK 5 #1153 | 土地 | tǔdì | tǔ di, tǔ dì | dictionary_multiple_pronunciations |
| HSK 5 #1184 | 为 | wéi | wèi, wéi | dictionary_multiple_pronunciations |
| HSK 5 #1192 | 尾巴 | wěiba | yǐ ba, wěi ba | dictionary_multiple_pronunciations |
| HSK 5 #1195 | 喂 | wèi | wèi, wéi | dictionary_multiple_pronunciations |
| HSK 5 #1226 | 系 | xì | jì, xì | dictionary_multiple_pronunciations |
| HSK 5 #1320 | 呀 | yā | yā, ya | dictionary_multiple_pronunciations |
| HSK 5 #1325 | 沿 | yán | yán, yàn | dictionary_multiple_pronunciations |
| HSK 5 #1361 | 乙 | yǐ | yǐ, zhé | dictionary_multiple_pronunciations |
| HSK 5 #1460 | 炸 | zhá | zhà, zhá | dictionary_multiple_pronunciations |
| HSK 5 #1468 | 占 | zhàn | zhàn, zhān | dictionary_multiple_pronunciations |
| HSK 5 #1471 | 涨 | zhǎng | zhǎng, zhàng | dictionary_multiple_pronunciations |
| HSK 5 #1493 | 挣 | zhèng | zhèng, zhēng | dictionary_multiple_pronunciations |
| HSK 5 #1565 | 追 | zhuī | zhuī, duī | dictionary_multiple_pronunciations |
| HSK 6 #63 | 播种 | bōzhǒng | bō zhǒng, bō zhòng | dictionary_multiple_pronunciations |
| HSK 6 #111 | 侧 | cè | cè, zhāi | dictionary_multiple_pronunciations |
| HSK 6 #117 | 叉 | chā | chá, chǎ, chà, chā | dictionary_multiple_pronunciations |
| HSK 6 #157 | 乘 | chéng | shèng, chéng | dictionary_multiple_pronunciations |
| HSK 6 #158 | 盛 | chéng | shèng, chéng | dictionary_multiple_pronunciations |
| HSK 6 #171 | 尺 | chǐ | chǐ, chě | dictionary_multiple_pronunciations |
| HSK 6 #179 | 冲 | chòng | chòng, chōng | dictionary_multiple_pronunciations |
| HSK 6 #220 | 刺 | cì | cī, cì | dictionary_multiple_pronunciations |
| HSK 6 #247 | 大都 | dàdū | dà dū, dà dōu | dictionary_multiple_pronunciations |
| HSK 6 #248 | 大方 | dàfang | dà fang, dà fāng | dictionary_multiple_pronunciations |
| HSK 6 #256 | 待 | dài | dāi, dài | dictionary_multiple_pronunciations |
| HSK 6 #275 | 当天 | dàngtiān | dàng tiān, dāng tiān | dictionary_multiple_pronunciations |
| HSK 6 #278 | 倒车 | dǎochē | dào chē, dǎo chē | dictionary_multiple_pronunciations |
| HSK 6 #282 | 得了 | déle | dé liǎo, dé le | dictionary_multiple_pronunciations |
| HSK 6 #291 | 地道 | dìdao | dì dao, dì dào | dictionary_multiple_pronunciations |
| HSK 6 #292 | 地方 | dìfāng | dì fang, dì fāng | dictionary_multiple_pronunciations |
| HSK 6 #334 | 蹲 | dūn | cún, dūn | dictionary_multiple_pronunciations |
| HSK 6 #344 | 恶心 | ěxin | è xīn, ě xīn | dictionary_multiple_pronunciations |
| HSK 6 #362 | 番 | fān | pān, fān | dictionary_multiple_pronunciations |
| HSK 6 #398 | 服 | fú | fú, fù | dictionary_multiple_pronunciations |
| HSK 6 #447 | 跟前 | gēnqián | gēn qian, gēn qián | dictionary_multiple_pronunciations |
| HSK 6 #454 | 工夫 | gōngfu | gōng fu, gōng fū | dictionary_multiple_pronunciations |
| HSK 6 #536 | 好学 | hàoxué | hào xué, hǎo xué | dictionary_multiple_pronunciations |
| HSK 6 #548 | 横 | héng | hèng, héng | dictionary_multiple_pronunciations |
| HSK 6 #567 | 划 | huà | huà, huá | dictionary_multiple_pronunciations |
| HSK 6 #594 | 混 | hùn | hún, hùn | dictionary_multiple_pronunciations |
| HSK 6 #628 | 夹 | jiā | jiā, jiá, gā | dictionary_multiple_pronunciations |
| HSK 6 #681 | 结 | jiē | jié, jiē | dictionary_multiple_pronunciations |
| HSK 6 #682 | 结果 | jiēguǒ | jié guǒ, jiē guǒ | dictionary_multiple_pronunciations |
| HSK 6 #684 | 结实 | jiēshi | jiē shi, jiē shí | dictionary_multiple_pronunciations |
| HSK 6 #692 | 解 | jiě | xiè, jiè, jiě | dictionary_multiple_pronunciations |
| HSK 6 #705 | 金子 | jīnzi | jīn zi, jīn zǐ | dictionary_multiple_pronunciations |
| HSK 6 #706 | 尽 | jìn | jìn, jǐn | dictionary_multiple_pronunciations |
| HSK 6 #753 | 卷 | juǎn | juàn, juǎn | dictionary_multiple_pronunciations |
| HSK 6 #754 | 卷 | juàn | juàn, juǎn | dictionary_multiple_pronunciations |
| HSK 6 #770 | 看好 | kànhǎo | kàn hǎo, kān hǎo | dictionary_multiple_pronunciations |
| HSK 6 #791 | 空地 | kòngdì | kòng dì, kōng dì | dictionary_multiple_pronunciations |
| HSK 6 #806 | 款式 | kuǎnshì | kuǎn shi, kuǎn shì | dictionary_multiple_pronunciations |
| HSK 6 #810 | 落 | là | lào, là, luò | dictionary_multiple_pronunciations |
| HSK 6 #812 | 啦 | la | la, lā | dictionary_multiple_pronunciations |
| HSK 6 #852 | 淋 | lín | lín, lìn | dictionary_multiple_pronunciations |
| HSK 6 #861 | 露 | lòu | lù, lòu | dictionary_multiple_pronunciations |
| HSK 6 #863 | 露 | lù | lù, lòu | dictionary_multiple_pronunciations |
| HSK 6 #873 | 率 | lǜ | shuài, lǜ | dictionary_multiple_pronunciations |
| HSK 6 #884 | 码头 | mǎtóu | mǎ tóu, mǎ tou | dictionary_multiple_pronunciations |
| HSK 6 #886 | 嘛 | ma | ma, má | dictionary_multiple_pronunciations |
| HSK 6 #887 | 埋 | mái | mái, mán | dictionary_multiple_pronunciations |
| HSK 6 #907 | 免 | miǎn | miǎn, wèn | dictionary_multiple_pronunciations |
| HSK 6 #927 | 名气 | míngqi | míng qì, míng qi | dictionary_multiple_pronunciations |
| HSK 6 #943 | 难点 | nándiǎn | nàn diǎn, nán diǎn | dictionary_multiple_pronunciations |
| HSK 6 #947 | 脑袋 | nǎodai | nǎo dài, nǎo dai | dictionary_multiple_pronunciations |
| HSK 6 #955 | 泥 | ní | nì, ní | dictionary_multiple_pronunciations |
| HSK 6 #974 | 泡 | pào | pào, pāo | dictionary_multiple_pronunciations |
| HSK 6 #981 | 喷 | pēn | pèn, pēn | dictionary_multiple_pronunciations |
| HSK 6 #991 | 漂 | piāo | piào, piǎo, piāo | dictionary_multiple_pronunciations |
| HSK 6 #1009 | 铺 | pū | pù, pū | dictionary_multiple_pronunciations |
| HSK 6 #1075 | 曲 | qǔ | qū, qǔ | dictionary_multiple_pronunciations |
| HSK 6 #1079 | 圈 | quān | juàn, juān, quān | dictionary_multiple_pronunciations |
| HSK 6 #1095 | 人家 | rénjia | rén jia, rén jiā | dictionary_multiple_pronunciations |
| HSK 6 #1123 | 撒 | sǎ | sǎ, sā | dictionary_multiple_pronunciations |
| HSK 6 #1124 | 塞 | sāi | sài, sāi, sè | dictionary_multiple_pronunciations |
| HSK 6 #1126 | 散 | sǎn | sàn, sǎn | dictionary_multiple_pronunciations |
| HSK 6 #1128 | 散 | sàn | sàn, sǎn | dictionary_multiple_pronunciations |
| HSK 6 #1142 | 扇 | shàn | shān, shàn | dictionary_multiple_pronunciations |
| HSK 6 #1180 | 狮子 | shīzi | shī zi, shī zǐ | dictionary_multiple_pronunciations |
| HSK 6 #1181 | 识 | shí | shí, zhì | dictionary_multiple_pronunciations |
| HSK 6 #1182 | 拾 | shí | shè, shí | dictionary_multiple_pronunciations |
| HSK 6 #1224 | 属 | shǔ | shǔ, zhǔ | dictionary_multiple_pronunciations |
| HSK 6 #1243 | 艘 | sōu | sāo, sōu | dictionary_multiple_pronunciations |
| HSK 6 #1275 | 特 | tè | té, tè | dictionary_multiple_pronunciations |
| HSK 6 #1311 | 同行 | tóngháng | tóng xíng, tóng háng | dictionary_multiple_pronunciations |
| HSK 6 #1333 | 吐 | tǔ | tù, tǔ | dictionary_multiple_pronunciations |
| HSK 6 #1335 | 吐 | tù | tù, tǔ | dictionary_multiple_pronunciations |
| HSK 6 #1348 | 哇 | wā | wā, wa | dictionary_multiple_pronunciations |
| HSK 6 #1350 | 歪 | wāi | wāi, wǎi | dictionary_multiple_pronunciations |
| HSK 6 #1384 | 温和 | wēnhé | wēn huo, wēn hé | dictionary_multiple_pronunciations |
| HSK 6 #1403 | 媳妇 | xífu | xí fù, xí fu | dictionary_multiple_pronunciations |
| HSK 6 #1413 | 吓 | xià | xià, hè | dictionary_multiple_pronunciations |
| HSK 6 #1513 | 言语 | yányǔ | yán yu, yán yǔ | dictionary_multiple_pronunciations |
| HSK 6 #1633 | 晕 | yūn | yùn, yūn | dictionary_multiple_pronunciations |
| HSK 6 #1654 | 扎 | zhā | zhā, zā, zhá | dictionary_multiple_pronunciations |
| HSK 6 #1655 | 炸 | zhà | zhà, zhá | dictionary_multiple_pronunciations |
| HSK 6 #1656 | 粘 | zhān | zhān, nián | dictionary_multiple_pronunciations |
| HSK 6 #1675 | 折 | zhé | zhé, shé, zhē | dictionary_multiple_pronunciations |
| HSK 6 #1728 | 中 | zhòng | zhòng, zhōng | dictionary_multiple_pronunciations |
| HSK 6 #1737 | 粥 | zhōu | yù, zhōu | dictionary_multiple_pronunciations |
| HSK 6 #1769 | 转 | zhuàn | zhuǎi, zhuǎn, zhuàn | dictionary_multiple_pronunciations |
| HSK 6 #1770 | 转动 | zhuàndòng | zhuàn dòng, zhuǎn dòng | dictionary_multiple_pronunciations |
| HSK 6 #1793 | 足 | zú | zú, jù | dictionary_multiple_pronunciations |
| HSK 6 #1799 | 钻 | zuān | zuàn, zuān | dictionary_multiple_pronunciations |

## Mots absents du dictionnaire

| Entrée | Mot | Pinyin | Traduction source |
|---|---|---|---|
| HSK 6 #1464 | 新媒体 | xīnméitǐ | new media |
| HSK 6 #1466 | 新能源 | xīnnéngyuán | new energy |

## Mots trouvés mais pinyin non résolu

| Entrée | Mot | Pinyin HSK | Prononciations dictionnaire |
|---|---|---|---|
| HSK 4 #534 | 嗯 | ǹg | èn, ēn, en |
| HSK 5 #1521 | 中华民族 | Zhōnghuá | zhōng huá mín zú |

## Doublons dans un même niveau

| Niveau | Mot | Occurrences |
|---|---|---|
| HSK 2 | 花 | #57 huā (exact_dictionary_link), #58 huā (exact_dictionary_link) |
| HSK 2 | 过 | #47 guò (exact_dictionary_link), #51 guo (exact_dictionary_link) |
| HSK 3 | 得 | #83 dé (exact_dictionary_link), #87 děi (exact_dictionary_link) |
| HSK 4 | 生 | #646 shēng (exact_dictionary_link), #647 shēng (exact_dictionary_link) |
| HSK 4 | 空 | #436 kōng (exact_dictionary_link), #439 kòng (exact_dictionary_link) |
| HSK 4 | 重 | #86 chóng (exact_dictionary_link), #960 zhòng (exact_dictionary_link) |
| HSK 5 | 处 | #179 chǔ (exact_dictionary_link), #182 chù (exact_dictionary_link) |
| HSK 5 | 批 | #825 pī (exact_dictionary_link), #826 pī (exact_dictionary_link) |
| HSK 5 | 称 | #132 chēng (exact_dictionary_link), #133 chēng (exact_dictionary_link) |
| HSK 5 | 系 | #539 jì (exact_dictionary_link), #1226 xì (exact_dictionary_link) |
| HSK 5 | 调 | #284 diào (exact_dictionary_link), #1130 tiáo (exact_dictionary_link) |
| HSK 6 | 卷 | #753 juǎn (exact_dictionary_link), #754 juàn (exact_dictionary_link) |
| HSK 6 | 吐 | #1333 tǔ (exact_dictionary_link), #1335 tù (exact_dictionary_link) |
| HSK 6 | 局 | #741 jú (exact_dictionary_link), #742 jú (exact_dictionary_link) |
| HSK 6 | 散 | #1126 sǎn (exact_dictionary_link), #1128 sàn (exact_dictionary_link) |
| HSK 6 | 料 | #850 liào (exact_dictionary_link), #851 liào (exact_dictionary_link) |
| HSK 6 | 露 | #861 lòu (exact_dictionary_link), #863 lù (exact_dictionary_link) |

## Mots présents dans plusieurs niveaux

| Mot | Niveaux | Occurrences |
|---|---|---|
| 两 | 1, 4 | HSK 1 #111 (liǎng), HSK 4 #473 (liǎng) |
| 中 | 3, 6 | HSK 3 #481 (zhōng), HSK 6 #1728 (zhòng) |
| 为 | 3, 4, 5 | HSK 3 #375 (wèi), HSK 4 #771 (wéi), HSK 5 #1184 (wéi) |
| 乘 | 4, 6 | HSK 4 #78 (chéng), HSK 6 #157 (chéng) |
| 会 | 1, 3 | HSK 1 #82 (huì), HSK 3 #183 (huì) |
| 倒 | 4, 5 | HSK 4 #139 (dào), HSK 5 #253 (dǎo) |
| 冲 | 5, 6 | HSK 5 #158 (chōng), HSK 6 #179 (chòng) |
| 划 | 5, 6 | HSK 5 #496 (huá), HSK 6 #567 (huà) |
| 别 | 2, 5 | HSK 2 #11 (bié), HSK 5 #66 (bié) |
| 副 | 5, 6 | HSK 5 #369 (fù), HSK 6 #407 (fù) |
| 升 | 5, 6 | HSK 5 #989 (shēng), HSK 6 #1169 (shēng) |
| 只 | 1, 3 | HSK 1 #289 (zhī), HSK 3 #475 (zhǐ) |
| 啊 | 2, 4 | HSK 2 #1 (a), HSK 4 #1 (ā) |
| 喂 | 1, 5 | HSK 1 #219 (wèi), HSK 5 #1195 (wèi) |
| 地 | 2, 3 | HSK 2 #33 (de), HSK 3 #89 (dì) |
| 地方 | 3, 6 | HSK 3 #91 (dìfang), HSK 6 #292 (dìfāng) |
| 头 | 2, 5 | HSK 2 #145 (tóu), HSK 5 #1149 (tou) |
| 好 | 1, 5 | HSK 1 #71 (hǎo), HSK 5 #472 (hào) |
| 干 | 3, 4 | HSK 3 #140 (gàn), HSK 4 #220 (gān) |
| 当 | 4, 5 | HSK 4 #135 (dāng), HSK 5 #250 (dàng) |
| 待 | 4, 6 | HSK 4 #131 (dāi), HSK 6 #256 (dài) |
| 得 | 2, 3 | HSK 2 #32 (de), HSK 3 #83 (dé), HSK 3 #87 (děi) |
| 所 | 5, 6 | HSK 5 #1098 (suǒ), HSK 6 #1254 (suǒ) |
| 扇 | 5, 6 | HSK 5 #949 (shān), HSK 6 #1142 (shàn) |
| 才 | 3, 5 | HSK 3 #44 (cái), HSK 5 #83 (cái) |
| 支 | 5, 6 | HSK 5 #1499 (zhī), HSK 6 #1694 (zhī) |
| 数 | 4, 5 | HSK 4 #691 (shù), HSK 5 #1063 (shǔ) |
| 本 | 1, 5 | HSK 1 #10 (běn), HSK 5 #40 (běn) |
| 炸 | 5, 6 | HSK 5 #1460 (zhá), HSK 6 #1655 (zhà) |
| 点 | 1, 2 | HSK 1 #33 (diǎn), HSK 2 #36 (diǎn) |
| 省 | 4, 5 | HSK 4 #650 (shěng), HSK 5 #998 (shěng) |
| 看 | 1, 5 | HSK 1 #99 (kàn), HSK 5 #657 (kān) |
| 着 | 2, 4 | HSK 2 #190 (zhe), HSK 4 #924 (zháo) |
| 种 | 3, 4 | HSK 3 #484 (zhǒng), HSK 4 #959 (zhòng) |
| 站 | 2, 3 | HSK 2 #186 (zhàn), HSK 3 #466 (zhàn) |
| 等 | 2, 4 | HSK 2 #34 (děng), HSK 4 #147 (děng) |
| 结 | 5, 6 | HSK 5 #600 (jié), HSK 6 #681 (jiē) |
| 结果 | 4, 6 | HSK 4 #382 (jiéguǒ), HSK 6 #682 (jiēguǒ) |
| 背 | 4, 5 | HSK 4 #20 (bēi), HSK 5 #36 (bèi) |
| 落 | 4, 6 | HSK 4 #493 (luò), HSK 6 #810 (là) |
| 行 | 3, 5 | HSK 3 #408 (xíng), HSK 5 #467 (háng) |
| 该 | 3, 6 | HSK 3 #135 (gāi), HSK 6 #413 (gāi) |
| 转 | 4, 6 | HSK 4 #970 (zhuǎn), HSK 6 #1769 (zhuàn) |
| 过去 | 2, 3 | HSK 2 #50 (guòqù), HSK 3 #160 (guòqù) |
| 还 | 1, 3 | HSK 1 #67 (hái), HSK 3 #178 (huán) |
| 量 | 4, 5 | HSK 4 #472 (liáng), HSK 5 #719 (liàng) |
| 长 | 2, 3 | HSK 2 #14 (cháng), HSK 3 #468 (zhǎng) |
| 面 | 2, 5 | HSK 2 #103 (miàn), HSK 5 #767 (miàn) |

## Anomalies restantes

- Pinyins non résolus malgré un mot chinois exact dans le dictionnaire : **2**.
- Entrées du dictionnaire trouvées sans pinyin exploitable : **0**.
- Anomalies d’intégrité de l’index du dictionnaire : **0**.
- Pinyins HSK comportant plusieurs variantes explicites : **1**.
- Anomalies héritées de l’extraction HSK : **2**.
- Normalisations héritées de l’extraction HSK : **15**.

### Détail des anomalies héritées

- HSK 1 #236 — 小朋友 : `unexpected_digit_in_pinyin` (page=15, raw=xiǎopéngyou5, stored=xiǎopéngyou)
- HSK 5 #683 — 劳动 : `malformed_headword_in_pdf_text_layer` (raw=劳verb, stored=劳动, evidence=pinyin láodòng; translation 'labor, work; to work')

Aucun niveau HSK du dictionnaire n’a été lu ou utilisé. Tous les niveaux de ce rapport viennent exclusivement des six fichiers HSK analysés.
