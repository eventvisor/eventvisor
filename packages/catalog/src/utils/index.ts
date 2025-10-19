export interface Query {
  keyword: string;
  tags: string[];
  archived?: boolean;
}

export function parseSearchQuery(queryString: string) {
  const query: Query = {
    keyword: "",
    tags: [],
    archived: undefined,
  };

  const parts = queryString.split(" ");

  for (const part of parts) {
    if (part.startsWith("tag:")) {
      const tag = part.replace("tag:", "");

      if (tag.length > 0) {
        query.tags.push(tag);
      }
    } else if (part.startsWith("archived:")) {
      const archived = part.replace("archived:", "");

      if (archived === "true") {
        query.archived = true;
      } else if (archived === "false") {
        query.archived = false;
      }
    } else {
      if (part.length > 0) {
        query.keyword = part;
      }
    }
  }

  return query;
}

export function getEventsByQuery(q: string, events: any[]) {
  const query = parseSearchQuery(q);

  const filteredEvents = events
    .filter((event) => {
      let matched = true;

      if (
        query.keyword.length > 0 &&
        event.name.toLowerCase().indexOf(query.keyword.toLowerCase()) === -1
      ) {
        matched = false;
      }

      if (query.tags.length > 0) {
        for (const tag of query.tags) {
          if (event.tags.every((t: string) => t.toLowerCase() !== tag.toLowerCase())) {
            matched = false;
          }
        }
      }

      if (typeof query.archived === "boolean") {
        if (query.archived && event.archived !== query.archived) {
          matched = false;
        }

        if (!query.archived && event.archived === true) {
          matched = false;
        }
      }

      return matched;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return filteredEvents;
}

export function getAttributesByQuery(q: string, attributes: any[]) {
  const query = parseSearchQuery(q);

  const filteredAttributes = attributes
    .filter((attribute) => {
      let matched = true;

      if (
        query.keyword.length > 0 &&
        attribute.name.toLowerCase().indexOf(query.keyword.toLowerCase()) === -1
      ) {
        matched = false;
      }

      if (typeof query.archived === "boolean") {
        if (query.archived && attribute.archived !== query.archived) {
          matched = false;
        }

        if (!query.archived && attribute.archived === true) {
          matched = false;
        }
      }

      return matched;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return filteredAttributes;
}

export function getDestinationsByQuery(q: string, destinations: any[]) {
  const query = parseSearchQuery(q);

  const filteredDestinations = destinations
    .filter((destination) => {
      let matched = true;

      if (
        query.keyword.length > 0 &&
        destination.name.toLowerCase().indexOf(query.keyword.toLowerCase()) === -1
      ) {
        matched = false;
      }

      if (typeof query.archived === "boolean") {
        if (query.archived && destination.archived !== query.archived) {
          matched = false;
        }

        if (!query.archived && destination.archived === true) {
          matched = false;
        }
      }

      return matched;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return filteredDestinations;
}

export function getEffectsByQuery(q: string, effects: any[]) {
  const query = parseSearchQuery(q);

  const filteredEffects = effects
    .filter((effect) => {
      let matched = true;

      if (
        query.keyword.length > 0 &&
        effect.name.toLowerCase().indexOf(query.keyword.toLowerCase()) === -1
      ) {
        matched = false;
      }

      if (typeof query.archived === "boolean") {
        if (query.archived && effect.archived !== query.archived) {
          matched = false;
        }

        if (!query.archived && effect.archived === true) {
          matched = false;
        }
      }

      return matched;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return filteredEffects;
}
