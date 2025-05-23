import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
    AppShell,
    Burger,
    Group,
    NavLink,
    Button,
    ActionIcon,
    useMantineTheme,
    ScrollArea,
    Image,
    rem,
    Box,
    rgba,
    ThemeIcon, // Added for fallback icon text
} from '@mantine/core';
import {
    IconGauge,
    IconTargetArrow,
    IconUsers,
    IconSettings,
    IconLogout,
    IconMoonStars,
    IconSun,
    IconAdjustments,
    IconBuildingStore, // Generic icon for projects if specific one is missing
} from '@tabler/icons-react';
import type { SerializedPermissions } from '../../declarations/projectCanister/test_backend.did.js';

// Props for AdminLayout
interface AdminLayoutProps {
    currentProjectId: string | null;
    onLogout: () => void;
    colorScheme: 'light' | 'dark';
    toggleColorScheme: (value?: 'light' | 'dark') => void; // Allow specific value toggle
    children: React.ReactNode;
    userProjectAccess: Map<string, SerializedPermissions | null>; // Permissions for all relevant projects
    accessibleProjectsMetadata: Array<{ // Metadata for projects user can access in navbar
        id: string;
        name: string;
        iconUrl?: string | null; // Optional: URL for the project's icon
    }>;
}

// Define your project subsections structure (as you had it)
const PROJECT_SUBSECTIONS = [
    { icon: IconGauge, label: 'Dashboard', pathSuffix: 'dashboard', requiredPermissions: [] as (keyof SerializedPermissions)[] },
    {
        icon: IconTargetArrow, label: 'Missions', pathSuffix: 'missions',
        requiredPermissions: ['createMission', 'editMissionInfo', 'editMissionFlow', 'updateMissionStatus', 'viewAdmins'] as (keyof SerializedPermissions)[] // Added viewAdmins as an example if it implies some mission visibility
    },
    {
        icon: IconUsers, label: 'Users', pathSuffix: 'users',
        requiredPermissions: ['viewAnyUserProgress', 'resetUserProgress', 'adjustUserProgress'] as (keyof SerializedPermissions)[]
    },
    {
        icon: IconSettings, label: 'Project Settings', pathSuffix: 'settings',
        requiredPermissions: ['editProjectInfo', 'viewAdmins', 'addAdmin', 'editAdmin', 'removeAdmin'] as (keyof SerializedPermissions)[]
    },
];

const AdminLayout: React.FC<AdminLayoutProps> = ({
    currentProjectId,
    onLogout,
    colorScheme,
    toggleColorScheme,
    children,
    userProjectAccess,
    accessibleProjectsMetadata,
}) => {
    const [opened, setOpened] = useState(false);
    const theme = useMantineTheme();
    const location = useLocation();
    const logoSrc = '/KONECTA_LOGOQ.svg';

    // Get permissions for the *currently selected* project
    const currentProjectPermissions: SerializedPermissions | null | undefined = currentProjectId
        ? userProjectAccess.get(currentProjectId)
        : null;

    // Filter PROJECT_SUBSECTIONS based on currentProjectPermissions for the active project
    const visibleProjectSubsections = PROJECT_SUBSECTIONS.filter(section => {
        if (!currentProjectId) { // If no project is selected (e.g., global settings view potentially)
            return false; // Or handle globally accessible sections differently if any
        }
        if (!currentProjectPermissions) {
            return false; // No permissions loaded for the current project, hide all subsections
        }
        if (section.requiredPermissions.length === 0) {
            return true; // Section requires no specific permissions (e.g., Dashboard)
        }
        // Check if user has at least one of the required permissions for this section
        return section.requiredPermissions.some(permissionKey => currentProjectPermissions[permissionKey] === true);
    });

    return (
        <AppShell
            header={{ height: 60 }}
            navbar={{ width: 280, breakpoint: 'sm', collapsed: { mobile: !opened } }}
            padding="md"
            styles={{
                main: {
                    backgroundColor: colorScheme === 'dark' ? theme.colors.dark[8] : theme.colors.gray[0],
                },
            }}
        >
            <AppShell.Header>
                <Group h="100%" px="md" justify="space-between">
                    <Group>
                        <Burger opened={opened} onClick={() => setOpened((o) => !o)} hiddenFrom="sm" size="sm" />
                        <Link to={currentProjectId ? `/${currentProjectId}/dashboard` : "/"} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
                            <Image
                                src={logoSrc}
                                alt="Konecta Logo"
                                h={25} // Adjust height as needed
                                w="auto"
                            // Removed filter, assuming distinct logo files or CSS can handle it
                            />
                        </Link>
                    </Group>
                    <Group>
                        <ActionIcon variant="default" onClick={() => toggleColorScheme()} title="Toggle color scheme" size="lg">
                            {colorScheme === 'dark' ? <IconSun style={{ width: rem(20), height: rem(20) }} /> : <IconMoonStars style={{ width: rem(20), height: rem(20) }} />}
                        </ActionIcon>
                        <Button variant="outline" color="red" leftSection={<IconLogout size={16} />} onClick={onLogout}>
                            Logout
                        </Button>
                    </Group>
                </Group>
            </AppShell.Header>

            <AppShell.Navbar p="md">
                {/* Adjusted height calculation for ScrollArea */}
                <ScrollArea h={`calc(100vh - var(--app-shell-header-height, ${rem(60)}) - var(--app-shell-padding, ${theme.spacing.md}) * 2)`}>
                    {accessibleProjectsMetadata.map((project) => {
                        const projectDashboardPath = `/${project.id}/dashboard`;
                        const isActiveProject = project.id === currentProjectId;

                        const ProjectIconDisplay = project.iconUrl
                            ? <Image src={project.iconUrl} w={20} h={20} radius="sm" alt={`${project.name} icon`} />
                            : <ThemeIcon variant="light" size="sm"><IconBuildingStore size="1.1rem" /></ThemeIcon>;

                        return (
                            <NavLink
                                key={project.id}
                                label={project.name}
                                leftSection={ProjectIconDisplay}
                                component={Link} // Make the main NavLink a Link to its dashboard
                                to={projectDashboardPath}
                                active={isActiveProject}
                                defaultOpened={isActiveProject} // Keep expanded if active
                                childrenOffset={rem(28)} // Indentation for children
                                onClick={() => { if (opened) setOpened(false); }} // Close mobile nav on item click
                                styles={(t) => ({
                                    root: {
                                        marginBottom: t.spacing.xs,
                                        borderRadius: t.radius.sm,
                                        ...(isActiveProject && {
                                            backgroundColor: colorScheme === 'dark'
                                                ? rgba(t.colors[t.primaryColor][8], 0.25)
                                                : rgba(t.colors[t.primaryColor][0], 0.5), // Use Mantine's rgba
                                            '&:hover': {
                                                backgroundColor: colorScheme === 'dark'
                                                    ? rgba(t.colors[t.primaryColor][7], 0.3)
                                                    : rgba(t.colors[t.primaryColor][1], 0.6),
                                            }
                                        }),
                                    },
                                    label: {
                                        fontWeight: isActiveProject ? 600 : 500,
                                        fontSize: t.fontSizes.sm,
                                    },
                                    body: { // Ensure label and icon are vertically centered
                                        display: 'flex',
                                        alignItems: 'center',
                                    }
                                })}
                            >
                                {/* Render subsections only if this project is active */}
                                {isActiveProject && visibleProjectSubsections.map((sub) => (
                                    <NavLink
                                        key={sub.label}
                                        label={sub.label}
                                        leftSection={<sub.icon size="1rem" stroke={1.5} />}
                                        component={Link}
                                        to={`/${project.id}/${sub.pathSuffix}`}
                                        active={ // More precise active check for subsections
                                            isActiveProject &&
                                            location.pathname === `/${project.id}/${sub.pathSuffix}`
                                        }
                                        onClick={() => { if (opened) setOpened(false); }} // Close mobile nav
                                        styles={(t) => ({ // Sub-item specific styles
                                            root: {
                                                paddingLeft: rem(30), // Indent further
                                                paddingTop: rem(8),
                                                paddingBottom: rem(8),
                                                borderRadius: t.radius.sm,
                                            },
                                            label: { fontSize: t.fontSizes.xs }
                                        })}
                                    />
                                ))}
                            </NavLink>
                        );
                    })}

                    {/* Separator and Global Settings Link */}
                    <Box
                        style={{
                            borderTop: `1px solid ${colorScheme === 'dark' ? theme.colors.dark[4] : theme.colors.gray[3]}`,
                            marginTop: theme.spacing.md,
                            paddingTop: theme.spacing.md
                        }}
                    >
                        <NavLink
                            label="Global Settings"
                            leftSection={<IconAdjustments size="1.1rem" stroke={1.5} />}
                            component={Link}
                            to="/global-settings"
                            active={location.pathname.startsWith('/global-settings')}
                            onClick={() => { if (opened) setOpened(false); }}
                            styles={(t) => ({
                                root: { borderRadius: t.radius.sm },
                                label: { fontSize: t.fontSizes.sm }
                            })}
                        />
                    </Box>
                </ScrollArea>
            </AppShell.Navbar>

            <AppShell.Main>
                {children}
            </AppShell.Main>
        </AppShell>
    );
};

export default AdminLayout;