import type { EncounterNode, Story } from './types';

export interface ValidationMessage {
  id: string;
  nodeId: string;
  severity: 'error' | 'warning';
  message: string;
}

function validateEncounterNode(node: EncounterNode, story: Story): ValidationMessage[] {
  const messages: ValidationMessage[] = [];
  const { encounter } = node;
  const label = encounter.enemy.name.trim() || node.title || node.id;

  if (encounter.enemy.name.trim() === '') {
    messages.push({
      id: `${node.id}:missing-name`,
      nodeId: node.id,
      severity: 'error',
      message: `${label}: Enemy name is required.`,
    });
  }

  if (encounter.enemy.image.trim() === '') {
    messages.push({
      id: `${node.id}:missing-image`,
      nodeId: node.id,
      severity: 'error',
      message: `${label}: Enemy image is required.`,
    });
  }

  if (encounter.pattern.length === 0) {
    messages.push({
      id: `${node.id}:empty-pattern`,
      nodeId: node.id,
      severity: 'error',
      message: `${label}: Pattern must contain at least one move.`,
    });
  }

  const victoryTarget = node.exitTargets.victory;
  if (!victoryTarget || !story.nodes[victoryTarget]) {
    messages.push({
      id: `${node.id}:unwired-victory`,
      nodeId: node.id,
      severity: 'error',
      message: `${label}: Victory exit is not wired.`,
    });
  }

  const defeatTarget = node.exitTargets.defeat;
  if (!defeatTarget || !story.nodes[defeatTarget]) {
    messages.push({
      id: `${node.id}:unwired-defeat`,
      nodeId: node.id,
      severity: 'warning',
      message: `${label}: Defeat exit is not wired.`,
    });
  }

  if (encounter.allowRetreat) {
    const retreatTarget = node.exitTargets.retreat;
    if (!retreatTarget || !story.nodes[retreatTarget]) {
      messages.push({
        id: `${node.id}:unwired-retreat`,
        nodeId: node.id,
        severity: 'warning',
        message: `${label}: Retreat exit is not wired.`,
      });
    }
  }

  for (const exitKey of Object.keys(encounter.exits)) {
    if (exitKey === 'victory' || exitKey === 'defeat' || exitKey === 'retreat') {
      continue;
    }
    const target = node.exitTargets[exitKey];
    if (!target || !story.nodes[target]) {
      const exitLabel = encounter.exits[exitKey]?.label || exitKey;
      messages.push({
        id: `${node.id}:unwired-${exitKey}`,
        nodeId: node.id,
        severity: 'warning',
        message: `${label}: Custom exit "${exitLabel}" is not wired.`,
      });
    }
  }

  return messages;
}

export function validateStory(story: Story): ValidationMessage[] {
  const messages: ValidationMessage[] = [];

  for (const node of Object.values(story.nodes)) {
    if (node.kind === 'encounter') {
      messages.push(...validateEncounterNode(node, story));
    }
  }

  return messages;
}
