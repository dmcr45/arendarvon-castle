// Behaviour checks for LOCK and UNLOCK (fixes 9-11) and the DRAWBRIDGE, driving the engine.
//   node doors_check.js
"use strict";
const create = require("../arendarvon-engine.js");

function play(title, setup, commands) {
    const game = create({ random: () => 1 });
    game.start();
    const bytes = game.snapshot();
    setup(bytes);
    game.restoreSnapshot(bytes);
    console.log("=== " + title);
    for (const c of commands) {
        const r = game.submit(c);
        console.log("> " + c + "\n  " + r.text.replace(/\n>$/, "").replace(/\n/g, " ").trim());
    }
}
const OBJ = (o, f) => 0x38 + 6 * o + f, CH = (c, f) => 0x581 + 6 * c + f, PAS = (p, f) => 0x5B9 + 4 * p + f;
const carryKeys = (b) => { b[OBJ(43, 0)] = 193; };
const at = (b, room, facing) => { b[CH(1, 2)] = room; b[9] = facing; };
const STATE = ["GAP", "OPEN", "CLOSED", "LOCKED", "NAILED", "BOLTED"];

play("UNLOCK on something that is not a door (the CURTAIN, passage 21)", (b) => { at(b, 53, 3); carryKeys(b); },
    ["UNLOCK CURTAIN"]);

play("UNLOCK a locked door, then look at it (door 4, CORRIDOR 20 -> GREAT HALL)", (b) => { at(b, 20, 2); carryKeys(b); b[CH(2, 2)] = 28; },
    ["EXAMINE DOOR", "UNLOCK DOOR", "EXAMINE DOOR", "OPEN DOOR"]);

play("LOCK an open door (door 5, SHORT CORRIDOR 24 -> COURTYARD)", (b) => { at(b, 24, 3); carryKeys(b); b[CH(2, 2)] = 28; },
    ["EXAMINE DOOR", "LOCK DOOR", "EXAMINE DOOR", "GO AHEAD"]);

play("LOCK then UNLOCK a NAILED door (door 34, LONG CORRIDOR 93 -> PRIVATE-ROOM)", (b) => { at(b, 93, 1); carryKeys(b); },
    ["EXAMINE DOOR", "GO AHEAD", "LOCK DOOR", "UNLOCK DOOR", "EXAMINE DOOR", "GO AHEAD"]);

play("Walking out over the DRAWBRIDGE from the start (GATEWAY 51, south = 117)", () => {},
    ["GO BACK"]);

// Which doors have a lock, and what state are they in at the start?
const g = create({}); const w = g.newWorldSnapshot();
const locked = [];
for (let p = 1; p <= 40; p++) if (w[PAS(p, 2)] & 8) locked.push(p + ":" + STATE[w[PAS(p, 3)]]);
console.log("=== Doors with a lock (passage:state at start): " + locked.join(" "));
