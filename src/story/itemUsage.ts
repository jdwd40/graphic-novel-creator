import type { Story, StoryEffect } from './types';

export interface ItemUsageRef {
  nodeId: string;
  role: 'given' | 'removed' | 'required';
  label: string;
}

export function findItemUsages(story: Story, itemId: string): ItemUsageRef[] {
  if (!itemId) return [];
  const refs: ItemUsageRef[] = [];

  const checkEffects = (
    effects: readonly StoryEffect[] | undefined,
    nodeId: string,
    contextLabel: string,
  ) => {
    for (const eff of effects ?? []) {
      if ('addItem' in eff && eff.addItem === itemId) {
        refs.push({ nodeId, role: 'given', label: `Given in ${contextLabel}` });
      }
      if ('removeItem' in eff && eff.removeItem === itemId) {
        refs.push({ nodeId, role: 'removed', label: `Removed in ${contextLabel}` });
      }
    }
  };

  for (const node of Object.values(story.nodes)) {
    const nodeLabel = node.title || node.id;
    if (node.kind === 'passage') {
      checkEffects(node.effects, node.id, `Passage "${nodeLabel}"`);
      for (const choice of node.choices) {
        if (choice.condition && 'item' in choice.condition && choice.condition.item === itemId) {
          refs.push({
            nodeId: node.id,
            role: 'required',
            label: `Required by choice "${choice.label}" in "${nodeLabel}"`,
          });
        }
        checkEffects(choice.effects, node.id, `choice "${choice.label}" in "${nodeLabel}"`);
      }
    } else {
      for (const [exitKey, exitCfg] of Object.entries(node.encounter.exits)) {
        checkEffects(exitCfg.effects, node.id, `Encounter "${nodeLabel}" (${exitKey})`);
      }
      for (const mod of node.encounter.modifiers ?? []) {
        if ('item' in mod.if && mod.if.item === itemId) {
          refs.push({
            nodeId: node.id,
            role: 'required',
            label: `Required by modifier in "${nodeLabel}"`,
          });
        }
      }
      if (
        node.encounter.ruleBreak?.type === 'unblockableHeavyWithoutItem' &&
        node.encounter.ruleBreak.item === itemId
      ) {
        refs.push({
          nodeId: node.id,
          role: 'required',
          label: `Required by boss rule-break in "${nodeLabel}"`,
        });
      }
      for (const mom of node.encounter.moments ?? []) {
        for (const mc of mom.choices) {
          if (mc.condition && 'item' in mc.condition && mc.condition.item === itemId) {
            refs.push({
              nodeId: node.id,
              role: 'required',
              label: `Required by moment "${mc.label}" in "${nodeLabel}"`,
            });
          }
        }
      }
    }
  }

  return refs;
}
