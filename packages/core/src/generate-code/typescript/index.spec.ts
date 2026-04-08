import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { JSONSchema } from "@eventvisor/types";

import { Dependencies } from "../../dependencies";
import { generateTypeScriptCodeForProject, getInterfaceName } from "./index";

describe("TypeScript code generation", () => {
  it("should generate safe keys and slash-aware names for namespaced entities", async () => {
    const outputPath = fs.mkdtempSync(path.join(os.tmpdir(), "eventvisor-typescript-codegen-"));

    const schemas = new Map<string, JSONSchema>([
      ["userId", { type: "string" }],
      ["user/id", { type: "string" }],
      [
        "auth/signup",
        {
          type: "object",
          properties: {
            email: { type: "string" },
          },
          required: ["email"],
        },
      ],
    ]);

    const deps = {
      datasource: {
        listAttributes: jest.fn().mockResolvedValue(["userId", "user/id"]),
        readAttribute: jest
          .fn()
          .mockImplementation(async (name: string) => schemas.get(name) ?? null),
        listEvents: jest.fn().mockResolvedValue(["auth/signup"]),
        readEvent: jest.fn().mockImplementation(async (name: string) => schemas.get(name) ?? null),
      },
    } as unknown as Dependencies;

    await generateTypeScriptCodeForProject(deps, outputPath);

    const attributesContent = fs.readFileSync(path.join(outputPath, "attributes.ts"), "utf8");
    const eventsContent = fs.readFileSync(path.join(outputPath, "events.ts"), "utf8");

    expect(attributesContent).toContain("export type UserIdAttribute = string");
    expect(attributesContent).toContain("export type UserNamespaceIdAttribute = string");
    expect(attributesContent).toContain("userId: UserIdAttribute;");
    expect(attributesContent).toContain('"user/id": UserNamespaceIdAttribute;');

    expect(eventsContent).toContain("export interface AuthNamespaceSignupEvent");
    expect(eventsContent).toContain('"auth/signup": AuthNamespaceSignupEvent;');
  });

  it("should add a numeric suffix when interface names still clash", async () => {
    const outputPath = fs.mkdtempSync(path.join(os.tmpdir(), "eventvisor-typescript-codegen-"));

    const deps = {
      datasource: {
        listAttributes: jest.fn().mockResolvedValue(["user/id", "user-namespace-id"]),
        readAttribute: jest.fn().mockResolvedValue({ type: "string" }),
        listEvents: jest.fn().mockResolvedValue([]),
        readEvent: jest.fn(),
      },
    } as unknown as Dependencies;

    await generateTypeScriptCodeForProject(deps, outputPath);

    const attributesContent = fs.readFileSync(path.join(outputPath, "attributes.ts"), "utf8");

    expect(attributesContent).toContain("export type UserNamespaceIdAttribute = string");
    expect(attributesContent).toContain("export type UserNamespaceIdAttribute2 = string");
    expect(attributesContent).toContain('"user/id": UserNamespaceIdAttribute;');
    expect(attributesContent).toContain('"user-namespace-id": UserNamespaceIdAttribute2;');
  });
});

describe("getInterfaceName", () => {
  it("should include namespace separators in namespaced entity names", () => {
    expect(getInterfaceName("user/id", "Attribute")).toBe("UserNamespaceIdAttribute");
  });
});
