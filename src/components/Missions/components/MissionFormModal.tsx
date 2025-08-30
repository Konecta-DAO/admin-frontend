import React, { useEffect, useState } from 'react';
import {
    Modal, Stack, TextInput, Textarea, Select, NumberInput, Checkbox,
    Group, Button, Divider, Title, Text, ScrollArea, FileInput,
    Avatar, Image, TagsInput, Alert,
} from '@mantine/core';
import { useForm, zodResolver } from '@mantine/form';
import { IconAlertCircle, IconUpload } from '@tabler/icons-react';
import { z } from 'zod';
import { ActionFlow } from '../types.ts'; // Assuming ActionFlow is correctly defined
import { DateTimePicker } from '@mantine/dates';
import ActionFlowBuilder from './ActionFlowBuilder.tsx';
import { notifications } from '@mantine/notifications';
// Make sure MissionStatus is the variant type from .did.js, e.g., { Draft: null } | { Active: null }
import { MissionStatus as BackendMissionStatus, RewardType, SerializedMission } from '../../../declarations/projectCanister/test_backend.did.js';
import { SerializedActionDefinition } from '../../../declarations/actionsCanister/actions.did.js';
import { prepareActionFlowForBackend } from '../utils.ts';

const NANO_PER_MILLISECOND = 1_000_000n; // Use BigInt for precision

export interface FileUploads {
    iconFile?: File | null;
    imageFile?: File | null;
}

// Define a string union type for form status, as Select and initialValues use strings
type FormMissionStatus = 'Draft' | 'Active' | 'Paused' | 'Completed' | 'Archived';
const missionStatusOptions = ['Draft', 'Active', 'Paused', 'Completed', 'Archived'] as const;


// This interface represents the structure of the form's values
export interface MissionFormValues {
    name: string;
    description: string;
    actionFlow: ActionFlow;
    actionFlowJson?: string;
    minRewardAmount: number;
    maxRewardAmount?: number;
    rewardTypeSelection: 'Points' | 'ICPToken' | 'TIME' | 'None';
    rewardIcpCanisterId?: string;
    rewardIcpMemo?: string;
    startTime: Date; // No longer nullable as it's required
    endTime?: Date | null;
    status: FormMissionStatus; // Changed to use the string union type for form state
    imageUrl?: string;
    iconUrl?: string;
    iconFile?: File | null;
    imageFile?: File | null;
    tags?: string[];
    requiredPreviousMissionId?: number[];
    requiredMissionLogic?: 'All' | 'Any';
    isRecursive: boolean;
    recursiveTimeCooldown?: number;
    maxCompletionsPerUser?: number;
    maxTotalCompletions?: number;
    priority?: number;
}

export interface MissionFormModalProps {
    opened: boolean;
    onClose: () => void;
    onSubmit: (
        values: Omit<SerializedMission, 'creationTime' | 'updates' | 'currentTotalCompletions' | 'creator' | 'projectId' | 'usersWhoCompletedCount'> & { id?: bigint }, // Add 'usersWhoCompletedCount' here
        filesToUpload: FileUploads
    ) => Promise<void>;
    initialMissionData?: SerializedMission | null;
    existingMissionId?: bigint | null;
    projectId: string;
    actionDefinitions: SerializedActionDefinition[];
}

// Enhanced Zod schema
const schema = z.object({
    name: z.string().min(3, 'Name must be at least 3 characters long'),
    description: z.string().min(1, 'Description is required'),
    actionFlow: z.custom<ActionFlow>(
        // Made validator safer
        (val) => !!val && Array.isArray(val.steps) && val.steps.length > 0,
        "Action flow must have at least one step"
    ),
    minRewardAmount: z.number().min(0, 'Min reward must be non-negative'),
    maxRewardAmount: z.number().min(0, 'Max reward must be non-negative').optional().nullable(),
    rewardTypeSelection: z.enum(['Points', 'ICPToken', 'TIME', 'None'], { required_error: "Reward type is required" }),
    rewardIcpCanisterId: z.string().optional(),
    rewardIcpMemo: z.string().refine(val => !val || /^\d+$/.test(val), { message: "Memo must be a non-negative integer string" }).optional(),
    startTime: z.date({ required_error: "Start time is required" }), // No longer nullable
    endTime: z.date().nullable().optional(),
    status: z.enum(missionStatusOptions, { required_error: "Status is required" }),
    // URL fields are no longer direct inputs
    iconFile: z.custom<File>().nullable().optional(),
    imageFile: z.custom<File>().nullable().optional(),
    tags: z.array(z.string()).optional(),
    requiredPreviousMissionId: z.array(z.number().positive()).optional(),
    requiredMissionLogic: z.enum(['All', 'Any']).optional(),
    isRecursive: z.boolean(),
    recursiveTimeCooldown: z.number().min(1, "Cooldown must be positive if recursive").optional().nullable(),
    maxCompletionsPerUser: z.number().min(1).optional().nullable(),
    maxTotalCompletions: z.number().min(1).optional().nullable(),
    priority: z.number().min(0).optional().nullable(),
}).refine(data => {
    if (data.rewardTypeSelection === 'ICPToken' && !data.rewardIcpCanisterId) {
        return false;
    }
    return true;
}, {
    message: "Canister ID is required for ICP Token rewards.",
    path: ['rewardIcpCanisterId']
}).refine(data => {
    if (data.endTime && data.startTime && data.endTime < data.startTime) {
        return false;
    }
    return true;
}, {
    message: "End time cannot be before start time.",
    path: ['endTime'],
}).refine(data => {
    if (data.isRecursive && (data.recursiveTimeCooldown === undefined || data.recursiveTimeCooldown === null || data.recursiveTimeCooldown <= 0)) {
        return false;
    }
    return true;
}, {
    message: "Recursive cooldown (ms) is required and must be positive if mission is recursive.",
    path: ['recursiveTimeCooldown'],
}).refine(data => {
    if (data.rewardTypeSelection === 'ICPToken' && (!data.maxTotalCompletions || data.maxTotalCompletions <= 0)) {
        return false;
    }
    return true;
}, {
    message: "Max Total Completions is required and must be positive for token rewards.",
    path: ['maxTotalCompletions'],
});

const getDefaultActionFlow = (): ActionFlow => ({
    name: "New Mission Flow",
    steps: [],
    completionLogic: { type: 'AllInOrder' },
    edges: [],
});

const MissionFormModal: React.FC<MissionFormModalProps> = ({
    opened, onClose, onSubmit, initialMissionData, existingMissionId, projectId, actionDefinitions,
}) => {
    const [iconPreview, setIconPreview] = useState<string | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isClient, setIsClient] = useState(false);
    const [isSubmittingForm, setIsSubmittingForm] = useState(false);
    const [submissionAttempted, setSubmissionAttempted] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    const form = useForm<MissionFormValues>({
        initialValues: {
            name: '', description: '',
            actionFlow: getDefaultActionFlow(),
            minRewardAmount: 10,
            startTime: new Date(),
            status: 'Draft', // Uses FormMissionStatus (string)
            isRecursive: false,
            iconUrl: '', imageUrl: '', iconFile: null, imageFile: null,
            tags: [],
            rewardTypeSelection: 'Points',
            rewardIcpCanisterId: '',
            rewardIcpMemo: '',
            requiredPreviousMissionId: [],
            requiredMissionLogic: 'All',
            maxRewardAmount: undefined,
            recursiveTimeCooldown: undefined,
            maxCompletionsPerUser: undefined,
            maxTotalCompletions: undefined,
            priority: undefined,
        },
        validate: zodResolver(schema),
    });

    useEffect(() => {
        if (opened) {
            setIsSubmittingForm(false);
            setSubmissionAttempted(false);
            form.setErrors({}); // Clear all errors, including root

            // Check if editing an existing mission
            if (initialMissionData && (existingMissionId !== undefined && existingMissionId !== null)) {
                let StoredActionFlowObject: Partial<ActionFlow> = {};
                if (initialMissionData.actionFlowJson) {
                    try {
                        StoredActionFlowObject = JSON.parse(initialMissionData.actionFlowJson);
                    } catch (e) {
                        console.error("CRITICAL: Failed to parse actionFlowJson. Mission ID:", existingMissionId, "Error:", e);
                    }
                }

                const defaultFlow = getDefaultActionFlow();
                const currentSteps = Array.isArray(StoredActionFlowObject.steps) && StoredActionFlowObject.steps.length > 0
                    ? StoredActionFlowObject.steps
                    : defaultFlow.steps;
                const currentEdges = Array.isArray(StoredActionFlowObject.edges)
                    ? StoredActionFlowObject.edges
                    : defaultFlow.edges;

                const robustActionFlow: ActionFlow = {
                    name: StoredActionFlowObject.name ?? defaultFlow.name,
                    steps: currentSteps,
                    completionLogic: StoredActionFlowObject.completionLogic?.type
                        ? StoredActionFlowObject.completionLogic
                        : defaultFlow.completionLogic,
                    edges: currentEdges,
                };

                let currentRewardTypeSelection: MissionFormValues['rewardTypeSelection'] = 'None';
                let currentRewardIcpCanisterId: string | undefined = '';
                let currentRewardIcpMemo: string | undefined = '';

                if (initialMissionData.rewardType) {
                    if ('Points' in initialMissionData.rewardType) {
                        currentRewardTypeSelection = 'Points';
                    } else if ('ICPToken' in initialMissionData.rewardType) {
                        currentRewardTypeSelection = 'ICPToken';
                        currentRewardIcpCanisterId = initialMissionData.rewardType.ICPToken.canisterId;
                        if (initialMissionData.rewardType.ICPToken.memo && initialMissionData.rewardType.ICPToken.memo[0] !== undefined) {
                            currentRewardIcpMemo = String(initialMissionData.rewardType.ICPToken.memo[0]);
                        }
                    } else if ('TIME' in initialMissionData.rewardType) {
                        currentRewardTypeSelection = 'TIME';
                    } else if ('None' in initialMissionData.rewardType) {
                        currentRewardTypeSelection = 'None';
                    }
                }

                // Convert backend status variant to form's string status
                const formStatus: FormMissionStatus = initialMissionData.status
                    ? (Object.keys(initialMissionData.status)[0] as FormMissionStatus)
                    : 'Draft';

                form.setValues({
                    name: initialMissionData.name,
                    description: initialMissionData.description,
                    actionFlow: robustActionFlow,
                    minRewardAmount: Number(initialMissionData.minRewardAmount),
                    maxRewardAmount: initialMissionData.maxRewardAmount[0] !== undefined ? Number(initialMissionData.maxRewardAmount[0]) : undefined,
                    rewardTypeSelection: currentRewardTypeSelection,
                    rewardIcpCanisterId: currentRewardIcpCanisterId,
                    rewardIcpMemo: currentRewardIcpMemo,
                    startTime: initialMissionData.startTime ? new Date(Number(initialMissionData.startTime) / Number(NANO_PER_MILLISECOND)) : new Date(),
                    endTime: initialMissionData.endTime[0] !== undefined ? new Date(Number(initialMissionData.endTime[0]) / Number(NANO_PER_MILLISECOND)) : null,
                    status: formStatus,
                    imageUrl: initialMissionData.imageUrl[0] ?? '',
                    iconUrl: initialMissionData.iconUrl[0] ?? '',
                    tags: initialMissionData.tags[0] ?? [],
                    requiredPreviousMissionId: initialMissionData.requiredPreviousMissionId[0]
                        ? initialMissionData.requiredPreviousMissionId[0].map(id => Number(id))
                        : [],
                    requiredMissionLogic: initialMissionData.requiredMissionLogic[0]
                        ? (Object.keys(initialMissionData.requiredMissionLogic[0])[0] as 'All' | 'Any')
                        : 'All',
                    isRecursive: initialMissionData.isRecursive,
                    recursiveTimeCooldown: initialMissionData.recursiveTimeCooldown[0] !== undefined
                        ? Number(initialMissionData.recursiveTimeCooldown[0]) / Number(NANO_PER_MILLISECOND)
                        : undefined,
                    maxCompletionsPerUser: initialMissionData.maxCompletionsPerUser[0] !== undefined
                        ? Number(initialMissionData.maxCompletionsPerUser[0])
                        : undefined,
                    maxTotalCompletions: initialMissionData.maxTotalCompletions[0] !== undefined
                        ? Number(initialMissionData.maxTotalCompletions[0])
                        : undefined,
                    priority: initialMissionData.priority[0] !== undefined
                        ? Number(initialMissionData.priority[0])
                        : undefined,
                    iconFile: null,
                    imageFile: null,
                });
                setIconPreview(initialMissionData.iconUrl[0] ? "https://" + projectId + ".raw.icp0.io" + initialMissionData.iconUrl[0] : null);
                setImagePreview(initialMissionData.imageUrl[0] ? "https://" + projectId + ".raw.icp0.io" + initialMissionData.imageUrl[0] : null);
            } else { // Creating a new mission
                form.reset();
                form.setFieldValue('actionFlow', getDefaultActionFlow());
                form.setFieldValue('startTime', new Date());
                form.setFieldValue('status', 'Draft');
                form.setFieldValue('rewardTypeSelection', 'Points');
                form.setFieldValue('requiredMissionLogic', 'All');
                setIconPreview(null);
                setImagePreview(null);
            }
        }
    }, [initialMissionData, existingMissionId, opened]); // form is intentionally omitted as per original code, review if needed


    const handleFileChange = (file: File | null, field: 'iconFile' | 'imageFile', previewSetter: React.Dispatch<React.SetStateAction<string | null>>, urlField: 'iconUrl' | 'imageUrl') => {
        form.setFieldValue(field, file);
        // Clear the URL field in the form state so we don't use a stale URL.
        form.setFieldValue(urlField, '');

        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => previewSetter(reader.result as string);
            reader.readAsDataURL(file);
        } else {
            // If the file is cleared, revert the *preview* to the original image URL, but the form will submit it as empty.
            previewSetter(initialMissionData?.[urlField]?.[0] ?? null);
        }
    };

    const handleActualFormSubmit = async (values: MissionFormValues) => {
        console.log("--- handleActualFormSubmit triggered ---");
        console.log("Form values at submission:", JSON.parse(JSON.stringify(values, (key, value) => typeof value === 'bigint' ? value.toString() : value)));
        setIsSubmittingForm(true);

        const {
            iconFile, imageFile,
            // **MODIFIED**: Destructure URL fields to exclude them from the base data object
            iconUrl, imageUrl,
            rewardTypeSelection, rewardIcpCanisterId, rewardIcpMemo,
            actionFlow,
            ...missionFormValuesBase
        } = values;

        let finalBackendRewardType: RewardType;

        switch (rewardTypeSelection) {
            case 'Points':
                finalBackendRewardType = { 'Points': null };
                break;
            case 'ICPToken':
                if (!rewardIcpCanisterId) {
                    form.setFieldError('rewardIcpCanisterId', 'Canister ID is required for ICP Token reward.');
                    setIsSubmittingForm(false);
                    return;
                }
                interface ICPTPayload {
                    canisterId: string;
                    memo: [] | [bigint];
                }
                const icpPayload: ICPTPayload = { canisterId: rewardIcpCanisterId, memo: [] };
                if (rewardIcpMemo && rewardIcpMemo.trim() !== '') {
                    try {
                        const memoBigInt = BigInt(rewardIcpMemo);
                        icpPayload.memo = [memoBigInt];
                    } catch (e) {
                        form.setFieldError('rewardIcpMemo', 'Memo must be a valid Nat64 (large non-negative integer).');
                        setIsSubmittingForm(false);
                        return;
                    }
                } else {
                    icpPayload.memo = [];
                }
                finalBackendRewardType = { 'ICPToken': icpPayload };
                break;
            case 'TIME':
                finalBackendRewardType = { 'TIME': null };
                break;
            case 'None':
                finalBackendRewardType = { 'None': null };
                break;
            default:
                notifications.show({ title: 'Error', message: 'Invalid reward type selected.', color: 'red' });
                setIsSubmittingForm(false);
                return;
        }

        const filesToUpload: FileUploads = { iconFile, imageFile };

        // Convert form's string status to backend's variant status
        const backendStatus: BackendMissionStatus = { [values.status]: null } as BackendMissionStatus;

        const backendReadyActionFlow = prepareActionFlowForBackend(actionFlow);

        const dataToSubmit = {
            ...missionFormValuesBase,
            startTime: BigInt(values.startTime.getTime()) * NANO_PER_MILLISECOND, // Safe now that startTime is required
            endTime: ((values.endTime)
                ? [BigInt(values.endTime.getTime()) * NANO_PER_MILLISECOND]
                : []) as [bigint] | [],
            actionFlowJson: JSON.stringify(backendReadyActionFlow, null, 2),
            rewardType: finalBackendRewardType,
            minRewardAmount: BigInt(values.minRewardAmount),
            maxRewardAmount: ((values.maxRewardAmount !== undefined && values.maxRewardAmount !== null)
                ? [BigInt(values.maxRewardAmount)]
                : []) as [bigint] | [],
            status: backendStatus,
            tags: ((values.tags && values.tags.length > 0)
                ? [values.tags]
                : []) as [string[]] | [],
            requiredPreviousMissionId: ((values.requiredPreviousMissionId && values.requiredPreviousMissionId.length > 0)
                ? [values.requiredPreviousMissionId.map(id => BigInt(id))]
                : []) as [bigint[]] | [], // Explicit cast here
            requiredMissionLogic: ((values.requiredPreviousMissionId && values.requiredPreviousMissionId.length > 0 && values.requiredMissionLogic)
                ? [{ [values.requiredMissionLogic]: null } as { All: null } | { Any: null }]
                : []) as [] | [{ All: null } | { Any: null }], // Explicit cast here
            isRecursive: values.isRecursive,
            recursiveTimeCooldown: ((values.recursiveTimeCooldown !== undefined && values.recursiveTimeCooldown !== null)
                ? [BigInt(Math.round(values.recursiveTimeCooldown)) * NANO_PER_MILLISECOND]
                : []) as [bigint] | [],
            maxCompletionsPerUser: ((values.maxCompletionsPerUser !== undefined && values.maxCompletionsPerUser !== null)
                ? [BigInt(values.maxCompletionsPerUser)]
                : []) as [bigint] | [],
            maxTotalCompletions: ((values.maxTotalCompletions !== undefined && values.maxTotalCompletions !== null)
                ? [BigInt(values.maxTotalCompletions)]
                : []) as [bigint] | [],
            priority: ((values.priority !== undefined && values.priority !== null)
                ? [BigInt(values.priority)]
                : []) as [bigint] | [],
        };

        // Use existingMissionId for the submission ID
        const missionIdForSubmission = existingMissionId ?? undefined;

        try {
            const submissionPayload = {
                ...(missionIdForSubmission !== undefined ? { id: missionIdForSubmission } : {}),
                ...dataToSubmit,
            };
            console.log("Payload being sent to parent onSubmit:", JSON.parse(JSON.stringify(submissionPayload, (key, value) => typeof value === 'bigint' ? value.toString() : value)));
            await onSubmit(submissionPayload as any, filesToUpload); // Cast to any if strict type checking on Omit keys is too complex here

        } catch (e) {
            console.error("Submission failed:", e);
            // Set a root error on the form for visibility
            form.setErrors({ root: `Submission failed: ${e instanceof Error ? e.message : 'Please try again.'}` });
        } finally {
            console.log("--- handleActualFormSubmit finished ---");
            setIsSubmittingForm(false);
        }
    };

    const handleValidationErrors = (errors: typeof form.errors) => {
        console.log("--- Form validation FAILED ---");
        console.error("Validation errors object:", errors);
        notifications.show({
            title: 'Invalid Form Data',
            message: 'Please review the form. Some fields have errors that need to be corrected before submission.',
            color: 'red',
            icon: <IconAlertCircle />,
        });
    };

    const isEditing = existingMissionId !== undefined && existingMissionId !== null;

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title={isEditing ? 'Edit Mission' : 'Create New Mission'}
            size="xl"
            overlayProps={{ backgroundOpacity: 0.55, blur: 3 }}
            centered
            scrollAreaComponent={ScrollArea.Autosize}
            styles={{ body: { paddingTop: 'var(--mantine-spacing-lg)', paddingBottom: 'var(--mantine-spacing-lg)' } }}
        >
            <form
                onSubmit={(e) => {
                    setSubmissionAttempted(true); // Mark that a submission has been tried
                    form.onSubmit(handleActualFormSubmit, handleValidationErrors)(e);
                }}
            >
                <Stack gap="lg">
                    <Title order={4}>Basic Information</Title>
                    <TextInput required label="Mission Name" placeholder="e.g., Daily Login Bonus" {...form.getInputProps('name')} />
                    <Textarea required label="Description (Markdown supported)" placeholder="Detailed mission instructions..." autosize minRows={3} {...form.getInputProps('description')} />
                    <Group grow align="flex-start">
                        <Stack gap="xs">
                            <FileInput label="Icon (Optional)" placeholder="Upload icon" leftSection={<IconUpload size={16} />} accept="image/*" onChange={(file) => handleFileChange(file, 'iconFile', setIconPreview, 'iconUrl')} clearable />
                            {(iconPreview) && (
                                <Avatar src={iconPreview} size="lg" radius="sm" />
                            )}
                        </Stack>
                        <Stack gap="xs">
                            <FileInput label="Banner Image (Optional)" placeholder="Upload image" leftSection={<IconUpload size={16} />} accept="image/*" onChange={(file) => handleFileChange(file, 'imageFile', setImagePreview, 'imageUrl')} clearable />
                            {(imagePreview) && (
                                <Image src={imagePreview} radius="sm" h={60} w="auto" fit="contain" />
                            )}
                        </Stack>
                    </Group>
                    <TagsInput
                        label="Tags (Optional)"
                        placeholder="Add tags and press Enter"
                        value={form.values.tags || []} // Ensure it's always an array
                        onChange={(newTags) => form.setFieldValue('tags', newTags)}
                        clearable
                    />

                    <Divider label="Reward Configuration" labelPosition="center" my="md" />
                    <Select
                        label="Reward Type"
                        data={[
                            { value: 'Points', label: 'Points' },
                            { value: 'ICPToken', label: 'ICP Token' },
                            { value: 'TIME', label: 'TIME' },
                            { value: 'None', label: 'None' },
                        ]}
                        {...form.getInputProps('rewardTypeSelection')}
                        onChange={(value) => {
                            form.setFieldValue('rewardTypeSelection', value as MissionFormValues['rewardTypeSelection']);
                            if (value !== 'ICPToken') {
                                form.setFieldValue('rewardIcpCanisterId', '');
                                form.setFieldValue('rewardIcpMemo', '');
                            }
                        }}
                        required
                    />
                    {form.values.rewardTypeSelection === 'ICPToken' && (
                        <>
                            <TextInput required label="ICP Token Canister ID" placeholder="Enter canister ID" {...form.getInputProps('rewardIcpCanisterId')} mt="sm" />
                            <TextInput label="ICP Token Memo (Optional, numeric)" placeholder="Enter memo (e.g., a Nat64 as string)" type="text" {...form.getInputProps('rewardIcpMemo')} mt="sm" />
                        </>
                    )}
                    <Group grow>
                        <NumberInput required label={form.values.rewardTypeSelection === "ICPToken" ? "Min Reward Amount [1 ICP = 100,000,000]" : "Min Reward Amount"} min={0} {...form.getInputProps('minRewardAmount')} />
                        <NumberInput label={form.values.rewardTypeSelection === "ICPToken" ? "Max Reward Amount (Optional) [1 ICP = 100,000,000]" : "Max Reward Amount (Optional)"} min={form.values.minRewardAmount || 0} {...form.getInputProps('maxRewardAmount')} />
                    </Group>

                    <Divider label="Scheduling & Behavior" labelPosition="center" my="md" />
                    <Group grow>
                        <DateTimePicker label="Start Time" placeholder="Mission start date and time" {...form.getInputProps('startTime')} required />
                        <DateTimePicker clearable label="End Time (Optional)" placeholder="Mission end date and time" minDate={form.values.startTime || undefined} {...form.getInputProps('endTime')} />
                    </Group>
                    <Checkbox label="Is this a recursive mission?" {...form.getInputProps('isRecursive', { type: 'checkbox' })} />
                    {form.values.isRecursive && <NumberInput label="Recursive Cooldown (in milliseconds)" placeholder="e.g., 86400000 for 1 day" min={1} {...form.getInputProps('recursiveTimeCooldown')} required={form.values.isRecursive} />}
                    <Group grow>
                        <NumberInput label="Max Completions Per User (Optional)" min={1} {...form.getInputProps('maxCompletionsPerUser')} />
                        <NumberInput
                            label="Max Total Completions"
                            description={form.values.rewardTypeSelection === 'ICPToken' ? "Required to pre-fund token rewards" : "Optional limit for this mission"}
                            min={1}
                            {...form.getInputProps('maxTotalCompletions')}
                            required={form.values.rewardTypeSelection === 'ICPToken'}
                        />
                    </Group>
                    <TagsInput
                        label="Required Previous Mission IDs (Optional, numeric)"
                        placeholder="Enter mission IDs and press Enter"
                        value={(form.values.requiredPreviousMissionId || []).map(String)}
                        onChange={(newStringIds) => {
                            const numericIds = newStringIds
                                .map(s => parseInt(s, 10))
                                .filter(idNum => !isNaN(idNum) && idNum > 0);
                            form.setFieldValue('requiredPreviousMissionId', numericIds);
                        }}
                        clearable
                    />
                    {form.values.requiredPreviousMissionId && form.values.requiredPreviousMissionId.length > 0 && (
                        <Select
                            label="Logic for Previous Missions"
                            data={[{ value: 'All', label: 'All Required' }, { value: 'Any', label: 'Any Required' }]}
                            {...form.getInputProps('requiredMissionLogic')}
                        // defaultValue="All" // Value is controlled by form.getInputProps
                        />
                    )}

                    <Divider label="Action Flow Configuration" labelPosition="center" my="md" />

                    {isClient ? (
                        <ActionFlowBuilder
                            actionFlow={form.values.actionFlow}
                            onActionFlowChange={(newFlow) => form.setFieldValue('actionFlow', newFlow)}
                            actionDefinitions={actionDefinitions}
                        />
                    ) : (
                        <Alert icon={<IconAlertCircle size="1rem" />} title="Loading Editor" color="blue" radius="md">
                            The interactive Action Flow editor is loading...
                        </Alert>
                    )}
                    {form.errors.actionFlow && <Text c="red" size="xs">{form.errors.actionFlow}</Text>}

                    <Divider label="Administration" labelPosition="center" my="md" />
                    <Select
                        label="Status"
                        data={missionStatusOptions} // Use defined string options
                        required
                        {...form.getInputProps('status')}
                    />
                    <NumberInput label="Priority (Optional, for ordering)" min={0} {...form.getInputProps('priority')} />

                    {/* Display for root-level form errors */}
                    {form.errors.root && <Alert color="red" title="Submission Error" icon={<IconAlertCircle />}>{form.errors.root}</Alert>}

                    {submissionAttempted && !form.isValid() && (
                        <Alert color="red" title="Validation Errors" icon={<IconAlertCircle />} mt="md" withCloseButton onClose={() => setSubmissionAttempted(false)}>
                            There are errors in the form that need to be corrected. Please scroll up and review the highlighted fields.
                        </Alert>
                    )}

                    <Group justify="flex-end" mt="xl">
                        <Button variant="default" onClick={onClose} disabled={isSubmittingForm}>Cancel</Button>
                        <Button type="submit" loading={isSubmittingForm}>
                            {isEditing ? 'Save Changes' : 'Create Mission'}
                        </Button>
                    </Group>
                </Stack>
            </form>
        </Modal>
    );
};

export default MissionFormModal;