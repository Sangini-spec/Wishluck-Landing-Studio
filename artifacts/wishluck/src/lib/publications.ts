import type { Publication } from "@workspace/api-client-react";

/** The legacy receipt status "published" meant upload, not live activation. */
export function publicationDisplayStatus(p: Publication) {
  if(p.remoteRole==="missing"||p.status==="deleted")return "deleted";
  if(["live","main"].includes(p.remoteRole??"")||(!p.remoteRole&&p.livePublished===true))return "published";
  if(["failed","uploading","uploaded","edited"].includes(p.status))return p.status;
  if(p.lifecycleStatus&&p.lifecycleStatus!=="published")return p.lifecycleStatus;
  return p.status==="published"?"uploaded":p.status;
}

export function uploadedThemeCount(publications: Publication[]) {
  return new Set(publications.filter(p => p.shop && p.themeId && p.remoteRole && p.remoteRole!=="missing" &&
    ["uploaded","edited"].includes(publicationDisplayStatus(p)))
    .map(p=>`${p.shop!.toLowerCase()}:${p.themeId!.split("/").at(-1)}`)).size;
}
