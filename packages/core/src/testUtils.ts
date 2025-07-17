import fs from "node:fs";
import path from "node:path";
import { expect } from "vitest";

export function compareOrUpdateFixture<T>(fullPath: string, actual: T): void {
  const GEN_FIXTURE = process.env.GEN_FIXTURE === "true";
  // const fullPath = path.resolve(process.cwd(), fixturePath);

  if (GEN_FIXTURE) {
    fs.writeFileSync(fullPath, JSON.stringify(actual, null, 2));
    console.log(`Generated fixture: ${fullPath}`);
  } else {
    const expected = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
    expect(actual).toEqual(expected);
  }
}

export { fetchEpub } from "./testUtils/fetchEpub";
