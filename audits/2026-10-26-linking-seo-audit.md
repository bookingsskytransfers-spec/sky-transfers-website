# Sky Transfers website: linking and SEO audit (read-only)

**Site:** https://www.skytransfers.com.au · **Crawled:** Mon 26 Oct 2026 (AEST) · **GSC window:** 26 Jul to 25 Oct 2026 (sc-domain property, all data)
**Scope:** I changed nothing on the site and sent nothing. Brand rules for every fix below: the address is **Oxenford** and the phone is **0481 437 772**, nothing else.

---

## 1. Summary

| Metric | Value |
|---|---|
| URLs in sitemap | 480 (422 suburb pages under /airport-transfers/, 23 blog URLs made up of the index plus 22 articles, and about 35 money/service pages) |
| Pages crawled | 488, all returning 200 (the extra 8 are extensionless blog duplicates, the bare domain and /agent.html, which is noindex) |
| Articles | 22. 18 are by Grand Ranker (GR), about 1,700 to 2,530 words, dated 10 to 26 Oct. 4 are by Claude, about 830 to 1,300 words, dated 9 to 19 Oct |
| GSC, whole site | 222 clicks, 28,803 impressions |
| GSC, all 22 articles | **2 clicks**, about 430 impressions. 7 articles have no impressions yet |
| Legacy WordPress URLs still in Google | 95 URLs, 15,025 impressions (52% of the site's impressions), 8 clicks. **81 return 301, 14 return 404** |

**Top problems, in priority order**
1. **Every GR article's in-article CTA is broken for conversion.** All 18 GR articles have "Book →" and "Book" CTAs, 36 links in total, pointing to `https://Www.skytransfers.com.au`. That URL has a capital W, goes to the bare homepage, skips `#book` and has no pre-fill. **None of the 22 articles uses the `/?pu=…&do=…#book` deep link**, although all 422 suburb pages and the main money pages already do.
2. **Articles barely link to money pages.** Only 2 of the 22 articles link to an `/airport-transfers/<suburb>` page. 13 anchors point to the wrong or a mismatched target, listed in section 3.
3. **Money pages don't link out to articles.** The one exception is /cruise-transfers.html, which links to the cruise-terminal article. 6 articles are effectively orphans, linked only from the /blog/ index: chauffeur-to-city, gc-airport-to-hotel, gc-luggage, seamless-cruise, what-happens-if-flight-delayed and wheelchair.
4. **Cannibalisation.** The homepage ranks (badly, at positions 70 to 90) for "gold coast airport transfers", "brisbane airport transfers", "private transfers gold coast" and similar queries, ahead of the dedicated pages. Four pages compete for the cruise terminal query. GR has 4 overlapping flight-tracking/reliability posts.
5. **6 extensionless internal links** create 200-status duplicate URLs. The canonical tag is correct, but the duplicates still waste crawl budget and split link equity.
6. **One price error.** brisbane-airport-chauffeur-to-city says sedan "$90–$140" and van "$140–$220". The live fares are a $95 sedan and a $110 people mover from the CBD to BNE.
7. **Heavy taxi framing in GR articles.** "taxi" appears 16 times in luggage, 13 in fixed-price, 12 in gc-to-hotel and 10 in families, plus "maxi taxi" in 3 articles. The homepage schema `@type` is **TaxiService**.
8. **14 legacy URLs return 404**, with about 100 impressions between them. Several 301s land on weak targets: /our-fleet/ goes to /#fleet (it ranks at **position 10.5**), /about-us/ and /contact-us/ go to /, and /services/event-transfers/ goes to /charters.html although /event-transfers.html exists.

**What's already right:** there are no NAP errors anywhere. I found no Harbour Rise, no 0488 337 771 and no Phoenix. Hope Island appears only as a service area. 0481 is on every page. Every article has a self-referencing canonical, index,follow, BlogPosting and Organization schema, and alt text on every image. http and non-www both 301 to https://www. The Claude articles' prices all match the live fares.

---

## 2. Article inventory

GSC columns are clicks / impressions / average position for the last 3 months. A dash (–) means the page had no impressions. Wd = word count.

| # | Article (/blog/…) | Author | Date | Wd | Target keyword (inferred) | GSC | Inbound internal links (excluding /blog/) | Links to matching money page? | Pre-filled CTA? | Taxi mentions |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | avoid-surge-pricing-airport-rides | GR | 19 Oct | 2378 | avoid surge pricing airport | <10 imp | families, wheelchair | ✗ (main-beach, mismatched) | ✗ | 5 (+uber 3, maxi 1) |
| 2 | book-private-airport-transfer-gold-coast | GR | 12 Oct | 2464 | private airport transfer gold coast | 0/109/75.3 | luggage, how-to-book | partly (coolangatta, cheapest) | ✗ | 1 |
| 3 | booking-private-transport-brisbane-cruise-terminal | GR | 20 Oct | 2435 | private transport brisbane cruise terminal | – | chauffeur-to-city | ✗ (no /cruise-transfers.html) | ✗ | 0 |
| 4 | brisbane-airport-chauffeur-to-city | GR | 23 Oct | 2399 | brisbane airport chauffeur to city | – | **none (orphan)** | ✓ /airport-transfers/brisbane-cbd | ✗ | 9 · **price error** |
| 5 | brisbane-airport-domestic-or-international-pickup | Claude | 9 Oct | 827 | brisbane airport domestic or international | 0/141/35 | early-morning, what-time, wheelchair | ✓ BNE page | ✗ (no book link) | 0 |
| 6 | brisbane-airport-to-cruise-terminal | Claude | 19 Oct | 1298 | brisbane airport to cruise terminal | 0/53/42.5 | chauffeur-to-city, /cruise-transfers.html | ✗ (no link back to /cruise-transfers.html) | ✗ (/#book) | 2 |
| 7 | early-morning-brisbane-airport-transfer | GR | 14 Oct | 2426 | early morning brisbane airport transfer | 1/9/8.6 | fixed-price | ✗ | ✗ | 4 |
| 8 | fixed-price-airport-transfers-brisbane-benefits | GR | 15 Oct | 2410 | fixed price airport transfers brisbane | <10 imp | guaranteed | ✗ | ✗ | 13 |
| 9 | gold-coast-airport-arrivals-guide | Claude | 9 Oct | 950 | gold coast airport arrivals | 0/13/21.1 | car-seats, luggage | ✓ GC airport page | ✗ (tel only) | 0 |
| 10 | gold-coast-airport-chauffeur-with-meet-and-greet | GR | 18 Oct | 2402 | gold coast airport chauffeur meet and greet | <10 imp | avoid-surge | ✗ | ✗ | 9 |
| 11 | gold-coast-airport-transfer-car-seats | GR | 11 Oct | 2381 | gold coast airport transfer car seats | 0/13/61.8 | book-private-GC, luggage | partly | ✗ | 9 |
| 12 | gold-coast-airport-transfer-how-to-get-from-gold-coast-airport-to-hotel | GR | 25 Oct | 2415 | gold coast airport to hotel | – | **none (orphan)** | ✓ /airport-transfers/surfers-paradise | ✗ | 12 |
| 13 | gold-coast-airport-transport-options-with-luggage | GR | 24 Oct | 2390 | gold coast airport transport luggage | – | **none (orphan)** | ✓ GC→Surfers | ✗ | 16 (+maxi 3) |
| 14 | gold-coast-to-brisbane-airport-what-time-to-leave | Claude | 9 Oct | 1043 | what time to leave gold coast for brisbane airport | 1/88/9.9 | dom-intl | ✗ (only /prices.html) | ✗ | 0 |
| 15 | guaranteed-on-time-airport-chauffeur-service-guide | GR | 16 Oct | 2165 | on time airport chauffeur | <10 imp | meet-and-greet | ✗ | ✗ | 1 |
| 16 | how-to-book-reliable-airport-transfers | GR | 13 Oct | 2446 | how to book airport transfers | <10 imp | early-morning, wheelchair | partly (brisbane-cbd) | ✗ | 2 |
| 17 | real-time-flight-tracking-airport-transfers | GR | 17 Oct | 2501 | flight tracking airport transfers | <10 imp | avoid-surge | ✗ (sunshine-coast, wrong) | ✗ | 0 |
| 18 | reliable-airport-pickup-brisbane-flight-tracking | GR | 10 Oct | 2389 | reliable airport pickup brisbane | <10 imp | how-to-book | ✗ (/airport-transfers/ index) | ✗ | 1 |
| 19 | safe-airport-transport-for-families | GR | 22 Oct | 1685 | safe airport transport families | – | chauffeur-to-city | ✗ (no /child-seats.html) | ✗ | 10 (+maxi 2) |
| 20 | seamless-airport-transfers-for-cruise-passengers | GR | 9 Oct | 2404 | airport transfers cruise passengers | <10 imp | **none (orphan)** | ✓ /cruise-transfers.html | ✗ | 1 |
| 21 | what-happens-if-flight-delayed | GR | 21 Oct | 2412 | what happens if flight delayed | – | **none (orphan)**; only extensionless links | ✗ | ✗ | 0 |
| 22 | wheelchair-airport-transfers-chauffeur-service | GR | 26 Oct | 2531 | wheelchair airport transfers | – | **none (orphan)** | ✗ | ✗ | 7 |

Every article has a title equal to its H1 (Claude's H1s are question-style), a self canonical, BlogPosting and Organization schema, no images missing alt text and 3 to 5 images. Meta descriptions run 119 to 164 characters, except **avoid-surge at 74 characters (too short)**.

---

## 3. Exact link fixes per article

**Fix A, all 18 GR articles: replace both CTAs.** Today they read `Book →` and `Book` and point to `https://Www.skytransfers.com.au`. Swap each for the pre-filled URL below and keep the anchor text, or make it more specific, for example "Get your fixed Surfers Paradise fare →". The place names must match the booking widget exactly: `Gold%20Coast%20Airport%20(OOL)`, `Brisbane%20Airport%20(BNE)`, `Brisbane%20Cruise%20Terminal%20(Pinkenba)` and any suburb name, such as `Surfers%20Paradise` or `Brisbane%20CBD`.
**Fix B, the "related" block on every GR article.** It currently links only to /#book, /prices.html and /blog/. Replace it with 2 relevant articles plus 1 money page, the way the Claude articles do.

| Article | Change this (anchor → current target) | To | Where |
|---|---|---|---|
| **avoid-surge-pricing-airport-rides** | Book→ / Book → Www homepage | `/?do=Brisbane%20Airport%20(BNE)#book` | mid-article CTA and the end "Booking a transfer" block |
| | "airport ride" → /main-beach-airport-transfers.html | /brisbane-airport-transfers.html (anchor "Brisbane Airport transfer") | first section, "Why Airport Rides Surge" |
| | "fixed-price airport" → /blog/…meet-and-greet | /blog/fixed-price-airport-transfers-brisbane-benefits.html | same paragraph |
| | add | "compare rideshare or a fixed transfer" → /rideshare-or-transfer.html | "How to Avoid Uber Surge" section |
| | add | "published fares" → /prices.html | "Fare Comparison" section |
| | meta description is 74 characters | rewrite to 140–155 characters, e.g. "Airport rides surge at peak times. 7 ways to avoid it, plus fixed-price Gold Coast and Brisbane Airport transfers with GST and tolls included." | head |
| **book-private-airport-transfer-gold-coast** | Book→/Book | `/?pu=Gold%20Coast%20Airport%20(OOL)&do=Surfers%20Paradise#book` | CTAs |
| | "Gold Coast Airport" → /blog/…car-seats | /gold-coast-airport-transfers.html | intro |
| | "cheapest" → cheapest-gc-to-bne | keep, but change the anchor to "cheapest Gold Coast to Brisbane Airport transfer" | as is |
| | add | "Surfers Paradise" → /airport-transfers/surfers-paradise.html; "Broadbeach" → /broadbeach-airport-transfers.html; "Burleigh Heads" → /burleigh-heads-airport-transfers.html | wherever suburbs are named |
| | add | "arriving at Gold Coast Airport" → /blog/gold-coast-airport-arrivals-guide.html | pickup/meeting section |
| **booking-private-transport-brisbane-cruise-terminal** | Book→/Book | `/?pu=Brisbane%20Airport%20(BNE)&do=Brisbane%20Cruise%20Terminal%20(Pinkenba)#book` | CTAs |
| | add | "Brisbane cruise terminal transfers" → **/cruise-transfers.html** | first paragraph |
| | add | "from Brisbane Airport to the cruise terminal" → /blog/brisbane-airport-to-cruise-terminal.html | route/timing section |
| | add | "minibus hire" → /minibus-hire-brisbane.html | groups section |
| **brisbane-airport-chauffeur-to-city** | Book→/Book | `/?pu=Brisbane%20Airport%20(BNE)&do=Brisbane%20CBD#book` | CTAs |
| | "Brisbane Airport" → /blog/brisbane-airport-to-cruise-terminal.html | /brisbane-airport-transfers.html | intro |
| | add | "Brisbane CBD airport transfers" → /brisbane-cbd-airport-transfers.html | price section |
| | **price fix:** "$90–$140 sedan / $140–$220 van" | "Sedan from **$95**, people mover **$110**, Sprinter **$255** (Brisbane CBD to BNE, GST and tolls included, 10% off returns)" | price section |
| **brisbane-airport-domestic-or-international-pickup** (Claude) | no book CTA | add "Book a Brisbane Airport pickup →" `/?pu=Brisbane%20Airport%20(BNE)#book` | end, and after the terminal table |
| | add | "Brisbane Airport to Brisbane CBD" → /airport-transfers/brisbane-cbd.html | body |
| **brisbane-airport-to-cruise-terminal** (Claude) | "booking form" → /#book | `/?pu=Brisbane%20Airport%20(BNE)&do=Brisbane%20Cruise%20Terminal%20(Pinkenba)#book` | end |
| | add | "cruise terminal transfers" → /cruise-transfers.html | intro (this is the link back to the money page) |
| **early-morning-brisbane-airport-transfer** | Book→/Book | `/?do=Brisbane%20Airport%20(BNE)#book` | CTAs |
| | "Brisbane Airport" → /blog/…domestic-or-international | /brisbane-airport-transfers.html (keep the terminal link, but on the anchor "domestic or international terminal") | intro |
| | add | "Gold Coast to Brisbane Airport" → /cheapest-gold-coast-to-brisbane-airport.html; "what time to leave" → /blog/gold-coast-to-brisbane-airport-what-time-to-leave.html | timing section |
| **fixed-price-airport-transfers-brisbane-benefits** | Book→/Book | `/?do=Brisbane%20Airport%20(BNE)#book` | CTAs |
| | "Brisbane Airport" → /blog/early-morning… | /brisbane-airport-transfers.html | intro |
| | "Brisbane Airport" (second) → /brisbane-or-gold-coast-airport.html | anchor "Brisbane or Gold Coast Airport?" | comparison section |
| | "corporate function" → /charters.html | /corporate-transfers.html | business section |
| | add | "see every fixed fare" → /prices.html; "avoid surge pricing" → /blog/avoid-surge-pricing-airport-rides.html | price section |
| **gold-coast-airport-arrivals-guide** (Claude) | no book CTA | add "Book your Gold Coast Airport pickup →" `/?pu=Gold%20Coast%20Airport%20(OOL)#book` | end |
| | add | "Surfers Paradise" → /gold-coast-airport-to-surfers-paradise.html; "meet and greet" → /blog/gold-coast-airport-chauffeur-with-meet-and-greet.html | body |
| **gold-coast-airport-chauffeur-with-meet-and-greet** | Book→/Book | `/?pu=Gold%20Coast%20Airport%20(OOL)#book` | CTAs |
| | **"Brisbane or the Cruise Terminal" → /byron-bay-transfers.html (wrong)** | split it: "Brisbane" → /brisbane-airport-to-gold-coast.html; "the Cruise Terminal" → /cruise-transfers.html | onward-travel paragraph |
| | add | "Gold Coast Airport transfers" → /gold-coast-airport-transfers.html; "where to meet your driver" → /blog/gold-coast-airport-arrivals-guide.html | intro, and the meeting-point section |
| **gold-coast-airport-transfer-car-seats** | Book→/Book | `/?pu=Gold%20Coast%20Airport%20(OOL)&do=Surfers%20Paradise#book` | CTAs |
| | "gold coast airport transfer car" → /gold-coast-airport-to-surfers-paradise.html | anchor "Gold Coast Airport to Surfers Paradise" | body |
| | add | "child seats" → **/child-seats.html**; "travelling with kids" → /blog/safe-airport-transport-for-families.html | the seat-types section (it currently never links to /child-seats.html) |
| | external link to streetsmarts.initiatives.qld.gov.au/road-rules/child-restraints (redirects twice, ends at 403) | https://www.qld.gov.au/transport/safety/rules/children (official QLD child restraints page) | road rules section |
| **gold-coast-airport-transfer-how-to-get-from-gold-coast-airport-to-hotel** | Book→/Book | `/?pu=Gold%20Coast%20Airport%20(OOL)&do=Surfers%20Paradise#book` | CTAs |
| | 4 extensionless links: /blog/gold-coast-airport-chauffeur-with-meet-and-greet, /blog/what-happens-if-flight-delayed, /blog/avoid-surge-pricing-airport-rides, /blog/gold-coast-airport-transfer-car-seats | add **.html** to each | body |
| | add | "Broadbeach" → /broadbeach-airport-transfers.html; "Main Beach" → /main-beach-airport-transfers.html; "Coolangatta" → /coolangatta-airport-transfers.html; "theme park hotels" → /theme-park-transfers.html | hotel-area section |
| **gold-coast-airport-transport-options-with-luggage** | Book→/Book | `/?pu=Gold%20Coast%20Airport%20(OOL)#book` | CTAs |
| | "maxi taxi" wording (3 times) | "people mover (up to 7)" or "Sprinter (up to 14)", linking to /minibus-hire-gold-coast.html | options list |
| | add | "Gold Coast Airport transfers" → /gold-coast-airport-transfers.html | intro |
| **gold-coast-to-brisbane-airport-what-time-to-leave** (Claude) | no book CTA | add "Book Gold Coast → Brisbane Airport →" `/?do=Brisbane%20Airport%20(BNE)#book` | end |
| | add | "Gold Coast to Brisbane Airport transfer" → /cheapest-gold-coast-to-brisbane-airport.html; "early morning flight" → /blog/early-morning-brisbane-airport-transfer.html | timing table section |
| **guaranteed-on-time-airport-chauffeur-service-guide** | Book→/Book | `/?do=Brisbane%20Airport%20(BNE)#book` | CTAs |
| | "private transfer" → /point-to-point-transfers.html | /chauffeur-service.html (anchor "chauffeur service") | intro |
| | "Gold Coast and Brisbane suburbs" → /broadbeach-airport-transfers.html | /airport-transfers/ (anchor "all suburbs we cover") | service area section |
| | add | "real-time flight tracking" → /blog/real-time-flight-tracking-airport-transfers.html | punctuality section |
| **how-to-book-reliable-airport-transfers** | Book→/Book | `/#book` (generic article, keep it un-prefilled but add #book) | CTAs |
| | "airport transfer" → /blog/reliable-airport-pickup… | /gold-coast-airport-transfers.html; reword to "Gold Coast Airport transfer" | intro |
| | "airport transfers" → /brisbane-cbd-airport-transfers.html | /brisbane-airport-transfers.html | step section |
| | "the" → /faq.html (one-word anchor) | anchor "booking FAQs" → /faq.html | FAQ lead-in |
| **real-time-flight-tracking-airport-transfers** | Book→/Book | `/?pu=Brisbane%20Airport%20(BNE)#book` | CTAs |
| | **"airport transfers" → /sunshine-coast-airport-transfers.html (wrong)** | /brisbane-airport-transfers.html | intro |
| | external link to Airservices **careers** page (air-traffic-control-careers) | https://www.airservicesaustralia.com/tag/delays/, or remove it | flight-data section |
| | add | "what happens if your flight is delayed" → /blog/what-happens-if-flight-delayed.html | delays section |
| **reliable-airport-pickup-brisbane-flight-tracking** | Book→/Book | `/?pu=Brisbane%20Airport%20(BNE)#book` | CTAs |
| | "airport transfers" → /airport-transfers/ | /brisbane-airport-transfers.html (anchor "Brisbane Airport transfers") | intro |
| | add | "domestic or international terminal" → /blog/brisbane-airport-domestic-or-international-pickup.html | pickup section |
| **safe-airport-transport-for-families** | Book→/Book | `/?pu=Gold%20Coast%20Airport%20(OOL)#book` | CTAs |
| | add | "child seats" → /child-seats.html; "car seats on the Gold Coast" → /blog/gold-coast-airport-transfer-car-seats.html; "theme parks" → /theme-park-transfers.html | seats section and the holiday section |
| | "maxi taxi" (2) | "people mover" / "Sprinter" → /minibus-hire-gold-coast.html | vehicle section |
| **seamless-airport-transfers-for-cruise-passengers** | Book→/Book | `/?pu=Brisbane%20Airport%20(BNE)&do=Brisbane%20Cruise%20Terminal%20(Pinkenba)#book` | CTAs |
| | **"Brisbane airport to cruise terminal transfer" → /brisbane-airport-transfers.html** | /blog/brisbane-airport-to-cruise-terminal.html, or /cruise-transfers.html | body |
| **what-happens-if-flight-delayed** | Book→/Book | `/?pu=Brisbane%20Airport%20(BNE)#book` | CTAs |
| | it has **no internal content links at all** | add "flight-tracked pickups" → /blog/real-time-flight-tracking-airport-transfers.html; "Brisbane Airport transfers" → /brisbane-airport-transfers.html; "Gold Coast Airport transfers" → /gold-coast-airport-transfers.html; "FAQ" → /faq.html | intro, and the "what we do" section |
| **wheelchair-airport-transfers-chauffeur-service** | Book→/Book | `/#book` plus the line "Call 0481 437 772 to confirm accessible vehicle needs" | CTAs |
| | 2 extensionless links: /blog/guaranteed-on-time-airport-chauffeur-service-guide, /blog/fixed-price-airport-transfers-brisbane-benefits | add **.html** | body |
| | add | "chauffeur service" → /chauffeur-service.html; "Brisbane Airport" → /brisbane-airport-transfers.html | intro |

**Fix C: the "Add skytransfers.com.au as a preferred source on Google" link** (google.com/preferences/source) appears in 4 articles: chauffeur-to-city, gc-to-hotel, luggage and wheelchair. It's harmless, but it's an outbound link above the CTA. Move it to the footer or remove it.

**Fix D: links from money pages into articles.** These pages currently have no article links:

| Money page | Add a link to | Suggested anchor |
|---|---|---|
| /gold-coast-airport-transfers.html | arrivals-guide, meet-and-greet, car-seats, luggage | "Landing at OOL: where to meet your driver", etc. |
| /brisbane-airport-transfers.html | domestic-or-international, early-morning, reliable-pickup, what-happens-if-flight-delayed | "Domestic or international: which terminal?" |
| /brisbane-airport-to-gold-coast.html, /cheapest-gold-coast-to-brisbane-airport.html | what-time-to-leave, fixed-price | "What time to leave the Gold Coast for a BNE flight" |
| /cruise-transfers.html | booking-private-transport-brisbane-cruise-terminal, seamless-cruise (already links the Claude cruise article) | "Cruise day checklist" |
| /gold-coast-airport-to-surfers-paradise.html and /airport-transfers/surfers-paradise.html | gc-airport-to-hotel | "Getting from OOL to your hotel" |
| /child-seats.html | car-seats, families | "Which car seat for which age" |
| /chauffeur-service.html | guaranteed-on-time, wheelchair, meet-and-greet | |
| /rideshare-or-transfer.html | avoid-surge, fixed-price | |
| /brisbane-cbd-airport-transfers.html and /airport-transfers/brisbane-cbd.html | chauffeur-to-city | |
| /faq.html | what-happens-if-flight-delayed, how-to-book | |

Also add pre-fills to the plain `/#book` buttons on /brisbane-cbd-airport-transfers.html (`/?pu=Brisbane%20CBD&do=Brisbane%20Airport%20(BNE)#book`), /gold-coast-airport-to-surfers-paradise.html (`/?pu=Gold%20Coast%20Airport%20(OOL)&do=Surfers%20Paradise#book`) and /cheapest-gold-coast-to-brisbane-airport.html (`/?do=Brisbane%20Airport%20(BNE)#book`).

---

## 4. Orphans, broken links, NAP and price errors

**Orphans and near-orphans** (the only inbound link is the /blog/ index): brisbane-airport-chauffeur-to-city, gold-coast-airport-transfer-how-to-get-…-to-hotel, gold-coast-airport-transport-options-with-luggage, seamless-airport-transfers-for-cruise-passengers, what-happens-if-flight-delayed and wheelchair-airport-transfers-chauffeur-service. Wheelchair is the newest (26 Oct). Fixes C and D cover all six.

**Broken, redirecting or duplicate links**
- 36 GR CTAs point to `https://Www.skytransfers.com.au`. The host is case-insensitive so the link resolves, but it lands on the top of the homepage, not on the booking form.
- 6 extensionless internal links return 200 duplicates: `/blog/what-happens-if-flight-delayed`, `/blog/fixed-price-airport-transfers-brisbane-benefits`, `/blog/gold-coast-airport-transfer-car-seats`, `/blog/gold-coast-airport-chauffeur-with-meet-and-greet`, `/blog/avoid-surge-pricing-airport-rides` and `/blog/guaranteed-on-time-airport-chauffeur-service-guide`. Fix the links, and also make the server 301 `/blog/<slug>` to `/blog/<slug>.html` site-wide.
- **/fleet.html returns 404.** No page links to it now, but /our-fleet/ (ranking at position 10.5) only 301s to /#fleet.
- /airport-transfers.html returns 404. The real index is /airport-transfers/, so add a 301.
- External: streetsmarts.initiatives.qld.gov.au child-restraints (redirects twice, ends at 403) needs replacing. uber.com surge returns 406, which is probably bot blocking, so it's fine. bne.com.au/parking redirects, so update it to the final URL. The Airservices careers link isn't relevant, so replace it.
- One gallery image is missing alt text.

**NAP:** clean. No Hope Island street address, no 45 Harbour Rise, no 0488 337 771 and no Phoenix on any of the 488 pages. One gap: the homepage business schema has **no `address`** and no `geo`, so add the Oxenford address (see section 6).

**Prices:** one error, in brisbane-airport-chauffeur-to-city, where "$90–$140" and "$140–$220" should read $95 sedan, $110 people mover and $255 Sprinter (CBD to BNE). Live reference fares to OOL / BNE / Cruise:
- Surfers Paradise: sedan 125/245/270
- Broadbeach: 110/245/270
- Coolangatta: 80/280/305
- Burleigh: 95/255/280
- Southport: 125/235/260
- Coomera: 155/195/220
- Brisbane CBD to BNE: $95

Returns are 10% off. The other GR articles quote no prices, which is safe. If Grand Ranker adds prices, they should link to /prices.html instead of typing numbers.

**Taxi positioning:** GR uses "taxi" heavily (counts per article are in section 2) and "maxi taxi" in luggage, families and avoid-surge. Comparison mentions are fine, but Sky shouldn't come across as a taxi. Replace "maxi taxi" with "people mover" or "Sprinter". Brief Grand Ranker: "private transfer / chauffeur, never taxi except in comparisons."

---

## 5. Keyword cannibalisation (GSC, 3 months)

| Query family | Pages competing (impressions, position) | Page that should win | Action |
|---|---|---|---|
| gold coast airport transfers / airport transfers gold coast / private transfers gold coast | homepage (158, 71), 3 legacy posts already 301'd (~250 combined), gold-coast-airport-transfers.html (low), book-private-GC blog (pos 62–95) | **/gold-coast-airport-transfers.html** | Exact-match anchors from all GC articles (Fix A/C). Homepage title should lead with a brand and dual-airport message, not "Gold Coast Airport Transfers". De-optimise the book-private-GC article towards "how to book" and link it to the money page |
| brisbane airport transfers / airport transfers brisbane / private airport transfer brisbane | homepage (93–138, 85–89), 4 legacy posts (301'd), brisbane-airport-transfers.html (67, 87.6) | **/brisbane-airport-transfers.html** | Same: anchors from the BNE articles, plus a homepage link with the anchor "Brisbane Airport transfers" |
| brisbane cruise terminal transfers / celebrity cruise transfer | /services/cruise-transfers/ (89, 301'd), cruise-transfers.html (85, 82), comparing-cruise legacy (43, 301'd), brisbane-airport-to-cruise-terminal blog (27, 63.8), seamless-cruise (3, 79.7), booking-private-transport-cruise (–) | **/cruise-transfers.html** | All 3 cruise articles should link to it with "Brisbane cruise terminal transfers". Retarget the articles: Claude's = "BNE to cruise terminal" (how-to), seamless-cruise = "fly-cruise timing", booking-private = "Portside vs Pinkenba / what to book" |
| brisbane airport to gold coast / gold coast to brisbane airport transfer | homepage (96, 76), legacy /services/airport-transfers-in-brisbane-and-gold-coast/ (118+67, 301 → BNE-to-GC, correct), brisbane-airport-to-gold-coast.html (94, 78), cheapest-gc-to-bne (58, 81) | BNE→GC: **/brisbane-airport-to-gold-coast.html**. GC→BNE: **/cheapest-gold-coast-to-brisbane-airport.html** | Link what-time-to-leave and early-morning to the GC→BNE page |
| stretch limo / stretch hummer hire (brisbane, indooroopilly, north lakes) | 5 legacy URLs, ~700 impressions, all 301 → /chauffeur-service.html | /chauffeur-service.html, or a new /stretch-limo-hire.html **if the service is still offered** | If it isn't offered, leave the redirects alone. If it is, build the page, because there's real demand |
| minibus hire brisbane | legacy /services/mini-bus-hire-brisbane/ (149, 80.9, 301 → minibus-hire-brisbane.html, correct), new page (2) | **/minibus-hire-brisbane.html** | Fine. Wait for Google to consolidate, and link "minibus hire Brisbane" from the cruise and charters pages |
| corporate / business class / executive transfers | homepage, legacy corporate posts (301 → corporate-transfers.html), /services/vip-transfers/ | **/corporate-transfers.html** | Fine. Add an internal link from charters ("corporate function" currently goes to charters from the fixed-price article) |
| flight tracking / reliable pickup / delayed flight / on-time (4 GR articles) | real-time-flight-tracking, reliable-airport-pickup-brisbane, what-happens-if-flight-delayed, guaranteed-on-time (all <10 impressions, overlapping) | real-time-flight-tracking for "flight tracking", what-happens-if-flight-delayed for "delayed flight" | Tell Grand Ranker to stop writing on this topic. Cross-link the four with distinct anchors |
| car seats / families / child seats | car-seats blog, families blog, /child-seats.html | **/child-seats.html** for the commercial query | Both articles must link to /child-seats.html |
| GC airport to hotel / Surfers / luggage | gc-to-hotel, luggage, /gold-coast-airport-to-surfers-paradise.html, /airport-transfers/surfers-paradise.html | **/gold-coast-airport-to-surfers-paradise.html** for "gold coast airport to surfers paradise" | Link both articles to it |
| "sky transfers" (brand) | homepage pos 2.1 (47 clicks), plus /our-fleet/ (7.4) and /about-us/ (11.9) still showing | homepage | Build /fleet.html and /about.html so those legacy sitelinks get proper targets |

---

## 6. Prioritised builder suggestions

**P1, this week (conversion and indexing)**
1. **Fix all 36 GR CTAs** to pre-filled `#book` URLs (Fix A) and add CTAs to the 4 Claude articles. Ask Grand Ranker to use the exact `/?pu=…&do=…#book` format in every future article, and never `Www.`.
2. **Fix the 13 wrong anchors** and the 6 extensionless links (section 3). Add a server rule that 301s `/blog/<slug>` to `/blog/<slug>.html`.
3. **Add money-page → article links** (Fix D) so the 6 orphans get inbound links.
4. **Fix the price error** in brisbane-airport-chauffeur-to-city.
5. **Redirects:**
   - Build **/fleet.html** (sedan, SUV, people mover, Sprinter 14 with capacity, luggage and photos) and point /our-fleet/ (position 10.5), /services/toyota-hiace-commuter-hire/ and /services/mercedes-benz-sprinter-van-hire/ at it.
   - 301 /airport-transfers.html → /airport-transfers/.
   - Change these existing redirects:
     - /services/airport-transfers-hope-island/ → **/airport-transfers/hope-island.html**, not the GC airport page
     - /services/event-transfers/ → **/event-transfers.html**, not charters
     - /services/airport-transfers-south-brisbane/ and /stress-free-airport-transfers-in-south-brisbane/ → /airport-transfers/south-brisbane.html (page exists)
     - /services/airport-transfers-hamilton/ → /airport-transfers/hamilton.html (page exists)
     - /about-us/ and /contact-us/ → a real /about.html and contact section, not the homepage
   - 301 the **14 legacy 404s**:
     - the-ultimate-guide-to-mini-bus-hire… → /minibus-hire-brisbane.html
     - corporate-airport-transfers-in-brisbane-never-miss-a-meeting-again and stress-free-corporate-airport-transfers… → /corporate-transfers.html
     - coach-transfers-gold-coast-made-simple… (ranks at 22.9) and affordable-bus-hire-gold-coast… → /minibus-hire-gold-coast.html
     - why-bus-hire-gold-coast-with-driver… → /minibus-hire-gold-coast.html
     - luxury-event-transfers-brisbane… and brisbane-event-transfers-reliable… → /event-transfers.html
     - private-airport-transfers-gold-coast-exclusivity… (ranks at 6.8) and gold-coast-airport-transfer-service-elevate… → /gold-coast-airport-transfers.html
     - best-transfers-from-brisbane-to-sea-world → /theme-park-transfers.html
     - luxury-airport-transfers-surfers-paradise… → /gold-coast-airport-to-surfers-paradise.html
     - why-toyota-hiace-van-hire… → /fleet.html
   - The http→https redirect works, but the bare `http://skytransfers.com.au/` takes 2 hops. Make it a single 301 straight to https://www.

**P2, next 2 weeks (schema, titles, tracking)**

6. **Schema:**
   - Change the homepage `@type` from `TaxiService` to `["LocalBusiness","LimousineService"]` or plain `LocalBusiness` with name, telephone +61 481 437 772 and the **Oxenford address** (`PostalAddress`, addressLocality "Oxenford", QLD, postcode 4210). Add `geo`, the existing GBP cid as `sameAs`, and `aggregateRating` (4.8 from 29) only if it's the site's own review markup and matches GBP. Keep the existing `Service`/`Offer` and `FAQPage`.
   - Add **FAQPage** to the GR articles that already have an "FAQ" H2. Most of them do, but only BlogPosting/Organization is marked up.
   - Add **Service** schema with `areaServed` on each money page that lacks it, and `BreadcrumbList` on blog articles.
7. **Titles and meta:**
   - avoid-surge meta: lengthen it from 74 characters.
   - point-to-point title: cut it to under 60 characters (it's 66).
   - Homepage title should be brand plus dual airport, e.g. "Sky Transfers | Fixed-Price Gold Coast & Brisbane Airport Transfers", so it stops competing with the single-airport pages.
   - GR titles with "2026 Guide" are fine for now, but drop the year in January.
8. **BNE book buttons:** /brisbane-airport-transfers.html already pre-fills BNE. Add the same pre-fill to /brisbane-cbd-airport-transfers.html, /cheapest-gold-coast-to-brisbane-airport.html, /gold-coast-airport-to-surfers-paradise.html and every BNE article.
9. **Charters/Christmas form:**
   - /charters.html has a form (`charter_enquiry` GA4 event) and a "Christmas parties and work functions" section, but the form opens a message/mail. It is **not tied to a Google Ads conversion**; only `booking_request` is mapped in ADS_CONVERSIONS.
   - Add an Ads conversion label for `charter_enquiry` and a Meta `Lead` event.
   - Add UTM-aware hidden fields, and ideally a server-side capture (email or sheet) so enquiries are countable.
   - Make the anchor /charters.html#end-of-year linkable from ads.
10. **Tags via GTM:**
    - The site loads gtag directly (Ads AW-18399667511, GA4 G-9LYFELNSBK). There is **no Google Tag Manager and no Meta pixel (no fbq)**.
    - Install GTM once, move the GA4 and Ads tags into it, and add the Meta pixel with the events PageView, Lead (charter_enquiry), Contact (contact_phone/whatsapp/email) and InitiateCheckout/Schedule (booking_request).
    - The `dataLayer.push` calls already exist in the code, so GTM triggers can use them directly.
11. **PageSpeed:** I couldn't run the PSI API because the public quota was exhausted today. The homepage HTML is about **171 KB** with large inline CSS, JS and JSON-LD.
    - Run PSI or Lighthouse manually.
    - Minify, move the PLACES/rate tables to a cached external JS file, lazy-load gallery and below-the-fold images, serve WebP/AVIF with width and height set, and preconnect to googletagmanager.

**P3, this month (growth)**

12. **Trade/travel-agent page:** /partners.html exists. Make it a proper "Travel agents & trade" page with a net-rate enquiry form (tracked), the rate-sheet PDF request, a bulk-booking process and agent testimonials, and link it from the footer. /agent.html is noindex. Keep that private portal noindexed, but link to it from the public trade page.
13. **GBP consistency:** the site name, phone 0481 437 772, the Oxenford address (in schema), hours (24/7), and category (use "Airport shuttle service" or "Chauffeur service", not Taxi) should all match GBP exactly. Use UTM-tagged website links on GBP.
14. **Review widget:** the homepage shows a static "★ 4.8 · 29 Google reviews" link and quotes. Add a live Google reviews widget, or a periodically refreshed static block, to the money pages and the article end blocks, and link to the GBP review URL.
15. **hreflang is not needed.** The site is single-language (en-AU), single-country.
16. **Grand Ranker brief:**
    - Every article needs ≥1 link to its matching money page (exact-match anchor), ≥1 relevant suburb page, ≥2 related articles and a pre-filled CTA.
    - No "taxi"/"maxi taxi" self-description.
    - No hard-coded prices; link to /prices.html instead.
    - Stop writing on flight tracking. Next topics should target money-page gaps: theme parks from OOL/BNE, Byron Bay from OOL, Brisbane CBD hotel transfers, Sunshine Coast, Christmas party transport, and travel-agent group bookings.

---
*Method: Python crawl of the sitemap plus discovered links (requests/BeautifulSoup), with the article body scoped to `div.lp` excluding `.related`; GSC Search Analytics API (page and query+page dimensions, 26 Jul to 25 Oct 2026); curl status checks on legacy URLs. Raw data: /workspace/skyaudit/ (crawl.json, parsed.json, arts.json, linkcheck.json).*
