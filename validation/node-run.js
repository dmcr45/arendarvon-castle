// Runs one of the validation HTML pages under Node.js instead of a browser:
//   node node-run.js "campaign.html?seeds=4&games=15&commands=150"
// The page's <script src> files and inline scripts run in order in one global scope,
// with just enough of 'document' and 'location' for the pages to work.
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const arg = process.argv[2];
if (!arg) { console.error("usage: node node-run.js page.html[?query]"); process.exit(2); }
const [page, query] = arg.split("?");
const file = path.resolve(__dirname, page);
const html = fs.readFileSync(file, "utf8");

global.location = { search: query ? "?" + query : "" };
global.document = { getElementById: () => ({ set textContent(v) { process.stdout.write(v + "\n"); } }) };
global.window = global;
global.atob = (b64) => Buffer.from(b64, "base64").toString("binary");

const re = /<script(?:\s+src="([^"]+)")?\s*>([\s\S]*?)<\/script>/g;
let m;
while ((m = re.exec(html)) !== null) {
    if (m[1]) {
        const src = path.resolve(path.dirname(file), m[1]);
        vm.runInThisContext(fs.readFileSync(src, "utf8"), { filename: src });
    } else if (m[2].trim()) {
        vm.runInThisContext(m[2], { filename: file + " (inline)" });
    }
}
