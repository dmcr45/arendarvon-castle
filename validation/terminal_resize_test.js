// Runs arendarvon.js in a simulated terminal: types commands, changes the window width
// and checks that the whole text is printed again, wrapped to the new width, with the
// prompt and the half-typed command restored.
//   node terminal_resize_test.js
"use strict";
const { PassThrough } = require("stream");

const input = new PassThrough();
input.isTTY = true;
input.setRawMode = () => input;
Object.defineProperty(process, "stdin", { value: input, configurable: true });

let columns = 80, screen = "";
const out = process.stdout;
const realWrite = out.write.bind(out);
out.isTTY = true;
Object.defineProperty(out, "columns", { get: () => columns, configurable: true });
Object.defineProperty(out, "rows", { get: () => 25, configurable: true });
out.write = (s) => { screen += String(s); return true; };

const report = [];
const check = (name, ok, detail) => report.push((ok ? "PASS  " : "FAIL  ") + name + (detail ? "  " + detail : ""));
const plain = (s) => s.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "").replace(/\r/g, "");
const afterLastClear = () => {
    const i = screen.lastIndexOf("\x1b[3J");
    return i < 0 ? null : plain(screen.substring(i));
};
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const type = async (text) => { input.write(text); await wait(30); };
const resize = async (width) => {            // dragging a window edge sends a burst of events
    for (let w = columns; w !== width; w += Math.sign(width - w)) { columns = w; out.emit("resize"); }
    columns = width; out.emit("resize");
    await wait(250);
};

(async () => {
    require("../arendarvon.js");
    await wait(50);
    await type("look\r");
    await type("go ahead\r");
    await type("take to");                       // typed but not entered
    const before = plain(screen);

    await resize(40);
    let shown = afterLastClear();
    check("resize to 40 columns redraws", shown !== null);
    const lines40 = shown.split("\n");
    const longest40 = Math.max(...lines40.map((l) => l.length));
    check("every line fits in 40 columns", longest40 <= 39, "longest " + longest40);
    check("the typed commands are still there", /> look/.test(shown) && /> go ahead/.test(shown));
    check("the prompt and the half-typed command come back", /> take to$/.test(shown), JSON.stringify(lines40.slice(-1)[0]));
    const words = (s) => s.replace(/> take to\s*$/, "").split(/\s+/).filter(Boolean).join(" ");
    check("same words as before the resize", words(shown) === words(before));

    await resize(120);
    shown = afterLastClear();
    const lines120 = shown.split("\n");
    const longest120 = Math.max(...lines120.map((l) => l.length));
    check("resize to 120 columns re-wraps wider", longest120 > 40 && longest120 <= 119, "longest " + longest120);
    check("fewer lines at 120 than at 40", lines120.length < lines40.length, lines120.length + " < " + lines40.length);
    check("same words at 120 columns", words(shown) === words(before));

    const clears = (screen.match(/\x1b\[3J/g) || []).length;
    await type("\r");                            // finish the command: "take to" -> TAKE TORCH?
    check("one redraw per resize (events are combined)", clears === 2, clears + " redraws");
    check("the game goes on after a redraw", /> take to\n/.test(plain(screen)));

    out.write = realWrite;
    realWrite(report.join("\n") + "\n\n---- the screen after the last redraw (120 columns) ----\n" + shown + "\n");
    process.exit(0);
})();
