#!/usr/bin/env node
/*
 * build-suburbs.js — one page per priced suburb, generated at deploy time.
 *
 *   node build-suburbs.js
 *
 * Reads the fare tables straight out of index.html (the booking engine's own
 * data, so a page can never quote a fare the form would refuse), plus
 * data/suburb-facts.json (measured driving distance and time to each airport,
 * from Google's route matrix). Writes:
 *
 *   airport-transfers/<suburb>.html     one per suburb
 *   airport-transfers/index.html        the hub that links every one of them
 *   sitemap.xml                         the committed entries plus the above
 *
 * Runs as the Render build command, so the generated pages are never
 * committed: the repo stays the 30-odd hand-written files, and the 370 pages
 * are rebuilt from the tables on every deploy. Change a fare in index.html
 * and every page that shows it follows.
 *
 * Why these are not doorway pages: every page carries figures that differ
 * for real — the suburb's own fares for each airport and every vehicle, its
 * measured distance and drive time, its zone's route notes, and links to the
 * suburbs that share its fare band. A reader in Yamanto and a reader in
 * Surfers Paradise are told different, true things. The copy that is shared
 * is deliberately short.
 *
 * No dependencies. Node 18+.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT    = __dirname;
const SITE    = 'https://www.skytransfers.com.au';
const DIR     = 'airport-transfers';
const LASTMOD = '2026-09-19';               // bump when the template or the copy changes
const OUT     = path.join(ROOT, DIR);

// ---------------------------------------------------------------------------
// fare tables, read from index.html so they cannot drift from the widget
// ---------------------------------------------------------------------------
const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
function table(name) {
  const m = indexHtml.match(new RegExp('^var ' + name + ' = (.+);\\s*$', 'm'));
  if (!m) throw new Error('build-suburbs: ' + name + ' not found in index.html');
  try { return JSON.parse(m[1]); }
  catch (e) { return new Function('return (' + m[1] + ')')(); }
}
const SUBURBS      = table('SUBURBS');        // Gold Coast: name -> [OOL zone, BNE zone]
const OOL_RATES    = table('OOL_RATES');
const BNE_RATES    = table('BNE_RATES');
const BM_ZONE      = table('BM_ZONE');        // Brisbane metro: zone -> [names]
const BM_RATES     = table('BM_RATES');
const LD_ZONE      = table('LD_ZONE');        // regional: zone -> [names]
const LD_BNE_RATES = table('LD_BNE_RATES');
const LD_OOL_RATES = table('LD_OOL_RATES');
const CRUISE_EXTRA = 25;

const OOL = 'Gold Coast Airport (OOL)';
const BNE = 'Brisbane Airport (BNE)';

const VEH = [
  ['Sedan',          '1–3 passengers · 2 bags'],
  ['SUV',            '1–4 passengers · 4 bags'],
  ['Luxury Minivan', '1–7 passengers · 6 bags'],
  ['Sprinter 10',    'up to 10 passengers · 11 bags'],
  ['Sprinter 15',    'up to 15 passengers · 16 bags'],
];

// measured distance/time; missing entries just drop the sentence that needs them
let FACTS = {};
try { FACTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'suburb-facts.json'), 'utf8')); }
catch (e) { console.warn('build-suburbs: no data/suburb-facts.json, pages will omit drive times'); }

// ---------------------------------------------------------------------------
// route notes per fare zone. Written once, shared by the suburbs in the band,
// and kept to things that are true of the whole band: which roads, which
// direction, what to allow for. Numbers come from FACTS, not from here.
// ---------------------------------------------------------------------------
const Z = {
  // Gold Coast, keyed by OOL zone
  S1: { region: 'Gold Coast', label: 'southern Gold Coast',
    notes: ['{S} sits in the southern beach strip that Gold Coast Airport belongs to — the terminal is at Bilinga, so this is the shortest run we do to OOL, often under ten minutes kerb to kerb. Brisbane Airport is the long way: north on the Gold Coast Highway or the M1, then the Gateway Motorway to BNE, with the Gateway toll already inside the fare.',
            'Because the airport is so close, the pick-up time we recommend for a departure is set by check-in cut-off rather than by the drive. For international flights from OOL we still suggest leaving a full margin: the terminal is small and queues move in surges when two flights board together.'],
    faq: [['How early should I be collected in {S} for a flight from Gold Coast Airport?', 'The drive is short — {OOL_MIN} — so we work back from your airline’s check-in cut-off and add a margin, and confirm the time with you when we confirm the booking.'],
          ['Is Brisbane Airport realistic from {S}?', 'Yes, {BNE_KM} and {BNE_MIN} in normal traffic via the M1 and the Gateway. The fare is fixed and includes the Gateway toll, so it is often cheaper than two people on the Airtrain and a taxi at the far end.'],
          ['Do you cross into New South Wales?', 'The airport straddles the state border at Coolangatta, so the terminal itself is fine. Tweed Heads and further south are quoted on request.']] },
  S2: { region: 'Gold Coast', label: 'Palm Beach and the Tallebudgera valleys',
    notes: ['From {S} the airport run is a short hop south on the Gold Coast Highway or the M1 to Bilinga. The valley suburbs add a few minutes on the way out to the motorway, which is the only part of this trip that ever varies.',
            'Brisbane Airport is the M1 north and then the Gateway Motorway; allow for weekday peak between Coomera and the Logan Motorway. The Gateway toll is inside the published fare.'],
    faq: [['How long is {S} to Gold Coast Airport?', 'Typically {OOL_MIN} for {OOL_KM}. We recommend a pick-up time that respects your airline’s check-in cut-off and confirm it with you.'],
          ['And to Brisbane Airport?', '{BNE_KM}, about {BNE_MIN} outside peak. The fare includes the Gateway toll and GST; nothing is added at the end.'],
          ['Can the chauffeur find a rural address in the valley?', 'Yes. Type the street address when you book — the form resolves it to the suburb for pricing and keeps the exact address for the driver.']] },
  S3: { region: 'Gold Coast', label: 'Burleigh and Varsity Lakes',
    notes: ['{S} is on the run of suburbs between Burleigh Heads and the airport. To OOL it is a straightforward drive south on the Gold Coast Highway or the M1, exiting at Tugun; to Brisbane Airport it is the M1 the whole way north, then the Gateway Motorway, toll included in the fare.',
            'This band is popular with holiday lets and with people working from the Varsity Lakes and Robina business parks, so a large share of the work is early departures and late arrivals. There is no after-hours loading at either end of the day.'],
    faq: [['{S} to Gold Coast Airport — how long?', 'About {OOL_MIN} for {OOL_KM} in normal conditions.'],
          ['{S} to Brisbane Airport — how long?', 'About {BNE_MIN} for {BNE_KM}; the Gateway toll is included in the fixed fare.'],
          ['Is there a surcharge for an early flight?', 'No. The published fare applies at any hour, including 4am departures and midnight arrivals.']] },
  C1: { region: 'Gold Coast', label: 'Broadbeach, Robina and Mudgeeraba',
    notes: ['{S} is in the central Gold Coast band that includes Broadbeach, the Star and Pacific Fair on the coast side and Robina and Mudgeeraba inland. Gold Coast Airport is south on the M1 or the Gold Coast Highway; Brisbane Airport is the M1 north and the Gateway Motorway, toll included.',
            'Most bookings from this zone are hotel and apartment pick-ups. Tell us the building name and the driver will use the porte-cochère or the correct tower entrance; on arrivals, your chauffeur meets you inside the terminal with a name board.'],
    faq: [['How far is {S} from Gold Coast Airport?', '{OOL_KM}, usually {OOL_MIN}.'],
          ['How far is {S} from Brisbane Airport?', '{BNE_KM}, usually {BNE_MIN} outside peak. The fixed fare includes the Gateway toll.'],
          ['Which airport is cheaper from {S}?', 'Gold Coast Airport, by a wide margin — see the two columns above. If your flight options are similar, OOL saves both money and an hour on the road.']] },
  C2: { region: 'Gold Coast', label: 'Surfers Paradise, Main Beach and Nerang',
    notes: ['{S} is in the band that includes Surfers Paradise and Main Beach on the coast and Nerang, Carrara and Ashmore inland. Gold Coast Airport is roughly half an hour south; Brisbane Airport is north on the M1 and then the Gateway Motorway, toll included.',
            'Surfers Paradise hotel pick-ups are the most common job we do. Give us the hotel name and your flight number: the driver meets you at the right entrance, and on the way back we track the flight so a delay does not cost you anything.'],
    faq: [['{S} to Gold Coast Airport?', '{OOL_KM}, typically {OOL_MIN}.'],
          ['{S} to Brisbane Airport?', '{BNE_KM}, typically {BNE_MIN} outside peak, Gateway toll included.'],
          ['Do you pick up from hotel lobbies?', 'Yes. Tell us the hotel and the driver will be at the main entrance or the porte-cochère, with a name board on arrivals.']] },
  H:  { region: 'Gold Coast', label: 'the hinterland',
    notes: ['{S} is in the Gold Coast hinterland, where the drive to either airport starts on mountain or valley roads before it reaches the M1. We price it as a fixed fare like any suburb, but we recommend a slightly earlier pick-up than the raw drive time suggests — fog, a slow truck on the range, or a road closure after heavy rain are all real on these roads.',
            'From here Gold Coast Airport is south on the M1 via Nerang; Brisbane Airport is north on the M1 and the Gateway, toll included. Both are published fares, and the vehicle choice matters more than usual: a Sprinter handles a wedding party or a lodge check-out on winding roads better than two sedans.'],
    faq: [['How long from {S} to Gold Coast Airport?', 'Roughly {OOL_MIN} for {OOL_KM}, but we suggest a margin for the range roads. We confirm a recommended pick-up time with the booking.'],
          ['And to Brisbane Airport?', 'Roughly {BNE_MIN} for {BNE_KM}. Fixed fare, Gateway toll included.'],
          ['Can you get a large vehicle up the mountain?', 'Yes, our Sprinters run these roads regularly. Tell us if the driveway is steep or unsealed so we send the right vehicle.']] },
  N1: { region: 'Gold Coast', label: 'Southport and the northern beaches',
    notes: ['{S} is in the Southport band, the Gold Coast’s civic and hospital centre, with Griffith University and Gold Coast University Hospital at Parkwood and the light rail through the middle. Gold Coast Airport is south on the M1 or the coast road; Brisbane Airport is north on the M1 and the Gateway, toll included.',
            'A lot of work from here is hospital visits, university terms and cruise-ship days, which means odd hours and firm deadlines. The fare is the same at 3am as at 3pm, and we track every flight.'],
    faq: [['{S} to Gold Coast Airport?', '{OOL_KM}, about {OOL_MIN}.'],
          ['{S} to Brisbane Airport?', '{BNE_KM}, about {BNE_MIN} outside peak, toll included.'],
          ['Do you do hospital pick-ups?', 'Yes, including patient discharges with a carer. Tell us the ward or entrance and the driver will meet you there.']] },
  N2: { region: 'Gold Coast', label: 'Runaway Bay and Paradise Point',
    notes: ['{S} is on the northern Broadwater, between Runaway Bay and Paradise Point. Gold Coast Airport is a longer run south on the M1 than it is for the central suburbs; Brisbane Airport is correspondingly closer, north on the M1 and the Gateway, toll included.',
            'For a Brisbane flight the time difference between the two airports narrows here, and for some international routes BNE is the sensible choice. Both fares are published, so you can decide on price rather than guess.'],
    faq: [['{S} to Gold Coast Airport?', '{OOL_KM}, about {OOL_MIN}.'],
          ['{S} to Brisbane Airport?', '{BNE_KM}, about {BNE_MIN} outside peak. Gateway toll included.'],
          ['Marina and canal addresses — any issue?', 'None. Give us the street address; if access is via a gate or a marina office, note it on the booking and the driver will call ahead.']] },
  N3: { region: 'Gold Coast', label: 'Helensvale, Hope Island and the theme-park belt',
    notes: ['{S} is in the band that holds Movie World and Wet’n’Wild at Oxenford, the Helensvale rail and light-rail interchange, and the Hope Island and Sanctuary Cove resorts. Brisbane Airport is north on the M1 and the Gateway Motorway; Gold Coast Airport is south on the M1 past the whole coast.',
            'Theme-park families and resort guests are most of the bookings here. Child seats are $15 each and fitted before we arrive, and a Luxury Minivan or Sprinter carries the pram, the golf bags and everyone in one vehicle.'],
    faq: [['{S} to Brisbane Airport?', '{BNE_KM}, about {BNE_MIN} outside peak, Gateway toll included.'],
          ['{S} to Gold Coast Airport?', '{OOL_KM}, about {OOL_MIN}.'],
          ['Can we add a theme-park drop-off on the way?', 'Theme-park transfers are a separate fixed fare — see the theme park transfers page — but a resort-to-park run on the same day is easy to book alongside.']] },
  N4: { region: 'Gold Coast', label: 'Coomera',
    notes: ['{S} is in the Coomera growth corridor, next to Dreamworld and the Coomera Westfield, with M1 access at both ends of the suburb. Brisbane Airport is the M1 north and the Gateway Motorway; Gold Coast Airport is the M1 south, about an hour at the coast’s far end.',
            'From here Brisbane Airport is the closer of the two by time, and the fixed fare includes the Gateway toll. Both are published, so compare the columns before you book the flight.'],
    faq: [['{S} to Brisbane Airport?', '{BNE_KM}, about {BNE_MIN} outside peak.'],
          ['{S} to Gold Coast Airport?', '{OOL_KM}, about {OOL_MIN}.'],
          ['Do you wait if the flight is late?', 'Yes. We track the flight and adjust the pick-up; airport pick-ups include 30 minutes of free waiting after landing, 60 for international arrivals at Brisbane.']] },
  N5: { region: 'Gold Coast', label: 'Ormeau, Pimpama and Yatala',
    notes: ['{S} is at the northern end of the Gold Coast, where the M1 runs past the Yatala industrial estate towards Logan. Brisbane Airport is the nearer airport by time from here — M1 north, then the Gateway Motorway, toll included — and Gold Coast Airport is a full run down the coast.',
            'This band does a lot of early corporate and FIFO work out of the Yatala and Stapylton estates. Fixed fares, tax invoices on every trip, and monthly accounts for regular travellers.'],
    faq: [['{S} to Brisbane Airport?', '{BNE_KM}, about {BNE_MIN} outside peak, Gateway toll included.'],
          ['{S} to Gold Coast Airport?', '{OOL_KM}, about {OOL_MIN}.'],
          ['Can a company set up an account?', 'Yes — monthly invoicing with a GST tax invoice per trip. See the partner and corporate page.']] },

  // Brisbane metro, keyed by BM zone
  CBD: { region: 'Brisbane', label: 'the Brisbane CBD and inner city',
    notes: ['{S} is in the inner-city band around the Brisbane CBD, South Bank and the Valley. Brisbane Airport is a short run via the Airport Link tunnel or Kingsford Smith Drive along the river, and the tunnel toll is inside the fare. Most jobs here are hotel and office pick-ups with a name-board meet on the way back.',
            'Gold Coast Airport from here is quoted on request: the M1 south the whole way, about an hour and a half outside peak. Call or WhatsApp us with the date and we fix the price before you book.'],
    faq: [['How long from {S} to Brisbane Airport?', 'About {BNE_MIN} for {BNE_KM}; longer in the weekday morning peak, which we allow for in the recommended pick-up time.'],
          ['Is the Airport Link toll extra?', 'No. Tolls and GST are inside the fixed fare.'],
          ['Do you pick up from hotels and offices?', 'Yes. Give us the building and the driver will be at the entrance; on arrivals your chauffeur meets you inside the terminal with a name board.']] },
  BN1: { region: 'Brisbane', label: 'the inner north, on the airport side',
    notes: ['{S} is in the band closest to Brisbane Airport — Hamilton, Ascot, Chermside and the suburbs between — which is why it carries the lowest Brisbane fare we publish. The run is short, via Kingsford Smith Drive, the Gateway or Sandgate Road depending on where in the suburb you are.',
            'Short trips are where a fixed fare matters most: there is no minimum charge and no flag-fall, so a 10-minute run to the terminal at 5am costs exactly what the table says.'],
    faq: [['How long from {S} to Brisbane Airport?', 'About {BNE_MIN} for {BNE_KM}.'],
          ['Is there a minimum fare for such a short trip?', 'No. The published fare is the whole price, at any hour.'],
          ['Gold Coast Airport from {S}?', 'Quoted on request — call or WhatsApp us with the date and we fix the price. The drive is {OOL_KM} down the Gateway and the M1, roughly {OOL_MIN}.']] },
  BN2: { region: 'Brisbane', label: 'the northern suburbs and the Redcliffe peninsula',
    notes: ['{S} is in the northern band running from Sandgate and Bald Hills up to North Lakes and across the bridge to Redcliffe. Brisbane Airport is reached via the Gateway Motorway or the Bruce Highway and Gympie Arterial, toll included in the fare.',
            'The peninsula adds the Houghton Highway crossing; it rarely delays a trip, but we allow for it in the pick-up time we recommend on departures.'],
    faq: [['How long from {S} to Brisbane Airport?', 'About {BNE_MIN} for {BNE_KM} outside peak.'],
          ['Do you cover early flights?', 'Yes, at the same fare. Most of our northern work is the first wave of departures.'],
          ['Gold Coast Airport from {S}?', 'Quoted on request: {OOL_KM} down the Gateway and the M1, roughly {OOL_MIN}. Call or WhatsApp us with the date and we fix the price before you book.']] },
  BN3: { region: 'Brisbane', label: 'the Caboolture corridor',
    notes: ['{S} is on the Caboolture corridor north of Brisbane, where the Bruce Highway is the road to everything. Brisbane Airport is south on the Bruce and then the Gateway Motorway, toll included; it is a comfortable run outside the weekday peak and we allow for the peak when we recommend a pick-up time.',
            'This band is often quoted per-kilometre by others, which is how a $165 trip turns into $220 on the meter. Ours is fixed, per vehicle, and includes the toll.'],
    faq: [['How long from {S} to Brisbane Airport?', 'About {BNE_MIN} for {BNE_KM} outside peak.'],
          ['Is the fare the same for a 4am pick-up?', 'Yes. No after-hours loading at any time.'],
          ['Can you take a group to the airport in one vehicle?', 'Up to 15 in a Sprinter with 16 bags, one fixed price for the whole vehicle.']] },
  BN4: { region: 'Brisbane', label: 'Bribie Island and Sandstone Point',
    notes: ['{S} is on or beside Bribie Island, across the bridge from Sandstone Point. Brisbane Airport is the Bribie Island Road to the Bruce Highway, then the Bruce south and the Gateway Motorway, toll included. It is one of the longer Brisbane runs we publish, which is why it has its own fare band.',
            'Island departures tend to be early and arrivals late; the fare is the same at both ends of the day, and we track the flight home so the driver is at the terminal when you are.'],
    faq: [['How long from {S} to Brisbane Airport?', 'About {BNE_MIN} for {BNE_KM} outside peak.'],
          ['Is there a night surcharge?', 'No. The published fare applies at any hour.'],
          ['Do you wait if the flight is delayed?', 'Yes — we track it, and airport pick-ups include 30 minutes free waiting after landing, 60 for international.']] },
  BE1: { region: 'Brisbane', label: 'the eastern suburbs, from Bulimba to Wynnum',
    notes: ['{S} is in the eastern band on the airport side of the river — Bulimba, Morningside, Wynnum and Manly — which makes for a short run to Brisbane Airport via the Gateway Motorway or Kingsford Smith Drive. The Gateway toll is inside the fare.',
            'This band is also the closest to the Brisbane Cruise Terminal at Pinkenba, so cruise-day transfers are common here; the terminal fare is the airport fare plus $25 and is shown in the table.'],
    faq: [['How long from {S} to Brisbane Airport?', 'About {BNE_MIN} for {BNE_KM}.'],
          ['And to the cruise terminal?', 'Minutes further than the airport; the fare is the airport fare plus $25, shown above.'],
          ['Gold Coast Airport from {S}?', 'Quoted on request: {OOL_KM} via the Gateway and the M1, roughly {OOL_MIN}. Call or WhatsApp us with the date and we fix the price before you book.']] },
  BE2: { region: 'Brisbane', label: 'the Redlands',
    notes: ['{S} is in the Redlands, the bayside band from Capalaba out to Cleveland and Redland Bay. Brisbane Airport is north on the Gateway Motorway, toll included, and outside peak it is a steady run; the Cleveland ferries to North Stradbroke Island mean a good share of our work here is island holidays with luggage.',
            'A Luxury Minivan or Sprinter takes the surfboards, the esky and everyone in one trip at one fixed price.'],
    faq: [['How long from {S} to Brisbane Airport?', 'About {BNE_MIN} for {BNE_KM} outside peak, Gateway toll included.'],
          ['Do you meet the ferry?', 'Yes. Tell us the sailing and we time the pick-up at the Cleveland terminal.'],
          ['Gold Coast Airport from {S}?', 'Quoted on request: {OOL_KM} via the Gateway and the M1, roughly {OOL_MIN}. Call or WhatsApp us with the date and we fix the price before you book.']] },
  BS1: { region: 'Brisbane', label: 'the inner south',
    notes: ['{S} is in the inner-southern band — Coorparoo, Mount Gravatt, Annerley and around — with Brisbane Airport reached via the Gateway Motorway or the Clem7 and Airport Link tunnels, whichever is moving. Tolls are inside the fare either way.',
            'Griffith University, the Princess Alexandra and Mater hospitals and the Gabba all sit in or beside this band, so we see a lot of conference, medical and event travel; a tax invoice is issued on every trip.'],
    faq: [['How long from {S} to Brisbane Airport?', 'About {BNE_MIN} for {BNE_KM} outside peak.'],
          ['Are the tunnel tolls included?', 'Yes. Tolls and GST are inside the fixed fare on every Brisbane route.'],
          ['Gold Coast Airport from {S}?', 'Quoted on request: {OOL_KM} via the M1, roughly {OOL_MIN}. Call or WhatsApp us with the date and we fix the price before you book.']] },
  BS2: { region: 'Brisbane', label: 'Sunnybank, Logan and the southern suburbs',
    notes: ['{S} is in the southern band from Sunnybank and Eight Mile Plains through Springwood to Logan Central. Brisbane Airport is the Gateway Motorway north, toll included, and is the published fare; Gold Coast Airport is the Pacific Motorway south and is quoted on request. From here the two are closer in time than most people expect.',
            'The Sunnybank precinct and the Logan business parks generate steady corporate and family travel; accounts are available for regular bookers.'],
    faq: [['How long from {S} to Brisbane Airport?', 'About {BNE_MIN} for {BNE_KM} outside peak, Gateway toll included.'],
          ['How long from {S} to Gold Coast Airport?', 'About {OOL_MIN} for {OOL_KM} down the M1. That run is quoted on request — call or WhatsApp us with the date.'],
          ['Can I book a return in one go?', 'Book each leg with its own flight number; we track both and the fare is the same each way.']] },
  BW1: { region: 'Brisbane', label: 'the inner west',
    notes: ['{S} is in the inner-western band — Toowong, Indooroopilly, Ashgrove, The Gap and around the University of Queensland at St Lucia. Brisbane Airport is reached via Legacy Way, the Inner City Bypass and the Airport Link tunnel, with all tolls inside the fare.',
            'University terms, conferences at UQ and the Wesley hospital keep this band busy with travellers who need a receipt: a GST tax invoice is emailed with every booking.'],
    faq: [['How long from {S} to Brisbane Airport?', 'About {BNE_MIN} for {BNE_KM} outside peak.'],
          ['Are the tunnel tolls extra?', 'No. Legacy Way and Airport Link tolls are inside the fixed fare.'],
          ['Gold Coast Airport from {S}?', 'Quoted on request: {OOL_KM}, roughly {OOL_MIN} via the M1. Call or WhatsApp us with the date and we fix the price before you book.']] },
  BW2: { region: 'Brisbane', label: 'the Centenary suburbs',
    notes: ['{S} is in the Centenary band — Jindalee, Mount Ommaney, Forest Lake, Richlands — with the Centenary Motorway as the spine. Brisbane Airport is the Centenary north to Legacy Way and the Airport Link, or the Ipswich and Gateway motorways, and the tolls are inside the fare on either route.',
            'Because two routes work, the driver chooses on the day by traffic, which is one of the reasons the fare is fixed rather than metered.'],
    faq: [['How long from {S} to Brisbane Airport?', 'About {BNE_MIN} for {BNE_KM} outside peak, tolls included.'],
          ['Gold Coast Airport from {S}?', 'Quoted on request: {OOL_KM} via the Logan and Pacific motorways, roughly {OOL_MIN}. Call or WhatsApp us with the date and we fix the price before you book.'],
          ['Is a Sunday fare the same?', 'Yes. Weekday, weekend and public holiday fares are identical.']] },
  BW3: { region: 'Brisbane', label: 'Springfield, Goodna and the Ipswich Motorway corridor',
    notes: ['{S} is on the corridor between Brisbane and Ipswich that includes Springfield, Goodna and Redbank. Brisbane Airport is the Ipswich Motorway or the Centenary Motorway, then the Gateway or Legacy Way and the Airport Link — tolls inside the fare on every variant. It is a run of well over half an hour, and the fare band reflects the distance honestly.',
            'Springfield Central’s offices and the Orion precinct generate corporate travel here; monthly accounts and tax invoices are standard.'],
    faq: [['How long from {S} to Brisbane Airport?', 'About {BNE_MIN} for {BNE_KM} outside peak. Tolls are inside the fare.'],
          ['Do you do early pick-ups this far out?', 'Yes, at the same fare, any hour.'],
          ['Gold Coast Airport from {S}?', 'Quoted on request: {OOL_KM} via the Logan and Pacific motorways, roughly {OOL_MIN}. Call or WhatsApp us with the date and we fix the price before you book.']] },
  BW4: { region: 'Brisbane', label: 'Ipswich',
    notes: ['{S} is in the Ipswich city band. Brisbane Airport is the Ipswich Motorway to the Gateway, or the Warrego and Centenary motorways to Legacy Way and the Airport Link, depending on the hour; both are toll roads and the tolls are inside the fare. Until recently most of Ipswich was not priced online at all, which is why you may have been told to phone for a quote — the table above is now the answer.',
            'RAAF Base Amberley and the Ipswich hospitals sit at the edge of this band, and a good share of the bookings are defence and medical travel with firm times. We track every flight.'],
    faq: [['How long from {S} to Brisbane Airport?', 'About {BNE_MIN} for {BNE_KM} outside peak. Tolls included.'],
          ['Is the fare the same at 4am?', 'Yes. No after-hours loading.'],
          ['Gold Coast Airport from {S}?', 'Quoted on request: {OOL_KM} via the Logan Motorway and the M1, roughly {OOL_MIN}. Call or WhatsApp us with the date and we fix the price before you book.']] },
  BW5: { region: 'Brisbane', label: 'the western Ipswich towns',
    notes: ['{S} is in the band of towns west of Ipswich — Rosewood, Walloon, Marburg, Amberley — which is the furthest Brisbane-priced band we publish. The run to Brisbane Airport is the Warrego Highway to Ipswich and then the motorways to the Gateway or Airport Link, tolls included. Allow the full time; there is no fast way around Ipswich in the morning peak.',
            'Because it is a long trip, the fixed fare is the point: a metered taxi from here would be well past the published price before it reached Brisbane.'],
    faq: [['How long from {S} to Brisbane Airport?', 'About {BNE_MIN} for {BNE_KM} outside peak. Tolls included.'],
          ['Do you cover rural addresses?', 'Yes. Type the street address when booking; the driver gets it exactly, and a note about gates or unsealed roads helps.'],
          ['Gold Coast Airport from {S}?', 'Quoted on request: {OOL_KM}, roughly {OOL_MIN}. A long run; call or WhatsApp us with the date and we fix the price before you book.']] },

  // regional, keyed by LD zone
  SC1: { region: 'Sunshine Coast', label: 'Caloundra and the southern Sunshine Coast',
    notes: ['{S} is at the southern end of the Sunshine Coast, around Caloundra and Kawana. Brisbane Airport is the Bruce Highway south and then the Gateway Motorway, toll included — a highway run of well over an hour, and the fare is a fixed regional band rather than a metered trip.',
            'Sunshine Coast Airport at Marcoola is the local alternative for some routes; for anything international, BNE is the usual choice and this is the fare for it.'],
    faq: [['How long from {S} to Brisbane Airport?', 'About {BNE_MIN} for {BNE_KM} outside peak. The Gateway toll is inside the fare.'],
          ['Do you allow for Bruce Highway delays?', 'We recommend a pick-up time with a margin for the highway and confirm it with you; on arrivals we track the flight.'],
          ['Can a group travel together?', 'Up to 15 in a Sprinter with 16 bags, one fixed price for the vehicle.']] },
  SC2: { region: 'Sunshine Coast', label: 'Maroochydore, Mooloolaba and Buderim',
    notes: ['{S} is in the central Sunshine Coast band — Maroochydore, Mooloolaba, Buderim and the airport at Marcoola. Brisbane Airport is the Sunshine Motorway and the Bruce Highway south, then the Gateway, toll included. It is the busiest regional run we do, mostly for international flights that do not serve Sunshine Coast Airport.',
            'The fare is fixed per vehicle, so a family or a group pays one price for the trip, and the Sprinter takes the surfboards.'],
    faq: [['How long from {S} to Brisbane Airport?', 'About {BNE_MIN} for {BNE_KM} outside peak, Gateway toll included.'],
          ['Why not fly from Sunshine Coast Airport?', 'For many routes you can, and it is minutes away. For international departures and most early flights, Brisbane is the option, and this is the fare.'],
          ['Is there a surcharge for early or late trips?', 'No. The published fare applies at any hour.']] },
  SC3: { region: 'Sunshine Coast', label: 'Coolum, Peregian and Twin Waters',
    notes: ['{S} is on the coast north of the Sunshine Coast Airport, between Marcoola and Peregian. Brisbane Airport is the Sunshine Motorway, then the Bruce Highway south and the Gateway, toll included. Allow the full time; the Bruce is a working highway and we build a margin into the recommended pick-up.',
            'Resort check-outs are the main job here, and a name board inside the terminal on the way back.'],
    faq: [['How long from {S} to Brisbane Airport?', 'About {BNE_MIN} for {BNE_KM} outside peak. Toll included.'],
          ['Do you pick up from resorts?', 'Yes — tell us the resort and the driver will be at reception or the porte-cochère.'],
          ['Do you track the flight home?', 'Yes, and airport pick-ups include 30 minutes free waiting after landing, 60 for international.']] },
  SC4: { region: 'Sunshine Coast', label: 'Noosa',
    notes: ['{S} is in the Noosa band — Noosa Heads, Noosaville, Sunshine Beach, Tewantin and out to Eumundi. Brisbane Airport is the longest Sunshine Coast run we publish: the Sunshine Motorway or the Eumundi road to the Bruce Highway, then the Bruce south and the Gateway, toll included, around two hours outside peak.',
            'Most Noosa bookings are holiday check-ins and check-outs, often for a family or a group, which is exactly where a fixed per-vehicle fare beats two rideshares and a wait.'],
    faq: [['How long from {S} to Brisbane Airport?', 'About {BNE_MIN} for {BNE_KM} outside peak. Toll included.'],
          ['How early should we be collected for an international flight?', 'Work back from check-in cut-off and add a highway margin; we confirm a recommended time with the booking.'],
          ['Can you carry surfboards and golf bags?', 'Yes. A Luxury Minivan or Sprinter takes them without a trailer; a trailer is available for $30 if needed.']] },
  TWB: { region: 'Toowoomba', label: 'Toowoomba',
    notes: ['{S} is in Toowoomba, at the top of the Great Dividing Range. Brisbane Airport is the Warrego Highway down the range and across the Lockyer Valley to Ipswich, then the motorways to the Gateway or Airport Link — tolls included — in roughly two hours outside peak. The Toowoomba Bypass takes the trucks off the range road, but we still allow for fog on the range on winter mornings.',
            'It is a long enough trip that the vehicle matters: the sedan is the published entry fare, and the Luxury Minivan is the comfortable choice for a family with luggage.'],
    faq: [['How long from {S} to Brisbane Airport?', 'About {BNE_MIN} for {BNE_KM} outside peak. Tolls included.'],
          ['Do you do very early pick-ups from Toowoomba?', 'Yes, at the same fare. Early departures from Brisbane are the bulk of the Toowoomba work.'],
          ['Is Wellcamp an option?', 'For a handful of routes, yes — but Brisbane has the schedule, and this is the fixed fare for it.']] },
  BYR: { region: 'Byron Bay', label: 'Byron Bay and the shire',
    notes: ['{S} is in the Byron Bay band, in New South Wales. Gold Coast Airport at Coolangatta is the near airport: north on the Pacific Motorway and through the Tugun Bypass, under an hour outside peak, and a fixed fare with no state-border complication. Brisbane Airport is the M1 all the way and the Gateway, toll included, about two hours.',
            'One thing that catches people out: New South Wales keeps daylight saving from October to April and Queensland does not, so in summer Byron is an hour ahead of both airports. Flight times are always in airport-local time; we work that out for you on the booking.'],
    faq: [['How long from {S} to Gold Coast Airport?', 'About {OOL_MIN} for {OOL_KM} outside peak.'],
          ['How long from {S} to Brisbane Airport?', 'About {BNE_MIN} for {BNE_KM}, Gateway toll included.'],
          ['What about the time-zone difference?', 'In daylight-saving months Byron is one hour ahead of Queensland. We confirm the pick-up in your local time and the flight in airport time so nothing is missed.']] },
};

// ---------------------------------------------------------------------------
// build the place list with fares
// ---------------------------------------------------------------------------
const places = [];
function add(name, zoneKey, fares, region, nearest) {
  places.push({ name, zoneKey, fares, region, nearest });
}
const plus = (arr, n) => arr.map(x => x + n);

for (const name of Object.keys(SUBURBS)) {
  const [zo, zb] = SUBURBS[name];
  const bne = BNE_RATES[zb], ool = OOL_RATES[zo];
  if (!bne || !ool) throw new Error('rate missing for ' + name);
  add(name, zo, { ool, bne, cruise: plus(bne, CRUISE_EXTRA) }, 'Gold Coast', 'OOL');
}
for (const z of Object.keys(BM_ZONE)) {
  const bne = BM_RATES[z]; if (!bne) throw new Error('BM rate missing for ' + z);
  for (const name of BM_ZONE[z]) add(name, z, { bne, cruise: plus(bne, CRUISE_EXTRA) }, 'Brisbane', 'BNE');
}
for (const z of Object.keys(LD_ZONE)) {
  const bne = LD_BNE_RATES[z], ool = LD_OOL_RATES[z];
  for (const name of LD_ZONE[z]) {
    const f = {}; if (ool) f.ool = ool; if (bne) { f.bne = bne; f.cruise = plus(bne, CRUISE_EXTRA); }
    add(name, z, f, Z[z] ? Z[z].region : 'Regional', ool && !bne ? 'OOL' : (z === 'BYR' ? 'OOL' : 'BNE'));
  }
}
for (const p of places) if (!Z[p.zoneKey]) throw new Error('no route notes for zone ' + p.zoneKey + ' (' + p.name + ')');

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slug = s => s.toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const money = n => '$' + n;
const km = m => (m / 1000).toFixed(m < 20000 ? 1 : 0).replace(/\.0$/, '') + ' km';
function mins(sec) {
  const m = Math.round(sec / 60);
  if (m < 60) return m + ' minutes';
  const h = Math.floor(m / 60), r = m % 60;
  return r ? h + ' h ' + r + ' min' : h + (h === 1 ? ' hour' : ' hours');
}
const bySlug = {};
for (const p of places) {
  p.slug = slug(p.name);
  if (bySlug[p.slug]) throw new Error('slug collision: ' + p.name + ' vs ' + bySlug[p.slug].name);
  bySlug[p.slug] = p;
  p.url = '/' + DIR + '/' + p.slug + '.html';
  p.facts = FACTS[p.name] || {};
  const fromCandidates = [];
  if (p.fares.ool) fromCandidates.push(p.fares.ool[0]);
  if (p.fares.bne) fromCandidates.push(p.fares.bne[0]);
  p.from = Math.min.apply(null, fromCandidates);
}

function fill(text, p) {
  const f = p.facts;
  const d = (k, what) => (f[k] && f[k][what]) ? f[k][what] : null;
  return text
    .replace(/\{S\}/g, esc(p.name))
    .replace(/\{BNE_KM\}/g, d('bne', 'm') ? km(d('bne', 'm')) : 'the published distance')
    .replace(/\{BNE_MIN\}/g, d('bne', 's') ? mins(d('bne', 's')) : 'the usual drive time')
    .replace(/\{OOL_KM\}/g, d('ool', 'm') ? km(d('ool', 'm')) : 'the published distance')
    .replace(/\{OOL_MIN\}/g, d('ool', 's') ? mins(d('ool', 's')) : 'the usual drive time')
    .replace(/\{BNE_KM_GC_NOTE\}/g, d('ool', 'm') ? km(d('ool', 'm')) + ' down ' : '');
}

const NAV = `<nav class="sitenav">
  <div class="sitenav-in">
    <a class="logo" href="/#top" aria-label="Sky Transfers home"><img src="/logo.png" alt="Sky Transfers" style="height:42px;width:auto;display:block"></a>
    <div class="navlinks">
      <a href="/#book">Book</a>
      <a href="/#fleet">Fleet</a>
      <a href="/prices.html">Prices</a>
      <a href="/#faq">FAQ</a>
      <a href="/partners.html">Partners</a>
      <a href="/charters.html">Charters</a>
      <a class="navcall" href="tel:+61481437772">+61 481 437 772</a>
    </div>
  </div>
</nav>`;

const FOOTER = `<footer class="site">
  <div class="foot-in">
    <div>
      <img src="/logo.png" alt="Sky Transfers" style="height:38px;width:auto;display:block;margin-bottom:8px">
      <p>Gold Coast &amp; Brisbane airport transfers, tours and charters.</p>
      <p>24 hours, 7 days.</p>
    </div>
    <div>
      <p><a href="tel:+61481437772">+61 481 437 772</a></p>
      <p><a href="https://wa.me/61481437772?text=Hi%20Sky%20Transfers%2C%20I%27d%20like%20a%20quote%20for%20an%20airport%20transfer." target="_blank" rel="noopener">WhatsApp us</a></p>
      <p><a href="mailto:info@skytransfers.com.au">info@skytransfers.com.au</a></p>
      <p><a href="https://www.skytransfers.com.au">www.skytransfers.com.au</a></p>
    </div>
    <div>
      <p><a href="/#book">Book a transfer</a></p>
      <p><a href="/prices.html">Prices by suburb</a></p>
      <p><a href="/partners.html">Agent &amp; partner program</a></p>
      <p><a href="/charters.html">Sprinter &amp; coach charters</a></p>
      <p><a href="https://www.google.com/maps?cid=9657905201752242057" target="_blank" rel="noopener">Review us on Google</a></p>
    </div>
    <div class="foot-routes">
      <p><a href="/gold-coast-airport-transfers.html">Gold Coast Airport transfers</a></p>
      <p><a href="/brisbane-airport-transfers.html">Brisbane Airport transfers</a></p>
      <p><a href="/brisbane-airport-to-gold-coast.html">Brisbane Airport to Gold Coast</a></p>
      <p><a href="/gold-coast-airport-to-surfers-paradise.html">Airport to Surfers Paradise</a></p>
      <p><a href="/theme-park-transfers.html">Theme park transfers</a></p>
      <p><a href="/cruise-transfers.html">Brisbane Cruise Terminal</a></p>
      <p><a href="/byron-bay-transfers.html">Byron Bay transfers</a></p>
      <p><a href="/corporate-transfers.html">Corporate transfers</a></p>
      <p><a href="/wedding-transfers.html">Wedding transfers</a></p>
      <p><a href="/${DIR}/">Airport transfers by suburb</a></p>
    </div>
    <div class="foot-legal">
      <p><a href="/privacy.html">Privacy policy</a></p>
      <p><a href="/terms.html">Terms &amp; conditions</a></p>
      <p class="foot-entity">Australia Wide Car Services Pty Ltd trading as Sky Transfers</p>
    </div>
  </div>
</footer>
<script>
/* Contact-click tracking, shared by the pages that have no booking widget of
   their own. Same as on the hand-written landing pages. */
(function(){
  function track(event, params){
    try {
      var data = params || {};
      if (typeof window.gtag === "function") window.gtag("event", event, data);
      if (Array.isArray(window.dataLayer)) window.dataLayer.push(Object.assign({event: event}, data));
    } catch (e) {}
  }
  document.addEventListener("click", function(e){
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a) return;
    var href = a.getAttribute("href") || "";
    if (href.indexOf("tel:") === 0) track("contact_phone", {method: "phone"});
    else if (href.indexOf("https://wa.me/") === 0) track("contact_whatsapp", {method: "whatsapp"});
    else if (href.indexOf("mailto:") === 0) track("contact_email", {method: "email"});
  });
})();
</script>
<a class="wa-float" aria-label="Chat with Sky Transfers on WhatsApp" title="WhatsApp us"
   href="https://wa.me/61481437772?text=Hi%20Sky%20Transfers%2C%20I%27d%20like%20a%20quote%20for%20an%20airport%20transfer."
   target="_blank" rel="noopener">
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413"/></svg>
</a>`;

function head(title, desc, canonical, ld) {
  return `<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}${canonical}">
<meta name="robots" content="index,follow">
<meta name="theme-color" content="#101828">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Sky Transfers">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${SITE}${canonical}">
<meta property="og:locale" content="en_AU">
<meta property="og:image" content="${SITE}/logo.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<!-- Google tag (gtag.js) — Google Ads AW-18399667511 and GA4 G-9LYFELNSBK. -->
<script async src="https://www.googletagmanager.com/gtag/js?id=AW-18399667511"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'AW-18399667511');
  gtag('config', 'G-9LYFELNSBK');
</script>
<style>
  :root{color-scheme:light dark}
  body{margin:0;padding:0}
  img{max-width:100%}
  [hidden]{display:none!important}
</style>
<script type="application/ld+json">
${JSON.stringify(ld, null, 1)}
</script>
</head>
<body>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Marcellus&family=Figtree:wght@400;500;600;700&display=swap">
<link rel="stylesheet" href="/site.css">
`;
}

// ---------------------------------------------------------------------------
// one suburb page
// ---------------------------------------------------------------------------
function airportsFor(p) {
  const a = [];
  if (p.fares.ool) a.push({ key: 'ool', code: 'OOL', name: 'Gold Coast Airport', place: OOL, fares: p.fares.ool });
  if (p.fares.bne) a.push({ key: 'bne', code: 'BNE', name: 'Brisbane Airport', place: BNE, fares: p.fares.bne });
  if (p.nearest === 'BNE') a.reverse();          // lead with the airport people here actually use
  return a;
}

function suburbPage(p) {
  const z = Z[p.zoneKey];
  const air = airportsFor(p);
  const primary = air[0];
  const ctaHref = '/?pu=' + encodeURIComponent(p.name) + '&do=' + encodeURIComponent(primary.place) + '#book';
  const state = p.region === 'Byron Bay' ? 'NSW' : 'QLD';
  const f = p.facts;

  const title = `${p.name} Airport Transfers | Fixed Price from $${p.from} | Sky Transfers`;
  const desc = `Private chauffeur transfers from ${p.name} to ${air.map(a => a.name + ' (' + a.code + ')').join(' and ')}. ` +
    `Fixed fares from $${p.from} per vehicle, GST and tolls included, flight tracking, meet and greet, free changes to 24 hours. 24/7.`;

  // fares table: one row per vehicle, one column per airport (+ cruise terminal if BNE priced)
  const cols = air.map(a => a.name + ' (' + a.code + ')');
  if (p.fares.cruise) cols.push('Brisbane Cruise Terminal');
  const rows = VEH.map((v, i) => {
    const cells = air.map(a => `<td>${money(a.fares[i])}</td>`);
    if (p.fares.cruise) cells.push(`<td>${money(p.fares.cruise[i])}</td>`);
    return `        <tr><th scope="row">${esc(v[0])}<span class="s"> ${esc(v[1])}</span></th>${cells.join('')}</tr>`;
  }).join('\n');

  // drive facts
  const drive = air.map(a => {
    const d = f[a.key];
    if (!d || !d.m || !d.s) return null;
    return `<li><strong>${esc(p.name)} to ${a.name}:</strong> ${km(d.m)}, about ${mins(d.s)} in normal traffic.</li>`;
  }).filter(Boolean);

  const nearestFact = (() => {
    const d = f[primary.key];
    if (d && d.s) return `<div class="fact"><span class="k">To ${primary.code}</span><span class="v">${mins(d.s).replace(' minutes', ' min').replace(/ h /, 'h ')}</span><span class="s">${km(d.m)}, typical</span></div>`;
    return `<div class="fact"><span class="k">Airports</span><span class="v">${air.map(a => a.code).join(' &amp; ')}</span><span class="s">Fixed fares to each</span></div>`;
  })();

  // neighbours: same fare band, excluding self
  const neighbours = places.filter(q => q.zoneKey === p.zoneKey && q.region === p.region && q !== p).slice(0, 8);

  const faqs = z.faq.map(([q, a]) => [fill(q, p), fill(a, p)]);

  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@id': SITE + p.url + '#service',
        '@type': 'Service',
        name: `Airport transfers from ${p.name}`,
        serviceType: 'Airport transfer',
        url: SITE + p.url,
        areaServed: { '@type': 'Place', name: `${p.name}, ${state}`, containedInPlace: { '@type': 'AdministrativeArea', name: state === 'NSW' ? 'New South Wales' : 'Queensland' } },
        provider: { '@id': SITE + '/#business' },
        offers: air.map(a => ({
          '@type': 'Offer',
          name: `${p.name} to ${a.name} (${a.code}), sedan, one way`,
          price: String(a.fares[0]),
          priceCurrency: 'AUD',
          availability: 'https://schema.org/InStock',
          url: SITE + p.url,
          priceSpecification: { '@type': 'PriceSpecification', price: String(a.fares[0]), minPrice: String(a.fares[0]), priceCurrency: 'AUD', valueAddedTaxIncluded: true },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' },
          { '@type': 'ListItem', position: 2, name: 'Airport transfers by suburb', item: SITE + '/' + DIR + '/' },
          { '@type': 'ListItem', position: 3, name: p.name, item: SITE + p.url },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: faqs.map(([q, a]) => ({ '@type': 'Question', name: q.replace(/&amp;/g, '&').replace(/&#39;/g, "'"), acceptedAnswer: { '@type': 'Answer', text: a.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&') } })),
      },
    ],
  };

  const body = `${NAV}

<header class="fares-hero" id="top">
  <h1>${esc(p.name)} airport transfers, fixed price</h1>
  <p>
    Private chauffeur transfers between ${esc(p.name)} and ${air.map(a => esc(a.name)).join(' or ')},
    priced per vehicle and published below. From $${p.from} one way, GST and tolls included, at any hour.
  </p>
  <a class="cta-gold" href="${ctaHref}">Book ${esc(p.name)} to ${esc(primary.code)}</a>
</header>

<div class="lp">

  <div class="facts">
    <div class="fact"><span class="k">From</span><span class="v">$${p.from}</span><span class="s">Sedan, one way, to ${esc(primary.code)}</span></div>
    ${nearestFact}
    <div class="fact"><span class="k">Vehicles</span><span class="v">1&ndash;15</span><span class="s">Sedan to Sprinter, one price each</span></div>
    <div class="fact"><span class="k">Changes</span><span class="v">Free</span><span class="s">Up to 24 hours before pick-up</span></div>
  </div>

  <h2>What it costs from ${esc(p.name)}</h2>
  <p>
    These are the fares the booking form quotes for ${esc(p.name)} — not &ldquo;from&rdquo; prices. One way,
    per vehicle, in Australian dollars, GST inclusive; Brisbane Airport and cruise terminal fares
    include the Gateway toll. The same fare applies at any hour of any day.
  </p>

  <div class="faretable-wrap">
    <table class="lpfare">
      <caption>${esc(p.name)} &rarr; ${cols.map(esc).join(' / ')} &mdash; one way, AUD</caption>
      <thead>
        <tr><th scope="col">Vehicle</th>${cols.map(c => `<th scope="col">${esc(c)}</th>`).join('')}</tr>
      </thead>
      <tbody>
${rows}
      </tbody>
    </table>
  </div>
  <p class="fare-note">
    Included: meet &amp; greet with a name board, flight tracking, 30 minutes&rsquo; free airport waiting
    (60 for international arrivals at Brisbane). Child seats $15 each, luggage trailer $30.
    The cruise terminal fare is the Brisbane Airport fare plus $25.
  </p>

  <h2>The drive from ${esc(p.name)}</h2>
  ${drive.length ? `<ul>\n    ${drive.join('\n    ')}\n  </ul>` : ''}
  ${z.notes.map(n => `<p>${fill(n, p)}</p>`).join('\n  ')}

  <div class="box">
    <p>
      <strong>Booking from ${esc(p.name)}.</strong> Type your street address into the booking form and it
      prices the trip as ${esc(p.name)} while keeping the exact address for your chauffeur. Online bookings
      close six hours before pick-up; inside that window, call <a href="tel:+61481437772">+61 481 437 772</a>
      and we will take the job if a car is free.
    </p>
  </div>

  <h2>Questions from ${esc(p.name)}</h2>
${faqs.map(([q, a]) => `  <details>\n    <summary>${q}</summary>\n    <p>${a}</p>\n  </details>`).join('\n')}

  ${neighbours.length ? `<h2>Nearby, same fare band</h2>
  <div class="related">
${neighbours.map(q => `    <a href="${q.url}">${esc(q.name)}<span>From $${q.from}</span></a>`).join('\n')}
  </div>` : ''}
  <p class="fare-note">
    ${z.region === 'Gold Coast' ? `<a href="/gold-coast-airport-transfers.html">Gold Coast Airport transfers</a> &middot; ` : ''}${p.fares.bne ? `<a href="/brisbane-airport-transfers.html">Brisbane Airport transfers</a> &middot; ` : ''}<a href="/${DIR}/">All suburbs</a> &middot; <a href="/prices.html">Full price list</a>
  </p>

</div>

<section class="cta-band">
  <h2>Price your ${esc(p.name)} transfer in about a minute</h2>
  <p>
    Pick-up, drop-off, flight number, vehicle. The fare comes back straight away and it does not change
    afterwards.
  </p>
  <a class="cta-gold" href="${ctaHref}">Book from ${esc(p.name)}</a>
  <span class="alt">Or call <a href="tel:+61481437772">+61 481 437 772</a> &mdash; 24 hours, 7 days.</span>
</section>
${FOOTER}
</body>
</html>
`;
  return head(title, desc, p.url, ld) + body;
}

// ---------------------------------------------------------------------------
// the hub
// ---------------------------------------------------------------------------
function hubPage() {
  const regions = [
    ['Gold Coast', ['S1', 'S2', 'S3', 'C1', 'C2', 'N1', 'N2', 'N3', 'N4', 'N5', 'H']],
    ['Brisbane', ['CBD', 'BN1', 'BN2', 'BN3', 'BN4', 'BE1', 'BE2', 'BS1', 'BS2', 'BW1', 'BW2', 'BW3', 'BW4', 'BW5']],
    ['Sunshine Coast', ['SC1', 'SC2', 'SC3', 'SC4']],
    ['Toowoomba', ['TWB']],
    ['Byron Bay', ['BYR']],
  ];
  const sections = regions.map(([region, zones]) => {
    const groups = zones.map(zk => {
      const list = places.filter(p => p.region === region && p.zoneKey === zk).sort((a, b) => a.name.localeCompare(b.name));
      if (!list.length) return '';
      return `  <h3>${esc(Z[zk].label.charAt(0).toUpperCase() + Z[zk].label.slice(1))}</h3>
  <div class="related">
${list.map(p => `    <a href="${p.url}">${esc(p.name)}<span>From $${p.from}</span></a>`).join('\n')}
  </div>`;
    }).filter(Boolean).join('\n');
    const n = places.filter(p => p.region === region).length;
    return `  <h2>${esc(region)} <span class="s">${n} suburbs</span></h2>\n${groups}`;
  }).join('\n\n');

  const title = `Airport Transfers by Suburb | ${places.length} Fixed Fares | Sky Transfers`;
  const desc = `Every suburb we price for airport transfers — ${places.length} across the Gold Coast, Brisbane, Ipswich, the Sunshine Coast, Toowoomba and Byron Bay — each with its own fixed fares, drive time and booking link.`;
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', '@id': SITE + '/' + DIR + '/', name: 'Airport transfers by suburb', url: SITE + '/' + DIR + '/', description: desc, isPartOf: { '@id': SITE + '/#website' }, about: { '@id': SITE + '/#business' } },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' },
        { '@type': 'ListItem', position: 2, name: 'Airport transfers by suburb', item: SITE + '/' + DIR + '/' } ] },
    ],
  };
  const body = `${NAV}

<header class="fares-hero" id="top">
  <h1>Airport transfers by suburb</h1>
  <p>
    ${places.length} suburbs, each with its own page: the fixed fare for every vehicle to each airport,
    the measured drive time, and a booking link that lands with the suburb already filled in.
  </p>
  <a class="cta-gold" href="/#book">Get a fixed price now</a>
</header>

<div class="lp">
  <p>
    Fares are per vehicle, one way, GST inclusive, and the same at any hour. Brisbane Airport fares include
    the Gateway toll. If your suburb is not here, it is still likely we serve it &mdash;
    <a href="/#book">type the address into the booking form</a> or call
    <a href="tel:+61481437772">+61 481 437 772</a>.
  </p>

${sections}

</div>

<section class="cta-band">
  <h2>Any of these, priced in about a minute</h2>
  <p>Pick-up, drop-off, flight number, vehicle. The fare is fixed before you book.</p>
  <a class="cta-gold" href="/#book">Book a transfer</a>
  <span class="alt">Or call <a href="tel:+61481437772">+61 481 437 772</a> &mdash; 24 hours, 7 days.</span>
</section>
${FOOTER}
</body>
</html>
`;
  return head(title, desc, '/' + DIR + '/', ld) + body;
}

// ---------------------------------------------------------------------------
// write everything
// ---------------------------------------------------------------------------
fs.mkdirSync(OUT, { recursive: true });
let written = 0;
for (const p of places) {
  fs.writeFileSync(path.join(OUT, p.slug + '.html'), suburbPage(p));
  written++;
}
fs.writeFileSync(path.join(OUT, 'index.html'), hubPage());

// sitemap: keep every committed entry, drop any earlier generated ones, append ours
const smPath = path.join(ROOT, 'sitemap.xml');
let sm = fs.readFileSync(smPath, 'utf8');
sm = sm.replace(/\s*<url>\s*<loc>[^<]*\/airport-transfers\/[^<]*<\/loc>[\s\S]*?<\/url>/g, '');
const entries = [`  <url>\n    <loc>${SITE}/${DIR}/</loc>\n    <lastmod>${LASTMOD}</lastmod>\n  </url>`]
  .concat(places.map(p => `  <url>\n    <loc>${SITE}${p.url}</loc>\n    <lastmod>${LASTMOD}</lastmod>\n  </url>`));
sm = sm.replace(/\s*<\/urlset>\s*$/, '\n' + entries.join('\n') + '\n</urlset>\n');
fs.writeFileSync(smPath, sm);

const withFacts = places.filter(p => p.facts && (p.facts.bne || p.facts.ool)).length;
console.log(`build-suburbs: ${written} suburb pages + hub written to ${DIR}/, ${withFacts} with measured drive times; sitemap now has ${(sm.match(/<loc>/g) || []).length} URLs`);
if (written !== places.length) { console.error('build-suburbs: page count mismatch'); process.exit(1); }
