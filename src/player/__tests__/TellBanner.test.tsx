import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TellBanner } from '../TellBanner';

describe('TellBanner (#54)', () => {
  it('renders clear tells inside a high-contrast banner with distinct large intent icons', () => {
    const cases = [
      { move: 'strike' as const, caption: 'Steel whispers toward your ribs.', label: 'Intent: Quick strike' },
      { move: 'heavy' as const, caption: 'He draws back with a heavy heave!', label: 'Intent: Heavy windup' },
      { move: 'open' as const, caption: 'His guard drops cleanly open.', label: 'Intent: Enemy open' },
    ];

    for (const c of cases) {
      const { unmount } = render(
        <TellBanner caption={c.caption} move={c.move} showIcon={true} />,
      );
      const banner = screen.getByTestId('combat-tell-caption');
      expect(banner).toHaveTextContent(c.caption);
      const icon = within(banner).getByTestId('tell-intent-icon');
      expect(icon).toHaveAttribute('aria-label', c.label);
      expect(icon.querySelector('svg')).not.toBeNull();
      unmount();
    }
  });

  it('uses identical neutral styling without icons or move hints for vague tells, and hides hidden tells', () => {
    const { container, rerender } = render(
      <TellBanner caption="Something shifts in his stance." move="heavy" showIcon={false} />,
    );
    const heavyBanner = screen.getByTestId('combat-tell-caption');
    const heavyClass = heavyBanner.className;
    expect(screen.queryByTestId('tell-intent-icon')).not.toBeInTheDocument();
    expect(heavyBanner.outerHTML).not.toMatch(/heavy|strike|open/i);

    rerender(
      <TellBanner caption="Something shifts in his stance." move="open" showIcon={false} />,
    );
    const openBanner = screen.getByTestId('combat-tell-caption');
    expect(openBanner.className).toBe(heavyClass);
    expect(screen.queryByTestId('tell-intent-icon')).not.toBeInTheDocument();

    rerender(<TellBanner caption="" move="strike" showIcon={false} />);
    expect(container.firstChild).toBeNull();
  });
});
