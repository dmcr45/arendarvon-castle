// Decodes the ALADIN bytecode from the SSD (independently of the C# tools):
// instruction boundaries by recursive descent from @0000 and @1770.
// Bytecode.list/code describe the program as it is on the disc;
// Bytecode.analyse(changes) does the same for a patched copy ([offset, [bytes]] pairs).
"use strict";

const Bytecode = (function () {
    const files = Ref.readDfs(Ref.b64ToBytes(SSD_BASE64));
    const original = files["$.ALADIN"];            // loaded at &1900
    const BASE = 0x21C7 - 0x1900;

    function analyse(changes) {
        const image = original.slice();
        for (const [off, bytes] of changes || []) image.set(bytes, BASE + off);
        const END = image.length - BASE;
        const B = (off) => image[BASE + off];

        function decode(off) {
            const op = B(off);
            if (op === 0xC4) return { off, len: 3, kind: "goto", target: B(off + 1) | (B(off + 2) << 8), falls: false };
            if ((op & 0xF0) === 0x80) return { off, len: 2, kind: "print", msg: ((op & 15) << 8) | B(off + 1), falls: true };
            if ((op & 0xC0) === 0x40) return { off, len: 5, kind: "assign", falls: true };
            if ((op & 0xC0) === 0x00) return { off, len: 7, kind: "if", target: B(off + 5) | (B(off + 6) << 8), falls: true };
            if ((op & 0xC0) === 0xC0) {
                const s = B(off + 1);
                return { off, len: 6, kind: s === 3 ? "return" : (s < 10 ? "host" : "sys"), service: s, falls: s !== 3 };
            }
            return { off, len: 1, kind: "undefined", falls: false };
        }

        const code = new Map();
        const work = [0x0000, 0x1770];
        while (work.length) {
            let off = work.pop();
            while (off >= 0 && off < END && !code.has(off)) {
                const ins = decode(off);
                code.set(off, ins);
                if (ins.target !== undefined && !code.has(ins.target)) work.push(ins.target);
                if (!ins.falls) break;
                off += ins.len;
            }
        }
        const list = Array.from(code.values()).sort((a, b) => a.off - b.off);
        return { list, code, decode, B };
    }

    const disc = analyse([]);
    return { list: disc.list, code: disc.code, decode: disc.decode, B: disc.B, analyse };
})();
