import {test} from "node:test";
import assert from "node:assert/strict";
import {publicationCounts,publicationState,recordPublicationState,designUploadState} from "./publication-status";
import type {Publication,Design} from "./domain";

const receipt=(overrides:Partial<Publication>={}):Publication=>({
  id:"receipt",designId:"design",title:"Product",createdAt:"2026-11-11T10:00:00Z",
  shop:"example.myshopify.com",themeId:"123",status:"published",verified:true,
  remoteRole:"unpublished",livePublished:false,...overrides,
});
test("legacy upload success is not live publication; deleted roles override stale flags",()=>{
  assert.equal(publicationState(receipt()),"uploaded");
  assert.equal(publicationState(receipt({remoteRole:"live",livePublished:false})),"published");
  assert.equal(publicationState(receipt({remoteRole:"missing",livePublished:true,edited:true})),"deleted");
});
test("totals count distinct existing themes, excluding failed, unknown and deleted receipts",()=>{
  const active=receipt({remoteRole:"live",livePublished:true});
  assert.deepEqual(publicationCounts([
    active,{...active,id:"duplicate",themeId:"gid://shopify/OnlineStoreTheme/123"},
    receipt({themeId:"2"}),receipt({themeId:"3",edited:true}),
    receipt({themeId:"4",remoteRole:"missing",livePublished:true}),
    receipt({themeId:"5",status:"failed",verified:false}),
    receipt({themeId:"6",remoteRole:undefined}),
    receipt({themeId:undefined}),
  ]),{published:1,uploaded:2});
});
test("native unpublishing and deletion update detection timeline without permitting repeat upload",()=>{
  const p=receipt({remoteRole:"live",livePublished:true});
  recordPublicationState(p,"2026-11-11T11:00:00Z");
  p.remoteRole="unpublished";p.livePublished=false;recordPublicationState(p,"2026-11-11T12:00:00Z");
  p.remoteRole="missing";recordPublicationState(p,"2026-11-11T13:00:00Z");
  assert.equal(p.lifecycleStatus,"deleted");
  assert.equal(p.timeline!.at(-1)!.at,"2026-11-11T13:00:00Z");
  assert.equal(designUploadState({id:"design",status:"draft"} as Design,[p]).status,"uploaded");
  assert.deepEqual(publicationCounts([p]),{published:0,uploaded:0});
});
