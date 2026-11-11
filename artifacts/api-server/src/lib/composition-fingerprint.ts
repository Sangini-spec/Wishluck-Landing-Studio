import type {VisualPlan} from "./design-plan";
import type {Composition} from "./composition-plan";

type FP=Record<string,unknown>;
const number=(v:unknown,fallback:number)=>typeof v==="number"?v:fallback;
export function composedFingerprint(plan:VisualPlan){
  const composition=plan.composition!;
  return {schemaVersion:3,hero:{...composition.hero},nodes:composition.sections.map(({title:_,...node})=>node),
    sectionOrder:["hero",...composition.sections.map(s=>s.kind)],imageTreatment:plan.imageTreatment,
    typeTreatment:plan.typography,headingSize:plan.headingSize??64,sectionSpacing:plan.sectionSpacing??72};
}
function projected(fp:FP){
  if(fp.schemaVersion===3)return fp;
  const family=String(fp.designFamily??fp.family??"atelier");
  const layout:Composition["hero"]["layout"]=["gallery","panorama","catalogue"].includes(family)?"stack":family==="kinetic"?"showcase":family==="journal"?"offset":"split";
  const surface=fp.colorStrategy==="ink"?"ink":fp.colorStrategy==="brand"?"brand":"paper";
  const sections=(fp.sectionOrder??["hero","story","faq"]) as string[];
  const sectionLayout=fp.detailLayout==="split"?"split":fp.detailLayout==="tiles"||fp.detailLayout==="bento"?"grid":"stack";
  return {hero:{layout,mediaSide:family==="atelier"?"right":"left",mediaShare:55,imageRatio:"square",imageCount:fp.imageTreatment==="collage"?3:1,surface,alignment:fp.alignment??"start",contentWidth:"balanced"},
    nodes:sections.filter(k=>k!=="hero").map((kind,i)=>{
      const position=i+1;
      const sectionSurface=kind==="purchase"?(surface==="ink"?"paper":"ink")
        :fp.colorStrategy==="contrast"?(position%2?"paper":"ink")
        :surface==="brand"?(fp.contentRhythm==="alternating"&&position%2?"brand":"paper")
        :surface==="ink"?"ink":fp.contentRhythm==="alternating"&&position%2===0?"muted":"paper";
      return {kind,layout:sectionLayout,surface:sectionSurface,headingPlacement:["dossier","panorama"].includes(family)?"beside":"above",columns:2,width:"contained",spacing:fp.contentRhythm==="dense"?40:72};
    }),
    sectionOrder:sections,imageTreatment:fp.imageTreatment??"cutout",typeTreatment:fp.typeTreatment??"display",headingSize:fp.heroScale==="monumental"?80:fp.heroScale==="compact"?48:64,sectionSpacing:fp.contentRhythm==="dense"?40:72};
}
function near(a:unknown,b:unknown,span:number){return Math.max(0,1-Math.abs(number(a,0)-number(b,0))/span);}
function nodeSimilarity(a:FP,b:FP){
  let score=0;
  const weights={layout:.25,surface:.15,headingPlacement:.2,columns:.15,width:.15};
  for(const [key,weight]of Object.entries(weights))if(a[key]===b[key])score+=weight;
  return score+near(a.spacing,b.spacing,76)*.1;
}
export function compositionSimilarity(left:FP,right:FP){
  const a=projected(left),b=projected(right),ah=a.hero as FP,bh=b.hero as FP;
  let hero=0;
  const weights={layout:.3,mediaSide:.12,imageRatio:.12,surface:.12,alignment:.08,contentWidth:.08};
  for(const[key,weight]of Object.entries(weights))if(ah[key]===bh[key])hero+=weight;
  hero+=near(ah.mediaShare,bh.mediaShare,35)*.1+near(ah.imageCount,bh.imageCount,3)*.08;
  const an=a.nodes as FP[],bn=b.nodes as FP[];
  let nodes=0;
  for(const node of an){
    const other=bn.find(n=>n.kind===node.kind);
    if(other)nodes+=nodeSimilarity(node,other);
  }
  nodes/=Math.max(an.length,bn.length,1);
  let samePositions=0;
  an.forEach((node,i)=>{if(node.kind===bn[i]?.kind)samePositions++;});
  const order=samePositions/Math.max(an.length,bn.length,1);
  const type=(a.typeTreatment===b.typeTreatment?1:0)*.4+(a.imageTreatment===b.imageTreatment?1:0)*.3+near(a.headingSize,b.headingSize,50)*.2+near(a.sectionSpacing,b.sectionSpacing,88)*.1;
  return Math.min(1,hero*.4+nodes*.4+order*.1+type*.1);
}
