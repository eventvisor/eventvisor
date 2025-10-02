import * as React from "react";
import { Eventvisor } from "@eventvisor/sdk";
import { EventName, AttributeName, Value } from "@eventvisor/types";

/**
 * Context
 */
export const EventvisorContext = React.createContext<Eventvisor | undefined>(undefined);

/**
 * Provider
 */
export interface EventvisorProviderProps {
  instance: Eventvisor;
  children?: React.ReactNode;
}

export function EventvisorProvider(props: EventvisorProviderProps) {
  return (
    <EventvisorContext.Provider value={props.instance}>{props.children}</EventvisorContext.Provider>
  );
}

/**
 * Hooks
 */
export function useInstance(): Eventvisor {
  const instance = React.useContext(EventvisorContext);

  return instance;
}

export function isReady(): boolean {
  const instance = useInstance();
  const [isEventvisorReady, setIsEventvisorReady] = React.useState(instance.isReady());

  React.useEffect(() => {
    instance.onReady().then(() => {
      if (isEventvisorReady === false) {
        setIsEventvisorReady(true);
      }
    });
  }, []);

  return isEventvisorReady;
}

export interface UseEventvisor {
  instance: Eventvisor;
  track: (eventName: EventName, value: Value) => void;
  setAttribute: (name: AttributeName, value: Value) => void;
  getAttributeValue: (name: AttributeName) => Value | null;
  isAttributeSet: (name: AttributeName) => boolean;
  removeAttribute: (name: AttributeName) => void;
}

export function useEventvisor(): UseEventvisor {
  const instance = useInstance();

  return {
    instance,
    track: (eventName, value) => instance.track(eventName, value),
    setAttribute: (name, value) => instance.setAttribute(name, value),
    getAttributeValue: (name) => instance.getAttributeValue(name),
    isAttributeSet: (name) => instance.isAttributeSet(name),
    removeAttribute: (name) => instance.removeAttribute(name),
  };
}
