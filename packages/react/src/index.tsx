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
  children: React.ReactNode;
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

export function track(eventName: EventName, value: Value) {
  const instance = useInstance();

  instance.track(eventName, value);
}

export function setAttribute(name: AttributeName, value: Value) {
  const instance = useInstance();

  instance.setAttribute(name, value);
}

export function getAttributeValue(name: AttributeName) {
  const instance = useInstance();

  return instance.getAttributeValue(name);
}

export function isAttributeSet(name: AttributeName) {
  const instance = useInstance();

  return instance.isAttributeSet(name);
}

export function removeAttribute(name: AttributeName) {
  const instance = useInstance();

  instance.removeAttribute(name);
}
