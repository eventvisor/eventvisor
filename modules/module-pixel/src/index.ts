import type { EventvisorModule } from "@eventvisor/sdk";

export type PixelModuleOptions = {
  name?: string;
  /** Script execution is disabled by default because datafiles are remote control input. */
  allowScripts?: boolean;
  /** CSP nonce applied to every injected script. */
  nonce?: string | (() => string | undefined);
};

export function createPixelModule(options: PixelModuleOptions = {}): EventvisorModule {
  const { name = "pixel", allowScripts = false, nonce } = options;

  return {
    name,

    handle: async ({ effectName, step, payload }, api) => {
      const report = (
        code: string,
        message: string,
        details: Record<string, unknown>,
        level: "error" | "warn" = "error",
      ) => api.reportDiagnostic({ level, code, message, details });
      const { params } = step;

      if (!params) {
        report("pixel_missing_params", "Pixel step has no params", { step });

        return;
      }

      if (typeof params.snippet !== "string" || !params.snippet) {
        report("pixel_missing_snippet", "Pixel step has no snippet", { params });

        return;
      }

      const selector = typeof params.selector === "string" ? params.selector : "body";

      const el = document.querySelector(selector);

      if (!el) {
        report("pixel_element_not_found", "Pixel target element was not found", { selector });

        return;
      }

      let snippet = params.snippet;

      const variableKeys: [replace: string, source: string][] = [];

      try {
        const pattern = /\{\{\s*([^}]+)\s*\}\}/g;
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(snippet)) !== null) {
          variableKeys.push([match[0], match[1]]);
        }
      } catch (e) {
        report("pixel_invalid_snippet", "Could not parse pixel snippet variables", {
          snippet,
          error: e,
        });
      }

      if (variableKeys.length > 0) {
        for (const [replace, variableKey] of variableKeys) {
          const source = variableKey.trim().replace(/^payload\.?/, "");
          const variableValue = source
            ? source.split(".").reduce<any>((value, key) => value?.[key], payload)
            : payload;

          snippet = snippet.replace(replace, String(variableValue ?? ""));
        }
      }

      // Parse the snippet to handle both script tags and regular HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(snippet, "text/html");

      // Handle script tags separately to ensure they execute
      const scripts = doc.querySelectorAll("script");
      if (scripts.length && !allowScripts) {
        report(
          "pixel_scripts_disabled",
          "Pixel snippet scripts were ignored because allowScripts is disabled",
          { effectName, scripts: scripts.length },
          "warn",
        );
      }
      scripts.forEach((script) => {
        if (!allowScripts) return;
        const newScript = document.createElement("script");

        // Copy all attributes from the original script
        Array.from(script.attributes).forEach((attr) => {
          newScript.setAttribute(attr.name, attr.value);
        });

        const resolvedNonce = typeof nonce === "function" ? nonce() : nonce;
        if (resolvedNonce) newScript.setAttribute("nonce", resolvedNonce);

        // Copy the script content
        newScript.textContent = script.textContent;

        // Append to the target element
        el.appendChild(newScript);
      });

      // Handle other HTML content (non-script elements)
      const otherElements = Array.from(doc.body.children).filter(
        (child) => child.tagName !== "SCRIPT",
      );
      otherElements.forEach((element) => {
        el.appendChild(element.cloneNode(true));
      });
    },
  };
}
