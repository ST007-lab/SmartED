import type { KnowledgeLevel } from '../types/learning';

export interface CuratedTopicPrompt {
  topic: string;
  discipline: string;
  suggestedLevel: KnowledgeLevel;
  summary: string;
}

export const CURATED_TOPIC_PROMPTS: CuratedTopicPrompt[] = [
  {
    topic: 'Quantum Computing',
    discipline: 'Physics & Computing',
    suggestedLevel: 'Beginner',
    summary: 'Qubits, superposition, interference, and real quantum gates.',
  },
  {
    topic: 'Photosynthesis',
    discipline: 'Biology',
    suggestedLevel: 'Beginner',
    summary: 'Light-dependent reactions, ATP shuttles, and the Calvin cycle.',
  },
  {
    topic: 'Macroeconomic Inflation & Central Banks',
    discipline: 'Economics',
    suggestedLevel: 'Intermediate',
    summary: 'Monetary policy levers, supply shocks, and interest rate transmission.',
  },
  {
    topic: 'Transformer Neural Networks',
    discipline: 'Computer Science',
    suggestedLevel: 'Intermediate',
    summary: 'Self-attention mechanisms, embeddings, and sequence modeling.',
  },
  {
    topic: 'TCP/IP & How the Internet Routes Packets',
    discipline: 'Systems Engineering',
    suggestedLevel: 'Beginner',
    summary: 'Packets, DNS resolution, handshakes, and congestion control.',
  },
  {
    topic: 'CRISPR-Cas9 Gene Editing',
    discipline: 'Biotechnology',
    suggestedLevel: 'Advanced',
    summary: 'Guide RNA targeting, double-strand breaks, and cellular repair pathways.',
  },
];

export const SUPPORTED_LANGUAGES = [
  'English',
  'Spanish',
  'French',
  'German',
  'Portuguese',
  'Hindi',
  'Mandarin Chinese',
  'Japanese',
  'Arabic',
];
