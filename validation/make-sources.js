// Regenerates engine-source.js and terminal-source.js - copies of ../arendarvon-engine.js
// and ../arendarvon.js as JavaScript strings, read by audit.html and terminal_sim.html.
// Run it after editing either file:
//   node make-sources.js
"use strict";
const fs = require("fs");
const path = require("path");
const wrap = (file, name, out) => fs.writeFileSync(path.join(__dirname, out),
    "const " + name + " = " + JSON.stringify(fs.readFileSync(path.join(__dirname, "..", file), "utf8")) + ";\n");
wrap("arendarvon-engine.js", "ENGINE_SOURCE", "engine-source.js");
wrap("arendarvon.js", "TERMINAL_SOURCE", "terminal-source.js");
