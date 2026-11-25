function encodeSvg(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg.trim())}`;
}

export function makePanelArt(
  title: string,
  subtitle: string,
  bgTop: string,
  bgBottom: string,
  accent: string,
  silhouette:
    | 'guard'
    | 'brute'
    | 'bell'
    | 'armory'
    | 'shrine'
    | 'open'
    | 'wounded'
    | 'courtyard'
    | 'dawn'
    | 'cell'
    | 'alley',
): string {
  const figure = (() => {
    switch (silhouette) {
      case 'courtyard':
        return `
          <path d="M95 154 L95 72 L135 72 L135 154 M225 154 L225 72 L265 72 L265 154" fill="#1e293b" stroke="${accent}" stroke-width="3"/>
          <path d="M135 154 L135 88 Q180 42 225 88 L225 154" fill="none" stroke="${accent}" stroke-width="4"/>
          <path d="M168 38 L192 38 L196 68 L164 68 Z" fill="#0f172a" stroke="${accent}" stroke-width="2.5"/>
          <path d="M60 40 L72 60 M110 24 L122 44 M248 28 L260 48 M295 45 L307 65" stroke="#94a3b8" stroke-width="2" opacity="0.6"/>
        `;
      case 'dawn':
        return `
          <circle cx="180" cy="128" r="38" fill="${accent}" opacity="0.85"/>
          <path d="M115 154 L145 58 L215 58 L245 154 Z" fill="#1e1b4b" opacity="0.7" stroke="${accent}" stroke-width="3"/>
          <path d="M60 120 L120 120 M240 120 L300 120 M180 40 L180 20" stroke="${accent}" stroke-width="3" stroke-linecap="round"/>
        `;
      case 'cell':
        return `
          <rect x="130" y="38" width="100" height="72" rx="4" fill="#0f172a" stroke="${accent}" stroke-width="3"/>
          <path d="M155 38 L155 110 M180 38 L180 110 M205 38 L205 110 M130 74 L230 74" stroke="#94a3b8" stroke-width="3"/>
          <path d="M100 154 L260 154" stroke="${accent}" stroke-width="3"/>
        `;
      case 'alley':
        return `
          <path d="M40 24 L140 58 L140 154 L40 154 Z" fill="#0f172a" stroke="${accent}" stroke-width="2.5"/>
          <path d="M320 24 L220 58 L220 154 L320 154 Z" fill="#0f172a" stroke="${accent}" stroke-width="2.5"/>
          <circle cx="180" cy="84" r="10" fill="${accent}" opacity="0.8"/>
          <path d="M70 32 L58 54 M195 22 L183 44 M285 36 L273 58" stroke="#64748b" stroke-width="2" opacity="0.7"/>
        `;
      case 'guard':
        return `
          <path d="M180 62 L205 88 L195 155 L165 155 L155 88 Z" fill="#1b1f2a" stroke="${accent}" stroke-width="3"/>
          <circle cx="180" cy="48" r="16" fill="#1b1f2a" stroke="${accent}" stroke-width="3"/>
          <path d="M198 112 L252 54" stroke="#e2e8f0" stroke-width="5" stroke-linecap="round"/>
          <path d="M150 94 L132 135 L156 146 Z" fill="#334155" stroke="${accent}" stroke-width="2.5"/>
        `;
      case 'brute':
        return `
          <path d="M140 58 L220 58 L234 156 L126 156 Z" fill="#1c1917" stroke="${accent}" stroke-width="3.5"/>
          <circle cx="180" cy="42" r="18" fill="#1c1917" stroke="${accent}" stroke-width="3.5"/>
          <path d="M226 96 L282 46" stroke="#94a3b8" stroke-width="7" stroke-linecap="round"/>
          <rect x="268" y="24" width="32" height="36" rx="4" transform="rotate(-35 284 42)" fill="#475569" stroke="${accent}" stroke-width="3"/>
        `;
      case 'open':
        return `
          <path d="M148 76 L212 76 L224 156 L136 156 Z" fill="#1c1917" stroke="#f59e0b" stroke-width="3.5"/>
          <circle cx="180" cy="60" r="16" fill="#1c1917" stroke="#f59e0b" stroke-width="3.5"/>
          <path d="M225 130 L292 152" stroke="#94a3b8" stroke-width="7" stroke-linecap="round"/>
          <path d="M110 42 L132 58 M248 42 L226 58" stroke="#fbbf24" stroke-width="4" stroke-linecap="round"/>
        `;
      case 'wounded':
        return `
          <path d="M152 72 L208 72 L218 156 L142 156 Z" fill="#2a1215" stroke="#ef4444" stroke-width="3.5"/>
          <circle cx="180" cy="54" r="16" fill="#2a1215" stroke="#ef4444" stroke-width="3.5"/>
          <path d="M138 92 L222 134" stroke="#ef4444" stroke-width="5" stroke-linecap="round"/>
        `;
      case 'bell':
        return `
          <path d="M130 140 Q145 54 180 44 Q215 54 230 140 Z" fill="#292524" stroke="${accent}" stroke-width="3.5"/>
          <circle cx="180" cy="144" r="10" fill="${accent}"/>
          <path d="M90 156 L270 156" stroke="${accent}" stroke-width="4"/>
        `;
      case 'armory':
        return `
          <rect x="120" y="54" width="120" height="100" rx="6" fill="#1e293b" stroke="${accent}" stroke-width="3"/>
          <path d="M150 74 L150 134 M180 74 L180 134 M210 74 L210 134" stroke="#cbd5e1" stroke-width="4" stroke-linecap="round"/>
        `;
      case 'shrine':
        return `
          <path d="M145 154 L165 62 L195 62 L215 154 Z" fill="#1e293b" stroke="${accent}" stroke-width="3"/>
          <circle cx="180" cy="46" r="12" fill="${accent}" opacity="0.85"/>
        `;
    }
  })();

  return encodeSvg(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 190" role="img" aria-label="${title}">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${bgTop}" />
          <stop offset="100%" stop-color="${bgBottom}" />
        </linearGradient>
      </defs>
      <rect width="360" height="190" fill="url(#bg)" />
      <path d="M0 154 L360 154 L360 190 L0 190 Z" fill="#0f1117" opacity="0.7" />
      ${figure}
      <text x="16" y="176" fill="#f8fafc" font-family="system-ui, sans-serif" font-size="12" font-weight="700" letter-spacing="1">${title.toUpperCase()} · ${subtitle.toUpperCase()}</text>
    </svg>
  `);
}

export const ART_GATEHOUSE = makePanelArt(
  'Gatehouse Guard',
  'Brawler',
  '#232b3d',
  '#131722',
  '#d49a2a',
  'guard',
);

export const ART_BRUTE = makePanelArt(
  'Hammer Brute',
  'Tough',
  '#381f24',
  '#160d10',
  '#f97316',
  'brute',
);

export const ART_BRUTE_OPEN = makePanelArt(
  'Hammer Stuck',
  'Opening',
  '#422006',
  '#1c1917',
  '#fbbf24',
  'open',
);

export const ART_BRUTE_WOUNDED = makePanelArt(
  'Hammer Brute',
  'Staggering',
  '#450a0a',
  '#160d10',
  '#ef4444',
  'wounded',
);

export const ART_BELLWARDEN = makePanelArt(
  'Iron Bellwarden',
  'Boss',
  '#1e1b4b',
  '#09090b',
  '#a855f7',
  'bell',
);

export const ART_BELLWARDEN_P2 = makePanelArt(
  'Bellwarden Awakened',
  'Phase II',
  '#3b0764',
  '#09090b',
  '#f43f5e',
  'wounded',
);

export const ART_COURTYARD = makePanelArt(
  'The Courtyard Gate',
  'Rainy Approach',
  '#1e293b',
  '#090d16',
  '#60a5fa',
  'courtyard',
);

export const ART_ARMORY = makePanelArt(
  'Watch Armory',
  'Quartermaster',
  '#1e293b',
  '#0f172a',
  '#38bdf8',
  'armory',
);

export const ART_SHRINE = makePanelArt(
  'Lantern Shrine',
  'Sanctuary',
  '#134e4a',
  '#0f172a',
  '#2dd4bf',
  'shrine',
);

export const ART_BELFRY_DAWN = makePanelArt(
  'Dawn Over the Belfry',
  'Victory',
  '#7c2d12',
  '#1e1b4b',
  '#fbbf24',
  'dawn',
);

export const ART_CELL = makePanelArt(
  'Guardhouse Cell',
  'Locked Down',
  '#1f2937',
  '#09090b',
  '#94a3b8',
  'cell',
);

export const ART_ALLEY = makePanelArt(
  'Rain-Slick Alley',
  'Retreat',
  '#172554',
  '#09090b',
  '#38bdf8',
  'alley',
);
