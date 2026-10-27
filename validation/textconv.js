// Converts the original coded word strings (pairs of word numbers; words starting with
// CHR$(8) glue onto the previous word) into readable strings, and back-checks them.
"use strict";

const TextConv = (function () {
    function words(A, coded) {
        const ws = [];
        for (let i = 0; i + 1 < coded.length; i += 2) ws.push(A.w[0x80 * coded.charCodeAt(i) + coded.charCodeAt(i + 1)]);
        return ws;
    }
    // Readable form: a glued word is appended to the previous token without a space.
    // A glued word at the very start keeps its CHR$(8) as "\b".
    function readable(A, coded) {
        const toks = [];
        for (const w of words(A, coded)) {
            if (w.charCodeAt(0) === 8) {
                if (toks.length === 0) toks.push(w);
                else toks[toks.length - 1] += w.substring(1);
            } else toks.push(w);
        }
        return toks.join(" ");
    }
    // Logical output of the ORIGINAL word list (no column wrapping): each word is printed
    // followed by a space; CHR$(8) deletes the character before it. $n handled by subst(n)
    // which returns {codedDesc} or {number}.
    function renderOriginal(A, coded, subst) {
        let out = "";
        let t = coded;
        let guard = 0;
        while (t !== "" && guard++ < 10000) {
            const w = A.w[0x80 * t.charCodeAt(0) + t.charCodeAt(1)];
            t = t.substring(2);
            if (w.charAt(0) !== "$") { out = putWord(out, w); continue; }
            const B = parseInt(w.substring(1), 10) || 0;
            if (B === 0) { out = out + "\n"; continue; }
            const s = subst(B);
            if (s.number !== undefined) { out = putWord(out, String(s.number)); continue; }
            t = A.d[s.desc] + t;
        }
        return out;
    }
    function putWord(out, w) {
        if (w.charCodeAt(0) === 8) { out = out.substring(0, out.length - 1); w = w.substring(1); }
        return out + w + " ";
    }
    return { words, readable, renderOriginal, putWord };
})();

if (typeof module !== "undefined") module.exports = TextConv;
