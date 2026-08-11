import { jsonParser } from "./json";
import { ymlParser } from "./yml";

export interface CustomParser {
  extension: string;
  parse: <T>(content: string, filePath?: string) => T;
  stringify: (content: unknown, filePath?: string) => string;
}

export const parsers = {
  yml: ymlParser,
  json: jsonParser,
} satisfies Record<string, CustomParser>;

export type BuiltInParser = keyof typeof parsers;
export type Parser = BuiltInParser | CustomParser;
