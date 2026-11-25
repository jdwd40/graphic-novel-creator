import type { Condition, Encounter, ExitEffect } from '../combat/types';

export type StoryEffect = ExitEffect;

export interface ItemDefinition {
  id: string;
  name: string;
  description: string;
  weaponDamage?: number;
  armourBuffer?: number;
}

export interface PassageChoice {
  id: string;
  label: string;
  targetNodeId: string | null;
  condition?: Condition;
  effects?: StoryEffect[];
}

export interface NodePosition {
  x: number;
  y: number;
}

export interface PassageNode {
  id: string;
  kind: 'passage';
  title: string;
  text: string;
  image?: string;
  position: NodePosition;
  effects?: StoryEffect[];
  choices: PassageChoice[];
  isEnding?: boolean;
}

export interface EncounterNode {
  id: string;
  kind: 'encounter';
  title: string;
  position: NodePosition;
  encounter: Encounter;
  exitTargets: Record<string, string | null>;
}

export type StoryNode = PassageNode | EncounterNode;

export interface Story {
  id: string;
  title: string;
  startNodeId: string;
  items: Record<string, ItemDefinition>;
  nodes: Record<string, StoryNode>;
}
