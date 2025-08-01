import type { SQLiteDB } from "@hayeah/sqlite-browser";
import { nukeAllIndexedDBDatabases } from "@hayeah/sqlite-browser/test";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/App";
import { getDb } from "../src/lib/DatabaseProvider";
import { RootStore, StoreProvider } from "../src/stores/RootStore";

describe("Debug App Rendering", () => {
  let rootStore: RootStore;
  let db: SQLiteDB;

  beforeEach(async () => {
    await nukeAllIndexedDBDatabases();
    db = await getDb(`test-${Date.now()}`);
    rootStore = await RootStore.create(db);
  });

  afterEach(async () => {
    await rootStore.close();
  });

  it("should render without error", async () => {
    const { container } = render(
      <StoreProvider value={rootStore}>
        <App />
      </StoreProvider>,
    );

    // Should render something
    expect(container.innerHTML).not.toBe("");

    // Wait for library to load
    await waitFor(() => {
      expect(screen.getByText("My Library")).toBeInTheDocument();
    });
  });
});
