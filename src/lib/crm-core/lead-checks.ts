import type { LeadCoreInput } from "./lead-input.types";
import type { LeadCheckId, LeadCheckKind, LeadCheckResult } from "./lead-stage.types";

function result(
  id: LeadCheckId,
  kind: LeadCheckKind,
  pass: boolean,
  labelUa: string,
  hintUa: string | null,
): LeadCheckResult {
  return { id, kind, pass, labelUa, hintUa };
}

export function evaluateLeadCheck(
  id: LeadCheckId,
  kind: LeadCheckKind,
  lead: LeadCoreInput,
): LeadCheckResult {
  const q = lead.qualification;
  const c = lead.contact;
  const m = lead.meetings;
  const comm = lead.commercial;
  const files = lead.files;

  switch (id) {
    case "source_set":
      return result(
        id,
        kind,
        Boolean(lead.source?.trim()),
        "Джерело ліда",
        !lead.source?.trim() ? "Оберіть або вкажіть джерело" : null,
      );
    case "contact_channel":
      return result(
        id,
        kind,
        c.hasValidPhoneOrEmail,
        "Телефон або email",
        !c.hasValidPhoneOrEmail ? "Додайте коректний телефон чи email" : null,
      );
    case "owner_assigned":
      return result(
        id,
        kind,
        lead.ownerAssigned && Boolean(lead.ownerId),
        "Відповідальний менеджер",
        !lead.ownerAssigned ? "Призначте відповідального" : null,
      );
    case "needs_summary":
      return result(
        id,
        kind,
        Boolean(q.needsSummary?.trim()),
        "Суть запиту",
        !q.needsSummary?.trim()
          ? "Коротко зафіксуйте, що потрібно клієнту"
          : null,
      );
    case "furniture_or_object_type":
      return result(
        id,
        kind,
        Boolean(q.furnitureType?.trim() || q.objectType?.trim()),
        "Тип меблів / об’єкту",
        !q.furnitureType?.trim() && !q.objectType?.trim()
          ? "Вкажіть тип меблів або об’єкт"
          : null,
      );
    case "next_step_text":
      return result(
        id,
        kind,
        Boolean(lead.nextStepText?.trim()),
        "Наступний крок (текст)",
        !lead.nextStepText?.trim()
          ? "Опишіть наступну дію для команди"
          : null,
      );
    case "next_contact_date":
      return result(
        id,
        kind,
        lead.nextContactAt != null,
        "Дата наступного контакту",
        lead.nextContactAt == null ? "Заплануйте дату дотику" : null,
      );
    case "measurement_decision_recorded": {
      const ok =
        q.measurementDecision === "scheduled" ||
        q.measurementDecision === "completed" ||
        q.measurementDecision === "skipped";
      return result(
        id,
        kind,
        ok,
        "Рішення щодо заміру",
        !ok
          ? "Зафіксуйте: замір потрібен, запланований або не потрібен"
          : null,
      );
    }
    case "measurement_scheduled_or_done": {
      const ok =
        m.completedMeasurementCount > 0 ||
        m.scheduledMeasurementCount > 0 ||
        m.hasUpcomingMeasurement ||
        q.measurementDecision === "skipped";
      return result(
        id,
        kind,
        ok,
        "Замір заплановано або виконано",
        !ok ? "Створіть подію заміру або завершіть виїзд" : null,
      );
    }
    case "site_address_or_context": {
      const ok =
        Boolean(q.address?.trim()) ||
        m.completedMeasurementCount > 0 ||
        m.scheduledMeasurementCount > 0;
      return result(
        id,
        kind,
        ok,
        "Адреса або контекст об’єкта",
        !ok ? "Додайте адресу в кваліфікації або заплануйте виїзд" : null,
      );
    }
    case "measurement_notes_or_sheet": {
      const ok = files.hasMeasurementSheet || files.attachmentCount >= 1;
      return result(
        id,
        kind,
        ok,
        "Лист заміру / нотатки",
        !ok
          ? "Додайте лист заміру або файли з розмірами"
          : null,
      );
    }
    case "estimate_exists":
      return result(
        id,
        kind,
        comm.estimates.length > 0,
        "Є версія розрахунку",
        comm.estimates.length === 0 ? "Створіть прорахунок" : null,
      );
    case "active_estimate": {
      const ok =
        Boolean(lead.commercial.activeEstimateId) &&
        comm.estimates.some((e) => e.id === lead.commercial.activeEstimateId);
      return result(
        id,
        kind,
        ok,
        "Активна версія смети",
        !ok
          ? "Оберіть поточну версію розрахунку"
          : null,
      );
    }
    case "proposal_draft_linked": {
      const active = lead.commercial.activeEstimateId;
      const prop = lead.commercial.latestProposal;
      const ok = Boolean(
        prop &&
          prop.estimateId &&
          active &&
          prop.estimateId === active &&
          (prop.status === "DRAFT" ||
            prop.status === "SENT" ||
            prop.status === "CLIENT_REVIEWING" ||
            prop.status === "APPROVED"),
      );
      return result(
        id,
        kind,
        ok,
        "КП прив’язано до активної смети",
        !ok
          ? "Створіть КП на базі активної смети"
          : null,
      );
    }
    case "proposal_sent": {
      const prop = comm.latestProposal;
      const ok = Boolean(
        prop &&
          (prop.status === "SENT" ||
            prop.status === "CLIENT_REVIEWING" ||
            prop.status === "APPROVED" ||
            prop.sentAt != null),
      );
      return result(
        id,
        kind,
        ok,
        "КП надіслано",
        !ok ? "Надішліть КП клієнту (статус «Надіслано»)" : null,
      );
    }
    case "follow_up_scheduled":
      return result(
        id,
        kind,
        lead.nextContactAt != null,
        "Follow-up заплановано",
        lead.nextContactAt == null
          ? "Після відправки КП додайте дату наступного контакту"
          : null,
      );
    case "proposal_approved": {
      const prop = comm.latestProposal;
      const ok = prop?.status === "APPROVED";
      return result(
        id,
        kind,
        Boolean(ok),
        "КП погоджено",
        !ok ? "Отримайте підтвердження від клієнта" : null,
      );
    }
    case "approved_amount_documented": {
      const prop = comm.latestProposal;
      const est = comm.latestEstimate;
      const amount =
        prop?.status === "APPROVED" && est?.id === prop.estimateId
          ? est.totalPrice
          : est?.totalPrice;
      const ok =
        typeof amount === "number" &&
        !Number.isNaN(amount) &&
        amount > 0;
      return result(
        id,
        kind,
        ok,
        "Погоджена сума зафіксована",
        !ok
          ? "У сметі має бути додатна сума для узгодженого КП"
          : null,
      );
    }
    case "budget_range_documented":
      return result(
        id,
        kind,
        Boolean(q.budgetRange?.trim()),
        "Бюджетний діапазон",
        !q.budgetRange?.trim()
          ? "Уточніть орієнтовний бюджет"
          : null,
      );
    case "key_files_present":
      return result(
        id,
        kind,
        files.attachmentCount >= 2,
        "Ключові файли (2+)",
        files.attachmentCount < 2
          ? "Додайте фото / креслення об’єкта"
          : null,
      );
    default: {
      const _x: never = id;
      return result(_x, kind, false, "", null);
    }
  }
}

export function evaluateLeadChecksForStage(
  lead: LeadCoreInput,
  required: LeadCheckId[],
  soft: LeadCheckId[],
): { required: LeadCheckResult[]; soft: LeadCheckResult[] } {
  return {
    required: required.map((id) => evaluateLeadCheck(id, "required", lead)),
    soft: soft.map((id) => evaluateLeadCheck(id, "soft", lead)),
  };
}
