/**
 * reportService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Online Examination & Evaluation System — Report Service
 *
 * Responsibilities:
 *  • Generate student exam result reports
 *  • Generate instructor/admin analytics reports
 *  • Batch report generation across multiple students/exams
 *  • Export reports as JSON, CSV, or printable HTML
 *  • Performance analytics (per-question, per-section, per-student)
 *  • Rank computation and percentile calculation
 *  • Proctor violation summary integration
 *  • Report caching and retrieval
 *  • Scheduled report generation hooks
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── Constants ────────────────────────────────────────────────────────────────

export const ReportType = Object.freeze({
  STUDENT_RESULT:      "STUDENT_RESULT",
  EXAM_ANALYTICS:      "EXAM_ANALYTICS",
  SECTION_ANALYTICS:   "SECTION_ANALYTICS",
  QUESTION_ANALYSIS:   "QUESTION_ANALYSIS",
  BATCH_RESULTS:       "BATCH_RESULTS",
  PROCTOR_SUMMARY:     "PROCTOR_SUMMARY",
  COMPARATIVE:         "COMPARATIVE",
  PROGRESS_TRACKER:    "PROGRESS_TRACKER",
});

export const ExportFormat = Object.freeze({
  JSON:  "json",
  CSV:   "csv",
  HTML:  "html",
  PRINT: "print",
});

export const GradeScale = Object.freeze({
  LETTER: "letter",   // A+, A, B+, B, C, F
  POINTS: "points",   // 10-point GPA scale
  PERCENT:"percent",  // Raw percentage
});

// Default grading thresholds (percentage-based)
const DEFAULT_GRADE_THRESHOLDS = [
  { min: 90, grade: "A+", points: 10.0, label: "Outstanding" },
  { min: 80, grade: "A",  points: 9.0,  label: "Excellent"   },
  { min: 70, grade: "B+", points: 8.0,  label: "Very Good"   },
  { min: 60, grade: "B",  points: 7.0,  label: "Good"        },
  { min: 50, grade: "C",  points: 6.0,  label: "Average"     },
  { min: 40, grade: "D",  points: 5.0,  label: "Pass"        },
  { min: 0,  grade: "F",  points: 0.0,  label: "Fail"        },
];

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ─── Utility Helpers ──────────────────────────────────────────────────────────

/**
 * Clamp a number between min and max.
 */
function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/**
 * Round to N decimal places.
 */
function round(val, decimals = 2) {
  return Math.round(val * 10 ** decimals) / 10 ** decimals;
}

/**
 * Calculate mean of an array of numbers.
 */
function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

/**
 * Calculate standard deviation.
 */
function stdDev(arr) {
  if (arr.length < 2) return 0;
  const avg = mean(arr);
  const variance = mean(arr.map(v => (v - avg) ** 2));
  return Math.sqrt(variance);
}

/**
 * Calculate median of a sorted array.
 */
function median(arr) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Compute percentile rank of a score within a distribution.
 * Returns 0–100.
 */
function percentileRank(score, allScores) {
  if (!allScores.length) return 0;
  const below = allScores.filter(s => s < score).length;
  return round((below / allScores.length) * 100, 1);
}

/**
 * Deep-clone a plain object/array.
 */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Format a duration in seconds to "Hh Mm Ss" string.
 */
function formatDuration(seconds) {
  if (seconds == null || isNaN(seconds)) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (h) parts.push(`${h}h`);
  if (m || h) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(" ");
}

/**
 * Pad a number to 2 digits.
 */
function pad2(n) {
  return String(n).padStart(2, "0");
}

/**
 * Format a date to a readable string.
 */
function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/**
 * Escape HTML special chars for safe HTML embedding.
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Convert an array of objects to CSV string.
 */
function toCSV(rows, columns) {
  if (!rows.length) return "";
  const cols = columns || Object.keys(rows[0]);
  const header = cols.map(c => `"${c}"`).join(",");
  const lines = rows.map(row =>
    cols.map(c => {
      const val = row[c] == null ? "" : row[c];
      return `"${String(val).replace(/"/g, '""')}"`;
    }).join(",")
  );
  return [header, ...lines].join("\r\n");
}

// ─── Grade Calculator ─────────────────────────────────────────────────────────

class GradeCalculator {
  constructor(thresholds = DEFAULT_GRADE_THRESHOLDS) {
    // Sort descending by min
    this._thresholds = [...thresholds].sort((a, b) => b.min - a.min);
  }

  /**
   * Get grade info for a given percentage.
   * @param {number} pct — 0 to 100
   * @returns {{ grade, points, label, passed }}
   */
  getGrade(pct) {
    const t = this._thresholds.find(t => pct >= t.min) || this._thresholds[this._thresholds.length - 1];
    return {
      grade:  t.grade,
      points: t.points,
      label:  t.label,
      passed: t.points >= 5.0,
      pct:    round(pct, 2),
    };
  }

  /**
   * Compute CGPA from an array of { marks, totalMarks } records.
   */
  computeCGPA(records) {
    if (!records.length) return 0;
    let weightedSum = 0;
    let totalCredits = 0;
    records.forEach(r => {
      const pct = (r.marks / r.totalMarks) * 100;
      const { points } = this.getGrade(pct);
      const credits = r.credits || 1;
      weightedSum  += points * credits;
      totalCredits += credits;
    });
    return round(weightedSum / totalCredits, 2);
  }
}

// ─── ReportService ────────────────────────────────────────────────────────────

class ReportService {
  constructor(options = {}) {
    this._gradeCalc = new GradeCalculator(options.gradeThresholds);
    this._cache     = new Map();   // reportId → { report, expiresAt }
    this._hooks     = { beforeGenerate: [], afterGenerate: [] };
    this._opts      = {
      cacheTTLMs:   options.cacheTTLMs   ?? CACHE_TTL_MS,
      orgName:      options.orgName      ?? "ExamPortal",
      orgLogo:      options.orgLogo      ?? null,
      passingPct:   options.passingPct   ?? 40,
      ...options,
    };
  }

  // ── Hooks ─────────────────────────────────────────────────────────────────

  /**
   * Register a hook that runs before/after report generation.
   * @param {"beforeGenerate"|"afterGenerate"} hook
   * @param {Function} fn
   */
  addHook(hook, fn) {
    if (!this._hooks[hook]) throw new Error(`Unknown hook: ${hook}`);
    this._hooks[hook].push(fn);
  }

  async _runHooks(hook, ctx) {
    for (const fn of this._hooks[hook]) {
      await fn(ctx);
    }
  }

  // ── Core: Student Result Report ───────────────────────────────────────────

  /**
   * Generate a full result report for a single student's exam attempt.
   *
   * @param {object} params
   * @param {object} params.student         — { id, name, rollNo, department, semester }
   * @param {object} params.exam            — { id, title, code, type, totalMarks, duration }
   * @param {object[]} params.questions     — Question definitions
   * @param {object} params.answers         — { [questionId]: selectedOption | selectedOptions[] }
   * @param {object} [params.proctorSummary]— Output of proctorService.getSummary()
   * @param {object} [params.meta]          — { startedAt, submittedAt, ipAddress, ... }
   * @returns {StudentResultReport}
   */
  async generateStudentResult({ student, exam, questions, answers, proctorSummary, meta = {} }) {
    const ctx = { type: ReportType.STUDENT_RESULT, student, exam };
    await this._runHooks("beforeGenerate", ctx);

    const questionReports = this._evaluateQuestions(questions, answers);
    const scoring         = this._computeScoring(questionReports, exam.totalMarks);
    const gradeInfo       = this._gradeCalc.getGrade(scoring.percentage);
    const timeStats       = this._computeTimeStats(meta);
    const sectionBreakdown= this._computeSectionBreakdown(questionReports);

    const report = {
      reportId:          this._generateReportId("SR"),
      reportType:        ReportType.STUDENT_RESULT,
      generatedAt:       new Date().toISOString(),
      org:               this._opts.orgName,

      student:           { ...student },
      exam: {
        ...exam,
        startedAt:     meta.startedAt    || null,
        submittedAt:   meta.submittedAt  || null,
      },

      scoring: {
        obtained:        scoring.obtained,
        total:           exam.totalMarks,
        percentage:      scoring.percentage,
        grade:           gradeInfo.grade,
        gradePoints:     gradeInfo.points,
        gradeLabel:      gradeInfo.label,
        passed:          gradeInfo.passed,
        correct:         scoring.correct,
        wrong:           scoring.wrong,
        skipped:         scoring.skipped,
        totalQuestions:  questions.length,
        attemptRate:     round(((scoring.correct + scoring.wrong) / questions.length) * 100, 1),
        accuracy:        scoring.correct + scoring.wrong > 0
                           ? round((scoring.correct / (scoring.correct + scoring.wrong)) * 100, 1)
                           : 0,
      },

      timeStats,
      sectionBreakdown,
      questionReports,

      proctor: proctorSummary
        ? this._summarizeProctor(proctorSummary)
        : null,

      meta: {
        ipAddress:       meta.ipAddress  || null,
        userAgent:       meta.userAgent  || navigator?.userAgent || null,
        browser:         this._parseBrowser(meta.userAgent),
        ...meta,
      },
    };

    this._cacheReport(report.reportId, report);
    await this._runHooks("afterGenerate", { ...ctx, report });

    return report;
  }

  // ── Core: Exam Analytics Report ───────────────────────────────────────────

  /**
   * Generate analytics report for an exam across all students.
   *
   * @param {object} params
   * @param {object} params.exam            — Exam definition
   * @param {object[]} params.questions     — Question definitions
   * @param {object[]} params.allAttempts   — Array of { student, answers, meta }
   * @returns {ExamAnalyticsReport}
   */
  async generateExamAnalytics({ exam, questions, allAttempts }) {
    const ctx = { type: ReportType.EXAM_ANALYTICS, exam };
    await this._runHooks("beforeGenerate", ctx);

    if (!allAttempts.length) {
      return this._emptyAnalyticsReport(exam);
    }

    // Evaluate every attempt
    const evaluated = allAttempts.map(attempt => {
      const qReports = this._evaluateQuestions(questions, attempt.answers);
      const scoring  = this._computeScoring(qReports, exam.totalMarks);
      const grade    = this._gradeCalc.getGrade(scoring.percentage);
      return { attempt, qReports, scoring, grade };
    });

    const allScores       = evaluated.map(e => e.scoring.percentage);
    const allObtained     = evaluated.map(e => e.scoring.obtained);
    const passedCount     = evaluated.filter(e => e.grade.passed).length;
    const rankings        = this._computeRankings(evaluated);
    const questionAnalysis= this._analyzeQuestions(questions, evaluated);
    const sectionAnalysis = this._analyzeSections(questions, evaluated);
    const gradeDistrib    = this._gradeDistribution(evaluated);
    const scoreHistogram  = this._buildHistogram(allScores, 10);

    const report = {
      reportId:     this._generateReportId("EA"),
      reportType:   ReportType.EXAM_ANALYTICS,
      generatedAt:  new Date().toISOString(),
      org:          this._opts.orgName,

      exam:         { ...exam },

      participation: {
        enrolled:   allAttempts.length,
        attempted:  allAttempts.length,
        passed:     passedCount,
        failed:     allAttempts.length - passedCount,
        passRate:   round((passedCount / allAttempts.length) * 100, 1),
      },

      scoreStats: {
        mean:       round(mean(allScores), 2),
        median:     round(median(allScores), 2),
        stdDev:     round(stdDev(allScores), 2),
        min:        round(Math.min(...allScores), 2),
        max:        round(Math.max(...allScores), 2),
        range:      round(Math.max(...allScores) - Math.min(...allScores), 2),
        meanMarks:  round(mean(allObtained), 2),
      },

      gradeDistribution: gradeDistrib,
      scoreHistogram,
      rankings,
      questionAnalysis,
      sectionAnalysis,

      topPerformers:    rankings.slice(0, 5),
      bottomPerformers: [...rankings].sort((a, b) => b.rank - a.rank).slice(0, 5),
    };

    this._cacheReport(report.reportId, report);
    await this._runHooks("afterGenerate", { ...ctx, report });

    return report;
  }

  // ── Core: Batch Results Report ────────────────────────────────────────────

  /**
   * Generate a flat batch results table — one row per student.
   *
   * @param {object} params
   * @param {object} params.exam
   * @param {object[]} params.questions
   * @param {object[]} params.allAttempts  — [{ student, answers, meta }]
   * @returns {BatchResultsReport}
   */
  async generateBatchResults({ exam, questions, allAttempts }) {
    const ctx = { type: ReportType.BATCH_RESULTS, exam };
    await this._runHooks("beforeGenerate", ctx);

    const rows = allAttempts.map((attempt, idx) => {
      const qReports = this._evaluateQuestions(questions, attempt.answers);
      const scoring  = this._computeScoring(qReports, exam.totalMarks);
      const grade    = this._gradeCalc.getGrade(scoring.percentage);
      const section  = this._computeSectionBreakdown(qReports);
      return {
        slNo:         idx + 1,
        studentId:    attempt.student?.id        || "—",
        rollNo:       attempt.student?.rollNo    || "—",
        name:         attempt.student?.name      || "—",
        department:   attempt.student?.department|| "—",
        obtained:     scoring.obtained,
        total:        exam.totalMarks,
        percentage:   scoring.percentage,
        grade:        grade.grade,
        gradePoints:  grade.points,
        passed:       grade.passed ? "Yes" : "No",
        correct:      scoring.correct,
        wrong:        scoring.wrong,
        skipped:      scoring.skipped,
        timeTaken:    formatDuration(attempt.meta?.durationSeconds),
        submittedAt:  formatDate(attempt.meta?.submittedAt),
        sectionScores:section.map(s => `${s.section}: ${s.obtained}/${s.total}`).join(" | "),
        rank:         null, // filled below
      };
    });

    // Assign ranks
    const sorted = [...rows].sort((a, b) => b.percentage - a.percentage || b.obtained - a.obtained);
    sorted.forEach((row, i) => {
      const original = rows.find(r => r.rollNo === row.rollNo && r.studentId === row.studentId);
      if (original) {
        original.rank = i + 1;
        original.percentile = percentileRank(row.percentage, rows.map(r => r.percentage));
      }
    });

    const report = {
      reportId:    this._generateReportId("BR"),
      reportType:  ReportType.BATCH_RESULTS,
      generatedAt: new Date().toISOString(),
      org:         this._opts.orgName,
      exam:        { ...exam },
      totalStudents: rows.length,
      rows,
    };

    this._cacheReport(report.reportId, report);
    await this._runHooks("afterGenerate", { ...ctx, report });

    return report;
  }

  // ── Core: Progress Tracker Report ────────────────────────────────────────

  /**
   * Generate a multi-exam progress report for one student.
   *
   * @param {object} params
   * @param {object} params.student
   * @param {object[]} params.examHistory  — [{ exam, questions, answers, meta }]
   * @returns {ProgressTrackerReport}
   */
  async generateProgressTracker({ student, examHistory }) {
    const ctx = { type: ReportType.PROGRESS_TRACKER, student };
    await this._runHooks("beforeGenerate", ctx);

    const entries = examHistory.map(h => {
      const qReports = this._evaluateQuestions(h.questions, h.answers);
      const scoring  = this._computeScoring(qReports, h.exam.totalMarks);
      const grade    = this._gradeCalc.getGrade(scoring.percentage);
      return {
        examId:      h.exam.id,
        examTitle:   h.exam.title,
        examCode:    h.exam.code,
        examType:    h.exam.type,
        date:        h.meta?.submittedAt || null,
        obtained:    scoring.obtained,
        total:       h.exam.totalMarks,
        percentage:  scoring.percentage,
        grade:       grade.grade,
        gradePoints: grade.points,
        passed:      grade.passed,
        correct:     scoring.correct,
        wrong:       scoring.wrong,
        skipped:     scoring.skipped,
      };
    });

    const scores      = entries.map(e => e.percentage);
    const gpaRecords  = entries.map(e => ({ marks: e.obtained, totalMarks: e.total, credits: 1 }));
    const cgpa        = this._gradeCalc.computeCGPA(gpaRecords);
    const trend       = this._computeTrend(scores);

    // Per-subject best/worst
    const subjectMap  = {};
    entries.forEach(e => {
      if (!subjectMap[e.examCode]) subjectMap[e.examCode] = [];
      subjectMap[e.examCode].push(e.percentage);
    });
    const subjectSummary = Object.entries(subjectMap).map(([code, pcts]) => ({
      code,
      attempts: pcts.length,
      best:     round(Math.max(...pcts), 1),
      avg:      round(mean(pcts), 1),
      latest:   round(pcts[pcts.length - 1], 1),
    }));

    const report = {
      reportId:       this._generateReportId("PT"),
      reportType:     ReportType.PROGRESS_TRACKER,
      generatedAt:    new Date().toISOString(),
      org:            this._opts.orgName,
      student:        { ...student },
      totalExams:     entries.length,
      passed:         entries.filter(e => e.passed).length,
      failed:         entries.filter(e => !e.passed).length,
      cgpa,
      overallPct:     round(mean(scores), 2),
      trend,
      entries,
      subjectSummary,
      scoreTimeline: entries.map(e => ({ label: e.examCode || e.examTitle, pct: e.percentage, date: e.date })),
    };

    this._cacheReport(report.reportId, report);
    await this._runHooks("afterGenerate", { ...ctx, report });

    return report;
  }

  // ── Export ────────────────────────────────────────────────────────────────

  /**
   * Export a report in the specified format.
   *
   * @param {object|string} reportOrId — Report object or cached report ID
   * @param {string} format            — ExportFormat constant
   * @param {object} [options]         — Format-specific options
   * @returns {{ data: string, filename: string, mimeType: string }}
   */
  export(reportOrId, format = ExportFormat.JSON, options = {}) {
    const report = typeof reportOrId === "string"
      ? this.getFromCache(reportOrId)
      : reportOrId;

    if (!report) throw new Error(`[ReportService] Report not found: ${reportOrId}`);

    switch (format) {
      case ExportFormat.JSON:  return this._exportJSON(report, options);
      case ExportFormat.CSV:   return this._exportCSV(report, options);
      case ExportFormat.HTML:  return this._exportHTML(report, options);
      case ExportFormat.PRINT: return this._exportPrint(report, options);
      default:
        throw new Error(`[ReportService] Unknown export format: ${format}`);
    }
  }

  /**
   * Trigger browser download for a report.
   *
   * @param {object} report
   * @param {string} format
   */
  download(report, format = ExportFormat.JSON) {
    const { data, filename, mimeType } = this.export(report, format);
    const blob = new Blob([data], { type: mimeType });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Open browser print dialog with a formatted HTML report.
   * @param {object} report
   */
  print(report) {
    const { data } = this.export(report, ExportFormat.HTML);
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) throw new Error("Popup blocked. Allow popups for printing.");
    win.document.write(data);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 500);
  }

  // ── Cache ─────────────────────────────────────────────────────────────────

  _cacheReport(id, report) {
    this._cache.set(id, { report, expiresAt: Date.now() + this._opts.cacheTTLMs });
  }

  getFromCache(id) {
    const entry = this._cache.get(id);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) { this._cache.delete(id); return null; }
    return deepClone(entry.report);
  }

  clearCache() {
    this._cache.clear();
  }

  listCachedReports() {
    const now = Date.now();
    return [...this._cache.entries()]
      .filter(([, v]) => now <= v.expiresAt)
      .map(([id, v]) => ({ id, type: v.report.reportType, generatedAt: v.report.generatedAt }));
  }

  // ── Private: Evaluation ───────────────────────────────────────────────────

  _evaluateQuestions(questions, answers) {
    return questions.map(q => {
      const raw = answers[q.id];
      let status, earned;

      if (q.type === "msq") {
        if (!raw || (Array.isArray(raw) && raw.length === 0)) {
          status = "skipped"; earned = 0;
        } else {
          const given    = [...raw].sort().join(",");
          const expected = [...q.correct].sort().join(",");
          status = given === expected ? "correct" : "wrong";
          earned = status === "correct" ? q.marks : 0;
        }
      } else {
        if (raw === undefined || raw === null) {
          status = "skipped"; earned = 0;
        } else {
          status = raw === q.correct ? "correct" : "wrong";
          earned = status === "correct" ? q.marks : 0;
        }
      }

      return {
        questionId:   q.id,
        section:      q.section   || "General",
        type:         q.type      || "mcq",
        marks:        q.marks,
        earned,
        status,
        givenAnswer:  raw ?? null,
        correctAnswer:q.correct,
        difficulty:   q.difficulty || "Medium",
        topic:        q.topic      || q.section || "—",
      };
    });
  }

  _computeScoring(qReports, totalMarks) {
    const obtained = qReports.reduce((s, q) => s + q.earned, 0);
    const correct  = qReports.filter(q => q.status === "correct").length;
    const wrong    = qReports.filter(q => q.status === "wrong").length;
    const skipped  = qReports.filter(q => q.status === "skipped").length;
    const pct      = totalMarks > 0 ? round((obtained / totalMarks) * 100, 2) : 0;
    return { obtained, percentage: pct, correct, wrong, skipped };
  }

  _computeTimeStats(meta) {
    const start = meta.startedAt   ? new Date(meta.startedAt)   : null;
    const end   = meta.submittedAt ? new Date(meta.submittedAt) : null;
    const durationSeconds = (start && end && !isNaN(start) && !isNaN(end))
      ? Math.round((end - start) / 1000)
      : (meta.durationSeconds || null);
    return {
      startedAt:       meta.startedAt    || null,
      submittedAt:     meta.submittedAt  || null,
      durationSeconds,
      durationFormatted: formatDuration(durationSeconds),
    };
  }

  _computeSectionBreakdown(qReports) {
    const sections = {};
    qReports.forEach(q => {
      if (!sections[q.section]) {
        sections[q.section] = { section: q.section, total: 0, obtained: 0, correct: 0, wrong: 0, skipped: 0, questions: 0 };
      }
      const s = sections[q.section];
      s.questions++;
      s.total    += q.marks;
      s.obtained += q.earned;
      s.correct  += q.status === "correct"  ? 1 : 0;
      s.wrong    += q.status === "wrong"    ? 1 : 0;
      s.skipped  += q.status === "skipped"  ? 1 : 0;
    });

    return Object.values(sections).map(s => ({
      ...s,
      percentage: s.total > 0 ? round((s.obtained / s.total) * 100, 1) : 0,
      accuracy:   s.correct + s.wrong > 0
                    ? round((s.correct / (s.correct + s.wrong)) * 100, 1)
                    : 0,
    }));
  }

  _summarizeProctor(ps) {
    if (!ps) return null;
    const total = ps.totalViolations || 0;
    const high  = ps.highViolations  || 0;
    const severity = high >= 5 ? "critical" : high >= 3 ? "high" : high >= 1 ? "medium" : "clean";
    return {
      sessionId:       ps.sessionId,
      totalViolations: total,
      highViolations:  high,
      violationCounts: ps.violationCounts || {},
      severity,
      flagged:         severity !== "clean",
    };
  }

  _parseBrowser(ua) {
    if (!ua) return "Unknown";
    if (/Edg\//.test(ua))     return "Microsoft Edge";
    if (/Chrome\//.test(ua))  return "Google Chrome";
    if (/Firefox\//.test(ua)) return "Mozilla Firefox";
    if (/Safari\//.test(ua))  return "Apple Safari";
    if (/Opera\//.test(ua))   return "Opera";
    return "Unknown";
  }

  // ── Private: Analytics ────────────────────────────────────────────────────

  _computeRankings(evaluated) {
    return [...evaluated]
      .sort((a, b) => b.scoring.percentage - a.scoring.percentage || b.scoring.obtained - a.scoring.obtained)
      .map((e, i) => ({
        rank:        i + 1,
        studentId:   e.attempt.student?.id     || "—",
        rollNo:      e.attempt.student?.rollNo || "—",
        name:        e.attempt.student?.name   || "—",
        obtained:    e.scoring.obtained,
        percentage:  e.scoring.percentage,
        grade:       e.grade.grade,
        passed:      e.grade.passed,
        percentile:  null, // filled after all ranks known
      }))
      .map((r, _, arr) => ({
        ...r,
        percentile: percentileRank(r.percentage, arr.map(x => x.percentage)),
      }));
  }

  _analyzeQuestions(questions, evaluated) {
    return questions.map(q => {
      const qResults = evaluated.map(e => e.qReports.find(r => r.questionId === q.id)).filter(Boolean);
      const total    = qResults.length;
      const correct  = qResults.filter(r => r.status === "correct").length;
      const wrong    = qResults.filter(r => r.status === "wrong").length;
      const skipped  = qResults.filter(r => r.status === "skipped").length;

      return {
        questionId:     q.id,
        text:           (q.text || "").slice(0, 80) + ((q.text?.length || 0) > 80 ? "…" : ""),
        section:        q.section   || "General",
        type:           q.type      || "mcq",
        marks:          q.marks,
        difficulty:     q.difficulty || "Medium",
        totalAttempts:  total,
        correctCount:   correct,
        wrongCount:     wrong,
        skippedCount:   skipped,
        correctRate:    total ? round((correct / total) * 100, 1) : 0,
        skipRate:       total ? round((skipped / total) * 100, 1) : 0,
        discriminationIndex: this._discriminationIndex(qResults, evaluated),
      };
    });
  }

  /**
   * Discrimination Index: difference in correct rate between top 27% and bottom 27%.
   * Range -1 to 1. Higher = better question discrimination.
   */
  _discriminationIndex(qResults, evaluated) {
    if (evaluated.length < 4) return null;
    const sorted     = [...evaluated].sort((a, b) => b.scoring.percentage - a.scoring.percentage);
    const cutoff     = Math.max(1, Math.floor(sorted.length * 0.27));
    const topGroup   = sorted.slice(0, cutoff);
    const bottomGroup= sorted.slice(-cutoff);

    const rate = (group) => {
      const correct = group.filter(e => {
        const r = e.qReports.find(r => r.questionId === qResults[0]?.questionId);
        return r?.status === "correct";
      }).length;
      return correct / group.length;
    };

    return round(rate(topGroup) - rate(bottomGroup), 3);
  }

  _analyzeSections(questions, evaluated) {
    const sectionNames = [...new Set(questions.map(q => q.section || "General"))];
    return sectionNames.map(sec => {
      const secQs      = questions.filter(q => (q.section || "General") === sec);
      const totalMarks = secQs.reduce((s, q) => s + q.marks, 0);
      const pcts       = evaluated.map(e => {
        const secReports = e.qReports.filter(r => r.section === sec);
        const obt        = secReports.reduce((s, r) => s + r.earned, 0);
        return totalMarks > 0 ? (obt / totalMarks) * 100 : 0;
      });
      return {
        section:    sec,
        questions:  secQs.length,
        totalMarks,
        meanPct:    round(mean(pcts), 1),
        medianPct:  round(median(pcts), 1),
        stdDev:     round(stdDev(pcts), 1),
        passRate:   round((pcts.filter(p => p >= this._opts.passingPct).length / pcts.length) * 100, 1),
      };
    });
  }

  _gradeDistribution(evaluated) {
    const dist = {};
    DEFAULT_GRADE_THRESHOLDS.forEach(t => { dist[t.grade] = 0; });
    evaluated.forEach(e => { dist[e.grade.grade] = (dist[e.grade.grade] || 0) + 1; });
    return Object.entries(dist).map(([grade, count]) => ({
      grade,
      count,
      pct: evaluated.length ? round((count / evaluated.length) * 100, 1) : 0,
    }));
  }

  _buildHistogram(values, bins = 10) {
    if (!values.length) return [];
    const min  = 0, max = 100;
    const size = (max - min) / bins;
    const histogram = Array.from({ length: bins }, (_, i) => ({
      rangeStart: round(min + i * size, 0),
      rangeEnd:   round(min + (i + 1) * size, 0),
      label:      `${round(min + i * size, 0)}–${round(min + (i + 1) * size, 0)}`,
      count:      0,
    }));
    values.forEach(v => {
      const idx = clamp(Math.floor((v - min) / size), 0, bins - 1);
      histogram[idx].count++;
    });
    return histogram;
  }

  _computeTrend(scores) {
    if (scores.length < 2) return "stable";
    const recent3 = scores.slice(-3);
    const avg3    = mean(recent3);
    const overall = mean(scores);
    if (avg3 > overall + 3)  return "improving";
    if (avg3 < overall - 3)  return "declining";
    return "stable";
  }

  _emptyAnalyticsReport(exam) {
    return {
      reportId:     this._generateReportId("EA"),
      reportType:   ReportType.EXAM_ANALYTICS,
      generatedAt:  new Date().toISOString(),
      exam,
      participation:{ enrolled: 0, attempted: 0, passed: 0, failed: 0, passRate: 0 },
      scoreStats:   { mean: 0, median: 0, stdDev: 0, min: 0, max: 0, range: 0 },
      gradeDistribution: [],
      scoreHistogram: [],
      rankings: [],
      questionAnalysis: [],
      sectionAnalysis: [],
      topPerformers: [],
      bottomPerformers: [],
    };
  }

  // ── Private: Export Formatters ────────────────────────────────────────────

  _exportJSON(report, { pretty = true } = {}) {
    return {
      data:     JSON.stringify(report, null, pretty ? 2 : 0),
      filename: `${report.reportType}_${report.reportId}.json`,
      mimeType: "application/json",
    };
  }

  _exportCSV(report) {
    let rows = [], columns = [];

    if (report.reportType === ReportType.BATCH_RESULTS) {
      rows    = report.rows;
      columns = ["rank","slNo","rollNo","name","department","obtained","total","percentage","grade","gradePoints","passed","correct","wrong","skipped","timeTaken","submittedAt"];
    } else if (report.reportType === ReportType.EXAM_ANALYTICS) {
      rows    = report.rankings;
      columns = ["rank","rollNo","name","obtained","percentage","grade","passed","percentile"];
    } else if (report.reportType === ReportType.STUDENT_RESULT) {
      rows    = report.questionReports.map(q => ({
        questionId:    q.questionId,
        section:       q.section,
        type:          q.type,
        marks:         q.marks,
        earned:        q.earned,
        status:        q.status,
        difficulty:    q.difficulty,
      }));
      columns = ["questionId","section","type","marks","earned","status","difficulty"];
    } else if (report.reportType === ReportType.PROGRESS_TRACKER) {
      rows    = report.entries;
      columns = ["examCode","examTitle","examType","date","obtained","total","percentage","grade","passed"];
    } else {
      return this._exportJSON(report);
    }

    return {
      data:     toCSV(rows, columns),
      filename: `${report.reportType}_${report.reportId}.csv`,
      mimeType: "text/csv",
    };
  }

  _exportHTML(report) {
    const html = this._buildHTMLReport(report);
    return {
      data:     html,
      filename: `${report.reportType}_${report.reportId}.html`,
      mimeType: "text/html",
    };
  }

  _exportPrint(report) {
    return this._exportHTML(report);
  }

  // ── HTML Report Builder ───────────────────────────────────────────────────

  _buildHTMLReport(report) {
    const title = `${report.reportType.replace(/_/g, " ")} — ${this._opts.orgName}`;

    const studentResultSection = () => {
      if (report.reportType !== ReportType.STUDENT_RESULT) return "";
      const s = report.scoring;
      const p = report.proctor;
      return `
        <div class="section">
          <h2>Student Information</h2>
          <table class="info-table">
            <tr><td>Name</td><td><strong>${escapeHtml(report.student?.name || "—")}</strong></td>
                <td>Roll No.</td><td>${escapeHtml(report.student?.rollNo || "—")}</td></tr>
            <tr><td>Department</td><td>${escapeHtml(report.student?.department || "—")}</td>
                <td>Semester</td><td>${escapeHtml(report.student?.semester || "—")}</td></tr>
          </table>
        </div>
        <div class="section">
          <h2>Exam Details</h2>
          <table class="info-table">
            <tr><td>Subject</td><td><strong>${escapeHtml(report.exam?.title || "—")}</strong></td>
                <td>Code</td><td>${escapeHtml(report.exam?.code || "—")}</td></tr>
            <tr><td>Type</td><td>${escapeHtml(report.exam?.type || "—")}</td>
                <td>Duration</td><td>${escapeHtml(report.timeStats?.durationFormatted || "—")}</td></tr>
          </table>
        </div>
        <div class="section">
          <h2>Score Summary</h2>
          <div class="score-card">
            <div class="score-big">${s.obtained}<span class="score-total">/${s.total}</span></div>
            <div class="score-pct">${s.percentage}%</div>
            <div class="grade-badge grade-${s.grade.replace("+","p")}">${s.grade}</div>
            <div class="score-label">${s.passed ? "✅ PASSED" : "❌ FAILED"}</div>
          </div>
          <table class="info-table">
            <tr><td>Correct</td><td class="green">${s.correct}</td>
                <td>Wrong</td><td class="red">${s.wrong}</td>
                <td>Skipped</td><td class="amber">${s.skipped}</td></tr>
            <tr><td>Attempt Rate</td><td>${s.attemptRate}%</td>
                <td>Accuracy</td><td>${s.accuracy}%</td>
                <td>Grade Points</td><td>${s.gradePoints}</td></tr>
          </table>
        </div>
        <div class="section">
          <h2>Section-Wise Breakdown</h2>
          <table class="data-table">
            <thead><tr><th>Section</th><th>Questions</th><th>Marks</th><th>Obtained</th><th>%</th><th>Correct</th><th>Wrong</th><th>Skipped</th></tr></thead>
            <tbody>
              ${(report.sectionBreakdown || []).map(s => `
                <tr>
                  <td>${escapeHtml(s.section)}</td>
                  <td>${s.questions}</td>
                  <td>${s.total}</td>
                  <td>${s.obtained}</td>
                  <td>${s.percentage}%</td>
                  <td class="green">${s.correct}</td>
                  <td class="red">${s.wrong}</td>
                  <td class="amber">${s.skipped}</td>
                </tr>`).join("")}
            </tbody>
          </table>
        </div>
        ${p ? `
        <div class="section ${p.flagged ? "warn-box" : ""}">
          <h2>Proctoring Summary ${p.flagged ? "⚠" : "✅"}</h2>
          <table class="info-table">
            <tr><td>Total Violations</td><td class="${p.flagged ? "red" : "green"}">${p.totalViolations}</td>
                <td>High/Critical</td><td class="${p.flagged ? "red" : "green"}">${p.highViolations}</td>
                <td>Severity</td><td class="${p.flagged ? "red" : "green"}">${p.severity.toUpperCase()}</td></tr>
          </table>
        </div>` : ""}`;
    };

    const batchSection = () => {
      if (report.reportType !== ReportType.BATCH_RESULTS) return "";
      return `
        <div class="section">
          <h2>Batch Results — ${escapeHtml(report.exam?.title || "")}</h2>
          <p>Total Students: <strong>${report.totalStudents}</strong></p>
          <table class="data-table">
            <thead><tr><th>#</th><th>Rank</th><th>Roll No.</th><th>Name</th><th>Dept</th><th>Obtained</th><th>%</th><th>Grade</th><th>Passed</th><th>Time</th></tr></thead>
            <tbody>
              ${(report.rows || []).map(r => `
                <tr>
                  <td>${r.slNo}</td><td>${r.rank}</td>
                  <td>${escapeHtml(r.rollNo)}</td><td>${escapeHtml(r.name)}</td>
                  <td>${escapeHtml(r.department)}</td>
                  <td>${r.obtained}/${r.total}</td>
                  <td>${r.percentage}%</td>
                  <td><span class="grade-badge grade-${r.grade.replace("+","p")}">${r.grade}</span></td>
                  <td class="${r.passed === "Yes" ? "green" : "red"}">${r.passed}</td>
                  <td>${r.timeTaken}</td>
                </tr>`).join("")}
            </tbody>
          </table>
        </div>`;
    };

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; background: #f4f7fb; color: #1a2340; font-size: 14px; }
    .page { max-width: 960px; margin: 0 auto; background: #fff; box-shadow: 0 2px 20px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #1a3a8f, #3b6bff); color: white; padding: 28px 36px; display: flex; align-items: center; justify-content: space-between; }
    .header-title { font-size: 22px; font-weight: 800; letter-spacing: 0.02em; }
    .header-sub { font-size: 12px; opacity: 0.7; margin-top: 4px; }
    .header-meta { text-align: right; font-size: 12px; opacity: 0.8; }
    .content { padding: 28px 36px; }
    .section { margin-bottom: 28px; }
    h2 { font-size: 16px; font-weight: 700; color: #1a3a8f; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #e8eef8; }
    .info-table { width: 100%; border-collapse: collapse; }
    .info-table td { padding: 8px 12px; border: 1px solid #e8eef8; font-size: 13px; }
    .info-table td:first-child, .info-table td:nth-child(3) { background: #f4f7fb; font-weight: 600; color: #4a5a7a; width: 130px; }
    .data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .data-table th { background: #1a3a8f; color: white; padding: 9px 10px; text-align: left; font-weight: 600; font-size: 12px; letter-spacing: 0.03em; }
    .data-table td { padding: 8px 10px; border-bottom: 1px solid #e8eef8; }
    .data-table tr:nth-child(even) td { background: #f9fbff; }
    .data-table tr:hover td { background: #f0f4ff; }
    .score-card { display: flex; align-items: center; gap: 20px; background: #f4f7fb; border: 1px solid #dde5f5; border-radius: 12px; padding: 20px 24px; margin-bottom: 16px; flex-wrap: wrap; }
    .score-big { font-size: 42px; font-weight: 900; color: #1a3a8f; line-height: 1; }
    .score-total { font-size: 22px; color: #8a9bc7; }
    .score-pct { font-size: 26px; font-weight: 800; color: #3b6bff; }
    .score-label { font-size: 14px; font-weight: 700; }
    .grade-badge { display: inline-block; padding: 4px 12px; border-radius: 99px; font-weight: 800; font-size: 16px; }
    .grade-Ap { background: #d1fae5; color: #065f46; }
    .grade-A  { background: #dbeafe; color: #1e40af; }
    .grade-Bp { background: #fef3c7; color: #92400e; }
    .grade-B  { background: #ede9fe; color: #5b21b6; }
    .grade-C  { background: #fee2e2; color: #991b1b; }
    .grade-D  { background: #f3f4f6; color: #374151; }
    .grade-F  { background: #ffe4e6; color: #9f1239; }
    .green { color: #065f46; font-weight: 600; }
    .red   { color: #9f1239; font-weight: 600; }
    .amber { color: #92400e; font-weight: 600; }
    .warn-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; }
    .footer { background: #f4f7fb; border-top: 1px solid #dde5f5; padding: 14px 36px; font-size: 11px; color: #8a9bc7; display: flex; justify-content: space-between; }
    @media print {
      body { background: white; }
      .page { box-shadow: none; }
      .data-table tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      <div class="header-title">${escapeHtml(this._opts.orgName)}</div>
      <div class="header-sub">${escapeHtml(title)}</div>
    </div>
    <div class="header-meta">
      Report ID: ${escapeHtml(report.reportId)}<br>
      Generated: ${formatDate(report.generatedAt)}
    </div>
  </div>
  <div class="content">
    ${studentResultSection()}
    ${batchSection()}
  </div>
  <div class="footer">
    <span>${escapeHtml(this._opts.orgName)} · Confidential</span>
    <span>Generated at ${formatDate(report.generatedAt)}</span>
  </div>
</div>
</body>
</html>`;
  }

  // ── Utils ─────────────────────────────────────────────────────────────────

  _generateReportId(prefix = "R") {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  }
}

// ─── Singleton Export ─────────────────────────────────────────────────────────

/**
 * Default singleton instance.
 *
 *   import reportService from './reportService';
 *   const result = await reportService.generateStudentResult({ ... });
 *   reportService.download(result, ExportFormat.CSV);
 */
const reportService = new ReportService();
export default reportService;

/**
 * Factory for custom-configured instances.
 *
 *   import { createReportService } from './reportService';
 *   const rs = createReportService({ orgName: 'JNTUH', passingPct: 35 });
 */
export function createReportService(options = {}) {
  return new ReportService(options);
}

export { ReportService, GradeCalculator };

// ─── Usage Reference ──────────────────────────────────────────────────────────
/*

STUDENT RESULT
──────────────────────────────────────────────────────────────────
import reportService, { ExportFormat } from './reportService';

const result = await reportService.generateStudentResult({
  student:  { id: 'S01', name: 'Arjun Sharma', rollNo: '22CS1A0501', department: 'CSE', semester: '4th' },
  exam:     { id: 'CS401', title: 'Data Structures', code: 'CS401', type: 'Midterm', totalMarks: 100 },
  questions: QUESTIONS,            // array of question definitions
  answers:   answers,              // { [questionId]: selectedOption }
  proctorSummary: proctorService.getSummary(),
  meta:     { startedAt: '2026-03-19T10:00:00Z', submittedAt: '2026-03-19T12:30:00Z' },
});

// Access data
console.log(result.scoring.percentage);   // 82.5
console.log(result.scoring.grade);        // "A"

// Export
reportService.download(result, ExportFormat.CSV);
reportService.print(result);


EXAM ANALYTICS
──────────────────────────────────────────────────────────────────
const analytics = await reportService.generateExamAnalytics({
  exam,
  questions,
  allAttempts: [
    { student: { ... }, answers: { ... }, meta: { ... } },
    ...
  ],
});
console.log(analytics.scoreStats.mean);       // class average %
console.log(analytics.participation.passRate);// pass %
console.log(analytics.questionAnalysis);      // per-question difficulty


BATCH RESULTS
──────────────────────────────────────────────────────────────────
const batch = await reportService.generateBatchResults({ exam, questions, allAttempts });
reportService.download(batch, ExportFormat.CSV);   // downloadable marksheet


PROGRESS TRACKER
──────────────────────────────────────────────────────────────────
const progress = await reportService.generateProgressTracker({
  student,
  examHistory: [{ exam, questions, answers, meta }, ...],
});
console.log(progress.cgpa);      // computed CGPA
console.log(progress.trend);     // "improving" | "stable" | "declining"


HOOKS
──────────────────────────────────────────────────────────────────
reportService.addHook('beforeGenerate', async (ctx) => {
  console.log('Generating:', ctx.type);
});
reportService.addHook('afterGenerate', async ({ report }) => {
  await saveToServer(report);
});


EXPORTS SUPPORTED
──────────────────────────────────────────────────────────────────
ExportFormat.JSON   → Pretty-printed JSON file
ExportFormat.CSV    → Tabular data (marksheet, question-wise)
ExportFormat.HTML   → Fully-styled printable HTML report
ExportFormat.PRINT  → Opens browser print dialog

*/
