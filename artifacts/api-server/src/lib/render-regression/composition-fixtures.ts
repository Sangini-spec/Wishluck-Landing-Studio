import type {CreativePlan} from "../composition-plan";

export const creativePlanFixture=():CreativePlan=>({
  name:"Evidence-led page",rationale:"Source-led product inspection.",typography:"editorial",imageTreatment:"framed",headingSize:62,sectionSpacing:72,
  composition:{
    hero:{layout:"split",mediaSide:"left",mediaShare:55,imageRatio:"square",imageCount:1,surface:"paper",alignment:"start",contentWidth:"balanced"},
    sections:[
      {kind:"story",layout:"split",surface:"paper",headingPlacement:"beside",columns:2,width:"contained",spacing:72,title:"The making"},
      {kind:"benefits",layout:"grid",surface:"muted",headingPlacement:"above",columns:3,width:"contained",spacing:64,title:"Considered details"},
      {kind:"faq",layout:"stack",surface:"paper",headingPlacement:"above",columns:1,width:"narrow",spacing:48,title:"Before choosing"},
    ],
  },
});
