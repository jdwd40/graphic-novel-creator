import { useCallback, useEffect, useRef, useState } from 'react';
import { selectEncounterArt } from '../combat/art';
import { nextTell, selectResultCaption } from '../combat/captions';
import { evaluateCondition } from '../combat/conditions';
import { getArmourBuffer, getEffectiveMaxHealth } from '../combat/playerState';
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
import { NotificationCard } from './NotificationCard';
import { ReaderHud } from './ReaderHud';
import { SatchelSheet } from './SatchelSheet';
import { TitleScreen } from './TitleScreen';
import { deriveHitFeedback } from './hitFeedback';
import './PlayerTheme.css';

export interface StoryPlayerProps {
  story: Story;
  initialPlaythrough?: PlaythroughState;
  showTitleScreen?: boolean;
  onExitToBuilder?: () => void;
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

export function StoryPlayer({
  story,
  initialPlaythrough,
  showTitleScreen,
  onExitToBuilder,
}: StoryPlayerProps) {
  const [onTitleScreen, setOnTitleScreen] = useState<boolean>(
    () => showTitleScreen ?? !initialPlaythrough,
  );
  const savedOnMount = loadPlaythrough(story.id);
  const [playthrough, setPlaythrough] = useState<PlaythroughState>(() => {
    if (initialPlaythrough) return initialPlaythrough;
    return savedOnMount ?? createPlaythrough(story);
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
    if (onTitleScreen) return;
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
  }, [currentNode, onTitleScreen, playthrough]);

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

  const handleDismissNotificationCard = () => {
    const cards = playthrough.notificationCards ?? [];
    if (cards.length === 0) return;
    updatePlaythrough({
      ...playthrough,
      notificationCards: cards.slice(1),
      notifications: cards.length <= 1 ? [] : playthrough.notifications,
    });
  };

  const handlePassageChoice = (choiceId: string) => {
    if (!currentNode || currentNode.kind !== 'passage') return;
    const choice = currentNode.choices.find((c) => c.id === choiceId);
    if (!choice) return;

    let next: PlaythroughState = {
      ...playthrough,
      notifications: [],
      notificationCards: [],
    };
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
      const targetApplied = applyStoryEffects(next, story, targetNode.effects);
      next = {
        ...targetApplied,
        notificationCards: [
          ...(next.notificationCards ?? []),
          ...(targetApplied.notificationCards ?? []),
        ],
      };
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

  // Auto-advance timer when reader setting is enabled (paused while Satchel sheet is open).
  useEffect(() => {
    if (!readerSettings.autoAdvance || showInventory) return;
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
    showInventory,
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

  const liveFight =
    currentNode?.kind === 'encounter' &&
    playthrough.activeFight?.encounterId === currentNode.id
      ? playthrough.activeFight.fight
      : null;
  const displayedHealth = liveFight
    ? liveFight.playerHealth
    : playthrough.combat.health;
  const effectiveMax = liveFight
    ? liveFight.playerMaxHealth
    : getEffectiveMaxHealth(playthrough.combat);
  const displayedArmour = liveFight
    ? liveFight.playerBuffer
    : getArmourBuffer(playthrough.combat);

  const maxArmourBuffer = liveFight
    ? liveFight.playerMaxBuffer
    : getArmourBuffer(playthrough.combat);

  const renderedView =
    unwiredNotice || !currentNode
      ? 'notice'
      : currentNode.kind === 'passage'
        ? 'passage'
        : playthrough.activeFight?.encounterId === currentNode.id
          ? playthrough.activeFight.fight.status === 'finished'
            ? 'end'
            : 'combat'
          : 'pending';

  const pageTransitionKey = `${playthrough.currentNodeId}:${renderedView}`;

  const pageContainerRef = useRef<HTMLDivElement | null>(null);
  const lastTransitionRef = useRef<string | null>(null);

  useEffect(() => {
    if (onTitleScreen || renderedView === 'pending') return;
    if (lastTransitionRef.current === null) {
      lastTransitionRef.current = pageTransitionKey;
      return;
    }
    if (lastTransitionRef.current !== pageTransitionKey) {
      lastTransitionRef.current = pageTransitionKey;
      try {
        window.scrollTo?.(0, 0);
      } catch {
        // Ignore unimplemented scrollTo in synthetic environments
      }
      const heading = pageContainerRef.current?.querySelector<HTMLElement>('[data-page-heading]');
      heading?.focus();
    }
  }, [onTitleScreen, pageTransitionKey, renderedView]);

  if (onTitleScreen) {
    return (
      <div className="player-shell" data-testid="story-player">
        <TitleScreen
          story={story}
          hasSave={Boolean(loadPlaythrough(story.id))}
          onContinue={() => {
            const loaded = loadPlaythrough(story.id);
            if (loaded) {
              setPlaythrough(loaded);
            }
            setOnTitleScreen(false);
          }}
          onNewGame={() => {
            const fresh = createPlaythrough(story);
            setUnwiredNotice(null);
            setResultCaption('');
            updatePlaythrough(fresh);
            setOnTitleScreen(false);
          }}
          onExitToBuilder={onExitToBuilder}
        />
      </div>
    );
  }

  return (
    <div className="player-shell" data-testid="story-player">
      <ReaderHud
        health={displayedHealth}
        maxHealth={effectiveMax}
        armour={displayedArmour}
        maxArmour={maxArmourBuffer}
        satchelOpen={showInventory}
        autoAdvance={readerSettings.autoAdvance}
        onToggleSatchel={() => setShowInventory((v) => !v)}
        onToggleAutoAdvance={handleToggleAutoAdvance}
        onRestart={handleRestart}
        onExitToBuilder={onExitToBuilder}
      />

      {showInventory && (
        <SatchelSheet
          story={story}
          combat={playthrough.combat}
          carriedItemIds={playthrough.items}
          wounds={playthrough.combat.wounds}
          onClose={() => setShowInventory(false)}
        />
      )}

      {(playthrough.notificationCards?.length ?? 0) > 0 && (
        <NotificationCard
          cards={playthrough.notificationCards ?? []}
          onDismiss={handleDismissNotificationCard}
        />
      )}

      <div
        key={pageTransitionKey}
        ref={pageContainerRef}
        className="page-turn-frame"
        data-testid="page-turn-frame"
      >
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
    <article className="passage-page" data-testid={`passage-view-${node.id}`}>
      {resolvedImage ? (
        <div className="passage-page__art-stage" data-testid="passage-art-stage">
          <img src={resolvedImage} alt={node.title} className="passage-page__art-img" />
        </div>
      ) : (
        <div className="passage-page__no-art-banner" data-testid="passage-no-art-banner">
          <h2 className="passage-page__display-title">{node.title}</h2>
        </div>
      )}
      {!resolvedImage && null}
      <div className="passage-page__caption" data-testid="passage-caption-panel">
        <h2
          className={
            resolvedImage
              ? 'passage-page__display-title page-heading-focus'
              : 'sr-only page-heading-focus'
          }
          tabIndex={-1}
          data-page-heading
        >
          {node.title}
        </h2>
        <p>{node.text}</p>
      </div>
      {!node.isEnding && visibleChoices.length > 0 ? (
        <ChoiceList choices={visibleChoices} onSelect={onChoice} />
      ) : (
        <div className="story-ending-actions">
          {node.isEnding && (
            <span className="story-node__badge story-node__badge--end" data-testid="passage-ending-badge">
              Ending
            </span>
          )}
          <button type="button" className="story-choice-btn" onClick={onRestart}>
            Play again
          </button>
        </div>
      )}
    </article>
  );
}

export type { Encounter };
