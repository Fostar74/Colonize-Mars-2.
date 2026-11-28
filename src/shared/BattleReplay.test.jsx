import React from "react";
import {fireEvent,render,screen} from "@testing-library/react";
import {LanguageProvider} from "../language";
import BattleReplay from "./BattleReplay";
import BattleKnights from "./BattleKnights";

test.each([
  ["en","Show round analysis","Round replay was not recorded for this battle.","Empty"],
  ["bg","Покажи анализа на рунда","За тази битка няма запис по рундове.","Празен слот"],
])("shows exactly two four-by-seven formations and honest missing data in %s", (language, analysis, missing, empty) => {
  localStorage.setItem("colonize-mars-language",language);
  const group={id:0,unit:"Explorer Trooper",row:1,column:2,count:100,contingentId:null};
  const round={round:1,start:[[group],[group]],losses:[{0:3},{}],protocols:[[],[]],events:[]};
  const {container}=render(<LanguageProvider>
    <BattleReplay result={{traceVersion:1,report:[round]}} />
    <BattleReplay result={{report:[]}} />
    <BattleKnights knights={{attacker:{kind:"cyber",level:1,equipped:{}}}} />
  </LanguageProvider>);
  expect(Array.from(container.querySelectorAll(".battle-replay-grid")).map(grid=>grid.children.length)).toEqual([28,28]);
  expect(container.querySelector(".battle-replay-loss").textContent).toBe(" (−3)");
  expect(screen.getByText(missing)).toBeTruthy();
  expect(screen.getAllByText(empty)).toHaveLength(6);
  fireEvent.click(screen.getByRole("button",{name:analysis}));
  expect(screen.getByRole("list")).toBeTruthy();
});
