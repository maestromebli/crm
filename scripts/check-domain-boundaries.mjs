import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const SRC_ROOT = path.join(ROOT, "src");

const FILE_EXTENSIONS = new Set([".ts", ".tsx", ".mts"]);

const RULES = [
  {
    name: "api-must-not-import-ui",
    sourceIncludes: "/src/app/api/",
    forbidden: ["/src/components/", "/src/modules/"],
  },
  {
    name: "lib-must-not-import-app",
    sourceIncludes: "/src/lib/",
    forbidden: ["/src/app/"],
  },
  {
    name: "features-must-not-import-app-api",
    sourceIncludes: "/src/features/",
    forbidden: ["/src/app/api/"],
  },
];

function toPosix(p) {
  return p.replaceAll("\\", "/");
}

async function walk(dir) {
  const out = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      out.push(...(await walk(fullPath)));
      continue;
    }
    const ext = path.extname(entry.name);
    if (FILE_EXTENSIONS.has(ext)) out.push(fullPath);
  }
  return out;
}

function normalizeSpecifier(fromFile, specifier) {
  if (!specifier) return null;
  if (specifier.startsWith("@/")) {
    return toPosix(path.join(SRC_ROOT, specifier.slice(2)));
  }
  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    return toPosix(path.resolve(path.dirname(fromFile), specifier));
  }
  return null;
}

function parseImports(content) {
  const imports = [];
  const regex =
    /(?:import\s+[^'"]*from\s+|import\s*\(\s*|export\s+[^'"]*from\s+)['"]([^'"]+)['"]/g;
  let match = regex.exec(content);
  while (match) {
    imports.push(match[1]);
    match = regex.exec(content);
  }
  return imports;
}

function matchRule(filePath, rule) {
  const normalizedFile = toPosix(filePath);
  return normalizedFile.includes(rule.sourceIncludes);
}

function isForbiddenTarget(targetPath, rule) {
  return rule.forbidden.some((needle) => targetPath.includes(needle));
}

async function main() {
  const files = await walk(SRC_ROOT);
  const violations = [];

  for (const filePath of files) {
    const normalizedFile = toPosix(filePath);
    const matchedRules = RULES.filter((rule) => matchRule(normalizedFile, rule));
    if (matchedRules.length === 0) continue;

    const content = await readFile(filePath, "utf8");
    const imports = parseImports(content);
    for (const specifier of imports) {
      const target = normalizeSpecifier(filePath, specifier);
      if (!target) continue;
      for (const rule of matchedRules) {
        if (isForbiddenTarget(target, rule)) {
          violations.push({
            rule: rule.name,
            file: normalizedFile,
            import: specifier,
            target,
          });
        }
      }
    }
  }

  if (violations.length === 0) {
    console.log("[arch:boundaries] no violations found");
    return;
  }

  console.log(`[arch:boundaries] found ${violations.length} potential violations`);
  for (const v of violations) {
    console.log(`- [${v.rule}] ${v.file} -> ${v.import}`);
  }

  if (process.env.BOUNDARY_STRICT === "1") {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("[arch:boundaries] failed", error);
  process.exitCode = 1;
});
