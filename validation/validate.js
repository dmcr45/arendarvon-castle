// VALIDATION SUITE
// Compares the refactored engine with the ORIGINAL program (real 6502 VM code running the
// real bytecode, with the BASIC host re-implemented), command by command.
"use strict";

const V = (function () {
    const out = [];
    const log = (s) => out.push(s);

    function mulberry32(seed) {
        return function () {
            seed |= 0; seed = seed + 0x6D2B79F5 | 0;
            let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }

    const files = Ref.readDfs(Ref.b64ToBytes(SSD_BASE64));
    const A = Ref.readArrays(files["$.Arrays"]);
    const START = files["$.!Start"];

    // The reference is the original with the approved fixes applied as bytecode (patches.js);
    // their three new messages join the message table.
    for (const n of Object.keys(Patches.READABLE)) MESSAGES_READABLE[Number(n)] = Patches.READABLE[n];

    // State bytes (offset from &1900) that are scratch in the original and not kept by the engine:
    //  G1 +0 (literal slot), +3 (random/subroutine result), +21..+24 (temporaries),
    //  +28..+30 (subroutine arguments), +12 (the character loop's counter, added by fix 7);
    //  text slots &191F+n written by the print routine.
    const SCRATCH = new Set([0, 3, 12, 21, 22, 23, 24, 28, 29, 30]);
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 15, 16].forEach(n => SCRATCH.add(31 + n));

    function stateDiff(a, b, exclude) {
        const diffs = [];
        for (let i = 0; i < 1672; i++) {
            if (exclude && exclude.has(i)) continue;
            if (a[i] !== b[i]) diffs.push("&" + (0x1900 + i).toString(16).toUpperCase() + ": ref " + a[i] + " eng " + b[i]);
        }
        return diffs;
    }

    function refEventText(e) {
        switch (e.type) {
            case "print": return "P:" + MESSAGES_READABLE[e.msg];
            case "random": return "R:" + e.bound + "=" + e.result;
            case "input": return "I";
            case "quit": return "Q";
            case "halt": return "H";
            case "error": return "H";
            case "saveAsk": return "SA"; case "saveName": return "SN";
            case "loadAsk": return "LA"; case "loadName": return "LN";
            case "quitAsk": return "QA";
        }
        return "?" + e.type;
    }
    function engEventText(e) {
        switch (e.type) {
            case "print": return "P:" + e.text;
            case "random": return "R:" + e.bound + "=" + e.result;
            case "input": return "I";
            case "quit": return "Q";
            case "halt": return "H";
            case "saveAsk": return "SA"; case "saveName": return "SN";
            case "loadAsk": return "LA"; case "loadName": return "LN";
            case "quitAsk": return "QA";
        }
        return "?" + e.type;
    }
    const squash = (s) => s.replace(/\s+/g, "");

    // ------------------------------------------------------------------ a pair of machines
    function Pair(seed, options) {
        options = options || {};
        this.rngRef = mulberry32(seed);
        this.rngEng = mulberry32(seed);
        this.coverage = options.coverage;
        this.refSaves = {};
        this.engSaves = {};
        this.engEvents = [];
        const self = this;
        this.eng = createArendarvonGame({
            random: (n) => 1 + Math.floor(self.rngEng() * n),
            storage: { save: (name, text) => { self.engSaves[name] = text; return true; }, load: (name) => (name in self.engSaves ? self.engSaves[name] : null) },
            trace: (e) => { if (self.engEvents.push(e) > 50000) throw new Error("runaway: the game never asks for input again"); },
        });
        this.patch = options.patch012b !== false;
        this.patch09c8 = options.patch09c8 !== false;
        this.patches = options.patches || Patches.ALL;
        this.newRef();
    }
    Pair.prototype.newRef = function () {
        const self = this;
        this.ref = new Ref.Machine(SSD_BASE64, {
            random: (n) => 1 + Math.floor(self.rngRef() * n),
            coverage: this.coverage, patch012b: this.patch !== false, patch09c8: this.patch09c8, patches: this.patches, saves: this.refSaves,
            quitCommand: true,
        });
    };
    // Runs one step on both. line === null means "start".
    Pair.prototype.step = function (line) {
        let refEv, refErr = null;
        this.engEvents = [];
        try {
            refEv = line === null ? this.ref.run() : this.ref.submit(line.toUpperCase());   // the BBC was used with CAPS LOCK on
        } catch (e) {
            refErr = e;
            refEv = (this.ref.events || []).slice();
            if (!/BASIC error/.test(e.message)) refEv.push({ type: "exception", message: e.message });
            else if (!refEv.length || refEv[refEv.length - 1].type !== "error") refEv.push({ type: "halt" });
        }
        let reply, engErr = null;
        try {
            reply = line === null ? this.eng.start() : this.eng.submit(line);
        } catch (e) {
            engErr = e;
            reply = { text: "", waitingFor: "?" };
        }
        const r = refEv.map(refEventText), g = this.engEvents.map(engEventText);
        const result = { line, refEvents: r, engEvents: g, problems: [] };
        const refRunaway = refErr && /runaway/.test(refErr.message), engRunaway = engErr && /runaway/.test(engErr.message);
        if (refRunaway && engRunaway) { result.halted = true; result.runaway = true; result.waiting = "H"; return result; }
        if (engErr) result.problems.push("ENGINE EXCEPTION: " + engErr.stack);
        if (refErr && !/BASIC error/.test(refErr.message)) result.problems.push("REFERENCE EXCEPTION: " + refErr.message);
        if (r.join("|") !== g.join("|")) {
            let k = 0; while (k < r.length && k < g.length && r[k] === g[k]) k++;
            result.problems.push("EVENTS differ at #" + k + ":\n    ref " + JSON.stringify(r) + "\n    eng " + JSON.stringify(g));
        }
        const last = r[r.length - 1];
        if (last === "I" && g[g.length - 1] === "I") {
            const d = stateDiff(this.ref.state(), this.eng.snapshot(), SCRATCH);
            if (d.length) result.problems.push("STATE differs (" + d.length + " bytes): " + d.slice(0, 8).join(", "));
            const rs = squash(this.ref.screen.text()), es = squash(reply.text);
            if (rs !== es) result.problems.push("SCREEN differs:\n  ref: " + this.ref.screen.text().replace(/\n/g, "/") + "\n  eng: " + reply.text.replace(/\n/g, "/"));
        }
        if (refErr && /BASIC error/.test(refErr.message) || last === "H") { result.halted = true; }
        result.waiting = last;
        return result;
    };
    // Put the same (mutated) state into both, at a command prompt.
    Pair.prototype.setState = function (bytes) {
        this.ref.mem.set(bytes, 0x1900);
        this.eng.restoreSnapshot(bytes);
    };

    return { log, out, mulberry32, files, A, START, SCRATCH, stateDiff, Pair, refEventText, squash };
})();



