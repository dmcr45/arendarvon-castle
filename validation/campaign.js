// Test campaign: random play + state mutation, comparing reference and engine.
"use strict";

const Campaign = (function () {
    const A = V.A;
    const START = V.START;
    const words = A.R.slice(1).map(r => ({ word: A.w[r[0]], value: r[1], kind: r[2] }));
    const VERBS = words.filter(w => w.kind === 1 && w.word !== "XXX");
    const OBJS = words.filter(w => w.kind === 2);
    const DIRS = words.filter(w => w.kind === 3);
    const PASS = words.filter(w => w.kind === 4);

    // offsets into the 1672 state bytes
    const OBJ = (o, f) => 0x38 + 6 * o + f;
    const ROOM = (r, f) => 0x161 + 9 * r + f;
    const CH = (c, f) => 0x581 + 6 * c + f;
    const PAS = (p, f) => 0x5B9 + 4 * p + f;

    function commandGenerator(rng) {
        const pick = (arr) => arr[Math.floor(rng() * arr.length)];
        const abbrev = (w) => rng() < 0.12 ? w.substring(0, 1 + Math.floor(rng() * w.length)) : w;
        return function () {
            const r = rng();
            if (r < 0.20) return "GO " + abbrev(pick(DIRS).word);
            if (r < 0.26) return abbrev(pick(DIRS).word);
            if (r < 0.30) return "TURN " + pick(DIRS).word;
            if (r < 0.52) return pick(VERBS).word + " " + abbrev(pick(OBJS).word);
            if (r < 0.64) return pick(VERBS).word + " " + pick(PASS).word + (rng() < 0.3 ? " " + pick(DIRS).word : "");
            if (r < 0.68) return "PUT " + pick(OBJS).word + " IN " + pick(OBJS).word;
            if (r < 0.70) return "GIVE " + pick(OBJS).word;
            if (r < 0.78) return pick(["LOOK", "WAIT", "INVENTORY", "SCORE", "MEASURE", "WAIT", "LOOK"]);
            if (r < 0.84) return rng() < 0.5 ? pick(OBJS).word : pick(PASS).word;
            if (r < 0.88) return pick(["", "XYZZY", "HELLO THERE", "  GO   AHEAD ", "take torch", "look", "USE THE STAFF", "STRIKE", "ATTACK", "CLIMB"]);
            if (r < 0.95) return pick(VERBS).word;
            if (r < 0.975) return pick(["SAVE", "LOAD"]);
            if (r < 0.978) return pick(["QUIT", "EXIT", "quit", "TAKE QUIT", "XXX", "X", "QUITE", "EXITS"]);
            return pick(["STRIKE " + pick(DIRS).word, "EXAMINE " + pick(DIRS).word, "STRIKE WALL", "USE COMPASS"]);
        };
    }

    // Words that refer to each object (the vocabulary value is the first object of that name).
    const WORDS_FOR_OBJECT = [];
    for (let o = 0; o <= 50; o++) WORDS_FOR_OBJECT.push([]);
    OBJS.forEach(w => {
        for (let o = w.value; o <= 50 && START[OBJ(o, 1)] === START[OBJ(w.value, 1)]; o++) WORDS_FOR_OBJECT[o].push(w.word);
    });
    const PASSAGE_WORDS = {};
    PASS.forEach(w => { (PASSAGE_WORDS[w.value] = PASSAGE_WORDS[w.value] || []).push(w.word); });

    // A command that makes sense in the current state (objects here, doors round the room...).
    function smartCommand(b, rng) {
        const R = (n) => Math.floor(rng() * n);
        const pick = (arr) => arr[R(arr.length)];
        const player = b[CH(1, 2)];
        const whereIs = (o) => {
            let loc = b[OBJ(o, 0)];
            for (let k = 0; k < 20; k++) {
                if (loc === 193 || loc === player || (loc & 128) === 0) return loc;
                loc = (loc & 64) ? b[CH(loc & 63, 2)] : b[OBJ(loc & 127, 0)];
            }
            return 0;
        };
        const here = [], carried = [];
        for (let o = 1; o <= 50; o++) {
            if (!WORDS_FOR_OBJECT[o].length) continue;
            const w = whereIs(o);
            if (b[OBJ(o, 0)] === 193 || w === 193) carried.push(o);
            else if (w === player) here.push(o);
        }
        const doors = [];
        for (let d = 1; d <= 4; d++) {
            const e = b[ROOM(player, d)];
            if (e & 128) { const words = PASSAGE_WORDS[b[PAS(e & 127, 0)]]; if (words) doors.push(pick(words)); }
        }
        const word = (o) => pick(WORDS_FOR_OBJECT[o]);
        const anyObj = () => (carried.length && rng() < 0.5) ? pick(carried) : (here.length ? pick(here) : (carried.length ? pick(carried) : 0));
        const t = R(20);
        if (t < 3 && here.length) return pick(["TAKE ", "TAKE ", "EXAMINE ", "CLIMB ", "STRIKE "]) + word(pick(here));
        if (t < 6 && carried.length) return pick(["USE ", "USE ", "DROP ", "GIVE ", "EXAMINE ", "STRIKE "]) + word(pick(carried));
        if (t < 7 && carried.length && (here.length || carried.length > 1)) return "PUT " + word(pick(carried)) + " IN " + word(anyObj());
        if (t < 10 && doors.length) return pick(["OPEN ", "CLOSE ", "LOCK ", "UNLOCK ", "STRIKE ", "EXAMINE ", "GO "]) + pick(doors);
        if (t < 13) return "GO " + pick(DIRS).word;
        if (t < 14) return pick(["ATTACK", "ATTACK", "GIVE " + (carried.length ? word(pick(carried)) : "MONEY")]);
        if (t < 15) return pick(["STRIKE ", "EXAMINE "]) + pick(DIRS).word;
        if (t < 16) return pick(["LOOK", "WAIT", "WAIT", "WAIT", "INVENTORY", "SCORE", "MEASURE"]);
        if (t < 17) return "TURN " + pick(DIRS).word;
        if (t < 18 && carried.length) return "USE " + word(pick(carried));
        return pick(["TAKE ", "USE ", "CLIMB "]) + word(1 + R(50)) ;
    }

    const SPECIAL_ROOMS =[3, 4, 5, 13, 20, 22, 26, 29, 31, 33, 35, 39, 44, 49, 50, 51, 52, 54, 57, 58, 67, 69, 71, 75, 76, 84, 85, 86, 88, 89, 98, 99, 100, 104, 105, 106, 107, 112, 113, 114, 116, 117];
    const OWNED = {};
    function ownedRooms(b, c) {
        const list = [];
        for (let r = 1; r <= 117; r++) if (b[ROOM(r, 6)] === c) list.push(r);
        return list;
    }

    // Mutate a state (at a command prompt) into an unusual but valid situation.
    function mutate(b, rng) {
        const R = (n) => Math.floor(rng() * n);
        const pick = (arr) => arr[R(arr.length)];
        const reaches = (from, target) => {         // is 'from' (transitively) inside 'target'?
            let o = from;
            for (let k = 0; k < 60; k++) {
                const loc = b[OBJ(o, 0)];
                if ((loc & 128) === 0 || (loc & 64) !== 0) return false;
                o = loc & 127;
                if (o === target) return true;
            }
            return true;
        };
        const place = (x) => {
            const player = b[CH(1, 2)];
            const choice = R(8);
            if (choice === 0) b[OBJ(x, 0)] = player;
            else if (choice === 1) b[OBJ(x, 0)] = 193;
            else if (choice === 2) b[OBJ(x, 0)] = 1 + R(117);
            else if (choice === 3) b[OBJ(x, 0)] = 192 + 2 + R(8);
            else if (choice === 4) b[OBJ(x, 0)] = 0;
            else {
                const y = 1 + R(50);
                if (y !== x && !reaches(y, x)) b[OBJ(x, 0)] = 128 | y;
                else b[OBJ(x, 0)] = player;
            }
        };
        const n = 1 + R(3);
        for (let k = 0; k < n; k++) {
            switch (R(14)) {
                case 0: b[CH(1, 2)] = 1 + R(117); break;
                case 1: b[CH(1, 2)] = pick(SPECIAL_ROOMS); break;
                case 2: for (let j = 0; j < 1 + R(4); j++) place(1 + R(50)); break;
                case 3: {                                           // used / broken
                    const o = 1 + R(50);
                    if ((b[OBJ(o, 2)] & 64) === 0 && b[OBJ(o, 3)] !== 0) {
                        const initialName = START[OBJ(o, 1)];
                        b[OBJ(o, 1)] = rng() < 0.5 ? b[OBJ(o, 3)] : initialName;
                    }
                    break;
                }
                case 4: {                                           // a character
                    const c = 2 + R(8);
                    const owned = ownedRooms(b, c);
                    b[CH(c, 2)] = rng() < 0.5 ? b[CH(1, 2)] : (owned.length ? pick(owned) : 1 + R(117));
                    b[CH(c, 3)] = R(16);
                    if (rng() < 0.3) b[CH(c, 1)] = pick([0, 1, 5, 10, 40, R(256)]);
                    if (rng() < 0.15) b[CH(c, 0)] = rng() < 0.5 ? b[CH(c, 5)] : START[CH(c, 0)];
                    break;
                }
                case 5: {                                           // passages
                    for (let j = 0; j < 1 + R(5); j++) {
                        const p = 1 + R(40);
                        if (rng() < 0.7) b[PAS(p, 3)] = R(6);
                        if (rng() < 0.4) b[PAS(p, 2)] = R(64);
                    }
                    break;
                }
                case 6:                                             // timers and flags
                    b[17] = pick([0, 0, 1, 2, 3, 75, R(80)]);
                    b[18] = pick([0, 0, 1, 2, 25]);
                    b[7] = pick([0, 0, 1, 2, 25]);
                    b[19] = pick([5, 5, 1, 0]);
                    b[20] = R(6);
                    b[9] = 1 + R(4);
                    b[10] = (rng() < 0.7 ? 8 : 0) | (rng() < 0.3 ? 4 : 0);
                    break;
                case 7:
                    b[CH(1, 1)] = pick([0, 1, 3, 5, 10, 60, 250, 255, R(256)]);
                    b[CH(1, 4)] = pick([0, 24, 25, 99, 100, 101, 150, 255, R(256)]);
                    break;
                case 8: for (let r = 1; r <= 117; r++) if (rng() < 0.3) b[ROOM(r, 5)] ^= 64; break;
                case 9: {
                    const o = 1 + R(50);
                    if (rng() < 0.5) b[OBJ(o, 2)] ^= 1;
                    if (rng() < 0.2) b[OBJ(o, 2)] ^= 2;
                    if (rng() < 0.2) b[OBJ(o, 4)] = pick([0, 1, 10, 100, 254, 255]);
                    break;
                }
                case 10: {                                          // meet a character
                    const c = 2 + R(8);
                    b[CH(1, 2)] = b[CH(c, 2)];
                    break;
                }
                case 11: {                                          // objects of interest at hand
                    const o = pick([3, 10, 11, 14, 16, 17, 18, 19, 22, 23, 25, 29, 31, 32, 34, 35, 37, 43, 44, 45, 46, 47, 4, 5, 6, 2, 12, 20, 30, 33, 36, 42, 50, 40, 41, 48, 49]);
                    b[OBJ(o, 0)] = rng() < 0.6 ? 193 : b[CH(1, 2)];
                    break;
                }
                case 12:                                            // the cannon loaded
                    b[OBJ(16, 0)] = 145;
                    if (rng() < 0.5) b[OBJ(18, 0)] = 145;
                    b[CH(1, 2)] = 50;
                    break;
                case 13: {                                          // all three papers carried
                    b[OBJ(4, 0)] = 193; b[OBJ(5, 0)] = 193; b[OBJ(6, 0)] = 193;
                    break;
                }
            }
        }
    }

    // Every place where the player can face a door that has a lock: [room, facing, passage]
    const DOOR_SPOTS = [];
    for (let r = 1; r <= 117; r++) for (let d = 1; d <= 4; d++) {
        const exit = START[ROOM(r, d)];
        if ((exit & 128) && (START[PAS(exit & 127, 2)] & 12) === 12) DOOR_SPOTS.push([r, d, exit & 127]);
    }

    // Targeted situations for rare code paths. Returns the command to try next.
    function scenario(b, rng) {
        const R = (n) => Math.floor(rng() * n);
        const pick = (arr) => arr[R(arr.length)];
        const lit = () => { b[10] = (b[10] | 8) & ~4; };
        const strong = () => { b[CH(1, 1)] = 200; b[CH(1, 4)] = 150; b[19] = 5; };
        const at = (room) => { b[CH(1, 2)] = room; };
        const meet = (c) => { b[CH(c, 2)] = b[CH(1, 2)]; b[CH(c, 0)] = START[CH(c, 0)]; };
        const invisible = (on) => { b[7] = on ? 10 : 0; };
        strong(); lit();
        switch (R(37)) {
            case 0: at(107); b[OBJ(37, 1)] = START[OBJ(37, 1)]; return "STRIKE STILL";
            case 1: { b[OBJ(14, 0)] = 193; const c = 2 + R(8); meet(c); invisible(rng() < 0.3); b[CH(c, 1)] = pick([5, 20, 60, 150]); return "ATTACK"; }
            case 2: b[CH(2, 2)] = 31; b[CH(2, 0)] = START[CH(2, 0)]; b[PAS(6, 3)] = 1; at(pick([26, 31])); invisible(true); return pick(["WAIT", "LOOK"]);
            case 3: b[CH(2, 2)] = 22; b[CH(2, 0)] = START[CH(2, 0)]; b[PAS(4, 3)] = pick([1, 2]); b[OBJ(43, 0)] = pick([194, 193, 20]); at(pick([20, 22])); invisible(true); return "WAIT";
            case 4: b[CH(4, 2)] = 84; b[CH(4, 0)] = START[CH(4, 0)]; at(pick([84, 49, 51])); invisible(true); return "WAIT";
            case 5: b[CH(4, 2)] = 85; b[CH(4, 0)] = START[CH(4, 0)]; b[PAS(32, 3)] = 1; at(pick([85, 86])); invisible(true); return "WAIT";
            case 6: meet(8); b[CH(8, 3)] = 2; invisible(false); b[OBJ(11, 0)] = pick([200, 112, 128 | 26, 193]); return "WAIT";
            case 7: at(104); meet(8); b[CH(8, 3)] = 0; invisible(false); return "WAIT";
            case 8: { at(pick([101, 107, 112, 115])); meet(8); b[CH(8, 3)] = 0; const t = pick([2, 12, 20, 30, 33, 36, 11, 42]); b[OBJ(t, 0)] = 200; return "WAIT"; }
            case 9: meet(9); b[CH(9, 3)] = 2; b[OBJ(pick([4, 5, 6]), 0)] = 201; if (rng() < 0.6) b[10] &= ~8; return "WAIT";
            case 10: meet(9); b[OBJ(47, 0)] = b[CH(1, 2)]; b[CH(9, 3)] = 0; if (rng() < 0.3) b[10] &= ~8; return "WAIT";
            case 11: at(31); b[PAS(6, 3)] = 1; b[CH(2, 2)] = 28; return "LOOK";
            case 12: at(67); b[OBJ(25, 0)] = 67; b[OBJ(22, 0)] = rng() < 0.3 ? 193 : 57; return "CLIMB ROPE";
            case 13: at(27); b[OBJ(10, 0)] = 27; b[OBJ(10, 1)] = rng() < 0.7 ? START[OBJ(10, 1)] : 153; b[OBJ(22, 0)] = rng() < 0.4 ? 193 : 57; return pick(["CLIMB SHOW-CASE", "CLIMB SHOW"]);
            case 14: b[OBJ(43, 0)] = 193; at(pick([20, 22, 24, 48, 45, 33, 34, 4, 6])); return pick(["LOCK DOOR", "LOCK LARDER", "UNLOCK DOOR", "LOCK CELLAR"]);
            case 15: { const c = 2 + R(8); meet(c); b[CH(c, 0)] = START[CH(c, 5)]; return "ATTACK"; }
            case 16: { b[OBJ(14, 0)] = 193; const c = pick([2, 3, 8]); meet(c); invisible(c !== 8); b[CH(c, 1)] = 1; return "ATTACK"; }
            case 17: b[OBJ(3, 0)] = 193; b[OBJ(3, 1)] = START[OBJ(3, 1)]; b[17] = 20; b[18] = pick([0, 5]); at(pick([3, 6, 17, 42, 52])); return "STRIKE TORCH";
            case 18: at(71); b[OBJ(29, 0)] = 193; b[PAS(26, 2)] = 35; b[PAS(26, 3)] = pick([1, 2]); b[CH(5, 2)] = 69; return "WAIT";
            case 19: meet(4); b[CH(4, 3)] = 1; b[OBJ(22, 0)] = 193; invisible(false); return "WAIT";
            case 20: at(98); b[9] = pick([1, 4]); b[PAS(26, 2)] = 35; b[PAS(27, 2)] = 35; return "TURN " + pick(["LEFT", "RIGHT", "AHEAD"]);
            case 21: at(89); b[9] = 2; b[PAS(35, 2)] = 35; b[OBJ(11, 0)] = pick([193, 112]); b[CH(1, 4)] = pick([99, 100, 150]); at(pick([88, 89])); return "WAIT";
            case 22: { b[OBJ(50, 0)] = 193; b[OBJ(50, 1)] = START[OBJ(50, 1)]; const c = 2 + R(8); meet(c); if (rng() < 0.2) b[CH(c, 0)] = START[CH(c, 5)]; return "USE KILL-"; }
            case 23: meet(4); b[OBJ(44, 0)] = 193; b[CH(4, 3)] = 0; invisible(false); return pick(["GIVE MONEY", "GIVE KNIFE"]);
            case 24: b[OBJ(34, 0)] = 193; b[OBJ(34, 2)] &= ~2; return "DROP FLASK";
            case 25: b[OBJ(19, 0)] = 193; b[OBJ(19, 1)] = 173; at(pick([20, 34, 43, 44, 74, 76])); return "STRIKE DOOR";
            case 26: meet(9); b[OBJ(47, 0)] = 193; b[CH(9, 3)] = 0; return "GIVE FOOD";
            case 27: meet(9); b[CH(9, 3)] = 1; b[10] &= ~8; b[OBJ(22, 0)] = 193; return "WAIT";
            case 28: at(113); b[OBJ(41, 0)] = 113; b[OBJ(22, 0)] = 57; return "CLIMB LADDER";
            case 29: { const o = pick([1, 3, 14, 24, 32]); b[OBJ(o, 0)] = 193; b[OBJ(o, 2)] |= 16; b[OBJ(o, 5)] |= 4; b[OBJ(o, 1)] = START[OBJ(o, 1)]; return "USE " + pick(WORDS_FOR_OBJECT[o]); }
            case 30: { const o = pick([3, 14, 24, 19]); b[OBJ(o, 0)] = 193; b[OBJ(o, 2)] |= 16; b[OBJ(o, 5)] &= ~4; b[OBJ(o, 1)] = START[OBJ(o, 1)]; b[OBJ(16, 0)] = 145; return "USE " + pick(WORDS_FOR_OBJECT[o]); }
            case 31: meet(8); b[OBJ(14, 0)] = 57; invisible(true); b[CH(8, 3)] = 0; return "ATTACK";
            case 32: at(pick([106, 107])); b[PAS(37, 3)] = pick([1, 2]); return pick(["CLOSE CUPBOARD", "OPEN CUPBOARD"]);
            case 33: { b[OBJ(33, 0)] = 193; b[OBJ(33, 1)] = START[OBJ(33, 1)]; const c = 2 + R(8); if (rng() < 0.8) meet(c); return "USE CHARM-"; }
            case 34: meet(8); b[OBJ(14, 0)] = 193; invisible(true); b[CH(8, 3)] = 0; return "ATTACK";
            case 35:                                                // a door with a lock, in any state (LOCK/UNLOCK)
            case 36: {
                const [room, facing, p] = pick(DOOR_SPOTS);
                at(room); b[9] = facing; b[CH(2, 2)] = 28;
                if (rng() < 0.85) b[OBJ(43, 0)] = 193;
                b[PAS(p, 3)] = rng() < 0.9 ? 1 + R(5) : pick([0, 6, 200]);
                return pick(["LOCK AHEAD", "UNLOCK AHEAD", "LOCK DOOR", "UNLOCK DOOR", "OPEN AHEAD", "EXAMINE AHEAD", "GO AHEAD"]);
            }
        }
        return "WAIT";
    }

    // Runs a campaign; returns summary.
    function run(params) {
        const seed = params.seed || 1;
        const games = params.games || 10;
        const commands = params.commands || 100;
        const fuzz = params.fuzz === undefined ? 0.05 : params.fuzz;
        const maxProblems = params.maxProblems || 12;
        const coverage = params.coverage || { ins: new Set(), taken: new Set(), notTaken: new Set() };
        const rng = V.mulberry32(seed * 7919 + 13);
        let steps = 0, problems = 0, gamesRun = 0, quits = 0, halts = 0, mutations = 0;
        const t0 = Date.now();
        for (let gi = 0; gi < games && problems < maxProblems; gi++) {
            gamesRun++;
            const pair = new V.Pair(seed * 100003 + gi, { coverage: coverage, patch012b: params.patch012b });
            const gen = commandGenerator(rng);
            let res = pair.step(null);
            steps++;
            const history = [];
            for (let ci = 0; ci < commands && problems < maxProblems; ci++) {
                if (res.problems.length) {
                    problems++;
                    V.log("---- PROBLEM (seed " + seed + " game " + gi + " step " + ci + ")");
                    V.log("  last commands: " + JSON.stringify(history.slice(-6)));
                    res.problems.forEach(p => V.log("  " + p));
                    break;
                }
                if (res.halted) { halts++; break; }
                let line;
                switch (res.waiting) {
                    case "Q": quits++; line = ""; break;
                    case "SA": line = rng() < 0.7 ? "Y" : "N"; break;
                    case "QA": line = ["Y", "yes", "N", "NO", "", "QUIT"][Math.floor(rng() * 6)]; break;
                    case "SN": line = rng() < 0.5 ? "ONE" : "TWO"; break;
                    case "LA": {
                        const names = Object.keys(pair.engSaves);
                        line = names.length && rng() < 0.8 ? "YES" : "NO";
                        break;
                    }
                    case "LN": { const names = Object.keys(pair.engSaves); line = names[Math.floor(rng() * names.length)]; break; }
                    default:
                        let suggested = null;
                        if (res.waiting === "I" && rng() < fuzz) {
                            const bytes = pair.ref.state();
                            if (params.scenario && rng() < params.scenario) { suggested = scenario(bytes, rng); history.push("<scenario>"); }
                            else { mutate(bytes, rng); history.push("<mutate>"); }
                            pair.setState(bytes);
                            mutations++;
                        }
                        line = suggested !== null ? suggested : (params.smart && rng() < params.smart) ? smartCommand(pair.ref.state(), rng) : gen();
                }
                history.push(line);
                res = pair.step(line);
                steps++;
            }
        }
        return { steps, problems, gamesRun, quits, halts, mutations, ms: Date.now() - t0, coverage };
    }

    return { run, mutate, commandGenerator, smartCommand, scenario };
})();

