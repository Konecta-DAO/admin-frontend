import React, { useCallback, useEffect, useState } from 'react';
import {
    Modal, Stack, Group, Title, Text, Avatar, Badge, Paper, Code,
    useMantineTheme, Button, ScrollArea, ThemeIcon, CopyButton, ActionIcon, Tooltip, Box, Anchor,
    Center,
    Loader,
    Accordion,
    useMantineColorScheme,
    Tabs,
    Alert,
} from '@mantine/core';
import {
    IconUserCircle, IconBrandTwitter, IconBrandDiscord, IconBrandTelegram, IconPoint,
    IconCalendarTime, IconShield, IconCopy, IconCheck, IconProgress,
    IconNetwork, IconBrain,
    IconListCheck,
    IconTargetArrow,
    IconActivity,
    IconClockCheck,
    IconClock,
    IconMapPin,
    IconClockHour4,
    IconFileText,
    IconMail,
    IconTags,
    IconLink,
    IconAlertCircle,
} from '@tabler/icons-react';
import type { ComprehensiveUser } from '../types.ts';
import { useAnalytics } from '../../../contexts/AnalyticsContext.tsx';
import { formatOptionalBigIntTimestamp } from '../../Dashboard/dashboardUtils.ts';
import { Principal } from '@dfinity/principal';

interface UserDetailModalProps {
    opened: boolean;
    onClose: () => void;
    user: ComprehensiveUser | null;
    projectId: string;
}

const DetailItem: React.FC<{
    icon: React.ReactNode;
    label: string;
    value?: string | number | boolean | React.ReactNode;
    isCode?: boolean;
    isLink?: boolean;
    linkPrefix?: string;
    hidden?: boolean;
}> = ({ icon, label, value, isCode, isLink, linkPrefix, hidden }) => {
    if (hidden || value === undefined || value === null || value === '') return null;

    let displayValue: React.ReactNode = String(value);
    if (typeof value === 'boolean') {
        displayValue = value ? <Badge color="green" variant="light">Yes</Badge> : <Badge color="red" variant="light">No</Badge>;
    } else if (isCode) {
        displayValue = <Code>{String(value)}</Code>;
    } else if (isLink && typeof value === 'string') {
        const href = linkPrefix ? `${linkPrefix}${value.startsWith('@') ? value.substring(1) : value}` : value;
        displayValue = <Anchor href={href} target="_blank" size="sm" rel="noopener noreferrer">{String(value)}</Anchor>;
    }


    return (
        <Group wrap="nowrap" gap="sm" align="flex-start">
            <ThemeIcon variant="light" color="gray" size="md" radius="sm" style={{ minWidth: 28 }}>{icon}</ThemeIcon>
            <Text size="sm" c="dimmed" fw={500} w={120}>{label}:</Text>
            <Box style={{ flex: 1, wordBreak: 'break-all' }}>
                {typeof value !== 'boolean' && !isCode && !isLink ? <Text size="sm">{displayValue}</Text> : displayValue}
            </Box>
        </Group>
    );
};

const UserDetailModal: React.FC<UserDetailModalProps> = ({ opened, onClose, user, projectId }) => {

    const theme = useMantineTheme();
    const { colorScheme } = useMantineColorScheme();
    const { projectActor, missionsAnalytics: projectMissionsAnalytics, isLoadingAnalytics: isLoadingMissionsAnalytics } = useAnalytics();

    const [allLinkedAccounts, setAllLinkedAccounts] = useState<Array<{ accType: string; principal: Principal }> | null>(null);
    const [isLoadingLinkedAccounts, setIsLoadingLinkedAccounts] = useState<boolean>(false);
    const [linkedAccountsError, setLinkedAccountsError] = useState<string | null>(null);

    useEffect(() => {
        if (opened && user && user.user_uuid && projectActor) {
            const fetchAllLinked = async () => {
                setIsLoadingLinkedAccounts(true);
                setLinkedAccountsError(null);
                setAllLinkedAccounts(null); // Clear previous results

                try {
                    const result = await projectActor.get_user_all_linked_accounts(user.user_uuid) as Array<[string, Principal]>;
                    console.log("Fetched all linked accounts:", result);
                    if (result) {
                        setAllLinkedAccounts(result.map(item => ({ accType: item[0], principal: item[1] })));
                    } else {
                        setAllLinkedAccounts([]);
                    }
                } catch (err: any) {
                    console.error("Failed to fetch all linked accounts:", err);
                    setLinkedAccountsError(`Failed to load linked accounts: ${err.message || 'Unknown error'}`);
                } finally {
                    setIsLoadingLinkedAccounts(false);
                }
            };
            fetchAllLinked();
        } else {
            // Clear data if modal is closed or user is not present
            setAllLinkedAccounts(null);
            setIsLoadingLinkedAccounts(false);
            setLinkedAccountsError(null);
        }
    }, [opened, user, projectId, projectActor]);

    const getMissionNameFromContext = useCallback((missionIdToFind: bigint): string => {
        if (!projectMissionsAnalytics) return `Mission ID: ${missionIdToFind.toString()}`;
        const mission = projectMissionsAnalytics.find(m => m.mission_id === missionIdToFind);
        return mission ? String(mission.name) : `Mission ID: ${missionIdToFind.toString()}`;
    }, [projectMissionsAnalytics]);


    if (!user) return null;

    const shortPrincipal = (id: string, start = 6, end = 4) => {
        if (!id || id.length < start + end + 3) return id;
        return `${id.substring(0, start)}...${id.substring(id.length - end)}`;
    }

    const formatDate = (timestampNano: bigint | number | undefined | null, includeTime = true) => {
        if (timestampNano === null || typeof timestampNano === 'undefined' || BigInt(timestampNano || 0n) === 0n) {
            return 'N/A';
        }
        try {
            const timestampMs = Number(BigInt(timestampNano) / 1_000_000n);
            const date = new Date(timestampMs);
            if (isNaN(date.getTime())) return 'Invalid Date';

            const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
            if (includeTime) {
                options.hour = '2-digit';
                options.minute = '2-digit';
            }
            return date.toLocaleDateString(undefined, options);
        } catch (e) {
            console.error("Error formatting date:", timestampNano, e);
            return "Error Date";
        }
    };

    const getOverallStatusString = (statusObj: any): string => {
        if (!statusObj || typeof statusObj !== 'object' || Object.keys(statusObj).length === 0) {
            return "Unknown";
        }
        const statusKey = Object.keys(statusObj)[0];
        return statusKey.replace(/([A-Z])/g, ' $1').trim();
    };

    const displayIdString = user.primaryPrincipal ? user.primaryPrincipal.toText() : user.user_uuid;
    const idTypeLabel = user.primaryPrincipal ? (user.primaryAccountType ? `Principal (${user.primaryAccountType})` : 'Principal') : 'User UUID';

    const primaryDisplayName = user.twitterHandle ? `@${user.twitterHandle}` :
        user.ocProfile ? user.ocProfile :
            user.discordUser ? user.discordUser :
                user.globalProfile?.username?.[0] ? user.globalProfile.username[0] :
                    user.primaryPrincipal ? shortPrincipal(user.primaryPrincipal.toText(), 10, 6) :
                        'User Profile';

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title={<Title order={3}>User Profile: <Text span inherit color={theme.primaryColor}>{primaryDisplayName}</Text></Title>}
            size="xl"
            overlayProps={{ backgroundOpacity: 0.55, blur: 3 }}
            centered
            scrollAreaComponent={ScrollArea.Autosize}
            styles={{ body: { maxHeight: '80vh' } }}
        >
            <Tabs defaultValue="summary" keepMounted={true} styles={{ panel: { paddingTop: theme.spacing.md } }}>
                <Tabs.List>
                    <Tabs.Tab value="summary" leftSection={<IconUserCircle size="0.9rem" />}>Profile Summary</Tabs.Tab>
                    <Tabs.Tab value="projectActivity" leftSection={<IconActivity size="0.9rem" />}>Project Engagement</Tabs.Tab>
                    <Tabs.Tab value="linkedAccounts" leftSection={<IconLink size="0.9rem" />}>Linked Accounts</Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="summary">
                    <Stack gap="lg">
                        {/* User Info Paper */}
                        <Paper shadow="xs" p="lg" radius="md" withBorder>
                            <Group wrap="nowrap">
                                <Avatar src={user.pfpProgress} size={90} radius="50%">
                                    {primaryDisplayName.substring(0, 2).toUpperCase()}
                                </Avatar>
                                <Stack gap={0} style={{ flex: 1 }}>
                                    <Title order={4} lineClamp={1}>
                                        {primaryDisplayName}
                                    </Title>
                                    <Group gap="xs" align="center">
                                        <Text size="xs" c="dimmed" title={displayIdString}>
                                            {idTypeLabel}: {shortPrincipal(displayIdString)}
                                        </Text>
                                        <CopyButton value={displayIdString} timeout={2000}>
                                            {({ copied, copy }) => (
                                                <Tooltip label={copied ? `Copied ${idTypeLabel}` : `Copy ${idTypeLabel}`} withArrow>
                                                    <ActionIcon color={copied ? 'teal' : 'gray'} variant="subtle" onClick={copy} size="xs">
                                                        {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                                                    </ActionIcon>
                                                </Tooltip>
                                            )}
                                        </CopyButton>
                                    </Group>
                                    <Badge mt={4} variant="light" color="blue" leftSection={<IconPoint size={14} />}>
                                        {(user.deducedPoints || 0n).toLocaleString()} Global Points
                                    </Badge>
                                </Stack>
                            </Group>
                        </Paper>

                        {/* Global Account Activity Paper */}
                        <Paper shadow="xs" p="md" radius="md" withBorder>
                            <Title order={4} mb="sm">
                                <Group gap="xs"><ThemeIcon variant="light" size="md"><IconActivity /></ThemeIcon><Text c="dimmed">Global Account Activity</Text></Group>
                            </Title>
                            <Stack gap="sm">
                                <DetailItem icon={<IconCalendarTime size={16} />} label="Joined Platform" value={formatDate(Number(user.globalCreationTime), false)} />
                                <DetailItem icon={<IconProgress size={16} />} label="PFP Status" value={user.pfpProgress?.startsWith('http') ? <Anchor href={user.pfpProgress} target="_blank" size="sm">{user.pfpProgress}</Anchor> : user.pfpProgress} isCode={!user.pfpProgress?.startsWith('http')} />
                                <DetailItem icon={<IconShield size={16} />} label="NNS Principal" value={user.nnsPrincipal ? shortPrincipal(user.nnsPrincipal.toString()) : 'N/A'} isCode={!!user.nnsPrincipal} hidden={!user.nnsPrincipal} />
                            </Stack>
                        </Paper>

                        {/* Social Profiles Paper */}
                        <Paper shadow="xs" p="md" radius="md" withBorder>
                            <Title order={4} mb="sm">
                                <Group gap="xs"><ThemeIcon variant="light" size="md"><IconNetwork /></ThemeIcon><Text c="dimmed">Social Profiles</Text></Group>
                            </Title>
                            <Stack gap="sm">
                                <DetailItem icon={<IconBrandTwitter size={16} />} label="Twitter" value={user.twitterHandle ? `@${user.twitterHandle}` : undefined} isLink={!!user.twitterHandle} linkPrefix="https://twitter.com/" />
                                <DetailItem icon={<IconBrandDiscord size={16} />} label="Discord" value={user.discordUser || undefined} />
                                <DetailItem icon={<IconBrandTelegram size={16} />} label="Telegram" value={user.telegramUser ? (user.telegramUser.startsWith('@') ? user.telegramUser : `@${user.telegramUser}`) : undefined} isLink={!!user.telegramUser} linkPrefix="https://t.me/" />
                                <DetailItem icon={<IconBrain size={16} />} label="OpenChat" value={user.ocProfile || undefined} isLink={!!user.ocProfile} linkPrefix={`https://oc.app/user/`} />
                                <DetailItem icon={<IconCheck size={16} />} label="OC Verified" value={user.globalProfile?.ocProfile?.[0]} hidden={user.globalProfile?.ocProfile === undefined || user.globalProfile?.ocProfile.length === 0} />
                            </Stack>
                        </Paper>

                        {/* Additional Global Info Paper */}
                        <Paper shadow="xs" p="md" radius="md" withBorder>
                            <Title order={4} mb="sm">
                                <Group gap="xs"><ThemeIcon variant="light" size="md"><IconUserCircle /></ThemeIcon><Text c="dimmed">Additional Global Info</Text></Group>
                            </Title>
                            <Stack gap="sm">
                                <DetailItem icon={<IconUserCircle size={16} />} label="Username" value={user.globalProfile?.username?.[0]} hidden={!user.globalProfile?.username || user.globalProfile.username.length === 0} />
                                <DetailItem icon={<IconMail size={16} />} label="Email" value={user.globalProfile?.email?.[0]} hidden={!user.globalProfile?.email || user.globalProfile.email.length === 0} />
                                <DetailItem icon={<IconFileText size={16} />} label="Bio" value={user.globalProfile?.bio?.[0]} hidden={!user.globalProfile?.bio || user.globalProfile.bio.length === 0} />
                                <DetailItem
                                    icon={<IconTags size={16} />}
                                    label="Categories"
                                    value={user.globalProfile?.categories?.[0]?.join(', ')}
                                    hidden={!user.globalProfile?.categories || user.globalProfile.categories.length === 0 || user.globalProfile.categories[0].length === 0}
                                />
                                <DetailItem icon={<IconMapPin size={16} />} label="Country" value={user.globalProfile?.country?.[0]} hidden={!user.globalProfile?.country || user.globalProfile.country.length === 0} />
                                <DetailItem icon={<IconClockHour4 size={16} />} label="Timezone" value={user.globalProfile?.timezone?.[0]} hidden={!user.globalProfile?.timezone || user.globalProfile.timezone.length === 0} />
                            </Stack>
                        </Paper>
                    </Stack>
                </Tabs.Panel>

                <Tabs.Panel value="projectActivity">
                    <Stack gap="lg">
                        <Title order={4} c="dimmed" mt="xs">
                            Activity for Project: <Text span color={theme.primaryColor} inherit>{projectId}</Text>
                        </Title>

                        {/* Project Stats Summary Paper */}
                        <Paper shadow="xs" p="md" radius="md" withBorder>
                            <Title order={5} mb="sm">
                                <Group gap="xs"><ThemeIcon variant="light" size="md"><IconActivity /></ThemeIcon><Text c="dimmed">Project Stats Summary</Text></Group>
                            </Title>
                            <Stack gap="sm">
                                <DetailItem icon={<IconCalendarTime size={16} />} label="First Seen in Project" value={formatDate(Number(user.first_seen_time_approx), false)} />
                                <DetailItem icon={<IconClock size={16} />} label="Last Active in Project" value={formatDate(Number(user.last_seen_time))} />
                                <DetailItem icon={<IconTargetArrow size={16} />} label="Missions Attempted" value={(user.missions_attempted_count || 0n).toString()} />
                                <DetailItem icon={<IconListCheck size={16} />} label="Missions Completed" value={(user.missions_completed_count || 0n).toString()} />
                            </Stack>
                        </Paper>

                        {/* Mission Progress Accordion Paper */}
                        <Paper shadow="xs" p="md" radius="md" withBorder>
                            <Title order={5} mb="md">
                                <Group gap="xs">
                                    <ThemeIcon variant="light" size="lg"><IconListCheck /></ThemeIcon>
                                    <Text c="dimmed">Mission Progress</Text>
                                </Group>
                            </Title>
                            {isLoadingMissionsAnalytics && (!user.progress_entries || user.progress_entries.length === 0) && <Center><Loader size="sm" my="lg" /></Center>}
                            {!isLoadingMissionsAnalytics && user.progress_entries && user.progress_entries.length === 0 && (
                                <Text c="dimmed" ta="center" my="lg">No mission interactions recorded for this user in this project.</Text>
                            )}
                            {!isLoadingMissionsAnalytics && user.progress_entries && user.progress_entries.length > 0 && (
                                <Accordion variant="separated" radius="md" defaultValue={user.progress_entries.length > 0 ? `mission-${user.progress_entries[0].mission_id.toString()}-0` : undefined}>
                                    {user.progress_entries.map((entry, index) => (
                                        <Accordion.Item value={`mission-${entry.mission_id.toString()}-${index}`} key={`mission-${entry.mission_id.toString()}-${index}`}>
                                            <Accordion.Control icon={<IconTargetArrow size={20} color={theme.colors.blue[6]} />}>
                                                <Group justify="space-between" wrap="nowrap">
                                                    <Text fw={500} truncate style={{ flex: 1 }}>{getMissionNameFromContext(entry.mission_id)}</Text>
                                                    <Badge color="teal" variant="light">{getOverallStatusString(entry.overall_status)}</Badge>
                                                </Group>
                                            </Accordion.Control>
                                            <Accordion.Panel>
                                                <Stack gap="xs">
                                                    <DetailItem icon={<IconListCheck size={16} />} label="Completions (This Mission)" value={(entry.completions_by_this_user_for_this_mission || 0n).toString()} />
                                                    {/* Timestamps in mission entries are arrays of bigints: e.g. last_active_time: [] | [bigint] */}
                                                    <DetailItem icon={<IconCalendarTime size={16} />} label="Last Active" value={formatOptionalBigIntTimestamp([entry.last_active_time!])} />
                                                    <DetailItem icon={<IconClockCheck size={16} />} label="Mission Completion Time" value={formatOptionalBigIntTimestamp(entry.completion_time)} />
                                                </Stack>
                                            </Accordion.Panel>
                                        </Accordion.Item>
                                    ))}
                                </Accordion>
                            )}
                        </Paper>
                    </Stack>
                </Tabs.Panel>

                {/* THIS PANEL WAS MOVED INSIDE THE MAIN TABS COMPONENT */}
                <Tabs.Panel value="linkedAccounts" pt="md">
                    <Paper shadow="xs" p="md" radius="md" withBorder>
                        <Title order={4} mb="md">
                            <Group gap="xs"><ThemeIcon variant="light" size="md"><IconLink /></ThemeIcon><Text c="dimmed">All Linked Accounts</Text></Group>
                        </Title>
                        {isLoadingLinkedAccounts && <Center><Loader /></Center>}
                        {linkedAccountsError && !isLoadingLinkedAccounts && (
                            <Alert title="Error" color="red" icon={<IconAlertCircle />}>
                                {linkedAccountsError}
                            </Alert>
                        )}
                        {!isLoadingLinkedAccounts && !linkedAccountsError && (
                            <>
                                {allLinkedAccounts && allLinkedAccounts.length > 0 ? (
                                    <Stack gap="sm">
                                        {allLinkedAccounts.map((account, index) => (
                                            <Paper key={index} p="xs" radius="sm" withBorder
                                                bg={account.principal.toText() === user.primaryPrincipal?.toText() ?
                                                    (colorScheme === 'dark' ? theme.colors.blue[9] : theme.colors.blue[0])
                                                    : undefined}
                                            >
                                                <Group justify="space-between">
                                                    <Stack gap={0}>
                                                        <Text size="sm" fw={500}>{account.accType}</Text>
                                                        <Text size="xs" c="dimmed" title={account.principal.toText()}>
                                                            {shortPrincipal(account.principal.toText())}
                                                            {account.principal.toText() === user.primaryPrincipal?.toText() && (
                                                                <Badge color="blue" variant="outline" size="xs" ml="xs">Primary</Badge>
                                                            )}
                                                        </Text>
                                                    </Stack>
                                                    <CopyButton value={account.principal.toText()} timeout={2000}>
                                                        {({ copied, copy }) => (
                                                            <Tooltip label={copied ? 'Copied Principal' : 'Copy Principal'} withArrow>
                                                                <ActionIcon color={copied ? 'teal' : 'gray'} variant="subtle" onClick={copy} size="sm">
                                                                    {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                                                                </ActionIcon>
                                                            </Tooltip>
                                                        )}
                                                    </CopyButton>
                                                </Group>
                                            </Paper>
                                        ))}
                                    </Stack>
                                ) : (
                                    <Text c="dimmed" ta="center">No accounts linked to this user's UUID.</Text>
                                )}
                            </>
                        )}
                    </Paper>
                </Tabs.Panel>
                {/* <<<<< TABS COMPONENT NOW CLOSES HERE, WRAPPING ALL PANELS */}
            </Tabs>

            <Group justify="flex-end" mt="lg" pt="md" style={{ borderTop: `1px solid ${colorScheme === 'dark' ? theme.colors.dark[5] : theme.colors.gray[2]}` }}>
                <Button variant="default" onClick={onClose} radius="md">Close</Button>
            </Group>
        </Modal>
    );
};

export default UserDetailModal;