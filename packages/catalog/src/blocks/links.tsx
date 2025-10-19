import React from "react";
import { Link } from "react-router";

export function LinkEvent(props: any) {
  const { name, className, children } = props;

  return (
    <Link to={`/events/${name}`} className={className}>
      {children}
    </Link>
  );
}

export function LinkAttribute(props: any) {
  const { name, className, children } = props;

  return (
    <Link to={`/attributes/${name}`} className={className}>
      {children}
    </Link>
  );
}

export function LinkDestination(props: any) {
  const { name, className, children } = props;

  return (
    <Link to={`/destinations/${name}`} className={className}>
      {children}
    </Link>
  );
}

export function LinkEffect(props: any) {
  const { name, className, children } = props;

  return (
    <Link to={`/effects/${name}`} className={className}>
      {children}
    </Link>
  );
}
