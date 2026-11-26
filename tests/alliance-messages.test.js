const assert=require("node:assert/strict");
const {test}=require("node:test");
const {mkdtempSync,rmSync}=require("node:fs");
const {tmpdir}=require("node:os");
const {join}=require("node:path");
const {spawnSync}=require("node:child_process");
const SQLite=require("better-sqlite3");

const work=mkdtempSync(join(tmpdir(),"cm118-"));
process.env.DATABASE_PATH=join(work,"game.sqlite");
const Game=require("../database/database");

test("alliance broadcasts are shared, isolated and acknowledged persistently per recipient",()=>{
  const game=new Game(),db=new SQLite(process.env.DATABASE_PATH);
  const clock=Date.now;
  let now=clock();
  Date.now=()=>now;
  try{
    const register=name=>game.createUser(name+"@private.example",name,"fixture").userId;
    const leader=register("RadioLeader"),member=register("Listener"),officer=register("Officer"),outsider=register("Outsider"),unaffiliated=register("Unaffiliated");
    assert.equal(game.createAlliance(leader,"Radio Alliance").error,undefined);
    assert.equal(game.createAlliance(outsider,"Other Alliance").error,undefined);
    const alliance=db.prepare("SELECT id FROM alliances WHERE leader_id=?").get(leader).id;
    const join=db.prepare("INSERT INTO alliance_members(user_id,alliance_id,role) VALUES (?,?,?)");
    join.run(member,alliance,"Member");
    join.run(officer,alliance,"Co-Leader");
    assert.match(game.sendMessage(member,"broadcast",null,"no permission").error,/leader or co-leader/);
    assert.match(game.sendMessage(outsider,"broadcast",null,"nobody").error,/no other members/);
    assert.match(game.listMessages(unaffiliated,"alliance").error,/Join an alliance/);

    // Same-text, same-time private copies have no historical alliance ID and stay private.
    const insert=db.prepare("INSERT INTO player_messages(sender_id,recipient_id,alliance_id,body,sent_at,message_type) VALUES (?,?,?,?,?,?)");
    insert.run(leader,member,null,"Historical identical text",now-10000,"private");
    insert.run(leader,officer,null,"Historical identical text",now-10000,"private");
    insert.run(leader,member,null,"Old trade",now-9000,"trade");
    insert.run(leader,null,alliance,"Already scoped history",now-8000,"alliance");
    assert.deepEqual(game.listMessages(member,"private").messages.map(m=>m.body),["Historical identical text"]);
    assert.deepEqual(game.listMessages(member,"trade").messages.map(m=>m.body),["Old trade"]);
    assert.deepEqual(game.listMessages(member,"alliance").messages.map(m=>m.body),["Already scoped history"]);
    assert.deepEqual(game.listPlayerNotifications(member).allianceUnreadIds,[]);

    assert.match(game.sendMessage(leader,"broadcast",null,"First shared notice").message,/2 members/);
    const first=game.listMessages(member,"alliance").messages[0];
    const other=game.listMessages(officer,"alliance").messages[0];
    assert.equal(first.sender,"RadioLeader");
    assert.equal(first.sentAt,now);
    assert.equal(first.id,other.id);
    assert.notEqual(first.unreadId,other.unreadId);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM player_messages WHERE body='First shared notice' AND recipient_id IS NULL").get().n,1);
    assert.deepEqual(game.listMessages(outsider,"alliance").messages,[]);
    assert.deepEqual(game.listPlayerNotifications(member),{notifications:[],allianceUnreadIds:[first.unreadId]});
    assert.equal(game.acknowledgeAllianceMessages(outsider,[first.unreadId]).success,true);
    assert.deepEqual(game.listPlayerNotifications(member).allianceUnreadIds,[first.unreadId]);

    // The reader opens the first notice just as the co-leader sends a second one.
    now+=2000;
    assert.match(game.sendMessage(officer,"broadcast",null,"New since open").message,/2 members/);
    const next=game.listMessages(member,"alliance").messages[0].unreadId;
    assert.equal(game.acknowledgeAllianceMessages(member,[first.unreadId,first.unreadId]).success,true);
    assert.deepEqual(game.listPlayerNotifications(member).allianceUnreadIds,[next]);
    const receipt=db.prepare("SELECT read_at FROM alliance_message_receipts WHERE id=?");
    const readAt=receipt.get(first.unreadId).read_at;
    now+=2000;
    assert.equal(game.acknowledgeAllianceMessages(member,[first.unreadId]).success,true);
    assert.equal(receipt.get(first.unreadId).read_at,readAt);
    assert.deepEqual(game.listPlayerNotifications(officer).allianceUnreadIds,[other.unreadId]);
    assert.deepEqual(game.listMessages(member,"private").messages.map(m=>m.body),["Historical identical text"]);
    assert.deepEqual(game.listMessages(member,"trade").messages.map(m=>m.body),["Old trade"]);

    const restarted=spawnSync(process.execPath,["-e",`
      const assert=require("node:assert/strict");
      const Game=require("./database/database");
      const game=new Game();
      assert.deepEqual(game.listPlayerNotifications(${member}).allianceUnreadIds,[${next}]);
      assert.equal(game.listMessages(${member},"alliance").messages.find(m=>m.id===${first.id}).unreadId,null);
      game.close();
    `],{env:process.env,encoding:"utf8"});
    assert.equal(restarted.status,0,restarted.stderr);
    assert.equal(db.pragma("integrity_check",{simple:true}),"ok");
  }finally{
    Date.now=clock;
    db.close();
    game.close();
    rmSync(work,{recursive:true,force:true});
  }
});
