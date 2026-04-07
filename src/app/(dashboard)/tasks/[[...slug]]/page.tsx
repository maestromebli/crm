import {
  ModuleCatchAllPage,
  moduleCatchAllMetadata,
} from "../../_components/ModuleCatchAllPage";
import { TasksWorkspace } from "../../../../components/tasks/TasksWorkspace";
import { buildModulePath } from "../../../../lib/navigation-resolve";

type PageProps = {
  params: Promise<{ slug?: string[] }>;
};

export function generateMetadata(props: PageProps) {
  return moduleCatchAllMetadata({ ...props, baseHref: "/tasks" });
}

export default async function TasksCatchAllPage(props: PageProps) {
  const { slug } = await props.params;
  const pathname = buildModulePath("/tasks", slug);
  const useTasksUi =
    pathname === "/tasks" ||
    pathname.startsWith("/tasks/my") ||
    pathname.startsWith("/tasks/today") ||
    pathname.startsWith("/tasks/overdue") ||
    pathname.startsWith("/tasks/team") ||
    pathname.startsWith("/tasks/diia");

  if (useTasksUi) {
    return <TasksWorkspace pathname={pathname} />;
  }

  return <ModuleCatchAllPage {...props} baseHref="/tasks" />;
}
