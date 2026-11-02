/*
 * data/tours.js - private day tours build-suburbs.js writes at the site root
 * (2 Nov 2026).
 *
 * A tour is the car and chauffeur for the whole day. Its price is not stored:
 * it is the hourly-hire rate (HOURLY in build-suburbs.js) x the tour's hours,
 * less 10% - the same discount the published full-day charters carry (V-Class
 * $970 for 8 h against 8 x $135). Approved by Aman, 2 Nov 2026: 10 hours from
 * Brisbane, 11 hours from the Gold Coast without the botanic gardens, entry
 * tickets extra, booked by enquiry so the office confirms the date first.
 *
 * Legs are measured road distance and time (Google route matrix,
 * TRAFFIC_UNAWARE, 2 Nov 2026); stay is the planned time at each stop, in
 * minutes. The page works the timetable out from these, and the build fails if
 * a day runs past the hours it is priced at.
 */
module.exports = [
  {
    slug: 'glass-house-mountains-australia-zoo-day-tour',
    lastmod: '2026-11-02',
    name: 'Glass House Mountains, Australia Zoo and Maleny',
    title: 'Glass House Mountains, Australia Zoo & Maleny Day Tour',
    h1: 'Glass House Mountains, Australia Zoo and Maleny private day tour',
    lead: 'A private car and chauffeur for the day: the Glass House Mountains lookout, Australia Zoo, the rainforest at Mary Cairncross and the hinterland town of Maleny, from your hotel in Brisbane or on the Gold Coast. One price per vehicle; entry tickets are extra.',
    stops: {
      lookout: { name: 'Glass House Mountains Lookout', where: 'Beerburrum', text: 'The view across the volcanic peaks of the Glass House Mountains, a short stop on the way in.' },
      zoo: { name: 'Australia Zoo', where: 'Beerwah', text: 'The main event. Your chauffeur waits while you spend the middle of the day at the zoo.', ticket: true },
      mc: { name: 'Mary Cairncross Scenic Reserve', where: 'Maleny', text: 'Subtropical rainforest walks and the classic view back across the Glass House Mountains.' },
      gardens: { name: 'Maleny Botanic Gardens & Bird World', where: 'Maleny', text: 'Landscaped gardens and walk-through aviaries on the edge of the range.', ticket: true },
      town: { name: 'Maleny town', where: 'Maleny', text: 'Coffee, cafes and the main street before the drive home.' },
    },
    starts: [
      { key: 'brisbane', label: 'From Brisbane', place: 'a Brisbane hotel or Brisbane Airport', hours: 10, start: '08:00',
        legs: [['lookout', 84.2, 68, 20], ['zoo', 16.3, 19, 240], ['mc', 13.9, 15, 45], ['gardens', 5.6, 9, 60], ['town', 3.9, 7, 25]],
        home: ['in Brisbane', 103.9, 88] },
      { key: 'gold-coast', label: 'From the Gold Coast', place: 'your Gold Coast hotel', hours: 11, start: '07:00',
        legs: [['lookout', 152.1, 111, 20], ['zoo', 16.3, 19, 240], ['mc', 13.9, 15, 45], ['town', 7.2, 10, 45]],
        home: ['on the Gold Coast', 170.5, 129],
        note: 'From the Gold Coast the drive is about two hours each way, so this version leaves out the botanic gardens to keep the day to eleven hours.' },
    ],
    included: [
      'A private vehicle and chauffeur for the whole day — nobody else on board',
      'Pick-up and drop-off at your hotel or apartment',
      'Fuel, tolls and GST',
      'Your own pace: stay longer at the zoo, skip a stop or swap the order on the day',
    ],
    extra: [
      'Entry tickets — Australia Zoo and Maleny Botanic Gardens & Bird World charge admission; buy them direct',
      'Meals and drinks',
      'Child seats, $15 each, fitted before pick-up',
    ],
    faq: [
      ['Are entry tickets included?', 'No. The price is the car and chauffeur for the day. Buy Australia Zoo and Maleny Botanic Gardens tickets direct, and check their websites for the day’s opening hours.'],
      ['Can we change the itinerary?', 'Yes, it is a private tour. Stay longer at the zoo, skip a stop or add a lunch in Maleny — tell us when you enquire and we will plan the day around it within the hours you book.'],
      ['How do we book?', 'Send the enquiry below with your date, group size and pick-up. We check the date and a vehicle are free and confirm with a written price, usually within the hour. Nothing is charged until then.'],
      ['We only want the zoo, not the whole day.', 'Then a return transfer is cheaper: the car drops you at the zoo and comes back at the time you choose.'],
      ['Is it suitable for young children?', 'Yes. Child seats are $15 each and fitted before we arrive, and a People Mover or Luxury Minivan takes a pram in the back.'],
    ],
  },
];
