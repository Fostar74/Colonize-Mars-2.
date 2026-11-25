import React from "react";
import {render,screen} from "@testing-library/react";
import {LanguageProvider} from "../language";
import SideQuests from "./SideQuests";

test.each([
  ["en","Steel Precision","Locked","Claim reward"],
  ["bg","Стоманена прецизност","Заключена","Вземи наградата"],
])("displays active and locked quests in %s",async(language,title,locked,claim)=>{
  const oldFetch=global.fetch;
  localStorage.setItem("colonize-mars-language",language);
  sessionStorage.setItem("userId","7");
  global.fetch=jest.fn().mockResolvedValue({ok:true,json:async()=>({missions:[
    {id:1,title:{en:"Steel Precision",bg:"Стоманена прецизност"},kind:"train",target:50,detail:"Railgunner",
      progress:50,status:"complete",rewards:[["army","Railgunner",50]]},
    {id:2,status:"locked"}
  ]})});
  try{
    render(<LanguageProvider><SideQuests/></LanguageProvider>);
    expect(await screen.findByText(title)).toBeTruthy();
    expect(screen.getByText(locked)).toBeTruthy();
    expect(screen.getByRole("button",{name:claim})).toBeTruthy();
  }finally{
    global.fetch=oldFetch;
    localStorage.clear();
    sessionStorage.clear();
  }
});
