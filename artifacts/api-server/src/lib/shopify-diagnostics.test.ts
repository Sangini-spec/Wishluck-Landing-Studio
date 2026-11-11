import {test} from "node:test";
import assert from "node:assert/strict";
import {redactShopifyResponse} from "./shopify-diagnostics";

test("Shopify diagnostics retain errors and codes but strip credentials and staged upload credentials",()=>{
  const raw={data:{currentAppInstallation:{app:{apiKey:"fixture-client"}}},errors:[{message:"Denied fixture-token",extensions:{code:"ACCESS_DENIED"}}],
    stagedTargets:[{url:"https://storage.googleapis.com/private?Signature=fixture-signature",resourceUrl:"https://private/resource",parameters:[{name:"policy",value:"fixture-policy"}]}]};
  const safe=redactShopifyResponse(raw,["fixture-token"]);
  assert.equal(safe.errors[0].extensions.code,"ACCESS_DENIED");
  assert.equal(safe.data.currentAppInstallation.app.apiKey,"[REDACTED]");
  assert.equal(safe.stagedTargets[0].parameters,"[REDACTED]");
  assert.equal(safe.stagedTargets[0].resourceUrl,"[REDACTED]");
  const json=JSON.stringify(safe);
  for(const credential of ["fixture-client","fixture-token","fixture-signature","fixture-policy"])assert.ok(!json.includes(credential));
});
