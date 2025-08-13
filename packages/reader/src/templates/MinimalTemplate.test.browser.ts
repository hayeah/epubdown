import { describe, expect, it } from "vitest";
import { filters, render } from "./MinimalTemplate";

describe("MinimalTemplate", () => {
  describe("render", () => {
    describe("basic rendering", () => {
      const cases = [
        {
          name: "simple template",
          template: "Hello {{ name }}!",
          data: { name: "World" },
          expected: "Hello World!",
        },
        {
          name: "nested properties",
          template: "User: {{ user.name }}, Age: {{ user.age }}",
          data: { user: { name: "Alice", age: 30 } },
          expected: "User: Alice, Age: 30",
        },
        {
          name: "arrays",
          template: "First: {{ items.0 }}, Second: {{ items.1 }}",
          data: { items: ["apple", "banana"] },
          expected: "First: apple, Second: banana",
        },
        {
          name: "missing values",
          template: "Value: {{ missing }}",
          data: {},
          expected: "Value: ",
        },
        {
          name: "null values",
          template: "Value: {{ nullValue }}",
          data: { nullValue: null },
          expected: "Value: ",
        },
        {
          name: "numeric values",
          template: "Number: {{ num }}, Float: {{ float }}",
          data: { num: 42, float: 3.14 },
          expected: "Number: 42, Float: 3.14",
        },
        {
          name: "boolean values",
          template: "True: {{ yes }}, False: {{ no }}",
          data: { yes: true, no: false },
          expected: "True: true, False: false",
        },
        {
          name: "multiple placeholders on same line",
          template: "{{ a }} {{ b }} {{ c }}",
          data: { a: "1", b: "2", c: "3" },
          expected: "1 2 3",
        },
        {
          name: "whitespace in placeholders",
          template: "{{  name  }}",
          data: { name: "test" },
          expected: "test",
        },
        {
          name: "empty template",
          template: "",
          data: {},
          expected: "",
        },
        {
          name: "template with no placeholders",
          template: "Just plain text",
          data: {},
          expected: "Just plain text",
        },
        {
          name: "deeply nested missing properties",
          template: "{{ a.b.c.d.e }}",
          data: { a: { b: null } },
          expected: "",
        },
      ];

      for (const { name, template, data, expected } of cases) {
        it(`should handle ${name}`, async () => {
          const result = await render(template, data);
          expect(result).toBe(expected);
        });
      }
    });

    describe("async operations", () => {
      const cases = [
        {
          name: "promises",
          template: "Async: {{ asyncValue }}",
          data: { asyncValue: Promise.resolve("resolved") },
          expected: "Async: resolved",
        },
        {
          name: "async functions that return promises",
          template: "Result: {{ getData }}",
          data: { getData: (async () => "async result")() },
          expected: "Result: async result",
        },
        {
          name: "multiple async operations in parallel",
          template: "A: {{ a }}, B: {{ b }}, C: {{ c }}",
          data: {
            a: Promise.resolve("first"),
            b: (async () => {
              await new Promise((resolve) => setTimeout(resolve, 10));
              return "second";
            })(),
            c: "third",
          },
          expected: "A: first, B: second, C: third",
        },
      ];

      for (const { name, template, data, expected } of cases) {
        it(`should handle ${name}`, async () => {
          const result = await render(template, data);
          expect(result).toBe(expected);
        });
      }
    });

    describe("function auto-calling", () => {
      const cases = [
        {
          name: "methods with proper context",
          template: "Method: {{ getMessage }}",
          data: {
            prefix: "Hello",
            getMessage() {
              return `${this.prefix} World`;
            },
          },
          expected: "Method: Hello World",
        },
        {
          name: "async methods",
          template: "Async Method: {{ getAsyncMessage }}",
          data: {
            prefix: "Async",
            async getAsyncMessage() {
              await new Promise((resolve) => setTimeout(resolve, 10));
              return `${this.prefix} Result`;
            },
          },
          expected: "Async Method: Async Result",
        },
        {
          name: "nested method calls",
          template: "Nested: {{ user.getFullName }}",
          data: {
            user: {
              firstName: "John",
              lastName: "Doe",
              getFullName() {
                return `${this.firstName} ${this.lastName}`;
              },
            },
          },
          expected: "Nested: John Doe",
        },
        {
          name: "arrow functions (no this binding)",
          template: "Arrow: {{ getArrow }}",
          data: {
            prefix: "Should not see this",
            getArrow: () => "Arrow function result",
          },
          expected: "Arrow: Arrow function result",
        },
        {
          name: "getters (not called as functions)",
          template: "Getter: {{ value }}",
          data: {
            _internal: "getter value",
            get value() {
              return this._internal;
            },
          },
          expected: "Getter: getter value",
        },
      ];

      for (const { name, template, data, expected } of cases) {
        it(`should handle ${name}`, async () => {
          const result = await render(template, data);
          expect(result).toBe(expected);
        });
      }

      it("should handle class instances with methods", async () => {
        class Person {
          constructor(
            public firstName: string,
            public lastName: string,
          ) {}

          getFullName() {
            return `${this.firstName} ${this.lastName}`;
          }

          async getGreeting() {
            return `Hello, ${this.getFullName()}`;
          }
        }

        const template =
          "Name: {{ person.getFullName }}, Greeting: {{ person.getGreeting }}";
        const data = {
          person: new Person("Jane", "Smith"),
        };
        const result = await render(template, data);
        expect(result).toBe("Name: Jane Smith, Greeting: Hello, Jane Smith");
      });
    });
  });

  describe("filters", () => {
    const filterCases = [
      {
        name: "upper",
        template: "{{ text | upper }}",
        data: { text: "hello" },
        expected: "HELLO",
      },
      {
        name: "lower",
        template: "{{ text | lower }}",
        data: { text: "HELLO" },
        expected: "hello",
      },
      {
        name: "default",
        template: "{{ missing | default:fallback }}",
        data: {},
        expected: "fallback",
      },
      {
        name: "HTML escaping",
        template: "{{ html | h }}",
        data: { html: '<script>alert("xss")</script>' },
        expected: "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;",
      },
      {
        name: "json",
        template: "{{ obj | json }}",
        data: { obj: { name: "test", value: 42 } },
        expected: '{"name":"test","value":42}',
      },
      {
        name: "join",
        template: "{{ items | join:, }}",
        data: { items: ["apple", "banana", "cherry"] },
        expected: "apple, banana, cherry",
      },
      {
        name: "map",
        template: "{{ users | map:name | join:, }}",
        data: {
          users: [{ name: "Alice" }, { name: "Bob" }, { name: "Charlie" }],
        },
        expected: "Alice, Bob, Charlie",
      },
      {
        name: "chain multiple filters",
        template: "{{ text | upper | slice:0,5 }}",
        data: { text: "hello world" },
        expected: "HELLO",
      },
      {
        name: "filter with quoted arguments",
        template: '{{ text | default:"No text available" }}',
        data: {},
        expected: "No text available",
      },
      {
        name: "multiple arguments in filters",
        template: "{{ text | slice:7,12 }}",
        data: { text: "Hello, World!" },
        expected: "World",
      },
      {
        name: "padStart",
        template: "{{ num | padStart:5,0 }}",
        data: { num: 42 },
        expected: "00042",
      },
      {
        name: "conditional",
        template: "{{ flag | if:YES,NO }}",
        data: { flag: true },
        expected: "YES",
      },
    ];

    for (const { name, template, data, expected } of filterCases) {
      it(`should apply ${name} filter`, async () => {
        const result = await render(template, data);
        expect(result).toBe(expected);
      });
    }

    it("should apply date filter", async () => {
      const template = "{{ date | date:en-US,short }}";
      const data = { date: new Date("2024-01-15T12:00:00Z") };
      const result = await render(template, data);
      // Date format may vary by environment
      expect(result).toContain("1");
      expect(result).toContain("15");
    });
  });

  describe("complex scenarios", () => {
    const complexCases = [
      {
        name: "mixed async and sync",
        template: "Sync: {{ sync }}, Async: {{ async }}, Method: {{ method }}",
        data: {
          sync: "immediate",
          async: Promise.resolve("delayed"),
          method() {
            return "called";
          },
        },
        expected: "Sync: immediate, Async: delayed, Method: called",
      },
      {
        name: "nested async with filters",
        template: "{{ user.getName | upper }}",
        data: {
          user: {
            async getName() {
              return "alice";
            },
          },
        },
        expected: "ALICE",
      },
      {
        name: "array of objects with methods",
        template: "{{ items.0.getValue }}, {{ items.1.getValue }}",
        data: {
          items: [
            {
              value: 10,
              getValue() {
                return this.value * 2;
              },
            },
            {
              value: 20,
              getValue() {
                return this.value * 2;
              },
            },
          ],
        },
        expected: "20, 40",
      },
    ];

    for (const { name, template, data, expected } of complexCases) {
      it(`should handle ${name}`, async () => {
        const result = await render(template, data);
        expect(result).toBe(expected);
      });
    }
  });

  describe("error handling", () => {
    it("should handle unknown filter", async () => {
      const template = "{{ value | unknownFilter }}";
      const data = { value: "test" };
      await expect(render(template, data)).rejects.toThrow("Unknown filter");
    });

    it("should handle rejected promises", async () => {
      const template = "{{ failingPromise }}";
      const data = {
        failingPromise: Promise.reject(new Error("Promise failed")),
      };
      await expect(render(template, data)).rejects.toThrow("Promise failed");
    });
  });

  describe("custom filters", () => {
    it("should allow custom filter functions", async () => {
      const customFilters = {
        ...filters,
        reverse: (s: unknown) => String(s).split("").reverse().join(""),
        double: (n: unknown) => Number(n) * 2,
      };

      const template = "{{ text | reverse }}, {{ num | double }}";
      const data = { text: "hello", num: 21 };
      const result = await render(template, data, customFilters);
      expect(result).toBe("olleh, 42");
    });
  });
});
