import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    Box, Title, Text, Paper, Loader, Alert, Group, Table, ActionIcon, Badge,
    Tooltip, Avatar, ScrollArea, TextInput, CopyButton,
    Pagination, Select, MultiSelect, SegmentedControl, Kbd, Stack,
    ThemeIcon,
    Grid,
    Button
} from '@mantine/core';
import {
    IconUsers, IconAlertCircle, IconEye, IconPoint,
    IconSearch, IconX, IconCopy, IconCheck,
    IconBrandTwitter, IconBrandDiscord, IconBrandTelegram, IconBrain,
    IconCalendar,
} from '@tabler/icons-react';
import { useDebouncedValue } from '@mantine/hooks';

import UserDetailModal from './components/UserDetailModal.tsx';
import type { PrimaryAccountInfoTuple, ComprehensiveUser, GlobalUsersBatchTuple } from './types.ts';
import { Principal } from '@dfinity/principal';
import { useAnalytics } from '../../contexts/AnalyticsContext.tsx';
import { SerializedGlobalUser, UserAnalyticsRecord } from '../../declarations/projectCanister/test_backend.did.js';
import { notifications } from '@mantine/notifications';
import { DatePickerInput } from '@mantine/dates';

type SocialFilter = 'twitter' | 'discord' | 'telegram' | 'oc';

type UserSortKey =
    | 'deducedPoints'
    | 'globalCreationTime'
    | 'last_seen_time'
    | 'missions_completed_count'
    | 'missions_attempted_count';

const UsersPage: React.FC = () => {
    const { projectId, userUUID: userUUIDFromRouteParams } = useParams<{ projectId: string; userUUID?: string }>();
    const navigate = useNavigate();
    const { projectActor } = useAnalytics();

    const [allUsers, setAllUsers] = useState<ComprehensiveUser[]>([]); // NEW
    const [filteredUsers, setFilteredUsers] = useState<ComprehensiveUser[]>([]); // NEW
    const [selectedUser, setSelectedUser] = useState<ComprehensiveUser | null>(null); // NEW
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isFiltering, setIsFiltering] = useState(false);

    // Modal States
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

    // Filtering & Sorting
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm] = useDebouncedValue(searchTerm, 300);
    const [activeSocialFilters, setActiveSocialFilters] = useState<SocialFilter[]>([]);

    const [sortBy, setSortBy] = useState<UserSortKey>('deducedPoints');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    const [selectedAccountTypes, setSelectedAccountTypes] = useState<string[]>([]);
    const [filterHasNNS, setFilterHasNNS] = useState<boolean | null>(null);

    const [joinedDateRange, setJoinedDateRange] = useState<[Date | null, Date | null]>([null, null]);
    const [lastActiveDateRange, setLastActiveDateRange] = useState<[Date | null, Date | null]>([null, null]);

    // Pagination
    const [activePage, setActivePage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    const fetchUsers = useCallback(async () => {
        if (!projectActor || !projectId) {
            setError("Project actor or Project ID is not available. Cannot fetch users.");
            setLoading(false);
            setAllUsers([]); // Clear any existing users
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // 1. Fetch project-specific user analytics records
            const userAnalyticsResult = await projectActor.get_all_user_analytics_records() as UserAnalyticsRecord[];
            console.log("Fetched UserAnalyticsRecords:", userAnalyticsResult);


            if (!userAnalyticsResult || userAnalyticsResult.length === 0) {
                setAllUsers([]);
                setLoading(false);
                return;
            }

            const userUUIDs = userAnalyticsResult.map(record => record.user_uuid);
            let primaryAccountsMap = new Map<string, { principal?: Principal; accountType?: string }>();
            let globalUsersMap = new Map<string, SerializedGlobalUser | undefined>();

            // 2. Fetch primary account data if there are UUIDs
            if (userUUIDs.length > 0) {
                const primaryAccountsData = await projectActor.getBatchPrimaryAccounts(userUUIDs) as PrimaryAccountInfoTuple[];
                console.log("Fetched PrimaryAccountsData:", primaryAccountsData);
                primaryAccountsData.forEach(([uuid, principalOptArr, accountTypeOptArr]) => {
                    primaryAccountsMap.set(uuid, {
                        principal: principalOptArr.length > 0 ? principalOptArr[0] : undefined,
                        accountType: accountTypeOptArr.length > 0 ? accountTypeOptArr[0] : undefined,
                    });
                });
            }

            if (userUUIDs.length > 0) {
                try {
                    const globalUsersData = await projectActor.getBatchGlobalUsers(userUUIDs) as GlobalUsersBatchTuple[];
                    console.log("Fetched GlobalUsersData:", globalUsersData);
                    globalUsersData.forEach(([uuid, globalUserOptArr]) => {
                        if (globalUserOptArr.length > 0) {
                            globalUsersMap.set(uuid, globalUserOptArr[0]);
                        }
                    });
                } catch (e) {
                    console.error("Failed to fetch batch global users, proceeding without global profiles:", e);
                    // Optionally notify the user, but don't block rendering project-specific data
                    // setError("Could not load full user profiles for all users."); // Or a less critical message
                }
            }

            // 3. Combine data into ComprehensiveUser
            const combinedUsers: ComprehensiveUser[] = userAnalyticsResult.map(record => {
                const primaryInfo = primaryAccountsMap.get(record.user_uuid);
                const globalInfo = globalUsersMap.get(record.user_uuid);
                return {
                    ...record, // Spread UserAnalyticsRecord
                    primaryPrincipal: primaryInfo?.principal,
                    primaryAccountType: primaryInfo?.accountType,

                    globalProfile: globalInfo, // Store the whole object if desired

                    // Elevate common fields for easier access
                    twitterHandle: globalInfo?.twitterhandle?.[0] || null,
                    ocProfile: globalInfo?.ocProfile?.[0] || null,
                    discordUser: globalInfo?.discordUser?.[0] || null,
                    telegramUser: globalInfo?.telegramUser?.[0] || null,
                    nuanceUser: globalInfo?.nuanceUser?.[0] || null,
                    nnsPrincipal: globalInfo?.nnsPrincipal?.[0] || null,
                    pfpProgress: globalInfo?.pfpProgress || `https://api.dicebear.com/8.x/bottts-neutral/svg?seed=${record.user_uuid.substring(0, 8)}`, // Fallback avatar
                    deducedPoints: globalInfo?.deducedPoints || 0n, // Default to 0 if not present
                    globalCreationTime: globalInfo?.creationTime || record.first_seen_time_approx, // Fallback to project first_seen
                };
            });

            setAllUsers(combinedUsers);
            // filteredUsers will be updated by the useEffect that depends on allUsers
        } catch (err: any) {
            console.error("Failed to fetch users:", err);
            setError(`Failed to load user data: ${err.message || 'An unknown error occurred.'}`);
            setAllUsers([]); // Clear users on error
        } finally {
            setLoading(false);
        }
    }, [projectActor, projectId]);

    useEffect(() => {
        if (userUUIDFromRouteParams && allUsers.length > 0) {
            if (!selectedUser || selectedUser.user_uuid !== userUUIDFromRouteParams) {
                const userToSelect = allUsers.find(u => u.user_uuid === userUUIDFromRouteParams);
                if (userToSelect) {
                    setSelectedUser(userToSelect);
                    setIsDetailModalOpen(true);
                } else {
                    notifications.show({
                        title: 'User Not Found',
                        message: `User ${shortPrincipal(userUUIDFromRouteParams, 8, 5)} not found in project ${projectId}.`,
                        color: 'orange',
                    });
                    if (projectId) navigate(`/${projectId}/users`, { replace: true });
                }
            }
        }
    }, [userUUIDFromRouteParams, allUsers, projectId, navigate, selectedUser]);

    useEffect(() => {
        if (projectActor && projectId) {
            fetchUsers();
        } else {
            setAllUsers([]);
            setLoading(false);
        }
    }, [fetchUsers]);

    // Client-side Filtering & Sorting Logic
    useEffect(() => {
        setIsFiltering(true); // Start filtering loader

        let usersToProcess = [...allUsers];

        // Search Term Filter
        if (debouncedSearchTerm) {
            const lowerSearch = debouncedSearchTerm.toLowerCase();
            usersToProcess = usersToProcess.filter(user =>
                user.user_uuid.toLowerCase().includes(lowerSearch) ||
                user.primaryPrincipal?.toText().toLowerCase().includes(lowerSearch) ||
                user.primaryAccountType?.toLowerCase().includes(lowerSearch) ||
                user.twitterHandle?.toLowerCase().includes(lowerSearch) ||
                user.ocProfile?.toLowerCase().includes(lowerSearch) ||
                user.discordUser?.toLowerCase().includes(lowerSearch) ||
                user.telegramUser?.toLowerCase().includes(lowerSearch) ||
                user.nuanceUser?.toLowerCase().includes(lowerSearch) ||
                user.globalProfile?.username?.[0]?.toLowerCase().includes(lowerSearch) ||
                user.globalProfile?.email?.[0]?.toLowerCase().includes(lowerSearch)
            );
        }

        // Social Account Filters
        if (activeSocialFilters.length > 0) {
            usersToProcess = usersToProcess.filter(user => {
                return activeSocialFilters.every(filter => {
                    if (filter === 'twitter') return !!user.twitterHandle;
                    if (filter === 'discord') return !!user.discordUser;
                    if (filter === 'telegram') return !!user.telegramUser;
                    if (filter === 'oc') return !!user.ocProfile;
                    return true;
                });
            });
        }

        // Primary Account Type Filter
        if (selectedAccountTypes.length > 0) {
            usersToProcess = usersToProcess.filter(user =>
                user.primaryAccountType && selectedAccountTypes.includes(user.primaryAccountType)
            );
        }

        // Has NNS Principal Filter
        if (filterHasNNS !== null) {
            usersToProcess = usersToProcess.filter(user =>
                filterHasNNS ? !!user.nnsPrincipal : !user.nnsPrincipal
            );
        }

        // Joined Platform Date Filter (uses user.globalCreationTime)
        if (joinedDateRange[0] && joinedDateRange[1]) {
            const startDate = new Date(joinedDateRange[0]);
            startDate.setHours(0, 0, 0, 0); // Normalize to start of day

            const endDate = new Date(joinedDateRange[1]);
            endDate.setHours(23, 59, 59, 999); // Normalize to end of day

            usersToProcess = usersToProcess.filter(user => {
                if (!user.globalCreationTime) return false;
                const userJoinedDate = new Date(Number(user.globalCreationTime / 1000000n)); // Convert nanoseconds to milliseconds
                return userJoinedDate >= startDate && userJoinedDate <= endDate;
            });
        } else if (joinedDateRange[0]) { // Handle single start date
            const startDate = new Date(joinedDateRange[0]);
            startDate.setHours(0, 0, 0, 0);
            usersToProcess = usersToProcess.filter(user => {
                if (!user.globalCreationTime) return false;
                const userJoinedDate = new Date(Number(user.globalCreationTime / 1000000n));
                return userJoinedDate >= startDate;
            });
        } else if (joinedDateRange[1]) { // Handle single end date
            const endDate = new Date(joinedDateRange[1]);
            endDate.setHours(23, 59, 59, 999);
            usersToProcess = usersToProcess.filter(user => {
                if (!user.globalCreationTime) return false;
                const userJoinedDate = new Date(Number(user.globalCreationTime / 1000000n));
                return userJoinedDate <= endDate;
            });
        }


        // Last Active in Project Filter (uses user.last_seen_time)
        if (lastActiveDateRange[0] && lastActiveDateRange[1]) {
            const startDate = new Date(lastActiveDateRange[0]);
            startDate.setHours(0, 0, 0, 0);

            const endDate = new Date(lastActiveDateRange[1]);
            endDate.setHours(23, 59, 59, 999);

            usersToProcess = usersToProcess.filter(user => {
                if (!user.last_seen_time) return false;
                const userLastActiveDate = new Date(Number(user.last_seen_time / 1000000n)); // Convert nanoseconds to milliseconds
                return userLastActiveDate >= startDate && userLastActiveDate <= endDate;
            });
        } else if (lastActiveDateRange[0]) { // Handle single start date
            const startDate = new Date(lastActiveDateRange[0]);
            startDate.setHours(0, 0, 0, 0);
            usersToProcess = usersToProcess.filter(user => {
                if (!user.last_seen_time) return false;
                const userLastActiveDate = new Date(Number(user.last_seen_time / 1000000n));
                return userLastActiveDate >= startDate;
            });
        } else if (lastActiveDateRange[1]) { // Handle single end date
            const endDate = new Date(lastActiveDateRange[1]);
            endDate.setHours(23, 59, 59, 999);
            usersToProcess = usersToProcess.filter(user => {
                if (!user.last_seen_time) return false;
                const userLastActiveDate = new Date(Number(user.last_seen_time / 1000000n));
                return userLastActiveDate <= endDate;
            });
        }

        // Sorting Logic
        usersToProcess.sort((a, b) => {
            let comparison = 0;
            // Helper to safely access and convert potentially bigint values
            const getSortableValue = (user: ComprehensiveUser, key: UserSortKey): number => {
                const value = user[key];
                if (typeof value === 'bigint') return Number(value);
                if (typeof value === 'number') return value;
                return 0; // Default for undefined or null
            };

            switch (sortBy) {
                case 'deducedPoints':
                    comparison = getSortableValue(a, 'deducedPoints') - getSortableValue(b, 'deducedPoints');
                    break;
                case 'globalCreationTime':
                    comparison = getSortableValue(a, 'globalCreationTime') - getSortableValue(b, 'globalCreationTime');
                    break;
                case 'last_seen_time':
                    comparison = getSortableValue(a, 'last_seen_time') - getSortableValue(b, 'last_seen_time');
                    break;
                case 'missions_completed_count':
                    comparison = getSortableValue(a, 'missions_completed_count') - getSortableValue(b, 'missions_completed_count');
                    break;
                case 'missions_attempted_count':
                    comparison = getSortableValue(a, 'missions_attempted_count') - getSortableValue(b, 'missions_attempted_count');
                    break;
                default:
                    comparison = 0;
            }
            return sortOrder === 'asc' ? comparison : -comparison;
        });

        setFilteredUsers(usersToProcess);
        // Reset page if filters change or data loads, but only if there was some data or an active filter.
        if (usersToProcess.length > 0 || debouncedSearchTerm || activeSocialFilters.length > 0 || selectedAccountTypes.length > 0 || filterHasNNS !== null || joinedDateRange[0] || joinedDateRange[1] || lastActiveDateRange[0] || lastActiveDateRange[1]) {
            setActivePage(1);
        }
        setIsFiltering(false);
    }, [
        debouncedSearchTerm,
        allUsers,
        activeSocialFilters,
        sortBy,
        sortOrder,
        selectedAccountTypes,
        filterHasNNS,
        joinedDateRange,
        lastActiveDateRange,
    ]);

    const paginatedUsers = useMemo(() => {
        const startIndex = (activePage - 1) * ITEMS_PER_PAGE;
        return filteredUsers.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [filteredUsers, activePage]);

    // --- Modal Control ---
    const handleOpenDetailModal = (userToView: ComprehensiveUser) => {
        setSelectedUser(userToView);
        setIsDetailModalOpen(true);
        if (projectId) navigate(`/${projectId}/users/${userToView.user_uuid}`);
    };

    const handleCloseDetailModal = () => {
        setIsDetailModalOpen(false);
        setSelectedUser(null);
        // Navigate back to the base /users URL for the current project when modal closes
        if (projectId) navigate(`/${projectId}/users`);
    };

    // --- UI Helpers & Actions ---
    const shortPrincipal = (id: string | Principal, start = 6, end = 4) => {
        const textId = typeof id === 'string' ? id : id.toText();
        if (!textId || textId.length < start + end + 3) return textId; // Return as is if too short
        return `${textId.substring(0, start)}...${textId.substring(textId.length - end)}`;
    }
    const formatDate = (timestampNano: bigint | number, isShort: boolean = false) => {
        if (timestampNano === null || typeof timestampNano === 'undefined' || BigInt(timestampNano) === 0n) {
            return 'N/A';
        }
        try {
            const timestampMs = Number(BigInt(timestampNano) / 1_000_000n);
            const date = new Date(timestampMs);
            if (isNaN(date.getTime())) return 'Invalid Date';
            return isShort ? date.toLocaleDateString() : date.toLocaleString();
        } catch (e) {
            console.error("Error formatting date:", timestampNano, e);
            return "Error Date";
        }
    };

    const availableAccountTypes = useMemo(() => {
        if (!allUsers) return [];
        const types = new Set<string>();
        allUsers.forEach(user => {
            if (user.primaryAccountType) {
                types.add(user.primaryAccountType);
            }
        });
        return Array.from(types).sort().map(type => ({ label: type, value: type }));
    }, [allUsers]);

    const handleClearAllFilters = () => {
        setSearchTerm('');
        setActiveSocialFilters([]);
        setSelectedAccountTypes([]);
        setFilterHasNNS(null);
        setJoinedDateRange([null, null]);
        setLastActiveDateRange([null, null]);
        // Optionally reset sorting
        // setSortBy('deducedPoints');
        // setSortOrder('desc');
        setActivePage(1); // Reset to first page
    };

    // Determine if any filter is active for the "No Results" message
    const anyFilterActive = useMemo(() => {
        return !!debouncedSearchTerm ||
            activeSocialFilters.length > 0 ||
            selectedAccountTypes.length > 0 ||
            filterHasNNS !== null ||
            (joinedDateRange[0] !== null || joinedDateRange[1] !== null) ||
            (lastActiveDateRange[0] !== null || lastActiveDateRange[1] !== null);
    }, [debouncedSearchTerm, activeSocialFilters, selectedAccountTypes, filterHasNNS, joinedDateRange, lastActiveDateRange]);

    if (loading && allUsers.length === 0) {
        return <Box p="md" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 'calc(100vh - 200px)' }}><Loader size="xl" /></Box>;
    }
    if (error && allUsers.length === 0) {
        return <Box p="md"><Alert icon={<IconAlertCircle size="1rem" />} title="Error!" color="red" radius="md">{error}</Alert></Box>;
    }

    // Inside UsersPage component's return statement, for the table rows:
    const userTableRows = paginatedUsers.map((user: ComprehensiveUser) => (
        <Table.Tr key={user.user_uuid}>
            <Table.Td> {/* User */}
                <Group gap="sm" wrap="nowrap">
                    <Avatar src={user.pfpProgress} alt={user.twitterHandle || user.primaryPrincipal?.toText() || user.user_uuid} radius="xl" size="md" />
                    <Stack gap={0}>
                        <Group gap={4} align="center">
                            <Text size="sm" fw={500} lineClamp={1} title={user.twitterHandle || user.ocProfile || user.primaryPrincipal?.toText() || user.user_uuid}>
                                {user.twitterHandle ? `@${user.twitterHandle}` :
                                    user.ocProfile ? user.ocProfile :
                                        user.discordUser ? user.discordUser :
                                            user.primaryPrincipal ? shortPrincipal(user.primaryPrincipal.toText()) :
                                                shortPrincipal(user.user_uuid, 8, 5)}
                            </Text>
                            <CopyButton value={user.primaryPrincipal?.toText() || user.user_uuid} timeout={2000}>
                                {({ copied, copy }) => (
                                    <Tooltip label={copied ? 'Copied' : 'Copy ID'} withArrow position="right">
                                        <ActionIcon color={copied ? 'teal' : 'gray'} variant="subtle" size="xs" onClick={copy}>
                                            {copied ? <IconCheck size={12} /> : <IconCopy size={12} />}
                                        </ActionIcon>
                                    </Tooltip>
                                )}
                            </CopyButton>
                        </Group>
                        <Text size="xs" c="dimmed" lineClamp={1}>
                            {user.primaryPrincipal ? (
                                user.primaryAccountType ? (
                                    <>
                                        Principal: {shortPrincipal(user.primaryPrincipal.toText())} ({user.primaryAccountType})
                                    </>
                                ) : (
                                    <>Principal: {shortPrincipal(user.primaryPrincipal.toText())}</>
                                )
                            ) : (
                                <>UUID: {shortPrincipal(user.user_uuid)}</>
                            )}
                        </Text>
                    </Stack>
                </Group>
            </Table.Td>
            <Table.Td> {/* Global Points */}
                <Badge variant="light" color="blue" leftSection={<IconPoint size={14} />}>
                    {(user.deducedPoints || 0n).toLocaleString()} Pts
                </Badge>
            </Table.Td>
            <Table.Td> {/* Missions Done (Proj) */}
                <Badge color="green" variant="light">
                    {(user.missions_completed_count || 0n).toString()}
                </Badge>
            </Table.Td>
            <Table.Td> {/* Missions Att. (Proj) */}
                <Text size="xs" ta="center">{(user.missions_attempted_count || 0n).toString()}</Text>
            </Table.Td>
            <Table.Td> {/* Last Active (Proj) - uses last_seen_time */}
                <Text size="xs">{formatDate(user.last_seen_time, true)}</Text>
            </Table.Td>
            <Table.Td> {/* Socials */}
                <Group gap={6} wrap="nowrap">
                    {user.twitterHandle && <Tooltip label={`Twitter: @${user.twitterHandle}`} withArrow><ThemeIcon variant="light" color="blue" size="sm" radius="xl"><IconBrandTwitter size={12} /></ThemeIcon></Tooltip>}
                    {user.discordUser && <Tooltip label={`Discord: ${user.discordUser}`} withArrow><ThemeIcon variant="light" color="indigo" size="sm" radius="xl"><IconBrandDiscord size={12} /></ThemeIcon></Tooltip>}
                    {user.telegramUser && <Tooltip label={`Telegram: ${user.telegramUser}`} withArrow><ThemeIcon variant="light" color="cyan" size="sm" radius="xl"><IconBrandTelegram size={12} /></ThemeIcon></Tooltip>}
                    {user.ocProfile && <Tooltip label={`OpenChat: ${user.ocProfile}`} withArrow><ThemeIcon variant="light" color="orange" size="sm" radius="xl"><IconBrain size={12} /></ThemeIcon></Tooltip>}
                </Group>
            </Table.Td>
            <Table.Td> {/* Joined Platform - uses globalCreationTime */}
                <Text size="xs">{formatDate(user.globalCreationTime ?? 0n, true)}</Text>
            </Table.Td>
            <Table.Td> {/* Actions */}
                <Group gap={4} justify="flex-end" wrap="nowrap">
                    <Tooltip label="View Details" withArrow>
                        <ActionIcon variant="subtle" onClick={() => handleOpenDetailModal(user)}><IconEye size={18} /></ActionIcon>
                    </Tooltip>
                </Group>
            </Table.Td>
        </Table.Tr>
    ));

    return (
        <Box p="md">
            <Group justify="space-between" mb="xl">
                <Title order={2}>User Management</Title>
            </Group>

            {error && !loading && allUsers.length > 0 && /* Show non-critical error if users are already displayed */
                <Alert icon={<IconAlertCircle size="1rem" />} title="Error Notice" color="red" radius="md" mb="md" withCloseButton onClose={() => setError(null)}>{error}</Alert>
            }

            <Paper shadow="sm" p="md" withBorder mb="lg">
                <Grid gutter="md" align="flex-end">
                    <Grid.Col span={{ base: 12, md: 6, lg: 3 }}>
                        <TextInput
                            label="Search Users"
                            placeholder="ID, Twitter, Discord..."
                            leftSection={<IconSearch size={16} />}
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.currentTarget.value)}
                            rightSection={searchTerm &&
                                <ActionIcon onClick={() => setSearchTerm('')} title="Clear search"><IconX size={14} /></ActionIcon>
                            }
                        />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 6, lg: 3 }}>
                        <MultiSelect
                            label="Linked social accounts"
                            placeholder="Has Twitter, Discord etc."
                            data={[
                                { value: 'twitter', label: 'Twitter' },
                                { value: 'discord', label: 'Discord' },
                                { value: 'telegram', label: 'Telegram' },
                                { value: 'oc', label: 'OpenChat' },
                            ]}
                            value={activeSocialFilters}
                            onChange={(values) => setActiveSocialFilters(values as SocialFilter[])}
                            clearable
                        />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 6, lg: 3 }}>
                        <MultiSelect
                            label="Primary Account Type"
                            placeholder="Select types"
                            data={availableAccountTypes}
                            value={selectedAccountTypes}
                            onChange={setSelectedAccountTypes}
                            disabled={availableAccountTypes.length === 0}
                            clearable
                        />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 6, lg: 3 }}>
                        <Text size="sm" fw={500} mb={4}>Has NNS Principal?</Text>
                        <SegmentedControl
                            fullWidth
                            value={filterHasNNS === null ? 'all' : (filterHasNNS ? 'yes' : 'no')}
                            onChange={(value) => {
                                if (value === 'all') setFilterHasNNS(null);
                                else if (value === 'yes') setFilterHasNNS(true);
                                else setFilterHasNNS(false);
                            }}
                            data={[
                                { label: 'All Users', value: 'all' },
                                { label: 'Has NNS', value: 'yes' },
                                { label: 'No NNS', value: 'no' },
                            ]}
                        />
                    </Grid.Col>

                    <Grid.Col span={{ base: 12, md: 6, lg: 3 }}>
                        <DatePickerInput
                            type="range"
                            label="Joined Platform Date"
                            placeholder="Select date range"
                            value={joinedDateRange}
                            onChange={(value) => {
                                if (value) {
                                    setJoinedDateRange([new Date(value[0]), new Date(value[1])]);
                                } else {
                                    setJoinedDateRange([null, null]);
                                }
                            }}
                            clearable
                        />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 6, lg: 3 }}>
                        <DatePickerInput
                            type="range"
                            label="Last Active (Project)"
                            placeholder="Select date range"
                            value={lastActiveDateRange}
                            onChange={(datesFromPicker: [string | null, string | null]) => {
                                const startDate = datesFromPicker[0] ? new Date(datesFromPicker[0]) : null;
                                const endDate = datesFromPicker[1] ? new Date(datesFromPicker[1]) : null;
                                setLastActiveDateRange([startDate, endDate]);
                            }}
                            clearable
                            leftSection={<IconCalendar size={16} />}
                        />
                    </Grid.Col>

                    <Grid.Col span={{ base: 12, sm: 6, md: 4, lg: 3 }}>
                        <Select
                            label="Sort by"
                            data={[
                                { value: 'deducedPoints', label: 'Global Points' },
                                { value: 'globalCreationTime', label: 'Platform Join Date' },
                                { value: 'last_seen_time', label: 'Last Active (Project)' },
                                { value: 'missions_completed_count', label: 'Missions Done (Project)' },
                                { value: 'missions_attempted_count', label: 'Missions Att. (Project)' },
                            ]}
                            value={sortBy}
                            onChange={(value) => setSortBy(value as UserSortKey)}
                        />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 6, md: 2, lg: 1 }} >
                        <SegmentedControl
                            mt={{ base: 0, sm: 'auto' }} // Aligns better when label is present on SortBy
                            fullWidth
                            value={sortOrder}
                            onChange={(value) => setSortOrder(value as 'asc' | 'desc')}
                            data={[
                                { label: 'Asc', value: 'asc' },
                                { label: 'Desc', value: 'desc' },
                            ]}
                        />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 'auto' }} > {/* Auto width for the button */}
                        <Button
                            variant="outline"
                            onClick={handleClearAllFilters}
                            leftSection={<IconX size={14} />}
                            mt={{ base: 'md', md: '1.65rem' }} // Adjust margin to align with other inputs
                            fullWidth={window.innerWidth < 768} // Full width on small screens
                        >
                            Clear All Filters
                        </Button>
                    </Grid.Col>
                </Grid>
            </Paper>

            {(loading && allUsers.length > 0) && <Box style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}><Loader /></Box>}
            {isFiltering && !loading && <Box style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}><Loader size="sm" /></Box>}


            {!isFiltering && filteredUsers.length === 0 && !loading ? (
                <Paper withBorder p="xl" style={{ textAlign: 'center' }}>
                    <ThemeIcon variant="light" size={60} radius={60} color="gray" mb="md">
                        <IconUsers size={30} stroke={1.5} />
                    </ThemeIcon>
                    <Text size="lg" mt="md" fw={500}>
                        {anyFilterActive ? "No users match your current filters." : "No users found for this project."}
                    </Text>
                    <Text c="dimmed">
                        {anyFilterActive ? "Try adjusting your search or filters." : "Once users interact with this project, they will appear here."}
                        {error && !anyFilterActive && ` Or check for errors: ${error}`}
                    </Text>
                </Paper>
            ) : !isFiltering ? (
                <Paper shadow="sm" p={0} withBorder>
                    <ScrollArea>
                        <Table striped highlightOnHover verticalSpacing="sm" miw={1000}>
                            <Table.Thead>
                                <Table.Tr>
                                    <Table.Th>User</Table.Th>
                                    <Table.Th>Global Points</Table.Th>
                                    <Table.Th>Missions Done (Proj)</Table.Th>
                                    <Table.Th>Missions Att. (Proj)</Table.Th>
                                    <Table.Th>Last Active (Proj)</Table.Th>
                                    <Table.Th>Socials</Table.Th>
                                    <Table.Th>Joined Platform</Table.Th>
                                    <Table.Th style={{ textAlign: 'right' }}>Actions</Table.Th>
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>{userTableRows}</Table.Tbody>
                        </Table>
                    </ScrollArea>
                    {filteredUsers.length > ITEMS_PER_PAGE && (
                        <Group justify="center" p="md">
                            <Pagination total={Math.ceil(filteredUsers.length / ITEMS_PER_PAGE)} value={activePage} onChange={setActivePage} />
                        </Group>
                    )}
                </Paper>
            ) : null /* Don't render table if isFiltering and not initial loading */}

            <UserDetailModal
                opened={isDetailModalOpen}
                onClose={handleCloseDetailModal}
                user={selectedUser}
                projectId={projectId!}
            />
        </Box>
    );
};

export default UsersPage;
