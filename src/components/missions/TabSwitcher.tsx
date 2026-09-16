import { useState, type ReactNode } from 'react';
import Tab from '../primitives/Tab';

/** Identifiers for the two panel views. */
export type MissionTab = 'missions' | 'event-info';

interface TabSwitcherProps {
  /** Panel content shown while the "Missions" tab is active. */
  children?: ReactNode;
  /** Notified whenever the active tab changes. */
  onChange?: (tab: MissionTab) => void;
}

/**
 * Tab row + panel switch (`ui-spec.md` §2 tabs).
 *
 * Owns the `activeTab` state; the "Event Info" panel is an intentional
 * placeholder because that content is out of scope here (`spec.md`).
 */
export default function TabSwitcher({ children, onChange }: TabSwitcherProps) {
  const [activeTab, setActiveTab] = useState<MissionTab>('missions');

  const select = (tab: MissionTab) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    onChange?.(tab);
  };

  return (
    <>
      <nav className="mb-4 flex gap-2" aria-label="Mission views">
        <Tab label="Missions" active={activeTab === 'missions'} onClick={() => select('missions')} />
        <Tab label="Event Info" active={activeTab === 'event-info'} onClick={() => select('event-info')} />
      </nav>
      {activeTab === 'missions' ? (
        children
      ) : (
        <p className="py-8 text-center text-sm text-slate-400">Event info coming soon.</p>
      )}
    </>
  );
}
