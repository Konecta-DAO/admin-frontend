import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useBlocker } from 'react-router-dom';
import {
    Box, Title, Text, Paper, Alert, Button, Group, Stack, TextInput, Textarea,
    ActionIcon, LoadingOverlay, Tabs, FileInput, Image,
    useMantineTheme, Tooltip, useMantineColorScheme, List,
    CopyButton, ThemeIcon, Code, Checkbox, Modal, ScrollArea, Popover,
    Accordion,
    Loader,
    Center
} from '@mantine/core';
import { useForm, yupResolver } from '@mantine/form';
import * as yup from 'yup';
import {
    IconDeviceFloppy, IconAlertCircle, IconPhoto, IconLink, IconSettings,
    IconBuildingStore, IconRefresh, IconUpload,
    IconUsers, IconCheck, IconCopy, IconUserCheck, IconUserOff, IconUserPlus,
    IconEdit, IconKey,
    IconTrash,
    IconPlus
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { ImageUploadInput, Result_1, Result_4 } from '../../declarations/projectCanister/test_backend.did.js';
import { Principal } from '@dfinity/principal';
import { useAuth } from '@nfid/identitykit/react';

import {
    type ProjectDetailsFormValues,
    type AdminPermissionEntry,
    type AdminManagementState,
    permissionGroups
} from './types.ts';
import { SerializedPermissions, SerializedProjectDetails } from '../../declarations/projectCanister/test_backend.did.js';
import { fileToUint8Array, urlValidation } from './settingsUtils.ts';
import { initialPermissionsState, permissionLabels } from './projectSettingsConstants.ts';
import { useAnalytics } from '../../contexts/AnalyticsContext.tsx';

const validationSchema = yup.object().shape({
    name: yup.string().required('Project display name is required').min(3, 'Name must be at least 3 characters'),
    isVisible: yup.boolean().required(),
    description: yup.string().max(5000, 'Description cannot exceed 5000 characters').default(''),
    aboutInfo: yup.string().max(5000, 'About Info cannot exceed 5000 characters').default(''),
    contactEmailContact: yup.string().email('Invalid email address').nullable().default(null),
    contactWebsiteUrl: yup.string().test('is-url', 'Invalid website URL', urlValidation).nullable().default(null),
    contactXAccountUrl: yup.string().test('is-url', 'Invalid X (Twitter) URL', urlValidation).nullable().default(null),
    contactDiscordInviteUrl: yup.string().test('is-url', 'Invalid Discord URL', urlValidation).nullable().default(null),
    contactTelegramGroupUrl: yup.string().test('is-url', 'Invalid Telegram URL', urlValidation).nullable().default(null),
    contactOpenChatUrl: yup.string().test('is-url', 'Invalid OpenChat URL', urlValidation).nullable().default(null),
    contactOtherLinks: yup.array().of(
        yup.object().shape({
            id: yup.string().required(),
            label: yup.string().required('Link label is required').max(50, 'Label cannot exceed 50 characters'),
            url: yup.string().required('Link URL is required').test('is-url', 'Invalid URL format for link', urlValidation),
        })
    ).nullable().default([]),
    iconFile: yup.mixed<File>().nullable().default(null),
    bannerFile: yup.mixed<File>().nullable().default(null),
});

const ProjectSettingsPage: React.FC = () => {
    const { projectId } = useParams<{ projectId: string }>();
    const theme = useMantineTheme();
    const { user } = useAuth();
    const navigate = useNavigate();

    const {
        projectActor,
        isLoadingAnalytics,
        analyticsError,
        refreshAnalytics
    } = useAnalytics();

    const [backendDetails, setBackendDetails] = useState<SerializedProjectDetails | null>(null);
    const [isLoadingDetails, setIsLoadingDetails] = useState(true);
    const [detailsError, setDetailsError] = useState<string | null>(null);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isPermissionsModalSubmitting, setIsPermissionsModalSubmitting] = useState(false);
    const [formKey, setFormKey] = useState(Date.now()); // To force re-fetch/re-init
    const { colorScheme } = useMantineColorScheme();

    const [iconPreviewUrl, setIconPreviewUrl] = useState<string | null>(null);
    const [bannerPreviewUrl, setBannerPreviewUrl] = useState<string | null>(null);

    const [adminManagement, setAdminManagement] = useState<AdminManagementState>({
        admins: [],
        newAdminPrincipalText: '',
        newAdminPermissions: { ...initialPermissionsState },
        editingAdminPrincipal: null,
        editingAdminPermissions: null,
    });
    const [isAdminsLoading, setIsAdminsLoading] = useState(false);
    const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false);
    const [currentUserPermissions, setCurrentUserPermissions] = useState<SerializedPermissions | null>(null);

    const [showRemoveAdminModal, setShowRemoveAdminModal] = useState(false);
    const [adminToRemove, setAdminToRemove] = useState<Principal | null>(null);
    const [showNavigationBlockModal, setShowNavigationBlockModal] = useState(false);
    const [nextLocationPath, setNextLocationPath] = useState<string | null>(null);

    const form = useForm<ProjectDetailsFormValues>({
        key: formKey,
        initialValues: {
            name: '', isVisible: true, description: '', aboutInfo: '',
            iconUrl: '', bannerUrl: '', iconFile: null, bannerFile: null, // iconUrl and bannerUrl store existing URLs for display
            contactXAccountUrl: '', contactTelegramGroupUrl: '', contactDiscordInviteUrl: '',
            contactOpenChatUrl: '', contactWebsiteUrl: '', contactEmailContact: '',
            contactOtherLinks: [],
        },
        validate: yupResolver(validationSchema),
    });

    const blocker = useBlocker(
        ({ currentLocation, nextLocation }) =>
            form.isDirty() && currentLocation.pathname !== nextLocation.pathname
    );

    const fetchAllSettings = useCallback(async () => {

        if (!projectActor || !projectId) {
            setDetailsError("Project actor or ID not available for fetching settings.");
            setIsLoadingDetails(false);
            return;
        }

        setIsLoadingDetails(true);
        setDetailsError(null);
        try {
            const currentUserPermsOpt = await projectActor.getMyAdminPermissions() as [SerializedPermissions] | [];
            const CUserPerms = currentUserPermsOpt.length > 0 ? currentUserPermsOpt[0] : null;
            setCurrentUserPermissions(CUserPerms ?? null);

            if (!CUserPerms?.viewAdmins && !CUserPerms?.editProjectInfo) {
                setDetailsError("You do not have permission to view or edit settings for this project.");
                notifications.show({ title: 'Access Denied', message: 'Insufficient permissions for project settings.', color: 'orange' });
                setIsLoadingDetails(false);
                return;
            }

            const details = await projectActor.getProjectDetails() as SerializedProjectDetails;
            setBackendDetails(details);

            const otherLinksFromBackend = details.contactInfo.otherLinks?.[0] || [];
            const formattedOtherLinks = otherLinksFromBackend.map((linkPair: [string, string], index: number) => ({
                id: `link-${Date.now()}-${index}`,
                label: linkPair[0],
                url: linkPair[1],
            }));

            form.setValues({
                name: details.name || '',
                isVisible: details.isVisible,
                description: details.description || '',
                aboutInfo: details.aboutInfo?.[0] || '',
                iconUrl: details.iconUrl?.[0] || '', // Store existing icon URL for display
                bannerUrl: details.bannerUrl?.[0] || '', // Store existing banner URL for display
                iconFile: null, bannerFile: null,
                contactXAccountUrl: details.contactInfo.xAccountUrl?.[0] || '',
                contactTelegramGroupUrl: details.contactInfo.telegramGroupUrl?.[0] || '',
                contactDiscordInviteUrl: details.contactInfo.discordInviteUrl?.[0] || '',
                contactOpenChatUrl: details.contactInfo.openChatUrl?.[0] || '',
                contactWebsiteUrl: details.contactInfo.websiteUrl?.[0] || '',
                contactEmailContact: details.contactInfo.emailContact?.[0] || '',
                contactOtherLinks: formattedOtherLinks,
            });
            form.resetDirty();

            if (CUserPerms?.viewAdmins) {
                setIsAdminsLoading(true);
                const adminRes = await projectActor.getAdminsWithPermissions() as Result_4;
                if ('ok' in adminRes) {
                    setAdminManagement(prev => ({ ...prev, admins: adminRes.ok }));
                } else {
                    notifications.show({ title: 'Error Fetching Admins', message: adminRes.err, color: 'red' });
                    setAdminManagement(prev => ({ ...prev, admins: [] }));
                }
                setIsAdminsLoading(false);
            } else {
                setAdminManagement(prev => ({ ...prev, admins: [] }));
            }

        } catch (e: any) {
            console.error("Failed to fetch project settings:", e);
            const errorMsg = e.message || "An unknown error occurred while fetching settings.";
            setDetailsError(errorMsg);
            notifications.show({ title: 'Error Fetching Settings', message: errorMsg, color: 'red', icon: <IconAlertCircle /> });
        } finally {
            setIsLoadingDetails(false);
        }
    }, [
        projectActor,
        projectId,
        // form, // form dependency removed as per recommendation if setValues and resetDirty don't need it.
        // setCurrentUserPermissions, setBackendDetails, setAdminManagement, setIsAdminsLoading should be stable if from useState
    ]);

    useEffect(() => {
        if (projectActor && !isLoadingAnalytics && !analyticsError) {
            fetchAllSettings();
        }
    }, [projectActor, isLoadingAnalytics, analyticsError, fetchAllSettings]); // Added fetchAllSettings

    useEffect(() => {
        if (blocker && blocker.state === "blocked") {
            setShowNavigationBlockModal(true);
            setNextLocationPath(blocker.location.pathname);
        } else if (blocker && blocker.state === "proceeding") {
            // Optional: any logic when proceeding
        }
    }, [blocker]);

    useEffect(() => {
        const file = form.values.iconFile;
        if (file) {
            const newPreviewUrl = URL.createObjectURL(file);
            setIconPreviewUrl(newPreviewUrl);
            return () => URL.revokeObjectURL(newPreviewUrl);
        } else {
            setIconPreviewUrl(null);
        }
    }, [form.values.iconFile]);

    useEffect(() => {
        const file = form.values.bannerFile;
        if (file) {
            const newPreviewUrl = URL.createObjectURL(file);
            setBannerPreviewUrl(newPreviewUrl);
            return () => URL.revokeObjectURL(newPreviewUrl);
        } else {
            setBannerPreviewUrl(null);
        }
    }, [form.values.bannerFile]);

    useEffect(() => {
        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            if (form.isDirty()) {
                event.preventDefault();
                event.returnValue = ''; // Required for Chrome
                return ''; // For other browsers
            }
        };

        if (form.isDirty()) {
            window.addEventListener('beforeunload', handleBeforeUnload);
        } else {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        }

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [form.isDirty()]);

    const handleAdminPrincipalChange = (text: string) => {
        setAdminManagement(prev => ({ ...prev, newAdminPrincipalText: text }));
    };

    const handleNewAdminPermissionChange = (permissionKey: keyof SerializedPermissions, value: boolean) => {
        setAdminManagement(prev => ({
            ...prev,
            newAdminPermissions: { ...prev.newAdminPermissions, [permissionKey]: value }
        }));
    };
    const handleEditingAdminPermissionChange = (permissionKey: keyof SerializedPermissions, value: boolean) => {
        if (adminManagement.editingAdminPermissions) {
            setAdminManagement(prev => ({
                ...prev,
                editingAdminPermissions: { ...prev.editingAdminPermissions!, [permissionKey]: value }
            }));
        }
    };

    const openPermissionModal = (adminEntry?: AdminPermissionEntry) => {
        if (adminEntry) {
            setAdminManagement(prev => ({
                ...prev,
                editingAdminPrincipal: adminEntry[0],
                editingAdminPermissions: { ...adminEntry[1] },
                newAdminPrincipalText: '',
                newAdminPermissions: { ...initialPermissionsState }
            }));
        } else {
            setAdminManagement(prev => ({
                ...prev,
                editingAdminPrincipal: null,
                editingAdminPermissions: null,
                newAdminPrincipalText: '',
                newAdminPermissions: { ...initialPermissionsState, viewAdmins: true },
            }));
        }
        setIsPermissionsModalOpen(true);
    };


    const handleSaveAdminPermissions = async () => {
        if (!projectActor) return;
        setIsPermissionsModalSubmitting(true);

        let principalToProcess: Principal;
        const permissionsToSave: SerializedPermissions = adminManagement.editingAdminPrincipal
            ? adminManagement.editingAdminPermissions!
            : adminManagement.newAdminPermissions;

        try {
            if (adminManagement.editingAdminPrincipal) {
                if (!currentUserPermissions?.editAdmin) {
                    notifications.show({ title: 'Permission Denied', message: "You don't have permission to edit admins.", color: 'red' });
                    setIsPermissionsModalSubmitting(false); return;
                }
                principalToProcess = adminManagement.editingAdminPrincipal;
                const res = await projectActor.updateAdminPermissions(principalToProcess, permissionsToSave) as Result_1;
                if ('ok' in res) {
                    notifications.show({ title: 'Admin Updated', message: `Permissions for ${principalToProcess.toText().substring(0, 15)}... updated.`, color: 'green' });
                    fetchAllSettings(); // Refresh all settings including admins
                } else {
                    notifications.show({ title: 'Update Failed', message: res.err, color: 'red' });
                }
            } else {
                if (!currentUserPermissions?.addAdmin) {
                    notifications.show({ title: 'Permission Denied', message: "You don't have permission to add admins.", color: 'red' });
                    setIsPermissionsModalSubmitting(false); return;
                }
                try {
                    principalToProcess = Principal.fromText(adminManagement.newAdminPrincipalText);
                } catch (e) {
                    notifications.show({ title: 'Invalid Input', message: "Invalid Principal ID format.", color: 'orange' });
                    setIsPermissionsModalSubmitting(false); return;
                }
                const res = await projectActor.addAdminWithPermissions(principalToProcess, permissionsToSave) as Result_1;
                if ('ok' in res) {
                    notifications.show({ title: 'Admin Added', message: `${principalToProcess.toText().substring(0, 15)}... added as admin.`, color: 'green' });
                    fetchAllSettings(); // Refresh all settings including admins
                } else {
                    notifications.show({ title: 'Add Failed', message: res.err, color: 'red' });
                }
            }
        } catch (e: any) {
            notifications.show({ title: 'Operation Failed', message: e.message || "An unexpected error occurred.", color: 'red' });
        } finally {
            setIsPermissionsModalSubmitting(false);
            setIsPermissionsModalOpen(false);
        }
    };

    const handleRemoveAdmin = (principal: Principal) => {
        if (!currentUserPermissions?.removeAdmin) {
            notifications.show({ title: 'Permission Denied', message: "You don't have permission to remove admins.", color: 'red' });
            return;
        }
        if (user?.principal.toText() === principal.toText() && adminManagement.admins.length === 1) {
            notifications.show({ title: 'Action Denied', message: "Cannot remove yourself as the last admin.", color: 'orange' });
            return;
        }
        setAdminToRemove(principal);
        setShowRemoveAdminModal(true);
    };

    const confirmRemoveAdmin = async () => {
        if (!projectActor || !adminToRemove) return;

        setIsAdminsLoading(true); // Consider a more specific loading state if needed
        setShowRemoveAdminModal(false);

        try {
            const res = await projectActor.removeAdmin(adminToRemove) as Result_1;
            if ('ok' in res) {
                notifications.show({ title: 'Admin Removed', message: `${adminToRemove.toText().substring(0, 15)}... removed.`, color: 'green' });
                fetchAllSettings(); // Refresh all settings including admins
            } else {
                notifications.show({ title: 'Removal Failed', message: res.err, color: 'red' });
            }
        } catch (e: any) {
            notifications.show({ title: 'Removal Error', message: e.message || "Could not remove admin.", color: 'red' });
        } finally {
            setIsAdminsLoading(false);
            setAdminToRemove(null);
        }
    };

    const handleSubmitProjectDetails = async (values: ProjectDetailsFormValues) => {
        if (!projectActor || !projectId || !currentUserPermissions?.editProjectInfo) {
            notifications.show({ title: 'Error', message: 'Actor not ready, Project ID missing, or insufficient permissions to edit project info.', color: 'red' });
            return;
        }
        setIsSubmitting(true);
        try {
            let iconInputToSend: [ImageUploadInput] | [] = [];
            if (values.iconFile) {
                const iconContent = await fileToUint8Array(values.iconFile);
                iconInputToSend = [{ Asset: { originalFileName: values.iconFile.name, content: iconContent } }];
            } else if (values.iconUrl) {
                // If no new file, but an existing URL is present, send the URL back.
                iconInputToSend = [{ Url: values.iconUrl }];
            }
            // If values.iconFile is null, iconInputToSend remains [], which will clear the icon on the backend.

            let bannerInputToSend: [ImageUploadInput] | [] = [];
            if (values.bannerFile) {
                const bannerContent = await fileToUint8Array(values.bannerFile);
                bannerInputToSend = [{ Asset: { originalFileName: values.bannerFile.name, content: bannerContent } }];
            } else if (values.bannerUrl) {
                // If no new file, but an existing URL is present, send the URL back.
                bannerInputToSend = [{ Url: values.bannerUrl }];
            }

            const otherLinksForBackend: Array<[string, string]> = values.contactOtherLinks
                ? values.contactOtherLinks.filter(link => link.label && link.url).map(link => [link.label, link.url] as [string, string])
                : [];

            const backendArgs = {
                name: values.name,
                isVisible: values.isVisible,
                iconInput: iconInputToSend,
                bannerInput: bannerInputToSend,
                description: values.description,
                aboutInfo: values.aboutInfo ? [values.aboutInfo] : [],
                contactXAccountUrl: values.contactXAccountUrl ? [values.contactXAccountUrl] : [],
                contactTelegramGroupUrl: values.contactTelegramGroupUrl ? [values.contactTelegramGroupUrl] : [],
                contactDiscordInviteUrl: values.contactDiscordInviteUrl ? [values.contactDiscordInviteUrl] : [],
                contactOpenChatUrl: values.contactOpenChatUrl ? [values.contactOpenChatUrl] : [],
                contactWebsiteUrl: values.contactWebsiteUrl ? [values.contactWebsiteUrl] : [],
                contactEmail: values.contactEmailContact ? [values.contactEmailContact] : [],
                contactOtherLinks: otherLinksForBackend.length > 0 ? [otherLinksForBackend] : [],
            };

            notifications.show({ id: 'saving-details', title: "Saving...", message: "Submitting project details to the backend.", color: 'blue', loading: true, autoClose: false });

            const result = await projectActor.setProjectDetails(
                backendArgs.name,
                backendArgs.isVisible,
                backendArgs.iconInput,
                backendArgs.bannerInput,
                backendArgs.description,
                backendArgs.aboutInfo,
                backendArgs.contactXAccountUrl,
                backendArgs.contactTelegramGroupUrl,
                backendArgs.contactDiscordInviteUrl,
                backendArgs.contactOpenChatUrl,
                backendArgs.contactWebsiteUrl,
                backendArgs.contactEmail,
                backendArgs.contactOtherLinks
            ) as Result_1;

            if ('ok' in result) {
                notifications.update({ id: 'saving-details', title: 'Settings Saved', message: `Project "${values.name}" settings updated!`, color: 'green', icon: <IconDeviceFloppy />, loading: false, autoClose: 5000 });
                setFormKey(Date.now()); // This will trigger re-fetch via fetchAllSettings
                // Explicitly call fetchAllSettings to ensure UI consistency immediately after save
                await fetchAllSettings();
                form.resetDirty(); // Reset dirty state after successful save and re-fetch
            } else {
                throw new Error(result.err);
            }
        } catch (e: any) {
            console.error("Failed to update project settings:", e);
            notifications.show({ title: 'Update Failed', message: e.message || "Error saving settings.", color: 'red', icon: <IconAlertCircle /> });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoadingAnalytics && !projectActor) {
        return <Center style={{ height: 'calc(100vh - 200px)' }}><Loader size="xl" /></Center>;
    }

    if (analyticsError) {
        return (
            <Alert icon={<IconAlertCircle size="1rem" />} title="Error Loading Project Data" color="red" radius="md" m="xl">
                {analyticsError}
                <Button onClick={() => typeof refreshAnalytics === 'function' ? refreshAnalytics() : window.location.reload()} mt="sm">
                    Try Again
                </Button>
            </Alert>
        );
    }

    if (!projectActor) {
        return (
            <Alert icon={<IconAlertCircle size="1rem" />} title="Project Not Accessible" color="orange" radius="md" m="xl">
                The project data could not be accessed. Please try refreshing or contact support.
                <Button onClick={() => navigate('/')} mt="sm">Go to Homepage</Button>
            </Alert>
        );
    }

    if (isLoadingDetails && !backendDetails && !detailsError) {
        return <Center style={{ height: 'calc(100vh - 200px)' }}><Loader size="xl" /></Center>;
    }

    if (detailsError && !backendDetails) {
        return (
            <Alert icon={<IconAlertCircle size="1rem" />} title="Error Fetching Settings Details" color="red" radius="md" m="xl">
                {detailsError}
                <Button onClick={() => { setDetailsError(null); setIsLoadingDetails(true); fetchAllSettings(); }} mt="sm">
                    Try Again
                </Button>
            </Alert>
        );
    }

    if (!backendDetails && !isLoadingDetails) {
        return (
            <Alert icon={<IconAlertCircle size="1rem" />} title="Settings Data Unavailable" color="orange" radius="md" m="xl">
                Essential settings information could not be loaded.
                <Button onClick={() => { setIsLoadingDetails(true); fetchAllSettings(); }} mt="sm">Try to Reload Settings</Button>
            </Alert>
        );
    }

    const currentProjectName = backendDetails?.name || projectId || "Project";
    const canEditProjectInfo = !!currentUserPermissions?.editProjectInfo;
    const canViewAdmins = !!currentUserPermissions?.viewAdmins;
    const canAddAdmin = !!currentUserPermissions?.addAdmin;
    const canEditAdmin = !!currentUserPermissions?.editAdmin;
    const canRemoveAdmin = !!currentUserPermissions?.removeAdmin;

    // Construct image URLs for display
    const existingIconDisplayUrl = (form.values.iconUrl && projectId)
        ? `https://${projectId}.raw.icp0.io${form.values.iconUrl.startsWith('/') ? form.values.iconUrl : `/${form.values.iconUrl}`}`
        : null;
    const existingBannerDisplayUrl = (form.values.bannerUrl && projectId)
        ? `https://${projectId}.raw.icp0.io${form.values.bannerUrl.startsWith('/') ? form.values.bannerUrl : `/${form.values.bannerUrl}`}`
        : null;


    return (
        <Box p="md" pos="relative">
            <LoadingOverlay visible={(isLoadingDetails && !backendDetails) || isSubmitting} zIndex={1000} overlayProps={{ radius: "sm", blur: 2 }} />
            <Group justify="space-between" mb="xl">
                <Title order={2}>
                    <Group gap="xs">
                        <IconSettings size={30} />
                        Settings: <Text span c={theme.primaryColor} inherit>{currentProjectName}</Text>
                    </Group>
                </Title>
                <Tooltip label="Refresh Settings Data">
                    <ActionIcon variant="light" onClick={() => fetchAllSettings()} size="lg" loading={isLoadingDetails}>
                        <IconRefresh size={20} />
                    </ActionIcon>
                </Tooltip>
            </Group>

            {projectId && (
                <Paper withBorder p="xs" radius="md" mb="lg" shadow="xs">
                    <Group justify="space-between" align="center">
                        <Group gap="xs">
                            <Text size="sm" fw={500} c="dimmed">Project ID:</Text>
                            <Code style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {projectId}
                            </Code>
                        </Group>
                        <CopyButton value={projectId} timeout={2000}>
                            {({ copied, copy }) => (
                                <Button
                                    variant="light"
                                    color={copied ? 'teal' : 'blue'}
                                    size="xs"
                                    onClick={copy}
                                    leftSection={copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                                >
                                    {copied ? 'Copied!' : 'Copy ID'}
                                </Button>
                            )}
                        </CopyButton>
                    </Group>
                </Paper>
            )}

            <Modal
                opened={isPermissionsModalOpen}
                onClose={() => setIsPermissionsModalOpen(false)}
                title={adminManagement.editingAdminPrincipal ? `Edit Permissions for ${adminManagement.editingAdminPrincipal.toText().substring(0, 15)}...` : "Add New Admin & Set Permissions"}
                size="lg"
                overlayProps={{ backgroundOpacity: 0.55, blur: 3 }}
            >
                <Stack>
                    {!adminManagement.editingAdminPrincipal && (
                        <TextInput
                            label="New Admin Principal ID"
                            placeholder="Enter Principal ID..."
                            value={adminManagement.newAdminPrincipalText}
                            onChange={(event) => handleAdminPrincipalChange(event.currentTarget.value)}
                            required
                        />
                    )}
                    <Text fw={500} size="sm" mt="md">Permissions:</Text>
                    <ScrollArea.Autosize mah={300}>
                        <Accordion defaultValue={permissionGroups.map(g => g.value)} multiple>
                            {permissionGroups.map((group) => (
                                <Accordion.Item key={group.value} value={group.value}>
                                    <Accordion.Control>{group.label}</Accordion.Control>
                                    <Accordion.Panel>
                                        <Stack gap="xs" pl="sm" pr="xs" pb="xs">
                                            {group.permissions.map((pKey) => (
                                                <Checkbox
                                                    key={pKey}
                                                    label={permissionLabels[pKey]}
                                                    checked={
                                                        adminManagement.editingAdminPrincipal
                                                            ? adminManagement.editingAdminPermissions?.[pKey] || false
                                                            : adminManagement.newAdminPermissions[pKey] || false
                                                    }
                                                    onChange={(event) => {
                                                        if (adminManagement.editingAdminPrincipal) {
                                                            handleEditingAdminPermissionChange(pKey, event.currentTarget.checked)
                                                        } else {
                                                            handleNewAdminPermissionChange(pKey, event.currentTarget.checked)
                                                        }
                                                    }}
                                                />
                                            ))}
                                        </Stack>
                                    </Accordion.Panel>
                                </Accordion.Item>
                            ))}
                        </Accordion>
                    </ScrollArea.Autosize>
                    <Group justify="flex-end" mt="lg">
                        <Button variant="default" onClick={() => setIsPermissionsModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveAdminPermissions} loading={isPermissionsModalSubmitting} leftSection={<IconDeviceFloppy size={16} />}>
                            {adminManagement.editingAdminPrincipal ? "Save Permissions" : "Add Admin"}
                        </Button>
                    </Group>
                </Stack>
            </Modal>

            <Modal
                opened={showNavigationBlockModal}
                onClose={() => {
                    setShowNavigationBlockModal(false);
                    blocker?.reset?.(); // Reset blocker if user decides to stay
                }}
                title="Unsaved Changes"
                centered
                overlayProps={{ backgroundOpacity: 0.55, blur: 3 }}
            >
                <Text>You have unsaved changes. Are you sure you want to leave? Your changes will be lost.</Text>
                <Group justify="flex-end" mt="lg">
                    <Button
                        variant="default"
                        onClick={() => {
                            setShowNavigationBlockModal(false);
                            blocker?.reset?.();
                        }}
                    >
                        Stay on Page
                    </Button>
                    <Button
                        color="red"
                        onClick={() => {
                            setShowNavigationBlockModal(false);
                            form.resetDirty(); // Consider form.reset() if you want to discard changes fully
                            blocker?.proceed?.();
                            if (nextLocationPath && !blocker?.proceed) { // Fallback for older react-router versions or specific blocker behavior
                                navigate(nextLocationPath);
                            }
                            setNextLocationPath(null);
                        }}
                    >
                        Leave Page
                    </Button>
                </Group>
            </Modal>

            <Modal
                opened={showRemoveAdminModal}
                onClose={() => {
                    setShowRemoveAdminModal(false);
                    setAdminToRemove(null);
                }}
                title="Confirm Admin Removal"
                centered
                overlayProps={{ backgroundOpacity: 0.55, blur: 3 }}
            >
                <Text>
                    Are you sure you want to remove admin: <Code>{adminToRemove?.toText().substring(0, 25)}...</Code>?
                    This action cannot be undone.
                </Text>
                <Group justify="flex-end" mt="lg">
                    <Button
                        variant="default"
                        onClick={() => {
                            setShowRemoveAdminModal(false);
                            setAdminToRemove(null);
                        }}
                    >
                        Cancel
                    </Button>
                    <Button
                        color="red"
                        leftSection={<IconUserOff size={16} />}
                        onClick={confirmRemoveAdmin}
                        loading={isAdminsLoading} // Re-evaluate this loading state if it conflicts
                    >
                        Remove Admin
                    </Button>
                </Group>
            </Modal>

            <form onSubmit={form.onSubmit(handleSubmitProjectDetails)}>
                <Tabs defaultValue="general">
                    <Tabs.List>
                        <Tabs.Tab value="general" leftSection={<IconBuildingStore size={16} />} disabled={!canEditProjectInfo && !backendDetails}>General</Tabs.Tab>
                        <Tabs.Tab value="branding" leftSection={<IconPhoto size={16} />} disabled={!canEditProjectInfo && !backendDetails}>Branding</Tabs.Tab>
                        <Tabs.Tab value="admins" leftSection={<IconUsers size={16} />} disabled={!canViewAdmins && !backendDetails}>Admins</Tabs.Tab>
                        <Tabs.Tab value="contact" leftSection={<IconLink size={16} />} disabled={!canEditProjectInfo && !backendDetails}>Contact & Links</Tabs.Tab>
                    </Tabs.List>

                    <Tabs.Panel value="general" pt="lg">
                        <Paper shadow="sm" p="lg" withBorder radius="md">
                            <fieldset disabled={!canEditProjectInfo || isSubmitting} style={{ border: 'none', padding: 0, margin: 0 }}>
                                <Stack gap="lg">
                                    <TextInput required label="Project Display Name" placeholder="My Awesome Project" {...form.getInputProps('name')} />
                                    <Checkbox label="Project is Visible (Publicly Listed in Index)" {...form.getInputProps('isVisible', { type: 'checkbox' })} />
                                    <Textarea label="Project Description (Public)" placeholder="A short, catchy description for public display." minRows={3} autosize {...form.getInputProps('description')} />
                                    <Textarea label="About Info (More details)" placeholder="Extended information about the project, its goals, team, etc." minRows={5} autosize {...form.getInputProps('aboutInfo')} />
                                </Stack>
                            </fieldset>
                        </Paper>
                    </Tabs.Panel>

                    <Tabs.Panel value="branding" pt="lg">
                        <Paper shadow="sm" p="lg" withBorder radius="md">
                            <fieldset disabled={!canEditProjectInfo || isSubmitting} style={{ border: 'none', padding: 0, margin: 0 }}>
                                <Stack gap="lg">
                                    <Title order={5}>Project Icon</Title>
                                    {(iconPreviewUrl || existingIconDisplayUrl) && (
                                        <Image
                                            src={iconPreviewUrl || existingIconDisplayUrl}
                                            maw={128}
                                            mah={128}
                                            radius="sm"
                                            alt="Icon Preview"
                                            mb="xs"
                                            fallbackSrc="/placeholder-icon.svg" // Optional: if you have a placeholder
                                        />
                                    )}
                                    {/* Icon URL TextInput removed */}
                                    <FileInput
                                        label="Upload New Icon"
                                        placeholder={form.values.iconUrl ? "Choose file to replace current icon" : "Choose file for icon"}
                                        leftSection={<IconUpload size={14} />}
                                        {...form.getInputProps('iconFile')}
                                        accept="image/*"
                                        clearable
                                        disabled={isSubmitting || !canEditProjectInfo}
                                    />

                                    <Title order={5} mt="md">Project Banner</Title>
                                    {(bannerPreviewUrl || existingBannerDisplayUrl) && (
                                        <Image
                                            src={bannerPreviewUrl || existingBannerDisplayUrl}
                                            mah={200}
                                            fit="contain"
                                            radius="sm"
                                            alt="Banner Preview"
                                            mb="xs"
                                            fallbackSrc="/placeholder-banner.svg" // Optional: if you have a placeholder
                                        />
                                    )}
                                    {/* Banner URL TextInput removed */}
                                    <FileInput
                                        label="Upload New Banner"
                                        placeholder={form.values.bannerUrl ? "Choose file to replace current banner" : "Choose file for banner"}
                                        leftSection={<IconUpload size={14} />}
                                        {...form.getInputProps('bannerFile')}
                                        accept="image/*"
                                        clearable
                                        disabled={isSubmitting || !canEditProjectInfo}
                                    />
                                </Stack>
                            </fieldset>
                        </Paper>
                    </Tabs.Panel>

                    <Tabs.Panel value="admins" pt="lg">
                        <Paper shadow="sm" p="lg" withBorder radius="md" pos="relative">
                            <LoadingOverlay visible={isAdminsLoading && !isSubmitting} zIndex={1} overlayProps={{ radius: "sm", blur: 1 }} />
                            <Title order={4} mb="lg">Project Administrators</Title>
                            <Button
                                leftSection={<IconUserPlus size={16} />}
                                onClick={() => openPermissionModal()}
                                disabled={!canAddAdmin || isAdminsLoading || isSubmitting}
                                mb="md"
                            >
                                Add New Admin
                            </Button>

                            <Stack gap="xs" mb="xl">
                                <Text fw={500}>Current Admins:</Text>
                                {adminManagement.admins.length === 0 ? (
                                    <Text c="dimmed" fs="italic">{canViewAdmins ? "No admins assigned." : "You do not have permission to view admins."}</Text>
                                ) : (
                                    <List
                                        spacing="xs"
                                        size="sm"
                                        center
                                    // icon={<ThemeIcon color="blue" size={20} radius="xl"><IconUserCheck size={12} /></ThemeIcon>}
                                    >
                                        {adminManagement.admins.map(([adminIdObj, perms]) => {
                                            const adminId = adminIdObj.toText();
                                            const isCurrentUserAdmin = user?.principal.toText() === adminIdObj.toText() || false;

                                            return (
                                                <List.Item
                                                    key={adminId}
                                                    icon={
                                                        isCurrentUserAdmin ? (
                                                            <Tooltip label="This is you" withArrow>
                                                                <ThemeIcon color="green" size={20} radius="xl">
                                                                    <IconUserCheck size={14} />
                                                                </ThemeIcon>
                                                            </Tooltip>
                                                        ) : (
                                                            <ThemeIcon color="blue" size={20} radius="xl">
                                                                <IconUsers size={12} />
                                                            </ThemeIcon>
                                                        )
                                                    }
                                                    style={isCurrentUserAdmin ? {
                                                        backgroundColor: colorScheme === 'dark' ? theme.colors.dark[5] : theme.colors.blue[0],
                                                        borderRadius: theme.radius.sm,
                                                        padding: '2px 6px', // Adjusted padding
                                                        margin: '2px 0', // Added margin for spacing
                                                    } : { padding: '2px 0', margin: '2px 0' }}
                                                >
                                                    <Group justify="space-between" wrap="nowrap">
                                                        <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                                                            <Code
                                                                style={{
                                                                    maxWidth: '100%',
                                                                    overflow: 'hidden',
                                                                    textOverflow: 'ellipsis',
                                                                    whiteSpace: 'nowrap',
                                                                    fontWeight: isCurrentUserAdmin ? 700 : 'normal',
                                                                    // backgroundColor: 'transparent' // Ensure code background is transparent for List.Item style
                                                                }}
                                                            >
                                                                {adminId}
                                                                {isCurrentUserAdmin && <Text span size="xs" c="dimmed"> (You)</Text>}
                                                            </Code>
                                                            <CopyButton value={adminId} timeout={2000}>
                                                                {({ copied, copy }) => (
                                                                    <Tooltip label={copied ? 'Copied' : 'Copy ID'} withArrow>
                                                                        <ActionIcon color={copied ? 'teal' : 'gray'} variant="subtle" size="xs" onClick={copy}>
                                                                            {copied ? <IconCheck size={12} /> : <IconCopy size={12} />}
                                                                        </ActionIcon>
                                                                    </Tooltip>
                                                                )}
                                                            </CopyButton>
                                                            <Popover width={300} position="bottom" withArrow shadow="md">
                                                                <Popover.Target>
                                                                    <ActionIcon variant="subtle" size="xs"><IconKey size={12} /></ActionIcon>
                                                                </Popover.Target>
                                                                <Popover.Dropdown>
                                                                    <Text size="xs" fw={500} mb="xs">Permissions:</Text>
                                                                    <ScrollArea.Autosize mah={150}>
                                                                        {Object.entries(perms).filter(([, val]) => val === true).map(([key]) => (
                                                                            <Text size="xs" key={key}>- {permissionLabels[key as keyof SerializedPermissions]}</Text>
                                                                        ))}
                                                                        {Object.values(perms).every(val => val === false) && <Text size="xs" c="dimmed">No specific permissions granted.</Text>}
                                                                    </ScrollArea.Autosize>
                                                                </Popover.Dropdown>
                                                            </Popover>
                                                        </Group>
                                                        <Group gap="xs">
                                                            <Tooltip label="Edit Permissions">
                                                                <ActionIcon variant="light" color="blue" size="sm" onClick={() => openPermissionModal([adminIdObj, perms])} disabled={!canEditAdmin || isAdminsLoading || isSubmitting}>
                                                                    <IconEdit size={14} />
                                                                </ActionIcon>
                                                            </Tooltip>
                                                            <Tooltip label="Remove Admin">
                                                                <ActionIcon
                                                                    variant="light"
                                                                    color="red"
                                                                    size="sm"
                                                                    onClick={() => handleRemoveAdmin(adminIdObj)}
                                                                    disabled={
                                                                        !canRemoveAdmin ||
                                                                        isAdminsLoading ||
                                                                        isSubmitting ||
                                                                        (isCurrentUserAdmin && adminManagement.admins.length === 1)
                                                                    }
                                                                >
                                                                    <IconUserOff size={14} />
                                                                </ActionIcon>
                                                            </Tooltip>
                                                        </Group>
                                                    </Group>
                                                </List.Item>
                                            );
                                        })}
                                    </List>
                                )}
                            </Stack>
                        </Paper>
                    </Tabs.Panel>

                    <Tabs.Panel value="contact" pt="lg">
                        <Paper shadow="sm" p="lg" withBorder radius="md">
                            <fieldset disabled={!canEditProjectInfo || isSubmitting} style={{ border: 'none', padding: 0, margin: 0 }}>
                                <Stack gap="md">
                                    <Title order={5} mb="xs">Contact Information & Social Links</Title>
                                    <TextInput label="Website URL" placeholder="https://myproject.com" {...form.getInputProps('contactWebsiteUrl')} />
                                    <TextInput label="Contact Email" placeholder="contact@myproject.com" {...form.getInputProps('contactEmailContact')} />
                                    <TextInput label="X (Twitter) Profile URL" placeholder="https://x.com/myproject" {...form.getInputProps('contactXAccountUrl')} />
                                    <TextInput label="Discord Server Invite URL" placeholder="https://discord.gg/invitecode" {...form.getInputProps('contactDiscordInviteUrl')} />
                                    <TextInput label="Telegram Group/Channel URL" placeholder="https://t.me/myprojectgroup" {...form.getInputProps('contactTelegramGroupUrl')} />
                                    <TextInput label="OpenChat Group URL" placeholder="https://oc.app/group/groupid" {...form.getInputProps('contactOpenChatUrl')} />
                                    <Stack gap="xs" mt="sm">
                                        <Group justify="space-between" align="center">
                                            <Title order={6}>Other Links</Title>
                                            <Button
                                                size="xs"
                                                variant="light"
                                                leftSection={<IconPlus size={14} />}
                                                onClick={() => {
                                                    const newLink = { id: `new-${Date.now()}`, label: '', url: '' };
                                                    form.setFieldValue('contactOtherLinks', [...form.values.contactOtherLinks, newLink]);
                                                    form.setDirty({ contactOtherLinks: true }); // Ensure form is marked dirty
                                                }}
                                                disabled={isSubmitting || !canEditProjectInfo}
                                            >
                                                Add Link
                                            </Button>
                                        </Group>

                                        {form.values.contactOtherLinks.length === 0 && (
                                            <Text c="dimmed" size="sm" ta="center" py="sm">No additional links provided.</Text>
                                        )}
                                        {form.values.contactOtherLinks.map((linkItem: { id: React.Key | null | undefined; }, index: any) => (
                                            <Paper key={linkItem.id} withBorder p="xs" radius="sm" shadow="xs">
                                                <Group wrap="nowrap" align="flex-end">
                                                    <TextInput
                                                        label="Label"
                                                        placeholder="e.g., Blog"
                                                        style={{ flex: 1 }}
                                                        {...form.getInputProps(`contactOtherLinks.${index}.label`)}
                                                        disabled={isSubmitting || !canEditProjectInfo}
                                                    />
                                                    <TextInput
                                                        label="URL"
                                                        placeholder="https://example.com/page"
                                                        style={{ flex: 1 }}
                                                        {...form.getInputProps(`contactOtherLinks.${index}.url`)}
                                                        disabled={isSubmitting || !canEditProjectInfo}
                                                    />
                                                    <Tooltip label="Remove Link" withArrow>
                                                        <ActionIcon
                                                            color="red"
                                                            variant="light"
                                                            onClick={() => {
                                                                const updatedLinks = form.values.contactOtherLinks.filter((_: any, i: any) => i !== index);
                                                                form.setFieldValue('contactOtherLinks', updatedLinks);
                                                                form.setDirty({ contactOtherLinks: true }); // Ensure form is marked dirty
                                                            }}
                                                            disabled={isSubmitting || !canEditProjectInfo}
                                                        >
                                                            <IconTrash size={18} />
                                                        </ActionIcon>
                                                    </Tooltip>
                                                </Group>
                                                {form.errors[`contactOtherLinks.${index}.label`] && <Text c="red" size="xs" mt={2}>{form.errors[`contactOtherLinks.${index}.label`]}</Text>}
                                                {form.errors[`contactOtherLinks.${index}.url`] && <Text c="red" size="xs" mt={2}>{form.errors[`contactOtherLinks.${index}.url`]}</Text>}
                                            </Paper>
                                        ))}
                                        {form.errors.contactOtherLinks && typeof form.errors.contactOtherLinks === 'string' && (
                                            <Text c="red" size="xs" mt="xs">{form.errors.contactOtherLinks}</Text>
                                        )}
                                    </Stack>
                                </Stack>
                            </fieldset>
                        </Paper>
                    </Tabs.Panel>
                </Tabs>

                <Group justify="flex-end" mt="xl" pt="md" style={{ borderTop: `1px solid ${colorScheme === 'dark' ? theme.colors.dark[4] : theme.colors.gray[3]}` }}>
                    <Button type="submit" loading={isSubmitting} disabled={!form.isDirty() || !canEditProjectInfo || isSubmitting} size="md" leftSection={<IconDeviceFloppy size={18} />}>
                        Save Project Details
                    </Button>
                </Group>
            </form>
        </Box>
    );
};

export default ProjectSettingsPage;