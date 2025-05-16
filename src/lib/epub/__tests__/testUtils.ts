import fs from 'fs';
import path from 'path';
import { expect } from '@jest/globals';

export function compareOrUpdateFixture<T>(fixturePath: string, actual: T): void {
  const GEN_FIXTURE = process.env.GEN_FIXTURE === 'true';
  const fullPath = path.resolve(process.cwd(), fixturePath);

  if (GEN_FIXTURE) {
    fs.writeFileSync(fullPath, JSON.stringify(actual, null, 2));
    console.log(`Generated fixture: ${fixturePath}`);
  } else {
    const expected = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
    expect(actual).toEqual(expected);
  }
}
