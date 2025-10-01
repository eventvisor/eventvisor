import { Module } from "@eventvisor/sdk";

export type TimestampModuleOptions = {
  name?: string;
};

export function toLocalIsoOffset(d = new Date()) {
  const pad = (n, len = 2) => String(n).padStart(len, "0");
  const offMin = -d.getTimezoneOffset();
  const sign = offMin >= 0 ? "+" : "-";
  const hh = pad(Math.floor(Math.abs(offMin) / 60));
  const mm = pad(Math.abs(offMin) % 60);

  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `.${pad(d.getMilliseconds(), 3)}${sign}${hh}:${mm}`
  );
}

export function createTimestampModule(options: TimestampModuleOptions = {}): Module {
  const { name = "timestamp" } = options;

  return {
    name,

    lookup: async ({ key }) => {
      if (key) {
        if (key === "epoch") {
          // seconds
          return Math.floor(Date.now() / 1000);
        }

        if (key === "epoch_ms") {
          // milliseconds
          return Date.now();
        }
      }

      // iso 8601 with offset
      return toLocalIsoOffset();
    },
  };
}
