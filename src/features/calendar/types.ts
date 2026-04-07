export type CalendarView = "day" | "week" | "month";

export type CalendarEventType =
  | "call"
  | "meeting"
  | "measurement"
  | "follow_up"
  | "proposal_presentation"
  | "contract_signing"
  | "handoff"
  | "production"
  | "installation"
  | "delivery"
  | "service"
  | "internal"
  | "reminder";

export type CalendarEventStatus =
  | "planned"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "canceled"
  | "overdue";

export type CalendarLinkedEntityType =
  | "lead"
  | "contact"
  | "deal"
  | "handoff"
  | "order";

export type CalendarEvent = {
  id: string;
  title: string;
  type: CalendarEventType;
  status: CalendarEventStatus;
  startAt: string;
  endAt: string;
  allDay?: boolean;
  location?: string;
  notes?: string;
  assigneeName?: string;
  linkedEntityType?: CalendarLinkedEntityType;
  linkedEntityLabel?: string;
  linkedEntityId?: string;
  isCritical?: boolean;
  /** Для фільтра «Лише мої» (події з БД). */
  createdById?: string;
  assignedToId?: string | null;
};

export type CalendarFilterState = {
  view: CalendarView;
  onlyMine: boolean;
  onlyCritical: boolean;
  onlyOverdue: boolean;
  types: CalendarEventType[] | null;
  statuses: CalendarEventStatus[] | null;
};

