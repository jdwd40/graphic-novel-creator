import { getImageSync, registerImageSync } from './imageStore';

function encodeSvg(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg.trim())}`;
}

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export type PanelSilhouette =
  | 'guard'
  | 'brute'
  | 'bell'
  | 'bellAwakened'
  | 'tower'
  | 'armory'
  | 'shrine'
  | 'open'
  | 'wounded'
  | 'courtyard'
  | 'dawn'
  | 'cell'
  | 'alley'
  | 'unknownPlace'
  | 'unknownFoe';

type Weather = 'rain' | 'stars' | 'embers' | 'none';

interface SceneParts {
  /** Drawn behind the ground plane. */
  far: string;
  /** Drawn on top of the ground plane. */
  subject: string;
  weather: Weather;
  /** Where the accent glow sits. */
  glow?: { x: number; y: number; r: number };
}

const INK = '#07080e';
const SHADE = '#141828';
const STONE = '#1f2540';

const SKYLINE =
  'M0 236 V196 h16 v-10 h12 v10 h20 v-34 l9 -12 l9 12 v34 h24 v-16 h7 v-7 h7 v7 h7 v16 h34 v-22 h30 v22 h28 v-40 l8 -10 l8 10 v40 h22 v-14 h26 v14 h18 v-28 h7 v-8 h7 v8 h7 v28 h30 v-18 h44 V236 Z';

function tower(x: number, y: number, w: number, h: number, fill: string, stroke: string): string {
  const m = w / 5;
  const top = y - 12;
  return `
    <path d="M${x - 4} ${y} V${top} h${m + 2} v7 h${m} v-7 h${m + 4} v7 h${m} v-7 h${m + 2} V${y} Z" fill="${fill}" stroke="${stroke}" stroke-width="2" stroke-linejoin="round"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
}

function lantern(x: number, y: number, r: number, color: string): string {
  return `
    <circle cx="${x}" cy="${y}" r="${r * 4.2}" fill="${color}" opacity="0.10"/>
    <circle cx="${x}" cy="${y}" r="${r * 2.2}" fill="${color}" opacity="0.22"/>
    <circle cx="${x}" cy="${y}" r="${r}" fill="${color}"/>
    <circle cx="${x - r * 0.25}" cy="${y - r * 0.25}" r="${r * 0.4}" fill="#fff" opacity="0.75"/>`;
}

function moon(x: number, y: number, r: number): string {
  return `
    <circle cx="${x}" cy="${y}" r="${r * 1.9}" fill="#f8f1d4" opacity="0.07"/>
    <circle cx="${x}" cy="${y}" r="${r * 1.35}" fill="#f8f1d4" opacity="0.10"/>
    <circle cx="${x}" cy="${y}" r="${r}" fill="#f8f1d4"/>
    <circle cx="${x - r * 0.3}" cy="${y - r * 0.2}" r="${r * 0.16}" fill="#d9cfa6" opacity="0.7"/>
    <circle cx="${x + r * 0.25}" cy="${y + r * 0.3}" r="${r * 0.22}" fill="#d9cfa6" opacity="0.55"/>`;
}

/** Hulking hammer-wielder shared by the brute panels. */
function bruteBody(accent: string): string {
  return `
    <path d="M172 238 L178 194 H197 L199 238 Z M203 238 L205 194 H224 L230 238 Z" fill="${INK}" stroke="${accent}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M158 200 L148 130 Q200 98 252 130 L242 200 Z" fill="${SHADE}" stroke="${accent}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M166 150 Q200 136 234 150 M172 176 H228" stroke="${accent}" stroke-width="2" opacity="0.5" fill="none"/>
    <circle cx="200" cy="104" r="17" fill="${SHADE}" stroke="${accent}" stroke-width="3"/>
    <path d="M190 104 h7 M203 104 h7" stroke="${accent}" stroke-width="3" stroke-linecap="round"/>`;
}

function buildScene(silhouette: PanelSilhouette, accent: string): SceneParts {
  switch (silhouette) {
    case 'courtyard':
      return {
        weather: 'rain',
        glow: { x: 200, y: 190, r: 150 },
        far: `<path d="${SKYLINE}" fill="${SHADE}" opacity="0.7"/>`,
        subject: `
          ${tower(92, 96, 56, 140, STONE, INK)}
          ${tower(252, 96, 56, 140, STONE, INK)}
          <rect x="148" y="128" width="104" height="108" fill="${SHADE}" stroke="${INK}" stroke-width="2"/>
          <path d="M148 128 h13 v-9 h13 v9 h13 v-9 h13 v9 h13 v-9 h13 v9 h13 v-9 h13 v9" fill="${SHADE}" stroke="${INK}" stroke-width="2"/>
          <path d="M168 236 V176 Q200 136 232 176 V236 Z" fill="${INK}" stroke="${accent}" stroke-width="3"/>
          <path d="M181 164 V236 M194 153 V236 M206 153 V236 M219 164 V236 M170 188 H230 M168 206 H232 M168 222 H232" stroke="${accent}" stroke-width="2" opacity="0.55"/>
          <path d="M194 128 h12 v26 l-6 -7 l-6 7 Z" fill="${accent}" opacity="0.9"/>
          <rect x="116" y="128" width="7" height="18" rx="3" fill="${accent}" opacity="0.85"/>
          <rect x="277" y="128" width="7" height="18" rx="3" fill="${accent}" opacity="0.85"/>
          <path d="M100 170 h14 M126 196 h16 M260 182 h16 M284 210 h14 M156 150 h12 M232 204 h12" stroke="${INK}" stroke-width="2" opacity="0.7"/>
          ${lantern(158, 176, 5, '#fbbf24')}
          ${lantern(242, 176, 5, '#fbbf24')}
          <ellipse cx="200" cy="262" rx="64" ry="7" fill="${accent}" opacity="0.16"/>
          <ellipse cx="96" cy="278" rx="38" ry="5" fill="${accent}" opacity="0.10"/>
          <path d="M193 290 q7 -22 14 0 Z" fill="${INK}"/><circle cx="200" cy="266" r="6" fill="${INK}"/>`,
      };
    case 'armory':
      return {
        weather: 'none',
        glow: { x: 200, y: 120, r: 170 },
        far: `
          <path d="M0 60 H400 M0 104 H400 M0 148 H400 M0 192 H400 M40 60 V104 M130 60 V104 M220 60 V104 M310 60 V104 M85 104 V148 M175 104 V148 M265 104 V148 M355 104 V148 M40 148 V192 M130 148 V192 M220 148 V192 M310 148 V192 M85 192 V236 M175 192 V236 M265 192 V236 M355 192 V236 M85 16 V60 M175 16 V60 M265 16 V60" stroke="${INK}" stroke-width="2" opacity="0.45"/>
          <path d="M200 22 L330 236 H70 Z" fill="#fde68a" opacity="0.07"/>`,
        subject: `
          <rect x="62" y="88" width="276" height="8" rx="3" fill="#3b2a1a" stroke="${INK}" stroke-width="2"/>
          ${[104, 136, 264, 296]
            .map(
              (x, i) => `
          <rect x="${x - 2.5}" y="82" width="5" height="20" rx="2" fill="#5b3f24"/>
          <circle cx="${x}" cy="80" r="4" fill="${accent}"/>
          <rect x="${x - 13}" y="100" width="26" height="5" rx="2" fill="${accent}"/>
          <path d="M${x - 5} 105 h10 v${58 + (i % 2) * 14} l-5 12 l-5 -12 Z" fill="#dbe4f0" stroke="${INK}" stroke-width="1.5"/>
          <path d="M${x} 107 v${56 + (i % 2) * 14}" stroke="#8fa0b8" stroke-width="1.5"/>`,
            )
            .join('')}
          <circle cx="200" cy="148" r="38" fill="${STONE}" stroke="${INK}" stroke-width="3"/>
          <circle cx="200" cy="148" r="33" fill="none" stroke="${accent}" stroke-width="4"/>
          <path d="M200 115 V181 M167 148 H233" stroke="${accent}" stroke-width="2.5" opacity="0.6"/>
          <circle cx="200" cy="148" r="8" fill="${accent}"/>
          <circle cx="197" cy="145" r="3" fill="#fff" opacity="0.7"/>
          <rect x="54" y="216" width="292" height="8" rx="2" fill="#3b2a1a" stroke="${INK}" stroke-width="2"/>
          ${[96, 150, 250, 304]
            .map(
              (x) => `
          <path d="M${x - 17} 216 q0 -30 17 -30 q17 0 17 30 Z" fill="#9aa8bd" stroke="${INK}" stroke-width="2"/>
          <path d="M${x} 186 V216 M${x - 16} 204 H${x + 16}" stroke="${INK}" stroke-width="2"/>
          <path d="M${x - 10} 194 q4 -5 9 -5" stroke="#fff" stroke-width="2" opacity="0.6" fill="none"/>`,
            )
            .join('')}
          ${lantern(200, 34, 7, '#fde68a')}
          <path d="M200 0 V27" stroke="${INK}" stroke-width="2.5"/>
          <rect x="300" y="244" width="62" height="44" rx="3" fill="#3b2a1a" stroke="${INK}" stroke-width="2.5"/>
          <path d="M300 258 H362 M331 244 V288" stroke="${INK}" stroke-width="2"/>`,
      };
    case 'shrine':
      return {
        weather: 'stars',
        glow: { x: 200, y: 160, r: 140 },
        far: `
          ${moon(318, 62, 20)}
          <path d="M0 236 V180 Q60 140 120 176 Q170 150 220 178 Q290 138 400 184 V236 Z" fill="${SHADE}" opacity="0.8"/>
          <path d="M40 236 l14 -70 l14 70 Z M74 236 l11 -52 l11 52 Z M312 236 l13 -64 l13 64 Z M346 236 l15 -82 l15 82 Z" fill="${INK}" opacity="0.9"/>`,
        subject: `
          <rect x="118" y="234" width="164" height="12" rx="2" fill="${STONE}" stroke="${INK}" stroke-width="2"/>
          <rect x="132" y="222" width="136" height="12" rx="2" fill="${STONE}" stroke="${INK}" stroke-width="2"/>
          <rect x="154" y="138" width="12" height="84" fill="${STONE}" stroke="${INK}" stroke-width="2"/>
          <rect x="234" y="138" width="12" height="84" fill="${STONE}" stroke="${INK}" stroke-width="2"/>
          <rect x="140" y="130" width="120" height="9" rx="2" fill="${STONE}" stroke="${INK}" stroke-width="2"/>
          <path d="M116 132 Q132 126 200 88 Q268 126 284 132 Q270 118 200 106 Q130 118 116 132 Z" fill="${SHADE}" stroke="${accent}" stroke-width="2.5" stroke-linejoin="round"/>
          <path d="M200 88 V72" stroke="${accent}" stroke-width="3" stroke-linecap="round"/>
          <path d="M200 139 V158" stroke="${INK}" stroke-width="2"/>
          ${lantern(200, 172, 13, accent)}
          <path d="M187 172 h26 M200 159 v26" stroke="${INK}" stroke-width="1.5" opacity="0.5"/>
          ${[142, 172, 228, 258]
            .map(
              (x, i) => `
          <rect x="${x - 2}" y="${i % 3 === 0 ? 224 : 212}" width="4" height="10" fill="#f8f1d4"/>
          <ellipse cx="${x}" cy="${i % 3 === 0 ? 220 : 208}" rx="2.4" ry="4.5" fill="#fbbf24"/>`,
            )
            .join('')}
          <circle cx="96" cy="150" r="2" fill="${accent}"/><circle cx="302" cy="126" r="2.4" fill="${accent}"/>
          <circle cx="76" cy="206" r="1.8" fill="${accent}"/><circle cx="328" cy="198" r="2" fill="${accent}"/>
          <circle cx="126" cy="96" r="1.6" fill="${accent}"/><circle cx="270" cy="84" r="1.8" fill="${accent}"/>`,
      };
    case 'dawn':
      return {
        weather: 'none',
        glow: { x: 200, y: 236, r: 210 },
        far: `
          <path d="M200 236 L-20 150 V110 Z M200 236 L60 0 H110 Z M200 236 L176 0 H224 Z M200 236 L290 0 H340 Z M200 236 L420 110 V150 Z" fill="#fde68a" opacity="0.10"/>
          <circle cx="200" cy="236" r="84" fill="${accent}" opacity="0.35"/>
          <circle cx="200" cy="236" r="62" fill="#fde68a"/>
          <path d="M20 96 q26 -12 52 0 q22 -8 40 2 H18 Z M290 70 q30 -14 58 0 q20 -6 34 4 H288 Z" fill="#fecaca" opacity="0.35"/>
          <path d="${SKYLINE}" fill="#1a1030" opacity="0.92"/>`,
        subject: `
          <rect x="174" y="118" width="52" height="120" fill="${INK}" stroke="${accent}" stroke-width="2.5"/>
          <path d="M162 120 L200 54 L238 120 Z" fill="${INK}" stroke="${accent}" stroke-width="2.5" stroke-linejoin="round"/>
          <path d="M200 54 V36 M193 43 H207" stroke="${accent}" stroke-width="3" stroke-linecap="round"/>
          <path d="M186 178 V148 Q200 130 214 148 V178 Z" fill="#fde68a" opacity="0.9"/>
          <path d="M192 172 q1 -20 8 -22 q7 2 8 22 Z" fill="${INK}"/><circle cx="200" cy="174" r="3" fill="${INK}"/>
          <rect x="194" y="198" width="12" height="18" rx="6" fill="${accent}" opacity="0.6"/>
          <path d="M70 84 q7 -8 14 0 q7 -8 14 0 M300 120 q6 -7 12 0 q6 -7 12 0 M110 130 q5 -6 10 0 q5 -6 10 0" stroke="${INK}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,
      };
    case 'cell':
      return {
        weather: 'none',
        glow: { x: 200, y: 84, r: 120 },
        far: `
          <path d="M0 52 H400 M0 98 H400 M0 144 H400 M0 190 H400 M60 52 V98 M150 52 V98 M270 52 V98 M350 52 V98 M20 98 V144 M110 98 V144 M300 98 V144 M380 98 V144 M60 144 V190 M150 144 V190 M250 144 V190 M340 144 V190 M20 190 V236 M110 190 V236 M290 190 V236 M380 190 V236 M110 6 V52 M290 6 V52" stroke="${INK}" stroke-width="2.5" opacity="0.5"/>
          <rect x="164" y="48" width="72" height="64" rx="8" fill="#2a3a5e" stroke="${INK}" stroke-width="4"/>
          <circle cx="216" cy="70" r="12" fill="#f8f1d4"/>
          <path d="M182 48 V112 M200 48 V112 M218 48 V112" stroke="${INK}" stroke-width="5"/>
          <path d="M166 112 H234 L318 300 H82 Z" fill="#cbd5e1" opacity="0.10"/>`,
        subject: `
          <path d="M138 300 L176 236 M200 300 V236 M262 300 L224 236" stroke="${INK}" stroke-width="6" opacity="0.35"/>
          <rect x="30" y="112" width="74" height="126" rx="4" fill="#2a1d12" stroke="${INK}" stroke-width="3"/>
          <path d="M30 144 H104 M30 204 H104" stroke="${accent}" stroke-width="5" opacity="0.8"/>
          <rect x="52" y="124" width="30" height="12" rx="2" fill="${INK}"/>
          <path d="M60 124 V136 M67 124 V136 M74 124 V136" stroke="${accent}" stroke-width="1.5"/>
          <circle cx="92" cy="176" r="5" fill="${accent}"/>
          <rect x="262" y="198" width="104" height="10" rx="2" fill="#3b2a1a" stroke="${INK}" stroke-width="2.5"/>
          <path d="M274 208 V238 M354 208 V238" stroke="${INK}" stroke-width="6"/>
          <circle cx="330" cy="120" r="6" fill="none" stroke="${accent}" stroke-width="3"/>
          <path d="M330 126 q-10 24 -2 44 q6 14 -6 28" fill="none" stroke="${accent}" stroke-width="3.5" stroke-dasharray="7 4" stroke-linecap="round"/>
          <path d="M150 262 q14 -10 28 0 Z" fill="#9aa8bd" stroke="${INK}" stroke-width="2"/>`,
      };
    case 'alley':
      return {
        weather: 'rain',
        glow: { x: 200, y: 150, r: 110 },
        far: `
          <path d="M150 236 V150 h14 v-16 h10 v16 h18 v-34 l8 -10 l8 10 v34 h16 v-12 h12 v12 h14 V236 Z" fill="${SHADE}" opacity="0.9"/>
          <circle cx="200" cy="186" r="46" fill="${accent}" opacity="0.14"/>`,
        subject: `
          <path d="M0 6 L152 84 V238 L0 300 Z" fill="${INK}" stroke="${accent}" stroke-width="2" stroke-opacity="0.6"/>
          <path d="M400 6 L248 84 V238 L400 300 Z" fill="${INK}" stroke="${accent}" stroke-width="2" stroke-opacity="0.6"/>
          <path d="M30 96 L64 108 V146 L30 140 Z M90 116 L122 126 V156 L90 152 Z" fill="#fbbf24" opacity="0.8"/>
          <path d="M370 96 L336 108 V146 L370 140 Z" fill="#fbbf24" opacity="0.55"/>
          <path d="M282 122 L312 114 V150 L282 154 Z" fill="${accent}" opacity="0.35"/>
          <path d="M20 190 L70 200 V262 L20 282 Z" fill="${SHADE}" stroke="${accent}" stroke-width="1.5" stroke-opacity="0.5"/>
          <path d="M152 92 Q200 108 248 92" fill="none" stroke="${accent}" stroke-width="1.5" opacity="0.7"/>
          <path d="M200 100 V112" stroke="${accent}" stroke-width="2"/>
          ${lantern(200, 120, 7, '#fbbf24')}
          <path d="M152 238 L96 300 M248 238 L304 300" stroke="${accent}" stroke-width="2" opacity="0.4"/>
          <ellipse cx="204" cy="268" rx="62" ry="8" fill="${accent}" opacity="0.2"/>
          <ellipse cx="204" cy="268" rx="26" ry="3" fill="#fbbf24" opacity="0.35"/>
          <circle cx="204" cy="196" r="6" fill="${INK}" stroke="${accent}" stroke-width="1.5"/>
          <path d="M196 232 l4 -30 q4 -4 8 0 l8 14 l-6 4 l-4 -6 l2 20 l-5 0 l-2 -12 l-2 12 Z" fill="${INK}" stroke="${accent}" stroke-width="1.5" stroke-linejoin="round"/>`,
      };
    case 'guard':
      return {
        weather: 'rain',
        glow: { x: 200, y: 150, r: 130 },
        far: `
          <path d="${SKYLINE}" fill="${SHADE}" opacity="0.55"/>
          <path d="M96 236 V120 Q200 20 304 120 V236 h-26 V130 Q200 62 122 130 V236 Z" fill="${SHADE}" opacity="0.85"/>
          <path d="M150 104 V236 M176 84 V236 M200 76 V236 M224 84 V236 M250 104 V236 M124 150 H276 M122 192 H278" stroke="${INK}" stroke-width="3" opacity="0.55"/>`,
        subject: `
          <path d="M252 250 L262 46" stroke="#5b3f24" stroke-width="5" stroke-linecap="round"/>
          <path d="M262 46 l-9 26 h16 Z" fill="#dbe4f0" stroke="${INK}" stroke-width="1.5" transform="rotate(3 262 46)"/>
          <path d="M180 240 L185 190 H198 L199 240 Z M202 240 L203 190 H216 L221 240 Z" fill="${INK}" stroke="${accent}" stroke-width="2.5" stroke-linejoin="round"/>
          <path d="M172 194 L176 128 Q200 114 224 128 L228 194 Z" fill="${SHADE}" stroke="${accent}" stroke-width="3" stroke-linejoin="round"/>
          <path d="M190 128 L200 194 L210 128" fill="${accent}" opacity="0.28"/>
          <path d="M176 164 H224" stroke="${accent}" stroke-width="4"/>
          <path d="M224 134 L254 160" stroke="${SHADE}" stroke-width="13" stroke-linecap="round"/>
          <path d="M224 134 L254 160" stroke="${accent}" stroke-width="2" stroke-linecap="round" opacity="0.6"/>
          <circle cx="200" cy="104" r="16" fill="${SHADE}" stroke="${accent}" stroke-width="3"/>
          <path d="M182 104 Q184 80 200 78 Q216 80 218 104 Z" fill="#9aa8bd" stroke="${INK}" stroke-width="2"/>
          <path d="M200 84 V112" stroke="${INK}" stroke-width="3"/>
          <path d="M200 78 q10 -14 22 -8 q-10 2 -14 12" fill="${accent}"/>
          <path d="M144 136 Q164 126 184 136 V176 Q164 206 144 176 Z" fill="${STONE}" stroke="${accent}" stroke-width="3" stroke-linejoin="round"/>
          <path d="M164 142 V190 M150 160 H178" stroke="${accent}" stroke-width="3" opacity="0.8"/>`,
      };
    case 'brute':
      return {
        weather: 'embers',
        glow: { x: 210, y: 130, r: 140 },
        far: `
          <path d="${SKYLINE}" fill="${SHADE}" opacity="0.55"/>
          <path d="M40 236 V120 h26 V236 Z M334 236 V150 l10 -12 l16 8 V236 Z" fill="${SHADE}" opacity="0.9"/>
          <path d="M34 120 h38 M40 150 h26 M40 190 h26" stroke="${INK}" stroke-width="3" opacity="0.6"/>`,
        subject: `
          <path d="M270 122 L304 50" stroke="#5b3f24" stroke-width="8" stroke-linecap="round"/>
          <rect x="274" y="20" width="60" height="38" rx="5" transform="rotate(25 304 39)" fill="#6b7890" stroke="${INK}" stroke-width="3"/>
          <rect x="280" y="26" width="48" height="8" rx="3" transform="rotate(25 304 39)" fill="#fff" opacity="0.22"/>
          ${bruteBody(accent)}
          <path d="M246 132 L280 100" stroke="${SHADE}" stroke-width="20" stroke-linecap="round"/>
          <path d="M246 132 L280 100" stroke="${accent}" stroke-width="2.5" stroke-linecap="round" opacity="0.7"/>
          <path d="M154 134 L132 180" stroke="${SHADE}" stroke-width="20" stroke-linecap="round"/>
          <path d="M154 134 L132 180" stroke="${accent}" stroke-width="2.5" stroke-linecap="round" opacity="0.7"/>
          <circle cx="130" cy="186" r="11" fill="${SHADE}" stroke="${accent}" stroke-width="2.5"/>
          <path d="M330 10 l8 -8 M344 30 l12 -4 M336 60 l10 6" stroke="${accent}" stroke-width="3" stroke-linecap="round" opacity="0.8"/>`,
      };
    case 'open':
      return {
        weather: 'embers',
        glow: { x: 280, y: 210, r: 130 },
        far: `<path d="${SKYLINE}" fill="${SHADE}" opacity="0.55"/>`,
        subject: `
          <path d="M304 236 l-30 14 M304 236 l26 20 M304 236 l-6 30 M304 236 l48 6 M304 236 l-58 2" stroke="${accent}" stroke-width="3" stroke-linecap="round"/>
          <path d="M300 208 L262 152" stroke="#5b3f24" stroke-width="8" stroke-linecap="round"/>
          <rect x="274" y="204" width="60" height="36" rx="5" fill="#6b7890" stroke="${INK}" stroke-width="3"/>
          <rect x="280" y="210" width="48" height="8" rx="3" fill="#fff" opacity="0.22"/>
          <path d="M160 238 L170 196 H190 L188 238 Z M200 238 L204 196 H224 L232 238 Z" fill="${INK}" stroke="${accent}" stroke-width="2.5" stroke-linejoin="round"/>
          <path d="M162 204 L172 134 Q214 108 254 140 L236 206 Z" fill="${SHADE}" stroke="${accent}" stroke-width="3" stroke-linejoin="round"/>
          <path d="M240 144 L266 156" stroke="${SHADE}" stroke-width="20" stroke-linecap="round"/>
          <path d="M240 144 L266 156" stroke="${accent}" stroke-width="2.5" stroke-linecap="round" opacity="0.7"/>
          <circle cx="236" cy="114" r="16" fill="${SHADE}" stroke="${accent}" stroke-width="3"/>
          <path d="M230 112 l6 4 M242 110 l5 4" stroke="${accent}" stroke-width="3" stroke-linecap="round"/>
          <circle cx="202" cy="166" r="20" fill="none" stroke="#fde047" stroke-width="3" stroke-dasharray="6 5"/>
          <path d="M202 138 V152 M202 180 V194 M174 166 H188 M216 166 H230" stroke="#fde047" stroke-width="3" stroke-linecap="round"/>
          <circle cx="202" cy="166" r="4" fill="#fde047"/>
          <path d="M106 86 l6 26 l-12 0 Z M100 120 h12 v10 h-12 Z" fill="#fde047" stroke="${INK}" stroke-width="2" transform="rotate(-12 106 108)"/>`,
      };
    case 'wounded':
      return {
        weather: 'embers',
        glow: { x: 200, y: 170, r: 130 },
        far: `<path d="${SKYLINE}" fill="${SHADE}" opacity="0.55"/>`,
        subject: `
          <path d="M268 238 L250 126" stroke="#5b3f24" stroke-width="8" stroke-linecap="round"/>
          <rect x="222" y="92" width="56" height="34" rx="5" transform="rotate(-8 250 109)" fill="#6b7890" stroke="${INK}" stroke-width="3"/>
          <path d="M150 238 L158 214 H206 L214 238 Z M214 238 L220 196 H240 L246 238 Z" fill="${INK}" stroke="${accent}" stroke-width="2.5" stroke-linejoin="round"/>
          <path d="M160 216 L170 152 Q206 132 240 154 L238 216 Z" fill="${SHADE}" stroke="${accent}" stroke-width="3" stroke-linejoin="round"/>
          <path d="M238 160 L256 176" stroke="${SHADE}" stroke-width="18" stroke-linecap="round"/>
          <path d="M166 160 L150 206" stroke="${SHADE}" stroke-width="18" stroke-linecap="round"/>
          <circle cx="196" cy="138" r="16" fill="${SHADE}" stroke="${accent}" stroke-width="3"/>
          <path d="M186 140 l7 -3 M199 137 l7 3" stroke="${accent}" stroke-width="3" stroke-linecap="round"/>
          <path d="M174 158 L232 208" stroke="#ff3b4e" stroke-width="6" stroke-linecap="round"/>
          <path d="M174 158 L232 208" stroke="#ffd0d5" stroke-width="1.5" stroke-linecap="round"/>
          <circle cx="186" cy="226" r="4" fill="#ff3b4e"/><circle cx="176" cy="246" r="3" fill="#ff3b4e"/><circle cx="204" cy="252" r="2.5" fill="#ff3b4e"/>
          <path d="M120 96 l14 14 M132 84 l6 18 M108 112 l18 6" stroke="#ff3b4e" stroke-width="3" stroke-linecap="round" opacity="0.8"/>`,
      };
    case 'bell':
    case 'bellAwakened': {
      const awake = silhouette === 'bellAwakened';
      return {
        weather: 'embers',
        glow: { x: 200, y: 120, r: awake ? 190 : 150 },
        far: `
          <path d="M0 0 H400 V14 H0 Z" fill="${INK}"/>
          <path d="M120 14 V34 M280 14 V34" stroke="${INK}" stroke-width="6"/>
          <path d="M112 34 Q126 150 84 182 H316 Q274 150 288 34 Z" fill="${SHADE}" opacity="0.85" stroke="${accent}" stroke-width="2" stroke-opacity="0.35"/>
          <path d="M100 160 H300 M118 70 H282" stroke="${accent}" stroke-width="2" opacity="0.25"/>
          ${
            awake
              ? `<circle cx="200" cy="112" r="78" fill="none" stroke="${accent}" stroke-width="4" opacity="0.55"/>
          <circle cx="200" cy="112" r="112" fill="none" stroke="${accent}" stroke-width="3" opacity="0.35"/>
          <circle cx="200" cy="112" r="150" fill="none" stroke="${accent}" stroke-width="2" opacity="0.2"/>`
              : ''
          }`,
        subject: `
          <path d="M276 244 V92" stroke="#5b3f24" stroke-width="7" stroke-linecap="round"/>
          <circle cx="276" cy="82" r="15" fill="#6b7890" stroke="${INK}" stroke-width="3"/>
          <path d="M276 62 v-8 M276 102 v8 M256 82 h-8 M296 82 h8 M262 68 l-6 -6 M290 68 l6 -6 M262 96 l-6 6 M290 96 l6 6" stroke="#6b7890" stroke-width="5" stroke-linecap="round"/>
          <path d="M136 240 Q146 152 170 134 H230 Q254 152 264 240 Z" fill="${SHADE}" stroke="${accent}" stroke-width="3" stroke-linejoin="round"/>
          <path d="M200 140 V238 M168 190 Q200 204 232 190" stroke="${accent}" stroke-width="2" opacity="0.45" fill="none"/>
          <ellipse cx="162" cy="140" rx="25" ry="14" fill="${STONE}" stroke="${accent}" stroke-width="3"/>
          <ellipse cx="238" cy="140" rx="25" ry="14" fill="${STONE}" stroke="${accent}" stroke-width="3"/>
          <path d="M252 148 L274 172" stroke="${STONE}" stroke-width="17" stroke-linecap="round"/>
          <path d="M174 128 Q176 82 200 72 Q224 82 226 128 Z" fill="${STONE}" stroke="${accent}" stroke-width="3" stroke-linejoin="round"/>
          <rect x="168" y="124" width="64" height="9" rx="4" fill="${STONE}" stroke="${accent}" stroke-width="3"/>
          <path d="M200 72 V60" stroke="${accent}" stroke-width="4" stroke-linecap="round"/>
          <ellipse cx="190" cy="106" rx="6" ry="${awake ? 4 : 2.5}" fill="${awake ? '#fff' : accent}"/>
          <ellipse cx="210" cy="106" rx="6" ry="${awake ? 4 : 2.5}" fill="${awake ? '#fff' : accent}"/>
          <ellipse cx="190" cy="106" rx="12" ry="7" fill="${accent}" opacity="0.35"/>
          <ellipse cx="210" cy="106" rx="12" ry="7" fill="${accent}" opacity="0.35"/>
          ${
            awake
              ? `<path d="M200 74 l-8 18 l10 8 l-12 20 M214 134 l-6 22 l12 14 l-8 26 l10 18 M176 150 l8 20 l-10 16 l6 22" fill="none" stroke="${accent}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
          <path d="M200 74 l-8 18 l10 8 l-12 20 M214 134 l-6 22 l12 14 l-8 26 l10 18" fill="none" stroke="#fff" stroke-width="1" opacity="0.8"/>`
              : `<path d="M150 170 q24 16 50 6 M250 176 q-20 14 -44 4" fill="none" stroke="#6b7890" stroke-width="3" stroke-dasharray="6 4"/>`
          }`,
      };
    }
    case 'tower':
      return {
        weather: 'stars',
        glow: { x: 200, y: 120, r: 170 },
        far: `
          ${moon(200, 112, 70)}
          <path d="${SKYLINE}" fill="${SHADE}" opacity="0.9"/>`,
        subject: `
          <path d="M156 240 L170 126 H230 L244 240 Z" fill="${INK}" stroke="${accent}" stroke-width="2.5" stroke-linejoin="round"/>
          <path d="M158 126 h84 v-10 h-84 Z" fill="${INK}" stroke="${accent}" stroke-width="2.5"/>
          <path d="M164 116 L200 40 L236 116 Z" fill="${INK}" stroke="${accent}" stroke-width="2.5" stroke-linejoin="round"/>
          <path d="M200 40 V20 M192 28 H208" stroke="${accent}" stroke-width="3" stroke-linecap="round"/>
          <path d="M182 190 V150 Q200 126 218 150 V190 Z" fill="#1c2340" stroke="${accent}" stroke-width="2"/>
          <path d="M188 180 q2 -28 12 -32 q10 4 12 32 Z" fill="${accent}"/>
          <path d="M192 176 q2 -20 8 -24" fill="none" stroke="#fff" stroke-width="2" opacity="0.6"/>
          <circle cx="200" cy="184" r="4.5" fill="${accent}"/>
          <rect x="195" y="206" width="10" height="20" rx="5" fill="${accent}" opacity="0.55"/>
          <path d="M92 76 q7 -8 14 0 q7 -8 14 0 M286 58 q6 -7 12 0 q6 -7 12 0 M300 104 q5 -6 10 0 q5 -6 10 0" stroke="${INK}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
          <path d="M0 262 Q100 244 200 258 T400 250 V300 H0 Z" fill="${INK}" opacity="0.6"/>`,
      };
    case 'unknownFoe':
      return {
        weather: 'embers',
        glow: { x: 200, y: 140, r: 140 },
        far: `<path d="${SKYLINE}" fill="${SHADE}" opacity="0.6"/>`,
        subject: `
          <path d="M130 240 Q134 150 164 128 Q200 106 236 128 Q266 150 270 240 Z" fill="${INK}" stroke="${accent}" stroke-width="3" stroke-linejoin="round"/>
          <path d="M168 132 Q170 84 200 76 Q230 84 232 132 Q200 150 168 132 Z" fill="${SHADE}" stroke="${accent}" stroke-width="3" stroke-linejoin="round"/>
          <path d="M184 112 l12 4 M216 112 l-12 4" stroke="${accent}" stroke-width="4" stroke-linecap="round"/>
          <ellipse cx="189" cy="114" rx="11" ry="6" fill="${accent}" opacity="0.3"/>
          <ellipse cx="211" cy="114" rx="11" ry="6" fill="${accent}" opacity="0.3"/>
          <path d="M150 190 q50 24 100 0" fill="none" stroke="${accent}" stroke-width="2" opacity="0.4"/>`,
      };
    case 'unknownPlace':
      return {
        weather: 'stars',
        glow: { x: 200, y: 200, r: 170 },
        far: `
          ${moon(300, 70, 22)}
          <path d="M0 236 V186 Q70 130 140 180 Q200 140 262 176 Q330 132 400 178 V236 Z" fill="${SHADE}" opacity="0.85"/>
          <path d="M0 236 V210 Q90 176 190 212 Q290 186 400 214 V236 Z" fill="${INK}" opacity="0.8"/>`,
        subject: `
          <path d="M170 300 Q186 250 198 238 H206 Q224 256 250 300 Z" fill="${accent}" opacity="0.22"/>
          <path d="M186 238 V214 h-34 l-10 -9 l10 -9 h34 v-8 h8 v8 h30 l10 9 l-10 9 h-30 v24 Z" fill="${INK}" stroke="${accent}" stroke-width="2.5" stroke-linejoin="round"/>
          <path d="M40 236 l12 -58 l12 58 Z M330 236 l14 -70 l14 70 Z" fill="${INK}"/>`,
      };
  }
}

function weatherLayer(weather: Weather, accent: string): string {
  if (weather === 'rain') {
    const drops: string[] = [];
    for (let i = 0; i < 34; i += 1) {
      const x = (i * 53 + 17) % 420;
      const y = (i * 89 + 31) % 280;
      const len = 14 + (i % 4) * 5;
      drops.push(`M${x} ${y} l-${(len * 0.3).toFixed(1)} ${len}`);
    }
    return `<path d="${drops.join(' ')}" stroke="#cfe4ff" stroke-width="1.6" stroke-linecap="round" opacity="0.38"/>`;
  }
  if (weather === 'stars') {
    const stars: string[] = [];
    for (let i = 0; i < 26; i += 1) {
      const x = (i * 97 + 23) % 400;
      const y = (i * 41 + 9) % 150;
      stars.push(`<circle cx="${x}" cy="${y}" r="${i % 5 === 0 ? 1.8 : 1}" fill="#fff" opacity="${i % 3 === 0 ? 0.9 : 0.5}"/>`);
    }
    return stars.join('');
  }
  if (weather === 'embers') {
    const embers: string[] = [];
    for (let i = 0; i < 16; i += 1) {
      const x = (i * 71 + 29) % 400;
      const y = (i * 59 + 13) % 230;
      embers.push(`<circle cx="${x}" cy="${y}" r="${1.2 + (i % 3) * 0.7}" fill="${accent}" opacity="${0.35 + (i % 4) * 0.15}"/>`);
    }
    return embers.join('');
  }
  return '';
}

/**
 * Builds a 4:3 placeholder comic panel: layered night scene, accent rim-light,
 * halftone shading, and a caption tag naming what the final art should show.
 * Everything important stays inside the centre 16:9 band so crops stay readable.
 */
export function makePanelArt(
  title: string,
  subtitle: string,
  bgTop: string,
  bgBottom: string,
  accent: string,
  silhouette: PanelSilhouette,
  options: { label?: boolean } = {},
): string {
  const scene = buildScene(silhouette, accent);
  const glow = scene.glow ?? { x: 200, y: 150, r: 150 };
  const caps = esc(title.toUpperCase());
  const sub = esc(subtitle.toUpperCase());
  // A quiet corner tag: enough to say what the final art should show without
  // competing with the page's own title.
  const tagText = subtitle ? `${caps}  /  ${sub}` : caps;
  const tagChars = title.length + (subtitle ? subtitle.length + 5 : 0);
  const tagWidth = Math.round(tagChars * 6.3 + 16);
  const label =
    options.label === false
      ? ''
      : `
      <g transform="translate(12 46)">
        <rect width="${tagWidth}" height="18" rx="4" fill="${INK}" fill-opacity="0.78" stroke="${accent}" stroke-opacity="0.7" stroke-width="1.2"/>
        <text x="8" y="12.6" fill="${accent}" font-family="system-ui, sans-serif" font-size="9.5" font-weight="700" textLength="${tagWidth - 16}" lengthAdjust="spacingAndGlyphs" xml:space="preserve">${tagText}</text>
      </g>`;

  return encodeSvg(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="800" height="600" role="img" aria-label="${esc(title)}">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${bgTop}"/>
          <stop offset="100%" stop-color="${bgBottom}"/>
        </linearGradient>
        <radialGradient id="glow" gradientUnits="userSpaceOnUse" cx="${glow.x}" cy="${glow.y}" r="${glow.r}">
          <stop offset="0%" stop-color="${accent}" stop-opacity="0.55"/>
          <stop offset="55%" stop-color="${accent}" stop-opacity="0.14"/>
          <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#10131f"/>
          <stop offset="100%" stop-color="#05060a"/>
        </linearGradient>
        <radialGradient id="vig" cx="50%" cy="48%" r="72%">
          <stop offset="55%" stop-color="#000" stop-opacity="0"/>
          <stop offset="100%" stop-color="#000" stop-opacity="0.72"/>
        </radialGradient>
        <pattern id="dots" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(28)">
          <circle cx="3.5" cy="3.5" r="1.5" fill="#fff"/>
        </pattern>
        <linearGradient id="dotfade" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#fff" stop-opacity="0"/>
          <stop offset="55%" stop-color="#fff" stop-opacity="0.15"/>
          <stop offset="100%" stop-color="#fff" stop-opacity="1"/>
        </linearGradient>
        <mask id="dotmask"><rect width="400" height="300" fill="url(#dotfade)"/></mask>
      </defs>
      <rect width="400" height="300" fill="url(#sky)"/>
      <rect width="400" height="300" fill="url(#glow)"/>
      ${scene.weather === 'stars' ? weatherLayer('stars', accent) : ''}
      ${scene.far}
      <path d="M0 236 H400 V300 H0 Z" fill="url(#ground)"/>
      <path d="M0 236 H400" stroke="${accent}" stroke-width="1.5" opacity="0.4"/>
      ${scene.subject}
      <rect width="400" height="300" fill="url(#dots)" mask="url(#dotmask)" opacity="0.13"/>
      ${scene.weather === 'rain' || scene.weather === 'embers' ? weatherLayer(scene.weather, accent) : ''}
      <rect width="400" height="300" fill="url(#vig)"/>
      ${label}
    </svg>
  `);
}

export const ART_GATEHOUSE = makePanelArt('Gatehouse Guard', 'Brawler', '#2b3550', '#0d101b', '#f0b03a', 'guard');

export const ART_BRUTE = makePanelArt('Hammer Brute', 'Tough', '#4a2228', '#140a0d', '#ff8a3d', 'brute');

export const ART_BRUTE_OPEN = makePanelArt('Hammer Stuck', 'Opening', '#4d2a08', '#161008', '#fbbf24', 'open');

export const ART_BRUTE_WOUNDED = makePanelArt('Hammer Brute', 'Staggering', '#4f0d12', '#12080a', '#ff5d6c', 'wounded');

export const ART_BELLWARDEN = makePanelArt('Iron Bellwarden', 'Boss', '#2a2466', '#08070f', '#b57bff', 'bell');

export const ART_BELLWARDEN_P2 = makePanelArt('Bellwarden Awakened', 'Phase II', '#4a0b55', '#0b0510', '#ff4d7d', 'bellAwakened');

export const ART_COURTYARD = makePanelArt('The Courtyard Gate', 'Rainy Approach', '#24324d', '#070a12', '#6cb0ff', 'courtyard');

export const ART_ARMORY = makePanelArt('Watch Armory', 'Quartermaster', '#2b3350', '#10131f', '#4cc3ff', 'armory');

export const ART_SHRINE = makePanelArt('Lantern Shrine', 'Sanctuary', '#0f4a48', '#090d18', '#3fe0c5', 'shrine');

export const ART_BELFRY_DAWN = makePanelArt('Dawn Over the Belfry', 'Victory', '#2a1d5c', '#d9581c', '#ffc53d', 'dawn');

export const ART_CELL = makePanelArt('Guardhouse Cell', 'Locked Down', '#262c3d', '#0a0b12', '#a9b7cc', 'cell');

export const ART_ALLEY = makePanelArt('Rain-Slick Alley', 'Retreat', '#1a2a5e', '#06070d', '#4cc3ff', 'alley');

export type ItemIconShape = 'sword' | 'coat' | 'steel' | 'mail' | 'charm' | 'pouch';

/** Square inventory tile: lit backdrop, rarity ring in the accent colour, glossy glyph. */
export function makeItemIcon(label: string, accent: string, shape: ItemIconShape): string {
  const sword = (blade: string, edge: string) => `
    <g transform="rotate(45 48 48)">
      <path d="M43.5 14 L48 4 L52.5 14 V58 H43.5 Z" fill="${blade}" stroke="#07080e" stroke-width="2" stroke-linejoin="round"/>
      <path d="M48 8 V56" stroke="${edge}" stroke-width="1.6"/>
      <rect x="34" y="57" width="28" height="6" rx="3" fill="${accent}" stroke="#07080e" stroke-width="2"/>
      <rect x="45" y="63" width="6" height="15" rx="2" fill="#5b3f24" stroke="#07080e" stroke-width="2"/>
      <circle cx="48" cy="82" r="5" fill="${accent}" stroke="#07080e" stroke-width="2"/>
    </g>`;
  const glyph = (() => {
    switch (shape) {
      case 'sword':
        return `${sword('#b9a58a', '#7d6a52')}
          <path d="M50 40 l3 3 M40 50 l3 3 M57 31 l2 2" stroke="#7a3d12" stroke-width="3" stroke-linecap="round" opacity="0.8"/>`;
      case 'steel':
        return `${sword('#eef4fb', '#9fb3cc')}
          <path d="M70 16 l2.5 6 l6 2.5 l-6 2.5 l-2.5 6 l-2.5 -6 l-6 -2.5 l6 -2.5 Z" fill="#fff"/>`;
      case 'coat':
        return `
          <path d="M26 30 L40 20 Q48 26 56 20 L70 30 L78 50 L66 55 L64 80 H32 L30 55 L18 50 Z" fill="#7a4a22" stroke="#07080e" stroke-width="2.5" stroke-linejoin="round"/>
          <path d="M48 26 V80 M36 42 l8 8 M36 58 l8 8 M52 50 l8 -8 M52 66 l8 -8" stroke="${accent}" stroke-width="2" opacity="0.85"/>
          <path d="M40 20 Q48 32 56 20" fill="none" stroke="#07080e" stroke-width="2.5"/>
          <path d="M26 34 l8 -6" stroke="#fff" stroke-width="2" opacity="0.4" stroke-linecap="round"/>`;
      case 'mail':
        return `
          <path d="M24 28 L40 18 Q48 24 56 18 L72 28 L80 48 L68 54 L66 80 H30 L28 54 L16 48 Z" fill="#8c9bb3" stroke="#07080e" stroke-width="2.5" stroke-linejoin="round"/>
          <path d="M32 36 q4 5 8 0 q4 5 8 0 q4 5 8 0 q4 5 8 0 M30 46 q4 5 8 0 q4 5 8 0 q4 5 8 0 q4 5 8 0 q2 3 4 2 M32 56 q4 5 8 0 q4 5 8 0 q4 5 8 0 q4 5 8 0 M32 66 q4 5 8 0 q4 5 8 0 q4 5 8 0 q4 5 8 0" fill="none" stroke="#07080e" stroke-width="1.6" opacity="0.7"/>
          <path d="M40 18 Q48 30 56 18" fill="none" stroke="#07080e" stroke-width="2.5"/>
          <path d="M24 32 l9 -6" stroke="#fff" stroke-width="2.4" opacity="0.6" stroke-linecap="round"/>`;
      case 'charm':
        return `
          <path d="M34 18 Q48 2 62 18" fill="none" stroke="#c9a15a" stroke-width="2.5" stroke-dasharray="4 3"/>
          <path d="M48 16 V28" stroke="#c9a15a" stroke-width="3"/>
          <path d="M30 70 Q34 34 48 28 Q62 34 66 70 Z" fill="${accent}" stroke="#07080e" stroke-width="2.5" stroke-linejoin="round"/>
          <rect x="26" y="68" width="44" height="7" rx="3.5" fill="${accent}" stroke="#07080e" stroke-width="2.5"/>
          <circle cx="48" cy="81" r="5" fill="#fde68a" stroke="#07080e" stroke-width="2"/>
          <path d="M38 62 Q39 42 46 36" fill="none" stroke="#fff" stroke-width="3" opacity="0.55" stroke-linecap="round"/>
          <path d="M74 24 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2 Z" fill="#fff"/>`;
      case 'pouch':
        return `
          <path d="M36 34 Q48 24 60 34 Q78 52 72 72 Q60 84 48 84 Q36 84 24 72 Q18 52 36 34 Z" fill="#7a4a22" stroke="#07080e" stroke-width="2.5" stroke-linejoin="round"/>
          <path d="M34 34 Q48 42 62 34 L58 22 Q48 28 38 22 Z" fill="#5b3518" stroke="#07080e" stroke-width="2.5" stroke-linejoin="round"/>
          <path d="M36 36 H60" stroke="${accent}" stroke-width="3.5" stroke-linecap="round"/>
          <circle cx="48" cy="60" r="7" fill="none" stroke="${accent}" stroke-width="2.5"/>
          <path d="M30 56 Q32 46 38 42" fill="none" stroke="#fff" stroke-width="2.5" opacity="0.35" stroke-linecap="round"/>`;
    }
  })();

  return encodeSvg(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="192" height="192" role="img" aria-label="${esc(label)}">
      <defs>
        <radialGradient id="tile" cx="50%" cy="38%" r="75%">
          <stop offset="0%" stop-color="#2c3558"/>
          <stop offset="100%" stop-color="#0a0c16"/>
        </radialGradient>
        <radialGradient id="halo" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="${accent}" stop-opacity="0.5"/>
          <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
        </radialGradient>
        <pattern id="d" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
          <circle cx="3" cy="3" r="1.1" fill="#fff"/>
        </pattern>
      </defs>
      <rect width="96" height="96" rx="14" fill="url(#tile)"/>
      <rect width="96" height="96" rx="14" fill="url(#d)" opacity="0.05"/>
      <circle cx="48" cy="48" r="40" fill="url(#halo)"/>
      ${glyph}
      <rect x="2.5" y="2.5" width="91" height="91" rx="12" fill="none" stroke="${accent}" stroke-width="3" opacity="0.9"/>
      <path d="M12 6 H40" stroke="#fff" stroke-width="2" opacity="0.35" stroke-linecap="round"/>
    </svg>
  `);
}

export const ART_ITEM_RUSTY_SWORD = makeItemIcon('Rusty Sword', '#d97706', 'sword');
export const ART_ITEM_PADDED_COAT = makeItemIcon('Padded Coat', '#d08a3c', 'coat');
export const ART_ITEM_STEEL_SWORD = makeItemIcon('Steel Sword', '#38bdf8', 'steel');
export const ART_ITEM_MAIL_HAUBERK = makeItemIcon('Mail', '#a9b7cc', 'mail');
export const ART_ITEM_BELL_CHARM = makeItemIcon('Bell-Clapper Charm', '#c084fc', 'charm');

export const ART_COVER = makePanelArt(
  'The Iron Bell',
  'An Illustrated Gamebook',
  '#2a2466',
  '#090d16',
  '#f5b83d',
  'tower',
  { label: false },
);

export const ART_PLAYER_PORTRAIT = encodeSvg(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="192" height="192" role="img" aria-label="Player Portrait">
    <defs>
      <radialGradient id="bg" cx="50%" cy="35%" r="80%">
        <stop offset="0%" stop-color="#35508a"/>
        <stop offset="100%" stop-color="#0b0f1e"/>
      </radialGradient>
      <pattern id="d" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
        <circle cx="3" cy="3" r="1.1" fill="#fff"/>
      </pattern>
    </defs>
    <rect width="96" height="96" fill="url(#bg)"/>
    <rect width="96" height="96" fill="url(#d)" opacity="0.06"/>
    <path d="M8 96 Q12 66 34 60 H62 Q84 66 88 96 Z" fill="#141828" stroke="#07080e" stroke-width="2.5"/>
    <path d="M30 62 Q48 78 66 62 L62 74 Q48 84 34 74 Z" fill="#f5b83d" stroke="#07080e" stroke-width="2"/>
    <path d="M26 54 Q22 18 48 12 Q74 18 70 54 Q66 66 48 68 Q30 66 26 54 Z" fill="#1f2540" stroke="#07080e" stroke-width="2.5"/>
    <path d="M34 50 Q32 28 48 24 Q64 28 62 50 Q58 60 48 61 Q38 60 34 50 Z" fill="#0a0c16"/>
    <path d="M38 44 l8 2 M58 44 l-8 2" stroke="#6cb0ff" stroke-width="3" stroke-linecap="round"/>
    <path d="M30 28 Q40 16 52 15" fill="none" stroke="#fff" stroke-width="2.5" opacity="0.3" stroke-linecap="round"/>
  </svg>
`);

function hashText(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const FALLBACK_PALETTES: ReadonlyArray<readonly [string, string, string]> = [
  ['#24324d', '#070a12', '#6cb0ff'],
  ['#2a2466', '#08070f', '#b57bff'],
  ['#0f4a48', '#090d18', '#3fe0c5'],
  ['#4a2228', '#140a0d', '#ff8a3d'],
  ['#3d2f0c', '#0f0c06', '#f5b83d'],
  ['#4a0b3c', '#0b0510', '#ff6fa8'],
];

const fallbackCache = new Map<string, string>();

/**
 * Stand-in art for nodes, foes, and items a creator has not illustrated yet.
 * The palette is picked from the name so each un-illustrated thing still looks distinct.
 */
export function makeFallbackArt(name: string, kind: 'place' | 'foe' | 'item'): string {
  const key = `${kind}:${name}`;
  const cached = fallbackCache.get(key);
  if (cached) return cached;
  const [top, bottom, accent] = FALLBACK_PALETTES[hashText(name) % FALLBACK_PALETTES.length];
  const art =
    kind === 'item'
      ? makeItemIcon(name, accent, 'pouch')
      : makePanelArt(
          name,
          'Art to come',
          top,
          bottom,
          accent,
          kind === 'foe' ? 'unknownFoe' : 'unknownPlace',
          { label: kind === 'foe' },
        );
  fallbackCache.set(key, art);
  return art;
}

export const SEED_IMAGE_IDS = {
  cover: 'img_seed_cover',
  playerPortrait: 'img_seed_player_portrait',
  courtyard: 'img_seed_courtyard',
  armory: 'img_seed_armory',
  shrine: 'img_seed_shrine',
  belfryDawn: 'img_seed_belfry_dawn',
  cell: 'img_seed_cell',
  alley: 'img_seed_alley',
  gatehouse: 'img_seed_gatehouse',
  brute: 'img_seed_brute',
  bruteOpen: 'img_seed_brute_open',
  bruteWounded: 'img_seed_brute_wounded',
  bellwarden: 'img_seed_bellwarden',
  bellwardenP2: 'img_seed_bellwarden_p2',
  itemRustySword: 'img_seed_item_rusty_sword',
  itemPaddedCoat: 'img_seed_item_padded_coat',
  itemSteelSword: 'img_seed_item_steel_sword',
  itemMailHauberk: 'img_seed_item_mail_hauberk',
  itemBellCharm: 'img_seed_item_bell_charm',
} as const;

const SEED_ART_ENTRIES: ReadonlyArray<{ id: string; name: string; dataUrl: string }> = [
  { id: SEED_IMAGE_IDS.cover, name: 'The Iron Bell Cover.svg', dataUrl: ART_COVER },
  { id: SEED_IMAGE_IDS.playerPortrait, name: 'Traveller Portrait.svg', dataUrl: ART_PLAYER_PORTRAIT },
  { id: SEED_IMAGE_IDS.courtyard, name: 'The Courtyard Gate.svg', dataUrl: ART_COURTYARD },
  { id: SEED_IMAGE_IDS.armory, name: 'Watch Armory.svg', dataUrl: ART_ARMORY },
  { id: SEED_IMAGE_IDS.shrine, name: 'Lantern Shrine.svg', dataUrl: ART_SHRINE },
  { id: SEED_IMAGE_IDS.belfryDawn, name: 'Dawn Over the Belfry.svg', dataUrl: ART_BELFRY_DAWN },
  { id: SEED_IMAGE_IDS.cell, name: 'Guardhouse Cell.svg', dataUrl: ART_CELL },
  { id: SEED_IMAGE_IDS.alley, name: 'Rain-Slick Alley.svg', dataUrl: ART_ALLEY },
  { id: SEED_IMAGE_IDS.gatehouse, name: 'Gatehouse Guard.svg', dataUrl: ART_GATEHOUSE },
  { id: SEED_IMAGE_IDS.brute, name: 'Hammer Brute.svg', dataUrl: ART_BRUTE },
  { id: SEED_IMAGE_IDS.bruteOpen, name: 'Hammer Brute Open.svg', dataUrl: ART_BRUTE_OPEN },
  { id: SEED_IMAGE_IDS.bruteWounded, name: 'Hammer Brute Wounded.svg', dataUrl: ART_BRUTE_WOUNDED },
  { id: SEED_IMAGE_IDS.bellwarden, name: 'Iron Bellwarden.svg', dataUrl: ART_BELLWARDEN },
  { id: SEED_IMAGE_IDS.bellwardenP2, name: 'Bellwarden Awakened.svg', dataUrl: ART_BELLWARDEN_P2 },
  { id: SEED_IMAGE_IDS.itemRustySword, name: 'Rusty Sword.svg', dataUrl: ART_ITEM_RUSTY_SWORD },
  { id: SEED_IMAGE_IDS.itemPaddedCoat, name: 'Padded Coat.svg', dataUrl: ART_ITEM_PADDED_COAT },
  { id: SEED_IMAGE_IDS.itemSteelSword, name: 'Steel Sword.svg', dataUrl: ART_ITEM_STEEL_SWORD },
  { id: SEED_IMAGE_IDS.itemMailHauberk, name: 'Mail Hauberk.svg', dataUrl: ART_ITEM_MAIL_HAUBERK },
  { id: SEED_IMAGE_IDS.itemBellCharm, name: 'Bell-Clapper Charm.svg', dataUrl: ART_ITEM_BELL_CHARM },
];

export function ensureSeedArtworkRegistered(): void {
  for (const entry of SEED_ART_ENTRIES) {
    // Re-register when the bundled art changes so stale copies in IndexedDB are replaced.
    if (getImageSync(entry.id)?.dataUrl !== entry.dataUrl) {
      registerImageSync({
        id: entry.id,
        storyId: 'iron-bell',
        name: entry.name,
        mimeType: 'image/svg+xml',
        dataUrl: entry.dataUrl,
        createdAt: 1,
      });
    }
  }
}
