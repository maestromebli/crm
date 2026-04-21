import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

function evaluate(text, opts = {}) {
  const maxSentences = opts.maxSentences ?? 6;
  const minChars = opts.minChars ?? 10;
  const requireUkrainian = opts.requireUkrainian ?? true;
  const allowMarkdown = opts.allowMarkdown ?? false;
  const trimmed = String(text ?? "").trim();

  const sentenceCount = trimmed
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter(Boolean).length;
  const lengthOk = trimmed.length >= minChars;
  const sentenceCountOk = sentenceCount > 0 && sentenceCount <= maxSentences;
  const ukrainianOk = !requireUkrainian || /[іїєґІЇЄҐ]/.test(trimmed);
  const markdownOk = allowMarkdown || !/[#*_`]{1,}/.test(trimmed);

  let score = 100;
  if (!lengthOk) score -= 25;
  if (!sentenceCountOk) score -= 25;
  if (!ukrainianOk) score -= 30;
  if (!markdownOk) score -= 20;
  score = Math.max(0, score);

  return {
    score,
    passed: score >= 70 && lengthOk && sentenceCountOk && ukrainianOk && markdownOk,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const reportFlagIdx = args.indexOf("--report");
  const reportPath =
    reportFlagIdx >= 0 && args[reportFlagIdx + 1]
      ? path.resolve(process.cwd(), args[reportFlagIdx + 1])
      : null;
  const file = path.resolve(process.cwd(), "scripts/ai-regression-cases.json");
  const raw = await readFile(file, "utf8");
  const cases = JSON.parse(raw);
  const minPassRate = Number(process.env.AI_EVAL_MIN_PASS_RATE ?? "100");
  const minPositiveAvg = Number(process.env.AI_EVAL_MIN_POSITIVE_AVG ?? "90");

  let failed = 0;
  const rows = [];
  for (const c of cases) {
    const result = evaluate(c.text, {
      maxSentences: c.maxSentences,
      minChars: c.minChars,
      requireUkrainian: c.requireUkrainian,
      allowMarkdown: c.allowMarkdown,
    });
    const expectedPass = Boolean(c.expectPass);
    const scoreGateOk = expectedPass ? result.score >= (c.minScore ?? 70) : true;
    const ok = scoreGateOk && result.passed === expectedPass;
    rows.push({
      id: c.id,
      score: result.score,
      expectedPass,
      expectedMinScore: c.minScore ?? 70,
      actualPass: result.passed,
      ok,
    });
    if (!ok) {
      failed += 1;
      console.error(
        `[FAIL] ${c.id}: score=${result.score}, passed=${result.passed}, expected minScore=${c.minScore}, expectPass=${c.expectPass}`,
      );
    } else {
      console.log(`[PASS] ${c.id}: score=${result.score}, passed=${result.passed}`);
    }
  }

  const total = rows.length;
  const passed = rows.filter((r) => r.ok).length;
  const passRate = total > 0 ? (passed / total) * 100 : 0;
  const positiveRows = rows.filter((r) => r.expectedPass);
  const positiveAvgScore =
    positiveRows.length > 0
      ? positiveRows.reduce((acc, r) => acc + r.score, 0) / positiveRows.length
      : 0;
  const gatesOk = passRate >= minPassRate && positiveAvgScore >= minPositiveAvg;

  const report = {
    generatedAt: new Date().toISOString(),
    thresholds: { minPassRate, minPositiveAvg },
    metrics: {
      total,
      passed,
      failed: total - passed,
      passRate: Number(passRate.toFixed(2)),
      positiveAvgScore: Number(positiveAvgScore.toFixed(2)),
    },
    rows,
    gatesOk,
  };

  if (reportPath) {
    await mkdir(path.dirname(reportPath), { recursive: true });
    await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
    console.log(`Report saved: ${reportPath}`);
  }

  if (failed > 0) {
    console.error(`\nAI regression eval failed: ${failed} case(s).`);
    process.exit(1);
  }
  if (!gatesOk) {
    console.error(
      `\nAI regression quality gate failed: passRate=${passRate.toFixed(2)} (min ${minPassRate}), positiveAvgScore=${positiveAvgScore.toFixed(2)} (min ${minPositiveAvg}).`,
    );
    process.exit(1);
  }
  console.log("\nAI regression eval passed.");
}

main().catch((error) => {
  console.error("AI regression eval crashed:", error);
  process.exit(1);
});
