import React from "react";
import {render,screen} from "@testing-library/react";
import {LanguageProvider} from "../language";
import Inventory from "./Inventory";

describe("Inventory",()=>{
  beforeEach(()=>{
    localStorage.setItem("colonize-mars-language","bg");
    sessionStorage.setItem("userId","1");
    sessionStorage.setItem("authToken","test-token");
    global.fetch=jest.fn(url=>Promise.resolve({
      ok:true,
      json:()=>Promise.resolve(String(url).includes("/inventory/")
        ? {resources:{Gold:0,Iron:0,Water:0,Solar:0},army:{},items:{attack:1},boosters:{universalForge:0}}
        : {gameProgress:{resources:{},army:{}}})
    }));
  });

  afterEach(()=>{
    localStorage.clear();
    sessionStorage.clear();
    jest.restoreAllMocks();
  });

  it("renders the market items tab without crashing",async()=>{
    render(<LanguageProvider><Inventory/></LanguageProvider>);
    expect(await screen.findByRole("button",{name:"Предмети от пазара"})).toBeTruthy();
  });
});
