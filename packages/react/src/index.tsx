import * as React from "react";
import type { Eventvisor } from "@eventvisor/sdk";
import type { AttributeName, Value } from "@eventvisor/types";

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
export function useEventvisorInstance(): Eventvisor {
  const instance = React.useContext(EventvisorContext);
  if (!instance) throw new Error("useEventvisorInstance must be used within EventvisorProvider");
  return instance;
}

export function useEventvisorReady(): boolean {
  const instance = useEventvisorInstance();
  const [isEventvisorReady, setIsEventvisorReady] = React.useState(instance.isReady());

  React.useEffect(() => {
    let active = true;
    setIsEventvisorReady(instance.isReady());
    instance.onReady().then(
      () => {
        if (active) setIsEventvisorReady(true);
      },
      () => {
        if (active) setIsEventvisorReady(false);
      },
    );
    return () => {
      active = false;
    };
  }, [instance]);

  return isEventvisorReady;
}

export interface UseEventvisor {
  instance: Eventvisor;
  track: Eventvisor["track"];
  setAttribute: Eventvisor["setAttribute"];
  getAttributeValue: (name: AttributeName) => Value | null;
  isAttributeSet: (name: AttributeName) => boolean;
  removeAttribute: Eventvisor["removeAttribute"];
}

export function useEventvisor(): UseEventvisor {
  const instance = useEventvisorInstance();

  return React.useMemo(
    () => ({
      instance,
      track: instance.track.bind(instance),
      setAttribute: instance.setAttribute.bind(instance),
      getAttributeValue: instance.getAttributeValue.bind(instance),
      isAttributeSet: instance.isAttributeSet.bind(instance),
      removeAttribute: instance.removeAttribute.bind(instance),
    }),
    [instance],
  );
}
