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

export function useEventvisorAttribute(name: AttributeName): Value | null {
  const instance = useEventvisorInstance();
  const [value, setValue] = React.useState<Value | null>(() => instance.getAttributeValue(name));

  React.useEffect(() => {
    setValue(instance.getAttributeValue(name));
    const refresh = ({ attributeName }: { attributeName: AttributeName }) => {
      if (attributeName === name) setValue(instance.getAttributeValue(name));
    };
    const unsubscribeSet = instance.on("attribute_set", refresh);
    const unsubscribeRemoved = instance.on("attribute_removed", refresh);
    const unsubscribeDatafile = instance.on("datafile_set", () =>
      setValue(instance.getAttributeValue(name)),
    );
    return () => {
      unsubscribeSet();
      unsubscribeRemoved();
      unsubscribeDatafile();
    };
  }, [instance, name]);

  return value;
}

export function useEventvisorAttributes(): Record<string, Value> {
  const instance = useEventvisorInstance();
  const [attributes, setAttributes] = React.useState(() => instance.getAttributes());

  React.useEffect(() => {
    const refresh = () => setAttributes(instance.getAttributes());
    refresh();
    const unsubscribeSet = instance.on("attribute_set", refresh);
    const unsubscribeRemoved = instance.on("attribute_removed", refresh);
    const unsubscribeDatafile = instance.on("datafile_set", refresh);
    return () => {
      unsubscribeSet();
      unsubscribeRemoved();
      unsubscribeDatafile();
    };
  }, [instance]);

  return attributes;
}
