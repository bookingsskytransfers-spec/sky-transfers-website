#!/usr/bin/env node
/*
 * fare-ladder.js — checks the published fares are internally consistent.
 *
 *   node fare-ladder.js          # prints the ladder, exits 1 on a violation
 *
 * Reads the rate tables out of index.html, the same source build-suburbs.js
 * uses, so this can never validate a different set of fares from the ones the
 * booking widget quotes. Drive times come from data/suburb-facts.json; without
 * that file the structural check still runs and the time-based one is skipped
 * rather than failed.
 *
 * WHAT IS CHECKED, AND WHY IT IS NOT WHAT YOU WOULD FIRST WRITE
 *
 * "Fares must rise with distance" sounds obviously right and is wrong. Measured
 * against road distance it flags 313 pairs on data that is correct, because
 * distance is not the cost driver: Tamborine Mountain is 80 km from BNE and
 * costs more than Southport at 82 km, because it is up a mountain. Drive time
 * is the driver, and against drive time the zone ladder is almost perfectly
 * ordered — the largest benign inversion is 11 minutes, the Broadwater strip
 * (N2) against the motorway corridor (N3).
 *
 * So two things are asserted:
 *
 *   A. within one rate row, a bigger vehicle never costs less. Pure structure,
 *      no distances, cannot false-positive. Catches a transposed or mistyped
 *      cell, which is the likeliest fare-table error.
 *   B. within one hub and one rate family, a dearer zone is not dramatically
 *      quicker to reach than a cheaper one. The backstop for a whole row
 *      entered at the wrong tier.
 *
 * And one thing is deliberately NOT asserted: a single suburb sitting in too
 * cheap a zone — the Lyons case of September 2026, a 65 km run billed at the
 * 43 km rate. Catching that needs a threshold about 7 minutes tight, and at 7
 * minutes roughly 19 suburbs that are correctly cheap-and-remote trip it too
 * (Undullah, Redland Bay, Currumbin Valley). A check that failed every time
 * those appeared would be worse than the gap it closes. The per-zone drive-time
 * spans are printed instead, because that is where a mis-banded suburb shows:
 * BS3 spanned 31-52 minutes with Lyons in it, and 31-39 without.
 *
 * No dependencies. Node 18+.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const TOL_MIN = 20;    // largest benign zone inversion measured: 11 min
const WIDE_MIN = 20;   // report a zone spanning more drive time than this
const MIN_N = 3;       // fewer measured members than this and the median is noise

const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
function table(name) {
  const m = indexHtml.match(new RegExp('^var ' + name + ' = (.+);\\s*$', 'm'));
  if (!m) throw new Error('fare-ladder: ' + name + ' not found in index.html');
  try { return JSON.parse(m[1]); }
  catch (e) { return new Function('return (' + m[1] + ')')(); }
}

const SUBURBS      = table('SUBURBS');
const OOL_RATES    = table('OOL_RATES');
const BNE_RATES    = table('BNE_RATES');
const BM_ZONE      = table('BM_ZONE');
const BM_RATES     = table('BM_RATES');
const BM_OOL_ZONE  = table('BM_OOL_ZONE');
const BM_OOL_RATES = table('BM_OOL_RATES');
const LD_ZONE      = table('LD_ZONE');
const LD_BNE_RATES = table('LD_BNE_RATES');
const LD_OOL_RATES = table('LD_OOL_RATES');

let FACTS = {};
try { FACTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'suburb-facts.json'), 'utf8')); }
catch (e) { console.warn('fare-ladder: no data/suburb-facts.json, checking structure only'); }

const problems = [];

/* A. vehicle columns ------------------------------------------------------- */
const TABLES = {
  OOL_RATES: OOL_RATES, BNE_RATES: BNE_RATES, BM_RATES: BM_RATES,
  BM_OOL_RATES: BM_OOL_RATES, LD_BNE_RATES: LD_BNE_RATES, LD_OOL_RATES: LD_OOL_RATES,
};
for (const tname of Object.keys(TABLES)) {
  const t = TABLES[tname];
  for (const zone of Object.keys(t)) {
    const row = t[zone];
    for (let i = 1; i < row.length; i++) {
      if (row[i] < row[i - 1]) {
        problems.push(tname + '.' + zone + ' charges $' + row[i] + ' for vehicle ' + i
          + ', less than $' + row[i - 1] + ' for a smaller one');
      }
    }
  }
}

/* B. zone ordering against median drive time ------------------------------- */
const gcOol = {}, gcBne = {};
for (const name of Object.keys(SUBURBS)) {
  const zo = SUBURBS[name][0], zb = SUBURBS[name][1];
  (gcOol[zo] = gcOol[zo] || []).push(name);
  (gcBne[zb] = gcBne[zb] || []).push(name);
}
/* One group per hub AND rate family: a Gold Coast zone and a Brisbane zone are
   not comparable to each other, only within their own family. */
const GROUPS = [
  { label: 'Gold Coast -> OOL', hub: 'ool', members: gcOol, rates: OOL_RATES },
  { label: 'Gold Coast -> BNE', hub: 'bne', members: gcBne, rates: BNE_RATES },
  { label: 'Brisbane -> BNE', hub: 'bne', members: BM_ZONE, rates: BM_RATES },
  { label: 'Brisbane -> OOL', hub: 'ool', members: BM_OOL_ZONE, rates: BM_OOL_RATES },
  { label: 'Regional -> BNE', hub: 'bne', members: LD_ZONE, rates: LD_BNE_RATES },
  { label: 'Regional -> OOL', hub: 'ool', members: LD_ZONE, rates: LD_OOL_RATES },
];

const ladder = [], wide = [];
for (const g of GROUPS) {
  const zrows = [];
  for (const zone of Object.keys(g.members)) {
    const row = g.rates[zone];
    if (!row) continue;                 // LD_OOL_RATES prices only some LD zones
    const mins = g.members[zone]
      .map(n => (FACTS[n] && FACTS[n][g.hub] && FACTS[n][g.hub].s) || 0)
      .filter(s => s > 0)
      .map(s => s / 60)
      .sort((a, b) => a - b);
    if (mins.length < MIN_N) continue;
    zrows.push({
      zone: zone, fare: row[0], n: mins.length,
      med: mins[Math.floor(mins.length / 2)], lo: mins[0], hi: mins[mins.length - 1],
    });
  }
  if (!zrows.length) continue;          // no measured members: nothing to compare
  zrows.sort((a, b) => a.fare - b.fare || a.med - b.med);

  for (let i = 1; i < zrows.length; i++) {
    const cheap = zrows[i - 1], dear = zrows[i];
    if (dear.med < cheap.med - TOL_MIN) {
      problems.push(g.label + ': ' + dear.zone + ' costs $' + dear.fare + ' at '
        + Math.round(dear.med) + ' min, but cheaper ' + cheap.zone + ' at $' + cheap.fare
        + ' takes ' + Math.round(cheap.med) + ' min');
    }
  }

  ladder.push('  ' + g.label.padEnd(18)
    + zrows.map(z => z.zone + ' $' + z.fare + '/' + Math.round(z.med) + 'm').join('  '));
  for (const z of zrows) {
    if (z.hi - z.lo > WIDE_MIN) {
      wide.push({ span: z.hi - z.lo, label: g.label, zone: z.zone, fare: z.fare, n: z.n, lo: z.lo, hi: z.hi });
    }
  }
}

/* report ------------------------------------------------------------------- */
console.log('fare ladder, zone $fare/median drive minutes:');
for (const l of ladder) console.log(l);

wide.sort((a, b) => b.span - a.span);
console.log('');
console.log('zones spanning over ' + WIDE_MIN + ' min of drive time (' + wide.length + '):');
for (const z of wide) {
  console.log('  ' + z.label.padEnd(18) + z.zone.padEnd(5) + '$' + z.fare + ' n=' + z.n
    + '  ' + Math.round(z.lo) + '-' + Math.round(z.hi) + ' min  span ' + Math.round(z.span));
}
console.log('  (a wide span is not wrong in itself - it is where a mis-banded suburb shows)');

if (problems.length) {
  console.error('');
  console.error('fare ladder: ' + problems.length + ' problem(s)');
  for (const p of problems) console.error('  ' + p);
  process.exit(1);
}
console.log('');
console.log('fare ladder: OK');
