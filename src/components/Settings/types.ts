import { Principal } from "@dfinity/principal";
import { SerializedPermissions } from "../../declarations/projectCanister/test_backend.did.js";

export type AdminPermissionEntry = [Principal, SerializedPermissions];

export interface ProjectDetailsFormValues {
    name: string;
    isVisible: boolean;
    description: string;
    aboutInfo: string;
    iconUrl: string | null;      // URL string
    bannerUrl: string | null;    // URL string
    iconFile?: File | null;   // For file input
    bannerFile?: File | null; // For file input

    // Contact Info
    contactXAccountUrl: string | null;
    contactTelegramGroupUrl: string | null;
    contactDiscordInviteUrl: string | null;
    contactOpenChatUrl: string | null;
    contactWebsiteUrl: string | null;
    contactEmailContact: string | null;
    contactOtherLinks: Array<{ id: string; label: string; url: string }>;
}

// State for the Admins tab
export interface AdminManagementState {
    admins: Array<AdminPermissionEntry>; // [Principal, Permissions]
    newAdminPrincipalText: string;
    newAdminPermissions: SerializedPermissions; // To hold permissions for the new admin being added
    editingAdminPrincipal: Principal | null;
    editingAdminPermissions: SerializedPermissions | null; // For the admin being edited
}

// Permissions Group Structure

type PermissionGroup = {
    value: string;
    label: string;
    permissions: Array<keyof SerializedPermissions>;
};

export const permissionGroups: PermissionGroup[] = [
    {
        value: 'adminManagement',
        label: 'Administrator Management',
        permissions: ['addAdmin', 'removeAdmin', 'editAdmin', 'viewAdmins'],
    },
    {
        value: 'projectInfo',
        label: 'Project Information',
        permissions: ['editProjectInfo'],
    },
    {
        value: 'missionManagement',
        label: 'Mission Management',
        permissions: ['createMission', 'editMissionInfo', 'editMissionFlow', 'updateMissionStatus'],
    },
    {
        value: 'userProgress',
        label: 'User Progress Management',
        permissions: ['viewAnyUserProgress', 'resetUserProgress', 'adjustUserProgress'],
    },
];