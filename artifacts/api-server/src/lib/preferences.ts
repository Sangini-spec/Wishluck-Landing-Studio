import {db,preferencesTable} from "@workspace/db";
import {eq} from "drizzle-orm";

export async function preference<T>(key:string):Promise<T|undefined>{
  const [row]=await db.select().from(preferencesTable).where(eq(preferencesTable.key,key));
  return row?.value as T|undefined;
}
export async function setPreference(key:string,value:unknown){
  await db.insert(preferencesTable).values({key,value}).onConflictDoUpdate({target:preferencesTable.key,set:{value}});
}
