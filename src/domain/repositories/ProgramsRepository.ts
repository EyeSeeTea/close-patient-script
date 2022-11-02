import { Enrollment, Event, TrackedEntity } from "domain/entities/TrackedEntity";
import { CancelableResponse } from "types/d2-api";

export interface ProgramsRepository {
    get(options: GetOptions): CancelableResponse<ApiGetResponse>;
    save(payload: Payload): CancelableResponse<ApiSaveResponse>;
}

export interface GetOptions {
    programId: string;
    orgUnitsIds?: string[];
    startDate?: string;
    endDate?: string;
}

export interface Payload {
    enrollments: Enrollment[];
    events: Event[];
}

export interface ApiGetResponse {
    instances: TrackedEntity[];
}

export interface ApiSaveResponse {
    validationReport?: { errorReports?: Report[] };
    status: "OK" | "ERROR" | "WARNING";
    stats: Stats;
}

export type ApiPostErrorResponse = {
    response: {
        data: ApiSaveResponse & { message?: string };
    };
};

interface Report {
    message: string;
}

interface Stats {
    created: number;
    updated: number;
    deleted: number;
    ignored: number;
    total: number;
}
