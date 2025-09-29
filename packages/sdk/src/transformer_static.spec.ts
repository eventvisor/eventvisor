import { Transformer } from "./transformer";

describe("Transformer static methods", () => {
  describe("getValueAtPath", () => {
    const testObj = {
      user: {
        profile: {
          name: "John Doe",
          email: "john@example.com",
          settings: {
            theme: "dark",
            notifications: true,
          },
        },
        preferences: ["reading", "music"],
      },
      config: {
        version: "1.0.0",
        features: ["auth", "api"],
      },
    };

    it("should get value at simple path", () => {
      const result = Transformer.getValueAtPath(testObj, "user.profile.name");
      expect(result).toBe("John Doe");
    });

    it("should get value at nested path", () => {
      const result = Transformer.getValueAtPath(testObj, "user.profile.settings.theme");
      expect(result).toBe("dark");
    });

    it("should get value at root level", () => {
      const result = Transformer.getValueAtPath(testObj, "config");
      expect(result).toEqual({
        version: "1.0.0",
        features: ["auth", "api"],
      });
    });

    it("should get array value", () => {
      const result = Transformer.getValueAtPath(testObj, "user.preferences");
      expect(result).toEqual(["reading", "music"]);
    });

    it("should get array element by index", () => {
      const result = Transformer.getValueAtPath(testObj, "user.preferences.0");
      expect(result).toBe("reading");
    });

    it("should get array element by numeric string", () => {
      const result = Transformer.getValueAtPath(testObj, "user.preferences.1");
      expect(result).toBe("music");
    });

    it("should return undefined for non-existent path", () => {
      const result = Transformer.getValueAtPath(testObj, "user.profile.age");
      expect(result).toBeUndefined();
    });

    it("should return undefined for invalid path", () => {
      const result = Transformer.getValueAtPath(testObj, "");
      expect(result).toBeUndefined();
    });

    it("should return undefined for null path", () => {
      const result = Transformer.getValueAtPath(testObj, null as any);
      expect(result).toBeUndefined();
    });

    it("should return undefined for non-string path", () => {
      const result = Transformer.getValueAtPath(testObj, 123 as any);
      expect(result).toBeUndefined();
    });

    it("should return undefined for non-existent array index", () => {
      const result = Transformer.getValueAtPath(testObj, "user.preferences.5");
      expect(result).toBeUndefined();
    });

    it("should return undefined for invalid array index", () => {
      const result = Transformer.getValueAtPath(testObj, "user.preferences.abc");
      expect(result).toBeUndefined();
    });

    it("should handle null object", () => {
      const result = Transformer.getValueAtPath(null, "user.profile.name");
      expect(result).toBeUndefined();
    });

    it("should handle undefined object", () => {
      const result = Transformer.getValueAtPath(undefined, "user.profile.name");
      expect(result).toBeUndefined();
    });
  });

  describe("setValueAtPath", () => {
    let testObj: any;

    beforeEach(() => {
      testObj = {
        user: {
          profile: {
            name: "John Doe",
            email: "john@example.com",
          },
          preferences: ["reading", "music"],
        },
        config: {
          version: "1.0.0",
        },
      };
    });

    it("should set value at simple path", () => {
      const result = Transformer.setValueAtPath(testObj, "user.profile.age", 30);
      expect(result.user.profile.age).toBe(30);
    });

    it("should set value at nested path", () => {
      const result = Transformer.setValueAtPath(testObj, "user.profile.settings.theme", "light");
      expect(result.user.profile.settings.theme).toBe("light");
    });

    it("should set value at root level", () => {
      const result = Transformer.setValueAtPath(testObj, "appName", "MyApp");
      expect(result.appName).toBe("MyApp");
    });

    it("should set array element by index", () => {
      const result = Transformer.setValueAtPath(testObj, "user.preferences.0", "gaming");
      expect(result.user.preferences[0]).toBe("gaming");
    });

    it("should create nested objects when they don't exist", () => {
      const result = Transformer.setValueAtPath(testObj, "user.profile.address.city", "New York");
      expect(result.user.profile.address.city).toBe("New York");
    });

    it("should create arrays when numeric keys are expected", () => {
      const result = Transformer.setValueAtPath(testObj, "user.scores.0", 100);
      expect(Array.isArray(result.user.scores)).toBe(true);
      expect(result.user.scores[0]).toBe(100);
    });

    it("should handle empty path", () => {
      const result = Transformer.setValueAtPath(testObj, "", "value");
      expect(result).toBe(testObj);
    });

    it("should handle null path", () => {
      const result = Transformer.setValueAtPath(testObj, null as any, "value");
      expect(result).toBe(testObj);
    });

    it("should handle non-string path", () => {
      const result = Transformer.setValueAtPath(testObj, 123 as any, "value");
      expect(result).toBe(testObj);
    });

    it("should handle null object", () => {
      const result = Transformer.setValueAtPath(null, "user.profile.name", "Jane");
      expect(result).toBe(null);
    });

    it("should handle undefined object", () => {
      const result = Transformer.setValueAtPath(undefined, "user.profile.name", "Jane");
      expect(result).toBe(undefined);
    });

    it("should not mutate original object", () => {
      const original = JSON.parse(JSON.stringify(testObj));
      Transformer.setValueAtPath(testObj, "user.profile.age", 30);
      expect(testObj).toEqual(original);
    });
  });

  describe("removeValueAt", () => {
    let testObj: any;

    beforeEach(() => {
      testObj = {
        user: {
          profile: {
            name: "John Doe",
            email: "john@example.com",
            settings: {
              theme: "dark",
              notifications: true,
            },
          },
          preferences: ["reading", "music", "gaming"],
        },
        config: {
          version: "1.0.0",
        },
      };
    });

    it("should remove value at simple path", () => {
      const result = Transformer.removeValueAt(testObj, "user.profile.email");
      expect(result.user.profile.email).toBeUndefined();
      expect(result.user.profile.name).toBe("John Doe"); // Other properties should remain
    });

    it("should remove value at nested path", () => {
      const result = Transformer.removeValueAt(testObj, "user.profile.settings.theme");
      expect(result.user.profile.settings.theme).toBeUndefined();
      expect(result.user.profile.settings.notifications).toBe(true); // Other properties should remain
    });

    it("should remove value at root level", () => {
      const result = Transformer.removeValueAt(testObj, "config");
      expect(result.config).toBeUndefined();
      expect(result.user).toBeDefined(); // Other properties should remain
    });

    it("should remove array element by index", () => {
      const result = Transformer.removeValueAt(testObj, "user.preferences.1");
      expect(result.user.preferences).toEqual(["reading", "gaming"]);
      expect(result.user.preferences.length).toBe(2);
    });

    it("should handle non-existent path gracefully", () => {
      const result = Transformer.removeValueAt(testObj, "user.profile.age");
      expect(result).toEqual(testObj); // Should return original object unchanged
    });

    it("should handle empty path", () => {
      const result = Transformer.removeValueAt(testObj, "");
      expect(result).toEqual(testObj);
    });

    it("should handle null path", () => {
      const result = Transformer.removeValueAt(testObj, null as any);
      expect(result).toEqual(testObj);
    });

    it("should handle non-string path", () => {
      const result = Transformer.removeValueAt(testObj, 123 as any);
      expect(result).toEqual(testObj);
    });

    it("should handle null object", () => {
      const result = Transformer.removeValueAt(null, "user.profile.name");
      expect(result).toBe(null);
    });

    it("should handle undefined object", () => {
      const result = Transformer.removeValueAt(undefined, "user.profile.name");
      expect(result).toBe(undefined);
    });

    it("should not mutate original object", () => {
      const original = JSON.parse(JSON.stringify(testObj));
      Transformer.removeValueAt(testObj, "user.profile.email");
      expect(testObj).toEqual(original);
    });
  });

  describe("renameValueAt", () => {
    let testObj: any;

    beforeEach(() => {
      testObj = {
        user: {
          profile: {
            name: "John Doe",
            email: "john@example.com",
            settings: {
              theme: "dark",
              notifications: true,
            },
          },
          preferences: ["reading", "music"],
        },
        config: {
          version: "1.0.0",
        },
      };
    });

    it("should rename single property", () => {
      const result = Transformer.renameValueAt(
        {
          name: "John Doe",
        },
        { name: "fullName" },
      );
      expect(result.fullName).toBe("John Doe");
      expect(result.name).toBeUndefined();
    });

    it("should rename simple property", () => {
      const result = Transformer.renameValueAt(testObj, {
        "user.profile.name": "user.profile.fullName",
      });
      expect(result.user.profile.fullName).toBe("John Doe");
      expect(result.user.profile.name).toBeUndefined();
    });

    it("should rename nested property", () => {
      const result = Transformer.renameValueAt(testObj, {
        "user.profile.email": "user.profile.userEmail",
      });
      expect(result.user.profile.userEmail).toBe("john@example.com");
      expect(result.user.profile.email).toBeUndefined();
    });

    it("should rename to nested path", () => {
      const result = Transformer.renameValueAt(testObj, {
        "user.profile.name": "user.profile.fullName",
      });
      expect(result.user.profile.fullName).toBe("John Doe");
      expect(result.user.profile.name).toBeUndefined();
    });

    it("should rename root property", () => {
      const result = Transformer.renameValueAt(testObj, { config: "configuration" });
      expect(result.configuration.version).toBe("1.0.0");
      expect(result.config).toBeUndefined();
    });

    it("should handle non-existent source path gracefully", () => {
      const result = Transformer.renameValueAt(testObj, { "user.profile.age": "userAge" });
      expect(result).toEqual(testObj); // Should return original object unchanged
    });

    it("should handle empty target object", () => {
      const result = Transformer.renameValueAt(testObj, {});
      expect(result).toEqual(testObj);
    });

    it("should handle null target object", () => {
      const result = Transformer.renameValueAt(testObj, null as any);
      expect(result).toEqual(testObj);
    });

    it("should handle null object", () => {
      const result = Transformer.renameValueAt(null, { name: "fullName" });
      expect(result).toBe(null);
    });

    it("should handle undefined object", () => {
      const result = Transformer.renameValueAt(undefined, { name: "fullName" });
      expect(result).toBe(undefined);
    });

    it("should handle non-object", () => {
      const result = Transformer.renameValueAt("string", { name: "fullName" });
      expect(result).toBe("string");
    });

    it("should not mutate original object", () => {
      const original = JSON.parse(JSON.stringify(testObj));
      Transformer.renameValueAt(testObj, { "user.profile.name": "user.profile.fullName" });
      expect(testObj).toEqual(original);
    });

    it("should handle complex nested rename", () => {
      const result = Transformer.renameValueAt(testObj, {
        "user.profile.settings.theme": "user.profile.settings.colorScheme",
      });
      expect(result.user.profile.settings.colorScheme).toBe("dark");
      expect(result.user.profile.settings.theme).toBeUndefined();
    });

    it("should handle rename with array path", () => {
      const result = Transformer.renameValueAt(testObj, {
        "user.preferences.0": "user.preferences.1",
      });
      expect(result.user.preferences[1]).toBe("reading");
      expect(result.user.preferences.length).toBe(2); // Array length extends to accommodate index 1
      // Note: Array manipulation during rename can be complex due to splice operations
    });
  });
});
