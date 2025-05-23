import { Principal } from '@dfinity/principal';
import { SerializedGlobalUser, UserAnalyticsRecord } from '../../declarations/projectCanister/test_backend.did.js';

export interface ComprehensiveUser extends UserAnalyticsRecord {
    // Fields from UserAnalyticsRecord (project-specific analytics) are inherited.
    // user_uuid: string;
    first_seen_time_approx: bigint;
    last_seen_time: bigint;
    missions_attempted_count: bigint;
    missions_completed_count: bigint;
    // progress_entries: UserMissionProgressAnalyticsRecord[];

    // Fields from primary account lookup (Phase 1.A)
    primaryPrincipal?: Principal;
    primaryAccountType?: string;

    // Fields from Index Canister's SerializedGlobalUser (global profile)
    // We'll map these carefully.
    globalProfile?: SerializedGlobalUser; // Store the whole object, or cherry-pick
    // For simplicity here, let's assume we store it and access like user.globalProfile?.twitterHandle

    // You can also elevate commonly accessed global fields for convenience:
    twitterHandle?: string | null; // from globalProfile.twitterhandle[0]
    ocProfile?: string | null; // from globalProfile.ocProfile[0]
    discordUser?: string | null; // from globalProfile.discordUser[0]
    telegramUser?: string | null; // from globalProfile.telegramUser[0]
    nuanceUser?: string | null; // from globalProfile.nuanceUser[0]
    nnsPrincipal?: Principal | null; // from globalProfile.nnsPrincipal[0]
    pfpProgress?: string; // from globalProfile.pfpProgress
    deducedPoints?: bigint; // from globalProfile.deducedPoints (global total points)
    globalCreationTime?: bigint; // from globalProfile.creationTime (actual user registration time)
}

export type PrimaryAccountInfoTuple = [string, [Principal] | [], [string] | []];
export type GlobalUsersBatchTuple = [string, [SerializedGlobalUser] | []];

export interface MissionRecord {
    timestamp: number;              // Motoko: Int (Nanoseconds from backend, converted to milliseconds)
    pointsEarned: number;           // Motoko: Nat
    tweetId?: string;               // Motoko: ?Text
}

// Represents the 'Progress' type from Motoko, specific to a User and a Mission (and implicitly a Project)
export interface UserMissionProgress {
    completionHistory: MissionRecord[];
    // Map of secret codes the user has used (Text: Code, Bool: Used true or false)
    usedCodes: Record<string, boolean>; // Motoko: TrieMap.TrieMap<Text, Bool>
}

export interface ModalMission {
    id: string;
    projectId: string;
    title: string;
    // You might add other relevant fields like iconUrl if you want to display them
}

export interface UserProgressOnMission {
    missionId: string;
    missionTitle: string;
    // missionIconUrl?: string; // Optional: if you want to show mission icons
    progress: UserMissionProgress;
}