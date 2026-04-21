export function createNextTemplateDraftVersion(input: {
  currentVersion: number;
  code: string;
}) {
  return {
    code: input.code,
    version: input.currentVersion + 1,
    status: "DRAFT" as const,
  };
}
