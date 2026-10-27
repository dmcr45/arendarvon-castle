// THE ORIGINAL PROGRAM WITH THE APPROVED FIXES, written as bytecode.
// Each fix is expressed the way the 1985 author could have written it: a few bytes
// changed in place, plus small routines placed in the bytecode's unreachable gaps
// ("data" areas never executed), and new messages built from the game's own words.
// The validation reference runs the real VM on this patched bytecode.
"use strict";

const Patches = (function () {
    // ---- operands -------------------------------------------------------------
    const g = (field) => ({ desc: field, idx: 1, ind: false });          // global G[1].field
    const lit = (v) => ({ desc: 0, idx: v, ind: false });                // a literal number
    const slot = (n) => ({ desc: n, idx: 2, ind: false });               // text slot G[2].n
    // record 'array' field 'field', record number taken from global G[1].indexField
    const rec = (array, field, indexField) => ({ desc: (array << 5) | field, idx: indexField, ind: true });
    const OBJECTS = 1, ROOMS = 2, CHARACTERS = 3, PASSAGES = 4, VERBS = 5;
    const OP = { LT: 0, LE: 1, EQ: 2, NE: 3, BITCLEAR: 4, BITSET: 5, SET: 6, ADD: 7, SUB: 8, RSUB: 9, AND: 10, OR: 11 };

    // ---- a tiny assembler -----------------------------------------------------
    // Returns { bytes, labels } for a list of items placed at 'origin'.
    function assemble(origin, items) {
        const labels = {};
        let pc = origin;
        for (const it of items) { if (it.label) labels[it.label] = pc; pc += it.len || 0; }
        const out = [];
        const target = (t) => (typeof t === "number" ? t : (labels[t] !== undefined ? labels[t] : External[t]));
        for (const it of items) {
            if (it.label) continue;
            const t = it.target !== undefined ? target(it.target) : 0;
            if (it.target !== undefined && t === undefined) throw new Error("unknown label " + it.target);
            switch (it.kind) {
                case "assign": out.push(0x40 | it.op | (it.a.ind ? 0x20 : 0) | (it.b.ind ? 0x10 : 0), it.a.desc, it.a.idx, it.b.desc, it.b.idx); break;
                case "if": out.push(it.op | (it.a.ind ? 0x20 : 0) | (it.b.ind ? 0x10 : 0), it.a.desc, it.a.idx, it.b.desc, it.b.idx, t & 0xFF, t >> 8); break;
                case "goto": out.push(0xC4, t & 0xFF, t >> 8); break;
                case "print": out.push(0x80 | (it.msg >> 8), it.msg & 0xFF); break;
            }
        }
        if (out.length !== pc - origin) throw new Error("assembler length");
        return { bytes: out, labels };
    }
    const assign = (op, a, b) => ({ kind: "assign", op, a, b, len: 5 });
    const iff = (op, a, b, target) => ({ kind: "if", op, a, b, target, len: 7 });
    const goto = (target) => ({ kind: "goto", target, len: 3 });
    const print = (msg) => ({ kind: "print", msg, len: 2 });
    const label = (name) => ({ label: name });
    const External = {};            // labels of blocks placed elsewhere (filled below)

    // ---- the unreachable gaps used (offset, size) --------------------------------
    const GAPS = { g1bce: [0x1bce, 107], g0606: [0x0606, 58], g171d: [0x171d, 83], g0ec1: [0x0ec1, 23], g0bd7: [0x0bd7, 19], g0140: [0x0140, 12],
                   g189a: [0x189a, 32] };   // freed by the record-0 fix itself (see P2a)

    // ---- new messages (numbers after the original 211) ---------------------------
    const NEW_MESSAGES = {
        212: ["YOU", "CAN'T", "UNLOCK", "A", "$7", "\b."],
        213: ["YOU", "CAN'T", "LOCK", "AN", "OPEN", "$7", "\b."],
        214: ["THE", "$7", "IS", "ALREADY", "LOCKED", "\b."],
    };
    function readable(words) {
        let s = "";
        for (const w of words) s = w.charCodeAt(0) === 8 ? s + w.substring(1) : (s ? s + " " : "") + w;
        return s;
    }

    // ---- the fixes ------------------------------------------------------------------
    // Each block: { gap, items }. 'inPlace' lists [offset, [bytes]] changed in the original.
    function blocks() {
        const slotGuard = (n, indexField, operand, next) => [
            assign(OP.SET, slot(n), lit(0)),
            iff(OP.EQ, g(indexField), lit(0), next),
            assign(OP.SET, slot(n), operand),
            label(next),
        ];
        return {
            // FIX 7 - the character loop gets its own counter (unused global G[1].12)
            loop: {
                code: [{ gap: "g0606", name: "P1", items: [
                    label("P1a"), assign(OP.SET, g(12), lit(2)),               // counter := 2
                    label("P1b"), assign(OP.SET, g(5), g(12)),                 // character := counter
                    goto(0x0edd),
                ] }],
                inPlace: (L) => [
                    [0x0ed8, [0xC4, L.P1a & 0xFF, L.P1a >> 8]],               // was: character := 2
                    [0x1709 + 2, [0x0C]],                                      // mood clear on the counter's character
                    [0x170e + 1, [0x0C]],                                      // counter += 1
                    [0x1713 + 1, [0x0C]], [0x1713 + 5, [L.P1b & 0xFF, L.P1b >> 8]],   // IF counter <= 9 GOTO P1b
                ],
            },
            // FIX 8 - no record 0: every table lookup by a global checks it is not 0
            record0: {
                code: [
                    { gap: "g1bce", name: "P2a", items: [label("P2a")]
                        .concat(slotGuard(1, 14, rec(VERBS, 0, 14), "s1"))
                        .concat(slotGuard(2, 1, rec(OBJECTS, 1, 1), "s2"))
                        .concat(slotGuard(3, 2, rec(OBJECTS, 1, 2), "s3"))
                        .concat(slotGuard(4, 6, rec(ROOMS, 0, 6), "s4"))
                        .concat(slotGuard(5, 8, rec(ROOMS, 0, 8), "s5"))
                        .concat(slotGuard(6, 5, rec(CHARACTERS, 0, 5), "s6"))
                        .concat([goto("P2b")]) },
                    { gap: "g0606", name: "P2b", items: [label("P2b")]
                        .concat(slotGuard(7, 4, rec(PASSAGES, 0, 4), "s7"))
                        .concat([goto(0x18ba)]) },
                    { gap: "g0606", name: "P3", items: [                        // $12: article of articleRoom
                        label("P3"), iff(OP.EQ, g(27), lit(0), "P3z"),
                        iff(OP.BITCLEAR, rec(ROOMS, 7, 27), lit(32), 0x18fb),
                        goto(0x18f3),
                        label("P3z"), assign(OP.SET, slot(12), lit(0)), goto(0x190f),
                    ] },
                    { gap: "g171d", name: "P4", items: [                        // $15/$16: size of 'here'
                        label("P4"), iff(OP.EQ, g(6), lit(0), "P4z"),
                        iff(OP.BITSET, g(9), lit(1), 0x1928),
                        goto(0x191b),
                        label("P4z"), assign(OP.SET, slot(15), lit(0)), assign(OP.SET, slot(16), lit(0)), goto(0x193c),
                    ] },
                    { gap: "g0ec1", name: "P5", items: [                        // TAKE from a character who is not here
                        label("P5"), iff(OP.EQ, g(5), lit(0), 0x04d5),
                        iff(OP.BITCLEAR, rec(CHARACTERS, 3, 5), lit(2), 0x04d0),
                        goto(0x04cb),
                    ] },
                    { gap: "g0bd7", name: "P6", items: [                        // is the room's owner here?
                        label("P6"), assign(OP.SET, g(5), rec(ROOMS, 6, 6)),
                        iff(OP.NE, g(5), lit(0), 0x007c),
                        goto(0x0088),
                    ] },
                    // A present is accepted only if there is one (object1 not 0); otherwise the
                    // character carries on as if nothing had been offered. Placed in the space
                    // the old slot-filling code (@189a-18b9) no longer needs.
                    { gap: "g189a", name: "P8", items: [
                        label("P8girl"), iff(OP.NE, g(1), lit(0), 0x108b), goto(0x1073),
                        label("P8gate"), iff(OP.NE, g(1), lit(0), 0x112b), goto(0x1110),
                        label("P8priest"), iff(OP.NE, g(1), lit(0), 0x125f), goto(0x1239),
                    ] },
                ],
                inPlace: (L) => [
                    [0x1897, [0xC4, L.P2a & 0xFF, L.P2a >> 8]],
                    [0x18ec, [0xC4, L.P3 & 0xFF, L.P3 >> 8]],
                    [0x1914, [0xC4, L.P4 & 0xFF, L.P4 >> 8]],
                    [0x04c4, [0xC4, L.P5 & 0xFF, L.P5 >> 8]],
                    [0x0077, [0xC4, L.P6 & 0xFF, L.P6 >> 8]],
                    [0x106c + 5, [L.P8girl & 0xFF, L.P8girl >> 8]],           // the girl: IF OFFERED GOTO P8girl
                    [0x1109 + 5, [L.P8gate & 0xFF, L.P8gate >> 8]],           // the gatekeeper
                    [0x1232 + 5, [L.P8priest & 0xFF, L.P8priest >> 8]],       // the priest
                ],
            },
            // FIXES 9-11 - LOCK and UNLOCK
            locks: {
                code: [
                    { gap: "g171d", name: "P7", items: [
                        label("P7"),
                        iff(OP.EQ, rec(PASSAGES, 3, 4), lit(2), 0x0444),       // CLOSED: lock it (the original code)
                        iff(OP.EQ, rec(PASSAGES, 3, 4), lit(1), "P7open"),
                        iff(OP.EQ, rec(PASSAGES, 3, 4), lit(3), "P7locked"),
                        iff(OP.EQ, rec(PASSAGES, 3, 4), lit(4), "P7nailed"),
                        iff(OP.NE, rec(PASSAGES, 3, 4), lit(5), 0x0427),       // no such state: "YOU CAN'T LOCK A $7." (abort)
                        print(26), goto(0x044b),                                // BOLTED: "IT IS LATCHED AND BOLTED ON THE OTHER SIDE."
                        label("P7nailed"), print(31), goto(0x044b),             // "IT IS NAILED SHUT."
                    ] },
                    { gap: "g0140", name: "P7b", items: [
                        label("P7open"), print(213), goto(0x044b),              // "YOU CAN'T LOCK AN OPEN $7."
                        label("P7locked"), print(214), goto(0x044b),            // "THE $7 IS ALREADY LOCKED."
                    ] },
                ],
                inPlace: (L) => [
                    [0x0438 + 5, [L.P7 & 0xFF, L.P7 >> 8]],                    // after the keys check: to P7
                    [0x0459, [0x80, 212]],                                      // UNLOCK: "YOU CAN'T UNLOCK A $7."
                    [0x0484 + 4, [2]],                                          // UNLOCK leaves the door CLOSED
                ],
            },
        };
    }

    // Place every block of the chosen fixes into its gap; returns the byte changes.
    function build(names) {
        const all = blocks();
        const used = {};
        const placed = [];
        // first pass: addresses of all blocks (labels may be referenced across blocks)
        for (const name of names) for (const blk of all[name].code) {
            const [base, size] = GAPS[blk.gap];
            const at = base + (used[blk.gap] || 0);
            const len = blk.items.reduce((n, it) => n + (it.len || 0), 0);
            used[blk.gap] = (used[blk.gap] || 0) + len;
            if (used[blk.gap] > size) throw new Error("gap " + blk.gap + " overflow");
            let pc = at;
            for (const it of blk.items) { if (it.label) External[it.label] = pc; pc += it.len || 0; }
            placed.push({ at, blk, name });
        }
        // [offset, bytes, fix name, "routine" (new code in unused space) or "inPlace"]
        const changes = [];
        for (const p of placed) changes.push([p.at, assemble(p.at, p.blk.items).bytes, p.name, "routine"]);
        for (const name of names) for (const [off, bytes] of all[name].inPlace(External)) changes.push([off, bytes, name, "inPlace"]);
        return changes;
    }

    // Add the new messages to the game's arrays (as read from $.Arrays), coded the same way.
    function addMessages(A, names) {
        if (names.indexOf("locks") >= 0) {
            for (const n of Object.keys(NEW_MESSAGES)) {
                let coded = "";
                for (const w of NEW_MESSAGES[n]) {
                    const i = A.w.indexOf(w);
                    if (i < 1) throw new Error("word not in the vocabulary: " + JSON.stringify(w));
                    coded += String.fromCharCode(i >> 7, i & 127);
                }
                A.s[Number(n)] = coded;
            }
        }
    }

    const ALL = ["loop", "record0", "locks"];
    const READABLE = {};
    for (const n of Object.keys(NEW_MESSAGES)) READABLE[n] = readable(NEW_MESSAGES[n]);
    return { build, addMessages, ALL, NEW_MESSAGES, READABLE, GAPS };
})();

if (typeof module !== "undefined") module.exports = Patches;
