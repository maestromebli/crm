/**
 * Опис tools для OpenAI-сумісного Chat Completions API (`tools`, `tool_choice: "auto"`).
 */
export const AI_CHAT_TOOLS: {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}[] = [
  {
    type: "function",
    function: {
      name: "crm_list_leads",
      description:
        "Список лідів у межах видимості користувача (воронка, етап, власник). Виклич, коли питання про «мої ліди», кількість, етапи, що в роботі.",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "integer",
            description: "Максимум записів (1–25), за замовчуванням 15",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "crm_list_deals",
      description:
        "Список угод у межах видимості: етап воронки, статус, сума, виробництво (запуск). Для питань про угоди, продажі, етапи угоди.",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "integer",
            description: "Максимум записів (1–25), за замовчуванням 15",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "crm_list_open_tasks",
      description:
        "Відкриті та в роботі задачі, доступні користувачу (assignee / створені ним / по своїх лідах-угодах).",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "integer",
            description: "Максимум записів (1–25), за замовчуванням 20",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "crm_get_lead",
      description:
        "Деталі одного ліда за id (якщо користувач має право та scope). Телефон/імейл — лише якщо є доступ до лідів.",
      parameters: {
        type: "object",
        properties: {
          lead_id: {
            type: "string",
            description: "Ідентифікатор ліда (cuid)",
          },
        },
        required: ["lead_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "crm_get_deal",
      description:
        "Деталі однієї угоди за id: етап, клієнт (назва), виробництво, дати. Лише в межах прав та видимості.",
      parameters: {
        type: "object",
        properties: {
          deal_id: {
            type: "string",
            description: "Ідентифікатор угоди (cuid)",
          },
        },
        required: ["deal_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "crm_quick_overview",
      description:
        "Швидкі лічильники в межах видимості: скільки лідів, угод, відкритих задач (за дозволами). Виклич першим для «скільки в мене…», огляду навантаження.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "crm_nav_menu",
      description:
        "Структура бокового меню ENVER CRM з реальними шляхами (href), відфільтрована за правами користувача. Для онбордингу та «де знайти X».",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "crm_calendar_upcoming",
      description:
        "Найближчі майбутні події календаря (тип, час, назва) у межах видимості. Потрібен доступ до календаря.",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "integer",
            description: "Максимум подій (1–20), за замовчуванням 12",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "crm_search_contacts",
      description:
        "Пошук контактів за підрядком у імені, телефоні або email (мінімум 2 символи). Лише контакти, пов’язані з видимими лідами/угодами.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Рядок пошуку (≥2 символи)",
          },
          limit: {
            type: "integer",
            description: "Максимум результатів (1–15), за замовчуванням 10",
          },
        },
        required: ["query"],
      },
    },
  },
];
