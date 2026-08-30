import { MongoClient, type Collection } from "mongodb";

import { config } from "./config.js";
import type { CycleRecord, PieceRecord } from "./types.js";

interface ProductionCollections {
  cycles: Collection<CycleRecord>;
  pieces: Collection<PieceRecord>;
}

let client: MongoClient | null = null;
let collections: ProductionCollections | null = null;

export async function connectDatabase() {
  if (client) return;

  client = new MongoClient(config.mongodbUri);
  await client.connect();

  const db = client.db(config.mongodbDbName);
  collections = {
    cycles: db.collection<CycleRecord>("cycles"),
    pieces: db.collection<PieceRecord>("pieces"),
  };

  await collections.cycles.createIndex({ date: 1, endedAt: -1 });
  await collections.cycles.createIndex({ date: 1, shift: 1, endedAt: -1 });
  await collections.pieces.createIndex({ date: 1, ts: -1 });
  await collections.pieces.createIndex({ date: 1, shift: 1, ts: -1 });
}

export async function getCollections() {
  if (!collections) await connectDatabase();
  return collections!;
}

export async function closeDatabase() {
  if (client) {
    await client.close();
    client = null;
    collections = null;
  }
}
