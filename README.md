# The Secret of Arendarvon Castle

A playable, documented refactor of the 1984 BBC Micro adventure
*The Secret of Arendarvon Castle*, by Hal Renko & Sam Edwards with Arend Rensink
(Addison-Wesley, ISBN 0-201-14080-4).

The game was published as a type-in listing: a book of newspaper clippings and
castle history, a booklet on playing it, and a third booklet that walked the
reader through typing in an encoded program over seven evenings. What they were
typing was bytecode for a small virtual machine the authors called ALADIN.

This repository contains that game's logic, disassembled from the bytecode and
rewritten as structured, commented JavaScript that runs on its own: no BBC
BASIC, no virtual machine, no emulator. It is a translation, not a reimagining.
Everything the original did, it does, and that claim is tested rather than
asserted (see [Is it faithful?](#is-it-faithful)).

> **Please read [NOTICE.md](NOTICE.md) before copying or redistributing any of
> this.** The underlying game is still in copyright and is not mine to give away.

## Play it

**In a browser.** Open `arendarvon.html`. Nothing to install; keep it next to
`arendarvon-engine.js`.

**In a terminal.** With [Node.js](https://nodejs.org) installed:

```bash
node arendarvon.js
```

Type commands such as `TAKE TORCH`, `OPEN DOOR`, `STRIKE WALL AHEAD`. Directions
are relative to the way you face: `AHEAD`, `RIGHT`, `BACK`, `LEFT`. Words can be
shortened (`TOR` finds the torch), unknown words are ignored, and lower case is
fine. `QUIT` or `EXIT` leaves the game.

Both front ends word-wrap to the window and show the text in ordinary sentence
case; the original printed everything in capitals on a 40-column screen. The
terminal version re-wraps the whole screen when you resize the window.

## What is here

| | |
|---|---|
| `arendarvon-engine.js` | the game: rules, parser, printer and world data, in one file |
| `arendarvon.html` | browser front end |
| `arendarvon.js` | terminal front end (Node.js) |
| `validation/` | the test harness: a 6502 emulator, the BASIC host re-implemented, and the comparison campaign |
| `reference/` | independent listings made from the disc: the bytecode, the 6502 VM, the vocabulary, messages, descriptions, world data, and the BASIC host |
| `docs/` | the validation report, and a map of the castle |
| `disc/` | the original disc image, used by the test harness |

Every statement of the game logic carries the offset of the bytecode
instruction it came from:

```js
if ((door.flags & HAS_LOCK) == 0) {                                  // @042c
    say("THE $7 HAS NO LOCK.");                                      // @0433
} else if (objects[OBJ_KEYS].location != CARRIED) {                  // @0438
```

so any line can be checked against `reference/bytecode_listing.txt`.

## Is it faithful?

It is compared with the original program itself, not with anyone's reading of
the original.

A 6502 emulator runs the real ALADIN machine code and the real bytecode from
the disc image, with the BBC BASIC host program re-implemented line by line.
The refactor and that reference machine are then given the same commands and
the same random numbers, and compared after every single command: every message
printed, every random number requested, every prompt, and all 1,672 bytes of
state that a saved game held.

- **238,680 commands, no differences.** 1,080 games of random, state-aware and
  scripted play, including save/load round trips and 27,330 deliberate state
  mutations to reach rare situations.
- **1,470 of the 1,476 reachable bytecode instructions executed.** The other six
  cannot run: they follow a call that ends the game.
- A static audit checks that every non-GOTO instruction is accounted for in the
  source and that every `say(...)` is exactly the original message.

`docs/VALIDATION_REPORT.txt` gives the full account, and the whole suite can be
re-run from `validation/` (see section 6 of the report).

## Deliberate differences

Eleven, all listed at the top of the engine with the reasoning:

- lower-case input, sentence case output, wrapping to the window, JSON saved
  games, and `QUIT`/`EXIT` replacing the authors' debug word `XXX`;
- a typo at bytecode offset `@012b` written as the author intended (no visible
  effect, demonstrated);
- five genuine bug fixes, including a test after `STRIKE TORCH` that was
  inverted, and `LOCK`/`UNLOCK` behaviour that let the keys open doors the
  author had nailed shut.

Each fix was also written into the original bytecode so that the comparison
above still runs against a like-for-like original;
`reference/fixes_bytecode_listing.txt` lists those patches instruction by
instruction.

## Credits

The game is by **Hal Renko & Sam Edwards** (a pen name of Kasper Boon) with
**Arend Rensink**, whose name signs the BASIC listings in the original book,
dated 7 July 1984. The ALADIN virtual machine, the bytecode, the castle, the
writing and the puzzles are theirs.

The refactor, the test harness and the documentation are by **Dennis McRitchie**,
working with Claude (Anthropic). I set the goals and made the design decisions
and played the result; Claude did the disassembly, wrote the code, and built and
ran the test harness.
