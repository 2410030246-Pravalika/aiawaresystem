import { 
  BookOpen, 
  TreePine, 
  Sparkles, 
  Heart, 
  Activity, 
  Baby, 
  Tv, 
  FileText, 
  Users, 
  GraduationCap, 
  Briefcase, 
  HeartHandshake 
} from "lucide-react";

export interface OptionType {
  id: string;
  name: string;
  description: string;
  icon: any;
}

export const TOPICS: OptionType[] = [
  { id: "Education", name: "Primary Education", description: "Promoting literacy, school admissions, and learning resources.", icon: GraduationCap },
  { id: "Environment", name: "Environmental Conservation", description: "Spreading awareness on waste reduction, climate action, and green living.", icon: TreePine },
  { id: "Women Empowerment", name: "Women Empowerment", description: "Promoting skill training, gender equality, financial independence.", icon: Sparkles },
  { id: "Child Welfare", name: "Child Welfare & Safety", description: "Campaigns against child labor, promoting food nutrition, vaccinations.", icon: Baby },
  { id: "Health Awareness", name: "Health & Hygiene", description: "Spreading knowledge on sanitation, mental wellness, clean water.", icon: Activity },
  { id: "Digital Literacy", name: "Digital Literacy", description: "Teaching technology basics, smart phone usage, cyber security.", icon: Tv },
  { id: "Tree Plantation", name: "Tree Plantation Drive", description: "Encouraging community plantation and restoring urban biodiversity.", icon: TreePine },
  { id: "Social Welfare", name: "Social Welfare & Aid", description: "Support for the homeless, elderly care, and disaster resilience.", icon: Heart }
];

export const AUDIENCES: OptionType[] = [
  { id: "Students", name: "Students & Youth", description: "Dynamic next-gen energetic community members.", icon: GraduationCap },
  { id: "Parents", name: "Parents & Guardians", description: "Focusing on child growth, modern safety, and education decisions.", icon: Users },
  { id: "Volunteers", name: "Volunteers & Activists", description: "Willing change-makers ready to join the grassroots action.", icon: HeartHandshake },
  { id: "Teachers", name: "Teachers & Mentors", description: "Guiding voices and academic community builders.", icon: BookOpen },
  { id: "Donors", name: "Donors & Supporters", description: "Compassionate patrons funding our societal impact.", icon: Briefcase },
  { id: "General Public", name: "General Public", description: "Broad community-wide reach for mindset shifts.", icon: Users }
];

export const TONES = [
  { id: "Professional", name: "Professional & Authoritative", description: "Data-backed, respectable, clear, and highly structured format." },
  { id: "Inspirational", name: "Inspirational & Caring", description: "Heartwarming storytelling highlighting hope and community potential." },
  { id: "Motivational", name: "Motivational Call-to-Arms", description: "Urgent, energetic, encouraging direct individual responsibility." },
  { id: "Informative", name: "Informative & Educational", description: "Fact-focused, direct, explaining the 'how' and 'why' simply." },
  { id: "Friendly", name: "Warm & Friendly", description: "Close, personal, approachable, emphasizing working together." }
];

export const NGO_FACTS = [
  { text: "Over 260 million children worldwide are currently out of school, making primary education campaigns a top NGO priority.", category: "Education" },
  { text: "A single mature tree can absorb over 48 lbs of carbon dioxide per year, making tree plantation vital for urban cooling.", category: "Environment" },
  { text: "When women earn an income, they reinvest 90% of it into their families and local communities.", category: "Women Empowerment" },
  { text: "Proper health and handwashing awareness can reduce childhood diarrheal diseases by up to 50%.", category: "Health Awareness" },
  { text: "NGOs like NayePankh Foundation work 365 days a year to bridge the resource gap for thousands of marginalized kids.", category: "Social Welfare" }
];
