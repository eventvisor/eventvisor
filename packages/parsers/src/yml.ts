import { existsSync, readFileSync } from "node:fs";

import { parse, parseDocument, Scalar, stringify } from "yaml";
import type { Pair, YAMLMap, YAMLSeq } from "yaml";

import type { CustomParser } from "./index";

interface CommentedNode {
  comment?: string | null;
  commentBefore?: string | null;
}

interface NodeCreator {
  createNode(value: unknown): unknown;
  createPair(key: unknown, value: unknown): Pair;
}

function copyComments(source: unknown, target: unknown) {
  if (!source || !target || typeof source !== "object" || typeof target !== "object") return;
  const from = source as CommentedNode;
  const to = target as CommentedNode;
  if (from.comment != null) to.comment = from.comment;
  if (from.commentBefore != null) to.commentBefore = from.commentBefore;
}

function getKey(node: unknown) {
  if (node == null) return undefined;
  if (typeof (node as { value?: unknown }).value !== "undefined") {
    return String((node as { value: unknown }).value);
  }
  return typeof node === "string" ? node : undefined;
}

function isYamlMap(node: unknown): node is YAMLMap {
  return Boolean(node && typeof node === "object" && Array.isArray((node as YAMLMap).items));
}

function isYamlSequence(node: unknown): node is YAMLSeq {
  return Boolean(node && typeof node === "object" && Array.isArray((node as YAMLSeq).items));
}

function identity(value: unknown) {
  const node = value as { value?: unknown; toJSON?: () => unknown } | null;
  if (node && typeof node.value !== "undefined") return JSON.stringify(node.value);
  if (node && typeof node.toJSON === "function") return JSON.stringify(node.toJSON());
  return JSON.stringify(value);
}

function createValue(creator: NodeCreator, previous: unknown, value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    const node = new Scalar(value);
    copyComments(previous, node);
    return node;
  }

  if (Array.isArray(value)) {
    const previousItems = new Map<string, unknown>();
    if (isYamlSequence(previous)) {
      previous.items.forEach((item) => previousItems.set(identity(item), item));
    }
    const sequence = creator.createNode([]) as YAMLSeq;
    value.forEach((entry) =>
      sequence.add(createValue(creator, previousItems.get(identity(entry)), entry)),
    );
    copyComments(previous, sequence);
    return sequence;
  }

  const previousPairs = new Map<string, Pair>();
  if (isYamlMap(previous)) {
    (previous.items as Pair[]).forEach((pair) => {
      const key = getKey(pair.key);
      if (key !== undefined) previousPairs.set(key, pair);
    });
  }

  const map = creator.createNode({}) as YAMLMap;
  Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
    const previousPair = previousPairs.get(key);
    const pair = creator.createPair(key, createValue(creator, previousPair?.value, entry));
    if (previousPair) {
      copyComments(previousPair, pair);
      copyComments(previousPair.key, pair.key);
      copyComments(previousPair.value, pair.value);
    }
    map.add(pair);
  });
  copyComments(previous, map);
  return map;
}

export const ymlParser: CustomParser = {
  extension: "yml",
  parse<T>(content: string): T {
    return parse(content) as T;
  },
  stringify(content: unknown, filePath?: string) {
    if (!filePath || !existsSync(filePath)) return stringify(content);
    const existing = readFileSync(filePath, "utf8");
    if (!existing.trim()) return stringify(content);
    if (content === null || typeof content !== "object" || Array.isArray(content)) {
      throw new Error("Cannot set root document to a primitive value");
    }

    const document = parseDocument(existing) as unknown as { contents: unknown } & NodeCreator;
    document.contents = createValue(document, document.contents, content);
    return document.toString();
  },
};
