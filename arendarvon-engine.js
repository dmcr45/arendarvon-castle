/* =============================================================================
 *
 *   THE SECRET OF ARENDARVON CASTLE  (1985)
 *   Game engine, refactored from the original ALADIN bytecode
 *
 * =============================================================================
 *
 *  WHAT THIS FILE IS
 *  -----------------
 *  The complete game - rules, command parser, message printer and world data -
 *  as one self-contained JavaScript file. It needs neither the BBC BASIC host
 *  program nor the ALADIN virtual machine. A front end (arendarvon.html for a
 *  browser, arendarvon.js for a terminal) calls createArendarvonGame(io), shows
 *  the text it returns and passes every line the player types to submit().
 *  This file never touches the screen, keyboard or disk itself.
 *
 *  WHERE IT COMES FROM
 *  -------------------
 *  Source disc: Disc999-SecretOfArendarvonCastle.ssd (BBC Micro, Acorn DFS)
 *    $.ALADIN   the ALADIN virtual machine in 6502 code (&1F88-&21C6) followed
 *               by the game itself as bytecode (&21C7-&3DFF)
 *    $.AREND    the BBC BASIC host: keyboard, parser, printer, RND, SAVE, LOAD
 *    $.Arrays   the vocabulary, 211 messages and 173 descriptions
 *    $.!Start   the world as it is at the start of a game (1672 bytes that the
 *               BASIC loads at &1900-&1F87 before every new game)
 *
 *  PART 1  constants and names                    (from the data layout)
 *  PART 2  game state                             (the original 1672 bytes)
 *  PART 3  host services: printer, parser,        (replaces BASIC $.AREND)
 *          random numbers, save/load
 *  PART 4  game logic                             (the 1420 bytecode instructions)
 *  PART 5  game data                              (from $.Arrays and $.!Start)
 *  PART 6  public interface for the front ends
 *
 *  HOW TO READ THE GAME LOGIC
 *  --------------------------
 *  - Traceability. Every statement in PART 4 ends with a comment "// @xxxx"
 *    giving the offset of the bytecode instruction(s) it was written from,
 *    relative to the start of the bytecode at &21C7 (so @0214 is address
 *    &23DB). "@0a3f-0a5b" means a run of instructions folded into one
 *    statement; "@00a0,00b1" lists several. The original's GOTO instructions
 *    became program structure (if/else, loops, return) and are only tagged
 *    where a statement such as "return" stands in for them. A comment
 *    "(FIX n)" marks code that differs from the original on purpose; see
 *    DIFFERENCES FROM THE 1985 PROGRAM below.
 *
 *  - Globals. As in the original, all game variables are global to the game
 *    (see PART 2). Local variables (let/const inside a function) are used only
 *    for values the original kept in its scratch bytes - random numbers,
 *    subroutine results, loop counters - which nothing reads afterwards.
 *
 *  - Bytes. Every number in the game is one unsigned byte, 0 to 255. The
 *    original's arithmetic never wraps round: it sticks at the limit. So
 *    plus(a, b) stops at 255 and minus(a, b) stops at 0. That matters: for
 *    example "too tired to move" is detected by strength reaching exactly 0.
 *    Plain ++ is used only for counters that provably stay small.
 *
 *  - Text. say("YOU GO $8.") prints a message word by word. $1-$16 are
 *    replaced when printing (see substitution()), $0 starts a new line, and a
 *    word written directly after $n with no space ("$8.") is joined to it.
 *
 *  - Subroutines. The original had one bytecode subroutine entry, a dispatcher
 *    at @1770, selected by a number (10-18) with two arguments passed in global
 *    bytes. Each case is now a normal function with parameters, for example
 *    findObjectAt(object, where) for "SYS 10". Printing ("SYS 2") became say().
 *
 *  - Ending a game. In the original, winning or dying asked BASIC to QUIT,
 *    which restarts the whole program, so nothing after it ever ran. Here
 *    hostQuit() throws an exception, which likewise abandons the rest of the turn.
 *    So winGame() and die() never return. The "break" that JavaScript needs
 *    after them in a switch is marked "(never reached)"; where it is tagged,
 *    it stands for the original's jump after the call, which never ran either.
 *
 *  DIFFERENCES FROM THE 1985 PROGRAM (all deliberate)
 *  -------------------------------------------------
 *  1. @012b: the original bytes 06 02 01 00 00 4C 01 used opcode 06 where 02
 *     ("if the second noun is 0") was meant, so the test never skipped the
 *     object lookup. It is written here as the author intended. This has no
 *     visible effect (proven in the verification report).
 *  2. Typed commands are turned into capitals. The BBC needed CAPS LOCK on.
 *  3. Text is not wrapped at column 39 (the BBC's 40-column screen); the front
 *     end wraps it to fit the window. Words are joined exactly as before.
 *  4. SAVE and LOAD use a readable JSON file instead of a memory dump, and a
 *     missing or damaged file gives a message instead of stopping the program.
 *  5. QUIT or EXIT asks "Do you really want to quit?" (or "...exit?"); Y ends
 *     the game, and Enter then starts a new one. Any other answer goes back
 *     to the game. They are whole words, not abbreviated, and work even as
 *     the answer to a question such as "WHAT DO YOU WANT TO TAKE:".
 *     They replace the original's hidden developer word XXX (verb 99,
 *     @015f-016c), which asked BASIC for a service it did not have, so BASIC
 *     stopped at once with the error "ON range at line 40". XXX is no longer
 *     accepted; its entry stays in the vocabulary only so that the word
 *     search - and so every abbreviation - works exactly as before.
 *  6. BUG FIX @09c8 (strikeObject). After STRIKE TORCH puts the burning torch
 *     out, the original tested the magic globe of light the wrong way round:
 *     bytes 02 12 01 00 00 DD 09, "IF globeTurns = 0 skip the darkness". The
 *     opcode should have been 03 ("<>"), matching the same test when the torch
 *     burns out by itself (@0c3f). The effect in a dark room was:
 *       - with no globe of light, the room wrongly stayed lit (no "IT IS
 *         DARK.") until the player left it;
 *       - with the globe shining, "IT IS DARK." was wrongly printed and the
 *         room went dark although the globe still lit it.
 *     Fixed here to "if the globe is shining, the room stays lit". (Validated
 *     against the original with that one byte patched to 03.)
 *  7. FIX 7 @0ed8-1713 (charactersAct): the character loop has its own
 *     counter. The original counted with the global 'character', which
 *     movePlayerTo() also sets (to the character in the player's new room).
 *     So whenever a character moved the player - 2 to 5 turns in 1000 - the
 *     loop jumped, and the characters still to act lost their turn (rarely,
 *     some acted twice). Now each living character acts once every turn.
 *  8. FIX 8: no "record 0". The tables are numbered from 1, and in the
 *     original "record 0" was just the last bytes of the table before it
 *     (see NAME MAP). The original read it whenever a number such as
 *     'character' was 0 - mostly in the message printer, which filled all
 *     sixteen $ slots before every message - and wrote it: in the character
 *     loop after a jump (7 above) and, in unusual states, when taking an
 *     object from a character who is not there (@04d0) or when the girl,
 *     the gatekeeper or the priest "accepted" a present although no object
 *     was named (@1092, @1132, @1266). Every such lookup now checks for 0
 *     first: a $ slot with nothing to name prints nothing, and a present that
 *     is not there is not accepted. Record 0 itself is an empty record that
 *     reads as 0 and cannot be changed (see emptyRecord). In normal play
 *     nothing visible changes.
 *  9. FIX 9 @0459: for a passage that is not a door, UNLOCK now says
 *     "YOU CAN'T UNLOCK A ..." instead of LOCK's "YOU CAN'T LOCK A ...".
 * 10. FIX 10 @0484: UNLOCK leaves the door CLOSED, not OPEN. Every other door
 *     in the game must be opened (OPEN, or FORCE) before you can pass.
 * 11. FIX 11 @0438-0446: LOCK works only on a CLOSED door. The original
 *     locked a door in any state: an OPEN door became locked without being
 *     shut, and a NAILED or BOLTED door became merely LOCKED - so LOCK then
 *     UNLOCK (with the keys) opened doors that were meant to stay shut, such
 *     as the nailed door from the LONG CORRIDOR to the PRIVATE-ROOM. Now:
 *       OPEN    "YOU CAN'T LOCK AN OPEN DOOR."      (new message)
 *       LOCKED  "THE DOOR IS ALREADY LOCKED."        (new message)
 *       NAILED  "IT IS NAILED SHUT."                 (as EXAMINE says)
 *       BOLTED  "IT IS LATCHED AND BOLTED ON THE OTHER SIDE."   (as EXAMINE)
 *  The new messages of 9 and 11 use only words of the original vocabulary.
 *  Fixes 6 to 11 change what a player can see only in the situations
 *  described. Each was validated by writing it into the original bytecode
 *  (as the 1985 author could have done, in the bytecode's unused space) and
 *  comparing that with this engine; see the validation report.
 *
 *  A DESIGN NOTE: BLUE FLUID
 *  -------------------------
 *  Drinking the BLUE FLUID (TAKE it) sends you to a random room - any of the
 *  117. Two of them end the game: OPEN AIR (you fall to your death) and the
 *  DRAWBRIDGE, which ends it exactly as walking out of the castle does ("YOU
 *  RETURN TO THE WORLD.", with your score). This looks deliberate - a gamble
 *  - and is kept as it was.
 *
 *  NAME MAP - where each name lives in the original memory
 *  -------------------------------------------------------
 *  Global bytes &1900-&191E (the original's array 0, record 1; "$gN" = &1900+N)
 *    +1  object1         first object in the command (then: which object)
 *    +2  object2         second object in the command
 *    +3  (scratch)       random result / subroutine result; score for $14
 *    +4  passage         passage word in the command (then: passage number)
 *    +5  character       the character present / being dealt with ($6)
 *    +6  here            the room being dealt with: the player's room, except
 *                        while a character wanders (then that character's room)
 *    +7  invisibleTurns  turns of invisibility left
 *    +8  targetRoom      room beyond an exit / destination ($5)
 *    +9  facing          1 NORTH, 2 EAST, 3 SOUTH, 4 WEST
 *    +10 gameFlags       LIT, DOORS_HELD_OPEN, ASKED_OBJECT/CONTAINER/DIRECTION
 *    +11 dir             absolute direction of the command (1-4) or 0
 *    +14 verb            verb number
 *    +17 torchTurns      turns of torchlight left
 *    +18 globeTurns      turns left on the magic globe of light
 *    +19 tiredTriesLeft  tries at moving while exhausted before collapsing
 *    +20 bewitchedSteps  progress through the BEWITCHED ROOM's facing puzzle
 *    +27 articleRoom     room whose article A/AN/THE is printed by $12
 *    +21..+24, +28..+30  scratch bytes and subroutine arguments (now local)
 *    +0, +12, +13, +15, +16, +25, +26  never used (the bytecode version of
 *                        FIX 7 uses +12 as the loop counter)
 *  Text slots &191F-&193D ($1-$16 in the original; computed when printing here)
 *  Records (the address given is that of the original's "record 0"; record 1
 *  starts right after the previous table, so each "record 0" was really the
 *  tail of the table before it. Here record 0 is an empty record: FIX 8):
 *    objects[1..50]     &1938  6 bytes  location name flags alt weight flags2
 *    rooms[1..117]      &1A61  9 bytes  name exits[1..4] flags owner textFlags level
 *    characters[1..9]   &1E81  6 bytes  name strength location mood magic dead
 *    passages[1..40]    &1EB9  4 bytes  name roomSum flags state
 *    verbs[1..22]       &1F5B  2 bytes  name needs
 *  In the original bytecode these are arrays 1, 2, 3, 4 and 5; array 0 is the
 *  two global areas above.
 * ========================================================================== */

"use strict";

function createArendarvonGame(io) {

io = io || {};
const hostRandom = io.random || ((limit) => 1 + Math.floor(Math.random() * limit));
const storage = io.storage || { save: () => false, load: () => null };
const trace = io.trace || (() => {});

// ============================================================================
// PART 1  CONSTANTS AND NAMES
// ============================================================================

// ---- Directions (absolute). Relative words AHEAD/RIGHT/BACK/LEFT are 0-3.
const NORTH = 1, EAST = 2, SOUTH = 3, WEST = 4;

// ---- Kinds of word in the vocabulary
const VERB = 1, OBJECT = 2, DIRECTION = 3, PASSAGE = 4;

// ---- Verbs (numbers are the original verb numbers)
const VERB_GO = 1, VERB_TURN = 2, VERB_CLIMB = 3, VERB_TAKE = 4, VERB_DROP = 5,
      VERB_GIVE = 6, VERB_PUT = 7, VERB_STRIKE = 8, VERB_EXAMINE = 9,
      VERB_OPEN = 10, VERB_CLOSE = 11, VERB_LOCK = 12, VERB_UNLOCK = 13,
      VERB_LOOK = 14, VERB_WAIT = 15, VERB_ATTACK = 16, VERB_MEASURE = 17,
      VERB_USE = 18, VERB_INVENTORY = 19, VERB_SCORE = 20, VERB_SAVE = 21,
      VERB_LOAD = 22, VERB_QUIT = 99;     // 99: the original's hidden XXX; now typed as QUIT or EXIT

// ---- What a verb needs (verbs[v].needs)
const NEEDS_LIGHT = 1, NEEDS_STRENGTH = 2, NEEDS_DIRECTION = 4, NEEDS_PASSAGE = 8,
      NEEDS_OBJECT = 16, NEEDS_TARGET = 32, NEEDS_CHARACTER = 64, NEEDS_SECOND_OBJECT = 128;

// ---- gameFlags bits
const DOORS_HELD_OPEN = 4;    // DISCLOSE-SPELL: the next automatic door-closing is skipped
const LIT = 8;                // the player can see in this room
const ASKED_OBJECT = 16;      // "WHAT DO YOU WANT TO ...:" has been asked for this command
const ASKED_CONTAINER = 32;   // "... THE $2 IN:" has been asked
const ASKED_DIRECTION = 64;   // "WHERE DO YOU WANT TO ...:" has been asked

// ---- Rooms: flags (low 4 bits = north-south size) and textFlags (low 4 bits = east-west size)
const SCORES = 128, VISITED = 64, STAIRS = 32, DARK = 16;
const SAY_A = 0, SAY_AN = 32, SAY_THE = 64;     // article printed by $12
const SAY_IN = 0, SAY_ON = 16;                  // "YOU ARE IN ..." or "YOU ARE ON ..."
const SIZE_BITS = 15;
const VIA_PASSAGE = 128;                        // an exit value of 128+n goes through passage n

// ---- Characters
const NOBODY = 0, PLAYER = 1, CUSTODIAN = 2, GIRL = 3, GATEKEEPER = 4, PRIEST = 5,
      EAGLE = 6, SECOND_WIZARD = 7, WIZARD = 8, RAT = 9;
// Moods (characters[c].mood)
const HOSTILE = 1, FRIENDLY = 2, DISTURBED = 4, OFFERED = 8;

// ---- Object locations (objects[o].location)
const NOWHERE = 0;
const IN_SOMETHING = 128;      // bit 7: not in a room
const HELD = 64;               // with bit 7: held by a character (low 6 bits), else inside an object (low 7 bits)
const CARRIED = 193;           // held by the player (= heldBy(PLAYER))
// Object flags
const VISIBLE = 1, CONTAINER = 2, TAKEABLE = 4, CLIMBABLE = 8, USABLE = 16,
      PAPER_PIECE = 32, LEADS_ELSEWHERE = 64, TREASURE = 128;
// Object flags2
const BREAKABLE = 1, SPELL = 4, OPEN_CONTAINER = 16;
const FIXED_WEIGHT = 255;      // weight 255: cannot be moved; containers keep 255

// ---- Objects the logic refers to by number
const OBJ_HOME_SPELL = 2, OBJ_TORCH = 3, OBJ_SCRAP_OF_PAPER = 4, OBJ_STRIP_OF_PAPER = 5,
      OBJ_PIECE_OF_PAPER = 6, OBJ_SHOWCASE = 10, OBJ_RESERVOIR = 11, OBJ_LIGHT_SPELL = 12,
      OBJ_KNIFE = 14, OBJ_GUNPOWDER = 16, OBJ_CANNON = 17, OBJ_BALL = 18, OBJ_STAFF = 19,
      OBJ_REVEAL_SPELL = 20, OBJ_ARMOUR = 22, OBJ_COMPASS = 23, OBJ_BELL_ROPE = 25,
      OBJ_BOOK_OF_SECRETS = 29, OBJ_DISCLOSE_SPELL = 30, OBJ_WHEEL = 31, OBJ_TELESCOPE = 32,
      OBJ_CHARM_SPELL = 33, OBJ_FLASK = 34, OBJ_BLUE_FLUID = 35, OBJ_INVISIBILITY_SPELL = 36,
      OBJ_STILL = 37, OBJ_LADDER_DOWN = 41, OBJ_GLOW_SPELL = 42, OBJ_KEYS = 43, OBJ_MONEY = 44,
      OBJ_RED_FLUID = 45, OBJ_STACK_OF_BALLS = 46, OBJ_FOOD = 47, OBJ_RUNGS_DOWN = 49,
      OBJ_KILL_SPELL = 50;
const LAST_OBJECT = 50;

// ---- Passages: flags and states
const HIDDEN = 1, OPENABLE = 2, IS_DOOR = 4, HAS_LOCK = 8, FORCEABLE = 16, AUTOMATIC = 32;
const GAP = 0, OPEN = 1, CLOSED = 2, LOCKED = 3, NAILED = 4, BOLTED = 5;

// ---- Helpers for location and exit values
function heldBy(character) { return IN_SOMETHING | HELD | character; }
function inside(object) { return IN_SOMETHING | object; }
function via(passage) { return VIA_PASSAGE | passage; }

// ---- Byte arithmetic, exactly as the ALADIN VM does it (operators 7 and 8)
function plus(a, b) { return Math.min(255, a + b); }    // "+": stops at 255
function minus(a, b) { return Math.max(0, a - b); }     // "-": stops at 0

// ---- How a command or a turn ended (used by the game logic in PART 4)
const END_TURN = "end turn";              // the world moves on (end-of-turn processing)
const ABORT_COMMAND = "abort command";    // straight back to the ">" prompt
const DIALOG = "dialog";                  // SAVE/LOAD: a question follows
const READY = "ready";                    // verb requirements are met
const NOT_UNDERSTOOD = "not understood";
const ASK_OBJECT = "ask object", ASK_CONTAINER = "ask container", ASK_DIRECTION = "ask direction";

// ============================================================================
// PART 2  GAME STATE
// ----------------------------------------------------------------------------
// The world records live in one byte array laid out exactly like the
// original's memory from &1900 to &1F87 - the 1672 bytes a saved game held.
// Keeping the layout means every detail of the original behaves identically,
// and lets the validation suite compare this engine with the original byte
// for byte.
// ============================================================================

const STATE_ADDRESS = 0x1900;
const STATE_SIZE = 1672;
const state = new Uint8Array(STATE_SIZE + 1);   // one extra byte: verbs[22].needs lives at &1F88

// ---- Global game variables (addresses &1900 + offset, see NAME MAP) --------
let object1 = 0;          // +1
let object2 = 0;          // +2
let passage = 0;          // +4
let character = 0;        // +5
let here = 0;             // +6
let invisibleTurns = 0;   // +7
let targetRoom = 0;       // +8
let facing = NORTH;       // +9
let gameFlags = LIT;      // +10
let dir = 0;              // +11
let verb = 0;             // +14
let torchTurns = 0;       // +17
let globeTurns = 0;       // +18
let tiredTriesLeft = 5;   // +19
let bewitchedSteps = 0;   // +20
let articleRoom = 0;      // +27
let score = 0;            // +3 at the moment the score is printed ($14)

function writeGlobals(bytes) {
    const put = (offset, value) => { bytes[offset] = checkByte(value); };
    put(1, object1); put(2, object2); put(4, passage); put(5, character); put(6, here);
    put(7, invisibleTurns); put(8, targetRoom); put(9, facing); put(10, gameFlags);
    put(11, dir); put(14, verb); put(17, torchTurns); put(18, globeTurns);
    put(19, tiredTriesLeft); put(20, bewitchedSteps); put(27, articleRoom);
}
function readGlobals(bytes) {
    object1 = bytes[1]; object2 = bytes[2]; passage = bytes[4]; character = bytes[5]; here = bytes[6];
    invisibleTurns = bytes[7]; targetRoom = bytes[8]; facing = bytes[9]; gameFlags = bytes[10];
    dir = bytes[11]; verb = bytes[14]; torchTurns = bytes[17]; globeTurns = bytes[18];
    tiredTriesLeft = bytes[19]; bewitchedSteps = bytes[20]; articleRoom = bytes[27];
}

function checkByte(value) {
    if (!Number.isInteger(value) || value < 0 || value > 255) throw new Error("not a byte: " + value);
    return value;
}

// ---- Record tables ----------------------------------------------------------
// recordTable(address of record 0, bytes per record, last record number, fields)
// gives an array of record views; each field reads and writes its byte in 'state'.
// A field listed as "exits" occupies four bytes, used as exits[1]..exits[4].
// The tables are numbered from 1. Record 0 (index 0 of each array) is an empty
// record - see emptyRecord.
function recordTable(tableName, baseAddress, recordSize, lastRecord, fields) {
    const table = [emptyRecord(tableName, fields)];
    for (let record = 1; record <= lastRecord; record++) {
        const start = baseAddress - STATE_ADDRESS + record * recordSize;
        const view = {};
        let offset = 0;
        for (const field of fields) {
            if (field === "exits") {
                const exits = {};
                for (let d = NORTH; d <= WEST; d++) {
                    const at = start + offset + d - 1;
                    Object.defineProperty(exits, d, { get: () => state[at], set: (v) => { state[at] = checkByte(v); } });
                }
                view.exits = exits;
                offset += 4;
            } else {
                const at = start + offset;
                Object.defineProperty(view, field, { get: () => state[at], set: (v) => { state[at] = checkByte(v); } });
                offset += 1;
            }
        }
        table.push(view);
    }
    return table;
}

// emptyRecord - record 0, which does not exist                    (FIX 8)
// In the original, "record 0" of a table was simply the last few bytes of the
// table before it, and a few commands read (and two wrote) it when a number
// such as 'character' was 0. The game logic now checks for 0 first, so record 0
// is never used. As a safety net it is an empty record: every field reads 0,
// writes are ignored, and any use is reported to io.trace as a "record0" event
// (the validation suite counts those as errors - there have been none).
function emptyRecord(tableName, fields) {
    const view = {};
    const used = (field, written) => trace({ type: "record0", table: tableName, field: field, written: written });
    const zeroField = (object, key, field) => Object.defineProperty(object, key, {
        get: () => { used(field, false); return 0; },
        set: () => { used(field, true); },
    });
    for (const field of fields) {
        if (field === "exits") {
            view.exits = {};
            for (let d = NORTH; d <= WEST; d++) zeroField(view.exits, d, "exits");
        } else {
            zeroField(view, field, field);
        }
    }
    return view;
}

const objects    = recordTable("objects",    0x1938, 6, 50,  ["location", "name", "flags", "alt", "weight", "flags2"]);
const rooms      = recordTable("rooms",      0x1A61, 9, 117, ["name", "exits", "flags", "owner", "textFlags", "level"]);
const characters = recordTable("characters", 0x1E81, 6, 9,   ["name", "strength", "location", "mood", "magic", "dead"]);
const passages   = recordTable("passages",   0x1EB9, 4, 40,  ["name", "roomSum", "flags", "state"]);
const verbs      = recordTable("verbs",      0x1F5B, 2, 22,  ["name", "needs"]);
const player = characters[PLAYER];

// ---- The start of a game (BASIC PROCs: *LOAD !Start, then reset the VM) ------
function resetWorld() {
    state.fill(0);
    state.set(TEXT_SLOT_LEFTOVERS, 0x191F - STATE_ADDRESS);
    ROOM_DATA.forEach((row, i) => row(rooms[i + 1]));
    OBJECT_DATA.forEach((row, i) => row(objects[i + 1]));
    CHARACTER_DATA.forEach((row, i) => row(characters[i + 1]));
    PASSAGE_DATA.forEach((row, i) => row(passages[i + 1]));
    VERB_DATA.forEach((row, i) => row(verbs[i + 1]));
    object1 = 0; object2 = 0; passage = 0; character = 0; here = 0; invisibleTurns = 0;
    targetRoom = 0; facing = NORTH; gameFlags = LIT; dir = 0; verb = 0; torchTurns = 0;
    globeTurns = 0; tiredTriesLeft = 5; bewitchedSteps = 0; articleRoom = 0; score = 0;
}

// ---- Row builders used by the data tables in PART 5 ---------------------------
function descriptionNumber(nameOrNumber) {
    if (typeof nameOrNumber === "number") return nameOrNumber;
    const first = DESCRIPTIONS.indexOf(nameOrNumber);
    if (first < 1 || DESCRIPTIONS.indexOf(nameOrNumber, first + 1) >= 0) throw new Error("description? " + nameOrNumber);
    return first;
}
function toRoom(room) { return room; }
function between(roomA, roomB) { return roomA + roomB; }
function roomRow(name, north, east, south, west, flags, nsSize, owner, article, inOrOn, ewSize, level) {
    return (r) => {
        r.name = descriptionNumber(name);
        r.exits[NORTH] = north; r.exits[EAST] = east; r.exits[SOUTH] = south; r.exits[WEST] = west;
        r.flags = flags | nsSize; r.owner = owner; r.textFlags = article | inOrOn | ewSize; r.level = level;
    };
}
function objectRow(name, location, flags, alt, weight, flags2) {
    return (o) => {
        o.location = location; o.name = descriptionNumber(name); o.flags = flags;
        o.alt = descriptionNumber(alt); o.weight = weight; o.flags2 = flags2;
    };
}
function characterRow(name, strength, location, mood, magic, dead) {
    return (c) => {
        c.name = descriptionNumber(name); c.strength = strength; c.location = location;
        c.mood = mood; c.magic = magic; c.dead = descriptionNumber(dead);
    };
}
function passageRow(name, roomSum, flags, state) {
    return (p) => { p.name = descriptionNumber(name); p.roomSum = roomSum; p.flags = flags; p.state = state; };
}
function verbRow(name, needs) {
    return (v) => { v.name = descriptionNumber(name); v.needs = needs; };
}

// ============================================================================
// PART 3  HOST SERVICES  (what the BBC BASIC program $.AREND did)
// ============================================================================

// ---- Ending the game --------------------------------------------------------
class GameEnded extends Error {
    constructor(reason) { super(reason); this.reason = reason; }
}

// HOST "QUIT" (service 8): the BASIC waited for a key and started a new game.
function hostQuit() {                                                  // (service 8)
    trace({ type: "quit" });
    throw new GameEnded("quit");
}

// ---- Random numbers (service 5: BASIC "P%=RND(P%)") -------------------------
// RND(n) gives a whole number 1..n for n >= 2. For n = 1 (or 0) BBC BASIC's
// RND returns a fraction, which the integer variable truncates to 0 - so
// random(1) is always 0. The game relies on that once (the torch, @0c19).
function random(limit) {
    let result = 0;
    if (limit > 1) {
        result = hostRandom(limit);
        if (!Number.isInteger(result) || result < 1 || result > limit) throw new Error("io.random(" + limit + ") gave " + result);
    }
    trace({ type: "random", bound: limit, result: result });
    return result;
}

// ---- The message printer (service 4: BASIC PROCp and PROCr) ------------------
let screenText = "";      // everything printed since the player last typed

// say(message): print a message.
//   Words are separated by single spaces. "$n" is replaced by substitution(n),
//   "$0" starts a new line, and any characters stuck to "$n" (as in "$8.")
//   are joined to the substituted text. A word starting with "\b" (only at the
//   start of ", A $2") is joined to whatever was printed before it.
function say(message) {                                                  // @1890  (printing was SYS 2)
    trace({ type: "print", text: message });
    for (const token of message.split(" ")) {
        if (token === "") continue;
        const slot = /^\$(\d+)(.*)$/.exec(token);
        if (slot === null) {
            printWord(token);
            continue;
        }
        const n = Number(slot[1]);
        if (n === 0) {
            newLine();
        } else if (n >= 14) {
            printWord(String(numberSubstitution(n)));
        } else {
            const text = DESCRIPTIONS[substitution(n)];
            if (text === undefined) throw new HostError("Subscript at line 1270");
            for (const word of text.split(" ")) if (word !== "") printWord(word);
        }
        if (slot[2] !== "") printWord("\b" + slot[2]);
    }
}                                                                        // @193c-1942  (BASIC prints it; return)
function printWord(word) {
    if (word.charCodeAt(0) === 8) {                 // CHR$(8): join to the previous word
        if (screenText.endsWith(" ")) screenText = screenText.slice(0, -1);
        word = word.slice(1);
    }
    screenText += word + " ";
}
function newLine() {
    screenText = screenText.replace(/ +$/, "") + "\n";
}

// A BBC BASIC error in the host program stops everything (only reachable with
// impossible data, e.g. a description number beyond the table).
class HostError extends Error {}

// substitution(n) - which description $1..$13 print                     @1890-1932
// (In the original, every message first ran the "SYS 2" routine at @1890, which
// copied these values into the text slots &191F+n; BASIC then printed d$(slot).)
// FIX 8: a name is looked up only if its number is not 0; description 0 is
// empty, so "$6" with no character prints nothing. (The original filled every
// slot before every message, reading "record 0" whenever a number was 0. In
// normal play no message prints such a slot, so nothing visible changes.)
function substitution(n) {
    const relative = minus(plus(dir, 4), facing) & 3;          // @18ba-18c9: 0 ahead 1 right 2 back 3 left
    switch (n) {
        case 1:  return verb == 0 ? 0 : verbs[verb].name;                         // @1897  (FIX 8: 0 if none)
        case 2:  return object1 == 0 ? 0 : objects[object1].name;                 // @189c  (FIX 8)
        case 3:  return object2 == 0 ? 0 : objects[object2].name;                 // @18a1  (FIX 8)
        case 4:  return here == 0 ? 0 : rooms[here].name;                         // @18a6  (FIX 8)
        case 5:  return targetRoom == 0 ? 0 : rooms[targetRoom].name;             // @18ab  (FIX 8)
        case 6:  return character == NOBODY ? 0 : characters[character].name;     // @18b0  (FIX 8)
        case 7:  return passage == 0 ? 0 : passages[passage].name;                // @18b5  (FIX 8)
        case 8:  return plus(relative, 97);                      // @18ce-18d3  AHEAD/RIGHT/BACK/LEFT
        case 9:  return plus(relative, 165);                     // @18d8-18dd  AHEAD/TO YOUR RIGHT/BEHIND YOU/TO YOUR LEFT
        case 10: return plus(dir, 100);                          // @18e2-18e7  NORTH/EAST/SOUTH/WEST
        case 12:                                                 // @18ec-190a  article of articleRoom
            if (articleRoom == 0) return 0;                                     // (FIX 8)
            else if ((rooms[articleRoom].textFlags & SAY_AN) != 0) return 170;  // "AN"
            else if ((rooms[articleRoom].textFlags & SAY_THE) != 0) return 171; // "THE"
            else return 169;                                                    // "A"
        default: return TEXT_SLOT_LEFTOVERS[n];                  // $11, $13: never set by the game
    }
}
// numberSubstitution(n) - the numbers $14..$16 print                     @190f-1937
function numberSubstitution(n) {
    if (n == 14) return score;                                   // @190f
    if (n == 15 || n == 16) {
        if (here == 0) return 0;                                 // (FIX 8)
        const room = rooms[here];
        const acrossFacing = (facing & 1) != 0 ? room.textFlags : room.flags;   // @1914-192d
        const alongFacing = (facing & 1) != 0 ? room.flags : room.textFlags;
        if (n == 15) return acrossFacing & SIZE_BITS;            // @1932  width
        else return alongFacing & SIZE_BITS;                     // @1937  depth
    }
    return TEXT_SLOT_LEFTOVERS[n] === undefined ? 0 : TEXT_SLOT_LEFTOVERS[n];
}

// ---- The command parser (service 1: BASIC PROCt, FNn, FNr) -------------------
// readCommandWords(line): split the typed line at spaces and look each word up.
// A known word fills its slot only if that slot is still empty, so after a
// question such as "WHAT DO YOU WANT TO TAKE:" the answer completes the command.
// QUIT and EXIT are the exception (DIFFERENCES 5): they always set the verb.
function readCommandWords(line) {
    let rest = line.toUpperCase();
    do {
        let space = rest.indexOf(" ");
        if (space < 0) space = rest.length;
        const word = rest.substring(0, space);
        rest = rest.substring(space + 1);
        if (word === "QUIT" || word === "EXIT") {
            verb = VERB_QUIT;
            quitWord = word;
            continue;
        }
        const entry = lookupWord(word);
        if (entry === 0) continue;                               // unknown words are ignored
        const kind = VOCABULARY[entry][1], value = VOCABULARY[entry][2];
        if (kind === VERB && value === VERB_QUIT) continue;      // XXX is no longer accepted
        switch (kind) {
            case VERB:
                if (verb === 0) verb = value;
                break;
            case OBJECT:
                if (object1 === 0) object1 = value;
                else if (object2 === 0) object2 = value;
                break;
            case DIRECTION:                                      // relative -> absolute
                if (dir === 0) dir = (facing + value + 3) % 4 + 1;
                break;
            case PASSAGE:
                if (passage === 0) passage = value;
                break;
        }
    } while (rest !== "");
}

// lookupWord(word): binary search of VOCABULARY. A typed word matches a
// vocabulary word if the shorter of the two is a prefix of the longer, so
// "TOR" finds TORCH and "TORCHES" finds it too. Returns the entry or 0.
function lookupWord(word) {
    if (word === "") return 0;
    let low = 1, high = VOCABULARY.length - 1;
    while (low <= high) {
        const middle = Math.floor((low + high) / 2);
        const known = VOCABULARY[middle][0].substring(0, word.length);
        const typed = word.substring(0, known.length);
        if (known < typed) low = middle + 1;
        else if (known > typed) high = middle - 1;
        else return middle;
    }
    return 0;
}

// ---- Saving, loading and quitting (services 6, 7 and 0) --------------------------
// The original asked "Save this situation?" and "Filename?" and dumped memory.
// Here the same questions lead to a readable JSON text handed to io.storage.
// Quitting (service 0) is new: see DIFFERENCES 5.

let waitingFor = "command";   // what the next typed line is: see PART 6
let quitWord = "QUIT";        // QUIT or EXIT, whichever was typed, for the question

function startQuitDialog() {                                    // (service 0)
    trace({ type: "quitAsk" });
    screenText += "Do you really want to " + quitWord.toLowerCase() + "? ";
    waitingFor = "quit: confirm";
}
function startSaveDialog() {                                    // (service 6)
    trace({ type: "saveAsk" });
    screenText += "Save this situation? ";
    waitingFor = "save: confirm";
}
function startLoadDialog() {                                    // (service 7)
    trace({ type: "loadAsk" });
    screenText += "Load a new situation? ";
    waitingFor = "load: confirm";
}
// continueDialog(line): the answer to one of these questions. Returns true if
// another question follows; false to go back to the game (a new ">" prompt).
function continueDialog(line) {
    const [action, step] = waitingFor.split(": ");
    if (action === "quit") {
        if (line.trim().toUpperCase().charAt(0) !== "Y") return false;
        hostQuit();                                              // the game is over
    }
    if (step === "confirm") {
        if (line.trim().toUpperCase().charAt(0) !== "Y") return false;
        screenText += "Filename? ";
        waitingFor = action + ": filename";
        trace({ type: action + "Name" });
        return true;
    }
    const name = line.trim();
    if (action === "save") {
        if (!storage.save(name, saveGameAsJson())) screenText += "COULD NOT SAVE.\n";
    } else {
        const text = storage.load(name);
        if (text === null || text === undefined) screenText += "FILE NOT FOUND.\n";
        else if (!loadGameFromJson(text)) screenText += "THAT IS NOT A SAVED GAME.\n";
    }
    return false;
}

// Readable names for the JSON file
const FLAG_NAMES = {
    objectFlags: [[VISIBLE, "VISIBLE"], [CONTAINER, "CONTAINER"], [TAKEABLE, "TAKEABLE"], [CLIMBABLE, "CLIMBABLE"],
                  [USABLE, "USABLE"], [PAPER_PIECE, "PAPER_PIECE"], [LEADS_ELSEWHERE, "LEADS_ELSEWHERE"], [TREASURE, "TREASURE"]],
    objectFlags2: [[BREAKABLE, "BREAKABLE"], [2, "BIT1"], [SPELL, "SPELL"], [8, "BIT3"], [OPEN_CONTAINER, "OPEN_CONTAINER"],
                   [32, "BIT5"], [64, "BIT6"], [128, "BIT7"]],
    mood: [[HOSTILE, "HOSTILE"], [FRIENDLY, "FRIENDLY"], [DISTURBED, "DISTURBED"], [OFFERED, "OFFERED"],
           [16, "BIT4"], [32, "BIT5"], [64, "BIT6"], [128, "BIT7"]],
    passageFlags: [[HIDDEN, "HIDDEN"], [OPENABLE, "OPENABLE"], [IS_DOOR, "IS_DOOR"], [HAS_LOCK, "HAS_LOCK"],
                   [FORCEABLE, "FORCEABLE"], [AUTOMATIC, "AUTOMATIC"], [64, "BIT6"], [128, "BIT7"]],
    gameFlags: [[1, "BIT0"], [2, "BIT1"], [DOORS_HELD_OPEN, "DOORS_HELD_OPEN"], [LIT, "LIT"], [ASKED_OBJECT, "ASKED_OBJECT"],
                [ASKED_CONTAINER, "ASKED_CONTAINER"], [ASKED_DIRECTION, "ASKED_DIRECTION"], [128, "BIT7"]],
};
const STATE_NAMES = ["GAP", "OPEN", "CLOSED", "LOCKED", "NAILED", "BOLTED"];

function flagsToNames(value, names) { return names.filter(([bit]) => (value & bit) != 0).map(([, name]) => name); }
function namesToFlags(list, names) {
    if (!Array.isArray(list)) throw new Error("flag list");
    let value = 0;
    for (const item of list) {
        const found = names.find(([, name]) => name === item);
        if (!found) throw new Error("unknown flag " + item);
        value |= found[0];
    }
    return value;
}
function locationToText(value) {
    if (value === NOWHERE) return "nowhere";
    if (value === CARRIED) return "carried";
    if ((value & IN_SOMETHING) == 0) return "room " + value + " (" + DESCRIPTIONS[rooms[value] ? rooms[value].name : 0] + ")";
    if ((value & HELD) != 0) {
        const c = value & 63;
        return "held by character " + c + (c >= 1 && characters[c] ? " (" + DESCRIPTIONS[characters[c].name] + ")" : "");
    }
    const o = value & 127;
    return "inside object " + o + (o >= 1 && objects[o] ? " (" + DESCRIPTIONS[objects[o].name] + ")" : "");
}
function textToLocation(text) {
    const m = /^(nowhere|carried|room (\d+)|held by character (\d+)|inside object (\d+))/.exec(String(text));
    if (!m) throw new Error("location " + text);
    if (m[1] === "nowhere") return NOWHERE;
    if (m[1] === "carried") return CARRIED;
    if (m[2] !== undefined) return checkByte(Number(m[2]) & 127);
    if (m[3] !== undefined) return heldBy(Number(m[3]) & 63);
    return inside(Number(m[4]) & 127);
}
function nameToNumber(text, allowed) {
    const n = allowed.find((d) => DESCRIPTIONS[d] === text);
    if (n === undefined) throw new Error("name " + text);
    return n;
}

// Which bits of each state byte the named JSON fields below already record.
// Anything else that differs from a new game (the game itself never changes
// such bytes, but an edited state could) is saved as "otherBytes", so that a
// saved game always restores the exact state.
const NAMED_BITS = (function () {
    const mask = new Uint8Array(STATE_SIZE);
    for (let i = 0; i <= 30; i++) mask[i] = 0xFF;                        // the global variables
    for (let o = 1; o <= LAST_OBJECT; o++) [0, 1, 2, 4, 5].forEach((f) => { mask[0x38 + 6 * o + f] = 0xFF; });
    for (let c = 1; c <= 9; c++) [0, 1, 2, 3, 4].forEach((f) => { mask[0x581 + 6 * c + f] = 0xFF; });
    for (let p = 1; p <= 40; p++) [2, 3].forEach((f) => { mask[0x5B9 + 4 * p + f] = 0xFF; });
    for (let r = 1; r <= 117; r++) mask[0x161 + 9 * r + 5] = VISITED;
    return mask;
})();
function newWorldBytes() {
    const saved = state.slice();
    const globals = new Uint8Array(31);
    writeGlobals(globals);
    resetWorld();
    const fresh = state.slice(0, STATE_SIZE);
    state.set(saved);
    readGlobals(globals);
    return fresh;
}

function saveGameAsJson() {
    const fresh = newWorldBytes();
    const otherBytes = {};
    for (let i = 31; i < STATE_SIZE; i++) {
        if (((state[i] ^ fresh[i]) & ~NAMED_BITS[i] & 0xFF) != 0) {
            otherBytes["&" + (STATE_ADDRESS + i).toString(16).toUpperCase()] = state[i];
        }
    }
    const variables = {
        here, facing, dir, verb, object1, object2, passage, character, targetRoom, articleRoom,
        invisibleTurns, torchTurns, globeTurns, tiredTriesLeft, bewitchedSteps,
        gameFlags: flagsToNames(gameFlags, FLAG_NAMES.gameFlags),
    };
    const visitedRooms = [];
    for (let r = 1; r <= 117; r++) if ((rooms[r].flags & VISITED) != 0) visitedRooms.push(r);
    const lines = [];
    lines.push("{");
    lines.push('  "game": "The Secret of Arendarvon Castle",');
    lines.push('  "format": 1,');
    lines.push('  "variables": ' + JSON.stringify(variables) + ",");
    lines.push('  "visitedRooms": ' + JSON.stringify(visitedRooms) + ",");
    lines.push('  "otherBytes": ' + JSON.stringify(otherBytes) + ",");
    lines.push('  "objects": [');
    for (let o = 1; o <= LAST_OBJECT; o++) {
        const x = objects[o];
        lines.push("    " + JSON.stringify({ object: o, name: DESCRIPTIONS[x.name], location: locationToText(x.location),
            flags: flagsToNames(x.flags, FLAG_NAMES.objectFlags), weight: x.weight,
            flags2: flagsToNames(x.flags2, FLAG_NAMES.objectFlags2) }) + (o < LAST_OBJECT ? "," : ""));
    }
    lines.push("  ],");
    lines.push('  "characters": [');
    for (let c = 1; c <= 9; c++) {
        const x = characters[c];
        lines.push("    " + JSON.stringify({ character: c, name: DESCRIPTIONS[x.name], strength: x.strength,
            location: locationToText(x.location), mood: flagsToNames(x.mood, FLAG_NAMES.mood), magic: x.magic }) + (c < 9 ? "," : ""));
    }
    lines.push("  ],");
    lines.push('  "passages": [');
    for (let p = 1; p <= 40; p++) {
        const x = passages[p];
        lines.push("    " + JSON.stringify({ passage: p, name: DESCRIPTIONS[x.name],
            flags: flagsToNames(x.flags, FLAG_NAMES.passageFlags), state: STATE_NAMES[x.state] || x.state }) + (p < 40 ? "," : ""));
    }
    lines.push("  ]");
    lines.push("}");
    return lines.join("\n");
}

// Returns true if the text was a valid saved game (and has been loaded).
// Nothing is changed unless the whole file is valid.
function loadGameFromJson(text) {
    const before = state.slice();
    const globalsBefore = new Uint8Array(31);
    writeGlobals(globalsBefore);
    try {
        const data = JSON.parse(text);
        if (data.game !== "The Secret of Arendarvon Castle" || data.format !== 1) throw new Error("not a save");
        const v = data.variables;
        const byte = (x) => checkByte(Number(x));
        const g = {
            here: byte(v.here), facing: byte(v.facing), dir: byte(v.dir), verb: byte(v.verb),
            object1: byte(v.object1), object2: byte(v.object2), passage: byte(v.passage), character: byte(v.character),
            targetRoom: byte(v.targetRoom), articleRoom: byte(v.articleRoom), invisibleTurns: byte(v.invisibleTurns),
            torchTurns: byte(v.torchTurns), globeTurns: byte(v.globeTurns), tiredTriesLeft: byte(v.tiredTriesLeft),
            bewitchedSteps: byte(v.bewitchedSteps), gameFlags: namesToFlags(v.gameFlags, FLAG_NAMES.gameFlags),
        };
        resetWorld();                                   // start from a new game ...
        const other = data.otherBytes || {};
        for (const key of Object.keys(other)) {         // ... plus any other changed bytes
            const m = /^&([0-9A-F]{4})$/i.exec(key);
            const i = m ? parseInt(m[1], 16) - STATE_ADDRESS : -1;
            if (i < 31 || i >= STATE_SIZE) throw new Error("address " + key);
            state[i] = (state[i] & NAMED_BITS[i]) | (checkByte(other[key]) & ~NAMED_BITS[i] & 0xFF);
        }
        for (let r = 1; r <= 117; r++) rooms[r].flags &= ~VISITED;
        for (const r of data.visitedRooms) {
            if (!(r >= 1 && r <= 117)) throw new Error("room " + r);
            rooms[r].flags |= VISITED;
        }
        if (data.objects.length !== LAST_OBJECT || data.characters.length !== 9 || data.passages.length !== 40) throw new Error("counts");
        data.objects.forEach((x, i) => {
            const o = objects[i + 1];
            if (x.object !== i + 1) throw new Error("object order");
            const initial = OBJECT_DATA[i];
            const probe = {}; initial(new Proxy(probe, { set: (t, k, val) => { t[k] = val; return true; } }));
            o.name = nameToNumber(x.name, [probe.name, probe.alt]);
            o.location = textToLocation(x.location);
            o.flags = namesToFlags(x.flags, FLAG_NAMES.objectFlags);
            o.weight = byte(x.weight);
            o.flags2 = namesToFlags(x.flags2, FLAG_NAMES.objectFlags2);
        });
        data.characters.forEach((x, i) => {
            const c = characters[i + 1];
            if (x.character !== i + 1) throw new Error("character order");
            const probe = {}; CHARACTER_DATA[i](new Proxy(probe, { set: (t, k, val) => { t[k] = val; return true; } }));
            c.name = nameToNumber(x.name, [probe.name, probe.dead]);
            c.strength = byte(x.strength);
            c.location = textToLocation(x.location);
            c.mood = namesToFlags(x.mood, FLAG_NAMES.mood);
            c.magic = byte(x.magic);
        });
        data.passages.forEach((x, i) => {
            const p = passages[i + 1];
            if (x.passage !== i + 1) throw new Error("passage order");
            p.flags = namesToFlags(x.flags, FLAG_NAMES.passageFlags);
            const s = STATE_NAMES.indexOf(x.state);
            p.state = s >= 0 ? s : byte(x.state);
        });
        here = g.here; facing = g.facing; dir = g.dir; verb = g.verb; object1 = g.object1; object2 = g.object2;
        passage = g.passage; character = g.character; targetRoom = g.targetRoom; articleRoom = g.articleRoom;
        invisibleTurns = g.invisibleTurns; torchTurns = g.torchTurns; globeTurns = g.globeTurns;
        tiredTriesLeft = g.tiredTriesLeft; bewitchedSteps = g.bewitchedSteps; gameFlags = g.gameFlags;
        return true;
    } catch (e) {
        state.set(before);
        readGlobals(globalsBefore);
        return false;
    }
}

// ============================================================================
// PART 4  GAME LOGIC
// ----------------------------------------------------------------------------
// 4.1  The command cycle            startGame ... askPlayer
// 4.2  Understanding the command    resolveCommand, checkVerbRequirements
// 4.3  The verbs                    performVerb, verbGo ... verbExamine
// 4.4  The end of a turn            endOfTurn, burnTorch ... roomEvents
// 4.5  The other characters         charactersAct, custodianActs ... wander
// 4.6  Subroutines                  findObjectAt ... killCharacter
//                                   (the original's "SYS 10" to "SYS 18")
// ============================================================================


// ============================================================================
// 4.1  THE COMMAND CYCLE
// ----------------------------------------------------------------------------
// The original bytecode is one long loop:
//
//     @0014  clear the command slots, print ">"
//     @006c  ask BASIC for a line of input (BASIC fills the slots)
//     @0072  make sense of the words, check the verb can be done
//     @020d  perform the verb
//     @0bea  let the world take its turn (timers, doors, characters)
//            back to @0014
//
// Here the loop is driven from outside: the front end calls submit() with each
// typed line, PART 6 puts the words into the slots with readCommandWords() and
// calls runCommand(), which runs until the game needs the next line.
// ============================================================================

/*
 * startGame - the title, then an automatic LOOK                  bytecode @0000-0009
 * ----------------------------------------------------------------------------
 * Purpose:   Starts a new game. BASIC had already reloaded the world ($.!Start);
 *            here resetWorld() does that. The first "command" is a LOOK that
 *            the player did not type, so it goes straight to runCommand()
 *            without waiting for input.
 * Called by: PART 6 (start, and after a game has ended)
 * Changes:   the whole world (reset), verb
 */
function startGame() {
    resetWorld();                                                        // (BASIC PROCs)
    say("SUPPLEMENTARY BOOK AVAILABLE.");                                // @0000
    say("$0 $0 $0 ** THE SECRET OF ARENDARVON CASTLE ** $0 $0 $0");      // @0002
    verb = VERB_LOOK;                                                    // @0004
    runCommand();                                                        // @0009
}

/*
 * runCommand - carry out whatever is in the command slots           bytecode @0072-171a
 * ----------------------------------------------------------------------------
 * Purpose:   Runs one command from the moment the words are known until the game
 *            needs another line of input. That line is either a new command
 *            (">"), the answer to a question such as "WHAT DO YOU WANT TO TAKE:",
 *            or the answer to a SAVE/LOAD question.
 * Called by: startGame, PART 6 (after readCommandWords)
 * Notes:     interpretAndPerform() does the real work and reports how it ended.
 */
function runCommand() {
    switch (interpretAndPerform()) {
        case NOT_UNDERSTOOD: notUnderstood(); break;
        case ASK_OBJECT:     askPlayer(ASKED_OBJECT, "WHAT DO YOU WANT TO $1:"); break;
        case ASK_CONTAINER:  askPlayer(ASKED_CONTAINER, "WHAT DO YOU WANT TO $1 THE $2 IN:"); break;
        case ASK_DIRECTION:  askPlayer(ASKED_DIRECTION, "WHERE DO YOU WANT TO $1:"); break;
        case DIALOG:         break;                                      // the SAVE/LOAD question is showing
        default:             beginNewCommand(); break;                   // END_TURN or ABORT_COMMAND
    }
}

/*
 * interpretAndPerform - one command, start to finish             bytecode @0072-171a
 * ----------------------------------------------------------------------------
 * Purpose:   1. resolveCommand: which direction, passage and objects are meant
 *            2. a bare direction means GO; no verb at all is not understood
 *            3. checkVerbRequirements: light, strength, missing words...
 *            4. performVerb
 *            5. endOfTurn: the world moves on (skipped when a verb aborts,
 *               e.g. INVENTORY, SCORE, or "YOU ARE NOT HOLDING THE ...")
 * Called by: runCommand
 * Returns:   END_TURN, ABORT_COMMAND, DIALOG, NOT_UNDERSTOOD or an ASK_... value
 */
function interpretAndPerform() {
    resolveCommand();                                                    // @0072-013d
    if (verb == 0) {                                                     // @014c
        if (dir == 0) return NOT_UNDERSTOOD;                             // @0153
        verb = VERB_GO;                                                  // @015a
    }
    if (verb == VERB_QUIT) {                                             // @015f  QUIT or EXIT (was XXX)
        startQuitDialog();                                               // @0166  service 0: see DIFFERENCES 5
        return DIALOG;                                                   // @016c  (after "no": a new prompt)
    }
    const readiness = checkVerbRequirements();                           // @016f-0206
    if (readiness != READY) return readiness;
    const result = performVerb();                                        // @020d-0bd4
    if (result != END_TURN) return result;
    endOfTurn();                                                         // @0bea-1713
    return END_TURN;                                                     // @171a
}

/*
 * beginNewCommand - forget the last command and prompt             bytecode @0014-0034
 * ----------------------------------------------------------------------------
 * Purpose:   Empties the command slots, forgets which questions were asked,
 *            prints the ">" prompt and waits for a line.
 * Called by: runCommand, notUnderstood, PART 6 (after a SAVE/LOAD question)
 * Changes:   verb, object1, object2, dir, passage, gameFlags (ASKED_... bits)
 */
function beginNewCommand() {
    verb = 0;                                                            // @0014
    object1 = 0;                                                         // @0019
    object2 = 0;                                                         // @001e
    dir = 0;                                                             // @0023
    passage = 0;                                                         // @0028
    gameFlags &= ~(ASKED_OBJECT | ASKED_CONTAINER | ASKED_DIRECTION);    // @002d  (AND 143)
    say("$0 >");                                                         // @0032
    waitForCommand();                                                    // @0034 -> @006c (input)
}

/*
 * notUnderstood - "I DON'T UNDERSTAND!"                            bytecode @0037-0039
 * ----------------------------------------------------------------------------
 * Called by: runCommand (no verb and no direction, or a question asked twice)
 */
function notUnderstood() {
    say("I DON'T UNDERSTAND!");                                          // @0037
    beginNewCommand();                                                   // @0039
}

/*
 * askPlayer - ask once for a missing part of the command    bytecode @003c-006a
 * ----------------------------------------------------------------------------
 * Purpose:   Prints a question and waits for a line WITHOUT clearing the command
 *            slots, so the answer ("TORCH", "NORTH"...) completes the command.
 *            Each question is asked at most once per command; the second time
 *            the game gives up with "I DON'T UNDERSTAND!".
 * Parameters: askedFlag  ASKED_OBJECT, ASKED_CONTAINER or ASKED_DIRECTION
 *             question   the message to print
 * Called by: runCommand
 * Notes:     The original has three copies of this code: object @003c,
 *            container @004d and direction @005e. Offsets are listed in that order.
 */
function askPlayer(askedFlag, question) {
    if ((gameFlags & askedFlag) != 0) {                                  // @003c / @004d / @005e
        notUnderstood();
        return;
    }
    gameFlags |= askedFlag;                                              // @0043 / @0054 / @0065
    say(question);                                                       // @0048 / @0059 / @006a
    waitForCommand();                                                    // @004a / @005b -> @006c
}


// ============================================================================
// 4.2  UNDERSTANDING THE COMMAND
// ============================================================================

/*
 * resolveCommand - work out what the typed words refer to        bytecode @0072-014b
 * ----------------------------------------------------------------------------
 * Purpose:   The parser only filled in word values. This decides:
 *            - here:       the player's room
 *            - character:  the character in this room, if any
 *            - dir:        the direction meant. A passage word ("DOOR") with no
 *                          direction selects the exit through such a passage.
 *            - passage:    the passage that exit goes through (0 if none, or if
 *                          it is a hidden passage that is not open)
 *            - targetRoom: the room that way (0 for a wall or hidden passage)
 *            - object1/2:  the actual object meant. Several objects can share a
 *                          name (three HEAPS OF RUBBISH); the one that is here wins.
 * Called by: interpretAndPerform
 * Changes:   here, character, dir, passage, targetRoom, object1, object2
 */
function resolveCommand() {
    here = player.location;                                              // @0072
    character = rooms[here].owner;                                       // @0077
    if (character != NOBODY                                              //        (FIX 8: no record 0)
        && characters[character].location != here) character = NOBODY;  // @007c-0083

    let haveDirection = (0 < dir);                                       // @0088
    if (!haveDirection && passage != 0) {                                // @008f
        haveDirection = findExitThroughPassage();                        // @0096-00bd
    }
    if (!haveDirection) {
        dir = 0;                                                         // @00c4
        passage = 0;                                                     // @00c9
        targetRoom = 0;                                                  // @00ce
    } else {
        const exit = rooms[here].exits[dir];
        if ((exit & VIA_PASSAGE) == 0) {                                 // @00d6
            passage = 0;                                                 // @010f
            targetRoom = exit;                                           // @0114
        } else {
            passage = exit & 127;                                        // @00dd-00e2
            if (passages[passage].state != OPEN                          // @00e7
                && (passages[passage].flags & HIDDEN) != 0) {            // @00ee
                passage = 0;                                             // @0102  a secret door stays secret
                targetRoom = 0;                                          // @0107
            } else {
                targetRoom = minus(passages[passage].roomSum, here);     // @00f5-00fa  the far side
            }
        }
    }

    if (object1 != 0) object1 = findObjectAt(object1, here);             // @0119-0126
    // The original's test here was a typo that never skipped the lookup
    // (see DIFFERENCES FROM THE 1985 PROGRAM, note 1).
    if (object2 != 0) object2 = findObjectAt(object2, here);             // @012b-0138
}

/*
 * findExitThroughPassage - turn "DOOR", "WINDOW"... into a direction   bytecode @0096-00bd
 * ----------------------------------------------------------------------------
 * Purpose:   The command named a kind of passage rather than a direction. The
 *            room's exits are tried in the order N, E, S, W and the first one
 *            leading through a passage of that kind is chosen.
 * Reads:     passage (the kind of passage: its description number, 48-60)
 * Changes:   dir (1-4 if found, otherwise 5), passage (the last passage examined)
 * Returns:   true if such an exit was found
 * Called by: resolveCommand
 */
function findExitThroughPassage() {
    const kind = passage;                                                // @0096
    for (dir = NORTH; dir <= WEST; dir++) {                              // @009b, @00b8-00bd
        if ((rooms[here].exits[dir] & VIA_PASSAGE) != 0) {               // @00a0
            passage = rooms[here].exits[dir] & 127;                      // @00a7-00ac
            if (passages[passage].name == kind) return true;             // @00b1
        }
    }
    return false;
}

/*
 * checkVerbRequirements - can this verb be done now?            bytecode @016f-0206
 * ----------------------------------------------------------------------------
 * Purpose:   Each verb has a set of needs (see VERB_DATA). They are checked in
 *            this order; the first one not met decides what happens:
 *              NEEDS_LIGHT          "IT IS TOO DARK."          (command abandoned)
 *              NEEDS_STRENGTH       "YOU ARE TOO TIRED TO MOVE." and one of the
 *                                   last tiredTriesLeft is used up
 *              NEEDS_DIRECTION      ask "WHERE DO YOU WANT TO ...:"
 *              NEEDS_PASSAGE        ask "WHAT DO YOU WANT TO ...:"
 *              NEEDS_OBJECT         ask "WHAT DO YOU WANT TO ...:"
 *              NEEDS_TARGET         a passage, a wall, or else an object (asked for)
 *              NEEDS_CHARACTER      "THERE IS NO ONE."         (command abandoned)
 *              NEEDS_SECOND_OBJECT  ask "WHAT DO YOU WANT TO ... THE ... IN:"
 * Called by: interpretAndPerform
 * Changes:   tiredTriesLeft, dir (cleared if NEEDS_TARGET and that way is open)
 * Returns:   READY, ABORT_COMMAND, or ASK_DIRECTION / ASK_OBJECT / ASK_CONTAINER
 */
function checkVerbRequirements() {
    const needs = verbs[verb].needs;
    if ((needs & NEEDS_LIGHT) != 0 && (gameFlags & LIT) == 0) {          // @016f, @0176
        say("IT IS TOO DARK.");                                          // @017d
        return ABORT_COMMAND;                                            // @017f
    }
    if ((needs & NEEDS_STRENGTH) != 0 && player.strength == 0) {         // @0182, @0189
        tiredTriesLeft = minus(tiredTriesLeft, 1);                       // @0190
        say("YOU ARE TOO TIRED TO MOVE.");                               // @0195
        return ABORT_COMMAND;                                            // @0197
    }
    if ((needs & NEEDS_DIRECTION) != 0 && dir == 0) return ASK_DIRECTION;    // @019a, @01a1
    if ((needs & NEEDS_PASSAGE) != 0 && passage == 0) return ASK_OBJECT;     // @01a8, @01af
    if ((needs & NEEDS_OBJECT) != 0 && object1 == 0) return ASK_OBJECT;      // @01b6, @01bd
    if ((needs & NEEDS_TARGET) != 0 && !(0 < passage)) {                 // @01c4, @01cb
        const facingAWall = (dir != 0 && targetRoom == 0);               // @01d2, @01d9
        if (!facingAWall) {
            dir = 0;                                                     // @01e0  an open way is not a target
            if (object1 == 0) return ASK_OBJECT;                         // @01e5
        }
    }
    if ((needs & NEEDS_CHARACTER) != 0 && !(0 < character)) {            // @01ec, @01f3
        say("THERE IS NO ONE.");                                         // @01fa
        return ABORT_COMMAND;                                            // @01fc
    }
    if ((needs & NEEDS_SECOND_OBJECT) != 0 && object2 == 0) return ASK_CONTAINER;  // @01ff, @0206
    return READY;
}


// ============================================================================
// 4.3  THE VERBS
// ----------------------------------------------------------------------------
// Each verb function returns
//   END_TURN       the command was carried out (even if it failed) and the world
//                  now takes its turn
//   ABORT_COMMAND  nothing happened in the game's time; back to the prompt
//   DIALOG         SAVE / LOAD: a question is on the screen
// ============================================================================

/*
 * performVerb - run the verb's code                               bytecode @020d-0bd4
 * ----------------------------------------------------------------------------
 * Notes:     The original tests "IF verb <> n GOTO next test" for each verb in
 *            turn. The offset on each case is that test.
 */
function performVerb() {
    switch (verb) {
        case VERB_GO:        return verbGo();                            // @020d
        case VERB_LOOK:      return verbLook();                          // @0261
        case VERB_TURN:      return verbTurn();                          // @02c6
        case VERB_CLIMB:     return verbClimb();                         // @02d4
        case VERB_OPEN:      return verbOpen();                          // @03a5
        case VERB_CLOSE:     return verbClose();                         // @03e5
        case VERB_LOCK:      return verbLock();                          // @0419
        case VERB_UNLOCK:    return verbUnlock();                        // @044b
        case VERB_TAKE:      return verbTake();                          // @0489
        case VERB_DROP:      return verbDrop();                          // @0567
        case VERB_PUT:       return verbPut();                           // @05bb
        case VERB_GIVE:      return verbGive();                          // @0640
        case VERB_USE:       return verbUse();                           // @0660
        case VERB_STRIKE:    return verbStrike();                        // @089d
        case VERB_ATTACK:    return verbAttack();                        // @09dd
        case VERB_EXAMINE:   return verbExamine();                       // @0abe
        case VERB_WAIT:                                                  // @0b7e
            say("YOU WAIT.");                                            // @0b85
            return END_TURN;
        case VERB_MEASURE:                                               // @0b87
            say("THE PLACE IS $15 WIDE AND $16 DEEP.");                  // @0b8e
            return END_TURN;
        case VERB_INVENTORY:                                             // @0b90
            say("YOU HAVE");                                             // @0b97
            listObjectsAt(CARRIED);                                      // @0b99
            return ABORT_COMMAND;                                        // @0b9f
        case VERB_SCORE:                                                 // @0ba2
            score = computeScore();                                      // @0ba9
            say("YOUR SCORE IS: $14");                                   // @0baf
            return ABORT_COMMAND;                                        // @0bb1
        case VERB_SAVE:                                                  // @0bb4
            startSaveDialog();                                           // @0bbb
            return DIALOG;                                               // @0bc1
        case VERB_LOAD:                                                  // @0bc4
            startLoadDialog();                                           // @0bcb
            return DIALOG;                                               // @0bd1
        default:
            return END_TURN;                                             // @0bd4
    }
}

/*
 * verbGo - GO in a direction                                      bytecode @020d-025b
 * ----------------------------------------------------------------------------
 * Purpose:   Turns the player to face the direction and walks that way. Walls
 *            and closed passages cost 3 strength. Stairs are mentioned.
 * Reads:     dir, targetRoom, passage (set by resolveCommand)
 * Changes:   facing, player.strength, and everything movePlayerTo changes
 * Messages:  "YOU GO $8." uses the direction relative to the OLD facing
 */
function verbGo() {
    say("YOU GO $8.");                                                   // @0214
    facing = dir;                                                        // @0216
    if (targetRoom == 0) {                                               // @021b
        say("YOU BUMP INTO THE WALL.");                                  // @0222
        player.strength = minus(player.strength, 3);                     // @0224
        return END_TURN;                                                 // @0229
    }
    if (passage != 0) {                                                  // @022c
        if (!(passages[passage].state <= OPEN)) {                        // @0233  closed, locked, nailed, bolted
            say("YOU BUMP INTO THE $7.");                                // @023a
            player.strength = minus(player.strength, 3);                 // @023c
            return END_TURN;                                             // @0241
        }
        say("YOU GO PAST THE $7.");                                      // @0244
    }
    if ((rooms[targetRoom].flags & STAIRS) != 0) {                       // @0246
        if (rooms[targetRoom].level < rooms[here].level) {               // @024d
            say("YOU CLIMB DOWN THE STAIRS.");                           // @0259
        } else {
            say("YOU CLIMB UP THE STAIRS.");                             // @0254
        }
    }
    movePlayerTo(targetRoom);                                            // @025b
    return END_TURN;
}

/*
 * verbLook - LOOK around                                          bytecode @0261-02bb
 * ----------------------------------------------------------------------------
 * Purpose:   Describes the room: its name, whether visited before, what lies in
 *            each of the four directions, the visible objects and any character.
 * Changes:   articleRoom; describeExit changes dir, targetRoom, passage;
 *            listObjectsAt changes object1, object2
 */
function verbLook() {
    say("YOU LOOK AROUND.");                                             // @0268
    if ((gameFlags & LIT) == 0) {                                        // @026a
        say("IT IS DARK.");                                              // @0271
        return END_TURN;                                                 // @0273
    }
    articleRoom = here;                                                  // @0276
    if ((rooms[here].textFlags & SAY_ON) != 0) {                         // @027b
        say("YOU ARE ON $12 $4.");                                       // @0287
    } else {
        say("YOU ARE IN $12 $4.");                                       // @0282
    }
    if ((rooms[here].flags & VISITED) != 0) {                            // @0289
        say("YOU HAVE BEEN HERE BEFORE.");                               // @0290
    }
    for (let way = NORTH; way <= WEST; way++) {
        describeExit(rooms[here].exits[way], way);                       // @0292, @0298, @029e, @02a4
    }
    say("YOU SEE");                                                      // @02aa
    listObjectsAt(here);                                                 // @02ac
    if (character != NOBODY) {                                           // @02b2
        say("THERE IS A $6 HERE.");                                      // @02b9
    }
    return END_TURN;                                                     // @02bb
}

/*
 * verbTurn - TURN to face a direction                             bytecode @02c6-02cf
 * ----------------------------------------------------------------------------
 * Changes:   facing
 */
function verbTurn() {
    say("YOU TURN $8.");                                                 // @02cd
    facing = dir;                                                        // @02cf
    return END_TURN;
}

/*
 * verbClimb - CLIMB an object                                     bytecode @02d4-039f
 * ----------------------------------------------------------------------------
 * Purpose:   Climbable objects either lead to another room (the ladders, the
 *            rungs in the well, the bell-rope) or lead nowhere (the show-case,
 *            the postcard stand...), in which case the player always falls off.
 *            Climbing the bell-rope rings the bells; climbing the show-case may
 *            break it. Wearing the armour makes every climb fail.
 *            A climb that leads somewhere succeeds 9 times in 10. Falling off the
 *            DOWNWARD ladder or rungs still gets you down - the hard way.
 * Changes:   targetRoom, player.strength, characters' moods, the show-case,
 *            and everything movePlayerTo changes
 */
function verbClimb() {
    if ((objects[object1].flags & CLIMBABLE) == 0) {                     // @02db
        say("YOU CAN'T CLIMB A $2.");                                    // @02e2
        return ABORT_COMMAND;                                            // @02e4
    }
    targetRoom = objects[object1].alt;                                   // @02e7  where it leads
    if ((objects[object1].flags & LEADS_ELSEWHERE) == 0) {               // @02ec
        targetRoom = here;                                               // @02f3
    }
    if (rooms[targetRoom].level < rooms[here].level) {                   // @02f8
        say("YOU CLIMB DOWN THE $2.");                                   // @0304
    } else {
        say("YOU CLIMB UP THE $2.");                                     // @02ff
    }

    if (object1 == OBJ_BELL_ROPE) {                                      // @0306
        say("BELLS START CHIMING.");                                     // @0317
        characters[PRIEST].mood |= DISTURBED;                            // @0319
    } else if (object1 == OBJ_SHOWCASE) {                                // @030d
        climbShowcase();                                                 // @0321-0363
    }

    let fallsOff;
    if (objects[OBJ_ARMOUR].location == CARRIED) {                       // @0365
        say("YOUR ARMOUR HINDERS YOU.");                                 // @036c
        fallsOff = true;                                                 // @036e
    } else if ((objects[object1].flags & LEADS_ELSEWHERE) == 0) {        // @0371
        fallsOff = true;                                                 // (there is nowhere to get to)
    } else {
        const roll = random(10);                                         // @0378
        fallsOff = !(roll < 10);                                         // @037e  1 chance in 10
    }

    if (!fallsOff) {
        movePlayerTo(targetRoom);                                        // @039f
        return END_TURN;
    }
    say("YOU FALL OFF.");                                                // @0385
    player.strength = minus(player.strength, 5);                         // @0387
    if (object1 == OBJ_RUNGS_DOWN || object1 == OBJ_LADDER_DOWN) {       // @038c, @0393
        player.strength = minus(player.strength, 10);                    // @039a
        movePlayerTo(targetRoom);                                        // @039f  down anyway
    }
    return END_TURN;
}

/*
 * climbShowcase - the show-case may break under the climber       bytecode @0321-0363
 * ----------------------------------------------------------------------------
 * Purpose:   An unbroken show-case breaks 8 times in 10 (always if the player
 *            wears the heavy armour), becoming an open container and disturbing
 *            the custodian. Whenever it breaks - or was already broken - the
 *            splinters hurt, unless the armour is worn. If it holds, nothing
 *            else happens here.
 * Called by: verbClimb (object1 is the show-case)
 * Changes:   the show-case's name, flags, flags2; custodian's mood; player.strength
 */
function climbShowcase() {
    const showcase = objects[object1];
    if (showcase.name != showcase.alt) {                                 // @0321  not broken yet
        if (objects[OBJ_ARMOUR].location != CARRIED) {                   // @0328
            const roll = random(10);                                     // @032f
            if (roll < 3) return;                                        // @0335  it holds
        }
        say("THE SHOWCASE BREAKS.");                                     // @033c
        showcase.name = showcase.alt;                                    // @033e
        showcase.flags |= CONTAINER;                                     // @0343
        showcase.flags2 |= OPEN_CONTAINER;                               // @0348
        characters[CUSTODIAN].mood |= DISTURBED;                         // @034d
    }
    if (objects[OBJ_ARMOUR].location == CARRIED) {                       // @0352
        say("YOUR ARMOUR PROTECTS YOU FROM THE SPLINTERS.");             // @0363
    } else {
        say("YOU ARE BADLY HURT BY THE SPLINTERS.");                     // @0359
        player.strength = minus(player.strength, 10);                    // @035b
    }
}

/*
 * verbOpen - OPEN a passage                                       bytecode @03a5-03e0
 * ----------------------------------------------------------------------------
 * Purpose:   Opens a CLOSED passage that can be opened. Locked, nailed and
 *            bolted ones won't open. The CUPBOARD-DOOR (passage 37) screams,
 *            which disturbs the wizard.
 * Changes:   passages[passage].state, the wizard's mood
 */
function verbOpen() {
    const door = passages[passage];
    if (door.state == OPEN) {                                            // @03ac
        say("YOU OPEN THE $7 EVEN WIDER.");                              // @03cb
    } else if ((door.flags & OPENABLE) == 0) {                           // @03b3
        say("YOU SEE NO WAY TO OPEN THE $7.");                           // @03ba
        return END_TURN;                                                 // @03bc
    } else if (door.state == CLOSED) {                                   // @03bf
        say("YOU OPEN THE $7.");                                         // @03d0
        door.state = OPEN;                                               // @03d2
    } else {
        say("THE $7 WON'T OPEN.");                                       // @03c6
        return END_TURN;                                                 // @03c8
    }
    if (passage == 37) {                                                 // @03d7  the CUPBOARD-DOOR
        say("AT ONCE IT STARTS SCREAMING.");                             // @03de
        characters[WIZARD].mood |= DISTURBED;                            // @03e0
    }
    return END_TURN;
}

/*
 * verbClose - CLOSE a passage                                     bytecode @03e5-0414
 * ----------------------------------------------------------------------------
 * Changes:   passages[passage].state, the wizard's mood (CUPBOARD-DOOR)
 */
function verbClose() {
    const door = passages[passage];
    if ((door.flags & OPENABLE) == 0) {                                  // @03ec
        say("YOU SEE NO WAY TO CLOSE THE $7.");                          // @03f3
    } else if (door.state != OPEN) {                                     // @03f8
        say("THE $7 IS ALREADY CLOSED.");                                // @03ff
    } else {
        say("YOU CLOSE THE $7.");                                        // @0404
        door.state = CLOSED;                                             // @0406
        if (passage == 37) {                                             // @040b  the CUPBOARD-DOOR
            say("AT ONCE IT STARTS SCREAMING.");                         // @0412
            characters[WIZARD].mood |= DISTURBED;                        // @0414
        }
    }
    return END_TURN;
}

/*
 * verbLock - LOCK a door                                          bytecode @0419-0446
 * ----------------------------------------------------------------------------
 * Purpose:   Needs a door with a lock, and the BUNCH OF KEYS. Only a CLOSED
 *            door can be locked.
 * Notes:     FIX 11. The original locked the door whatever state it was in:
 *            an OPEN door became locked (and so shut, without being closed),
 *            and a NAILED or BOLTED door became merely LOCKED - which the
 *            keys then UNLOCKED, a way through doors the author meant to stay
 *            shut (for example the nailed door from the LONG CORRIDOR to the
 *            PRIVATE-ROOM). Now each state gets its own answer; the answers
 *            for NAILED and BOLTED are the ones EXAMINE gives.
 * Changes:   passages[passage].state
 */
function verbLock() {
    const door = passages[passage];
    if ((door.flags & IS_DOOR) == 0) {                                   // @0420
        say("YOU CAN'T LOCK A $7.");                                     // @0427
        return ABORT_COMMAND;                                            // @0429
    }
    if ((door.flags & HAS_LOCK) == 0) {                                  // @042c
        say("THE $7 HAS NO LOCK.");                                      // @0433
    } else if (objects[OBJ_KEYS].location != CARRIED) {                  // @0438
        say("YOU HAVE NO KEYS.");                                        // @043f
    } else {
        switch (door.state) {                                            //        (FIX 11)
            case CLOSED:
                say("YOU LOCK THE $7.");                                 // @0444
                door.state = LOCKED;                                     // @0446
                break;
            case OPEN:   say("YOU CAN'T LOCK AN OPEN $7."); break;                    // (FIX 11: new message)
            case LOCKED: say("THE $7 IS ALREADY LOCKED."); break;                     // (FIX 11: new message)
            case NAILED: say("IT IS NAILED SHUT."); break;                            // (FIX 11: as EXAMINE)
            case BOLTED: say("IT IS LATCHED AND BOLTED ON THE OTHER SIDE."); break;   // (FIX 11: as EXAMINE)
            default:                                                     //        (FIX 11: no such state)
                say("YOU CAN'T LOCK A $7.");
                return ABORT_COMMAND;
        }
    }
    return END_TURN;
}

/*
 * verbUnlock - UNLOCK a door                                      bytecode @044b-0484
 * ----------------------------------------------------------------------------
 * Purpose:   Needs a locked door with a lock, and the BUNCH OF KEYS. The
 *            unlocked door is CLOSED; OPEN it to go through.
 * Notes:     FIX 9. For a passage that is not a door, the original printed
 *            LOCK's message "YOU CAN'T LOCK A ...".
 *            FIX 10. The original left an unlocked door OPEN, as if UNLOCK
 *            opened it too - unlike every other door in the game, which must be
 *            opened with OPEN (or FORCE) before passing.
 * Changes:   passages[passage].state
 */
function verbUnlock() {
    const door = passages[passage];
    if ((door.flags & IS_DOOR) == 0) {                                   // @0452
        say("YOU CAN'T UNLOCK A $7.");                                   // @0459  (FIX 9: was "YOU CAN'T LOCK A $7.")
        return ABORT_COMMAND;                                            // @045b
    }
    if ((door.flags & HAS_LOCK) == 0) {                                  // @045e
        say("THE $7 HAS NO LOCK.");                                      // @0465
    } else if (objects[OBJ_KEYS].location != CARRIED) {                  // @046a
        say("YOU HAVE NO KEYS.");                                        // @0471
    } else if (door.state != LOCKED) {                                   // @0476
        say("THE $7 IS NOT LOCKED.");                                    // @047d
    } else {
        say("YOU UNLOCK THE $7.");                                       // @0482
        door.state = CLOSED;                                             // @0484  (FIX 10: was OPEN)
    }
    return END_TURN;
}

/*
 * verbTake - TAKE an object                                       bytecode @0489-0562
 * ----------------------------------------------------------------------------
 * Purpose:   Picks up an object lying here, inside a container that can be
 *            opened, or held by the character here (a friendly one lets go;
 *            otherwise it is disturbed and there is an even chance).
 *            Strength works as carrying capacity: an object is taken only if it
 *            weighs LESS than the player's strength, which then drops by its
 *            weight. Taking the armour puts it on; taking a fluid drinks it:
 *            BLUE FLUID sends the player to a random room - any of the 117,
 *            including OPEN AIR (a fatal fall) and the DRAWBRIDGE, which ends
 *            the game just as walking out of the castle does (see roomEvents
 *            and winGame). RED FLUID gives 100 strength.
 * Changes:   the object's location and flags, object2 (a container),
 *            the container's weight, a character's mood, player.strength
 */
function verbTake() {
    const thing = objects[object1];
    if (thing.location == CARRIED) {                                     // @0490
        say("YOU ARE ALREADY HOLDING THE $2.");                          // @0497
        return ABORT_COMMAND;                                            // @0499
    }
    if ((thing.flags & TAKEABLE) == 0) {                                 // @049c
        say("YOU CAN'T TAKE A $2.");                                     // @04a3
        return ABORT_COMMAND;                                            // @04a5
    }
    if (!(thing.weight < player.strength)) {                             // @04a8
        say("THE $2 IS TOO HEAVY FOR YOU.");                             // @04af
        return END_TURN;                                                 // @04b1
    }

    if ((thing.location & IN_SOMETHING) == 0) {                          // @04b4  lying in the room
        say("YOU TAKE THE $2.");                                         // @0513
    } else if ((thing.location & HELD) != 0) {                           // @04bb  a character has it
        say("YOU TRY TO TAKE THE $2 FROM THE $6.");                      // @04c2
        if (character != NOBODY                                          //        (FIX 8: no record 0)
            && (characters[character].mood & FRIENDLY) != 0) {           // @04c4
            say("THE $6 LETS GO WILLINGLY.");                            // @04cb
        } else {
            if (character != NOBODY) {                                   //        (FIX 8)
                characters[character].mood |= DISTURBED;                 // @04d0
            }
            const roll = random(2);                                      // @04d5
            if (roll != 1) {                                             // @04db
                say("THE $6 DOES NOT LET GO.");                          // @04e2
                return END_TURN;                                         // @04e4
            }
            say("YOU MANAGE TO GRAB IT.");                               // @04e7
        }
    } else {                                                             //        inside a container
        object2 = thing.location & 127;                                  // @04ec-04f1
        if ((objects[object2].flags2 & OPEN_CONTAINER) == 0) {           // @04f6
            say("THERE IS NO WAY TO TAKE ANYTHING FROM THE $3.");        // @04fd
            return END_TURN;                                             // @04ff
        }
        say("YOU TAKE THE $2 FROM THE $3.");                             // @0502
        if (objects[object2].weight != FIXED_WEIGHT) {                   // @0504
            objects[object2].weight = minus(objects[object2].weight, thing.weight);   // @050b
        }
    }

    thing.location = CARRIED;                                            // @0515
    thing.flags |= VISIBLE;                                              // @051a
    player.strength = minus(player.strength, thing.weight);              // @051f

    switch (object1) {
        case OBJ_ARMOUR:                                                 // @0524
            say("YOU PUT IT ON.");                                       // @053c
            break;                                                       // @053e
        case OBJ_BLUE_FLUID:                                             // @052b
            say("YOU DRINK IT.");                                        // @0541
            thing.location = NOWHERE;                                    // @0543
            say("YOU PASS OUT, AND WHEN YOU COME TO YOURSELF AGAIN");    // @0548
            movePlayerTo(random(117));                                   // @054a-0550
            break;                                                       // @0556
        case OBJ_RED_FLUID:                                              // @0532
            say("YOU DRINK IT.");                                        // @0559
            thing.location = NOWHERE;                                    // @055b
            say("YOU FEEL STRENGTH FLOWING THROUGH YOU.");               // @0560
            player.strength = plus(player.strength, 100);                // @0562
            break;
    }
    return END_TURN;
}

/*
 * verbDrop - DROP a carried object                                bytecode @0567-05b6
 * ----------------------------------------------------------------------------
 * Purpose:   Puts the object down here and gives back its weight in strength.
 *            A dropped FLASK breaks and loses its contents. A dropped burning
 *            TORCH goes out at the end of the turn.
 * Changes:   the object's location (and the flask's name and flags),
 *            player.strength, torchTurns
 */
function verbDrop() {
    const thing = objects[object1];
    if (thing.location != CARRIED) {                                     // @056e
        say("YOU ARE NOT HOLDING THE $2.");                              // @0575
        return ABORT_COMMAND;                                            // @0577
    }
    say("YOU DROP THE $2.");                                             // @057a
    player.strength = plus(player.strength, thing.weight);               // @057c
    thing.location = here;                                               // @0581
    if (object1 == OBJ_FLASK && (thing.flags & CONTAINER) != 0) {        // @0586, @058d
        say("THE $2 BREAKS.");                                           // @0594
        thing.name = thing.alt;                                          // @0596
        say("ITS CONTENTS ARE LOST.");                                   // @059b
        destroyObjectsAt(inside(OBJ_FLASK), OBJ_FLASK);                  // @059d
        thing.flags &= ~CONTAINER;                                       // @05a3
    }
    if (object1 == OBJ_TORCH && torchTurns != 0) {                       // @05a8, @05af
        torchTurns = 1;                                                  // @05b6
    }
    return END_TURN;
}

/*
 * verbPut - PUT an object INTO a container                        bytecode @05bb-0603
 * ----------------------------------------------------------------------------
 * Purpose:   The object must be carried, the second object must be a container,
 *            and the object must weigh less than the container's weight (which
 *            doubles as its capacity and grows as things are put in).
 * Changes:   the object's location, the container's weight, player.strength
 */
function verbPut() {
    const thing = objects[object1];
    const container = objects[object2];
    if (thing.location != CARRIED) {                                     // @05c2
        say("YOU ARE NOT HOLDING THE $2.");                              // @05c9
        return ABORT_COMMAND;                                            // @05cb
    }
    if ((container.flags & CONTAINER) == 0) {                            // @05ce
        say("YOU CAN'T PUT SOMETHING INTO A $3.");                       // @05d5
        return ABORT_COMMAND;                                            // @05d7
    }
    if (!(thing.weight < container.weight)) {                            // @05da
        say("THE $2 DOES NOT FIT INTO THE $3.");                         // @05e1
        return END_TURN;                                                 // @05e3
    }
    thing.location = inside(object2);                                    // @05e6-05eb
    if (container.weight != FIXED_WEIGHT) {                              // @05f0
        container.weight = plus(container.weight, thing.weight);         // @05f7
    }
    player.strength = plus(player.strength, thing.weight);               // @05fc
    say("YOU PUT THE $2 INTO THE $3.");                                  // @0601
    return END_TURN;                                                     // @0603
}

/*
 * verbGive - GIVE (offer) an object to the character here         bytecode @0640-065b
 * ----------------------------------------------------------------------------
 * Purpose:   Only marks the character as OFFERED; what it does about the offer
 *            is decided when it acts at the end of the turn (see 4.5).
 * Changes:   characters[character].mood
 */
function verbGive() {
    if (findObjectAt(object1, CARRIED) == 0) {                           // @0647-064d
        say("YOU ARE NOT HOLDING THE $2.");                              // @0654
        return ABORT_COMMAND;                                            // @0656
    }
    say("YOU OFFER THE $2 TO THE $6.");                                  // @0659
    characters[character].mood |= OFFERED;                               // @065b
    return END_TURN;
}

/*
 * verbUse - USE an object: cast a spell or work a device          bytecode @0660-0673
 * ----------------------------------------------------------------------------
 * Changes:   see castSpell and useDevice
 */
function verbUse() {
    if ((objects[object1].flags & USABLE) == 0) {                        // @0667
        say("WHAT FOR?");                                                // @066e
        return ABORT_COMMAND;                                            // @0670
    }
    if ((objects[object1].flags2 & SPELL) != 0) {                        // @0673
        return castSpell();                                              // @067a-07ed
    } else {
        return useDevice();                                              // @07f0-089a
    }
}

/*
 * castSpell - USE a spell                                         bytecode @067a-07ed
 * ----------------------------------------------------------------------------
 * Purpose:   A spell must be carried and unused. Casting costs 25 magic power,
 *            unless the player carries the RESERVOIR OF MAGIC. The spell is used
 *            up (renamed "USED ...") and takes effect:
 *              HOME-SPELL          you escape: the game is won
 *              LIGHT-SPELL         a globe of light for 25 turns
 *              DISCLOSE-SPELL      opens the passages round this room, and holds
 *                                  the next automatic passage open
 *              REVEAL-SPELL        stops the passages here working by themselves
 *                                  and makes them visible
 *              GLOW-SPELL          shows every object here, even hidden ones
 *              INVISIBILITY-SPELL  25 turns of invisibility
 *              KILL-SPELL          kills the character here
 *              CHARM-SPELL         makes the character here friendly
 * Notes:     Any other spell would act as the HOME-SPELL (there are none).
 * Changes:   player.magic, the spell's name; then per spell (see above)
 */
function castSpell() {
    const spell = objects[object1];
    if (spell.location != CARRIED) {                                     // @067a
        say("YOU ARE NOT HOLDING THE $2.");                              // @0681
        return ABORT_COMMAND;                                            // @0683
    }
    if (spell.name == spell.alt) {                                       // @0686
        say("THE $2 HAS NO POWER LEFT.");                                // @068d
        return END_TURN;                                                 // @068f
    }
    if (objects[OBJ_RESERVOIR].location != CARRIED) {                    // @0692
        if (!(25 <= player.magic)) {                                     // @0699
            say("YOU DON'T HAVE THE POWER TO CAST THE $2.");             // @06a0
            return END_TURN;                                             // @06a2
        }
        player.magic = minus(player.magic, 25);                          // @06a5
    }
    say("YOU CAST THE $2.");                                             // @06aa
    spell.name = spell.alt;                                              // @06ac

    switch (object1) {
        case OBJ_LIGHT_SPELL:                                            // @06b8
            say("ABOVE YOUR HEAD APPEARS A GLOBE OF LIGHT.");            // @06f2
            globeTurns = 25;                                             // @06f4
            gameFlags |= LIT;                                            // @06f9
            break;                                                       // @06fe
        case OBJ_DISCLOSE_SPELL:                                         // @06bf
            castDiscloseSpell();                                         // @0701-0731
            break;                                                       // @0736
        case OBJ_REVEAL_SPELL:                                           // @06c6
            castRevealSpell();                                           // @0739-0760
            break;                                                       // @0767
        case OBJ_GLOW_SPELL:                                             // @06cd
            castGlowSpell();                                             // @076a-07b1
            break;                                                       // @07b8
        case OBJ_INVISIBILITY_SPELL:                                     // @06d4
            say("YOU BECOME INVISIBLE.");                                // @07cf
            invisibleTurns = 25;                                         // @07d1
            break;                                                       // @07d6
        case OBJ_KILL_SPELL:                                             // @06db
            if (character != NOBODY                                      // @07d9
                && characters[character].name != characters[character].dead) {   // @07e0
                killCharacter(character);                                // @07e7
            }
            break;                                                       // @07ed
        case OBJ_CHARM_SPELL:                                            // @06e2
            if (character != NOBODY) {                                   // @07bb
                characters[character].mood &= ~HOSTILE;                  // @07c2
                characters[character].mood |= FRIENDLY;                  // @07c7
            }
            break;                                                       // @07cc
        case OBJ_HOME_SPELL:                                             // @06b1
        default:
            winGame();                                                   // @06e9
            break;                                                       // @06ef  (never reached: winGame() does not return)
    }
    return END_TURN;
}

/*
 * castDiscloseSpell - open every passage round the room           bytecode @0701-0731
 * ----------------------------------------------------------------------------
 * Changes:   dir (loop; ends as 5), passage, passages' state, gameFlags
 */
function castDiscloseSpell() {
    for (dir = NORTH; dir < 5; dir++) {                                  // @0701, @0725-072a
        if ((rooms[here].exits[dir] & VIA_PASSAGE) != 0) {               // @0706
            passage = rooms[here].exits[dir] & 127;                      // @070d-0712
            if (!(passages[passage].state < CLOSED)) {                   // @0717  closed, locked...
                say("THE $7 $9 OPENS.");                                 // @071e
                passages[passage].state = OPEN;                          // @0720
            }
        }
    }
    gameFlags |= DOORS_HELD_OPEN;                                        // @0731
}

/*
 * castRevealSpell - automatic passages here stop being automatic   bytecode @0739-0760
 * ----------------------------------------------------------------------------
 * Changes:   dir (loop; ends as 5), passage, passages' flags
 */
function castRevealSpell() {
    for (dir = NORTH; dir < 5; dir++) {                                  // @0739, @075b-0760
        if ((rooms[here].exits[dir] & VIA_PASSAGE) != 0) {               // @073e
            passage = rooms[here].exits[dir] & 127;                      // @0745-074a
            if ((passages[passage].flags & AUTOMATIC) != 0) {            // @074f
                passages[passage].flags &= ~(AUTOMATIC | HIDDEN);        // @0756  (AND 222)
            }
        }
    }
}

/*
 * castGlowSpell - show every object that is here                  bytecode @076a-07b1
 * ----------------------------------------------------------------------------
 * Purpose:   Every object here that the player does not carry becomes VISIBLE
 *            and is announced, with where it is (in the room, inside something,
 *            or held by the character).
 * Notes:     The VISIBLE flag is set on object1 itself even when the lookup
 *            found a same-named object instead (as in the original).
 * Changes:   object1 (loop; ends as 51), object2, objects' flags
 */
function castGlowSpell() {
    for (object1 = 1; object1 <= LAST_OBJECT; object1++) {               // @076a, @07ac-07b1
        if (objects[object1].location == CARRIED) continue;              // @076f
        if (findObjectAt(object1, here) == 0) continue;                  // @0776-077c
        objects[object1].flags |= VISIBLE;                               // @0783
        if ((objects[object1].location & IN_SOMETHING) == 0) {           // @0788
            say("YOU SEE A $2.");                                        // @07aa
        } else if ((objects[object1].location & HELD) != 0) {            // @078f
            say("THE $6 HAS GOT A $2.");                                 // @0796
        } else {
            object2 = objects[object1].location & 127;                   // @079b-07a0
            say("IN THE $3 IS A $2.");                                   // @07a5
        }
    }
}

/*
 * useDevice - USE something that is not a spell                   bytecode @07f0-089a
 * ----------------------------------------------------------------------------
 * Purpose:   TELESCOPE  a joke
 *            WHEEL      raises or lowers the PORTCULLIS (passage 17) and
 *                       disturbs the gatekeeper
 *            COMPASS    tells you which way you face
 *            BELL-ROPE  rings the bells, disturbing the priest
 *            CANNON     fires (see fireCannon); so would anything else usable
 * Changes:   passages[17].state, moods, dir, and see fireCannon
 */
function useDevice() {
    if (objects[object1].name == objects[object1].alt) {                 // @07f0  broken
        say("THE $2 HAS BECOME USELESS.");                               // @07f7
        return END_TURN;                                                 // @07f9
    }
    switch (object1) {
        case OBJ_TELESCOPE:                                              // @0803
            say("YOU LOOK THROUGH THE TELESCOPE. EVERYTHING LOOKS VERY LARGE.");   // @0871
            break;                                                       // @0873
        case OBJ_WHEEL:                                                  // @080a
            say("YOU TURN THE WHEEL.");                                  // @0876
            characters[GATEKEEPER].mood |= DISTURBED;                    // @0878
            say("YOU HEAR A NOISE.");                                    // @087d
            passages[17].state = minus(3, passages[17].state);           // @087f  OPEN <-> CLOSED
            break;                                                       // @0884
        case OBJ_COMPASS:                                                // @0811
            dir = facing;                                                // @0887
            say("YOU READ THE COMPASS. YOU ARE FACING $10.");            // @088c
            break;                                                       // @088e
        case OBJ_BELL_ROPE:                                              // @0818
            say("YOU PULL THE BELL-ROPE.");                              // @0891
            say("BELLS START CHIMING.");                                 // @0893
            characters[PRIEST].mood |= DISTURBED;                        // @0895
            break;                                                       // @089a
        case OBJ_CANNON:                                                 // @07fc
        default:
            fireCannon();                                                // @081f-0869
            break;
    }
    return END_TURN;
}

/*
 * fireCannon - fire the cannon in the courtyard                   bytecode @081f-0869
 * ----------------------------------------------------------------------------
 * Purpose:   Needs gunpowder in the cannon. The shot uses up whatever is in the
 *            cannon. With a ball loaded, the ball knocks a hole in the wall to
 *            the south (revealing passage 19) and ends up back in the stack of
 *            balls. Without a ball, half the time the cannon explodes and kills.
 * Changes:   objects in the cannon, dir, passages[19].flags, the ball
 */
function fireCannon() {
    if (objects[OBJ_GUNPOWDER].location != inside(OBJ_CANNON)) {         // @081f
        say("THE CANNON IS NOT LOADED.");                                // @0826
        return;                                                          // @0828
    }
    say("YOU FIRE THE CANNON. THERE IS A LOUD BANG.");                   // @082b
    if (objects[OBJ_BALL].location == inside(OBJ_CANNON)) {              // @082d
        destroyObjectsAt(inside(OBJ_CANNON), OBJ_CANNON);                // @0857
        dir = SOUTH;                                                     // @085d
        say("THE BALL STRIKES A HOLE IN THE WALL $9.");                  // @0862
        passages[19].flags &= ~HIDDEN;                                   // @0864
        objects[OBJ_BALL].location = inside(OBJ_STACK_OF_BALLS);         // @0869
        return;                                                          // @086e
    }
    destroyObjectsAt(inside(OBJ_CANNON), OBJ_CANNON);                    // @0834
    const roll = random(2);                                              // @083a
    if (roll == 1) {                                                     // @0840
        say("YOU SEE NO EFFECT.");                                       // @0852
    } else {
        say("IT EXPLODES AND PIECES HIT YOU.");                          // @0847
        die();                                                           // @0849
    }
}

/*
 * verbStrike - STRIKE a wall, a passage or an object              bytecode @089d-09d8
 * ----------------------------------------------------------------------------
 * Purpose:   The noise disturbs whoever lives in this room. What is struck is,
 *            in this order: the object named, the passage named, or the wall in
 *            the direction given. One random number from 1 to 20 decides whether
 *            a passage bursts open or an object breaks: the blow's force must be
 *            at least that number.
 * Changes:   the room owner's mood, and see the three strike... functions
 */
function verbStrike() {
    const roll = random(20);                                             // @08a4
    const owner = rooms[here].owner;                                     // @08aa
    if (owner != NOBODY) {                                               // @08af
        characters[owner].mood |= DISTURBED;                             // @08b6
    }
    if (0 < object1) {                                                   // @08bb
        strikeObject(roll);                                              // @092c-09d8
    } else if (0 < passage) {                                            // @08c2
        strikePassage(roll);                                             // @08e9-0924
    } else {
        strikeWall();                                                    // @08c9-08e1
    }
    return END_TURN;
}

/*
 * strikeWall - STRIKE the wall in a direction                     bytecode @08c9-08e1
 * ----------------------------------------------------------------------------
 * Purpose:   Striking the wall where the (hidden) HOLE IN THE WALL between the
 *            DUNGEON and the CELLAR-VAULT is (passage 2) widens it half the
 *            time, making it visible.
 * Changes:   passages[2].flags
 */
function strikeWall() {
    say("YOU STRIKE THE WALL $9.");                                      // @08c9
    if (rooms[here].exits[dir] != via(2)) return;                        // @08cb
    const roll = random(2);                                              // @08d2
    if (roll == 2) return;                                               // @08d8
    say("YOU WIDEN THE HOLE IN THE WALL.");                              // @08df
    passages[2].flags &= ~HIDDEN;                                        // @08e1
}

/*
 * strikePassage - STRIKE a passage (to force it open)             bytecode @08e9-0924
 * ----------------------------------------------------------------------------
 * Purpose:   With the unbroken STAFF the blow has force 10, otherwise force 1
 *            and it costs 5 strength. A FORCEABLE passage that is not open
 *            bursts open if the force is at least the roll.
 * Parameters: roll  the random number 1-20 from verbStrike
 * Changes:   player.strength, passages[passage].state
 */
function strikePassage(roll) {
    let force;
    if (objects[OBJ_STAFF].location == CARRIED                           // @08e9
        && objects[OBJ_STAFF].name != objects[OBJ_STAFF].alt) {          // @08ff
        say("YOU STRIKE THE $7 $9 WITH YOUR STAFF.");                    // @0906
        force = 10;                                                      // @0908
    } else {
        say("YOU STRIKE THE $7 $9.");                                    // @08f0
        player.strength = minus(player.strength, 5);                     // @08f2
        force = 1;                                                       // @08f7
    }
    if ((passages[passage].flags & FORCEABLE) == 0) return;              // @090d
    if (passages[passage].state < CLOSED) return;                        // @0914
    if (force < roll) return;                                            // @091b
    say("IT IS OPEN.");                                                  // @0922
    passages[passage].state = OPEN;                                      // @0924
}

/*
 * strikeObject - STRIKE an object (to break it)                   bytecode @092c-09d8
 * ----------------------------------------------------------------------------
 * Purpose:   With the unbroken STAFF (and not striking the staff itself) the
 *            force is 18, otherwise 10 and it costs 5 strength.
 *            Striking the burning TORCH puts it out. A BREAKABLE unbroken object
 *            breaks if the force is at least the roll: the SHOW-CASE becomes an
 *            open container, the FLASK loses its contents, the STILL explodes.
 * Parameters: roll  the random number 1-20 from verbStrike
 * Notes:     BUG FIX (@09c8, see DIFFERENCES FROM THE 1985 PROGRAM, note 6):
 *            after the torch goes out, a dark room goes dark unless the magic
 *            globe of light is shining. The original tested the globe the wrong
 *            way round (opcode 02 "=" where 03 "<>" was meant).
 * Changes:   player.strength, torchTurns, gameFlags, the object's name, flags
 */
function strikeObject(roll) {
    let force;
    if (object1 != OBJ_STAFF                                             // @092c
        && objects[OBJ_STAFF].location == CARRIED                        // @0933
        && objects[OBJ_STAFF].name != objects[OBJ_STAFF].alt) {          // @0949
        say("YOU STRIKE THE $2 WITH YOUR STAFF.");                       // @0950
        force = 18;                                                      // @0952
    } else {
        say("YOU STRIKE THE $2.");                                       // @093a
        player.strength = minus(player.strength, 5);                     // @093c
        force = 10;                                                      // @0941
    }

    if (object1 == OBJ_TORCH) {                                          // @0957
        if (torchTurns == 0) return;                                     // @09ba
        say("IT GOES OUT.");                                             // @09c1
        torchTurns = 0;                                                  // @09c3
        if (0 < globeTurns) return;                                      // @09c8  the globe still lights it (BUG FIX: see Notes)
        if ((rooms[here].flags & DARK) == 0) return;                     // @09cf
        say("IT IS DARK.");                                              // @09d6
        gameFlags &= ~LIT;                                               // @09d8
        return;
    }

    const thing = objects[object1];
    if ((thing.flags2 & BREAKABLE) == 0) return;                         // @095e
    if (thing.name == thing.alt) return;                                 // @0965  already broken
    if (force < roll) return;                                            // @096c
    say("THE $2 BREAKS.");                                               // @0973
    thing.name = thing.alt;                                              // @0975
    switch (object1) {
        case OBJ_SHOWCASE:                                               // @097a
            thing.flags |= CONTAINER;                                    // @0992
            thing.flags2 |= OPEN_CONTAINER;                              // @0997
            break;                                                       // @099c
        case OBJ_FLASK:                                                  // @0981
            say("ITS CONTENTS ARE LOST.");                               // @099f
            destroyObjectsAt(inside(OBJ_FLASK), OBJ_FLASK);              // @09a1
            thing.flags &= ~CONTAINER;                                   // @09a7
            break;                                                       // @09ac
        case OBJ_STILL:                                                  // @0988
            say("IT EXPLODES AND PIECES HIT YOU.");                      // @09af
            die();                                                       // @09b1
            break;                                                       // @09b7  (never reached: die() does not return)
    }
}

/*
 * verbAttack - ATTACK the character here                          bytecode @09dd-0ab0
 * ----------------------------------------------------------------------------
 * Purpose:   The victim becomes hostile. Bare-handed, a blow lands half the time
 *            (a roll of 11-20) and does 10 damage. With the KNIFE the roll picks
 *            the wound: 1-2 warded off, 3-6 5 damage, 7-10 10, 11-14 25, 15-18 40,
 *            19-20 a deadly gash. While invisible every attack lands (a heavy
 *            blow, or a deadly gash with the knife) - except on the WIZARD, who
 *            can see you. The SECOND_WIZARD wards off everything.
 *            A character whose strength reaches 0 dies.
 * Changes:   the victim's mood and strength; see killCharacter
 */
function verbAttack() {
    const victim = characters[character];
    if (victim.name == victim.dead) {                                    // @09e4
        say("IT IS USELESS TO ATTACK THE $6.");                          // @09eb
        return END_TURN;                                                 // @09ed
    }
    victim.mood &= ~FRIENDLY;                                            // @09f0
    victim.mood |= HOSTILE;                                              // @09f5
    const roll = random(20);                                             // @09fa

    let blow;
    if (objects[OBJ_KNIFE].location != CARRIED) {                        // @0a00
        say("YOU ATTACK.");                                              // @0a07
        if (character == SECOND_WIZARD) blow = "warded off";             // @0a09
        else if (invisibleTurns != 0 && character != WIZARD) blow = "heavy blow";  // @0a10, @0a17
        else if (roll < 11) blow = "warded off";                         // @0a1e
        else blow = "heavy blow";                                        // @0a25
    } else {
        say("YOU ATTACK WITH YOUR KNIFE.");                              // @0a28
        if (character == SECOND_WIZARD) blow = "warded off";             // @0a2a
        else if (invisibleTurns != 0 && character != WIZARD) blow = "deadly gash";  // @0a31, @0a38
        else if (roll < 3) blow = "warded off";                          // @0a3f
        else if (roll < 7) blow = "scratch";                             // @0a46
        else if (roll < 11) blow = "nasty cut";                          // @0a4d
        else if (roll < 15) blow = "stab";                               // @0a54
        else if (roll < 19) blow = "slice";                              // @0a5b
        else blow = "deadly gash";                                       // @0a62
    }

    switch (blow) {
        case "warded off":
            say("THE $6 WARDS OFF YOUR ATTACK.");                        // @0a65
            return END_TURN;                                             // @0a67
        case "heavy blow":
            say("YOU STRIKE THE $6 A HEAVY BLOW.");                      // @0a6a
            victim.strength = minus(victim.strength, 10);                // @0a6c
            break;                                                       // @0a71
        case "scratch":
            say("YOU SCRATCH THE $6 LIGHTLY.");                          // @0a74
            victim.strength = minus(victim.strength, 5);                 // @0a76
            break;                                                       // @0a7b
        case "nasty cut":
            say("YOU GIVE THE $6 A NASTY CUT.");                         // @0a7e
            victim.strength = minus(victim.strength, 10);                // @0a80
            break;                                                       // @0a85
        case "stab":
            say("YOU STAB THE $6.");                                     // @0a88
            victim.strength = minus(victim.strength, 25);                // @0a8a
            break;                                                       // @0a8f
        case "slice":
            say("YOU SLICE DEEPLY INTO THE BODY OF THE $6.");             // @0a92
            victim.strength = minus(victim.strength, 40);                // @0a94
            break;                                                       // @0a99
        case "deadly gash":
            say("YOU DELIVER A DEADLY GASH TO THE $6.");                 // @0a9c
            victim.strength = 0;                                         // @0a9e
            break;
    }
    if (victim.strength == 0) {                                          // @0aa3
        killCharacter(character);                                        // @0aaa
    }
    return END_TURN;                                                     // @0ab0
}

/*
 * verbExamine - EXAMINE an object, a passage or a wall            bytecode @0abe-0b78
 * ----------------------------------------------------------------------------
 * Changes:   see examineObject
 */
function verbExamine() {
    if (0 < object1) {                                                   // @0ac5
        examineObject();                                                 // @0b35-0b78
    } else if (0 < passage) {                                            // @0acc
        examinePassage();                                                // @0ae6-0b30
    } else {
        say("YOU EXAMINE THE WALL $9.");                                 // @0ad3
        if (rooms[here].exits[dir] == via(2)) {                          // @0ad5  the hole in the dungeon wall
            say("THERE IS A HOLE IN THE WALL.");                         // @0adc
        } else {
            say("YOU SEE NOTHING SPECIAL.");                             // @0ae1
        }
    }
    return END_TURN;
}

/*
 * examinePassage - describe the state of a passage                bytecode @0ae6-0b30
 */
function examinePassage() {
    say("YOU EXAMINE THE $7 $9.");                                       // @0ae6
    switch (passages[passage].state) {
        case GAP:                                                        // @0ae8
            say("YOU SEE NOTHING SPECIAL.");                             // @0b10
            break;                                                       // @0b12
        case OPEN:                                                       // @0aef
            say("IT IS OPEN.");                                          // @0b15
            break;                                                       // @0b17
        case CLOSED:                                                     // @0af6
            if ((passages[passage].flags & IS_DOOR) != 0) {              // @0b1a
                say("IT IS CLOSED BUT NOT LOCKED.");                     // @0b26
            } else {
                say("IT IS CLOSED.");                                    // @0b21
            }
            break;                                                       // @0b23, @0b28
        case LOCKED:                                                     // @0afd
            say("IT IS LOCKED.");                                        // @0b2b
            break;                                                       // @0b2d
        case NAILED:                                                     // @0b04
            say("IT IS NAILED SHUT.");                                   // @0b30
            break;                                                       // @0b32
        default:                                                         //        BOLTED (or more)
            say("IT IS LATCHED AND BOLTED ON THE OTHER SIDE.");          // @0b0b
            break;                                                       // @0b0d
    }
}

/*
 * examineObject - look at an object, or into it                   bytecode @0b35-0b78
 * ----------------------------------------------------------------------------
 * Purpose:   Examining a piece of paper while carrying all three pieces joins
 *            them into the GLOW-SPELL. Otherwise it lists what is inside.
 * Changes:   the three papers and the glow-spell's location; or (via
 *            listObjectsAt) object1 and object2
 */
function examineObject() {
    say("YOU EXAMINE THE $2.");                                          // @0b35
    if ((objects[object1].flags & PAPER_PIECE) != 0                      // @0b37
        && objects[OBJ_SCRAP_OF_PAPER].location == CARRIED               // @0b3e
        && objects[OBJ_STRIP_OF_PAPER].location == CARRIED               // @0b45
        && objects[OBJ_PIECE_OF_PAPER].location == CARRIED) {            // @0b4c
        // The original stores "location == 0" here: always false, i.e. 0.
        objects[OBJ_SCRAP_OF_PAPER].location = NOWHERE;                  // @0b53
        objects[OBJ_STRIP_OF_PAPER].location = NOWHERE;                  // @0b58
        objects[OBJ_PIECE_OF_PAPER].location = NOWHERE;                  // @0b5d
        say("TOGETHER WITH THE OTHER PIECES IT FORMS THE GLOW-SPELL.");  // @0b62
        objects[OBJ_GLOW_SPELL].location = CARRIED;                      // @0b64
        return;                                                          // @0b69
    }
    say("YOU SEE");                                                      // @0b76
    listObjectsAt(inside(object1));                                      // @0b6c-0b78
}


// ============================================================================
// 4.4  THE END OF A TURN
// ----------------------------------------------------------------------------
// After every command that took game time (END_TURN), the world moves on.
// ============================================================================

/*
 * endOfTurn - the world takes its turn                            bytecode @0bea-1713
 * ----------------------------------------------------------------------------
 * Purpose:   In order: exhaustion, the torch, the globe of light, invisibility,
 *            the automatic passages, the dangers of particular rooms, and
 *            finally each character acts.
 * Called by: interpretAndPerform
 */
function endOfTurn() {
    if (!(0 < tiredTriesLeft)) {                                         // @0bea
        say("YOU ARE TOTALLY EXHAUSTED.");                               // @0bf1
        die();                                                           // @0bf3
    }
    burnTorch();                                                         // @0bf9-0c4f
    fadeGlobeOfLight();                                                  // @0c54-0c86
    fadeInvisibility();                                                  // @0c8b-0c9e
    updateAutomaticPassages();                                           // @0ca0-0db9
    roomEvents();                                                        // @0dc0-0ebe
    charactersAct();                                                     // @0ed8-1713
}

/*
 * burnTorch - the burning torch shortens                          bytecode @0bf9-0c4f
 * ----------------------------------------------------------------------------
 * Purpose:   While lit, the torch counts down one turn. If it is here it may
 *            waver: with t turns left, 1 chance in t (never when t is 1, see
 *            random()). At 0 it becomes the EXTINGUISHED TORCH, and if it was
 *            here and no globe of light is shining a dark room goes dark.
 * Changes:   torchTurns, the torch's name, gameFlags
 */
function burnTorch() {
    if (torchTurns == 0) return;                                         // @0bf9
    torchTurns = minus(torchTurns, 1);                                   // @0c00
    if (torchTurns != 0) {                                               // @0c05
        if (findObjectAt(OBJ_TORCH, here) == 0) return;                  // @0c0c-0c12
        const roll = random(torchTurns);                                 // @0c19
        if (roll < torchTurns) return;                                   // @0c1f
        say("THE TORCH WAVERS.");                                        // @0c26
        return;                                                          // @0c28
    }
    objects[OBJ_TORCH].name = objects[OBJ_TORCH].alt;                    // @0c2b
    if (findObjectAt(OBJ_TORCH, here) == 0) return;                      // @0c30-0c36
    say("THE TORCH GOES OUT.");                                          // @0c3d
    if (0 < globeTurns) return;                                          // @0c3f
    if ((rooms[here].flags & DARK) == 0) return;                         // @0c46
    say("IT IS DARK.");                                                  // @0c4d
    gameFlags &= ~LIT;                                                   // @0c4f
}

/*
 * fadeGlobeOfLight - the magic globe of light shortens            bytecode @0c54-0c86
 * ----------------------------------------------------------------------------
 * Changes:   globeTurns, gameFlags
 */
function fadeGlobeOfLight() {
    if (globeTurns == 0) return;                                         // @0c54
    globeTurns = minus(globeTurns, 1);                                   // @0c5b
    if (0 < globeTurns) return;                                          // @0c60
    say("THE MAGIC GLOBE OF LIGHT GOES OUT.");                           // @0c67
    const torchHere = findObjectAt(OBJ_TORCH, here);                     // @0c69
    if (torchHere != 0 && 0 < torchTurns) return;                        // @0c6f, @0c76  the torch still burns
    if ((rooms[here].flags & DARK) == 0) return;                         // @0c7d
    say("IT IS DARK.");                                                  // @0c84
    gameFlags &= ~LIT;                                                   // @0c86
}

/*
 * fadeInvisibility - invisibility wears off                       bytecode @0c8b-0c9e
 * ----------------------------------------------------------------------------
 * Changes:   invisibleTurns
 */
function fadeInvisibility() {
    if (invisibleTurns == 0) return;                                     // @0c8b
    invisibleTurns = minus(invisibleTurns, 1);                           // @0c92
    if (0 < invisibleTurns) return;                                      // @0c97
    say("SUDDENLY YOU BECOME VISIBLE AGAIN.");                           // @0c9e
}

/*
 * updateAutomaticPassages - secret doors open and close by themselves   @0ca0-0db9
 * ----------------------------------------------------------------------------
 * Purpose:   Passages 12 to 36 marked AUTOMATIC (the hidden doors) are checked
 *            every turn. One that is not an exit of the player's room simply
 *            closes, silently. One that is, opens or closes according to its
 *            own rule:
 *              12  WARDROBE side opens while the WARDROBE-DOOR (13) is closed
 *              18  opens when you face it from the SECRET CORRIDOR (52)
 *              22  opens when you face it from the SECRET CORRIDOR (58)
 *              26  opens when you face it from the CORRIDOR (98); from the
 *                  GALLERY it opens while you carry the BOOK OF SECRETS
 *              27  opens when you face it from the CORRIDOR (98)
 *              35  opens when you face it from the SECRET CORRIDOR (89); from
 *                  the other side it opens if you carry the RESERVOIR OF MAGIC
 *                  or have at least 100 magic power (and then costs 5)
 *              36  opens after you have faced N, E, S, W in turn in the
 *                  BEWITCHED ROOM (see roomEvents)
 *            A door that should close stays open once after a DISCLOSE-SPELL.
 * Changes:   passage (loop; ends as 37), dir, passages' state, gameFlags,
 *            player.magic, bewitchedSteps
 */
function updateAutomaticPassages() {
    for (passage = 12; passage <= 36; passage++) {                       // @0ca0, @0db4-0db9
        if ((passages[passage].flags & AUTOMATIC) == 0) continue;        // @0ca5
        if (!findExitToPassage()) {                                      // @0cac-0cce
            passages[passage].state = CLOSED;                            // @0cd5
            continue;                                                    // @0cda
        }

        let opens;
        switch (passage) {
            case 18:                                                     // @0cdd
                opens = (here == 52) && facing == dir;                   // @0d18, @0d7f
                break;
            case 22:                                                     // @0ce4
                opens = (here == 58) && facing == dir;                   // @0d22, @0d7f
                break;
            case 26:                                                     // @0ceb
                if (here == 98) opens = (facing == dir);                 // @0d2c, @0d7f
                else opens = findObjectAt(OBJ_BOOK_OF_SECRETS, CARRIED) != 0;    // @0d33-0d39
                break;
            case 27:                                                     // @0cf2
                opens = (here == 98) && facing == dir;                   // @0d43, @0d7f
                break;
            case 35:                                                     // @0cf9
                if (here == 89) {                                        // @0d4d
                    opens = (facing == dir);                             // @0d7f
                } else if (findObjectAt(OBJ_RESERVOIR, CARRIED) != 0) {  // @0d54-0d5a
                    opens = true;
                } else if (player.magic < 100) {                         // @0d61
                    opens = false;
                } else {
                    player.magic = minus(player.magic, 5);               // @0d68
                    opens = true;                                        // @0d6d
                }
                break;
            case 36:                                                     // @0d00
                if (bewitchedSteps < 4) {                                // @0d70
                    opens = false;
                } else {
                    bewitchedSteps = 0;                                  // @0d77
                    opens = true;                                        // @0d7c
                }
                break;
            default:                                                     //        12 (and any other)
                opens = (here == 39)                                     // @0d07
                    && passages[13].state != OPEN;                       // @0d0e, @0d15
                break;
        }

        if (opens) {
            if (passages[passage].state == OPEN) continue;               // @0da6
            say("THE $7 $9 OPENS.");                                     // @0dad
            passages[passage].state = OPEN;                              // @0daf
        } else {
            if (passages[passage].state == CLOSED) continue;             // @0d86
            if ((gameFlags & DOORS_HELD_OPEN) != 0) {                    // @0d8d
                gameFlags &= ~DOORS_HELD_OPEN;                           // @0d94
                continue;                                                // @0d99
            }
            say("THE $7 $9 CLOSES.");                                    // @0d9c
            passages[passage].state = CLOSED;                            // @0d9e
        }
    }
}

/*
 * findExitToPassage - which exit of this room uses 'passage'?     bytecode @0cac-0cce
 * ----------------------------------------------------------------------------
 * Changes:   dir (1-4 if found, otherwise 5)
 * Returns:   true if found
 */
function findExitToPassage() {
    for (dir = NORTH; dir <= WEST; dir++) {                              // @0cac, @0cc9-0cce
        const exit = rooms[here].exits[dir];
        if ((exit & VIA_PASSAGE) != 0                                    // @0cb1
            && (exit & 127) == passage) return true;                     // @0cb8-0cc2
    }
    return false;
}

/*
 * roomEvents - dangers and effects of particular rooms            bytecode @0dc0-0ebe
 * ----------------------------------------------------------------------------
 * Purpose:   35, 75, 76 ROOM                 the ceiling collapses (9 times in 10)
 *            54 SECRET CORRIDOR              the floor gives way unless you carry
 *                                            the RESERVOIR OF MAGIC or have over
 *                                            100 magic power (which costs 10)
 *            29 STAIRCASE, 31 MEDIEVAL BEDROOM   the custodian notices you
 *            116 OPEN AIR                    you fall to your death
 *            117 DRAWBRIDGE                  you have left the castle: the game
 *                                            ends, with 10 points for escaping
 *            67 CHAPEL                       spells you have here lose their power
 *            105 BEWITCHED ROOM              counts turns spent facing N, E, S, W
 *                                            in order (see passage 36)
 * Changes:   see above
 */
function roomEvents() {
    switch (here) {
        case 35:                                                         // @0dc0
        case 75:                                                         // @0dc7
        case 76: {                                                       // @0dce
            const roll = random(10);                                     // @0e09
            if (roll == 10) break;                                       // @0e0f
            say("WITH A LOUD CRASH THE CEILING COLLAPSES ON YOU.");      // @0e16
            die();                                                       // @0e18
            break;                                                       //        (never reached: die() does not return)
        }
        case 54:                                                         // @0dd5
            if (findObjectAt(OBJ_RESERVOIR, CARRIED) != 0) break;        // @0e1e-0e24
            if (100 < player.magic) {                                    // @0e2b
                player.magic = minus(player.magic, 10);                  // @0e42
            } else {
                player.strength = minus(player.strength, 20);            // @0e32
                say("YOU FALL THROUGH THE FLOOR. YOU LAND IN THE ROOM BELOW.");   // @0e37
                movePlayerTo(13);                                        // @0e39  a CELLAR-VAULT
            }
            break;                                                       // @0e3f, @0e47
        case 31:                                                         // @0ddc
        case 29:                                                         // @0de3
            characters[CUSTODIAN].mood |= DISTURBED;                     // @0e4a
            break;                                                       // @0e4f
        case 116:                                                        // @0dea
            say("YOU FALL FROM A TERRIBLE HEIGHT.");                     // @0e52
            die();                                                       // @0e54
            break;                                                       // @0e5a  (never reached: die() does not return)
        case 117:                                                        // @0df1
            winGame();                                                   // @0e5d
            break;                                                       // @0e63  (never reached: winGame() does not return)
        case 67:                                                         // @0df8
            drainSpellsInChapel();                                       // @0e66-0ea8
            break;                                                       // @0eaa
        case 105:                                                        // @0dff
            bewitchedSteps = plus(bewitchedSteps, 1);                    // @0ead
            if (facing != bewitchedSteps) {                              // @0eb2
                bewitchedSteps = 0;                                      // @0eb9
            }
            break;                                                       // @0ebe
    }
}

/*
 * drainSpellsInChapel - spells here lose their power              bytecode @0e66-0ea8
 * ----------------------------------------------------------------------------
 * Changes:   object2 (loop; ends as 51), spells' names
 */
function drainSpellsInChapel() {
    let drained = false;                                                 // @0e66
    for (object2 = 1; object2 <= LAST_OBJECT; object2++) {               // @0e6b, @0e95-0e9a
        if ((objects[object2].flags2 & SPELL) == 0) continue;            // @0e70
        if (findObjectAt(object2, player.location) == 0) continue;       // @0e77-0e7d
        if (objects[object2].name == objects[object2].alt) continue;     // @0e84
        objects[object2].name = objects[object2].alt;                    // @0e8b
        drained = true;                                                  // @0e90
    }
    if (drained) {                                                       // @0ea1
        say("IN THIS HOLY PLACE SPELLS LOSE THEIR POWER.");              // @0ea8
    }
}


// ============================================================================
// 4.5  THE OTHER CHARACTERS
// ----------------------------------------------------------------------------
// Each character (2 to 9) acts once per turn. The ...Acts functions deal with
// the player if they meet, or carry out the character's routine, and return
//   true   the character then wanders (see wander)
//   false  the character stays where it is this turn
// Moods: DISTURBED (by noise) turns into HOSTILE unless the character is
// FRIENDLY. OFFERED means the player offered it something this turn. Both
// DISTURBED and OFFERED are forgotten at the end of each character's turn.
// ============================================================================

/*
 * charactersAct - every living character takes its turn          bytecode @0ed8-171a
 * ----------------------------------------------------------------------------
 * Purpose:   Characters 2 to 9 act in turn: a dead one does nothing; a DISTURBED
 *            one that is not FRIENDLY becomes HOSTILE; then it acts, and may
 *            wander. Its DISTURBED and OFFERED marks are then cleared.
 *            While it acts, 'character' names it (for "$6" in messages).
 * Notes:     FIX 7. The loop has its own counter, 'acting'. The original
 *            counted with the global 'character' itself - the same byte that
 *            movePlayerTo() sets to the character in the player's new room (or
 *            0). So when a character moved the player (the custodian,
 *            gatekeeper, eagle or wizard "puts" you somewhere), the loop went
 *            on from THAT number + 1: usually the player (1), which is no
 *            character, and the phase ended - the remaining characters lost
 *            their turn (in 2 to 5 turns in 1000 in tests). Rarely a character acted
 *            twice. Now every character acts once per turn, and the switch
 *            needs no default. 'character' may still change during a
 *            character's turn (movePlayerTo), exactly as in the original.
 * Changes:   character (ends as the last character to act, normally the RAT),
 *            moods, and see each ...Acts function
 */
function charactersAct() {
    for (let acting = CUSTODIAN; acting <= RAT; acting++) {              // @0ed8 @170e-1713  (FIX 7: own counter)
        character = acting;                                              //        (FIX 7)
        if (characters[acting].name != characters[acting].dead) {        // @0edd  the dead do nothing
            if ((characters[acting].mood & DISTURBED) != 0               // @0ee4
                && (characters[acting].mood & FRIENDLY) == 0) {          // @0eeb
                characters[acting].mood |= HOSTILE;                      // @0ef2
            }
            let wanders;
            switch (acting) {
                case CUSTODIAN:     wanders = custodianActs(); break;    // @0ef7
                case GIRL:          wanders = girlActs(); break;         // @0efe
                case GATEKEEPER:    wanders = gatekeeperActs(); break;   // @0f05
                case PRIEST:        wanders = priestActs(); break;       // @0f0c
                case EAGLE:         wanders = eagleActs(); break;        // @0f13
                case SECOND_WIZARD: wanders = true; break;               // @0f1a  it only roams
                case WIZARD:        wanders = wizardActs(); break;       // @0f21
                case RAT:           wanders = ratActs(); break;          // @0f28
            }
            if (wanders) wander();                                       // @1672-1707
        }
        characters[acting].mood &= ~(DISTURBED | OFFERED);               // @1709  (AND 243)
    }
}

/*
 * custodianActs - the CUSTODIAN (character 2)                     bytecode @0f32-105b
 * ----------------------------------------------------------------------------
 * Purpose:   Meeting the player (who is not invisible):
 *              refuses presents; if friendly, looks the other way;
 *              half the time takes back the BUNCH OF KEYS;
 *              takes the SUIT OF ARMOUR off the player (and turns hostile);
 *              if hostile, locks the player in the DUNGEON.
 *            His rounds: in the MEDIEVAL BEDROOM (31) he closes door 6; in the
 *            GREAT HALL (22) he closes door 4 and, if he has his keys, locks it.
 * Returns:   true if he wanders afterwards
 * Changes:   player.strength, objects, passages 4 and 6, dir, passage, object2,
 *            his mood, and see movePlayerTo
 */
function custodianActs() {
    const custodian = characters[CUSTODIAN];
    if (custodian.location == player.location && !(0 < invisibleTurns)) {    // @0f32, @0f39
        if ((custodian.mood & OFFERED) != 0) {                           // @0f40
            say("THE $6 SAYS: 'I DO NOT ACCEPT PRESENTS.'");             // @0f81
            return false;                                                // @0f83
        }
        if ((custodian.mood & FRIENDLY) != 0) {                          // @0f47
            say("THE $6 IS FRIENDLY.");                                  // @0f86
            say("HE SAYS: 'I WILL NOT WATCH YOU.'");                     // @0f88
            return true;                                                 // @0f8a
        }
        if (objects[OBJ_KEYS].location == CARRIED) {                     // @0f4e
            const roll = random(2);                                      // @0f55
            if (roll == 2) {                                             // @0f5b
                object2 = OBJ_KEYS;                                      // @0fa1
                say("THE $6 IS ANGRY.");                                 // @0fa6
                player.strength = plus(player.strength, objects[object2].weight);    // @0fa8
                objects[object2].location = heldBy(CUSTODIAN);           // @0fad
                say("THE $6 TAKES THE $3 FROM YOU.");                    // @0fb2
                return false;                                            // @0fb4
            }
        }
        if (objects[OBJ_ARMOUR].location == CARRIED) {                   // @0f62
            object2 = OBJ_ARMOUR;                                        // @0fb7
            say("THE $6 TAKES THE $3 FROM YOU.");                        // @0fbc
            player.strength = plus(player.strength, objects[object2].weight);        // @0fbe
            objects[object2].location = custodian.location;              // @0fc3  and leaves it here
            custodian.mood |= HOSTILE;                                   // @0fc8
            return false;                                                // @0fcd
        }
        if ((custodian.mood & HOSTILE) != 0) {                           // @0f69
            say("THE $6 IS ANGRY.");                                     // @0f8d
            say("HE SAYS: 'YOU HAVE BROKEN THE REGULATIONS.'");          // @0f8f
            say("HE LOCKS YOU UP.");                                     // @0f91
            movePlayerTo(3);                                             // @0f93  the DUNGEON
            custodian.mood &= ~HOSTILE;                                  // @0f99
            return false;                                                // @0f9e
        }
    }

    if (custodian.location == 31) {                                      // @0f70  MEDIEVAL BEDROOM
        passage = 6;                                                     // @0fd0
        if (passages[passage].state == CLOSED) return true;              // @0fd5
        passages[passage].state = CLOSED;                                // @0fdc
        if (player.location == 26) {                                     // @0fe1  on the stairs outside
            dir = EAST;                                                  // @0ff9
            say("THE $7 $9 CLOSES.");                                    // @0ffe
        } else if (player.location == 31) {                              // @0fe8
            dir = WEST;                                                  // @0fef
            say("THE $6 CLOSES THE $7 $9.");                             // @0ff4
        }
        return false;                                                    // @0ff6, @1000
    }

    if (custodian.location == 22) {                                      // @0f77  GREAT HALL
        passage = 4;                                                     // @1003
        if (passages[passage].state == LOCKED) return true;              // @1008
        if (passages[passage].state != CLOSED) {                         // @100f
            passages[passage].state = CLOSED;                            // @1016
            if (player.location == 20) {                                 // @101b  in the corridor outside
                dir = EAST;                                              // @1022
                say("THE $7 $9 CLOSES.");                                // @1027
            }
            if (objects[OBJ_KEYS].location != heldBy(CUSTODIAN)) {       // @1029
                if (player.location == 22) {                             // @1030
                    dir = WEST;                                          // @1037
                    say("THE $6 CLOSES THE $7 $9.");                     // @103c
                }
                return false;                                            // @103e
            }
        } else if (objects[OBJ_KEYS].location != heldBy(CUSTODIAN)) {    // @1041
            return true;
        }
        passages[passage].state = LOCKED;                                // @1048
        if (player.location == 22) {                                    // @104d
            dir = WEST;                                                  // @1054
            say("THE CUSTODIAN LOCKS THE $7 $9.");                       // @1059
        }
        return false;                                                    // @105b
    }
    return true;                                                         // @0f7e
}

/*
 * girlActs - the GIRL (character 3)                               bytecode @105e-10f1
 * ----------------------------------------------------------------------------
 * Purpose:   Meeting the player (who is not invisible): accepts a present and
 *            becomes friendly; if hostile, screams (disturbing the custodian) and
 *            calms down; if friendly, offers help.
 *            In the ENTRY-HALL (33) she tends her postcard stand, now and then
 *            counting her money.
 * Returns:   true if she wanders afterwards
 * Changes:   player.strength, the object offered, moods
 */
function girlActs() {
    const girl = characters[GIRL];
    if (player.location == girl.location && !(0 < invisibleTurns)) {     // @105e, @1065
        if ((girl.mood & OFFERED) != 0 && object1 != 0) {                // @106c  (FIX 8: only if there is a present)
            say("THE $6 ACCEPTS THE $2.");                               // @108b
            player.strength = plus(player.strength, objects[object1].weight);        // @108d
            objects[object1].location = heldBy(GIRL);                    // @1092
            girl.mood |= FRIENDLY;                                       // @1097
            say("SHE SAYS: 'THANK YOU' AND SMILES.");                    // @109c
            return false;                                                // @109e
        }
        if ((girl.mood & HOSTILE) != 0) {                                // @1073
            say("THE GIRL SCREAMS.");                                    // @10a1
            characters[CUSTODIAN].mood |= DISTURBED;                     // @10a3
            girl.mood &= ~HOSTILE;                                       // @10a8
            return true;                                                 // @10ad
        }
        if ((girl.mood & FRIENDLY) != 0) {                               // @107a
            say("THE GIRL SMILES AND SAYS: 'CAN I HELP YOU?'");          // @10b0
            return false;                                                // @10b2
        }
    }
    if (girl.location != 33) return true;                                // @1081, @1088  ENTRY-HALL

    if (findObjectAt(OBJ_MONEY, heldBy(GIRL)) != 0) {                    // @10b5-10bb
        const roll = random(6);                                          // @10c2
        if (!(roll < 6)) {                                               // @10c8
            if (girl.location == player.location) {                      // @10cf
                say("THE $6 COUNTS THE MONEY.");                         // @10d6
            }
            return false;                                                // @10d8
        }
    }
    const roll = random(2);                                              // @10db
    if (roll == 1) return true;                                          // @10e1
    if (girl.location == player.location) {                              // @10e8
        say("THE GIRL LOOKS AT THE POSTCARDS.");                         // @10ef
    }
    return false;                                                        // @10f1
}

/*
 * gatekeeperActs - the GATEKEEPER (character 4)                   bytecode @10f4-1218
 * ----------------------------------------------------------------------------
 * Purpose:   Meeting the player (who is not invisible): if friendly, looks the
 *            other way; accepts a present - the WAD OF MONEY makes him friendly,
 *            anything else offends him; if hostile, attacks (the armour
 *            protects; otherwise half the time it kills); if neither, throws
 *            the player out of his territory.
 *            In the GUARD-ROOM (84) he turns the wheel of the PORTCULLIS (17);
 *            in the CORRIDOR (85) he shuts the TORTURE-ROOM door (32).
 * Returns:   true if he wanders afterwards
 * Changes:   player.strength, objects, passages 17 and 32, dir, passage, moods
 */
function gatekeeperActs() {
    const keeper = characters[GATEKEEPER];
    if (keeper.location == player.location && !(0 < invisibleTurns)) {   // @10f4, @10fb
        if ((keeper.mood & FRIENDLY) != 0) {                             // @1102
            say("THE $6 IS FRIENDLY.");                                  // @1182
            say("HE SAYS: 'I WILL NOT WATCH YOU.'");                     // @1184
            return true;                                                 // @1186
        }
        if ((keeper.mood & OFFERED) != 0 && object1 != 0) {              // @1109  (FIX 8: only if there is a present)
            say("THE $6 ACCEPTS THE $2.");                               // @112b
            player.strength = plus(player.strength, objects[object1].weight);        // @112d
            objects[object1].location = heldBy(GATEKEEPER);              // @1132
            if (object1 == OBJ_MONEY) {                                  // @1137
                say("THE $6 COUNTS THE MONEY.");                         // @1148
                keeper.mood |= FRIENDLY;                                 // @114a
                keeper.mood &= ~HOSTILE;                                 // @114f
            } else {
                say("HE SAYS: 'DO YOU EXPECT TO BUY ME WITH A $2?'");    // @113e
                keeper.mood |= HOSTILE;                                  // @1140
            }
            return false;                                                // @1145, @1154
        }
        if ((keeper.mood & HOSTILE) != 0) {                              // @1110
            say("THE GATEKEEPER ATTACKS. HE HITS YOU.");                 // @1157
            if (objects[OBJ_ARMOUR].location == CARRIED) {               // @1159
                say("YOUR ARMOUR PROTECTS YOU.");                        // @117d
                return false;                                            // @117f
            }
            const roll = random(2);                                      // @1160
            if (roll != 1) {                                             // @1166
                say("IT KNOCKS YOU OUT COLD.");                          // @116d
                die();                                                   // @116f
            }
            player.strength = minus(player.strength, 40);                // @1175
            return false;                                                // @117a
        }
        say("THE $6 SAYS: 'YOU ARE TRESPASSING.'");                      // @1189
        say("HE PUTS YOU OUT OF HIS TERRITORY.");                        // @118b
        movePlayerTo(79);                                                // @118d  SHORT CORRIDOR
        return false;                                                    // @1193
    }

    if (keeper.location == 84) {                                         // @111a  GUARD-ROOM
        const roll = random(3);                                          // @1196
        if (roll < 3) return true;                                       // @119c
        passages[17].state = minus(3, passages[17].state);               // @11a3  PORTCULLIS: OPEN <-> CLOSED
        if (player.location == 49) {                                     // @11a8  COURTYARD, north of it
            dir = SOUTH;                                                 // @11c7
        } else if (player.location == 51) {                              // @11af  GATEWAY, south of it
            dir = NORTH;                                                 // @11cf
        } else {
            if (player.location == keeper.location) {                    // @11b6
                say("THE GATEKEEPER TURNS THE WHEEL.");                  // @11c0
                say("YOU HEAR A NOISE.");                                // @11c2
            }
            return false;                                                // @11bd, @11c4
        }
        passage = 17;                                                    // @11d4
        if (passages[17].state == CLOSED) {                              // @11d9
            say("THE $7 $9 CLOSES.");                                    // @11e5
        } else {
            say("THE $7 $9 OPENS.");                                     // @11e0
        }
        return false;                                                    // @11e2, @11e7
    }

    if (keeper.location == 85) {                                         // @1121  CORRIDOR
        if (passages[32].state != OPEN) return true;                     // @11ea
        passage = 32;                                                    // @11f1
        passages[passage].state = CLOSED;                                // @11f6
        if (player.location == 86) {                                     // @11fb  TORTURE-ROOM
            dir = EAST;                                                  // @1213
            say("THE $7 $9 CLOSES.");                                    // @1218
        } else if (player.location == 85) {                              // @1202
            dir = WEST;                                                  // @1209
            say("THE $6 CLOSES THE $7 $9.");                             // @120e
        }
        return false;                                                    // @1210, @121a
    }
    return true;                                                         // @1128
}

/*
 * priestActs - the PRIEST (character 5)                           bytecode @121d-132f
 * ----------------------------------------------------------------------------
 * Purpose:   Meeting the player (who is not invisible): if friendly, gives a
 *            benediction (+20 strength) and is no longer friendly; accepts a
 *            present and becomes friendly; takes the BOOK OF SECRETS off the
 *            player (and turns hostile); if hostile, speaks a malediction (-30).
 *            His routine: in the CHAPEL (67) he rings the bells; in the
 *            VESTRY (69) he reads or rests; in the GALLERY (71) he takes the
 *            BOOK OF SECRETS from the BOOK-CASE or puts it back.
 * Returns:   true if he wanders afterwards
 * Changes:   player.strength, objects, object2, his mood
 */
function priestActs() {
    const priest = characters[PRIEST];
    if (priest.location == player.location && !(0 < invisibleTurns)) {   // @121d, @1224
        if ((priest.mood & FRIENDLY) != 0) {                             // @122b
            say("THE $6 IS FRIENDLY.");                                  // @129f
            priest.mood &= ~FRIENDLY;                                    // @12a1
            say("HE SPEAKS A BENEDICTION.");                             // @12a6
            say("YOU FEEL STRENGTH FLOWING THROUGH YOU.");               // @12a8
            player.strength = plus(player.strength, 20);                 // @12aa
            return false;                                                // @12af
        }
        if ((priest.mood & OFFERED) != 0 && object1 != 0) {              // @1232  (FIX 8: only if there is a present)
            say("THE $6 ACCEPTS THE $2.");                               // @125f
            player.strength = plus(player.strength, objects[object1].weight);        // @1261
            objects[object1].location = heldBy(PRIEST);                  // @1266
            say("HE SAYS: 'THANK YOU, SON'.");                           // @126b
            priest.mood |= FRIENDLY;                                     // @126d
            return false;                                                // @1272
        }
        if (objects[OBJ_BOOK_OF_SECRETS].location == CARRIED) {          // @1239
            object2 = OBJ_BOOK_OF_SECRETS;                               // @1275
            say("THE $6 TAKES THE $3 FROM YOU.");                        // @127a
            player.strength = plus(player.strength, objects[object2].weight);        // @127c
            objects[object2].location = heldBy(PRIEST);                  // @1281
            priest.mood |= HOSTILE;                                      // @1286
            return false;                                                // @128b
        }
        if ((priest.mood & HOSTILE) != 0) {                              // @1240
            say("THE $6 IS ANGRY.");                                     // @128e
            priest.mood &= ~HOSTILE;                                     // @1290
            say("HE SPEAKS A MALEDICTION. YOU FEEL YOURSELF LOSING STRENGTH.");      // @1295
            player.strength = minus(player.strength, 30);                // @1297
            return false;                                                // @129c
        }
    }

    const book = objects[OBJ_BOOK_OF_SECRETS];
    switch (priest.location) {
        case 67: {                                                       // @1247  CHAPEL
            const roll = random(3);                                      // @12b2
            if (roll < 3) return true;                                   // @12b8
            if (player.location == priest.location) {                    // @12bf
                say("THE PRIEST PULLS THE BELL-ROPE.");                  // @12c6
            }
            say("BELLS START CHIMING.");                                 // @12c8
            return false;                                                // @12ca
        }
        case 69: {                                                       // @124e  VESTRY
            const roll = random(3);                                      // @12cd
            if (roll == 1) return true;                                  // @12d3
            if (player.location != priest.location) return false;        // @12da
            if (book.location == heldBy(PRIEST)) {                       // @12e1
                say("THE PRIEST READS THE BOOK OF SECRETS.");             // @12ed
            } else {
                say("THE $6 RESTS.");                                    // @12e8
            }
            return false;                                                // @12ea, @12ef
        }
        case 71: {                                                       // @1255  GALLERY
            const roll = random(2);                                      // @12f2
            if (roll == 1) return true;                                  // @12f8
            if (book.location == inside(26)) {                           // @12ff  in the BOOK-CASE
                book.location = heldBy(PRIEST);                          // @1310
                if (player.location == priest.location) {                // @1315
                    say("THE PRIEST TAKES THE BOOK OF SECRETS FROM THE BOOK-CASE.");  // @131c
                }
                return false;                                            // @131e
            }
            if (book.location == heldBy(PRIEST)) {                       // @1306
                book.location = inside(26);                              // @1321
                if (player.location == priest.location) {                // @1326
                    say("THE PRIEST PUTS THE BOOK OF SECRETS IN THE BOOK-CASE.");     // @132d
                }
                return false;                                            // @132f
            }
            return true;                                                 // @130d
        }
    }
    return true;                                                         // @125c
}

/*
 * eagleActs - the EAGLE (character 6)                             bytecode @1332-13a6
 * ----------------------------------------------------------------------------
 * Purpose:   Invisibility does not fool it. Meeting the player: if hostile it
 *            stabs (-15); if friendly it carries the player down to the
 *            COURTYARD (49); in its nest (99), 2 times in 3, it throws the
 *            intruder down (-70). Otherwise it rests or wanders.
 * Returns:   true if it wanders afterwards
 * Changes:   player.strength, and see movePlayerTo
 */
function eagleActs() {
    const eagle = characters[EAGLE];
    if (eagle.location == player.location) {                             // @1332
        if (invisibleTurns != 0) {                                       // @1339
            say("THE $6 CAN SMELL YOU, ALTHOUGH YOU ARE INVISIBLE.");    // @1340
        }
        if ((eagle.mood & HOSTILE) != 0) {                               // @1342
            say("THE $6 IS ANGRY.");                                     // @135a
            say("IT STABS YOU WITH ITS BEAK.");                          // @135c
            player.strength = minus(player.strength, 15);                // @135e
            return false;                                                // @1363
        }
        if ((eagle.mood & FRIENDLY) != 0) {                              // @1349
            say("THE $6 IS FRIENDLY.");                                  // @1366
            say("IT CARRIES YOU THROUGH THE AIR AND PUTS YOU DOWN GENTLY.");         // @1368
            movePlayerTo(49);                                            // @136a  COURTYARD
            return false;                                                // @1370
        }
        if (eagle.location == 99) {                                      // @1350  BIRDS' NEST
            const roll = random(3);                                      // @1373
            if (roll != 1) {                                             // @1379
                say("THE EAGLE REGARDS YOU AS AN INTRUDER. IT TAKES YOU UP AND DROPS YOU FROM A HEIGHT.");   // @1380
                movePlayerTo(49);                                        // @1382
                player.strength = minus(player.strength, 70);            // @1388
                return false;                                            // @138d
            }
        }
    }
    const roll = random(3);                                              // @1390
    if (roll == 1) return true;                                          // @1396
    if (player.location == eagle.location) {                             // @139d
        say("THE $6 RESTS.");                                            // @13a4
    }
    return false;                                                        // @13a6
}

/*
 * wizardActs - the WIZARD (character 8)                           bytecode @13a9-1546
 * ----------------------------------------------------------------------------
 * Purpose:   Invisibility does not fool him, and angers him unless he is
 *            friendly. Meeting the player: refuses presents; if hostile, casts
 *            the KILL-SPELL if he still has it, otherwise locks the player in the
 *            BEWITCHED ROOM (105); if friendly, see wizardIsFriendly; otherwise,
 *            half the time, locks the player up.
 *            His routine: experiments in the LABORATORY (107), rests in the
 *            BEDROOM (104), and elsewhere collects treasures (wizardCollects).
 * Returns:   true if he wanders afterwards
 * Changes:   his mood, and see the functions called
 */
function wizardActs() {
    const wizard = characters[WIZARD];
    if (wizard.location == player.location) {                            // @13a9
        if (invisibleTurns != 0) {                                       // @13b0
            say("THE WIZARD SAYS: 'I SEE YOU HAVE USED MY INVISIBILITY-SPELL'.");    // @13b7
            if ((wizard.mood & FRIENDLY) == 0) {                         // @13b9
                wizard.mood |= HOSTILE;                                  // @13c0
            }
        }
        if ((wizard.mood & OFFERED) != 0) {                              // @13c5
            say("THE $6 SAYS: 'I DO NOT ACCEPT PRESENTS.'");             // @13f8
            return false;                                                // @13fa
        }
        if ((wizard.mood & HOSTILE) != 0) {                              // @13cc
            say("THE $6 IS ANGRY.");                                     // @13fd
            wizard.mood &= ~HOSTILE;                                     // @13ff
            if (objects[OBJ_KILL_SPELL].location == heldBy(WIZARD)) {    // @1404
                say("HE CASTS THE KILL-SPELL.");                         // @140b
                die();                                                   // @140d
            }
            return wizardLocksPlayerUp();                                // @1456-1460
        }
        if ((wizard.mood & FRIENDLY) != 0) {                             // @13d3
            return wizardIsFriendly();                                   // @1413-1453
        }
        const roll = random(2);                                          // @13da
        if (roll == 1) return wizardLocksPlayerUp();                     // @13e0
    }

    switch (wizard.location) {
        case 107: {                                                      // @13e7  LABORATORY
            const roll = random(2);                                      // @1517
            if (roll == 1) return true;                                  // @151d
            if (player.location == wizard.location) {                    // @1524
                say("THE WIZARD CARRIES OUT AN EXPERIMENT.");             // @152b
            }
            return false;                                                // @152d
        }
        case 104: {                                                      // @13ee  BEDROOM
            const roll = random(3);                                      // @1530
            if (roll == 1) return true;                                  // @1536
            if (player.location == wizard.location) {                    // @153d
                say("THE $6 RESTS.");                                    // @1544
            }
            return false;                                                // @1546
        }
        default:
            return wizardCollectsTreasure();                             // @13f5 -> @1463-1514
    }
}

/*
 * wizardLocksPlayerUp - into the BEWITCHED ROOM                   bytecode @1456-1460
 * ----------------------------------------------------------------------------
 * Returns:   false (the wizard stays)
 */
function wizardLocksPlayerUp() {
    say("THE $6 SAYS: 'YOU ARE TRESPASSING.'");                          // @1456
    say("HE LOCKS YOU UP.");                                             // @1458
    movePlayerTo(105);                                                   // @145a  BEWITCHED ROOM
    return false;                                                        // @1460
}

/*
 * wizardIsFriendly - the charmed wizard                           bytecode @1413-1453
 * ----------------------------------------------------------------------------
 * Purpose:   1 time in 6 the charm wears off. Otherwise he is friendly: he hands
 *            over the RESERVOIR OF MAGIC if he has it, or says in which room it
 *            lies. (If it is inside something or held by someone else, he wanders.)
 * Returns:   true if he wanders afterwards
 * Changes:   his mood, the reservoir, player.strength, targetRoom
 */
function wizardIsFriendly() {
    const roll = random(6);                                              // @1413
    if (roll == 1) {                                                     // @1419
        say("THE WIZARD WORKS OFF THE CHARM-SPELL.");                    // @144c
        characters[WIZARD].mood &= ~FRIENDLY;                            // @144e
        return false;                                                    // @1453
    }
    say("THE $6 IS FRIENDLY.");                                          // @1420
    const reservoir = objects[OBJ_RESERVOIR];
    if (reservoir.location == heldBy(WIZARD)) {                          // @1422
        say("HE GIVES YOU THE RESERVOIR OF MAGIC.");                     // @1433
        player.strength = minus(player.strength, reservoir.weight);      // @1435
        reservoir.location = CARRIED;                                    // @143a
        return false;                                                    // @143f
    }
    if ((reservoir.location & IN_SOMETHING) == 0) {                      // @1429  lying in a room
        targetRoom = reservoir.location;                                 // @1442
        say("HE SAYS: 'THE RESERVOIR OF MAGIC IS IN THE $5.'");          // @1447
        return false;                                                    // @1449
    }
    return true;                                                         // @1430
}

/*
 * wizardCollectsTreasure - the wizard's magpie habit              bytecode @1463-1514
 * ----------------------------------------------------------------------------
 * Purpose:   3 times in 5, starting from a random object and going round all 50,
 *            he looks for the first TREASURE that is where he is. If he already
 *            has it he may drop it (1 in 5) or examine it (1 in 5). Otherwise he
 *            takes it - from the player if the player has it.
 * Returns:   true if he wanders afterwards
 * Changes:   object2, the treasure's location, player.strength
 */
function wizardCollectsTreasure() {
    const wizard = characters[WIZARD];
    const roll = random(5);                                              // @1463
    if (roll <= 2) return true;                                          // @1469
    const start = random(50);                                            // @1470-1476
    object2 = start;                                                     // @147b
    let found = false;
    do {
        if ((objects[object2].flags & TREASURE) != 0                     // @1480
            && findObjectAt(object2, wizard.location) != 0) {            // @1487-148d
            found = true;
            break;
        }
        object2 = plus(object2, 1);                                      // @1494
        if (!(object2 <= LAST_OBJECT)) object2 = minus(object2, 50);     // @1499, @14a0
    } while (object2 != start);                                          // @14a5
    if (!found) return true;                                             // @14ac

    const treasure = objects[object2];
    if (treasure.location == heldBy(WIZARD)) {                           // @14af  he has it already
        const choice = random(5);                                        // @14d4
        if (choice == 1) {                                               // @14da
            treasure.location = wizard.location;                         // @14eb
            if (player.location == wizard.location) {                    // @14f0
                say("THE $6 DROPS THE $3.");                             // @14f7
            }
            return false;                                                // @14f9
        }
        if (choice == 2) {                                               // @14e1
            if (player.location == wizard.location) {                    // @14fc
                say("THE WIZARD EXAMINES THE $3.");                      // @1503
            }
            return false;                                                // @1505
        }
        return true;                                                     // @14e8
    }
    if (findObjectAt(object2, CARRIED) != 0) {                           // @14b6-14bc  the player has it
        say("THE $6 TAKES THE $3 FROM YOU.");                            // @1508
        player.strength = plus(player.strength, treasure.weight);        // @150a
        treasure.location = heldBy(WIZARD);                              // @150f
        return false;                                                    // @1514
    }
    treasure.location = heldBy(WIZARD);                                  // @14c3
    if (player.location == wizard.location) {                            // @14c8
        say("THE $6 TAKES THE $3.");                                     // @14cf
    }
    return false;                                                        // @14d1
}

/*
 * ratActs - the RAT (character 9)                                 bytecode @1549-166f
 * ----------------------------------------------------------------------------
 * Purpose:   Invisibility does not fool it. Meeting the player: offered the
 *            FOOD SUPPLY it eats (see ratEatsFood); if hostile, it flees from
 *            light, is stopped by the armour, or bites (-5); if friendly, it gives
 *            the player a piece of paper it holds (in the dark it just drops it).
 *            Anywhere, it eats food lying where it is, and otherwise plays with
 *            the three pieces of paper (ratCollectsPaper).
 * Returns:   true if it wanders afterwards
 * Changes:   player.strength, object2, the papers, and see the functions called
 */
function ratActs() {
    const rat = characters[RAT];
    if (rat.location == player.location) {                               // @1549
        if (invisibleTurns != 0) {                                       // @1550
            say("THE $6 CAN SMELL YOU, ALTHOUGH YOU ARE INVISIBLE.");    // @1557
        }
        if ((rat.mood & OFFERED) != 0 && object1 == OBJ_FOOD) {          // @1559, @1560
            return ratEatsFood();                                        // @164b-166d
        }
        if ((rat.mood & HOSTILE) != 0) {                                 // @1567
            if ((gameFlags & LIT) != 0) {                                // @157f
                say("THE RAT FLEES IN FEAR.");                           // @1597
                return true;                                             // @1599
            }
            if (objects[OBJ_ARMOUR].location == CARRIED) {               // @1586
                say("YOU HEAR A NOISE.");                                // @166d
                return false;                                            // @166f
            }
            say("YOU FEEL A BITE.");                                     // @158d
            player.strength = minus(player.strength, 5);                 // @158f
            return true;                                                 // @1594
        }
        if ((rat.mood & FRIENDLY) != 0) {                                // @156e
            if ((gameFlags & LIT) != 0) {                                // @159c
                say("THE $6 IS FRIENDLY.");                              // @15a3
            }
            for (object2 = OBJ_SCRAP_OF_PAPER; object2 <= OBJ_PIECE_OF_PAPER; object2++) {   // @15a5, @15b1-15b6
                if (objects[object2].location == heldBy(RAT)) {          // @15aa
                    if ((gameFlags & LIT) != 0) {                        // @15c0
                        player.strength = minus(player.strength, objects[object2].weight);   // @15c7
                        objects[object2].location = CARRIED;             // @15cc
                        say("YOU ARE GIVEN SOMETHING.");                 // @15d1
                    } else {
                        objects[object2].location = rat.location;        // @15d6
                    }
                    return false;                                        // @15d3, @15db
                }
            }
            return true;                                                 // @15bd
        }
    }
    if (objects[OBJ_FOOD].location == rat.location) {                    // @1575
        return ratEatsFood();                                            // @164b-166d
    }
    return ratCollectsPaper();                                           // @157c -> @15de-1648
}

/*
 * ratEatsFood - the rat eats the FOOD SUPPLY and becomes friendly  bytecode @164b-166d
 * ----------------------------------------------------------------------------
 * Returns:   false (the rat stays)
 * Changes:   the food (gone), the rat's mood
 */
function ratEatsFood() {
    const rat = characters[RAT];
    objects[OBJ_FOOD].location = NOWHERE;                                // @164b
    rat.mood &= ~HOSTILE;                                                // @1650
    rat.mood |= FRIENDLY;                                                // @1655
    if (player.location != rat.location) return false;                   // @165a
    if ((gameFlags & LIT) != 0) {                                        // @1661
        say("THE RAT EATS THE FOOD.");                                   // @1668
    } else {
        say("YOU HEAR A NOISE.");                                        // @166d
    }
    return false;                                                        // @166a, @166f
}

/*
 * ratCollectsPaper - the rat picks up or drops the papers          bytecode @15de-1648
 * ----------------------------------------------------------------------------
 * Purpose:   One roll of 1-10: below 4 the rat wanders. Otherwise it takes the
 *            first piece of paper lying where it is (unless the roll is 10), or
 *            drops the first one it holds (only when the roll is 10).
 * Returns:   true if it wanders afterwards
 * Changes:   object2 (loop), the papers' location
 */
function ratCollectsPaper() {
    const rat = characters[RAT];
    const roll = random(10);                                             // @15de
    if (roll < 4) return true;                                           // @15e4
    for (object2 = OBJ_SCRAP_OF_PAPER; object2 <= OBJ_PIECE_OF_PAPER; object2++) {   // @15eb, @15fe-1603
        if (objects[object2].location == rat.location) {                 // @15f0  lying here: take it
            if (roll == 10) continue;                                    // @160d
            objects[object2].location = heldBy(RAT);                     // @1614
            if (player.location != rat.location) return false;           // @1619
            if ((gameFlags & LIT) != 0) {                                // @1620
                say("THE $6 TAKES THE $3.");                             // @1627
            } else {
                say("YOU HEAR A NOISE.");                                // @166d
            }
            return false;                                                // @1629, @166f
        }
        if (objects[object2].location == heldBy(RAT)) {                  // @15f7  holding it: drop it
            if (roll != 10) continue;                                    // @162c
            objects[object2].location = rat.location;                    // @1633
            if (player.location != rat.location) return false;           // @1638
            if ((gameFlags & LIT) != 0) {                                // @163f
                say("THE $6 DROPS THE $3.");                             // @1646
            } else {
                say("YOU HEAR A NOISE.");                                // @166d
            }
            return false;                                                // @1648, @166f
        }
    }
    return true;                                                         // @160a
}

/*
 * wander - a character moves to a neighbouring room of its own     bytecode @1672-1707
 * ----------------------------------------------------------------------------
 * Purpose:   Starting from a random direction and going clockwise, the first
 *            exit that is not a wall, not a closed passage, and leads into a
 *            room the character owns is taken. The player sees (or, in the dark,
 *            hears) the character leave or arrive.
 * Reads:     character (the one wandering)
 * Changes:   here (set to the character's room: $4 in "ENTERS FROM THE $4"),
 *            dir, targetRoom, passage, the character's location
 */
function wander() {
    const it = characters[character];
    here = it.location;                                                  // @1672
    const firstDirection = random(4);                                    // @1677
    dir = firstDirection;                                                // @167d
    do {
        const exit = rooms[here].exits[dir];
        if (exit != 0) {                                                 // @1682
            targetRoom = exit;                                           // @1689
            let passable = true;
            if ((targetRoom & VIA_PASSAGE) != 0) {                       // @168e
                passage = targetRoom & 127;                              // @1695-169a
                targetRoom = minus(passages[passage].roomSum, here);     // @169f-16a4
                passable = !(1 < passages[passage].state);               // @16a9  not through closed doors
            }
            if (passable && rooms[targetRoom].owner == character) {      // @16b0
                moveWanderer(it);                                        // @16cb-1707
                return;
            }
        }
        dir = (dir & 3) + 1;                                             // @16b7-16bc  next, clockwise
    } while (dir != firstDirection);                                     // @16c1
}

/*
 * moveWanderer - the character goes through the chosen exit       bytecode @16cb-1707
 * ----------------------------------------------------------------------------
 * Parameters: it  the character's record
 * Changes:   its location; dir is turned round for "ENTERS FROM THE ... $9"
 */
function moveWanderer(it) {
    if (player.location == here) {                                       // @16cb
        if ((gameFlags & LIT) != 0) {                                    // @16d2
            say("THE $6 GOES TO THE $5 $9.");                            // @16d9
        } else {
            say("YOU HEAR A NOISE.");                                    // @16de
        }
    }
    it.location = targetRoom;                                            // @16e0
    if (player.location == targetRoom) {                                 // @16e5
        if ((gameFlags & LIT) != 0) {                                    // @16ec
            dir = ((dir + 1) & 3) + 1;                                   // @16f3-16fd  the opposite direction
            say("THE $6 ENTERS FROM THE $4 $9.");                        // @1702
        } else {
            say("YOU HEAR A NOISE.");                                    // @1707
        }
    }
}


// ============================================================================
// 4.6  SUBROUTINES
// ----------------------------------------------------------------------------
// In the original these were one bytecode routine at @1770, entered with a
// function number in a global byte and two arguments in two more. Each
// function number is now an ordinary function:
//     SYS 10  findObjectAt        SYS 14  destroyObjectsAt
//     SYS 11  movePlayerTo        SYS 15  winGame
//     SYS 12  listObjectsAt       SYS 16  die
//     SYS 13  describeExit        SYS 17  computeScore
//     SYS 18  killCharacter       (SYS 2, printing, became say() in PART 3)
// ============================================================================

/*
 * findObjectAt - is this object (or one of the same name) there?  bytecode @1770-17d8
 * ----------------------------------------------------------------------------
 * Purpose:   Starting with 'object' and going on through the following objects
 *            as long as they have the SAME name, returns the first one that is
 *            at 'where'. An object counts as being where its container is, or
 *            where the character holding it is - so a room "contains" what the
 *            player there carries, and CARRIED "contains" what is in a carried bag.
 * Parameters: object  an object number (as typed: the first of its name)
 *             where   a room number, CARRIED, heldBy(...) or inside(...)
 * Returns:   the object number found, or 0
 * Notes:     original "SYS 10": arguments in &191C/&191D, result in &1903
 */
function findObjectAt(object, where) {                                   // @1770  (entered as SYS 10)
    const name = objects[object].name;                                   // @1777
    while (objects[object].name == name) {                               // @177c
        let location = objects[object].location;                         // @1783
        for (;;) {
            if (location == where) return object;                        // @1788-1794, @17d8
            if ((location & IN_SOMETHING) == 0) break;                   // @179c
            if ((location & HELD) != 0) {                                // @17b2
                location = characters[location & 63].location;          // @17b9-17be
            } else {
                location = objects[location & 127].location;             // @17c6-17cb
            }
        }
        object = plus(object, 1);                                        // @17a3
        if (!(object < 51)) break;                                       // @17a8
    }
    return 0;                                                            // @17d3, @17d8
}

/*
 * movePlayerTo - the player enters a room                         bytecode @17de-188a
 * ----------------------------------------------------------------------------
 * Purpose:   Marks the room being left as VISITED (if the player could see),
 *            moves the player, decides whether the new room can be seen - a
 *            dark room needs the burning torch (a torch that is not burnt out
 *            lights itself for 75 turns) or the globe of light - and describes
 *            it. Wearing the armour costs 1 strength per move. Entering the
 *            BEWITCHED ROOM restarts its puzzle.
 * Parameters: room  the room number
 * Notes:     original "SYS 11". In the dark the character in the room is not
 *            looked for, so 'character' keeps its old value (as in the original).
 * Changes:   here, player.location, rooms' VISITED flag, torchTurns, gameFlags,
 *            articleRoom, character, player.strength, bewitchedSteps
 */
function movePlayerTo(room) {                                            // @17de  (entered as SYS 11)
    if ((gameFlags & LIT) != 0) {                                        // @17e5
        rooms[here].flags |= VISITED;                                    // @17ec
    }
    here = room;                                                         // @17f1
    player.location = here;                                              // @17f6

    let canSee = true;
    if ((rooms[here].flags & DARK) != 0) {                               // @17fb
        canSee = false;
        if (findObjectAt(OBJ_TORCH, here) != 0) {                        // @1802-1808
            if (0 < torchTurns) {                                        // @180f  burning
                canSee = true;
            } else if (objects[OBJ_TORCH].name != objects[OBJ_TORCH].alt) {   // @1816  not burnt out
                torchTurns = 75;                                         // @181d  light it
                canSee = true;                                           // @1822
            }
        }
        if (!canSee && 0 < globeTurns) {                                 // @1825
            canSee = true;
        }
    }

    if (!canSee) {
        say("IT IS DARK.");                                              // @182c
        gameFlags &= ~LIT;                                               // @182e
    } else {
        gameFlags |= LIT;                                                // @1836
        articleRoom = here;                                              // @183b
        if ((rooms[here].textFlags & SAY_ON) != 0) {                     // @1840
            say("YOU ARE ON $12 $4.");                                   // @184c
        } else {
            say("YOU ARE IN $12 $4.");                                   // @1847
        }
        character = rooms[here].owner;                                   // @184e
        if (character != NOBODY) {                                       // @1853
            if (characters[character].location != here) {               // @185a
                character = NOBODY;                                      // @1861
            } else {                                                     // @1869  (the original tested LIT again here:
                say("THERE IS A $6 HERE.");                              // @1870   always true, as LIT was set above)
            }
        }
    }

    if (objects[OBJ_ARMOUR].location == CARRIED) {                       // @1872
        player.strength = minus(player.strength, 1);                     // @1879
    }
    if (here == 105) {                                                   // @187e  BEWITCHED ROOM
        bewitchedSteps = 0;                                              // @1885
    }
}                                                                        // @188a

/*
 * listObjectsAt - "A TORCH, A KNIFE AND A FLASK."                 bytecode @1948-19c1
 * ----------------------------------------------------------------------------
 * Purpose:   Lists the VISIBLE objects at 'where' as one sentence. Each object
 *            is printed one step late, so that the last can be given "AND A".
 * Parameters: where  a room number, CARRIED or inside(object)
 * Notes:     original "SYS 12"
 * Changes:   object1 (the last object listed), object2 (loop; ends as 51)
 */
function listObjectsAt(where) {                                          // @1948, @195e  (entered as SYS 12)
    object1 = 0;                                                         // @194f
    let listed = 0;                                                      // @1959  0, 1, or 2 = several
    for (object2 = 1; object2 <= LAST_OBJECT; object2++) {               // @1954, @1986-198b
        if (objects[object2].location != where) continue;                // @1963
        if ((objects[object2].flags & VISIBLE) == 0) continue;           // @196a
        if (listed == 0) {                                               // @1971
            listed = 1;                                                  // @19af
        } else if (listed == 1) {                                        // @1978
            listed = 2;                                                  // @19b7
            say("A $2");                                                 // @19bc
        } else {
            say("\b, A $2");                                             // @197f
        }
        object1 = object2;                                               // @1981
    }
    if (listed == 0) {                                                   // @1992
        say("NOTHING SPECIAL.");                                         // @1999
    } else if (listed == 1) {                                            // @199e
        say("A $2.");                                                    // @19a5
    } else {
        say("AND A $2.");                                                // @19aa
    }
}                                                                        // @19c1

/*
 * describeExit - what lies in one direction                       bytecode @19d3-1aab
 * ----------------------------------------------------------------------------
 * Purpose:   Used by LOOK for each direction. Says nothing about walls or hidden
 *            passages that are shut. Mentions darkness, staircases (UP or DOWN
 *            by level), a continuing corridor, or the room beyond - and for a
 *            passage, whether it is open and what lies beyond it.
 * Parameters: exit       the exit value (0, a room, or via(passage))
 *             direction  1-4
 * Notes:     original "SYS 13"
 * Changes:   dir, targetRoom, passage, articleRoom
 */
function describeExit(exit, direction) {                                 // @19d3  (entered as SYS 13)
    dir = direction;                                                     // @19da
    targetRoom = exit;                                                   // @19df
    if (targetRoom == 0) return;                                         // @19e4  a wall
    if ((exit & VIA_PASSAGE) != 0) {                                     // @19eb
        describePassageExit(exit);                                       // @1a44-1aa9
        return;
    }
    if ((rooms[targetRoom].flags & DARK) != 0) {                         // @19f2
        say("$9 IT IS DARK.");                                           // @19f9
    } else if ((rooms[targetRoom].flags & STAIRS) != 0) {                // @19fe
        const goesUp = rooms[here].level < rooms[targetRoom].level;
        if (rooms[here].name != rooms[targetRoom].name) {                // @1a05
            if (goesUp) say("$9 IS A STAIRCASE LEADING UP.");            // @1a1d, @1a29
            else say("$9 IS A STAIRCASE LEADING DOWN.");                 // @1a24
        } else {
            if (goesUp) say("$9 THE STAIRCASE GOES ON LEADING UP.");     // @1a0c, @1a18
            else say("$9 THE STAIRCASE GOES ON LEADING DOWN.");          // @1a13
        }
    } else if (rooms[here].name == rooms[targetRoom].name) {             // @1a2e
        say("$9 THE $5 GOES ON.");                                       // @1a35
    } else {
        articleRoom = targetRoom;                                        // @1a3a
        say("$9 IS $12 $5.");                                            // @1a3f
    }
}                                                                        // @1aab

/*
 * describePassageExit - a passage in one direction                bytecode @1a44-1aa9
 * ----------------------------------------------------------------------------
 * Parameters: exit  via(passage)
 * Changes:   passage, targetRoom, articleRoom
 */
function describePassageExit(exit) {
    passage = exit & 127;                                                // @1a44-1a49
    targetRoom = minus(passages[passage].roomSum, here);                 // @1a4e-1a53
    if (passages[passage].state == GAP) {                                // @1a58
        if ((passages[passage].flags & HIDDEN) != 0) return;             // @1a5f
        say("$9 IS A $7.");                                              // @1a66
    } else if (passages[passage].state == OPEN) {                        // @1a6b
        say("$9 IS A $7. IT IS OPEN.");                                  // @1a7e
    } else {
        if ((passages[passage].flags & HIDDEN) != 0) return;             // @1a72
        say("$9 IS A $7. IT IS CLOSED.");                                // @1a79
        return;                                                          // @1a7b
    }
    if ((rooms[targetRoom].flags & DARK) != 0) {                         // @1a80
        say("BEYOND IT IS DARK.");                                       // @1a87
    } else if ((rooms[targetRoom].flags & STAIRS) != 0) {                // @1a8c
        if (rooms[here].level < rooms[targetRoom].level) {               // @1a93
            say("BEYOND IS A STAIRCASE LEADING UP.");                    // @1a9f
        } else {
            say("BEYOND IS A STAIRCASE LEADING DOWN.");                  // @1a9a
        }
    } else {
        articleRoom = targetRoom;                                        // @1aa4
        say("BEYOND IS $12 $5.");                                        // @1aa9
    }
}

/*
 * destroyObjectsAt - remove everything at a place                 bytecode @1ab1-1aeb
 * ----------------------------------------------------------------------------
 * Purpose:   Every object at 'where' goes NOWHERE, and its weight is taken off
 *            the container (unless the container's weight is FIXED_WEIGHT).
 * Parameters: where      inside(container)
 *             container  the object that held them
 * Notes:     original "SYS 14"
 */
function destroyObjectsAt(where, container) {                            // @1ab1, @1abd, @1ac2  (entered as SYS 14)
    for (let o = 1; o <= LAST_OBJECT; o++) {                             // @1ab8, @1adf-1ae4
        if (objects[o].location != where) continue;                      // @1ac7
        objects[o].location = NOWHERE;                                   // @1ace
        if (objects[container].weight != FIXED_WEIGHT) {                 // @1ad3
            objects[container].weight = minus(objects[container].weight, objects[o].weight);   // @1ada
        }
    }
}                                                                        // @1aeb

/*
 * winGame - the player has escaped                                bytecode @1af1-1b09
 * ----------------------------------------------------------------------------
 * Notes:     original "SYS 15". Escaping earns 10 extra points. Never returns.
 */
function winGame() {                                                     // @1af1  (entered as SYS 15)
    say("YOU RETURN TO THE WORLD.");                                     // @1af8
    score = computeScore();                                              // @1afa
    score = plus(score, 10);                                             // @1b00
    say("YOUR SCORE IS: $14");                                           // @1b05
    say("$0 $0 PRESS <RETURN> TO PLAY AGAIN.");                          // @1b07
    hostQuit();                                                          // @1b09
}

/*
 * die - the player is dead                                        bytecode @1b0f-1b22
 * ----------------------------------------------------------------------------
 * Notes:     original "SYS 16". Never returns.
 */
function die() {                                                         // @1b0f  (entered as SYS 16)
    say("YOU DIE!");                                                     // @1b16
    score = computeScore();                                              // @1b18
    say("YOUR SCORE IS: $14");                                           // @1b1e
    say("$0 $0 PRESS <RETURN> TO PLAY AGAIN.");                          // @1b20
    hostQuit();                                                          // @1b22
}

/*
 * computeScore - the score                                        bytecode @1b28-1b88
 * ----------------------------------------------------------------------------
 * Purpose:   1 point for each SCORES room VISITED, 15 for each TREASURE carried,
 *            and 5 more for each of those not used up. Stops at 255.
 * Notes:     original "SYS 17"
 * Changes:   targetRoom (loop; ends as 118), object2 (loop; ends as 51)
 * Returns:   the score
 */
function computeScore() {                                                // @1b28  (entered as SYS 17)
    let points = 0;                                                      // @1b2f
    for (targetRoom = 1; targetRoom <= 117; targetRoom++) {              // @1b34, @1b4c-1b51
        if ((rooms[targetRoom].flags & SCORES) != 0                      // @1b39
            && (rooms[targetRoom].flags & VISITED) != 0) {               // @1b40
            points = plus(points, 1);                                    // @1b47
        }
    }
    for (object2 = 1; object2 <= LAST_OBJECT; object2++) {               // @1b58, @1b7c-1b81
        if ((objects[object2].flags & TREASURE) == 0) continue;          // @1b5d
        if (objects[object2].location != CARRIED) continue;              // @1b64
        points = plus(points, 15);                                       // @1b6b
        if (objects[object2].name != objects[object2].alt) {             // @1b70
            points = plus(points, 5);                                    // @1b77
        }
    }
    return points;                                                       // @1b88
}

/*
 * killCharacter - a character dies                                bytecode @1b8e-1bc8
 * ----------------------------------------------------------------------------
 * Purpose:   Announces the death, gives the character its dead name (which is
 *            how the game knows it is dead), and drops everything it held.
 * Parameters: victim  the character number
 * Notes:     original "SYS 18". "THE $6 IS DEAD." names 'character', which is
 *            always the victim when this is called.
 * Changes:   the victim's name, object2 (loop; ends as 51), objects' location
 */
function killCharacter(victim) {                                         // @1b8e, @1b95  (entered as SYS 18)
    say("THE $6 IS DEAD.");                                              // @1b9a
    characters[victim].name = characters[victim].dead;                   // @1b9c
    for (object2 = 1; object2 <= LAST_OBJECT; object2++) {               // @1ba1, @1bbc-1bc1
        if (objects[object2].location == heldBy(victim)) {               // @1ba6-1bb0
            objects[object2].location = characters[victim].location;     // @1bb7
        }
    }
}                                                                        // @1bc8

// ============================================================================
// PART 5  GAME DATA
// ----------------------------------------------------------------------------
// Everything below was extracted mechanically from the disc image
// (files $.Arrays and $.!Start) and is checked byte-for-byte against it by the
// validation suite. Record numbers are the numbers the game logic uses.
// ============================================================================

// ---------------------------------------------------------------------------
// VOCABULARY - the words the parser understands                ($.Arrays R%())
//   kind  VERB      value = verb number (VERB_...)
//         OBJECT    value = object number (the FIRST object of that name)
//         DIRECTION value = 0 AHEAD, 1 RIGHT, 2 BACK, 3 LEFT (relative to facing)
//         PASSAGE   value = passage kind (its description number, 48-60)
// The list MUST stay in this order: lookupWord() is a binary search over it,
// and with abbreviations the order decides which word wins.
// ---------------------------------------------------------------------------
const VOCABULARY = [
    null,                                    // (entry 0 is unused)
    ["AHEAD",         DIRECTION, 0],          // 1
    ["ARMOUR",        OBJECT,    22],         // 2
    ["ATTACK",        VERB,      16],         // 3
    ["BACK",          DIRECTION, 2],          // 4
    ["BALL",          OBJECT,    18],         // 5
    ["BELL-",         OBJECT,    25],         // 6
    ["BLUE",          OBJECT,    35],         // 7
    ["BODY",          OBJECT,    1],          // 8
    ["BOOK-",         OBJECT,    26],         // 9
    ["BOOKS",         OBJECT,    27],         // 10
    ["BUNCH",         OBJECT,    43],         // 11
    ["CANNON",        OBJECT,    17],         // 12
    ["CASE",          OBJECT,    26],         // 13
    ["CELLAR",        PASSAGE,   55],         // 14
    ["CHARM-",        OBJECT,    33],         // 15
    ["CLIMB",         VERB,      3],          // 16
    ["CLOSE",         VERB,      11],         // 17
    ["COMPASS",       OBJECT,    23],         // 18
    ["CORD",          PASSAGE,   52],         // 19
    ["CUPBOARD",      PASSAGE,   58],         // 20
    ["CURTAIN",       PASSAGE,   57],         // 21
    ["DISCLOSE-",     OBJECT,    30],         // 22
    ["DOOR",          PASSAGE,   51],         // 23
    ["DROP",          VERB,      5],          // 24
    ["EXAMINE",       VERB,      9],          // 25
    ["FLASK",         OBJECT,    34],         // 26
    ["FOOD",          OBJECT,    47],         // 27
    ["GIVE",          VERB,      6],          // 28
    ["GLOW-",         OBJECT,    42],         // 29
    ["GO",            VERB,      1],          // 30
    ["GREEN",         OBJECT,    38],         // 31
    ["GUNPOWDER",     OBJECT,    16],         // 32
    ["HIDDEN",        PASSAGE,   53],         // 33
    ["HOLE",          PASSAGE,   49],         // 34
    ["HOME-",         OBJECT,    2],          // 35
    ["INVENTORY",     VERB,      19],         // 36
    ["INVISIBILITY-", OBJECT,    36],         // 37
    ["KEYS",          OBJECT,    43],         // 38
    ["KILL-",         OBJECT,    50],         // 39
    ["KNIFE",         OBJECT,    14],         // 40
    ["LADDER",        OBJECT,    40],         // 41
    ["LARDER",        PASSAGE,   50],         // 42
    ["LEFT",          DIRECTION, 3],          // 43
    ["LIGHT-",        OBJECT,    12],         // 44
    ["LOAD",          VERB,      22],         // 45
    ["LOCK",          VERB,      12],         // 46
    ["LOOK",          VERB,      14],         // 47
    ["MAGIC",         OBJECT,    28],         // 48
    ["MEASURE",       VERB,      17],         // 49
    ["MONEY",         OBJECT,    44],         // 50
    ["OPEN",          VERB,      10],         // 51
    ["PASSWAY",       PASSAGE,   59],         // 52
    ["PIECE",         OBJECT,    6],          // 53
    ["PORTCULLIS",    PASSAGE,   56],         // 54
    ["POSTCARD",      OBJECT,    13],         // 55
    ["PUT",           VERB,      7],          // 56
    ["RED",           OBJECT,    45],         // 57
    ["RESERVOIR",     OBJECT,    11],         // 58
    ["REVEAL-",       OBJECT,    20],         // 59
    ["RIGHT",         DIRECTION, 1],          // 60
    ["RING",          OBJECT,    24],         // 61
    ["ROPE",          OBJECT,    25],         // 62
    ["RUBBISH",       OBJECT,    7],          // 63
    ["RUNGS",         OBJECT,    48],         // 64
    ["SAVE",          VERB,      21],         // 65
    ["SCORE",         VERB,      20],         // 66
    ["SCRAP",         OBJECT,    4],          // 67
    ["SECRETS",       OBJECT,    29],         // 68
    ["SHOW-",         OBJECT,    10],         // 69
    ["STACK",         OBJECT,    46],         // 70
    ["STAFF",         OBJECT,    19],         // 71
    ["STAND",         OBJECT,    13],         // 72
    ["STILL",         OBJECT,    37],         // 73
    ["STRIKE",        VERB,      8],          // 74
    ["STRIP",         OBJECT,    5],          // 75
    ["STRONG",        PASSAGE,   48],         // 76
    ["SUIT",          OBJECT,    22],         // 77
    ["SUPPLY",        OBJECT,    39],         // 78
    ["TAKE",          VERB,      4],          // 79
    ["TELESCOPE",     OBJECT,    32],         // 80
    ["TORCH",         OBJECT,    3],          // 81
    ["TURN",          VERB,      2],          // 82
    ["UNLOCK",        VERB,      13],         // 83
    ["USE",           VERB,      18],         // 84
    ["WAIT",          VERB,      15],         // 85
    ["WARDROBE",      PASSAGE,   54],         // 86
    ["WEAPONS",       OBJECT,    21],         // 87
    ["WELL",          OBJECT,    15],         // 88
    ["WHEEL",         OBJECT,    31],         // 89
    ["WINDOW",        PASSAGE,   60],         // 90
    ["XXX",           VERB,      99],         // 91
];

// ---------------------------------------------------------------------------
// DESCRIPTIONS - names printed by the $1..$13 substitutions    ($.Arrays d$())
// Record fields such as rooms[r].name hold an index into this table.
// ---------------------------------------------------------------------------
const DESCRIPTIONS = [
    "",                           //   0  (prints nothing)
    "SECRET STAIRCASE",           //   1
    "DUNGEON",                    //   2
    "CELLAR-VAULT",               //   3
    "WELL",                       //   4
    "LARDER",                     //   5
    "STAIRCASE",                  //   6
    "SOLDIERS' LIVING-ROOM",      //   7
    "SOLDIERS' ROOM",             //   8
    "CORRIDOR",                   //   9
    "GREAT HALL",                 //  10
    "ANTE-ROOM",                  //  11
    "SHORT CORRIDOR",             //  12
    "EXHIBITION-ROOM",            //  13
    "MEDIEVAL BEDROOM",           //  14
    "ENTRY-HALL",                 //  15
    "ROOM",                       //  16
    "SERVANTS' ROOM",             //  17
    "WARDROBE",                   //  18
    "KITCHEN",                    //  19
    "COURTYARD",                  //  20
    "GATEWAY",                    //  21
    "SECRET CORRIDOR",            //  22
    "MAGIC WORKSHOP",             //  23
    "ARMOURY",                    //  24
    "LONG CORRIDOR",              //  25
    "CHAPEL",                     //  26
    "VESTRY",                     //  27
    "GALLERY",                    //  28
    "GUEST-ROOM",                 //  29
    "LANDING",                    //  30
    "GAMBLING-ROOM",              //  31
    "GUARD-ROOM",                 //  32
    "TORTURE-ROOM",               //  33
    "LOOK-OUT",                   //  34
    "PRIVATE-ROOM",               //  35
    "LUMBER-ROOM",                //  36
    "BIRDS' NEST",                //  37
    "BELL-TOWER",                 //  38
    "BEDROOM",                    //  39
    "BEWITCHED ROOM",             //  40
    "CUPBOARD",                   //  41
    "LABORATORY",                 //  42
    "STORE-ROOM",                 //  43
    "STUDY",                      //  44
    "SMALL ROOM",                 //  45
    "OPEN AIR",                   //  46
    "DRAWBRIDGE",                 //  47
    "STRONG DOOR",                //  48
    "HOLE IN THE WALL",           //  49
    "LARDER-DOOR",                //  50
    "DOOR",                       //  51
    "CORD",                       //  52
    "HIDDEN DOOR",                //  53
    "WARDROBE-DOOR",              //  54
    "CELLAR-DOOR",                //  55
    "PORTCULLIS",                 //  56
    "CURTAIN",                    //  57
    "CUPBOARD-DOOR",              //  58
    "MAGICAL PASSWAY",            //  59
    "BROKEN WINDOW",              //  60
    "YOU",                        //  61
    "CUSTODIAN",                  //  62
    "GIRL",                       //  63
    "GATEKEEPER",                 //  64
    "PRIEST",                     //  65
    "EAGLE",                      //  66
    "WIZARD",                     //  67
    "RAT",                        //  68
    "DEAD CUSTODIAN",             //  69
    "GIRL'S BODY",                //  70
    "BODY OF THE GATEKEEPER",     //  71
    "DEAD PRIEST",                //  72
    "EAGLE'S CARCASS",            //  73
    "WIZARD'S BODY",              //  74
    "GO",                         //  75
    "TURN",                       //  76
    "CLIMB",                      //  77
    "TAKE",                       //  78
    "DROP",                       //  79
    "GIVE",                       //  80
    "PUT",                        //  81
    "STRIKE",                     //  82
    "EXAMINE",                    //  83
    "OPEN",                       //  84
    "CLOSE",                      //  85
    "LOCK",                       //  86
    "UNLOCK",                     //  87
    "LOOK",                       //  88
    "WAIT",                       //  89
    "ATTACK",                     //  90
    "MEASURE",                    //  91
    "USE",                        //  92
    "INVENTORY",                  //  93
    "SCORE",                      //  94
    "SAVE",                       //  95
    "LOAD",                       //  96
    "AHEAD",                      //  97
    "RIGHT",                      //  98
    "BACK",                       //  99
    "LEFT",                       // 100
    "NORTH",                      // 101
    "EAST",                       // 102
    "SOUTH",                      // 103
    "WEST",                       // 104
    "DEAD BODY",                  // 105
    "HOME-SPELL",                 // 106
    "TORCH",                      // 107
    "SCRAP OF PAPER",             // 108
    "STRIP OF PAPER",             // 109
    "PIECE OF PAPER",             // 110
    "HEAP OF RUBBISH",            // 111
    "COMPASS",                    // 112
    "SHOW-CASE",                  // 113
    "RESERVOIR OF MAGIC",         // 114
    "LIGHT-SPELL",                // 115
    "POSTCARD STAND",             // 116
    "KNIFE",                      // 117
    "SERIES OF RUNGS",            // 118
    "CANNON",                     // 119
    "BALL",                       // 120
    "STAFF",                      // 121
    "REVEAL-SPELL",               // 122
    "COLLECTION OF WEAPONS",      // 123
    "SUIT OF ARMOUR",             // 124
    "EXTINGUISHED TORCH",         // 125
    "RING",                       // 126
    "BELL-ROPE",                  // 127
    "BOOK-CASE",                  // 128
    "COLLECTION OF BOOKS",        // 129
    "BOOK ON MAGIC",              // 130
    "BOOK OF SECRETS",            // 131
    "DISCLOSE-SPELL",             // 132
    "WHEEL",                      // 133
    "TELESCOPE",                  // 134
    "CHARM-SPELL",                // 135
    "FLASK",                      // 136
    "BLUE FLUID",                 // 137
    "INVISIBILITY-SPELL",         // 138
    "STILL",                      // 139
    "GREEN FLUID",                // 140
    "SUPPLY OF RED FLUID",        // 141
    "SHORT LADDER",               // 142
    "GLOW-SPELL",                 // 143
    "BUNCH OF KEYS",              // 144
    "WAD OF MONEY",               // 145
    "RED FLUID",                  // 146
    "STACK OF BALLS",             // 147
    "FOOD SUPPLY",                // 148
    "HEAP OF GUNPOWDER",          // 149
    "KILL-SPELL",                 // 150
    "USED HOME-SPELL",            // 151
    "BROKEN COMPASS",             // 152
    "BROKEN SHOW-CASE",           // 153
    "USED LIGHT-SPELL",           // 154
    "USED REVEAL-SPELL",          // 155
    "BROKEN RING",                // 156
    "USED DISCLOSE-SPELL",        // 157
    "BROKEN WHEEL",               // 158
    "BROKEN TELESCOPE",           // 159
    "USED CHARM-SPELL",           // 160
    "BROKEN FLASK",               // 161
    "USED INVISIBILITY-SPELL",    // 162
    "USED GLOW-SPELL",            // 163
    "USED KILL-SPELL",            // 164
    "AHEAD",                      // 165
    "TO YOUR RIGHT",              // 166
    "BEHIND YOU",                 // 167
    "TO YOUR LEFT",               // 168
    "A",                          // 169
    "AN",                         // 170
    "THE",                        // 171
    "DEAD RAT",                   // 172
    "BROKEN STAFF"                // 173
];

// ---------------------------------------------------------------------------
// ROOMS 1-117                                  original array 2, 9-byte records
//   exits   a room number, 0 = wall, or via(n) = through passage n
//   flags   SCORES  visiting it counts towards the score (once VISITED)
//           VISITED set when the player leaves it while able to see
//           STAIRS  it is a staircase     DARK  needs a light
//   ns/ew   the room's size, shown by MEASURE ($15/$16)
//   owner   the character that lives here: only that character enters
//   art     article for $12 (SAY_A, SAY_AN, SAY_THE); at: SAY_IN or SAY_ON
//   level   height; decides "UP" or "DOWN" for stairs and climbing
// ---------------------------------------------------------------------------
const ROOM_DATA = [
//           name                       north    east     south    west     flags               ns  owner          art      at      ew  level
    roomRow("SECRET STAIRCASE",        0,       via(1),  2,       0,       STAIRS|DARK,        1,  NOBODY,        SAY_A,   SAY_ON, 1,  1),  // 1
    roomRow("SECRET STAIRCASE",        1,       59,      0,       0,       STAIRS|DARK,        1,  NOBODY,        SAY_A,   SAY_ON, 1,  2),  // 2
    roomRow("DUNGEON",                 0,       via(2),  0,       via(1),  SCORES|DARK,        2,  RAT,           SAY_A,   SAY_IN, 2,  0),  // 3
    roomRow("CELLAR-VAULT",            5,       via(3),  10,      via(2),  0,                  2,  RAT,           SAY_A,   SAY_IN, 3,  0),  // 4
    roomRow("WELL",                    0,       0,       4,       0,       SCORES,             1,  RAT,           SAY_A,   SAY_IN, 1,  0),  // 5
    roomRow("LARDER",                  0,       0,       0,       via(3),  SCORES|DARK,        1,  RAT,           SAY_A,   SAY_IN, 1,  0),  // 6
    roomRow("CELLAR-VAULT",            0,       0,       8,       10,      DARK,               2,  RAT,           SAY_A,   SAY_IN, 2,  0),  // 7
    roomRow("STAIRCASE",               7,       0,       9,       0,       STAIRS|DARK,        1,  NOBODY,        SAY_A,   SAY_ON, 1,  1),  // 8
    roomRow("STAIRCASE",               8,       via(15), 0,       0,       STAIRS,             1,  RAT,           SAY_A,   SAY_ON, 1,  2),  // 9
    roomRow("CELLAR-VAULT",            4,       7,       0,       11,      DARK,               2,  RAT,           SAY_A,   SAY_IN, 2,  0),  // 10
    roomRow("CELLAR-VAULT",            0,       10,      13,      12,      DARK,               2,  RAT,           SAY_A,   SAY_IN, 2,  0),  // 11
    roomRow("CELLAR-VAULT",            0,       11,      0,       0,       DARK,               2,  RAT,           SAY_A,   SAY_IN, 2,  0),  // 12
    roomRow("CELLAR-VAULT",            11,      0,       0,       0,       DARK,               2,  RAT,           SAY_A,   SAY_IN, 2,  0),  // 13
    roomRow("SOLDIERS' LIVING-ROOM",   0,       16,      66,      0,       0,                  4,  NOBODY,        SAY_A,   SAY_IN, 2,  3),  // 14
    roomRow("SOLDIERS' ROOM",          0,       0,       16,      0,       SCORES,             2,  NOBODY,        SAY_A,   SAY_IN, 2,  3),  // 15
    roomRow("CORRIDOR",                15,      20,      0,       14,      0,                  1,  NOBODY,        SAY_A,   SAY_IN, 2,  3),  // 16
    roomRow("SOLDIERS' ROOM",          0,       0,       0,       66,      SCORES|DARK,        2,  NOBODY,        SAY_A,   SAY_IN, 2,  3),  // 17
    roomRow("STAIRCASE",               0,       19,      20,      0,       STAIRS|DARK,        1,  NOBODY,        SAY_A,   SAY_ON, 1,  4),  // 18
    roomRow("STAIRCASE",               0,       0,       68,      18,      STAIRS|DARK,        1,  NOBODY,        SAY_A,   SAY_ON, 1,  5),  // 19
    roomRow("CORRIDOR",                18,      via(4),  21,      16,      0,                  1,  NOBODY,        SAY_A,   SAY_IN, 2,  3),  // 20
    roomRow("SOLDIERS' ROOM",          20,      0,       0,       0,       SCORES,             2,  NOBODY,        SAY_A,   SAY_IN, 2,  3),  // 21
    roomRow("GREAT HALL",              0,       23,      0,       via(4),  SCORES,             4,  CUSTODIAN,     SAY_THE, SAY_IN, 3,  3),  // 22
    roomRow("ANTE-ROOM",               0,       28,      24,      22,      SCORES,             3,  CUSTODIAN,     SAY_THE, SAY_IN, 3,  3),  // 23
    roomRow("SHORT CORRIDOR",          23,      0,       via(5),  0,       0,                  1,  CUSTODIAN,     SAY_A,   SAY_IN, 1,  3),  // 24
    roomRow("STAIRCASE",               0,       26,      0,       98,      STAIRS|DARK,        1,  NOBODY,        SAY_A,   SAY_ON, 1,  5),  // 25
    roomRow("STAIRCASE",               0,       via(6),  0,       25,      STAIRS,             1,  NOBODY,        SAY_A,   SAY_ON, 1,  4),  // 26
    roomRow("EXHIBITION-ROOM",         0,       0,       28,      0,       SCORES,             2,  CUSTODIAN,     SAY_THE, SAY_IN, 4,  3),  // 27
    roomRow("CORRIDOR",                27,      29,      32,      23,      0,                  1,  CUSTODIAN,     SAY_A,   SAY_IN, 3,  3),  // 28
    roomRow("STAIRCASE",               0,       0,       30,      28,      STAIRS,             1,  CUSTODIAN,     SAY_A,   SAY_ON, 1,  4),  // 29
    roomRow("STAIRCASE",               29,      0,       0,       74,      STAIRS,             1,  CUSTODIAN,     SAY_A,   SAY_ON, 1,  5),  // 30
    roomRow("MEDIEVAL BEDROOM",        0,       via(7),  0,       via(6),  SCORES,             3,  CUSTODIAN,     SAY_THE, SAY_IN, 2,  3),  // 31
    roomRow("MEDIEVAL BEDROOM",        28,      0,       33,      via(7),  0,                  3,  CUSTODIAN,     SAY_THE, SAY_IN, 1,  3),  // 32
    roomRow("ENTRY-HALL",              32,      0,       via(9),  via(8),  SCORES,             2,  GIRL,          SAY_AN,  SAY_IN, 3,  3),  // 33
    roomRow("CORRIDOR",                via(9),  via(10), 44,      45,      0,                  3,  NOBODY,        SAY_A,   SAY_IN, 1,  3),  // 34
    roomRow("ROOM",                    0,       0,       via(11), via(10), 0,                  2,  NOBODY,        SAY_A,   SAY_IN, 2,  3),  // 35
    roomRow("SERVANTS' ROOM",          via(11), via(13), 42,      0,       SCORES|DARK,        3,  NOBODY,        SAY_A,   SAY_IN, 2,  3),  // 36
    roomRow("SECRET STAIRCASE",        0,       0,       38,      77,      SCORES|STAIRS|DARK, 1,  NOBODY,        SAY_A,   SAY_ON, 1,  5),  // 37
    roomRow("SECRET STAIRCASE",        37,      0,       via(12), 0,       SCORES|STAIRS,      1,  NOBODY,        SAY_A,   SAY_ON, 1,  4),  // 38
    roomRow("WARDROBE",                via(12), 0,       0,       via(13), SCORES,             1,  NOBODY,        SAY_A,   SAY_IN, 1,  3),  // 39
    roomRow("STAIRCASE",               79,      0,       0,       41,      STAIRS,             1,  NOBODY,        SAY_A,   SAY_ON, 1,  5),  // 40
    roomRow("STAIRCASE",               0,       40,      0,       42,      STAIRS,             1,  NOBODY,        SAY_A,   SAY_ON, 1,  4),  // 41
    roomRow("CORRIDOR",                36,      41,      0,       43,      DARK,               1,  NOBODY,        SAY_A,   SAY_IN, 1,  3),  // 42
    roomRow("CORRIDOR",                via(14), 42,      0,       0,       DARK,               1,  NOBODY,        SAY_A,   SAY_IN, 1,  3),  // 43
    roomRow("KITCHEN",                 34,      0,       via(14), via(15), SCORES,             2,  RAT,           SAY_A,   SAY_IN, 3,  3),  // 44
    roomRow("CORRIDOR",                via(16), 34,      0,       46,      0,                  1,  NOBODY,        SAY_A,   SAY_IN, 2,  3),  // 45
    roomRow("STAIRCASE",               0,       45,      47,      0,       STAIRS,             1,  NOBODY,        SAY_A,   SAY_ON, 1,  4),  // 46
    roomRow("STAIRCASE",               46,      0,       83,      0,       STAIRS,             1,  NOBODY,        SAY_A,   SAY_ON, 1,  5),  // 47
    roomRow("COURTYARD",               via(5),  via(8),  via(16), 49,      SCORES,             5,  GIRL,          SAY_THE, SAY_IN, 3,  3),  // 48
    roomRow("COURTYARD",               0,       48,      via(17), 50,      SCORES,             5,  GIRL,          SAY_THE, SAY_IN, 2,  3),  // 49
    roomRow("COURTYARD",               0,       49,      via(19), via(23), SCORES,             5,  GIRL,          SAY_THE, SAY_IN, 3,  3),  // 50
    roomRow("GATEWAY",                 via(17), 0,       117,     via(18), SCORES,             3,  NOBODY,        SAY_A,   SAY_IN, 2,  3),  // 51
    roomRow("SECRET CORRIDOR",         via(19), via(18), via(20), 58,      DARK,               1,  NOBODY,        SAY_A,   SAY_IN, 3,  3),  // 52
    roomRow("MAGIC WORKSHOP",          via(20), 0,       via(21), 0,       SCORES,             2,  SECOND_WIZARD, SAY_A,   SAY_IN, 3,  3),  // 53
    roomRow("SECRET CORRIDOR",         via(21), 0,       0,       55,      SCORES,             1,  SECOND_WIZARD, SAY_A,   SAY_IN, 2,  3),  // 54
    roomRow("SECRET STAIRCASE",        0,       54,      0,       56,      STAIRS,             1,  SECOND_WIZARD, SAY_A,   SAY_ON, 1,  4),  // 55
    roomRow("SECRET STAIRCASE",        89,      55,      0,       0,       STAIRS,             1,  SECOND_WIZARD, SAY_A,   SAY_ON, 1,  5),  // 56
    roomRow("ARMOURY",                 62,      via(22), 0,       0,       SCORES,             3,  NOBODY,        SAY_THE, SAY_IN, 3,  3),  // 57
    roomRow("SECRET CORRIDOR",         59,      52,      0,       via(22), DARK,               1,  NOBODY,        SAY_A,   SAY_IN, 1,  3),  // 58
    roomRow("SECRET CORRIDOR",         60,      0,       58,      2,       DARK,               1,  NOBODY,        SAY_A,   SAY_IN, 1,  3),  // 59
    roomRow("SECRET STAIRCASE",        0,       0,       59,      61,      STAIRS|DARK,        1,  NOBODY,        SAY_A,   SAY_ON, 1,  4),  // 60
    roomRow("SECRET STAIRCASE",        0,       60,      94,      0,       STAIRS|DARK,        1,  NOBODY,        SAY_A,   SAY_ON, 1,  5),  // 61
    roomRow("LONG CORRIDOR",           63,      0,       57,      0,       0,                  2,  NOBODY,        SAY_A,   SAY_IN, 1,  3),  // 62
    roomRow("LONG CORRIDOR",           64,      via(23), 62,      0,       0,                  1,  NOBODY,        SAY_A,   SAY_IN, 3,  3),  // 63
    roomRow("LONG CORRIDOR",           66,      65,      63,      0,       0,                  1,  NOBODY,        SAY_A,   SAY_IN, 1,  3),  // 64
    roomRow("SOLDIERS' ROOM",          0,       0,       0,       64,      SCORES,             2,  NOBODY,        SAY_A,   SAY_IN, 2,  3),  // 65
    roomRow("LONG CORRIDOR",           14,      17,      64,      0,       0,                  2,  NOBODY,        SAY_A,   SAY_IN, 1,  3),  // 66
    roomRow("CHAPEL",                  0,       68,      97,      0,       SCORES,             4,  PRIEST,        SAY_THE, SAY_IN, 4,  6),  // 67
    roomRow("SHORT CORRIDOR",          19,      70,      via(24), 67,      0,                  1,  PRIEST,        SAY_A,   SAY_IN, 2,  6),  // 68
    roomRow("VESTRY",                  via(24), 0,       0,       0,       SCORES,             2,  PRIEST,        SAY_A,   SAY_IN, 2,  6),  // 69
    roomRow("GALLERY",                 0,       0,       71,      68,      SCORES,             2,  PRIEST,        SAY_A,   SAY_IN, 1,  6),  // 70
    roomRow("GALLERY",                 70,      via(26), 0,       0,       SCORES,             1,  PRIEST,        SAY_A,   SAY_IN, 3,  6),  // 71
    roomRow("GUEST-ROOM",              0,       via(28), via(27), 0,       SCORES,             3,  NOBODY,        SAY_A,   SAY_IN, 3,  6),  // 72
    roomRow("GUEST-ROOM",              0,       0,       via(29), 0,       SCORES,             2,  NOBODY,        SAY_A,   SAY_IN, 4,  6),  // 73
    roomRow("LANDING",                 via(29), 30,      via(30), via(28), 0,                  2,  NOBODY,        SAY_A,   SAY_ON, 3,  6),  // 74
    roomRow("ROOM",                    via(30), 0,       76,      0,       0,                  3,  NOBODY,        SAY_A,   SAY_IN, 3,  6),  // 75
    roomRow("ROOM",                    75,      0,       via(31), 0,       0,                  3,  NOBODY,        SAY_A,   SAY_IN, 3,  6),  // 76
    roomRow("SECRET STAIRCASE",        0,       37,      78,      0,       SCORES|STAIRS,      1,  NOBODY,        SAY_A,   SAY_ON, 1,  7),  // 77
    roomRow("SECRET STAIRCASE",        77,      110,     0,       0,       SCORES|STAIRS,      1,  NOBODY,        SAY_A,   SAY_ON, 1,  8),  // 78
    roomRow("SHORT CORRIDOR",          0,       0,       40,      80,      0,                  1,  NOBODY,        SAY_A,   SAY_IN, 2,  6),  // 79
    roomRow("GAMBLING-ROOM",           via(31), 79,      0,       82,      0,                  4,  GATEKEEPER,    SAY_A,   SAY_IN, 2,  6),  // 80
    roomRow("GUARD-ROOM",              0,       0,       82,      0,       SCORES,             2,  GATEKEEPER,    SAY_A,   SAY_IN, 2,  6),  // 81
    roomRow("CORRIDOR",                81,      80,      0,       83,      0,                  1,  GATEKEEPER,    SAY_A,   SAY_IN, 2,  6),  // 82
    roomRow("CORRIDOR",                47,      82,      0,       85,      0,                  1,  GATEKEEPER,    SAY_A,   SAY_IN, 1,  6),  // 83
    roomRow("GUARD-ROOM",              0,       0,       85,      0,       SCORES,             2,  GATEKEEPER,    SAY_A,   SAY_IN, 2,  6),  // 84
    roomRow("CORRIDOR",                84,      83,      0,       via(32), 0,                  1,  GATEKEEPER,    SAY_A,   SAY_IN, 2,  6),  // 85
    roomRow("TORTURE-ROOM",            0,       via(32), 0,       via(33), SCORES,             3,  NOBODY,        SAY_A,   SAY_IN, 3,  6),  // 86
    roomRow("LOOK-OUT",                0,       0,       0,       88,      SCORES,             2,  NOBODY,        SAY_A,   SAY_IN, 2,  6),  // 87
    roomRow("LONG CORRIDOR",           92,      87,      0,       via(35), 0,                  1,  NOBODY,        SAY_A,   SAY_IN, 1,  6),  // 88
    roomRow("SECRET CORRIDOR",         90,      via(35), 56,      0,       0,                  1,  SECOND_WIZARD, SAY_A,   SAY_IN, 1,  6),  // 89
    roomRow("STAIRCASE",               91,      0,       89,      0,       STAIRS,             1,  SECOND_WIZARD, SAY_A,   SAY_ON, 1,  7),  // 90
    roomRow("STAIRCASE",               0,       101,     90,      0,       STAIRS,             1,  SECOND_WIZARD, SAY_A,   SAY_ON, 1,  8),  // 91
    roomRow("LONG CORRIDOR",           95,      93,      88,      0,       0,                  2,  NOBODY,        SAY_A,   SAY_IN, 1,  6),  // 92
    roomRow("LONG CORRIDOR",           via(34), via(33), 0,       92,      0,                  1,  NOBODY,        SAY_A,   SAY_IN, 2,  6),  // 93
    roomRow("PRIVATE-ROOM",            61,      0,       via(34), 0,       SCORES,             2,  NOBODY,        SAY_A,   SAY_IN, 2,  6),  // 94
    roomRow("LONG CORRIDOR",           97,      0,       92,      0,       0,                  3,  NOBODY,        SAY_A,   SAY_IN, 1,  6),  // 95
    roomRow("LUMBER-ROOM",             0,       0,       0,       97,      SCORES,             4,  NOBODY,        SAY_A,   SAY_IN, 2,  6),  // 96
    roomRow("LONG CORRIDOR",           67,      96,      95,      0,       0,                  3,  NOBODY,        SAY_A,   SAY_IN, 1,  6),  // 97
    roomRow("CORRIDOR",                via(27), 25,      0,       via(26), SCORES,             1,  NOBODY,        SAY_A,   SAY_IN, 1,  6),  // 98
    roomRow("BIRDS' NEST",             0,       0,       100,     via(40), SCORES,             1,  EAGLE,         SAY_A,   SAY_IN, 3,  1),  // 99
    roomRow("BELL-TOWER",              99,      0,       0,       0,       SCORES,             2,  NOBODY,        SAY_A,   SAY_IN, 3,  10), // 100
    roomRow("SHORT CORRIDOR",          0,       102,     104,     91,      0,                  2,  WIZARD,        SAY_A,   SAY_IN, 1,  9),  // 101
    roomRow("STAIRCASE",               0,       103,     0,       101,     STAIRS,             1,  WIZARD,        SAY_A,   SAY_ON, 1,  10), // 102
    roomRow("STAIRCASE",               0,       0,       114,     102,     STAIRS,             1,  WIZARD,        SAY_A,   SAY_ON, 1,  11), // 103
    roomRow("BEDROOM",                 101,     via(36), 0,       0,       SCORES,             2,  WIZARD,        SAY_A,   SAY_IN, 2,  9),  // 104
    roomRow("BEWITCHED ROOM",          105,     0,       0,       via(36), SCORES,             3,  NOBODY,        SAY_A,   SAY_IN, 2,  9),  // 105
    roomRow("CUPBOARD",                0,       0,       via(37), 0,       SCORES|DARK,        1,  NOBODY,        SAY_A,   SAY_IN, 1,  12), // 106
    roomRow("LABORATORY",              via(37), 114,     0,       0,       SCORES,             2,  WIZARD,        SAY_A,   SAY_IN, 2,  12), // 107
    roomRow("STORE-ROOM",              0,       109,     0,       0,       SCORES,             4,  WIZARD,        SAY_A,   SAY_IN, 2,  9),  // 108
    roomRow("STORE-ROOM",              0,       0,       0,       108,     0,                  2,  WIZARD,        SAY_A,   SAY_IN, 2,  9),  // 109
    roomRow("SECRET STAIRCASE",        111,     0,       0,       78,      SCORES|STAIRS,      1,  NOBODY,        SAY_A,   SAY_ON, 1,  10), // 110
    roomRow("SECRET STAIRCASE",        0,       0,       110,     112,     SCORES|STAIRS,      1,  NOBODY,        SAY_A,   SAY_ON, 1,  11), // 111
    roomRow("STUDY",                   0,       0,       via(25), 0,       SCORES,             3,  WIZARD,        SAY_A,   SAY_IN, 3,  12), // 112
    roomRow("SMALL ROOM",              0,       0,       0,       via(39), 0,                  2,  WIZARD,        SAY_A,   SAY_IN, 1,  12), // 113
    roomRow("LABORATORY",              103,     via(38), 0,       107,     SCORES,             2,  WIZARD,        SAY_A,   SAY_IN, 1,  12), // 114
    roomRow("CORRIDOR",                via(25), via(39), 0,       via(38), 0,                  1,  WIZARD,        SAY_A,   SAY_IN, 3,  12), // 115
    roomRow("OPEN AIR",                0,       via(40), 0,       0,       0,                  0,  EAGLE,         SAY_THE, SAY_IN, 0,  10), // 116
    roomRow("DRAWBRIDGE",              51,      0,       0,       0,       0,                  3,  NOBODY,        SAY_A,   SAY_ON, 1,  3),  // 117
];

// ---------------------------------------------------------------------------
// OBJECTS 1-50                                 original array 1, 6-byte records
//   location  a room number, CARRIED, heldBy(character), inside(object), NOWHERE
//   flags     VISIBLE (listed when you LOOK), CONTAINER, TAKEABLE, CLIMBABLE,
//             USABLE, PAPER_PIECE, LEADS_ELSEWHERE (climbing takes you to 'alt'),
//             TREASURE (scores when carried; the wizard collects them)
//   alt       name it gets when used up or broken, or the room climbing leads to
//   weight    also a container's capacity; 255 = cannot be moved
//   flags2    BREAKABLE, SPELL (cast with USE), OPEN_CONTAINER (can TAKE out of it)
// ---------------------------------------------------------------------------
const OBJECT_DATA = [
//               name                       location              flags                                    alt                        weight flags2
    objectRow("DEAD BODY",              3,                    VISIBLE|TAKEABLE,                        0,                         100,   OPEN_CONTAINER),  //  1  DUNGEON
    objectRow("HOME-SPELL",             inside(1),            VISIBLE|TAKEABLE|USABLE|TREASURE,        "USED HOME-SPELL",         1,     SPELL),           //  2  in DEAD BODY
    objectRow("TORCH",                  3,                    VISIBLE|TAKEABLE,                        "EXTINGUISHED TORCH",      10,    0),               //  3  DUNGEON
    objectRow("SCRAP OF PAPER",         10,                   VISIBLE|TAKEABLE|PAPER_PIECE,            0,                         0,     0),               //  4  CELLAR-VAULT
    objectRow("STRIP OF PAPER",         11,                   VISIBLE|TAKEABLE|PAPER_PIECE,            0,                         0,     0),               //  5  CELLAR-VAULT
    objectRow("PIECE OF PAPER",         12,                   VISIBLE|TAKEABLE|PAPER_PIECE,            0,                         1,     0),               //  6  CELLAR-VAULT
    objectRow("HEAP OF RUBBISH",        17,                   VISIBLE|CONTAINER|TAKEABLE,              0,                         255,   OPEN_CONTAINER),  //  7  SOLDIERS' ROOM
    objectRow("HEAP OF RUBBISH",        65,                   VISIBLE|CONTAINER|TAKEABLE,              0,                         255,   OPEN_CONTAINER),  //  8  SOLDIERS' ROOM
    objectRow("HEAP OF RUBBISH",        21,                   VISIBLE|CONTAINER|TAKEABLE,              0,                         255,   OPEN_CONTAINER),  //  9  SOLDIERS' ROOM
    objectRow("SHOW-CASE",              27,                   VISIBLE|TAKEABLE|CLIMBABLE,              "BROKEN SHOW-CASE",        255,   BREAKABLE),       // 10  EXHIBITION-ROOM
    objectRow("RESERVOIR OF MAGIC",     112,                  VISIBLE|TAKEABLE|TREASURE,               0,                         20,    0),               // 11  STUDY
    objectRow("LIGHT-SPELL",            inside(10),           VISIBLE|TAKEABLE|USABLE|TREASURE,        "USED LIGHT-SPELL",        1,     SPELL),           // 12  in SHOW-CASE
    objectRow("POSTCARD STAND",         33,                   VISIBLE|CONTAINER|TAKEABLE|CLIMBABLE,    0,                         255,   OPEN_CONTAINER),  // 13  ENTRY-HALL
    objectRow("KNIFE",                  44,                   VISIBLE|TAKEABLE,                        0,                         7,     0),               // 14  KITCHEN
    objectRow("WELL",                   49,                   CONTAINER|CLIMBABLE,                     0,                         255,   OPEN_CONTAINER),  // 15  COURTYARD
    objectRow("HEAP OF GUNPOWDER",      inside(17),           VISIBLE|TAKEABLE,                        0,                         7,     0),               // 16  in CANNON
    objectRow("CANNON",                 50,                   VISIBLE|CONTAINER|TAKEABLE|CLIMBABLE|USABLE, 0,                         255,   OPEN_CONTAINER),  // 17  COURTYARD
    objectRow("BALL",                   inside(46),           VISIBLE|TAKEABLE,                        0,                         40,    0),               // 18  in STACK OF BALLS
    objectRow("STAFF",                  53,                   VISIBLE|TAKEABLE,                        "BROKEN STAFF",            13,    BREAKABLE),       // 19  MAGIC WORKSHOP
    objectRow("REVEAL-SPELL",           106,                  VISIBLE|TAKEABLE|USABLE|TREASURE,        "USED REVEAL-SPELL",       1,     SPELL),           // 20  CUPBOARD
    objectRow("COLLECTION OF WEAPONS",  57,                   VISIBLE|TAKEABLE,                        0,                         255,   0),               // 21  ARMOURY
    objectRow("SUIT OF ARMOUR",         57,                   TAKEABLE,                                0,                         60,    0),               // 22  ARMOURY
    objectRow("COMPASS",                inside(7),            VISIBLE|TAKEABLE|USABLE,                 "BROKEN COMPASS",          5,     BREAKABLE),       // 23  in HEAP OF RUBBISH
    objectRow("RING",                   inside(8),            VISIBLE|TAKEABLE,                        "BROKEN RING",             3,     BREAKABLE),       // 24  in HEAP OF RUBBISH
    objectRow("BELL-ROPE",              67,                   CLIMBABLE|USABLE|LEADS_ELSEWHERE,        toRoom(100),               30,    0),               // 25  CHAPEL
    objectRow("BOOK-CASE",              71,                   VISIBLE|CONTAINER|TAKEABLE|CLIMBABLE,    0,                         255,   OPEN_CONTAINER),  // 26  GALLERY
    objectRow("COLLECTION OF BOOKS",    inside(26),           VISIBLE|TAKEABLE,                        0,                         100,   0),               // 27  in BOOK-CASE
    objectRow("BOOK ON MAGIC",          inside(26),           CONTAINER|TAKEABLE,                      0,                         18,    OPEN_CONTAINER),  // 28  in BOOK-CASE
    objectRow("BOOK OF SECRETS",        inside(26),           CONTAINER|TAKEABLE,                      0,                         20,    OPEN_CONTAINER),  // 29  in BOOK-CASE
    objectRow("DISCLOSE-SPELL",         inside(28),           VISIBLE|TAKEABLE|USABLE|TREASURE,        "USED DISCLOSE-SPELL",     1,     SPELL),           // 30  in BOOK ON MAGIC
    objectRow("WHEEL",                  84,                   VISIBLE|TAKEABLE|USABLE,                 "BROKEN WHEEL",            255,   BREAKABLE),       // 31  GUARD-ROOM
    objectRow("TELESCOPE",              87,                   VISIBLE|TAKEABLE|USABLE,                 "BROKEN TELESCOPE",        25,    BREAKABLE),       // 32  LOOK-OUT
    objectRow("CHARM-SPELL",            100,                  VISIBLE|TAKEABLE|USABLE|TREASURE,        "USED CHARM-SPELL",        1,     SPELL),           // 33  BELL-TOWER
    objectRow("FLASK",                  106,                  VISIBLE|CONTAINER|TAKEABLE,              "BROKEN FLASK",            9,     BREAKABLE|OPEN_CONTAINER), // 34  CUPBOARD
    objectRow("BLUE FLUID",             inside(34),           VISIBLE|TAKEABLE,                        0,                         7,     0),               // 35  in FLASK
    objectRow("INVISIBILITY-SPELL",     53,                   VISIBLE|TAKEABLE|USABLE|TREASURE,        "USED INVISIBILITY-SPELL", 1,     SPELL),           // 36  MAGIC WORKSHOP
    objectRow("STILL",                  107,                  VISIBLE|TAKEABLE,                        0,                         111,   BREAKABLE),       // 37  LABORATORY
    objectRow("GREEN FLUID",            inside(37),           VISIBLE|TAKEABLE,                        0,                         9,     0),               // 38  in STILL
    objectRow("SUPPLY OF RED FLUID",    108,                  VISIBLE|CONTAINER|TAKEABLE,              0,                         255,   OPEN_CONTAINER),  // 39  STORE-ROOM
    objectRow("SHORT LADDER",           109,                  VISIBLE|TAKEABLE|CLIMBABLE|LEADS_ELSEWHERE, toRoom(113),               255,   0),               // 40  STORE-ROOM
    objectRow("SHORT LADDER",           113,                  VISIBLE|TAKEABLE|CLIMBABLE|LEADS_ELSEWHERE, toRoom(109),               255,   0),               // 41  SMALL ROOM
    objectRow("GLOW-SPELL",             NOWHERE,              VISIBLE|TAKEABLE|USABLE|TREASURE,        "USED GLOW-SPELL",         1,     SPELL),           // 42
    objectRow("BUNCH OF KEYS",          heldBy(CUSTODIAN),    VISIBLE|TAKEABLE,                        0,                         10,    0),               // 43
    objectRow("WAD OF MONEY",           heldBy(GIRL),         VISIBLE|TAKEABLE,                        0,                         4,     0),               // 44
    objectRow("RED FLUID",              inside(39),           VISIBLE|TAKEABLE,                        0,                         7,     0),               // 45  in SUPPLY OF RED FLUID
    objectRow("STACK OF BALLS",         50,                   VISIBLE|CONTAINER|TAKEABLE|CLIMBABLE,    0,                         255,   OPEN_CONTAINER),  // 46  COURTYARD
    objectRow("FOOD SUPPLY",            6,                    VISIBLE|TAKEABLE,                        0,                         30,    0),               // 47  LARDER
    objectRow("SERIES OF RUNGS",        5,                    VISIBLE|CLIMBABLE|LEADS_ELSEWHERE,       toRoom(49),                255,   0),               // 48  WELL
    objectRow("SERIES OF RUNGS",        inside(15),           VISIBLE|CLIMBABLE|LEADS_ELSEWHERE,       toRoom(5),                 255,   0),               // 49  in WELL
    objectRow("KILL-SPELL",             heldBy(WIZARD),       VISIBLE|TAKEABLE|USABLE|TREASURE,        "USED KILL-SPELL",         1,     SPELL),           // 50
];

// ---------------------------------------------------------------------------
// CHARACTERS 1-9 (1 is the player)             original array 3, 6-byte records
//   mood    HOSTILE, FRIENDLY, DISTURBED (noise; turns hostile), OFFERED (a gift)
//   magic   the player's magic power, spent on spells
//   dead    name used once the character is dead (name == dead means dead)
// ---------------------------------------------------------------------------
const CHARACTER_DATA = [
//               name           strength location mood magic dead
    characterRow("YOU",         250,     51,      0,   150,  0),                        // 1 PLAYER  (starts in GATEWAY)
    characterRow("CUSTODIAN",   150,     28,      0,   0,    "DEAD CUSTODIAN"),         // 2 CUSTODIAN  (starts in CORRIDOR)
    characterRow("GIRL",        100,     33,      0,   0,    "GIRL'S BODY"),            // 3 GIRL  (starts in ENTRY-HALL)
    characterRow("GATEKEEPER",  250,     85,      0,   0,    "BODY OF THE GATEKEEPER"), // 4 GATEKEEPER  (starts in CORRIDOR)
    characterRow("PRIEST",      100,     69,      0,   0,    "DEAD PRIEST"),            // 5 PRIEST  (starts in VESTRY)
    characterRow("EAGLE",       150,     99,      0,   0,    "EAGLE'S CARCASS"),        // 6 EAGLE  (starts in BIRDS' NEST)
    characterRow("WIZARD",      1,       54,      0,   0,    "WIZARD'S BODY"),          // 7 SECOND_WIZARD  (starts in SECRET CORRIDOR)
    characterRow("WIZARD",      100,     112,     0,   0,    "WIZARD'S BODY"),          // 8 WIZARD  (starts in STUDY)
    characterRow("RAT",         50,      4,       0,   0,    "DEAD RAT"),               // 9 RAT  (starts in CELLAR-VAULT)
];

// ---------------------------------------------------------------------------
// PASSAGES 1-40 (doors, curtains, holes...)    original array 4, 4-byte records
//   between  the two rooms it joins (stored as their sum: the far side of a
//            passage is always sum - current room)
//   flags    HIDDEN (invisible unless open), OPENABLE, IS_DOOR (can have a lock),
//            HAS_LOCK, FORCEABLE (STRIKE can open it), AUTOMATIC (opens and
//            closes by itself, see updateAutomaticPassages)
//   state    GAP (nothing to open), OPEN, CLOSED, LOCKED, NAILED, BOLTED
// ---------------------------------------------------------------------------
const PASSAGE_DATA = [
//             name                  between     flags                                  state
    passageRow("STRONG DOOR",        between(1, 3),  OPENABLE|IS_DOOR,                      BOLTED), //  1  SECRET STAIRCASE / DUNGEON
    passageRow("HOLE IN THE WALL",   between(3, 4),  HIDDEN,                                GAP),    //  2  DUNGEON / CELLAR-VAULT
    passageRow("LARDER-DOOR",        between(4, 6),  OPENABLE|IS_DOOR|HAS_LOCK,             LOCKED), //  3  CELLAR-VAULT / LARDER
    passageRow("DOOR",               between(20, 22), OPENABLE|IS_DOOR|HAS_LOCK|FORCEABLE,   LOCKED), //  4  CORRIDOR / GREAT HALL
    passageRow("DOOR",               between(24, 48), OPENABLE|IS_DOOR|HAS_LOCK|FORCEABLE,   OPEN),   //  5  SHORT CORRIDOR / COURTYARD
    passageRow("DOOR",               between(26, 31), OPENABLE|IS_DOOR,                      CLOSED), //  6  STAIRCASE / MEDIEVAL BEDROOM
    passageRow("CORD",               between(31, 32), 0,                                     GAP),    //  7  MEDIEVAL BEDROOM / MEDIEVAL BEDROOM
    passageRow("DOOR",               between(33, 48), OPENABLE|IS_DOOR|HAS_LOCK,             OPEN),   //  8  ENTRY-HALL / COURTYARD
    passageRow("DOOR",               between(33, 34), OPENABLE|IS_DOOR|HAS_LOCK,             LOCKED), //  9  ENTRY-HALL / CORRIDOR
    passageRow("DOOR",               between(34, 35), OPENABLE|IS_DOOR|FORCEABLE,            NAILED), // 10  CORRIDOR / ROOM
    passageRow("DOOR",               between(35, 36), OPENABLE|IS_DOOR,                      OPEN),   // 11  ROOM / SERVANTS' ROOM
    passageRow("HIDDEN DOOR",        between(38, 39), HIDDEN|OPENABLE|AUTOMATIC,             CLOSED), // 12  SECRET STAIRCASE / WARDROBE
    passageRow("WARDROBE-DOOR",      between(36, 39), OPENABLE|IS_DOOR,                      CLOSED), // 13  SERVANTS' ROOM / WARDROBE
    passageRow("DOOR",               between(43, 44), OPENABLE|IS_DOOR|FORCEABLE,            NAILED), // 14  CORRIDOR / KITCHEN
    passageRow("CELLAR-DOOR",        between(9, 44), OPENABLE|IS_DOOR|HAS_LOCK|FORCEABLE,   OPEN),   // 15  STAIRCASE / KITCHEN
    passageRow("DOOR",               between(45, 48), OPENABLE|IS_DOOR|HAS_LOCK,             LOCKED), // 16  CORRIDOR / COURTYARD
    passageRow("PORTCULLIS",         between(49, 51), 0,                                     OPEN),   // 17  COURTYARD / GATEWAY
    passageRow("HIDDEN DOOR",        between(51, 52), HIDDEN|OPENABLE|AUTOMATIC,             CLOSED), // 18  GATEWAY / SECRET CORRIDOR
    passageRow("HOLE IN THE WALL",   between(50, 52), HIDDEN,                                GAP),    // 19  COURTYARD / SECRET CORRIDOR
    passageRow("DOOR",               between(52, 53), OPENABLE|IS_DOOR,                      OPEN),   // 20  SECRET CORRIDOR / MAGIC WORKSHOP
    passageRow("CURTAIN",            between(53, 54), OPENABLE,                              OPEN),   // 21  MAGIC WORKSHOP / SECRET CORRIDOR
    passageRow("HIDDEN DOOR",        between(57, 58), HIDDEN|OPENABLE|AUTOMATIC,             CLOSED), // 22  ARMOURY / SECRET CORRIDOR
    passageRow("DOOR",               between(50, 63), OPENABLE|IS_DOOR|HAS_LOCK,             LOCKED), // 23  COURTYARD / LONG CORRIDOR
    passageRow("CURTAIN",            between(68, 69), OPENABLE,                              OPEN),   // 24  SHORT CORRIDOR / VESTRY
    passageRow("DOOR",               between(112, 115), OPENABLE|IS_DOOR,                      OPEN),   // 25  STUDY / CORRIDOR
    passageRow("HIDDEN DOOR",        between(71, 98), HIDDEN|OPENABLE|AUTOMATIC,             CLOSED), // 26  GALLERY / CORRIDOR
    passageRow("HIDDEN DOOR",        between(72, 98), HIDDEN|OPENABLE|AUTOMATIC,             CLOSED), // 27  GUEST-ROOM / CORRIDOR
    passageRow("DOOR",               between(72, 74), OPENABLE|IS_DOOR,                      CLOSED), // 28  GUEST-ROOM / LANDING
    passageRow("DOOR",               between(73, 74), OPENABLE|IS_DOOR,                      CLOSED), // 29  GUEST-ROOM / LANDING
    passageRow("DOOR",               between(74, 75), OPENABLE|IS_DOOR|FORCEABLE,            NAILED), // 30  LANDING / ROOM
    passageRow("DOOR",               between(76, 80), OPENABLE|IS_DOOR|FORCEABLE,            NAILED), // 31  ROOM / GAMBLING-ROOM
    passageRow("DOOR",               between(85, 86), OPENABLE|IS_DOOR,                      OPEN),   // 32  CORRIDOR / TORTURE-ROOM
    passageRow("DOOR",               between(86, 93), OPENABLE|IS_DOOR,                      OPEN),   // 33  TORTURE-ROOM / LONG CORRIDOR
    passageRow("DOOR",               between(93, 94), OPENABLE|IS_DOOR|HAS_LOCK,             NAILED), // 34  LONG CORRIDOR / PRIVATE-ROOM
    passageRow("HIDDEN DOOR",        between(88, 89), HIDDEN|OPENABLE|AUTOMATIC,             CLOSED), // 35  LONG CORRIDOR / SECRET CORRIDOR
    passageRow("HIDDEN DOOR",        between(104, 105), HIDDEN|OPENABLE|AUTOMATIC,             CLOSED), // 36  BEDROOM / BEWITCHED ROOM
    passageRow("CUPBOARD-DOOR",      between(106, 107), OPENABLE|IS_DOOR,                      CLOSED), // 37  CUPBOARD / LABORATORY
    passageRow("MAGICAL PASSWAY",    between(114, 115), 0,                                     GAP),    // 38  LABORATORY / CORRIDOR
    passageRow("DOOR",               between(113, 115), OPENABLE|IS_DOOR,                      OPEN),   // 39  SMALL ROOM / CORRIDOR
    passageRow("BROKEN WINDOW",      between(99, 116), 0,                                     OPEN),   // 40  BIRDS' NEST / OPEN AIR
];

// ---------------------------------------------------------------------------
// VERBS 1-22 and what each needs before it can run          original array 5
//   (checked by checkVerbRequirements, in this bit order)
// ---------------------------------------------------------------------------
const VERB_DATA = [
    verbRow("GO",        NEEDS_STRENGTH|NEEDS_DIRECTION),                            // 1
    verbRow("TURN",      NEEDS_STRENGTH|NEEDS_DIRECTION),                            // 2
    verbRow("CLIMB",     NEEDS_LIGHT|NEEDS_STRENGTH|NEEDS_OBJECT),                   // 3
    verbRow("TAKE",      NEEDS_LIGHT|NEEDS_OBJECT),                                  // 4
    verbRow("DROP",      NEEDS_OBJECT),                                              // 5
    verbRow("GIVE",      NEEDS_LIGHT|NEEDS_OBJECT|NEEDS_CHARACTER),                  // 6
    verbRow("PUT",       NEEDS_LIGHT|NEEDS_OBJECT|NEEDS_SECOND_OBJECT),              // 7
    verbRow("STRIKE",    NEEDS_LIGHT|NEEDS_STRENGTH|NEEDS_TARGET),                   // 8
    verbRow("EXAMINE",   NEEDS_LIGHT|NEEDS_TARGET),                                  // 9
    verbRow("OPEN",      NEEDS_STRENGTH|NEEDS_PASSAGE),                              // 10
    verbRow("CLOSE",     NEEDS_STRENGTH|NEEDS_PASSAGE),                              // 11
    verbRow("LOCK",      NEEDS_LIGHT|NEEDS_STRENGTH|NEEDS_PASSAGE),                  // 12
    verbRow("UNLOCK",    NEEDS_LIGHT|NEEDS_STRENGTH|NEEDS_PASSAGE),                  // 13
    verbRow("LOOK",      0),                                                         // 14
    verbRow("WAIT",      0),                                                         // 15
    verbRow("ATTACK",    NEEDS_LIGHT|NEEDS_STRENGTH|NEEDS_CHARACTER),                // 16
    verbRow("MEASURE",   NEEDS_LIGHT),                                               // 17
    verbRow("USE",       NEEDS_LIGHT|NEEDS_OBJECT),                                  // 18
    verbRow("INVENTORY", 0),                                                         // 19
    verbRow("SCORE",     0),                                                         // 20
    verbRow("SAVE",      0),                                                         // 21
    verbRow("LOAD",      0),                                                         // 22  (this last byte lies just past the saved area; it is 0)
];

// ---------------------------------------------------------------------------
// START-UP BYTES OF THE TWO GLOBAL AREAS                       ($.!Start &1900)
// &1900-&191E  game variables: all 0 except facing = 1 (NORTH), gameFlags = LIT,
//              tiredTriesLeft = 5. Set by resetWorld() through the variables.
// &191F-&193D  the original's $1..$16 text slots: leftovers from the author's
//              session (this engine computes substitutions when printing).
//              (In the original the last six bytes were also "object record 0";
//              here record 0 is an empty record - FIX 8.)
// ---------------------------------------------------------------------------
const TEXT_SLOT_LEFTOVERS = [133, 75, 51, 51, 3, 2, 48, 92, 97, 165, 105, 196, 233, 160, 4, 2, 3, 160, 215, 165, 160, 176, 198, 160, 160, 160, 193, 160, 133, 160, 146];
// (check) global bytes at start: 0 0 0 0 0 0 0 0 0 1 8 0 0 0 0 0 0 0 0 5 0 0 0 0 0 0 0 0 0 0 0


// ============================================================================
// PART 6  PUBLIC INTERFACE
// ----------------------------------------------------------------------------
// How a front end talks to the game:
//
//     const game = createArendarvonGame({ random, storage, trace });
//     let reply = game.start();             // { text, waitingFor, newGame }
//     reply = game.submit("TAKE TORCH");    // for every line the player types
//
// reply.text        what to show (lines separated by "\n"; a command prompt
//                   ends with ">")
// reply.waitingFor  what the next line is for:
//                     "command"          a command
//                     "save: confirm"    answer to "Save this situation?"
//                     "save: filename"   answer to "Filename?"
//                     "load: confirm", "load: filename"   the same for LOAD
//                     "quit: confirm"    answer to "Do you really want to quit?"
//                     "restart"          the game is over: any line starts anew
//                                        (the front end says "press Enter to
//                                        play again" if the text does not)
// reply.newGame     true when a new game has just started (clear the screen)
//
// io (all optional)
//   random(limit)            a whole number from 1 to limit (default Math.random)
//   storage.save(name, text) store a saved game; return true if it worked
//   storage.load(name)       return the saved text, or null
//   trace(event)             told about every message, random number and
//                            prompt - used by the validation suite
// ============================================================================

// HOST "INPUT" (service 1): the game waits for the next command line.
function waitForCommand() {                                              // @006c
    trace({ type: "input" });
    waitingFor = "command";
}

function respond(action, newGame) {
    screenText = "";
    try {
        action();
    } catch (e) {
        if (e instanceof GameEnded) {
            waitingFor = "restart";
        } else if (e instanceof HostError) {
            trace({ type: "halt", reason: e.message });
            screenText += "\n" + e.message + "\n";
            waitingFor = "restart";
        } else {
            throw e;
        }
    }
    const text = screenText.split("\n").map((line) => line.replace(/ +$/, "")).join("\n");
    return { text: text, waitingFor: waitingFor, newGame: !!newGame };
}

return {
    start() {
        return respond(startGame, true);
    },
    submit(line) {
        line = String(line);
        if (waitingFor == "command") return respond(() => { readCommandWords(line); runCommand(); });
        if (waitingFor == "restart") return respond(startGame, true);
        return respond(() => { if (!continueDialog(line)) beginNewCommand(); });
    },
    get waitingFor() {
        return waitingFor;
    },

    // ---- for the validation suite ----
    // snapshot(): the 1672 bytes the original would have held at &1900-&1F87
    snapshot() {
        const bytes = state.slice(0, STATE_SIZE);
        writeGlobals(bytes);
        return bytes;
    },
    // newWorldSnapshot(): the bytes of a freshly reset world (should equal $.!Start)
    newWorldSnapshot() {
        resetWorld();
        const bytes = state.slice(0, STATE_SIZE);
        writeGlobals(bytes);
        return bytes;
    },
    // restoreSnapshot(bytes): set every game variable and record from such bytes
    restoreSnapshot(bytes) {
        state.set(bytes.subarray(0, STATE_SIZE));
        readGlobals(bytes);
        waitingFor = "command";
    },
    saveGameAsJson: saveGameAsJson,
    loadGameFromJson: loadGameFromJson,
};

}   // end of createArendarvonGame

if (typeof module !== "undefined" && module.exports) module.exports = createArendarvonGame;
