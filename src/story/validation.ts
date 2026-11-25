import type { EncounterNode, PassageNode, Story, StoryEffect } from './types';
import { getVisibleEncounterExitKeys } from '../builder/EncounterNodeCard';

export interface ValidationMessage {
  id: string;
  nodeId?: string;
  itemId?: string;
  severity: 'error' | 'warning';
  message: string;
}

function checkMissingItemRefs(
  effects: readonly StoryEffect[] | undefined,
  story: Story,
  nodeId: string,
  contextLabel: string,
  out: ValidationMessage[],
  keyPrefix: string,
): void {
  (effects ?? []).forEach((eff, idx) => {
    if ('addItem' in eff && eff.addItem && !story.items[eff.addItem]) {
      out.push({
        id: `${nodeId}:${keyPrefix}:missing-add-${idx}-${eff.addItem}`,
        nodeId,
        severity: 'error',
        message: `${contextLabel} references missing item "${eff.addItem}".`,
      });
    }
    if ('removeItem' in eff && eff.removeItem && !story.items[eff.removeItem]) {
      out.push({
        id: `${nodeId}:${keyPrefix}:missing-rem-${idx}-${eff.removeItem}`,
        nodeId,
        severity: 'error',
        message: `${contextLabel} references missing item "${eff.removeItem}".`,
      });
    }
  });
}

function validatePassageNode(node: PassageNode, story: Story): ValidationMessage[] {
  const messages: ValidationMessage[] = [];
  const label = node.title.trim() || node.id;

  if (!node.image || node.image.trim() === '') {
    messages.push({
      id: `${node.id}:missing-passage-image`,
      nodeId: node.id,
      severity: 'warning',
      message: `Passage "${label}" has no image.`,
    });
  }

  if (!node.isEnding && node.choices.length === 0) {
    messages.push({
      id: `${node.id}:dead-end`,
      nodeId: node.id,
      severity: 'warning',
      message: `Passage "${label}" is not an ending and has no choices.`,
    });
  }

  checkMissingItemRefs(node.effects, story, node.id, label, messages, 'passage');

  node.choices.forEach((choice, idx) => {
    if (choice.condition && 'item' in choice.condition && !story.items[choice.condition.item]) {
      messages.push({
        id: `${node.id}:choice-${idx}-missing-cond-item-${choice.condition.item}`,
        nodeId: node.id,
        severity: 'error',
        message: `${label} choice "${choice.label}" references missing item "${choice.condition.item}".`,
      });
    }
    checkMissingItemRefs(
      choice.effects,
      story,
      node.id,
      `${label} choice "${choice.label}"`,
      messages,
      `choice-${idx}`,
    );
  });

  return messages;
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
    const exitCfg = encounter.exits[exitKey];
    if (exitCfg) {
      checkMissingItemRefs(
        exitCfg.effects,
        story,
        node.id,
        `${label} exit "${exitCfg.label || exitKey}"`,
        messages,
        `exit-${exitKey}`,
      );
    }
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

  (encounter.modifiers ?? []).forEach((mod, idx) => {
    if ('item' in mod.if && !story.items[mod.if.item]) {
      messages.push({
        id: `${node.id}:mod-${idx}-missing-item-${mod.if.item}`,
        nodeId: node.id,
        severity: 'error',
        message: `${label}: Modifier ${idx + 1} references missing item "${mod.if.item}".`,
      });
    }
  });

  if (
    encounter.ruleBreak?.type === 'unblockableHeavyWithoutItem' &&
    !story.items[encounter.ruleBreak.item]
  ) {
    messages.push({
      id: `${node.id}:rulebreak-missing-item-${encounter.ruleBreak.item}`,
      nodeId: node.id,
      severity: 'error',
      message: `${label}: Rule-break references missing item "${encounter.ruleBreak.item}".`,
    });
  }

  (encounter.moments ?? []).forEach((moment, idx) => {
    if (moment.choices.length < 2) {
      messages.push({
        id: `${node.id}:moment-${idx}-choices`,
        nodeId: node.id,
        severity: 'error',
        message: `${label}: Moment ${idx + 1} must have at least two choices.`,
      });
    }
    moment.choices.forEach((choice, cIdx) => {
      if (choice.condition && 'item' in choice.condition && !story.items[choice.condition.item]) {
        messages.push({
          id: `${node.id}:moment-${idx}-choice-${cIdx}-missing-item-${choice.condition.item}`,
          nodeId: node.id,
          severity: 'error',
          message: `${label}: Moment ${idx + 1} choice "${choice.label}" references missing item "${choice.condition.item}".`,
        });
      }
      if (choice.then === 'exit') {
        const hasExit =
          Boolean(choice.exit) &&
          Object.prototype.hasOwnProperty.call(encounter.exits, choice.exit!) &&
          (choice.exit !== 'retreat' || encounter.allowRetreat);
        if (!hasExit) {
          messages.push({
            id: `${node.id}:moment-${idx}-choice-${cIdx}-missing-exit`,
            nodeId: node.id,
            severity: 'error',
            message: `${label}: Moment ${idx + 1} choice "${choice.label}" references missing exit "${choice.exit ?? ''}".`,
          });
        }
      }
    });
  });

  return messages;
}

function collectReachableNodeIds(story: Story): Set<string> {
  const visited = new Set<string>();
  const queue: string[] = [];
  if (story.nodes[story.startNodeId]) {
    visited.add(story.startNodeId);
    queue.push(story.startNodeId);
  }

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const node = story.nodes[currentId];
    if (!node) continue;

    const neighbors: string[] = [];
    if (node.kind === 'passage') {
      for (const c of node.choices) {
        if (c.targetNodeId) neighbors.push(c.targetNodeId);
      }
    } else {
      for (const exitKey of getVisibleEncounterExitKeys(node)) {
        const target = node.exitTargets[exitKey];
        if (target) neighbors.push(target);
      }
    }

    for (const nextId of neighbors) {
      if (story.nodes[nextId] && !visited.has(nextId)) {
        visited.add(nextId);
        queue.push(nextId);
      }
    }
  }

  return visited;
}

function storyHasRestEffect(story: Story): boolean {
  for (const node of Object.values(story.nodes)) {
    if (node.kind === 'passage') {
      if (node.effects?.some((e) => 'rest' in e && e.rest)) return true;
      for (const choice of node.choices) {
        if (choice.effects?.some((e) => 'rest' in e && e.rest)) return true;
      }
    } else {
      for (const exitCfg of Object.values(node.encounter.exits)) {
        if (exitCfg.effects.some((e) => 'rest' in e && e.rest)) return true;
      }
    }
  }
  return false;
}

export function validateStory(story: Story): ValidationMessage[] {
  const messages: ValidationMessage[] = [];
  let encounterCount = 0;

  for (const node of Object.values(story.nodes)) {
    if (node.kind === 'encounter') {
      encounterCount += 1;
      messages.push(...validateEncounterNode(node, story));
    } else {
      messages.push(...validatePassageNode(node, story));
    }
  }

  for (const item of Object.values(story.items)) {
    if (!item.image || item.image.trim() === '') {
      messages.push({
        id: `item:${item.id}:missing-image`,
        itemId: item.id,
        severity: 'warning',
        message: `Item "${item.name || item.id}" has no image.`,
      });
    }
  }

  const reachable = collectReachableNodeIds(story);
  for (const node of Object.values(story.nodes)) {
    if (!reachable.has(node.id)) {
      const label =
        node.kind === 'encounter'
          ? node.encounter.enemy.name.trim() || node.title || node.id
          : node.title.trim() || node.id;
      messages.push({
        id: `${node.id}:unreachable`,
        nodeId: node.id,
        severity: 'warning',
        message: `"${label}" cannot be reached from the start passage.`,
      });
    }
  }

  if (encounterCount >= 2 && !storyHasRestEffect(story)) {
    messages.push({
      id: `${story.id}:missing-rest-effect`,
      nodeId: story.startNodeId,
      severity: 'warning',
      message:
        'Story has two or more encounters and no rest effect; readers may starve of health.',
    });
  }

  return messages;
}
