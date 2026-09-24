# sky-transfers-website

Static site, deployed by Render from `main`.

## What is generated and what is not

`build-suburbs.js` runs as the Render build command. It reads the fare
tables straight out of `index.html` and writes, on every deploy:

- `airport-transfers/<suburb>.html` - one page per priced suburb
- `airport-transfers/index.html` - the hub linking all of them
- the region pages listed in its `REGIONS` array
- `sitemap.xml` - the committed entries plus the above
- **`prices.html`** - all six fare tables, rewritten in place by `refreshPrices()`

None of those can drift from the fares, because they are rebuilt from the
fares. **Change a rate table in `index.html` and you are done** - the suburb
pages, the region pages and the price list all follow on the next deploy.

`prices.html` was the exception until 23 September 2026, and it is worth knowing
why it stopped being one. It carried a comment claiming a script generated it;
that script was not in the repo and nothing regenerated it. It had drifted twice
by the time anyone looked: missing 51 suburbs, quoting a cruise fare corrected
two days earlier elsewhere on the site, stating a suburb count that was stale in
four places (the visible lead, the meta description, the og:description and the
JSON-LD), and naming a vehicle retired on 20 September. Before handing its rows
to the build, all 752 were regenerated from the rate tables and diffed against
the committed file byte-for-byte, which is what proved they were a pure function
of the tables and safe to generate.

The committed `prices.html` is therefore a stale artefact by design - the build
overwrites its table bodies. Same arrangement as `sitemap.xml`. Do not hand-edit
either one to fix a fare.

## Two things that will bite you in build-suburbs.js

**`BM_SUBURB` and `LD_SUBURB` do not exist in this file.** They exist in
`index.html` and in `stripe-server.js`, and the page builders here iterate
`BM_ZONE` and `LD_ZONE` directly instead. Assuming the three files share a shape
threw `ReferenceError: BM_SUBURB is not defined` at build time. Derive the map
locally, or grep before you reach for an identifier.

**In `String.replace`, `$` in the replacement *string* is special.** Fare rows
are full of `<td>$225</td>`, so `'$1' + rows + '$2'` silently reads `$2` as
capture group 2. Use a function replacer whenever the inserted text can contain
money - in this file it always can.

Both were caught by assertions rather than by anyone noticing a wrong page.
Render keeps serving the previous build when the build command exits non-zero, so
a bad deploy here is a no-op rather than a broken site. Keep that shape: assert,
throw, let the old build stand. What is currently asserted:

- a named table is missing from `index.html`
- a suburb has no BNE or OOL rate, or a BM zone has no rate row
- a zone has no entry in `Z`, so there are no route notes for its pages
- two suburbs collide on the same slug
- a region ends up with no suburbs left in one of its zones
- `prices.html` is missing the anchor or a `<tbody>` the rewrite needs
- the row count written to `prices.html` does not match the row count computed

**Nothing checks that the fare ladder ascends.** A zone priced below one closer
in will deploy without complaint - that is how Lyons came to charge a 65 km run
at the 43 km rate for several days. Worth adding.

## The hand-written landing pages

Five pages are written by hand and are **not** generated:

    gold-coast-airport-transfers.html
    brisbane-airport-transfers.html
    brisbane-airport-to-gold-coast.html
    byron-bay-transfers.html
    cruise-transfers.html

They carry sample fares and suburb counts as literal text, which makes them the
last place on the site where a number can go stale. On 24 September 2026 four of
them still said Brisbane had 223 suburbs; it had 274 since the previous day. The
counts appear in the meta description and og:description as well as the body, so
a search result can be wrong even when the page looks right.

**Do not find-and-replace a bare number across these files.** The WhatsApp icon
at the foot of each page is an inline SVG whose path data contains the literal
text `.347.223-.644` - and `298` and `223` both appear inside it. Match the
surrounding phrase instead, and check the icon still renders.

Their fare tables deep-link into the booking form: each suburb name is an anchor
to `/?pu=...&do=...#book`, and `index.html` validates both parameters against
`PLACES` before pre-filling. A typo in a suburb name there fails quietly - the
form just opens empty - so verify new rows against `PLACES`.

## Do not read a route minimum off a landing page

Every live Google ad carries a "from $X" fare, and Google checks that claim
against the page it points at - so "what is the cheapest fare on this route" gets
asked of these pages often. **`prices.html` is the authority for a minimum. A
landing page is not.** Three things on them read as route minimums and are not,
all three currently live:

- **A per-person breakdown.** `brisbane-airport-to-gold-coast.html` says "$65
  each" - that is $260 for an SUV split four ways, not a $65 fare.
- **A cross-link to another route.** `byron-bay-transfers.html` says "from $80"
  in its related-links panel; that is Gold Coast Airport's minimum, not Byron's.
- **The illustrative fares in body copy.** `brisbane-airport-transfers.html`
  names Noosa at $375 and Sunshine Coast Airport at $305 under "going further
  than Brisbane". Those are recognisable destinations, not cheap ones - the real
  Sunshine Coast minimum is **Caloundra at $280**, and it appears nowhere on that
  page.

The third is the dangerous one, because it looks like a deliberate range rather
than a sample and it reads as an upper bound on how cheap the route gets.

## Deploy order

The booking server (`sky-transfers-booking-server`) recomputes every fare
server-side and its price wins. Deploy the server **first** when adding
places or vehicles: it accepts every name the old site sends, so the old
site keeps working against the new server, whereas a new site against an old
server fails to price the new names.
