"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { DealWorkspacePayload, DealWorkspaceTabId } from "../../features/deal-workspace/types";
import { DealWorkspaceTabPanels } from "./DealWorkspaceTabPanels";

type Props = {
  tab: DealWorkspaceTabId;
  data: DealWorkspacePayload;
  onTab: (tab: DealWorkspaceTabId) => void;
  estimateVisibility: "director" | "head" | "sales";
};

export function DealModules({ tab, data, onTab, estimateVisibility }: Props) {
  const reduceMotion = useReducedMotion();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={tab}
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
      >
        <DealWorkspaceTabPanels
          tab={tab}
          data={data}
          onTab={onTab}
          estimateVisibility={estimateVisibility}
        />
      </motion.div>
    </AnimatePresence>
  );
}
