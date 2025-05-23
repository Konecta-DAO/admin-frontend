import React, { useState, useEffect } from 'react';
import {
    Modal,
    Text,
    Button,
    Stack,
    Loader,
    Box,
    useMantineTheme,
    useMantineColorScheme,
    TextInput,
    Textarea,
    Tabs,
    Group,
    lighten,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconSend, IconCalendarEvent, IconCheck } from '@tabler/icons-react';
import { konectaColors } from '../../../theme.ts';
import { notifications } from '@mantine/notifications';

interface LoginModalProps {
    opened: boolean;
    onClose: () => void;
    onCalendlyScheduled?: () => void;
    onFormSubmitSuccess?: (values: any) => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ opened, onClose, onCalendlyScheduled, onFormSubmitSuccess }) => {
    const theme = useMantineTheme();
    const { colorScheme } = useMantineColorScheme();
    const [isRegistering, setIsRegistering] = useState(false);
    const [calendlyLoading, setCalendlyLoading] = useState(true);

    const registrationForm = useForm({
        initialValues: {
            projectName: '',
            email: '',
            discord: '',
            twitter: '',
            projectDescription: '',
        },
        validate: {
            projectName: (value: { trim: () => { (): any; new(): any; length: number; }; }) => (value.trim().length > 0 ? null : 'Project name is required'),
            email: (value: string) => (/^\S+@\S+([\.-]?\w+)*(\.\w{2,3})+$/.test(value) ? null : 'Invalid email address'),
            projectDescription: (value: { trim: () => { (): any; new(): any; length: number; }; }) => (value.trim().length > 0 ? null : 'Project description is required'),
        },
    });

    const handleRegistrationSubmit = async (values: typeof registrationForm.values) => {
        setIsRegistering(true);
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1500));
        setIsRegistering(false);
        notifications.show({
            title: 'Registration Submitted!',
            message: 'Your project details have been received. We will review it shortly.',
            color: 'green',
            icon: <IconCheck size="1.2rem" />,
            autoClose: 5000,
        });
        if (onFormSubmitSuccess) {
            onFormSubmitSuccess(values);
        }
        registrationForm.reset();
        onClose();
    };

    const calendlyBgColor = colorScheme === 'dark' ? '0A090D' : 'FFFFFF';
    const calendlyTextColor = colorScheme === 'dark' ? 'FFFFFF' : '0A090D';

    useEffect(() => {
        const handleCalendlyEvent = (event: MessageEvent) => {
            if (
                event.origin === 'https://calendly.com' &&
                event.data &&
                event.data.event === 'calendly.event_scheduled'
            ) {
                if (onCalendlyScheduled) {
                    onCalendlyScheduled();
                } else {
                    notifications.show({
                        title: 'Call Scheduled Successfully!',
                        message: 'Your appointment has been confirmed. We look forward to speaking with you.',
                        color: 'teal',
                        icon: <IconCheck size="1.2rem" />,
                        autoClose: 7000,
                        withCloseButton: true,
                    });
                }
                onClose();
            }
        };

        if (opened) {
            window.addEventListener('message', handleCalendlyEvent);
            setCalendlyLoading(true);
        }

        return () => {
            window.removeEventListener('message', handleCalendlyEvent);
        };
    }, [opened, onClose, onCalendlyScheduled]);

    useEffect(() => {
        if (!opened) {
            registrationForm.reset();
            setIsRegistering(false);
        }
    }, [opened]);


    return (
        <Modal
            opened={opened}
            onClose={() => {
                onClose();
                registrationForm.reset();
            }}
            title={<Text fw={600} size="lg">Onboard Your Project with Konecta</Text>}
            size="lg"
            centered
            overlayProps={{
                backgroundOpacity: colorScheme === 'dark' ? 0.65 : 0.55,
                blur: 5,
            }}
            transitionProps={{ transition: 'pop', duration: 200 }}
            radius="md"
            shadow="xl"
            styles={{
                body: { paddingTop: theme.spacing.sm }
            }}
        >
            <Text c="dimmed" ta="center" mb="lg" mt="xs">
                Choose your preferred way to tell us about your exciting project. We're eager to learn more!
            </Text>
            <Tabs defaultValue="form" color={konectaColors.azureBlue} keepMounted={false} onChange={() => setCalendlyLoading(true)}>
                <Tabs.List grow>
                    <Tabs.Tab value="form" leftSection={<IconSend size={16} />}>
                        Register Manually
                    </Tabs.Tab>
                    <Tabs.Tab value="calendly" leftSection={<IconCalendarEvent size={16} />}>
                        Schedule Discovery Call
                    </Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="form" pt="lg">
                    <form onSubmit={registrationForm.onSubmit(handleRegistrationSubmit)}>
                        <Stack gap="md">
                            <TextInput
                                required
                                label="Project Name"
                                placeholder="e.g., My Awesome dApp"
                                {...registrationForm.getInputProps('projectName')}
                                data-autofocus
                                autoComplete="organization"
                            />
                            <TextInput
                                required
                                label="Contact Email"
                                placeholder="you@example.com"
                                type="email"
                                {...registrationForm.getInputProps('email')}
                                autoComplete="email"
                            />
                            <TextInput
                                label="Discord Username"
                                placeholder="yourtag#1234 (Optional)"
                                {...registrationForm.getInputProps('discord')}
                                autoComplete="off"
                            />
                            <TextInput
                                label="X (Twitter) Handle"
                                placeholder="@yourproject (Optional)"
                                {...registrationForm.getInputProps('twitter')}
                                autoComplete="off"
                            />
                            <Textarea
                                required
                                label="Project Description"
                                placeholder="Briefly describe your project, its goals, and what you hope to achieve with Konecta."
                                minRows={4}
                                autosize
                                {...registrationForm.getInputProps('projectDescription')}
                            />
                            <Button
                                type="submit"
                                mt="md"
                                fullWidth
                                loading={isRegistering}
                                variant="gradient"
                                gradient={{ from: konectaColors.azureBlue, to: lighten(konectaColors.azureBlue, 0.2), deg: 90 }}
                                leftSection={isRegistering ? null : <IconSend size={18} />}
                            >
                                {isRegistering ? 'Submitting...' : 'Submit Registration'}
                            </Button>
                        </Stack>
                    </form>
                </Tabs.Panel>

                <Tabs.Panel value="calendly" pt="lg">
                    <Text mb="md" ta="center">
                        Prefer a direct conversation? Schedule a call with our team to discuss your project and how we can help you get started.
                    </Text>
                    <Box
                        style={{
                            position: 'relative',
                            height: '700px',
                            borderRadius: theme.radius.sm,
                            overflow: 'hidden',
                            border: `1px solid ${colorScheme === 'dark' ? theme.colors.dark[4] : theme.colors.gray[3]}`,
                        }}
                    >
                        {calendlyLoading && (
                            <Group
                                justify="center"
                                align="center"
                                style={{
                                    height: '100%',
                                    position: 'absolute',
                                    top: 0, left: 0, right: 0, bottom: 0,
                                    backgroundColor: colorScheme === 'dark' ? theme.colors.dark[7] : theme.white,
                                    zIndex: 1,
                                }}
                            >
                                <Loader color={konectaColors.azureBlue} type="dots" size="lg" />
                                <Text ml="sm" c={colorScheme === 'dark' ? theme.colors.dark[0] : theme.colors.gray[7]}>Loading scheduler...</Text>
                            </Group>
                        )}
                        <iframe
                            src={`https://calendly.com/capuzr/30-min?hide_event_type_details=1&hide_gdpr_banner=1&background_color=${calendlyBgColor}&text_color=${calendlyTextColor}`}
                            width="100%"
                            height="100%"
                            frameBorder="0"
                            title="Schedule a call with Konecta"
                            onLoad={() => setCalendlyLoading(false)}
                            style={{
                                display: 'block',
                                visibility: calendlyLoading ? 'hidden' : 'visible',
                            }}
                        ></iframe>
                    </Box>
                    <Text size="xs" mt="sm" ta="center" c="dimmed">
                        Your information will be handled by Calendly.
                    </Text>
                </Tabs.Panel>
            </Tabs>
        </Modal>
    );
};

export default LoginModal;