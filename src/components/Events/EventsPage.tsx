// src/components/Events/EventsPage.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Box, Title, Text, Paper, Loader, Alert, Button, Group, Table, ActionIcon, Badge,
    useMantineTheme, Tooltip, Avatar, ScrollArea, Menu, TextInput, Stack,
    Pagination, Select, MultiSelect, Popover, Image,
    ThemeIcon,
} from '@mantine/core';
import {
    IconCalendarEvent, IconAlertCircle, IconPlus, IconPencil, IconTrash, IconEye,
    IconCurrencyDollar, IconPhoto, IconFilter, IconSearch, IconX, IconBuildingStore,
    IconUsers, IconLanguage,
    IconTag,
} from '@tabler/icons-react';
import { useDebouncedValue } from '@mantine/hooks';

// Assuming your EventFormModal is in a subfolder, adjust path if needed
import EventFormModal from './components/EventFormModal.tsx';
import EventViewModal from './components/EventViewModal.tsx'; // Import the view modal
import type { KonectaEvent, EventStatus, EventToken, EventFormValues, EventFileUploads } from './types.ts'; // Adjust path

// --- Mock Data for Events ---
const MOCK_DB_EVENTS: KonectaEvent[] = [
    {
        id: 'evt1',
        projectId: 'project-konecta',
        name: 'Konecta Genesis AMA',
        description: 'Join us for an Ask Me Anything session about the Konecta platform, KTA token, and our upcoming SNS launch. Get your questions ready!\n\n**Agenda:**\n- Introduction to Konecta\n- KTA Tokenomics\n- SNS Launch Details\n- Q&A with the team',
        coverPhotoUrl: 'https://placehold.co/800x300/337FF5/FFF?text=Konecta+AMA+Session',
        location: 'X Spaces @KonectaPlatform',
        language: 'en',
        startDate: new Date(Date.now() + 86400000 * 7).getTime(), // 7 days from now
        endDate: new Date(Date.now() + 86400000 * 7 + (1.5 * 3600000)).getTime(), // 1.5 hour duration
        status: 'published',
        categories: ['AMA', 'Community', 'ICP', 'SNS'],
        interests: ['Tokens', 'Web3', 'Blockchain'],
        priceToken: 'FREE',
        createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
        updatedAt: new Date().toISOString(),
    },
    {
        id: 'evt2',
        projectId: 'project-konecta',
        name: 'ICP Developer Workshop: Building with Konecta APIs',
        description: 'A deep dive workshop for developers looking to integrate their dApps with Konecta. Explore our mission and event APIs. Prerequisites: Basic understanding of ICP development.',
        coverPhotoUrl: 'https://placehold.co/800x300/2AB272/FFF?text=Developer+Workshop',
        location: 'Zoom (Link sent to registered participants)',
        language: 'en',
        startDate: new Date(Date.now() + 86400000 * 14).getTime(), // 14 days from now
        endDate: new Date(Date.now() + 86400000 * 14 + (2 * 3600000)).getTime(), // 2 hours duration
        status: 'draft',
        categories: ['Workshop', 'Development', 'API', 'ICP'],
        interests: ['Developers', 'dApps', 'Integrations'],
        priceToken: 'ICP',
        tokenAmount: 0.5,
        createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
        updatedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    },
    {
        id: 'evt3',
        projectId: 'project-alpha', // Different project
        name: 'Project Alpha Launch Party & NFT Drop',
        description: 'Celebrate the official launch of Project Alpha! Join us for exclusive insights, meet the team, and participate in our commemorative NFT drop.',
        coverPhotoUrl: 'https://placehold.co/800x300/8849EB/FFF?text=Alpha+Launch+Party',
        location: 'Discord Stage - Project Alpha Server',
        language: 'es',
        startDate: new Date(Date.now() + 86400000 * 3).getTime(), // 3 days from now
        endDate: new Date(Date.now() + 86400000 * 3 + (2.5 * 3600000)).getTime(), // 2.5 hours duration
        status: 'published',
        categories: ['Launch', 'Party', 'Community', 'NFT'],
        interests: ['Gaming', 'Collectibles', 'Web3'],
        priceToken: 'FREE',
        createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
        updatedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    },
    {
        id: 'evt4',
        projectId: 'project-konecta',
        name: 'Konecta & Friends: Cross-Community Meetup',
        description: 'A virtual meetup bringing together various ICP communities. Network, share ideas, and explore collaboration opportunities. Co-hosted with several leading ICP projects.',
        // No cover photo for this one
        location: 'Google Meet (Invite only)',
        language: 'en',
        startDate: new Date(Date.now() + 86400000 * 20).getTime(), // 20 days from now
        endDate: new Date(Date.now() + 86400000 * 20 + (1 * 3600000)).getTime(), // 1 hour duration
        status: 'active', // Event is ongoing
        categories: ['Networking', 'Community', 'Collaboration', 'ICP'],
        interests: ['Partnerships', 'Ecosystem Growth'],
        priceToken: 'CKBTC',
        tokenAmount: 0.001,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    }
];

// --- Mock API Functions for Events ---
const fetchEventsForProjectAPI = (projectId: string): Promise<KonectaEvent[]> => {
    console.log(`API: Fetching events for project ${projectId}`);
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve(MOCK_DB_EVENTS.filter(e => e.projectId === projectId));
        }, 700);
    });
};

const addEventToProjectAPI = (
    eventData: Omit<KonectaEvent, 'id' | 'createdAt' | 'updatedAt'>
): Promise<KonectaEvent> => {
    console.log('API: Adding event', eventData);
    return new Promise((resolve) => {
        setTimeout(() => {
            const newEvent: KonectaEvent = {
                ...eventData,
                id: `evt${Date.now()}`,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
            MOCK_DB_EVENTS.unshift(newEvent); // Add to the beginning for better UX in the list
            resolve(newEvent);
        }, 500);
    });
};

const updateEventInProjectAPI = (
    eventId: string,
    eventUpdates: Partial<Omit<KonectaEvent, 'id' | 'createdAt' | 'updatedAt' | 'projectId'>>
): Promise<KonectaEvent> => {
    console.log(`API: Updating event ${eventId}`, eventUpdates);
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            const index = MOCK_DB_EVENTS.findIndex(e => e.id === eventId);
            if (index > -1) {
                MOCK_DB_EVENTS[index] = {
                    ...MOCK_DB_EVENTS[index],
                    ...eventUpdates,
                    updatedAt: new Date().toISOString(),
                };
                resolve(MOCK_DB_EVENTS[index]);
            } else {
                reject(new Error("Event not found for update"));
            }
        }, 500);
    });
};

const deleteEventFromProjectAPI = (eventId: string): Promise<void> => {
    console.log(`API: Deleting event ${eventId}`);
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            const index = MOCK_DB_EVENTS.findIndex(e => e.id === eventId);
            if (index > -1) {
                MOCK_DB_EVENTS.splice(index, 1);
                resolve();
            } else {
                reject(new Error("Event not found for deletion"));
            }
        }, 500);
    });
};

// --- Helper to simulate file upload and return a URL ---
// In a real app, this would be an actual upload service call
const uploadFileSimulator = (file: File): Promise<string> => {
    return new Promise((resolve) => {
        setTimeout(() => {
            // Using placehold.co for a visual placeholder.
            // Using a simple hash of name and size to make images slightly different for different files.
            const simpleHash = file.name.length + file.size % 100;
            resolve(`https://placehold.co/800x300/${simpleHash}CC99/FFFFFF?text=Uploaded:${file.name.substring(0, 10)}`);
        }, 300); // Simulate network delay
    });
};


const EventsPage: React.FC = () => {
    const { projectId } = useParams<{ projectId: string }>();
    const navigate = useNavigate();
    const theme = useMantineTheme();

    const [events, setEvents] = useState<KonectaEvent[]>([]);
    const [allProjectEvents, setAllProjectEvents] = useState<KonectaEvent[]>([]); // To store all events for filtering
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Modal States
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState<KonectaEvent | null>(null);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [viewingEvent, setViewingEvent] = useState<KonectaEvent | null>(null);

    // Filtering & Sorting States
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm] = useDebouncedValue(searchTerm, 300);
    const [selectedStatus, setSelectedStatus] = useState<EventStatus | null>(null);
    const [selectedPriceToken, setSelectedPriceToken] = useState<EventToken | null>(null);
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [allAvailableCategories, setAllAvailableCategories] = useState<string[]>([]);


    // Pagination states
    const [activePage, setActivePage] = useState(1);
    const ITEMS_PER_PAGE = 7;


    const fetchProjectEvents = () => {
        if (projectId) {
            setLoading(true); setError(null);
            fetchEventsForProjectAPI(projectId)
                .then(data => {
                    const sortedData = data.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
                    setAllProjectEvents(sortedData); // Store all for client-side filtering
                    setEvents(sortedData); // Initial display

                    // Extract unique categories for filter dropdown
                    const categories = new Set<string>();
                    data.forEach(event => event.categories.forEach(cat => categories.add(cat)));
                    setAllAvailableCategories(Array.from(categories).sort());

                    setLoading(false);
                })
                .catch(err => {
                    console.error("Failed to fetch events:", err);
                    setError(`Failed to load events for project ${projectId}.`);
                    setLoading(false);
                });
        } else {
            setError("Project ID is missing.");
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProjectEvents();
    }, [projectId]);

    // Filtering logic
    useEffect(() => {
        let filtered = [...allProjectEvents];

        if (debouncedSearchTerm) {
            filtered = filtered.filter(event =>
                event.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                event.description.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                event.location.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
            );
        }
        if (selectedStatus) {
            filtered = filtered.filter(event => event.status === selectedStatus);
        }
        if (selectedPriceToken) {
            filtered = filtered.filter(event => event.priceToken === selectedPriceToken);
        }
        if (selectedCategories.length > 0) {
            filtered = filtered.filter(event =>
                selectedCategories.every(selCat => event.categories.includes(selCat))
            );
        }
        setEvents(filtered);
        setActivePage(1); // Reset to first page on filter change
    }, [debouncedSearchTerm, selectedStatus, selectedPriceToken, selectedCategories, allProjectEvents]);


    const paginatedEvents = useMemo(() => {
        const startIndex = (activePage - 1) * ITEMS_PER_PAGE;
        return events.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [events, activePage]);


    // --- Modal Control ---
    const handleOpenCreateModal = () => { setEditingEvent(null); setIsFormModalOpen(true); };
    const handleOpenEditModal = (event: KonectaEvent) => { setEditingEvent(event); setIsFormModalOpen(true); };
    const handleCloseFormModal = () => { setIsFormModalOpen(false); setEditingEvent(null); };
    const handleOpenViewModal = (event: KonectaEvent) => { setViewingEvent(event); setIsViewModalOpen(true); };
    const handleCloseViewModal = () => { setIsViewModalOpen(false); setViewingEvent(null); };

    // --- Data Mutation ---
    const handleFormSubmit = async (formValues: EventFormValues, filesToUpload: EventFileUploads) => {
        if (!projectId) {
            alert("Project ID is missing."); return;
        }
        setIsSubmitting(true);

        let finalCoverPhotoUrl: string | undefined = formValues.coverPhotoUrl; // Existing or initial URL from form

        if (filesToUpload.coverPhotoFile) {
            try {
                finalCoverPhotoUrl = await uploadFileSimulator(filesToUpload.coverPhotoFile);
            } catch (uploadError) {
                console.error("Cover photo upload failed:", uploadError);
                alert("Cover photo upload failed (simulated). Event not saved.");
                setIsSubmitting(false); return;
            }
        } else if (!formValues.coverPhotoFile && formValues.coverPhotoUrl === '' && editingEvent?.coverPhotoUrl) {
            // This implies the user cleared an existing photo.
            // The EventFormModal should set formValues.coverPhotoUrl to '' if the image is cleared by the user.
            // For now, this covers the case where the URL in the form is explicitly empty.
            finalCoverPhotoUrl = undefined;
        }


        const eventData: Omit<KonectaEvent, 'id' | 'createdAt' | 'updatedAt'> = {
            projectId: projectId,
            name: formValues.name || 'Untitled Event',
            description: formValues.description || '',
            coverPhotoUrl: finalCoverPhotoUrl,
            location: formValues.location || 'Online',
            language: formValues.language || 'en',
            startDate: formValues.startDate instanceof Date ? formValues.startDate.getTime() : Date.now(),
            endDate: formValues.endDate instanceof Date ? formValues.endDate.getTime() : (formValues.startDate instanceof Date ? formValues.startDate.getTime() : Date.now()) + 3600000,
            status: formValues.status || 'draft',
            categories: formValues.categories || [],
            interests: formValues.interests || [],
            priceToken: formValues.priceToken || 'FREE',
            tokenAmount: formValues.priceToken !== 'FREE' ? (formValues.tokenAmount || 0) : undefined,
        };

        try {
            if (editingEvent) {
                await updateEventInProjectAPI(editingEvent.id, eventData as Partial<Omit<KonectaEvent, 'id' | 'createdAt' | 'updatedAt' | 'projectId'>>);
            } else {
                await addEventToProjectAPI(eventData);
            }
            fetchProjectEvents();
            handleCloseFormModal();
        } catch (apiError: any) {
            console.error("Failed to save event:", apiError);
            setError(apiError?.message || "Failed to save event.");
            // alert(`Error saving event: ${apiError instanceof Error ? apiError.message : String(apiError)}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteEvent = async (eventId: string) => {
        if (window.confirm("Are you sure you want to delete this event? This action cannot be undone.")) {
            setIsSubmitting(true);
            try {
                await deleteEventFromProjectAPI(eventId);
                fetchProjectEvents();
            } catch (apiError: any) {
                console.error("Failed to delete event:", apiError);
                setError(apiError?.message || "Failed to delete event.");
                // alert(`Error deleting event: ${apiError instanceof Error ? apiError.message : String(apiError)}`);
            } finally {
                setIsSubmitting(false);
            }
        }
    };

    // --- UI Helpers ---
    const getStatusColor = (status: EventStatus): string => {
        const colors: Record<EventStatus, string> = {
            draft: 'gray', published: 'blue', active: 'green', completed: 'teal', canceled: 'red',
        };
        return colors[status] || 'gray';
    };

    const renderPrice = (event: KonectaEvent) => {
        if (event.priceToken === 'FREE') return <Badge color="green" variant="light" size="sm">Free</Badge>;
        return (
            <Badge color="orange" variant="light" size="sm" leftSection={<IconCurrencyDollar size={14} />}>
                {event.tokenAmount} {event.priceToken}
            </Badge>
        );
    };

    const formatDate = (timestamp: number) => new Date(timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

    if (loading && events.length === 0) {
        return <Box p="md" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 'calc(100vh - 200px)' }}><Loader size="xl" /></Box>;
    }
    if (error && events.length === 0) {
        return <Box p="md"><Alert icon={<IconAlertCircle size="1rem" />} title="Error!" color="red" radius="md">{error}</Alert></Box>;
    }

    const eventTableRows = paginatedEvents.map((event) => (
        <Table.Tr key={event.id}>
            <Table.Td>
                <Group gap="sm" wrap="nowrap">
                    <Avatar
                        src={event.coverPhotoUrl}
                        radius="sm"
                        size="lg"
                        alt={event.name}
                    >
                        {!event.coverPhotoUrl && <IconPhoto size={20} />}
                    </Avatar>
                    <Stack gap={0}>
                        <Text fw={500} size="sm" lineClamp={1}>{event.name}</Text>
                        <Text size="xs" c="dimmed" lineClamp={1}>{event.location}</Text>
                    </Stack>
                </Group>
            </Table.Td>
            <Table.Td>
                <Stack gap={2}>
                    <Text size="xs">{formatDate(event.startDate)}</Text>
                    <Text size="xs" c="dimmed">{new Date(event.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                </Stack>
            </Table.Td>
            <Table.Td><Badge color={getStatusColor(event.status)} variant="light">{event.status.charAt(0).toUpperCase() + event.status.slice(1)}</Badge></Table.Td>
            <Table.Td>{renderPrice(event)}</Table.Td>
            <Table.Td>
                {event.categories.slice(0, 2).map(cat => <Badge key={cat} color="grape" variant="outline" size="xs" mr={4} mb={4}>{cat}</Badge>)}
                {event.categories.length > 2 && <Text size="xs" c="dimmed">+{event.categories.length - 2}</Text>}
            </Table.Td>
            <Table.Td>
                <Group gap={4} justify="flex-end" wrap="nowrap">
                    <Tooltip label="View Details" withArrow>
                        <ActionIcon variant="subtle" onClick={() => handleOpenViewModal(event)}><IconEye size={18} /></ActionIcon>
                    </Tooltip>
                    <Tooltip label="Edit Event" withArrow>
                        <ActionIcon variant="subtle" color="blue" onClick={() => handleOpenEditModal(event)}><IconPencil size={18} /></ActionIcon>
                    </Tooltip>
                    <Tooltip label="Delete Event" withArrow>
                        <ActionIcon variant="subtle" color="red" onClick={() => handleDeleteEvent(event.id)} loading={isSubmitting && viewingEvent?.id !== event.id}><IconTrash size={18} /></ActionIcon>
                    </Tooltip>
                </Group>
            </Table.Td>
        </Table.Tr>
    ));

    return (
        <Box p="md">
            <Group justify="space-between" mb="xl">
                <Title order={2}>Events for Project: <Text span c="blue" inherit>{projectId}</Text></Title>
                <Button leftSection={<IconPlus size={16} />} onClick={handleOpenCreateModal} disabled={isSubmitting}>
                    Create Event
                </Button>
            </Group>

            {error && <Alert icon={<IconAlertCircle size="1rem" />} title="Error Notice" color="red" radius="md" mb="md" withCloseButton onClose={() => setError(null)}>{error}</Alert>}

            <Paper shadow="sm" p="md" withBorder mb="lg">
                <Group grow>
                    <TextInput
                        placeholder="Search by name, description, location..."
                        leftSection={<IconSearch size={16} />}
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.currentTarget.value)}
                        rightSection={searchTerm ? <ActionIcon onClick={() => setSearchTerm('')}><IconX size={14} /></ActionIcon> : null}
                    />
                    <Select
                        placeholder="Filter by status"
                        leftSection={<IconFilter size={16} />}
                        data={[
                            { value: '', label: 'All Statuses' },
                            ...(['draft', 'published', 'active', 'completed', 'canceled'].map((s: string) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) })))
                        ]}
                        value={selectedStatus}
                        onChange={(value) => setSelectedStatus(value as EventStatus | null)}
                        clearable
                    />
                    <Select
                        placeholder="Filter by price type"
                        leftSection={<IconCurrencyDollar size={16} />}
                        data={[
                            { value: '', label: 'All Price Types' },
                            { value: 'FREE', label: 'FREE' },
                            { value: 'ICP', label: 'ICP' },
                            { value: 'CKBTC', label: 'CKBTC' }
                        ]}
                        value={selectedPriceToken}
                        onChange={(value) => setSelectedPriceToken(value as EventToken | null)}
                        clearable
                    />
                    <MultiSelect
                        placeholder="Filter by categories"
                        leftSection={<IconTag size={16} />}
                        data={allAvailableCategories}
                        value={selectedCategories}
                        onChange={setSelectedCategories}
                        searchable
                        clearable
                    />
                </Group>
            </Paper>


            {loading && events.length === 0 ? (
                <Text>Loading events...</Text> /* Or a more prominent loader */
            ) : events.length === 0 ? (
                <Paper withBorder p="xl" style={{ textAlign: 'center' }}>
                    <ThemeIcon variant="light" size={60} radius={60} color="gray" mb="md">
                        <IconCalendarEvent size={30} stroke={1.5} />
                    </ThemeIcon>
                    <Text size="lg" mt="md" fw={500}>No events found.</Text>
                    <Text c="dimmed">Try adjusting your filters or create a new event for this project.</Text>
                    <Button mt="xl" onClick={handleOpenCreateModal} variant="outline">Create Your First Event</Button>
                </Paper>
            ) : (
                <Paper shadow="sm" p={0} withBorder>
                    <ScrollArea>
                        <Table striped highlightOnHover verticalSpacing="md" miw={900}>
                            <Table.Thead>
                                <Table.Tr>
                                    <Table.Th>Event</Table.Th>
                                    <Table.Th>Date</Table.Th>
                                    <Table.Th>Status</Table.Th>
                                    <Table.Th>Price</Table.Th>
                                    <Table.Th>Categories</Table.Th>
                                    <Table.Th style={{ textAlign: 'right' }}>Actions</Table.Th>
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>{eventTableRows}</Table.Tbody>
                        </Table>
                    </ScrollArea>
                    {events.length > ITEMS_PER_PAGE && (
                        <Group justify="center" p="md">
                            <Pagination total={Math.ceil(events.length / ITEMS_PER_PAGE)} value={activePage} onChange={setActivePage} />
                        </Group>
                    )}
                </Paper>
            )}

            <EventFormModal
                opened={isFormModalOpen}
                onClose={handleCloseFormModal}
                onSubmit={handleFormSubmit}
                initialData={editingEvent}
                projectId={projectId || ''} // Ensure projectId is passed
            />

            <EventViewModal
                opened={isViewModalOpen}
                onClose={handleCloseViewModal}
                event={viewingEvent}
            />
        </Box>
    );
};

export default EventsPage;
