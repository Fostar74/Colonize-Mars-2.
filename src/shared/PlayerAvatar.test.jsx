import React from "react";
import {fireEvent,render} from "@testing-library/react";
import PlayerAvatar from "./PlayerAvatar";
import commanderArt from "../images/orange-empire-base.png";
import emperorArt from "../images/orange-empire-emperor.png";

test("custom images use a versioned URL and fall back when removed or unavailable",()=>{
  const player={id:7,avatarId:"engineer-f",avatarVersion:"a".repeat(64)};
  const {container,rerender}=render(<PlayerAvatar player={player} />);
  const image=container.querySelector("img");
  expect(image.src).toMatch(new RegExp("/player-avatars/7/"+player.avatarVersion+"\\.webp$"));
  fireEvent.error(image);
  expect(container.textContent).toBe("👩‍🔧");
  rerender(<PlayerAvatar player={{...player,avatarVersion:"b".repeat(64)}} />);
  expect(container.querySelector("img")).not.toBeNull();
  rerender(<PlayerAvatar player={{...player,avatarVersion:null}} />);
  expect(container.textContent).toBe("👩‍🔧");
});

test("missing NPC portraits use artwork for the commander and Emperor",()=>{
  const {container,rerender}=render(<PlayerAvatar player={{npc:true,commanderId:1}} />);
  expect(container.querySelector("img").getAttribute("src")).toBe(commanderArt);
  rerender(<PlayerAvatar player={{npc:true,commanderId:10,emperor:true}} />);
  expect(container.querySelector("img").getAttribute("src")).toBe(emperorArt);
});
