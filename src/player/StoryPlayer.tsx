import { useEffect, useState } from 'react';
import { selectResultCaption } from '../combat/captions';
import { getArmourBuffer, getEffectiveMaxHealth, getWeaponDamage } from '../combat/playerState';
import {
  advanceBeat,
  finishFight,
  retreatFight,
  startFight,
} from '../combat/resolver';
import type { Encounter, ExitKey, FightState, Tactic } from '../combat/types';
import {
  applyStoryEffects,
  createPlaythrough,
  loadPlaythrough,
  savePlaythrough,
  type PlaythroughState,
} from '../story/playthrough';
import type { EncounterNode, PassageNode, Story } from '../story/types';
import { ChoiceList } from './ChoiceList';
import { CombatScreen, type CombatFeedbackState } from './CombatScreen';
import { deriveHitFeedback } from './hitFeedback';

export interface StoryPlayerProps {
  story: Story;
  initialPlaythrough?: PlaythroughState;
}

export function applyFightOutcomeToPlaythrough(
  pt: PlaythroughState,
  story: Story,
  encounterNode: EncounterNode,
  fightState: FightState,
  overrideExitKey?: ExitKey,
): { nextPlaythrough: PlaythroughState; targetNodeId: string | null } {
  const result = finishFight(fightState, encounterNode.encounter, overrideExitKey);
  const nextFlags = { ...pt.flags };

  if (result.clean) {
    nextFlags[`encounter_${encounterNode.id}_clean`] = true;
  }
  if (result.bloodied) {
    nextFlags[`encounter_${encounterNode.id}_bloodied`] = true;
  }

  let updated: PlaythroughState = {
    ...pt,
    flags: nextFlags,
    combat: {
      ...pt.combat,
      health: result.healthAfter,
    },
    activeFight: null,
  };

  if (result.exitEffects.length > 0) {
    updated = applyStoryEffects(updated, story, result.exitEffects);
  }

  const targetNodeId = encounterNode.exitTargets[result.exitKey] ?? null;
  if (targetNodeId && story.nodes[targetNodeId]) {
    updated = {
      ...updated,
      currentNodeId: targetNodeId,
    };
  }

  return {
    nextPlaythrough: updated,
    targetNodeId: targetNodeId && story.nodes[targetNodeId] ? targetNodeId : null,
  };
}

export function StoryPlayer({ story, initialPlaythrough }: StoryPlayerProps) {
  const [playthrough, setPlaythrough] = useState<PlaythroughState>(() => {
    if (initialPlaythrough) return initialPlaythrough;
    return loadPlaythrough(story.id) ?? createPlaythrough(story);
  });
  const [unwiredNotice, setUnwiredNotice] = useState<string | null>(null);
  const [resultCaption, setResultCaption] = useState<string>('');
  const [showInventory, setShowInventory] = useState(false);
  const [feedback, setFeedback] = useState<CombatFeedbackState | undefined>(undefined);

  const currentNode = story.nodes[playthrough.currentNodeId];

  // Clear transient hit feedback after 350ms so animations reset cleanly without blocking taps.
  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(undefined), 350);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  // Start fight automatically when arriving on an encounter node without an active fight.
  useEffect(() => {
    if (!currentNode || currentNode.kind !== 'encounter') return;
    if (
      playthrough.activeFight &&
      playthrough.activeFight.encounterId === currentNode.id
    ) {
      return;
    }

    const started = startFight(currentNode.encounter, playthrough.combat, {
      playthroughId: playthrough.id,
      encounterId: currentNode.id,
    });
    const nextPt: PlaythroughState = {
      ...playthrough,
      activeFight: { encounterId: currentNode.id, fight: started },
    };
    savePlaythrough(nextPt);
    setPlaythrough(nextPt);
    setResultCaption(`${currentNode.encounter.enemy.name} bars your path.`);
  }, [currentNode, playthrough]);

  const updatePlaythrough = (next: PlaythroughState) => {
    savePlaythrough(next);
    setPlaythrough(next);
  };

  const handleRestart = () => {
    const fresh = createPlaythrough(story);
    setUnwiredNotice(null);
    setResultCaption('');
    updatePlaythrough(fresh);
  };

  const handlePassageChoice = (choiceId: string) => {
    if (!currentNode || currentNode.kind !== 'passage') return;
    const choice = currentNode.choices.find((c) => c.id === choiceId);
    if (!choice) return;

    let next = playthrough;
    if (choice.effects && choice.effects.length > 0) {
      next = applyStoryEffects(next, story, choice.effects);
    }

    if (!choice.targetNodeId || !story.nodes[choice.targetNodeId]) {
      updatePlaythrough(next);
      setUnwiredNotice('This path is not written yet');
      return;
    }

    setUnwiredNotice(null);
    updatePlaythrough({
      ...next,
      currentNodeId: choice.targetNodeId,
    });
  };

  const completeEncounter = (
    encounterNode: EncounterNode,
    finishedFight: FightState,
  ) => {
    const { nextPlaythrough, targetNodeId } = applyFightOutcomeToPlaythrough(
      playthrough,
      story,
      encounterNode,
      finishedFight,
    );
    updatePlaythrough(nextPlaythrough);
    if (!targetNodeId) {
      setUnwiredNotice('This path is not written yet');
    } else {
      setUnwiredNotice(null);
    }
  };

  const handleSelectTactic = (tactic: Tactic) => {
    if (!currentNode || currentNode.kind !== 'encounter') return;
    const active = playthrough.activeFight;
    if (!active || active.encounterId !== currentNode.id) return;

    const updatedFight: FightState = {
      ...active.fight,
      currentTactic: tactic,
    };
    updatePlaythrough({
      ...playthrough,
      activeFight: { encounterId: currentNode.id, fight: updatedFight },
    });
  };

  const handleAdvanceBeat = () => {
    if (!currentNode || currentNode.kind !== 'encounter') return;
    const active = playthrough.activeFight;
    if (!active || active.encounterId !== currentNode.id) return;

    const step = advanceBeat(
      active.fight,
      currentNode.encounter,
      active.fight.currentTactic,
    );
    const caption = selectResultCaption(
      step.events,
      active.fight.currentTactic,
      currentNode.encounter,
      step.state.beatNumber,
    );
    setResultCaption(caption);
    setFeedback(
      deriveHitFeedback(
        active.fight,
        step.state,
        step.events,
        active.fight.currentTactic,
      ),
    );

    if (step.state.status === 'finished') {
      setFeedback(undefined);
      completeEncounter(currentNode, step.state);
      return;
    }

    updatePlaythrough({
      ...playthrough,
      activeFight: { encounterId: currentNode.id, fight: step.state },
    });
  };

  const handleRetreat = () => {
    if (!currentNode || currentNode.kind !== 'encounter') return;
    const active = playthrough.activeFight;
    if (!active || active.encounterId !== currentNode.id) return;

    const step = retreatFight(active.fight, currentNode.encounter);
    completeEncounter(currentNode, step.state);
  };

  const effectiveMax = getEffectiveMaxHealth(playthrough.combat);

  return (
    <div className="player-shell" data-testid="story-player">
      <div className="player-status-bar">
        <span data-testid="player-hp-summary">
          Health: {playthrough.combat.health}/{effectiveMax}
        </span>
        <span>Weapon: {getWeaponDamage(playthrough.combat)} dmg</span>
        <span>Armour: {getArmourBuffer(playthrough.combat)} buf</span>
        <button type="button" onClick={() => setShowInventory((v) => !v)}>
          {showInventory ? 'Hide gear' : 'Gear & wounds'}
        </button>
        <button type="button" onClick={handleRestart}>
          Restart story
        </button>
      </div>

      {showInventory && (
        <section className="story-caption-box" aria-label="Gear and wounds">
          <div>
            <strong>Weapon:</strong>{' '}
            {playthrough.combat.weapon?.name ?? 'Bare hands'} (damage{' '}
            {getWeaponDamage(playthrough.combat)})
          </div>
          <div>
            <strong>Armour:</strong>{' '}
            {playthrough.combat.armour?.name ?? 'None'} (buffer{' '}
            {getArmourBuffer(playthrough.combat)})
          </div>
          <div>
            <strong>Wounds:</strong>{' '}
            {playthrough.combat.wounds.length === 0
              ? 'None'
              : playthrough.combat.wounds
                  .map((w) => `${w.name} (${w.description})`)
                  .join(', ')}
          </div>
        </section>
      )}

      {playthrough.notifications.length > 0 && (
        <div className="combat-tell-box" role="status" data-testid="player-notifications">
          {playthrough.notifications.join(' | ')}
        </div>
      )}

      {unwiredNotice ? (
        <section className="story-caption-box" data-testid="unwired-exit-message">
          <p>{unwiredNotice}</p>
          <button type="button" className="story-choice-btn" onClick={handleRestart}>
            Return to start
          </button>
        </section>
      ) : !currentNode ? (
        <section className="story-caption-box">
          <p>This path is not written yet</p>
          <button type="button" className="story-choice-btn" onClick={handleRestart}>
            Return to start
          </button>
        </section>
      ) : currentNode.kind === 'passage' ? (
        <PassageView node={currentNode} onChoice={handlePassageChoice} onRestart={handleRestart} />
      ) : playthrough.activeFight && playthrough.activeFight.encounterId === currentNode.id ? (
        <CombatScreen
          encounter={currentNode.encounter}
          fightState={playthrough.activeFight.fight}
          resultCaption={resultCaption || `${currentNode.encounter.enemy.name} bars your path.`}
          feedback={feedback}
          onAdvanceBeat={handleAdvanceBeat}
          onSelectTactic={handleSelectTactic}
          onRetreat={handleRetreat}
        />
      ) : null}
    </div>
  );
}

function PassageView({
  node,
  onChoice,
  onRestart,
}: {
  node: PassageNode;
  onChoice: (choiceId: string) => void;
  onRestart: () => void;
}) {
  return (
    <article className="combat-screen" data-testid={`passage-view-${node.id}`}>
      {node.image && (
        <div className="combat-art-stage">
          <img src={node.image} alt={node.title} className="combat-art-img" />
        </div>
      )}
      <div className="story-caption-box">
        <h2 style={{ margin: '0 0 0.4rem', fontSize: '1.1rem' }}>{node.title}</h2>
        <p style={{ margin: 0 }}>{node.text}</p>
      </div>
      {node.choices.length > 0 ? (
        <ChoiceList choices={node.choices} onSelect={onChoice} />
      ) : (
        <button type="button" className="story-choice-btn" onClick={onRestart}>
          Play again
        </button>
      )}
    </article>
  );
}

export type { Encounter };
