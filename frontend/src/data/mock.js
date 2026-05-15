// Mock data for gradnext landing pages

export const statistics = {
  community: "5,000+",
  offerRate: "60%",
  countries: "13+",
  mentors: "50+",
  casesCompleted: "5,000+",
  sessionsDelivered: "5,000+"
};

export const testimonials = [
  {
    id: 1,
    name: "Dinesh",
    role: "Management Consultant",
    company: "McKinsey & Company",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face",
    text: "I had a great experience working with gradnext to prepare for my case interviews. The support and guidance I received were instrumental in improving both my confidence and my performance. Kashish brought clarity and structure to complex problems and always made sure I understood not just the 'how' but also the 'why' behind every step."
  },
  {
    id: 2,
    name: "Anshul Saxena",
    role: "Associate",
    company: "BCG",
    image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face",
    text: "The recorded videos were a game changer for me, as it essentially rewired how I approached cases. I went from using my own method to using gradnext's approach. The mentor cases were helpful - they challenged me every case more and more pushing me to the edge, and giving solid feedback."
  },
  {
    id: 3,
    name: "Priya Sharma",
    role: "Consultant",
    company: "Bain & Company",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=face",
    text: "gradnext's structured approach to case preparation was exactly what I needed. The peer-to-peer practice sessions helped me gain confidence, and the 1:1 mentorship with MBB consultants provided invaluable insights that you can't find anywhere else."
  }
];

export const subscriptionPlans = [
  {
    id: "free",
    name: "Free Trial",
    price: 0,
    duration: "7 days",
    popular: false,
    features: [
      "Access to sample video lessons",
      "Limited case interview resources",
      "Community forum access",
      "1 peer practice session"
    ],
    cta: "Start Free Trial"
  },
  {
    id: "basic",
    name: "Basic Plan",
    price: 4999,
    duration: "3 months",
    popular: false,
    features: [
      "Full video course access",
      "All case interview resources",
      "Unlimited peer-to-peer practice",
      "Live workshop recordings",
      "Drill exercises",
      "Community support"
    ],
    cta: "Get Basic"
  },
  {
    id: "pro",
    name: "Pro Plan",
    price: 7999,
    duration: "6 months",
    popular: true,
    features: [
      "Everything in Basic",
      "Live workshop participation",
      "Priority peer matching",
      "Extended resource access",
      "Progress tracking dashboard",
      "Certificate of completion"
    ],
    cta: "Get Pro"
  }
];

export const coachingPlans = [
  {
    id: "last-mile",
    name: "Last Mile Prep",
    price: 16999,
    popular: false,
    features: [
      "5 sessions with MBB consultant",
      "1 strategy call",
      "Detailed performance dashboard",
      "Full subscription access",
      "Session recordings",
      "Personalized feedback reports"
    ],
    ideal: "Ideal for candidates with interview invites",
    cta: "Start Last Mile"
  },
  {
    id: "mid-mile",
    name: "Mid Mile Prep",
    price: 29999,
    popular: true,
    features: [
      "10 sessions with MBB consultants",
      "2 strategy calls",
      "Detailed performance dashboard",
      "Full subscription access",
      "CV & cover letter review",
      "Mock interview simulations",
      "Networking guidance"
    ],
    ideal: "Ideal for serious aspirants starting preparation",
    cta: "Start Mid Mile"
  },
  {
    id: "full-prep",
    name: "Full Prep",
    price: 44999,
    popular: false,
    features: [
      "15 sessions with MBB consultants",
      "3 strategy calls",
      "Dedicated coach assignment",
      "Detailed performance dashboard",
      "Full subscription access",
      "Complete application support",
      "Priority scheduling",
      "Unlimited email support"
    ],
    ideal: "Ideal for comprehensive end-to-end preparation",
    cta: "Start Full Prep"
  }
];

export const cohortPlans = [
  {
    id: "premium",
    name: "Premium Plan",
    price: 34999,
    popular: false,
    features: [
      "8 live group sessions (2 hours each)",
      "1 one-on-one coaching session",
      "15+ peer practice sessions",
      "All session recordings",
      "50+ casebooks",
      "MBB CV templates",
      "LinkedIn outreach templates",
      "Full subscription access",
      "Scholarships available"
    ],
    duration: "8 weeks",
    cta: "Join Premium"
  },
  {
    id: "elite",
    name: "Elite Plan",
    price: 49999,
    popular: true,
    features: [
      "8 live group sessions (2 hours each)",
      "3 one-on-one coaching sessions",
      "Full access to CaseBuddy AI",
      "15+ peer practice sessions",
      "All session recordings",
      "50+ casebooks",
      "MBB CV templates",
      "LinkedIn outreach templates",
      "Full subscription access",
      "Priority support",
      "Scholarships available"
    ],
    duration: "8 weeks",
    cta: "Join Elite"
  }
];

export const cohortCurriculum = [
  {
    week: "Ice-Breaker",
    title: "Building Connections",
    description: "Build connections with your peers through introductions and interactive activities. Set expectations for the program."
  },
  {
    week: "Module 1",
    title: "Building Consulting CV and Networking",
    description: "Learn to construct compelling MBB-style CVs and discover effective LinkedIn outreach strategies."
  },
  {
    week: "Module 2",
    title: "How to Approach Case Interviews",
    description: "Understand the full anatomy of a case interview: structuring, hypothesis-driven analysis, and communication."
  },
  {
    week: "Module 3",
    title: "Profitability Framework",
    description: "Deep dive into revenue-side frameworks including 4As, 4Cs, 4Ps, and cost-side analysis."
  },
  {
    week: "Module 4",
    title: "Market Entry Framework",
    description: "Explore market attractiveness assessment, competitive landscape, and strategic entry options."
  },
  {
    week: "Module 5",
    title: "Growth Framework",
    description: "Study growth strategies through the Ansoff Matrix and organic vs inorganic growth paths."
  },
  {
    week: "Module 6",
    title: "M&A Framework",
    description: "Cover fundamentals of Mergers & Acquisitions, target evaluation, and valuation techniques."
  },
  {
    week: "Module 7",
    title: "Guesstimates & Pricing",
    description: "Master top-down and bottom-up estimation approaches and various pricing strategies."
  },
  {
    week: "Module 8",
    title: "Unconventional Cases",
    description: "Develop strategies for abstract cases that don't fit predefined frameworks."
  }
];

export const subscriptionFeatures = {
  videoCourse: {
    title: "Video Course",
    subtitle: "Comprehensive Case Interview Mastery",
    description: "Master consulting case interviews with our structured video curriculum taught by MBB consultants.",
    stats: { videos: "50+", hours: "25+", frameworks: "15+" },
    features: [
      "Structured learning path from basics to advanced",
      "Real MBB interview case walkthroughs",
      "Framework deep-dives with practical examples",
      "Quantitative skills and mental math training",
      "Fit interview preparation modules",
      "Industry-specific case variations"
    ]
  },
  workshops: {
    title: "Live Workshops",
    subtitle: "Interactive Learning Sessions",
    description: "Join live interactive sessions with MBB consultants and practice real-time case solving.",
    stats: { monthly: "4+", duration: "2 hours", participants: "Limited" },
    features: [
      "Live case solving with expert feedback",
      "Q&A sessions with MBB mentors",
      "Industry trends and insights",
      "Networking with fellow aspirants",
      "Recording access for all sessions",
      "Topic-specific deep dives"
    ]
  },
  drills: {
    title: "Case Drills",
    subtitle: "Sharpen Your Skills",
    description: "Practice with curated drill exercises designed to build speed and accuracy in case solving.",
    stats: { drills: "100+", categories: "10+", levels: "3" },
    features: [
      "Mental math drills for speed",
      "Chart and data interpretation exercises",
      "Framework application practice",
      "Time-bound case exercises",
      "Progress tracking and analytics",
      "Difficulty progression system"
    ]
  },
  resources: {
    title: "Case Interview Resources",
    subtitle: "Your Complete Toolkit",
    description: "Access our comprehensive library of casebooks, frameworks, and preparation materials.",
    stats: { casebooks: "50+", templates: "20+", guides: "15+" },
    features: [
      "Top consulting firm casebooks",
      "Framework cheat sheets",
      "MBB CV and cover letter templates",
      "LinkedIn outreach templates",
      "Industry primers",
      "Fit interview question bank"
    ]
  },
  peerPractice: {
    title: "Peer-to-Peer Practice",
    subtitle: "Practice Makes Perfect",
    description: "Connect with fellow aspirants globally for structured case practice sessions.",
    stats: { members: "5000+", countries: "13+", sessions: "24/7" },
    features: [
      "Smart peer matching algorithm",
      "Structured practice formats",
      "Feedback exchange system",
      "Scheduling flexibility",
      "Practice case library",
      "Global community access"
    ]
  }
};

export const faqs = {
  general: [
    {
      question: "What is gradnext?",
      answer: "gradnext is a consulting interview preparation platform that provides structured learning resources, case practice, and coaching from McKinsey, BCG, and Bain (MBB) consultants. It's designed to help aspiring consultants prepare for and succeed in case interviews at top consulting firms."
    },
    {
      question: "Who are the mentors on gradnext?",
      answer: "Our mentors are current and former consultants from McKinsey, BCG, and Bain, collectively known as MBB firms. They bring firsthand experience with the consulting interview process and provide guidance tailored to what top firms actually look for in candidates."
    },
    {
      question: "What is the difference between Subscription and Coaching?",
      answer: "The Subscription gives you self-paced access to the full content library, drills, workshops, and the peer practice network. Coaching is a separate offering where you get personalized 1-on-1 sessions with MBB consultants, including feedback on your case performance and strategy calls to plan your preparation journey."
    },
    {
      question: "Is there a free trial available?",
      answer: "Yes! gradnext offers a free trial with no credit card required. You can start exploring the platform and its resources before committing to a paid plan."
    },
    {
      question: "Do you offer scholarships or financial assistance?",
      answer: "gradnext does offer scholarships for eligible candidates only on the coaching program for candidates with MBB shortlist. Please reach out to the team directly at support@gradnext.co or book a free discovery call to find out more about available options."
    },
    {
      question: "How is gradnext different from other consulting prep platforms?",
      answer: "gradnext combines structured content with real MBB mentor access, a global peer practice network, and personalized coaching, all in one place. Rather than just providing static resources, the platform emphasizes active practice and direct feedback from consultants who've been through the process themselves."
    },
    {
      question: "What is peer practice, and how does it work?",
      answer: "Peer practice lets you connect and practice case interviews with other aspiring consultants around the world. Depending on your plan, you get 2 sessions/month (Basic), 4 sessions/month (Pro), or unlimited sessions (Pro+). It's a great way to build real interview skills in a low-stakes environment."
    },
    {
      question: "I'm not sure which coaching plan is right for me, what should I do?",
      answer: "For coaching plans, you can book a free 15-minute discovery call with the gradnext team to get personalized guidance based on your timeline, target firms, and preparation needs. There's no obligation, and it's a great way to make an informed decision before subscribing."
    }
  ],
  subscription: [
    {
      question: "How long do I have access to the content after subscribing?",
      answer: "You have full access to all content included in your plan for as long as your subscription remains active. Since subscriptions are billed monthly or 6-monthly, your access continues uninterrupted as long as payments are up to date."
    },
    {
      question: "Can I upgrade my plan later?",
      answer: "Yes, you can upgrade from Basic to Pro or Pro+ at any point in your subscription journey. This is useful if you start with a lower tier and find you need more practice sessions, workshop access, or additional drills as your interview date approaches."
    },
    {
      question: "Do you offer refunds?",
      answer: "Please refer to gradnext's Cancellation & Refund policy for full details, available in the footer of the site. You can also reach out directly at support@gradnext.co for any billing-related queries."
    },
    {
      question: "How does the 7-day free trial work?",
      answer: "You can start a 7-day free trial with no credit card required. This gives you hands-on access to the platform so you can explore the content, drills, and features before committing to a paid plan. You can cancel at any time during the trial."
    },
    {
      question: "What topics do the video courses cover?",
      answer: "The 9-module curriculum covers a wide range, including an introduction to consulting, building your CV and cover letter, networking for referrals, and advance case interviews - totalling 35+ hours of structured content designed by MBB consultants."
    },
    {
      question: "How are the live workshops conducted?",
      answer: "Workshops are interactive sessions held online with current and former MBB consultants. They cover industry-specific primers (such as fintech, airlines, and healthcare) as well as broader consulting topics. Attendees can ask questions live and engage directly with the experts. Live workshops are currently coming soon."
    },
    {
      question: "What types of case drills are available?",
      answer: "The drill library includes 500+ questions spanning three main categories: case math (240+), structuring (240+), and charts & exhibits (300+). Each drill includes instant feedback and detailed explanations to help you understand not just the answer, but the reasoning behind it."
    },
    {
      question: "What resources are included in the library?",
      answer: "The resource library contains 100+ practice cases, 15+ frameworks, 10+ casebooks from top business schools, and 50+ cheat sheets. These cover a broad range of case types and are designed to complement the video courses and drills."
    },
    {
      question: "How do peer sessions work?",
      answer: "Peers can list their available time slots on the platform. Other peers can request to book any of these slots, and once the host approves the request, the session invite is automatically generated and both users will see the confirmed session reflected on their dashboards."
    }
  ],
  coaching: [
    {
      question: "How are coaching sessions conducted?",
      answer: "Sessions are conducted online, one-on-one with your dedicated MBB coach. They include a mix of mock interviews, fit interview practice, and strategy calls, all conducted in a realistic format that mirrors actual consulting interviews."
    },
    {
      question: "Can I choose my own coach?",
      answer: "Yes, you will be able to view a list of available coaches along with their profiles and ratings, and you can choose the coach you'd like to book a session with."
    },
    {
      question: "What if I need more sessions than my plan includes?",
      answer: "If you exhaust your sessions before feeling interview-ready, you can top up with more sessions. Unsure about how many sessions will be required for your prep? Book a discovery call or apply for the Pinnacle program which is our application based selection program having a mix of base plus success based fees."
    },
    {
      question: "What is a strategy call, and how is it different from a coaching session?",
      answer: "A strategy call is a planning-focused conversation where your coach helps you map out your entire preparation journey, prioritizing what to work on, when, and how. Coaching sessions, by contrast, are practice-focused, covering mock interviews, case walkthroughs, and targeted skill-building."
    },
    {
      question: "Which coaching plan is right for me?",
      answer: "The right plan depends on where you are in your prep journey. Last Mile suits those already in the final stages of interviews. Mid Mile is for those in early stages looking to build skills. Full Prep is for those starting from scratch, and Pinnacle (custom pricing) is for candidates wanting comprehensive, unlimited, dedicated support throughout."
    },
    {
      question: "Does coaching include a resume review?",
      answer: "The 1:1 sessions can be used for either mock case interviews or CV reviews, and the focus of each session will be decided mutually during the first strategy call."
    },
    {
      question: "How does the onboarding process work?",
      answer: "Once you enroll, you complete a profile sharing your background, target firms, and interview timeline. You can then book a strategy call to design a customized preparation plan tailored specifically to your gaps and goals."
    },
    {
      question: "Is there a scholarship available for coaching?",
      answer: "Yes. If you've already received an interview invite from a top consulting firm, you can apply for a scholarship to access coaching support. Look for the \"Apply for scholarship\" link on the coaching page or reach out to support@gradnext.co for details."
    }
  ],
  cohort: [
    {
      question: "When does the next cohort start?",
      answer: "We run cohorts quarterly. Check our website for the next batch start date and application deadline."
    },
    {
      question: "What if I miss a live session?",
      answer: "All sessions are recorded and available in your dashboard. You can catch up at your own pace."
    },
    {
      question: "How many people are in each cohort?",
      answer: "We limit cohort size to 30-40 participants to ensure quality interaction and peer practice opportunities."
    }
  ]
};

export const companyLogos = [
  { name: "McKinsey & Company", logo: "McKinsey" },
  { name: "BCG", logo: "BCG" },
  { name: "Bain & Company", logo: "Bain" },
  { name: "Kearney", logo: "Kearney" },
  { name: "Arthur D. Little", logo: "ADL" }
];

export const universities = [
  "IIM Ahmedabad",
  "IIM Bangalore",
  "ISB Hyderabad",
  "XLRI Jamshedpur",
  "FMS Delhi",
  "IIM Calcutta",
  "SPJIMR Mumbai",
  "MDI Gurgaon"
];