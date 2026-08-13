// Reserve TOEIC data for future migration into `card/toeic.js`.
// Intentionally not loaded by the game yet.
// When this content is approved for production, move the items below into `TOEIC_DATA`.

const TOEIC_RESERVE_DATA = [
  {
    "id": 60,
    "type": "part5",
    "title": "60강 (Part 5) — 간접의문문/의문사절 (3문항)",
    "questions": [
      {
        "id": "60-1",
        "question": "Please confirm ______ the revised contract has been signed by both parties.",
        "options": [
          "whether",
          "what",
          "how",
          "whose"
        ],
        "answer": "whether"
      },
      {
        "id": "60-2",
        "question": "The technician demonstrated ______ the wireless scanner should be reset after each shift.",
        "options": [
          "how",
          "that",
          "where",
          "which"
        ],
        "answer": "how"
      },
      {
        "id": "60-3",
        "question": "We have not yet decided ______ the temporary reception desk will be removed from the lobby.",
        "options": [
          "when",
          "that",
          "which",
          "why"
        ],
        "answer": "when"
      }
    ]
  },
  {
    "id": 61,
    "type": "part5",
    "title": "61강 (Part 5) — 접속부사/전환 표현 (3문항)",
    "questions": [
      {
        "id": "61-1",
        "question": "The package was sent to the wrong branch; ______, a replacement order was prepared immediately.",
        "options": [
          "however",
          "therefore",
          "otherwise",
          "instead"
        ],
        "answer": "therefore"
      },
      {
        "id": "61-2",
        "question": "The software patch has been installed; ______, users may still experience slower loading times this morning.",
        "options": [
          "furthermore",
          "however",
          "therefore",
          "otherwise"
        ],
        "answer": "however"
      },
      {
        "id": "61-3",
        "question": "Please include your invoice number on the form; ______, the Finance team may not be able to process your request.",
        "options": [
          "similarly",
          "otherwise",
          "instead",
          "nevertheless"
        ],
        "answer": "otherwise"
      }
    ]
  },
  {
    "id": 62,
    "type": "part5",
    "title": "62강 (Part 5) — 병렬구조/등위접속사 (3문항)",
    "questions": [
      {
        "id": "62-1",
        "question": "The new scheduling tool can assign meeting rooms, send reminder e-mails, and ______ attendance records automatically.",
        "options": [
          "update",
          "updates",
          "updating",
          "updated"
        ],
        "answer": "update"
      },
      {
        "id": "62-2",
        "question": "Employees may reserve the fitness studio either through the company app ______ at the front desk.",
        "options": [
          "and",
          "or",
          "but",
          "so"
        ],
        "answer": "or"
      },
      {
        "id": "62-3",
        "question": "The branch manager asked the assistant to print the handouts and ______ the visitor badges before noon.",
        "options": [
          "prepares",
          "prepare",
          "prepared",
          "preparing"
        ],
        "answer": "prepare"
      }
    ]
  },
  {
    "id": 63,
    "type": "part7",
    "title": "63강 (Part 7) — Part 7 Multiple Passages (Set 14)",
    "questions": [
      {
        "id": "63-1",
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
        "id": "63-2",
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
        "id": "63-3",
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
        "id": "63-4",
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
        "id": "63-5",
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
    "passage": "Document 1: Web Page\n\nPARKLANE CENTER\nEmployee Parking Permit Program — October 2027\n\nPermit Options\nEast Garage (covered): $95/month\nNorth Lot (outdoor): $60/month, approximately a five-minute walk to the main lobby\nOverflow Lot (outdoor): $35/month, available after 8:30 a.m. only. Complimentary Route B shuttle departs from Stop 2 every 12 minutes.\n\nEligibility\nFull-time employees scheduled onsite at least three days each workweek may apply for a monthly permit.\n\nApplication Deadline\nSeptember 20 for October permits\n\nPickup\nApproved permits may be picked up beginning September 25 at the Security Desk. A photo ID is required.\n\nNotes\nAssignments are based on availability and may be adjusted during maintenance periods.\n\nDocument 2: Assignment Notice\n\nPARKLANE CENTER — October Parking Assignment\nEmployee: Lena Cho\nDepartment: Procurement\nPermit type requested: East Garage\nStatus: Approved\nAssigned location: Overflow Lot\nPickup available: September 25, 9:00 a.m.–5:00 p.m. at the Security Desk\n\nImportant: Because resurfacing work will take place in East Garage throughout October, employees who requested covered parking have been temporarily assigned to alternate areas. Please display the permit at all times while parked on site.\n\nDocument 3: E-mail\n\nSubject: October parking assignment\nFrom: Lena Cho <lcho@parklane.example>\nTo: Facilities Support <facilities@parklane.example>\nDate: September 23, 2027\n\nHello,\n\nI received my October permit notice and saw that I was assigned to the Overflow Lot. On Mondays and Wednesdays, I arrive before 7:15 a.m. to receive vendor sample deliveries for Procurement. Since the Overflow Lot cannot be used until 8:30 a.m. and the shuttle does not begin running until 8:20, would it be possible to be reassigned to the North Lot or to receive temporary access closer to the building on those early-shift days?\n\nAlso, I will be out of town on September 25. May I pick up the permit on September 26 instead?\n\nThank you,\nLena Cho"
  },
  {
    "id": 64,
    "type": "part7",
    "title": "64강 (Part 7) — Part 7 Multiple Passages (Set 15)",
    "questions": [
      {
        "id": "64-1",
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
        "id": "64-2",
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
        "id": "64-3",
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
        "id": "64-4",
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
        "id": "64-5",
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
    "passage": "Document 1: Web Page\n\nSWIFTLANE COURIER\nBusiness Pickup Services\n\nSame-day pickup is available Monday through Friday for requests entered by 11:30 a.m.\n\nAll pickups are scheduled in two-hour windows.\n\nInternational shipments require three copies of a signed commercial invoice unless the Paperless Customs option is selected.\n\nLabel printing at pickup is available only for Premium account holders.\n\nIf the pickup address is changed after confirmation, an $8 service fee applies.\n\nTemperature-sensitive items are not accepted through standard pickup.\n\nDocument 2: Pickup Confirmation\n\nSWIFTLANE COURIER — Pickup Confirmation\nShipment No.: SW-77421\nAccount: BrightArc Interiors\nPickup date: Thursday, November 4, 2027\nPickup window: 2:00–4:00 p.m.\nService: International Express\nDestination: Auckland, New Zealand\nPackages: 1 carton / 4.2 kg\nLabel status: Customer printed\nPaperless customs option: No\nDriver instructions: Collect 3 signed commercial invoices at pickup\n\nDocument 3: E-mail\n\nSubject: This afternoon’s courier pickup\nFrom: Nari Kim <nkim@brightarc.example>\nTo: Ben Walsh <bwalsh@brightarc.example>\nDate: November 4, 2027\n\nHi Ben,\n\nCould you leave the finish-sample box at reception by 1:45 this afternoon? I scheduled the Auckland shipment for the 2:00–4:00 p.m. pickup window.\n\nI attached the shipping label because our SwiftLane account does not include driver label printing. Also, since I did not select the paperless customs option, please place the three signed commercial invoices in the clear pouch on the carton before the driver arrives.\n\nIf the courier comes while I’m still in the client call, reception can release the package using shipment number SW-77421.\n\nThanks,\nNari"
  },
  {
    "id": 65,
    "type": "part6",
    "title": "65강 (Part 6) — 복리후생 등록 마감 안내 이메일 (지문 1개 + 4문항)",
    "questions": [
      {
        "id": "65-1",
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
        "id": "65-2",
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
        "id": "65-3",
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
        "id": "65-4",
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
    "passage": "Directions: Read the text below and choose the best answer for each blank.\n\nSubject: Reminder: Benefits Enrollment Deadline\n\nDear Employees,\n\nAnnual open enrollment for medical and dental coverage will close at 5:00 p.m. on Friday, November 13. All benefit selections must be submitted through the HR portal by that time. [1]\n\nIf you wish to add or remove dependents, please upload the required supporting documents, such as birth certificates or proof of residence, before completing your selections. Elections submitted without proper documentation may be delayed or returned for correction. [2]\n\nEven if you plan to keep your current coverage, you should still review the plan summaries carefully, as several monthly premium rates will (1) _______ effective January 1. [3]\n\nIf you are unable to access the portal, contact Human Resources as soon as possible (2) _______ we can help you complete the process before the deadline. [4] Employees who miss the enrollment period may be able to make changes later only after a qualifying (3) _______."
  },
  {
    "id": 66,
    "type": "part6",
    "title": "66강 (Part 6) — 재고 실사 일정 및 작업 지시 메모 (지문 1개 + 4문항)",
    "questions": [
      {
        "id": "66-1",
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
        "id": "66-2",
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
        "id": "66-3",
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
        "id": "66-4",
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
    "passage": "Directions: Read the text below and choose the best answer for each blank.\n\nSubject: Instructions for Saturday Inventory Count\n\nDear Warehouse Team,\n\nThe quarterly inventory count for Building C will take place on Saturday, December 5, from 7:00 a.m. to 1:00 p.m. During that time, no outgoing shipments will be processed from the facility. [1]\n\nTeam supervisors will distribute zone assignments on Thursday afternoon. Please review your section before arriving, and report any missing shelf labels to Operations by Friday at noon. [2]\n\nTo reduce errors, each item must be scanned twice, and any quantity differences should be recorded on the variance sheet immediately. Temporary staff will assist with pallet movement, but only certified forklift operators may (1) _______ equipment in the loading area. [3]\n\nAfter the count is complete, supervisors will compare the results with the inventory system and submit a summary (2) _______ 3:00 p.m. Monday. [4] Employees scheduled to work that day will receive overtime pay according to company policy. If you need special protective gear, contact the Safety Office so the necessary (3) _______ can be made in advance."
  },
  {
    "id": 67,
    "type": "part5",
    "title": "67강 (Part 5) — 시간/조건 부사절의 시제 (3문항)",
    "questions": [
      {
        "id": "67-1",
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
        "id": "67-2",
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
        "id": "67-3",
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
    "id": 68,
    "type": "part5",
    "title": "68강 (Part 5) — 동사 문형/동사 패턴 (3문항)",
    "questions": [
      {
        "id": "68-1",
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
        "id": "68-2",
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
        "id": "68-3",
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
    "id": 69,
    "type": "part5",
    "title": "69강 (Part 5) — 출장/배송/예약 실무 어휘 (3문항)",
    "questions": [
      {
        "id": "69-1",
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
        "id": "69-2",
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
        "id": "69-3",
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
    "id": 70,
    "type": "part5",
    "title": "70강 (Part 5) — 실무 콜로케이션/복합명사 (3문항)",
    "questions": [
      {
        "id": "70-1",
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
        "id": "70-2",
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
        "id": "70-3",
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
