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
/* Mirrors RETURN_DISCOUNT in index.html and stripe-server.js. Only used to
   quote the saving in prose here - nothing on these pages is charged from it -
   but it still has to agree with those two or the pages would advertise a
   price the booking form does not honour. */
const RETURN_DISCOUNT = 0.10;
const returnFare = (f) => Math.round(f * 2 * (1 - RETURN_DISCOUNT));
const DIR     = 'airport-transfers';
const LASTMOD = '2026-11-02';               // bump when the template or the copy changes
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
const BM_OOL_ZONE  = table('BM_OOL_ZONE');   // Brisbane metro -> OOL: band -> [names]
const BM_OOL_RATES = table('BM_OOL_RATES');
const BM_OOL_SUBURB = {};
Object.keys(BM_OOL_ZONE).forEach((z) => BM_OOL_ZONE[z].forEach((s) => { BM_OOL_SUBURB[s] = z; }));
const LD_ZONE      = table('LD_ZONE');        // regional: zone -> [names]
const LD_BNE_RATES = table('LD_BNE_RATES');
const LD_OOL_RATES = table('LD_OOL_RATES');
const CRUISE_EXTRA = 25;

const OOL = 'Gold Coast Airport (OOL)';
const BNE = 'Brisbane Airport (BNE)';

const VEH = [
  ['Sedan',          '1–3 passengers · 2 bags'],
  ['SUV',            '1–4 passengers · 4 bags'],
  ['People Mover',   '1–7 passengers · 6 bags'],
  ['Luxury Sedan',   '1–3 passengers · 2 bags'],
  ['Luxury Minivan', '1–6 passengers · 6 bags'],
  ['Sprinter 10',    'up to 10 passengers · 11 bags'],
  ['Sprinter 14',    'up to 14 passengers · 15 bags'],
];
/* VEH is the point-to-point and day-tour list: the 18-seater has no fare
   there, so it stays out of those tables. VEH_T is the airport and cruise
   TRANSFER list, where the 18-seater has had a published fare since 3 Nov 2026
   (the rate tables' eighth column: Sprinter 14 x 1.20, up to the next $5). */
const VEH_T = VEH.concat([['Sprinter 18', 'up to 18 passengers · 18 bags']]);

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
    notes: ['{S} sits in the southern beach strip that Gold Coast Airport belongs to \u2014 the terminal is at Bilinga, so this is the shortest run we do to OOL, often under ten minutes kerb to kerb. Brisbane Airport is the long way: north on the Gold Coast Highway or the M1, then the Gateway Motorway to BNE, with the Gateway toll already inside the fare.',
            'Because the airport is so close, the pick-up time we recommend for a departure is set by check-in cut-off rather than by the drive. For international flights from OOL we still suggest leaving a full margin: the terminal is small and queues move in surges when two flights board together.'],
    faq: [['How early should I be collected in {S} for a flight from Gold Coast Airport?', 'The drive is short \u2014 {OOL_MIN} \u2014 so we work back from your airline\u2019s check-in cut-off and add a margin, and confirm the time with you when we confirm the booking.'],
          ['Is Brisbane Airport realistic from {S}?', 'Yes, {BNE_KM} and {BNE_MIN} in normal traffic via the M1 and the Gateway. The fare is fixed and includes the Gateway toll, so it is often cheaper than two people on the Airtrain plus a rideshare at the far end.'],
          ['Do you cross into New South Wales?', 'The airport straddles the state border at Coolangatta, so the terminal itself is fine. Tweed Heads and further south are quoted on request.']] },
  S2: { region: 'Gold Coast', label: 'Palm Beach and the Tallebudgera valleys',
    notes: ['From {S} the airport run is a short hop south on the Gold Coast Highway or the M1 to Bilinga. The valley suburbs add a few minutes on the way out to the motorway, which is the only part of this trip that ever varies.',
            'Brisbane Airport is the M1 north and then the Gateway Motorway; allow for weekday peak between Coomera and the Logan Motorway. The Gateway toll is inside the published fare.'],
    faq: [['How long is {S} to Gold Coast Airport?', 'Typically {OOL_MIN} for {OOL_KM}. We recommend a pick-up time that respects your airline\u2019s check-in cut-off and confirm it with you.'],
          ['And to Brisbane Airport?', '{BNE_KM}, about {BNE_MIN} outside peak. The fare includes the Gateway toll and GST; nothing is added at the end.'],
          ['Can the chauffeur find a rural address in the valley?', 'Yes. Type the street address when you book \u2014 the form resolves it to the suburb for pricing and keeps the exact address for the driver.']] },
  S3: { region: 'Gold Coast', label: 'Burleigh and Varsity Lakes',
    notes: ['{S} is on the run of suburbs between Burleigh Heads and the airport. To OOL it is a straightforward drive south on the Gold Coast Highway or the M1, exiting at Tugun; to Brisbane Airport it is the M1 the whole way north, then the Gateway Motorway, toll included in the fare.',
            'This band is popular with holiday lets and with people working from the Varsity Lakes and Robina business parks, so a large share of the work is early departures and late arrivals. There is no after-hours loading at either end of the day.'],
    faq: [['{S} to Gold Coast Airport \u2014 how long?', 'About {OOL_MIN} for {OOL_KM} in normal conditions.'],
          ['{S} to Brisbane Airport \u2014 how long?', 'About {BNE_MIN} for {BNE_KM}; the Gateway toll is included in the fixed fare.'],
          ['Is there a surcharge for an early flight?', 'No. The published fare applies at any hour, including 4am departures and midnight arrivals.']] },
  C1: { region: 'Gold Coast', label: 'Broadbeach, Robina and Mudgeeraba',
    notes: ['{S} is in the central Gold Coast band that includes Broadbeach, the Star and Pacific Fair on the coast side and Robina and Mudgeeraba inland. Gold Coast Airport is south on the M1 or the Gold Coast Highway; Brisbane Airport is the M1 north and the Gateway Motorway, toll included.',
            'Most bookings from this zone are hotel and apartment pick-ups. Tell us the building name and the driver will use the porte-coch\u00e8re or the correct tower entrance; on arrivals, your chauffeur meets you inside the terminal with a name board.'],
    faq: [['How far is {S} from Gold Coast Airport?', '{OOL_KM}, usually {OOL_MIN}.'],
          ['How far is {S} from Brisbane Airport?', '{BNE_KM}, usually {BNE_MIN} outside peak. The fixed fare includes the Gateway toll.'],
          ['Which airport is cheaper from {S}?', 'Gold Coast Airport, by a wide margin \u2014 see the two columns above. If your flight options are similar, OOL saves both money and an hour on the road.']] },
  C2: { region: 'Gold Coast', label: 'Surfers Paradise, Main Beach and Nerang',
    notes: ['{S} is in the band that includes Surfers Paradise and Main Beach on the coast and Nerang, Carrara and Ashmore inland. Gold Coast Airport is roughly half an hour south; Brisbane Airport is north on the M1 and then the Gateway Motorway, toll included.',
            'Surfers Paradise hotel pick-ups are the most common job we do. Give us the hotel name and your flight number: the driver meets you at the right entrance, and on the way back we track the flight so a delay does not cost you anything.'],
    faq: [['{S} to Gold Coast Airport?', '{OOL_KM}, typically {OOL_MIN}.'],
          ['{S} to Brisbane Airport?', '{BNE_KM}, typically {BNE_MIN} outside peak, Gateway toll included.'],
          ['Do you pick up from hotel lobbies?', 'Yes. Tell us the hotel and the driver will be at the main entrance or the porte-coch\u00e8re, with a name board on arrivals.']] },
  H:  { region: 'Gold Coast', label: 'the hinterland',
    notes: ['{S} is in the Gold Coast hinterland, where the drive to either airport starts on mountain or valley roads before it reaches the M1. We price it as a fixed fare like any suburb, but we recommend a slightly earlier pick-up than the raw drive time suggests \u2014 fog, a slow truck on the range, or a road closure after heavy rain are all real on these roads.',
            'From here Gold Coast Airport is south on the M1 via Nerang; Brisbane Airport is north on the M1 and the Gateway, toll included. Both are published fares, and the vehicle choice matters more than usual: a Sprinter handles a wedding party or a lodge check-out on winding roads better than two sedans.'],
    faq: [['How long from {S} to Gold Coast Airport?', 'Roughly {OOL_MIN} for {OOL_KM}, but we suggest a margin for the range roads. We confirm a recommended pick-up time with the booking.'],
          ['And to Brisbane Airport?', 'Roughly {BNE_MIN} for {BNE_KM}. Fixed fare, Gateway toll included.'],
          ['Can you get a large vehicle up the mountain?', 'Yes, our Sprinters run these roads regularly. Tell us if the driveway is steep or unsealed so we send the right vehicle.']] },
  N1: { region: 'Gold Coast', label: 'Southport and the northern beaches',
    notes: ['{S} is in the Southport band, the Gold Coast\u2019s civic and hospital centre, with Griffith University and Gold Coast University Hospital at Parkwood and the light rail through the middle. Gold Coast Airport is south on the M1 or the coast road; Brisbane Airport is north on the M1 and the Gateway, toll included.',
            'A lot of work from here is hospital visits, university terms and cruise-ship days, which means odd hours and firm deadlines. The fare is the same at 3am as at 3pm, and we track every flight.'],
    faq: [['{S} to Gold Coast Airport?', '{OOL_KM}, about {OOL_MIN}.'],
          ['{S} to Brisbane Airport?', '{BNE_KM}, about {BNE_MIN} outside peak, toll included.'],
          ['Do you do hospital pick-ups?', 'Yes, including patient discharges with a carer. Tell us the ward or entrance and the driver will meet you there.']] },
  N2: { region: 'Gold Coast', label: 'Runaway Bay and Paradise Point',
    notes: ['{S} is on the northern Broadwater, between Runaway Bay and Paradise Point. Gold Coast Airport is a longer run south on the M1 than it is for the central suburbs; Brisbane Airport is correspondingly closer, north on the M1 and the Gateway, toll included.',
            'For a Brisbane flight the time difference between the two airports narrows here, and for some international routes BNE is the sensible choice. Both fares are published, so you can decide on price rather than guess.'],
    faq: [['{S} to Gold Coast Airport?', '{OOL_KM}, about {OOL_MIN}.'],
          ['{S} to Brisbane Airport?', '{BNE_KM}, about {BNE_MIN} outside peak. Gateway toll included.'],
          ['Marina and canal addresses \u2014 any issue?', 'None. Give us the street address; if access is via a gate or a marina office, note it on the booking and the driver will call ahead.']] },
  N3: { region: 'Gold Coast', label: 'Helensvale, Hope Island and the theme-park belt',
    notes: ['{S} is in the band that holds Movie World and Wet\u2019n\u2019Wild at Oxenford, the Helensvale rail and light-rail interchange, and the Hope Island and Sanctuary Cove resorts. Brisbane Airport is north on the M1 and the Gateway Motorway; Gold Coast Airport is south on the M1 past the whole coast.',
            'Theme-park families and resort guests are most of the bookings here. Child seats are $15 each and fitted before we arrive, and a Luxury Minivan or Sprinter carries the pram, the golf bags and everyone in one vehicle.'],
    faq: [['{S} to Brisbane Airport?', '{BNE_KM}, about {BNE_MIN} outside peak, Gateway toll included.'],
          ['{S} to Gold Coast Airport?', '{OOL_KM}, about {OOL_MIN}.'],
          ['Can we add a theme-park drop-off on the way?', 'Theme-park transfers are a separate fixed fare \u2014 see the theme park transfers page \u2014 but a resort-to-park run on the same day is easy to book alongside.']] },
  N4: { region: 'Gold Coast', label: 'Coomera',
    notes: ['{S} is in the Coomera growth corridor, next to Dreamworld and the Coomera Westfield, with M1 access at both ends of the suburb. Brisbane Airport is the M1 north and the Gateway Motorway; Gold Coast Airport is the M1 south, about an hour at the coast\u2019s far end.',
            'From here Brisbane Airport is the closer of the two by time, and the fixed fare includes the Gateway toll. Both are published, so compare the columns before you book the flight.'],
    faq: [['{S} to Brisbane Airport?', '{BNE_KM}, about {BNE_MIN} outside peak.'],
          ['{S} to Gold Coast Airport?', '{OOL_KM}, about {OOL_MIN}.'],
          ['Do you wait if the flight is late?', 'Yes. We track the flight and adjust the pick-up; airport pick-ups include 30 minutes of free waiting after landing, 60 for international arrivals.']] },
  N5: { region: 'Gold Coast', label: 'Ormeau, Pimpama and Yatala',
    notes: ['{S} is at the northern end of the Gold Coast, where the M1 runs past the Yatala industrial estate towards Logan. Brisbane Airport is the nearer airport by time from here \u2014 M1 north, then the Gateway Motorway, toll included \u2014 and Gold Coast Airport is a full run down the coast.',
            'This band does a lot of early corporate and FIFO work out of the Yatala and Stapylton estates. Fixed fares, tax invoices on every trip, and monthly accounts for regular travellers.'],
    faq: [['{S} to Brisbane Airport?', '{BNE_KM}, about {BNE_MIN} outside peak, Gateway toll included.'],
          ['{S} to Gold Coast Airport?', '{OOL_KM}, about {OOL_MIN}.'],
          ['Can a company set up an account?', 'Yes \u2014 monthly invoicing with a GST tax invoice per trip. See the partner and corporate page.']] },

  // Brisbane metro, keyed by BM zone
  CBD: { region: 'Brisbane', label: 'the Brisbane CBD and inner city',
    notes: ['{S} is in the inner-city band around the Brisbane CBD, South Bank and the Valley. Brisbane Airport is a short run via the Airport Link tunnel or Kingsford Smith Drive along the river, and the tunnel toll is inside the fare. Most jobs here are hotel and office pick-ups with a name-board meet on the way back.',
            'Gold Coast Airport is a fixed fare from here too: the M1 south the whole way, about an hour and a half outside peak, so both airports are priced in the table above.'],
    faq: [['How long from {S} to Brisbane Airport?', 'About {BNE_MIN} for {BNE_KM}; longer in the weekday morning peak, which we allow for in the recommended pick-up time.'],
          ['Is the Airport Link toll extra?', 'No. Tolls and GST are inside the fixed fare.'],
          ['Do you pick up from hotels and offices?', 'Yes. Give us the building and the driver will be at the entrance; on arrivals your chauffeur meets you inside the terminal with a name board.']] },
  BN1: { region: 'Brisbane', label: 'the inner north, on the airport side',
    notes: ['{S} is in the band closest to Brisbane Airport \u2014 Hamilton, Ascot, Chermside and the suburbs between \u2014 which is why it carries the lowest Brisbane fare we publish. The run is short, via Kingsford Smith Drive, the Gateway or Sandgate Road depending on where in the suburb you are.',
            'Short trips are where a fixed fare matters most: there is no minimum charge and no flag-fall, so a 10-minute run to the terminal at 5am costs exactly what the table says.'],
    faq: [['How long from {S} to Brisbane Airport?', 'About {BNE_MIN} for {BNE_KM}.'],
          ['Is there a minimum fare for such a short trip?', 'No. The published fare is the whole price, at any hour.'],
          ['Gold Coast Airport from {S}?', 'The drive is {OOL_KM} down the Gateway and the M1, roughly {OOL_MIN}. {OOL_PRICING}']] },
  BN2: { region: 'Brisbane', label: 'the northern suburbs and the Redcliffe peninsula',
    notes: ['{S} is in the northern band running from Sandgate and Bald Hills up to North Lakes and across the bridge to Redcliffe. Brisbane Airport is reached via the Gateway Motorway or the Bruce Highway and Gympie Arterial, toll included in the fare.',
            'The peninsula adds the Houghton Highway crossing; it rarely delays a trip, but we allow for it in the pick-up time we recommend on departures.'],
    faq: [['How long from {S} to Brisbane Airport?', 'About {BNE_MIN} for {BNE_KM} outside peak.'],
          ['Do you cover early flights?', 'Yes, at the same fare. Most of our northern work is the first wave of departures.'],
          ['Gold Coast Airport from {S}?', '{OOL_KM} down the Gateway and the M1, roughly {OOL_MIN}. {OOL_PRICING}']] },
  BN3: { region: 'Brisbane', label: 'the Caboolture corridor',
    notes: ['{S} is on the Caboolture corridor north of Brisbane, where the Bruce Highway is the road to everything. Brisbane Airport is south on the Bruce and then the Gateway Motorway, toll included; it is a comfortable run outside the weekday peak and we allow for the peak when we recommend a pick-up time.',
            'This band is often quoted per-kilometre by others, which is how a $165 trip turns into $220 on the meter. Ours is fixed, per vehicle, and includes the toll.'],
    faq: [['How long from {S} to Brisbane Airport?', 'About {BNE_MIN} for {BNE_KM} outside peak.'],
          ['Is the fare the same for a 4am pick-up?', 'Yes. No after-hours loading at any time.'],
          ['Can you take a group to the airport in one vehicle?', 'Up to 14 in a Sprinter with 15 bags, one fixed price for the whole vehicle.']] },
  BN4: { region: 'Brisbane', label: 'Bribie Island and Sandstone Point',
    notes: ['{S} is on or beside Bribie Island, across the bridge from Sandstone Point. Brisbane Airport is the Bribie Island Road to the Bruce Highway, then the Bruce south and the Gateway Motorway, toll included. It is one of the longer Brisbane runs we publish, which is why it has its own fare band.',
            'Island departures tend to be early and arrivals late; the fare is the same at both ends of the day, and we track the flight home so the driver is at the terminal when you are.'],
    faq: [['How long from {S} to Brisbane Airport?', 'About {BNE_MIN} for {BNE_KM} outside peak.'],
          ['Is there a night surcharge?', 'No. The published fare applies at any hour.'],
          ['Do you wait if the flight is delayed?', 'Yes \u2014 we track it, and airport pick-ups include 30 minutes free waiting after landing, 60 for international.']] },
  BE1: { region: 'Brisbane', label: 'the eastern suburbs, from Bulimba to Wynnum',
    notes: ['{S} is in the eastern band on the airport side of the river \u2014 Bulimba, Morningside, Wynnum and Manly \u2014 which makes for a short run to Brisbane Airport via the Gateway Motorway or Kingsford Smith Drive. The Gateway toll is inside the fare.',
            'This band is also the closest to the Brisbane Cruise Terminal at Pinkenba, so cruise-day transfers are common here; the terminal fare is the airport fare plus $25 and is shown in the table.'],
    faq: [['How long from {S} to Brisbane Airport?', 'About {BNE_MIN} for {BNE_KM}.'],
          ['And to the cruise terminal?', 'Minutes further than the airport; the fare is the airport fare plus $25, shown above.'],
          ['Gold Coast Airport from {S}?', '{OOL_KM} via the Gateway and the M1, roughly {OOL_MIN}. {OOL_PRICING}']] },
  BE2: { region: 'Brisbane', label: 'the Redlands',
    notes: ['{S} is in the Redlands, the bayside band from Capalaba out to Cleveland and Redland Bay. Brisbane Airport is north on the Gateway Motorway, toll included, and outside peak it is a steady run; the Cleveland ferries to North Stradbroke Island mean a good share of our work here is island holidays with luggage.',
            'A Luxury Minivan or Sprinter takes the surfboards, the esky and everyone in one trip at one fixed price.'],
    faq: [['How long from {S} to Brisbane Airport?', 'About {BNE_MIN} for {BNE_KM} outside peak, Gateway toll included.'],
          ['Do you meet the ferry?', 'Yes. Tell us the sailing and we time the pick-up at the Cleveland terminal.'],
          ['Gold Coast Airport from {S}?', '{OOL_KM} via the Gateway and the M1, roughly {OOL_MIN}. {OOL_PRICING}']] },
  BS1: { region: 'Brisbane', label: 'the inner south',
    notes: ['{S} is in the inner-southern band \u2014 Coorparoo, Mount Gravatt, Annerley and around \u2014 with Brisbane Airport reached via the Gateway Motorway or the Clem7 and Airport Link tunnels, whichever is moving. Tolls are inside the fare either way.',
            'Griffith University, the Princess Alexandra and Mater hospitals and the Gabba all sit in or beside this band, so we see a lot of conference, medical and event travel; a tax invoice is issued on every trip.'],
    faq: [['How long from {S} to Brisbane Airport?', 'About {BNE_MIN} for {BNE_KM} outside peak.'],
          ['Are the tunnel tolls included?', 'Yes. Tolls and GST are inside the fixed fare on every Brisbane route.'],
          ['Gold Coast Airport from {S}?', '{OOL_KM} via the M1, roughly {OOL_MIN}. {OOL_PRICING}']] },
  BS2: { region: 'Brisbane', label: 'Sunnybank, Logan and the southern suburbs',
    notes: ['{S} is in the southern band from Sunnybank and Eight Mile Plains through Springwood and Logan Central to Loganholme, Marsden and Cornubia. Brisbane Airport is the Gateway Motorway north, toll included, and is the published fare; Gold Coast Airport is the Pacific Motorway south, and is a fixed fare as well, so both are priced in the table above. From here the two are closer in time than most people expect.',
            'The Sunnybank precinct and the Logan business parks generate steady corporate and family travel; accounts are available for regular bookers.'],
    faq: [['How long from {S} to Brisbane Airport?', 'About {BNE_MIN} for {BNE_KM} outside peak, Gateway toll included.'],
          ['How long from {S} to Gold Coast Airport?', 'About {OOL_MIN} for {OOL_KM} down the M1. {OOL_PRICING}'],
          ['Can I book a return in one go?', 'Book each leg with its own flight number; we track both and the fare is the same each way.']] },
  BS3: { region: 'Brisbane', label: 'Beenleigh, Waterford and the Logan River',
    notes: ['{S} sits in the Logan River band, where the Logan Motorway meets the M1 — Beenleigh and Eagleby on the river, Waterford and Bethania upstream, and the Park Ridge shelf to the west. Brisbane Airport is the published fare, north on the Logan Motorway and then the Gateway, tolls inside the fare. Gold Coast Airport is the M1 south, and is a fixed fare as well, so you can compare the two in the table above before you book the flight.',
            'This is the halfway mark between the two cities, which makes it the one part of Brisbane where the airport you fly from is worth a moment’s thought. Both distances are in the facts above, so you can compare before you book the flight rather than after.'],
    faq: [['How long from {S} to Brisbane Airport?', 'About {BNE_MIN} for {BNE_KM} outside peak, with the Logan and Gateway tolls already inside the fixed fare.'],
          ['Is Gold Coast Airport closer from {S}?', 'Often not far off it: {OOL_KM}, roughly {OOL_MIN} down the M1. {OOL_PRICING}'],
          ['Do you run to the Brisbane Cruise Terminal?', 'Yes, as a fixed door-to-ship fare from {S}. Choose Brisbane Cruise Terminal in the booking form for an instant price; we track ship arrivals and meet disembarking passengers with a name board.']] },
  BS4: { region: 'Brisbane', label: 'Logan Village, Jimboomba and the rural south',
    notes: ['{S} is in Logan’s rural south — the belt running from Greenbank and Munruben out through Logan Village, Yarrabilba, Flagstone and Jimboomba. Brisbane Airport is the published fare: local roads out to the Logan Motorway, then the Gateway, tolls included. Gold Coast Airport is a fixed fare too, so both are in the table above.',
            'Addresses out here are often acreage, and a driveway can be a few hundred metres of gravel behind a gate. Type the street address when you book and add the gate code in the notes — the form resolves the address to the suburb for pricing and keeps the exact address for your chauffeur. We also suggest a slightly earlier pick-up than the raw drive time implies, because the first stretch of this trip is country road rather than motorway.'],
    faq: [['How long from {S} to Brisbane Airport?', 'About {BNE_MIN} for {BNE_KM} outside peak. Tolls and GST are inside the fixed fare, and the same price applies at 4am.'],
          ['Gold Coast Airport from {S}?', '{OOL_KM}, roughly {OOL_MIN}. {OOL_PRICING}'],
          ['Will a Sprinter get down an acreage driveway?', 'Usually, and we carry school, club and conference groups out here regularly. Tell us if the driveway is steep, narrow or unsealed and we will send the right vehicle or meet you at the gate.']] },
  BW1: { region: 'Brisbane', label: 'the inner west',
    notes: ['{S} is in the inner-western band \u2014 Toowong, Indooroopilly, Ashgrove, The Gap and around the University of Queensland at St Lucia. Brisbane Airport is reached via Legacy Way, the Inner City Bypass and the Airport Link tunnel, with all tolls inside the fare.',
            'University terms, conferences at UQ and the Wesley hospital keep this band busy with travellers who need a receipt: a GST tax invoice is emailed with every booking.'],
    faq: [['How long from {S} to Brisbane Airport?', 'About {BNE_MIN} for {BNE_KM} outside peak.'],
          ['Are the tunnel tolls extra?', 'No. Legacy Way and Airport Link tolls are inside the fixed fare.'],
          ['Gold Coast Airport from {S}?', '{OOL_KM}, roughly {OOL_MIN} via the M1. {OOL_PRICING}']] },
  BW2: { region: 'Brisbane', label: 'the Centenary suburbs',
    notes: ['{S} is in the Centenary band \u2014 Jindalee, Mount Ommaney, Forest Lake, Richlands \u2014 with the Centenary Motorway as the spine. Brisbane Airport is the Centenary north to Legacy Way and the Airport Link, or the Ipswich and Gateway motorways, and the tolls are inside the fare on either route.',
            'Because two routes work, the driver chooses on the day by traffic, which is one of the reasons the fare is fixed rather than metered.'],
    faq: [['How long from {S} to Brisbane Airport?', 'About {BNE_MIN} for {BNE_KM} outside peak, tolls included.'],
          ['Gold Coast Airport from {S}?', '{OOL_KM} via the Logan and Pacific motorways, roughly {OOL_MIN}. {OOL_PRICING}'],
          ['Is a Sunday fare the same?', 'Yes. Weekday, weekend and public holiday fares are identical.']] },
  BW3: { region: 'Brisbane', label: 'Springfield, Goodna and the Ipswich Motorway corridor',
    notes: ['{S} is on the corridor between Brisbane and Ipswich that includes Springfield, Goodna and Redbank. Brisbane Airport is the Ipswich Motorway or the Centenary Motorway, then the Gateway or Legacy Way and the Airport Link \u2014 tolls inside the fare on every variant. It is a run of well over half an hour, and the fare band reflects the distance honestly.',
            'Springfield Central\u2019s offices and the Orion precinct generate corporate travel here; monthly accounts and tax invoices are standard.'],
    faq: [['How long from {S} to Brisbane Airport?', 'About {BNE_MIN} for {BNE_KM} outside peak. Tolls are inside the fare.'],
          ['Do you do early pick-ups this far out?', 'Yes, at the same fare, any hour.'],
          ['Gold Coast Airport from {S}?', '{OOL_KM} via the Logan and Pacific motorways, roughly {OOL_MIN}. {OOL_PRICING}']] },
  BW4: { region: 'Brisbane', label: 'Ipswich',
    notes: ['{S} is in the Ipswich city band. Brisbane Airport is the Ipswich Motorway to the Gateway, or the Warrego and Centenary motorways to Legacy Way and the Airport Link, depending on the hour; both are toll roads and the tolls are inside the fare. Until recently most of Ipswich was not priced online at all, which is why you may have been told to phone for a quote \u2014 the table above is now the answer.',
            'RAAF Base Amberley and the Ipswich hospitals sit at the edge of this band, and a good share of the bookings are defence and medical travel with firm times. We track every flight.'],
    faq: [['How long from {S} to Brisbane Airport?', 'About {BNE_MIN} for {BNE_KM} outside peak. Tolls included.'],
          ['Is the fare the same at 4am?', 'Yes. No after-hours loading.'],
          ['Gold Coast Airport from {S}?', '{OOL_KM} via the Logan Motorway and the M1, roughly {OOL_MIN}. {OOL_PRICING}']] },
  BW5: { region: 'Brisbane', label: 'the western Ipswich towns',
    notes: ['{S} is in the band of towns west of Ipswich \u2014 Rosewood, Walloon, Marburg, Amberley \u2014 which is the furthest Brisbane-priced band we publish. The run to Brisbane Airport is the Warrego Highway to Ipswich and then the motorways to the Gateway or Airport Link, tolls included. Allow the full time; there is no fast way around Ipswich in the morning peak.',
            'Because it is a long trip, the fixed fare is the point: you know the whole price before you leave, however long the drive takes.'],
    faq: [['How long from {S} to Brisbane Airport?', 'About {BNE_MIN} for {BNE_KM} outside peak. Tolls included.'],
          ['Do you cover rural addresses?', 'Yes. Type the street address when booking; the driver gets it exactly, and a note about gates or unsealed roads helps.'],
          ['Gold Coast Airport from {S}?', '{OOL_KM}, roughly {OOL_MIN}. It is a long run, so allow extra time. {OOL_PRICING}']] },

  // regional, keyed by LD zone
  SC1: { region: 'Sunshine Coast', label: 'Caloundra and the southern Sunshine Coast',
    notes: ['{S} is at the southern end of the Sunshine Coast, around Caloundra and Kawana. Brisbane Airport is the Bruce Highway south and then the Gateway Motorway, toll included \u2014 a highway run of well over an hour, and the fare is a fixed regional band rather than a metered trip.',
            'Sunshine Coast Airport at Marcoola is the local alternative for some routes; for anything international, BNE is the usual choice and this is the fare for it.'],
    faq: [['How long from {S} to Brisbane Airport?', 'About {BNE_MIN} for {BNE_KM} outside peak. The Gateway toll is inside the fare.'],
          ['Do you allow for Bruce Highway delays?', 'We recommend a pick-up time with a margin for the highway and confirm it with you; on arrivals we track the flight.'],
          ['Can a group travel together?', 'Up to 14 in a Sprinter with 15 bags, one fixed price for the vehicle.']] },
  SC2: { region: 'Sunshine Coast', label: 'Maroochydore, Mooloolaba and Buderim',
    notes: ['{S} is in the central Sunshine Coast band \u2014 Maroochydore, Mooloolaba, Buderim and the airport at Marcoola. Brisbane Airport is the Sunshine Motorway and the Bruce Highway south, then the Gateway, toll included. It is the busiest regional run we do, mostly for international flights that do not serve Sunshine Coast Airport.',
            'The fare is fixed per vehicle, so a family or a group pays one price for the trip, and the Sprinter takes the surfboards.'],
    faq: [['How long from {S} to Brisbane Airport?', 'About {BNE_MIN} for {BNE_KM} outside peak, Gateway toll included.'],
          ['Why not fly from Sunshine Coast Airport?', 'For many routes you can, and it is minutes away. For international departures and most early flights, Brisbane is the option, and this is the fare.'],
          ['Is there a surcharge for early or late trips?', 'No. The published fare applies at any hour.']] },
  SC3: { region: 'Sunshine Coast', label: 'Coolum, Peregian and Twin Waters',
    notes: ['{S} is on the coast north of the Sunshine Coast Airport, between Marcoola and Peregian. Brisbane Airport is the Sunshine Motorway, then the Bruce Highway south and the Gateway, toll included. Allow the full time; the Bruce is a working highway and we build a margin into the recommended pick-up.',
            'Resort check-outs are the main job here, and a name board inside the terminal on the way back.'],
    faq: [['How long from {S} to Brisbane Airport?', 'About {BNE_MIN} for {BNE_KM} outside peak. Toll included.'],
          ['Do you pick up from resorts?', 'Yes \u2014 tell us the resort and the driver will be at reception or the porte-coch\u00e8re.'],
          ['Do you track the flight home?', 'Yes, and airport pick-ups include 30 minutes free waiting after landing, 60 for international.']] },
  SC4: { region: 'Sunshine Coast', label: 'Noosa',
    notes: ['{S} is in the Noosa band \u2014 Noosa Heads, Noosaville, Sunshine Beach, Tewantin and out to Eumundi. Brisbane Airport is the longest Sunshine Coast run we publish: the Sunshine Motorway or the Eumundi road to the Bruce Highway, then the Bruce south and the Gateway, toll included, around two hours outside peak.',
            'Most Noosa bookings are holiday check-ins and check-outs, often for a family or a group, which is exactly where a fixed per-vehicle fare beats two rideshares and a wait.'],
    faq: [['How long from {S} to Brisbane Airport?', 'About {BNE_MIN} for {BNE_KM} outside peak. Toll included.'],
          ['How early should we be collected for an international flight?', 'Work back from check-in cut-off and add a highway margin; we confirm a recommended time with the booking.'],
          ['Can you carry surfboards and golf bags?', 'Yes. A Luxury Minivan or Sprinter takes them without a trailer; a trailer is available for $30 if needed.']] },
  AZ: { region: 'Sunshine Coast', label: 'Beerwah and Australia Zoo',
    notes: ['{S} is in the Sunshine Coast hinterland under the Glass House Mountains, and it is where Australia Zoo is. Brisbane Airport is {BNE_KM} away, about {BNE_MIN}: the Bruce Highway north and the Steve Irwin Way, with the Gateway toll inside the fare. Gold Coast Airport is the long way round, {OOL_KM} and about {OOL_MIN}, through Brisbane on the motorways.',
            'Most trips here are to or from the zoo. From a Brisbane hotel the fare is the same as from Brisbane Airport, from anywhere on the Gold Coast it is the same as from Gold Coast Airport, and the Sunshine Coast beaches are short point-to-point runs \u2014 all of them priced in the booking form.'],
    faq: [['How long from Brisbane Airport to {S}?', 'About {BNE_MIN} for {BNE_KM} outside peak, toll included in the fare.'],
          ['Can you take us to Australia Zoo and back on the same day?', 'Yes. Book the drop-off and the pick-up as one return booking and the pair is 10% cheaper. If you would rather keep the car all day, see the Glass House Mountains, Australia Zoo and Maleny day tour.'],
          ['Do you include zoo tickets?', 'No \u2014 we are the transport only. Buy entry from Australia Zoo.']] },
  TWB: { region: 'Toowoomba', label: 'Toowoomba',
    notes: ['{S} is in Toowoomba, at the top of the Great Dividing Range. Brisbane Airport is the Warrego Highway down the range and across the Lockyer Valley to Ipswich, then the motorways to the Gateway or Airport Link \u2014 tolls included \u2014 in roughly two hours outside peak. The Toowoomba Bypass takes the trucks off the range road, but we still allow for fog on the range on winter mornings.',
            'It is a long enough trip that the vehicle matters: the sedan is the published entry fare, and the Luxury Minivan is the comfortable choice for a family with luggage.'],
    faq: [['How long from {S} to Brisbane Airport?', 'About {BNE_MIN} for {BNE_KM} outside peak. Tolls included.'],
          ['Do you do very early pick-ups from Toowoomba?', 'Yes, at the same fare. Early departures from Brisbane are the bulk of the Toowoomba work.'],
          ['Is Wellcamp an option?', 'For a handful of routes, yes \u2014 but Brisbane has the schedule, and this is the fixed fare for it.']] },
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
  for (const name of BM_ZONE[z]) {
    /* 252 of the 274 have a fixed OOL fare. The far north (Caboolture, Bribie,
       Grandchester) is still quoted by hand and simply gets no fares.ool, which
       airportsFor() already handles by omitting the Gold Coast table. */
    const f = { bne, cruise: plus(bne, CRUISE_EXTRA) };
    const om = BM_OOL_SUBURB[name];
    if (om) f.ool = BM_OOL_RATES[om];
    add(name, z, f, 'Brisbane', 'BNE');
  }
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
/* Google truncates a snippet at roughly 155-160 characters. These are built up
   clause by clause in order of value and stopped before the cut, rather than
   written long and chopped mid-sentence - so whatever survives is a whole
   thought, and the suburb, the airport and the price are always in it. */
/* Google shows roughly 60 characters of a title. Variants are listed richest
   first and the first that fits wins, so a short suburb keeps the fare framing
   and only the handful of very long names fall back to the terser form.
   The brand is deliberately absent from deep pages: it was costing 16
   characters on 450 of them, and Google appends the site name itself. */
const fitTitle = (variants, limit = 60) =>
  variants.find((v) => v.length <= limit) || variants[variants.length - 1];

function metaDesc(parts, limit = 158) {
  let out = '';
  for (const part of parts) {
    if (!part) continue;
    const next = out ? out + ' ' + part : part;
    /* Skip rather than stop: a clause that does not fit should not cost the
       shorter ones behind it. Each clause stands alone, so dropping one out
       of the middle still reads properly. */
    if (next.length > limit) continue;
    out = next;
  }
  return out;
}
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
    .replace(/\{BNE_KM_GC_NOTE\}/g, d('ool', 'm') ? km(d('ool', 'm')) + ' down ' : '')
    /* Fare zones straddle the OOL bands, so whether a Gold Coast fare exists is
       a per-suburb fact, not a per-zone one: BW5 holds ten priced suburbs and
       Grandchester, which is not. One placeholder, resolved per page. */
    .replace(/\{OOL_PRICING\}/g, p.fares.ool
      ? 'The fare is fixed and shown above, the same price at any hour with no surge.'
      : 'That run is quoted on request: call or WhatsApp us with the date and we fix the price before you book.');
}

const NAV = `<nav class="sitenav">
  <div class="sitenav-in">
    <a class="logo" href="/#top" aria-label="Sky Transfers home"><img src="/logo.png" alt="Sky Transfers" width="318" height="160" style="height:42px;width:auto;display:block"></a>
    <div class="navlinks">
      <a href="/#book">Book</a>
      <a href="/fleet.html">Fleet</a>
      <a href="/prices.html">Prices</a>
      <a href="/#faq">FAQ</a>
      <a href="/partners.html">Partners</a>
      <a href="/charters.html">Charters</a>
      <a href="/blog/">Blog</a>
      <a class="navwa" href="https://wa.me/61481437772?text=Hi%2C%20can%20I%20get%20a%20quote%20please%3F" target="_blank" rel="noopener" aria-label="Get a quote on WhatsApp"><span class="wa-l">Get a quote on </span>WhatsApp</a>
      <a class="navcall" href="tel:+61481437772">+61 481 437 772</a>
    </div>
  </div>
</nav>`;

const FOOTER = `<footer class="site">
  <div class="foot-in">
    <div>
      <img src="/logo.png" alt="Sky Transfers" width="318" height="160" loading="lazy" decoding="async" style="height:38px;width:auto;display:block;margin-bottom:8px">
      <p>Gold Coast &amp; Brisbane airport transfers, tours and charters.</p>
      <p>24 hours, 7 days.</p>
    </div>
    <div>
      <p><a href="tel:+61481437772">+61 481 437 772</a></p>
      <p><a href="https://wa.me/61481437772?text=Hi%20Sky%20Transfers%2C%20I%27d%20like%20a%20quote%20for%20an%20airport%20transfer." target="_blank" rel="noopener">WhatsApp us</a></p>
      <p><a href="mailto:info@skytransfers.com.au">info@skytransfers.com.au</a></p>
      <p><a href="https://www.skytransfers.com.au/">Sky Transfers home</a></p>
    </div>
    <div>
      <p><a href="/#book">Book a transfer</a></p>
      <p><a href="/prices.html">Prices by suburb</a></p>
      <p><a href="/blog/">Blog &amp; travel guides</a></p>
      <p><a href="/partners.html">Agent &amp; partner program</a></p>
      <p><a href="/faq.html">Questions &amp; answers</a></p>
      <p><a href="/child-seats.html">Child seats</a></p>
      <p><a href="/rideshare-or-transfer.html">Rideshare or transfer?</a></p>
      <p><a href="/chauffeur-service.html">Chauffeur service</a></p>
      <p><a href="/cheapest-gold-coast-to-brisbane-airport.html">Cheapest way to Brisbane Airport</a></p>
      <p><a href="/brisbane-or-gold-coast-airport.html">Brisbane or Gold Coast Airport?</a></p>
      <p><a href="https://www.google.com/maps?cid=9657905201752242057" target="_blank" rel="noopener">Review us on Google</a></p>
    </div>
    <div class="foot-routes">
      <p><a href="/gold-coast-airport-transfers.html">Gold Coast Airport transfers</a></p>
      <p><a href="/brisbane-airport-transfers.html">Brisbane Airport transfers</a></p>
      <p><a href="/brisbane-airport-to-gold-coast.html">Brisbane Airport to Gold Coast</a></p>
      <p><a href="/gold-coast-airport-to-surfers-paradise.html">Airport to Surfers Paradise</a></p>
      <p><a href="/point-to-point-transfers.html">Point-to-point transfers</a></p>
      <p><a href="/theme-park-transfers.html">Theme park transfers</a></p>
      <p><a href="/cruise-transfers.html">Brisbane Cruise Terminal</a></p>
      <p><a href="/byron-bay-transfers.html">Byron Bay transfers</a></p>
      <p><a href="/sunshine-coast-airport-transfers.html">Sunshine Coast transfers</a></p>
      <p><a href="/toowoomba-airport-transfers.html">Toowoomba transfers</a></p>
      <p><a href="/ipswich-airport-transfers.html">Ipswich transfers</a></p>
      <p><a href="/logan-airport-transfers.html">Logan transfers</a></p>
      <p><a href="/${DIR}/">Airport transfers by suburb</a></p>
    </div>
    <div class="foot-routes">
      <p><a href="/corporate-transfers.html">Corporate transfers</a></p>
      <p><a href="/wedding-transfers.html">Wedding transfers</a></p>
      <p><a href="/event-transfers.html">Event transfers</a></p>
      <p><a href="/christmas-party-transport-gold-coast.html">Christmas party transport</a></p>
      <p><a href="/minibus-hire-gold-coast.html">Minibus hire Gold Coast</a></p>
      <p><a href="/minibus-hire-brisbane.html">Minibus hire Brisbane</a></p>
      <p><a href="/charters.html">Sprinter &amp; coach charters</a></p>
      <p><a href="/funeral-transport.html">Funeral transport</a></p>
      <p><a href="/gallery.html">Vehicle photo gallery</a></p>
    </div>
    <div class="foot-legal">
      <p><a href="/about.html">About us</a></p>
      <p><a href="/contact.html">Contact us</a></p>
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
      /* a phone or WhatsApp tap is also a Google Ads conversion (26 Oct 2026) */
      var ads = { contact_phone: "AW-18399667511/iNX7CNuTsagdELfK0sVE", contact_whatsapp: "AW-18399667511/oZaJCN6TsagdELfK0sVE" }[event];
      if (ads && typeof window.gtag === "function") window.gtag("event", "conversion", { send_to: ads, value: 1.0, currency: "AUD" });
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

/* Photo behind every generated page's header (23 Oct 2026): the coast at dusk
   for the Gold Coast and Sunshine Coast, the hinterland road for the hinterland
   and Toowoomba, the river city for Brisbane, Logan and Ipswich. */
function heroImg(region, zoneKey) {
  if (zoneKey === 'H' || /Toowoomba/.test(region || '')) return 'ch-hero-dusk';
  if (/Gold Coast|Sunshine|Byron|Tweed/.test(region || '')) return 'st-hero-dusk';
  return 'hero-city';
}
const HERO_ALT = {
  'hero-airport': 'A black chauffeur car waiting outside an airport terminal at dusk',
  'hero-city': 'A black sedan crossing a bridge in front of a city skyline at dusk',
  'hero-motorway': 'A black sedan on a coastal motorway at sunset',
  'hero-wedding': 'A black people mover with a white ribbon outside a wedding marquee',
  'hero-corporate': 'A chauffeur holding the door of a black executive car outside an office tower',
  'hero-cruise': 'A black people mover on the quay beside a docked cruise ship at dawn',
  'hero-family': 'A parent fitting a child seat in the back of a black SUV',
  'st-hero-dusk': 'A black people mover on a palm-lined beachfront road at dusk',
  'ch-hero-dusk': 'A black Mercedes Sprinter on a hinterland road at golden hour'
};
function heroBg(name) {
  return '<div class="hero-bg"><picture><source type="image/webp" srcset="/img/' + name + '-640.webp 640w, /img/' + name + '-1024.webp 1024w, /img/' + name + '-1536.webp 1536w" sizes="100vw"><img src="/img/' + name + '.jpg" width="1536" height="1024" alt="' + (HERO_ALT[name] || '') + '" fetchpriority="high" decoding="async"></picture></div>';
}

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
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${SITE}/logo.png">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<!-- Google tag (gtag.js) \u2014 Google Ads AW-18399667511 and GA4 G-9LYFELNSBK. -->
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
<link rel="stylesheet" href="/site.css?v=20261102">
<link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Marcellus&family=Figtree:wght@400;500;600;700&display=swap" onload="this.onload=null;this.rel='stylesheet'">
<noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Marcellus&family=Figtree:wght@400;500;600;700&display=swap"></noscript>
</head>
<body>
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

/* Recheck 7 (2 Nov 2026): neighbours used to be the first eight of the fare
   band, so those eight collected every "nearby" link and 59 pages had only
   the suburb index linking in. Now: the six nearest in the band, measured by
   road distance to the two airports (close enough to place a suburb inside
   one band), and any page nobody picked is added to its nearest neighbour's
   list, so every page in a band of two or more has a neighbour linking in. */
const NEIGHBOURS = new Map();
function buildNeighbours() {
  const at = (p) => [p.facts && p.facts.bne && p.facts.bne.m, p.facts && p.facts.ool && p.facts.ool.m];
  const dist = (a, b) => {
    const x = at(a), y = at(b);
    let d = 0, n = 0;
    for (let i = 0; i < 2; i++) if (x[i] != null && y[i] != null) { d += (x[i] - y[i]) ** 2; n++; }
    return n ? Math.sqrt(d / n) : Infinity;
  };
  const nearest = (p, list) => list.filter(q => q !== p).map(q => [q, dist(p, q)])
    .sort((a, b) => (a[1] - b[1]) || a[0].name.localeCompare(b[0].name)).map(x => x[0]);
  const bands = {};
  for (const p of places) (bands[p.region + '|' + p.zoneKey] = bands[p.region + '|' + p.zoneKey] || []).push(p);
  for (const list of Object.values(bands)) {
    for (const p of list) NEIGHBOURS.set(p, nearest(p, list).slice(0, 6));
    const linked = new Set(list.flatMap(p => NEIGHBOURS.get(p)));
    for (const p of list) if (list.length > 1 && !linked.has(p)) NEIGHBOURS.get(nearest(p, list)[0]).push(p);
  }
}
/* the region page a suburb belongs to, if any (Logan, Sunshine Coast, Toowoomba, Ipswich) */
const hubFor = (p) => REGIONS.find(r => r.zones.includes(p.zoneKey) && (!r.only || r.only.includes(p.name)));
/* Pages that cover the same place from another angle (Recheck 7 section 7,
   items 8, 9 and 12): the hand-written guide for the suburb, the CBD route
   page, and the attractions people from here ask about. Linked from the body
   so neither page of a pair is only reachable through the footer. */
const CBD_GUIDE = ['/brisbane-cbd-airport-transfers.html', 'Brisbane CBD airport transfers'];
/* Attractions people staying nearby ask about (10 Nov 2026). Until now an
   attraction was linked only from the one suburb it stands in, so seven pages
   had eight to ten links each from a site of 500. Nearest first; a name that
   is not a priced suburb is simply never matched. */
const NEAR_ATTRACTIONS = {
  'movie-world-transfers': ['Helensvale', 'Pacific Pines', 'Hope Island', 'Coomera', 'Upper Coomera', 'Gaven', 'Maudsland', 'Sanctuary Cove', 'Arundel', 'Parkwood', 'Southport', 'Labrador', 'Runaway Bay', 'Paradise Point', 'Main Beach', 'Broadbeach', 'Nerang'],
  'dreamworld-transfers': ['Upper Coomera', 'Oxenford', 'Pimpama', 'Helensvale', 'Hope Island', 'Willow Vale', 'Ormeau', 'Pacific Pines', 'Sanctuary Cove', 'Surfers Paradise', 'Main Beach', 'Broadbeach'],
  'sea-world-transfers': ['Southport', 'Labrador', 'Bundall', 'Benowa', 'Broadbeach', 'Ashmore', 'Biggera Waters', 'Runaway Bay', 'Molendinar'],
  'currumbin-wildlife-sanctuary-transfers': ['Tugun', 'Palm Beach', 'Elanora', 'Currumbin Waters', 'Currumbin Valley', 'Bilinga', 'Coolangatta', 'Kirra', 'Burleigh Heads', 'Burleigh Waters', 'Tallebudgera', 'Miami'],
  'gold-coast-convention-centre-transfers': ['Broadbeach Waters', 'Mermaid Beach', 'Mermaid Waters', 'Main Beach', 'Miami', 'Bundall', 'Clear Island Waters', 'Burleigh Heads'],
  'lone-pine-koala-sanctuary-transfers': ['Indooroopilly', 'Kenmore', 'Chapel Hill', 'Jindalee', 'Sherwood', 'Graceville', 'Corinda', 'Taringa', 'Toowong', 'St Lucia', 'Mount Ommaney', 'South Brisbane', 'Fortitude Valley', 'Spring Hill', 'West End', 'Milton', 'Auchenflower'],
  'australia-zoo-transfers': ['Caloundra', 'Golden Beach', 'Pelican Waters', 'Currimundi', 'Wurtulla', 'Mooloolaba', 'Alexandra Headland', 'Maroochydore', 'Mountain Creek', 'Buderim', 'Sippy Downs', 'Caboolture', 'Morayfield', 'Burpengary', 'Narangba', 'Noosa Heads', 'Noosaville', 'Coolum Beach', 'Brisbane CBD', 'South Brisbane'],
};
/* The private day tour leaves from Brisbane or the Gold Coast hotel strip. */
const TOUR_NEAR = ['Brisbane CBD', 'South Brisbane', 'Fortitude Valley', 'Spring Hill', 'Surfers Paradise', 'Broadbeach', 'Main Beach', 'Southport', 'Beerwah'];
const SUBURB_EXTRA = {
  'Broadbeach': [['/broadbeach-airport-transfers.html', 'Broadbeach airport transfer guide'], ['/gold-coast-convention-centre-transfers.html', 'Gold Coast Convention Centre transfers']],
  'Main Beach': [['/main-beach-airport-transfers.html', 'Main Beach airport transfer guide']],
  'Burleigh Heads': [['/burleigh-heads-airport-transfers.html', 'Burleigh Heads airport transfer guide']],
  'Coolangatta': [['/coolangatta-airport-transfers.html', 'Coolangatta airport transfer guide']],
  'Surfers Paradise': [
    ['/gold-coast-airport-to-surfers-paradise.html', 'Gold Coast Airport to Surfers Paradise guide'],
    ['/theme-park-transfers.html', 'Gold Coast theme park transfers'],
    ['/sea-world-transfers.html', 'Sea World transfers'],
    ['/movie-world-transfers.html', 'Movie World transfers'],
    ['/gold-coast-convention-centre-transfers.html', 'Convention Centre transfers'],
  ],
  'Brisbane CBD': [CBD_GUIDE, ['/lone-pine-koala-sanctuary-transfers.html', 'Lone Pine Koala Sanctuary transfers']],
  'Fortitude Valley': [CBD_GUIDE],
  'South Brisbane': [CBD_GUIDE],
  'Spring Hill': [CBD_GUIDE],
};

function suburbPage(p) {
  const z = Z[p.zoneKey];
  const air = airportsFor(p);
  const primary = air[0];
  const ctaHref = '/?pu=' + encodeURIComponent(p.name) + '&do=' + encodeURIComponent(primary.place) + '#book';
  const state = p.region === 'Byron Bay' ? 'NSW' : 'QLD';
  const f = p.facts;

  /* A few destinations are airports themselves, where "X Airport Airport
     Transfers" reads like a stutter. */
  const isAirport = /\bAirport\b/.test(p.name);
  /* Titles follow how people actually search: "coomera to brisbane airport",
     not "coomera airport transfers" (Search Console, Aug-Oct 2026: "X to
     Brisbane Airport" drew 20x the impressions of "X to Gold Coast Airport").
     So Brisbane Airport is named first, except around Byron Bay, where the
     Gold Coast is the airport people mean. */
  const named = (p.region === 'Byron Bay' || air.length < 2) ? air : air.slice().sort((a, b) => (a.key === 'bne' ? -1 : 1) - (b.key === 'bne' ? -1 : 1));
  const shortAir = named.length > 1 ? named.map(a => a.name.replace(/ Airport$/, '')).join(' & ') + ' Airport' : named[0].name;
  const fullAir = named.map(a => a.name).join(' & ');
  const title = fitTitle(isAirport ? [
    `Transfers to ${p.name} | Fixed Price from $${p.from}`,
    `Transfers to ${p.name} | From $${p.from}`,
    `Transfers to ${p.name}`,
  ] : [
    named.length > 1 ? `${p.name} to ${fullAir} | From $${p.from}` : `${p.name} to ${fullAir} Transfers | From $${p.from}`,
    `${p.name} to ${fullAir} | From $${p.from}`,
    `${p.name} to ${shortAir} | From $${p.from}`,
    named.length > 1 ? `${p.name} to ${named.map(a => a.code).join(' & ')} Airport | From $${p.from}` : `${p.name} to ${named[0].code} | From $${p.from}`,
    `${p.name} to ${shortAir}`,
    `${p.name} Airport Transfers`,
  ]);
  const desc = metaDesc([
    isAirport ? `${p.name} to ${primary.name} (${primary.code}) from $${p.from} per vehicle.`
      : `${p.name} to ` + named.map(a => `${a.name} from $${a.fares[0]}`).join(', ') + (named.length > 1 ? ',' : '') + ' per vehicle.',
    'Fixed price, GST and tolls included.',
    'Flight tracked, meet and greet.',
    air.length > 1 ? `${air[1].name} (${air[1].code}) priced too.` : '',
    '24/7.',
  ]);

  // fares table: one row per vehicle, one column per airport (+ cruise terminal if BNE priced)
  const cols = air.map(a => a.name + ' (' + a.code + ')');
  if (p.fares.cruise) cols.push('Brisbane Cruise Terminal');
  const rows = VEH_T.map((v, i) => {
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
  if (!NEIGHBOURS.size) buildNeighbours();
  const neighbours = NEIGHBOURS.get(p) || [];
  const hub = hubFor(p);
  const extra = SUBURB_EXTRA[p.name] || [];

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

<header class="fares-hero photo" id="top">
  ${heroBg(heroImg(p.region, p.zoneKey))}
  <div class="hero-in">
  <h1>${isAirport ? `Transfers to ${esc(p.name)}` : `${esc(p.name)} to ${named.map(a => esc(a.name)).join(' and ')}`}, fixed price</h1>
  <p>
    Private chauffeur transfers between ${esc(p.name)} and ${air.map(a => esc(a.name)).join(' or ')},
    priced per vehicle and published below. From $${p.from} one way, GST and tolls included, at any hour.
  </p>
  <a class="cta-gold" href="${ctaHref}">Book ${esc(p.name)} to ${esc(primary.code)}</a>
  </div>
</header>

<div class="lp">

  <div class="facts">
    <div class="fact"><span class="k">From</span><span class="v">$${p.from}</span><span class="s">Sedan, one way, to ${esc(primary.code)}</span></div>
    ${nearestFact}
    <div class="fact"><span class="k">Vehicles</span><span class="v">1&ndash;18</span><span class="s">Sedan to 18-seat Sprinter</span></div>
    <div class="fact"><span class="k">Changes</span><span class="v">Free</span><span class="s">Up to 24 hours before pick-up</span></div>
  </div>

  <h2>What it costs from ${esc(p.name)}</h2>
  <p>
    These are the fares the booking form quotes for ${esc(p.name)} \u2014 not &ldquo;from&rdquo; prices. One way,
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
    <strong>Coming back as well?</strong> Book the return in the same booking and the whole trip
    is 10% cheaper &mdash; $${p.from} each way is <strong>$${returnFare(p.from)} return</strong>
    instead of $${p.from * 2}. Tick &ldquo;coming back as well&rdquo; in the
    <a href="${ctaHref}">booking form</a> and the return price shows on every vehicle.
  </p>
  <p class="fare-note">
    Included: meet &amp; greet with a name board, flight tracking, 30 minutes&rsquo; free airport waiting
    (60 for international arrivals). Child seats $15 each, luggage trailer $30.
    The cruise terminal fare is the Brisbane Airport fare plus $25.
    More than 18? Our 53-seat coach is quoted per job —
    see <a href="/charters.html">charters</a>.
  </p>

  ${extra.length ? `<p class="fare-note">
    More for ${esc(p.name)}: ${extra.map(([h, t]) => `<a href="${h}">${esc(t)}</a>`).join(' &middot; ')}.
  </p>

  ` : ''}<h2>The drive from ${esc(p.name)}</h2>
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

  ${(() => { const here = ATTRACTIONS.filter(x => x.suburb === p.name);
    const already = (SUBURB_EXTRA[p.name] || []).map(x => x[0]);
    const near = ATTRACTIONS.filter(x => x.suburb !== p.name && (NEAR_ATTRACTIONS[x.slug] || []).indexOf(p.name) !== -1 && already.indexOf('/' + x.slug + '.html') === -1)
      .sort((x, y) => NEAR_ATTRACTIONS[x.slug].indexOf(p.name) - NEAR_ATTRACTIONS[y.slug].indexOf(p.name)).slice(0, 3);
    const tours = TOUR_NEAR.indexOf(p.name) !== -1 ? TOURS : [];
    return here.length || near.length || tours.length ? `<h2>${here.length ? `Visiting ${here.map(x => esc(x.visit || x.name)).join(' or ')}?` : `Attractions near ${esc(p.name)}`}</h2>
  <div class="related">
${here.map(x => `    <a href="/${x.slug}.html">${esc(x.name)} transfers<span>From the airports and the hotel strip</span></a>`)
  .concat(near.map(x => `    <a href="/${x.slug}.html">${esc(x.name)} transfers<span>${esc(x.suburb)} &middot; fixed price from your door</span></a>`))
  .concat(tours.map(t => `    <a href="/${t.slug}.html">${esc(t.name)} day tour<span>Private car and chauffeur for the day</span></a>`)).join('\n')}
  </div>
  ` : ''; })()}${neighbours.length ? `<h2>Nearby, same fare band</h2>
  <div class="related">
${neighbours.map(q => `    <a href="${q.url}">${esc(q.name)}<span>From $${q.from}</span></a>`).join('\n')}
  </div>` : ''}
  ${hub ? `<p class="fare-note">Part of our <a href="/${hub.slug}.html">${esc(hub.name)} airport transfers</a> area.</p>` : ''}
  <!--guides:auto--><!--/guides:auto-->
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
    ['Brisbane', ['CBD', 'BN1', 'BN2', 'BN3', 'BN4', 'BE1', 'BE2', 'BS1', 'BS2', 'BS3', 'BS4', 'BW1', 'BW2', 'BW3', 'BW4', 'BW5']],
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

  const title = `Airport Transfers by Suburb | ${places.length} Fixed Fares`;
  const desc = 'Every suburb we price to Gold Coast (OOL) and Brisbane (BNE) airports, with the fare, the measured drive time and a booking link for each. Fixed fares.';
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

<header class="fares-hero photo" id="top">
  ${heroBg('hero-airport')}
  <div class="hero-in">
  <h1>Airport transfers by suburb</h1>
  <p>
    ${places.length} suburbs, each with its own page: the fixed fare for every vehicle to each airport,
    the measured drive time, and a booking link that lands with the suburb already filled in.
  </p>
  <a class="cta-gold" href="/#book">Get a fixed price now</a>
  </div>
</header>

<div class="lp">
  <p>
    Fares are per vehicle, one way, GST inclusive, and the same at any hour. Brisbane Airport fares include
    the Gateway toll. <strong>Booking a return takes 10% off the whole trip.</strong>
    If your suburb is not here, it is still likely we serve it &mdash;
    <a href="/#book">type the address into the booking form</a> or call
    <a href="tel:+61481437772">+61 481 437 772</a>.
  </p>
  <p class="fare-note">
    By region: <a href="/gold-coast-airport-transfers.html">Gold Coast</a> &middot;
    <a href="/brisbane-airport-transfers.html">Brisbane</a> &middot;
    <a href="/logan-airport-transfers.html">Logan</a> &middot;
    <a href="/ipswich-airport-transfers.html">Ipswich</a> &middot;
    <a href="/sunshine-coast-airport-transfers.html">Sunshine Coast</a> &middot;
    <a href="/toowoomba-airport-transfers.html">Toowoomba</a> &middot;
    <a href="/byron-bay-transfers.html">Byron Bay</a>
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
// region pages: one landing page per region that had none. Gold Coast,
// Brisbane and Byron Bay already have hand-written pages; these three cover
// the fare bands that were only reachable through the price list.
// ---------------------------------------------------------------------------
/* Logan City Council's 59 localities, which is not the same set as any one fare
   zone: BS2 also holds nine Brisbane City suburbs (Sunnybank through Parkinson)
   that have no business on a Logan page, while BS3 and BS4 are entirely Logan. */
const LOGAN = [
  'Bahrs Scrub', 'Bannockburn', 'Beenleigh', 'Belivah', 'Berrinba', 'Bethania', 'Boronia Heights',
  'Browns Plains', 'Buccan', 'Carbrook', 'Cedar Creek', 'Cedar Grove', 'Cedar Vale', 'Chambers Flat',
  'Cornubia', 'Crestmead', 'Daisy Hill', 'Eagleby', 'Edens Landing', 'Flagstone', 'Forestdale',
  'Greenbank', 'Heritage Park', 'Hillcrest', 'Holmview', 'Jimboomba', 'Kingston', 'Logan Central',
  'Logan Reserve', 'Logan Village', 'Loganholme', 'Loganlea', 'Lyons', 'Marsden', 'Meadowbrook',
  'Mount Warren Park', 'Munruben', 'New Beith', 'North Maclean', 'Park Ridge', 'Park Ridge South',
  'Priestdale', 'Regents Park', 'Rochedale South', 'Shailer Park', 'Slacks Creek', 'South Maclean',
  'Springwood', 'Stockleigh', 'Tanah Merah', 'Underwood', 'Undullah', 'Waterford', 'Waterford West',
  'Windaroo', 'Wolffdene', 'Woodhill', 'Woodridge', 'Yarrabilba',
];

const REGIONS = [
  {
    slug: 'logan-airport-transfers', name: 'Logan', zones: ['BS2', 'BS3', 'BS4'], only: LOGAN,
    labels: {
      BS2: 'Springwood, Loganholme and the northern suburbs',
      BS3: 'Beenleigh, Waterford and the Logan River',
      BS4: 'Logan Village, Jimboomba and the rural south',
    },
    title: 'Logan Airport Transfers | Fixed Fares to Brisbane',
    desc: 'Logan to Brisbane Airport from $140 per vehicle: Springwood, Beenleigh, Loganholme, Jimboomba and the rest. Fixed fares, tolls and GST in, any hour.',
    h1: 'Logan airport transfers, fixed price',
    lead: 'Private chauffeur transfers between the Logan City suburbs and Brisbane Airport (BNE), priced by three fare bands: the northern suburbs around Springwood and Loganholme, the Beenleigh and Waterford belt on the Logan River, and the rural south out through Logan Village and Jimboomba. One fixed fare per vehicle, published below.',
    notes: [
      'Logan sits between Brisbane and the Gold Coast, and that is the single most useful thing to know about a transfer from here. Brisbane Airport is the published fare on this page: the Logan Motorway or the Pacific Motorway north, then the Gateway, with every toll already inside the price. Gold Coast Airport is the M1 south and is a published fare as well, from $225 in the closest band. From the southern half of Logan it is not much further than Brisbane, so it is worth comparing the two before you book the flight rather than after.',
      'The three bands below follow the drive rather than the council map. The northern band, from Rochedale South and Springwood out to Loganholme and Marsden, is close enough in to carry the same fare as Sunnybank. The middle band is the Logan River country either side of the motorway — Beenleigh, Waterford, Bethania and the Park Ridge shelf. The third is the rural south, out through Logan Village, Yarrabilba, Flagstone and Jimboomba, where a driveway can be a few hundred metres of gravel behind a gate and we suggest a slightly earlier pick-up than the raw drive time implies.',
      'The Brisbane International Cruise Terminal at Pinkenba is a fixed door-to-ship fare from every Logan suburb — the Brisbane Airport fare plus $25, quoted instantly in the booking form when you choose it as your drop-off. We track ship arrivals and meet disembarking passengers inside with a name board.',
    ],
    faq: [
      ['How long is Logan to Brisbane Airport?', 'From about {MIN_LOW} at the northern end to about {MIN_HIGH} from the rural south, outside peak. Every suburb page below shows its own measured distance and drive time.'],
      ['Which airport should I use from Logan?', 'Both are published fares, so the honest answer is whichever suits your flight. Brisbane Airport is nearer from every Logan suburb, measured; Gold Coast Airport starts at $225 and is the M1 most of the way. Each suburb page below shows both distances and both fares side by side.'],
      ['Is the fare the same for a 4am pick-up?', 'Yes. The published fare applies at any hour, any day, including public holidays, with no after-hours loading and no surge. Early departures are a large share of the Logan work.'],
      ['Can you find an acreage address out past Jimboomba?', 'Yes. Type the street address into the booking form and it prices the trip by suburb while keeping the exact address for your chauffeur; add the gate code in the notes if there is one. Tell us if the driveway is steep, narrow or unsealed and we will send the right vehicle or meet you at the gate.'],
    ],
  },
  {
    slug: 'sunshine-coast-airport-transfers', name: 'Sunshine Coast', zones: ['SC1', 'SC2', 'SC3', 'SC4'],
    title: 'Sunshine Coast Airport Transfers | From Brisbane Airport',
    desc: 'Brisbane Airport to the Sunshine Coast from $280 per vehicle: Caloundra, Mooloolaba, Maroochydore, Coolum and Noosa. Fixed fares, toll and GST in.',
    h1: 'Sunshine Coast airport transfers, fixed price',
    lead: 'Private chauffeur transfers between Brisbane Airport (BNE) and every Sunshine Coast suburb we price, from Caloundra to Noosa. One fixed fare per vehicle, published below, the same at 4am as at 4pm.',
    notes: [
      'Most Sunshine Coast travellers use Brisbane Airport for international flights and for the routes Sunshine Coast Airport does not fly. The drive is the Bruce Highway south to the Gateway Motorway, about an hour from Caloundra and closer to two from Noosa outside peak; the Gateway toll is inside every fare in the table.',
      'The Bruce is a working highway and it does slow down \u2014 Friday afternoons northbound and Sunday evenings southbound most of all \u2014 so for a departure we recommend a pick-up time with a highway margin built in and confirm it with you when we confirm the booking. On arrivals we track the flight and the driver meets you inside the terminal with a name board; international arrivals include 60 minutes of free waiting rather than the usual 30.',
      'Fares are per vehicle, not per person. A family or a group of friends pays one price for the trip, and a Luxury Minivan or Sprinter takes the surfboards, golf bags and prams without a trailer. Sunshine Coast Airport at Marcoola is also a priced destination for travellers connecting between the two airports.',
    ],
    faq: [
      ['How long is the drive from Brisbane Airport to the Sunshine Coast?', 'It depends where on the coast: about {MIN_LOW} to Caloundra and the southern end, about {MIN_HIGH} to Noosa, outside peak. Every suburb page shows its own measured drive time.'],
      ['Is the fare the same for an early-morning or late-night flight?', 'Yes. The published fare applies at any hour, any day, including public holidays. There is no after-hours loading and no surge.'],
      ['Can you carry surfboards and golf bags?', 'Yes. A Luxury Minivan or Sprinter takes them without a trailer; a trailer is available for $30 if a sedan or SUV needs it.'],
      ['Do you go to Sunshine Coast Airport?', 'Yes, it is priced like any Sunshine Coast suburb \u2014 see the Sunshine Coast Airport (MCY) page \u2014 for travellers connecting between Brisbane and Marcoola.'],
    ],
  },
  {
    slug: 'toowoomba-airport-transfers', name: 'Toowoomba', zones: ['TWB'],
    title: 'Toowoomba Airport Transfers | Fixed Fare to Brisbane',
    desc: 'Toowoomba to Brisbane Airport from $395 per vehicle. One fixed fare, tolls and GST included, flight tracked, any hour. Sedan to 14-seat Sprinter.',
    h1: 'Toowoomba airport transfers, fixed price',
    lead: 'Private chauffeur transfers between Toowoomba \u2014 the city and the surrounding suburbs from Highfields to Westbrook \u2014 and Brisbane Airport (BNE). One fixed fare per vehicle, published below, for any hour of any day.',
    notes: [
      'Toowoomba to Brisbane Airport is the Warrego Highway down the range, across the Lockyer Valley to Ipswich, then the motorways to the Gateway or the Airport Link tunnel \u2014 around two hours outside peak, with every toll inside the fare. The Toowoomba Bypass keeps the trucks off the range road, but winter fog on the range is real and we allow for it in the pick-up time we recommend.',
      'Most of our Toowoomba work is early departures from Brisbane: a 6am international flight means a pick-up before 3am, and the fare is the same as at midday. On the way home we track the flight, so a late arrival costs you nothing, and the driver meets you inside the terminal with a name board.',
      'It is a long enough trip that the vehicle matters. The sedan is the published entry fare; the Luxury Minivan is the comfortable choice for a family with luggage, and the Sprinters carry a sports team or a wedding party in one vehicle for one price. Brisbane West Wellcamp Airport serves a handful of routes; for everything else, Brisbane has the schedule and this is the fixed fare for it.',
    ],
    faq: [
      ['How long is Toowoomba to Brisbane Airport?', 'About {MIN_LOW} to {MIN_HIGH} depending on the suburb, outside peak. Allow more in the weekday morning peak through Ipswich, which we build into the recommended pick-up time.'],
      ['Do you do 3am pick-ups from Toowoomba?', 'Yes, at the same fare. Early departures are most of the Toowoomba work.'],
      ['Are tolls included?', 'Yes. Tolls and GST are inside the fixed fare on every Brisbane route.'],
      ['Is Newtown or the Lockyer Valley priced?', 'Not yet online. Withcott, Gatton, Plainland and Laidley sit between Toowoomba and Brisbane and are quoted on request \u2014 call or WhatsApp us with the date.'],
    ],
  },
  {
    slug: 'ipswich-airport-transfers', name: 'Ipswich', zones: ['BW3', 'BW4', 'BW5'],
    title: 'Ipswich Airport Transfers | Fixed Fares to Brisbane',
    desc: 'Ipswich, Springfield, Goodna, Ripley and Rosewood to Brisbane Airport from $155 per vehicle. Fixed fares, tolls and GST included, any hour.',
    h1: 'Ipswich airport transfers, fixed price',
    lead: 'Pre-booked chauffeur transfers between the Ipswich region and Brisbane Airport (BNE), priced by three fare bands: the Springfield and Goodna corridor, Ipswich city, and the towns west to Rosewood and Marburg. One fixed fare per vehicle, published below.',
    notes: [
      'From Ipswich the airport is the Ipswich Motorway to the Gateway, or the Warrego and Centenary motorways to Legacy Way and the Airport Link, depending on the hour; both are toll roads and the tolls are inside the fare. Springfield and Goodna are well under an hour outside peak, Ipswich city a little over, and Rosewood or Marburg a little more again. The weekday morning peak through the Ipswich Motorway is the one thing that changes the drive, and we allow for it in the pick-up time we recommend.',
      'We are a pre-booked chauffeur service, not an on-demand rideshare: bookings close online six hours before pick-up, and inside that window we take the job by phone only if a car is free. What you get for booking ahead is a fixed fare with no meter and no surge, a driver who tracks your flight, and a name board inside the terminal on the way home.',
      'RAAF Base Amberley, the Ipswich hospitals and the Springfield Central offices generate a lot of this work, so tax invoices are issued on every trip and monthly accounts are available for regular travellers. Until recently most of Ipswich was not priced online at all \u2014 the table below is now the answer.',
    ],
    faq: [
      ['How long is Ipswich to Brisbane Airport?', 'About {MIN_LOW} from the Springfield end to about {MIN_HIGH} from the western towns, outside peak. Each suburb page shows its own measured drive time.'],
      ['Can I book a car right now?', 'Online bookings close six hours before pick-up. Inside that window, call +61 481 437 772 and we will take the job if a car is free \u2014 but we are a pre-booked service, so please book ahead when you can.'],
      ['Are the motorway tolls extra?', 'No. Tolls and GST are inside the fixed fare on every route to Brisbane Airport.'],
      ['Which suburbs are in which fare band?', 'The bands are listed below with every suburb in each. Springfield, Goodna, Redbank and Camira are the corridor band; Ipswich city and its suburbs the middle band; Rosewood, Walloon, Marburg, Amberley and Grandchester the western band.'],
    ],
  },
];

function regionPage(r) {
  /* `only` restricts every band to named suburbs, for a region that shares a
     fare zone with somewhere else: Logan sits in BS2 alongside nine Brisbane
     City suburbs, and listing Sunnybank on a Logan page would be wrong.
     `labels` renames a band whose zone label is written for the wider band.
     lo/hi are null when no suburb in the band has a measured drive time —
     without that, Math.min of an empty list is Infinity and the page prints
     "Infinity minutes". */
  const bands = r.zones.map(zk => {
    let list = places.filter(p => p.zoneKey === zk);
    if (r.only) list = list.filter(p => r.only.indexOf(p.name) !== -1);
    list = list.sort((a, b) => a.name.localeCompare(b.name));
    if (!list.length) throw new Error('region ' + r.slug + ': no suburbs left in zone ' + zk);
    const secs = list.map(p => p.facts.bne && p.facts.bne.s).filter(Boolean);
    return { zk, label: (r.labels && r.labels[zk]) || Z[zk].label, list, fares: list[0].fares.bne,
             lo: secs.length ? Math.min.apply(null, secs) : null,
             hi: secs.length ? Math.max.apply(null, secs) : null };
  });
  const all = bands.reduce((a, b) => a.concat(b.list), []);
  const from = Math.min.apply(null, bands.map(b => b.fares[0]));
  const los = bands.map(b => b.lo).filter(v => v !== null), his = bands.map(b => b.hi).filter(v => v !== null);
  const lo = los.length ? Math.min.apply(null, los) : null, hi = his.length ? Math.max.apply(null, his) : null;
  const url = '/' + r.slug + '.html';
  const ctaHref = '/?do=' + encodeURIComponent(BNE) + '#book';
  const brief = v => mins(v).replace(' minutes', ' min').replace(/ h /, 'h ');
  const fillR = t => t.replace(/\{MIN_LOW\}/g, lo === null ? 'the usual drive time' : mins(lo))
                      .replace(/\{MIN_HIGH\}/g, hi === null ? 'the usual drive time' : mins(hi));
  const faqs = r.faq.map(([q, a]) => [fillR(q), fillR(a)]);

  const rows = bands.map(b => `        <tr><th scope="row">${esc(b.label.charAt(0).toUpperCase() + b.label.slice(1))}<span class="s"> ${b.list.length} suburbs${b.lo === null ? '' : ` &middot; ${mins(b.lo)}&ndash;${mins(b.hi)}`}</span></th>${b.fares.map(f => `<td>${money(f)}</td>`).join('')}</tr>`).join('\n');

  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@id': SITE + url + '#service', '@type': 'Service', name: `${r.name} airport transfers`, serviceType: 'Airport transfer', url: SITE + url,
        areaServed: { '@type': 'Place', name: `${r.name}, QLD`, containedInPlace: { '@type': 'AdministrativeArea', name: 'Queensland' } },
        provider: { '@id': SITE + '/#business' },
        offers: { '@type': 'Offer', name: `${r.name} to Brisbane Airport (BNE), sedan, one way`, price: String(from), priceCurrency: 'AUD', availability: 'https://schema.org/InStock', url: SITE + url,
          priceSpecification: { '@type': 'PriceSpecification', minPrice: String(from), priceCurrency: 'AUD', valueAddedTaxIncluded: true } },
      },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' },
        { '@type': 'ListItem', position: 2, name: `${r.name} airport transfers`, item: SITE + url } ] },
      { '@type': 'FAQPage', mainEntity: faqs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a.replace(/<[^>]+>/g, '') } })) },
    ],
  };

  const body = `${NAV}

<header class="fares-hero photo" id="top">
  ${heroBg(heroImg(r.name))}
  <div class="hero-in">
  <h1>${esc(r.h1)}</h1>
  <p>
    ${esc(r.lead)}
  </p>
  <a class="cta-gold" href="${ctaHref}">Get your fixed price</a>
  </div>
</header>

<div class="lp">

  <div class="facts">
    <div class="fact"><span class="k">From</span><span class="v">$${from}</span><span class="s">Sedan, one way, to BNE</span></div>
    <div class="fact"><span class="k">Suburbs priced</span><span class="v">${all.length}</span><span class="s">Each with its own page</span></div>
    ${lo === null ? '' : `<div class="fact"><span class="k">Drive to BNE</span><span class="v">${brief(lo)}&ndash;${brief(hi)}</span><span class="s">Measured, outside peak</span></div>`}
    <div class="fact"><span class="k">Free waiting</span><span class="v">60 min</span><span class="s">International arrivals</span></div>
  </div>

  <h2>What it costs from ${esc(r.name)}</h2>
  <p>
    One-way fares per vehicle in Australian dollars, GST and tolls included, the same at any hour.
    Booking the return in the same booking takes 10% off the whole trip &mdash; $${from} each way
    is $${returnFare(from)} return instead of $${from * 2}. Each band
    lists its suburbs further down; every suburb also has its own page with the exact drive time.
  </p>

  <div class="faretable-wrap">
    <table class="lpfare">
      <caption>${esc(r.name)} &rarr; Brisbane Airport (BNE) &mdash; one way, AUD</caption>
      <thead>
        <tr><th scope="col">Fare band</th>${VEH.map(v => `<th scope="col">${esc(v[0])}</th>`).join('')}</tr>
      </thead>
      <tbody>
${rows}
      </tbody>
    </table>
  </div>
  <p class="fare-note">
    Sedan and Luxury Sedan 1&ndash;3 passengers &middot; SUV 1&ndash;4 &middot; People Mover 1&ndash;7 &middot; Luxury Minivan 1&ndash;6 &middot; Sprinter 10, 14 and 18 seats.
    Included: meet &amp; greet with a name board, flight tracking, 30 minutes&rsquo; free airport waiting
    (60 for international arrivals). Child seats $15 each, luggage trailer $30. The Brisbane Cruise Terminal is the
    airport fare plus $25. More than 18? Our 53-seat coach is quoted per job —
    see <a href="/charters.html">charters</a>.
  </p>

  <h2>The drive</h2>
  ${r.notes.map(n => `<p>${n}</p>`).join('\n  ')}

  <div class="box">
    <p>
      <strong>Booking.</strong> Type your street address into the booking form; it prices the trip by suburb and keeps
      the exact address for your chauffeur. Online bookings close six hours before pick-up; inside that window, call
      <a href="tel:+61481437772">+61 481 437 772</a> and we will take the job if a car is free.
    </p>
  </div>

  <h2>Questions about ${esc(r.name)} transfers</h2>
${faqs.map(([q, a]) => `  <details>\n    <summary>${q}</summary>\n    <p>${a}</p>\n  </details>`).join('\n')}

  <h2>Every ${esc(r.name)} suburb we price</h2>
${bands.map(b => `  <h3>${esc(b.label.charAt(0).toUpperCase() + b.label.slice(1))} <span class="s">sedan $${b.fares[0]}</span></h3>
  <div class="related">
${b.list.map(p => `    <a href="${p.url}">${esc(p.name)}<span>${p.facts.bne ? mins(p.facts.bne.s) + ' to BNE' : 'From $' + p.from}</span></a>`).join('\n')}
  </div>`).join('\n')}
${r.slug === 'sunshine-coast-airport-transfers' ? `
  <h2>While you are on the Sunshine Coast</h2>
  <div class="related">
${ATTRACTIONS.filter(x => x.slug === 'australia-zoo-transfers').map(x => `    <a href="/${x.slug}.html">${esc(x.name)} transfers<span>${esc(x.suburb)} &middot; from Brisbane and the coast</span></a>`)
  .concat(TOURS.map(t => `    <a href="/${t.slug}.html">${esc(t.name)} day tour<span>Private car and chauffeur for the day</span></a>`)).join('\n')}
  </div>` : ''}
  <!--guides:auto--><!--/guides:auto-->
  <p class="fare-note">
    <a href="/brisbane-airport-transfers.html">Brisbane Airport transfers</a> &middot; <a href="/${DIR}/">All suburbs</a> &middot; <a href="/prices.html">Full price list</a> &middot; <a href="/fleet.html">See the vehicles</a>
  </p>

</div>

<section class="cta-band">
  <h2>Price your ${esc(r.name)} transfer in about a minute</h2>
  <p>Pick-up, drop-off, flight number, vehicle. The fare comes back straight away and it does not change afterwards.</p>
  <a class="cta-gold" href="${ctaHref}">Book a ${esc(r.name)} transfer</a>
  <span class="alt">Or call <a href="tel:+61481437772">+61 481 437 772</a> &mdash; 24 hours, 7 days.</span>
</section>
${FOOTER}
</body>
</html>
`;
  return head(r.title, r.desc, url, ld) + body;
}

// ---------------------------------------------------------------------------
// attraction pages (2 Nov 2026) - the list, measured distances and copy are in
// data/attractions.js. Airport fares come from the rate tables through the
// attraction's suburb; hotel-area fares from the point-to-point ladder below.
// ---------------------------------------------------------------------------
/* The point-to-point ladder. Stated once here for fares.json and the
   attraction pages, and it MUST match LADDERS / CLASS_ADDER / OUTER_LOADING in
   p2p-fare.js on the booking server, which is what actually quotes the trip. */
const P2P = {
  gc:  [[8, 80], [15, 85], [20, 95], [30, 110], [40, 125], [50, 145], [65, 165], [85, 225]],
  bne: [[15, 85], [20, 105], [30, 125], [40, 140], [50, 155], [65, 185], [85, 225]],
  adders: [0, 15, 25, 35, 45, 135, 195],
  loading: 25,
  outer: ['H', 'BW4', 'BW5', 'BN3', 'BN4'],
  maxKm: 85,
  /* Day-trip destinations (DAY_TRIP_ZONES in p2p-fare.js): Brisbane suburbs on
     the Brisbane ladder to 65 km, then the zone's Brisbane Airport fare to
     95 km; the whole Gold Coast at the zone's Gold Coast Airport fare; the
     Sunshine Coast zones on the Gold Coast ladder to 85 km. */
  dayTrip: ['AZ'], sunshine: ['SC1', 'SC2', 'SC3', 'SC4'], bneLadderKm: 65, bneFlatKm: 95,
};
const placeByName = {};
for (const p of places) placeByName[p.name] = p;
/* Same rules as p2p-fare.js quote(): Brisbane ladder if either end is in the
   Brisbane tables, Gold Coast only if both ends are; regional ends, same-place
   trips and anything past 85 km have no banded fare (null). */
function p2pFares(a, b, kmRaw) {
  const pa = placeByName[a], pb = placeByName[b];
  if (!pa || !pb || a === b) return null;
  const da = P2P.dayTrip.indexOf(pa.zoneKey) !== -1, db = P2P.dayTrip.indexOf(pb.zoneKey) !== -1;
  if (da !== db) {
    const zone = da ? pa : pb, other = da ? pb : pa;
    const dist = Math.round(kmRaw * 10) / 10;
    const lad = (ladder) => { const row = ladder.find(([max]) => dist <= max); return row ? P2P.adders.map(x => row[1] + x) : null; };
    if (other.region === 'Gold Coast') return zone.fares.ool.slice();
    if (other.region === 'Brisbane') return dist > P2P.bneFlatKm ? null : dist > P2P.bneLadderKm ? zone.fares.bne.slice() : lad(P2P.bne);
    if (P2P.sunshine.indexOf(other.zoneKey) !== -1) return dist > P2P.maxKm ? null : lad(P2P.gc);
    return null;
  }
  if (pa.region !== 'Gold Coast' && pa.region !== 'Brisbane') return null;
  if (pb.region !== 'Gold Coast' && pb.region !== 'Brisbane') return null;
  const ladder = (pa.region === 'Brisbane' || pb.region === 'Brisbane') ? P2P.bne : P2P.gc;
  const dist = Math.round(kmRaw * 10) / 10;
  if (!(dist > 0) || dist > P2P.maxKm) return null;
  const row = ladder.find(([max]) => dist <= max);
  if (!row) return null;
  const load = (P2P.outer.indexOf(pa.zoneKey) !== -1 || P2P.outer.indexOf(pb.zoneKey) !== -1) ? P2P.loading : 0;
  return P2P.adders.map(x => row[1] + x + load);
}

let ATTRACTIONS = [];
try { ATTRACTIONS = require(path.join(ROOT, 'data', 'attractions.js')); }
catch (e) { console.warn('build-suburbs: no data/attractions.js, skipping attraction pages (' + e.message + ')'); }
const ATTR_LASTMOD = '2026-11-02';

function attractionPage(a) {
  const p = placeByName[a.suburb];
  if (!p) throw new Error('attraction ' + a.slug + ': suburb not priced: ' + a.suburb);
  if (!p.fares.ool || !p.fares.bne) throw new Error('attraction ' + a.slug + ': needs both airport fares');
  const v0 = a.venues[0];
  const url = '/' + a.slug + '.html';
  const short = a.short || a.name;

  /* Hotel-area rows: the fares at the venue's own address and at the suburb.
     If they land in different bands, print the range - a single figure would
     be wrong for one of the two ways a customer can enter the trip. */
  const hotel = a.from.map(r => {
    const lo = p2pFares(r.from, a.suburb, r.km), hi = p2pFares(r.from, a.suburb, r.kmAlt);
    if (!lo || !hi) return Object.assign({ fares: null }, r);
    return Object.assign({ fares: lo.map((f, i) => [Math.min(f, hi[i]), Math.max(f, hi[i])]) }, r);
  });
  const priced = hotel.filter(r => r.fares);
  if (!priced.length) throw new Error('attraction ' + a.slug + ': no hotel row has a fare');
  const hotelBy = {}; for (const r of hotel) hotelBy[r.from] = r;
  const span = ([lo, hi]) => lo === hi ? money(lo) : money(lo) + '&ndash;' + hi;
  const from = Math.min.apply(null, priced.map(r => r.fares[0][0]));

  const pairs = (a.pairs || []).map(q => Object.assign({ fares: p2pFares(a.suburb, q.suburb, q.km) }, q));
  const pairBy = {}; for (const q of pairs) pairBy[q.to] = q;

  const ret = (r) => { const [lo, hi] = r.fares[0]; return lo === hi ? money(returnFare(lo)) : money(returnFare(lo)) + '&ndash;' + returnFare(hi); };
  const need = (map, k, what) => { if (!map[k] || !map[k].fares) throw new Error('attraction ' + a.slug + ': copy needs ' + what + ' for ' + k); return map[k]; };
  const fillA = t => t
    .replace(/\{OOL_KM\}/g, km(v0.ool.m)).replace(/\{OOL_MIN\}/g, mins(v0.ool.s))
    .replace(/\{BNE_KM\}/g, km(v0.bne.m)).replace(/\{BNE_MIN\}/g, mins(v0.bne.s))
    .replace(/\{F_OOL\}/g, money(p.fares.ool[0])).replace(/\{F_BNE\}/g, money(p.fares.bne[0]))
    .replace(/\{P2P:([^}]+)\}/g, (m, k) => span(need(hotelBy, k, 'a fare').fares[0]))
    .replace(/\{P2P3:([^}]+)\}/g, (m, k) => span(need(hotelBy, k, 'a fare').fares[2]))
    .replace(/\{RET:([^}]+)\}/g, (m, k) => ret(need(hotelBy, k, 'a fare')))
    .replace(/\{PAIR:([^}]+)\}/g, (m, k) => money(need(pairBy, k, 'a park pair').fares[0]))
    .replace(/\{PAIR_KM:([^}]+)\}/g, (m, k) => need(pairBy, k, 'a park pair').km + ' km')
    .replace(/\{PAIR_MIN:([^}]+)\}/g, (m, k) => need(pairBy, k, 'a park pair').min + ' minutes');
  const notes = a.notes.map(fillA);
  const faqs = a.faq.map(([q, x]) => [fillA(q), fillA(x)]);
  const left = (notes.join(' ') + faqs.join(' ')).match(/\{[A-Z_0-9]+(:[^}]*)?\}/);
  if (left) throw new Error('attraction ' + a.slug + ': unfilled placeholder ' + left[0]);

  const air = [
    { code: 'OOL', name: 'Gold Coast Airport', place: OOL, fares: p.fares.ool, d: v0.ool },
    { code: 'BNE', name: 'Brisbane Airport', place: BNE, fares: p.fares.bne, d: v0.bne },
  ].sort((x, y) => x.d.s - y.d.s);                 // nearer airport first
  const title = fitTitle(a.title.map(t => t.replace('${FROM}', '$' + from).replace('${BNE}', '$' + p.fares.bne[0]).replace('${OOL}', '$' + p.fares.ool[0])));
  const desc = metaDesc([
    `${a.name}: ${priced[0].from} from ${money(priced[0].fares[0][0])}, ` + air.map(x => `${x.name} ${money(x.fares[0])}`).join(', ') + ', per vehicle.',
    'Fixed price, GST and tolls included.',
    a.descTail || (a.themePark ? 'Child seats fitted.' : 'Tax invoice on every trip.'),
    '24/7.',
  ]);
  const ctaHref = '/?pu=' + encodeURIComponent(air[0].place) + '&do=' + encodeURIComponent(a.suburb) + '#book';
  const brief = v => mins(v).replace(' minutes', ' min').replace(/ h /, 'h ');

  const airRows = VEH_T.map((v, i) => `        <tr><th scope="row">${esc(v[0])}<span class="s"> ${esc(v[1])}</span></th>${air.map(x => `<td>${money(x.fares[i])}</td>`).join('')}</tr>`).join('\n');
  const hotelRows = priced.map(r => `        <tr><th scope="row">${esc(r.from)}<span class="s"> ${r.km} km &middot; about ${r.min} min</span></th>${r.fares.map(f => `<td>${span(f)}</td>`).join('')}</tr>`).join('\n');
  const unpriced = hotel.filter(r => !r.fares).map(r => esc(r.from));
  const venueList = a.venues.length > 1 ? `<ul>\n    ${a.venues.map(v => `<li><strong>${esc(v.name)}</strong>, ${esc(a.suburb)}: ${km(v.ool.m)} (about ${mins(v.ool.s)}) from Gold Coast Airport, ${km(v.bne.m)} (about ${mins(v.bne.s)}) from Brisbane Airport.</li>`).join('\n    ')}\n  </ul>` : '';
  const others = ATTRACTIONS.filter(x => x !== a);

  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@id': SITE + url + '#service', '@type': 'Service', name: `${a.name} transfers`, serviceType: 'Private transfer', url: SITE + url,
        /* Name only: the site carries no street address or PostalAddress, an
           attraction's included (Recheck 7, 2 Nov 2026). */
        areaServed: a.venues.map(v => ({ '@type': a.themePark ? 'TouristAttraction' : 'Place', name: v.name })),
        provider: { '@id': SITE + '/#business' },
        offers: air.map(x => ({ '@type': 'Offer', name: `${x.name} (${x.code}) to ${v0.name}, sedan, one way`, price: String(x.fares[0]), priceCurrency: 'AUD',
          availability: 'https://schema.org/InStock', url: SITE + url,
          priceSpecification: { '@type': 'PriceSpecification', price: String(x.fares[0]), minPrice: String(x.fares[0]), priceCurrency: 'AUD', valueAddedTaxIncluded: true } })),
      },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' },
      ].concat(a.themePark ? [{ '@type': 'ListItem', position: 2, name: 'Theme park transfers', item: SITE + '/theme-park-transfers.html' }] : [])
       .concat([{ '@type': 'ListItem', position: a.themePark ? 3 : 2, name: `${a.name} transfers`, item: SITE + url }]) },
      { '@type': 'FAQPage', mainEntity: faqs.map(([q, x]) => ({ '@type': 'Question', name: q.replace(/&ndash;/g, '-'), acceptedAnswer: { '@type': 'Answer', text: x.replace(/<[^>]+>/g, '').replace(/&ndash;/g, '-') } })) },
    ],
  };

  const body = `${NAV}

<header class="fares-hero photo" id="top">
  ${heroBg(a.hero)}
  <div class="hero-in">
  <h1>${esc(a.h1)}</h1>
  <p>
    ${esc(a.lead)}
  </p>
  <a class="cta-gold" href="${ctaHref}">Get your fixed price</a>
  </div>
</header>

<div class="lp">

  <div class="facts">
    <div class="fact"><span class="k">From</span><span class="v">$${from}</span><span class="s">Sedan, one way, from a hotel</span></div>
    <div class="fact"><span class="k">From ${air[0].code}</span><span class="v">${money(air[0].fares[0])}</span><span class="s">${km(air[0].d.m)}, about ${brief(air[0].d.s)}</span></div>
    <div class="fact"><span class="k">From ${air[1].code}</span><span class="v">${money(air[1].fares[0])}</span><span class="s">${km(air[1].d.m)}, about ${brief(air[1].d.s)}</span></div>
    <div class="fact"><span class="k">Child seats</span><span class="v">$15</span><span class="s">Fitted before we arrive</span></div>
  </div>

  <h2>Getting to ${esc(short)}</h2>
  ${venueList}
  ${notes.map(n => `<p>${n}</p>`).join('\n  ')}

  <h2>From the airports</h2>
  <p>
    The fares the booking form quotes for ${esc(a.suburb)}, where ${esc(short)} ${a.venues.length > 1 ? 'are' : 'is'}. One way, per vehicle,
    in Australian dollars, GST and tolls included, the same at any hour. Book the return in the same booking and the pair is 10% cheaper.
  </p>
  <div class="faretable-wrap">
    <table class="lpfare">
      <caption>${air.map(x => esc(x.name) + ' (' + x.code + ')').join(' / ')} &rarr; ${esc(short)} &mdash; one way, AUD</caption>
      <thead>
        <tr><th scope="col">Vehicle</th>${air.map(x => `<th scope="col">From ${esc(x.name)}</th>`).join('')}</tr>
      </thead>
      <tbody>
${airRows}
      </tbody>
    </table>
  </div>
  <p class="fare-note">
    Included: meet &amp; greet with a name board, flight tracking, 30 minutes&rsquo; free airport waiting
    (60 for international arrivals). Child seats $15 each, luggage trailer $30, prams free where they fit.
    More than 18? Our 53-seat coach is quoted per job &mdash; see <a href="/charters.html">charters</a>.
  </p>

  <h2>From your hotel</h2>
  <p>
    Point-to-point fares from the main places people stay, priced on the measured road distance &mdash; a fixed
    band, not a meter, so traffic and the time of day never change them. Where a range is shown, the exact figure
    depends on your hotel&rsquo;s address and the booking form quotes it to the dollar before you pay.
  </p>
  <div class="faretable-wrap">
    <table class="lpfare">
      <caption>To ${esc(short)} &mdash; one way, AUD</caption>
      <thead>
        <tr><th scope="col">From</th>${VEH.map(v => `<th scope="col">${esc(v[0])}</th>`).join('')}</tr>
      </thead>
      <tbody>
${hotelRows}
      </tbody>
    </table>
  </div>
  <p class="fare-note">
    ${unpriced.length ? `${unpriced.join(' and ')} ${unpriced.length > 1 ? 'are' : 'is'} further than we price online &mdash; call or WhatsApp us and we fix the price before you book. ` : ''}Staying somewhere else? Type the address into the
    <a href="${ctaHref}">booking form</a> and it prices the trip straight away.
    ${a.stayHtml || 'Want the car to stay with you? <a href="/point-to-point-transfers.html">Book by the hour</a>, three to six hours, from $90 an hour.'}
  </p>
${pairs.length ? `
  <h2>Between the parks</h2>
  <div class="related">
${pairs.filter(q => q.fares).map(q => `    <a href="${q.href}">${esc(a.name.split(' and ')[0])} to ${esc(q.to)}<span>${q.km} km &middot; about ${q.min} min &middot; sedan ${money(q.fares[0])}</span></a>`).join('\n')}
  </div>` : ''}

  <div class="box">
    <p>
      <strong>Booking.</strong> Choose ${esc(a.suburb)} or type the ${a.venues.length > 1 ? 'park&rsquo;s' : 'venue&rsquo;s'} address as the drop-off, and your hotel
      or flight as the pick-up. Online bookings close six hours before pick-up; changes are free up to 24 hours before.
      Inside six hours, call <a href="tel:+61481437772">+61 481 437 772</a> and we will take the job if a car is free.
    </p>
  </div>

  <h2>Questions about ${esc(short)} transfers</h2>
${faqs.map(([q, x]) => `  <details>\n    <summary>${q}</summary>\n    <p>${x}</p>\n  </details>`).join('\n')}

  <h2>Other attractions we price</h2>
  <div class="related">
${others.map(o => `    <a href="/${o.slug}.html">${esc(o.name)}<span>${esc(o.suburb)}</span></a>`).join('\n')}
  </div>
  <!--guides:auto--><!--/guides:auto-->
  <p class="fare-note">
    ${a.themePark ? `<a href="/theme-park-transfers.html">Theme park transfers</a> &middot; ` : ''}<a href="${p.url}">${esc(a.suburb)} airport transfers</a> &middot; ${p.region === 'Gold Coast' ? '<a href="/gold-coast-airport-transfers.html">Gold Coast Airport transfers</a>' : '<a href="/brisbane-airport-transfers.html">Brisbane Airport transfers</a>'} &middot; <a href="/fleet.html">See the whole fleet</a>${/child seat/i.test(JSON.stringify(a)) ? ' &middot; <a href="/child-seats.html">Child seats</a>' : ''} &middot; <a href="/point-to-point-transfers.html">Point-to-point fares</a> &middot; <a href="/prices.html">Full price list</a>
  </p>

</div>

<section class="cta-band">
  <h2>Price your ${esc(short)} transfer in about a minute</h2>
  <p>Pick-up, drop-off, date, vehicle. The fare comes back straight away and it does not change afterwards.</p>
  <a class="cta-gold" href="${ctaHref}">Book your transfer</a>
  <span class="alt">Or call <a href="tel:+61481437772">+61 481 437 772</a> &mdash; 24 hours, 7 days.</span>
</section>
${FOOTER}
</body>
</html>
`;
  return head(title, desc, url, ld) + body;
}

// ---------------------------------------------------------------------------
// private day tours (2 Nov 2026) - data/tours.js. The car and chauffeur for
// the day, priced as the hourly-hire rate x hours less 10%, and booked by
// enquiry: the form posts to the server's /charter-enquiry, so it lands in the
// same inbox and Zapier flow as a charter.
// ---------------------------------------------------------------------------
/* Hourly hire, per vehicle class in VEH order. MUST match HOURLY_RATES in
   index.html and stripe-server.js; fares.json publishes this same array. */
const HOURLY = [90, 100, 115, 125, 135, 160, 185];
const TOUR_DISCOUNT = 0.9;          // what the full-day charters carry
const tourFares = (hours) => HOURLY.map(r => Math.round(r * hours * TOUR_DISCOUNT / 5) * 5);
const SERVER = 'https://sky-transfers-booking-server.onrender.com';
const dollars = n => '$' + n.toLocaleString('en-AU');

let TOURS = [];
try { TOURS = require(path.join(ROOT, 'data', 'tours.js')); }
catch (e) { console.warn('build-suburbs: no data/tours.js, skipping tour pages (' + e.message + ')'); }

function clock(min) {
  const m = Math.round(min / 5) * 5, h = Math.floor(m / 60) % 24, mm = m % 60;
  return (h % 12 || 12) + ':' + String(mm).padStart(2, '0') + (h < 12 ? ' am' : ' pm');
}

function tourPage(t) {
  const url = '/' + t.slug + '.html';
  /* Each start: its timetable from the measured legs and planned stays, and
     its fares. A day that overruns the hours it is priced at stops the build. */
  const starts = t.starts.map(s => {
    const [hh, mi] = s.start.split(':').map(Number);
    let now = hh * 60 + mi, drive = 0;
    const rows = [{ time: clock(now), what: 'Pick-up from ' + s.place, how: '' }];
    for (const [key, km, min, stay] of s.legs) {
      const st = t.stops[key];
      if (!st) throw new Error('tour ' + t.slug + ': no stop ' + key);
      now += min; drive += min;
      rows.push({ time: clock(now), stop: st, km, min, stay });
      now += stay;
    }
    now += s.home[2]; drive += s.home[2];
    rows.push({ time: clock(now), what: 'Back ' + s.home[0], how: s.home[1] + ' km, about ' + mins(s.home[2] * 60) });
    const total = now - (hh * 60 + mi);
    if (total > s.hours * 60) throw new Error('tour ' + t.slug + ' ' + s.key + ': the day is ' + total + ' min, priced at ' + s.hours + ' h');
    return Object.assign({ rows, total, drive, fares: tourFares(s.hours) }, s);
  });
  const from = Math.min.apply(null, starts.map(s => s.fares[0]));
  const desc = metaDesc([
    `Private day tour: Glass House Mountains, Australia Zoo and Maleny. ` + starts.map((s, i) => `${i ? s.label.replace('From ', 'from ') : s.label} ${dollars(s.fares[0])}`).join(', ') + ' per vehicle.',
    'Car and chauffeur all day, tolls and GST included.',
    'Entry tickets extra.',
  ]);

  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@id': SITE + url + '#tour', '@type': 'TouristTrip', name: t.name + ' private day tour', url: SITE + url,
        description: t.lead, provider: { '@id': SITE + '/#business' },
        itinerary: { '@type': 'ItemList', itemListElement: Object.keys(t.stops).map((k, i) => ({ '@type': 'ListItem', position: i + 1,
          item: { '@type': 'TouristAttraction', name: t.stops[k].name } })) },
        offers: starts.map(s => ({ '@type': 'Offer', name: `${s.label}, ${s.hours} hours, sedan, per vehicle`, price: String(s.fares[0]), priceCurrency: 'AUD',
          availability: 'https://schema.org/InStock', url: SITE + url,
          priceSpecification: { '@type': 'PriceSpecification', price: String(s.fares[0]), minPrice: String(s.fares[0]), priceCurrency: 'AUD', valueAddedTaxIncluded: true } })),
      },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' },
        { '@type': 'ListItem', position: 2, name: 'Charters & day tours', item: SITE + '/charters.html' },
        { '@type': 'ListItem', position: 3, name: t.name + ' day tour', item: SITE + url } ] },
      { '@type': 'FAQPage', mainEntity: t.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
    ],
  };

  const timetable = (s) => `  <div class="faretable-wrap">
    <table class="lpfare tourplan">
      <caption>${esc(s.label)} &mdash; about ${Math.round(s.total / 60 * 2) / 2} hours door to door, ${mins(s.drive * 60)} of it driving</caption>
      <thead><tr><th scope="col">Time</th><th scope="col">Stop</th><th scope="col">Getting there</th><th scope="col">Time there</th></tr></thead>
      <tbody>
${s.rows.map(r => r.stop
    ? `        <tr><td>${r.time}</td><th scope="row">${esc(r.stop.name)}<span class="s"> ${esc(r.stop.text)}${r.stop.ticket ? ' <em>Entry ticket extra.</em>' : ''}</span></th><td>${r.km} km, ${r.min} min</td><td>${mins(r.stay * 60).replace(' minutes', ' min')}</td></tr>`
    : `        <tr><td>${r.time}</td><th scope="row">${esc(r.what)}</th><td>${r.how}</td><td></td></tr>`).join('\n')}
      </tbody>
    </table>
  </div>${s.note ? `\n  <p class="fare-note">${esc(s.note)}</p>` : ''}`;

  const vehOptions = VEH.map((v, i) => `<option value="${esc(v[0])}">${esc(v[0])} (${esc(v[1].split(' · ')[0])})</option>`).join('');
  const priceJson = JSON.stringify(Object.fromEntries(starts.map(s => [s.key, { label: s.label, hours: s.hours, fares: s.fares }])));

  const body = `${NAV}

<header class="fares-hero photo" id="top">
  ${heroBg('ch-hero-dusk')}
  <div class="hero-in">
  <h1>${esc(t.h1)}</h1>
  <p>
    ${esc(t.lead)}
  </p>
  <a class="cta-gold" href="#enquire">Check a date</a>
  </div>
</header>

<div class="lp">

  <div class="facts">
${starts.map(s => `    <div class="fact"><span class="k">${esc(s.label)}</span><span class="v">${dollars(s.fares[0])}</span><span class="s">Sedan, ${s.hours} hours, per vehicle</span></div>`).join('\n')}
    <div class="fact"><span class="k">Group of 10</span><span class="v">${dollars(starts[0].fares[5])}</span><span class="s">Sprinter 10, from Brisbane</span></div>
    <div class="fact"><span class="k">Entry tickets</span><span class="v">Extra</span><span class="s">Bought direct</span></div>
  </div>

  <h2>The day</h2>
  <p>
    The car and the chauffeur are yours from pick-up to drop-off. These are the measured drive times outside peak and
    the time we plan at each stop &mdash; it is a private tour, so stay longer at the zoo, skip a stop or change the
    order on the day, within the hours you book.
  </p>
${starts.map(timetable).join('\n')}

  <h2>What it costs</h2>
  <p>
    One price per vehicle for the whole day, not per person, with fuel, tolls and GST included. Entry tickets are extra.
  </p>
  <div class="faretable-wrap">
    <table class="lpfare">
      <caption>${esc(t.name)} day tour &mdash; per vehicle, AUD</caption>
      <thead>
        <tr><th scope="col">Vehicle</th>${starts.map(s => `<th scope="col">${esc(s.label)} (${s.hours} h)</th>`).join('')}</tr>
      </thead>
      <tbody>
${VEH.map((v, i) => `        <tr><th scope="row">${esc(v[0])}<span class="s"> ${esc(v[1])}</span></th>${starts.map(s => `<td>${dollars(s.fares[i])}</td>`).join('')}</tr>`).join('\n')}
      </tbody>
    </table>
  </div>
  <p class="fare-note">
    That is ${starts.map(s => `$${Math.round(s.fares[5] / 10)} a head for ten in a Sprinter ${s.label.replace('From', 'from')}`).join(' and ')}.
    More than 14? The 18-seat Sprinter and the 53-seat coach are quoted per job &mdash; say so in the enquiry.
  </p>

  <div class="box">
    <p><strong>Included.</strong></p>
    <ul>
${t.included.map(x => `      <li>${esc(x)}</li>`).join('\n')}
    </ul>
    <p><strong>Not included.</strong></p>
    <ul>
${t.extra.map(x => `      <li>${esc(x)}</li>`).join('\n')}
    </ul>
  </div>

  <h2 id="enquire">Check a date</h2>
  <p>
    Tours are booked by enquiry: tell us the date and the group, we check a vehicle and a chauffeur are free, and we
    confirm with a written price, usually within the hour. Nothing is charged until then.
  </p>
  <form id="tour-form" class="tour-form" novalidate>
    <div class="tf-grid">
      <label>Starting from<select id="tf-start" required>${starts.map(s => `<option value="${s.key}">${esc(s.label.replace('From ', ''))}</option>`).join('')}</select></label>
      <label>Date<input id="tf-date" type="date" required></label>
      <label>People<input id="tf-pax" type="number" min="1" max="53" value="2" required></label>
      <label>Vehicle<select id="tf-veh">${vehOptions}</select></label>
      <label class="wide">Pick-up address or hotel<input id="tf-pickup" type="text" autocomplete="street-address" required></label>
      <label>Name<input id="tf-name" type="text" autocomplete="name" required></label>
      <label>Mobile<input id="tf-phone" type="tel" autocomplete="tel" required></label>
      <label class="wide">Email<input id="tf-email" type="email" autocomplete="email" required></label>
      <label class="wide">Anything we should know (children's ages, a stop to add or skip)<textarea id="tf-notes" rows="3"></textarea></label>
    </div>
    <p class="tf-price" id="tf-price" aria-live="polite"></p>
    <button class="cta-gold" type="submit" id="tf-send">Send enquiry</button>
    <p class="tf-msg" id="tf-msg" role="status" hidden></p>
  </form>

  <h2>Questions about the tour</h2>
${t.faq.map(([q, a]) => `  <details>\n    <summary>${esc(q)}</summary>\n    <p>${esc(a)}${/return transfer is cheaper/.test(a) ? ' See <a href="/australia-zoo-transfers.html">Australia Zoo transfers</a>.' : ''}</p>\n  </details>`).join('\n')}

  <p class="fare-note">
    <a href="/australia-zoo-transfers.html">Australia Zoo transfers</a> &middot; <a href="/charters.html">Charters</a> &middot; <a href="/point-to-point-transfers.html">Hourly hire</a> &middot; <a href="/prices.html">Full price list</a>
  </p>

</div>

<section class="cta-band">
  <h2>Ask about a date</h2>
  <p>Tell us the day and the group; we confirm the vehicle and the price, usually within the hour.</p>
  <a class="cta-gold" href="#enquire">Check a date</a>
  <span class="alt">Or call <a href="tel:+61481437772">+61 481 437 772</a> &mdash; 24 hours, 7 days.</span>
</section>
<style>
  .tourplan td:first-child{white-space:nowrap;font-weight:600}
  .tour-form{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px;box-shadow:var(--shadow)}
  .tf-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}
  .tf-grid label{display:flex;flex-direction:column;gap:6px;font-weight:600;font-size:14px;color:var(--ink)}
  .tf-grid .wide{grid-column:1/-1}
  .tf-price{margin:14px 0 10px;font-weight:600;color:var(--ink)}
  .tf-msg{margin-top:12px;padding:12px;border-radius:10px;background:var(--gold-soft);color:var(--ink)}
  .tf-msg.err{background:transparent;border:1px solid var(--err)}
</style>
<script>
(function(){
  var PRICES = ${priceJson};
  var VEHS = ${JSON.stringify(VEH.map(v => v[0]))};
  var $ = function(id){ return document.getElementById(id); };
  function price(){
    var s = PRICES[$("tf-start").value], i = VEHS.indexOf($("tf-veh").value);
    return { label: s.label, hours: s.hours, fare: s.fares[i] };
  }
  function show(){
    var p = price();
    $("tf-price").textContent = p.label + ", " + p.hours + " hours, " + $("tf-veh").value + ": $" + p.fare.toLocaleString("en-AU") + " per vehicle, entry tickets extra.";
  }
  $("tf-start").addEventListener("change", show); $("tf-veh").addEventListener("change", show); show();
  var t = new Date(); t.setDate(t.getDate() + 1); $("tf-date").min = t.toISOString().slice(0, 10);
  function msg(text, err){ var m = $("tf-msg"); m.hidden = false; m.className = "tf-msg" + (err ? " err" : ""); m.innerHTML = text; m.scrollIntoView({ behavior: "smooth", block: "center" }); }
  $("tour-form").addEventListener("submit", function(e){
    e.preventDefault();
    var f = this, need = ["tf-date", "tf-pax", "tf-pickup", "tf-name", "tf-phone", "tf-email"];
    for (var k = 0; k < need.length; k++) { var el = $(need[k]); if (!el.value.trim() || !el.checkValidity()) { el.focus(); msg("Please fill in " + el.parentNode.firstChild.textContent.trim().toLowerCase() + ".", true); return; } }
    var p = price(), b = $("tf-send"); b.disabled = true; b.textContent = "Sending…";
    var body = {
      occasion: "Day tour: Glass House, Australia Zoo & Maleny (" + p.label.replace("From", "from") + ")",
      vehicle: $("tf-veh").value, date: $("tf-date").value, hours: p.hours, pax: $("tf-pax").value,
      name: $("tf-name").value.trim(), phone: $("tf-phone").value.trim(), email: $("tf-email").value.trim(),
      itinerary: "Tour: ${esc(t.name)} (${url})\\nStarting from: " + p.label.replace("From ", "") + "\\nPick-up: " + $("tf-pickup").value.trim() +
        "\\nPublished tour price: $" + p.fare + " per vehicle, " + p.hours + " hours, entry tickets extra" +
        ($("tf-notes").value.trim() ? "\\nNotes: " + $("tf-notes").value.trim() : "")
    };
    var ctl = window.AbortController ? new AbortController() : null, timer = ctl ? setTimeout(function(){ ctl.abort(); }, 15000) : null;
    fetch("${SERVER}/charter-enquiry", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ctl ? ctl.signal : undefined })
      .then(function(r){ return r.json().then(function(d){ if (!r.ok) throw new Error(d.error || "failed"); return d; }); })
      .then(function(d){
        if (window.gtag) gtag("event", "tour_enquiry", { tour: "${t.slug}", start: $("tf-start").value, vehicle: body.vehicle });
        f.reset(); show();
        msg("Thank you — we have your enquiry (reference <strong>" + d.ref + "</strong>). A copy is on its way to your email, and we will confirm the date and the price, usually within the hour.");
      })
      .catch(function(){
        msg('We could not send that just now. Please call or WhatsApp <a href="tel:+61481437772">+61 481 437 772</a> or email info@skytransfers.com.au with the date, the group size and your pick-up.', true);
      })
      .then(function(){ if (timer) clearTimeout(timer); b.disabled = false; b.textContent = "Send enquiry"; });
  });
})();
</script>
${FOOTER}
</body>
</html>
`;
  return head(t.title, desc, url, ld) + body;
}

// ---------------------------------------------------------------------------
// prices.html is committed, but every fare row in it is a pure function of the
// rate tables above - 752 rows across six tables, all of them derived. Nothing
// regenerated it, which is how it went stale twice: a suburb count, a cruise
// "from" price, and a vehicle name that had been retired. So rebuild its table
// bodies here at deploy time, the same way sitemap.xml is rewritten below, and
// the page can no longer disagree with the engine that quotes the fares.
// ---------------------------------------------------------------------------
function pricesRows() {
  const row = (name, r) => '        <tr><th scope="row">' + esc(name) + '</th>'
    + r.map((v) => '<td>' + money(v) + '</td>').join('') + '</tr>';
  /* BM_SUBURB and LD_SUBURB do not exist in this file - the page builders
     iterate BM_ZONE and LD_ZONE directly - so derive the name -> zone maps here
     rather than assuming the shape index.html and stripe-server.js happen to use. */
  const bmSub = {}; Object.keys(BM_ZONE).forEach((z) => BM_ZONE[z].forEach((s) => { bmSub[s] = z; }));
  const ldSub = {}; Object.keys(LD_ZONE).forEach((z) => LD_ZONE[z].forEach((s) => { ldSub[s] = z; }));
  const gc = Object.keys(SUBURBS).sort();
  const bmn = Object.keys(bmSub).sort();
  const ldn = Object.keys(ldSub).sort();
  return {
    ool:   gc.map((n) => row(n, OOL_RATES[SUBURBS[n][0]])),
    gcbne: gc.map((n) => row(n, BNE_RATES[SUBURBS[n][1]])),
    bne:   bmn.map((n) => row(n, BM_RATES[bmSub[n]])),
    bmool: bmn.filter((n) => BM_OOL_SUBURB[n]).map((n) => row(n, BM_OOL_RATES[BM_OOL_SUBURB[n]])),
    ldbne: ldn.filter((n) => LD_BNE_RATES[ldSub[n]]).map((n) => row(n, LD_BNE_RATES[ldSub[n]])),
    ldool: ldn.filter((n) => LD_OOL_RATES[ldSub[n]]).map((n) => row(n, LD_OOL_RATES[ldSub[n]])),
  };
}

function refreshPrices() {
  const file = path.join(ROOT, 'prices.html');
  let html;
  try { html = fs.readFileSync(file, 'utf8'); }
  catch (e) { console.warn('build-suburbs: no prices.html, skipping the price list'); return; }
  const rows = pricesRows();
  const COLS = '<thead><tr><th scope="col">Suburb</th>'
    + VEH_T.map((v) => '<th scope="col">' + esc(v[0]) + '</th>').join('') + '</tr></thead>';

  /* Brisbane -> Gold Coast Airport is a newer table than the page, so add it
     once, immediately after the Brisbane -> Brisbane Airport one. */
  if (!/id="bmool"/.test(html)) {
    const after = /(<div class="tbl-scroll">\s*<table class="pricetable" id="bne">[\s\S]*?<\/table>\s*<\/div>\n)/;
    if (!after.test(html)) throw new Error('prices.html: cannot find the #bne table to insert after');
    html = html.replace(after, (m, block) => block + [
      '',
      '  <div class="tbl-scroll">',
      '    <table class="pricetable" id="bmool">',
      '      <caption>Brisbane &amp; surrounds &rarr; Gold Coast Airport (OOL) &mdash; one way</caption>',
      '      ' + COLS,
      '      <tbody>',
      '      </tbody>',
      '    </table>',
      '  </div>',
      '  <p class="fine" style="margin-top:-8px">',
      '    Measured road distance to Gold Coast Airport sets the band, which is why these do not',
      '    follow the Brisbane Airport order above: Logan and Beenleigh are closest to OOL and the',
      '    cheapest, while the inner north is among the dearest. Caboolture, Bribie Island and',
      '    Grandchester are quoted by hand rather than listed &mdash;',
      '    <a href="tel:+61481437772">call us</a> and we fix the price before you book.',
      '  </p>',
      '',
    ].join('\n'));
  }

  for (const id of Object.keys(rows)) {
    const re = new RegExp('(id="' + id + '"[\\s\\S]*?<tbody>\\n)[\\s\\S]*?(      </tbody>)');
    if (!re.test(html)) throw new Error('prices.html: no table body for #' + id);
    /* A function replacer, not a string: every row contains text like
       "<td>$225</td>", and in a replacement string $2 means capture group 2. */
    html = html.replace(re, (m, open, close) => open + rows[id].join('\n') + '\n' + close);
    /* The header too, from the same vehicle list, so an added column in the
       rows can never sit under a shorter header (it did, briefly, when the
       18-seater got fares on 3 Nov 2026). Bounded to this one table. */
    const th = new RegExp('(id="' + id + '"(?:(?!</table>)[\\s\\S])*?)<thead>[\\s\\S]*?</thead>');
    if (!th.test(html)) throw new Error('prices.html: no header for #' + id);
    html = html.replace(th, (m, open) => open + COLS);
  }
  const got = (html.match(/<tr><th scope="row">/g) || []).length;
  const want = Object.keys(rows).reduce((a, k) => a + rows[k].length, 0);
  if (got !== want) throw new Error('prices.html: wrote ' + got + ' rows, expected ' + want);
  fs.writeFileSync(file, html);
  console.log('build-suburbs: prices.html refreshed, ' + got + ' fare rows across '
    + Object.keys(rows).length + ' tables');
}

// ---------------------------------------------------------------------------
// Coverage figures. These used to be typed into each page by hand, which is how
// the site came to quote 223, 274, 298, 370 and 421 for the same two numbers --
// the partner page was understating coverage by 123 destinations. They are
// generated here instead, the same way prices.html has its fare rows rebuilt
// above, so a number can only be wrong if the fare tables themselves are.
//
// A page opts in by marking the figure: 421<!--c:total--> destinations. The
// comment renders as nothing, so the markup a reader sees is unchanged.
//   c:total -> every priced destination
//   c:bne   -> destinations in the Brisbane region
//   c:ool   -> destinations in the Gold Coast region
// ---------------------------------------------------------------------------
function refreshCounts() {
  const counts = {
    total: places.length,
    bne: places.filter((p) => p.region === 'Brisbane').length,
    ool: places.filter((p) => p.region === 'Gold Coast').length,
  };
  /* llms.txt quotes the total twice and had drifted (421 against 422). */
  try {
    const lf = path.join(ROOT, 'llms.txt'), lt = fs.readFileSync(lf, 'utf8');
    const ln = lt.replace(/\b\d{3}(?= destinations\b)/g, String(counts.total));
    if (ln !== lt) fs.writeFileSync(lf, ln);
  } catch (e) { console.warn('build-suburbs: llms.txt count not refreshed (' + e.message + ')'); }
  const files = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'));
  /* The region pages are written by this script a few lines above, so their
     own figures are already generated and must not be reported as drift.
     A figure that is deliberately page-specific marks itself c:skip. */
  const generated = new Set(REGIONS.map((r) => r.slug + '.html'));
  let written = 0, marks = 0, unmarked = [];
  for (const f of files) {
    const p = path.join(ROOT, f);
    const before = fs.readFileSync(p, 'utf8');
    const after = before.replace(/\d+(?=<!--c:(total|bne|ool)-->)/g, (m, key) => {
      marks++;
      return String(counts[key]);
    });
    /* A figure that looks like coverage but carries no marker is the next drift
       waiting to happen. Warn rather than throw: a copy edit should not be able
       to fail a deploy, but it should be impossible to miss in the log. */
    if (!generated.has(f)) {
      const re = /(?<!\d)(\d{2,4})\s+(destinations|suburbs)\b/g;
      let m;
      while ((m = re.exec(after)) !== null) {
        if (after.slice(m.index, m.index + 40).indexOf('<!--c:') === -1) {
          unmarked.push(f + ': "' + m[0] + '"');
        }
      }
    }
    if (after !== before) { fs.writeFileSync(p, after); written++; }
  }
  console.log('build-suburbs: coverage figures refreshed, ' + marks + ' marker(s) in '
    + files.length + ' pages (total ' + counts.total + ', Brisbane ' + counts.bne
    + ', Gold Coast ' + counts.ool + '), ' + written + ' file(s) rewritten');
  if (unmarked.length) {
    console.warn('build-suburbs: WARNING unmarked coverage figures, these will drift:');
    for (const u of unmarked) console.warn('  ' + u);
  }
}

// ---------------------------------------------------------------------------
// fares.json - the published price list as machine-readable data
//
// Written because AI assistants are booking these transfers. A customer's
// assistant found the fares, filled the form, and could not pay by card, which
// is the assistant behaving correctly: entering someone else's card details is
// off-limits for a responsibly built agent. To price one trip such an assistant
// otherwise has to scrape 421 HTML pages. This is one fetch instead.
//
// Generated from the same tables as every page, so it cannot drift from what
// the booking widget quotes. Nothing in it is personal or secret - it is the
// price list already published on prices.html, in a shape a machine can read.
// ---------------------------------------------------------------------------
const CRUISE_PLACE = 'Brisbane Cruise Terminal (Pinkenba)';

function writeFaresJson() {
  /* A deep link only pre-fills if the name matches index.html's PLACES exactly,
     and a wrong one fails silently - the form just opens empty. Plain substring
     checks rather than a parse, so there is no regex here to get wrong. */
  for (const place of [OOL, BNE, CRUISE_PLACE]) {
    if (indexHtml.indexOf(place) === -1) {
      throw new Error('fares.json: "' + place + '" is not in index.html, so its deep link would not pre-fill');
    }
  }

  const vehicles = VEH_T.map(([name, cap]) => {
    /* '1-3 passengers - 2 bags' and 'up to 10 passengers - 11 bags' both end
       [..., maxPassengers, bags], so read from the right and the two shapes
       need no special-casing. */
    const n = (cap.match(/\d+/g) || []).map(Number);
    return { name, max_passengers: n[n.length - 2] || null, bags: n[n.length - 1] || null };
  });

  const rows = [];
  for (const p of places) {
    const d = { name: p.name, region: p.region, nearest: p.nearest, page: SITE + p.url, fares: {} };
    for (const k of ['ool', 'bne', 'cruise']) if (p.fares[k]) d.fares[k] = p.fares[k];
    const km = {}, minutes = {};
    for (const k of ['ool', 'bne']) {
      if (p.facts[k] && p.facts[k].m) km[k] = Math.round(p.facts[k].m / 100) / 10;
      if (p.facts[k] && p.facts[k].s) minutes[k] = Math.round(p.facts[k].s / 60);
    }
    if (Object.keys(km).length) d.km = km;
    if (Object.keys(minutes).length) d.minutes = minutes;
    rows.push(JSON.stringify(d));
  }

  const head = {
    about: 'Published fixed fares for Sky Transfers, Gold Coast and Brisbane, Australia. '
         + 'Generated from the booking engine on every deploy, so these are the same prices '
         + 'the booking form quotes.',
    /* A real build timestamp, not LASTMOD. This file is rebuilt on every
       deploy, so dating it from the template constant would tell a reader it
       was stale when it is not - and the lie would grow with every month. */
    generated: new Date().toISOString(),
    currency: 'AUD',
    basis: 'Per vehicle, one way, GST and road tolls included. Not per person.',
    surge: 'None. The same fare applies at any hour, including nights, weekends and public holidays.',
    /* Stated as a formula, not just a sentence, so an assistant can price a
       return itself instead of guessing or asking. Must match RETURN_DISCOUNT
       in stripe-server.js and index.html. */
    return_trips: {
      available: true,
      discount_percent: 10,
      formula: 'round(one_way_fare * 2 * 0.9)',
      basis: 'Both legs of a return are the same fare, and the pair is discounted 10%. '
           + 'Booked as one booking, with its own return date and time. Child seats and '
           + 'the luggage trailer are charged per leg, and are not discounted.',
      example: { one_way: 80, return_total: 144, saved: 16 },
    },
    /* Neither of these is derived from the airport tables, so they are stated
       here and MUST match p2p-fare.js (ladders, adders, loading) and
       HOURLY_RATES in stripe-server.js / index.html. The quote endpoint is
       the authority for an exact point-to-point figure. */
    point_to_point: {
      available: true,
      how: 'Any two addresses on the Gold Coast or in Brisbane, neither an airport nor the cruise terminal. '
         + 'Measured road distance is snapped into a band; each vehicle class adds a flat amount. '
         + 'Not a meter: the time of day and traffic never change it.',
      quote_endpoint: 'https://sky-transfers-booking-server.onrender.com/p2p-quote',
      quote_request_example: { pickup: { suburb: 'Surfers Paradise', address: 'Surfers Paradise QLD, Australia' },
                               dropoff: { suburb: 'Broadbeach', address: 'Broadbeach QLD, Australia' } },
      sedan_by_road_km: {
        gold_coast: P2P.gc,
        brisbane:   P2P.bne,
        note: 'Each pair is [up to km, sedan fare]. A trip with one end in each city uses the Brisbane ladder. Beyond 85 km is quoted by hand.',
      },
      class_adders_in_fares_array_order: P2P.adders.concat([null]),
      outer_zone_loading: P2P.loading,
      minimum_fare: 80,
      returns: 'Same 10% formula as airport transfers.',
      page: SITE + '/point-to-point-transfers.html',
    },
    hourly_hire: {
      available: true,
      how: 'Chauffeur and vehicle as directed, booked from the form by choosing "By the hour". Rate per hour by vehicle class, no evening loading.',
      min_hours: 3, max_hours_online: 6,
      rate_per_hour_in_fares_array_order: HOURLY.concat([null]),
      prefill_url: SITE + '/?hours={hours}&pu={pickup}#book',
      longer: 'Half and full days are charters: ' + SITE + '/charters.html',
    },
    fares_array_order: VEH_T.map((v) => v[0]),
    vehicles,
    hubs: [
      { key: 'ool', code: 'OOL', name: 'Gold Coast Airport', booking_name: OOL },
      { key: 'bne', code: 'BNE', name: 'Brisbane Airport', booking_name: BNE },
      { key: 'cruise', code: null, name: 'Brisbane International Cruise Terminal, Pinkenba', booking_name: CRUISE_PLACE },
    ],
    cruise_terminal_surcharge: CRUISE_EXTRA,
    booking: {
      no_card_required: true,
      how: 'A booking can be requested without any payment, using the "Request booking - pay later" '
         + 'button. An assistant booking on behalf of a traveller should use that and leave payment '
         + 'to the traveller, rather than the card form.',
      prefill_url: SITE + '/?pu={pickup}&do={dropoff}#book',
      prefill_example: SITE + '/?pu=Surfers%20Paradise&do=Brisbane%20Airport%20(BNE)#book',
      required_fields: ['pickup', 'dropoff', 'vehicle', 'date', 'time', 'passengers',
                        'address', 'name', 'phone', 'email'],
      optional_fields: ['flight', 'childSeats', 'trailer', 'notes'],
      minimum_notice_hours: 6,
      timezone: 'Australia/Brisbane, UTC+10 all year - Queensland has no daylight saving',
      booking_regularly: SITE + '/partners.html',
    },
    not_listed_here: 'Anything absent is quoted by hand, including destinations beyond about 140 km '
                   + 'from Gold Coast Airport. Call +61 481 437 772 or email info@skytransfers.com.au.',
    destinations_count: rows.length,
  };

  /* Envelope pretty-printed and one destination per line: legible if a person
     opens it, still compact across 400-odd rows. JSON.stringify(_, null, 2)
     always ends "\n}", so dropping those two characters leaves a valid object
     to append to. */
  const headJson = JSON.stringify(head, null, 2);
  const json = headJson.slice(0, -2)
    + ',\n  "destinations": [\n    ' + rows.join(',\n    ') + '\n  ]\n}\n';

  if (!rows.length) throw new Error('fares.json: no destinations');
  fs.writeFileSync(path.join(ROOT, 'fares.json'), json);
  console.log('build-suburbs: fares.json written, ' + rows.length + ' destinations, '
    + Math.round(json.length / 1024) + ' KB');
}

// ---------------------------------------------------------------------------
// blog: articles posted by the content service become static pages under
// /blog/, beside the hand-written ones. The feed lives on the booking server
// (blog-feed.js); this reads it at build time and writes real HTML, so the
// articles are served from the CDN on the real domain like everything else.
// ---------------------------------------------------------------------------
const BLOG_DIR  = path.join(ROOT, 'blog');
const BLOG_FEED = process.env.BLOG_FEED_URL
  || 'https://sky-transfers-booking-server.onrender.com/api/articles.json';

/* Same rules as blog-feed.js. The slug becomes a filename, and a build is the
   worst place to discover you trusted one. */
const blogSlug = (s) => {
  const v = String(s || '').toLowerCase().trim()
    .replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
  return v && v.length <= 120 && v !== 'index' ? v : null;
};

/* The body is written by an outside service and is about to be served from
   skytransfers.com.au, so it is cut down to tags that cannot execute.
   Everything else on these pages goes through esc(); the body is the one
   field that has to stay HTML. */
const safeHtml = (s) => String(s || '')
  /* Paired first, with their contents: stripping only the tags would leave the
     script's source sitting in the page as visible text. */
  .replace(/<\s*(script|style|iframe|object|embed|form|svg|noscript|template)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
  .replace(/<\s*\/?\s*(script|iframe|object|embed|form|input|link|meta|base|style|svg|noscript|template)\b[^>]*>/gi, '')
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
  .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
  .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '')
  .replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1=$2#$2');

const longDate = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  if (!m) return null;
  const months = ['January','February','March','April','May','June','July',
                  'August','September','October','November','December'];
  return `${Number(m[3])} ${months[Number(m[2]) - 1]} ${m[1]}`;
};

/* ---- fixes to fed articles (26 Oct 2026, after an audit of all of them) ----
   Applied here, at build time, so an article the content service sends again
   cannot undo them, and every future article gets the same treatment.
   1. Its "Book" buttons all pointed at the bare homepage. They now open the
      booking form with the article's own route filled in (index.html reads
      ?pu= and ?do= and accepts only names on its own place list).
   2. Links the service aimed at the wrong page are re-pointed, by the
      article and the link's words; one wrong fare is corrected.
   3. Each article ends with links to suburb pages for its area and to three
      other articles, so no article is left with nothing pointing at it. */
const BOOK_END = { bne: 'Brisbane Airport (BNE)', ool: 'Gold Coast Airport (OOL)', cruise: 'Brisbane Cruise Terminal (Pinkenba)',
                   cbd: 'Brisbane CBD', surfers: 'Surfers Paradise' };
/* The audit's own choice of route per article (26 Oct 2026); any article not
   listed falls back to the keyword guess below. */
const BOOK_ROUTE = {
  'avoid-surge-pricing-airport-rides': [null, 'bne'], 'book-private-airport-transfer-gold-coast': ['ool', 'surfers'],
  'booking-private-transport-brisbane-cruise-terminal': ['bne', 'cruise'], 'brisbane-airport-chauffeur-to-city': ['bne', 'cbd'],
  'early-morning-brisbane-airport-transfer': [null, 'bne'], 'fixed-price-airport-transfers-brisbane-benefits': [null, 'bne'],
  'gold-coast-airport-chauffeur-with-meet-and-greet': ['ool', null], 'gold-coast-airport-transfer-car-seats': ['ool', 'surfers'],
  'gold-coast-airport-transfer-how-to-get-from-gold-coast-airport-to-hotel': ['ool', 'surfers'],
  'gold-coast-airport-transport-options-with-luggage': ['ool', null], 'guaranteed-on-time-airport-chauffeur-service-guide': [null, 'bne'],
  'how-to-book-reliable-airport-transfers': [null, null], 'real-time-flight-tracking-airport-transfers': ['bne', null],
  'reliable-airport-pickup-brisbane-flight-tracking': ['bne', null], 'safe-airport-transport-for-families': ['ool', null],
  'seamless-airport-transfers-for-cruise-passengers': ['bne', 'cruise'], 'what-happens-if-flight-delayed': ['bne', null],
  'wheelchair-airport-transfers-chauffeur-service': [null, null],
};
/* group days out, not airport runs: quoted, not priced by the booking form */
const isGroupDay = (a) => { const t = (String(a.slug || '') + ' ' + String(a.title || '')).toLowerCase();
  return /christmas|winer|charter|party|hens|bucks|day.tour/.test(t) && !/airport/.test(t); };
const GROUP_QUOTE = '/charters.html#quote';
function bookLinkFor(a) {
  if (isGroupDay(a)) return GROUP_QUOTE;
  const t = (String(a.slug || '') + ' ' + String(a.title || '')).toLowerCase();
  const link = (pu, dro) => '/?' + [pu ? 'pu=' + encodeURIComponent(BOOK_END[pu]) : '', dro ? 'do=' + encodeURIComponent(BOOK_END[dro]) : '']
    .filter(Boolean).join('&') + '#book';
  const r = BOOK_ROUTE[a.slug];
  if (r) return r[0] || r[1] ? link(r[0], r[1]) : '/#book';
  if (/cruise/.test(t)) return link('bne', 'cruise');
  if (/gold.coast.to.brisbane/.test(t)) return link(null, 'bne');
  if (/brisbane/.test(t) && /\bcity\b|cbd/.test(t)) return link('bne', 'cbd');
  if (/brisbane/.test(t) && !/gold.coast/.test(t)) return link('bne', null);
  if (/gold.coast|surfers|coolangatta|ool\b/.test(t)) return link('ool', /surfers|hotel/.test(t) ? 'surfers' : null);
  return '/#book';
}
/* [article slug, the link's words, where it should go, and - when the same
   words appear more than once - the page it wrongly points at now]. From the
   26 Oct 2026 audit (Downloads/Sky-Website-Audit-for-Claude.txt). */
const ARTICLE_LINK_FIX = [
  ['gold-coast-airport-chauffeur-with-meet-and-greet', 'Brisbane or the Cruise Terminal', '/cruise-transfers.html'],
  ['real-time-flight-tracking-airport-transfers', 'airport transfers', '/brisbane-airport-transfers.html'],
  ['guaranteed-on-time-airport-chauffeur-service-guide', 'Gold Coast and Brisbane suburbs', '/airport-transfers/'],
  ['guaranteed-on-time-airport-chauffeur-service-guide', 'private transfer', '/chauffeur-service.html'],
  ['avoid-surge-pricing-airport-rides', 'airport ride', '/brisbane-airport-transfers.html'],
  ['avoid-surge-pricing-airport-rides', 'fixed-price airport', '/blog/fixed-price-airport-transfers-brisbane-benefits.html'],
  ['fixed-price-airport-transfers-brisbane-benefits', 'Brisbane Airport', '/brisbane-airport-transfers.html', '/blog/early-morning-brisbane-airport-transfer'],
  ['fixed-price-airport-transfers-brisbane-benefits', 'corporate function', '/corporate-transfers.html'],
  ['seamless-airport-transfers-for-cruise-passengers', 'Brisbane airport to cruise terminal transfer', '/blog/brisbane-airport-to-cruise-terminal.html'],
  ['how-to-book-reliable-airport-transfers', 'airport transfers', '/brisbane-airport-transfers.html'],
  ['how-to-book-reliable-airport-transfers', 'airport transfer', '/gold-coast-airport-transfers.html'],
  ['book-private-airport-transfer-gold-coast', 'Gold Coast Airport', '/gold-coast-airport-transfers.html', '/blog/gold-coast-airport-transfer-car-seats'],
  ['brisbane-airport-chauffeur-to-city', 'Brisbane Airport', '/brisbane-airport-transfers.html', '/blog/brisbane-airport-to-cruise-terminal'],
  ['early-morning-brisbane-airport-transfer', 'Brisbane Airport', '/brisbane-airport-transfers.html', '/blog/brisbane-airport-domestic-or-international-pickup'],
  ['reliable-airport-pickup-brisbane-flight-tracking', 'airport transfers', '/brisbane-airport-transfers.html'],
];
/* outbound links that went somewhere unhelpful, in any article */
const ARTICLE_HREF_FIX = [
  ['https://www.airservicesaustralia.com/careers/air-traffic-control-careers/', 'https://www.airservicesaustralia.com/tag/delays/'],
  ['https://streetsmarts.initiatives.qld.gov.au/road-rules/child-restraints', 'https://www.qld.gov.au/transport/safety/rules/children'],
];
/* [article slug, exact words, the words that replace them] */
const ARTICLE_TEXT_FIX = [
  ['brisbane-airport-chauffeur-to-city', 'with indicative sedan fares of $90-$140 one way', 'with a fixed sedan fare of $95 one way'],
  ['brisbane-airport-chauffeur-to-city', '>$90-$140</td>', '>$95 (fixed)</td>'],
  ['brisbane-airport-chauffeur-to-city', '>$140-$220</td>', '>$110 people mover (fixed)</td>'],
  /* meet-and-greet article: the site's own fares, booking and waiting (28 Oct 2026) */
  ['gold-coast-airport-chauffeur-with-meet-and-greet',
    'We quote each job on distance, vehicle class, passenger numbers and any extras such as a child seat. Pricing depends on those factors, so the honest answer is to request a quote for your specific trip rather than trust a generic figure. What we can promise is the structure: no surge fees, no hidden charges, and free cancellation up to 24 hours before pickup.',
    'Every suburb has a published fixed fare for every vehicle, from $80 in a sedan, and the booking form shows the same price instantly. <a href="/prices.html">See every fare</a>. There are no surge fees, no hidden charges, and free cancellation up to 24 hours before pickup.'],
  ['gold-coast-airport-chauffeur-with-meet-and-greet',
    'We take bookings by phone, email or WhatsApp,',
    'Book online for an instant fixed price, or by phone, email or WhatsApp,'],
  ['gold-coast-airport-chauffeur-with-meet-and-greet',
    'Confirm before booking whether the service includes the first 60 minutes of waiting free,',
    'Confirm before booking how long waiting is free after landing (we include 30 minutes for domestic flights, and 60 for international arrivals),'],
  ['gold-coast-airport-chauffeur-with-meet-and-greet',
    'The same applies to accessibility requirements: state them upfront so the right vehicle and driver are assigned.',
    'The same applies to accessibility requirements: state them upfront. Foldable wheelchairs travel free; if you need to stay seated in your wheelchair, call before booking.'],
  ['real-time-flight-tracking-airport-transfers',
    'The sequence below is the one we follow, with the decision rules',
    'The sequence below is the one we recommend, with the decision rules'],
  ['real-time-flight-tracking-airport-transfers',
    '<li>Is the wait different for domestic and international flights?</li>\n</ul>\n',
    '<li>Is the wait different for domestic and international flights?</li>\n</ul>\n<p>With us, waiting is free for 30 minutes after actual landing, or 60 minutes for international arrivals.</p>\n'],
  ['guaranteed-on-time-airport-chauffeur-service-guide',
    'Ask what yours includes, and what happens if you run over.',
    'Ask what yours includes, and what happens if you run over. With us, waiting is free for 30 minutes after actual landing, or 60 minutes for international arrivals.'],
  ['guaranteed-on-time-airport-chauffeur-service-guide',
    'Book with Sky Transfers and lock in a pickup you can count on.',
    'Book with Sky Transfers and lock in a pickup you can count on. Our <a href="/terms.html">terms</a> set out exactly what happens if something goes wrong: if we cannot supply your booked vehicle, we send a suitable alternative or refund the fare in full.'],
  ['early-morning-brisbane-airport-transfer',
    'Sky Transfers builds pricing this way: upfront, with no surge fees, so the quote you receive is the price you pay.',
    'Sky Transfers builds pricing this way: upfront, with no surge fees, so the quote you receive is the price you pay. There is no night or early-morning loading either: a 4am pickup costs the same as one at midday.'],
  ['early-morning-brisbane-airport-transfer',
    'Sky Transfers handles bookings by phone, email, or WhatsApp, with free cancellation up to 24 hours before pickup.',
    'Sky Transfers takes bookings online with an instant fixed price, or by phone, email or WhatsApp, with free cancellation up to 24 hours before pickup. Online bookings close 6 hours before pickup, so for anything sooner, call <a href="tel:+61481437772">+61 481 437 772</a>.'],
  ['how-to-book-reliable-airport-transfers',
    'Extras like child seats, meet and greet, or additional stops may incur a fee, so clarify upfront.',
    'Meet and greet is always included, child seats are $15 each, and any extras are added to the fixed price before you pay, never on the day.'],
  ['reliable-airport-pickup-brisbane-flight-tracking',
    'Sky Transfers provides free cancellation when flights are cancelled by the airline. When you rebook your flight, you can rebook your transfer at the same time.',
    'If your flight is cancelled, call us straight away. Changes and cancellation are free up to 24 hours before pickup, and inside 24 hours we will do our best to move your booking to your new flight.'],
  ['reliable-airport-pickup-brisbane-flight-tracking',
    '<p>Brisbane Airport has designated pickup zones for each terminal. Domestic arrivals use the Level 2 pickup zone on the eastern side of the terminal building. International arrivals use the Level 2 zone on the western side.</p>\n<p>Your driver will not park in the pickup zone. Instead, they\'ll circle or wait in the holding area until you\'re ready.</p>\n',
    ''],
  ['reliable-airport-pickup-brisbane-flight-tracking',
    'Sky Transfers includes complimentary waiting time with every booking.',
    'Sky Transfers includes free waiting with every airport pickup: 60 minutes after landing for international arrivals, and 30 minutes for domestic.'],
  ['reliable-airport-pickup-brisbane-flight-tracking',
    'You can book via phone, email, or WhatsApp, whichever suits you best.',
    'You can book online for an instant fixed price, or by phone, email or WhatsApp, whichever suits you best.'],
  ['reliable-airport-pickup-brisbane-flight-tracking',
    'A few hours before your flight, you\'ll get a reminder. This is the time to confirm your arrival time or notify us of any changes.',
    'Before you land, you\'ll have your chauffeur\'s name and mobile number. If your plans change, tell us as soon as you can.'],
  ['reliable-airport-pickup-brisbane-flight-tracking',
    'As you approach landing, you\'ll receive an update confirming your driver is en route or already positioned at the terminal. ',
    ''],
  ['seamless-airport-transfers-for-cruise-passengers',
    'The Overseas Passenger Terminal sits at Circular Quay, on the western edge of the central business district. It handles the largest ships and puts you within walking distance of the Rocks and the ferry wharves.',
    'The Brisbane International Cruise Terminal is at Pinkenba, on the airport side of the river, about 10 minutes by road from Brisbane Airport. Our fixed fare from the airport is $95 in a sedan, with no cruise surcharge on this run.'],
  ['seamless-airport-transfers-for-cruise-passengers',
    'From the international terminal to the cruise terminal, allow 30 to 45 minutes in normal traffic and 60 to 75 minutes in the morning peak.',
    'From Brisbane Airport to the cruise terminal is about 10 minutes by road. From the Gold Coast, allow 50 to 85 minutes, and 90 minutes or more on embarkation morning.'],
  ['seamless-airport-transfers-for-cruise-passengers',
    'At the international terminal, the meeting point is usually just outside the customs exit; at the domestic terminals, it is the kerbside pick-up zone outside baggage reclaim.',
    'With Sky Transfers, your chauffeur waits inside the arrivals hall with a name board, at both the international and domestic terminals.'],
  ['booking-private-transport-brisbane-cruise-terminal',
    'Peak demand windows',
    'Nothing, with us'],
  ['booking-private-transport-brisbane-cruise-terminal',
    'Early morning and turnaround days carry premiums',
    'No early-morning, weekend or public-holiday loading'],
  ['booking-private-transport-brisbane-cruise-terminal',
    'Whether a return leg is held',
    'Book both legs together'],
  ['booking-private-transport-brisbane-cruise-terminal',
    'Return transfers are usually quoted separately',
    'Both legs 10% off when booked as a return on our website'],
  ['booking-private-transport-brisbane-cruise-terminal',
    'For current rates, request a quote with your address and group details rather than relying on any published estimate.',
    'Our fares are published: Brisbane Airport to the terminal is $95 in a sedan, the Brisbane CBD $120 and Surfers Paradise $270, and <a href="/prices.html">every suburb is on the price list</a>.'],
  ['booking-private-transport-brisbane-cruise-terminal',
    'usually a small per-seat charge, and worth confirming the seat type.</li>\n</ul>\n',
    'usually a small per-seat charge, and worth confirming the seat type.</li>\n</ul>\n<p>With Sky Transfers there is no out-of-hours or public-holiday loading, and child seats are $15 each.</p>\n'],
  ['booking-private-transport-brisbane-cruise-terminal',
    'Send your travel details through the enquiry form, by phone or via WhatsApp.',
    'Book online for an instant fixed price, or send your details by phone, email or WhatsApp.'],
  ['booking-private-transport-brisbane-cruise-terminal',
    'Pricing depends on pickup suburb, vehicle size, passenger numbers and time of day, so there is no single flat rate.',
    'Pricing depends on your pickup suburb and vehicle, not the time of day: from Brisbane Airport it is $95 in a sedan, and every suburb has a published fare.'],
  ['booking-private-transport-brisbane-cruise-terminal',
    'Request a quote for current rates.',
    'See every fare on the <a href="/prices.html">price list</a>.'],
  ['book-private-airport-transfer-gold-coast',
    'include a waiting window at no extra cost.',
    'include a waiting window at no extra cost: 30 minutes after landing for domestic flights, and 60 for international arrivals.'],
  ['book-private-airport-transfer-gold-coast',
    'Not every operator runs accessible vehicles, so confirm availability before you pay rather than assuming it can be arranged.',
    'Not every operator runs accessible vehicles, so confirm availability before you pay rather than assuming it can be arranged. We don\'t: foldable wheelchairs and walkers travel free, but if you need to stay seated in your wheelchair, call before booking.'],
  ['brisbane-airport-chauffeur-to-city',
    'A quote that excludes these is not dishonest, but you want to know before you travel, not at the kerb.',
    'A quote that excludes these is not dishonest, but you want to know before you travel, not at the kerb. With Sky Transfers, tolls and GST are always included in the fare.'],
  ['brisbane-airport-chauffeur-to-city',
    'A city hotel is a standard zone; a suburban address, the ',
    'A city hotel is a standard zone; with some operators a suburban address, the '],
  ['brisbane-airport-chauffeur-to-city',
    ' or a regional destination sits outside it and is quoted separately.',
    ' or a regional destination is quoted separately. With us, every suburb and the cruise terminal has a published fixed fare.'],
  ['brisbane-airport-chauffeur-to-city',
    'ask how much free waiting time is included after landing.',
    'ask how much free waiting time is included after landing. With us, waiting is free for 60 minutes after landing on international arrivals and 30 on domestic.'],
  ['gold-coast-airport-transfer-how-to-get-from-gold-coast-airport-to-hotel',
    'We do not publish a rate card here because every quote depends on your route and group. Request a quote and you get one fixed figure, GST and tolls included.',
    'Our fares are published. From Gold Coast Airport in a sedan: Surfers Paradise $125, Broadbeach $110, Burleigh Heads $95 and Coolangatta $80, with GST and tolls included, and <a href="/prices.html">every suburb is on the price list</a>.'],
  ['gold-coast-airport-transfer-how-to-get-from-gold-coast-airport-to-hotel',
    'Gold Coast Airport transfer prices depend on distance, vehicle size, time of day and whether you choose meet and greet.',
    'Gold Coast Airport transfer prices depend on distance and vehicle size, and with metered services on the time of day too. With us, the fare is the same at any hour and meet and greet is always included.'],
  ['gold-coast-airport-transfer-how-to-get-from-gold-coast-airport-to-hotel',
    'Child seats, meet and greet and extra stops all affect the total.',
    'Child seats ($15 each with us) and extra stops add to the total; meet and greet does not.'],
  ['gold-coast-airport-transport-options-with-luggage',
    'see meet-and-greet details up front.</p>\n',
    'see meet-and-greet details up front.</p>\n<p>Too many bags for the car? Our luggage trailer takes golf bags, surfboards, prams and oversized cases for $30, and prams, foldable wheelchairs and walkers travel free wherever they fit.</p>\n'],
  ['fixed-price-airport-transfers-brisbane-benefits',
    'and no extra charge if your group is larger than a standard sedan can hold.',
    'and no per-passenger pricing: the fare is per vehicle, so a bigger group simply books a bigger vehicle, priced upfront.'],
  ['fixed-price-airport-transfers-brisbane-benefits',
    'beyond that window, terms vary, so check before you book.',
    'inside 24 hours a cancellation fee of up to the full fare may apply, as set out in our <a href="/terms.html">terms</a>.'],
  ['fixed-price-airport-transfers-brisbane-benefits',
    'Waiting time is usually built around a grace period after landing, giving you time to clear baggage and customs.',
    'Waiting time is usually built around a grace period after landing, giving you time to clear baggage and customs. With us, waiting is free for 60 minutes after landing on international arrivals and 30 on domestic.'],
  ['safe-airport-transport-for-families',
    'Ask whether there is an extra charge per seat</li>\n</ul>\n',
    'Ask whether there is an extra charge per seat</li>\n</ul>\n<p>With us, child seats, capsules and boosters are $15 each, fitted before we arrive. <a href="/child-seats.html">How child seats work</a>.</p>\n'],
  /* no ramp or lift vehicle in the fleet (28 Oct 2026) */
  ['wheelchair-airport-transfers-chauffeur-service', 'Here is the sequence we use, and the one we recommend with any provider.',
    'Here is the sequence we recommend with any provider.'],
  ['wheelchair-airport-transfers-chauffeur-service', 'Tell us your wheelchair type and dimensions when you book so we assign the right vehicle.',
    'Foldable wheelchairs and walkers travel free where they fit. We do not run ramp or lift vehicles, so if you need to stay seated in your wheelchair, call us on <a href="tel:+61481437772">+61 481 437 772</a> before booking and we will tell you honestly what we can arrange.'],
];
/* Recheck 7 (2 Nov 2026): per-article rewrites kept as data, not code -
   [{slug, field, find, replace, all}], field defaulting to content_html.
   Applied to the raw feed before the rest of the build touches it, so the
   ARTICLE_TEXT_FIX entries above still see the text they were written for.
   A find that no longer matches is reported, never fatal: the content
   service may have edited the article since. */
let ARTICLE_FIXES = [];
try { ARTICLE_FIXES = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'article-fixes.json'), 'utf8')); }
catch (e) { console.warn('build-suburbs: no data/article-fixes.json (' + e.message + ')'); }
function applyArticleFixes(a) {
  let missed = 0;
  for (const f of ARTICLE_FIXES) {
    if (f.slug !== a.slug) continue;
    const field = f.field || 'content_html';
    const v = String(a[field] == null ? '' : a[field]);
    if (v.indexOf(f.find) < 0) { missed++; continue; }
    a[field] = f.all ? v.split(f.find).join(f.replace) : v.replace(f.find, () => f.replace);
  }
  if (missed) console.warn(`build-suburbs: ${missed} article fix(es) for ${a.slug} no longer match - check the article`);
  return a;
}
/* A bare "Book" anchor tells neither the reader nor a search engine where it
   goes; name the route the link already carries. */
function bookAnchor(href) {
  const q = String(href).replace(/&amp;/g, '&');
  const pu = (/[?&]pu=([^&#]+)/.exec(q) || [])[1], dro = (/[?&]do=([^&#]+)/.exec(q) || [])[1];
  const nm = (x) => decodeURIComponent(x).replace(/ \((OOL|BNE)\)$/, '').replace(/ \(Pinkenba\)$/, '');
  if (pu && dro) return 'Book ' + nm(pu) + ' to ' + nm(dro);
  if (pu) return 'Book a transfer from ' + nm(pu);
  if (dro) return 'Book a transfer to ' + nm(dro);
  if (/charters\.html#quote/.test(q)) return 'Request a group quote';
  return 'Book an airport transfer';
}
function fixArticle(a) {
  let h = String(a.content_html || '');
  /* The content service's pictures come without a width and height, so the
     text below jumped down when each one arrived (33 articles, 11 Nov 2026).
     Every one of them is 1200 x 675; the inline style already scales them to
     the column (width:100%; height:auto), so the attributes only reserve the
     space. Anything that already states a size is left alone. */
  h = h.replace(/<img\b(?![^>]*\swidth=)([^>]*\ssrc=(["'])https:\/\/cdn\.grandranker\.com\/articles\/[^"']+\2[^>]*)>/gi, '<img width="1200" height="675"$1>');
  const strip = (x) => x.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  h = h.replace(/(<a\b[^>]*?href=)(["'])\s*https?:\/\/(?:www\.)?skytransfers\.com\.au\/?\s*\2/gi, (m, pre, q) => pre + q + esc(bookLinkFor(a)) + q);
  const bare = (u) => String(u || '').replace(/^https?:\/\/(www\.)?skytransfers\.com\.au/i, '').replace(/\.html$/, '');
  for (const [slug, words, to, was] of ARTICLE_LINK_FIX) {
    if (slug !== a.slug) continue;
    h = h.replace(/<a\b([^>]*?)href=(["'])([^"']*)\2([^>]*)>([\s\S]*?)<\/a>/gi,
      (m, pre, q, href, post, inner) => (strip(inner) === words.toLowerCase() && (!was || bare(href) === was)
        ? '<a' + pre + 'href=' + q + to + q + post + '>' + inner + '</a>' : m));
  }
  for (const [from, to] of ARTICLE_HREF_FIX) h = h.split('href="' + from + '"').join('href="' + to + '"');
  if (isGroupDay(a)) h = h.replace(/href=(["'])\/?#book\1/g, 'href=$1' + GROUP_QUOTE + '$1');
  /* /blog/<slug> without .html is a duplicate of the real page */
  h = h.replace(/href=(["'])(?:https?:\/\/(?:www\.)?skytransfers\.com\.au)?\/blog\/([a-z0-9-]+)\1/gi, 'href=$1/blog/$2.html$1');
  /* "Add skytransfers.com.au as a preferred source on Google": an outbound
     link sitting above the booking button - out */
  h = h.replace(/<p\b[^>]*>\s*<a\b[^>]*google\.com\/preferences\/source[^>]*>[\s\S]*?<\/a>\s*<\/p>/gi, '')
       .replace(/<a\b[^>]*google\.com\/preferences\/source[^>]*>[\s\S]*?<\/a>/gi, '');
  for (const [slug, find, rep] of ARTICLE_TEXT_FIX) if (slug === a.slug) {
    if (h.indexOf(find) < 0) console.warn(`build-suburbs: text fix for ${slug} no longer matches - check the article: ${find.slice(0, 60)}`);
    h = h.split(find).join(rep);
  }
  /* Sky is never described as a taxi: the service's "airport taxi with car
     seat" keyword becomes "airport transfer with car seat", in the text and
     in the heading ids and #links built from it. */
  h = h.replace(/\b(airport)(\s+)(taxi)(\s+with\s+(?:an?\s+)?(?:child\s+|baby\s+)?(?:car\s+)?seats?)\b/gi,
      (m, ap, sp, tx, rest) => ap + sp + (tx[0] === 'T' ? 'Transfer' : 'transfer') + rest)
    .replace(/airport-taxi-with-/g, 'airport-transfer-with-');
  /* embedded videos: the player is stripped by safeHtml, so the empty box
     goes too and the video becomes a link out to YouTube */
  h = h.replace(/<div class="video-embed-container[^"]*">\s*<div class="video-embed-wrapper"[^>]*>[\s\S]*?<\/div>\s*<div class="video-info[^"]*">\s*<h4[^>]*>\s*<a href="(https:\/\/(?:www\.)?youtube\.com\/[^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/h4>\s*(?:<p[^>]*>([\s\S]*?)<\/p>\s*)?<\/div>\s*<\/div>/g,
      (m, href, title, src) => '<p class="video-link"><a href="' + href + '" target="_blank" rel="noopener">Watch on YouTube: '
        + title.replace(/\s*#\w+/g, '').replace(/\s*\|[^|]*$/, '').trim() + '</a>' + (src ? ' &mdash; ' + src.trim() : '') + '</p>')
    /* any other shape: just drop the empty player box */
    .replace(/<div class="video-embed-wrapper"[^>]*>\s*(?:<iframe[\s\S]*?<\/iframe>)?\s*<\/div>/g, '');
  /* Recheck 7: the service writes a bordered box whose contents safeHtml
     strips, leaving an empty frame on the page */
  h = h.replace(/<div\s+style="[^"]*border:[^"]*"\s*>\s*<\/div>/gi, '');
  /* never link a competitor (safety net; the article fixes remove the known ones) */
  h = h.replace(/<a\b[^>]*href=["']https?:\/\/(?:www\.)?(?:hughes\.com\.au|carsondemand\.com\.au|con-x-ion\.com|researchgate\.net)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi, '$1');
  h = h.replace(/(<a\b[^>]*href=(["'])([^"']*(?:#book|charters\.html#quote)[^"']*)\2[^>]*>)\s*(?:Book(?:\s+now)?|Get an instant price)\s*(?:&rarr;|→)?\s*(<\/a>)/gi,
    (m, open, q, href, close) => open + bookAnchor(href) + close);
  /* a review count written into an article goes stale the day it is
     published: "4.8 on Google (29 reviews)" keeps the rating, drops the count */
  h = h.replace(/(on Google)\s*(?:\(\d[\d,]*\s+reviews?\)|(?:across|from|over|with)\s+\d[\d,]*\s+reviews?)/gi, '$1');
  return h;
}
const AREA_PLACES = {
  'Gold Coast': ['Surfers Paradise', 'Broadbeach', 'Main Beach', 'Burleigh Heads', 'Coolangatta', 'Southport'],
  'Brisbane': ['Brisbane CBD', 'Fortitude Valley', 'South Brisbane', 'Hamilton', 'Chermside', 'Springfield'],
  'Brisbane cruise': ['Brisbane CBD', 'Fortitude Valley', 'South Brisbane', 'Hamilton', 'New Farm', 'Ascot'],
};
function relatedBlock(a, all) {
  const group = isGroupDay(a);
  const t = (String(a.slug || '') + ' ' + String(a.title || '')).toLowerCase();
  const areas = /cruise/.test(t) && !/gold.coast/.test(t) ? ['Brisbane cruise'] : /brisbane/.test(t) && !/gold.coast/.test(t) ? ['Brisbane'] : /gold.coast|surfers|coolangatta/.test(t) && !/brisbane/.test(t) ? ['Gold Coast'] : ['Gold Coast', 'Brisbane'];
  const per = areas.length === 1 ? 6 : 3;
  const sub = areas.flatMap((ar) => AREA_PLACES[ar].map((n) => places.find((p) => p.name === n)).filter(Boolean).slice(0, per));
  const links = group ? [
    '<a href="/christmas-party-transport-gold-coast.html">Christmas party transport<span>V-Class, Sprinters and the coach</span></a>',
    '<a href="/charters.html">Minibus &amp; coach charters<span>Half and full day rates</span></a>',
    '<a href="/minibus-hire-gold-coast.html">Minibus hire, Gold Coast<span>Fixed fares by suburb</span></a>',
    '<a href="/minibus-hire-brisbane.html">Minibus hire, Brisbane<span>Fixed fares by suburb</span></a>',
    '<a href="/fleet.html">Our fleet<span>Sedan to 53-seat coach</span></a>',
    '<a href="/event-transfers.html">Event transfers<span>Concerts, race days, conferences</span></a>',
  ] : sub.map((p) => `<a href="${esc(p.url)}">${esc(p.name)} airport transfers<span>Fixed fares, both airports</span></a>`);
  if (/seat|famil|child|kid/.test(t)) links.unshift('<a href="/child-seats.html">Child and baby seats<span>Fitted for you, booked online</span></a>');
  const i = all.findIndex((x) => x.slug === a.slug);
  const more = all.length > 1 ? [1, 2, 3].map((k) => all[(i + k) % all.length]).filter((x, j, arr) => x.slug !== a.slug && arr.findIndex((y) => y.slug === x.slug) === j) : [];
  return `
  <h2>Keep reading</h2>
  <div class="related">
    ${links.join('\n    ')}
  </div>
  ${more.length ? `<div class="related">
    ${more.map((x) => `<a href="/blog/${esc(x.slug)}.html">${esc(x.title || x.slug)}<span>Travel guide</span></a>`).join('\n    ')}
  </div>` : ''}`;
}

function blogPage(a, dateIso, dateText, all) {
  const url = `/blog/${a.slug}.html`;
  const title = a.meta_title || a.title || 'Article';
  const desc = a.meta_description || a.subtitle || '';
  const post = {
    '@type': 'BlogPosting',
    headline: a.title || title,
    description: desc,
    url: SITE + url,
    mainEntityOfPage: SITE + url,
    inLanguage: a.language_code || 'en-AU',
    author: { '@type': 'Organization', name: a.author_name || 'Sky Transfers' },
    publisher: { '@id': SITE + '/#business' },
  };
  if (dateIso) { post.datePublished = dateIso; post.dateModified = dateIso; }
  if (a.image_url) post.image = a.image_url;
  /* Breadcrumbs as on every other generated page (linking audit, Oct 2026). */
  const ld = { '@context': 'https://schema.org', '@graph': [post,
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' },
      { '@type': 'ListItem', position: 2, name: 'Blog & travel guides', item: SITE + '/blog/' },
      { '@type': 'ListItem', position: 3, name: a.title || title, item: SITE + url } ] }] };
  /* head() declares every page a website; an article should say so. */
  /* Share previews use the article's own photo when the feed gives a plain
     https URL; anything else keeps the logo. */
  const img = /^https:\/\/[^\s"'<>]+$/.test(String(a.image_url || '')) ? esc(a.image_url) : '';
  let h = head(title, desc, url, ld)
    .replace('<meta property="og:type" content="website">',
             '<meta property="og:type" content="article">');
  if (img) h = h.split(`content="${SITE}/logo.png">`).join(`content="${img}">`);
  return `${h}
<body>
${NAV}

<header class="fares-hero photo" id="top">
  ${heroBg('hero-airport')}
  <div class="hero-in">
  <h1>${esc(a.title || title)}</h1>
  ${a.subtitle ? `<p>${esc(a.subtitle)}</p>` : (desc ? `<p>${esc(desc)}</p>` : '')}
  ${isGroupDay(a) ? `<a class="cta-gold" href="${GROUP_QUOTE}">Get a group quote</a>` : `<a class="cta-gold" href="${esc(bookLinkFor(a))}">${esc(bookAnchor(bookLinkFor(a)))}</a>`}
  </div>
</header>

<div class="lp lp-narrow">
  <p class="fine"><a href="/blog/">&larr; All articles</a>${dateText ? ` &middot; Published ${dateText}` : ''}${a.read_time ? ` &middot; ${esc(a.read_time)}` : ''}</p>

${safeHtml(fixArticle(a))}
${relatedBlock(a, all || [])}

${isGroupDay(a) ? `  <h2>Booking a group day out</h2>
  <div class="related">
    <a href="${GROUP_QUOTE}">Get a group quote<span>Fixed written price, usually within the hour</span></a>
    <a href="/charters.html">Charter rates<span>Half and full day, per vehicle</span></a>
    <a href="/christmas-party-transport-gold-coast.html">Christmas party transport<span>Book early for December</span></a>
  </div>` : `  <h2>Booking a transfer</h2>
  <div class="related">
    <a href="${esc(bookLinkFor(a))}">${esc(bookAnchor(bookLinkFor(a)))}<span>Every suburb, fixed fares</span></a>
    <a href="/prices.html">Every published fare<span>All suburbs, all vehicles</span></a>
    <a href="/blog/">More articles<span>Guides to both airports</span></a>
  </div>`}
</div>
${FOOTER}
</body>
</html>
`;
}

async function writeBlog() {
  let feed;
  try {
    const r = await fetch(BLOG_FEED, { signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    feed = await r.json();
  } catch (e) {
    /* A content service being down must not fail the whole site build. The
       hand-written articles are committed, so /blog/ still works. */
    console.warn('build-suburbs: blog feed unavailable (' + e.message
      + '); /blog/ left exactly as committed');
    return;
  }
  const list = Array.isArray(feed && feed.articles) ? feed.articles : [];
  if (!list.length) { console.log('build-suburbs: blog feed has no articles; /blog/ left as committed'); return; }

  for (const a of list) applyArticleFixes(a);
  fs.mkdirSync(BLOG_DIR, { recursive: true });
  /* Whatever is committed is hand-written and wins. A feed article can add to
     the blog, never quietly rewrite something a person wrote. */
  const committed = new Set(fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith('.html')));
  const cards = [], written = [];
  let skipped = 0;
  /* every feed article, for the "Keep reading" links at the foot of each */
  const related = list.map((x) => ({ slug: blogSlug(x.slug), title: x.title || '' }))
    .filter((x) => x.slug && !committed.has(x.slug + '.html'));

  for (const a of list) {
    const slug = blogSlug(a.slug);
    if (!slug) { skipped++; console.warn('build-suburbs: blog article with an unusable slug skipped'); continue; }
    const file = slug + '.html';
    if (committed.has(file)) { skipped++; console.warn(`build-suburbs: /blog/${file} is hand-written, feed copy skipped`); continue; }
    const dateIso = /^\d{4}-\d{2}-\d{2}$/.test(String(a.published_on || '')) ? a.published_on : null;
    const dateText = longDate(dateIso);
    fs.writeFileSync(path.join(BLOG_DIR, file), blogPage({ ...a, slug }, dateIso, dateText, related));
    written.push({ slug, lastmod: dateIso || LASTMOD });
    cards.push(`  <article class="post-card">
    ${dateText ? `<p class="post-date"><time datetime="${esc(dateIso)}">${esc(dateText)}</time></p>` : ''}
    <h2><a href="/blog/${esc(slug)}.html">${esc(a.title || slug)}</a></h2>
    <p>${esc(a.meta_description || a.subtitle || '')}</p>
    <a class="post-more" href="/blog/${esc(slug)}.html">Read: ${esc(a.title || slug)} &rarr;</a>
  </article>`);
  }

  /* Splice the cards into the committed index between its markers, so the
     hand-written list and its ordering survive untouched. */
  const idxPath = path.join(BLOG_DIR, 'index.html');
  let idx = fs.readFileSync(idxPath, 'utf8');
  const open = '<!--blog:auto-->', close = '<!--/blog:auto-->';
  if (idx.indexOf(open) === -1 || idx.indexOf(close) === -1) {
    console.warn('build-suburbs: blog index markers missing, cards not added');
  } else {
    idx = idx.slice(0, idx.indexOf(open) + open.length)
        + (cards.length ? '\n' + cards.join('\n') + '\n  ' : '\n  ')
        + idx.slice(idx.indexOf(close));
    fs.writeFileSync(idxPath, idx);
  }

  if (written.length) {
    const sm2 = fs.readFileSync(smPath, 'utf8').replace(/\s*<\/urlset>\s*$/,
      '\n' + written.map((w) => `  <url>\n    <loc>${SITE}/blog/${w.slug}.html</loc>\n    <lastmod>${w.lastmod}</lastmod>\n  </url>`).join('\n')
      + '\n</urlset>\n');
    fs.writeFileSync(smPath, sm2);
  }
  console.log(`build-suburbs: blog, ${written.length} article page(s) from the feed, ${skipped} skipped`);
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
for (const r of REGIONS) fs.writeFileSync(path.join(ROOT, r.slug + '.html'), regionPage(r));
for (const a of ATTRACTIONS) fs.writeFileSync(path.join(ROOT, a.slug + '.html'), attractionPage(a));
for (const t of TOURS) fs.writeFileSync(path.join(ROOT, t.slug + '.html'), tourPage(t));
refreshPrices();
refreshCounts();
writeFaresJson();

// sitemap: keep every committed entry, drop any earlier generated ones, append ours
const smPath = path.join(ROOT, 'sitemap.xml');
let sm = fs.readFileSync(smPath, 'utf8');
sm = sm.replace(/\s*<url>\s*<loc>[^<]*\/airport-transfers\/[^<]*<\/loc>[\s\S]*?<\/url>/g, '');
for (const r of REGIONS.concat(ATTRACTIONS, TOURS)) sm = sm.replace(new RegExp('\\s*<url>\\s*<loc>[^<]*/' + r.slug + '\\.html</loc>[\\s\\S]*?</url>', 'g'), '');
const entries = REGIONS.map(r => `  <url>\n    <loc>${SITE}/${r.slug}.html</loc>\n    <lastmod>${LASTMOD}</lastmod>\n  </url>`)
  .concat(ATTRACTIONS.map(a => `  <url>\n    <loc>${SITE}/${a.slug}.html</loc>\n    <lastmod>${a.lastmod || ATTR_LASTMOD}</lastmod>\n  </url>`))
  .concat(TOURS.map(t => `  <url>\n    <loc>${SITE}/${t.slug}.html</loc>\n    <lastmod>${t.lastmod}</lastmod>\n  </url>`))
  .concat([`  <url>\n    <loc>${SITE}/${DIR}/</loc>\n    <lastmod>${LASTMOD}</lastmod>\n  </url>`])
  .concat(places.map(p => `  <url>\n    <loc>${SITE}${p.url}</loc>\n    <lastmod>${LASTMOD}</lastmod>\n  </url>`));
sm = sm.replace(/\s*<\/urlset>\s*$/, '\n' + entries.join('\n') + '\n</urlset>\n');
fs.writeFileSync(smPath, sm);

const withFacts = places.filter(p => p.facts && (p.facts.bne || p.facts.ool)).length;
console.log(`build-suburbs: ${written} suburb pages + hub written to ${DIR}/, ${REGIONS.length} region pages, ${ATTRACTIONS.length} attraction pages and ${TOURS.length} tour page(s) at the root, ${withFacts} with measured drive times; sitemap now has ${(sm.match(/<loc>/g) || []).length} URLs`);
if (written !== places.length) { console.error('build-suburbs: page count mismatch'); process.exit(1); }

/* ---- links from the main pages to the articles (26 Oct 2026, audit "Fix D") ----
   Each page below carries a <!--guides:auto--> marker (the suburb pages too);
   after the articles are written it is filled with links to the ones listed
   for that page that actually exist in /blog/ right now - so an article the
   content service removes can never leave a broken link behind, and a page
   whose articles are all missing simply shows nothing. */
const GUIDES = {
  'gold-coast-airport-transfers.html': ['gold-coast-airport-arrivals-guide', 'gold-coast-airport-chauffeur-with-meet-and-greet', 'gold-coast-airport-transfer-car-seats', 'gold-coast-airport-transport-options-with-luggage', 'getting-to-surfers-paradise-after-midnight', 'gold-coast-airport-surfers-paradise-travel-time'],
  'brisbane-airport-transfers.html': ['brisbane-airport-domestic-or-international-pickup', 'early-morning-brisbane-airport-transfer', 'reliable-airport-pickup-brisbane-flight-tracking', 'what-happens-if-flight-delayed'],
  'brisbane-airport-to-gold-coast.html': ['gold-coast-to-brisbane-airport-what-time-to-leave', 'fixed-price-airport-transfers-brisbane-benefits'],
  'cheapest-gold-coast-to-brisbane-airport.html': ['gold-coast-to-brisbane-airport-what-time-to-leave', 'fixed-price-airport-transfers-brisbane-benefits'],
  'cruise-transfers.html': ['booking-private-transport-brisbane-cruise-terminal', 'seamless-airport-transfers-for-cruise-passengers'],
  'gold-coast-airport-to-surfers-paradise.html': ['gold-coast-airport-transfer-how-to-get-from-gold-coast-airport-to-hotel', 'gold-coast-airport-transport-options-with-luggage', 'book-private-airport-transfer-gold-coast', 'getting-to-surfers-paradise-after-midnight', 'gold-coast-airport-surfers-paradise-travel-time'],
  [DIR + '/surfers-paradise.html']: ['gold-coast-airport-transfer-how-to-get-from-gold-coast-airport-to-hotel', 'gold-coast-airport-arrivals-guide', 'getting-to-surfers-paradise-after-midnight', 'gold-coast-airport-surfers-paradise-travel-time'],
  'corporate-transfers.html': ['how-to-manage-corporate-travel-expenses-for-airport-transport', 'brisbane-airport-chauffeur-corporate-travel'],
  'event-transfers.html': ['party-bus-vs-minibus-winery-tour-transport', 'planning-winery-tour-stops-for-a-group'],
  'minibus-hire-gold-coast.html': ['party-bus-vs-minibus-winery-tour-transport', 'planning-winery-tour-stops-for-a-group'],
  'child-seats.html': ['gold-coast-airport-transfer-car-seats', 'safe-airport-transport-for-families'],
  'chauffeur-service.html': ['guaranteed-on-time-airport-chauffeur-service-guide', 'brisbane-airport-chauffeur-corporate-travel', 'wheelchair-airport-transfers-chauffeur-service', 'gold-coast-airport-chauffeur-with-meet-and-greet', 'real-time-flight-tracking-airport-transfers'],
  'rideshare-or-transfer.html': ['avoid-surge-pricing-airport-rides', 'fixed-price-airport-transfers-brisbane-benefits'],
  'brisbane-cbd-airport-transfers.html': ['brisbane-airport-chauffeur-to-city'],
  [DIR + '/brisbane-cbd.html']: ['brisbane-airport-chauffeur-to-city', 'brisbane-airport-domestic-or-international-pickup'],
  'faq.html': ['what-happens-if-flight-delayed', 'how-to-book-reliable-airport-transfers'],
  /* 10 Nov 2026: 33 of 48 service pages linked to no article, and 11 articles
     were linked from no service page. */
  'partners.html': ['how-do-travel-agents-book-airport-transfers-for-clients', 'how-to-manage-corporate-travel-expenses-for-airport-transport'],
  'theme-park-transfers.html': ['safe-airport-transport-for-families', 'gold-coast-airport-transfer-car-seats', 'gold-coast-airport-arrivals-guide'],
  'byron-bay-transfers.html': ['gold-coast-airport-arrivals-guide', 'what-happens-if-flight-delayed', 'brisbane-airport-to-coolangatta'],
  'point-to-point-transfers.html': ['getting-to-surfers-paradise-after-midnight', 'avoid-surge-pricing-airport-rides', '7-steps-compare-airport-transfer-quotes'],
  'minibus-hire-brisbane.html': ['booking-private-transport-brisbane-cruise-terminal', 'early-morning-brisbane-airport-transfer', 'christmas-parties-tamborine-winery-tours-transfers-guide'],
  'christmas-party-transport-gold-coast.html': ['christmas-parties-tamborine-winery-tours-transfers-guide', 'party-bus-vs-minibus-winery-tour-transport'],
  'broadbeach-airport-transfers.html': ['gold-coast-airport-arrivals-guide', 'gold-coast-airport-transfer-how-to-get-from-gold-coast-airport-to-hotel', 'gold-coast-to-brisbane-airport-what-time-to-leave'],
  'main-beach-airport-transfers.html': ['gold-coast-airport-arrivals-guide', 'gold-coast-airport-transport-options-with-luggage', 'gold-coast-to-brisbane-airport-what-time-to-leave'],
  'burleigh-heads-airport-transfers.html': ['gold-coast-airport-arrivals-guide', 'book-private-airport-transfer-gold-coast', 'gold-coast-to-brisbane-airport-what-time-to-leave'],
  'coolangatta-airport-transfers.html': ['gold-coast-airport-arrivals-guide', 'brisbane-airport-to-coolangatta', '7-steps-compare-airport-transfer-quotes'],
  'sunshine-coast-airport-transfers.html': ['brisbane-airport-domestic-or-international-pickup', 'early-morning-brisbane-airport-transfer', 'what-happens-if-flight-delayed'],
  'toowoomba-airport-transfers.html': ['brisbane-airport-domestic-or-international-pickup', 'early-morning-brisbane-airport-transfer', 'what-happens-if-flight-delayed'],
  'ipswich-airport-transfers.html': ['brisbane-airport-domestic-or-international-pickup', 'early-morning-brisbane-airport-transfer', 'fixed-price-airport-transfers-brisbane-benefits'],
  'logan-airport-transfers.html': ['brisbane-airport-domestic-or-international-pickup', 'gold-coast-to-brisbane-airport-what-time-to-leave', 'fixed-price-airport-transfers-brisbane-benefits'],
  'movie-world-transfers.html': ['safe-airport-transport-for-families', 'gold-coast-airport-transfer-car-seats'],
  'dreamworld-transfers.html': ['safe-airport-transport-for-families', 'gold-coast-airport-transfer-car-seats'],
  'sea-world-transfers.html': ['safe-airport-transport-for-families', 'gold-coast-airport-transfer-car-seats'],
  'currumbin-wildlife-sanctuary-transfers.html': ['gold-coast-airport-arrivals-guide', 'safe-airport-transport-for-families'],
  'gold-coast-convention-centre-transfers.html': ['how-to-manage-corporate-travel-expenses-for-airport-transport', 'gold-coast-airport-chauffeur-with-meet-and-greet'],
  'lone-pine-koala-sanctuary-transfers.html': ['brisbane-airport-domestic-or-international-pickup', 'safe-airport-transport-for-families'],
  'australia-zoo-transfers.html': ['brisbane-airport-domestic-or-international-pickup', 'safe-airport-transport-for-families'],
};
/* Every suburb page not named above gets three guides: the one that matters
   most for its airport first, then two from a pool, chosen by the suburb's
   position in the list so the links are spread across the articles and stay
   the same from one build to the next. Only 2 of 422 suburb pages linked to
   an article before. */
const SUBURB_GUIDES = {
  gc: { first: 'gold-coast-airport-arrivals-guide', pool: ['gold-coast-to-brisbane-airport-what-time-to-leave', 'gold-coast-airport-transfer-car-seats', 'gold-coast-airport-transport-options-with-luggage', 'what-happens-if-flight-delayed', 'book-private-airport-transfer-gold-coast', '7-steps-compare-airport-transfer-quotes', 'avoid-surge-pricing-airport-rides', 'gold-coast-airport-chauffeur-with-meet-and-greet', 'safe-airport-transport-for-families', 'real-time-flight-tracking-airport-transfers'] },
  bne: { first: 'brisbane-airport-domestic-or-international-pickup', pool: ['early-morning-brisbane-airport-transfer', 'what-happens-if-flight-delayed', 'reliable-airport-pickup-brisbane-flight-tracking', 'fixed-price-airport-transfers-brisbane-benefits', 'brisbane-airport-to-coolangatta', 'brisbane-airport-to-cruise-terminal', '7-steps-compare-airport-transfer-quotes', 'how-to-book-reliable-airport-transfers', 'brisbane-airport-chauffeur-corporate-travel', 'safe-airport-transport-for-families'] },
};
function suburbGuides() {
  const out = {};
  places.forEach((p, i) => {
    const page = p.url.replace(/^\//, '');
    if (GUIDES[page]) return;
    const g = SUBURB_GUIDES[p.region === 'Gold Coast' || p.region === 'Byron Bay' ? 'gc' : 'bne'];
    out[page] = [g.first, g.pool[i % g.pool.length], g.pool[(i + 3) % g.pool.length]];
  });
  return out;
}
function articleTitle(slug) {
  const f = path.join(BLOG_DIR, slug + '.html');
  if (!fs.existsSync(f)) return null;
  const m = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(fs.readFileSync(f, 'utf8'));
  const t = m ? m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : '';
  return t || null;
}
function fillGuides() {
  const open = '<!--guides:auto-->', close = '<!--/guides:auto-->';
  let pages = 0, links = 0;
  for (const [page, slugs] of Object.entries(Object.assign(suburbGuides(), GUIDES))) {
    const f = path.join(ROOT, page);
    if (!fs.existsSync(f)) { console.warn('build-suburbs: guides - no page ' + page); continue; }
    let s = fs.readFileSync(f, 'utf8');
    const i = s.indexOf(open), j = s.indexOf(close);
    if (i === -1 || j < i) { console.warn('build-suburbs: guides - no marker on ' + page); continue; }
    /* titles come back from the page already escaped; pass them through as-is */
    const items = slugs.map((sl) => [sl, articleTitle(sl)]).filter((x) => x[1]);
    const block = items.length ? `
  <h2>Travel guides</h2>
  <div class="related">
${items.map(([sl, t]) => `    <a href="/blog/${sl}.html">${t}<span>Travel guide</span></a>`).join('\n')}
  </div>
  ` : '';
    s = s.slice(0, i + open.length) + block + s.slice(j);
    fs.writeFileSync(f, s);
    pages++; links += items.length;
  }
  console.log(`build-suburbs: travel-guide links, ${links} on ${pages} page(s)`);
}

/* Recheck 7 (2 Nov 2026): a card's link text was its title and its blurb run
   together ("Brisbane Airport transfers274 suburbs priced"). The blurb now sits
   beside the link inside the card; the link still covers the whole card
   (.related .rc a::after in site.css). Runs over every page, hand-written ones
   included, after everything else has written its cards. Idempotent. */
function splitCards() {
  const dirs = [ROOT, OUT, BLOG_DIR];
  let n = 0;
  for (const d of dirs) {
    if (!fs.existsSync(d)) continue;
    for (const name of fs.readdirSync(d)) {
      if (!name.endsWith('.html')) continue;
      const f = path.join(d, name);
      const s = fs.readFileSync(f, 'utf8');
      const t = s.replace(/<div class="related">[\s\S]*?<\/div>/g, (block) => block.replace(
        /<a (href="[^"]*"[^>]*)>([^<]+(?:<!--[^>]*-->[^<]*)*)<span>([\s\S]*?)<\/span><\/a>/g,
        (m, attrs, title, blurb) => { n++; return `<div class="rc"><a ${attrs}>${title.trim()}</a><span>${blurb}</span></div>`; }));
      if (t !== s) fs.writeFileSync(f, t);
    }
  }
  console.log(`build-suburbs: ${n} card links now name only their title`);
}

/* The referral programme (3 Nov 2026): every public page - the ones carrying
   the Google tag - loads /ref.js, which remembers a ?ref= code, and lists the
   programme in its footer. Done last, so pages written by every step above
   (suburbs, regions, the blog feed) get it too. Back-office pages (admin,
   dispatch, agent, driver, track, account, affiliate) carry no Google tag and
   are left alone, which matters: track.html takes ?ref= for a booking. */
function referralPass() {
  const TAG = "gtag('config', 'G-9LYFELNSBK')";
  const LINK = '<p><a href="/affiliates.html">Referral programme</a></p>';
  const CONTACT = '<p><a href="/contact.html">Contact us</a></p>';
  let js = 0, foot = 0;
  for (const d of [ROOT, OUT, BLOG_DIR]) {
    if (!fs.existsSync(d)) continue;
    for (const name of fs.readdirSync(d)) {
      if (!name.endsWith('.html')) continue;
      const f = path.join(d, name);
      const s = fs.readFileSync(f, 'utf8');
      if (!s.includes(TAG)) continue;
      let t = s;
      if (!t.includes('src="/ref.js"') && t.includes('</head>')) { t = t.replace('</head>', '<script src="/ref.js" defer></script>\n</head>'); js++; }
      if (!t.includes('href="/affiliates.html">Referral programme') && t.includes(CONTACT)) { t = t.replace(CONTACT, CONTACT + '\n      ' + LINK); foot++; }
      if (t !== s) fs.writeFileSync(f, t);
    }
  }
  console.log(`build-suburbs: referral script on ${js} pages, footer link on ${foot}`);
}

/* One footer (10 Nov 2026). The hand-written pages had drifted into twelve
   different footers: the newer pages (point-to-point, minibus hire, event
   transfers, the Christmas page) were linked from a handful of pages each and
   the suburb pages - four fifths of the site - linked to none of them. Every
   public page now carries the two route columns of FOOTER, and its first
   links column carries the same general links; what is particular to a page
   (the homepage's #book, the charter page's #quote, its own tagline) is left
   alone. Runs before the referral and manage-booking passes, which add their
   own lines. */
function footerPass() {
  const TAG = "gtag('config', 'G-9LYFELNSBK')";
  const fa = FOOTER.indexOf('<div class="foot-routes">'), fb = FOOTER.indexOf('<div class="foot-legal">');
  const routes = FOOTER.slice(fa, fb).replace(/\s+$/, '');
  const routeHrefs = new Set([...routes.matchAll(/<a href="([^"]+)"/g)].map((m) => m[1]));
  const general = [...FOOTER.slice(0, fa).matchAll(/^ *<p><a href="(\/[^"#]*)">[^<]*<\/a><\/p>$/gm)].map((m) => [m[1], m[0].trim()]);
  const REVIEW = /^( *)<p><a href="https:\/\/www\.google\.com\/maps[^"]*"[^>]*>Review us on Google<\/a><\/p>$/m;
  /* Five link columns side by side, and the legal links as one row beneath.
     Injected, not added to site.css, because the homepage and the charter
     page carry their own inline copy of the footer rules and never load it. */
  const CSS = '<style id="foot-css">footer.site .foot-in{max-width:1100px}footer.site .foot-in>div:first-child{max-width:230px}'
    + 'footer.site .foot-legal{flex:1 0 100%;display:flex;flex-wrap:wrap;gap:4px 20px;border-top:1px solid rgba(255,255,255,.14);padding-top:14px;margin-top:8px}'
    + 'footer.site .foot-legal p{margin:0}footer.site .foot-legal .foot-entity{margin-left:auto}'
    + '@media (max-width:700px){footer.site .foot-legal .foot-entity{margin-left:0;flex-basis:100%}}</style>';
  let n = 0, odd = [];
  for (const d of [ROOT, OUT, BLOG_DIR]) {
    if (!fs.existsSync(d)) continue;
    for (const name of fs.readdirSync(d)) {
      if (!name.endsWith('.html')) continue;
      const f = path.join(d, name);
      const s = fs.readFileSync(f, 'utf8');
      if (!s.includes(TAG)) continue;
      const a = s.indexOf('<footer class="site">'), b = s.indexOf('</footer>', a);
      if (a < 0 || b < 0) continue;
      let foot = s.slice(a, b);
      const r0 = foot.indexOf('<div class="foot-routes">'), l0 = foot.indexOf('<div class="foot-legal">');
      if (r0 < 0 || l0 < r0 || !REVIEW.test(foot.slice(0, r0))) { odd.push(name); continue; }
      let top = foot.slice(0, r0);
      /* a link that now lives in the route columns is not repeated above them */
      top = top.replace(/^ *<p><a href="(\/[^"#]*)">[^<]*<\/a><\/p>\n/gm, (m, href) => (routeHrefs.has(href) ? '' : m));
      const missing = general.filter(([href]) => !routeHrefs.has(href) && !top.includes('href="' + href + '"'));
      if (missing.length) top = top.replace(REVIEW, (m, sp) => missing.map(([, line]) => sp + line).join('\n') + '\n' + m);
      foot = top + routes + '\n    ' + foot.slice(l0);
      let t = s.slice(0, a) + foot + s.slice(b);
      if (t !== s) n++;
      if (!t.includes('id="foot-css"') && t.includes('</head>')) t = t.replace('</head>', CSS + '\n</head>');
      if (t !== s) fs.writeFileSync(f, t);
    }
  }
  console.log(`build-suburbs: one footer on ${n} page(s)${odd.length ? ', left alone: ' + odd.join(', ') : ''}`);
}

/* "Manage my booking" (Recheck 7 item 12, 3 Nov 2026) in the footer of every
   public page and in the header from 1024 px wide (on a 768 px tablet it pushed the
   header from two lines to three; phones show only the WhatsApp and call buttons).
   It goes to the Manage my booking section of contact.html: there is no customer
   self-service page, and /account.html is the DRIVER page. */
function manageLinkPass() {
  const TAG = "gtag('config', 'G-9LYFELNSBK')";
  const CONTACT = '<p><a href="/contact.html">Contact us</a></p>';
  const FOOT = '<p><a href="/contact.html#manage">Manage my booking</a></p>';
  const NAV = '<a class="navmb" href="/contact.html#manage">Manage booking</a>';
  const CSS = '<style>@media(max-width:1023px){.navlinks a.navmb{display:none}}</style>';
  let foot = 0, nav = 0;
  for (const d of [ROOT, OUT, BLOG_DIR]) {
    if (!fs.existsSync(d)) continue;
    for (const name of fs.readdirSync(d)) {
      if (!name.endsWith('.html')) continue;
      const f = path.join(d, name);
      const s = fs.readFileSync(f, 'utf8');
      if (!s.includes(TAG)) continue;
      let t = s;
      if (!t.includes(FOOT) && t.includes(CONTACT)) { t = t.replace(CONTACT, CONTACT + '\n      ' + FOOT); foot++; }
      const wa = t.indexOf('<a class="navwa"');
      if (!t.includes(NAV) && wa > 0 && t.lastIndexOf('class="navlinks"', wa) > 0) {
        t = t.slice(0, wa) + NAV + '\n      ' + t.slice(wa); nav++;
        if (!t.includes(CSS)) t = t.replace('</head>', CSS + '\n</head>');
      }
      if (t !== s) fs.writeFileSync(f, t);
    }
  }
  console.log(`build-suburbs: Manage my booking in ${foot} footers and ${nav} headers`);
}

/* The Meta pixel (dataset 27923899043979480, 3 Nov 2026), on exactly the pages
   that carry the GA4 config - so never admin, dispatch, the driver and agent
   portals, account or tracking links, or the affiliate sign-in.

   It is placed straight after the Google tag's own block and does not add a
   single tracking call of its own beyond PageView. Instead it wraps gtag, so
   the events the site already sends to Google become their Meta equivalents
   and the two can never disagree about what counts:
     booking_request, charter_enquiry, funeral_enquiry  -> Lead
     begin_checkout                                     -> InitiateCheckout
     purchase (booking-confirmed.html, Stripe's figure) -> Purchase + value
     contact_phone / _whatsapp / _email, phone_click,
     whatsapp_click                                     -> Contact
   Nothing personal is passed: no name, email, phone or address, only the fare
   on a purchase. autoConfig is off so Meta does not invent events from button
   clicks on the booking form. A Purchase is sent once per Stripe session even
   if the confirmation page is reloaded, and never without one (a visit to the
   page that did not come back from Stripe is not a sale). */
const META_PIXEL = '27923899043979480';
const META_SNIPPET = `<script>
  /* Meta pixel - added at build time by build-suburbs.js (metaPass) */
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
  n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
  document,'script','https://connect.facebook.net/en_US/fbevents.js');
  fbq('set', 'autoConfig', false, '${META_PIXEL}');
  fbq('init', '${META_PIXEL}');
  fbq('track', 'PageView');
  (function(){
    var MAP = { booking_request: 'Lead', charter_enquiry: 'Lead', funeral_enquiry: 'Lead',
                begin_checkout: 'InitiateCheckout', purchase: 'Purchase',
                contact_phone: 'Contact', contact_whatsapp: 'Contact', contact_email: 'Contact',
                phone_click: 'Contact', whatsapp_click: 'Contact' };
    var g = window.gtag, lastContact = 0;
    if (typeof g !== 'function') return;
    window.gtag = function(cmd, name, p){
      try {
        var ev = cmd === 'event' && MAP[name];
        if (ev === 'Contact') {
          var now = Date.now();
          if (now - lastContact < 1500) ev = null; else lastContact = now;
        }
        if (ev === 'Purchase') {
          var id = p && p.transaction_id, data = { currency: (p && p.currency) || 'AUD' };
          if (p && typeof p.value === 'number') data.value = p.value;
          if (!id) ev = null;  /* a real Stripe return always has one */
          else { try { var k = 'sky_meta_buy_' + id; if (localStorage.getItem(k)) ev = null; else localStorage.setItem(k, '1'); } catch (e) {} }
          if (ev) fbq('track', 'Purchase', data, { eventID: id });
        } else if (ev) fbq('track', ev);
      } catch (e) { /* tracking must never break a page */ }
      return g.apply(this, arguments);
    };
  })();
</script>`;
function metaPass() {
  const TAG = "gtag('config', 'G-9LYFELNSBK')";
  let n = 0, skipped = 0;
  for (const d of [ROOT, OUT, BLOG_DIR]) {
    if (!fs.existsSync(d)) continue;
    for (const name of fs.readdirSync(d)) {
      if (!name.endsWith('.html')) continue;
      const f = path.join(d, name);
      const s = fs.readFileSync(f, 'utf8');
      const at = s.indexOf(TAG);
      if (at < 0 || s.includes("fbq('init'")) continue;
      const end = s.indexOf('</script>', at);
      if (end < 0) { skipped++; continue; }
      const cut = end + '</script>'.length;
      fs.writeFileSync(f, s.slice(0, cut) + '\n' + META_SNIPPET + s.slice(cut));
      n++;
    }
  }
  console.log(`build-suburbs: Meta pixel on ${n} pages${skipped ? ', ' + skipped + ' skipped' : ''}`);
}

/* Last, because it appends to the sitemap the block above has just written,
   and awaits a network call. Never allowed to fail the build. The guide
   links run after it either way, so committed articles are still linked when
   the feed is down. */
writeBlog().catch((e) => console.warn('build-suburbs: blog step failed (' + e.message + ')'))
  .then(() => { try { fillGuides(); } catch (e) { console.warn('build-suburbs: guides step failed (' + e.message + ')'); } })
  .then(() => { try { splitCards(); } catch (e) { console.warn('build-suburbs: card step failed (' + e.message + ')'); } })
  .then(() => { try { footerPass(); } catch (e) { console.warn('build-suburbs: footer step failed (' + e.message + ')'); } })
  .then(() => { try { referralPass(); } catch (e) { console.warn('build-suburbs: referral step failed (' + e.message + ')'); } })
  .then(() => { try { metaPass(); } catch (e) { console.warn('build-suburbs: Meta pixel step failed (' + e.message + ')'); } })
  .then(() => { try { manageLinkPass(); } catch (e) { console.warn('build-suburbs: manage-booking step failed (' + e.message + ')'); } });
