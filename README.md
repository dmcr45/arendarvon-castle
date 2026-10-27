# The Secret of Arendarvon Castle

A playable, documented refactor of the 1984 BBC Micro adventure by Hal Renko &
Sam Edwards with Arend Rensink (Addison-Wesley, ISBN 0-201-14080-4).

The game was published as a type-in listing, so its buyers spent seven evenings
copying an encoded program out of a book without being able to read a line of
it. What they were typing was bytecode for a small virtual machine the authors
called ALADIN. This repository holds that game's logic, disassembled from the
bytecode and rewritten as commented JavaScript that runs on its own — no BBC
Micro, no emulator, no BASIC. It is a translation, not a remake, and the claim
is tested rather than asserted.

## Play it

**In a browser:** open `arendarvon.html`, keeping it next to
`arendarvon-engine.js`. 

**In a terminal,** with [Node.js](https://nodejs.org):
```bash
node arendarvon.js
```

Commands are a verb and what it applies to: `TAKE TORCH`, `OPEN DOOR`,
`STRIKE WALL AHEAD`. Directions are relative to the way you face — `AHEAD`,
`RIGHT`, `BACK`, `LEFT`. Words can be shortened (`TOR` finds the torch), unknown
words are ignored, lower case is fine, and `QUIT` leaves.

Text wraps to the window in ordinary sentence case; the original printed
capitals on a 40-column screen.

## What is here

| | |
|---|---|
| `arendarvon-engine.js` | the game: rules, parser, printer and world data, in one file |
| `arendarvon.html`, `arendarvon.js` | browser and terminal front ends |
| `validation/` | the test harness: a 6502 emulator, the BASIC host re-implemented, and the comparison campaign |
| `reference/` | listings made from the disc: bytecode, the 6502 VM, vocabulary, messages, descriptions, world data, the BASIC host |
| `docs/` | validation report, castle map |
| `disc/` | the disc image the harness runs against |

Every statement carries the offset of the bytecode it came from, so any line can
be checked against `reference/bytecode_listing.txt`:

```js
if ((door.flags & HAS_LOCK) == 0) {                                  // @042c
    say("THE $7 HAS NO LOCK.");                                      // @0433
} else if (objects[OBJ_KEYS].location != CARRIED) {                  // @0438
```

## Is it faithful?

The JavaScript refactor is checked against the original program rather than
against anyone's reading of it. A 6502 emulator runs the real ALADIN machine
code and bytecode from the disc, with the BBC BASIC host re-implemented; both
are given the same commands and the same random numbers, and compared after
every one — every message, every random number, and all 1,672 bytes of saved
state.

- **238,680 commands across 1,080 games, no differences.** Random, state-aware
  and scripted play, save/load round trips, and 27,330 deliberate state
  mutations to reach rare situations.
- **1,470 of the program's 1,476 instructions executed.** The other six are
  dead code: each follows a call that ends the game and never returns.
- A static audit confirms every non-GOTO instruction is accounted for in the
  source, and every message printed is exactly the original's.

`docs/VALIDATION_REPORT.txt` has the detail; the suite can be re-run.

## Deliberate differences

Eleven, each documented at the top of the engine: lower-case input, sentence
case, wrapping to the window, JSON saves, `QUIT`/`EXIT` in place of the authors'
debug word `XXX`, a typo at `@012b` written as intended, and five bug fixes —
among them an inverted test after `STRIKE TORCH`, and `LOCK`/`UNLOCK` letting
the keys open doors the author had nailed shut.

Each fix was also written into the original bytecode, so the comparison above
still runs against a like-for-like original;
`reference/fixes_bytecode_listing.txt` lists those patches.

## The original

- **The game:** [bbcmicro.co.uk](https://bbcmicro.co.uk/game.php?id=2216) has
  the disc image and plays it in your browser through jsbeeb. Lurkio's corrected
  disc is on the [Stardot forums](https://stardot.org.uk/forums/viewtopic.php?f=7&t=4836).
- **The book:** scanned at the
  [Internet Archive](https://archive.org/details/arendarvon) — the castle's
  history in newspaper clippings, how to play, and how to type it in.
- **An emulator:** [BeebEm](https://github.com/stardot/beebem-windows) runs
  either disc as a BBC Micro would.

## Rights and preservation

The game is still in copyright: it rests with the authors or with
Addison-Wesley's successor, and none of it is mine to give away. My own work
here — the refactor, the harness, the front ends and the documentation — is MIT
licensed; see [LICENSE](LICENSE). The two are not cleanly separable, since the
engine is a translation of the authors' program and embeds their text and world
data, so treat the whole as a derivative work.

It is published as preservation of a type-in listing forty years out of print,
following the line [bbcmicro.co.uk](https://bbcmicro.co.uk/game.php?id=2216)
draws: the program is archived so people can play it, and the printed book is
left to others. The program is here; the book is not. If any of the authors or
rights holders would prefer this changed or taken down, saying so is enough.

## Credits

The game is by **Hal Renko & Sam Edwards** (a pen name of Kasper Boon) with
**Arend Rensink**, whose name signs the listings, dated 7 July 1984. The castle,
the writing, the puzzles and ALADIN itself are theirs.

The refactor, harness and documentation are mine — **Dennis McRitchie** —
working with Claude (Anthropic): I set the goals, made the design decisions and
played the result; Claude did the disassembly, wrote the code, and built and ran
the test harness.
