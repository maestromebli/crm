import type {
  AssistantRouteKind,
  ContextHint,
  ResolvedPageContext,
} from "../types";
import type { EffectiveRole } from "../../../lib/authz/roles";

const CUID = /^[a-z0-9]{20,40}$/i;

function segmentIsId(s: string | undefined): boolean {
  return Boolean(s && CUID.test(s));
}

export function resolvePathnameContext(pathname: string): ResolvedPageContext {
  const segments = pathname.split("/").filter(Boolean);
  const first = segments[0] ?? "";
  const second = segments[1];
  const third = segments[2];

  let kind: AssistantRouteKind = "other";
  let leadId: string | null = null;
  let dealId: string | null = null;

  if (first === "dashboard" || pathname === "/") {
    kind = "dashboard";
  } else if (first === "leads") {
    if (segmentIsId(second)) {
      kind = "lead_detail";
      leadId = second ?? null;
    } else {
      kind = "leads_list";
    }
  } else if (first === "deals") {
    if (segmentIsId(second)) {
      dealId = second ?? null;
      kind = third === "workspace" ? "deal_workspace" : "deal_detail";
    } else {
      kind = "deals_list";
    }
  } else if (first === "calendar") {
    kind = "calendar";
  } else if (first === "tasks" || first === "today") {
    kind = "tasks";
  } else if (first === "production") {
    kind = "production";
  } else if (first === "handoff") {
    kind = "handoff";
  } else if (first === "files") {
    kind = "files";
  } else if (first === "crm" && second === "finance") {
    kind = "finance";
  } else if (first === "reports") {
    kind = "reports";
  } else if (first === "target") {
    kind = "target";
  } else if (first === "settings") {
    kind = "settings";
  }

  return { kind, pathname, leadId, dealId };
}

function hintForDirector(ctx: ResolvedPageContext): ContextHint {
  if (ctx.kind === "dashboard") {
    return {
      title: "Операційний огляд",
      summary:
        "Тут зручно тримати фокус на ризиках, вузьких місцях і завантаженні команди.",
      suggestedNextStep:
        "Перегляньте розділ «Критичне» та звіти по продажах, якщо потрібен стратегічний зріз.",
      hasSuggestion: true,
      tone: "neutral",
    };
  }
  if (ctx.kind === "deal_detail" || ctx.kind === "deal_workspace") {
    return {
      title: "Замовлення",
      summary:
        "Перевірте узгодженість етапу, готовність до виробництва та фінансові умови перед наступним кроком.",
      suggestedNextStep:
        "Оцініть ризики прострочки та забезпеченість документами в робочому місці замовлення.",
      hasSuggestion: true,
      tone: "risk",
    };
  }
  return genericHint(ctx);
}

function hintForHeadManager(ctx: ResolvedPageContext): ContextHint {
  if (ctx.kind === "leads_list" || ctx.kind === "lead_detail") {
    return {
      title: "Ліди команди",
      summary:
        "Зверніть увагу на ліди без наступного кроку та прострочені контакти — це найшвидший виграш у конверсії.",
      suggestedNextStep:
        "Розподіліть навантаження або закріпіть follow-up за відповідальними менеджерами.",
      hasSuggestion: true,
      tone: "attention",
    };
  }
  if (ctx.kind === "dashboard") {
    return {
      title: "Команда",
      summary:
        "Дашборд допомагає побачити завантаження лінії продажів і пріоритети на день.",
      suggestedNextStep:
        "Відкрийте «Моя робота» / «Команда», щоб знайти вузькі місця.",
      hasSuggestion: true,
      tone: "neutral",
    };
  }
  return genericHint(ctx);
}

function hintForSales(ctx: ResolvedPageContext): ContextHint {
  if (ctx.kind === "lead_detail") {
    return {
      title: "Лід",
      summary:
        "Перед рухом по воронці переконайтесь у контакті, кваліфікації та наступному кроці — це зменшує втрати.",
      suggestedNextStep:
        "Заплануйте дзвінок або повідомлення клієнту, за потреби — замір у календарі.",
      hasSuggestion: true,
      tone: "attention",
    };
  }
  if (ctx.kind === "deal_detail" || ctx.kind === "deal_workspace") {
    return {
      title: "Замовлення",
      summary:
        "Тримайте в полі зору КП, договір та готовність до виробництва — клієнт чекає чіткого наступного кроку.",
      suggestedNextStep:
        "Перевірте активну версію розрахунку та надішліть follow-up, якщо КП без відповіді.",
      hasSuggestion: true,
      tone: "neutral",
    };
  }
  if (ctx.kind === "calendar") {
    return {
      title: "Календар",
      summary: "Заміри та зустрічі краще тримати в одному місці — менше пропусків і накладок.",
      suggestedNextStep:
        "Підтвердіть час на об’єкті та збережіть коментар після виїзду.",
      hasSuggestion: false,
      tone: "neutral",
    };
  }
  return genericHint(ctx);
}

function genericHint(ctx: ResolvedPageContext): ContextHint {
  switch (ctx.kind) {
    case "dashboard":
      return {
        title: "Дашборд",
        summary: "Короткий зріз пріоритетів дня та зон ризику по вашій зоні відповідальності.",
        suggestedNextStep:
          "Відкрийте «Моя робота» або перейдіть до лідів/замовлень з найближчими дедлайнами.",
        hasSuggestion: false,
        tone: "neutral",
      };
    case "lead_detail":
      return {
        title: "Лід",
        summary: "Переконайтесь, що контакт, наступний крок і етап воронки узгоджені.",
        suggestedNextStep:
          "Зафіксуйте дію в таймлайні та заплануйте наступний контакт.",
        hasSuggestion: true,
        tone: "attention",
      };
    case "deal_detail":
    case "deal_workspace":
      return {
        title: "Замовлення",
        summary:
          "Робоче місце збирає документи, готовність і виробництво — менше розривів між відділами.",
        suggestedNextStep:
          "Перевірте обов’язкові файли та етап перед передачею далі.",
        hasSuggestion: true,
        tone: "neutral",
      };
    case "calendar":
      return {
        title: "Календар",
        summary: "Плануйте виїзди та зустрічі так, щоб у команди залишався запас часу.",
        suggestedNextStep: "Підтвердіть слот з клієнтом і оновіть статус події.",
        hasSuggestion: false,
        tone: "neutral",
      };
    case "production":
      return {
        title: "Виробництво",
        summary: "Черга та статуси допомагають не втрачати об’єкти між етапами.",
        suggestedNextStep:
          "Перевірте блокери та коментарі по об’єкту перед зміною статусу.",
        hasSuggestion: true,
        tone: "attention",
      };
    case "finance":
      return {
        title: "Фінанси",
        summary: "Звірка оплат і витрат по об’єкту знижує фінансові сюрпризи.",
        suggestedNextStep: "Перегляньте реєстр об’єктів та статус авансів.",
        hasSuggestion: false,
        tone: "neutral",
      };
    case "target":
      return {
        title: "Таргет",
        summary:
          "Тут зводяться кампанії Meta, витрати та ліди з реклами — зручно для маркетингу та продажів.",
        suggestedNextStep:
          "Перевірте CPL і синхронізацію; ключі API — у налаштуваннях Meta таргету.",
        hasSuggestion: true,
        tone: "neutral",
      };
    default:
      return {
        title: "ENVER CRM",
        summary:
          "Я підказую наступні кроки з урахуванням вашої ролі та поточного розділу.",
        suggestedNextStep:
          "Відкрийте чат нижче або перейдіть у повний AI-розділ з меню.",
        hasSuggestion: false,
        tone: "neutral",
      };
  }
}

/**
 * Текстові підказки без виклику API — безпечно для продакшену.
 */
export function buildContextHint(
  role: EffectiveRole,
  ctx: ResolvedPageContext,
): ContextHint {
  if (role === "SUPER_ADMIN" || role === "DIRECTOR") {
    return hintForDirector(ctx);
  }
  if (role === "HEAD_MANAGER") {
    return hintForHeadManager(ctx);
  }
  return hintForSales(ctx);
}
