import React from 'react';
import { Box, getRadius, getSize, getThemeColor, MantineGradient, MantineRadius, MantineTheme, rem, rgba, useMantineColorScheme, useMantineTheme } from '@mantine/core';

// Props interface for the ThemeIcon component
export interface ThemeIconProps extends Omit<React.ComponentPropsWithoutRef<'div'>, 'color'> {
    color: string; // Allow any string for color initially
    variant?: 'filled' | 'light' | 'outline' | 'default' | 'gradient' | 'white';
    size?: MantineTheme['fontSizes'] | number | string;
    radius?: MantineTheme['radius'] | number | string;
    gradient?: MantineGradient;
    children: React.ReactNode;
}

// Custom ThemeIcon component, useful for displaying icons with themed backgrounds
const ThemeIcon: React.FC<ThemeIconProps> = ({
    color: colorProp,
    variant = 'light',
    size = 'md',
    radius = 'sm',
    gradient,
    children,
    style,
    ...others
}) => {
    const theme = useMantineTheme();
    const { colorScheme } = useMantineColorScheme();

    const _getThemeColor = (colorName: string, shade?: number): string => {
        if (colorName in theme.colors && shade !== undefined) {
            // Ensure the color exists in the theme and shade is provided
            // Mantine's getThemeColor handles resolving theme color names to actual CSS values.
            return getThemeColor(colorName, theme); // getThemeColor will use primaryShade if shade is not in colorName itself
        }
        // If colorName is not a theme color key (e.g., a direct CSS value like '#FF0000')
        // or shade is not applicable, return the colorName as is.
        // For specific shades when colorName IS a theme color:
        if (typeof theme.colors[colorName]?.[shade as number] === 'string') {
            return theme.colors[colorName][shade as number];
        }
        return getThemeColor(colorName, theme); // Fallback to resolve colorName (e.g. primary shade)
    };

    // Calculate icon size using Mantine's theme functions
    const iconSizeValue = getSize({ size, sizes: theme.spacing });

    const getBorderRadiusValue = (r: MantineTheme['radius'] | number | string): string | number => {
        if (typeof r === 'string' && r in theme.radius) {
            return getRadius(r as MantineRadius) ?? r; // Use getRadius for theme keys, falling back to original value if undefined
        }
        if (typeof r === 'number') {
            return rem(r); // Convert numbers to rem
        }
        return `${r}`; // Return direct string values as a string
    };
    const borderRadiusValue = getBorderRadiusValue(radius);

    // Base styles for the wrapper Box
    const wrapperStyle: React.CSSProperties = {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
        width: iconSizeValue,
        height: iconSizeValue,
        minWidth: iconSizeValue,
        minHeight: iconSizeValue,
        borderRadius: borderRadiusValue,
        ...style,
    };

    // Handle gradient variant
    if (variant === 'gradient') {
        const gradientProps = gradient || theme.defaultGradient; // Use default gradient if none provided
        return (
            <Box
                {...others}
                style={{
                    ...wrapperStyle,
                    // Use _getThemeColor to resolve potential theme color names in gradient
                    background: `linear-gradient(${gradientProps.deg || 0}deg, ${_getThemeColor(gradientProps.from)} 0%, ${_getThemeColor(gradientProps.to)} 100%)`,
                    color: theme.white, // Text color for gradient is typically white
                }}
            >
                {children}
            </Box>
        );
    }

    // Determine background, border, and text colors based on variant and theme
    let backgroundColorValue: string;
    let borderColorValue: string = 'transparent';
    let textColorValue: string;

    // Define shades for different variants and color schemes
    const lightShade = colorScheme === 'dark' ? 8 : 0; // Adjusted for better contrast in light mode
    const resolvedColorScheme = colorScheme;
    const lightTextShade = colorScheme === 'dark' ? 0 : 7;
    const filledShade = typeof theme.primaryShade === 'object'
        ? theme.primaryShade[resolvedColorScheme === 'auto' ? 'light' : resolvedColorScheme]
        : theme.primaryShade;
    const outlineShade = colorScheme === 'dark' ? 5 : 7;


    if (variant === 'filled') {
        backgroundColorValue = _getThemeColor(colorProp, filledShade);
        textColorValue = theme.white; // Or use autoContrast logic if needed
    } else if (variant === 'light') {
        // For light variant, background is a very light shade of the color, text is a darker shade
        backgroundColorValue = rgba(_getThemeColor(colorProp, lightShade), colorScheme === 'dark' ? 0.25 : 0.15); // Use rgba for light background
        textColorValue = _getThemeColor(colorProp, lightTextShade);
    } else if (variant === 'outline') {
        borderColorValue = _getThemeColor(colorProp, outlineShade);
        textColorValue = _getThemeColor(colorProp, outlineShade);
        backgroundColorValue = 'transparent';
    } else if (variant === 'white') {
        backgroundColorValue = theme.white;
        textColorValue = _getThemeColor(colorProp, filledShade);
    } else { // default variant (similar to outline but with standard gray border)
        borderColorValue = colorScheme === 'dark' ? _getThemeColor('dark', 4) : _getThemeColor('gray', 3);
        backgroundColorValue = colorScheme === 'dark' ? _getThemeColor('dark', 6) : theme.white;
        textColorValue = colorScheme === 'dark' ? _getThemeColor('dark', 0) : _getThemeColor('gray', 7);
    }

    return (
        <Box
            {...others}
            style={{
                ...wrapperStyle,
                backgroundColor: backgroundColorValue,
                border: `${rem(1)} solid ${borderColorValue}`,
                color: textColorValue,
            }}
        >
            {children}
        </Box>
    );
};

export default ThemeIcon;
