import { PurchaseTaskCard, type PurchaseTaskView } from "./PurchaseTaskCard";

export function PurchaseNeedList({ tasks }: { tasks: PurchaseTaskView[] }) {
  return (
    <section className="space-y-2">
      {tasks.map((task) => (
        <PurchaseTaskCard key={task.id} task={task} />
      ))}
    </section>
  );
}
