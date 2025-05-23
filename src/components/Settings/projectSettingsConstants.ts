import { SerializedPermissions } from "../../declarations/projectCanister/test_backend.did.js";

export const initialPermissionsState: SerializedPermissions = {
    addAdmin: false, removeAdmin: false, editAdmin: false, viewAdmins: true,
    editProjectInfo: false, createMission: false, editMissionInfo: false, editMissionFlow: false,
    updateMissionStatus: false, viewAnyUserProgress: false, resetUserProgress: false, adjustUserProgress: false,
};

export const permissionLabels: Record<keyof SerializedPermissions, string> = {
    addAdmin: "Add Admin", removeAdmin: "Remove Admin", editAdmin: "Edit Admin Permissions", viewAdmins: "View Admins",
    editProjectInfo: "Edit Project Info", createMission: "Create Mission", editMissionInfo: "Edit Mission Info",
    editMissionFlow: "Edit Mission Flow", updateMissionStatus: "Update Mission Status",
    viewAnyUserProgress: "View Any User's Progress", resetUserProgress: "Reset User Progress",
    adjustUserProgress: "Adjust User Progress",
};