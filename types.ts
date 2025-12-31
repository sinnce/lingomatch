export interface VocabularyPair {
  target: string;
  native: string;
}

export interface CardItem {
  id: string;
  text: string;
  pairId: string; // The ID connecting the native and target words
  type: 'native' | 'target';
  state: 'idle' | 'selected' | 'matched' | 'wrong';
}

export type GameStatus = 'setup' | 'loading' | 'playing' | 'won' | 'lost';

export interface GameConfig {
  language: string;
  difficulty: string;
  topic: string;
}

export const LANGUAGES = [
  'Spanish', 'French', 'German', 'Italian', 'Japanese', 'Korean', 'Portuguese', 'Chinese'
];

export const TOPICS = [
  'Basics', 'Food', 'Travel', 'Animals', 'Emotions', 'Business', 'Technology'
];

export const DIFFICULTIES = [
  'Beginner', 'Intermediate', 'Advanced'
];