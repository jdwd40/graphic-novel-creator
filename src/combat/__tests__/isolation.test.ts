import { describe, expect, it } from 'vitest';

const combatModules = import.meta.glob('../*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

describe('src/combat isolation', () => {
  it('imports nothing from React, @xyflow/react, or storage, and never calls Math.random', () => {
    const entries = Object.entries(combatModules);
    expect(entries.length).toBeGreaterThan(0);

    for (const [file, content] of entries) {
      expect(content, `${file} must not import react`).not.toMatch(/from\s+['"]react['"]/);
      expect(content, `${file} must not import react-dom`).not.toMatch(/from\s+['"]react-dom/);
      expect(content, `${file} must not import @xyflow/react`).not.toMatch(
        /from\s+['"]@xyflow\/react['"]/,
      );
      expect(content, `${file} must not access localStorage`).not.toMatch(/localStorage/);
      expect(content, `${file} must not call Math.random`).not.toMatch(/Math\.random/);
    }
  });
});
