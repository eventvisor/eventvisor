export type EmitType =
  | "ready"
  | "datafile_set"
  | "attribute_set"
  | "attribute_removed"
  | "event_tracked";

export type EventDetails = Record<string, unknown>;

export type EventCallback = (details: EventDetails) => void;

export type Listeners = Record<EmitType, EventCallback[]> | {}; // eslint-disable-line

export class Emitter {
  listeners: Listeners;

  constructor() {
    this.listeners = {};
  }

  on(emitType: EmitType, callback: EventCallback) {
    if (!this.listeners[emitType]) {
      this.listeners[emitType] = [];
    }

    const listeners = this.listeners[emitType];
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

  trigger(emitType: EmitType, details: EventDetails = {}) {
    const listeners = this.listeners[emitType];

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
