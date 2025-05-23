import React, { useState, useEffect } from 'react';
import {
    Box, Title, Text, Paper, Loader, Alert, Button, Group, Stack,
    Switch, Select, NumberInput, Divider, Tabs,
    useMantineTheme, List, ThemeIcon, Center,
    Tooltip,
    ActionIcon,
    Anchor,
    useMantineColorScheme,
} from '@mantine/core';
import { useForm, yupResolver } from '@mantine/form';
import * as yup from 'yup';
import { notifications } from '@mantine/notifications';
import {
    IconSettings, IconBell, IconPalette, IconLock, IconDeviceFloppy, IconAlertCircle,
    IconListNumbers, IconLanguage, IconClock, IconShieldLock,
    IconPassword, IconLogin, IconRefresh,
} from '@tabler/icons-react';

// --- TypeScript Interfaces ---
interface NotificationSettings {
    emailNewFeatures: boolean;
    emailWeeklySummary: boolean;
    // inAppNotifications: boolean; // Example for future
}

interface PreferenceSettings {
    defaultItemsPerPage: number;
    language: string; // e.g., 'en', 'es'
    timezone: string; // e.g., 'UTC', 'America/New_York'
}

export interface GlobalAdminSettings {
    adminUserId: string; // Identifier for the admin user whose settings these are
    notifications: NotificationSettings;
    preferences: PreferenceSettings;
}

// Form values will be a flattened version for easier handling
export interface GlobalSettingsFormValues {
    // Notifications
    emailNewFeatures: boolean;
    emailWeeklySummary: boolean;
    // Preferences
    defaultItemsPerPage: number;
    language: string;
    timezone: string;
}

// --- Mock Data and API ---
let MOCK_DB_GLOBAL_SETTINGS: GlobalAdminSettings = {
    adminUserId: 'admin-user-001',
    notifications: {
        emailNewFeatures: true,
        emailWeeklySummary: false,
    },
    preferences: {
        defaultItemsPerPage: 10,
        language: 'en-US',
        timezone: 'America/New_York',
    },
};

const fetchGlobalAdminSettingsAPI = (adminUserId: string): Promise<GlobalAdminSettings> => {
    console.log(`API: Fetching global settings for admin ${adminUserId}`);
    return new Promise((resolve) => {
        setTimeout(() => {
            // In a real app, you'd fetch based on the logged-in admin user
            resolve({ ...MOCK_DB_GLOBAL_SETTINGS, adminUserId });
        }, 700);
    });
};

const updateGlobalAdminSettingsAPI = (
    adminUserId: string,
    formValues: GlobalSettingsFormValues
): Promise<GlobalAdminSettings> => {
    return new Promise((resolve) => {
        setTimeout(() => {
            MOCK_DB_GLOBAL_SETTINGS = {
                ...MOCK_DB_GLOBAL_SETTINGS,
                adminUserId,
                notifications: {
                    emailNewFeatures: formValues.emailNewFeatures,
                    emailWeeklySummary: formValues.emailWeeklySummary,
                },
                preferences: {
                    defaultItemsPerPage: formValues.defaultItemsPerPage,
                    language: formValues.language,
                    timezone: formValues.timezone,
                },
            };
            resolve({ ...MOCK_DB_GLOBAL_SETTINGS });
        }, 500);
    });
};

// --- Validation Schema ---
const validationSchema = yup.object().shape({
    emailNewFeatures: yup.boolean(),
    emailWeeklySummary: yup.boolean(),
    defaultItemsPerPage: yup.number()
        .min(5, 'Must be at least 5')
        .max(100, 'Cannot exceed 100')
        .required('Default items per page is required'),
    language: yup.string().required('Language is required'),
    timezone: yup.string().required('Timezone is required'),
});

// --- Timezone and Language Options ---
const languageOptions = [
    { value: 'en-US', label: 'English (United States)' },
    { value: 'en-GB', label: 'English (United Kingdom)' },
    { value: 'es-ES', label: 'Español (España)' },
    { value: 'fr-FR', label: 'Français (France)' },
    // Add more as needed
];

const timezoneOptions = [
    { value: 'UTC', label: 'Coordinated Universal Time (UTC)' },
    { value: 'America/New_York', label: 'Eastern Time (ET)' },
    { value: 'America/Chicago', label: 'Central Time (CT)' },
    { value: 'America/Denver', label: 'Mountain Time (MT)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
    { value: 'Europe/London', label: 'London (GMT/BST)' },
    { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
    // Add more as needed
];


const GlobalSettingsPage: React.FC = () => {
    const theme = useMantineTheme();
    const [settings, setSettings] = useState<GlobalAdminSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [formKey, setFormKey] = useState(Date.now()); // For re-initializing form
    const { colorScheme } = useMantineColorScheme();

    // Simulate getting the current admin user ID (in a real app, this would come from auth context)
    const MOCK_ADMIN_USER_ID = 'admin-user-001';

    const form = useForm<GlobalSettingsFormValues>({
        key: formKey,
        initialValues: {
            emailNewFeatures: false,
            emailWeeklySummary: false,
            defaultItemsPerPage: 10,
            language: 'en-US',
            timezone: 'UTC',
        },
        validate: yupResolver(validationSchema),
    });

    const fetchSettings = async () => {
        setLoading(true);
        setError(null);
        try {
            const fetchedSettings = await fetchGlobalAdminSettingsAPI(MOCK_ADMIN_USER_ID);
            setSettings(fetchedSettings);
            form.setValues({
                emailNewFeatures: fetchedSettings.notifications.emailNewFeatures,
                emailWeeklySummary: fetchedSettings.notifications.emailWeeklySummary,
                defaultItemsPerPage: fetchedSettings.preferences.defaultItemsPerPage,
                language: fetchedSettings.preferences.language,
                timezone: fetchedSettings.preferences.timezone,
            });
            form.resetDirty();
        } catch (e: any) {
            setError(e.message || "Failed to load global settings.");
            notifications.show({ title: 'Loading Error', message: e.message, color: 'red' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, [formKey]);

    const handleSubmit = async (values: GlobalSettingsFormValues) => {
        setIsSubmitting(true);
        try {
            const updatedSettings = await updateGlobalAdminSettingsAPI(MOCK_ADMIN_USER_ID, values);
            setSettings(updatedSettings); // Update local state with response
            form.resetDirty();
            notifications.show({
                title: 'Settings Saved',
                message: 'Your global settings have been updated successfully!',
                color: 'green',
                icon: <IconDeviceFloppy />,
            });
        } catch (e: any) {
            notifications.show({
                title: 'Update Failed',
                message: e.message || "An error occurred while saving settings.",
                color: 'red',
                icon: <IconAlertCircle />,
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading && !settings) {
        return <Center style={{ height: 'calc(100vh - 200px)' }}><Loader size="xl" /></Center>;
    }

    if (error && !settings) {
        return <Alert icon={<IconAlertCircle />} title="Error" color="red" m="xl">{error} <Button onClick={fetchSettings} mt="sm">Try Again</Button></Alert>;
    }

    if (!settings) { // Should be caught by above, but as a safeguard
        return <Center><Text>No settings data available.</Text></Center>;
    }

    return (
        <Box p="md">
            <Group justify="space-between" mb="xl">
                <Title order={2}>
                    <Group gap="xs">
                        <IconSettings size={30} /> Global Admin Settings
                    </Group>
                </Title>
                <Tooltip label="Refresh Settings Data">
                    <ActionIcon variant="light" onClick={() => setFormKey(Date.now())} size="lg" loading={loading}>
                        <IconRefresh size={20} />
                    </ActionIcon>
                </Tooltip>
            </Group>

            {error && settings && (
                <Alert icon={<IconAlertCircle />} title="Error Notice" color="red" radius="md" mb="md" withCloseButton onClose={() => setError(null)}>{error}</Alert>
            )}

            <form onSubmit={form.onSubmit(handleSubmit)}>
                <Tabs defaultValue="notifications" variant="pills" radius="md">
                    <Tabs.List>
                        <Tabs.Tab value="notifications" leftSection={<IconBell size={16} />}>Notifications</Tabs.Tab>
                        <Tabs.Tab value="preferences" leftSection={<IconPalette size={16} />}>Preferences</Tabs.Tab>
                    </Tabs.List>

                    <Tabs.Panel value="notifications" pt="lg">
                        <Paper shadow="sm" p="lg" withBorder radius="md">
                            <Title order={4} mb="lg">Email Notifications</Title>
                            <Stack gap="md">
                                <Switch
                                    label="New Feature Announcements"
                                    description="Stay updated with the latest features and improvements to Konecta."
                                    {...form.getInputProps('emailNewFeatures', { type: 'checkbox' })}
                                />
                                <Switch
                                    label="Weekly Activity Summary"
                                    description="Get a summary of key metrics and activities across your projects."
                                    {...form.getInputProps('emailWeeklySummary', { type: 'checkbox' })}
                                />
                            </Stack>
                        </Paper>
                    </Tabs.Panel>

                    <Tabs.Panel value="preferences" pt="lg">
                        <Paper shadow="sm" p="lg" withBorder radius="md">
                            <Title order={4} mb="lg">Interface & Data Preferences</Title>
                            <Stack gap="lg">
                                <NumberInput
                                    label="Default Items Per Page"
                                    description="Set the default number of items shown in tables (e.g., Missions, Users)."
                                    placeholder="e.g., 10, 25, 50"
                                    min={5}
                                    max={100}
                                    step={5}
                                    leftSection={<IconListNumbers size={16} />}
                                    {...form.getInputProps('defaultItemsPerPage')}
                                />
                                <Select
                                    label="Language"
                                    description="Choose your preferred language for the admin panel."
                                    data={languageOptions}
                                    leftSection={<IconLanguage size={16} />}
                                    {...form.getInputProps('language')}
                                    searchable
                                />
                                <Select
                                    label="Timezone"
                                    description="Select your timezone to display dates and times accurately."
                                    data={timezoneOptions}
                                    leftSection={<IconClock size={16} />}
                                    {...form.getInputProps('timezone')}
                                    searchable
                                />
                            </Stack>
                        </Paper>
                    </Tabs.Panel>

                </Tabs>

                <Group justify="flex-end" mt="xl" pt="md" style={{ borderTop: `1px solid ${colorScheme === 'dark' ? theme.colors.dark[4] : theme.colors.gray[3]}` }}>
                    <Button
                        type="submit"
                        leftSection={<IconDeviceFloppy size={18} />}
                        loading={isSubmitting}
                        disabled={loading || !form.isDirty()}
                        size="md"
                    >
                        Save Global Settings
                    </Button>
                </Group>
            </form>
        </Box>
    );
};

export default GlobalSettingsPage;

