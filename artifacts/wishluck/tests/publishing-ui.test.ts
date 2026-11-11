import {test} from "node:test";
import assert from "node:assert/strict";
import {historyPreferences,readyPublication,uploadPhase} from "../src/lib/publishing-ui";
import type {Publication,PublishingJob} from "@workspace/api-client-react";

const pending={id:"upload-1",designId:"design-1",shop:"store-a.myshopify.com"};
const publication:Publication={id:"publication-1",jobId:"upload-1",designId:"design-1",shop:pending.shop,title:"Product",status:"published",verified:true,createdAt:"2026-11-11T00:00:00Z",editorUrl:"https://store-a.myshopify.com/admin/themes/123/editor"};
const job:PublishingJob={id:"upload-1",publicationId:publication.id,designId:"design-1",shop:pending.shop,kind:"upload",phase:"completed",status:"completed",contentHash:"fixture",createdAt:publication.createdAt,updatedAt:publication.createdAt};

test("Only the matching verified upload can navigate to the editor",()=>{
  assert.equal(readyPublication(pending,[publication],[job]),publication);
  for(const change of [{verified:false},{status:"uploading"},{editorUrl:undefined},{shop:"store-b.myshopify.com"},{designId:"another-design"},{id:"unrelated",jobId:"unrelated"}]){
    assert.equal(readyPublication(pending,[{...publication,...change}],[job]),undefined);
  }
  assert.equal(readyPublication({...pending,id:undefined},[publication],[job]),undefined);
});
test("A completed job can resolve its persisted publication even without a receipt jobId",()=>{
  const recovered={...publication,jobId:undefined};
  assert.equal(readyPublication(pending,[recovered],[job]),recovered);
  assert.equal(readyPublication(pending,[recovered],[{...job,shop:"store-b.myshopify.com"}]),undefined);
});
test("History preferences safely restore hide/show without deleting receipts",()=>{
  assert.deepEqual(historyPreferences(null),{collapsed:false,hidden:[]});
  assert.deepEqual(historyPreferences("{broken"),{collapsed:false,hidden:[]});
  const hidden={collapsed:true,hidden:["publication:one","job:two"]};
  assert.deepEqual(historyPreferences(JSON.stringify(hidden)),hidden);
  assert.deepEqual(historyPreferences('{"collapsed":"yes","hidden":[3,"publication:one",null]}'),{collapsed:false,hidden:["publication:one"]});
});
test("Upload progress describes real phases without invented completion percentages",()=>{
  assert.equal(uploadPhase("creating"),"Uploading your theme");
  assert.equal(uploadPhase("verifying"),"Verifying uploaded files");
  assert.equal(uploadPhase("completed"),"Preparing the theme editor");
  assert.equal(uploadPhase("unknown"),"Preparing your Shopify preview");
});
