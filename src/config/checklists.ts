export type ChecklistType = "handoff" | "stage" | "installation" | "custom";

export type ChecklistItemTemplate = {
  id: string;
  label: string;
  required: boolean;
  ownerRole?: string;
};

export type ChecklistTemplate = {
  id: string;
  type: ChecklistType;
  label: string;
  blocksTransition: boolean;
  items: ChecklistItemTemplate[];
};

export const CHECKLIST_TEMPLATES: ChecklistTemplate[] = [
  {
    id: "handoff-default",
    type: "handoff",
    label: "Handoff → Виробництво",
    blocksTransition: true,
    items: [
      {
        id: "approved-drawings",
        label: "Погоджені креслення / ескізи завантажені",
        required: true,
      },
      {
        id: "contract-signed",
        label: "Підписаний договір прикріплено",
        required: true,
      },
      {
        id: "payment-proof",
        label: "Передоплата підтверджена",
        required: true,
      },
    ],
  },
];

