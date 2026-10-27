// NMOS 6502 core (all 151 documented opcodes, binary mode), table-driven with integer codes.
// Used only as the validation reference: it executes the real ALADIN VM machine code.
"use strict";

function Cpu6502(mem) {
    this.m = mem;
    this.a = 0; this.x = 0; this.y = 0; this.s = 0xFF; this.pc = 0;
    this.n = 0; this.v = 0; this.d = 0; this.i = 0; this.z = 0; this.c = 0;
    this.steps = 0;
}

(function () {
    const MN = ["BRK","ORA","ASL","PHP","BPL","CLC","JSR","AND","BIT","ROL","PLP","BMI","SEC","RTI","EOR","LSR","PHA","JMP","BVC","CLI",
                "RTS","ADC","ROR","PLA","BVS","SEI","STA","STY","STX","DEY","TXA","BCC","TYA","TXS","LDY","LDA","LDX","TAY","TAX","BCS",
                "CLV","TSX","CPY","CMP","DEC","INY","DEX","BNE","CLD","CPX","SBC","INC","INX","NOP","BEQ","SED"];
    const MODES = ["imp","acc","imm","zp","zpx","zpy","izx","izy","abs","abx","aby","ind","rel"];
    const OPS = new Int16Array(256).fill(-1), AM = new Int8Array(256).fill(-1);
    `00 BRK imp|01 ORA izx|05 ORA zp|06 ASL zp|08 PHP imp|09 ORA imm|0A ASL acc|0D ORA abs|0E ASL abs|
10 BPL rel|11 ORA izy|15 ORA zpx|16 ASL zpx|18 CLC imp|19 ORA aby|1D ORA abx|1E ASL abx|
20 JSR abs|21 AND izx|24 BIT zp|25 AND zp|26 ROL zp|28 PLP imp|29 AND imm|2A ROL acc|2C BIT abs|2D AND abs|2E ROL abs|
30 BMI rel|31 AND izy|35 AND zpx|36 ROL zpx|38 SEC imp|39 AND aby|3D AND abx|3E ROL abx|
40 RTI imp|41 EOR izx|45 EOR zp|46 LSR zp|48 PHA imp|49 EOR imm|4A LSR acc|4C JMP abs|4D EOR abs|4E LSR abs|
50 BVC rel|51 EOR izy|55 EOR zpx|56 LSR zpx|58 CLI imp|59 EOR aby|5D EOR abx|5E LSR abx|
60 RTS imp|61 ADC izx|65 ADC zp|66 ROR zp|68 PLA imp|69 ADC imm|6A ROR acc|6C JMP ind|6D ADC abs|6E ROR abs|
70 BVS rel|71 ADC izy|75 ADC zpx|76 ROR zpx|78 SEI imp|79 ADC aby|7D ADC abx|7E ROR abx|
81 STA izx|84 STY zp|85 STA zp|86 STX zp|88 DEY imp|8A TXA imp|8C STY abs|8D STA abs|8E STX abs|
90 BCC rel|91 STA izy|94 STY zpx|95 STA zpx|96 STX zpy|98 TYA imp|99 STA aby|9A TXS imp|9D STA abx|
A0 LDY imm|A1 LDA izx|A2 LDX imm|A4 LDY zp|A5 LDA zp|A6 LDX zp|A8 TAY imp|A9 LDA imm|AA TAX imp|AC LDY abs|AD LDA abs|AE LDX abs|
B0 BCS rel|B1 LDA izy|B4 LDY zpx|B5 LDA zpx|B6 LDX zpy|B8 CLV imp|B9 LDA aby|BA TSX imp|BC LDY abx|BD LDA abx|BE LDX aby|
C0 CPY imm|C1 CMP izx|C4 CPY zp|C5 CMP zp|C6 DEC zp|C8 INY imp|C9 CMP imm|CA DEX imp|CC CPY abs|CD CMP abs|CE DEC abs|
D0 BNE rel|D1 CMP izy|D5 CMP zpx|D6 DEC zpx|D8 CLD imp|D9 CMP aby|DD CMP abx|DE DEC abx|
E0 CPX imm|E1 SBC izx|E4 CPX zp|E5 SBC zp|E6 INC zp|E8 INX imp|E9 SBC imm|EA NOP imp|EC CPX abs|ED SBC abs|EE INC abs|
F0 BEQ rel|F1 SBC izy|F5 SBC zpx|F6 INC zpx|F8 SED imp|F9 SBC aby|FD SBC abx|FE INC abx`
        .split("|").map(s => s.trim()).filter(s => s).forEach(s => {
            const p = s.split(" "), op = parseInt(p[0], 16);
            OPS[op] = MN.indexOf(p[1]); AM[op] = MODES.indexOf(p[2]);
            if (OPS[op] < 0 || AM[op] < 0) throw new Error("table " + s);
        });
    Cpu6502.OPS = OPS; Cpu6502.AM = AM; Cpu6502.MN = MN;
})();

Cpu6502.prototype.push = function (b) { this.m[0x100 + this.s] = b & 0xFF; this.s = (this.s - 1) & 0xFF; };
Cpu6502.prototype.pull = function () { this.s = (this.s + 1) & 0xFF; return this.m[0x100 + this.s]; };
Cpu6502.prototype.getP = function () {
    return (this.n << 7) | (this.v << 6) | 0x30 | (this.d << 3) | (this.i << 2) | (this.z << 1) | this.c;
};
Cpu6502.prototype.setP = function (p) {
    this.n = (p >> 7) & 1; this.v = (p >> 6) & 1; this.d = (p >> 3) & 1; this.i = (p >> 2) & 1; this.z = (p >> 1) & 1; this.c = p & 1;
};

Cpu6502.prototype.step = function () {
    const m = this.m;
    const opcode = m[this.pc];
    const op = Cpu6502.OPS[opcode], mode = Cpu6502.AM[opcode];
    if (op < 0) throw new Error("illegal opcode " + opcode.toString(16) + " at " + this.pc.toString(16));
    let pc = (this.pc + 1) & 0xFFFF, addr = 0;
    switch (mode) {
        case 0: case 1: break;                                                         // imp, acc
        case 2: addr = pc; pc = (pc + 1) & 0xFFFF; break;                              // imm
        case 3: addr = m[pc]; pc = (pc + 1) & 0xFFFF; break;                           // zp
        case 4: addr = (m[pc] + this.x) & 0xFF; pc = (pc + 1) & 0xFFFF; break;         // zpx
        case 5: addr = (m[pc] + this.y) & 0xFF; pc = (pc + 1) & 0xFFFF; break;         // zpy
        case 6: { const z = (m[pc] + this.x) & 0xFF; addr = m[z] | (m[(z + 1) & 0xFF] << 8); pc = (pc + 1) & 0xFFFF; break; }
        case 7: { const z = m[pc]; addr = ((m[z] | (m[(z + 1) & 0xFF] << 8)) + this.y) & 0xFFFF; pc = (pc + 1) & 0xFFFF; break; }
        case 8: addr = m[pc] | (m[(pc + 1) & 0xFFFF] << 8); pc = (pc + 2) & 0xFFFF; break;
        case 9: addr = ((m[pc] | (m[(pc + 1) & 0xFFFF] << 8)) + this.x) & 0xFFFF; pc = (pc + 2) & 0xFFFF; break;
        case 10: addr = ((m[pc] | (m[(pc + 1) & 0xFFFF] << 8)) + this.y) & 0xFFFF; pc = (pc + 2) & 0xFFFF; break;
        case 11: { const p = m[pc] | (m[(pc + 1) & 0xFFFF] << 8); addr = m[p] | (m[(p & 0xFF00) | ((p + 1) & 0xFF)] << 8); pc = (pc + 2) & 0xFFFF; break; }
        case 12: { const off = m[pc]; pc = (pc + 1) & 0xFFFF; addr = (pc + (off < 128 ? off : off - 256)) & 0xFFFF; break; }
    }
    this.pc = pc;
    let v, t;
    switch (op) {
        case 0: throw new Error("BRK at " + ((pc - 1) & 0xFFFF).toString(16));          // BRK
        case 1: v = this.a |= m[addr]; this.n = v >> 7; this.z = v === 0 ? 1 : 0; break; // ORA
        case 2: case 15: case 9: case 22: {                                              // ASL LSR ROL ROR
            v = mode === 1 ? this.a : m[addr];
            if (op === 2) { this.c = v >> 7; t = (v << 1) & 0xFF; }
            else if (op === 15) { this.c = v & 1; t = v >> 1; }
            else if (op === 9) { t = ((v << 1) | this.c) & 0xFF; this.c = v >> 7; }
            else { t = (v >> 1) | (this.c << 7); this.c = v & 1; }
            this.n = t >> 7; this.z = t === 0 ? 1 : 0;
            if (mode === 1) this.a = t; else m[addr] = t;
            break;
        }
        case 3: this.push(this.getP()); break;                                           // PHP
        case 4: if (!this.n) this.pc = addr; break;                                      // BPL
        case 5: this.c = 0; break;                                                       // CLC
        case 6: t = (this.pc - 1) & 0xFFFF; this.push(t >> 8); this.push(t); this.pc = addr; break;   // JSR
        case 7: v = this.a &= m[addr]; this.n = v >> 7; this.z = v === 0 ? 1 : 0; break; // AND
        case 8: v = m[addr]; this.z = (this.a & v) === 0 ? 1 : 0; this.n = v >> 7; this.v = (v >> 6) & 1; break;   // BIT
        case 10: this.setP(this.pull()); break;                                          // PLP
        case 11: if (this.n) this.pc = addr; break;                                      // BMI
        case 12: this.c = 1; break;                                                      // SEC
        case 13: this.setP(this.pull()); t = this.pull(); t |= this.pull() << 8; this.pc = t; break;   // RTI
        case 14: v = this.a ^= m[addr]; this.n = v >> 7; this.z = v === 0 ? 1 : 0; break; // EOR
        case 16: this.push(this.a); break;                                               // PHA
        case 17: this.pc = addr; break;                                                  // JMP
        case 18: if (!this.v) this.pc = addr; break;                                     // BVC
        case 19: this.i = 0; break;                                                      // CLI
        case 20: t = this.pull(); t |= this.pull() << 8; this.pc = (t + 1) & 0xFFFF; break;   // RTS
        case 21: case 50:                                                                // ADC SBC
            if (this.d) throw new Error("decimal mode not supported");
            v = m[addr]; if (op === 50) v ^= 0xFF;
            t = this.a + v + this.c;
            this.v = (~(this.a ^ v) & (this.a ^ t) & 0x80) ? 1 : 0;
            this.c = t > 0xFF ? 1 : 0;
            this.a = t & 0xFF; this.n = this.a >> 7; this.z = this.a === 0 ? 1 : 0;
            break;
        case 23: this.a = this.pull(); this.n = this.a >> 7; this.z = this.a === 0 ? 1 : 0; break;   // PLA
        case 24: if (this.v) this.pc = addr; break;                                      // BVS
        case 25: this.i = 1; break;                                                      // SEI
        case 26: m[addr] = this.a; break;                                                // STA
        case 27: m[addr] = this.y; break;                                                // STY
        case 28: m[addr] = this.x; break;                                                // STX
        case 29: this.y = (this.y - 1) & 0xFF; this.n = this.y >> 7; this.z = this.y === 0 ? 1 : 0; break;   // DEY
        case 30: this.a = this.x; this.n = this.a >> 7; this.z = this.a === 0 ? 1 : 0; break;   // TXA
        case 31: if (!this.c) this.pc = addr; break;                                     // BCC
        case 32: this.a = this.y; this.n = this.a >> 7; this.z = this.a === 0 ? 1 : 0; break;   // TYA
        case 33: this.s = this.x; break;                                                 // TXS
        case 34: this.y = m[addr]; this.n = this.y >> 7; this.z = this.y === 0 ? 1 : 0; break;   // LDY
        case 35: this.a = m[addr]; this.n = this.a >> 7; this.z = this.a === 0 ? 1 : 0; break;   // LDA
        case 36: this.x = m[addr]; this.n = this.x >> 7; this.z = this.x === 0 ? 1 : 0; break;   // LDX
        case 37: this.y = this.a; this.n = this.y >> 7; this.z = this.y === 0 ? 1 : 0; break;   // TAY
        case 38: this.x = this.a; this.n = this.x >> 7; this.z = this.x === 0 ? 1 : 0; break;   // TAX
        case 39: if (this.c) this.pc = addr; break;                                      // BCS
        case 40: this.v = 0; break;                                                      // CLV
        case 41: this.x = this.s; this.n = this.x >> 7; this.z = this.x === 0 ? 1 : 0; break;   // TSX
        case 42: case 43: case 49: {                                                     // CPY CMP CPX
            const r = op === 43 ? this.a : (op === 49 ? this.x : this.y);
            v = m[addr]; t = (r - v) & 0xFF;
            this.c = r >= v ? 1 : 0; this.n = t >> 7; this.z = t === 0 ? 1 : 0;
            break;
        }
        case 44: t = (m[addr] - 1) & 0xFF; m[addr] = t; this.n = t >> 7; this.z = t === 0 ? 1 : 0; break;   // DEC
        case 45: this.y = (this.y + 1) & 0xFF; this.n = this.y >> 7; this.z = this.y === 0 ? 1 : 0; break;   // INY
        case 46: this.x = (this.x - 1) & 0xFF; this.n = this.x >> 7; this.z = this.x === 0 ? 1 : 0; break;   // DEX
        case 47: if (!this.z) this.pc = addr; break;                                     // BNE
        case 48: this.d = 0; break;                                                      // CLD
        case 51: t = (m[addr] + 1) & 0xFF; m[addr] = t; this.n = t >> 7; this.z = t === 0 ? 1 : 0; break;   // INC
        case 52: this.x = (this.x + 1) & 0xFF; this.n = this.x >> 7; this.z = this.x === 0 ? 1 : 0; break;   // INX
        case 53: break;                                                                  // NOP
        case 54: if (this.z) this.pc = addr; break;                                      // BEQ
        case 55: this.d = 1; break;                                                      // SED
    }
    this.steps++;
};

if (typeof module !== "undefined") module.exports = Cpu6502;
