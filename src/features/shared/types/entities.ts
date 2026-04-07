export type Uuid = string;

export type Client = {
  id: Uuid;
  name: string;
  type: "PERSON" | "COMPANY";
};

export type Project = {
  id: Uuid;
  code: string;
  title: string;
  clientId: Uuid;
  managerId: Uuid;
  status: "LEAD" | "APPROVED" | "IN_WORK" | "COMPLETED" | "CLOSED" | "CANCELLED";
  contractAmount: number;
  currency: "UAH";
  plannedMargin: number | null;
  actualMargin: number | null;
  startDate: string | null;
  dueDate: string | null;
  notes: string;
};

export type ProjectObject = {
  id: Uuid;
  projectId: Uuid;
  title: string;
  objectType: string;
  address: string;
  notes: string;
};

