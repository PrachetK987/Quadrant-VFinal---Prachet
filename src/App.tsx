/**
 * src/App.tsx
 *
 * Root component of Quadrant Campus Guide.
 * Initializes:
 * - Offline campus pack ingestion on first boot
 * - Periodic background sync worker (every 60s while online)
 * - Navigation between Explore, Building Detail, Routes, Assistant, Packs, and Profile
 */

import React, { useEffect, useState } from 'react';
import { Layout, NavTab } from './components/Layout';
import { ExploreScreen } from './features/explore/ExploreScreen';
import { BuildingDetailScreen } from './features/building/BuildingDetailScreen';
import { RoutesScreen } from './features/routes/RoutesScreen';
import { AssistantScreen } from './features/assistant/AssistantScreen';
import { PackManagerScreen } from './features/packs/PackManagerScreen';
import { ProfileScreen } from './features/profile/ProfileScreen';
import { syncWorker } from './sync/syncWorker';
import { packManager } from './offline/packManager';
import { repo } from './db/repo';

export function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('explore');
  const [activeBuildingId, setActiveBuildingId] = useState<string | null>(null);
  const [initialTargetRoom, setInitialTargetRoom] = useState<string | undefined>();

  // Current session mock profile
  const [userId] = useState<string>('user-pilot-maya');
  const [userName] = useState<string>('Maya Lin (Class of 27)');

  useEffect(() => {
    // 1. Start periodic delta sync (on start, browser online, and 60s loop)
    syncWorker.startPeriodicSync();

    // 2. Check if local database has buildings. If empty, automatically install offline pack
    repo.getBuildings().then(async (buildings) => {
      if (buildings.length === 0) {
        console.log('[Quadrant] Initializing local Dexie database from campus pack v1...');
        await packManager.downloadAndInstallPack('/packs/campus-pack-v1');
      }
    });

    return () => {
      syncWorker.stopPeriodicSync();
    };
  }, []);

  const handleOpenBuilding = (buildingId: string, targetRoom?: string) => {
    setActiveBuildingId(buildingId);
    setInitialTargetRoom(targetRoom);
  };

  const handleBackToExplore = () => {
    setActiveBuildingId(null);
    setInitialTargetRoom(undefined);
  };

  return (
    <Layout
      currentTab={currentTab}
      onTabChange={tab => {
        setCurrentTab(tab);
        setActiveBuildingId(null);
        setInitialTargetRoom(undefined);
      }}
    >
      {activeBuildingId ? (
        <BuildingDetailScreen
          buildingId={activeBuildingId}
          onBack={handleBackToExplore}
          userId={userId}
          userName={userName}
          initialTargetRoom={initialTargetRoom}
        />
      ) : (
        <>
          {currentTab === 'explore' && <ExploreScreen onOpenBuilding={handleOpenBuilding} />}
          {currentTab === 'routes' && <RoutesScreen />}
          {currentTab === 'assistant' && <AssistantScreen onOpenBuilding={handleOpenBuilding} />}
          {currentTab === 'packs' && <PackManagerScreen />}
          {currentTab === 'profile' && <ProfileScreen userId={userId} userName={userName} />}
        </>
      )}
    </Layout>
  );
}

export default App;
