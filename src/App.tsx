import React, { useState, useEffect, useCallback } from 'react';
import { Center, Loader } from '@mantine/core';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { mantineTheme } from './theme.ts';
import LoginPage from './components/Login/LoginPage.tsx';
import AdminLayout from './components/AdminLayout/AdminLayout.tsx';
import DashboardPage from './components/Dashboard/DashboardPage.tsx';
import MissionsPage from './components/Missions/MissionsPage.tsx';
// import EventsPage from './components/Events/EventsPage';
import UsersPage from './components/Users/UsersPage.tsx';
import SettingsPage from './components/Settings/SettingsPage.tsx';
import GlobalSettingsPage from './components/GlobalSettings/GlobalSettingsPage.tsx';
import { notifications, Notifications } from '@mantine/notifications';
import { useAgent, useAuth, useIdentity, useIsInitializing } from "@nfid/identitykit/react";
import "@nfid/identitykit/react/styles.css";
import { Actor, ActorSubclass, Agent } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';

import { idlFactory as projectCanisterIDL, SerializedPermissions, SerializedProjectDetails } from './declarations/projectCanister/test_backend.did.js';
import { idlFactory as indexCanisterIDL } from './declarations/indexCanister/index.js';

import { IconAlertCircle } from '@tabler/icons-react';
import { AnalyticsProvider } from './contexts/AnalyticsContext.tsx';

const INDEX_CANISTER_ID = "q3itu-vqaaa-aaaag-qngyq-cai";

const createActor = async (canisterId: string, idlFactory: any, agent?: Agent): Promise<ActorSubclass> => {
  const currentAgent = agent;
  if (!currentAgent) {
    console.error("Attempted to create actor without an agent.");
    throw new Error("Agent is undefined. Cannot create actor.");
  }

  if (process.env.NODE_ENV !== "production") {
    try {
      await currentAgent.fetchRootKey();
      console.log("Root key fetched for local development agent.");
    } catch (err) {
      console.warn(
        "Unable to fetch root key. Ensure your local replica is running or this may fail.",
        err
      );
    }
  }
  return Actor.createActor(idlFactory, {
    agent: currentAgent,
    canisterId,
  });
};

const App: React.FC = () => {

  const nfidIsInitializing = useIsInitializing();
  const nfidIdentity = useIdentity();
  const {
    user: nfidUser,
    disconnect: nfidLogout,
  } = useAuth();

  const nfidIsAuthenticated = !!nfidUser;
  const agent = useAgent();

  // Application-specific authentication state (has permissions for at least one project)
  const [appIsAuthenticated, setAppIsAuthenticated] = useState(false);
  // Are we currently checking permissions?
  const [isCheckingPermissions, setIsCheckingPermissions] = useState(true); // Start true
  const [hasDoneInitialPermissionCheck, setHasDoneInitialPermissionCheck] = useState(false);
  // Map of project IDs to user's permissions for that project
  const [userProjectAccess, setUserProjectAccess] = useState<Map<string, SerializedPermissions | null>>(new Map());
  // The first project ID the user has access to, for initial navigation
  const [initialProjectId, setInitialProjectId] = useState<string | null>(null);
  const [accessibleProjectsMetadata, setAccessibleProjectsMetadata] = useState<Array<{ id: string; name: string; iconUrl?: string | null }>>([]);

  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>(() => {
    const storedColorScheme = localStorage.getItem('konecta-admin-color-scheme');
    return (storedColorScheme === 'light' || storedColorScheme === 'dark') ? storedColorScheme : 'dark';
  });

  const toggleColorScheme = (value?: 'light' | 'dark') => {
    const nextColorScheme = value || (colorScheme === 'dark' ? 'light' : 'dark');
    setColorScheme(nextColorScheme);
    localStorage.setItem('konecta-admin-color-scheme', nextColorScheme);
  };

  useEffect(() => {
    document.body.style.backgroundColor = colorScheme === 'dark'
      ? (mantineTheme.colors?.dark?.[7] || '#1A1B1E')
      : (mantineTheme.colors?.gray?.[0] || '#F8F9FA');
  }, [colorScheme]);


  // Function to check user's permissions across projects
  const checkUserPermissions = useCallback(async () => {
    if (!agent || !nfidIdentity) {
      console.warn("checkUserPermissions: Aborting - Agent or NFID Identity missing.");
      setIsCheckingPermissions(false); // Ensure loader is off if we abort early
      setHasDoneInitialPermissionCheck(true); // Mark check as "done" to prevent re-trigger
      return;
    }

    setIsCheckingPermissions(true); // Set loader ON for the duration of this function

    try {
      const indexActor = await createActor(INDEX_CANISTER_ID, indexCanisterIDL, agent);
      const projectCanisterPrincipals = await indexActor.getProjects() as Principal[];
      const projectCanisterIds = projectCanisterPrincipals.map(p => p.toText());

      if (projectCanisterIds.length === 0) {
        setAppIsAuthenticated(false);
        setUserProjectAccess(new Map());
        setAccessibleProjectsMetadata([]);
        if (nfidLogout) await nfidLogout();
      } else {
        const permissionsPromises = projectCanisterIds.map(async (canisterId: string) => {
          try {
            const projectActor = await createActor(canisterId, projectCanisterIDL, agent);
            const permissionsOpt = await projectActor.getMyAdminPermissions() as SerializedPermissions[];
            return { projectId: canisterId, permissions: permissionsOpt.length > 0 ? permissionsOpt[0] : null };
          } catch (projectError) {
            return { projectId: canisterId, permissions: null };
          }
        });

        const results = await Promise.all(permissionsPromises);

        const accessMap = new Map<string, SerializedPermissions | null>();
        let firstAccessibleProject: string | null = null;
        results.forEach(result => {
          accessMap.set(result.projectId, result.permissions);
          if (result.permissions && !firstAccessibleProject) {
            firstAccessibleProject = result.projectId;
          }
        });

        setUserProjectAccess(accessMap);

        if (firstAccessibleProject) {
          setInitialProjectId(firstAccessibleProject);
          setAppIsAuthenticated(true);

          const projectsToFetchDetailsFor = Array.from(accessMap.entries())
            .filter(([_, perms]) => perms !== null)
            .map(([projectId]) => projectId);

          if (projectsToFetchDetailsFor.length > 0) {
            const detailsPromises = projectsToFetchDetailsFor.map(async (pId) => {
              try {
                const pActor = await createActor(pId, projectCanisterIDL, agent);
                const detailsOpt = await pActor.getProjectDetails() as SerializedProjectDetails;
                return { id: pId, name: detailsOpt.name, iconUrl: detailsOpt.iconUrl?.[0] || null };
              } catch (e) {
                console.error(`checkUserPermissions: Failed to fetch details for project ${pId}`, e);
                return { id: pId, name: `Project ${pId.substring(0, 5)}... (Error)`, iconUrl: null };
              }
            });
            const fetchedDetails = await Promise.all(detailsPromises);
            setAccessibleProjectsMetadata(fetchedDetails);
          } else {
            setAccessibleProjectsMetadata([]);
          }
        } else {
          setAppIsAuthenticated(false);
          setAccessibleProjectsMetadata([]);
          notifications.show({
            title: 'Access Denied',
            message: 'You do not have administrative permissions for any projects. You will be logged out.',
            color: 'orange', icon: <IconAlertCircle />, autoClose: 7000,
          });
          if (nfidLogout) await nfidLogout();
        }
      }
    } catch (error) {
      console.error("checkUserPermissions [CRITICAL ERROR]", error);
      notifications.show({
        title: 'Error Checking Permissions',
        message: 'An unexpected error occurred while verifying your access. Please try again.',
        color: 'red',
      });
      setAppIsAuthenticated(false);
      setUserProjectAccess(new Map());
      setAccessibleProjectsMetadata([]);
    } finally {
      setIsCheckingPermissions(false);
      setHasDoneInitialPermissionCheck(true);
    }
  }, [
    agent,
    nfidIdentity,
    nfidLogout,
    setUserProjectAccess,
    setInitialProjectId,
    setAppIsAuthenticated,
    setIsCheckingPermissions,
    setHasDoneInitialPermissionCheck,
    setAccessibleProjectsMetadata,
  ]);

  // Effect to manage authentication flow and trigger permission checks
  useEffect(() => {

    if (nfidIsInitializing) {
      if (!isCheckingPermissions) setIsCheckingPermissions(true);
      return;
    }

    if (!nfidIsAuthenticated) {
      // NFID is done, but user is NOT logged in (or logged out). Reset app state.
      if (appIsAuthenticated) setAppIsAuthenticated(false);
      if (initialProjectId) setInitialProjectId(null);
      setUserProjectAccess(new Map());
      if (hasDoneInitialPermissionCheck) setHasDoneInitialPermissionCheck(false);
      if (isCheckingPermissions) setIsCheckingPermissions(false);
      return;
    }

    // --- NFID Authenticated & Initialized at this point ---

    if (!agent) {
      if (!isCheckingPermissions) setIsCheckingPermissions(true);
      return;
    }

    // --- NFID Authenticated, Initialized, AND Agent is Ready ---

    if (hasDoneInitialPermissionCheck) {
      if (isCheckingPermissions) setIsCheckingPermissions(false);
    } else {
      checkUserPermissions();
    }
  }, [
    nfidIsAuthenticated,
    nfidIsInitializing,
    agent,
    appIsAuthenticated,
    isCheckingPermissions,
    hasDoneInitialPermissionCheck,
    checkUserPermissions,
    initialProjectId,
  ]);

  const handleLogout = useCallback(async () => {
    try {
      if (nfidLogout) {
        await nfidLogout();
      }
    } catch (e) {
      console.error("handleLogout: Error during NFID logout:", e);
    } finally {
      setAppIsAuthenticated(false);
      setInitialProjectId(null);
      setUserProjectAccess(new Map());
      setIsCheckingPermissions(false);
    }
  }, [nfidLogout]);

  // ProtectedRoute component to guard routes that require authentication and permissions
  const ProtectedRouteComponent: React.FC<{ children: JSX.Element; }> = ({ children }) => {
    if (isCheckingPermissions || nfidIsInitializing) {
      return <Center style={{ height: '100vh' }}><Loader size="xl" color={colorScheme === 'dark' ? 'white' : 'blue'} /></Center>;
    }
    if (!appIsAuthenticated) {
      return <Navigate to="/login" replace />;
    }
    return children;
  };

  // Main routing structure
  // Show a global loader if NFID is initializing or permissions are being checked at the top level.
  if (nfidIsInitializing && !nfidIsAuthenticated) {
    return <Center style={{ height: '100vh' }}><Loader size="xl" color={colorScheme === 'dark' ? 'white' : 'blue'} /></Center>;
  }

  const notificationsContainer = document.getElementById('notifications-portal');

  return (
    <>
      <Notifications
        position="top-right"
        zIndex={2000}
        container={notificationsContainer}
      />
      <Routes>
        <Route
          path="/"
          element={
            isCheckingPermissions ? <Center style={{ height: '100vh' }}><Loader size="xl" color={colorScheme === 'dark' ? 'white' : 'blue'} /></Center> :
              appIsAuthenticated && initialProjectId ? (
                <Navigate to={`/${initialProjectId}/dashboard`} replace />
              ) : (
                <Navigate to="/login" replace />
              )
          }
        />
        <Route
          path="/login"
          element={
            isCheckingPermissions ? <Center style={{ height: '100vh' }}><Loader size="xl" color={colorScheme === 'dark' ? 'white' : 'blue'} /></Center> :
              appIsAuthenticated && initialProjectId ? (
                <Navigate to={`/${initialProjectId}/dashboard`} replace />
              ) : (
                <LoginPage />
              )
          }
        />
        <Route
          path="/global-settings"
          element={
            <ProtectedRouteComponent>
              <AdminLayout
                currentProjectId={initialProjectId!}
                onLogout={handleLogout}
                colorScheme={colorScheme}
                toggleColorScheme={toggleColorScheme}
                userProjectAccess={userProjectAccess}
                accessibleProjectsMetadata={accessibleProjectsMetadata}
              >
                <GlobalSettingsPage />
              </AdminLayout>
            </ProtectedRouteComponent>
          }
        />
        <Route
          path="/:projectId/*"
          element={
            <ProtectedRouteComponent>
              <AdminLayoutWrapper
                onLogout={handleLogout}
                colorScheme={colorScheme}
                toggleColorScheme={toggleColorScheme}
                userProjectAccess={userProjectAccess}
                accessibleProjectsMetadata={accessibleProjectsMetadata}
              />
            </ProtectedRouteComponent>
          }
        />
        {/* Fallback for any other unmatched route */}
        <Route
          path="*"
          element={
            isCheckingPermissions ? <Center style={{ height: '100vh' }}><Loader size="xl" color={colorScheme === 'dark' ? 'white' : 'blue'} /></Center> :
              appIsAuthenticated && initialProjectId ? (
                <Navigate to={`/${initialProjectId}/dashboard`} replace />
              ) : (
                <Navigate to="/login" replace />
              )
          }
        />
      </Routes>
    </>
  );
};

const AdminLayoutWrapper: React.FC<{
  onLogout: () => void;
  colorScheme: 'light' | 'dark';
  toggleColorScheme: (value?: 'light' | 'dark') => void;
  userProjectAccess: Map<string, SerializedPermissions | null>;
  accessibleProjectsMetadata: Array<{ id: string; name: string; iconUrl?: string | null }>;
}> = ({ onLogout, colorScheme, toggleColorScheme, userProjectAccess, accessibleProjectsMetadata }) => {
  const { projectId } = useParams<{ projectId: string }>();

  if (!projectId || !userProjectAccess.has(projectId) || userProjectAccess.get(projectId) === null) {
    console.warn(`AdminLayoutWrapper: Invalid or unauthorized projectId '${projectId}'. Redirecting.`);
    const firstAccessible = Array.from(userProjectAccess.entries()).find(([_, perms]) => perms !== null);
    if (firstAccessible) {
      return <Navigate to={`/${firstAccessible[0]}/dashboard`} replace />;
    }
    return <Navigate to="/login" replace />;
  }

  return (
    <AnalyticsProvider>
      <AdminLayout
        currentProjectId={projectId}
        onLogout={onLogout}
        colorScheme={colorScheme}
        toggleColorScheme={toggleColorScheme}
        userProjectAccess={userProjectAccess}
        accessibleProjectsMetadata={accessibleProjectsMetadata}
      >
        {/* Nested routes for the specific project */}
        <Routes>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="missions" element={<MissionsPage />} />
          <Route path="missions/:missionId" element={<MissionsPage />} />
          {/* <Route path="events" element={<EventsPage />} /> */}
          <Route path="users" element={<UsersPage />} />
          <Route path="users/:userUUID" element={<UsersPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="dashboard" replace />} /> {/* Fallback */}
        </Routes>
      </AdminLayout>
    </AnalyticsProvider>
  );
};

export default App;

