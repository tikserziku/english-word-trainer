export interface Word {
  word: string;
  cleanWord: string;
  pronunciation: string;
  translation: string;
  explanation: string;
}

export type LearningPhase = 'welcome' | 'mic-check' | 'introduction' | 'pronunciation' | 'spelling' | 'completed';

// Test system types
export type AppMode = 'menu' | 'learning' | 'test-easy' | 'test-hard' | 'test-results';

export interface TestQuestion {
  word: Word;
  options?: string[]; // For multiple choice (easy test)
  userAnswer?: string;
  pronunciationCorrect?: boolean;
  spellingCorrect?: boolean;
  answered: boolean;
}

export interface TestResult {
  mode: 'easy' | 'hard';
  questions: TestQuestion[];
  score: number;
  maxScore: number;
  percentage: number;
  completedAt: Date;
}

export interface TestProgress {
  currentQuestionIndex: number;
  questions: TestQuestion[];
  startedAt: Date;
}