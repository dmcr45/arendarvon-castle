# Origin, authorship and rights

## The original work

*The Secret of Arendarvon Castle: A Microworld Adventure for Your BBC Micro*
by Hal Renko & Sam Edwards with Arend Rensink.
Addison-Wesley Publishing Company, Wokingham, Berkshire, 1984/85.
ISBN 0-201-14080-4. Cover illustration by Bert Vanderveen.

"Hal Renko & Sam Edwards" is a pen name of Kasper Boon. The BASIC listings in
the booklet *Programming the Game* are signed `REM Arend Rensink, 7.7.84`.

The game, its text, its world, its puzzles, the ALADIN virtual machine and its
bytecode are the work of those authors and their publisher. Addison-Wesley's
book business has since passed to Pearson. A 1984 publication is still within
copyright; whether the rights sit with the authors or the publisher's successor
is not something this repository can settle.

## What is whose, in this repository

**Not mine.** The game's logic, text, map and data, reproduced here in another
form; the listings in `reference/`, which are derived from the original program;
and `disc/Disc999-SecretOfArendarvonCastle.ssd` together with
`validation/ssd-data.js`, which are the original disc image.

**Mine.** The structure, naming and commentary of the refactor; the test harness
(the 6502 emulator, the re-implemented BASIC host, the comparison campaign); the
browser and terminal front ends; the documentation and the map.

The two are not cleanly separable: the engine is a translation of someone else's
program, and it embeds their text and world data because it cannot run without
them. Treat the whole as a derivative work of a copyrighted game.

## Permission

> **STATUS: permission is being sought from the authors. Not yet granted.**
> (Update this line when they reply.)

If permission has not been granted, do not redistribute this repository or any
part of it. In particular, the disc image, the reference listings and the
engine's data tables should not be published without the rights holders' assent.

## Why it was made

Preservation and curiosity. The original was published as a type-in listing of
encoded bytecode, which meant that tens of thousands of readers typed in a
program none of them could read. This is an attempt to make that program
legible, and to keep a well-made 1984 adventure playable on today's machines.

## If you are one of the authors

You are welcome to ask for changes, for attribution in a different form, or for
this to be taken down; the last of those will be honoured without argument.
Contact details are in the repository's GitHub profile.
