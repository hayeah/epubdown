import { describe, expect, it } from "vitest";
import { Template, parseTemplates } from "./Template";

const mockTemplateMarkdown = `# Template One
This is template one body.
With multiple lines.

# Template Two  
Second template {{ value }}.

# Async Template
Async value: {{ asyncFunc }}
Promise value: {{ promiseValue }}
`;

describe("Template", () => {
  describe("parseTemplates", () => {
    it("should parse templates from markdown", () => {
      const templates = parseTemplates(mockTemplateMarkdown);

      expect(templates).toHaveLength(3);
      expect(templates[0]).toEqual({
        id: "template-one",
        title: "Template One",
        body: "This is template one body.\nWith multiple lines.",
      });
      expect(templates[1]).toEqual({
        id: "template-two",
        title: "Template Two",
        body: "Second template {{ value }}.",
      });
      expect(templates[2]).toEqual({
        id: "async-template",
        title: "Async Template",
        body: "Async value: {{ asyncFunc }}\nPromise value: {{ promiseValue }}",
      });
    });

    it("should return Template class instances", () => {
      const templates = parseTemplates(mockTemplateMarkdown);

      expect(templates[0]).toBeInstanceOf(Template);
      expect(templates[1]).toBeInstanceOf(Template);
      expect(templates[2]).toBeInstanceOf(Template);
    });

    it("should slugify template IDs correctly", () => {
      const templates = parseTemplates(mockTemplateMarkdown);

      expect(templates[0]?.id).toBe("template-one");
      expect(templates[1]?.id).toBe("template-two");
      expect(templates[2]?.id).toBe("async-template");
    });

    it("should handle special characters in titles", () => {
      const markdown = `# Template With Special-Characters & Symbols!
Body content here.`;

      const templates = parseTemplates(markdown);
      expect(templates[0]?.id).toBe("template-with-special-characters-symbols");
    });

    it("should handle empty sections", () => {
      const markdown = `# Empty Template
`;

      const templates = parseTemplates(markdown);
      expect(templates[0]).toEqual({
        id: "empty-template",
        title: "Empty Template",
        body: "",
      });
    });
  });

  describe("Template class rendering", () => {
    it("should render simple template with data", async () => {
      const template = new Template("test", "Test", "Hello {{ name }}!");

      const result = await template.render({ name: "World" });
      expect(result).toBe("Hello World!");
    });

    it("should render template with multiple variables", async () => {
      const template = new Template(
        "test",
        "Test",
        "{{ greeting }}, {{ name }}! Count: {{ count }}",
      );

      const result = await template.render({
        greeting: "Hello",
        name: "Alice",
        count: 42,
      });
      expect(result).toBe("Hello, Alice! Count: 42");
    });

    it("should handle async functions in templates", async () => {
      const template = new Template(
        "async",
        "Async Test",
        "Result: {{ getData }}",
      );

      const result = await template.render({
        getData: (async () => "async data")(),
      });
      expect(result).toBe("Result: async data");
    });

    it("should handle promises in templates", async () => {
      const template = new Template(
        "promise",
        "Promise Test",
        "Value: {{ promiseValue }}",
      );

      const result = await template.render({
        promiseValue: Promise.resolve("resolved value"),
      });
      expect(result).toBe("Value: resolved value");
    });

    it("should handle multiple async operations", async () => {
      const template = new Template(
        "multiple-async",
        "Multiple Async",
        "Func: {{ funcResult }}, Promise: {{ promiseResult }}, Sync: {{ syncValue }}",
      );

      const result = await template.render({
        funcResult: (async () => "func value")(),
        promiseResult: Promise.resolve("promise value"),
        syncValue: "sync value",
      });
      expect(result).toBe(
        "Func: func value, Promise: promise value, Sync: sync value",
      );
    });

    it("should handle nested object properties", async () => {
      const template = new Template(
        "nested",
        "Nested Test",
        "User: {{ user.name }}, Age: {{ user.age }}",
      );

      const result = await template.render({
        user: {
          name: "Bob",
          age: 30,
        },
      });
      expect(result).toBe("User: Bob, Age: 30");
    });

    it("should handle async functions with delays", async () => {
      const template = new Template(
        "delayed",
        "Delayed Test",
        "Delayed: {{ delayedData }}",
      );

      const result = await template.render({
        delayedData: (async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return "delayed result";
        })(),
      });
      expect(result).toBe("Delayed: delayed result");
    });

    it("should handle rejected promises gracefully", async () => {
      const template = new Template(
        "rejected",
        "Rejected Test",
        "Value: {{ failingPromise }}",
      );

      await expect(
        template.render({
          failingPromise: Promise.reject(new Error("Promise rejected")),
        }),
      ).rejects.toThrow("Promise rejected");
    });

    it("should handle async functions that throw", async () => {
      const template = new Template(
        "throwing",
        "Throwing Test",
        "Value: {{ throwingFunc }}",
      );

      await expect(
        template.render({
          throwingFunc: (async () => {
            throw new Error("Function threw");
          })(),
        }),
      ).rejects.toThrow("Function threw");
    });
  });

  describe("integration with parsed templates", () => {
    it("should render parsed template with sync data", async () => {
      const templates = parseTemplates(mockTemplateMarkdown);
      const template = templates[1]; // Template Two
      expect(template).toBeDefined();
      if (!template) return;

      const result = await template.render({ value: "test value" });
      expect(result).toBe("Second template test value.");
    });

    it("should render parsed async template", async () => {
      const templates = parseTemplates(mockTemplateMarkdown);
      const template = templates[2]; // Async Template
      expect(template).toBeDefined();
      if (!template) return;

      const result = await template.render({
        asyncFunc: (async () => "async result")(),
        promiseValue: Promise.resolve("promise result"),
      });
      expect(result).toBe(
        "Async value: async result\nPromise value: promise result",
      );
    });
  });
});
