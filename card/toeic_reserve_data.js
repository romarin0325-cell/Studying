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
,
{
  "id": 59,
  "type": "part7",
  "title": "59강 (Part 7) — Part 7 Multiple Passages (Set 14)",
  "questions": [
    {
      "id": "59-1",
      "question": "According to the Web page, who may apply for a monthly parking permit?",
      "options": [
        "Any employee with a company ID",
        "Full-time employees who work onsite at least three days per week",
        "Employees who arrive before 8:00 a.m. each day",
        "Only employees in Procurement or Facilities"
      ],
      "answer": "Full-time employees who work onsite at least three days per week"
    },
    {
      "id": "59-2",
      "question": "According to the assignment notice, why was Lena Cho assigned to the Overflow Lot for October?",
      "options": [
        "She requested the least expensive option",
        "North Lot permits were reserved for visitors",
        "East Garage will undergo resurfacing work",
        "Her application was submitted after the deadline"
      ],
      "answer": "East Garage will undergo resurfacing work"
    },
    {
      "id": "59-3",
      "question": "Why did Lena Cho write to Facilities Support?",
      "options": [
        "To cancel her October permit entirely",
        "To ask about a different arrangement because she works early shifts",
        "To report that the shuttle stop has been moved",
        "To request a refund for September parking charges"
      ],
      "answer": "To ask about a different arrangement because she works early shifts"
    },
    {
      "id": "59-4",
      "question": "What is indicated about the Overflow Lot?",
      "options": [
        "It is closer to the building than the North Lot",
        "It can be used at any time with a company ID",
        "It is served by a shuttle from Stop 2",
        "It is covered and costs $95 per month"
      ],
      "answer": "It is served by a shuttle from Stop 2"
    },
    {
      "id": "59-5",
      "question": "In the e-mail, the word \"reassigned\" is closest in meaning to",
      "options": [
        "moved to a different option",
        "charged a new fee",
        "checked in manually",
        "listed in advance"
      ],
      "answer": "moved to a different option"
    }
  ],
  "passage": `Document 1: Web Page

PARKLANE CENTER
Employee Parking Permit Program — October 2027

Permit Options
East Garage (covered): $95/month
North Lot (outdoor): $60/month, approximately a five-minute walk to the main lobby
Overflow Lot (outdoor): $35/month, available after 8:30 a.m. only. Complimentary Route B shuttle departs from Stop 2 every 12 minutes.

Eligibility
Full-time employees scheduled onsite at least three days each workweek may apply for a monthly permit.

Application Deadline
September 20 for October permits

Pickup
Approved permits may be picked up beginning September 25 at the Security Desk. A photo ID is required.

Notes
Assignments are based on availability and may be adjusted during maintenance periods.

Document 2: Assignment Notice

PARKLANE CENTER — October Parking Assignment
Employee: Lena Cho
Department: Procurement
Permit type requested: East Garage
Status: Approved
Assigned location: Overflow Lot
Pickup available: September 25, 9:00 a.m.–5:00 p.m. at the Security Desk

Important: Because resurfacing work will take place in East Garage throughout October, employees who requested covered parking have been temporarily assigned to alternate areas. Please display the permit at all times while parked on site.

Document 3: E-mail

Subject: October parking assignment
From: Lena Cho <lcho@parklane.example>
To: Facilities Support <facilities@parklane.example>
Date: September 23, 2027

Hello,

I received my October permit notice and saw that I was assigned to the Overflow Lot. On Mondays and Wednesdays, I arrive before 7:15 a.m. to receive vendor sample deliveries for Procurement. Since the Overflow Lot cannot be used until 8:30 a.m. and the shuttle does not begin running until 8:20, would it be possible to be reassigned to the North Lot or to receive temporary access closer to the building on those early-shift days?

Also, I will be out of town on September 25. May I pick up the permit on September 26 instead?

Thank you,
Lena Cho`
},
{
  "id": 60,
  "type": "part7",
  "title": "60강 (Part 7) — Part 7 Multiple Passages (Set 15)",
  "questions": [
    {
      "id": "60-1",
      "question": "According to the Web page, what is required for same-day pickup?",
      "options": [
        "A request entered by 11:30 a.m. on a business day",
        "A Premium account and prepaid label",
        "At least three packages to the same destination",
        "A phone confirmation from customer service"
      ],
      "answer": "A request entered by 11:30 a.m. on a business day"
    },
    {
      "id": "60-2",
      "question": "According to the pickup confirmation, what must be given to the driver?",
      "options": [
        "A packing list and proof of insurance",
        "Three signed commercial invoices",
        "A blank return label",
        "Two photo IDs"
      ],
      "answer": "Three signed commercial invoices"
    },
    {
      "id": "60-3",
      "question": "Why did Nari Kim write to Ben Walsh?",
      "options": [
        "To ask him to prepare the shipment materials before the courier arrives",
        "To tell him the pickup had been postponed until the next day",
        "To confirm that the label printer has been repaired",
        "To ask him to change the destination address"
      ],
      "answer": "To ask him to prepare the shipment materials before the courier arrives"
    },
    {
      "id": "60-4",
      "question": "What is suggested about BrightArc Interiors?",
      "options": [
        "It requested paperless customs processing",
        "It has a Premium account with SwiftLane Courier",
        "It will provide its own shipping label",
        "It scheduled the pickup after the cutoff time"
      ],
      "answer": "It will provide its own shipping label"
    },
    {
      "id": "60-5",
      "question": "In Document 2, the word \"window\" is closest in meaning to",
      "options": [
        "container",
        "time period",
        "office counter",
        "glass opening"
      ],
      "answer": "time period"
    }
  ],
  "passage": `Document 1: Web Page

SWIFTLANE COURIER
Business Pickup Services

Same-day pickup is available Monday through Friday for requests entered by 11:30 a.m.

All pickups are scheduled in two-hour windows.

International shipments require three copies of a signed commercial invoice unless the Paperless Customs option is selected.

Label printing at pickup is available only for Premium account holders.

If the pickup address is changed after confirmation, an $8 service fee applies.

Temperature-sensitive items are not accepted through standard pickup.

Document 2: Pickup Confirmation

SWIFTLANE COURIER — Pickup Confirmation
Shipment No.: SW-77421
Account: BrightArc Interiors
Pickup date: Thursday, November 4, 2027
Pickup window: 2:00–4:00 p.m.
Service: International Express
Destination: Auckland, New Zealand
Packages: 1 carton / 4.2 kg
Label status: Customer printed
Paperless customs option: No
Driver instructions: Collect 3 signed commercial invoices at pickup

Document 3: E-mail

Subject: This afternoon’s courier pickup
From: Nari Kim <nkim@brightarc.example>
To: Ben Walsh <bwalsh@brightarc.example>
Date: November 4, 2027

Hi Ben,

Could you leave the finish-sample box at reception by 1:45 this afternoon? I scheduled the Auckland shipment for the 2:00–4:00 p.m. pickup window.

I attached the shipping label because our SwiftLane account does not include driver label printing. Also, since I did not select the paperless customs option, please place the three signed commercial invoices in the clear pouch on the carton before the driver arrives.

If the courier comes while I’m still in the client call, reception can release the package using shipment number SW-77421.

Thanks,
Nari`
},
{
  "id": 61,
  "type": "part6",
  "title": "61강 (Part 6) — 복리후생 등록 마감 안내 이메일 (지문 1개 + 4문항)",
  "questions": [
    {
      "id": "61-1",
      "question": "Select the best answer for blank (1).",
      "options": [
        "change",
        "changes",
        "changed",
        "changing"
      ],
      "answer": "change"
    },
    {
      "id": "61-2",
      "question": "Select the best answer for blank (2).",
      "options": [
        "unless",
        "so that",
        "although",
        "whereas"
      ],
      "answer": "so that"
    },
    {
      "id": "61-3",
      "question": "Select the best answer for blank (3).",
      "options": [
        "event",
        "events",
        "eventual",
        "even"
      ],
      "answer": "event"
    },
    {
      "id": "61-4",
      "question": "Sentence Insertion \n \nIn which of the positions marked [1], [2], [3], and [4] does the following sentence best belong? \n \nSentence: Paper enrollment forms will not be accepted this year.",
      "options": [
        "[1]",
        "[2]",
        "[3]",
        "[4]"
      ],
      "answer": "[1]"
    }
  ],
  "passage": `Directions: Read the text below and choose the best answer for each blank.

Subject: Reminder: Benefits Enrollment Deadline

Dear Employees,

Annual open enrollment for medical and dental coverage will close at 5:00 p.m. on Friday, November 13. All benefit selections must be submitted through the HR portal by that time. [1]

If you wish to add or remove dependents, please upload the required supporting documents, such as birth certificates or proof of residence, before completing your selections. Elections submitted without proper documentation may be delayed or returned for correction. [2]

Even if you plan to keep your current coverage, you should still review the plan summaries carefully, as several monthly premium rates will (1) _______ effective January 1. [3]

If you are unable to access the portal, contact Human Resources as soon as possible (2) _______ we can help you complete the process before the deadline. [4] Employees who miss the enrollment period may be able to make changes later only after a qualifying (3) _______.`
},
{
  "id": 62,
  "type": "part6",
  "title": "62강 (Part 6) — 재고 실사 일정 및 작업 지시 메모 (지문 1개 + 4문항)",
  "questions": [
    {
      "id": "62-1",
      "question": "Select the best answer for blank (1).",
      "options": [
        "operate",
        "operation",
        "operator",
        "operating"
      ],
      "answer": "operate"
    },
    {
      "id": "62-2",
      "question": "Select the best answer for blank (2).",
      "options": [
        "at",
        "by",
        "for",
        "until"
      ],
      "answer": "by"
    },
    {
      "id": "62-3",
      "question": "Select the best answer for blank (3).",
      "options": [
        "prepare",
        "prepared",
        "preparation",
        "preparations"
      ],
      "answer": "preparations"
    },
    {
      "id": "62-4",
      "question": "Sentence Insertion \n \nIn which of the positions marked [1], [2], [3], and [4] does the following sentence best belong? \n \nSentence: Scanners that are not working properly should be exchanged at the equipment desk before counting begins.",
      "options": [
        "[1]",
        "[2]",
        "[3]",
        "[4]"
      ],
      "answer": "[2]"
    }
  ],
  "passage": `Directions: Read the text below and choose the best answer for each blank.

Subject: Instructions for Saturday Inventory Count

Dear Warehouse Team,

The quarterly inventory count for Building C will take place on Saturday, December 5, from 7:00 a.m. to 1:00 p.m. During that time, no outgoing shipments will be processed from the facility. [1]

Team supervisors will distribute zone assignments on Thursday afternoon. Please review your section before arriving, and report any missing shelf labels to Operations by Friday at noon. [2]

To reduce errors, each item must be scanned twice, and any quantity differences should be recorded on the variance sheet immediately. Temporary staff will assist with pallet movement, but only certified forklift operators may (1) _______ equipment in the loading area. [3]

After the count is complete, supervisors will compare the results with the inventory system and submit a summary (2) _______ 3:00 p.m. Monday. [4] Employees scheduled to work that day will receive overtime pay according to company policy. If you need special protective gear, contact the Safety Office so the necessary (3) _______ can be made in advance.`
},
{
  "id": 63,
  "type": "part5",
  "title": "63강 (Part 5) — 시간/조건 부사절의 시제 (3문항)",
  "questions": [
    {
      "id": "63-1",
      "question": "By the time the inspectors arrive, the maintenance team ______ the safety barriers around the work area.",
      "options": [
        "will install",
        "installed",
        "has installed",
        "will have installed"
      ],
      "answer": "will have installed"
    },
    {
      "id": "63-2",
      "question": "Please keep the samples refrigerated until the courier ______ them up this afternoon.",
      "options": [
        "picks",
        "will pick",
        "picked",
        "is picking"
      ],
      "answer": "picks"
    },
    {
      "id": "63-3",
      "question": "Once the budget revision ______ by the director, Finance will issue the updated figures to all departments.",
      "options": [
        "is approved",
        "approved",
        "approves",
        "will approve"
      ],
      "answer": "is approved"
    }
  ]
},
{
  "id": 64,
  "type": "part5",
  "title": "64강 (Part 5) — 동사 문형/동사 패턴 (3문항)",
  "questions": [
    {
      "id": "64-1",
      "question": "The new expense portal allows employees ______ receipts directly from their phones.",
      "options": [
        "to upload",
        "uploading",
        "upload",
        "uploaded"
      ],
      "answer": "to upload"
    },
    {
      "id": "64-2",
      "question": "Our legal team advised the supplier ______ the wording in Section 4 before signing the contract.",
      "options": [
        "revise",
        "to revise",
        "revising",
        "revised"
      ],
      "answer": "to revise"
    },
    {
      "id": "64-3",
      "question": "The delay prevented the technicians from ______ the network test before noon.",
      "options": [
        "completing",
        "complete",
        "completed",
        "to complete"
      ],
      "answer": "completing"
    }
  ]
},
{
  "id": 65,
  "type": "part5",
  "title": "65강 (Part 5) — 출장/배송/예약 실무 어휘 (3문항)",
  "questions": [
    {
      "id": "65-1",
      "question": "The hotel agreed to waive the late check-out ______ because the flight had been canceled.",
      "options": [
        "fee",
        "fare",
        "price",
        "salary"
      ],
      "answer": "fee"
    },
    {
      "id": "65-2",
      "question": "Customers can track the status of each ______ by entering the reference number online.",
      "options": [
        "shipment",
        "payroll",
        "brochure",
        "warranty"
      ],
      "answer": "shipment"
    },
    {
      "id": "65-3",
      "question": "Please review the attached ______ for tomorrow’s client visit and notify me of any scheduling conflicts.",
      "options": [
        "itinerary",
        "contract",
        "résumé",
        "inventory"
      ],
      "answer": "itinerary"
    }
  ]
},
{
  "id": 66,
  "type": "part5",
  "title": "66강 (Part 5) — 실무 콜로케이션/복합명사 (3문항)",
  "questions": [
    {
      "id": "66-1",
      "question": "All visitors must check in at the security ______ before entering the laboratory wing.",
      "options": [
        "desk",
        "label",
        "batch",
        "item"
      ],
      "answer": "desk"
    },
    {
      "id": "66-2",
      "question": "The marketing team asked for advance ______ before any changes were made to the promotional schedule.",
      "options": [
        "notice",
        "notify",
        "notification",
        "notifying"
      ],
      "answer": "notice"
    },
    {
      "id": "66-3",
      "question": "The replacement parts are still pending manager ______, so the repair cannot begin yet.",
      "options": [
        "approval",
        "approve",
        "approved",
        "approving"
      ],
      "answer": "approval"
    }
  ]
}

];
