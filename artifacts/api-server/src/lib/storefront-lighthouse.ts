import lighthouse from "lighthouse";
import {launch} from "chrome-launcher";
import {chromium,type Browser} from "playwright";
import type {StorefrontAccess} from "./storefront-access";

export async function storefrontLighthouse(url:string,access:StorefrontAccess){
  const chrome=await launch({chromePath:process.env.CHROMIUM_PATH||"/repl/tools/bin/chromium",
    chromeFlags:["--headless","--no-sandbox","--disable-dev-shm-usage"]});
  let browser:Browser|undefined;
  const deadline=setTimeout(()=>{void Promise.resolve().then(()=>chrome.kill()).catch(()=>{});},180000);
  try{
    browser=await chromium.connectOverCDP(`http://127.0.0.1:${chrome.port}`);
    // Install cookies in Chrome's origin-scoped jar. Global extra headers would
    // leak a Cookie header to third-party images/fonts and must never be used.
    await browser.contexts()[0].addCookies(access.cookies());
    const result=await lighthouse(url,{port:chrome.port,output:"html",logLevel:"silent",
      onlyCategories:["performance","seo","accessibility"],disableStorageReset:true});
    if(!result)throw new Error("Lighthouse returned no report.");
    return {data:result.lhr,html:Buffer.from(Array.isArray(result.report)?result.report[0]:result.report)};
  }finally{
    clearTimeout(deadline);
    await browser?.close().catch(()=>{});
    await Promise.resolve().then(()=>chrome.kill()).catch(()=>{});
  }
}
