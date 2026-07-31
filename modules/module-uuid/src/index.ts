import type { EventvisorModule } from "@eventvisor/sdk";

export type UUIDModuleOptions = {
  name?: string;
  prefix?: string;
};

function generateCustomUUID(): string {
  const hexDigits = "0123456789abcdef";
  let uuid = "";

  // Generate 32 hex digits and format as UUID
  const random = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(random);
  } else {
    for (let index = 0; index < random.length; index++)
      random[index] = Math.floor(Math.random() * 256);
  }
  for (let i = 0; i < 32; i++) {
    const byte = random[Math.floor(i / 2)];
    const randomByte = i % 2 === 0 ? byte >> 4 : byte & 0xf;
    // Insert dashes according to UUID format (8-4-4-4-12)
    if (i === 8 || i === 12 || i === 16 || i === 20) {
      uuid += "-";
    }
    // Set version 4 and variant bits
    if (i === 12) {
      uuid += "4"; // Version 4
    } else if (i === 16) {
      uuid += hexDigits[(randomByte & 0x3) | 0x8]; // Variant bits
    } else {
      uuid += hexDigits[randomByte];
    }
  }

  return uuid;
}

export function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return generateCustomUUID();
}

export function createUUIDModule(options: UUIDModuleOptions = {}): EventvisorModule {
  const { name = "uuid" } = options;

  return {
    name,

    lookup: async () => {
      return generateUUID();
    },
  };
}
