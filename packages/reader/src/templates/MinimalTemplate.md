# MinimalTemplate usage guide

A tiny, promise-aware mustache renderer with filter pipes. This guide covers syntax, behavior, and many examples using `render`, `renderSeq`, and the built-in filters.

# Import

```ts
import { render, renderSeq, filters, type FilterMap } from "./MinimalTemplate";
```

# Quick start

```ts
await render("Hello {{ name }}!", { name: "World" });
// -> "Hello World!"
```

# Placeholder syntax

* Delimiters: `{{ ... }}`
* Whitespace inside braces is ignored: `{{  name  }}`
* Expression grammar:
  `path` or `path | filter[:arg[,arg...]] | filter2[:...] ...`
* No control flow, loops, or expressions beyond the above
* Tokens resolve independently and then concatenate with literal text

# Paths and resolution

* Dot paths traverse objects and arrays: `user.name`, `items.0`
* Each step awaits if it is a promise
* Missing or null along the path yields `undefined` which renders as empty string unless a filter changes it
* Getters are read with the correct receiver (`this`) via `Reflect.get`
* If the final value is a function, it is auto-called with the last object as `this` and its return value is awaited

Examples:

```ts
await render("User: {{ user.name }}", { user: { name: "Ada" } });
// "User: Ada"

await render("First: {{ items.0 }}", { items: ["a", "b"] });
// "First: a"

await render("Missing: {{ nope.deep.value }}", {});
// "Missing: "
```

Function auto-calling:

```ts
const ctx = {
  greeting: "Hello",
  getMessage() { return `${this.greeting}, world`; },
  arrow: () => "arrow result",
};

await render("{{ getMessage }} | {{ arrow }}", ctx);
// "Hello, world | arrow result"
```

Class instances:

```ts
class Person {
  constructor(public first: string, public last: string) {}
  getFull() { return `${this.first} ${this.last}`; }
  async getHello() { return `Hi ${this.getFull()}`; }
}
await render("{{ p.getFull }} / {{ p.getHello }}", { p: new Person("Jane","Doe") });
// "Jane Doe / Hi Jane Doe"
```

Async values inline:

```ts
await render("A={{ a }}, B={{ b }}", {
  a: Promise.resolve(1),
  b: (async () => "ok")(),
});
// "A=1, B=ok"
```

# Filters overview

Built-in filters are small and safe. Filter args are parsed as comma-separated tokens; use quotes when you need spaces or commas inside a single arg.

* `upper(v)`
  Uppercases a string.

* `lower(v)`
  Lowercases a string.

* `default(v, d="")`
  If `v` is `null`, `undefined`, or `""`, returns `d`.

* `h(s)`
  HTML escapes `& < > " '`. Not a full sanitizer.

* `json(v)`
  `JSON.stringify(v)` without spacing.

* `date(v, locale="en-US", style="medium")`
  Formats `Date` or date-coercible value using `Intl.DateTimeFormat`. On invalid locale, falls back to ISO or empty.

* `join(arr, sep=", ")`
  Joins an array. Non-arrays become `String(v)`.

* `map(arr, path)`
  Maps an array by a dot path for each item. The path may resolve to a method and will be auto-called.

* `if(v, thenVal, elseVal="")`
  Truthy check.

* `padStart(v, len, ch=" ")`
  Pads the stringified value on the left.

* `slice(v, start, end)`
  String slice.

Filter chaining:

```ts
await render("{{ name | upper | slice:0,3 }}", { name: "charlotte" });
// "CHA"
```

Quoted args:

```ts
await render('{{ text | default:"No text" }}', {});
// "No text"

await render("{{ items | join:' | ' }}", { items: ["a", "b", "c"] });
// "a | b | c"
```

Common patterns:

```ts
await render("{{ raw | h }}", { raw: '<script>x</script>' });
// "&lt;script&gt;x&lt;/script&gt;"

await render("{{ when | if:yes,no }}", { when: true, yes: "Y", no: "N" });
// "Y"

await render("{{ id | padStart:6,0 }}", { id: 42 });
// "000042"
```

Arrays with `map` and `join`:

```ts
await render("{{ users | map:name | join:, }}", {
  users: [{ name: "Ada" }, { name: "Linus" }],
});
// "Ada, Linus"

await render("{{ people | map:getFull | join:'; ' }}", {
  people: [
    { first: "Ada", last: "L.", getFull() { return `${this.first} ${this.last}`; } },
    { first: "Alan", last: "T.", getFull() { return `${this.first} ${this.last}`; } },
  ],
});
// "Ada L.; Alan T."
```

Dates:

```ts
await render("{{ d | date:en-GB,short }}", { d: "2024-01-15T12:00:00Z" });
// e.g. "15/01/2024" (varies by runtime)
```

# Error handling

* Unknown filter throws `Error("Unknown filter: ...")`
* Rejected promises bubble up
* Use `try/catch` around `render` if you want to handle failures

```ts
try {
  await render("{{ value | nope }}", { value: 1 });
} catch (e) {
  // handle error
}
```

# Custom filters

Provide your own registry or extend the built-ins.

```ts
const myFilters: FilterMap = {
  ...filters,
  reverse: (s: unknown) => String(s).split("").reverse().join(""),
  plural: (n: unknown, word: string, pluralWord?: string) => {
    const k = Number(n);
    return `${k} ${k === 1 ? word : (pluralWord ?? word + "s")}`;
  },
  jsonPretty: (v: unknown, spaces="2") => JSON.stringify(v, null, Number(spaces)),
};

await render("{{ name | reverse }}", { name: "stressed" }, myFilters);
// "desserts"

await render("{{ count | plural:item,items }}", { count: 1 }, myFilters);
// "1 item"

await render("{{ obj | jsonPretty:4 }}", { obj: { a: 1 } }, myFilters);
// "{\n    \"a\": 1\n}"
```

# Streaming and concurrency

* `render` collects all literal and token promises and `await Promise.all`, allowing parallel resolution of independent async values
* `renderSeq` awaits each token in order, suitable for progressive streaming scenarios

```ts
await renderSeq("A={{ a }}, B={{ b }}", {
  a: Promise.resolve("first"),
  b: (async () => { await new Promise(r => setTimeout(r, 10)); return "second"; })(),
});
// "A=first, B=second"
```

# Recipes

Interpolation with defaults and escaping:

```ts
const tpl = `
<h1>{{ title | default:"Untitled" | h }}</h1>
<p>By {{ author | default:"Anonymous" | h }}</p>
`;
await render(tpl, { title: 'Alice & Bob', author: null });
// "<h1>Alice &amp; Bob</h1>\n<p>By Anonymous</p>\n"
```

Rendering a bullet list from objects:

```ts
const tpl = `- {{ items | map:name | join:'\n- ' }}`;
await render(tpl, { items: [{ name: "A" }, { name: "B" }, { name: "C" }] });
// "- A\n- B\n- C"
```

Formatting IDs and dates:

```ts
const tpl = "ID {{ id | padStart:8,0 }} created {{ ts | date:en-US,short }}";
await render(tpl, { id: 73, ts: new Date("2025-01-02") });
// "ID 00000073 created 1/2/25" (locale dependent)
```

Combining async methods and filters:

```ts
const tpl = "User: {{ user.getName | upper }}";
const ctx = { user: { async getName() { return "alice"; } } };
await render(tpl, ctx);
// "User: ALICE"
```

Mapping to nested properties and methods:

```ts
const tpl = "{{ rows | map:user.name | join:', ' }} / {{ rows | map:user.getTag | join:', ' }}";
const rows = [
  { user: { name: "Ada", getTag() { return `@${this.name.toLowerCase()}`; } } },
  { user: { name: "Bob", getTag() { return `@${this.name.toLowerCase()}`; } } },
];
await render(tpl, { rows });
// "Ada, Bob / @ada, @bob"
```

JSON embedding for debugging:

```ts
await render("ctx={{ ctx | json }}", { ctx: { a: 1, b: [2,3] } });
// 'ctx={"a":1,"b":[2,3]}'
```

Conditional fragments:

```ts
await render("{{ isAdmin | if:'[ADMIN] ','')}}{{ name }}", { isAdmin: true, name: "Lee" });
// "[ADMIN] Lee"
```

# Behavior notes and gotchas

* Intermediate function calls are not supported in paths. `{{ obj.method.result }}` will try to read a property named `result` from the function value, not call `method`. Only the final value is auto-called.
* Filter arguments are parsed with simple quote handling and do not support escape characters inside quotes. Prefer switching quote types if you need quotes inside a string.
* All filter arguments arrive as strings. Filters are responsible for coercion (`Number`, etc).
* `join:, ` without quotes is equivalent to default separator because the argument parser treats commas as separators. Quote separators that contain commas or spaces: `join:', '`.
* `date` relies on the host environment for locales and may vary by runtime. Use a custom filter if you need strict formatting.
* `h` escapes only a small set of characters. Use a sanitizer upstream if you process untrusted HTML.
* Missing values become empty strings. Use `default` to make this explicit in templates.
