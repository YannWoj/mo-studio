"use strict";

/* ================= utilitaires ================= */
         const $ = (id) => document.getElementById(id);
         const esc = (s) =>
            String(s ?? "").replace(
               /[&<>"']/g,
               (m) =>
                  ({
                     "&": "&amp;",
                     "<": "&lt;",
                     ">": "&gt;",
                     '"': "&quot;",
                     "'": "&#39;",
                  })[m],
            );
         const uid = () =>
            Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
         function shuffle(arr) {
            // mélange de Fisher-Yates
            const a = arr.slice();
            for (let i = a.length - 1; i > 0; i--) {
               const j = Math.floor(Math.random() * (i + 1));
               [a[i], a[j]] = [a[j], a[i]];
            }
            return a;
         }
         const flatten = (s) =>
            String(s ?? "")
               .toLowerCase()
               .normalize("NFD")
               .replace(/[\u0300-\u036f]/g, "")
               .replace(/[^a-z0-9\u4e00-\u9fff]/g, "");
         const now = () => Date.now();
         const isDue = (c) => c.due != null && c.due <= now();
         const fmtDate = (ts) =>
            new Date(ts).toLocaleString("fr-FR", {
               day: "2-digit",
               month: "2-digit",
               hour: "2-digit",
               minute: "2-digit",
            });
         const unitSort = (a, b) =>
            (a.unit ?? 999) - (b.unit ?? 999) ||
            (a.order ?? 9999) - (b.order ?? 9999) ||
            a.created - b.created;
