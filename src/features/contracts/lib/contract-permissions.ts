export const CONTRACT_PERMISSIONS = {
  create: "contract.create",
  edit: "contract.edit",
  issue: "contract.issue",
  send: "contract.send",
  cancel: "contract.cancel",
  verify: "contract.verify",
  downloadSigned: "contract.download_signed",
  templateManage: "contract.template.manage",
  overrideGate: "contract.override_gate",
} as const;

export type ContractPermission = (typeof CONTRACT_PERMISSIONS)[keyof typeof CONTRACT_PERMISSIONS];

export function hasContractPermission(
  permissionKeys: readonly string[],
  permission: ContractPermission,
): boolean {
  return permissionKeys.includes(permission);
}
