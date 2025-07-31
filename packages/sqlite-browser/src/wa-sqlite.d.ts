declare module "wa-sqlite/src/examples/IDBBatchAtomicVFS.js" {
  export class IDBBatchAtomicVFS {
    constructor(name?: string);
    static create(
      name: string,
      module: any,
      options?: any,
    ): Promise<IDBBatchAtomicVFS>;
  }
}

declare module "wa-sqlite/dist/wa-sqlite-async.wasm?url" {
  const url: string;
  export default url;
}

declare module "wa-sqlite" {
  export type SQLiteCompatibleType =
    | number
    | string
    | Uint8Array
    | Array<number>
    | bigint
    | null;
}
