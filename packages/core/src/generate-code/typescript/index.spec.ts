import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as ts from "typescript";

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
        listSchemas: jest.fn().mockResolvedValue([]),
        readSchema: jest.fn(),
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
        listSchemas: jest.fn().mockResolvedValue([]),
        readSchema: jest.fn(),
      },
    } as unknown as Dependencies;

    await generateTypeScriptCodeForProject(deps, outputPath);

    const attributesContent = fs.readFileSync(path.join(outputPath, "attributes.ts"), "utf8");

    expect(attributesContent).toContain("export type UserNamespaceIdAttribute = string");
    expect(attributesContent).toContain("export type UserNamespaceIdAttribute2 = string");
    expect(attributesContent).toContain('"user-namespace-id": UserNamespaceIdAttribute;');
    expect(attributesContent).toContain('"user/id": UserNamespaceIdAttribute2;');
  });

  it("resolves reusable schemas before generating entity types", async () => {
    const outputPath = fs.mkdtempSync(path.join(os.tmpdir(), "eventvisor-typescript-codegen-"));
    const deps = {
      datasource: {
        listAttributes: jest.fn().mockResolvedValue([]),
        readAttribute: jest.fn(),
        listEvents: jest.fn().mockResolvedValue(["customer/updated"]),
        readEvent: jest.fn().mockResolvedValue({
          schema: "customer",
          description: "Customer updated",
        }),
        listSchemas: jest.fn().mockResolvedValue(["customer", "identifier"]),
        readSchema: jest.fn().mockImplementation(async (key: string) =>
          key === "customer"
            ? {
                type: "object",
                properties: { id: { schema: "identifier" } },
                required: ["id"],
              }
            : { type: "string", minLength: 1 },
        ),
      },
    } as unknown as Dependencies;

    await generateTypeScriptCodeForProject(deps, outputPath);

    const eventsContent = fs.readFileSync(path.join(outputPath, "events.ts"), "utf8");
    expect(eventsContent).toContain("export interface CustomerNamespaceUpdatedEvent");
    expect(eventsContent).toContain("id: string;");
    expect(eventsContent).not.toContain("schema:");
  });

  it("sorts generated entities and returns the SDK track result", async () => {
    const outputPath = fs.mkdtempSync(path.join(os.tmpdir(), "eventvisor-typescript-codegen-"));
    const deps = {
      datasource: {
        listAttributes: jest.fn().mockResolvedValue(["zeta", "alpha"]),
        readAttribute: jest.fn().mockResolvedValue({ type: "string" }),
        listEvents: jest.fn().mockResolvedValue(["zeta", "alpha"]),
        readEvent: jest.fn().mockImplementation(async (name: string) =>
          name === "alpha"
            ? { type: "object" }
            : {
                type: "object",
                properties: { id: { type: "string" } },
                required: ["id"],
              },
        ),
        listSchemas: jest.fn().mockResolvedValue([]),
        readSchema: jest.fn(),
      },
    } as unknown as Dependencies;

    await generateTypeScriptCodeForProject(deps, outputPath);

    const eventsContent = fs.readFileSync(path.join(outputPath, "events.ts"), "utf8");
    const indexContent = fs.readFileSync(path.join(outputPath, "index.ts"), "utf8");
    expect(eventsContent.indexOf("alpha")).toBeLessThan(eventsContent.indexOf("zeta"));
    expect(indexContent).toContain("type EventNamesWithoutRequiredPayload");
    expect(indexContent).toContain("Record<string, never> extends Events[K]");
    expect(indexContent).toContain("payload: Events[K] = {} as Events[K]");
    expect(indexContent).toContain("result = await instance.track");
    expect(indexContent).toContain("return result;");

    const usagePath = path.join(outputPath, "usage.ts");
    fs.writeFileSync(
      usagePath,
      [
        'import { track } from "./index";',
        'void track("alpha");',
        'void track("zeta", { id: "event-1" });',
        "// @ts-expect-error zeta has a required payload property",
        'void track("zeta");',
      ].join("\n"),
    );

    const sdkTypesDirectory = path.join(outputPath, "node_modules", "@eventvisor", "sdk");
    fs.mkdirSync(sdkTypesDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(sdkTypesDirectory, "index.d.ts"),
      [
        "export type Value = unknown;",
        "export interface Eventvisor {",
        "  track(eventName: string, value?: Value): Promise<Value | null>;",
        "  setAttribute(attributeName: string, value: Value): Promise<Value | null>;",
        "}",
      ].join("\n"),
    );

    const program = ts.createProgram([usagePath], {
      ignoreDeprecations: "6.0",
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.Node10,
      noEmit: true,
      skipLibCheck: true,
      strict: true,
      target: ts.ScriptTarget.ES2020,
    });
    const diagnostics = ts.getPreEmitDiagnostics(program);
    expect(
      diagnostics.map((diagnostic) =>
        ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
      ),
    ).toEqual([]);
  });
});

describe("getInterfaceName", () => {
  it("should include namespace separators in namespaced entity names", () => {
    expect(getInterfaceName("user/id", "Attribute")).toBe("UserNamespaceIdAttribute");
  });
});
