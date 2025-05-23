export type EventStatus = 'draft' | 'published' | 'active' | 'completed' | 'canceled';
export type EventToken = 'FREE' | 'ICP' | 'CKBTC';

export interface KonectaEvent {
    id: string; // Unique ID
    projectId: string;
    name: string;
    description: string;
    coverPhotoUrl?: string; // URL for cover photo
    location: string; // e.g., "Twitter Space", "Discord Stage", "Online (Zoom)", "123 Main St"
    language: string; // e.g., "en", "es"
    startDate: number; // Unix timestamp in milliseconds (convert from/to nanoseconds for backend)
    endDate: number;   // Unix timestamp in milliseconds
    status: EventStatus;
    categories: string[]; // Array of tag strings
    interests: string[];  // Array of tag strings
    priceToken: EventToken;
    tokenAmount?: number; // Required only if priceToken is not FREE
    createdAt: string; // ISO date string
    updatedAt: string; // ISO date string
}

// Type for the form, including temporary fields
export type EventFormValues = Partial<Omit<KonectaEvent, 'id' | 'createdAt' | 'updatedAt' | 'startDate' | 'endDate'>> & {
    coverPhotoFile?: File | null;
    // Use JS Date objects in the form for better UX
    startDate?: Date | null;
    endDate?: Date | null;
};

// Type for files to upload separately
export interface EventFileUploads {
    coverPhotoFile?: File | null;
}