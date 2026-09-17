import AppShell from '../components/shell/AppShell';
import BackgroundDecor from '../components/shell/BackgroundDecor';
import EventHeader from '../components/shell/EventHeader';
import MainPanel from '../components/shell/MainPanel';
import MascotChestHero from '../components/hero/MascotChestHero';
import ProgressTracker from '../components/missions/ProgressTracker';
import TabSwitcher from '../components/missions/TabSwitcher';
import MissionList from '../components/missions/MissionList';
import { useMissionState } from '../hooks/useMissionState';

/**
 * Top-level TechFair mission tracker screen (`ui-spec.md` §2 layout skeleton).
 *
 * `useMissionState` is the single source of truth for mission completion; its
 * output drives the hero animation, the progress readout and the mission list.
 *
 * Header copy is hardcoded to the `ui-spec.md` mockup values; if the event ever
 * becomes config-driven this should read from `GET /api/config` instead.
 */
export default function MissionsScreen() {
  const { missions, isShaking, shakeIntensity, isAllCompleted, completedCount, toggleMission } =
    useMissionState();

  return (
    <AppShell>
      <BackgroundDecor />
      <EventHeader title="TechFair 2025" subtitle="Aug 28 - 29, 2025 • Main Campus" />
      <MascotChestHero
        isShaking={isShaking}
        shakeIntensity={shakeIntensity}
        isAllCompleted={isAllCompleted}
      />
      <MainPanel>
        <ProgressTracker completed={completedCount} total={missions.length} />
        <TabSwitcher>
          <MissionList missions={missions} onToggle={toggleMission} />
        </TabSwitcher>
      </MainPanel>
    </AppShell>
  );
}
