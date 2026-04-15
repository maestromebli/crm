export type ConstructorApiSuccess<T> = {
  ok: true;
  data: T;
};

export type ConstructorApiError = {
  ok: false;
  error: string;
  code: "validation_error" | "permission_error" | "transition_error" | "not_found" | "domain_error";
  details?: Record<string, unknown>;
};

export type ConstructorApiResponse<T> = ConstructorApiSuccess<T> | ConstructorApiError;

export type ConstructorSubmissionBlocker = {
  code:
    | "ASSIGNED_CONSTRUCTOR_MISSING"
    | "TECH_SPEC_MISSING"
    | "VERSION_MISSING"
    | "CHECKLIST_INCOMPLETE"
    | "CRITICAL_QUESTIONS_OPEN"
    | "REQUIRED_FILE_MISSING"
    | "VERSION_SUMMARY_MISSING"
    | "APPROVED_SNAPSHOT_MISSING";
  message: string;
};
