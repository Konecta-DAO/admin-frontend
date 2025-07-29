import React, { useState, useEffect } from 'react';
import { TextInput, NumberInput, Checkbox, TagsInput, JsonInput, Text, Alert } from '@mantine/core';
import { SerializedActionParameterDefinition, ParameterDataType } from '../../../declarations/actionsCanister/actions.did.js'; // Assuming ParameterDataType is also exported
import { IconAlertCircle } from '@tabler/icons-react';

interface LiteralValueInputProps {
    paramDef: SerializedActionParameterDefinition;
    valueJson: string; // The current JSON string representation of the literal value
    onChange: (newValueJson: string | undefined) => void; // Callback with the new JSON string, or undefined if value should be absent
}

// Helper function to extract the type string from ParameterDataType
const getDataTypeString = (dataType: ParameterDataType): string => {
    return Object.keys(dataType)[0];
};

const LiteralValueInput: React.FC<LiteralValueInputProps> = ({ paramDef, valueJson, onChange }) => {
    const [inputValue, setInputValue] = useState<any>(''); // Holds the parsed, user-friendly value
    const [parseError, setParseError] = useState<string | null>(null);

    const typeString = getDataTypeString(paramDef.dataType);

    useEffect(() => {
        const currentTypeString = getDataTypeString(paramDef.dataType);
        try {
            setParseError(null);
            if (valueJson === undefined || valueJson === null || valueJson.trim() === '') {
                // For empty or undefined valueJson, set a type-appropriate default
                switch (currentTypeString) {
                    case 'Text':
                    case 'Principal': // Principals are text-like
                        setInputValue('');
                        break;
                    case 'Nat':
                    case 'Int':
                    case 'Nat64': // Assuming these are handled as numbers by NumberInput
                    case 'Int64':
                        setInputValue(0);
                        break;
                    case 'Bool':
                        setInputValue(false);
                        break;
                    case 'JsonText':
                        setInputValue('{}'); // Default for JsonText is an empty object string
                        break;
                    default:
                        if (currentTypeString.startsWith('Array')) {
                            setInputValue([]);
                        } else if (currentTypeString.startsWith('Opt')) {
                            setInputValue(null); // Use null for optional types that are "empty"
                        } else {
                            setInputValue(''); // Fallback for other types
                        }
                }
                return;
            }

            // If valueJson is present, process it
            if (currentTypeString === 'JsonText') {
                // For JsonText, inputValue should be the string itself.
                // Validate it by trying to parse.
                JSON.parse(valueJson);
                setInputValue(valueJson);
            } else {
                // For other types, parse it for the input controls
                const parsed = JSON.parse(valueJson);
                setInputValue(parsed);
            }
        } catch (e) {
            console.error(`Error parsing valueJson for ${paramDef.name} (${currentTypeString}):`, valueJson, e);
            // setParseError(`Invalid current JSON. Error: ${(e as Error).message}. Using raw value.`);
            setInputValue(valueJson); // Fallback to raw string if parsing fails
        }
    }, [valueJson, paramDef.name, paramDef.dataType]); // paramDef.dataType is an object; re-run if its identity changes

    const handleChange = (newValue: any) => {
        setInputValue(newValue); // Update local state for immediate input feedback
        try {
            // For undefined (e.g. cleared optional non-required number), pass undefined up
            if (newValue === undefined) {
                onChange(undefined);
            } else {
                const newJsonString = JSON.stringify(newValue);
                onChange(newJsonString);
            }
            setParseError(null); // Clear parse error if user fixes it by typing
        } catch (e) {
            setParseError(`Error stringifying new value: ${(e as Error).message}`);
        }
    };

    const commonProps = {
        label: `Value for "${paramDef.inputLabel}"`,
        description: paramDef.helpText || `Expected type: ${typeString}`,
        error: parseError,
        required: paramDef.isRequired,
        mt: "xs" as "xs", // Type assertion for Mantine size prop
    };

    let dynamicPlaceholder: string | number | undefined;
    const defaultPlaceholderTextForType = {
        Text: "Enter text",
        Principal: "Enter Principal ID",
        Nat: "Enter a number",
        Int: "Enter a number",
        ArrayText: "Enter tags and press Enter",
        // Add other types if they use this component and need specific placeholders
    }[typeString] || `Enter ${typeString.toLowerCase()}`;

    if (paramDef.defaultValueJson?.[0] && typeof paramDef.defaultValueJson[0] === 'string') {
        try {
            const parsedDefault = JSON.parse(paramDef.defaultValueJson[0]);
            if (typeString === 'ArrayText' && Array.isArray(parsedDefault)) {
                dynamicPlaceholder = parsedDefault.join(', ');
            } else {
                dynamicPlaceholder = parsedDefault;
            }
        } catch (e) {
            console.error("Failed to parse defaultValueJson for placeholder:", paramDef.defaultValueJson[0], e);
            dynamicPlaceholder = defaultPlaceholderTextForType;
        }
    } else {
        dynamicPlaceholder = defaultPlaceholderTextForType;
    }

    switch (typeString) {
        case 'Text':
            return (
                <TextInput
                    {...commonProps}
                    value={inputValue === null || inputValue === undefined ? '' : String(inputValue)}
                    onChange={(event) => handleChange(event.currentTarget.value)}
                    placeholder={String(dynamicPlaceholder)}
                />
            );
        case 'Nat':
        case 'Int':
            // Add Nat64, Int64 if they use NumberInput and represent large numbers as string in JSON but number in UI
            // For simplicity, assuming NumberInput handles standard numbers here. BigInts might need string inputs or specialized components.
            return (
                <NumberInput
                    {...commonProps}
                    value={typeof inputValue === 'number' ? inputValue : Number(inputValue) || (paramDef.isRequired ? 0 : '')}
                    onChange={(value: number | string) => {
                        if (value === '') {
                            handleChange(paramDef.isRequired ? 0 : null); // Use null for empty optional
                        } else {
                            handleChange(value);
                        }
                    }}
                    placeholder={String(dynamicPlaceholder)}
                    allowDecimal={false} // Nat and Int are typically whole numbers
                    allowNegative={typeString === 'Int' /* || typeString === 'Int64' */}
                    min={typeString === 'Nat' /* || typeString === 'Nat64' */ ? 0 : undefined}
                />
            );
        case 'Bool':
            return (
                <Checkbox
                    {...commonProps}
                    label={commonProps.label} // Checkbox uses label prop differently
                    description={commonProps.description}
                    checked={typeof inputValue === 'boolean' ? inputValue : Boolean(inputValue)}
                    onChange={(event) => handleChange(event.currentTarget.checked)}
                />
            );
        case 'ArrayText':
            return (
                <TagsInput
                    {...commonProps}
                    value={Array.isArray(inputValue) ? inputValue.map(String) : []}
                    onChange={(tags) => handleChange(tags)} // tags is string[]
                    placeholder={String(dynamicPlaceholder)}
                    description={paramDef.helpText || "Enter values and press Enter. Expected array of strings."}
                />
            );

        // Handle other specific array types with JsonInput
        case 'ArrayInt':
        case 'ArrayNat':
        case 'ArrayBool':
        case 'ArrayPrincipal':
        case 'ArrayNat64':
            // Add any other 'Array*' types from ParameterDataType here
            return (
                <JsonInput
                    {...commonProps}
                    value={typeof inputValue === 'string' ? inputValue : JSON.stringify(inputValue ?? [])}
                    onChange={onChange} // JsonInput's onChange provides string directly
                    formatOnBlur
                    autosize
                    minRows={3}
                    description={paramDef.helpText || `Enter as JSON array. Expected ${typeString}. Example: ${typeString === 'ArrayInt' ? '[1, 2, 3]' : '["item1", true, 3]'}`}
                />
            );

        case 'JsonText':
            return (
                <JsonInput
                    {...commonProps}
                    // inputValue for JsonText should be a string (either the original valid JSON, an error string, or default '{}')
                    value={typeof inputValue === 'string' ? inputValue : '{}'}
                    onChange={onChange} // JsonInput's onChange provides string directly
                    formatOnBlur
                    autosize
                    minRows={3}
                    description={paramDef.helpText || "Enter a valid JSON structure."}
                />
            );
        case 'Principal':
            return (
                <TextInput
                    {...commonProps}
                    value={inputValue === null || inputValue === undefined ? '' : String(inputValue)}
                    onChange={(event) => handleChange(event.currentTarget.value)}
                    placeholder={String(dynamicPlaceholder)}
                />
            );

        default:
            return (
                <Alert icon={<IconAlertCircle size="1rem" />} title="Unsupported Input Type" color="orange" radius="md" mt="xs">
                    <Text size="sm">
                        The data type <Text span fw={700}>{typeString}</Text> for parameter "{paramDef.inputLabel}"
                        does not have a specialized UI input.
                    </Text>
                    {paramDef.helpText && <Text size="xs" mt={4}>Hint: {paramDef.helpText}</Text>}
                </Alert>
            );
    }
};

export default LiteralValueInput;