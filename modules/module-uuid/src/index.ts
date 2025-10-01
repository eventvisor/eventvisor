import { Module } from "@eventvisor/sdk";

export type UUIDModuleOptions = {
  name?: string;
  prefix?: string;
};

function generateCustomUUID(): string {
  const hexDigits = "0123456789abcdef";
  let uuid = "";

  // Generate 32 hex digits and format as UUID
  for (let i = 0; i < 32; i++) {
    const randomByte = Math.floor(Math.random() * 16);
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
  if (typeof crypto !== "undefined") {
    return crypto.randomUUID();
  }

  if (typeof require !== "undefined") {
    try {
      const uuid = require("crypto").randomUUID();

      return uuid;

      // eslint-disable-next-line
    } catch (e) {
      // do nothing
    }
  }

  return generateCustomUUID();
}

export function createUUIDModule(options: UUIDModuleOptions = {}): Module {
  const { name = "uuid" } = options;

  return {
    name,

    lookup: async () => {
      return generateUUID();
    },
  };
}
