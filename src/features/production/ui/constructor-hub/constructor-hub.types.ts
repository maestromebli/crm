export type ConstructorHubStatus =
  | "UNASSIGNED"
  | "ASSIGNED"
  | "REVIEWING"
  | "HAS_QUESTIONS"
  | "IN_PROGRESS"
  | "DRAFT_UPLOADED"
  | "UNDER_REVIEW"
  | "NEEDS_REWORK"
  | "APPROVED"
  | "HANDED_OFF";

export type ConstructorQuestionCategory =
  | "SIZES"
  | "MATERIALS"
  | "TECH"
  | "INSTALLATION"
  | "DESIGN"
  | "PRODUCTION";

export type ConstructorQuestionTarget =
  | "MANAGER"
  | "MEASURER"
  | "HEAD_OF_PRODUCTION"
  | "CLIENT";

export type ConstructorQuestionPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type ConstructorQuestionStatus = "OPEN" | "IN_PROGRESS" | "CLOSED";

export type ConstructorFileCategory =
  | "CLIENT_PROJECT"
  | "OBJECT_PHOTO"
  | "MEASUREMENTS"
  | "VIDEO"
  | "REFERENCES"
  | "PROPOSAL_APPROVED"
  | "APPROVED_MATERIALS"
  | "REVISION_COMMENTS"
  | "OLD_VERSIONS"
  | "FINAL_FOR_PRODUCTION";

export type ConstructorVersionType = "DRAFT" | "REVIEW" | "FINAL";
export type ConstructorVersionApprovalStatus =
  | "PENDING"
  | "APPROVED"
  | "RETURNED"
  | "REJECTED";

export type ConstructorApprovalSeverity = "MINOR" | "MAJOR" | "CRITICAL";
export type ConstructorTimelineEventType =
  | "ASSIGNED"
  | "MEASUREMENTS_UPLOADED"
  | "TECH_SPEC_UPDATED"
  | "QUESTION_CREATED"
  | "QUESTION_ANSWERED"
  | "DRAFT_UPLOADED"
  | "RETURNED_FOR_REWORK"
  | "SENT_FOR_REVIEW"
  | "APPROVED"
  | "HANDED_TO_PRODUCTION";

export type ConstructorAIAlertLevel = "INFO" | "WARNING" | "CRITICAL";

export type ConstructorHubRole =
  | "ADMIN"
  | "DIRECTOR"
  | "HEAD_OF_PRODUCTION"
  | "PRODUCTION_MANAGER"
  | "CONSTRUCTOR"
  | "OUTSOURCE_CONSTRUCTOR";

export type ConstructorProjectHeader = {
  flowId: string;
  dealId: string;
  dealNumber: string;
  projectName: string;
  clientName: string;
  objectAddress: string;
  managerName: string;
  headOfProductionName: string;
  assignedConstructorName: string;
  deadlineAt: string | null;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  status: ConstructorHubStatus;
};

export type ConstructorTask = {
  id: string;
  title: string;
  done: boolean;
  dueAt: string | null;
};

export type ConstructorChecklistItem = {
  id: string;
  label: string;
  done: boolean;
  required: boolean;
};

export type ConstructorZoneProgress = {
  id: string;
  zoneName: string;
  progressPercent: number;
};

export type ConstructorTechSection = {
  id: string;
  title: string;
  summary: string;
  completionPercent: number;
  updatedAt: string | null;
  details: string[];
};

export type ConstructorQuestion = {
  id: string;
  text: string;
  category: ConstructorQuestionCategory;
  addressedTo: ConstructorQuestionTarget;
  priority: ConstructorQuestionPriority;
  status: ConstructorQuestionStatus;
  authorName: string;
  createdAt: string;
  pinned: boolean;
  answerPreview: string | null;
};

export type ConstructorFileComment = {
  id: string;
  authorName: string;
  text: string;
  createdAt: string;
};

export type ConstructorFile = {
  id: string;
  fileName: string;
  category: ConstructorFileCategory;
  uploadedBy: string;
  uploadedAt: string;
  versionLabel: string;
  extension: string;
  previewUrl: string | null;
  downloadUrl: string | null;
  approved: boolean;
  important: boolean;
  archived: boolean;
  mine: boolean;
  comments: ConstructorFileComment[];
};

export type ConstructorVersion = {
  id: string;
  versionLabel: string;
  type: ConstructorVersionType;
  uploadedAt: string;
  uploadedBy: string;
  changeSummary: string;
  approvalStatus: ConstructorVersionApprovalStatus;
};

export type ConstructorApprovalReview = {
  id: string;
  createdAt: string;
  reviewerName: string;
  decision: "ACCEPTED" | "RETURNED" | "COMMENTED";
  severity: ConstructorApprovalSeverity | null;
  reason: string | null;
  remarks: string[];
};

export type ConstructorTimelineEvent = {
  id: string;
  type: ConstructorTimelineEventType;
  title: string;
  description: string;
  actorName: string;
  createdAt: string;
};

export type ConstructorAIAlert = {
  id: string;
  level: ConstructorAIAlertLevel;
  message: string;
  section: "RISKS" | "CHECK" | "MISSING" | "RECOMMENDATION";
};

export type ConstructorApprovedSummaryLine = {
  id: string;
  label: string;
  state: "APPROVED" | "MISSING" | "OUTDATED";
  summary: string;
};

export type ConstructorApprovedSummary = {
  lines: ConstructorApprovedSummaryLine[];
};

export type ConstructorContact = {
  id: string;
  roleLabel: string;
  name: string;
  phone: string | null;
};

export type ConstructorMessage = {
  id: string;
  authorName: string;
  authorRole: string;
  text: string;
  createdAt: string;
};

export type ConstructorWorkspace = {
  header: ConstructorProjectHeader;
  stages: Array<{ id: string; label: string; state: "DONE" | "ACTIVE" | "PENDING" }>;
  tasks: ConstructorTask[];
  checklist: ConstructorChecklistItem[];
  zoneProgress: ConstructorZoneProgress[];
  techSections: ConstructorTechSection[];
  questions: ConstructorQuestion[];
  files: ConstructorFile[];
  versions: ConstructorVersion[];
  approvalReviews: ConstructorApprovalReview[];
  timeline: ConstructorTimelineEvent[];
  aiAlerts: ConstructorAIAlert[];
  approvedSummary: ConstructorApprovedSummary;
  contacts: ConstructorContact[];
  communication: ConstructorMessage[];
  currentUserRole: ConstructorHubRole;
};
