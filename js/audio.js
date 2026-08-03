"use strict";

/* ================= audio ================= */
         let voices = [];
         function refreshVoices() {
            if (!("speechSynthesis" in window)) return;
            voices = (speechSynthesis.getVoices() || []).filter((v) =>
               /^zh([-_]|$)/i.test(v.lang),
            );
         }
         if ("speechSynthesis" in window)
            speechSynthesis.onvoiceschanged = refreshVoices;
         function speak(text) {
            if (!("speechSynthesis" in window) || !text) return;
            speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(text);
            u.lang = "zh-CN";
            u.rate = db.settings.rate || 0.85;
            const v =
               voices.find((v) => v.voiceURI === db.settings.voice) ||
               voices[0];
            if (v) u.voice = v;
            speechSynthesis.speak(u);
         }
