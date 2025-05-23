import { UIInteractionType } from "../../declarations/actionsCanister/actions.did.js";
import { ActionFlow } from "./types.ts";


interface BackendParameterValueSourceVariant {
    LiteralValue?: string;
    PreviousStepOutput?: { sourceStepId: number; outputKeyPath: string };
    UserSuppliedInput?: { inputKeyPath: string };
    MissionContext?: { contextKey: string };
    // Add other types if they exist
}

interface BackendCompletionLogicVariant {
    AllInOrder?: null;
    AllAnyOrder?: null;
    // Add other types if they exist
}

export function prepareActionFlowForBackend(frontendActionFlow: ActionFlow): any {
    // Create a deep copy to avoid mutating the original state object
    const backendReadyFlow = JSON.parse(JSON.stringify(frontendActionFlow));

    // 1. Transform top-level completionLogic
    if (backendReadyFlow.completionLogic && backendReadyFlow.completionLogic.type) {
        const logicType = backendReadyFlow.completionLogic.type;
        delete backendReadyFlow.completionLogic.type; // Remove the 'type' field
        backendReadyFlow.completionLogic[logicType] = null; // Set the variant { "VariantName": null }
    }

    // 2. Transform parameterBindings.valueSource in each step's actions
    if (backendReadyFlow.steps && Array.isArray(backendReadyFlow.steps)) {
        for (const step of backendReadyFlow.steps) {
            // Assuming item only contains SingleAction for now as per your structure
            if (step.item && step.item.SingleAction && step.item.SingleAction.parameterBindings) {
                step.item.SingleAction.parameterBindings = step.item.SingleAction.parameterBindings.map((binding: any) => {
                    if (binding.valueSource && binding.valueSource.type) {
                        const vsType = binding.valueSource.type; // e.g., "LiteralValue"
                        const vsData = { ...binding.valueSource };
                        delete vsData.type; // Remove the "type" discriminant

                        let newBackendValueSource: BackendParameterValueSourceVariant = {};

                        if (vsType === 'LiteralValue') {
                            // The valueJson IS the Text payload for #LiteralValue
                            newBackendValueSource.LiteralValue = vsData.valueJson;
                        } else if (vsType === 'PreviousStepOutput') {
                            newBackendValueSource.PreviousStepOutput = {
                                sourceStepId: vsData.sourceStepId,
                                outputKeyPath: vsData.outputKeyPath,
                            };
                        } else if (vsType === 'UserSuppliedInput') {
                            newBackendValueSource.UserSuppliedInput = { inputKeyPath: vsData.inputKeyPath };
                        } else if (vsType === 'MissionContext') {
                            newBackendValueSource.MissionContext = { contextKey: vsData.contextKey };
                        }
                        // Add more 'else if' blocks for other ParameterValueSource types

                        return {
                            ...binding,
                            valueSource: newBackendValueSource,
                        };
                    }
                    return binding; // Should ideally not be reached if valueSource.type is always present
                });
            }
            // If you have ActionGroup with parameterBindings, handle them similarly
        }
    }

    return backendReadyFlow;
}

export function prepareUiInteractionForJson(originalUiInteraction: UIInteractionType): UIInteractionType {
    // Create a deep copy to avoid mutating the original object if it's shared (e.g., from actionDefinitions array)
    // and to ensure we are working with a mutable structure if needed.
    // If originalUiInteraction is always a fresh copy, direct modification can also work, but cloning is safer.
    const uiCopy = JSON.parse(JSON.stringify(originalUiInteraction));

    if (uiCopy.InputAndButton && uiCopy.InputAndButton.inputFields && Array.isArray(uiCopy.InputAndButton.inputFields)) {
        const transformedInputFields = uiCopy.InputAndButton.inputFields.map((field: any) => {
            // Safely access placeholder, which is ?Text in Candid, thus [string] | [] in .did.js
            const didJsPlaceholder = field.placeholder;
            let jsonFriendlyPlaceholder: string | undefined = undefined;

            if (Array.isArray(didJsPlaceholder)) {
                if (didJsPlaceholder.length > 0) {
                    jsonFriendlyPlaceholder = didJsPlaceholder[0]; // Unwrap the string
                }
                // If didJsPlaceholder is [], jsonFriendlyPlaceholder remains undefined (representing null)
            } else if (typeof didJsPlaceholder === 'string') {
                // This case handles if it was somehow already a string
                jsonFriendlyPlaceholder = didJsPlaceholder;
            }
            // If didJsPlaceholder was null or undefined initially, jsonFriendlyPlaceholder also remains undefined

            return {
                ...field,
                placeholder: jsonFriendlyPlaceholder, // Now it's string | undefined
            };
        });

        // Return a new uiCopy with the transformed inputFields
        return {
            ...uiCopy,
            InputAndButton: {
                ...uiCopy.InputAndButton,
                inputFields: transformedInputFields,
            },
        };
    }
    // Add similar logic here if other UIInteractionType variants (e.g., #ButtonOnly)
    // also have optional text fields from Candid that might be in the array format.

    return uiCopy; // Return the (potentially modified) copy
}