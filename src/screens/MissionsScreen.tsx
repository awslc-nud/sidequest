import AppShell from '../components/shell/AppShell';
import BackgroundDecor from '../components/shell/BackgroundDecor';
import EventHeader from '../components/shell/EventHeader';
import MainPanel from '../components/shell/MainPanel';
import MascotChestHero from '../components/hero/MascotChestHero';
import { useMissionState } from '../hooks/useMissionState';

/**
 * Top-level TechFair mission tracker screen (`ui-spec.md` §2 layout skeleton).
 *
 * Composition only: the floating panel is intentionally empty for now — the
 * progress tracker, tab switcher and mission list are wired in Phase 3–4.
 *
 * Header copy is hardcoded to the `ui-spec.md` mockup values; if the event ever
 * becomes config-driven this should read from `GET /api/config` instead.
 */
export default function MissionsScreen() {
  const { isShaking } = useMissionState();

  return (
    <AppShell>
      <BackgroundDecor />
      <EventHeader title="TechFair 2025" subtitle="Aug 28 - 29, 2025 • Main Campus" />
      <MascotChestHero isShaking={isShaking} />
      <MainPanel>
        {/* Progress tracker, tab switcher and mission list land in Phases 3–4. */}
      </MainPanel>
    </AppShell>
  );
}
