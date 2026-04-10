// Reserve TOEIC data for future migration into `card/toeic.js`.
// Intentionally not loaded by the game yet.
// When this content is approved for production, move the items below into `TOEIC_DATA`.

const TOEIC_RESERVE_DATA = [
  {
    id: 51,
    type: 'part7',
    title: '51강 (Part 7) — Part 7 Multiple Passages (Set 12)',
    questions: [
      {
        id: '51-1',
        question: 'According to the Web page, which feature is included in the Business plan?',
        options: [
          '100 GB of storage',
          'Shared task boards',
          'CSV and PDF export',
          'Due-date reminders'
        ],
        answer: 'CSV and PDF export'
      },
      {
        id: '51-2',
        question: 'According to the renewal notice, when will Riverton Design Studio be charged if no changes are made?',
        options: [
          'August 26',
          'August 29',
          'August 31',
          'September 1'
        ],
        answer: 'August 31'
      },
      {
        id: '51-3',
        question: 'Why did Maya Torres write to Billing Support?',
        options: [
          'To request a refund for extra licenses',
          'To ask about changing the seat count and billing cycle',
          'To report that the renewal notice was sent too early',
          'To cancel Riverton Design Studio’s account immediately'
        ],
        answer: 'To ask about changing the seat count and billing cycle'
      },
      {
        id: '51-4',
        question: 'If Riverton renews with 8 Business annual licenses, what will the new annual renewal amount most likely be?',
        options: [
          '$840.00',
          '$900.00',
          '$960.00',
          '$1,020.00'
        ],
        answer: '$960.00'
      },
      {
        id: '51-5',
        question: 'In the Web page, the word “prorated” is closest in meaning to',
        options: [
          'adjusted proportionally',
          'paid automatically',
          'renewed monthly',
          'shared equally'
        ],
        answer: 'adjusted proportionally'
      }
    ],
    passage: `Document 1: Web Page

TASKFLOW CLOUD
Team Plan Overview

Choose the plan that fits your team.

Standard
$84 per user/year
Includes:
- Shared task boards
- Due-date reminders
- 100 GB of storage

Business
$120 per user/year
Includes all Standard features, plus:
- Permission controls
- Activity history
- CSV and PDF export
- 1 TB of storage

Billing Notes
- Annual plans renew automatically on the renewal date shown in your account.
- Renewal notices are e-mailed 14 days before the renewal date.
- Additional users added at renewal are billed at the regular annual rate.
- Additional users added mid-cycle are prorated based on the number of full months remaining.
- Changes from annual to monthly billing take effect on the next renewal date.

Document 2: Renewal Notice

TASKFLOW CLOUD — Renewal Notice
Notice Date: August 17, 2027
Account: Riverton Design Studio
Current Plan: Business (Annual)
Current Users: 6
Renewal Date: August 31, 2027
Amount Due on Renewal: $720.00

Scheduled Renewal Summary
- Plan will renew as Business (Annual).
- 6 user licenses will renew automatically.
- Payment method ending in 1142 will be charged on August 31.
- To change seat count or billing frequency for this renewal, update your account by August 29.

Document 3: E-mail

Subject: August 31 renewal — seat count question
From: Maya Torres <maya@rivertondesign.com>
To: Billing Support <billing@taskflowcloud.com>
Date: August 26, 2027

Hello,

I received the renewal notice for our Business annual plan. We expect two new project coordinators to start in early September, so I’d like to increase our seat count from six to eight. Please confirm whether I can make that change for the August 31 renewal instead of adding the licenses this week.

Also, our finance manager asked whether switching to monthly billing would take effect right away or only after the current annual term ends.

Thank you,
Maya Torres
Studio Manager`
  },
  {
    id: 52,
    type: 'part7',
    title: '52강 (Part 7) — Part 7 Multiple Passages (Set 13)',
    questions: [
      {
        id: '52-1',
        question: 'What is the main purpose of the article?',
        options: [
          'To announce the relocation of a library branch',
          'To describe a new service available at Midtown Public Library',
          'To request donations for a community history project',
          'To explain how to join the library’s staff'
        ],
        answer: 'To describe a new service available at Midtown Public Library'
      },
      {
        id: '52-2',
        question: 'According to the reservation confirmation, what time is Ana Gomez’s reserved session scheduled to begin?',
        options: [
          '3:00 p.m.',
          '3:15 p.m.',
          '3:30 p.m.',
          '5:00 p.m.'
        ],
        answer: '3:30 p.m.'
      },
      {
        id: '52-3',
        question: 'Why did Ana Gomez write to Ben Park?',
        options: [
          'To ask him to reserve a second appointment',
          'To remind him to attend the library orientation',
          'To ask him to provide materials needed for the appointment',
          'To tell him that the project has been postponed'
        ],
        answer: 'To ask him to provide materials needed for the appointment'
      },
      {
        id: '52-4',
        question: 'What is suggested about Ana Gomez?',
        options: [
          'She has already paid for two appointments',
          'She has not attended the library’s monthly introduction class',
          'She reserved the Photo Station instead of the Video Conversion Station',
          'She made the reservation more than 14 days in advance'
        ],
        answer: 'She has not attended the library’s monthly introduction class'
      },
      {
        id: '52-5',
        question: 'In the e-mail, the word “labeled” is closest in meaning to',
        options: [
          'borrowed',
          'marked',
          'repaired',
          'sealed'
        ],
        answer: 'marked'
      }
    ],
    passage: `Document 1: Article

CITY LIFE WEEKLY
Midtown Library Opens Digitization Lab for Public Use

The Midtown Public Library has opened a new Digitization Lab on the second floor of its West Annex. The lab allows visitors to convert old photographs, slides, and VHS tapes into digital files using library equipment. The service is available Tuesday through Saturday by reservation.

Two types of stations are offered. The Photo Station includes a flatbed scanner and slide converter and costs $12 for a 90-minute session. The Video Conversion Station, which transfers VHS tapes to digital files, costs $18 for 90 minutes.

Because the video equipment requires a short setup demonstration, first-time Video Conversion Station users must arrive 15 minutes before their session for an orientation. This requirement is waived for people who have attended the library’s monthly introduction class. All users should bring their own external storage drive to save files. Reservations can be made through the library Web site up to 14 days in advance.

Document 2: Reservation Confirmation

MIDTOWN PUBLIC LIBRARY — Digitization Lab Reservation
Name: Ana Gomez
Reservation No.: DL-91874
Date: Friday, September 18, 2027
Station: Video Conversion Station
Check-in / Orientation: 3:15 p.m.
Session Time: 3:30–5:00 p.m.
Fee: $18.00
Bring: VHS tapes and an external storage drive
Cancellation: Cancel by Thursday, September 17, 12:00 p.m. for a full refund
Location: West Annex, 2nd Floor

Document 3: E-mail

Subject: Friday digitization appointment
From: Ana Gomez <ana.gomez@riverwatch.org>
To: Ben Park <ben.park@riverwatch.org>
Date: September 16, 2027

Hi Ben,

I booked the library’s Video Conversion Station for Friday afternoon so we can digitize the interview tapes for the Riverwatch history project. Could you leave the labeled VHS cassettes on my desk before you head out tomorrow?

The library provides the converter, but we need to bring our own external drive to save the files. If you still have the 1 TB drive we used for last month’s presentation, please bring that as well.

Thanks,
Ana`
  },
  {
    id: 53,
    type: 'part6',
    title: '53강 (Part 6) — 채용 지원 서류 보완 요청 이메일 (지문 1개 + 4문항)',
    questions: [
      {
        id: '53-1',
        question: 'Select the best answer for blank (1).',
        options: ['so', 'unless', 'whereas', 'although'],
        answer: 'so'
      },
      {
        id: '53-2',
        question: 'Select the best answer for blank (2).',
        options: ['if', 'because', 'despite', 'meanwhile'],
        answer: 'if'
      },
      {
        id: '53-3',
        question: 'Select the best answer for blank (3).',
        options: ['document', 'documented', 'documentation', 'documenting'],
        answer: 'documentation'
      },
      {
        id: '53-4',
        question: 'Sentence Insertion \n \nIn which of the positions marked [1], [2], [3], and [4] does the following sentence best belong? \n \nSentence: You will receive an automated confirmation each time a file is uploaded successfully.',
        options: ['[1]', '[2]', '[3]', '[4]'],
        answer: '[2]'
      }
    ],
    passage: `Directions: Read the text below and choose the best answer for each blank.

Subject: Additional Materials for Your Application

Dear Ms. Ahmed,

Thank you for applying for the Inventory Planning Specialist position at Westfield Logistics. After an initial review of your résumé, we would like to continue with your application. Before we arrange interviews, please upload a copy of your spreadsheet certification and your most recent reference list through the applicant portal. [1]

All supporting documents should be submitted by 5:00 p.m. on Thursday, September 10. Files must be in PDF format, and each file name should include your last name and the job title. [2] Once all items have been received, a recruiting coordinator will contact you to schedule a 30-minute online interview.

Applications are being reviewed on a rolling basis, (1) _______ we recommend completing this step as soon as possible. [3] If you have already uploaded the requested materials, you do not need to send them again. Instead, reply to this e-mail so we can confirm that your file is complete.

If you have trouble using the portal, you may send the documents directly to careers@westfield.example, (2) _______ the message is sent before the deadline above. [4] Candidates selected for interviews may be asked to provide additional (3) _______ , such as writing samples or employment records.

Thank you again for your interest in Westfield Logistics.

Sincerely,
Hiring Team
Westfield Logistics`
  },
  {
    id: 54,
    type: 'part6',
    title: '54강 (Part 6) — 출장 일정 변경 + 호텔 예약 조정 안내 (지문 1개 + 4문항)',
    questions: [
      {
        id: '54-1',
        question: 'Select the best answer for blank (1).',
        options: ['rebooked', 'rebooking', 'rebook', 'rebooks'],
        answer: 'rebooked'
      },
      {
        id: '54-2',
        question: 'Select the best answer for blank (2).',
        options: ['apply', 'applies', 'applied', 'applying'],
        answer: 'apply'
      },
      {
        id: '54-3',
        question: 'Select the best answer for blank (3).',
        options: ['if', 'though', 'unless', 'because'],
        answer: 'if'
      },
      {
        id: '54-4',
        question: 'Sentence Insertion \n \nIn which of the positions marked [1], [2], [3], and [4] does the following sentence best belong? \n \nSentence: Because of the later arrival time, your breakfast meeting with the local purchasing team has been moved from 8:30 a.m. to 9:15 a.m.',
        options: ['[1]', '[2]', '[3]', '[4]'],
        answer: '[1]'
      }
    ],
    passage: `Directions: Read the text below and choose the best answer for each blank.

Subject: Revised Itinerary for the Osaka Supplier Visit

Dear Mr. Ito,

Due to scheduled maintenance on the Airport Express line, the 6:45 a.m. train from Kansai Airport to central Osaka on Wednesday, October 14, has been canceled. We have therefore (1) _______ you on the 7:20 a.m. limited express, which is expected to arrive at Namba Station at 8:06 a.m. [1]

Your reservation at the Harbor View Hotel has also been updated. Because the plant tour at Shinsei Components will end later than originally planned, your checkout date has been changed from Wednesday, October 14, to Thursday, October 15. The corporate room rate will still (2) _______ , so no additional authorization is required. [2]

The driver who was scheduled to meet you at Namba Station is no longer available. However, the hotel operates a complimentary shuttle from Stop C every 20 minutes, and the trip to the hotel takes about 12 minutes. [3]

Please review the attached itinerary carefully and let me know right away (3) _______ any of the reservation details need to be corrected. Once you confirm the changes, I will send the updated booking numbers and final meeting agenda. [4]

Best regards,
Naoko Sato
Travel Coordinator
Keihin Industrial Group`
  },
  {
    id: 55,
    type: 'part5',
    title: '55강 (Part 5) — 관사/한정사/고정 표현 (3문항)',
    questions: [
      {
        id: '55-1',
        question: 'The consultant will provide ______ overview of the revised distribution plan at tomorrow’s briefing.',
        options: ['a', 'an', 'the', 'each'],
        answer: 'an'
      },
      {
        id: '55-2',
        question: 'Employees who need parking permits should submit the request form to ______ Human Resources office on the second floor.',
        options: ['a', 'an', 'the', 'some'],
        answer: 'the'
      },
      {
        id: '55-3',
        question: 'Replacement chargers will be sent at ______ additional cost to customers affected by the recall.',
        options: ['any', 'no', 'none', 'without'],
        answer: 'no'
      }
    ]
  },
  {
    id: 56,
    type: 'part5',
    title: '56강 (Part 5) — 간접의문문/의문사절 (3문항)',
    questions: [
      {
        id: '56-1',
        question: 'Please confirm ______ the revised contract has been signed by both parties.',
        options: ['whether', 'what', 'how', 'whose'],
        answer: 'whether'
      },
      {
        id: '56-2',
        question: 'The technician demonstrated ______ the wireless scanner should be reset after each shift.',
        options: ['how', 'that', 'where', 'which'],
        answer: 'how'
      },
      {
        id: '56-3',
        question: 'We have not yet decided ______ the temporary reception desk will be removed from the lobby.',
        options: ['when', 'that', 'which', 'why'],
        answer: 'when'
      }
    ]
  },
  {
    id: 57,
    type: 'part5',
    title: '57강 (Part 5) — 접속부사/전환 표현 (3문항)',
    questions: [
      {
        id: '57-1',
        question: 'The package was sent to the wrong branch; ______, a replacement order was prepared immediately.',
        options: ['however', 'therefore', 'otherwise', 'instead'],
        answer: 'therefore'
      },
      {
        id: '57-2',
        question: 'The software patch has been installed; ______, users may still experience slower loading times this morning.',
        options: ['furthermore', 'however', 'therefore', 'otherwise'],
        answer: 'however'
      },
      {
        id: '57-3',
        question: 'Please include your invoice number on the form; ______, the Finance team may not be able to process your request.',
        options: ['similarly', 'otherwise', 'instead', 'nevertheless'],
        answer: 'otherwise'
      }
    ]
  },
  {
    id: 58,
    type: 'part5',
    title: '58강 (Part 5) — 병렬구조/등위접속사 (3문항)',
    questions: [
      {
        id: '58-1',
        question: 'The new scheduling tool can assign meeting rooms, send reminder e-mails, and ______ attendance records automatically.',
        options: ['update', 'updates', 'updating', 'updated'],
        answer: 'update'
      },
      {
        id: '58-2',
        question: 'Employees may reserve the fitness studio either through the company app ______ at the front desk.',
        options: ['and', 'or', 'but', 'so'],
        answer: 'or'
      },
      {
        id: '58-3',
        question: 'The branch manager asked the assistant to print the handouts and ______ the visitor badges before noon.',
        options: ['prepares', 'prepare', 'prepared', 'preparing'],
        answer: 'prepare'
      }
    ]
  }
];
