// Everything a map of the castle needs, read from the engine's own data tables
// plus a frozen room layout. Emits one JSON object on stdout.
//   node mapmodel.js ../arendarvon-engine.js layout.json > model.json
"use strict";
const fs = require("fs");
const src = fs.readFileSync(process.argv[2], "utf8");
const layout = JSON.parse(fs.readFileSync(process.argv[3], "utf8").replace(/^﻿/, ""));

// ---- descriptions, so a name number becomes a name
const DESC = [];
{
    const block = /const DESCRIPTIONS = \[([\s\S]*?)\n\];/.exec(src)[1];
    for (const m of block.matchAll(/"([^"]*)"/g)) DESC.push(m[1]);
}
const name = (v) => (typeof v === "number" ? (DESC[v] || "?" + v) : v.replace(/^"|"$/g, ""));

// ---- the four tables
const rooms = [null], objects = [null], characters = [null], passages = [null];
const num = (s) => { s = s.trim(); const m = /via\((\d+)\)/.exec(s); return m ? { passage: +m[1] } : { room: +s || 0 }; };
for (const m of src.matchAll(/roomRow\(\s*"([^"]+)",\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*(\d+),\s*(\w+),\s*(\w+),\s*(\w+),\s*(\d+),\s*(\d+)\)/g))
    rooms.push({ n: rooms.length, name: m[1], exits: { N: num(m[2]), E: num(m[3]), S: num(m[4]), W: num(m[5]) },
                 flags: m[6].trim(), ns: +m[7], owner: m[8], article: m[9], at: m[10], ew: +m[11], level: +m[12] });
for (const m of src.matchAll(/objectRow\(\s*"([^"]+)",\s*([^,]+),\s*([^,]+),\s*((?:"[^"]*"|[^,]+)),\s*(\d+),\s*([^)]+)\)/g))
    objects.push({ n: objects.length, name: m[1], where: m[2].trim(), flags: m[3].trim(), alt: m[4].trim(), weight: +m[5], flags2: m[6].trim() });
for (const m of src.matchAll(/characterRow\(\s*"([^"]+)",\s*(\d+),\s*(\d+),\s*([^,]+),\s*(\d+),\s*([^)]+)\)/g))
    characters.push({ n: characters.length, name: m[1], strength: +m[2], room: +m[3], mood: m[4].trim(), magic: +m[5] });
for (const m of src.matchAll(/passageRow\(\s*"([^"]+)",\s*between\((\d+),\s*(\d+)\),\s*([^,]+),\s*(\w+)\)/g))
    passages.push({ n: passages.length, name: m[1], a: +m[2], b: +m[3], flags: m[4].trim(), state: m[5] });

// ---- where each object starts: a room, inside another object, or held
for (const o of objects.slice(1)) {
    const w = o.where;
    let m;
    if (w === "NOWHERE") o.start = { kind: "nowhere" };
    else if ((m = /^inside\((\d+)\)$/.exec(w))) o.start = { kind: "inside", object: +m[1] };
    else if ((m = /^heldBy\((\w+)\)$/.exec(w))) o.start = { kind: "held", who: m[1] };
    else if (/^\d+$/.test(w)) o.start = { kind: "room", room: +w };
    else o.start = { kind: "?", raw: w };
}
const CHAR_N = { PLAYER: 1, CUSTODIAN: 2, GIRL: 3, GATEKEEPER: 4, PRIEST: 5, EAGLE: 6, SECOND_WIZARD: 7, WIZARD: 8, RAT: 9 };
for (const o of objects.slice(1)) if (o.start.kind === "held") o.start.character = CHAR_N[o.start.who];

// the room an object ends up visible in, following containers and carriers
function roomOf(o, seen) {
    seen = seen || new Set();
    if (seen.has(o.n)) return null;
    seen.add(o.n);
    const s = o.start;
    if (s.kind === "room") return s.room;
    if (s.kind === "inside") return roomOf(objects[s.object], seen);
    if (s.kind === "held") return s.character === 1 ? "carried" : characters[s.character].room;
    return null;
}
for (const o of objects.slice(1)) o.room = roomOf(o);

// ---- the wall each passage sits in, from the layout
const pos = layout.pos;
for (const p of passages.slice(1)) {
    const A = rooms[p.a], B = rooms[p.b], a = pos[p.a], b = pos[p.b];
    p.wall = null;
    if (!a || !b) continue;
    for (const d of ["N", "E", "S", "W"]) {
        const e = A.exits[d];
        if (!e || e.passage !== p.n) continue;
        if (d === "N" || d === "S") {
            const y = d === "N" ? a.y : a.y + A.ns;
            const x0 = Math.max(a.x, b.x), x1 = Math.min(a.x + A.ew, b.x + B.ew);
            if (x1 > x0) p.wall = { horizontal: true, x: (x0 + x1) / 2, y };
        } else {
            const x = d === "W" ? a.x : a.x + A.ew;
            const y0 = Math.max(a.y, b.y), y1 = Math.min(a.y + A.ns, b.y + B.ns);
            if (y1 > y0) p.wall = { horizontal: false, x, y: (y0 + y1) / 2 };
        }
        break;
    }
}
// ---- plain openings (exits with no passage), as wall segments
const openings = [];
const seenPair = new Set();
for (const r of rooms.slice(1)) for (const d of ["N", "E", "S", "W"]) {
    const e = r.exits[d];
    if (!e || !e.room || e.passage) continue;
    const s = rooms[e.room];
    const key = Math.min(r.n, s.n) + "-" + Math.max(r.n, s.n);
    if (seenPair.has(key)) continue;
    const a = pos[r.n], b = pos[s.n];
    if (!a || !b) continue;
    const back = s.exits[{ N: "S", S: "N", E: "W", W: "E" }[d]];
    const twoWay = !!(back && back.room === r.n);
    let wall = null;
    if (d === "N" || d === "S") {
        const y = d === "N" ? a.y : a.y + r.ns;
        const x0 = Math.max(a.x, b.x), x1 = Math.min(a.x + r.ew, b.x + s.ew);
        if (x1 > x0 && (d === "N" ? b.y + s.ns === a.y : b.y === a.y + r.ns)) wall = { horizontal: true, x: (x0 + x1) / 2, y };
    } else {
        const x = d === "W" ? a.x : a.x + r.ew;
        const y0 = Math.max(a.y, b.y), y1 = Math.min(a.y + r.ns, b.y + s.ns);
        if (y1 > y0 && (d === "W" ? b.x + s.ew === a.x : b.x === a.x + r.ew)) wall = { horizontal: false, x, y: (y0 + y1) / 2 };
    }
    seenPair.add(key);
    openings.push({ from: r.n, to: s.n, dir: d, twoWay, wall, sameLevel: r.level === s.level });
}
process.stdout.write(JSON.stringify({ rooms, objects, characters, passages, openings, layout }, null, 0));
