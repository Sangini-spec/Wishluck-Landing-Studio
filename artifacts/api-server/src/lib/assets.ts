import { randomUUID } from "node:crypto";
import { db, artifactsTable } from "@workspace/db";
import { objectStorageClient } from "./objectStorage";

export async function saveArtifact(runId: string, sourceUrl: string, bytes: Buffer | string, contentType: string) {
  const id = randomUUID();
  const base = process.env.PRIVATE_OBJECT_DIR;
  if (!base) throw new Error("App Storage is not configured.");
  const path = `${base.replace(/^\//,"")}/research/${id}`;
  const slash = path.indexOf("/");
  await objectStorageClient.bucket(path.slice(0,slash)).file(path.slice(slash+1)).save(bytes, { contentType, resumable: false });
  await db.insert(artifactsTable).values({ id, runId, sourceUrl, objectPath: path, contentType });
  return `/api/evidence/${id}`;
}
