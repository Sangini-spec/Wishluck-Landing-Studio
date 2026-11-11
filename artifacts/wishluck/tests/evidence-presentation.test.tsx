import {test} from "node:test";
import assert from "node:assert/strict";
import {renderToStaticMarkup} from "react-dom/server";
import type {Design,Publication} from "@workspace/api-client-react";
import {DetailDisclosure} from "../src/components/detail-disclosure";
import {ScoresPanel} from "../src/components/evidence-panels";
import {publicationDisplayStatus,uploadedThemeCount} from "../src/lib/publications";

const receipt=(override:Partial<Publication>={}):Publication=>({
  id:"receipt",designId:"design",title:"Product",createdAt:"2026-11-11T10:00:00Z",status:"published",
  themeId:"123",shop:"example.myshopify.com",remoteRole:"unpublished",livePublished:false,...override,
});
test("evidence disclosures start closed and preserve full evidence and source links",()=>{
  const html=renderToStaticMarkup(<DetailDisclosure label="Research details"><p>Complete source observation, not a shortened excerpt.</p><a href="https://reference.example/product">Original source</a></DetailDisclosure>);
  assert.match(html,/<details/);
  assert.doesNotMatch(html,/<details[^>]*\sopen(?:[ =>])/);
  assert.match(html,/Complete source observation, not a shortened excerpt\./);
  assert.match(html,/https:\/\/reference.example\/product/);
  assert.match(html,/<summary/);
});
test("percentage circles use actual returned SEO AEO GEO and overall scores",()=>{
  const html=renderToStaticMarkup(<ScoresPanel design={{scores:{overall:61,seo:78,aeo:80,geo:17}} as Design}/>);
  assert.equal((html.match(/role="meter"/g)??[]).length,4);
  for(const score of [61,78,80,17])assert.ok(html.includes(`>${score}%</span>`));
  assert.match(html,/Local check coverage/);
});
test("publication labels distinguish real live, legacy uploads, edits, failure and deletion",()=>{
  assert.equal(publicationDisplayStatus(receipt()),"uploaded");
  assert.equal(publicationDisplayStatus(receipt({remoteRole:"live",livePublished:true})),"published");
  assert.equal(publicationDisplayStatus(receipt({lifecycleStatus:"edited"})),"edited");
  assert.equal(publicationDisplayStatus(receipt({status:"failed",lifecycleStatus:"uploaded"})),"failed");
  assert.equal(publicationDisplayStatus(receipt({remoteRole:"missing",livePublished:true})),"deleted");
  assert.equal(publicationDisplayStatus(receipt({livePublished:true,lifecycleStatus:"published"})),"uploaded");
});
test("uploaded total excludes live, deleted and unknown themes and deduplicates receipts",()=>{
  assert.equal(uploadedThemeCount([
    receipt(),receipt({id:"duplicate",themeId:"gid://shopify/OnlineStoreTheme/123"}),
    receipt({themeId:"2",lifecycleStatus:"edited"}),
    receipt({themeId:"3",remoteRole:"live",livePublished:true}),
    receipt({themeId:"4",remoteRole:"missing"}),
    receipt({themeId:"5",remoteRole:undefined}),
  ]),2);
});
