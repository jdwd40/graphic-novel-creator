import { useCallback, useEffect, useState } from 'react';
import { selectEncounterArt } from '../combat/art';
import { nextTell, selectResultCaption } from '../combat/captions';
import { evaluateCondition } from '../combat/conditions';
import { getArmourBuffer, getEffectiveMaxHealth, getWeaponDamage } from '../combat/playerState';
import {
  advanceBeat,
  finishFight,
  getActiveMoment,
  getAvailableMomentChoices,
  resolveMomentChoice,
  retreatFight,
  startFight,
} from '../combat/resolver';
import type { BeatLogEntry, Encounter, ExitKey, FightState, Tactic } from '../combat/types';
import {
  applyStoryEffects,
  createPlaythrough,
  loadPlaythrough,
  savePlaythrough,
  type PlaythroughState,
} from '../story/playthrough';
import {
  computeAutoAdvanceDelay,
  loadReaderSettings,
  saveReaderSettings,
  type ReaderSettings,
} from '../story/settings';
import type { EncounterNode, PassageNode, Story } from '../story/types';
import { useImageUrl } from '../story/useImageUrl';
import { ChoiceList } from './ChoiceList';
import { CombatScreen, type CombatFeedbackState } from './CombatScreen';
import { EndOfFightPage } from './EndOfFightPage';
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
  const [readerSettings, setReaderSettings] = useState<ReaderSettings>(() =>
    loadReaderSettings(),
  );
  const [tacticTouchCount, setTacticTouchCount] = useState(0);

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
      storyState: {
        flags: playthrough.flags,
        items: playthrough.items,
        stats: { ...playthrough.stats, health: playthrough.combat.health },
      },
    });
    const nextPt: PlaythroughState = {
      ...playthrough,
      activeFight: { encounterId: currentNode.id, fight: started },
    };
    savePlaythrough(nextPt);
    setPlaythrough(nextPt);
    setResultCaption(`${currentNode.encounter.enemy.name} bars your path.`);
  }, [currentNode, playthrough]);

  const updatePlaythrough = useCallback((next: PlaythroughState) => {
    savePlaythrough(next);
    setPlaythrough(next);
  }, []);

  const handleToggleAutoAdvance = (checked: boolean) => {
    const nextSettings: ReaderSettings = { ...readerSettings, autoAdvance: checked };
    saveReaderSettings(nextSettings);
    setReaderSettings(nextSettings);
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

    const targetNode = story.nodes[choice.targetNodeId];
    if (targetNode.kind === 'passage' && targetNode.effects && targetNode.effects.length > 0) {
      next = applyStoryEffects(next, story, targetNode.effects);
    }

    setUnwiredNotice(null);
    updatePlaythrough({
      ...next,
      currentNodeId: choice.targetNodeId,
    });
  };

  const completeEncounter = useCallback(
    (encounterNode: EncounterNode, finishedFight: FightState) => {
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
    },
    [playthrough, story, updatePlaythrough],
  );

  const handleSelectTactic = (tactic: Tactic) => {
    if (!currentNode || currentNode.kind !== 'encounter') return;
    const active = playthrough.activeFight;
    if (!active || active.encounterId !== currentNode.id) return;

    setTacticTouchCount((c) => c + 1);
    const updatedFight: FightState = {
      ...active.fight,
      currentTactic: tactic,
    };
    updatePlaythrough({
      ...playthrough,
      activeFight: {
        encounterId: currentNode.id,
        fight: updatedFight,
        lastResultCaption: active.lastResultCaption,
      },
    });
  };

  const handleAdvanceBeat = useCallback(() => {
    if (!currentNode || currentNode.kind !== 'encounter') return;
    const active = playthrough.activeFight;
    if (!active || active.encounterId !== currentNode.id) return;
    if (active.fight.status === 'finished' || active.fight.pendingMomentQueue.length > 0) return;

    const tellBefore = nextTell(active.fight, currentNode.encounter);
    const artBefore = selectEncounterArt(currentNode.encounter, active.fight);

    const step = advanceBeat(
      active.fight,
      currentNode.encounter,
      active.fight.currentTactic,
    );
    const baseCaption = selectResultCaption(
      step.events,
      active.fight.currentTactic,
      currentNode.encounter,
      step.state.beatNumber,
    );
    const allyCaptions = step.events
      .filter((e) => e.type === 'allyActed' && e.caption)
      .map((e) => e.caption!);
    const caption = allyCaptions.length > 0 ? `${allyCaptions.join(' ')} ${baseCaption}` : baseCaption;

    const moveEvent = step.events.find((e) => e.type === 'enemyMove');
    const logEntry: BeatLogEntry = {
      kind: 'beat',
      beatNumber: step.state.beatNumber,
      move: moveEvent?.move ?? tellBefore.move,
      tactic: active.fight.currentTactic,
      image: artBefore,
      resultCaption: caption,
      tellCaption: tellBefore.caption,
    };
    const nextFight: FightState = {
      ...step.state,
      beatLog: [...step.state.beatLog, logEntry],
    };

    setResultCaption(caption);
    setFeedback(
      nextFight.status === 'finished'
        ? undefined
        : deriveHitFeedback(
            active.fight,
            nextFight,
            step.events,
            active.fight.currentTactic,
          ),
    );

    updatePlaythrough({
      ...playthrough,
      activeFight: {
        encounterId: currentNode.id,
        fight: nextFight,
        lastResultCaption: caption,
      },
    });
  }, [currentNode, playthrough, updatePlaythrough]);

  // Auto-advance timer when reader setting is enabled.
  useEffect(() => {
    if (!readerSettings.autoAdvance) return;
    if (!currentNode || currentNode.kind !== 'encounter') return;
    const active = playthrough.activeFight;
    if (!active || active.encounterId !== currentNode.id) return;
    if (active.fight.status !== 'ongoing' || active.fight.pendingMomentQueue.length > 0) {
      return;
    }

    const activeCaption =
      active.lastResultCaption ||
      resultCaption ||
      `${currentNode.encounter.enemy.name} bars your path.`;
    const tell = nextTell(active.fight, currentNode.encounter);
    const delayMs = computeAutoAdvanceDelay(activeCaption, tell.caption);

    const timer = window.setTimeout(() => {
      handleAdvanceBeat();
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [
    currentNode,
    handleAdvanceBeat,
    playthrough.activeFight,
    readerSettings.autoAdvance,
    resultCaption,
    tacticTouchCount,
  ]);

  const handleRetreat = () => {
    if (!currentNode || currentNode.kind !== 'encounter') return;
    const active = playthrough.activeFight;
    if (!active || active.encounterId !== currentNode.id) return;

    const tellBefore = nextTell(active.fight, currentNode.encounter);
    const artBefore = selectEncounterArt(currentNode.encounter, active.fight);
    const step = retreatFight(active.fight, currentNode.encounter);
    const caption = selectResultCaption(
      step.events,
      'steady',
      currentNode.encounter,
      active.fight.beatNumber + 1,
    );
    const logEntry: BeatLogEntry = {
      kind: 'beat',
      beatNumber: active.fight.beatNumber + 1,
      move: 'strike',
      tactic: 'steady',
      image: artBefore,
      resultCaption: caption,
      tellCaption: tellBefore.caption,
    };
    const nextFight: FightState = {
      ...step.state,
      beatLog: [...step.state.beatLog, logEntry],
    };

    updatePlaythrough({
      ...playthrough,
      activeFight: {
        encounterId: currentNode.id,
        fight: nextFight,
        lastResultCaption: caption,
      },
    });
  };

  const handleSelectMomentChoice = (choiceIndex: number) => {
    if (!currentNode || currentNode.kind !== 'encounter') return;
    const active = playthrough.activeFight;
    if (!active || active.encounterId !== currentNode.id) return;

    const storyState = {
      flags: playthrough.flags,
      items: playthrough.items,
      stats: { ...playthrough.stats, health: playthrough.combat.health },
    };
    const activeMoment = getActiveMoment(active.fight, currentNode.encounter);
    const available = getAvailableMomentChoices(
      active.fight,
      currentNode.encounter,
      storyState,
    );
    const picked = available.find((c) => c.choiceIndex === choiceIndex);
    const artNow = selectEncounterArt(currentNode.encounter, active.fight);

    const step = resolveMomentChoice(
      active.fight,
      currentNode.encounter,
      choiceIndex,
      storyState,
    );

    const nextLog = [...step.state.beatLog];
    if (activeMoment && picked) {
      nextLog.push({
        kind: 'moment',
        momentIndex: activeMoment.index,
        caption: activeMoment.moment.caption,
        chosenLabel: picked.choice.label,
        image: artNow,
      });
    }

    const nextFight: FightState = {
      ...step.state,
      beatLog: nextLog,
    };

    updatePlaythrough({
      ...playthrough,
      activeFight: {
        encounterId: currentNode.id,
        fight: nextFight,
        lastResultCaption: active.lastResultCaption,
      },
    });
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
        <label className="auto-advance-toggle">
          <input
            type="checkbox"
            checked={readerSettings.autoAdvance}
            onChange={(e) => handleToggleAutoAdvance(e.target.checked)}
          />
          Auto-advance
        </label>
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
        <PassageView
          node={currentNode}
          storyState={{
            flags: playthrough.flags,
            items: playthrough.items,
            stats: { ...playthrough.stats, health: playthrough.combat.health },
          }}
          onChoice={handlePassageChoice}
          onRestart={handleRestart}
        />
      ) : playthrough.activeFight && playthrough.activeFight.encounterId === currentNode.id ? (
        playthrough.activeFight.fight.status === 'finished' ? (
          <EndOfFightPage
            encounter={currentNode.encounter}
            fightState={playthrough.activeFight.fight}
            onContinue={() =>
              completeEncounter(currentNode, playthrough.activeFight!.fight)
            }
          />
        ) : (
          <CombatScreen
            encounter={currentNode.encounter}
            fightState={playthrough.activeFight.fight}
            storyState={{
              flags: playthrough.flags,
              items: playthrough.items,
              stats: { ...playthrough.stats, health: playthrough.combat.health },
            }}
            resultCaption={
              playthrough.activeFight.lastResultCaption ||
              resultCaption ||
              `${currentNode.encounter.enemy.name} bars your path.`
            }
            feedback={feedback}
            onAdvanceBeat={handleAdvanceBeat}
            onSelectTactic={handleSelectTactic}
            onRetreat={handleRetreat}
            onSelectMomentChoice={handleSelectMomentChoice}
          />
        )
      ) : null}
    </div>
  );
}

function PassageView({
  node,
  storyState,
  onChoice,
  onRestart,
}: {
  node: PassageNode;
  storyState: { flags: Record<string, boolean>; items: string[]; stats: Record<string, number> };
  onChoice: (choiceId: string) => void;
  onRestart: () => void;
}) {
  const visibleChoices = node.choices.filter((choice) =>
    evaluateCondition(choice.condition, storyState),
  );
  const resolvedImage = useImageUrl(node.image);

  return (
    <article className="combat-screen" data-testid={`passage-view-${node.id}`}>
      {resolvedImage && (
        <div className="combat-art-stage">
          <img src={resolvedImage} alt={node.title} className="combat-art-img" />
        </div>
      )}
      <div className="story-caption-box">
        <h2 style={{ margin: '0 0 0.4rem', fontSize: '1.1rem' }}>{node.title}</h2>
        <p style={{ margin: 0 }}>{node.text}</p>
      </div>
      {visibleChoices.length > 0 ? (
        <ChoiceList choices={visibleChoices} onSelect={onChoice} />
      ) : (
        <button type="button" className="story-choice-btn" onClick={onRestart}>
          Play again
        </button>
      )}
    </article>
  );
}

export type { Encounter };
