// Prints the approved fixes (patches.js) as a bytecode listing: every original
// instruction changed in place (before and after) and every routine added in unused space.
//   node list-fixes.js > fixes_bytecode_listing.txt
"use strict";
const fs = require("fs");
const path = require("path");
const dir = fs.existsSync(path.join(__dirname, "patches.js")) ? __dirname : path.join(__dirname, "../test");
const Patches = require(path.join(dir, "patches.js"));
const Ref = require(path.join(dir, "bbcref.js"));
const messages = require(path.join(dir, "messages.js"));
const ssd = /"([A-Za-z0-9+\/=]{1000,})"/.exec(fs.readFileSync(path.join(dir, "ssd-data.js"), "utf8"))[1];
const image = Ref.readDfs(Ref.b64ToBytes(ssd))["$.ALADIN"];
const BASE = 0x21C7 - 0x1900;
for (const n of Object.keys(Patches.READABLE)) messages[Number(n)] = Patches.READABLE[n];

const hex2 = (n) => n.toString(16).toUpperCase().padStart(2, "0");
const hex4 = (n) => n.toString(16).padStart(4, "0");
const LEN = (op) => (op === 0xC4 ? 3 : (op & 0xF0) === 0x80 ? 2 : (op & 0xC0) === 0x40 ? 5 : (op & 0xC0) === 0x00 ? 7 : 6);
const GLOBALS = { 1: "object1", 2: "object2", 3: "result", 4: "passage", 5: "character", 6: "here", 7: "invisibleTurns",
    8: "targetRoom", 9: "facing", 10: "gameFlags", 11: "dir", 12: "counter", 14: "verb", 27: "articleRoom" };
const TABLES = { 1: ["objects", ["location", "name", "flags", "alt", "weight", "flags2"]],
    2: ["rooms", ["name", "exits[1]", "exits[2]", "exits[3]", "exits[4]", "flags", "owner", "textFlags", "level"]],
    3: ["characters", ["name", "strength", "location", "mood", "magic", "dead"]],
    4: ["passages", ["name", "roomSum", "flags", "state"]], 5: ["verbs", ["name", "needs"]] };

function operand(desc, idx, indirect) {
    if (desc === 0) return String(idx);
    const table = desc >> 5, field = desc & 31;
    if (table === 0) return idx === 1 ? (GLOBALS[field] || "g" + field) : idx === 2 ? "slot$" + field : "G[" + idx + "]." + field;
    const [name, fields] = TABLES[table];
    return name + "[" + (indirect ? (GLOBALS[idx] || "g" + idx) : idx) + "]." + (fields[field] || field);
}
function text(b) {
    const op = b[0];
    if (op === 0xC4) return "GOTO @" + hex4(b[1] | (b[2] << 8));
    if ((op & 0xF0) === 0x80) { const m = ((op & 15) << 8) | b[1]; return "PRINT msg" + m + "  " + JSON.stringify(messages[m]); }
    if ((op & 0xC0) === 0xC0) return "SERVICE " + b[1];
    const x = operand(b[1], b[2], (op & 0x20) !== 0), y = operand(b[3], b[4], (op & 0x10) !== 0), o = op & 15;
    if ((op & 0xC0) === 0x40) return x + " := " + (o === 6 ? y : x + " " + { 7: "+", 8: "-", 9: "rsub", 10: "AND", 11: "OR" }[o] + " " + y);
    return "IF " + x + " " + ["<", "<=", "=", "<>", "&=0", "&<>0"][o] + " " + y + " GOTO @" + hex4(b[5] | (b[6] << 8));
}
const instruction = (img, at) => Array.from(img.slice(BASE + at, BASE + at + LEN(img[BASE + at])));

// instruction starts of the original (the same recursive descent the validation uses)
const starts = new Set();
{
    const work = [0x0000, 0x1770];
    while (work.length) {
        let o = work.pop();
        while (o < image.length - BASE && !starts.has(o)) {
            starts.add(o);
            const b = instruction(image, o);
            if (b[0] === 0xC4) { work.push(b[1] | (b[2] << 8)); break; }
            if ((b[0] & 0xC0) === 0x00) work.push(b[5] | (b[6] << 8));
            if ((b[0] & 0xC0) === 0xC0 && b[1] === 3) break;
            o += b.length;
        }
    }
}

const changes = Patches.build(Patches.ALL);
const fixed = image.slice();
for (const [off, bytes] of changes) fixed.set(bytes, BASE + off);

const out = [];
const L = (s) => out.push(s);
L("THE APPROVED FIXES, WRITTEN AS ALADIN BYTECODE");
L("==============================================");
L("Offsets are relative to the start of the bytecode (&21C7), as in bytecode_listing.txt.");
L("The validation reference runs the original program with these changes (and the @012b and");
L("@09c8 corrections) and compares it with arendarvon-engine.js command by command. The new");
L("routines sit in parts of the bytecode that the original never executes.");
L("");
L("New messages, built only from words of the original vocabulary:");
for (const n of Object.keys(Patches.READABLE)) L("  msg" + n + "  " + JSON.stringify(Patches.READABLE[n]));
const TITLES = {
    loop: "FIX 7 - the character loop gets its own counter (the spare global byte &190C)",
    record0: "FIX 8 - no record 0: a table is looked up by a number only if the number is not 0",
    locks: "FIXES 9-11 - UNLOCK's message; UNLOCK leaves the door CLOSED; LOCK only a CLOSED door",
};
for (const fix of Patches.ALL) {
    L(""); L(TITLES[fix]); L("-".repeat(TITLES[fix].length));
    const mine = changes.filter((c) => c[2] === fix).sort((a, b) => a[0] - b[0]);
    for (const [off, bytes] of mine.filter((c) => c[3] === "routine")) {
        const freed = off >= 0x189a && off < 0x18ba ? ", in the old slot-filling code that @1897 now jumps over" : "";
        L("  new routine at @" + hex4(off) + " (" + bytes.length + " bytes" + freed + "):");
        for (let p = 0; p < bytes.length; p += LEN(bytes[p])) {
            const ins = bytes.slice(p, p + LEN(bytes[p]));
            L("    @" + hex4(off + p) + "  " + ins.map(hex2).join(" ").padEnd(21) + text(ins));
        }
    }
    const changedStarts = new Set();
    for (const [off] of mine.filter((c) => c[3] === "inPlace")) {
        for (let k = 0; k < 7; k++) {
            const s = off - k;
            if (starts.has(s) && s + LEN(image[BASE + s]) > off) { changedStarts.add(s); break; }
        }
    }
    for (const s of [...changedStarts].sort((a, b) => a - b)) {
        const was = instruction(image, s), now = instruction(fixed, s);
        L("  @" + hex4(s) + "  was " + was.map(hex2).join(" ").padEnd(21) + text(was));
        L("         now " + now.map(hex2).join(" ").padEnd(21) + text(now));
    }
}
process.stdout.write(out.join("\n") + "\n");
