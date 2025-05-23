import React, { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Box, Title, Text, Paper, Loader, Alert, Grid, SimpleGrid, Group, ActionIcon,
  SegmentedControl, Table, ThemeIcon, Badge, Tooltip, Center,
  useMantineTheme,
  UnstyledButton,
  TableScrollContainer,
  Modal,
  useMantineColorScheme,
  List,
  Anchor,
  Container,
  Button,
  TextInput,
  Switch,
  MultiSelect,
  rgba,
} from '@mantine/core';
import {
  IconAlertCircle, IconRefresh, IconUsers, IconTargetArrow, IconChecks, IconActivity,
  IconCalendarStats, IconClockPlay,
  IconClockCheck, IconClockCancel, IconPlayerPause, IconFileText,
  IconChevronUp,
  IconChevronDown,
  IconSelector,
  IconUserPlus,
  IconChartFunnel,
  IconListCheck,
  IconArrowsExchange,
} from '@tabler/icons-react';
import { AreaChart, BarChart } from '@mantine/charts';
import { notifications } from '@mantine/notifications';
import {
  MissionAnalyticsSummary,
  AggregatedFunnelStep,
  Result_3
} from '../../declarations/projectCanister/test_backend.did.js';
import { processActivityData, formatBigInt, formatOptionalBigIntTimestamp, calculateWAU, calculateMAU, processLifecycleData, processWeeklyRetentionCohorts } from './dashboardUtils.ts';
import { DatePickerInput } from '@mantine/dates';
import MissionFunnelChart from './MissionFunnelChart.tsx';
import { useAnalytics } from '../../contexts/AnalyticsContext.tsx';

interface StatCardProps {
  title: string | React.ReactNode;
  value: string | number;
  icon?: React.ReactNode;
  color?: string;
  loading?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color, loading }) => (
  <Paper withBorder p="md" radius="md" shadow="sm">
    <Group justify="space-between">
      <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
        {title}
      </Text>
      {icon && <ThemeIcon color={color || "gray"} variant="light" size={28} radius="md">{icon}</ThemeIcon>}
    </Group>
    {loading ? <Loader size="sm" mt="sm" /> : <Text size="xl" fw={700} mt="sm">{value}</Text>}
  </Paper>
);

interface ThProps {
  children: React.ReactNode;
  reversed: boolean;
  sorted: boolean;
  onSort(): void;
  width?: string | number;
  ta?: 'left' | 'center' | 'right';
}

function Th({ children, reversed, sorted, onSort, width, ta }: ThProps) {
  const Icon = sorted ? (reversed ? IconChevronUp : IconChevronDown) : IconSelector;
  return (
    <Table.Th style={{ width }} ta={ta || 'left'}>
      <UnstyledButton onClick={onSort} style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
        <Group justify={ta === 'right' ? 'flex-end' : (ta === 'center' ? 'center' : 'flex-start')} gap="xs" style={{ flexGrow: 1 }}>
          <Text fw={500} fz="sm">{children}</Text>
          <Icon size="0.9rem" stroke={1.5} />
        </Group>
      </UnstyledButton>
    </Table.Th>
  );
}

const DashboardPage: React.FC = () => {

  const {
    projectActor,
    overviewData,
    missionsAnalytics,
    userProgressData,
    isLoadingAnalytics,
    analyticsError,
    refreshAnalytics
  } = useAnalytics();

  const { projectId } = useParams<{ projectId: string }>();
  const theme = useMantineTheme();
  const { colorScheme } = useMantineColorScheme();

  const [timeSeriesRange, setTimeSeriesRange] = useState<string>('30'); // "7", "30", "90"
  const [customDateRange, setCustomDateRange] = useState<[Date | null, Date | null]>([null, null]);

  // State for Mission Funnel Modal
  const [selectedMissionForFunnel, setSelectedMissionForFunnel] = useState<MissionAnalyticsSummary | null>(null);
  const [funnelData, setFunnelData] = useState<AggregatedFunnelStep[] | null>(null);
  const [loadingFunnel, setLoadingFunnel] = useState(false);
  const [funnelError, setFunnelError] = useState<string | null>(null);

  const [drillDownModalOpen, setDrillDownModalOpen] = useState(false);
  const [drillDownData, setDrillDownData] = useState<{ title: string; users: string[] } | null>(null);
  const [activeChartPayload, setActiveChartPayload] = useState<any[] | null>(null);

  const [missionNameFilter, setMissionNameFilter] = useState<string>('');
  // MODIFIED: For MultiSelect status filter
  const [selectedStatusFilters, setSelectedStatusFilters] = useState<string[]>([]);
  // NEW: For Tag filter
  const [selectedTagFilters, setSelectedTagFilters] = useState<string[]>([]);

  const [isComparisonMode, setIsComparisonMode] = useState<boolean>(false);
  const [comparisonChartData, setComparisonChartData] = useState<{
    dau: any[]; newUsers: any[]; completions: any[];
  } | null>(null);

  const handleRetentionCellClick = (cohortDateLabel: string, weekIndex: number, usersInSegment: string[]) => {
    setDrillDownData({
      title: `Retained Users - Cohort: ${cohortDateLabel.replace("Week of ", "")}, Week ${weekIndex}`,
      users: usersInSegment
    });
    setDrillDownModalOpen(true);
  };

  // --- Chart Drill-Down Functionality ---
  const handleChartPointClick = (
    payload: any, // Type from Mantine charts event if available, else any
    metricType: 'DAU' | 'New Users' | 'Completions',
    date: string // date string from chart data point
  ) => {
    if (!userProgressData || !payload) return;

    let usersToList: string[] = [];
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    if (metricType === 'DAU') {
      const activeUserUUIDs = new Set<string>();
      userProgressData.forEach(userRec => {
        const isActive = userRec.progress_entries.some(entry => {
          const activityDate = new Date(Number(entry.last_active_time / 1_000_000n));
          activityDate.setHours(0, 0, 0, 0);
          return activityDate.getTime() === targetDate.getTime();
        });
        if (isActive) activeUserUUIDs.add(userRec.user_uuid);
      });
      usersToList = Array.from(activeUserUUIDs);
    } else if (metricType === 'New Users') {
      usersToList = userProgressData
        .filter(userRec => {
          const firstSeenDate = new Date(Number(userRec.first_seen_time_approx / 1_000_000n));
          firstSeenDate.setHours(0, 0, 0, 0);
          return firstSeenDate.getTime() === targetDate.getTime();
        })
        .map(userRec => userRec.user_uuid);
    } else if (metricType === 'Completions') {
      const completingUserUUIDs = new Set<string>();
      userProgressData.forEach(userRec => {
        const didCompleteOnDate = userRec.progress_entries.some(entry => {
          if (entry.completion_time?.[0]) {
            const completionDate = new Date(Number(entry.completion_time[0] / 1_000_000n));
            completionDate.setHours(0, 0, 0, 0);
            return completionDate.getTime() === targetDate.getTime();
          }
          return false;
        });
        if (didCompleteOnDate) completingUserUUIDs.add(userRec.user_uuid);
      });
      usersToList = Array.from(completingUserUUIDs);
    }

    setDrillDownData({ title: `${metricType} on ${targetDate.toLocaleDateString()}`, users: usersToList });
    setDrillDownModalOpen(true);
  };

  const getMissionStatus = (statusObj: { [key: string]: null } | undefined): string => {
    if (!statusObj) return ""; // Handle undefined case
    return Object.keys(statusObj)[0];
  };

  const lifecycleData = useMemo(() => {
    if (!userProgressData) return null;
    const rangeDays = parseInt(timeSeriesRange);
    return processLifecycleData(userProgressData, rangeDays);
  }, [userProgressData, timeSeriesRange]);
  const retentionData = useMemo(() => {
    if (!userProgressData) return null;
    return processWeeklyRetentionCohorts(userProgressData, 8);
  }, [userProgressData]);

  type MissionSortKey = keyof MissionAnalyticsSummary | 'completionRate' | 'overallConversion';
  const [missionSortStatus, setMissionSortStatus] = useState<{ columnAccessor: MissionSortKey; direction: 'asc' | 'desc' } | null>(null);

  const handleViewFunnel = async (mission: MissionAnalyticsSummary) => {
    if (!projectActor) {
      notifications.show({ title: 'Error', message: 'Project actor not available.', color: 'red' });
      return;
    }
    setSelectedMissionForFunnel(mission);
    setLoadingFunnel(true);
    setFunnelError(null);
    setFunnelData(null); // Clear previous data
    try {
      const result = await projectActor.get_aggregated_mission_funnel(mission.mission_id) as Result_3;
      if ('ok' in result) {
        setFunnelData(result.ok);
      } else {
        console.error("Failed to fetch funnel data from backend:", result.err);
        setFunnelError(result.err);
        notifications.show({
          title: `Error Fetching Funnel for ${mission.name}`,
          message: result.err || "Unknown backend error.",
          color: 'red'
        });
      }
    } catch (e: any) {
      console.error("Exception fetching funnel data:", e);
      const errorMessage = e.message || "An unexpected client-side error occurred.";
      setFunnelError(errorMessage);
      notifications.show({
        title: `Error Fetching Funnel for ${mission.name}`,
        message: errorMessage,
        color: 'red'
      });
    } finally {
      setLoadingFunnel(false);
    }
  };

  const effectiveDaysForTitle = useMemo(() => {
    if (customDateRange[0] && customDateRange[1]) {
      const diffTime = Math.abs(customDateRange[1].getTime() - customDateRange[0].getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // inclusive
      return `${diffDays} (Custom)`;
    }
    return timeSeriesRange;
  }, [timeSeriesRange, customDateRange]);

  const chartDataConfig = useMemo(() => {
    if (!userProgressData) {
      return { dau: [], newUsers: [], completions: [], currentPeriodLabel: "Selected Period", previousPeriodLabel: "Previous Period" };
    }

    // Determine current period based on user selection
    let currentRangeStart: Date | null = null;
    let currentRangeEnd: Date | null = null;
    let periodLengthDays: number = parseInt(timeSeriesRange); // Default if not custom

    if (customDateRange[0] && customDateRange[1]) {
      currentRangeStart = new Date(customDateRange[0]);
      currentRangeStart.setHours(0, 0, 0, 0);
      currentRangeEnd = new Date(customDateRange[1]);
      currentRangeEnd.setHours(23, 59, 59, 999); // Ensure end of day for current period
      const diffTime = Math.abs(currentRangeEnd.getTime() - currentRangeStart.getTime());
      periodLengthDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // This might need to be +1 if inclusive days
    } else if (timeSeriesRange !== '__custom_internal__') {
      periodLengthDays = parseInt(timeSeriesRange);
      currentRangeEnd = new Date(); // Today
      currentRangeEnd.setHours(23, 59, 59, 999);
      currentRangeStart = new Date();
      currentRangeStart.setDate(currentRangeEnd.getDate() - (periodLengthDays - 1));
      currentRangeStart.setHours(0, 0, 0, 0);
    } else { // Fallback if __custom_internal__ but dates are not set
      return { dau: [], newUsers: [], completions: [], currentPeriodLabel: "Selected Period", previousPeriodLabel: "Previous Period" };
    }


    // --- Process data for the current period ---
    const currentDauRaw = processActivityData(userProgressData, periodLengthDays, 'dau', currentRangeStart, currentRangeEnd);
    const currentNewUsersRaw = processActivityData(userProgressData, periodLengthDays, 'newUsers', currentRangeStart, currentRangeEnd);
    const currentCompletionsRaw = processActivityData(userProgressData, periodLengthDays, 'completions', currentRangeStart, currentRangeEnd);

    const currentPeriodLabel = `${currentRangeStart.toLocaleDateString()} - ${currentRangeEnd.toLocaleDateString()}`;


    if (!isComparisonMode) {
      return {
        dau: currentDauRaw.map(d => ({ date: d.date, "Active Users": d.value })),
        newUsers: currentNewUsersRaw.map(d => ({ date: d.date, "New Users": d.value })),
        completions: currentCompletionsRaw.map(d => ({ date: d.date, "Completions": d.value })),
        currentPeriodLabel,
        previousPeriodLabel: ""
      };
    }

    // --- If Comparison Mode is ON ---
    // Calculate previous period dates (same length, immediately preceding)
    const previousRangeEnd = new Date(currentRangeStart);
    previousRangeEnd.setDate(previousRangeEnd.getDate() - 1); // Day before current period starts
    previousRangeEnd.setHours(23, 59, 59, 999);
    const previousRangeStart = new Date(previousRangeEnd);
    previousRangeStart.setDate(previousRangeEnd.getDate() - (periodLengthDays - 1));
    previousRangeStart.setHours(0, 0, 0, 0);

    const previousPeriodLabel = `${previousRangeStart.toLocaleDateString()} - ${previousRangeEnd.toLocaleDateString()}`;

    const previousDauRaw = processActivityData(userProgressData, periodLengthDays, 'dau', previousRangeStart, previousRangeEnd);
    const previousNewUsersRaw = processActivityData(userProgressData, periodLengthDays, 'newUsers', previousRangeStart, previousRangeEnd);
    const previousCompletionsRaw = processActivityData(userProgressData, periodLengthDays, 'completions', previousRangeStart, previousRangeEnd);

    // Align data for comparison (Day 1, Day 2, ...)
    // `processActivityData` should ideally return data padded for the full periodLengthDays.
    const alignData = (current: typeof currentDauRaw, previous: typeof previousDauRaw, pLength: number) => {
      const aligned: { dayLabel: string; currentValue: number | null; previousValue: number | null }[] = [];
      for (let i = 0; i < pLength; i++) {
        aligned.push({
          dayLabel: `Day ${i + 1}`,
          currentValue: current[i]?.value ?? 0, // Assuming processActivityData pads with 0 or missing entries imply 0
          previousValue: previous[i]?.value ?? 0,
        });
      }
      return aligned;
    };

    return {
      dau: alignData(currentDauRaw, previousDauRaw, periodLengthDays),
      newUsers: alignData(currentNewUsersRaw, previousNewUsersRaw, periodLengthDays),
      completions: alignData(currentCompletionsRaw, previousCompletionsRaw, periodLengthDays),
      currentPeriodLabel,
      previousPeriodLabel
    };

  }, [userProgressData, timeSeriesRange, customDateRange, isComparisonMode]);

  const wau = useMemo(() => {
    if (!userProgressData) return 0;
    return calculateWAU(userProgressData);
  }, [userProgressData]);

  const mau = useMemo(() => {
    if (!userProgressData) return 0;
    return calculateMAU(userProgressData);
  }, [userProgressData]);

  const filteredAndSortedMissionsAnalytics = useMemo(() => {
    if (!missionsAnalytics) return [];

    let filtered = [...missionsAnalytics];

    if (missionNameFilter) {
      filtered = filtered.filter(mission =>
        String(mission.name).toLowerCase().includes(missionNameFilter.toLowerCase())
      );
    }

    if (selectedStatusFilters.length > 0) {
      filtered = filtered.filter(mission =>
        selectedStatusFilters.includes(getMissionStatus(mission.status))
      );
    }

    if (selectedTagFilters.length > 0) {
      filtered = filtered.filter(mission => {
        // mission.tags is ?[Text] which becomes [string[]] | [] in JS from Candid
        const missionTags = (mission.tags && mission.tags.length > 0 && mission.tags[0]) ? mission.tags[0] : [];
        if (missionTags.length === 0 && selectedTagFilters.length > 0) return false; // No tags on mission, but filters exist
        // Check if any of the mission's tags are in the selectedTagFilters
        return missionTags.some(tag => selectedTagFilters.includes(tag));
        // If you want an AND logic (mission must have ALL selected tags):
        // return selectedTagFilters.every(filterTag => missionTags.includes(filterTag));
      });
    }

    if (missionSortStatus) {
      const { columnAccessor, direction } = missionSortStatus;
      return [...filtered].sort((a, b) => {
        let valA: string | number | bigint = '';
        let valB: string | number | bigint = '';

        if (columnAccessor === 'completionRate' || columnAccessor === 'overallConversion') { // Combined logic for rates
          const rateA = BigInt(a.estimated_starts) > 0n ? (Number(a.total_completions) / Number(a.estimated_starts)) : -1;
          const rateB = BigInt(b.estimated_starts) > 0n ? (Number(b.total_completions) / Number(b.estimated_starts)) : -1;
          valA = rateA;
          valB = rateB;
        } else if (columnAccessor === 'name' || columnAccessor === 'status') {
          valA = columnAccessor === 'status' ? getMissionStatus(a[columnAccessor]) : String(a[columnAccessor as keyof MissionAnalyticsSummary] || '');
          valB = columnAccessor === 'status' ? getMissionStatus(b[columnAccessor]) : String(b[columnAccessor as keyof MissionAnalyticsSummary] || '');
        } else {
          // Handle BigInt or number for other properties
          const rawValA = a[columnAccessor as keyof MissionAnalyticsSummary];
          const rawValB = b[columnAccessor as keyof MissionAnalyticsSummary];
          valA = typeof rawValA === 'bigint' ? rawValA : BigInt(Number(rawValA) || 0);
          valB = typeof rawValB === 'bigint' ? rawValB : BigInt(Number(rawValB) || 0);
        }

        if (typeof valA === 'string' && typeof valB === 'string') {
          return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        if (valA < valB) return direction === 'asc' ? -1 : 1;
        if (valA > valB) return direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return filtered;
  }, [missionsAnalytics, missionNameFilter, selectedStatusFilters, missionSortStatus]);

  const availableStatuses = useMemo(() => {
    if (!missionsAnalytics) return [];
    const statuses = new Set<string>();
    missionsAnalytics.forEach(mission => statuses.add(getMissionStatus(mission.status)));
    return Array.from(statuses).map(s => ({ label: s, value: s }));
  }, [missionsAnalytics]);

  const availableTags = useMemo(() => {
    if (!missionsAnalytics) return [];
    const tagsSet = new Set<string>();
    missionsAnalytics.forEach(mission => {
      // mission.tags is ?[Text], so it's an array with an optional array inside in JS: [string[]] | []
      if (mission.tags && mission.tags.length > 0 && mission.tags[0]) {
        mission.tags[0].forEach(tag => tagsSet.add(tag));
      }
    });
    return Array.from(tagsSet).sort().map(tag => ({ label: tag, value: tag }));
  }, [missionsAnalytics]);

  const handleMissionSort = (accessor: MissionSortKey) => {
    if (missionSortStatus && missionSortStatus.columnAccessor === accessor) {
      setMissionSortStatus({
        ...missionSortStatus,
        direction: missionSortStatus.direction === 'asc' ? 'desc' : 'asc',
      });
    } else {
      setMissionSortStatus({ columnAccessor: accessor, direction: 'asc' });
    }
  };

  const missionStatusColors: Record<string, string> = {
    Active: 'green', Draft: 'gray', Paused: 'orange',
    Completed: 'blue', Expired: 'red',
  };



  const commonChartProps = {
    h: 300,
    dataKey: "date",
    withXAxis: true,
    withYAxis: true,
    tooltipAnimationDuration: 200,
  };

  const getRetentionCellColor = (percentage: number | null): string => {
    if (percentage === null) return colorScheme === 'dark' ? theme.colors.dark[6] : theme.colors.gray[1];
    if (percentage > 75) return rgba(theme.colors.teal[7], 0.7);
    if (percentage > 50) return rgba(theme.colors.teal[5], 0.6);
    if (percentage > 25) return rgba(theme.colors.lime[5], 0.5);
    if (percentage > 10) return rgba(theme.colors.yellow[5], 0.5);
    if (percentage > 0) return rgba(theme.colors.orange[5], 0.4);
    return rgba(theme.colors.gray[5], 0.3);
  };

  const avgMissionsCompleted = useMemo(() => {
    if (!overviewData || !overviewData.unique_users_interacted || BigInt(overviewData.unique_users_interacted.toString()) === 0n) return "N/A";
    const completions = BigInt(overviewData.project_lifetime_completions.toString());
    const users = BigInt(overviewData.unique_users_interacted.toString());
    return (Number(completions) / Number(users)).toFixed(2);
  }, [overviewData]);

  const avgMissionsAttempted = useMemo(() => {
    if (!overviewData || !overviewData.unique_users_interacted || BigInt(overviewData.unique_users_interacted.toString()) === 0n) return "N/A";
    const attempts = BigInt(overviewData.project_lifetime_starts_approx.toString());
    const users = BigInt(overviewData.unique_users_interacted.toString());
    return (Number(attempts) / Number(users)).toFixed(2);
  }, [overviewData]);

  const handleClearFilters = () => {
    setMissionNameFilter('');
    setSelectedStatusFilters([]); // Reset to empty array for MultiSelect
    setSelectedTagFilters([]);
  };

  if (!projectId) {
    return <Alert color="red" title="Error">Project ID is missing.</Alert>;
  }

  if (isLoadingAnalytics) {
    return <Center style={{ height: 'calc(100vh - 200px)' }}><Loader size="xl" /></Center>;
  }

  if (analyticsError) {
    return (
      <Container p="md">
        <Alert icon={<IconAlertCircle size="1rem" />} title="Error Loading Project Analytics" color="red" radius="md">
          <Text>{analyticsError}</Text>
          <Button onClick={refreshAnalytics} mt="sm" variant="outline">Try Again</Button>
        </Alert>
      </Container>
    );
  }

  // Fallback if data isn't loaded for some reason after loading is false (e.g. partial error not caught by analyticsError string)
  if (!overviewData || !missionsAnalytics || !userProgressData) {
    return (
      <Container p="md">
        <Alert icon={<IconAlertCircle size="1rem" />} title="Data Incomplete" color="orange" radius="md">
          Some essential analytics data could not be loaded.
          <Button onClick={refreshAnalytics} mt="sm" variant="outline">Try Refreshing</Button>
        </Alert>
      </Container>
    );
  }

  return (
    <Box p="md">
      <Group justify="space-between" mb="xl">
        <Title order={2}>
          <Group gap="xs">
            <IconCalendarStats size={30} />
            Dashboard: <Text span c={theme.primaryColor} inherit>{overviewData?.project_name ? String(overviewData.project_name) : projectId}</Text>
          </Group>
        </Title>
        <Tooltip label="Refresh All Dashboard Data">
          <ActionIcon variant="light" onClick={refreshAnalytics} size="lg" loading={isLoadingAnalytics}>
            <IconRefresh size={20} />
          </ActionIcon>
        </Tooltip>
      </Group>

      <Paper shadow="xs" p="lg" mb="xl" withBorder bg={colorScheme === 'dark' ? theme.colors.dark[6] : theme.white}>
        <Title order={4} mb="md">Project Overview</Title>
        <SimpleGrid cols={{ base: 1, xs: 2, md: 3, lg: 4 }} spacing="md" mb="md">
          <StatCard
            title={
              <Tooltip label="Total unique users who have ever interacted with any mission in this project." position="top-start" withArrow>
                <span>Total Users (Ever) <IconAlertCircle size={12} style={{ verticalAlign: 'middle', marginLeft: 2, opacity: 0.7 }} /></span>
              </Tooltip>
            }
            value={formatBigInt(overviewData?.unique_users_interacted)}
            icon={<IconUsers size={20} />} color="grape"
          />
          <StatCard
            title={
              <Tooltip label="Weekly Active Users: Unique users active in the last 7 calendar days (including today)." position="top-start" withArrow>
                <span>WAU (Last 7d) <IconAlertCircle size={12} style={{ verticalAlign: 'middle', marginLeft: 2, opacity: 0.7 }} /></span>
              </Tooltip>
            }
            value={wau}
            icon={<IconUsers size={20} />} color="indigo"
          />
          <StatCard
            title={
              <Tooltip label="Monthly Active Users: Unique users active in the last 30 calendar days (including today)." position="top-start" withArrow>
                <span>MAU (Last 30d) <IconAlertCircle size={12} style={{ verticalAlign: 'middle', marginLeft: 2, opacity: 0.7 }} /></span>
              </Tooltip>
            }
            value={mau}
            icon={<IconUsers size={20} />} color="violet"
          />
          <StatCard title="Total Missions" value={formatBigInt(overviewData?.total_missions)} icon={<IconTargetArrow size={20} />} color="cyan" />
        </SimpleGrid>
        <SimpleGrid cols={{ base: 1, xs: 2, md: 3, lg: 5 }} spacing="md" mb="xl">
          <StatCard title="Active Missions" value={formatBigInt(overviewData?.active_missions)} icon={<IconActivity size={20} />} color="green" />
          <StatCard
            title={ // Item 6: Label Clarity Example
              <Tooltip label="Total number of times any mission has been started or re-started by users." position="top-start" withArrow>
                <span>Total Mission Engagements <IconAlertCircle size={12} style={{ verticalAlign: 'middle', marginLeft: 2, opacity: 0.7 }} /></span>
              </Tooltip>
            }
            value={formatBigInt(overviewData?.project_lifetime_starts_approx)}
            icon={<IconClockPlay size={20} />} color="yellow"
          />
          <StatCard title="Lifetime Completions" value={formatBigInt(overviewData?.project_lifetime_completions)} icon={<IconChecks size={20} />} color="teal" />
          <StatCard title="Draft Missions" value={formatBigInt(overviewData?.draft_missions)} icon={<IconFileText size={18} />} color="gray" />
          <StatCard title="Paused Missions" value={formatBigInt(overviewData?.paused_missions)} icon={<IconPlayerPause size={18} />} color="orange" />
        </SimpleGrid>
        {/* Item 8: Mission Statuses in Overview - visual separation is already decent, could add a sub-header if many more */}
        <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="md" mb="md">
          <StatCard title="Expired Missions" value={formatBigInt(overviewData?.expired_missions)} icon={<IconClockCancel size={18} />} color="red" />
          <StatCard
            title={
              <Tooltip label="Missions that have reached their 'maxTotalCompletions' limit." position="top-start" withArrow>
                <span>Missions Maxed Out <IconAlertCircle size={12} style={{ verticalAlign: 'middle', marginLeft: 2, opacity: 0.7 }} /></span>
              </Tooltip>
            }
            value={formatBigInt(overviewData?.completed_overall_missions)}
            icon={<IconClockCheck size={18} />} color="blue"
          />
        </SimpleGrid>
        <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="md" mt="lg">
          <StatCard
            title={
              <Tooltip label="Average number of missions completed by each unique user who interacted with the project." withArrow>
                <span>Avg. Completions / User <IconAlertCircle size={12} style={{ verticalAlign: 'middle', marginLeft: 2, opacity: 0.7 }} /></span>
              </Tooltip>
            }
            value={avgMissionsCompleted}
            icon={<IconListCheck size={18} />} color="lime"
          />
          <StatCard
            title={
              <Tooltip label="Average number of mission engagements (starts/re-starts) by each unique user." withArrow>
                <span>Avg. Engagements / User <IconAlertCircle size={12} style={{ verticalAlign: 'middle', marginLeft: 2, opacity: 0.7 }} /></span>
              </Tooltip>
            }
            value={avgMissionsAttempted}
            icon={<IconUsers size={18} />} color="cyan"
          />
        </SimpleGrid>
      </Paper>

      {/* User Activity Trends */}
      <Title order={4} mb="md" mt="xl">User Activity Trends</Title>
      <Paper p="md" mb="md" withBorder shadow="xs">
        <Group justify="space-between" align="flex-end" wrap="wrap"> {/* Use wrap for responsiveness */}
          <SegmentedControl
            disabled={isComparisonMode && (customDateRange[0] !== null || customDateRange[1] !== null)} // Disable presets if custom range active in comparison
            value={(customDateRange[0] || customDateRange[1]) && !isComparisonMode ? '__custom__' : timeSeriesRange}
            onChange={(value) => {
              if (value !== '__custom__') {
                setTimeSeriesRange(value);
                setCustomDateRange([null, null]);
              }
            }}
            data={[
              { label: '7D', value: '7' },
              { label: '30D', value: '30' },
              { label: '90D', value: '90' },
            ]}
          />

          <DatePickerInput
            type="range"
            placeholder="Select custom date range"
            value={customDateRange}
            onChange={(newRange) => {
              if (newRange) {
                setCustomDateRange([
                  newRange[0] ? new Date(newRange[0]) : null,
                  newRange[1] ? new Date(newRange[1]) : null
                ]);
                if (newRange[0] && newRange[1]) {
                  setTimeSeriesRange('__custom_internal__'); // Set to a value that indicates custom is active for chart title logic
                } else if (!newRange[0] && !newRange[1] && timeSeriesRange === '__custom_internal__') {
                  setTimeSeriesRange('30'); // Default back if custom is cleared
                }
              } else {
                setCustomDateRange([null, null]);
              }
            }}
            clearable
            maxDate={new Date()}
            style={{ flexGrow: 1, maxWidth: 300 }}
          />

          <Tooltip label={isComparisonMode ? "Disable Period Comparison" : "Enable Period Comparison"}>
            <Switch
              label="Compare"
              checked={isComparisonMode}
              onChange={(event) => setIsComparisonMode(event.currentTarget.checked)}
              thumbIcon={isComparisonMode ? <IconArrowsExchange size={12} /> : undefined}
            />
          </Tooltip>
        </Group>
        {isComparisonMode && chartDataConfig.previousPeriodLabel && (
          <Text size="xs" c="dimmed" mt="xs">
            Comparing with: {chartDataConfig.previousPeriodLabel}
          </Text>
        )}
      </Paper>

      <Text size="sm" c="dimmed" mb="md">
        Displaying data for: {isComparisonMode ? `${chartDataConfig.currentPeriodLabel} (vs Previous)` : effectiveDaysForTitle}
      </Text>

      {isLoadingAnalytics && (!chartDataConfig.dau.length) ? (
        <Center style={{ height: 300 }}><Loader /></Center>
      ) : analyticsError ? (
        <Alert color="red" title="Error loading trend data">{analyticsError}</Alert>
      ) : (
        <Grid gutter="md" mb="xl">
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Paper withBorder p="md" radius="md" shadow="sm"
              onClick={() => { // General click on the paper containing the chart
                if (activeChartPayload && activeChartPayload.length > 0 && activeChartPayload[0]?.payload?.date) {
                  handleChartPointClick(activeChartPayload[0].payload, 'DAU', activeChartPayload[0].payload.date);
                }
              }}
              style={{ cursor: activeChartPayload ? 'pointer' : 'default' }} // Indicate clickability
            >
              <Text fw={500} mb="sm">Daily Active Users</Text>
              {chartDataConfig.dau.length > (isComparisonMode ? 0 : 1) ? (
                <AreaChart
                  h={300}
                  data={chartDataConfig.dau}
                  dataKey={isComparisonMode ? "dayLabel" : "date"}
                  series={
                    isComparisonMode
                      ? [
                        { name: 'currentValue', label: `Current: Active Users`, color: theme.colors.blue[6] },
                        { name: 'previousValue', label: `Previous: Active Users`, color: theme.colors.gray[5] },
                      ]
                      : [{ name: 'Active Users', color: theme.colors.blue[6] }]
                  }
                  curveType="monotone"
                  connectNulls
                  onMouseMove={(event: any) => { // Capture active payload
                    if (event.activePayload && event.activePayload.length > 0) {
                      setActiveChartPayload(event.activePayload);
                    } else {
                      setActiveChartPayload(null);
                    }
                  }}
                />
              ) : <Text c="dimmed" ta="center" p="xl">Not enough data for trend.</Text>}
            </Paper>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Paper withBorder p="md" radius="md" shadow="sm"
              onClick={() => {
                if (activeChartPayload && activeChartPayload.length > 0 && activeChartPayload[0]?.payload?.date) {
                  handleChartPointClick(activeChartPayload[0].payload, 'New Users', activeChartPayload[0].payload.date);
                }
              }}
              style={{ cursor: activeChartPayload ? 'pointer' : 'default' }}
            >
              <Text fw={500} mb="sm">New Users</Text>
              {chartDataConfig.newUsers.length > 0 ? (
                <BarChart
                  {...commonChartProps}
                  data={chartDataConfig.newUsers}
                  series={[{ name: 'New Users', color: theme.colors.green[6] }]}
                  onMouseMove={(event: any) => {
                    if (event.activePayload && event.activePayload.length > 0) {
                      setActiveChartPayload(event.activePayload);
                    } else {
                      setActiveChartPayload(null);
                    }
                  }}
                  onMouseLeave={() => setActiveChartPayload(null)}
                />
              ) : <Text c="dimmed" ta="center" p="xl">No new user data.</Text>}
            </Paper>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Paper withBorder p="md" radius="md" shadow="sm"
              onClick={() => {
                if (activeChartPayload && activeChartPayload.length > 0 && activeChartPayload[0]?.payload?.date) {
                  handleChartPointClick(activeChartPayload[0].payload, 'Completions', activeChartPayload[0].payload.date);
                }
              }}
              style={{ cursor: activeChartPayload ? 'pointer' : 'default' }}
            >
              <Text fw={500} mb="sm">Mission Completions</Text>
              {chartDataConfig.completions.length > (isComparisonMode ? 0 : 1) ? (
                <AreaChart
                  {...commonChartProps}
                  data={chartDataConfig.completions}
                  series={[{ name: 'Completions', color: theme.colors.teal[6] }]}
                  curveType="monotone"
                  onMouseMove={(event: any) => {
                    if (event.activePayload && event.activePayload.length > 0) {
                      setActiveChartPayload(event.activePayload);
                    } else {
                      setActiveChartPayload(null);
                    }
                  }}
                  onMouseLeave={() => setActiveChartPayload(null)}
                />
              ) : <Text c="dimmed" ta="center" p="xl">Not enough data for trend.</Text>}
            </Paper>
          </Grid.Col>
        </Grid>
      )}

      {/* Mission Performance */}
      <Title order={4} mb="md" mt="xl">Mission Performance</Title>

      <Paper p="md" mb="md" withBorder shadow="xs">
        <Grid align="flex-end">
          <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
            <TextInput
              label="Search by Mission Name"
              placeholder="Enter mission name..."
              value={missionNameFilter}
              onChange={(event) => setMissionNameFilter(event.currentTarget.value)}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
            <MultiSelect
              label="Filter by Status"
              placeholder="Select statuses"
              data={availableStatuses}
              value={selectedStatusFilters}
              onChange={setSelectedStatusFilters}
              clearable
              searchable
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}> {/* Adjusted span */}
            <MultiSelect
              label="Filter by Tags"
              placeholder="Select tags"
              data={availableTags} // Use the new availableTags memo
              value={selectedTagFilters}
              onChange={setSelectedTagFilters}
              clearable
              searchable
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 'auto' }}> {/* Adjusted span */}
            <Button onClick={handleClearFilters} variant="outline" fullWidth={!theme.breakpoints.sm}> {/* Adjusted fullWidth condition */}
              Clear All Filters
            </Button>
          </Grid.Col>
        </Grid>
      </Paper>

      {analyticsError ? <Alert color="red" title="Error loading missions">{analyticsError}</Alert> :
        isLoadingAnalytics && !filteredAndSortedMissionsAnalytics?.length ? (
          <Center><Loader mt="xl" /></Center>
        ) : filteredAndSortedMissionsAnalytics && filteredAndSortedMissionsAnalytics.length > 0 ? (
          <Paper withBorder shadow="sm" radius="md" style={{ overflowX: 'auto' }}>
            <TableScrollContainer minWidth={950}>
              <Table striped highlightOnHover verticalSpacing="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Th sorted={missionSortStatus?.columnAccessor === 'name'} reversed={missionSortStatus?.direction === 'desc'} onSort={() => handleMissionSort('name')} width="25%">Mission Name</Th>
                    <Th sorted={missionSortStatus?.columnAccessor === 'status'} reversed={missionSortStatus?.direction === 'desc'} onSort={() => handleMissionSort('status')} width="10%">Status</Th>
                    <Th ta="right" sorted={missionSortStatus?.columnAccessor === 'estimated_starts'} reversed={missionSortStatus?.direction === 'desc'} onSort={() => handleMissionSort('estimated_starts')} width="12%">Starts (Est.)</Th>
                    <Th ta="right" sorted={missionSortStatus?.columnAccessor === 'total_completions'} reversed={missionSortStatus?.direction === 'desc'} onSort={() => handleMissionSort('total_completions')} width="12%">Completions</Th>
                    <Th ta="right" sorted={missionSortStatus?.columnAccessor === 'unique_completers'} reversed={missionSortStatus?.direction === 'desc'} onSort={() => handleMissionSort('unique_completers')} width="12%">Unique Completers</Th>
                    {/* Item 2: New "Overall Conversion" column */}
                    <Th ta="right" sorted={missionSortStatus?.columnAccessor === 'overallConversion'} reversed={missionSortStatus?.direction === 'desc'} onSort={() => handleMissionSort('overallConversion')} width="12%">Overall Conversion</Th>
                    <Table.Th style={{ width: '17%' }}>Dates (Start/End)</Table.Th>
                    <Table.Th style={{ width: '5%' }} ta="center">Funnel</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredAndSortedMissionsAnalytics.map((mission) => {
                    const status = getMissionStatus(mission.status);
                    const estimatedStartsNum = Number(mission.estimated_starts);
                    const totalCompletionsNum = Number(mission.total_completions);
                    const overallConversion = estimatedStartsNum > 0
                      ? ((totalCompletionsNum / estimatedStartsNum) * 100).toFixed(1) + '%'
                      : 'N/A';
                    return (
                      <Table.Tr key={mission.mission_id.toString()}>
                        <Table.Td>
                          <Anchor component={Link} to={`/${projectId}/missions/${mission.mission_id.toString()}`} size="sm" fw={500}>
                            {String(mission.name)}
                          </Anchor>
                          <Text size="xs" c="dimmed">ID: {formatBigInt(mission.mission_id)}</Text>
                        </Table.Td>
                        <Table.Td><Badge color={missionStatusColors[status] || theme.colors.gray[6]} variant="light">{status}</Badge></Table.Td>
                        <Table.Td ta="right">{formatBigInt(mission.estimated_starts)}</Table.Td>
                        <Table.Td ta="right">{formatBigInt(mission.total_completions)}</Table.Td>
                        <Table.Td ta="right">{formatBigInt(mission.unique_completers)}</Table.Td>
                        <Table.Td ta="right">{overallConversion}</Table.Td>
                        <Table.Td>
                          <Text size="xs">S: {formatOptionalBigIntTimestamp([mission.mission_start_time])}</Text>
                          <Text size="xs">E: {formatOptionalBigIntTimestamp(mission.mission_end_time)}</Text>
                        </Table.Td>
                        <Table.Td ta="center">
                          <Tooltip label={`View Funnel for ${String(mission.name)}`} withArrow position="left">
                            <ActionIcon variant="subtle" color="blue" onClick={() => handleViewFunnel(mission)}>
                              <IconChartFunnel size={18} />
                            </ActionIcon>
                          </Tooltip>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </TableScrollContainer>
          </Paper>
        ) : (
          <Text c="dimmed" ta="center" mt="xl" p="lg">No mission analytics data available.</Text> // Consistent "No Data"
        )}

      <Modal
        opened={!!selectedMissionForFunnel}
        onClose={() => {
          setSelectedMissionForFunnel(null);
          setFunnelData(null);
          setFunnelError(null);
        }}
        title={null}
        size="lg"
        overlayProps={{ backgroundOpacity: 0.55, blur: 3 }}
        centered
        closeOnClickOutside={false}
      >
        <MissionFunnelChart
          funnelData={funnelData}
          missionName={selectedMissionForFunnel?.name ? String(selectedMissionForFunnel.name) : undefined}
          isLoading={loadingFunnel}
          error={funnelError}
        />
      </Modal>

      <Modal
        opened={drillDownModalOpen}
        onClose={() => setDrillDownModalOpen(false)}
        title={drillDownData?.title || "Details"}
        size="lg"
        overlayProps={{ backgroundOpacity: 0.55, blur: 3 }}
      >
        {drillDownData && drillDownData.users.length > 0 ? (
          <List size="sm" spacing="xs" withPadding>
            {drillDownData.users.slice(0, 100).map(uuid => (
              <List.Item key={uuid}>
                <Anchor component={Link} to={`/${projectId}/users/${uuid}`} /* target="_blank" rel="noopener noreferrer" // Optional: open in new tab */>
                  {uuid}
                </Anchor>
              </List.Item>
            ))}
            {drillDownData.users.length > 100 && <List.Item>...and {drillDownData.users.length - 100} more users.</List.Item>}
          </List>
        ) : (
          <Text c="dimmed">No specific users found for this selection.</Text>
        )}
      </Modal>

      {/* User Lifecycle & Retention */}
      <Title order={3} mb="md" mt="xl">User Lifecycle & Retention</Title>
      <Grid gutter="md" mb="xl">
        <Grid.Col span={{ base: 12, lg: 5 }}> {/* Lifecycle Data Cards */}
          <Paper withBorder p="md" radius="md" shadow="sm">
            <Text fw={500} mb="md">Lifecycle (Last {timeSeriesRange} Days vs Previous {timeSeriesRange} Days)</Text>
            {lifecycleData ? (
              <SimpleGrid cols={2} spacing="md">
                <StatCard title="Active Users" value={lifecycleData.currentPeriodActiveUsers} icon={<IconUsers size={18} />} color="blue" />
                <StatCard title="New Users" value={lifecycleData.newUsers} icon={<IconUserPlus size={18} />} color="green" />
                <StatCard title="Retained Users" value={lifecycleData.retainedUsers} icon={<IconUsers size={18} />} color="teal" />
                <StatCard title="Resurrected Users" value={lifecycleData.resurrectedUsers} icon={<IconActivity size={18} />} color="grape" />
                <StatCard title="Churned Users" value={lifecycleData.churnedUsers} icon={<IconUsers size={18} />} color="red" />
                <StatCard title="Quick Ratio" value={lifecycleData.quickRatio || "N/A"} icon={<IconRefresh size={18} />} color="yellow" />
              </SimpleGrid>
            ) : (
              <Text c="dimmed" ta="center" p="xl">Lifecycle data not available.</Text>
            )}
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 7 }}> {/* Retention Table */}
          <Paper withBorder p="md" radius="md" shadow="sm" style={{ overflow: 'hidden' }}>
            <Text fw={500} mb="md">Weekly Retention Cohorts</Text>
            {retentionData && retentionData.length > 0 ? (
              <TableScrollContainer minWidth={700}>
                <Table striped highlightOnHover withColumnBorders withTableBorder>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Cohort (Week Of)</Table.Th>
                      <Table.Th ta="center">Size</Table.Th>
                      {Array.from({ length: retentionData[0].retentionValues.length }).map((_, idx) => (
                        <Table.Th key={idx} ta="center">W{idx}</Table.Th>
                      ))}
                    </Table.Tr>
                  </Table.Thead>

                  <Table.Tbody>
                    {retentionData.map((cohort) => (
                      <Table.Tr key={cohort.cohortDateLabel}>
                        <Table.Td>{cohort.cohortDateLabel.replace("Week of ", "")}</Table.Td>
                        <Table.Td ta="center">{cohort.cohortSize}</Table.Td>
                        {cohort.retentionValues.map((cellData, weekIdx) => (
                          <Table.Td
                            key={weekIdx}
                            ta="center"
                            style={{
                              backgroundColor: getRetentionCellColor(cellData.percentage),
                              color: cellData.percentage !== null && cellData.percentage > 50 ? theme.white : theme.black,
                              cursor: cellData.users.length > 0 ? 'pointer' : 'default'
                            }}
                            onClick={() => {
                              if (cellData.users.length > 0) {
                                handleRetentionCellClick(cohort.cohortDateLabel, weekIdx, cellData.users);
                              }
                            }}
                          >
                            <Tooltip
                              label={
                                cellData.percentage === null
                                  ? "Future week"
                                  : cellData.users.length > 0
                                    ? `${cellData.users.length} users retained. Click to view.`
                                    : "No users retained"
                              }
                              disabled={cellData.percentage === null && cellData.users.length === 0}
                            >
                              <span>
                                {cellData.percentage !== null ? `${cellData.percentage.toFixed(0)}%` : '-'}
                              </span>
                            </Tooltip>
                          </Table.Td>
                        ))}
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </TableScrollContainer>
            ) : (
              <Text c="dimmed" ta="center" p="xl">Retention data not available or still processing.</Text>
            )}
          </Paper>
        </Grid.Col>
      </Grid>
    </Box>
  );
};

export default DashboardPage;