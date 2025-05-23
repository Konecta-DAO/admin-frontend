// src/components/Events/components/EventViewModal.tsx

import React from 'react';
import {
    Modal, Stack, Image, Group, Title, Badge, Divider, Paper, Text, Box, SimpleGrid, Code,
    useMantineTheme, Button, ScrollArea, useMantineColorScheme, ThemeIcon, Accordion, Anchor, Center
} from '@mantine/core';
import {
    IconCalendarEvent, IconClock, IconMapPin, IconWorld, IconTag, IconCurrencyDollar, IconInfoCircle,
    IconUsers, IconPhoto, IconBuildingStore, IconLanguage, IconListDetails, IconTimeline, IconActivity,
    IconTicket, IconAlignLeft, IconTags, IconLink
} from '@tabler/icons-react';
import type { KonectaEvent, EventStatus } from '../types.ts'; // Adjust path as needed

// Helper component for consistent information display lines
const InfoLine: React.FC<{
    icon?: React.ReactNode;
    label: string;
    value?: string | React.ReactNode;
    valueBold?: boolean;
    hidden?: boolean;
    isLink?: boolean;
    children?: React.ReactNode;
}> = ({ icon, label, value, valueBold, hidden, isLink, children }) => {
    if (hidden) return null;
    if (!value && !children) return null;

    let displayValue = value;
    if (typeof value === 'string' && isLink) {
        try {
            new URL(value); // Check if it's a valid URL
            displayValue = <Anchor href={value} target="_blank" size="sm" lh={1.2}>{value}</Anchor>;
        } catch (_) {
            // Not a valid URL, display as text
        }
    }


    return (
        <Group wrap="nowrap" gap="sm" align="flex-start" style={{ lineHeight: 1.4 }}>
            {icon && <ThemeIcon variant="light" color="gray" size="md" radius="sm" style={{ marginTop: 2 }}>{icon}</ThemeIcon>}
            <Text size="sm" c="dimmed" w={100} ta="right" fw={500}>{label}:</Text>
            {children ? (
                <Box style={{ flex: 1 }}>{children}</Box>
            ) : (
                displayValue && (typeof displayValue === 'string' ?
                    <Text size="sm" fw={valueBold ? 600 : 400} style={{ flex: 1 }}>{displayValue}</Text> :
                    <Box style={{ flex: 1 }}>{displayValue}</Box>)
            )}
        </Group>
    );
};

// Helper component for section cards
const InfoCard: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpened?: boolean }> = ({ title, icon, children, defaultOpened = true }) => {
    return (
        <Paper shadow="xs" radius="md" withBorder>
            <Accordion defaultValue={defaultOpened ? "content" : undefined} variant="transparent">
                <Accordion.Item value="content">
                    <Accordion.Control>
                        <Group gap="xs">
                            <ThemeIcon variant="light" size="lg">{icon}</ThemeIcon>
                            <Title order={5}>{title}</Title>
                        </Group>
                    </Accordion.Control>
                    <Accordion.Panel>
                        <Stack gap="sm" pl="xs" pr="xs" pb="xs">
                            {children}
                        </Stack>
                    </Accordion.Panel>
                </Accordion.Item>
            </Accordion>
        </Paper>
    );
};

interface EventViewModalProps {
    opened: boolean;
    onClose: () => void;
    event: KonectaEvent | null;
}

const EventViewModal: React.FC<EventViewModalProps> = ({ opened, onClose, event }) => {
    const theme = useMantineTheme();
    const { colorScheme } = useMantineColorScheme();

    if (!event) return null;

    const getStatusColor = (status: EventStatus) => {
        const colorMap: Record<EventStatus, string> = {
            draft: 'gray', published: 'blue', active: 'green', completed: 'teal', canceled: 'red',
        };
        return colorMap[status] || 'gray';
    };

    const formatDate = (timestamp: number, withTime = true) => {
        const options: Intl.DateTimeFormatOptions = {
            year: 'numeric', month: 'long', day: 'numeric',
        };
        if (withTime) {
            options.hour = '2-digit';
            options.minute = '2-digit';
            options.hour12 = true;
        }
        return new Date(timestamp).toLocaleString(undefined, options);
    };

    const formatDuration = (start: number, end: number) => {
        const durationMs = end - start;
        if (durationMs <= 0) return 'N/A';
        const days = Math.floor(durationMs / (1000 * 60 * 60 * 24));
        const hours = Math.floor((durationMs / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((durationMs / (1000 * 60)) % 60);

        let parts: string[] = [];
        if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);
        if (hours > 0) parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
        if (minutes > 0) parts.push(`${minutes} minute${minutes > 1 ? 's' : ''}`);
        if (parts.length === 0 && durationMs > 0) return "Less than a minute";
        return parts.join(', ');
    };

    const priceText = event.priceToken === 'FREE'
        ? <Badge color="green" variant="light" size="md">Free Event</Badge>
        : <Badge color="orange" variant="light" size="md">{event.tokenAmount} {event.priceToken}</Badge>;

    const cardIconColor = colorScheme === 'dark' ? theme.colors.blue[3] : theme.colors.blue[6];

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title={
                <Group gap="sm">
                    <ThemeIcon variant="light" size={36} radius="md" color={getStatusColor(event.status)}>
                        <IconCalendarEvent size={20} />
                    </ThemeIcon>
                    <Title order={3} style={{ flex: 1 }} lineClamp={2}>{event.name}</Title>
                </Group>
            }
            size="xl" // xl or xxl
            overlayProps={{ backgroundOpacity: 0.6, blur: 4 }}
            centered
            scrollAreaComponent={ScrollArea.Autosize}
            styles={{
                header: { borderBottom: `1px solid ${colorScheme === 'dark' ? theme.colors.dark[5] : theme.colors.gray[2]}`, paddingBottom: theme.spacing.sm },
                body: { paddingTop: theme.spacing.md },
            }}
        >
            <Stack gap="xl">
                {event.coverPhotoUrl && (
                    <Paper radius="md" shadow="md" withBorder>
                        <Image
                            src={event.coverPhotoUrl}
                            alt={`${event.name} cover photo`}
                            height={250}
                            radius="md"
                            fit="cover"
                            fallbackSrc={`https://placehold.co/1200x400/${theme.colors.gray[3]}/${theme.colors.gray[7]}?text=Event+Cover`}
                        />
                    </Paper>
                )}
                {!event.coverPhotoUrl && (
                    <Center>
                        <ThemeIcon variant="light" color="gray" size={100} radius="md">
                            <IconPhoto size={50} />
                        </ThemeIcon>
                    </Center>
                )}


                <Group justify="space-between" align="center" mb="xs" mt={event.coverPhotoUrl ? 0 : "md"}>
                    {/* Title already in modal header, could add short description here if needed */}
                    <Badge size="xl" radius="sm" color={getStatusColor(event.status)} variant="filled">
                        {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                    </Badge>
                </Group>

                <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
                    <Stack gap="lg">
                        <InfoCard title="When & Where" icon={<IconClock color={cardIconColor} />}>
                            <InfoLine icon={<IconCalendarEvent />} label="Start Date" value={formatDate(event.startDate, true)} valueBold />
                            <InfoLine icon={<IconCalendarEvent />} label="End Date" value={formatDate(event.endDate, true)} />
                            <InfoLine icon={<IconTimeline />} label="Duration" value={formatDuration(event.startDate, event.endDate)} />
                            <Divider my="xs" />
                            <InfoLine icon={<IconMapPin />} label="Location" value={event.location} isLink={true} valueBold />
                            <InfoLine icon={<IconLanguage />} label="Language" value={event.language?.toUpperCase()} />
                        </InfoCard>

                        <InfoCard title="Ticketing" icon={<IconTicket color={cardIconColor} />}>
                            <InfoLine icon={<IconCurrencyDollar />} label="Price" value={priceText} />
                            {event.priceToken !== 'FREE' && event.tokenAmount !== undefined && (
                                <InfoLine label="Amount" value={`${event.tokenAmount} ${event.priceToken}`} />
                            )}
                        </InfoCard>
                    </Stack>

                    <Stack gap="lg">
                        {event.description && (
                            <InfoCard title="About This Event" icon={<IconAlignLeft color={cardIconColor} />} defaultOpened={true}>
                                {/* A proper Markdown renderer would be ideal here if complex markdown is used */}
                                <Box
                                    fz="sm"
                                    lh={1.65}
                                    style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '300px', overflowY: 'auto', padding: '2px' }}
                                    dangerouslySetInnerHTML={{ __html: event.description.replace(/\n\n/g, '<br /><br />').replace(/\n/g, '<br />') }}
                                />
                            </InfoCard>
                        )}

                        {(event.categories.length > 0 || event.interests.length > 0) && (
                            <InfoCard title="Tags & Topics" icon={<IconTags color={cardIconColor} />}>
                                <InfoLine icon={<IconTag />} label="Categories" hidden={event.categories.length === 0}>
                                    <Group gap={6} wrap="wrap" mt={2}>
                                        {event.categories.map(c => <Badge key={c} variant="light" color="grape" radius="sm">{c}</Badge>)}
                                    </Group>
                                </InfoLine>
                                <InfoLine icon={<IconUsers />} label="Interests" hidden={event.interests.length === 0}>
                                    <Group gap={6} wrap="wrap" mt={2}>
                                        {event.interests.map(i => <Badge key={i} variant="light" color="cyan" radius="sm">{i}</Badge>)}
                                    </Group>
                                </InfoLine>
                            </InfoCard>
                        )}
                    </Stack>
                </SimpleGrid>

                <Paper p="xs" mt="md" radius="sm" bg={colorScheme === 'dark' ? theme.colors.dark[8] : theme.colors.gray[0]}>
                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
                        <Text size="xs" c="dimmed">Event ID: <Code fz="xs">{event.id}</Code></Text>
                        <Text size="xs" c="dimmed">Project ID: <Code fz="xs">{event.projectId}</Code></Text>
                        <Text size="xs" c="dimmed">Created: {formatDate(new Date(event.createdAt).getTime(), false)}</Text>
                        <Text size="xs" c="dimmed">Last Updated: {formatDate(new Date(event.updatedAt).getTime(), false)}</Text>
                    </SimpleGrid>
                </Paper>
            </Stack>

            <Group justify="flex-end" mt="xl" pt="md" style={{ borderTop: `1px solid ${colorScheme === 'dark' ? theme.colors.dark[5] : theme.colors.gray[2]}` }}>
                <Button variant="default" onClick={onClose} radius="md">Close</Button>
                {/* <Button leftSection={<IconPencil size={16}/>} radius="md">Edit Event</Button> */}
            </Group>
        </Modal>
    );
};

export default EventViewModal;