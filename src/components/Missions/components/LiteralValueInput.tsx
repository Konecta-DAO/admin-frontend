import React, { useState, useEffect } from 'react';
import { TextInput, NumberInput, Checkbox, TagsInput, JsonInput, Text, Alert } from '@mantine/core';
import { SerializedActionParameterDefinition, ParameterDataType } from '../../../declarations/actionsCanister/actions.did.js';
import { IconAlertCircle } from '@tabler/icons-react';

interface LiteralValueInputProps {
    paramDef: SerializedActionParameterDefinition;
    valueJson: string; // The current JSON string representation of the literal value
    onChange: (newValueJson: string | undefined) => void; // Callback with the new JSON string, or undefined if value should be absent
}

const getDataTypeString = (dataType: ParameterDataType): string => {
    return Object.keys(dataType)[0];
};

const LiteralValueInput: React.FC<LiteralValueInputProps> = ({ paramDef, valueJson, onChange }) => {
    const [inputValue, setInputValue] = useState<any>('');
    const [parseError, setParseError] = useState<string | null>(null);

    const typeString = getDataTypeString(paramDef.dataType);

    useEffect(() => {
        const currentTypeString = getDataTypeString(paramDef.dataType);
        try {
            setParseError(null);
            if (valueJson === undefined || valueJson === null || valueJson.trim() === '') {
                // Set type-appropriate defaults for empty values
                const defaultsMap: { [key: string]: any } = {
                    'Text': '', 'Principal': '',
                    'Nat': '', 'Int': '', 'Nat64': '', 'OptNat': '', 'OptInt': '',
                    'Bool': false, 'JsonText': '{}',
                };
                if (currentTypeString in defaultsMap) {
                    setInputValue(defaultsMap[currentTypeString]);
                } else if (currentTypeString.startsWith('Array')) {
                    setInputValue([]);
                } else if (currentTypeString.startsWith('Opt')) {
                    setInputValue(null);
                } else {
                    setInputValue('');
                }
                return;
            }

            // For string-based types, we don't need to parse. We just unquote the JSON string.
            if (currentTypeString === 'Text' || currentTypeString === 'Principal') {
                if (valueJson.startsWith('"') && valueJson.endsWith('"')) {
                    // It's a valid JSON string, so unwrap it for the input field.
                    setInputValue(JSON.parse(valueJson));
                } else {
                    // It's likely a raw string from a fallback state, use it directly.
                    // This prevents the parse error.
                    setInputValue(valueJson);
                }
            } else if (currentTypeString === 'JsonText') {
                // For JsonText, validate it's valid JSON but keep it as a string for the JsonInput
                JSON.parse(valueJson);
                setInputValue(valueJson);
            } else {
                // For other types (numbers, booleans, arrays), parse it for the input controls.
                const parsed = JSON.parse(valueJson);
                setInputValue(parsed);
            }

        } catch (e) {
            console.error(`Error parsing valueJson for ${paramDef.name} (${currentTypeString}):`, valueJson, e);
            setInputValue(valueJson); // Fallback to raw string if parsing fails
        }
    }, [valueJson, paramDef.name, paramDef.dataType]);

    const handleChange = (newValue: any) => {
        setInputValue(newValue);
        try {
            if (newValue === undefined || newValue === null) {
                onChange(JSON.stringify(null));
            } else {
                const newJsonString = JSON.stringify(newValue);
                onChange(newJsonString);
            }
            setParseError(null);
        } catch (e) {
            setParseError(`Error stringifying new value: ${(e as Error).message}`);
        }
    };

    const commonProps = {
        label: `Value for "${paramDef.inputLabel}"`,
        description: paramDef.helpText?.[0] || `Expected type: ${typeString}`,
        error: parseError,
        required: paramDef.isRequired,
        mt: "xs" as "xs",
    };

    let dynamicPlaceholder: string | number | undefined;
    const defaultPlaceholderTextForType = {
        Text: "Enter text",
        Principal: "Enter Principal ID",
        Nat: "Enter a number",
        Int: "Enter a number",
        OptNat: "Enter a number (optional)",
        OptInt: "Enter a number (optional)",
        ArrayText: "Enter tags and press Enter",
    }[typeString] || `Enter ${typeString.toLowerCase()}`;

    if (paramDef.defaultValueJson?.[0] && typeof paramDef.defaultValueJson[0] === 'string') {
        try {
            const parsedDefault = JSON.parse(paramDef.defaultValueJson[0]);
            dynamicPlaceholder = Array.isArray(parsedDefault) ? parsedDefault.join(', ') : parsedDefault;
        } catch (e) {
            dynamicPlaceholder = defaultPlaceholderTextForType;
        }
    } else {
        dynamicPlaceholder = defaultPlaceholderTextForType;
    }

    switch (typeString) {
        case 'Text':
        case 'Principal':
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
        case 'Nat64':
        case 'OptNat':
        case 'OptInt':
            return (
                <NumberInput
                    {...commonProps}
                    value={typeof inputValue === 'number' ? inputValue : ''}
                    onChange={(value) => {
                        handleChange(value === '' ? null : value);
                    }}
                    placeholder={String(dynamicPlaceholder)}
                    allowDecimal={false}
                    allowNegative={typeString === 'Int' || typeString === 'OptInt'}
                    min={typeString.includes('Nat') ? 0 : undefined}
                />
            );

        case 'Bool':
            return (
                <Checkbox
                    {...commonProps}
                    label={commonProps.label}
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
                    onChange={(tags) => handleChange(tags)}
                    placeholder={String(dynamicPlaceholder)}
                    description={paramDef.helpText?.[0] || "Enter values and press Enter. Expected array of strings."}
                />
            );

        case 'ArrayInt':
        case 'ArrayNat':
        case 'ArrayBool':
        case 'ArrayPrincipal':
        case 'ArrayNat64':
        case 'JsonText':
            return (
                <JsonInput
                    {...commonProps}
                    value={typeof inputValue === 'string' ? inputValue : JSON.stringify(inputValue ?? (typeString.startsWith('Array') ? [] : {}), null, 2)}
                    onChange={onChange}
                    formatOnBlur
                    autosize
                    minRows={3}
                    description={paramDef.helpText?.[0] || `Enter a valid JSON structure. Example for ${typeString}: ${typeString === 'ArrayInt' ? '[1, 2, 3]' : '["item1", "item2"]'}`}
                />
            );

        default:
            return (
                <Alert icon={<IconAlertCircle size="1rem" />} title="Unsupported Input Type" color="orange" radius="md" mt="xs">
                    <Text size="sm">
                        The data type <Text span fw={700}>{typeString}</Text> for parameter "{paramDef.inputLabel}"
                        does not have a specialized UI input.
                    </Text>
                    {paramDef.helpText?.[0] && <Text size="xs" mt={4}>Hint: {paramDef.helpText[0]}</Text>}
                </Alert>
            );
    }
};

export default LiteralValueInput;