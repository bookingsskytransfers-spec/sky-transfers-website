/*
 * data/attractions.js - the attraction pages build-suburbs.js writes at the site
 * root (2 Nov 2026).
 *
 * Why these six: Search Console (Aug-Oct 2026) shows theme-park searches are the
 * attraction demand we already appear for - "movie world transfers", "gold coast
 * airport to movie world", "brisbane airport to dreamworld", "sea world to movie
 * world" - at position 60+ on one combined page. Currumbin, the convention centre
 * and Lone Pine are the other attractions inside a published fare zone. Australia
 * Zoo (Beerwah) is not priced online, so it has no page until it is.
 *
 * Fares are NOT stored here. Airport fares come from the rate tables in
 * index.html through the attraction's suburb; hotel-area fares come from the
 * point-to-point ladder (P2P in build-suburbs.js, which must match p2p-fare.js)
 * applied to the road distances below. So a fare change flows through.
 *
 * Distances: airports -> venue from Google's route matrix, TRAFFIC_UNAWARE, the
 * same basis as suburb-facts.json (2 Nov 2026). Hotel areas -> venue from the
 * live /p2p-quote endpoint (2 Nov 2026): km = to the venue's own address (what
 * a customer who picks the park in the form gets), kmAlt = to the suburb (what
 * the page's deep link sends). Where the two land in different bands the page
 * prints a range rather than a single figure that could be wrong.
 */
module.exports = [
  {
    slug: 'movie-world-transfers',
    name: 'Movie World and Wet’n’Wild',
    suburb: 'Oxenford',
    hero: 'hero-family',
    themePark: true,
    venues: [
      { name: 'Warner Bros. Movie World', ool: { m: 40113, s: 1805 }, bne: { m: 68631, s: 2728 } },
      { name: 'Wet’n’Wild Gold Coast', ool: { m: 40781, s: 1935 }, bne: { m: 69769, s: 2924 } },
      { name: 'Paradise Country', ool: { m: 41532, s: 2115 }, bne: { m: 70519, s: 3104 } },
    ],
    title: ['Movie World & Wet’n’Wild Transfers | From ${FROM}', 'Movie World Transfers | From ${FROM}'],
    h1: 'Movie World and Wet’n’Wild transfers, fixed price',
    lead: 'Private transfers to Warner Bros. Movie World, Wet’n’Wild and Paradise Country at Oxenford — from your hotel or from either airport — at one fixed price per vehicle, with child seats fitted before we arrive.',
    from: [
      { from: 'Surfers Paradise', km: 17, kmAlt: 18.5, min: 20 },
      { from: 'Main Beach', km: 16.4, kmAlt: 17.9, min: 18 },
      { from: 'Broadbeach', km: 23.3, kmAlt: 24.8, min: 26 },
      { from: 'Burleigh Heads', km: 27.2, kmAlt: 28.7, min: 20 },
      { from: 'Coolangatta', km: 43.5, kmAlt: 45, min: 30 },
      { from: 'Brisbane CBD', km: 59.8, kmAlt: 59.8, min: 42 },
    ],
    pairs: [
      { to: 'Dreamworld', suburb: 'Coomera', km: 8, min: 9, href: '/dreamworld-transfers.html' },
      { to: 'Sea World', suburb: 'Main Beach', km: 16.4, min: 18, href: '/sea-world-transfers.html' },
    ],
    notes: [
      'The three parks sit side by side at Oxenford, off the M1 between the Gold Coast and Brisbane, and they share one fare: Oxenford’s. Movie World is {OOL_KM} from Gold Coast Airport, about {OOL_MIN} outside peak, and {BNE_KM} from Brisbane Airport, about {BNE_MIN}, almost all of it on the motorway.',
      'From the beach strip it is a short run up the M1: about 20 minutes from Surfers Paradise or Main Beach, a little longer from Broadbeach. The G:link tram does not reach Oxenford, so without a car the choice is a bus connection or a transfer, and for a family with a pram and a day’s worth of bags one vehicle door to gate is the easy answer.',
      'Book the morning drop and the afternoon pick-up as one return booking and both legs are fixed, with 10% off the pair — {RET:Surfers Paradise} for a sedan from Surfers Paradise instead of two separate fares. Set the return time to when you will actually walk out of the gates; at closing time every family in the car park wants a ride at the same moment, and a booked car is the one thing that does not get dearer.',
    ],
    faq: [
      ['Which airport is better for Movie World?', 'Gold Coast Airport is the cheaper fare — {F_OOL} in a sedan, {OOL_KM} and about {OOL_MIN}. Brisbane Airport is {F_BNE}, {BNE_KM} and about {BNE_MIN}. Both are fixed fares with GST and tolls included, so it comes down to which flight suits you.'],
      ['How much is a transfer from Surfers Paradise to Movie World?', '{P2P:Surfers Paradise} one way in a sedan, or {RET:Surfers Paradise} return when both legs are in one booking. A People Mover for up to seven is {P2P3:Surfers Paradise} one way. The fare is per vehicle, not per person.'],
      ['Is the fare the same for Wet’n’Wild and Paradise Country?', 'Yes. All three parks are priced as Oxenford, so the fare to Wet’n’Wild or Paradise Country is the same as to Movie World.'],
      ['Can we do Movie World and Dreamworld on the same trip?', 'They are {PAIR_KM:Dreamworld} apart, about {PAIR_MIN:Dreamworld} by road, and a transfer between them is {PAIR:Dreamworld} in a sedan. Book it as its own one-way trip from Oxenford to Coomera.'],
      ['Do you sell park tickets?', 'No — we are the transport only. Buy tickets from the park, and check the park’s own website for that day’s opening hours before you set the pick-up times.'],
    ],
  },
  {
    slug: 'dreamworld-transfers',
    name: 'Dreamworld',
    suburb: 'Coomera',
    hero: 'hero-family',
    themePark: true,
    venues: [
      { name: 'Dreamworld and WhiteWater World', ool: { m: 46908, s: 2150 }, bne: { m: 63316, s: 2580 } },
    ],
    title: ['Dreamworld Transfers | Airport & Hotel, From ${FROM}', 'Dreamworld Transfers | From ${FROM}'],
    h1: 'Dreamworld transfers, fixed price',
    lead: 'Private transfers to Dreamworld and WhiteWater World at Coomera from your hotel or from either airport, at one fixed price per vehicle, GST and tolls included, with child seats fitted before we arrive.',
    from: [
      { from: 'Surfers Paradise', km: 23.8, kmAlt: 27, min: 26 },
      { from: 'Main Beach', km: 23.2, kmAlt: 26.5, min: 24 },
      { from: 'Broadbeach', km: 30.1, kmAlt: 33.3, min: 32 },
      { from: 'Burleigh Heads', km: 34, kmAlt: 37.2, min: 25 },
      { from: 'Coolangatta', km: 50.3, kmAlt: 53.5, min: 36 },
      { from: 'Brisbane CBD', km: 54.5, kmAlt: 57.7, min: 40 },
    ],
    pairs: [
      { to: 'Movie World', suburb: 'Oxenford', km: 8, min: 9, href: '/movie-world-transfers.html' },
      { to: 'Sea World', suburb: 'Main Beach', km: 23.2, min: 24, href: '/sea-world-transfers.html' },
    ],
    notes: [
      'Dreamworld and WhiteWater World share one site at Coomera, just off the M1, a few minutes north of Movie World. From Brisbane Airport it is closer in time than you might expect: {BNE_KM} and about {BNE_MIN} from BNE against {OOL_KM} and about {OOL_MIN} from Gold Coast Airport. The Gold Coast fare is still the lower of the two — {F_OOL} against {F_BNE} in a sedan — so the difference is your flight, not the drive.',
      'From the coast it is the M1 north the whole way: about 25 minutes from Surfers Paradise or Main Beach, half an hour from Broadbeach, and Brisbane’s CBD is about 40 minutes the other way. Every one of those runs is a fixed point-to-point fare, shown in the table below, and the same at 8am as at closing time.',
      'Book the drop and the pick-up as one return booking and the pair is 10% cheaper — {RET:Surfers Paradise} return in a sedan from Surfers Paradise. A People Mover takes seven with a pram in the back; past seven, the Sprinters take ten or fourteen, bags and prams included, in one vehicle.',
    ],
    faq: [
      ['Is Dreamworld closer to Brisbane or Gold Coast Airport?', 'Gold Coast Airport is {OOL_KM} and about {OOL_MIN}; Brisbane Airport is {BNE_KM} and about {BNE_MIN}. The sedan fare is {F_OOL} from the Gold Coast and {F_BNE} from Brisbane, both fixed with GST and tolls included.'],
      ['How much is Surfers Paradise to Dreamworld?', '{P2P:Surfers Paradise} one way in a sedan, or {RET:Surfers Paradise} return in one booking. The fare is per vehicle, so a family of four pays the same as one person.'],
      ['Can you take us from Brisbane city to Dreamworld?', 'Yes, {P2P:Brisbane CBD} one way in a sedan from the CBD, about 40 minutes. It is a fixed fare with tolls included, booked in the same form as an airport transfer.'],
      ['Does WhiteWater World cost the same?', 'Yes. It shares the Dreamworld site at Coomera and is priced the same.'],
      ['Can we add Movie World on another day?', 'Of course — each park run is its own booking. Movie World is {PAIR_KM:Movie World} south of Dreamworld, and a transfer between the two parks is {PAIR:Movie World} in a sedan.'],
    ],
  },
  {
    slug: 'sea-world-transfers',
    name: 'Sea World',
    suburb: 'Main Beach',
    hero: 'hero-family',
    themePark: true,
    venues: [
      { name: 'Sea World', ool: { m: 35790, s: 2805 }, bne: { m: 89082, s: 4062 } },
    ],
    title: ['Sea World Gold Coast Transfers | From ${FROM}', 'Sea World Transfers | From ${FROM}'],
    h1: 'Sea World transfers, fixed price',
    lead: 'Private transfers to Sea World on The Spit at Main Beach from your hotel or from either airport, at one fixed price per vehicle, GST and tolls included, with child seats fitted before we arrive.',
    from: [
      { from: 'Surfers Paradise', km: 7.8, kmAlt: 2.7, min: 12 },
      { from: 'Broadbeach', km: 11.1, kmAlt: 6, min: 21 },
      { from: 'Burleigh Heads', km: 21.4, kmAlt: 16.3, min: 33 },
      { from: 'Coolangatta', km: 39.2, kmAlt: 34.1, min: 47 },
      { from: 'Brisbane CBD', km: 80.3, kmAlt: 75.9, min: 65 },
    ],
    pairs: [
      { to: 'Movie World', suburb: 'Oxenford', km: 16.4, min: 18, href: '/movie-world-transfers.html' },
      { to: 'Dreamworld', suburb: 'Coomera', km: 23.2, min: 24, href: '/dreamworld-transfers.html' },
    ],
    notes: [
      'Sea World is on The Spit at Main Beach, about 12 minutes from Surfers Paradise. From Gold Coast Airport it is {OOL_KM}, about {OOL_MIN}, up the Gold Coast Highway; from Brisbane Airport it is {BNE_KM}, about {BNE_MIN}. The sedan fares are {F_OOL} and {F_BNE}.',
      'From the main hotel strip it is a short point-to-point fare: {P2P:Surfers Paradise} from Surfers Paradise and {P2P:Broadbeach} from Broadbeach in a sedan. Staying further south, Burleigh is about half an hour and Coolangatta closer to 50 minutes.',
      'If you are flying in and going straight to the park or the resort beside it, book the airport transfer to Main Beach — the fare is the Main Beach fare whichever door we stop at. Book both legs together and the return is 10% off the pair.',
    ],
    faq: [
      ['How far is Sea World from Gold Coast Airport?', '{OOL_KM} by road, about {OOL_MIN} outside peak. A sedan is {F_OOL} one way, fixed, with GST included.'],
      ['How much is Surfers Paradise to Sea World?', '{P2P:Surfers Paradise} one way in a sedan, or {RET:Surfers Paradise} return in one booking. The fare is per vehicle, not per person.'],
      ['Can we go from Sea World to Movie World?', 'Yes. They are {PAIR_KM:Movie World} apart, about {PAIR_MIN:Movie World}, and a transfer between the two is {PAIR:Movie World} in a sedan.'],
      ['Is Brisbane Airport to Sea World realistic?', 'It is {BNE_KM}, about {BNE_MIN} outside peak, and {F_BNE} in a sedan with the toll included. Gold Coast Airport is nearer and cheaper if your flight allows it.'],
    ],
  },
  {
    slug: 'currumbin-wildlife-sanctuary-transfers',
    name: 'Currumbin Wildlife Sanctuary',
    suburb: 'Currumbin',
    hero: 'hero-family',
    themePark: true,
    venues: [
      { name: 'Currumbin Wildlife Sanctuary', ool: { m: 4757, s: 434 }, bne: { m: 105529, s: 4154 } },
    ],
    title: ['Currumbin Wildlife Sanctuary Transfers | From ${FROM}', 'Currumbin Sanctuary Transfers | From ${FROM}'],
    h1: 'Currumbin Wildlife Sanctuary transfers, fixed price',
    lead: 'Private transfers to Currumbin Wildlife Sanctuary from Gold Coast Airport, Brisbane Airport or your hotel, at one fixed price per vehicle, GST and tolls included.',
    from: [
      { from: 'Coolangatta', km: 6.1, kmAlt: 7.5, min: 8 },
      { from: 'Burleigh Heads', km: 12, kmAlt: 9.2, min: 11 },
      { from: 'Broadbeach', km: 14, kmAlt: 20.2, min: 27 },
      { from: 'Surfers Paradise', km: 24.9, kmAlt: 22.1, min: 28 },
      { from: 'Main Beach', km: 27.6, kmAlt: 24.8, min: 35 },
    ],
    pairs: [],
    notes: [
      'The sanctuary is at Currumbin on the southern Gold Coast, {OOL_KM} from Gold Coast Airport — about {OOL_MIN}. The sedan fare from OOL is {F_OOL}. Brisbane Airport is {BNE_KM}, about {BNE_MIN}, and {F_BNE} in a sedan.',
      'Its closeness to the airport is the useful part. On a first or last day, when the hotel room is not ready yet or the flight is not until the evening, a few hours at the sanctuary fills the gap without a long drive either side. If you want the car and your bags to stay with you while you are inside, book by the hour (three to six hours, from $90 an hour in a sedan) rather than two one-way transfers.',
      'From the hotel strip it is a fixed point-to-point fare: {P2P:Burleigh Heads} from Burleigh Heads and {P2P:Surfers Paradise} from Surfers Paradise in a sedan. Book both legs together and the return is 10% off the pair.',
    ],
    faq: [
      ['How far is Currumbin Wildlife Sanctuary from Gold Coast Airport?', '{OOL_KM}, about {OOL_MIN} by road. A sedan is {F_OOL} one way, the lowest fare we publish from the airport.'],
      ['How much is Surfers Paradise to Currumbin Wildlife Sanctuary?', '{P2P:Surfers Paradise} one way in a sedan, or {RET:Surfers Paradise} return in one booking.'],
      ['Can the car wait while we visit?', 'Yes, if you book by the hour: three to six hours, from $90 an hour in a sedan, with the chauffeur and your bags staying with the vehicle. Two one-way transfers are cheaper if you do not need the car in between.'],
      ['Do you come from Brisbane?', 'Brisbane Airport to Currumbin is {F_BNE} in a sedan, {BNE_KM}. From Brisbane city the trip is over our online point-to-point range, so call or WhatsApp us and we fix the price before you book.'],
    ],
  },
  {
    slug: 'gold-coast-convention-centre-transfers',
    name: 'Gold Coast Convention and Exhibition Centre',
    short: 'the convention centre',
    visit: 'the Gold Coast Convention Centre',
    suburb: 'Broadbeach',
    hero: 'hero-corporate',
    themePark: false,
    venues: [
      { name: 'Gold Coast Convention and Exhibition Centre', ool: { m: 25864, s: 1859 }, bne: { m: 91440, s: 3995 } },
    ],
    title: ['Gold Coast Convention Centre Transfers | From ${FROM}', 'GCCEC Transfers | From ${FROM}'],
    h1: 'Gold Coast Convention Centre transfers, fixed price',
    lead: 'Private transfers for delegates, exhibitors and event guests to the Gold Coast Convention and Exhibition Centre at Broadbeach, from either airport or your hotel, at one fixed price per vehicle with a tax invoice on every trip.',
    from: [
      { from: 'Surfers Paradise', km: 3.7, kmAlt: 4.1, min: 9 },
      { from: 'Main Beach', km: 5.6, kmAlt: 5.9, min: 13 },
      { from: 'Burleigh Heads', km: 11.5, kmAlt: 11.7, min: 17 },
      { from: 'Coolangatta', km: 29.3, kmAlt: 29.5, min: 31 },
      { from: 'Brisbane CBD', km: 82.6, kmAlt: 82.8, min: 63 },
    ],
    pairs: [],
    notes: [
      'The centre is on the Gold Coast Highway at Broadbeach and is priced as Broadbeach: {F_OOL} in a sedan from Gold Coast Airport ({OOL_KM}, about {OOL_MIN}) and {F_BNE} from Brisbane Airport ({BNE_KM}, about {BNE_MIN}), GST and tolls included. The drive down from Brisbane is motorway almost all the way.',
      'For a team, one vehicle is usually cheaper than several: the fare is per vehicle, so a People Mover for seven or a 14-seat Sprinter costs one price however many of you are in it. We meet arrivals inside the terminal with a name board and track the flight, so a delayed flight does not leave anyone stranded at the kerb.',
      'Every trip comes with a tax invoice, and companies with regular travel can run a monthly account. For a whole conference program — hotel shuttles, a dinner run, several arrivals on the same morning — send us the schedule and we price it as one job.',
    ],
    faq: [
      ['How much is Brisbane Airport to the Gold Coast Convention Centre?', '{F_BNE} one way in a sedan, {BNE_KM} and about {BNE_MIN}, fixed with the Gateway toll and GST included. From Gold Coast Airport it is {F_OOL}.'],
      ['Can you move a group of delegates together?', 'Yes. A People Mover takes up to seven and the Sprinters ten or fourteen, each at one fare per vehicle. Larger groups and multi-day programs are quoted as one job — see the charters page or call us.'],
      ['Do you issue tax invoices?', 'Yes, on every trip, and monthly accounts are available for companies that travel regularly.'],
      ['How much is Surfers Paradise to the convention centre?', '{P2P:Surfers Paradise} one way in a sedan — it is about 4 km, roughly 10 minutes.'],
    ],
  },
  {
    slug: 'lone-pine-koala-sanctuary-transfers',
    name: 'Lone Pine Koala Sanctuary',
    suburb: 'Fig Tree Pocket',
    hero: 'hero-city',
    themePark: false,
    venues: [
      { name: 'Lone Pine Koala Sanctuary', ool: { m: 111395, s: 4611 }, bne: { m: 27684, s: 1969 } },
    ],
    title: ['Lone Pine Koala Sanctuary Transfers | From ${FROM}', 'Lone Pine Transfers | From ${FROM}'],
    h1: 'Lone Pine Koala Sanctuary transfers, fixed price',
    lead: 'Private transfers to Lone Pine Koala Sanctuary at Fig Tree Pocket from Brisbane Airport, the city or your hotel, at one fixed price per vehicle, GST and tolls included.',
    from: [
      { from: 'Brisbane CBD', km: 15, kmAlt: 15.6, min: 22 },
      { from: 'South Brisbane', km: 12.6, kmAlt: 11.9, min: 17 },
      { from: 'Fortitude Valley', km: 15.2, kmAlt: 15, min: 17 },
    ],
    pairs: [],
    notes: [
      'Lone Pine is in Fig Tree Pocket, on the Brisbane River in the western suburbs. From Brisbane Airport it is {BNE_KM}, about {BNE_MIN} outside peak, and the sedan fare is {F_BNE} with the tolls included. Gold Coast Airport is a long way round — {OOL_KM}, about {OOL_MIN} — at {F_OOL}.',
      'From the city it is a fixed point-to-point fare of about 20 minutes: {P2P:Brisbane CBD} from the CBD and {P2P:South Brisbane} from South Brisbane in a sedan. Book both legs together and the return is 10% off the pair.',
      'For international visitors with a few hours between landing and check-in, BNE to Lone Pine is shorter than the drive to most Gold Coast hotels. If you want the car and your bags to stay with you while you are inside, book by the hour (three to six hours, from $90 an hour in a sedan) instead of two one-way transfers.',
    ],
    faq: [
      ['How far is Lone Pine from Brisbane Airport?', '{BNE_KM}, about {BNE_MIN} by road outside peak. A sedan is {F_BNE} one way, fixed, tolls and GST included.'],
      ['How much is Brisbane city to Lone Pine?', '{P2P:Brisbane CBD} one way in a sedan from the CBD, or {RET:Brisbane CBD} return in one booking.'],
      ['Can the car wait while we visit?', 'Yes, if you book by the hour: three to six hours, from $90 an hour in a sedan. Two one-way transfers are cheaper if you do not need the car in between.'],
      ['Do you come from the Gold Coast?', 'Gold Coast Airport to Lone Pine is {F_OOL} in a sedan. From a Gold Coast hotel the trip is longer than our online point-to-point range, so call or WhatsApp us and we fix the price before you book.'],
    ],
  },
  {
    slug: 'australia-zoo-transfers',
    name: 'Australia Zoo',
    suburb: 'Beerwah',
    hero: 'hero-family',
    themePark: false,
    descTail: 'Day return 10% off.',
    stayHtml: 'Want the car and chauffeur with you all day? See the <a href="/glass-house-mountains-australia-zoo-day-tour.html">Glass House Mountains, Australia Zoo and Maleny day tour</a>.',
    lastmod: '2026-11-02',
    venues: [
      { name: 'Australia Zoo', ool: { m: 175959, s: 7276 }, bne: { m: 75160, s: 3348 } },
    ],
    title: ['Australia Zoo Private Transfers | Brisbane & Gold Coast', 'Australia Zoo Transfers'],
    h1: 'Australia Zoo transfers, fixed price',
    lead: 'Private transfers to Australia Zoo at Beerwah from Brisbane, the Gold Coast or the Sunshine Coast — one fixed price per vehicle, GST and tolls included, with child seats fitted before we arrive. Entry tickets are bought from the zoo.',
    /* Hotel areas -> zoo (2 Nov 2026, Google route matrix): km = to the zoo,
       kmAlt = to the suburb of Beerwah, which is what a deep link sends. */
    from: [
      { from: 'Brisbane CBD', km: 82.9, kmAlt: 80.9, min: 72 },
      { from: 'South Brisbane', km: 85.2, kmAlt: 83.2, min: 68 },
      { from: 'Caloundra', km: 21.6, kmAlt: 24.1, min: 24 },
      { from: 'Mooloolaba', km: 28, kmAlt: 30.5, min: 25 },
      { from: 'Maroochydore', km: 32.8, kmAlt: 35.3, min: 29 },
      { from: 'Noosa Heads', km: 69.9, kmAlt: 72.4, min: 54 },
      { from: 'Surfers Paradise', km: 152.8, kmAlt: 150.8, min: 111 },
      { from: 'Broadbeach', km: 159.1, kmAlt: 157.1, min: 118 },
    ],
    pairs: [],
    notes: [
      'Australia Zoo is at Beerwah, in the Sunshine Coast hinterland under the Glass House Mountains. From Brisbane Airport it is {BNE_KM}, about {BNE_MIN}, and the sedan fare is {F_BNE} with the toll included. From Gold Coast Airport it is {OOL_KM}, about {OOL_MIN}, at {F_OOL}.',
      'From a Brisbane hotel the fare is the same as from the airport — {P2P:Brisbane CBD} in a sedan from the CBD, a little over an hour up the Bruce Highway. From anywhere on the Gold Coast it is the Gold Coast Airport fare, {P2P:Surfers Paradise} from Surfers Paradise, about two hours each way. Staying on the Sunshine Coast it is a short run: {P2P:Caloundra} from Caloundra and {P2P:Maroochydore} from Maroochydore.',
      'Most visitors go for the day. Book the drop-off and the pick-up as one return booking and the pair is 10% cheaper — {RET:Brisbane CBD} return from Brisbane city and {RET:Surfers Paradise} from Surfers Paradise in a sedan. The car drops you at the gate and comes back at the time you choose. If you would rather keep the car and chauffeur all day and see more of the hinterland, the <a href="/glass-house-mountains-australia-zoo-day-tour.html">Glass House Mountains, Australia Zoo and Maleny day tour</a> adds the lookout, the rainforest at Mary Cairncross and Maleny.',
    ],
    faq: [
      ['How much is a private transfer from Brisbane to Australia Zoo?', '{P2P:Brisbane CBD} one way in a sedan from Brisbane city or Brisbane Airport, or {RET:Brisbane CBD} return in one booking. A People Mover for up to seven is {P2P3:Brisbane CBD} one way. The fare is per vehicle, not per person, with tolls and GST included.'],
      ['How much is it from the Gold Coast?', '{P2P:Surfers Paradise} one way in a sedan from anywhere on the Gold Coast, or {RET:Surfers Paradise} return in one booking. It is about two hours each way, so most Gold Coast visitors book the return.'],
      ['Are zoo tickets included?', 'No — we are the transport only. Buy entry from Australia Zoo, and check its website for the day’s opening hours before you set the pick-up time.'],
      ['Can the car wait for us all day?', 'Yes — that is the Glass House Mountains, Australia Zoo and Maleny day tour, priced for the whole day with the car and chauffeur staying with you. A return booking is cheaper if you only need the drop-off and the pick-up.'],
    ],
  },
];
