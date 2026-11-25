export type Tactic = 'press' | 'steady' | 'guard';

export type Move = 'strike' | 'heavy' | 'open';

export type TellClarity = 'clear' | 'vague' | 'hidden';

export type ToughnessPreset = 'weak' | 'standard' | 'tough' | 'boss';

export type BehaviourPreset = 'brawler' | 'brute' | 'skirmisher' | 'custom';

export type StandardExitKey = 'victory' | 'defeat' | 'retreat';

export type ExitKey = StandardExitKey | (string & {});

export type StatOperator = 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq';

export type Condition =
  | { flag: string }
  | { item: string }
  | { stat: string; op: StatOperator; value: number };

export interface StoryStateSnapshot {
  flags: Record<string, boolean>;
  items: string[];
  stats: Record<string, number>;
}

export type Modifier =
  | { if: Condition; effect: 'enemyHealth'; value: number }
  | { if: Condition; effect: 'enemyHit'; value: number }
  | { if: Condition; effect: 'revealTells' }
  | { if: Condition; effect: 'allyActs'; beat: number; damage: number; caption: string }
  | { if: Condition; effect: 'swapPattern'; pattern: Move[] }
  | { if: Condition; effect: 'bonusBuffer'; value: number }
  | { if: Condition; effect: 'unlockChoice'; choiceId: string }
  | { if: Condition; effect: 'unlockExit'; exitKey: string };

export type MomentTrigger =
  | { enemyHealthAtMost: number }
  | { playerHealthAtMost: number }
  | { beat: number }
  | { phaseStart: number };

export interface MomentChoice {
  id?: string;
  label: string;
  then: 'continue' | 'exit';
  exit?: ExitKey;
  enemyHealthDelta?: number;
  condition?: Condition;
  requiresUnlock?: string;
}

export interface Moment {
  id?: string;
  trigger: MomentTrigger;
  caption: string;
  choices: MomentChoice[];
}

export type ExitEffect =
  | { setFlag: string }
  | { addItem: string }
  | { removeItem: string }
  | { changeHealth: number }
  | { addWound: string; description?: string }
  | { removeWound: string }
  | { rest: true };

export interface ExitConfig {
  label?: string;
  effects: ExitEffect[];
}

export interface BossPhase {
  healthAtMost: number;
  pattern: Move[];
  image?: string;
}

export type BossRuleBreak =
  | { type: 'unblockableHeavyWithoutItem'; item: string }
  | { type: 'hiddenTellsUntilFlag'; flag: string }
  | { type: 'healthFloorUntilMoment'; floor: number; momentIndex: number };

export type WinCondition =
  | { type: 'enemyHealthZero' }
  | { type: 'surviveBeats'; beats: number }
  | { type: 'reachMoment'; momentIndex: number };

export type ResultCaptionKey =
  | 'strikeTraded'
  | 'strikePressed'
  | 'strikeGuarded'
  | 'heavyLanded'
  | 'heavyPressed'
  | 'heavyBlocked'
  | 'openPunished'
  | 'openSteady'
  | 'openGuarded'
  | 'enemyDefeated'
  | 'playerDefeated'
  | 'retreat';

export interface EncounterCaptions {
  tell?: Partial<Record<Move, string[]>>;
  result?: Partial<Record<ResultCaptionKey, string[]>>;
}

export interface EncounterArt {
  open?: string;
  enemyWounded?: string;
  playerWounded?: string;
  phases?: string[];
}

export interface EncounterEnemy {
  name: string;
  image: string;
  toughness: ToughnessPreset;
  health: number;
  hit: number;
}

export interface Encounter {
  type: 'encounter';
  enemy: EncounterEnemy;
  behaviour: BehaviourPreset;
  pattern: Move[];
  altPattern: Move[] | null;
  tellClarity: TellClarity;
  captions?: EncounterCaptions;
  art?: EncounterArt;
  modifiers?: Modifier[];
  moments?: Moment[];
  phases?: BossPhase[];
  winCondition?: WinCondition;
  ruleBreak?: BossRuleBreak | null;
  allowRetreat: boolean;
  exits: Record<string, ExitConfig>;
}

export interface EquippedWeapon {
  id: string;
  name: string;
  damage: number;
}

export interface EquippedArmour {
  id: string;
  name: string;
  buffer: number;
}

export interface Wound {
  name: string;
  description: string;
}

export interface PlayerCombatState {
  health: number;
  maxHealth: number;
  weapon: EquippedWeapon | null;
  armour: EquippedArmour | null;
  wounds: Wound[];
}

export interface AllyActionState {
  beat: number;
  damage: number;
  caption: string;
}

export type BeatLogEntry =
  | {
      kind: 'beat';
      beatNumber: number;
      move: Move;
      tactic: Tactic;
      image: string;
      resultCaption: string;
      tellCaption: string | null;
    }
  | {
      kind: 'moment';
      momentIndex: number;
      caption: string;
      chosenLabel: string;
      image: string;
    };

export interface FightState {
  enemyHealth: number;
  enemyMaxHealth: number;
  enemyHit: number;
  playerHealth: number;
  playerMaxHealth: number;
  playerStartingHealth: number;
  playerBuffer: number;
  playerMaxBuffer: number;
  playerWeaponDamage: number;
  beatNumber: number;
  pattern: Move[];
  altPattern: Move[] | null;
  activePattern: Move[];
  patternIndex: number;
  loopCount: number;
  phase: number;
  currentTactic: Tactic;
  pendingOpen: boolean;
  firedMoments: number[];
  pendingMomentQueue: number[];
  revealedTells: boolean;
  allyActions: AllyActionState[];
  unlockedChoices: string[];
  unlockedExits: string[];
  releasedHealthFloor: boolean;
  playthroughId: string;
  encounterId: string;
  status: 'ongoing' | 'finished';
  exitKey: ExitKey | null;
  beatLog: BeatLogEntry[];
}

export interface BeatEvent {
  type:
    | 'allyActed'
    | 'playerHit'
    | 'enemyMove'
    | 'bufferAbsorbed'
    | 'playerDamaged'
    | 'heavyBlocked'
    | 'enemyDefeated'
    | 'playerDefeated'
    | 'retreat'
    | 'phaseChanged'
    | 'momentTriggered';
  amount?: number;
  move?: Move;
  tactic?: Tactic;
  caption?: string;
  phase?: number;
  momentIndex?: number;
}

export interface FightResult {
  exitKey: ExitKey;
  healthAfter: number;
  beatsPlayed: number;
  healthLost: number;
  clean: boolean;
  bloodied: boolean;
  bufferDiscarded: true;
  exitEffects: ExitEffect[];
}
