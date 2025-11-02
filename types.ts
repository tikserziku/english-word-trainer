export interface Word {
  word: string;
  cleanWord: string;
  pronunciation: string;
  translation: string;
  explanation: string;
}

export type LearningPhase = 'welcome' | 'mic-check' | 'introduction' | 'pronunciation' | 'spelling' | 'completed';