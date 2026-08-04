"use strict";

/* ================= progression des futurs parcours ================= */
const COURSE_PROGRESS_KEY = "mo-studio-course-progress-v1";

function emptyCourseProgress() {
   return {
      version: 1,
      levels: {},
   };
}

function loadCourseProgress() {
   try {
      const stored = JSON.parse(localStorage.getItem(COURSE_PROGRESS_KEY));
      if (
         stored &&
         stored.version === 1 &&
         stored.levels &&
         typeof stored.levels === "object" &&
         !Array.isArray(stored.levels)
      ) {
         return stored;
      }
   } catch (error) {
      /* Un parcours vide reste disponible si son stockage est illisible. */
   }
   return emptyCourseProgress();
}

function saveCourseProgress() {
   try {
      localStorage.setItem(COURSE_PROGRESS_KEY, JSON.stringify(courseProgress));
   } catch (error) {
      toast("Impossible d’enregistrer la progression du parcours.");
   }
}

let courseProgress = loadCourseProgress();
