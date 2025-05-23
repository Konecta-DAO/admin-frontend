import { Actor, ActorSubclass, Agent } from "@dfinity/agent";

export const fileToUint8Array = (file: File): Promise<Uint8Array> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            if (event.target?.result && event.target.result instanceof ArrayBuffer) {
                resolve(new Uint8Array(event.target.result));
            } else {
                reject(new Error('Failed to read file as ArrayBuffer.'));
            }
        };
        reader.onerror = (error) => {
            reject(error);
        };
        reader.readAsArrayBuffer(file);
    });
};

export const urlValidation = (value: string | undefined | null): boolean => {
    if (!value || value.trim() === '') return true;
    try { new URL(value); return true; } catch (_) { return false; }
};

export const createActorUtil = async (canisterId: string, idlFactory: any, agent?: Agent): Promise<ActorSubclass> => {
    if (!agent) {
        throw new Error("Agent is not available to create actor.");
    }
    if (process.env.NODE_ENV !== "production") {
        try {
            await agent.fetchRootKey();
        } catch (err) {
            console.warn("Unable to fetch root key for local development. Ensure replica is running.", err);
        }
    }
    return Actor.createActor(idlFactory, { agent, canisterId });
};
