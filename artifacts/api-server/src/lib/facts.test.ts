import {test} from "node:test";
import assert from "node:assert/strict";
import {cleanProductSpecs} from "./facts";
test("privacy tables are not treated as shoe specifications",()=>{
  const specs=cleanProductSpecs({Category:"Examples of personal information in this category",Identifiers:"Name, email address, billing address",
    "Geolocation data":"Approximate location derived from IP address","Financial information":"Payment information",
    "Commercial information":"Purchase history","Materials":"Cotton","Dimensions":"20 × 10 cm"});
  assert.deepEqual(specs,{Materials:"Cotton",Dimensions:"20 × 10 cm"});
});
