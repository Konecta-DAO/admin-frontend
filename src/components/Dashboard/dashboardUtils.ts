import { Actor, ActorSubclass, Agent } from '@dfinity/agent';
import type { UserAnalyticsRecord } from '../../declarations/projectCanister/test_backend.did.js'; // Adjust path

// Re-export or define createActorUtil if it's not easily accessible
// Assuming it's similar to the one in settingsUtils.ts
export const createActorUtil = async (
    canisterId: string,
    idl: any, // Use 'any' or a more specific IDL type if available
    agentInstance: Agent
): Promise<ActorSubclass> => {
    if (!agentInstance) {
        console.error("Attempted to create actor without an agent.");
        throw new Error("Agent is undefined. Cannot create actor.");
    }
    // In local development, agent.fetchRootKey() is often needed
    if (process.env.NODE_ENV !== "production") {
        try {
            await agentInstance.fetchRootKey();
        } catch (err) {
            console.warn(
                "Unable to fetch root key. Ensure your local replica is running.",
                err
            );
        }
    }
    return Actor.createActor(idl, {
        agent: agentInstance,
        canisterId,
    });
};


export interface TimeSeriesDataPoint {
    date: string; // YYYY-MM-DD
    value: number;
}

const getTimeBoundary = (days: number, baseDate: Date = new Date()): number => {
    const date = new Date(baseDate);
    date.setDate(date.getDate() - days);
    date.setHours(0, 0, 0, 0);
    return date.getTime(); // Milliseconds
};

const bigIntToDate = (nanosecondsBigInt: bigint): Date => {
    return new Date(Number(nanosecondsBigInt / 1_000_000n)); // Convert nanoseconds to milliseconds
};

const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
};

export const getUniqueActiveUsersInPeriod = (
    userData: UserAnalyticsRecord[],
    startDate: Date,
    endDate: Date
): Set<string> => {
    const activeUsers = new Set<string>();
    userData.forEach(user => {
        for (const entry of user.progress_entries) {
            const activityDate = bigIntToDate(entry.last_active_time);
            if (activityDate >= startDate && activityDate <= endDate) {
                activeUsers.add(user.user_uuid);
                break; // Count user once if active on any mission in period
            }
        }
    });
    return activeUsers;
};

const getDateKey = (date: Date): string => date.toISOString().split('T')[0];

export const processActivityData = (
    userRecords: UserAnalyticsRecord[],
    // `days` is now fallback if absoluteRangeStart/End are not provided
    days: number,
    type: 'dau' | 'newUsers' | 'completions',
    absoluteRangeStart?: Date | null,
    absoluteRangeEnd?: Date | null
): TimeSeriesDataPoint[] => {
    const activityMap = new Map<string, number>();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let rangeStartDate: Date;
    let rangeEndDate: Date;

    if (absoluteRangeStart && absoluteRangeEnd) {
        rangeStartDate = new Date(absoluteRangeStart);
        rangeStartDate.setHours(0, 0, 0, 0);
        rangeEndDate = new Date(absoluteRangeEnd);
        rangeEndDate.setHours(0, 0, 0, 0);
    } else {
        rangeEndDate = new Date(today); // Inclusive of today
        rangeStartDate = new Date(today);
        rangeStartDate.setDate(today.getDate() - (days - 1)); // e.g. for 7 days, today - 6 days
    }

    // Pre-populate map with all dates in the range to ensure continuous data for charts
    for (let d = new Date(rangeStartDate); d <= rangeEndDate; d.setDate(d.getDate() + 1)) {
        activityMap.set(getDateKey(d), 0);
    }

    userRecords.forEach(user => {
        const firstSeenTimeMs = user.first_seen_time_approx ? Number(user.first_seen_time_approx / 1_000_000n) : null;

        if (type === 'newUsers' && firstSeenTimeMs) {
            const firstSeenDate = new Date(firstSeenTimeMs);
            firstSeenDate.setHours(0, 0, 0, 0); // Normalize
            if (firstSeenDate >= rangeStartDate && firstSeenDate <= rangeEndDate) {
                const dateKey = getDateKey(firstSeenDate);
                if (activityMap.has(dateKey)) { // Ensure it's within our desired pre-populated range
                    activityMap.set(dateKey, (activityMap.get(dateKey) || 0) + 1);
                }
            }
        } else if (type === 'dau' || type === 'completions') {
            const uniqueDaysForUserActivity = new Set<string>(); // For DAU calculation
            const uniqueCompletionsForUserPerDay = new Map<string, Set<bigint>>(); // For completions: date -> Set of mission_ids

            user.progress_entries.forEach(entry => {
                const activityTimeMs = Number(entry.last_active_time / 1_000_000n);
                const activityDate = new Date(activityTimeMs);
                activityDate.setHours(0, 0, 0, 0); // Normalize

                if (activityDate >= rangeStartDate && activityDate <= rangeEndDate) {
                    const dateKey = getDateKey(activityDate);
                    if (activityMap.has(dateKey)) { // Ensure it's within our desired range
                        if (type === 'dau') {
                            uniqueDaysForUserActivity.add(dateKey);
                        } else if (type === 'completions' && entry.completion_time?.[0]) {
                            const completionTimeMs = Number(entry.completion_time[0] / 1_000_000n);
                            const completionDate = new Date(completionTimeMs);
                            completionDate.setHours(0, 0, 0, 0); // Normalize

                            if (getDateKey(completionDate) === dateKey) { // Completion happened on this specific day
                                if (!uniqueCompletionsForUserPerDay.has(dateKey)) {
                                    uniqueCompletionsForUserPerDay.set(dateKey, new Set());
                                }
                                // Assuming entry.mission_id is a bigint. This ensures one user completing the same mission multiple times on same day is counted once for that mission
                                // Or, if you want to count every completion record, remove the Set logic for mission_id.
                                // For "Mission Completions" count, it's usually fine to count each completion event.
                                // The original code just incremented. Let's stick to that for simplicity unless unique mission completions per day is needed.
                                activityMap.set(dateKey, (activityMap.get(dateKey) || 0) + 1);
                            }
                        }
                    }
                }
            });

            if (type === 'dau') {
                uniqueDaysForUserActivity.forEach(dateKey => {
                    if (activityMap.has(dateKey)) {
                        activityMap.set(dateKey, (activityMap.get(dateKey) || 0) + 1);
                    }
                });
            }
        }
    });

    return Array.from(activityMap.entries())
        .map(([date, value]) => ({ date, value }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};

export const calculateWAU = (userData: UserAnalyticsRecord[], referenceDate: Date = new Date()): number => {
    const endDate = new Date(referenceDate);
    endDate.setHours(23, 59, 59, 999);
    const startDate = new Date(referenceDate);
    startDate.setDate(startDate.getDate() - 6); // Last 7 days including today
    startDate.setHours(0, 0, 0, 0);
    return getUniqueActiveUsersInPeriod(userData, startDate, endDate).size;
};

export const calculateMAU = (userData: UserAnalyticsRecord[], referenceDate: Date = new Date()): number => {
    const endDate = new Date(referenceDate);
    endDate.setHours(23, 59, 59, 999);
    const startDate = new Date(referenceDate);
    startDate.setDate(startDate.getDate() - 29); // Last 30 days including today
    startDate.setHours(0, 0, 0, 0);
    return getUniqueActiveUsersInPeriod(userData, startDate, endDate).size;
};

export interface LifecycleData {
    newUsers: number;
    retainedUsers: number; // Users active in current AND previous period
    resurrectedUsers: number; // Active in current, NOT in previous, and NOT new
    churnedUsers: number; // Active in previous, NOT in current
    currentPeriodActiveUsers: number;
    previousPeriodActiveUsers: number;
    quickRatio?: string; // (New + Resurrected) / Churned
}

export const processLifecycleData = (
    userData: UserAnalyticsRecord[],
    currentPeriodDays: number, // e.g., 7, 30, 90 from timeSeriesRange
    referenceDate: Date = new Date()
): LifecycleData | null => {
    if (!userData || userData.length === 0) return null;

    const currentPeriodEndDate = new Date(referenceDate);
    currentPeriodEndDate.setHours(23, 59, 59, 999);
    const currentPeriodStartDate = new Date(referenceDate);
    currentPeriodStartDate.setDate(currentPeriodStartDate.getDate() - (currentPeriodDays - 1));
    currentPeriodStartDate.setHours(0, 0, 0, 0);

    const previousPeriodEndDate = new Date(currentPeriodStartDate);
    previousPeriodEndDate.setDate(previousPeriodEndDate.getDate() - 1);
    previousPeriodEndDate.setHours(23, 59, 59, 999);
    const previousPeriodStartDate = new Date(previousPeriodEndDate);
    previousPeriodStartDate.setDate(previousPeriodStartDate.getDate() - (currentPeriodDays - 1));
    previousPeriodStartDate.setHours(0, 0, 0, 0);

    const activeInCurrentPeriod = new Set<string>();
    const activeInPreviousPeriod = new Set<string>();
    const newUsersInCurrentPeriod = new Set<string>();

    userData.forEach(user => {
        const firstSeenDate = bigIntToDate(user.first_seen_time_approx);
        let userActiveInCurrent = false;
        let userActiveInPrevious = false;

        for (const entry of user.progress_entries) {
            const activityDate = bigIntToDate(entry.last_active_time);
            if (activityDate >= currentPeriodStartDate && activityDate <= currentPeriodEndDate) {
                userActiveInCurrent = true;
            }
            if (activityDate >= previousPeriodStartDate && activityDate <= previousPeriodEndDate) {
                userActiveInPrevious = true;
            }
        }

        if (userActiveInCurrent) {
            activeInCurrentPeriod.add(user.user_uuid);
            if (firstSeenDate >= currentPeriodStartDate && firstSeenDate <= currentPeriodEndDate) {
                newUsersInCurrentPeriod.add(user.user_uuid);
            }
        }
        if (userActiveInPrevious) {
            activeInPreviousPeriod.add(user.user_uuid);
        }
    });

    let newCount = 0;
    let retainedCount = 0;
    let resurrectedCount = 0;

    activeInCurrentPeriod.forEach(userId => {
        if (newUsersInCurrentPeriod.has(userId)) {
            newCount++;
        } else if (activeInPreviousPeriod.has(userId)) {
            retainedCount++;
        } else {
            // Active in current, not new, and not active in previous => resurrected
            resurrectedCount++;
        }
    });

    let churnedCount = 0;
    activeInPreviousPeriod.forEach(userId => {
        if (!activeInCurrentPeriod.has(userId)) {
            churnedCount++;
        }
    });

    const quickRatioValue = churnedCount > 0 ? ((newCount + resurrectedCount) / churnedCount).toFixed(2) : "N/A (No Churn)";
    if (churnedCount === 0 && (newCount + resurrectedCount > 0)) {
        // quickRatioValue = "∞"; // Or "Very High" / "Positive Growth"
    }


    return {
        newUsers: newCount,
        retainedUsers: retainedCount,
        resurrectedUsers: resurrectedCount,
        churnedUsers: churnedCount,
        currentPeriodActiveUsers: activeInCurrentPeriod.size,
        previousPeriodActiveUsers: activeInPreviousPeriod.size,
        quickRatio: quickRatioValue,
    };
};

export interface RetentionCohortWeek {
    cohortDateLabel: string; // e.g., "Week of YYYY-MM-DD"
    cohortStartDate: Date;
    cohortSize: number;
    retentionValues: RetentionCellValue[]; // includes percentage and user details for each cohort week
}

// Helper to get the start of the week (Monday) for a given date
const getStartOfWeek = (d: Date): Date => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    return new Date(date.setDate(diff));
};

export interface RetentionCellValue {
    percentage: number | null;
    users: string[]; // List of user UUIDs in this specific segment
}

export const processWeeklyRetentionCohorts = (
    userData: UserAnalyticsRecord[],
    numWeeksToTrack: number = 8, // Track for 8 weeks including the join week
    referenceDate: Date = new Date()
): RetentionCohortWeek[] => {
    if (!userData || userData.length === 0) return [];

    const cohortsMap: Map<string, { firstSeenDate: Date, userIds: Set<string> }> = new Map();
    const mostRecentMonday = getStartOfWeek(new Date(referenceDate)); // Ensure getStartOfWeek is defined
    mostRecentMonday.setHours(0, 0, 0, 0);

    // 1. Group users into weekly cohorts based on their first_seen_time_approx
    userData.forEach(user => {
        const firstSeenD = bigIntToDate(user.first_seen_time_approx);
        const startOfWeekForUser = getStartOfWeek(firstSeenD);
        startOfWeekForUser.setHours(0, 0, 0, 0);

        if (startOfWeekForUser > mostRecentMonday) return; // Cohort hasn't fully formed or is in the future

        const cohortKey = formatDate(startOfWeekForUser); // YYYY-MM-DD of the Monday

        if (!cohortsMap.has(cohortKey)) {
            cohortsMap.set(cohortKey, { firstSeenDate: startOfWeekForUser, userIds: new Set() });
        }
        cohortsMap.get(cohortKey)!.userIds.add(user.user_uuid);
    });

    const results: RetentionCohortWeek[] = [];

    // 2. For each cohort, calculate retention for subsequent weeks
    Array.from(cohortsMap.entries())
        .sort((a, b) => b[1].firstSeenDate.getTime() - a[1].firstSeenDate.getTime()) // Newest cohorts first
        .forEach(([cohortKey, cohortData]) => {
            const cohortStartDate = cohortData.firstSeenDate;
            const cohortSize = cohortData.userIds.size;
            const cohortUserIdsSet = cohortData.userIds; // The set of users in this cohort

            const retentionValuesCurrentCohort: RetentionCellValue[] = [];

            for (let weekIndex = 0; weekIndex < numWeeksToTrack; weekIndex++) {
                const weekStartDate = new Date(cohortStartDate);
                weekStartDate.setDate(weekStartDate.getDate() + weekIndex * 7);
                weekStartDate.setHours(0, 0, 0, 0);

                const weekEndDate = new Date(weekStartDate);
                weekEndDate.setDate(weekEndDate.getDate() + 6); // End of the week (Sunday)
                weekEndDate.setHours(23, 59, 59, 999);

                if (weekStartDate > referenceDate) { // If the start of this retention week is in the future
                    retentionValuesCurrentCohort.push({ percentage: null, users: [] });
                    continue;
                }

                const retainedUserIdsThisWeek: string[] = [];
                cohortUserIdsSet.forEach(userId => { // Iterate only over users from the original cohort
                    const userRecord = userData.find(u => u.user_uuid === userId);
                    if (userRecord) {
                        for (const entry of userRecord.progress_entries) {
                            const activityDate = bigIntToDate(entry.last_active_time);
                            if (activityDate >= weekStartDate && activityDate <= weekEndDate) {
                                retainedUserIdsThisWeek.push(userId);
                                break; // User was active in this week, no need to check other entries for this user for this week
                            }
                        }
                    }
                });

                retentionValuesCurrentCohort.push({
                    percentage: cohortSize > 0 ? (retainedUserIdsThisWeek.length / cohortSize) * 100 : 0,
                    users: retainedUserIdsThisWeek
                });
            }
            results.push({
                cohortDateLabel: `Week of ${cohortKey}`,
                cohortStartDate: cohortStartDate,
                cohortSize: cohortSize,
                // cohortUserIds: cohortUserIdsSet, // If you need the original cohort users separately
                retentionValues: retentionValuesCurrentCohort,
            });
        });

    return results;
};

// Helper to format bigint to string for display
export const formatBigInt = (value?: bigint | number | null): string => {
    if (value === undefined || value === null) return '0';
    return BigInt(value).toString();
};

export const formatOptionalBigIntTimestamp = (timestampOpt?: [] | [bigint]): string => {
    if (timestampOpt && timestampOpt.length > 0 && timestampOpt[0]) {
        try {
            return bigIntToDate(timestampOpt[0]).toLocaleDateString();
        } catch (e) {
            return "Invalid Date"
        }
    }
    return 'N/A';
}

export const formatDuration = (milliseconds: number | null | undefined): string => {
    if (milliseconds === null || milliseconds === undefined || isNaN(milliseconds) || milliseconds < 0) {
        return "N/A";
    }

    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 1) {
        return `${days} days ${hours % 24} hr`;
    } else if (days === 1) {
        return `1 day ${hours % 24} hr`;
    } else if (hours > 1) {
        return `${hours} hr ${minutes % 60} min`;
    } else if (hours === 1) {
         return `1 hr ${minutes % 60} min`;
    } else if (minutes > 0) {
        return `${minutes} min ${seconds % 60} sec`;
    } else if (seconds > 0) {
        return `${seconds} sec`;
    } else if (milliseconds > 0) {
        return "< 1 sec";
    }
    return "N/A"; // Or "0 sec" if appropriate for 0ms
};