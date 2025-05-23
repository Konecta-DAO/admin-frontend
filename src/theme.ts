import { createTheme, MantineColorScheme, MantineColorsTuple, MantineTheme, rgba } from '@mantine/core';

// Define Konecta color palette
export const konectaColors = {
    white: '#FFFFFF',
    grey100: '#F0F0F5', // Lighter grey for backgrounds in light mode
    grey200: '#BCBCC2',
    grey400: '#A6A5AE',
    grey600: '#797985',
    grey800: '#4A495A', // Darker grey for elements in light mode
    grey900: '#363548',
    grey950: '#29283C',
    grey000: '#201F34', // Deepest grey, good for background
    azureBlue: '#337FF5', // Accent
};

// Helper function to generate Mantine color tuples
export const generateColorTuple = (color: string): MantineColorsTuple => Array(10).fill(color) as unknown as MantineColorsTuple;

// Mantine theme object
const themeObject = {
    fontFamily: 'Inter, sans-serif',
    primaryColor: 'konectaAzureBlue',
    colors: {
        konectaAzureBlue: generateColorTuple(konectaColors.azureBlue),
        konectaGrey: [
            konectaColors.white,    // 0
            konectaColors.grey200,  // 1
            konectaColors.grey400,  // 2
            konectaColors.grey600,  // 3
            konectaColors.grey800,  // 4
            konectaColors.grey900,  // 5
            konectaColors.grey950,  // 6
            konectaColors.grey000,  // 7
            '#1a192b',              // 8 (darker shade for dark mode components)
            '#0e0d19'               // 9 (even darker)
        ] as MantineColorsTuple,
    },
    components: {
        Button: {
            defaultProps: {
                radius: 'md',
            },
        },
        Paper: {
            defaultProps: {
                radius: 'lg',
                shadow: 'sm',
            },
        },
        NavLink: {
            // Styles for the NavLink component, used in AdminLayout sidebar
            // The `styles` function receives the theme, component params, and a context object which includes the current colorScheme.
            styles: (
                theme: MantineTheme,
                _props: any, // Replace 'any' with 'NavLinkProps' if you import and use props
                // Make context optional and type its colorScheme as 'light' | 'dark'
                context?: { colorScheme: 'light' | 'dark'; variant?: string }
            ) => {
                let resolvedCS: 'light' | 'dark';

                // Prioritize colorScheme from context if context is available
                if (context && context.colorScheme) {
                    resolvedCS = context.colorScheme;
                } else if ((theme as any).colorScheme && ((theme as any).colorScheme === 'light' || (theme as any).colorScheme === 'dark')) {
                    // Fallback to theme.colorScheme if context is not available or doesn't have colorScheme
                    // (theme as any) is used to bypass potential TypeScript errors if MantineTheme type is incomplete.
                    // Ideally, your MantineTheme type should include the resolved colorScheme.
                    resolvedCS = (theme as any).colorScheme;
                } else {
                    // Absolute fallback if no color scheme can be determined (should not happen in a normal setup)
                    resolvedCS = 'light';
                    console.warn('Konecta Theme: Could not determine color scheme for NavLink styles, defaulting to light.');
                }

                return ({
                    root: {
                        borderRadius: theme.radius.md,
                        // Style for the active NavLink
                        '&[dataActive="true"]': {
                            backgroundColor: resolvedCS === 'dark'
                                ? rgba(theme.colors.konectaAzureBlue[7], 0.3)
                                : theme.colors.konectaAzureBlue[0],
                            color: resolvedCS === 'dark'
                                ? theme.white
                                : theme.colors.konectaAzureBlue[6],
                            fontWeight: 500,
                        },
                        // Style for the label within an active NavLink
                        '&[dataActive="true"] .mantineNavLinkLabel': {
                            color: resolvedCS === 'dark'
                                ? theme.white
                                : theme.colors.konectaAzureBlue[7],
                        },
                        // Style for the icon within an active NavLink
                        '&[dataActive="true"] .mantineNavLinkIcon': {
                            color: resolvedCS === 'dark'
                                ? theme.white
                                : theme.colors.konectaAzureBlue[6],
                        }
                    },
                });
            },
        },
    },
};


// Create and export the theme
export const mantineTheme = createTheme(themeObject);
