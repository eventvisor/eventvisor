import * as crypto from "crypto";
import { DatafileContent } from "@eventvisor/types";

const base62chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

function generateHashFromString(str: string, length = 10): string {
  const hashBuffer = crypto.createHash("sha256").update(str).digest();

  // Convert buffer to base62 (alphanumeric)
  let num = BigInt("0x" + hashBuffer.toString("hex"));
  let base62 = "";
  while (num > 0) {
    // Convert the remainder to a number for indexing
    const remainder = Number(num % 62n);
    base62 = base62chars[remainder] + base62;
    num = num / 62n;
  }

  // Return first 10 chars for a short hash (adjust length as needed)
  return base62.slice(0, length);
}

export function generateHashForDatafile(datafileContent: DatafileContent): string {
  const copiedDatafileContent = { ...datafileContent };
  copiedDatafileContent.revision = "";

  const hash = generateHashFromString(JSON.stringify(copiedDatafileContent));

  return hash;
}
