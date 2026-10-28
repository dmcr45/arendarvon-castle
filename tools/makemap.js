// Draws the castle from the model: one SVG per floor.
//   node makemap.js model.json outdir
"use strict";
const fs = require("fs");
const path = require("path");
const M = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const OUT = process.argv[3];
fs.mkdirSync(OUT, { recursive: true });

const R = M.rooms, O = M.objects, C = M.characters, P = M.passages, pos = M.layout.pos;

// which floor each page shows, and which staircase levels belong with it
const PAGES = [
    { file: "cellar",  title: "Cellar",    main: [0],  stairs: [1, 2],         note: "height 0; its staircases climb to the 1st floor", footprint: true },
    { file: "floor-1", title: "1st floor", main: [3],  stairs: [1, 2, 4, 5],   note: "height 3; staircases lead down to the cellar and up to the 2nd floor" },
    { file: "floor-2", title: "2nd floor", main: [6],  stairs: [4, 5, 7, 8],   note: "height 6" },
    { file: "floor-3", title: "3rd floor", main: [9],  stairs: [7, 8, 10, 11], note: "height 9; the Bell-tower and the Birds nest stand apart from the rest", footprint: true },
    { file: "floor-4", title: "4th floor", main: [12], stairs: [10, 11],       note: "height 12", footprint: true },
];
const onPage = (r, pg) => (r.n === 99 || r.n === 100) ? pg.file === "floor-3"
    : pg.main.includes(r.level) || (/STAIRS/.test(r.flags) && pg.stairs.includes(r.level));

const U = 44;                      // pixels per MEASURE unit
const PAD = 34;
const COLW = 340;                  // width of the key column
const GW = 16, GH = 14;            // the plan is 16 x 14 units
const TOP = 52;
const W = PAD * 2 + GW * U + COLW, H = PAD * 2 + TOP + GH * U;
const X = (u) => PAD + u * U, Y = (u) => PAD + TOP + u * U;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const title = (s) => s.toLowerCase().replace(/(^|[\s-])\S/g, (m) => m.toUpperCase()).replace(/'S\b/g, "'s");
const wide = (t, size) => t.length * size * 0.54;

function svgFor(pg) {
    const s = [];
    s.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '">');
    s.push('<style>');
    s.push(':root{--paper:#F6F4EE;--ink:#1E242B;--dim:#76808A;--grid:#E6E2D8;--room:#FFFDF8;--dark:#EAE5D9;--scores:#FBF6E4;--accent:#1F5C8B;--accent2:#7A5B16;--magic:#7B3FA0;}');
    s.push('@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--paper:#141A20;--ink:#DEE4EA;--dim:#8B97A2;--grid:#1F272F;--room:#1C242C;--dark:#161D24;--scores:#222A26;--accent:#7FB1DC;--accent2:#D9B36A;--magic:#C08BE0;}}');
    s.push(':root[data-theme="dark"]{--paper:#141A20;--ink:#DEE4EA;--dim:#8B97A2;--grid:#1F272F;--room:#1C242C;--dark:#161D24;--scores:#222A26;--accent:#7FB1DC;--accent2:#D9B36A;--magic:#C08BE0;}');
    s.push('text{font-family:"Segoe UI",system-ui,sans-serif}');
    s.push('.grid{stroke:var(--grid);stroke-width:.5}');
    s.push('.foot{stroke:var(--dim);stroke-width:1.1;opacity:.5}');
    s.push('.footfill{fill:var(--dim);opacity:.09}');
    s.push('.room{fill:var(--room);stroke:var(--ink);stroke-width:1.6}');
    s.push('.dark{fill:var(--dark)}.scores{fill:var(--scores)}');
    s.push('.gap{stroke:var(--paper);stroke-width:4.6;stroke-linecap:butt}');
    s.push('.door{stroke:var(--ink);stroke-width:1.5;fill:none}');
    s.push('.shut{fill:var(--ink)}');
    s.push('.hid{stroke:var(--ink);stroke-width:1.5;stroke-dasharray:2.6 2.6;fill:none}');
    s.push('.magic{stroke:var(--magic);stroke-width:2.6;fill:none}');
    s.push('.oneway{fill:var(--accent)}');
    s.push('.rname{font-size:10px;font-weight:600;fill:var(--ink);text-anchor:middle}');
    s.push('.rnum{font-family:"Cascadia Mono",Consolas,monospace;font-size:8px;fill:var(--dim)}');
    s.push('.item{font-size:8.5px;fill:var(--accent2);text-anchor:middle}');
    s.push('.who{font-size:9px;font-style:italic;fill:var(--accent);text-anchor:middle}');
    s.push('.up{font-family:"Cascadia Mono",Consolas,monospace;font-size:8px;fill:var(--dim);text-anchor:middle}');
    s.push('.h1{font-size:19px;font-weight:600;fill:var(--ink)}');
    s.push('.sub{font-size:11px;fill:var(--dim)}');
    s.push('.keyh{font-size:11px;font-weight:600;fill:var(--ink)}');
    s.push('.key{font-size:10px;fill:var(--ink)}');
    s.push('.keydim{font-size:10px;fill:var(--dim)}');
    s.push('</style>');
    s.push('<defs><pattern id="steps" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">'
        + '<rect width="7" height="7" fill="var(--room)"/><line x1="0" y1="0" x2="0" y2="7" stroke="var(--dim)" stroke-width="1.3"/></pattern></defs>');
    s.push('<rect width="' + W + '" height="' + H + '" fill="var(--paper)"/>');
    s.push('<text class="h1" x="' + PAD + '" y="' + (PAD + 8) + '">The Secret of Arendarvon Castle &#8212; ' + esc(pg.title) + '</text>');
    s.push('<text class="sub" x="' + PAD + '" y="' + (PAD + 27) + '">' + esc(pg.note)
        + '. One square is one unit as MEASURE reports it; north is up. Everything shown is as the game starts.'
        + (pg.footprint ? ' The grey shape behind is the castle at ground level.' : '') + '</text>');

    for (let i = 0; i <= GW; i++) s.push('<line class="grid" x1="' + X(i) + '" y1="' + Y(0) + '" x2="' + X(i) + '" y2="' + Y(GH) + '"/>');
    for (let j = 0; j <= GH; j++) s.push('<line class="grid" x1="' + X(0) + '" y1="' + Y(j) + '" x2="' + X(GW) + '" y2="' + Y(j) + '"/>');

    // On the sparse floors, the castle's footprint at ground level is drawn faintly
    // behind, so you can see where these rooms sit under or over the rest of it.
    if (pg.footprint) {
        const cells = new Set();
        for (const r of R.slice(1)) {
            if (r.level !== 3 || !pos[r.n]) continue;
            const p = pos[r.n];
            for (let i = 0; i < r.ew; i++) for (let j = 0; j < r.ns; j++) cells.add((p.x + i) + "," + (p.y + j));
        }
        const edges = [];
        for (const key of cells) {
            const [x, y] = key.split(",").map(Number);
            if (!cells.has((x) + "," + (y - 1))) edges.push([x, y, x + 1, y]);
            if (!cells.has((x) + "," + (y + 1))) edges.push([x, y + 1, x + 1, y + 1]);
            if (!cells.has((x - 1) + "," + (y))) edges.push([x, y, x, y + 1]);
            if (!cells.has((x + 1) + "," + (y))) edges.push([x + 1, y, x + 1, y + 1]);
        }
        for (const key of cells) {
            const [x, y] = key.split(",").map(Number);
            s.push('<rect class="footfill" x="' + X(x) + '" y="' + Y(y) + '" width="' + U + '" height="' + U + '"/>');
        }
        for (const e of edges) {
            s.push('<line class="foot" x1="' + X(e[0]) + '" y1="' + Y(e[1]) + '" x2="' + X(e[2]) + '" y2="' + Y(e[3]) + '"/>');
        }
    }
    const here = R.slice(1).filter((r) => pos[r.n] && onPage(r, pg));
    const shown = (n) => here.some((r) => r.n === n);
    const isStair = (r) => /STAIRS/.test(r.flags);

    for (const r of here) {
        const p = pos[r.n];
        const fill = isStair(r) ? ' fill="url(#steps)"' : '';
        const cls = "room" + (isStair(r) ? "" : /DARK/.test(r.flags) ? " dark" : /SCORES/.test(r.flags) ? " scores" : "");
        s.push('<rect class="' + cls + '"' + fill + ' x="' + X(p.x) + '" y="' + Y(p.y) + '" width="' + (r.ew * U) + '" height="' + (r.ns * U) + '"/>');
    }

    const gap = (w, len) => w.horizontal
        ? '<line class="gap" x1="' + (X(w.x) - len) + '" y1="' + Y(w.y) + '" x2="' + (X(w.x) + len) + '" y2="' + Y(w.y) + '"/>'
        : '<line class="gap" x1="' + X(w.x) + '" y1="' + (Y(w.y) - len) + '" x2="' + X(w.x) + '" y2="' + (Y(w.y) + len) + '"/>';

    for (const o of M.openings) {
        if (!o.wall || !shown(o.from) || !shown(o.to)) continue;
        s.push(gap(o.wall, 11));
        if (!o.twoWay) {
            const a = pos[o.from], b = pos[o.to];
            const dx = o.wall.horizontal ? 0 : (b.x >= a.x ? 1 : -1);
            const dy = o.wall.horizontal ? (b.y >= a.y ? 1 : -1) : 0;
            const cx = X(o.wall.x) + dx * 10, cy = Y(o.wall.y) + dy * 10;
            s.push('<path class="oneway" d="M' + (cx + dx * 6) + ' ' + (cy + dy * 6) + ' L' + (cx - dy * 4.5) + ' ' + (cy - dx * 4.5)
                + ' L' + (cx + dy * 4.5) + ' ' + (cy + dx * 4.5) + ' Z"/>');
        }
    }
    for (const p of P.slice(1)) {
        if (!p.wall || !shown(p.a) || !shown(p.b)) continue;
        const h = p.wall.horizontal, cx = X(p.wall.x), cy = Y(p.wall.y), half = 10;
        s.push(gap(p.wall, 13));
        const bar = (cls) => h
            ? '<line class="' + cls + '" x1="' + (cx - half) + '" y1="' + cy + '" x2="' + (cx + half) + '" y2="' + cy + '"/>'
            : '<line class="' + cls + '" x1="' + cx + '" y1="' + (cy - half) + '" x2="' + cx + '" y2="' + (cy + half) + '"/>';
        if (p.name === "MAGICAL PASSWAY") { s.push(bar("magic")); continue; }
        if (/HIDDEN/.test(p.flags)) { s.push(bar("hid")); continue; }
        if (["LOCKED", "NAILED", "BOLTED"].includes(p.state)) {
            s.push(h ? '<rect class="shut" x="' + (cx - half) + '" y="' + (cy - 1.7) + '" width="' + (half * 2) + '" height="3.4"/>'
                     : '<rect class="shut" x="' + (cx - 1.7) + '" y="' + (cy - half) + '" width="3.4" height="' + (half * 2) + '"/>');
            continue;
        }
        if (p.state === "CLOSED") { s.push(bar("door")); continue; }
        const j = 3.5;                                  // open: jambs only
        s.push(h ? '<path class="door" d="M' + (cx - half) + ' ' + (cy - j) + ' L' + (cx - half) + ' ' + (cy + j)
                   + ' M' + (cx + half) + ' ' + (cy - j) + ' L' + (cx + half) + ' ' + (cy + j) + '"/>'
                 : '<path class="door" d="M' + (cx - j) + ' ' + (cy - half) + ' L' + (cx + j) + ' ' + (cy - half)
                   + ' M' + (cx - j) + ' ' + (cy + half) + ' L' + (cx + j) + ' ' + (cy + half) + '"/>');
    }

    const keyRows = [];
    for (const r of here) {
        const p = pos[r.n], cx = X(p.x) + r.ew * U / 2;
        s.push('<text class="rnum" x="' + (X(p.x) + 3) + '" y="' + (Y(p.y) + 10) + '">' + r.n + '</text>');
        if (isStair(r)) {
            const up = ["N", "E", "S", "W"].filter((d) => r.exits[d] && r.exits[d].room && R[r.exits[d].room].level > r.level);
            s.push('<text class="up" x="' + cx + '" y="' + (Y(p.y) + r.ns * U / 2 + 3) + '">' + (up.join("") || "&#8212;") + ' &#8593;</text>');
            continue;
        }
        const people = C.slice(2).filter((c) => c.room === r.n);
        const items = O.slice(1).filter((o) => o.room === r.n && o.start.kind === "room");
        const nested = O.slice(1).filter((o) => o.room === r.n && o.start.kind !== "room");
        const roomW = r.ew * U - 7, roomH = r.ns * U - 7, lh = 11.5;
        const cy = Y(p.y) + r.ns * U / 2;
        const nm = title(r.name);
        const overflow = [];

        // The name goes in the room; if it will not fit across, it is split over
        // two lines, and failing that turned on its side in a tall narrow room.
        const split = (t) => {
            const w = t.split(" ");
            if (w.length < 2) return null;
            const half = Math.ceil(w.length / 2);
            return [w.slice(0, half).join(" "), w.slice(half).join(" ")];
        };
        let nameLines = null, rotated = false, across = roomW, down = roomH;
        if (wide(nm, 10) <= roomW) nameLines = [nm];
        else {
            const two = split(nm);
            if (two && two.every((l) => wide(l, 10) <= roomW) && 2 * lh <= roomH) nameLines = two;
            else if (r.ns > r.ew) {                       // tall and narrow: turn the name on its side
                rotated = true; across = roomH; down = roomW;
                if (wide(nm, 10) <= across) nameLines = [nm];
                else { const t2 = split(nm); nameLines = (t2 && t2.every((l) => wide(l, 10) <= across)) ? t2 : [nm]; }
            } else nameLines = split(nm) || [nm];
        }

        const extras = [];
        for (const c of people) extras.push({ cls: "who", t: title(c.name), size: 9 });
        for (const o of items) extras.push({ cls: "item", t: title(o.name), size: 8.5 });
        const keep = [];
        for (const e of extras) {
            if (!rotated && wide(e.t, e.size) <= across && (nameLines.length + keep.length + 1) * lh <= down) keep.push(e);
            else overflow.push(e.t);
        }

        const rows = nameLines.map((t) => ({ cls: "rname", t: t, size: 10 })).concat(keep);
        const y0 = -(rows.length - 1) * lh / 2 + 3;
        const g = rotated
            ? '<g transform="translate(' + cx + ' ' + cy + ') rotate(-90)">'
            : '<g transform="translate(' + cx + ' ' + cy + ')">';
        s.push(g);
        rows.forEach((L, i) => {
            let size = L.size;
            if (wide(L.t, size) > across) size = Math.max(6.2, size * across / wide(L.t, size));
            const fs2 = size < L.size ? ' font-size=' + JSON.stringify(size.toFixed(1) + 'px') : '';
            s.push('<text class="' + L.cls + '" x="0" y="' + (y0 + i * lh) + '"' + fs2 + '>' + esc(L.t) + '</text>');
        });
        s.push('</g>');

        const extra = overflow.concat(nested.map((o) => title(o.name) + " ("
            + (o.start.kind === "inside" ? "in " + title(O[o.start.object].name) : "carried by " + title(C[o.start.character].name)) + ")"));
        if (extra.length) keyRows.push({ n: r.n, name: title(r.name), items: extra });
    }

    // A passage whose two rooms do not touch: the magical passway, drawn as a
    // line across the floor from one wall to the other.
    const sideMid = (room, p0, pn) => {
        for (const d of ["N", "E", "S", "W"]) {
            const e = room.exits[d];
            if (!e || e.passage !== pn) continue;
            if (d === "N") return { x: p0.x + room.ew / 2, y: p0.y };
            if (d === "S") return { x: p0.x + room.ew / 2, y: p0.y + room.ns };
            if (d === "W") return { x: p0.x, y: p0.y + room.ns / 2 };
            return { x: p0.x + room.ew, y: p0.y + room.ns / 2 };
        }
        return null;
    };
    for (const p of P.slice(1)) {
        if (p.wall || !shown(p.a) || !shown(p.b)) continue;
        const m1 = sideMid(R[p.a], pos[p.a], p.n), m2 = sideMid(R[p.b], pos[p.b], p.n);
        if (!m1 || !m2) continue;
        s.push('<line class="magic" stroke-dasharray="7 5" x1="' + X(m1.x) + '" y1="' + Y(m1.y) + '" x2="' + X(m2.x) + '" y2="' + Y(m2.y) + '"/>');
        s.push('<circle cx="' + X(m1.x) + '" cy="' + Y(m1.y) + '" r="3.2" fill="var(--magic)"/>');
        s.push('<circle cx="' + X(m2.x) + '" cy="' + Y(m2.y) + '" r="3.2" fill="var(--magic)"/>');
        const mx = (X(m1.x) + X(m2.x)) / 2, my = (Y(m1.y) + Y(m2.y)) / 2;
        s.push('<text class="item" x="' + mx + '" y="' + (my - 6) + '" fill="var(--magic)">' + esc(title(p.name)) + '</text>');
    }

    // The two rooms outside the castle, which have no place on a floor plan.
    if (pg.file === "floor-1" && pos[51]) {
        const g = pos[51], bx = g.x + R[51].ew / 2, by = g.y + R[51].ns;
        s.push(gap({ horizontal: true, x: bx, y: by }, 11));
        s.push('<rect class="room scores" x="' + X(bx - 0.5) + '" y="' + Y(by) + '" width="' + U + '" height="' + (U * 0.8) + '" stroke-dasharray="4 3"/>');
        s.push('<text class="rname" x="' + X(bx) + '" y="' + (Y(by) + U * 0.34) + '" font-size="8.6px">Drawbridge</text>');
        s.push('<text class="item" x="' + X(bx) + '" y="' + (Y(by) + U * 0.56) + '" font-size="7.6px">117 &#8212; the way out</text>');
    }

    const kx = PAD + GW * U + 26;
    let ky = Y(0) + 6;
    const line = (cls, t, dx) => { s.push('<text class="' + cls + '" x="' + (kx + (dx || 0)) + '" y="' + ky + '">' + esc(t) + '</text>'); ky += 13; };
    const sym = (draw, t) => { s.push(draw); s.push('<text class="key" x="' + (kx + 32) + '" y="' + (ky + 3.5) + '">' + esc(t) + '</text>'); ky += 17; };
    line("keyh", "Legend");
    ky += 3;
    sym('<line class="gap" x1="' + kx + '" y1="' + ky + '" x2="' + (kx + 22) + '" y2="' + ky + '"/>'
        + '<path class="door" d="M' + kx + ' ' + (ky - 4) + ' L' + kx + ' ' + (ky + 4) + ' M' + (kx + 22) + ' ' + (ky - 4) + ' L' + (kx + 22) + ' ' + (ky + 4) + '"/>', "open door");
    sym('<line class="door" x1="' + kx + '" y1="' + ky + '" x2="' + (kx + 22) + '" y2="' + ky + '"/>', "closed door");
    sym('<rect class="shut" x="' + kx + '" y="' + (ky - 1.7) + '" width="22" height="3.4"/>', "locked, nailed or bolted");
    sym('<line class="hid" x1="' + kx + '" y1="' + ky + '" x2="' + (kx + 22) + '" y2="' + ky + '"/>', "hidden door, or a hole");
    sym('<line class="magic" x1="' + kx + '" y1="' + ky + '" x2="' + (kx + 22) + '" y2="' + ky + '"/>', "magical passway");
    sym('<path class="oneway" d="M' + (kx + 22) + ' ' + ky + ' L' + (kx + 11) + ' ' + (ky - 5) + ' L' + (kx + 11) + ' ' + (ky + 5) + ' Z"/>', "one way, in this direction");
    sym('<rect x="' + kx + '" y="' + (ky - 7) + '" width="22" height="14" fill="url(#steps)" stroke="var(--ink)" stroke-width="1.3"/>', "staircase; letters give the way up");
    sym('<rect x="' + kx + '" y="' + (ky - 7) + '" width="22" height="14" class="room dark"/>', "dark: you need a light");
    sym('<rect x="' + kx + '" y="' + (ky - 7) + '" width="22" height="14" class="room scores"/>', "scores a point when visited");
    s.push('<text class="who" x="' + (kx + 11) + '" y="' + (ky + 3) + '" text-anchor="middle">name</text>'
        + '<text class="keydim" x="' + (kx + 32) + '" y="' + (ky + 3) + '">a character starts here</text>'); ky += 17;
    s.push('<text class="item" x="' + (kx + 11) + '" y="' + (ky + 3) + '" text-anchor="middle">name</text>'
        + '<text class="keydim" x="' + (kx + 32) + '" y="' + (ky + 3) + '">an object starts here</text>'); ky += 24;
    const BEYOND = {
        "floor-1": ["117 Drawbridge, south of the Gateway: step onto it and the game ends, with ten points for getting out."],
        "floor-3": ["116 Open Air, through the broken window on the west side of the Birds nest: a fall that kills you."],
    }[pg.file];
    if (BEYOND) {
        line("keyh", "Beyond the castle");
        ky += 3;
        for (const t of BEYOND) {
            let row = "";
            for (const word of t.split(" ")) {
                if (row && (row + " " + word).length > 44) { line("keydim", row); row = word; } else row = row ? row + " " + word : word;
            }
            if (row) line("keydim", row);
            ky += 4;
        }
        ky += 6;
    }
    if (keyRows.length) {
        line("keyh", "Also in these rooms");
        ky += 3;
        for (const row of keyRows) {
            line("key", row.n + "  " + row.name);
            for (const t of row.items) line("keydim", t, 10);
            ky += 3;
        }
    }
    s.push('</svg>');
    return s.join("\n");
}

const drawings = [];
for (const pg of PAGES) {
    const out = path.join(OUT, pg.file + ".svg");
    const svg = svgFor(pg);
    drawings.push(svg);
    fs.writeFileSync(out, svg);
    console.log("wrote " + out + " (" + Math.round(fs.statSync(out).size / 1024) + " KB)");
}

// One page holding all five, which is what the maps/ URL serves. Printing it
// gives a floor per sheet, landscape, with the shading intact.
const page = [
    '<!doctype html>',
    '<meta charset="utf-8">',
    '<title>Arendarvon Castle maps</title>',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    '<style>',
    ' :root{--paper:#F6F4EE;--ink:#1E242B;--dim:#76808A;--accent:#1F5C8B}',
    ' @media (prefers-color-scheme:dark){:root{--paper:#141A20;--ink:#DEE4EA;--dim:#8B97A2;--accent:#7FB1DC}}',
    ' body{margin:0;padding:24px 16px 48px;background:var(--paper);color:var(--ink);font:15px/1.5 "Segoe UI",system-ui,sans-serif}',
    ' header{max-width:1112px;margin:0 auto 20px}',
    ' h1{font-size:22px;margin:0 0 6px}',
    ' p{margin:0;color:var(--dim);max-width:70ch}',
    ' a{color:var(--accent)}',
    ' svg{display:block;margin:0 auto 24px;max-width:100%;height:auto}',
    ' @media print{',
    '   @page{size:landscape;margin:8mm}',
    '   :root{--paper:#fff}',
    '   body{padding:0;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}',
    '   header{max-width:none;break-after:page;page-break-after:always}',
    '   svg{margin:0;width:100%;break-inside:avoid;page-break-inside:avoid;break-after:page;page-break-after:always}',
    '   svg:last-of-type{break-after:auto;page-break-after:auto}',
    ' }',
    '</style>',
    '<header>',
    '<h1>The Secret of Arendarvon Castle &#8212; the castle, floor by floor</h1>',
    '<p>Drawn from the game&#8217;s own data: every room at the size MEASURE reports, every door in the state it starts in,',
    ' and every object and character where the game puts them at the start. Cellar first, then the four floors above.',
    ' <a href="../">Play the game</a> &#183; <a href="https://github.com/dmcr45/arendarvon-castle">the repository</a></p>',
    '</header>',
    "<!-- Visitor counting is off. To switch it on: sign up at https://www.goatcounter.com",
    "     (free, no cookies, no personal data), then uncomment the line below and put",
    "     your own site code in place of YOURCODE. Delete this block to leave it off.",
    "<script data-goatcounter=\"https://YOURCODE.goatcounter.com/count\" async src=\"//gc.zgo.at/count.js\"></script>",
    "-->",
].join("\n") + "\n" + drawings.join("\n") + "\n";
const idx = path.join(OUT, "index.html");
fs.writeFileSync(idx, page);
console.log("wrote " + idx + " (" + Math.round(fs.statSync(idx).size / 1024) + " KB)");
