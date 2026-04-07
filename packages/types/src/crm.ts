export type LeadStatus = "NEW" | "IN_PROGRESS" | "WON" | "LOST";

export type Lead = {
  id: string;
  title: string;
  status: LeadStatus;
};

