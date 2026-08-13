const LISTENING_DATA = [
  // DAY05_02 (7문제)
  { part: 2, setTitle: "DAY05_02 #1", audioFile: "DAY05_02_1번.mp3", questions: [{ answer: 0 }] }, // 1 A
  { part: 2, setTitle: "DAY05_02 #2", audioFile: "DAY05_02_2번.mp3", questions: [{ answer: 0 }] }, // 2 A
  { part: 2, setTitle: "DAY05_02 #3", audioFile: "DAY05_02_3번.mp3", questions: [{ answer: 1 }] }, // 3 B
  { part: 2, setTitle: "DAY05_02 #4", audioFile: "DAY05_02_4번.mp3", questions: [{ answer: 1 }] }, // 4 B
  { part: 2, setTitle: "DAY05_02 #5", audioFile: "DAY05_02_5번.mp3", questions: [{ answer: 2 }] }, // 5 C
  { part: 2, setTitle: "DAY05_02 #6", audioFile: "DAY05_02_6번.mp3", questions: [{ answer: 1 }] }, // 6 B
  { part: 2, setTitle: "DAY05_02 #7", audioFile: "DAY05_02_7번.mp3", questions: [{ answer: 2 }] }, // 7 C

  // DAY05_04 (7문제)
  { part: 2, setTitle: "DAY05_04 #1", audioFile: "DAY05_04_1번.mp3", questions: [{ answer: 1 }] }, // 1 B
  { part: 2, setTitle: "DAY05_04 #2", audioFile: "DAY05_04_2번.mp3", questions: [{ answer: 2 }] }, // 2 C
  { part: 2, setTitle: "DAY05_04 #3", audioFile: "DAY05_04_3번.mp3", questions: [{ answer: 0 }] }, // 3 A
  { part: 2, setTitle: "DAY05_04 #4", audioFile: "DAY05_04_4번.mp3", questions: [{ answer: 0 }] }, // 4 A
  { part: 2, setTitle: "DAY05_04 #5", audioFile: "DAY05_04_5번.mp3", questions: [{ answer: 1 }] }, // 5 B
  { part: 2, setTitle: "DAY05_04 #6", audioFile: "DAY05_04_6번.mp3", questions: [{ answer: 2 }] }, // 6 C
  { part: 2, setTitle: "DAY05_04 #7", audioFile: "DAY05_04_7번.mp3", questions: [{ answer: 2 }] }, // 7 C

  // DAY06_02 (7문제)
  { part: 2, setTitle: "DAY06_02 #1", audioFile: "DAY06_02_1번.mp3", questions: [{ answer: 1 }] }, // 1 B
  { part: 2, setTitle: "DAY06_02 #2", audioFile: "DAY06_02_2번.mp3", questions: [{ answer: 0 }] }, // 2 A
  { part: 2, setTitle: "DAY06_02 #3", audioFile: "DAY06_02_3번.mp3", questions: [{ answer: 1 }] }, // 3 B
  { part: 2, setTitle: "DAY06_02 #4", audioFile: "DAY06_02_4번.mp3", questions: [{ answer: 0 }] }, // 4 A
  { part: 2, setTitle: "DAY06_02 #5", audioFile: "DAY06_02_5번.mp3", questions: [{ answer: 2 }] }, // 5 C
  { part: 2, setTitle: "DAY06_02 #6", audioFile: "DAY06_02_6번.mp3", questions: [{ answer: 0 }] }, // 6 A
  { part: 2, setTitle: "DAY06_02 #7", audioFile: "DAY06_02_7번.mp3", questions: [{ answer: 2 }] }, // 7 C

  // DAY06_04 (7문제)
  { part: 2, setTitle: "DAY06_04 #1", audioFile: "DAY06_04_1번.mp3", questions: [{ answer: 2 }] }, // 1 C
  { part: 2, setTitle: "DAY06_04 #2", audioFile: "DAY06_04_2번.mp3", questions: [{ answer: 0 }] }, // 2 A
  { part: 2, setTitle: "DAY06_04 #3", audioFile: "DAY06_04_3번.mp3", questions: [{ answer: 2 }] }, // 3 C
  { part: 2, setTitle: "DAY06_04 #4", audioFile: "DAY06_04_4번.mp3", questions: [{ answer: 1 }] }, // 4 B
  { part: 2, setTitle: "DAY06_04 #5", audioFile: "DAY06_04_5번.mp3", questions: [{ answer: 0 }] }, // 5 A
  { part: 2, setTitle: "DAY06_04 #6", audioFile: "DAY06_04_6번.mp3", questions: [{ answer: 0 }] }, // 6 A
  { part: 2, setTitle: "DAY06_04 #7", audioFile: "DAY06_04_7번.mp3", questions: [{ answer: 1 }] },  // 7 B

  // DAY10_02 (Part 3 - 2세트, 4문제)
  { 
    part: 3, 
    setTitle: "DAY10_02 #1-2", 
    audioFile: "DAY10_02_1-2번.mp3", 
    passage: "W: Hi, Mark. This is Donna. I'd like to arrange a party for our boss. He became the department head last week. Can you help me with the preparations?\n\nM: I'd be happy to. What should I do?\n\nW: Could you call the company that catered the party you organized last year? I need to know how much dinner for 50 people costs.",
    passageKo: "여: 안녕하세요, Mark. Donna예요. 저는 저희 상사를 위한 파티를 준비하고 싶어요. 그는 지난주에 부장이 되었어요. 준비를 도와주실 수 있나요?\n\n남: 기꺼이요. 제가 무엇을 하면 되나요?\n\n여: 작년에 당신이 준비했던 파티에 음식을 공급했던 회사에 전화해 주실 수 있나요? 저는 50인분의 저녁 식사 가격이 얼마나 드는지 알아야 해요.",
    questions: [
      { 
        answer: 0, 
        questionText: "What is the purpose of the call?",
        questionTextKo: "전화의 목적은 무엇인가?",
        options: ["To request assistance", "To ask for an opinion", "To offer advice", "To submit a complaint"],
        optionsKo: ["도움을 요청하기 위해", "의견을 묻기 위해", "조언을 제공하기 위해", "불만을 제기하기 위해"]
      },
      { 
        answer: 1, 
        questionText: "What does the woman ask the man to do?",
        questionTextKo: "여자는 남자에게 무엇을 해달라고 요청하는가?",
        options: ["Purchase some furniture", "Contact a caterer", "Mail some documents", "Change a dinner menu"],
        optionsKo: ["가구를 구매한다.", "출장 연회업체에 연락한다.", "문서를 보낸다.", "저녁 식사 메뉴를 변경한다."]
      }
    ]
  },
  { 
    part: 3, 
    setTitle: "DAY10_02 #3-4", 
    audioFile: "DAY10_02_3-4번.mp3", 
    passage: "W1: I just read the review of our movie, Cosmos. Have either of you seen it yet?\n\nW2: I read it this morning. Overall, it is really positive. Right, Steve?\n\nM: Yeah. I'm happy with it. Especially when you consider that Bill Waters wrote it. He is a famous film critic, and thousands of people read his articles.\n\nW1: Right. I'm sure it will result in higher ticket sales at theaters.",
    passageKo: "여1: 방금 우리 영화 Cosmos의 평론을 읽었어요. 두 분 중 그것을 보신 분이 계신가요?\n\n여2: 저는 그것을 오늘 아침에 읽었어요. 전반적으로, 매우 긍정적이더군요. 그렇죠, Steve?\n\n남: 네. 저는 무척 만족스러워요. 특히 Bill Waters가 썼다는 것을 고려했을 때요. 그는 유명한 영화 평론가이고, 많은 사람들이 그의 기사를 읽으니까요.\n\n여1: 맞아요. 저는 그 평론이 극장에서의 더 높은 티켓 판매량을 가져올 거라고 확신해요.",
    questions: [
      { 
        answer: 1, 
        questionText: "What is the conversation mainly about?",
        questionTextKo: "대화의 주제는 주로 무엇에 대한 것인가?",
        options: ["A ticket discount", "A film review", "A theater opening", "A movie release"],
        optionsKo: ["티켓 할인", "영화 평론", "극장 개장", "영화 개봉"]
      },
      { 
        answer: 2, 
        questionText: "What does the man mean when he says, \"Especially when you consider that Bill Waters wrote it\"?",
        questionTextKo: "남자가 \"특히 Bill Waters가 썼다는 것을 고려했을 때요\"라고 말할 때 의도하는 것은 무엇인가?",
        options: ["He is critical of a work.", "He will revise a script.", "He respects a writer.", "He will request a copy."],
        optionsKo: ["그는 작품에 대해 비판적이다.", "그는 대본을 수정할 것이다.", "그는 기자를 존경한다.", "그는 사본을 요청할 것이다."]
      }
    ]
  },
  // DAY10_04 (Part 3 - 2세트, 4문제)
  { 
    part: 3, 
    setTitle: "DAY10_04 #1-2", 
    audioFile: "DAY10_04_1-2번.mp3", 
    passage: "M: Hello. I'm staying in Suite 107, and the air conditioner in here isn't working.\n\nW: Really? Have you tried turning the power off and then back on?\n\nM: I already did that, but it's still not working.\n\nW: All right. I'll tell a technician to go up and look at it immediately. If he can't get it working right away, we'll move you to another room on the same floor.",
    passageKo: "남: 안녕하세요. 저는 스위트룸 107호에 머물고 있는데요, 이곳의 에어컨이 작동하지 않고 있어요.\n\n여: 정말인가요? 전원을 껐다가 다시 켜보셨나요?\n\n남: 이미 그렇게 해봤지만, 아직도 작동하지 않고 있어요.\n\n여: 알겠습니다. 제가 기술자에게 지금 올라가서 그것을 살펴보라고 하겠습니다. 만약 그가 그것을 바로 작동하게 하지 못하면, 같은 층의 다른 객실로 손님을 옮겨드리겠습니다.",
    questions: [
      { 
        answer: 3, 
        questionText: "Where most likely are the speakers?",
        questionTextKo: "화자들은 어디에 있는 것 같은가?",
        options: ["At a travel agency", "At a retail store", "At a gym", "At a hotel"],
        optionsKo: ["여행사에", "소매점에", "체육관에", "호텔에"]
      },
      { 
        answer: 0, 
        questionText: "According to the woman, what can be made available?",
        questionTextKo: "여자에 따르면, 무엇이 이용 가능해질 수 있는가?",
        options: ["A different room", "A free membership", "A discounted price", "An instruction manual"],
        optionsKo: ["다른 객실", "무료 회원권", "할인된 가격", "사용설명서"]
      }
    ]
  },
  { 
    part: 3, 
    setTitle: "DAY10_04 #3-4", 
    audioFile: "DAY10_04_3-4번.mp3", 
    passage: "M: Kenwood Financial. How may I help you?\n\nW: Hello. I'm calling because I... uh... I lost my credit card yesterday. I need to cancel it and get it replaced.\n\nM: Can you provide your name and address?\n\nW: My name is Martina Rhodes and I live at 5001 Selah Way, Danville, Vermont.\n\nM: OK, Ms. Rhodes. Your request will take three days to process. The replacement will be mailed out to you then.",
    passageKo: "남: Kenwood Financial사입니다. 어떻게 도와드릴까요?\n\n여: 안녕하세요. 저는... 어... 어제 신용카드를 잃어버려서요. 그것을 취소하고 교체해야 해요.\n\n남: 성함과 주소를 알려주시겠습니까?\n\n여: 제 이름은 Martina Rhodes이고 저는 5001번지 Selah Way, Danville, Vermont에 살아요.\n\n남: 알겠습니다, Ms. Rhodes. 고객님의 요청이 처리되는 데 3일이 걸릴 것입니다. 그 후에 교체될 카드가 우편으로 발송될 것입니다.",
    questions: [
      { 
        answer: 2, 
        questionText: "Where does the man most likely work?",
        questionTextKo: "남자는 어디에서 일하는 것 같은가?",
        options: ["At a post office", "At an online store", "At a credit card company", "At an investment firm"],
        optionsKo: ["우체국에서", "온라인 매장에서", "신용카드 회사에서", "투자 회사에서"]
      },
      { 
        answer: 1, 
        questionText: "What is mentioned about the replacement?",
        questionTextKo: "교체품에 대해 무엇이 언급되는가?",
        options: ["It will contain more information.", "It will be sent in the mail.", "It will involve an additional fee.", "It will include improved features."],
        optionsKo: ["더 많은 정보를 포함할 것이다.", "우편물로 보내질 것이다.", "추가 요금을 필요로 할 것이다.", "개선된 기능들을 포함할 것이다."]
      }
    ]
  },
  // DAY16_02 (Part 4 - 2세트, 4문제)
  { 
    part: 4, 
    setTitle: "DAY16_02 #1-2", 
    audioFile: "DAY16_02_1-2번.mp3", 
    passage: "Attention, everyone. The company's overtime policy is going to be changed next month. Currently, staff members are paid extra for working more than 50 hours in one week. However, the number of hours needed for overtime pay will be lowered to 45 hours per week. If you have any questions about this change, please send an e-mail to Minjoo in the human resources department. OK, you may return to work.",
    passageKo: "모두 주목해 주시기 바랍니다. 회사의 초과 근무 정책이 다음 달에 변경될 예정입니다. 현재, 직원들은 한 주에 50시간 이상 근무에 대해 추가 수당을 받습니다. 하지만, 초과 근무 수당을 위해 필요한 시간은 주당 45시간으로 낮춰질 것입니다. 만약 이 변경 사항에 대해 질문이 있다면, 인사부의 Minjoo에게 이메일을 보내세요. 좋습니다, 업무를 하러 돌아가셔도 됩니다.",
    questions: [
      { 
        answer: 0, 
        questionText: "What is the speaker mainly discussing?",
        questionTextKo: "화자는 주로 무엇에 대해 이야기하고 있는가?",
        options: ["An overtime policy", "A payment delay", "A schedule change", "An employee orientation"],
        optionsKo: ["초과 근무 정책", "납부 지연", "일정 변경", "직원 오리엔테이션"]
      },
      { 
        answer: 2, 
        questionText: "Why should listeners e-mail Minjoo?",
        questionTextKo: "청자들은 왜 Minjoo에게 이메일을 보내야 하는가?",
        options: ["To request another shift", "To confirm their attendance", "To make further inquiries", "To share project details"],
        optionsKo: ["다른 근무 시간을 요청하기 위해", "그들의 참석을 확정하기 위해", "추가 문의를 하기 위해", "프로젝트 세부 사항을 공유하기 위해"]
      }
    ]
  },
  { 
    part: 4, 
    setTitle: "DAY16_02 #3-4", 
    audioFile: "DAY16_02_3-4번.mp3", 
    passage: "Alison, this is Henry. I'm calling to ask for a favor. Um... can you give a presentation to the board of directors this afternoon on our project's status? Unfortunately, I'm away at a sales conference today. It doesn't end until tomorrow, so I will not be able to make it to the meeting myself. Please call me back as soon as possible to let me know if you're available. Thanks!",
    passageKo: "Alison, Henry예요. 부탁할 것이 있어서 전화했어요. 음... 오늘 오후에 저희 프로젝트 상황에 대해 이사회에 보고를 해주실 수 있나요? 유감스럽게도 저는 오늘 영업 컨퍼런스로 부재중이에요. 컨퍼런스는 내일이 되어서야 끝나서, 저는 회의 시간에 맞춰 갈 수 없을 거예요. 가능한 한 빨리 제게 다시 전화해서 시간이 있는지 알려주세요. 감사합니다!",
    questions: [
      { 
        answer: 1, 
        questionText: "What is the purpose of the message?",
        questionTextKo: "메시지의 목적은 무엇인가?",
        options: ["To verify a meeting schedule", "To request a coworker’s assistance", "To change a presentation topic", "To check a project’s status"],
        optionsKo: ["회의 일정을 확인하기 위해", "동료의 도움을 요청하기 위해", "발표 주제를 변경하기 위해", "프로젝트의 진행 상황을 확인하기 위해"]
      },
      { 
        answer: 3, 
        questionText: "What does the speaker say about the sales conference?",
        questionTextKo: "화자는 영업 컨퍼런스에 대해 무엇을 말하는가?",
        options: ["It was organized by the board.", "It was very successful.", "It will be held in another town.", "It finishes tomorrow."],
        optionsKo: ["이사회에 의해 준비되었다.", "매우 성공적이었다.", "다른 도시에서 열릴 것이다.", "내일 끝난다."]
      }
    ]
  },
  // DAY16_04 (Part 4 - 2세트, 4문제)
  { 
    part: 4, 
    setTitle: "DAY16_04 #1-2", 
    audioFile: "DAY16_04_1-2번.mp3", 
    passage: "Attention all London Books customers! We're currently having a huge sale on science fiction novels. All books in this genre are discounted by 25 percent. This is the perfect opportunity to add to your collection. We're also running a promotion on recipe books this weekend. If you buy two cookbooks, one will be half price. Be sure to take advantage of this great offer while it's available!",
    passageKo: "London Books의 고객 여러분 모두 주목해 주시기 바랍니다! 저희는 현재 공상 과학 소설에 대한 대대적인 할인 판매를 하고 있습니다. 이 장르의 모든 책들은 25퍼센트 할인됩니다. 이는 여러분의 소장품을 늘릴 완벽한 기회입니다. 저희는 또한 이번 주말에 요리책들에 대한 판촉 행사를 진행할 것입니다. 요리책 두 권을 구매하시면, 한 권은 반값이 될 것입니다. 이용할 수 있을 때 이 엄청난 할인을 꼭 활용하세요!",
    questions: [
      { 
        answer: 0, 
        questionText: "Who is the announcement intended for?",
        questionTextKo: "공지는 누구를 대상으로 하는가?",
        options: ["Bookstore customers", "Publishing firm staff", "Science fiction authors", "Conference attendees"],
        optionsKo: ["서점 고객들", "출판사 직원들", "공상 과학 소설가들", "컨퍼런스 참석자들"]
      },
      { 
        answer: 3, 
        questionText: "What will take place this weekend?",
        questionTextKo: "이번 주말에 무슨 일이 일어날 것인가?",
        options: ["A store renovation", "A book signing event", "A writing workshop", "A promotional offer"],
        optionsKo: ["매장 수리", "책 사인회", "작문 워크숍", "판촉 할인"]
      }
    ]
  },
  { 
    part: 4, 
    setTitle: "DAY16_04 #3-4", 
    audioFile: "DAY16_04_3-4번.mp3", 
    passage: "Thank you for visiting Bridgeport Academy. Today, I'll discuss some of the reasons to enroll your children here. First of all, our high school is well known for its academic excellence. Many of our graduates are accepted into top universities. In addition, we offer various sports and arts programs. We are particularly proud of our basketball team, which won the state championship in the tournament last week. Now, let me show you around our facilities.",
    passageKo: "Bridgeport 학교를 방문해 주셔서 감사합니다. 오늘, 저는 여러분의 자녀들을 이곳에 입학시키셔야 하는 몇 가지 이유를 말씀드리겠습니다. 먼저, 저희 고등학교는 학업상 우수함으로 잘 알려져 있습니다. 저희의 졸업생 중 다수가 상위 대학들에 입학합니다. 게다가, 저희는 다양한 운동 및 미술 프로그램을 제공합니다. 저희는 특히 농구팀을 자랑으로 생각하는데, 그 팀은 지난주 토너먼트에서 주 우승을 했습니다. 지금부터, 저희 시설을 둘러보시도록 여러분을 안내해 드리겠습니다.",
    questions: [
      { 
        answer: 0, 
        questionText: "Where most likely are the listeners?",
        questionTextKo: "청자들은 어디에 있는 것 같은가?",
        options: ["At a high school", "At a sports complex", "At an art museum", "At a daycare center"],
        optionsKo: ["고등학교에", "종합 운동장에", "미술관에", "보육시설에"]
      },
      { 
        answer: 3, 
        questionText: "Why does the speaker say, \"Many of our graduates are accepted into top universities\"?",
        questionTextKo: "화자는 왜 \"저희의 졸업생 중 다수가 상위 대학들에 입학합니다\"라고 말하는가?",
        options: ["To justify a program’s length", "To encourage greater diligence", "To explain an option", "To highlight an institution’s reputation"],
        optionsKo: ["프로그램의 기간을 정당화하기 위해", "더 많은 노력을 장려하기 위해", "선택 사항에 대해 설명하기 위해", "기관의 명성을 강조하기 위해"]
      }
    ]
  }
];

// 향후 Part 3, 4 지원을 위해 LISTENING_DATA 는 구조를 유지합니다.
// Part 3, 4의 경우 questions 배열에 여러 문제가 들어갈 수 있습니다.
