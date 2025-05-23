import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { ActorSubclass } from '@dfinity/agent';
import { useAgent } from '@nfid/identitykit/react';
import { notifications } from '@mantine/notifications';
import {
    idlFactory as projectCanisterIDL,
    ProjectGlobalAnalytics,
    MissionAnalyticsSummary,
    UserAnalyticsRecord,
} from '../declarations/projectCanister/test_backend.did.js';
import { createActorUtil } from '../components/Dashboard/dashboardUtils.ts';

interface AnalyticsContextType {
    projectActor: ActorSubclass | null;
    overviewData: ProjectGlobalAnalytics | null;
    missionsAnalytics: MissionAnalyticsSummary[] | null;
    userProgressData: UserAnalyticsRecord[] | null;
    isLoadingAnalytics: boolean;
    analyticsError: string | null;
    refreshAnalytics: () => void;
}

const AnalyticsContext = createContext<AnalyticsContextType | undefined>(undefined);

export const useAnalytics = (): AnalyticsContextType => {
    const context = useContext(AnalyticsContext);
    if (!context) {
        throw new Error('useAnalytics must be used within an AnalyticsProvider');
    }
    return context;
};

interface AnalyticsProviderProps {
    children: ReactNode;
}

export const AnalyticsProvider: React.FC<AnalyticsProviderProps> = ({ children }) => {
    const { projectId } = useParams<{ projectId: string }>();
    const agent = useAgent();

    const [projectActor, setProjectActor] = useState<ActorSubclass | null>(null);
    const [overviewData, setOverviewData] = useState<ProjectGlobalAnalytics | null>(null);
    const [missionsAnalytics, setMissionsAnalytics] = useState<MissionAnalyticsSummary[] | null>(null);
    const [userProgressData, setUserProgressData] = useState<UserAnalyticsRecord[] | null>(null);
    const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(true);
    const [analyticsError, setAnalyticsError] = useState<string | null>(null);

    // Effect to create actor when projectId or agent changes
    useEffect(() => {
        if (projectId && agent) {
            setIsLoadingAnalytics(true); // Reset loading state for new project
            setAnalyticsError(null);
            setOverviewData(null);
            setMissionsAnalytics(null);
            setUserProgressData(null);

            createActorUtil(projectId, projectCanisterIDL, agent)
                .then(actor => setProjectActor(actor as ActorSubclass))
                .catch(err => {
                    console.error("AnalyticsProvider: Failed to create project actor:", err);
                    setAnalyticsError("Failed to initialize project connection.");
                    notifications.show({ title: "Error", message: "Could not connect to project services for analytics.", color: 'red' });
                    setIsLoadingAnalytics(false);
                });
        } else {
            setProjectActor(null); // Clear actor if no projectId or agent
        }
    }, [projectId, agent]);

    // Effect to fetch all analytics data when projectActor is available
    const fetchAnalyticsData = useCallback(async () => {
        if (!projectActor) return;

        setIsLoadingAnalytics(true);
        setAnalyticsError(null);
        // Optionally show a global loading notification
        // notifications.show({ id: 'loading-analytics', title: 'Loading Project Data', message: 'Fetching all analytics...', loading: true, autoClose: false });

        try {
            const [overviewResult, missionsResult, usersResult] = await Promise.allSettled([
                projectActor.get_analytics_overview(),
                projectActor.get_all_missions_analytics(),
                projectActor.get_all_user_analytics_records(),
            ]);

            if (overviewResult.status === 'fulfilled') {
                setOverviewData(overviewResult.value as ProjectGlobalAnalytics);
            } else {
                console.error("Failed to fetch overview analytics:", overviewResult.reason);
                setAnalyticsError(prev => prev ? `${prev}, Overview data failed.` : 'Overview data failed.');
                notifications.show({ title: 'Fetch Error', message: 'Could not load project overview.', color: 'red' });
            }

            if (missionsResult.status === 'fulfilled') {
                setMissionsAnalytics(missionsResult.value as MissionAnalyticsSummary[]);
            } else {
                console.error("Failed to fetch missions analytics:", missionsResult.reason);
                setAnalyticsError(prev => prev ? `${prev}, Missions data failed.` : 'Missions data failed.');
                notifications.show({ title: 'Fetch Error', message: 'Could not load missions analytics.', color: 'red' });
            }

            if (usersResult.status === 'fulfilled') {
                setUserProgressData(usersResult.value as UserAnalyticsRecord[]);
            } else {
                console.error("Failed to fetch user progress analytics:", usersResult.reason);
                setAnalyticsError(prev => prev ? `${prev}, User data failed.` : 'User data failed.');
                notifications.show({ title: 'Fetch Error', message: 'Could not load user analytics.', color: 'red' });
            }

        } catch (e: any) {
            console.error("General error fetching analytics data:", e);
            const msg = e.message || "An unexpected error occurred while fetching analytics.";
            setAnalyticsError(msg);
            notifications.show({ title: "Data Fetch Error", message: msg, color: 'red' });
        } finally {
            setIsLoadingAnalytics(false);
            // notifications.hide('loading-analytics');
            // if (!analyticsError) { // Only show if all promises didn't set an error (might be too noisy)
            //     notifications.show({ title: 'Data Loaded', message: 'Project analytics are up to date.', color: 'green', autoClose: 2000 });
            // }
        }
    }, [projectActor]);

    useEffect(() => {
        if (projectActor) {
            fetchAnalyticsData();
        }
    }, [projectActor, fetchAnalyticsData]);


    return (
        <AnalyticsContext.Provider value={{
            projectActor,
            overviewData,
            missionsAnalytics,
            userProgressData,
            isLoadingAnalytics,
            analyticsError,
            refreshAnalytics: fetchAnalyticsData 
        }}>
            {children}
        </AnalyticsContext.Provider>
    );
};