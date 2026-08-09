"use strict";

/* ================= progression du parcours ================= */
const COURSE_PROGRESS_KEY = "mo-studio-course-progress-v1";
const COURSE_PROGRESS_SCOPE_MODES = ["personal", "hsk", "all"];

function emptyCourseProgress() {
   return {
      version: 2,
      completedLessons: {}, // { [unitId]: horodatage de complétion (ms) }
      scope: { mode: "personal", hskLevel: 1 },
   };
}

function validCourseProgressScope(scope) {
   return (
      !!scope &&
      typeof scope === "object" &&
      COURSE_PROGRESS_SCOPE_MODES.includes(scope.mode) &&
      Number.isInteger(scope.hskLevel) &&
      scope.hskLevel >= 1 &&
      scope.hskLevel <= 6
   );
}

function loadCourseProgress() {
   try {
      const stored = JSON.parse(localStorage.getItem(COURSE_PROGRESS_KEY));
      if (
         stored &&
         stored.version === 2 &&
         stored.completedLessons &&
         typeof stored.completedLessons === "object" &&
         !Array.isArray(stored.completedLessons) &&
         validCourseProgressScope(stored.scope)
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

function recordLessonCompletion(unitId) {
   if (!unitId) return;
   courseProgress.completedLessons[String(unitId)] = Date.now();
   saveCourseProgress();
}

function isLessonCompleted(unitId) {
   return Object.prototype.hasOwnProperty.call(courseProgress.completedLessons, String(unitId));
}

function getCourseScope() {
   return { ...courseProgress.scope };
}

function setCourseScope(mode, hskLevel) {
   const resolvedMode = COURSE_PROGRESS_SCOPE_MODES.includes(mode) ? mode : courseProgress.scope.mode;
   const resolvedLevel =
      Number.isInteger(hskLevel) && hskLevel >= 1 && hskLevel <= 6 ? hskLevel : courseProgress.scope.hskLevel;
   courseProgress.scope = { mode: resolvedMode, hskLevel: resolvedLevel };
   saveCourseProgress();
}
