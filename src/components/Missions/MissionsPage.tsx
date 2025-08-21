// src/components/Missions/MissionsPage.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom'; // Import useNavigate
import {
    Box, Title, Text, Paper, Loader, Alert, Button, Group, Table, ActionIcon, Badge, Tooltip, Avatar, ScrollArea,
    Modal,
    Stack,
} from '@mantine/core';
import { CodeHighlightTabs } from '@mantine/code-highlight';
import {
    IconTargetArrow, IconCode, IconAlertCircle, IconPlus, IconPencil, IconTrash, IconEye, IconCurrencyDollar, IconGift, IconRepeat,
    IconDownload,
    IconFileTypeTsx,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications'; // For notifications

import MissionFormModal, { FileUploads } from './components/MissionFormModal.tsx';
import MissionViewModal from './components/MissionViewModal.tsx';
import { ActionFlow, ActionInstance } from './types.ts'; // Assuming this type is correctly defined by you
import {
    MissionStatus,
    RewardType,
    SerializedMission as BackendSerializedMission, // Rename to avoid conflict
    Result_1,
    ImageUploadInput, // Import the new type
} from '../../declarations/projectCanister/test_backend.did.js';
import { idlFactory as icrc1IDLFactory } from '../../declarations/icp_ledger/index.js';
import { useAnalytics } from '../../contexts/AnalyticsContext.tsx'; // Import useAnalytics
import { Principal } from '@dfinity/principal';
import { SerializedActionDefinition } from '../../declarations/actionsCanister/actions.did.js';
import { Actor, ActorSubclass, Agent } from '@dfinity/agent';
import { useAgent, useAuth } from '@nfid/identitykit/react';
import { idlFactory as actionsCanisterIDL } from '../../declarations/actionsCanister/index.js';
import { ACTIONS_CANISTER_ID } from '../../main.tsx';
const NANO_PER_MILLISECOND = 1_000_000n; // Use BigInt for nano calculations

// Define your frontend version of SerializedMission to include an 'id'
export interface SerializedMission extends BackendSerializedMission {
    id: bigint; // Add the mission ID
}

interface GeneratedCodeInfo {
    mission: SerializedMission;
    customActionInstance: ActionInstance;
}

const STATIC_MOTOKO_IDL_CONTENT = `// Placeholder IDL Content`;
const generateFrontendTriggerSnippet = (mission: SerializedMission, instance: ActionInstance): string => {
    return `// Placeholder snippet for ${mission.name} - ${instance.actionDefinitionId}`;
};

// Helper to convert a File object to a Uint8Array
const fileToUint8Array = (file: File): Promise<Uint8Array> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
        reader.onerror = (error) => reject(error);
        reader.readAsArrayBuffer(file);
    });
};


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

const MissionsPage: React.FC = () => {
    const { projectId, missionId: missionIdFromRoute } = useParams<{ projectId: string; missionId?: string }>();
    const navigate = useNavigate();
    const { projectActor } = useAnalytics(); // Get projectActor

    const [missions, setMissions] = useState<SerializedMission[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [editingMission, setEditingMission] = useState<SerializedMission | null>(null);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [viewingMission, setViewingMission] = useState<SerializedMission | null>(null);
    const [isLoadingDelete, setIsLoadingDelete] = useState(false);
    const [showGeneratedCodeModal, setShowGeneratedCodeModal] = useState(false);
    const [generatedCodeInfo, setGeneratedCodeInfo] = useState<GeneratedCodeInfo | null>(null);
    const [isSubmittingForm, setIsSubmittingForm] = useState(false);
    const agent = useAgent();
    const user = useAuth();
    const [actionDefinitions, setActionDefinitions] = useState<SerializedActionDefinition[]>([]);
    const [loadingActionDefinitions, setLoadingActionDefinitions] = useState<boolean>(true);
    const [actionsActor, setActionsActor] = useState<ActorSubclass | null>(null);

    useEffect(() => {
        const initializeActionsActor = async () => {
            if (agent && !actionsActor) { // Only if agent exists and actor isn't already created
                try {
                    // Fetch root key for local development if not already done by this agent instance
                    if (process.env.NODE_ENV !== "production") {
                        try {
                            await agent.fetchRootKey();
                        } catch (e) {
                            console.warn(`MissionsPage: Failed to fetch root key for actions canister. Dev environment issue?`, e);
                        }
                    }
                    const actor = await createActor(ACTIONS_CANISTER_ID, actionsCanisterIDL, agent);
                    setActionsActor(actor);
                    // console.log("MissionsPage: Actions Actor created successfully.");
                } catch (e) {
                    console.error("MissionsPage: Failed to create actions canister actor:", e);
                    setLoadingActionDefinitions(false);
                }
            }
        };

        initializeActionsActor();

    }, [agent, actionsActor]);

    const fetchMissions = useCallback(async () => {
        if (!projectId || !projectActor) {
            setError("Project actor or Project ID is not available.");
            setMissions([]); // Clear missions if actor/projectId is missing
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const backendMissionsResult = await projectActor.getAllMissions() as Array<[bigint, BackendSerializedMission]>;
            const formattedMissions: SerializedMission[] = backendMissionsResult.map(([id, missionData]) => ({
                ...missionData,
                id: id,
            }));

            setMissions(formattedMissions.sort((a, b) => {
                // Ensure creationTime is treated as BigInt for comparison
                const timeA = a.creationTime ? BigInt(a.creationTime) : 0n;
                const timeB = b.creationTime ? BigInt(b.creationTime) : 0n;
                if (timeA < timeB) return 1; // Descending sort
                if (timeA > timeB) return -1;
                return 0;
            }));
        } catch (err: any) {
            console.error("Failed to fetch missions:", err);
            setError(`Failed to load missions for project ${projectId}. ${err.message}`);
            setMissions([]);
        } finally {
            setLoading(false);
        }
    }, [projectId, projectActor]);

    useEffect(() => {
        fetchMissions();
    }, [fetchMissions]);

    const fetchActionDefinitions = useCallback(async () => {
        if (!actionsActor) {
            setLoadingActionDefinitions(false);
            return;
        }
        setLoadingActionDefinitions(true);
        try {
            const result = await actionsActor.listActionDefinitions([]) as SerializedActionDefinition[];

            console.log("Fetched action definitions:", JSON.stringify(result, (key, value) =>
                typeof value === 'bigint' ? value.toString() : value
                , 2));
            setActionDefinitions(result || []);
        } catch (err: any) {
            console.error("Failed to fetch action definitions:", err);
            setActionDefinitions([]);
        } finally {
            setLoadingActionDefinitions(false);
        }
    }, [actionsActor]);

    useEffect(() => {
        if (actionsActor) { // Fetch only when the actionsActor is available
            fetchActionDefinitions();
        }
    }, [actionsActor, fetchActionDefinitions]);

    // Effect to handle opening/closing the modal based on missionIdFromRoute
    useEffect(() => {
        if (missionIdFromRoute) {
            if (!loading && missions.length > 0) {
                const missionToView = missions.find(m => String(m.id) === missionIdFromRoute);
                if (missionToView) {
                    if (!isViewModalOpen || (viewingMission && String(viewingMission.id) !== String(missionToView.id))) {
                        setViewingMission(missionToView);
                        setIsViewModalOpen(true);
                    }
                } else {
                    notifications.show({
                        title: 'Mission Not Found',
                        message: `The mission with ID ${missionIdFromRoute} was not found.`,
                        color: 'orange',
                    });
                    if (projectId) navigate(`/${projectId}/missions`, { replace: true });
                }
            }
            // If still loading, this effect will re-run when missions/loading state changes.
        } else {
            // If no missionId in route, ensure modal is closed
            if (isViewModalOpen) {
                setIsViewModalOpen(false);
                setViewingMission(null);
            }
        }
    }, [missionIdFromRoute, missions, loading, projectId, navigate, isViewModalOpen, viewingMission]);


    const handleOpenCreateModal = () => {
        setEditingMission(null);
        setIsFormModalOpen(true);
    };

    const handleOpenEditModal = (mission: SerializedMission) => {
        setEditingMission(mission);
        setIsFormModalOpen(true);
    };

    const handleOpenViewModal = (mission: SerializedMission) => {
        setViewingMission(mission);
        setIsViewModalOpen(true);
        if (projectId && String(mission.id) !== missionIdFromRoute) {
            navigate(`/${projectId}/missions/${String(mission.id)}`);
        }
    };

    const handleCloseFormModal = () => {
        setIsFormModalOpen(false);
        setEditingMission(null);
    };

    const handleCloseViewModal = () => {
        setIsViewModalOpen(false);
        setViewingMission(null);
        if (projectId && missionIdFromRoute) { // Only navigate if a missionId was in the URL
            navigate(`/${projectId}/missions`, { replace: true });
        }
    };

    const handleFormSubmit = async (
        // This 'missionInputData' no longer contains iconUrl or imageUrl.
        missionInputData: Omit<BackendSerializedMission, 'creationTime' | 'updates' | 'currentTotalCompletions' | 'creator' | 'usersWhoCompletedCount' | 'iconUrl' | 'imageUrl'> & { id?: bigint },
        files: FileUploads
    ) => {
        if (!projectId || !projectActor) {
            notifications.show({ title: 'Error', message: 'Project actor or Project ID is missing.', color: 'red' });
            return;
        }

        const isEditing = missionInputData.id !== undefined && missionInputData.id !== null;

        // --- PRE-FUNDING LOGIC FOR NEW TOKEN MISSIONS ---
        if (missionInputData.rewardType && 'ICPToken' in missionInputData.rewardType && !isEditing) {
            setIsSubmittingForm(true); // Set loading state immediately
            if (!agent) {
                notifications.show({ title: 'Authentication Error', message: 'User agent not available for transaction.', color: 'red' });
                setIsSubmittingForm(false);
                return;
            }
            if (!missionInputData.maxTotalCompletions?.[0] || missionInputData.maxTotalCompletions[0] <= 0n) {
                notifications.show({ title: 'Validation Error', message: 'Max total completions must be a positive number for token rewards.', color: 'red' });
                setIsSubmittingForm(false);
                return;
            }

            const fundingNotificationId = 'funding-mission-transfer';

            try {
                const tokenCanisterId = missionInputData.rewardType.ICPToken.canisterId;
                const tokenActor = await createActor(tokenCanisterId, icrc1IDLFactory, agent);

                const [fee, decimals] = await Promise.all([
                    tokenActor.icrc1_fee() as Promise<bigint>,
                    tokenActor.icrc1_decimals() as Promise<number>,
                ]);

                const singleRewardAmount = missionInputData.minRewardAmount * (10n ** BigInt(decimals));
                const maxCompletions = missionInputData.maxTotalCompletions[0];
                const totalRewardAmount = singleRewardAmount * maxCompletions;
                const totalFees = fee * (maxCompletions + 1n); // +1 for the initial deposit
                const totalTransferAmount = totalRewardAmount + totalFees;

                const missionIdToUse = missionInputData.id ?? BigInt(Date.now());

                // Replicate backend subaccount generation logic
                const missionIdText = missionIdToUse.toString();
                const encoder = new TextEncoder();
                const prefixBytes = encoder.encode("konecta-mission");
                const missionIdBytes = encoder.encode(missionIdText);
                const combinedBytes = new Uint8Array(prefixBytes.length + missionIdBytes.length);
                combinedBytes.set(prefixBytes);
                combinedBytes.set(missionIdBytes, prefixBytes.length);
                const hashBuffer = await crypto.subtle.digest('SHA-256', combinedBytes);
                const subaccount = new Uint8Array(32);
                subaccount.set(new Uint8Array(hashBuffer));

                const toAccount = {
                    owner: Principal.fromText(projectId),
                    subaccount: [subaccount],
                };

                const transferArgs = {
                    from_subaccount: [],
                    to: toAccount,
                    amount: totalTransferAmount,
                    fee: [fee],
                    memo: [],
                    created_at_time: [],
                };

                notifications.show({
                    id: fundingNotificationId,
                    title: 'Funding Mission...',
                    message: `Please approve the transfer of ${Number(totalTransferAmount) / (10 ** decimals)} tokens to fund this mission.`,
                    color: 'blue',
                    loading: true,
                    autoClose: false,
                });

                const transferResult = await tokenActor.icrc1_transfer(transferArgs) as { Ok: bigint } | { Err: any };

                if ('Err' in transferResult) {
                    throw new Error(`Token transfer failed: ${JSON.stringify(transferResult.Err)}`);
                }

                notifications.update({
                    id: fundingNotificationId,
                    title: 'Funding Successful!',
                    message: 'Mission has been funded. Now creating the mission on-chain.',
                    color: 'green',
                    loading: false,
                    autoClose: 4000,
                });

            } catch (e) {
                const error = e as Error;
                console.error("Mission funding failed:", error);
                notifications.update({
                    id: fundingNotificationId,
                    title: 'Funding Failed',
                    message: error.message || 'An unknown error occurred during the token transfer.',
                    color: 'red',
                    loading: false,
                    autoClose: 8000,
                });
                setIsSubmittingForm(false);
                return; // Stop the process
            }
        }

        setIsSubmittingForm(true);

        try {
            // **MODIFIED**: Handle file uploads
            let iconInput: [] | [ImageUploadInput] = [];
            if (files.iconFile) {
                const content = await fileToUint8Array(files.iconFile);
                iconInput = [{ Asset: { originalFileName: files.iconFile.name, content } }];
                notifications.show({ id: 'icon-upload', title: "Processing Icon...", message: "Preparing icon for upload.", color: 'blue', loading: true, autoClose: 2000 });
            }

            let imageInput: [] | [ImageUploadInput] = [];
            if (files.imageFile) {
                const content = await fileToUint8Array(files.imageFile);
                imageInput = [{ Asset: { originalFileName: files.imageFile.name, content } }];
                notifications.show({ id: 'image-upload', title: "Processing Banner...", message: "Preparing banner for upload.", color: 'blue', loading: true, autoClose: 2000 });
            }

            const missionIdToUse: bigint = missionInputData.id ?? // ID from form (if creating with specific ID)
                editingMission?.id ??      // ID from existing mission being edited
                BigInt(Date.now());       // Fallback for new mission if no ID on form (adjust if backend assigns IDs)


            const {
                // 'id' is used as missionIdToUse, other fields are from missionInputData
                // **MODIFIED**: iconUrl and imageUrl are no longer in this object
                name, description, actionFlowJson, minRewardAmount, maxRewardAmount, rewardType,
                startTime, endTime, tags, requiredPreviousMissionId,
                requiredMissionLogic, isRecursive, recursiveTimeCooldown, maxCompletionsPerUser,
                maxTotalCompletions, status, priority
            } = missionInputData;

            // **MODIFIED**: Actual backend call with new image upload arguments
            const result = await projectActor.addOrUpdateMission(
                missionIdToUse, name, description, actionFlowJson, minRewardAmount, maxRewardAmount,
                rewardType, startTime, endTime,
                iconInput,  // 10th argument
                imageInput, // 11th argument
                tags, requiredPreviousMissionId,
                requiredMissionLogic, isRecursive, recursiveTimeCooldown, maxCompletionsPerUser,
                maxTotalCompletions, status, priority
            ) as Result_1;

            if (result && 'err' in result) {
                throw new Error(String(result.err));
            }

            notifications.show({ title: 'Success', message: `Mission ${editingMission ? 'updated' : 'created'} successfully.`, color: 'green' });

            let missionForCodeGen: SerializedMission;

            // **MODIFIED**: The constructed object for code gen won't have the new URLs immediately.
            // They will be populated on the next full fetch. We'll set them to empty arrays.
            const newIconUrl: [] | [string] = [];
            const newImageUrl: [] | [string] = [];

            if (editingMission && editingMission.id === missionIdToUse) {
                missionForCodeGen = {
                    ...editingMission,
                    id: missionIdToUse,
                    name, description, actionFlowJson, minRewardAmount, maxRewardAmount, rewardType, startTime, endTime,
                    iconUrl: newIconUrl, // Use new empty value
                    imageUrl: newImageUrl, // Use new empty value
                    tags, requiredPreviousMissionId, requiredMissionLogic, isRecursive,
                    recursiveTimeCooldown, maxCompletionsPerUser, maxTotalCompletions, status, priority,
                    updates: [...editingMission.updates, [BigInt(Date.now()) * NANO_PER_MILLISECOND, user.user?.principal!]],
                };
            } else {
                missionForCodeGen = {
                    name, description, actionFlowJson, minRewardAmount, maxRewardAmount, rewardType, startTime, endTime,
                    iconUrl: newIconUrl, imageUrl: newImageUrl, // Use new empty values
                    tags, requiredPreviousMissionId, requiredMissionLogic, isRecursive,
                    recursiveTimeCooldown, maxCompletionsPerUser, maxTotalCompletions, status, priority,
                    id: missionIdToUse,
                    creationTime: BigInt(Date.now()) * NANO_PER_MILLISECOND,
                    creator: user.user?.principal!,
                    currentTotalCompletions: 0n,
                    usersWhoCompletedCount: [],
                    updates: [[BigInt(Date.now()) * NANO_PER_MILLISECOND, user.user?.principal!]],
                };
            }

            // --- Code generation logic ---
            let actionInstanceToShowCodeFor: ActionInstance | undefined = undefined;
            if (missionForCodeGen.actionFlowJson) {
                try {
                    const parsedActionFlow: ActionFlow = JSON.parse(missionForCodeGen.actionFlowJson);
                    if (parsedActionFlow && Array.isArray(parsedActionFlow.steps)) {
                        for (const step of parsedActionFlow.steps) {
                            if ('SingleAction' in step.item &&
                                step.item['SingleAction'].actionDefinitionId === 'custom_action_canister_call_v1') {
                                actionInstanceToShowCodeFor = step.item['SingleAction'];
                                break;
                            }
                        }
                    }
                } catch (jsonError) {
                    console.error("Error parsing actionFlowJson for mission code generation:", missionForCodeGen.id, jsonError);
                    notifications.show({ title: "Code Gen Warning", message: "Could not parse action flow for code generation.", color: 'orange' });
                }
            }

            if (actionInstanceToShowCodeFor) {
                setGeneratedCodeInfo({
                    mission: missionForCodeGen,
                    customActionInstance: actionInstanceToShowCodeFor
                });
                setShowGeneratedCodeModal(true);
            }
            // --- End code generation logic ---

            await fetchMissions();
            handleCloseFormModal();

        } catch (e) {
            const error = e as Error;
            console.error("Failed to save mission:", error);
            notifications.show({ title: 'Error Saving Mission', message: error.message || 'An unknown error occurred.', color: 'red' });
        } finally {
            setIsSubmittingForm(false);
        }
    };

    const handleDeleteMission = async (missionId: bigint) => {
        setIsLoadingDelete(true);

        if (!projectId || !projectActor) {
            notifications.show({ title: 'Error', message: 'Project actor or Project ID context is missing.', color: 'red' });
            return;
        }

        try {
            const result = await projectActor.deleteMission(missionId) as Result_1;

            if (result && 'err' in result) {
                throw new Error(String(result.err));
            }

            await fetchMissions();
        } catch (e) {
            const error = e as Error;
            console.error("Failed to delete mission:", error);
            notifications.show({ title: 'Error Deleting Mission', message: `An unknown error occurred while deleting mission with ID ${missionId}.`, color: 'red' });
        }

        setIsLoadingDelete(false);
    };

    const getStatusColor = (statusObject: MissionStatus) => {
        const status = Object.keys(statusObject)[0] as keyof MissionStatus;
        switch (status) {
            case 'Active': return 'green';
            case 'Draft': return 'gray';
            case 'Completed': return 'blue';
            case 'Expired': return 'red';
            case 'Paused': return 'orange';
            default: return 'gray';
        }
    };

    const renderRewardText = (rewardType: RewardType, amountMin: bigint, amountMaxOpt?: [] | [bigint]) => {
        const amountMax = (amountMaxOpt && amountMaxOpt.length > 0) ? amountMaxOpt[0] : undefined;
        let amountText = (amountMax && amountMax > amountMin) ? `${amountMin}-${amountMax}` : `${amountMin}`;
        const typeKey = Object.keys(rewardType)[0] as keyof RewardType;

        switch (typeKey) {
            case 'Points': return `${amountText} Points`;
            case 'ICPToken': return `${amountText} ICP`;
            case 'TIME': return `${amountText} TIME`;
            case 'None': return 'No Reward';
            default: return `${amountText} ${typeKey}`;
        }
    };

    const renderRewardBadge = (mission: SerializedMission) => {
        const typeKey = Object.keys(mission.rewardType)[0] as keyof RewardType;
        const color = typeKey === 'ICPToken' || typeKey === 'TIME' ? 'yellow' :
            typeKey === 'Points' ? 'blue' : 'gray';
        const icon = typeKey === 'ICPToken' || typeKey === 'TIME' ? <IconCurrencyDollar size={14} /> : <IconGift size={14} />;
        return (
            <Badge color={color} variant="light" leftSection={icon}>
                {renderRewardText(mission.rewardType, mission.minRewardAmount, mission.maxRewardAmount)}
            </Badge>
        );
    };

    if (loading && missions.length === 0) return <Box p="md" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 'calc(100vh - 200px)' }}><Loader size="xl" /></Box>;
    if (error && missions.length === 0) return <Box p="md"><Alert icon={<IconAlertCircle size="1rem" />} title="Error!" color="red" radius="md">{error}</Alert></Box>;

    const rows = missions.map((mission) => (
        <Table.Tr key={String(mission.id)}>
            <Table.Td>
                <Group gap="sm" wrap="nowrap">
                    <Avatar src={"https://" + projectId + ".raw.icp0.io" + mission.iconUrl?.[0]} alt={mission.name} radius="xl" size="md">{mission.name ? mission.name.charAt(0) : 'M'}</Avatar>
                    <Text fw={500} size="sm" truncate maw={200}>{mission.name}</Text>
                </Group>
            </Table.Td>
            <Table.Td>{renderRewardBadge(mission)}</Table.Td>
            <Table.Td><Badge color={getStatusColor(mission.status)} variant="light">{Object.keys(mission.status)[0]}</Badge></Table.Td>
            <Table.Td>
                {mission.isRecursive ?
                    <Tooltip label={`Cooldown: ${mission.recursiveTimeCooldown?.[0] ? (Number(mission.recursiveTimeCooldown[0] / NANO_PER_MILLISECOND) / 1000).toFixed(1) + 's' : 'N/A'}`}>
                        <IconRepeat size={16} />
                    </Tooltip>
                    : '-'}
            </Table.Td>
            <Table.Td>{mission.tags?.[0] && mission.tags[0].length > 0 ? mission.tags[0].slice(0, 2).map(tag => <Badge key={tag} variant="outline" color="gray" mr={4}>{tag}</Badge>) : '-'}</Table.Td>
            <Table.Td><Text size="xs">{new Date(Number(BigInt(mission.creationTime || 0n) / NANO_PER_MILLISECOND)).toLocaleDateString()}</Text></Table.Td>
            <Table.Td>
                <Group gap={4} justify="flex-end" wrap="nowrap">
                    <Tooltip label="View Details" withArrow><ActionIcon variant="subtle" onClick={() => handleOpenViewModal(mission)}><IconEye size={16} /></ActionIcon></Tooltip>
                    <Tooltip label="Edit Mission" withArrow><ActionIcon variant="subtle" color="blue" onClick={() => handleOpenEditModal(mission)} disabled={loadingActionDefinitions}><IconPencil size={16} /></ActionIcon></Tooltip>
                    <Tooltip label="Delete Mission" withArrow><ActionIcon variant="subtle" color="red" loading={isLoadingDelete} onClick={() => handleDeleteMission(mission.id)}><IconTrash size={16} /></ActionIcon></Tooltip>
                </Group>
            </Table.Td>
        </Table.Tr>
    ));

    const handleDownloadIdlFile = () => {
        const blob = new Blob([STATIC_MOTOKO_IDL_CONTENT], { type: 'text/plain;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'mission_action_interface.mo';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    };

    return (
        <Box p="md">
            <Group justify="space-between" mb="xl">
                <Title order={2}>Missions {projectId && <Text span c="blue" inherit> (Project: {projectId.substring(0, 5)}...)</Text>}</Title>
                <Button
                    leftSection={<IconPlus size={16} />}
                    onClick={handleOpenCreateModal}
                    disabled={loadingActionDefinitions}
                >
                    {loadingActionDefinitions ? 'Loading Actions...' : 'Create Mission'}
                </Button>
            </Group>

            {error && missions.length > 0 && /* Show non-critical error if missions are already displayed */
                <Alert icon={<IconAlertCircle size="1rem" />} title="Error Notice" color="red" radius="md" mb="md" withCloseButton onClose={() => setError(null)}>{error}</Alert>
            }

            {missions.length === 0 && !loading ? (
                <Paper withBorder p="xl" style={{ textAlign: 'center' }}>
                    <IconTargetArrow size={48} stroke={1.5} style={{ opacity: 0.5 }} />
                    <Text size="lg" mt="md">No missions yet for this project.</Text>
                    <Text c="dimmed">Get started by creating a new mission.</Text>
                    <Button mt="xl" onClick={handleOpenCreateModal}>Create Your First Mission</Button>
                </Paper>
            ) : (
                <Paper shadow="sm" p={0} withBorder>
                    <ScrollArea>
                        <Table striped highlightOnHover verticalSpacing="sm" miw={900}>
                            <Table.Thead>
                                <Table.Tr>
                                    <Table.Th>Name</Table.Th>
                                    <Table.Th>Reward</Table.Th>
                                    <Table.Th>Status</Table.Th>
                                    <Table.Th>Recursive</Table.Th>
                                    <Table.Th>Tags</Table.Th>
                                    <Table.Th>Created</Table.Th>
                                    <Table.Th style={{ textAlign: 'right' }}>Actions</Table.Th>
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>{rows}</Table.Tbody>
                        </Table>
                    </ScrollArea>
                </Paper>
            )}

            <MissionFormModal
                opened={isFormModalOpen}
                onClose={handleCloseFormModal}
                onSubmit={handleFormSubmit as any} // Cast if type mismatch is complex and intended to be handled
                initialMissionData={editingMission} // Use frontend SerializedMission
                existingMissionId={editingMission ? editingMission.id : null}
                projectId={projectId || ''}
                actionDefinitions={actionDefinitions}
            />

            <MissionViewModal
                opened={isViewModalOpen}
                onClose={handleCloseViewModal}
                mission={viewingMission}
                actionDefinitions={actionDefinitions}
                id={viewingMission ? viewingMission.id : null}
                projectId={projectId}
            />

            {generatedCodeInfo && (
                <Modal
                    opened={showGeneratedCodeModal}
                    onClose={() => {
                        setShowGeneratedCodeModal(false);
                        setGeneratedCodeInfo(null);
                    }}
                    title={`Integration Code for Mission: ${generatedCodeInfo.mission.name}`}
                    size="xl"
                    centered
                    scrollAreaComponent={ScrollArea.Autosize}
                    mah="90vh"
                >
                    <Stack gap="lg">
                        <Text size="sm">
                            Use the following code snippets to integrate the custom canister call action.
                            The <code>.mo</code> file is a sample interface, and the TypeScript (<code>.ts</code>) snippet
                            shows how to trigger this configured action from your frontend.
                        </Text>
                        <CodeHighlightTabs
                            code={[
                                { fileName: 'mission_action_interface.mo', code: STATIC_MOTOKO_IDL_CONTENT, language: 'motoko', icon: <IconCode size={16} /> },
                                { fileName: 'frontend_trigger.ts', code: generateFrontendTriggerSnippet(generatedCodeInfo.mission, generatedCodeInfo.customActionInstance), language: 'typescript', icon: <IconFileTypeTsx size={16} /> },
                            ]}
                        />
                        <Text size="xs" c="dimmed" mt="sm">
                            <strong>Note:</strong> For the TypeScript snippet, ensure you replace placeholder values
                            (like the Mission Platform Canister ID and its IDL factory) with your actual integration details.
                            For optimal syntax highlighting, ensure an adapter (e.g., Shiki with Motoko language support)
                            is configured for <code>@mantine/code-highlight</code> in your application's root.
                        </Text>

                        <Button onClick={handleDownloadIdlFile} leftSection={<IconDownload size={16} />} variant="outline" mt="md"> Download mission_action_interface.mo </Button>
                        <Group justify="flex-end" mt="xl">
                            <Button variant="default" onClick={() => { setShowGeneratedCodeModal(false); setGeneratedCodeInfo(null); }}> Close </Button>
                        </Group>
                    </Stack>
                </Modal>
            )}
        </Box>
    );
};

export default MissionsPage;