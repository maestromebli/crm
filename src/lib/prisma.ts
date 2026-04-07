import fs from "node:fs";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { loadProjectEnv } from "./load-project-env";

loadProjectEnv();

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  /** Після `prisma generate` змінюється default.js — старий singleton дає ValidationError на нових полях. */
  prismaFingerprintAtCreate?: string;
};

/** Запобігає вкладеному «recovery» під час повтору після reset singleton. */
let prismaQueryRecoveryDepth = 0;

/** Черга reset — паралельні P1017 не створюють кілька пулів одночасно (ризик «too many connections»). */
let prismaResetChain: Promise<void> = Promise.resolve();

function prismaCodegenIncludesLeadNextStep(): boolean {
  const en = Prisma.LeadScalarFieldEnum as Record<string, unknown> | undefined;
  return Boolean(en && typeof en === "object" && "nextStep" in en);
}

/** Старий singleton без нових полей Lead дає ValidationError («Unknown argument nextStep»). */
function leadModelHasNextStepField(client: PrismaClient): boolean {
  if (!prismaCodegenIncludesLeadNextStep()) {
    return true;
  }
  const internal = client as unknown as {
    _runtimeDataModel?: {
      models?: Record<string, { fields?: { name: string }[] }>;
    };
  };
  const fields = internal._runtimeDataModel?.models?.Lead?.fields;
  if (!fields?.length) {
    return false;
  }
  return fields.some((f) => f.name === "nextStep");
}

/** Чи згенерований клієнт знає поле `Estimate.leadId` (після `prisma generate`). */
export function prismaCodegenIncludesEstimateLeadId(): boolean {
  const en = Prisma.EstimateScalarFieldEnum as Record<string, unknown> | undefined;
  return Boolean(en && typeof en === "object" && "leadId" in en);
}

/** Чи згенерований клієнт знає поле `Estimate.name`. */
export function prismaCodegenIncludesEstimateName(): boolean {
  const en = Prisma.EstimateScalarFieldEnum as Record<string, unknown> | undefined;
  return Boolean(en && typeof en === "object" && "name" in en);
}

function estimateModelHasLeadIdField(client: PrismaClient): boolean {
  if (!prismaCodegenIncludesEstimateLeadId()) {
    return true;
  }
  const internal = client as unknown as {
    _runtimeDataModel?: {
      models?: Record<string, { fields?: { name: string }[] }>;
    };
  };
  const fields = internal._runtimeDataModel?.models?.Estimate?.fields;
  if (!fields?.length) {
    return false;
  }
  return fields.some((f) => f.name === "leadId");
}

function estimateModelHasNameField(client: PrismaClient): boolean {
  if (!prismaCodegenIncludesEstimateName()) {
    return true;
  }
  const internal = client as unknown as {
    _runtimeDataModel?: {
      models?: Record<string, { fields?: { name: string }[] }>;
    };
  };
  const fields = internal._runtimeDataModel?.models?.Estimate?.fields;
  if (!fields?.length) {
    return false;
  }
  return fields.some((f) => f.name === "name");
}

/** Чи згенерований клієнт знає `LeadProposal.visualizationUrl` (посилання на візуалізацію в КП). */
export function prismaCodegenIncludesLeadProposalVisualizationUrl(): boolean {
  const en = Prisma.LeadProposalScalarFieldEnum as
    | Record<string, unknown>
    | undefined;
  return Boolean(en && typeof en === "object" && "visualizationUrl" in en);
}

/** Чи згенерований клієнт знає `LeadProposal.viewedAt` (публічний перегляд КП). */
export function prismaCodegenIncludesLeadProposalViewedAt(): boolean {
  const en = Prisma.LeadProposalScalarFieldEnum as
    | Record<string, unknown>
    | undefined;
  return Boolean(en && typeof en === "object" && "viewedAt" in en);
}

function leadProposalModelHasViewedAtField(client: PrismaClient): boolean {
  if (!prismaCodegenIncludesLeadProposalViewedAt()) {
    return true;
  }
  const internal = client as unknown as {
    _runtimeDataModel?: {
      models?: Record<string, { fields?: { name: string }[] }>;
    };
  };
  const fields = internal._runtimeDataModel?.models?.LeadProposal?.fields;
  if (!fields?.length) {
    return false;
  }
  return fields.some((f) => f.name === "viewedAt");
}

/** Після зміни звʼязків Deal ↔ production старий singleton міг давати ValidationError. */
function dealProductionRelationConsistent(client: PrismaClient): boolean {
  const internal = client as unknown as {
    _runtimeDataModel?: {
      models?: Record<string, { fields?: { name: string }[] }>;
    };
  };
  const fields = internal._runtimeDataModel?.models?.Deal?.fields;
  if (!fields?.length) {
    return true;
  }
  return fields.some((f) => f.name === "productionOrders");
}

function prismaClientMatchesCurrentCodegen(client: PrismaClient): boolean {
  return (
    leadModelHasNextStepField(client) &&
    estimateModelHasLeadIdField(client) &&
    estimateModelHasNameField(client) &&
    leadProposalModelHasViewedAtField(client) &&
    dealProductionRelationConsistent(client)
  );
}

/**
 * Після оновлення схеми старий singleton може мати застарілі делегати (напр. без `project`),
 * хоча codegen у node_modules уже новий — тоді треба пересоздати клієнт (і в production).
 */
function prismaSingletonHasRequiredDelegates(client: PrismaClient): boolean {
  const c = client as unknown as { dealHandoff?: unknown; project?: unknown };
  return (
    typeof c.dealHandoff !== "undefined" && typeof c.project !== "undefined"
  );
}

async function resetPrismaSingletonHard(): Promise<void> {
  const cur = globalForPrisma.prisma;
  if (cur) {
    await cur.$disconnect().catch(() => undefined);
  }
  globalForPrisma.prisma = undefined;
  globalForPrisma.prismaFingerprintAtCreate = undefined;
}

async function enqueueResetPrismaSingletonHard(): Promise<void> {
  const run = prismaResetChain.then(() => resetPrismaSingletonHard());
  prismaResetChain = run.catch(() => undefined);
  await run;
}

function getDelegateForModel(
  client: PrismaClient,
  model: string,
): Record<string, (a: unknown) => Promise<unknown>> | undefined {
  const c = client as unknown as Record<string, unknown>;
  const tryKey = (key: string) => {
    const v = c[key];
    if (v && typeof v === "object") {
      return v as Record<string, (a: unknown) => Promise<unknown>>;
    }
    return undefined;
  };
  return tryKey(model) ?? tryKey(model.charAt(0).toLowerCase() + model.slice(1));
}

/** Не намагаємося «вилікувати» вичерпання ліміту з’єднань новим пулом — лише погіршує ситуацію. */
function isDbResourceExhaustedError(e: unknown): boolean {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2037") return true;
  }
  if (e instanceof Error) {
    const m = e.message.toLowerCase();
    if (m.includes("too many") && m.includes("connection")) return true;
    if (m.includes("remaining connection slots are reserved")) return true;
    if (m.includes("53300")) return true;
    const raw = e.message;
    if (/забагато|підключ|з'єднан/i.test(raw)) return true;
  }
  return false;
}

/** P1017 та схожі — зазвичай «мертве» з’єднання в пулі; один повтор часто достатній. */
function isTransientDbConnectionError(e: unknown): boolean {
  if (isDbResourceExhaustedError(e)) return false;
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    return e.code === "P1017";
  }
  if (e instanceof Prisma.PrismaClientUnknownRequestError) {
    const m = e.message.toLowerCase();
    return (
      m.includes("closed the connection") || m.includes("connection terminated")
    );
  }
  if (e instanceof Error) {
    const m = e.message.toLowerCase();
    return (
      m.includes("closed the connection") ||
      m.includes("connection terminated") ||
      m.includes("econnreset")
    );
  }
  return false;
}

function createClient(): PrismaClient {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "DATABASE_URL не задано. Додайте змінну в середовище (наприклад .env.local).",
      );
    }
     
    console.warn(
      "[prisma] DATABASE_URL відсутній — використовується postgresql://127.0.0.1:5432/postgres. " +
        "Якщо pnpm db:ensure-admin писав у іншу БД, вхід дасть «Невірний email або пароль». " +
        "Створіть .env.local з DATABASE_URL і перезапустіть dev-сервер.",
    );
  }

  const maxLtEnv = process.env.PG_POOL_MAX_LIFETIME_SECONDS;
  const maxLt =
    maxLtEnv != null && maxLtEnv !== ""
      ? Number(maxLtEnv)
      : process.env.NODE_ENV !== "production"
        ? 180
        : 0;
  const defaultPoolMax =
    process.env.NODE_ENV === "production"
      ? 10
      : 5;
  const pool = new Pool({
    connectionString: url || "postgresql://127.0.0.1:5432/postgres",
    max: Math.min(
      20,
      Math.max(2, Number(process.env.PG_POOL_MAX ?? defaultPoolMax)),
    ),
    idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS ?? 20_000),
    connectionTimeoutMillis: Number(process.env.PG_CONNECTION_TIMEOUT_MS ?? 15_000),
    keepAlive: true,
    maxUses: Number(process.env.PG_POOL_MAX_USES ?? 750),
    ...(maxLt > 0 ? { maxLifetimeSeconds: maxLt } : {}),
  });
  const adapter = new PrismaPg(pool);

  const base = new PrismaClient({ adapter });
  const extended = base.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query, model, operation }) {
          if (prismaQueryRecoveryDepth > 0) {
            try {
              return await query(args);
            } catch (inner) {
              if (!isTransientDbConnectionError(inner)) throw inner;
              return await query(args);
            }
          }
          try {
            return await query(args);
          } catch (e) {
            if (!isTransientDbConnectionError(e)) throw e;
            if (typeof model !== "string" || typeof operation !== "string") {
              throw e;
            }
            prismaQueryRecoveryDepth++;
            try {
              await enqueueResetPrismaSingletonHard();
              const fresh = getPrisma();
              const delegate = getDelegateForModel(fresh, model);
              const fn = delegate?.[operation];
              if (typeof fn !== "function") {
                throw e;
              }
              try {
                return await fn(args);
              } catch (e2) {
                if (!isTransientDbConnectionError(e2)) throw e2;
                await enqueueResetPrismaSingletonHard();
                const fresh2 = getPrisma();
                const d2 = getDelegateForModel(fresh2, model);
                const fn2 = d2?.[operation];
                if (typeof fn2 !== "function") throw e2;
                return await fn2(args);
              }
            } finally {
              prismaQueryRecoveryDepth--;
            }
          }
        },
      },
    },
  });

  return extended as unknown as PrismaClient;
}

/** Відбиток: схема + згенерований клієнт (default.js оновлюється після `prisma generate`). */
function prismaCodegenFingerprint(): string {
  const cwd = process.cwd();
  let schemaM = 0;
  let clientM = 0;
  try {
    schemaM = fs.statSync(path.join(cwd, "prisma", "schema.prisma")).mtimeMs;
  } catch {
    /* noop */
  }
  try {
    clientM = fs.statSync(
      path.join(cwd, "node_modules", "@prisma", "client", "default.js"),
    ).mtimeMs;
  } catch {
    /* noop */
  }
  return `${schemaM}:${clientM}`;
}

let lastDevFingerprintCheck = 0;
let lastDevFingerprint = "";

function currentCodegenFingerprintThrottled(): string {
  const now = Date.now();
  if (now - lastDevFingerprintCheck < 2000) {
    return lastDevFingerprint;
  }
  lastDevFingerprintCheck = now;
  lastDevFingerprint = prismaCodegenFingerprint();
  return lastDevFingerprint;
}

/**
 * У dev HMR і в long-running production процесі globalThis може тримати старий PrismaClient
 * без нових моделей (наприклад `project`). Скидаємо singleton, якщо делегати або поля не збігаються з codegen.
 */
function getPrisma(): PrismaClient {
  if (process.env.NODE_ENV === "production") {
    const cur = globalForPrisma.prisma;
    if (!cur) {
      globalForPrisma.prisma = createClient();
    } else if (
      !prismaClientMatchesCurrentCodegen(cur) ||
      !prismaSingletonHasRequiredDelegates(cur)
    ) {
      void cur.$disconnect().catch(() => undefined);
      globalForPrisma.prisma = createClient();
    }
    return globalForPrisma.prisma!;
  }

  let existing = globalForPrisma.prisma;

  if (existing) {
    if (
      !prismaSingletonHasRequiredDelegates(existing) ||
      !prismaClientMatchesCurrentCodegen(existing)
    ) {
      void existing.$disconnect().catch(() => undefined);
      globalForPrisma.prisma = undefined;
      globalForPrisma.prismaFingerprintAtCreate = undefined;
      existing = undefined;
    }
  }

  if (existing && globalForPrisma.prismaFingerprintAtCreate != null) {
    const fp = currentCodegenFingerprintThrottled();
    if (fp && fp !== globalForPrisma.prismaFingerprintAtCreate) {
      void existing.$disconnect().catch(() => undefined);
      globalForPrisma.prisma = undefined;
      globalForPrisma.prismaFingerprintAtCreate = undefined;
      existing = undefined;
    }
  }

  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createClient();
    globalForPrisma.prismaFingerprintAtCreate = prismaCodegenFingerprint();
  }
  return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrisma();
    const value = Reflect.get(client, prop, client) as unknown;
    if (typeof value === "function") {
      return (value as (...a: unknown[]) => unknown).bind(client);
    }
    return value;
  },
});
