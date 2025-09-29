import { Module } from "@eventvisor/sdk";

export type PixelModuleOptions = {
  name?: string;
};

export function createPixelModule(options: PixelModuleOptions = {}): Module {
  const { name = "pixel" } = options;

  return {
    name,

    handle: async ({ step, payload }, { logger, sourceResolver }) => {
      const { params } = step;

      if (!params) {
        logger.error("[module-pixel] No params found in step", { step });

        return;
      }

      if (!params.snippet) {
        logger.error("[module-pixel] No snippet found in params", { params });

        return;
      }

      const selector = params.selector || "body";

      const el = document.querySelector(selector);

      if (!el) {
        logger.error("[module-pixel] No element found with selector", { selector });

        return;
      }

      let snippet = params.snippet;

      let variableKeys: [replace: string, source: string][] = [];

      try {
        variableKeys = Array.from(
          snippet.matchAll(/\{\{\s*([^}]+)\s*\}\}/g),
          (match: any) => match,
        );
      } catch (e) {
        logger.error("[module-pixel] Error parsing snippet for variable keys", {
          snippet,
          error: e,
        });
      }

      if (variableKeys.length > 0) {
        for (const [replace, variableKey] of variableKeys) {
          const source = variableKey.trim();
          const variableValue = await sourceResolver.resolve(source, { payload });

          snippet = snippet.replace(replace, variableValue); // @TODO: /g?
        }
      }

      // Parse the snippet to handle both script tags and regular HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(snippet, "text/html");

      // Handle script tags separately to ensure they execute
      const scripts = doc.querySelectorAll("script");
      scripts.forEach((script) => {
        const newScript = document.createElement("script");

        // Copy all attributes from the original script
        Array.from(script.attributes).forEach((attr) => {
          newScript.setAttribute(attr.name, attr.value);
        });

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
