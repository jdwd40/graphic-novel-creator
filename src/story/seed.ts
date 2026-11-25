import { BEHAVIOUR_PRESETS, GEAR_TIERS, TOUGHNESS_PRESETS } from '../combat/constants';
import {
  ART_ARMORY,
  ART_BELLWARDEN,
  ART_BELLWARDEN_P2,
  ART_BRUTE,
  ART_BRUTE_OPEN,
  ART_BRUTE_WOUNDED,
  ART_GATEHOUSE,
  ART_SHRINE,
} from './artwork';
import type { Story } from './types';

export function createSeedStory(): Story {
  return {
    id: 'iron-bell',
    title: 'The Iron Bell',
    startNodeId: 'passage_intro',
    items: {
      rusty_sword: {
        id: 'rusty_sword',
        name: GEAR_TIERS[0].weaponName,
        description: 'A notched watch-blade that still holds an edge.',
        weaponDamage: GEAR_TIERS[0].damage,
      },
      padded_coat: {
        id: 'padded_coat',
        name: GEAR_TIERS[0].armourName,
        description: 'Thick stitched leather that absorbs early blows.',
        armourBuffer: GEAR_TIERS[0].buffer,
      },
      steel_sword: {
        id: 'steel_sword',
        name: GEAR_TIERS[1].weaponName,
        description: 'Balanced foundry steel forged for the upper tower.',
        weaponDamage: GEAR_TIERS[1].damage,
      },
      mail_hauberk: {
        id: 'mail_hauberk',
        name: GEAR_TIERS[1].armourName,
        description: 'Riveted iron rings that turn heavy swings.',
        armourBuffer: GEAR_TIERS[1].buffer,
      },
      iron_key: {
        id: 'iron_key',
        name: 'Bell-Clapper Charm',
        description: 'Resonates with the Warden’s heavy strikes, letting you parry them.',
      },
    },
    nodes: {
      passage_intro: {
        id: 'passage_intro',
        kind: 'passage',
        title: 'The Courtyard Gate',
        text: 'Rain hammers the cobblestones below the Iron Bell tower. Beyond the unlocked armory hatch, a lantern swings in the gatehouse.',
        image: ART_ARMORY,
        position: { x: 60, y: 120 },
        choices: [
          {
            id: 'c_armory',
            label: 'Gear up at the watch armory',
            targetNodeId: 'passage_armory',
            effects: [{ addItem: 'rusty_sword' }, { addItem: 'padded_coat' }],
          },
        ],
      },
      passage_armory: {
        id: 'passage_armory',
        kind: 'passage',
        title: 'Watch Armory',
        text: 'You strap on a Padded Coat and draw a Rusty Sword from the rack. Footsteps echo from the gatehouse archway.',
        image: ART_ARMORY,
        position: { x: 340, y: 120 },
        choices: [
          {
            id: 'c_scout',
            label: 'Inspect the cracked bell blueprints (+knowledge)',
            targetNodeId: 'enc_gatehouse',
            effects: [{ setFlag: 'knows_weakness' }],
          },
          {
            id: 'c_rush',
            label: 'Step straight into the gatehouse',
            targetNodeId: 'enc_gatehouse',
          },
        ],
      },
      enc_gatehouse: {
        id: 'enc_gatehouse',
        kind: 'encounter',
        title: 'Gatehouse Guard',
        position: { x: 650, y: 100 },
        encounter: {
          type: 'encounter',
          enemy: {
            name: 'Gatehouse Guard',
            image: ART_GATEHOUSE,
            toughness: 'standard',
            health: TOUGHNESS_PRESETS.standard.health,
            hit: TOUGHNESS_PRESETS.standard.hit,
          },
          behaviour: 'brawler',
          pattern: [...BEHAVIOUR_PRESETS.brawler],
          altPattern: null,
          tellClarity: TOUGHNESS_PRESETS.standard.tellClarity,
          allowRetreat: true,
          exits: {
            victory: { effects: [] },
            defeat: { effects: [{ addWound: 'Bruised shoulder' }] },
            retreat: { effects: [] },
          },
        },
        exitTargets: {
          victory: 'passage_shrine',
          defeat: 'passage_defeat_cell',
          retreat: 'passage_retreat_alley',
        },
      },
      passage_shrine: {
        id: 'passage_shrine',
        kind: 'passage',
        title: 'Lantern Shrine',
        text: 'The guard slumps against the stone pillar. Ahead lies a quiet shrine stocked with foundry steel and a hearth to catch your breath.',
        image: ART_SHRINE,
        position: { x: 960, y: 80 },
        choices: [
          {
            id: 'c_upgrade_rest',
            label: 'Rest by the hearth and take the Steel Sword & Mail',
            targetNodeId: 'enc_brute',
            effects: [
              { rest: true },
              { addItem: 'steel_sword' },
              { addItem: 'mail_hauberk' },
              { addItem: 'iron_key' },
            ],
          },
        ],
      },
      enc_brute: {
        id: 'enc_brute',
        kind: 'encounter',
        title: 'Hammer Brute',
        position: { x: 1270, y: 80 },
        encounter: {
          type: 'encounter',
          enemy: {
            name: 'Hammer Brute',
            image: ART_BRUTE,
            toughness: 'tough',
            health: TOUGHNESS_PRESETS.tough.health,
            hit: TOUGHNESS_PRESETS.tough.hit,
          },
          behaviour: 'brute',
          pattern: [...BEHAVIOUR_PRESETS.brute],
          altPattern: null,
          tellClarity: TOUGHNESS_PRESETS.tough.tellClarity,
          captions: {
            tell: { heavy: ['The creature shifts its weight.'] },
            result: { heavyBlocked: ['The hammer crashes into the floor and sticks there.'] },
          },
          art: {
            open: ART_BRUTE_OPEN,
            enemyWounded: ART_BRUTE_WOUNDED,
          },
          modifiers: [{ if: { flag: 'knows_weakness' }, effect: 'revealTells' }],
          moments: [
            {
              trigger: { enemyHealthAtMost: 3 },
              caption: 'The brute falls to one knee, gasping beneath the belfry.',
              choices: [
                { label: 'Finish it.', then: 'continue' },
                { label: 'Demand surrender.', then: 'exit', exit: 'surrender' },
              ],
            },
          ],
          phases: [],
          winCondition: { type: 'enemyHealthZero' },
          allowRetreat: true,
          exits: {
            victory: { effects: [] },
            defeat: { effects: [{ addWound: 'Cracked rib' }] },
            retreat: { effects: [] },
            surrender: { label: 'Surrender', effects: [{ setFlag: 'brute_spared' }] },
          },
        },
        exitTargets: {
          victory: 'enc_boss',
          defeat: 'passage_defeat_cell',
          retreat: 'passage_retreat_alley',
          surrender: 'enc_boss',
        },
      },
      enc_boss: {
        id: 'enc_boss',
        kind: 'encounter',
        title: 'Iron Bellwarden',
        position: { x: 1580, y: 80 },
        encounter: {
          type: 'encounter',
          enemy: {
            name: 'Iron Bellwarden',
            image: ART_BELLWARDEN,
            toughness: 'boss',
            health: TOUGHNESS_PRESETS.boss.health,
            hit: TOUGHNESS_PRESETS.boss.hit,
          },
          behaviour: 'brawler',
          pattern: [...BEHAVIOUR_PRESETS.brawler],
          altPattern: null,
          tellClarity: 'clear',
          phases: [
            {
              healthAtMost: 8,
              pattern: ['strike', 'heavy'],
              image: ART_BELLWARDEN_P2,
            },
          ],
          moments: [
            {
              trigger: { phaseStart: 1 },
              caption: 'The great bell tolls overhead, shaking dust from the rafters!',
              choices: [
                { label: 'Stand firm and press on.', then: 'continue' },
                { label: 'Duck under the fallen beam.', then: 'continue', enemyHealthDelta: -1 },
              ],
            },
          ],
          winCondition: { type: 'enemyHealthZero' },
          allowRetreat: false,
          exits: {
            victory: { effects: [] },
            defeat: { effects: [] },
          },
        },
        exitTargets: {
          victory: 'passage_victory',
          defeat: 'passage_defeat_cell',
        },
      },
      passage_victory: {
        id: 'passage_victory',
        kind: 'passage',
        title: 'Dawn Over the Belfry',
        text: 'The Iron Bell falls silent. Daylight breaks across the valley below.',
        image: ART_SHRINE,
        position: { x: 1890, y: 40 },
        isEnding: true,
        choices: [],
      },
      passage_defeat_cell: {
        id: 'passage_defeat_cell',
        kind: 'passage',
        title: 'The Guardhouse Cell',
        text: 'You wake on cold flagstones, battered but alive. The story is not over yet.',
        image: ART_ARMORY,
        position: { x: 960, y: 310 },
        choices: [
          {
            id: 'c_escape_cell',
            label: 'Slip out while the watch changes',
            targetNodeId: 'passage_shrine',
          },
        ],
      },
      passage_retreat_alley: {
        id: 'passage_retreat_alley',
        kind: 'passage',
        title: 'Rain-Slick Alley',
        text: 'You fall back into the alley to catch your breath before deciding whether to try again.',
        image: ART_ARMORY,
        position: { x: 960, y: 470 },
        choices: [
          {
            id: 'c_return_gatehouse',
            label: 'Head back to the gatehouse',
            targetNodeId: 'enc_gatehouse',
          },
        ],
      },
    },
  };
}
