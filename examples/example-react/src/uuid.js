export function generateUUID() {
  const chars = "0123456789abcdef";
  let uuid = "";

  // Generate 8-4-4-4-12 format
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      uuid += "-";
    } else if (i === 14) {
      uuid += "4"; // Version 4 UUID
    } else if (i === 19) {
      uuid += chars[(Math.random() * 4) | 8]; // Variant bits
    } else {
      uuid += chars[Math.floor(Math.random() * 16)];
    }
  }

  return uuid;
}
