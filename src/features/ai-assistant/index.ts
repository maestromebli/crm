export { AssistantFloatingHost } from "./components/AssistantFloatingHost";
export { AssistantPageEntityProvider } from "./context/AssistantPageEntityContext";
export { AssistantWidget } from "./components/AssistantWidget";
export { AssistantPanel } from "./components/AssistantPanel";
export { AssistantAvatar } from "./components/AssistantAvatar";
export { assistantConfig } from "./config/assistantConfig";
export { useAssistantContext } from "./hooks/useAssistantContext";
export { useAssistantChat } from "./hooks/useAssistantChat";
export { useAssistantState } from "./hooks/useAssistantState";
export { useLeadTasksOverdueForAssistant } from "./hooks/useLeadTasksOverdueForAssistant";
export {
  ENVER_LEAD_TASKS_UPDATED_EVENT,
  ENVER_DEAL_TASKS_UPDATED_EVENT,
} from "./constants/leadTasksSync";
export type {
  EnverLeadTasksUpdatedDetail,
  EnverDealTasksUpdatedDetail,
} from "./constants/leadTasksSync";
export { dispatchLeadTasksUpdated } from "./utils/dispatchLeadTasksUpdated";
export { dispatchDealTasksUpdated } from "./utils/dispatchDealTasksUpdated";
export {
  getAssistantGreeting,
  getAssistantStatusLabel,
  getAssistantTooltip,
  getAssistantNextBestActionText,
  getAssistantRecommendationSummary,
} from "./utils/assistantMessages";
export type {
  AssistantVisualState,
  AssistantRouteKind,
  ResolvedPageContext,
  AssistantResolvedContext,
  AssistantAppearanceConfig,
} from "./types";
