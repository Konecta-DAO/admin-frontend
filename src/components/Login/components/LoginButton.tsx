import { Button as MantineButton, Loader, useMantineTheme } from '@mantine/core';
import { IconWallet } from '@tabler/icons-react';
import { ConnectWalletButtonProps, useAuth, useIsInitializing } from "@nfid/identitykit/react";
import { konectaColors } from '../../../theme.ts';
import { rgba, lighten } from '@mantine/core';

interface CustomButtonInternalProps {
    colorScheme: 'light' | 'dark';
}

const CustomNfidConnectButton: React.FC<ConnectWalletButtonProps & CustomButtonInternalProps> = ({
    onClick,
    colorScheme,
    children,
    ...rest
}) => {
    const { isConnecting: isUserConnecting } = useAuth();
    const isNfidInitializing = useIsInitializing();
    const theme = useMantineTheme();

    const isLoading = isNfidInitializing || isUserConnecting;

    const { size, type, ref, ...restButtonProps } = rest;

    return (
        <MantineButton
            fullWidth
            size="xl"
            type="button"
            mt="lg"
            leftSection={isLoading ? <Loader size="md" type="dots" color={colorScheme === 'dark' ? theme.black : theme.white} /> : <IconWallet size={24} />}
            onClick={onClick}
            disabled={isLoading || restButtonProps.disabled}
            variant="gradient"
            gradient={{
                from: konectaColors.azureBlue,
                to: lighten(konectaColors.azureBlue, 0.1),
                deg: 120
            }}
            radius="lg"
            styles={(t) => ({
                root: {
                    boxShadow: `0 8px 20px -4px ${rgba(konectaColors.azureBlue, 0.6)}`,
                    transition: 'all 0.2s ease-out',
                    '&:hover': {
                        transform: 'translateY(-3px) scale(1.02)',
                        boxShadow: `0 12px 28px -4px ${rgba(konectaColors.azureBlue, 0.75)}`,
                    },
                    '&:active': {
                        transform: 'translateY(-1px) scale(1.01)',
                    },
                },
                label: {
                    fontSize: t.fontSizes.md,
                    fontWeight: 600,
                }
            })}
            {...restButtonProps}
        >
            {isLoading ? 'Authenticating...' : (children || 'Connect with NFID')}
        </MantineButton>
    );
};

export default CustomNfidConnectButton;