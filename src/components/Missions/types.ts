import { UIInteractionType } from "../../declarations/actionsCanister/actions.did.js";

export interface FlowEdgeCore { // Basic properties React Flow needs
    id: string;
    source: string;      // Source node ID
    target: string;      // Target node ID
    sourceHandle?: string | null;
    targetHandle?: string | null;
    animated?: boolean;
    label?: string;
    // You can add markerEnd, style, etc., if you save them too
    markerEnd?: { type: string /* MarkerType is an enum, use string here or import */;[key: string]: any; };
    [key: string]: any; // Allow other properties
}

export interface ActionFlow {
    name?: string;
    steps: ActionStep[];
    completionLogic: FlowCompletionLogic; // This might need to become more granular or node-specific
    edges?: FlowEdgeCore[];
    entryNodeId?: string; // Specify the starting node
}

export interface ActionStep {
    stepId: number; // Nat
    description?: string;
    item: ActionItem;
}

export type ActionItem =
    { "SingleAction": ActionInstance }
    | { "ActionGroup": GroupOfActions };

export interface GroupOfActions {
    groupId: number; // Nat
    actions: ActionInstance[];
    completionLogic: GroupCompletionLogic;
}

export interface ActionInstance {
    instanceId: number; // Nat
    actionDefinitionId: string; // Text (Key to look up ActionDefinition)
    parameterBindings: ParameterBinding[];
    uiInteraction: UIInteractionType;
    displayName?: string;
}

export type FlowCompletionLogic =
    | { type: 'AllInOrder' }
    | { type: 'AllAnyOrder' }

export type GroupCompletionLogic =
    | { type: 'CompleteAny' }
    | { type: 'CompleteAll' };


export interface ParameterBinding {
    parameterName: string;
    valueSource: ParameterValueSource;
}

export type ParameterValueSource =
    | { type: 'LiteralValue'; valueJson: string } // JSON string
    | { type: 'PreviousStepOutput'; sourceStepId: number; outputKeyPath: string }
    | { type: 'UserSuppliedInput'; inputKeyPath: string }
    | { type: 'MissionContext'; contextKey: string };

export interface UIInputField {
    keyForUserInput: string;
    inputLabel: string;
    placeholder?: string;
    isRequired: boolean;
    // dataType?: ParameterDataType; // For more specific input rendering
}

// Simplified ParameterDataType for frontend, can be expanded