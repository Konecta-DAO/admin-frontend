import React, { useState, useCallback, useEffect } from 'react';
import {
    Paper, Title, Button, Group, Modal, Stack, Select, TextInput, Textarea, Alert, Text, Box,
    ScrollArea,
    Tooltip
} from '@mantine/core';
import { IconPlus, IconSettings, IconTrash, IconAlertCircle, IconInfoCircle } from '@tabler/icons-react';
import {
    ReactFlow,
    addEdge,
    Controls,
    Background,
    Node as FlowNode,
    Edge,
    Connection,
    useNodesState,
    useEdgesState,
    NodeTypes,
    MarkerType,
    Position,
    NodeProps as FlowNodeProps,
    Handle,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import type {
    ActionFlow, ActionStep, ParameterBinding, ParameterValueSource,
    FlowCompletionLogic,
    FlowEdgeCore
} from '../types.ts'; // Adjust path as needed
import LiteralValueInput from './LiteralValueInput.tsx';
import { ParameterDataType, SerializedActionDefinition, SerializedActionParameterDefinition, UIInteractionType } from '../../../declarations/actionsCanister/actions.did.js';
import { prepareUiInteractionForJson } from '../utils.ts';

// --- Custom Node Component (Simplified Example) ---
interface StepNodeData extends Record<string, unknown> { // Still extends Record for flexibility
    step: ActionStep;
    onEditStep: (stepId: number) => void;
    onDeleteStep: (stepId: number) => void;
    isFirst: boolean;
    isLast: boolean;
    flowLogic: FlowCompletionLogic['type'];
}

type MyCustomStepNodeType = FlowNode<StepNodeData, 'stepNode'>;

const getParameterDataTypeName = (dataType: ParameterDataType): string => {
    if (dataType && typeof dataType === 'object' && Object.keys(dataType).length > 0) {
        return Object.keys(dataType)[0] as string;
    }
    return 'Unknown'; // Fallback for unexpected structure
};

const StepNodeComponent = (props: FlowNodeProps<MyCustomStepNodeType>): JSX.Element => {
    const { id, data, selected } = props;
    const actionItem = data.step.item;
    let actionName = 'Unknown Action';
    if ('SingleAction' in actionItem) {
        actionName = actionItem['SingleAction'].displayName || actionItem['SingleAction'].actionDefinitionId;
    } else if ('ActionGroup' in actionItem) {
        actionName = `Group (${actionItem['ActionGroup'].actions.length} actions)`;
    }
    return (
        <Paper shadow="sm" p="xs" withBorder radius="md" style={{ width: 220, border: selected ? '2px solid var(--mantine-color-blue-6)' : undefined, background: 'var(--mantine-color-body)' }}>
            {/* Target Handle (for incoming connections) */}
            <Handle
                type="target"
                position={Position.Left}
                id={`${id}-target`} // Unique ID for the handle
                style={{ background: '#555' }} // Optional styling
                isConnectable={true}
            />
            <Stack gap="xs">
                <Group justify="space-between">
                    <Text fw={500} size="sm" truncate>Step {data.step.stepId}: {data.step.description || 'Unnamed'}</Text>
                    <Tooltip label="Delete Step">
                        <IconTrash size={16} color="red" cursor="pointer" onClick={() => data.onDeleteStep(data.step.stepId)} />
                    </Tooltip>
                </Group>
                <Text size="xs" c="dimmed" truncate>{actionName}</Text>
                <Button size="xs" variant="outline" onClick={() => data.onEditStep(data.step.stepId)} leftSection={<IconSettings size={14} />}>
                    Configure
                </Button>
            </Stack>
            {/* Source Handle (for outgoing connections) */}
            <Handle
                type="source"
                position={Position.Right}
                id={`${id}-source`} // Unique ID for the handle
                style={{ background: '#555' }} // Optional styling
                isConnectable={true}
            />
        </Paper>
    );
};

const nodeTypes: NodeTypes = {
    stepNode: StepNodeComponent,
};

// --- Action Detail Modal (Simplified) ---
interface ActionDetailModalProps {
    opened: boolean;
    onClose: () => void;
    stepToEdit: ActionStep | null;
    actionDefinitions: SerializedActionDefinition[];
    allSteps: ActionStep[];
    onSaveStep: (updatedStep: ActionStep) => void;
}

const getDefaultValueSourceForType = (type: ParameterValueSource['type']): ParameterValueSource => {
    switch (type) {
        case 'LiteralValue':
            return { type: 'LiteralValue', valueJson: '""' }; // Default to empty JSON string
        case 'PreviousStepOutput':
            return { type: 'PreviousStepOutput', sourceStepId: 0, outputKeyPath: '' }; // Needs valid stepId
        case 'UserSuppliedInput':
            return { type: 'UserSuppliedInput', inputKeyPath: '' };
        case 'MissionContext':
            return { type: 'MissionContext', contextKey: '' };
        default:
            return { type: 'LiteralValue', valueJson: '""' }; // Fallback
    }
};

const ActionDetailModal: React.FC<ActionDetailModalProps> = ({
    opened, onClose, stepToEdit, actionDefinitions, allSteps, onSaveStep
}) => {
    const [currentStep, setCurrentStep] = useState<ActionStep | null>(null);
    const [selectedActionDefinition, setSelectedActionDefinition] = useState<SerializedActionDefinition | null>(null);

    // useEffect for setting currentStep and selectedActionDefinition (same as previous response)
    useEffect(() => {
        if (stepToEdit) {
            const deepCopiedStep = JSON.parse(JSON.stringify(stepToEdit)) as ActionStep;
            setCurrentStep(deepCopiedStep);
            const item = deepCopiedStep.item;
            if ('SingleAction' in item) {
                const action = item['SingleAction'];
                const definition = actionDefinitions.find(ad => ad.id === action.actionDefinitionId);
                setSelectedActionDefinition(definition || null);
            } else { setSelectedActionDefinition(null); }
        } else {
            setCurrentStep(null);
            setSelectedActionDefinition(null);
        }
    }, [stepToEdit, actionDefinitions]);

    // handleSave, handleActionDefinitionChange, updateParameterBinding (same as previous response)
    const handleSave = () => {
        if (currentStep) {
            // Add validation here before saving if needed
            onSaveStep(currentStep);
            onClose(); // Close after saving
        }
    };

    const handleActionDefinitionChange = (newDefId: string | null) => {
        if (!newDefId || !currentStep || !('SingleAction' in currentStep.item)) return;

        const newDef = actionDefinitions.find(ad => ad.id === newDefId);
        if (!newDef) return;

        setSelectedActionDefinition(newDef);
        setCurrentStep(prevStep => {
            if (!prevStep || !('SingleAction' in prevStep.item)) return prevStep; // Keep this guard
            // Assuming we are configuring a SingleAction
            let instanceIdToKeepOrUse = Date.now(); // Fallback for new/non-SingleAction
            if ('SingleAction' in prevStep.item && prevStep.item.SingleAction.instanceId) {
                instanceIdToKeepOrUse = prevStep.item.SingleAction.instanceId;
            }

            const preparedNewUiInteraction = prepareUiInteractionForJson(newDef.defaultUIType);
            return {
                ...prevStep,
                item: {
                    SingleAction: { // Assuming changing definition means it's still/becomes a SingleAction
                        instanceId: instanceIdToKeepOrUse,
                        actionDefinitionId: newDef.id,
                        displayName: newDef.name, // Default display name from new definition
                        parameterBindings: [],    // Reset parameter bindings
                        uiInteraction: preparedNewUiInteraction,
                    }
                }
            };
        });
    };

    // Updated updateBinding function
    const updateParameterBinding = useCallback((paramName: string, newSource: ParameterValueSource) => {
        setCurrentStep(prevStep => {
            if (!prevStep || !('SingleAction' in prevStep.item)) return prevStep;
            const originalInstance = prevStep.item.SingleAction;

            const existingBindings = prevStep.item['SingleAction'].parameterBindings;
            const bindingIndex = existingBindings.findIndex(b => b.parameterName === paramName);

            let newBindings: ParameterBinding[];
            if (bindingIndex > -1) {
                newBindings = existingBindings.map((b, i) =>
                    i === bindingIndex ? { ...b, valueSource: newSource } : b
                );
            } else {
                newBindings = [...existingBindings, { parameterName: paramName, valueSource: newSource }];
            }
            return {
                ...prevStep,
                item: {
                    SingleAction: { // Correctly target the SingleAction variant
                        ...originalInstance,
                        parameterBindings: newBindings
                    }
                }
            };
        });
    }, []);

    const renderParameterInputs = (
        paramDef: SerializedActionParameterDefinition,
        currentValueSource: ParameterValueSource | undefined,
        _updateParameterBinding: (paramName: string, newSource: ParameterValueSource) => void,
        _allSteps: ActionStep[],
        _currentStepId: number | undefined
    ) => {
        const updateBinding = _updateParameterBinding;
        let valueSourceToRender = currentValueSource;

        if (!valueSourceToRender) {
            let initialValueJson = paramDef.defaultValueJson?.[0] || '""';
            try {
                JSON.parse(initialValueJson);
            } catch (e) {
                initialValueJson = '""';
            }
            valueSourceToRender = { type: 'LiteralValue', valueJson: initialValueJson };
        }

        const handleSourceTypeChange = (newType: string | null) => {
            if (!newType) return;
            const selectedNewType = newType as ParameterValueSource['type'];
            let newSource = getDefaultValueSourceForType(selectedNewType);

            if (newSource.type === 'LiteralValue' && paramDef.defaultValueJson?.[0]) {
                try {
                    JSON.parse(paramDef.defaultValueJson?.[0]);
                    newSource.valueJson = paramDef.defaultValueJson?.[0];
                } catch (e) { /* newSource.valueJson remains '""' */ }
            } else if (newSource.type === 'PreviousStepOutput') {
                const availablePreviousSteps = _allSteps.filter(s => s.stepId !== _currentStepId);
                if (availablePreviousSteps.length > 0) {
                    newSource.sourceStepId = availablePreviousSteps[0].stepId;
                } else {
                    newSource.sourceStepId = 0;
                }
            }
            updateBinding(paramDef.name, newSource);
        };

        // MODIFICATION START
        const actualDataTypeName = getParameterDataTypeName(paramDef.dataType);
        let displayDataType = actualDataTypeName;

        if (actualDataTypeName.startsWith('Array') && actualDataTypeName.length > 5) {
            const subType = actualDataTypeName.substring(5); // e.g., "Bool" from "ArrayBool"
            displayDataType = `Array of ${subType}`;
        } else if (actualDataTypeName.startsWith('Opt') && actualDataTypeName.length > 3) {
            const subType = actualDataTypeName.substring(3); // e.g., "Int" from "OptInt"
            displayDataType = `Optional ${subType}`;
        }
        // MODIFICATION END

        return (
            <Paper key={paramDef.name} withBorder p="sm" radius="sm" mt="md">
                <Group justify="space-between">
                    <Title order={6}>{paramDef.inputLabel} <Text span c="dimmed" size="xs">({paramDef.name})</Text></Title>
                    {paramDef.helpText && (
                        <Tooltip label={paramDef.helpText} multiline w={220} withArrow position="top-end">
                            <IconInfoCircle size={16} style={{ cursor: 'help', color: 'var(--mantine-color-gray-6)' }} />
                        </Tooltip>
                    )}
                </Group>
                <Text size="xs" c="dimmed">
                    {/* MODIFIED LINE */}
                    Data Type: {displayDataType}
                    {paramDef.isRequired ? <Text span c="red" inherit> (Required)</Text> : ' (Optional)'}
                </Text>

                <Select
                    label="Value Source Type"
                    value={valueSourceToRender?.type}
                    onChange={handleSourceTypeChange}
                    data={[
                        { value: 'LiteralValue', label: 'Literal Value (Constant)' },
                        { value: 'PreviousStepOutput', label: 'Output from Previous Step' },
                        { value: 'UserSuppliedInput', label: 'User Supplied Input (from Mission UI)' },
                        { value: 'MissionContext', label: 'Mission Context (System Provided)' },
                    ]}
                    mt="sm"
                    mb="xs"
                />

                {valueSourceToRender?.type === 'LiteralValue' && (
                    <LiteralValueInput
                        paramDef={paramDef} // Make sure LiteralValueInput also handles paramDef.dataType correctly if needed
                        valueJson={valueSourceToRender.valueJson}
                        onChange={(newValueJson) => {
                            if (newValueJson) updateBinding(paramDef.name, { type: 'LiteralValue', valueJson: JSON.parse(newValueJson)! });
                        }}
                    />
                )}
                {valueSourceToRender?.type === 'PreviousStepOutput' && (
                    <Stack gap="xs" mt="xs">
                        <Select
                            label="Source Step ID"
                            placeholder="Select a previous step"
                            value={valueSourceToRender.sourceStepId !== 0 ? String(valueSourceToRender.sourceStepId) : null}
                            data={_allSteps
                                .filter(s => s.stepId !== _currentStepId)
                                .map(s => ({ value: String(s.stepId), label: `Step ${s.stepId}: ${s.description || 'Unnamed Step'}` }))
                            }
                            onChange={(val) => val && updateBinding(paramDef.name, { type: 'PreviousStepOutput', sourceStepId: parseInt(val, 10), outputKeyPath: valueSourceToRender.outputKeyPath || "" })}
                            nothingFoundMessage="No other steps available to reference"
                            clearable={!paramDef.isRequired}
                            required={paramDef.isRequired}
                        />
                        <TextInput
                            label="Output Key Path"
                            placeholder="e.g., userData.id or results[0].status"
                            value={valueSourceToRender?.outputKeyPath}
                            onChange={(e) => updateBinding(paramDef.name, { type: 'PreviousStepOutput', sourceStepId: valueSourceToRender.sourceStepId, outputKeyPath: e.currentTarget.value })}
                            required={paramDef.isRequired}
                        />
                    </Stack>
                )}
                {valueSourceToRender?.type === 'UserSuppliedInput' && (
                    <TextInput
                        mt="xs"
                        label="User Input Key Path"
                        placeholder="Key for user input field (defined in UI Interaction)"
                        value={valueSourceToRender.inputKeyPath}
                        onChange={(e) => updateBinding(paramDef.name, { type: 'UserSuppliedInput', inputKeyPath: e.currentTarget.value })}
                        required={paramDef.isRequired}
                    />
                )}
                {valueSourceToRender?.type === 'MissionContext' && (
                    <TextInput
                        mt="xs"
                        label="Mission Context Key"
                        placeholder="e.g., missionId, userPrincipal, dailyTwitterTarget"
                        value={valueSourceToRender.contextKey}
                        onChange={(e) => updateBinding(paramDef.name, { type: 'MissionContext', contextKey: e.currentTarget.value })}
                        required={paramDef.isRequired}
                    />
                )}
            </Paper>
        );
    };

    // ... (Modal JSX structure: if (!currentStep) return null; etc. as before) ...
    if (!currentStep) return null;

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title={`Configure Step ${currentStep.stepId}: ${currentStep.description || 'No step description'}`}
            size="xl" centered
            scrollAreaComponent={ScrollArea.Autosize}
            mah="90vh"
        >
            <Stack gap="lg">
                <TextInput
                    label="Step Description"
                    placeholder="A clear description for this step"
                    value={currentStep.description || ''}
                    onChange={(e) => setCurrentStep(prev => prev ? { ...prev, description: e.currentTarget.value } : null)}
                />

                {'SingleAction' in currentStep.item && (() => {
                    const actionInstance = currentStep.item['SingleAction'];

                    return (
                        <Paper p="lg" withBorder radius="md" shadow="xs">
                            <Title order={4} mb="md">Action Configuration</Title>
                            <Select
                                label="Action Definition"
                                description="Choose the type of action this step will perform."
                                data={actionDefinitions.map(ad => ({ value: ad.id, label: `[${getParameterDataTypeName(ad.platform as any)}] ${ad.name} (v${ad.version})` }))}
                                value={actionInstance.actionDefinitionId}
                                onChange={handleActionDefinitionChange}
                                searchable
                                nothingFoundMessage="No action definition found"
                                mb="lg"
                            />
                            {selectedActionDefinition && selectedActionDefinition.parameterSchema.length > 0 && (
                                <Box>
                                    <Title order={5} mb="sm">Parameter Bindings</Title>
                                    {selectedActionDefinition.parameterSchema.map(paramDef => {
                                        const binding = actionInstance.parameterBindings.find(b => b.parameterName === paramDef.name);
                                        // Call with the new signature, passing the valueSource directly
                                        return renderParameterInputs(
                                            paramDef,
                                            binding?.valueSource, // This is ParameterValueSource | undefined
                                            updateParameterBinding, // Pass the callback
                                            allSteps,             // Pass allSteps
                                            currentStep?.stepId   // Pass currentStepId
                                        );
                                    })}
                                </Box>
                            )}
                            {selectedActionDefinition && selectedActionDefinition.parameterSchema.length === 0 && (
                                <Text size="sm" c="dimmed" mt="sm">This action has no configurable parameters.</Text>
                            )}
                            <Textarea
                                mt="lg"
                                label="Action Display Name (Optional)"
                                description="Override the default name of the action for this step."
                                placeholder={selectedActionDefinition?.name || "Custom display name"}
                                value={actionInstance.displayName || ''}
                                onChange={(e) => setCurrentStep(prev => {
                                    if (!prev || !('SingleAction' in prev.item)) return prev;
                                    const originalInstance = prev.item.SingleAction;
                                    return {
                                        ...prev,
                                        item: {
                                            SingleAction: { // Correctly target the SingleAction variant
                                                ...originalInstance,
                                                displayName: e.currentTarget.value
                                            }
                                        }
                                    };
                                })}
                            />
                        </Paper>
                    );
                })()}

                {'ActionGroup' in currentStep.item && (
                    <Alert color="orange" title="Action Group Configuration">
                        UI for configuring Action Groups (multiple actions, group completion logic) is not fully implemented in this detailed modal. You can edit the group via the main ActionFlow JSON.
                    </Alert>
                )}


                <Group justify="flex-end" mt="xl">
                    <Button variant="default" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSave}>Save Step Changes</Button>
                </Group>
            </Stack>
        </Modal>
    );
};


// --- Main ActionFlowBuilder Component ---
interface ActionFlowBuilderProps {
    actionFlow: ActionFlow;
    onActionFlowChange: (newActionFlow: ActionFlow) => void;
    actionDefinitions: SerializedActionDefinition[];
}

const ActionFlowBuilder: React.FC<ActionFlowBuilderProps> = ({
    actionFlow, onActionFlowChange, actionDefinitions
}) => {
    const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode<StepNodeData, 'stepNode'>>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [stepToEdit, setStepToEdit] = useState<ActionStep | null>(null);

    // Convert ActionFlow steps to React Flow nodes and edges
    useEffect(() => {
        if (!actionFlow || !Array.isArray(actionFlow.steps)) {
            setNodes([]);
            setEdges([]);
            return;
        }

        const newNodes = (actionFlow.steps || []).map((step, index) => ({
            id: step.stepId.toString(),
            type: 'stepNode' as const,
            position: { x: (index % 4) * 270 + 50, y: Math.floor(index / 4) * 180 + 50 },
            data: {
                step,
                onEditStep: (stepIdToEdit) => {
                    setStepToEdit((actionFlow.steps || []).find(s => s.stepId === stepIdToEdit) || null);
                    setIsDetailModalOpen(true);
                },
                onDeleteStep: (stepIdToDelete) => {
                    const newSteps = (actionFlow.steps || []).filter(s => s.stepId !== stepIdToDelete);
                    // Filter current local 'edges' state
                    const remainingEdges = edges.filter(edge => edge.source !== String(stepIdToDelete) && edge.target !== String(stepIdToDelete));
                    onActionFlowChange({ ...actionFlow, steps: newSteps, edges: remainingEdges as FlowEdgeCore[] });
                },
                isFirst: index === 0,
                isLast: (actionFlow.steps || []).length - 1 === index,
                flowLogic: actionFlow.completionLogic?.type || 'AllInOrder',
            } as StepNodeData,
        }));
        setNodes(newNodes);

        // Set local React Flow 'edges' state from the prop
        // Cast FlowEdgeCore[] from prop to Edge[] for React Flow state if types are slightly different
        setEdges((actionFlow.edges || []) as Edge[]);

    }, [actionFlow]); // Removed onActionFlowChange from deps to avoid potential loops when edges are updated visually


    const onConnect = useCallback(
        (connection: Connection) => {
            const newEdge = {
                ...connection,
                id: `edge-${connection.source}-${connection.target}-${Date.now()}`,
                markerEnd: { type: MarkerType.ArrowClosed },
                type: 'smoothstep', // Optional
            } as Edge;
            // This updates local 'edges' state. The useEffect below will propagate it.
            setEdges((eds) => addEdge(newEdge, eds));
        },
        [setEdges] // setEdges is stable
    );

    useEffect(() => {

        if (actionFlow && JSON.stringify(actionFlow.edges || []) !== JSON.stringify(edges)) {
            onActionFlowChange({ ...actionFlow, edges: edges as FlowEdgeCore[] });
        }
    }, [edges, actionFlow, onActionFlowChange]);

    const handleAddStep = () => {
        const existingSteps = actionFlow?.steps || [];
        const existingIds = existingSteps.map(s => s.stepId);
        let newStepId = 1;
        while (existingIds.includes(newStepId)) { newStepId++; }

        const defaultActionDef = actionDefinitions.length > 0 ? actionDefinitions[0] : null;
        if (!defaultActionDef) { alert("No action definitions available."); return; }

        const preparedDefaultUiInteraction = prepareUiInteractionForJson(defaultActionDef.defaultUIType);

        const newStep: ActionStep = {
            stepId: newStepId,
            description: `New Step ${newStepId}`,
            item: {
                "SingleAction": { // Assuming new steps default to SingleAction
                    instanceId: Date.now(), // Convert to bigint if your ActionStep type expects Nat
                    actionDefinitionId: defaultActionDef.id,
                    parameterBindings: [],
                    uiInteraction: preparedDefaultUiInteraction, // Use the prepared version
                    displayName: `Action for Step ${newStepId}`, // Or defaultActionDef.name
                }
            }
        };
        onActionFlowChange({
            ...(actionFlow),
            steps: [...existingSteps, newStep],
            edges: edges as FlowEdgeCore[] // Preserve current visual edges
        });
    };

    const handleSaveStepDetails = (updatedStep: ActionStep) => {
        const existingSteps = actionFlow?.steps || [];
        onActionFlowChange({
            ...(actionFlow),
            steps: existingSteps.map(s => s.stepId === updatedStep.stepId ? updatedStep : s),
            edges: edges as FlowEdgeCore[] // Preserve current visual edges
        });
        setIsDetailModalOpen(false);
    };

    const handleFlowMetaChange = (metaChanges: Partial<Pick<ActionFlow, 'name' | 'completionLogic'>>) => {
        onActionFlowChange({
            ...(actionFlow),
            ...metaChanges,
            edges: edges as FlowEdgeCore[] // Preserve current visual edges
        });
    };

    const flowCompletionTypes: { value: FlowCompletionLogic['type']; label: string }[] = [
        { value: 'AllInOrder', label: 'All In Order (Old Logic - Visual Edges Ignored)' },
        { value: 'AllAnyOrder', label: 'All In Any Order (Old Logic - Visual Edges Ignored)' },
        // Add a new type if you evolve your backend:
        // { value: 'GraphDefined', label: 'Graph Defined (Uses Visual Edges)'}
    ];

    // Defensive access
    const currentFlowName = actionFlow?.name || '';
    const currentCompletionLogicType = actionFlow?.completionLogic?.type || 'AllInOrder';
    const currentStepsForModal = actionFlow?.steps || [];

    return (
        <Paper withBorder p="md" mt="sm" radius="md">
            <Stack gap="md">
                <Group justify="space-between">
                    <Title order={5}>Action Flow Visual Editor</Title>
                    <Button onClick={handleAddStep} leftSection={<IconPlus size={16} />} size="xs" variant="filled">
                        Add Step Node
                    </Button>
                </Group>
                <TextInput
                    label="Flow Name"
                    placeholder="Enter a name for this flow"
                    value={currentFlowName}
                    onChange={(e) => onActionFlowChange({ ...actionFlow, name: e.currentTarget.value })}
                />
                <Select
                    label="Flow Completion Logic (Current Backend Interpretation)"
                    description="Note: Visually drawn edges are not yet used by the backend logic unless 'GraphDefined' is implemented."
                    data={flowCompletionTypes}
                    value={currentCompletionLogicType}
                    onChange={(val) => {
                        if (val) {
                            const baseFlow = actionFlow || { steps: [], completionLogic: { type: 'AllInOrder' } }; // Ensure baseFlow is an object
                            onActionFlowChange({
                                ...baseFlow,
                                completionLogic: { type: val as FlowCompletionLogic['type'] }
                            });
                        }
                    }}
                />

                <Box style={{ height: 500, border: '1px solid var(--mantine-color-default-border)', borderRadius: 'var(--mantine-radius-md)', background: 'var(--mantine-color-dark-8)' }}>
                    {typeof window !== 'undefined' ? (
                        <ReactFlow
                            nodes={nodes}
                            edges={edges} // Bound to local 'edges' state
                            onNodesChange={onNodesChange}
                            onEdgesChange={onEdgesChange} // useEdgesState updates 'edges'
                            onConnect={onConnect}         // Updates 'edges' via setEdges(addEdge(...))
                            nodeTypes={nodeTypes}
                            fitView
                            deleteKeyCode={['Backspace', 'Delete']}
                            nodesDraggable={true}
                            nodesConnectable={true}
                            elementsSelectable={true}
                        >
                            <Controls />
                            <Background gap={16} size={1} />
                        </ReactFlow>
                    ) : (
                        <Alert icon={<IconAlertCircle size="1rem" />} title="Loading Editor" color="blue">
                            Action flow editor will be available shortly.
                        </Alert>
                    )}
                </Box>
            </Stack>

            {isDetailModalOpen && stepToEdit && ( // Ensure stepToEdit is not null
                <ActionDetailModal
                    opened={isDetailModalOpen}
                    onClose={() => setIsDetailModalOpen(false)}
                    stepToEdit={stepToEdit}
                    actionDefinitions={actionDefinitions}
                    allSteps={currentStepsForModal}
                    onSaveStep={handleSaveStepDetails}
                />
            )}
        </Paper>
    );
};

export default ActionFlowBuilder;