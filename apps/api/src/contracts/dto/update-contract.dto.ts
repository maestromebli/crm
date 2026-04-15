import { ContractEditableFieldsDto } from "./create-from-quotation.dto";

export interface UpdateContractDto {
  status?: string;
  fields?: Partial<ContractEditableFieldsDto>;
}
