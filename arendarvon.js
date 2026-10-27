#!/usr/bin/env node
/*
 * THE SECRET OF ARENDARVON CASTLE - terminal front end
 *
 * Usage:   node arendarvon.js
 * Needs:   Node.js, and arendarvon-engine.js in the same folder.
 *
 * Text is shown in ordinary capitals (the game itself prints in capitals, as
 * the BBC did), word-wrapped to the width of the terminal, and re-wrapped if
 * the window changes size. Up/down arrows recall earlier commands. Saved games
 * are written as readable JSON files in a "saves" folder next to this
 * script. Ctrl+C quits.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const createArendarvonGame = require("./arendarvon-engine.js");

const SAVE_FOLDER = path.join(__dirname, "saves");

// The file for a save name: saves\<name>.json, in lower case (as the browser
// version's downloads are), with anything but letters, digits, _ and - as _.
function saveFile(name) {
    const safe = name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_");
    return safe === "" ? null : path.join(SAVE_FOLDER, safe + ".json");
}

const game = createArendarvonGame({
    storage: {
        save(name, text) {
            const file = saveFile(name);
            if (file === null) return false;
            try {
                fs.mkdirSync(SAVE_FOLDER, { recursive: true });
                fs.writeFileSync(file, text, "utf8");
                return true;
            } catch (e) {
                return false;
            }
        },
        load(name) {
            const file = saveFile(name);
            if (file === null) return null;
            try {
                return fs.readFileSync(file, "utf8");
            } catch (e) {
                return null;
            }
        },
    },
});

// The game prints in capitals, as the BBC did. readableCase() shows a reply in
// ordinary English capitals instead: lower case, with a capital at the start of
// each sentence, line and quotation, "I", and the title.
// (The same function is in arendarvon.html.)
function readableCase(text) {
    return text.toLowerCase()
        .replace(/\bi\b/g, "I")
        .replace("** the secret of arendarvon castle **", "** The Secret of Arendarvon Castle **")
        .replace(/<return>/g, "<Return>")
        .replace(/(^\s*|\n\s*|[.!?]'?\s+|:\s*')([a-z])/g, (m, before, c) => before + c.toUpperCase());
}

// Word-wrap one line of text to the terminal width.
function wrap(line, width) {
    const limit = Math.max(20, width - 1);
    const out = [];
    let current = "";
    for (const word of line.split(" ")) {
        if (current === "") current = word;
        else if (current.length + 1 + word.length <= limit) current += " " + word;
        else { out.push(current); current = word; }
    }
    out.push(current);
    return out.join("\n");
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, historySize: 200 });
const terminalWidth = () => process.stdout.columns || 80;

// Everything shown since the game (re)started, as unwrapped lines - the
// game's text and the commands typed - so that it can be re-wrapped when the
// window changes size. The oldest lines are dropped beyond MAX_TRANSCRIPT.
const transcript = [];
const MAX_TRANSCRIPT = 5000;
let currentPrompt = "";          // the prompt line being answered ("" if none)

function remember(line) {
    transcript.push(line);
    if (transcript.length > MAX_TRANSCRIPT) transcript.splice(0, transcript.length - MAX_TRANSCRIPT);
}

// Print a line of text, wrapped, and remember it.
function printLine(line) {
    remember(line);
    process.stdout.write(wrap(line, terminalWidth()) + "\n");
}

// Make promptLine the input prompt. If it is too long for one line, all but
// its last wrapped piece is printed and the last piece becomes the prompt.
function setPrompt(promptLine) {
    currentPrompt = promptLine;
    const wrapped = wrap(promptLine, terminalWidth()).split("\n");
    const last = wrapped.pop();
    if (wrapped.length) process.stdout.write(wrapped.join("\n") + "\n");
    rl.setPrompt(last === "" ? "" : last + " ");
}

// Show a reply. Its last line (">" or a question) becomes the input prompt.
function show(reply) {
    if (reply.newGame) {
        transcript.length = 0;
        if (process.stdout.isTTY) process.stdout.write("\x1b[2J\x1b[H");
    }
    const lines = readableCase(reply.text).split("\n");
    let promptLine = lines.pop();
    for (const line of lines) printLine(line);
    if (reply.waitingFor === "restart") {
        if (promptLine !== "") printLine(promptLine);
        promptLine = reply.text.includes("PRESS <RETURN>") ? "" : "(press Enter to play again)";
    }
    setPrompt(promptLine);
    rl.prompt();
}

// When the window changes size: clear the screen (and what has scrolled off
// it), print everything again wrapped to the new width, then the prompt with
// whatever has been typed so far. Resizing sends many events; only the last
// one, after a tenth of a second of quiet, redraws.
let redrawTimer = null;
function redraw() {
    process.stdout.write("\x1b[2J\x1b[3J\x1b[H");
    const width = terminalWidth();
    if (transcript.length) process.stdout.write(transcript.map((line) => wrap(line, width)).join("\n") + "\n");
    setPrompt(currentPrompt);
    rl.prevRows = 0;             // readline's note of where its input line was; the screen is new
    rl.prompt(true);             // true: keep the typed text and the cursor where they are
}
if (process.stdout.isTTY) {
    process.stdout.on("resize", () => {
        clearTimeout(redrawTimer);
        redrawTimer = setTimeout(redraw, 100);
    });
}

rl.on("line", (line) => {
    remember(currentPrompt === "" ? line : currentPrompt + " " + line);
    show(game.submit(line));
});
rl.on("SIGINT", () => rl.close());
rl.on("close", () => {
    process.stdout.write("\n");
    process.exit(0);
});

show(game.start());
