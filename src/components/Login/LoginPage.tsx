import React, { useState } from 'react';
import {
    Paper,
    Text,
    Button,
    Stack,
    Box,
    useMantineTheme,
    useMantineColorScheme,
    Image,
    Divider,
    ActionIcon,
    rgba,
    lighten,
    darken,
} from '@mantine/core';
import { IconMoonStars, IconSun, IconRocket, IconCheck } from '@tabler/icons-react';
import { konectaColors } from '../../theme.ts';
import { notifications } from '@mantine/notifications';
import { ConnectWallet } from '@nfid/identitykit/react';
import LoginModal from './components/LoginModal.tsx';
import CustomNfidConnectButton from './components/LoginButton.tsx';

const animatedGradientLightKeyframes = `
  @keyframes animatedGradientLight {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
`;

const animatedGradientDarkKeyframes = `
  @keyframes animatedGradientDark {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
`;


const LoginPage: React.FC = () => {
    const theme = useMantineTheme();
    const { colorScheme, toggleColorScheme } = useMantineColorScheme();
    const [modalOpened, setModalOpened] = useState(false);

    const logoSrc = '/KONECTA_LOGOQ.svg';

    const currentYear = new Date().getFullYear();


    const handleRegisterProjectClick = () => {
        setModalOpened(true);
    };

    const handleCalendlyScheduledInParent = () => {
        notifications.show({
            title: 'Call Scheduled Successfully!',
            message: 'Your appointment has been confirmed. We look forward to speaking with you from parent.',
            color: 'teal',
            icon: <IconCheck size="1.2rem" />,
            autoClose: 7000,
            withCloseButton: true,
        });
    };

    const handleFormSubmittedInParent = (values: any) => {
        console.log("Form submitted in parent with values:", values);
        notifications.show({
            title: 'Project Registration Received!',
            message: `Thank you, ${values.projectName}. We've received your details.`,
            color: 'blue',
            icon: <IconCheck size="1.2rem" />,
            autoClose: 6000,
        });
    };

    return (
        <>
            <style>{animatedGradientLightKeyframes}</style>
            <style>{animatedGradientDarkKeyframes}</style>
            <Box
                style={(t) => ({
                    minHeight: '100vh',
                    background: colorScheme === 'dark'
                        ? `radial-gradient(ellipse at 70% 100%, ${darken(konectaColors.azureBlue, 0.5)} 0%, ${konectaColors.grey950} 40%, ${t.colors.dark[8]} 70%)`
                        : `linear-gradient(135deg, ${lighten(konectaColors.azureBlue, 0.85)} 0%, ${t.colors.gray[0]} 50%, ${t.colors.gray[1]} 100%)`,
                    backgroundSize: '250% 250%',
                    animation: `${colorScheme === 'dark' ? 'animatedGradientDark' : 'animatedGradientLight'} ${colorScheme === 'dark' ? 25 : 20}s ease infinite`,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: t.spacing.md,
                    position: 'relative',
                    overflow: 'hidden',
                })}
            >
                <ActionIcon
                    variant="transparent"
                    color={colorScheme === 'dark' ? theme.colors.yellow[4] : theme.colors.blue[7]}
                    onClick={() => toggleColorScheme()}
                    title="Toggle color scheme"
                    size={42}
                    radius="md"
                    style={{
                        position: 'absolute',
                        top: theme.spacing.xl,
                        right: theme.spacing.xl,
                        zIndex: 10,
                        backgroundColor: colorScheme === 'dark' ? rgba(theme.colors.dark[5], 0.5) : rgba(theme.white, 0.5),
                        backdropFilter: 'blur(5px)',
                    }}
                >
                    {colorScheme === 'dark' ? <IconSun size="1.6rem" /> : <IconMoonStars size="1.6rem" />}
                </ActionIcon>

                <Paper
                    p="xl"
                    shadow="xl"
                    radius="lg"
                    miw={360}
                    maw={500}
                    w="100%"
                    style={(t) => ({
                        backgroundColor: colorScheme === 'dark'
                            ? `rgba(12, 15, 23, 0.65)`
                            : `rgba(255, 255, 255, 0.75)`,
                        backdropFilter: 'blur(22px) saturate(160%)',
                        border: `1px solid ${colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.3)'}`,
                        position: 'relative',
                        overflow: 'hidden',
                        boxShadow: colorScheme === 'dark'
                            ? `0 16px 40px -12px rgba(0,0,0,0.7)`
                            : `0 12px 30px -10px rgba(0,0,0,0.15)`,
                        '&::before': {
                            content: '""',
                            position: 'absolute',
                            top: 0,
                            left: '-100%',
                            width: '75%',
                            height: '100%',
                            background: `linear-gradient(to right, transparent 0%, ${colorScheme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.2)'} 50%, transparent 100%)`,
                            transform: 'skewX(-25deg)',
                            pointerEvents: 'none',
                        },
                    })}
                >
                    <Stack align="center" gap="xl" style={{ zIndex: 1, position: 'relative' }}>
                        <Box
                            style={{
                                transition: 'transform 0.3s ease-out',
                                '&:hover': {
                                    transform: 'scale(1.05)',
                                },
                            }}
                        >
                            <Image
                                src={logoSrc}
                                alt="Konecta Logo"
                                h={40}
                                w="auto"
                                style={{
                                    filter: colorScheme === 'light' ? 'invert(1) brightness(1.1) drop-shadow(0 0 5px rgba(255,255,255,0.3))' : 'drop-shadow(0 2px 3px rgba(0,0,0,0.1))',
                                    marginBottom: theme.spacing.md,
                                }}
                            />
                        </Box>

                        <Text
                            size="xl"
                            fw={600}
                            c={colorScheme === 'dark' ? theme.colors.gray[3] : theme.colors.dark[2]}
                            style={{
                                textAlign: 'center',
                                textShadow: colorScheme === 'dark' ? `0 0 8px ${rgba(konectaColors.azureBlue, 0.3)}` : 'none',
                            }}
                        >
                            Admin Panel
                        </Text>

                        <Divider
                            my="sm"
                            label="Connect to Konecta"
                            labelPosition="center"
                            style={{ width: '90%' }}
                            c={colorScheme === 'dark' ? theme.colors.dark[2] : theme.colors.gray[6]}
                        />

                        <Text
                            size="sm"
                            c={colorScheme === 'dark' ? theme.colors.gray[4] : theme.colors.gray[7]}
                            style={{ textAlign: 'center', lineHeight: 1.7 }}
                            maw={400}
                        >
                            Empower your ICP project with gamified missions, dynamic events, and AI-driven growth.
                            Securely connect your NFID to access the control center.
                        </Text>

                        <ConnectWallet
                            connectButtonComponent={(props) => (
                                <CustomNfidConnectButton {...props} colorScheme={colorScheme === 'auto' ? 'light' : colorScheme} />
                            )}
                        />

                        <Button
                            fullWidth
                            size="lg"
                            mt="md"
                            variant="outline"
                            onClick={handleRegisterProjectClick}
                            leftSection={<IconRocket size={22} />}
                            styles={(t) => ({
                                root: {
                                    borderColor: colorScheme === 'dark' ? konectaColors.azureBlue : t.colors.blue[6],
                                    color: colorScheme === 'dark' ? konectaColors.azureBlue : t.colors.blue[6],
                                    transition: 'all 0.2s ease-out',
                                    '&:hover': {
                                        backgroundColor: colorScheme === 'dark' ? rgba(konectaColors.azureBlue, 0.1) : rgba(t.colors.blue[6], 0.05),
                                        transform: 'translateY(-2px)',
                                    }
                                },
                                label: {
                                    fontWeight: 600,
                                }
                            })}
                        >
                            Register Your Project
                        </Button>

                    </Stack>
                </Paper>

                <Text c={colorScheme === 'dark' ? theme.colors.dark[3] : theme.colors.gray[6]} size="xs" mt="xl" pt="md" style={{ textAlign: 'center' }}>
                    &copy; {currentYear} Konecta &bull; The one-stop Web3 learning and promotion platform.
                </Text>

                <LoginModal
                    opened={modalOpened}
                    onClose={() => setModalOpened(false)}
                    onCalendlyScheduled={handleCalendlyScheduledInParent}
                    onFormSubmitSuccess={handleFormSubmittedInParent}
                />
            </Box>
        </>
    );
};

export default LoginPage;