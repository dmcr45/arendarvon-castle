# v1.0.0 — The Secret of Arendarvon Castle, playable again

The 1984 BBC Micro adventure by Hal Renko & Sam Edwards with Arend Rensink
(Addison-Wesley, ISBN 0-201-14080-4), disassembled from its original ALADIN
bytecode and rewritten as a single, documented JavaScript file that runs on its
own — no BBC Micro, no emulator, no BASIC.

## Play it

- **In your browser:** https://dmcr45.github.io/arendarvon-castle/
- **Download:** `play-arendarvon-castle-1.0.0.zip` below (68 KB). Unzip and open
  `arendarvon.html`, or run `node arendarvon.js` for a terminal game.

Commands are a verb and what it applies to: `TAKE TORCH`, `OPEN DOOR`,
`STRIKE WALL AHEAD`. Directions are relative to the way you face — `AHEAD`,
`RIGHT`, `BACK`, `LEFT`. Words may be shortened, unknown words are ignored, and
`QUIT` leaves the game.

## Faithful, and tested rather than asserted

The refactor is compared against the original program itself: a 6502 emulator
runs the real ALADIN machine code and bytecode from the disc, with the BBC BASIC
host re-implemented, and the two are checked after every command — every
message, every random number, and all 1,672 bytes of saved state.

- **238,680 commands across 1,080 games, with no differences.**
- 1,470 of the program's 1,476 instructions executed; the remaining six are dead
  code, each following a call that ends the game and never returns.
- A static audit confirms every non-GOTO instruction is accounted for in the
  source, and that every message printed is exactly the original's.

`docs/VALIDATION_REPORT.txt` gives the full account, and the suite can be re-run.

## Deliberate differences from 1984

Lower-case input, sentence-case output, text wrapped to the window, readable JSON
saved games, and `QUIT`/`EXIT` in place of the authors' debug word `XXX`.

Six corrections to the original code, each documented in the engine's header and
each validated by writing the same fix into the original bytecode:

- a typo at `@012b`, written as the author intended (no visible effect);
- `STRIKE TORCH` tested the magic globe of light the wrong way round;
- the character loop shared its counter with another variable, so characters
  could lose their turn;
- tables are no longer read at "record 0", which was the tail of the previous
  table;
- `UNLOCK` reported the wrong message and left doors open;
- `LOCK` worked on any door, which let the keys open doors nailed shut.

## Also in the repository

The validation harness, independent listings of the bytecode and the 6502 virtual
machine, the vocabulary, messages and world data, and a map of all five floors.

## Credit and rights

The game, its castle, its writing and its puzzles belong to its authors. This
release is a translation, published as preservation with full credit and no
claim over the original; see the README.

The refactor, the harness and the documentation are by Dennis McRitchie, working
with Claude (Anthropic).
