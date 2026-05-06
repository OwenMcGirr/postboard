export interface AuthorProfile {
  displayName: string;
  status: string;
  canonicalSummary: string;
  importedFromLocal: boolean;
  lastInterviewCompletedAt: number | null;
  updatedAt: number | null;
}

export interface InterviewSession {
  _id: string;
  status: string;
  currentQuestionId: string | null;
  questionCount: number;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

export interface InterviewMessage {
  _id: string;
  role: "assistant" | "user";
  questionId?: string;
  content: string;
  order: number;
  createdAt: number;
}

export interface MemoryFact {
  _id: string;
  category: string;
  content: string;
  priority: number;
  updatedAt: number;
}

export interface MemorySource {
  _id: string;
  kind: string;
  target: string;
  title: string;
  summary: string;
  sourceUrl: string;
  confidence: number;
  keywords: string[];
  createdAt: number;
}

export interface WritingExample {
  _id: string;
  text: string;
  label: string;
  sourceBrief?: string;
  createdAt: number;
}

export interface SettingsState {
  profile: AuthorProfile;
  interview: {
    session: InterviewSession;
    messages: InterviewMessage[];
  } | null;
  facts: MemoryFact[];
  sources: MemorySource[];
  examples: WritingExample[];
}

export interface InterviewQuestion {
  id: string;
  prompt: string;
}

export interface InterviewAnswerResult {
  nextQuestion: InterviewQuestion | null;
  readyToComplete: boolean;
}

export interface InterviewSummary {
  displayName: string;
  canonicalSummary: string;
  facts: Array<{
    category: string;
    content: string;
    priority: number;
  }>;
}

export interface ResearchFinding {
  title: string;
  summary: string;
  sourceUrl: string;
  confidence: number;
  keywords: string[];
}
