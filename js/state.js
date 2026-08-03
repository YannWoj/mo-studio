"use strict";

/* ================= répétition espacée (SRS) ================= */
         // intervalles par niveau : 10 min, 1 j, 3 j, 7 j, 14 j, 30 j, 60 j, 120 j
         const INTERVALS = [
            600e3,
            86400e3,
            3 * 86400e3,
            7 * 86400e3,
            14 * 86400e3,
            30 * 86400e3,
            60 * 86400e3,
            120 * 86400e3,
         ];
         const MAXLVL = INTERVALS.length - 1;
         function fmtIv(ms) {
            if (ms < 3600e3) return Math.round(ms / 60e3) + " min";
            if (ms < 47 * 3600e3) return "1 j";
            return Math.round(ms / 86400e3) + " j";
         }
         function gradeIv(c) {
            // aperçu de l'intervalle pour chaque bouton, selon le niveau actuel de la carte
            const lvl = c.lvl || 0;
            return {
               again: INTERVALS[0],
               hard: INTERVALS[1],
               good: INTERVALS[Math.min(MAXLVL, Math.max(2, lvl + 1))],
               easy: INTERVALS[Math.min(MAXLVL, Math.max(3, lvl + 2))],
            };
         }
         function applyGrade(c, g) {
            const iv = gradeIv(c);
            if (g === "again") c.lvl = 0;
            else if (g === "hard") c.lvl = 1;
            else if (g === "good")
               c.lvl = Math.min(MAXLVL, Math.max(2, (c.lvl || 0) + 1));
            else c.lvl = Math.min(MAXLVL, Math.max(3, (c.lvl || 0) + 2));
            c.due = now() + iv[g];
            if (g === "again" || g === "hard") c.acquired = false;
            save();
         }
