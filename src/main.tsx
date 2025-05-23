import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import '@mantine/core/styles.css';
import '@mantine/code-highlight/styles.css';
import '@mantine/charts/styles.css';
import '@mantine/dates/styles.css';
import { createBrowserRouter, createRoutesFromElements, Route, RouterProvider } from 'react-router-dom';
import { IdentityKitProvider } from '@nfid/identitykit/react';
import { MantineProvider } from '@mantine/core';
import { mantineTheme } from './theme.ts';
import { IdentityKitAuthType } from "@nfid/identitykit"
import { HttpAgent, Actor } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { idlFactory as indexCanisterIDL } from './declarations/indexCanister/index.js';
import { notifications } from '@mantine/notifications';

const INDEX_CANISTER_ID = "q3itu-vqaaa-aaaag-qngyq-cai";

export const ACTIONS_CANISTER_ID = "3c7h6-daaaa-aaaag-qnhhq-cai";

const derivationOrigin = "https://3qzqh-pqaaa-aaaag-qnheq-cai.icp0.io/";

interface AppProvidersProps {
  targets: string[];
  derivationOrigin: string;
  children: React.ReactNode;
}

const AppProviders: React.FC<AppProvidersProps> = ({
  targets,
  derivationOrigin,
  children,
}) => {
  return (
    <MantineProvider theme={mantineTheme} defaultColorScheme="dark">
      <IdentityKitProvider
        signerClientOptions={{ targets, derivationOrigin }}
        authType={IdentityKitAuthType.DELEGATION}
      >
        {children}
      </IdentityKitProvider>
    </MantineProvider>
  );
};

const fetchInitialCanisterIds = async (): Promise<string[]> => {
  const agent = new HttpAgent({});

  if (process.env.NODE_ENV !== "production") {
    try {
      await agent.fetchRootKey();
    } catch (err) {
      console.warn(
        "Unable to fetch root key for initial canister ID fetch. Ensure your local replica is running or this may fail.",
        err
      );
    }
  }

  const indexActor = Actor.createActor(indexCanisterIDL, {
    agent,
    canisterId: INDEX_CANISTER_ID,
  });

  try {
    const projectPrincipals = await indexActor.getProjects() as Principal[];
    const projectCanisterIds = projectPrincipals.map(p => p.toText());

    const allTargets = [INDEX_CANISTER_ID, ACTIONS_CANISTER_ID, ...projectCanisterIds];
    console.log("All target canister IDs for IdentityKitProvider:", allTargets);
    return allTargets;
  } catch (error) {
    console.error("Failed to fetch project canister IDs from index canister:", error);
    notifications.show({
      title: 'Critical Error',
      message: 'Could not fetch initial project list. The application might not work correctly. Please refresh or contact support.',
      color: 'red',
      autoClose: false,
    });
    return [INDEX_CANISTER_ID];
  }
};

(async () => {
  // 1. Wait until we have all IdentityKit targets
  const fetchedTargets = await fetchInitialCanisterIds();

  // 2. Create a single-route Data Router
  const router = createBrowserRouter(
    createRoutesFromElements(
      <Route
        path="/*"
        element={
          <AppProviders
            targets={fetchedTargets}
            derivationOrigin={derivationOrigin}
          >
            <App />
          </AppProviders>
        }
      />
    )
  );

  // 3. Tell React to render a Data-Router instead of a BrowserRouter
  ReactDOM.createRoot(
    document.getElementById('root') as HTMLElement
  ).render(
    <React.StrictMode>
      <RouterProvider router={router} />
    </React.StrictMode>
  );
})();