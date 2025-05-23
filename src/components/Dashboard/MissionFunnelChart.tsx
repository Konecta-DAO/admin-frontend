import React from 'react';
import { Box, Text, Paper, Group, ThemeIcon, useMantineTheme, Stack, Progress, Alert, Center, Loader, Tooltip, Badge } from '@mantine/core';
import { IconUsers, IconChecks, IconAlertCircle, IconArrowNarrowRight } from '@tabler/icons-react';
import type { AggregatedFunnelStep } from '../../declarations/projectCanister/test_backend.did.js';
import { formatBigInt } from './dashboardUtils.ts';

interface MissionFunnelChartProps {
    funnelData: AggregatedFunnelStep[] | null;
    missionName?: string;
    isLoading: boolean;
    error?: string | null;
}

const MissionFunnelChart: React.FC<MissionFunnelChartProps> = ({ funnelData, missionName, isLoading, error }) => {
    const theme = useMantineTheme();

    if (isLoading) {
        return <Center style={{ height: 200 }}><Loader /></Center>;
    }

    if (error) {
        return <Alert icon={<IconAlertCircle size="1rem" />} title="Error Loading Funnel" color="red" radius="md">{error}</Alert>;
    }

    if (!funnelData || funnelData.length === 0) {
        return <Text c="dimmed" ta="center" p="md">No funnel data available for this mission or mission has no defined steps.</Text>;
    }

    const initialReached = funnelData.length > 0 ? Number(funnelData[0].users_reached_step) : 0;

    return (
        <Paper shadow="none" p="md" /* No border here, modal provides it */ >
            {missionName && <Text size="lg" fw={700} mb="lg" ta="center">Mission Funnel: {missionName}</Text>}
            <Stack gap="xl">
                {funnelData.map((step, index) => {
                    const reached = Number(step.users_reached_step);
                    const completed = Number(step.users_completed_step);

                    // Conversion rate for this specific step (of those who reached it)
                    const stepConversionRate = reached > 0 ? (completed / reached) * 100 : 0;

                    // Overall conversion rate from the very beginning of the funnel up to this step's completion
                    const overallConversionFromStart = initialReached > 0 ? (completed / initialReached) * 100 : 0;

                    let dropOffFromPreviousToThisStepReached = 0;
                    let dropOffWithinThisStep = 0;

                    if (index > 0) {
                        const prevStepCompleted = Number(funnelData[index - 1].users_completed_step);
                        // Drop-off = users who completed previous step - users who reached current step
                        // This should ideally be 0 if users_reached_step is correctly set to prev_step_completed
                        // Any difference here indicates users who completed prev step but didn't appear as "reached" for current.
                        // However, our backend logic for users_reached_step makes this prevStepCompleted === reached (for step > 0)
                        dropOffFromPreviousToThisStepReached = prevStepCompleted > 0 ? ((prevStepCompleted - reached) / prevStepCompleted) * 100 : 0;
                    }
                    // Drop-off within this step = users who reached this step - users who completed this step
                    dropOffWithinThisStep = reached > 0 ? ((reached - completed) / reached) * 100 : (reached === 0 && completed === 0 ? 0 : 100);

                    return (
                        <Box key={`step-${formatBigInt(step.step_id)}-${index}`}>
                            <Group justify="space-between" mb={5}>
                                <Text fw={500} size="sm">
                                    {index + 1}. {step.step_name?.[0] || `Step ID: ${formatBigInt(step.step_id)}`}
                                </Text>
                                <Group gap="sm">
                                    <Tooltip label="Users who reached this step (i.e., completed the previous step, or started the mission for the first step)">
                                        <Badge
                                            color="blue"
                                            variant="light"
                                            leftSection={<IconUsers size={14} />}
                                        >
                                            {formatBigInt(step.users_reached_step)} Reached
                                        </Badge>
                                    </Tooltip>
                                    <Tooltip label="Users who successfully completed this specific step">
                                        <Badge
                                            color="teal"
                                            variant="light"
                                            leftSection={<IconChecks size={14} />}
                                        >
                                            {formatBigInt(step.users_completed_step)} Completed
                                        </Badge>
                                    </Tooltip>
                                </Group>
                            </Group>

                            <Tooltip label={`Overall progress: ${overallConversionFromStart.toFixed(1)}% of users who started the mission completed this step.`}>
                                <Progress.Root size="lg" radius="sm">
                                    <Progress.Section
                                        value={overallConversionFromStart}
                                        color={theme.colors.teal[index % theme.colors.teal.length]} // Vary color slightly
                                    >
                                        <Progress.Label>{overallConversionFromStart.toFixed(1)}% overall</Progress.Label>
                                    </Progress.Section>
                                </Progress.Root>
                            </Tooltip>

                            {/* Connector and drop-off info to the *next* potential step */}
                            {index < funnelData.length - 1 && (
                                <Group mt="xs" justify="flex-end">
                                    <Text c="dimmed" size="xs">
                                        {dropOffWithinThisStep.toFixed(1)}% drop-off within this step
                                    </Text>
                                    <ThemeIcon variant="subtle" color="gray" size="sm">
                                        <IconArrowNarrowRight />
                                    </ThemeIcon>
                                </Group>
                            )}
                            {/* For the last step, just show its own completion rate */}
                            {index === funnelData.length - 1 && (
                                <Group mt="xs" justify="flex-end">
                                    <Text c="dimmed" size="xs">
                                        Step completion: {stepConversionRate.toFixed(1)}% (of those who reached)
                                    </Text>
                                </Group>
                            )}
                        </Box>
                    );
                })}
            </Stack>
        </Paper>
    );
};

export default MissionFunnelChart;