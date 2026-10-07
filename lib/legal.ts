/**
 * The Privacy Policy and Terms of Use, as data, so the two pages share one
 * layout and a change of wording is a change here.
 *
 * Written from what Sonder actually does (the migrations and lib/ are the
 * source of truth). When the product changes what it collects, shares or
 * promises, change the text in the same commit and bump LEGAL_UPDATED.
 */

export const LEGAL_UPDATED = 'October 7, 2026';

/** Where people write about their data or these terms. Empty hides the line. */
export const CONTACT_EMAIL = '';

export type LegalSection = { heading: string; paragraphs: string[]; bullets?: string[] };

export type LegalDocument = {
  title: string;
  intro: string;
  sections: LegalSection[];
};

export const PRIVACY: LegalDocument = {
  title: 'Privacy Policy',
  intro:
    'Sonder gives every car a history, keyed to its VIN. This page says what Sonder collects, who can see it, who helps run it, and what you can do about it. It is meant to be read, so it is plain.',
  sections: [
    {
      heading: 'What Sonder collects',
      paragraphs: ['Only what the app needs to do its job:'],
      bullets: [
        'Your account: the email address you sign up with and your password (kept by our sign-in provider in a form we cannot read), plus the handle, display name and region you choose to add. Region is a region, never an address.',
        'Your garage: the VINs you add and the details decoded from them (year, make, model and so on); the log entries you write, with their dates, odometer readings, costs, notes and parts; the photos you upload; the reminders you set.',
        'What you do with others: cars and members you follow or block, meets you host or say you are going to (and the car you bring), listings you post (price and the contact line you write), messages you send, and reports you file.',
        'Technical: a sign-in token kept in your browser or app so you stay signed in, and the usual request records (such as your IP address and browser) that our hosting providers keep to run and secure the service.',
      ],
    },
    {
      heading: 'What Sonder does not do',
      paragraphs: [
        'No advertising, no analytics trackers, and no selling of personal data. Your email address is used to run your account and to send the emails described below, nothing else.',
      ],
    },
    {
      heading: 'Who can see what',
      paragraphs: [
        'Private is the default. Nothing about you or your car is public until you publish it.',
      ],
      bullets: [
        'Your garage, log, reminders and messages are visible only to you (and, for messages, the person you are writing to).',
        'Publishing a car makes its passport public at imsonder.com/p/ followed by the VIN: anyone with the link can read it, and it can be previewed in other apps. A passport shows the car, its photos and its log, including earlier owners’ entries if you inherited them with a transfer code. An earlier owner is named only if they published their own period.',
        'Once you have published a car, your name, handle and region appear on your member page at imsonder.com/u/ followed by your handle, with your published cars.',
        'Signed-in members can see a profile if it is yours, belongs to someone who has published a car, or there is a connection: you follow each other, share a conversation, or one of you hosts or is going to a meet the other can see. Everyone else’s profile stays private.',
        'A listing’s price and contact line are public while the car is listed, and are cleared when the listing ends.',
        'Meets are for signed-in members: they show the host, who is going and the car each person is bringing.',
      ],
    },
    {
      heading: 'When a car changes hands',
      paragraphs: [
        'A car’s history belongs to the car. When you sell, you get a transfer code to give the buyer. A buyer who enters it inherits the earlier log; anyone who adds the car without it starts a fresh log and cannot read yours. Your entries stay credited to you, and once a period has ended nobody can change or delete what was recorded in it.',
      ],
    },
    {
      heading: 'Who helps run Sonder',
      paragraphs: [
        'Sonder uses a few providers to work, and they handle data on our behalf:',
      ],
      bullets: [
        'Supabase: our database, sign-in and file storage.',
        'Vercel: hosting for the website and app.',
        'Resend: delivery of the emails Sonder sends.',
        'The US National Highway Traffic Safety Administration (NHTSA): when you look up a VIN, that VIN is sent to NHTSA’s public vehicle database to fill in the car’s details. Nothing about you is sent with it.',
      ],
    },
    {
      heading: 'Emails',
      paragraphs: [
        'Sonder emails you to confirm your address, sign you in with a link, reset a password and confirm a change of email. You need these to use your account.',
        'It can also email you about unread messages and when a maintenance reminder comes due. Both are on by default, have a switch in Profile, and carry an unsubscribe link. A message email says who wrote and how many, never what they said. A reminder email names the car and the reminder you wrote, never a date or a mileage.',
      ],
    },
    {
      heading: 'Your choices',
      paragraphs: ['You are in control of most of this from inside the app:'],
      bullets: [
        'Edit your profile, change your email or password, and switch emails on or off in Profile.',
        'Publish or unpublish any car at any time. Unpublishing closes its passport link.',
        'Block members, and report meets, listings, messages or a car someone else has claimed.',
        'Delete your account in Profile. That erases your profile, the cars still in your garage with their log and photos, the messages you sent, your follows and your settings. Past periods of cars you sold stay with those cars so the next owner’s history survives, but with your identity removed and unpublished.',
      ],
    },
    {
      heading: 'Children',
      paragraphs: [
        'Sonder is not for children under 13, and we do not knowingly collect their information. If you believe a child has an account, tell us and we will remove it.',
      ],
    },
    {
      heading: 'Security and where data lives',
      paragraphs: [
        'Data is encrypted in transit, and access to it is limited by database rules that are tested. No service is perfectly secure, and we cannot promise otherwise. Our providers may process data in the United States and other countries.',
      ],
    },
    {
      heading: 'Changes',
      paragraphs: [
        'If this policy changes in a way that matters, the date at the top will change, and for big changes we will say so in the app or by email.',
      ],
    },
  ],
};

export const TERMS: LegalDocument = {
  title: 'Terms of Use',
  intro:
    'These are the rules for using Sonder. By creating an account or using the service you agree to them. If you do not agree, please do not use it.',
  sections: [
    {
      heading: 'Who runs Sonder',
      paragraphs: [
        'Sonder is a small project run by Jiaxiang Jin. It is early software: it can change, have bugs, or be unavailable.',
      ],
    },
    {
      heading: 'Your account',
      paragraphs: [
        'You must be at least 13. Give an accurate email address, keep your sign-in methods to yourself, and tell us if you think someone else has got into your account. You are responsible for what happens under your account.',
      ],
    },
    {
      heading: 'Your content',
      paragraphs: [
        'You own what you write and upload. You give Sonder permission to store it, to show it the way you have chosen (privately, or publicly once you publish), and to keep a car’s history attached to the car as described below. Only post what you have the right to post, and nothing that exposes someone else’s private information. Never put an address in your region.',
      ],
    },
    {
      heading: 'How a car’s history works',
      paragraphs: [
        'History belongs to the car. When you sell a car, its log stays with it, your entries stay credited to you, and a period that has ended cannot be edited or deleted by anyone. A buyer inherits the earlier log only with the transfer code you give them. If you delete your account, your past periods of cars you sold stay with those cars, without your identity.',
        'Adding a car does not prove you own it. If someone has added a car that is yours, report it from the Add a car screen and we will look into it.',
      ],
    },
    {
      heading: 'Acceptable use',
      paragraphs: ['Sonder is for legal car culture: meets, builds, track days and the people who care about them. You agree not to:'],
      bullets: [
        'promote or organise street racing, takeovers or reckless driving;',
        'post scams, fake or misleading listings, or pretend to be someone else;',
        'claim a car you do not own, or write false history for a car;',
        'send spam or harass anyone, or share someone’s private information;',
        'scrape, overload or attack the service, or try to get around how it protects people’s data.',
      ],
    },
    {
      heading: 'What we may do',
      paragraphs: [
        'Members can report meets, listings and messages, and enough reports can hide a meet, take a listing down or pause a sender automatically. We may also remove content, hide or end listings and meets, pause messaging, or suspend or close accounts that break these terms or put others at risk.',
      ],
    },
    {
      heading: 'Passports, listings and meets are not guarantees',
      paragraphs: [
        'What is in a passport is written by owners and is not checked by Sonder. Vehicle details come from a public database and can contain errors. Do not rely on a passport alone to decide whether to buy a car, and always inspect it yourself.',
        'Sonder is not a party to any sale, handles no payments, and does not vouch for any seller, buyer or meet. You deal with other people at your own risk. Follow the law and be careful at meets.',
      ],
    },
    {
      heading: 'The service as is',
      paragraphs: [
        'Sonder is provided as it is, without promises that it will always work, be error-free or keep any particular data. To the fullest extent the law allows, Sonder and its owner are not liable for indirect or consequential losses, or for losses from your dealings with other members. Nothing in these terms limits anything the law does not allow to be limited.',
      ],
    },
    {
      heading: 'Ending your use',
      paragraphs: [
        'You can stop at any time and delete your account in Profile. We may suspend or end the service or your access, and will try to give notice when we reasonably can.',
      ],
    },
    {
      heading: 'Changes to these terms',
      paragraphs: [
        'We may update these terms. The date above will change, and if you keep using Sonder after a change, you accept the new terms. For changes that matter we will say so in the app or by email.',
      ],
    },
  ],
};
