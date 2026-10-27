// REFERENCE MACHINE: the original game exactly as the BBC Micro ran it.
//  - The 6502 CPU emulator executes the real ALADIN VM machine code (&1FA6...) from the SSD.
//  - That VM executes the real bytecode (&21C7...) from the SSD.
//  - This file re-implements only the BBC BASIC host program $.AREND, line by line.
// Nothing in here uses any interpretation of the VM or bytecode: it only sees rout%/par% and memory.
"use strict";

const Ref = (function () {

    // ---------------------------------------------------------------- SSD / DFS
    function b64ToBytes(b64) {
        if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(b64, "base64"));
        const s = atob(b64); const u = new Uint8Array(s.length);
        for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
        return u;
    }
    function readDfs(ssd) {
        const files = {};
        const n = ssd[256 + 5] / 8;
        for (let i = 0; i < n; i++) {
            const o = 8 + i * 8, p = 256 + o;
            let name = ""; for (let k = 0; k < 7; k++) name += String.fromCharCode(ssd[o + k]);
            name = String.fromCharCode(ssd[o + 7] & 0x7F) + "." + name.trim();
            const mixed = ssd[p + 6];
            const len = ssd[p + 4] | (ssd[p + 5] << 8) | (((mixed >> 4) & 3) << 16);
            const sec = ssd[p + 7] | ((mixed & 3) << 8);
            files[name] = ssd.slice(sec * 256, sec * 256 + len);
        }
        return files;
    }
    // BBC BASIC PRINT# file: &40 + 4-byte big-endian int, &00 + len + reversed chars
    function readArrays(b) {
        let p = 0;
        const int = () => { if (b[p] !== 0x40) throw new Error("int@" + p); const v = (b[p + 1] << 24) | (b[p + 2] << 16) | (b[p + 3] << 8) | b[p + 4]; p += 5; return v; };
        const str = () => { if (b[p] !== 0x00) throw new Error("str@" + p); const n = b[p + 1]; let s = ""; for (let i = n - 1; i >= 0; i--) s += String.fromCharCode(b[p + 2 + i]); p += 2 + n; return s; };
        // 480 INPUT#Q%,N%,F%:DIMR%(N%,F%-1):FORI%=1TON%:FORJ%=0TOF%-1:INPUT#Q%,R%(I%,J%)
        const N = int(), F = int();
        const R = [null];
        for (let i = 1; i <= N; i++) { const row = []; for (let j = 0; j < F; j++) row.push(int()); R.push(row); }
        // INPUT#Q%,C%,D%,E%:DIMw$(C%),d$(E%),s$(D%)  (words, descriptions, statements)
        const C = int(), D = int(), E = int();
        const w = [""], s = [""], d = [""];
        for (let i = 1; i <= C; i++) w.push(str());
        for (let i = 1; i <= D; i++) s.push(str());
        for (let i = 1; i <= E; i++) d.push(str());
        return { N, R, w, s, d };
    }

    // ---------------------------------------------------------------- 40-column MODE 7 screen
    function Screen() { this.clear(); }
    Screen.prototype.clear = function () { this.rows = [[]]; this.x = 0; this.y = 0; };
    Screen.prototype.put = function (ch) {
        const code = ch.charCodeAt(0);
        if (code === 8) {                       // VDU 8: cursor left, wraps to end of previous line
            this.x--;
            if (this.x < 0) { if (this.y > 0) { this.y--; this.x = 39; } else this.x = 0; }
            return;
        }
        while (this.rows.length <= this.y) this.rows.push([]);
        this.rows[this.y][this.x] = ch;
        this.x++;
        if (this.x === 40) { this.x = 0; this.y++; }
    };
    Screen.prototype.print = function (s) { for (const ch of s) this.put(ch); };
    Screen.prototype.newline = function () { this.x = 0; this.y++; };
    Screen.prototype.text = function () {
        const out = [];
        for (let r = 0; r < this.rows.length; r++) {
            let line = ""; const row = this.rows[r] || [];
            for (let c = 0; c < row.length; c++) line += row[c] === undefined ? " " : row[c];
            out.push(line.replace(/\s+$/, ""));
        }
        return out.join("\n");
    };

    // ---------------------------------------------------------------- the machine
    const R_ADDR = 0x0448, P_ADDR = 0x0440;   // BBC resident integer variables R% and P%
    const SENTINEL = 0xFFF0;

    function Machine(ssdBase64, options) {
        options = options || {};
        const files = readDfs(b64ToBytes(ssdBase64));
        this.files = files;
        this.arr = readArrays(files["$.Arrays"]);
        this.mem = new Uint8Array(0x10000);
        this.cpu = new Cpu6502(this.mem);
        this.screen = new Screen();
        this.random = options.random || ((n) => 1 + Math.floor(Math.random() * n));
        this.patch012b = !!options.patch012b;     // intended form of the typo at @012b (06 -> 02)
        this.patch09c8 = !!options.patch09c8;     // bug fix at @09c8 (02 -> 03)
        // The engine's QUIT/EXIT (its DIFFERENCES 5), as the BASIC would do it: PROCt takes the whole
        // words QUIT and EXIT as verb 99 (always) and ignores XXX; service 0 - for which the BASIC
        // had no handler ("ON range at line 40") - asks "Do you really want to quit?".
        this.quitCommand = !!options.quitCommand;
        this.patches = options.patches || [];     // further approved fixes, written as bytecode (patches.js)
        this.patchBytes = [];
        if (this.patches.length) {
            const P = typeof Patches !== "undefined" ? Patches : require("./patches.js");
            this.patchBytes = P.build(this.patches);
            P.addMessages(this.arr, this.patches);
        }
        this.coverage = options.coverage || null;       // {ins:Set, taken:Set, notTaken:Set}
        this.stepLimit = options.stepLimit || 5000000;
        this.onInstruction = options.onInstruction || null;   // (offset, memory) at every bytecode instruction
        // 420 DEFPROCi: M%=&1900: T%=M%+31: R%=0: P%=0 ... *lo. Aladin 1900
        this.mem.set(files["$.ALADIN"], 0x1900);
        this.setInt(R_ADDR, 0); this.setInt(P_ADDR, 0);
        // BBC CALL parameter block: 2 params, both integer variables (type 4)
        this.mem[0x600] = 2;
        this.mem[0x601] = R_ADDR & 0xFF; this.mem[0x602] = R_ADDR >> 8; this.mem[0x603] = 4;
        this.mem[0x604] = P_ADDR & 0xFF; this.mem[0x605] = P_ADDR >> 8; this.mem[0x606] = 4;
        this.saves = options.saves || {};
        this.status = "new";
    }
    Machine.prototype.getInt = function (a) { const m = this.mem; return (m[a] | (m[a + 1] << 8) | (m[a + 2] << 16) | (m[a + 3] << 24)); };
    Machine.prototype.setInt = function (a, v) { const m = this.mem; m[a] = v & 0xFF; m[a + 1] = (v >> 8) & 0xFF; m[a + 2] = (v >> 16) & 0xFF; m[a + 3] = (v >> 24) & 0xFF; };

    // 720 DEFPROCs: PROCc("lo. !Start 1900"): !&70=&21C7: ?&1F93=10: CLS
    Machine.prototype.procS = function () {
        this.mem.set(this.files["$.!Start"], 0x1900);
        this.setInt(0x70, 0x21C7);
        this.mem[0x1F93] = 10;
        if (this.patch012b) this.mem[0x21C7 + 0x012b] = 0x02;
        if (this.patch09c8) this.mem[0x21C7 + 0x09c8] = 0x03;
        for (const [offset, bytes] of this.patchBytes) this.mem.set(bytes, 0x21C7 + offset);
        this.screen.clear();
    };

    // CALL &1FA6,R%,P%
    Machine.prototype.call = function () {
        const cpu = this.cpu, cov = this.coverage;
        cpu.s = 0xFF;
        const ret = SENTINEL - 1;
        cpu.push(ret >> 8); cpu.push(ret & 0xFF);
        cpu.pc = 0x1FA6;
        let n = 0;
        while (cpu.pc !== SENTINEL) {
            if (this.onInstruction && cpu.pc === 0x1FC7) this.onInstruction((this.mem[0x70] | (this.mem[0x71] << 8)) - 0x21C7, this.mem);
            if (cov) {
                const pc = cpu.pc;
                if (pc === 0x1FC7) cov.ins.add((this.mem[0x70] | (this.mem[0x71] << 8)) - 0x21C7);
                else if (pc === 0x2045) cov.taken.add((this.mem[0x70] | (this.mem[0x71] << 8)) - 0x21C7);
                else if (pc === 0x203D) cov.notTaken.add((this.mem[0x70] | (this.mem[0x71] << 8)) - 0x21C7);
            }
            cpu.step();
            if (++n > this.stepLimit) throw new Error("step limit (infinite loop?) bytecode pc=" + ((this.mem[0x70] | (this.mem[0x71] << 8)) - 0x21C7).toString(16));
        }
    };

    // Runs the BASIC main loop until the program needs keyboard input.
    // Returns an array of events; the last one tells what input is wanted.
    //   40 REPEAT:PROCs:REPEAT:CALL&1FA6,R%,P%:IFR%<>8ONR%GOSUB190,,,150,240,350,280
    //  110 UNTILR%=8:A%=GET:UNTILFALSE
    Machine.prototype.run = function () {
        const ev = [];
        this.events = ev;
        if (this.status === "new") { this.procS(); this.status = "running"; }
        let hostCalls = 0;
        for (;;) {
            if (++hostCalls > 50000) { this.status = "halted"; throw new Error("runaway: the game never asks for input again"); }
            this.call();
            const r = this.getInt(R_ADDR);
            if (r === 8) {                                   // UNTIL R%=8 : A%=GET
                ev.push({ type: "quit" });
                this.status = "waitkey";
                return ev;
            }
            switch (r) {
                case 1:                                      // 190 PRINTCHR$(8);:INPUTLINE""i$:PROCt:RETURN
                    this.screen.print("\b");
                    this.status = "input";
                    ev.push({ type: "input" });
                    return ev;
                case 4: {                                    // 150 PROCp(s$(P%)):RETURN
                    const p = this.getInt(P_ADDR);
                    ev.push({ type: "print", msg: p });
                    this.procP(this.arr.s[p]);
                    break;
                }
                case 5: {                                    // 240 P%=RND(P%):RETURN
                    const bound = this.getInt(P_ADDR);
                    let res;
                    if (bound > 1) res = this.random(bound);  // RND(n) n>1: integer 1..n
                    else res = 0;                            // RND(1)/RND(0): a fraction -> P% = 0
                    ev.push({ type: "random", bound: bound, result: res });
                    this.setInt(P_ADDR, res);
                    break;
                }
                case 6:                                      // 350 save
                    this.status = "saveAsk"; ev.push({ type: "saveAsk" }); return ev;
                case 7:                                      // 280 load
                    this.status = "loadAsk"; ev.push({ type: "loadAsk" }); return ev;
                case 0:
                    if (this.quitCommand) { this.status = "quitAsk"; ev.push({ type: "quitAsk" }); return ev; }
                    // fall through: the original BASIC stops
                default:                                     // ON R% GOSUB with no matching entry
                    ev.push({ type: "halt", reason: "ON range (R%=" + r + ")" });
                    this.status = "halted";
                    return ev;
            }
        }
    };

    // Deliver a line of keyboard input to whatever the program is waiting for
    Machine.prototype.submit = function (line) {
        const st = this.status;
        if (st === "input") { this.screen.clear(); this.procT(line); this.status = "running"; return this.run(); }
        if (st === "waitkey") { this.status = "new"; return this.run(); }   // A%=GET then UNTIL FALSE -> PROCs
        if (st === "quitAsk") {
            // INPUT"Do you really want to quit",a$:IFLEFT$(a$,1)<>"Y"RETURN ELSE (as R%=8: A%=GET, restart)
            if (line.trim().toUpperCase().charAt(0) !== "Y") { this.status = "running"; return this.run(); }
            this.status = "waitkey"; return [{ type: "quit" }];
        }
        if (st === "saveAsk") {
            // 350 INPUT"Save this situation",a$:IFLEFT$(a$,1)<>"Y"RETURN ELSE INPUT"Filename",n$:PROCc("sa. "+n$+" 1900 1F88")
            if (line.charAt(0) !== "Y") { this.status = "running"; return this.run(); }
            this.status = "saveName"; return [{ type: "saveName" }];
        }
        if (st === "saveName") { this.saves[line] = this.mem.slice(0x1900, 0x1F88); this.status = "running"; return this.run(); }
        if (st === "loadAsk") {
            if (line.charAt(0) !== "Y") { this.status = "running"; return this.run(); }
            this.status = "loadName"; return [{ type: "loadName" }];
        }
        if (st === "loadName") {
            const data = this.saves[line];
            if (!data) { this.status = "halted"; return [{ type: "halt", reason: "File not found" }]; }
            this.mem.set(data, 0x1900); this.status = "running"; return this.run();
        }
        throw new Error("submit in status " + st);
    };

    // 790 DEFPROCt: REPEAT: G%=FNr(FNn): IFG%=0THEN960 ... 960 UNTILi$=""
    Machine.prototype.procT = function (line) {
        const M = this.mem, base = 0x1900, R = this.arr.R;
        let i = line;
        do {
            // 990 DEFFNn: S%=INSTR(i$," "): IFS%=0 S%=LEN(i$)+1: w$=LEFT$(i$,S%-1): i$=MID$(i$,S%+1)
            let S = i.indexOf(" ") + 1;
            if (S === 0) S = i.length + 1;
            const w = i.substring(0, S - 1);
            i = i.substring(S);
            if (this.quitCommand && (w === "QUIT" || w === "EXIT")) { M[base + 14] = 99; continue; }
            const G = this.fnR(w);
            if (G !== 0 && !(this.quitCommand && R[G][2] === 1 && R[G][1] === 99)) {
                const val = R[G][1];
                switch (R[G][2]) {                       // 830 ON R%(G%,2) GOTO 850,880,920,950
                    case 1: if (M[base + 14] === 0) M[base + 14] = val & 0xFF; break;
                    case 2: if (M[base + 1] === 0) M[base + 1] = val & 0xFF; else if (M[base + 2] === 0) M[base + 2] = val & 0xFF; break;
                    case 3: if (M[base + 11] === 0) M[base + 11] = ((M[base + 9] + val + 3) % 4 + 1) & 0xFF; break;
                    case 4: if (M[base + 4] === 0) M[base + 4] = val & 0xFF; break;
                    default: throw new Error("ON range in PROCt");
                }
            }
        } while (i !== "");
    };

    // 1070 DEFFNr(w$): binary search of the vocabulary with prefix matching
    Machine.prototype.fnR = function (w) {
        if (w === "") return 0;
        const R = this.arr.R, W = this.arr.w;
        let L = 1, H = this.arr.N;
        for (;;) {
            if (L > H) return 0;
            const U = Math.floor((L + H) / 2);
            const r = W[R[U][0]].substring(0, w.length);
            const wp = w.substring(0, r.length);
            if (r < wp) { L = U + 1; continue; }
            if (r > wp) { H = U - 1; continue; }
            return U;
        }
    };

    // 1180 DEFPROCp(t$)
    Machine.prototype.procP = function (t) {
        const W = this.arr.w, D = this.arr.d, T = 0x1900 + 31;
        do {
            const w = W[0x80 * t.charCodeAt(0) + t.charCodeAt(1)];
            if (w === undefined) throw new Error("bad word code");
            t = t.substring(2);
            if (w.charAt(0) !== "$") { this.procR(w); continue; }
            const B = parseInt(w.substring(1), 10) || 0;          // VAL(MID$(w$,2))
            if (B === 0) { this.screen.newline(); continue; }     // PRINT
            if (B > 13) { this.procR(String(this.mem[T + B])); continue; }
            const di = this.mem[T + B];
            if (di >= D.length) { this.events.push({ type: "error", reason: "Subscript d$(" + di + ")" }); throw new Error("BASIC error: Subscript d$(" + di + ")"); }
            t = D[di] + t;
        } while (t !== "");
    };
    // 1310 DEFPROCr(w$)
    Machine.prototype.procR = function (w) {
        const sc = this.screen;
        if (!(sc.x + w.length < 39)) {
            if (!(w.charCodeAt(0) === 8 && w.length === 2)) {
                sc.newline();
                if (w.charCodeAt(0) === 8) sc.print(" ");
            }
        }
        sc.print(w + " ");
    };

    // The 1672 bytes a *SAVE would write (&1900-&1F87)
    Machine.prototype.state = function () { return this.mem.slice(0x1900, 0x1F88); };

    return { Machine, readDfs, readArrays, b64ToBytes, Screen };
})();

if (typeof module !== "undefined") module.exports = Ref;
