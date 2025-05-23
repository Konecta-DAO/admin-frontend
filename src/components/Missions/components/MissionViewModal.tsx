import React from 'react';
import {
    Modal,
    Stack,
    Image,
    Avatar,
    Group,
    Title,
    Badge,
    Divider,
    Paper,
    Text,
    Box,
    SimpleGrid,
    Code,
    useMantineTheme,
    Button,
    ScrollArea,
    useMantineColorScheme,
    ThemeIcon,
    List,
    Alert,
    MantineColor,
} from '@mantine/core';
import {
    IconTargetArrow,
    IconGift,
    IconRepeat,
    IconCurrencyDollar,
    IconListCheck,
    IconSettings,
    IconTags,
    IconCalendarEvent,
    IconHierarchy2,
    IconAlertCircle,
} from '@tabler/icons-react';
import { ActionFlow, ActionInstance } from '../types.ts';
export type RewardType = { 'Points': null } |
{ 'None': null } |
{ 'TIME': null } |
{ 'ICPToken': { 'memo': [] | [bigint], 'canisterId': string } };

import { MissionStatus, SerializedMission } from '../../../declarations/projectCanister/test_backend.did.js';
import { PlatformType, SerializedActionDefinition, UIInteractionType } from '../../../declarations/actionsCanister/actions.did.js';

interface MissionViewModalProps {
    opened: boolean;
    onClose: () => void;
    mission: SerializedMission | null;
    actionDefinitions: SerializedActionDefinition[];
    id?: bigint | string | null;
    projectId?: string | null;
}

const NANO_PER_MILLISECOND = 1_000_000;

const MissionViewModal: React.FC<MissionViewModalProps> = ({
    opened,
    onClose,
    mission,
    actionDefinitions,
    id, // Destructure new id prop
    projectId // Destructure new projectId prop
}) => {
    const theme = useMantineTheme();
    const { colorScheme } = useMantineColorScheme();

    if (!mission) return null;

    const getStatusColor = (statusObject: MissionStatus) => {
        const status = Object.keys(statusObject)[0] as keyof MissionStatus; // Get the actual status string
        switch (status) {
            case 'Active': return 'green';
            case 'Draft': return 'gray';
            case 'Completed': return 'blue';
            case 'Expired': return 'red';
            default: return 'gray';
        }
    };

    // MODIFIED renderRewardText
    const renderRewardText = (rewardType: RewardType, amountMin: number, amountMax?: number) => {
        let amountText = amountMax && amountMax > amountMin ? `${amountMin}-${amountMax}` : `${amountMin}`;
        const typeKey = Object.keys(rewardType)[0] as keyof RewardType; // Get the discriminant (e.g., "Points", "ICPToken")

        switch (typeKey) {
            case 'Points':
                return `${amountText} Points`;
            case 'ICPToken':
                // const tokenDetails = rewardType[typeKey]; // if you need memo or canisterId
                return `${amountText} ICP`; // Assuming amountText refers to ICP quantity
            case 'TIME':
                return `${amountText} TIME`; // Assuming amountText refers to TIME quantity
            case 'None':
                return 'No Reward';
            default:
                // Fallback for any other types, if RewardType definition expands
                return `${amountText} ${typeKey}`;
        }
    };

    // MODIFIED renderRewardDetails
    const renderRewardDetails = (m: SerializedMission) => {
        const typeKey = Object.keys(m.rewardType)[0] as keyof RewardType;
        let badgeColor: MantineColor = 'blue';
        let badgeIcon = <IconGift size={16} />;

        // Map keys from your RewardType to appropriate colors/icons
        if (typeKey === 'ICPToken' || typeKey === 'TIME') { // These are like 'CryptoCurrency'
            badgeColor = 'yellow';
            badgeIcon = <IconCurrencyDollar size={16} />;
        } else if (typeKey === 'Points') {
            badgeColor = 'blue';
            // badgeIcon is already IconGift, or you can choose another
        }

        return (
            <Stack gap={2} mt="xs" pl="xs">
                <Badge
                    size="md"
                    color={badgeColor}
                    variant="light"
                    leftSection={badgeIcon}
                >
                    {renderRewardText(m.rewardType, Number(m.minRewardAmount), m.maxRewardAmount.length > 0 ? Number(m.maxRewardAmount[0]) : undefined)}
                </Badge>
                {m.maxRewardAmount.length > 0 && m.maxRewardAmount[0]! > m.minRewardAmount && (
                    <Text size="xs" c="dimmed">(Randomized between min and max)</Text>
                )}
            </Stack>
        );
    };

    const parseAndDisplayActionFlow = (actionFlowJson: string) => {
        try {
            const flow: ActionFlow = JSON.parse(actionFlowJson);
            return (
                <Stack gap="md">
                    <Text size="sm" fw={500}>Flow: {flow.name || 'Untitled Flow'} (Logic: {flow.completionLogic.type})</Text>
                    {flow.steps.map((step, index) => (
                        <Paper key={step.stepId} withBorder p="sm" radius="sm" ml={index > 0 ? "md" : 0}>
                            <Text fw={500}><ThemeIcon variant="light" size="sm" mr={5}><IconListCheck size={14} /></ThemeIcon>Step {step.stepId}: {step.description || 'Unnamed Step'}</Text>
                            {'SingleAction' in step.item && renderActionInstance(step.item['SingleAction'])}
                            {'ActionGroup' in step.item && (
                                <Box pl="md" mt="xs">
                                    <Text size="sm" c="dimmed">Group (Logic: {step.item['ActionGroup'].completionLogic.type})</Text>
                                    {step.item['ActionGroup'].actions.map(action => renderActionInstance(action, true))}
                                </Box>
                            )}
                        </Paper>
                    ))}
                </Stack>
            );
        } catch (e) {
            console.error("Error parsing ActionFlow JSON for display:", e);
            return (
                <Alert icon={<IconAlertCircle size="1rem" />} title="Action Flow Error" color="red" radius="md">
                    Could not display the action flow. The underlying data might be corrupted.
                    (Details: {String(e instanceof Error ? e.message : e)})
                </Alert>
            );
        }
    };

    const renderActionInstance = (action: ActionInstance, isGrouped = false) => {
        const definition = actionDefinitions.find(def => def.id === action.actionDefinitionId);
        const uiInteraction = action.uiInteraction;
        const uiInteractionKey = Object.keys(uiInteraction)[0] as keyof UIInteractionType;

        let uiDetails = "";

        switch (uiInteractionKey) {
            case 'ButtonOnly':
                if ('ButtonOnly' in uiInteraction && uiInteraction.ButtonOnly) {
                    const data = uiInteraction.ButtonOnly;
                    uiDetails = `Button: "${data.buttonText}"`;
                }
                break;
            case 'InputAndButton':
                if ('InputAndButton' in uiInteraction && uiInteraction.InputAndButton) {
                    const data = uiInteraction.InputAndButton;
                    uiDetails = `Inputs: ${data.inputFields.length}, Button: "${data.buttonText}"`;
                }
                break;
            case 'Informational':
            case 'ExternalRedirect':
            case 'NoUIRequired':
                break;
            default:
                // const _exhaustiveCheck: never = uiInteractionKey; // Uncomment for exhaustive checks
                console.warn("Unhandled UIInteractionType in renderActionInstance:", uiInteractionKey);
                uiDetails = "Unknown UI interaction";
        }

        // Get platform and category text by accessing the key of the object
        let platformText = 'N/A';
        let categoryText = 'N/A'; // Assuming category might come from definition as well

        if (definition) {
            // Correctly access the platform key
            const platformKey = Object.keys(definition.platform)[0] as keyof PlatformType;
            platformText = platformKey;
            // If category is also a variant like platform, access it similarly:
            // const categoryKey = Object.keys(definition.category)[0];
            // categoryText = categoryKey;
            // For now, if category is a direct string or needs specific handling:
            // categoryText = definition.category; // Or however it's structured
        }

        return (
            <Box key={action.instanceId} mt="xs" pl={isGrouped ? "md" : "xs"}>
                <Text size="sm">
                    <ThemeIcon variant="light" color="teal" size="sm" mr={5}><IconSettings size={12} /></ThemeIcon>
                    Action: {action.displayName || definition?.name || action.actionDefinitionId}
                </Text>
                {definition && <Text size="xs" c="dimmed">Platform: {platformText}, Category: {categoryText}</Text>}
                <Text size="xs" c="dimmed">UI: {uiInteractionKey} {uiDetails && `(${uiDetails})`}</Text>
                {action.parameterBindings.length > 0 && (
                    <Box mt={2} >
                        <Text size="xs" fw={500}>Parameters:</Text>
                        <List size="xs" spacing={2} withPadding listStyleType="disc">
                            {action.parameterBindings.map(pb => (
                                <List.Item key={pb.parameterName} fz="xs">
                                    {pb.parameterName}:
                                    <Code ml={4} fz="xs" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                        {pb.valueSource.type === 'LiteralValue' ? `Literal(${pb.valueSource.valueJson})` :
                                            pb.valueSource.type === 'PreviousStepOutput' ? `Step ${pb.valueSource.sourceStepId} Output (${pb.valueSource.outputKeyPath})` :
                                                pb.valueSource.type === 'UserSuppliedInput' ? `User Input (${pb.valueSource.inputKeyPath})` :
                                                    pb.valueSource.type === 'MissionContext' ? `Context (${pb.valueSource.contextKey})` : 'Unknown Source'}
                                    </Code>
                                </List.Item>
                            ))}
                        </List>
                    </Box>
                )}
            </Box>
        );
    };

    const missionStartTime = mission.startTime ? new Date(Number(mission.startTime) / NANO_PER_MILLISECOND).toLocaleString() : null;
    const missionEndTime = mission.endTime.length > 0 ? new Date(Number(mission.endTime[0]) / NANO_PER_MILLISECOND).toLocaleString() : null;
    const missionCreationTime = new Date(Number(mission.creationTime) / NANO_PER_MILLISECOND).toLocaleString();
    const lastUpdateRecord = mission.updates && mission.updates.length > 0 ? mission.updates[mission.updates.length - 1] : null;
    const lastUpdateTime = lastUpdateRecord ? new Date(Number(lastUpdateRecord[0]) / NANO_PER_MILLISECOND).toLocaleString() : null;
    const lastUpdaterPrincipal = lastUpdateRecord ? lastUpdateRecord[1] : null;
    const lastUpdater = lastUpdaterPrincipal ? lastUpdaterPrincipal.toText() : null; // Assuming Principal has toText()

    const recursiveCooldownSeconds = mission.recursiveTimeCooldown.length > 0
        ? (Number(mission.recursiveTimeCooldown[0]) / NANO_PER_MILLISECOND / 1000).toFixed(1) + 's'
        : 'N/A';

    // Use the passed 'id' and 'projectId' props
    const displayId = id ? (typeof id === 'bigint' ? id.toString() : id) : 'N/A';
    const displayProjectId = projectId ?? 'N/A';

    return (
        <Modal opened={opened} onClose={onClose} title={`Mission Details`} size="xl" overlayProps={{ backgroundOpacity: 0.55, blur: 3 }} centered scrollAreaComponent={ScrollArea.Autosize} styles={{ inner: { overflowY: 'hidden' } }}>
            <ScrollArea.Autosize mah="calc(90vh - 100px)" style={{ paddingRight: 'var(--mantine-spacing-md)' }}>
                <Stack gap="lg">
                    {mission.imageUrl.length > 0 && <Image radius="md" src={"https://" + projectId + ".raw.icp0.io" + mission.imageUrl[0]} alt={mission.name} height={180} fallbackSrc="https://placehold.co/600x180/eeeeee/cccccc?text=No+Image" />}
                    <Group wrap="nowrap" gap="lg" mt={mission.imageUrl.length > 0 ? undefined : 'md'}>
                        <Avatar src={mission.iconUrl.length > 0 ? "https://" + projectId + ".raw.icp0.io" + mission.iconUrl[0] : undefined} size={80} radius="md"><IconTargetArrow size={40} /></Avatar>
                        <Stack gap={2} style={{ flexGrow: 1 }}>
                            <Title order={3}>{mission.name}</Title>
                            <Group>
                                <Badge size="lg" radius="sm" color={getStatusColor(mission.status)}>{Object.keys(mission.status)[0]}</Badge> {/* Display status key */}
                                {mission.priority !== undefined && mission.priority.length > 0 && <Badge color="pink" variant="light">Priority: {Number(mission.priority[0])}</Badge>}
                            </Group>
                            {/* Use displayId and displayProjectId */}
                            <Text size="xs" c="dimmed">ID: {displayId} (Project: {displayProjectId})</Text>
                        </Stack>
                    </Group>

                    <Paper withBorder p="md" radius="sm" bg={colorScheme === 'dark' ? theme.colors.dark[6] : theme.colors.gray[0]}>
                        <Text size="sm" fw={500} mb={4}>Description:</Text>
                        <Box component={ScrollArea.Autosize} mah={200} style={{ whiteSpace: 'pre-wrap', fontSize: theme.fontSizes.sm }}>
                            {mission.description || <Text c="dimmed" fs="italic">No description provided.</Text>}
                        </Box>
                    </Paper>

                    <Divider my="sm" label="Details" labelPosition="center" />

                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
                        <Paper withBorder p="md" radius="md">
                            <Group><IconGift size={20} stroke={1.5} /><Text fw={500}>Reward</Text></Group>
                            {renderRewardDetails(mission)}
                        </Paper>
                        <Paper withBorder p="md" radius="md">
                            <Group><IconRepeat size={20} stroke={1.5} /><Text fw={500}>Behavior & Limits</Text></Group>
                            <Stack gap={4} mt="xs" pl="xs">
                                <Badge size="sm" radius="sm" color={mission.isRecursive ? 'teal' : 'gray'} variant="light">
                                    {mission.isRecursive ?
                                        `Recursive (Cooldown: ${recursiveCooldownSeconds})`
                                        : 'One-time'}
                                </Badge>
                                {mission.maxCompletionsPerUser.length > 0 && <Text size="xs">Max per user: {Number(mission.maxCompletionsPerUser[0])}</Text>}
                                {mission.maxTotalCompletions.length > 0 && <Text size="xs">Max total: {Number(mission.maxTotalCompletions[0])}</Text>}
                                <Text size="xs">Current total completions: {Number(mission.currentTotalCompletions)}</Text>
                            </Stack>
                        </Paper>
                        <Paper withBorder p="md" radius="md">
                            <Group><IconCalendarEvent size={20} stroke={1.5} /><Text fw={500}>Schedule</Text></Group>
                            <Stack gap={4} mt="xs" pl="xs">
                                <Text size="sm">Start: {missionStartTime ? missionStartTime : <Text c="dimmed" span>Not set</Text>}</Text>
                                <Text size="sm">End: {missionEndTime ? missionEndTime : <Text c="dimmed" span>Not set (runs indefinitely or until completed)</Text>}</Text>
                            </Stack>
                        </Paper>
                        <Paper withBorder p="md" radius="md">
                            <Group><IconTags size={20} stroke={1.5} /><Text fw={500}>Tags</Text></Group>
                            {mission.tags.length > 0 && mission.tags[0]!.length > 0 ? (
                                <Group mt="xs" gap="xs" pl="xs">{mission.tags[0]!.map(tag => <Badge key={tag} variant='light'>{tag}</Badge>)}</Group>
                            ) : <Text size="sm" c="dimmed" mt="xs" pl="xs">No tags.</Text>}
                        </Paper>
                        {(mission.requiredPreviousMissionId.length > 0 && mission.requiredPreviousMissionId[0]!.length > 0) &&
                            <Paper withBorder p="md" radius="md" style={{ gridColumn: '1 / -1' }}>
                                <Group><IconHierarchy2 size={20} stroke={1.5} /><Text fw={500}>Prerequisites</Text></Group>
                                <Text size="sm" mt="xs" pl="xs">Requires completion of Mission IDs: {mission.requiredPreviousMissionId[0]!.map(id => id.toString()).join(', ')}</Text>
                                <Text size="sm" pl="xs">Logic: {mission.requiredMissionLogic.length > 0 && mission.requiredMissionLogic[0] ? Object.keys(mission.requiredMissionLogic[0])[0] : 'All'}</Text>
                            </Paper>
                        }
                    </SimpleGrid>

                    <Divider my="sm" label="Action Flow" labelPosition="center" />
                    <Paper withBorder p="md" radius="md">
                        {parseAndDisplayActionFlow(mission.actionFlowJson)}
                    </Paper>

                    <Divider my="sm" label="Meta" labelPosition="center" />
                    <Group justify="space-between">
                        <Text size="xs" c="dimmed">Creator: {mission.creator.toText()}</Text>
                        <Text size="xs" c="dimmed">Created: {missionCreationTime}</Text>
                    </Group>
                    {lastUpdateTime && lastUpdater && (
                        <Box>
                            <Text size="xs" c="dimmed" mb={2}>Last update: {lastUpdateTime} by {lastUpdater}</Text>
                        </Box>
                    )}
                    <Group justify="flex-end" mt="xl">
                        <Button variant="default" onClick={onClose}>Close</Button>
                    </Group>
                </Stack >
            </ScrollArea.Autosize>
        </Modal >
    );
};

export default MissionViewModal;