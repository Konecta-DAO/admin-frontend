import React, { useEffect, useState } from 'react';
import {
    Modal, Stack, TextInput, Textarea, Select, NumberInput, Group, Button, Divider,
    FileInput, Image, MultiSelect, SegmentedControl,ScrollArea,  Title
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates'; 
import { useForm } from '@mantine/form';
import {IconUpload, IconCalendar, IconClock, IconMapPin, IconWorld, IconTag, IconCurrencyDollar } from '@tabler/icons-react';
import type { KonectaEvent, EventFormValues, EventFileUploads, EventStatus, EventToken } from '../types.ts';

// Define props for the modal
interface EventFormModalProps {
    opened: boolean;
    onClose: () => void;
    onSubmit: (values: EventFormValues, filesToUpload: EventFileUploads) => Promise<void>;
    initialData?: KonectaEvent | null;
    projectId: string;
}

const EventFormModal: React.FC<EventFormModalProps> = ({
    opened,
    onClose,
    onSubmit,
    initialData,
    projectId,
}) => {
    const [coverPreview, setCoverPreview] = useState<string | null>(initialData?.coverPhotoUrl || null);

    const form = useForm<EventFormValues>({
        initialValues: {
            name: '', description: '', coverPhotoUrl: '', location: '', language: 'en',
            startDate: null, endDate: null, status: 'draft', categories: [], interests: [],
            priceToken: 'FREE', tokenAmount: 0, projectId: projectId, coverPhotoFile: null,
        },
        validate: {
            name: (value: string): string | null =>
                value.trim().length > 0 ? null : 'Event name is required',

            location: (value: string): string | null =>
                value.trim().length > 0 ? null : 'Location is required',

            // `value` is a Date or null:
            startDate: (value: Date | null): string | null =>
                value ? null : 'Start date/time is required',

            // two parameters: `value` and the entire form values
            endDate: (
                value: Date | null,
                values: EventFormValues
            ): string | null => {
                if (!value) return 'End date/time is required';
                if (values.startDate && value <= values.startDate) {
                    return 'End date/time must be after start date/time';
                }
                return null;
            },

            // `value` can be undefined if you reset it, so include that:
            tokenAmount: (
                value: number | undefined,
                values: EventFormValues
            ): string | null =>
                values.priceToken !== 'FREE' && (!value || value <= 0)
                    ? 'Token amount required for paid events'
                    : null,
        },
    });

    // Effect to populate form when editing
    useEffect(() => {
        if (initialData) {
            form.setValues({
                ...form.initialValues, // Start with defaults
                ...initialData,        // Override with existing data
                projectId: initialData.projectId,
                // Convert timestamps back to Date objects for the form
                startDate: initialData.startDate ? new Date(initialData.startDate) : null,
                endDate: initialData.endDate ? new Date(initialData.endDate) : null,
                // Ensure optional numbers are handled
                tokenAmount: initialData.tokenAmount ?? undefined,
                // Reset file input, set preview
                coverPhotoFile: null,
                coverPhotoUrl: initialData.coverPhotoUrl || '',
            });
            setCoverPreview(initialData.coverPhotoUrl || null);
        } else {
            form.reset();
            form.setFieldValue('projectId', projectId);
            setCoverPreview(null);
        }
    }, [initialData, projectId, opened]); // Rerun when modal opens or data changes

    // Handle file change and update preview
    const handleFileChange = (file: File | null) => {
        form.setFieldValue('coverPhotoFile', file);
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => setCoverPreview(reader.result as string);
            reader.readAsDataURL(file);
        } else {
            setCoverPreview(initialData?.coverPhotoUrl || null); // Revert to original if file cleared
        }
    };

    const handleFormSubmit = (values: EventFormValues) => {
        const { coverPhotoFile, ...otherValues } = values;
        const filesToUpload: EventFileUploads = { coverPhotoFile };
        onSubmit(otherValues, filesToUpload); // Pass form values and files separately
    };

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title={initialData ? 'Edit Event' : 'Create New Event'}
            size="xl"
            overlayProps={{ backgroundOpacity: 0.55, blur: 3 }}
            centered
            scrollAreaComponent={ScrollArea.Autosize}
            styles={{ body: { paddingTop: 'var(--mantine-spacing-lg)', paddingBottom: 'var(--mantine-spacing-lg)' } }}
        >
            <form onSubmit={form.onSubmit(handleFormSubmit)}>
                <Stack gap="xl">
                    {/* --- Basic Info --- */}
                    <Title order={4}><Group gap="xs">Basic Information</Group></Title>
                    <TextInput required label="Event Name" placeholder="e.g., Konecta Community Call #5" {...form.getInputProps('name')} />
                    <Textarea label="Description (Markdown supported)" placeholder="Details about the event..." autosize minRows={4} {...form.getInputProps('description')} />
                    <FileInput
                        label="Cover Photo (Optional)"
                        placeholder="Click to upload banner image"
                        leftSection={<IconUpload size={16} />}
                        accept="image/*"
                        {...form.getInputProps('coverPhotoFile')}
                        onChange={handleFileChange}
                        clearable
                    />
                    {(coverPreview || form.values.coverPhotoUrl) && (
                        <Image src={coverPreview || form.values.coverPhotoUrl} radius="sm" h={100} w="auto" fit="contain" />
                    )}

                    <Divider label="Logistics & Timing" labelPosition="center" my="lg" />
                    <TextInput required label="Location / Platform" placeholder="e.g., Twitter Space, Zoom Link, Discord Stage, Physical Address" leftSection={<IconMapPin size={16} />} {...form.getInputProps('location')} />
                    <Select label="Language" data={['en', 'es', 'fr', 'de', 'pt']} defaultValue="en" allowDeselect={false} leftSection={<IconWorld size={16} />} {...form.getInputProps('language')} />
                    <Group grow>
                        <DateTimePicker required label="Start Date & Time" placeholder="Pick date and time" valueFormat="DD MMM YYYY hh:mm A" leftSection={<IconCalendar size={16} />} {...form.getInputProps('startDate')} />
                        <DateTimePicker required label="End Date & Time" placeholder="Pick date and time" valueFormat="DD MMM YYYY hh:mm A" leftSection={<IconClock size={16} />} {...form.getInputProps('endDate')} />
                    </Group>

                    <Divider label="Categorization & Pricing" labelPosition="center" my="lg" />
                    <Group grow>
                        {/* Using creatable MultiSelect for flexibility */}
                        <MultiSelect label="Categories" placeholder="Add relevant categories" data={['AMA', 'Workshop', 'Launch', 'Community Call', 'Networking']} searchable creatable hidePickedOptions {...form.getInputProps('categories')} leftSection={<IconTag size={16} />} />
                        <MultiSelect label="Interests" placeholder="Add relevant interests" data={['DeFi', 'NFTs', 'Gaming', 'Development', 'ICP', 'SNS']} searchable creatable hidePickedOptions {...form.getInputProps('interests')} leftSection={<IconTag size={16} />} />
                    </Group>
                    <SegmentedControl
                        data={[{ label: 'Free', value: 'FREE' }, { label: 'ICP', value: 'ICP' }, { label: 'ckBTC', value: 'CKBTC' }]}
                        {...form.getInputProps('priceToken')}
                        fullWidth
                    />
                    {form.values.priceToken !== 'FREE' && (
                        <NumberInput required label="Token Amount" placeholder="e.g., 1.5" min={0} precision={8} {...form.getInputProps('tokenAmount')} leftSection={<IconCurrencyDollar size={16} />} />
                    )}


                    <Divider label="Administration" labelPosition="center" my="lg" />
                    <Select
                        label="Event Status"
                        data={['draft', 'published', 'active', 'completed', 'canceled']}
                        required
                        {...form.getInputProps('status')}
                    />

                    <Group justify="flex-end" mt="xl">
                        <Button variant="default" onClick={onClose}>Cancel</Button>
                        <Button type="submit">{initialData ? 'Save Changes' : 'Create Event'}</Button>
                    </Group>
                </Stack>
            </form>
        </Modal>
    );
};

export default EventFormModal;

