# epubdown: Project Overview

* epubdown is a small monorepo for turning EPUBs into Markdown and reading them in a browser.
* It consists of:

  * a core library for EPUB parsing, metadata, ToC, and HTML→Markdown
  * a React reader app that persists data in the browser
  * a lightweight SQLite-in-the-browser layer

# Tech & Tooling

* Package manager

  * pnpm `10.x` (repo pins `pnpm@10.0.0` in `packageManager`)
* Language

  * TypeScript everywhere, ESM modules (`"type": "module"`)
* Build & bundling

  * Vite (app and library mode)
  * Rollup Visualizer for bundle inspection (reader)
* Testing

  * Vitest
  * Node env tests and browser env tests (Playwright provider via shared config)
* Linting & formatting

  * Biome (`format`, `lint`, `check`), quote style set to double quotes, relaxed rules in tests (non-null assertions allowed)
* UI

  * React 19
  * Tailwind CSS 4 (beta) via `@tailwindcss/vite`
  * Wouter for routing, MobX for state
* EPUB plumbing

  * `jszip`, `jsdom`, `turndown` (custom xml branch)
* Browser storage

  * `wa-sqlite` wrapped by `@hayeah/sqlite-browser`

# Monorepo Layout

* Root

  * `package.json` with workspace-wide scripts (`dev`, `build`, `test`, `format`, `lint`, `check`)
  * `tsconfig.base.json` shared compiler options
  * `tsconfig.json` includes only `packages/*/src/**/*` and excludes tests for typechecking speed
  * `biome.json` shared lint/format config
  * `vitest.config.browser.shared.ts` shared browser-test config (Playwright, public `epubs` dir)
  * `.vscode/tasks.json` optional `vibe` template tasks
* packages

  * `packages/core` `@epubdown/core`

    * EPUB parsing, metadata, ToC, HTML→Markdown
    * CLIs under `src/cli` (see “CLI” below)
    * Node tests and browser tests
  * `packages/reader` `@epubdown/reader`

    * React app, routes, components, library UI, markdown rendering
    * Tailwind v4 setup, Vite + React plugin
  * `packages/sqlite-browser` `@hayeah/sqlite-browser`

    * Thin wrapper to run SQLite in the browser backed by IndexedDB
    * Built as an ES library

# Everyday Commands

* Format code
  * `pnpm format`  (Biome formatter)
* Lint code
  * `pnpm lint`    (Biome linter, auto-fixes when possible)
* Typecheck
  * `pnpm tsc`     (TypeScript type checking)
* Full check (lint + format + analyze)
  * `pnpm check`
* Per-package scripts

  * Core

    * `pnpm -C packages/core test`
    * `pnpm -C packages/core test:browser`
    * `pnpm -C packages/core check`
  * Reader

    * `pnpm -C packages/reader dev`
    * `pnpm -C packages/reader build`
    * `pnpm -C packages/reader preview`
    * `pnpm -C packages/reader test`
    * `pnpm -C packages/reader test:browser`
    * `pnpm -C packages/reader check`
  * SQLite-browser

    * `pnpm -C packages/sqlite-browser dev`   (library build watch)
    * `pnpm -C packages/sqlite-browser build`
    * `pnpm -C packages/sqlite-browser exec tsc --noEmit`   (typecheck)
    * `pnpm -C packages/sqlite-browser test:browser`
    * `pnpm -C packages/sqlite-browser check`

# Package: @epubdown/core

* Purpose

  * Read EPUB zips, parse OPF/NCX/Navigation, extract metadata, and convert chapter HTML to Markdown
* Key modules

  * `Epub.ts`  entry for EPUB reading orchestration
  * `TableOfContents.ts` ToC parsing across EPUB flavors
  * `Metadata.ts` metadata parsing
  * `ContentToMarkdown.ts` HTML→Markdown using `turndown` xml branch
  * `xmlParser.ts` JSDOM-based XML parsing utilities
  * `resolvers/*` swapping file/zip data sources
  * `utils/*` dumpers, shorteners, path normalization
* CLIs (TypeScript files under `src/cli`)

  * `anonymize-xml.ts` remove sensitive data in XML
  * `shorten-epub.ts` strip or shrink heavy assets
  * `dumpEpub.ts` inspect EPUB internals
  * `html2md.ts` convert HTML to Markdown
* Running CLIs during dev

  * Use `bun` to execute TS directly, for example:

    * `bun packages/core/src/cli/dumpEpub.ts --help`

# Package: @epubdown/reader

* Purpose

  * Browser reader app for library management and reading
* Highlights

  * React 19 + Tailwind 4, small router (Wouter), MobX stores
  * Markdown rendering via `react-markdown` + `remark-gfm` and custom components
  * App structure under `src/` with `book/`, `library/`, `markdown/`, `stores/`
  * Prototype pages under `prototype/` for fast iteration
* Dev server

  * `pnpm dev` or `pnpm -C packages/reader dev`
* Build

  * Library mode disabled for the app; normal Vite SPA build with multiple HTML inputs (main and prototype library)

# Package: @hayeah/sqlite-browser

* Purpose

  * Thin wrapper around `wa-sqlite` with IndexedDB persistence helpers
* Build

  * Vite library mode emitting ES module
* Tests

  * Browser tests including helpers to nuke IndexedDB between runs

# Testing Strategy

* Node environment

  * Logic and parsing tests run under `vitest` with `environment: "node"` in `packages/core/vitest.config.ts`
* Browser environment

  * DOM and storage tests run in headless Chromium via Vitest Browser + Playwright provider
  * Shared browser test config lives at the repo root: `vitest.config.browser.shared.ts`
  * Per-package browser config extends the shared one
* Test file patterns

  * Generic tests: `*.test.ts` or `*.test.tsx`
  * Browser-only tests: `*.test.browser.ts` or `*.test.browser.tsx`
  * Shared test content: `*.test.shared.ts` used by both node and browser suites
  * Benchmarks: `*.bench.ts`

# File Naming Conventions

* Source files

  * PascalCase for modules that primarily export a class or a composable component

    * Examples: `Epub.ts`, `TableOfContents.ts`, `ChapterNavigation.tsx`
  * lowerCamelCase for general-purpose utilities

    * Examples: `xmlParser.ts`, `normalizePath.ts`, `dateUtils.ts`
  * kebab-case for CLI entrypoints

    * Examples: `anonymize-xml.ts`, `shorten-epub.ts`, `dumpEpub.ts`
* Tests

  * Unit/integration tests: `Name.test.ts` or `Name.test.tsx`
  * Browser-only tests: `Name.test.browser.ts(x)`
  * Shared tests: `Name.test.shared.ts(x)` consumed by both environments
  * Benchmarks: `Name.bench.ts`
* Types and declarations

  * Ambient or module declarations: `name.d.ts`

* React components

  * Prefer one component per file with `PascalCase.tsx`
  * Co-locate component-specific styles or test files next to the component

* Paths and aliases

  * In `packages/reader/tsconfig.json`, imports to workspace packages are aliased to their `src` for DX

    * Use package names (`@epubdown/core`, `@hayeah/sqlite-browser`) in imports; they resolve to source during dev/tests
