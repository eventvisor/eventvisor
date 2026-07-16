import type { AttributeName, EventName, Value } from "@eventvisor/types";
import type { EventvisorDiagnostic } from "./logger.js";

export type EmitType =
  "ready" | "datafile_set" | "attribute_set" | "attribute_removed" | "event_tracked" | "error";

export interface EventDetailsMap {
  ready: Record<string, never>;
  datafile_set: { replaced: boolean };
  attribute_set: { attributeName: AttributeName };
  attribute_removed: { attributeName: AttributeName };
  event_tracked: { eventName: EventName; value: Value };
  error: { diagnostic: EventvisorDiagnostic };
}

export type EventCallback<T extends EmitType = EmitType> = (details: EventDetailsMap[T]) => void;

export type Listeners = { [T in EmitType]?: EventCallback<T>[] };

export class Emitter {
  listeners: Listeners;

  constructor() {
    this.listeners = {};
  }

  on<T extends EmitType>(emitType: T, callback: EventCallback<T>) {
    if (!this.listeners[emitType]) {
      this.listeners[emitType] = [];
    }

    const listeners = this.listeners[emitType] as EventCallback<T>[];
    listeners.push(callback);

    let isActive = true;

    return function unsubscribe() {
      if (!isActive) {
        return;
      }

      isActive = false;

      const index = listeners.indexOf(callback);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    };
  }

  trigger<T extends EmitType>(emitType: T, details: EventDetailsMap[T]) {
    const listeners = this.listeners[emitType] as EventCallback<T>[] | undefined;

    if (!listeners) {
      return;
    }

    listeners.forEach(function (listener) {
      try {
        listener(details);
      } catch (err) {
        console.error(err);
      }
    });
  }

  clearAll() {
    this.listeners = {};
  }
}
