import { Injectable } from "@nestjs/common";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

@Injectable()
export class DocumentStorageService {
  private readonly basePath = join(process.cwd(), "storage", "contracts");

  async save(contractId: string, fileName: string, content: string | Buffer): Promise<string> {
    const folder = join(this.basePath, contractId);
    await mkdir(folder, { recursive: true });
    const fullPath = join(folder, fileName);
    await writeFile(fullPath, content);
    return fullPath;
  }
}
