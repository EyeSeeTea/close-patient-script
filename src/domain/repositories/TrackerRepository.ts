import { Async } from "domain/entities/Async";
import { Enrollment, Event, TrackedEntity } from "domain/entities/TrackedEntity";

export interface TrackerRepository {
    get(options: GetOptions): Async<TrackedEntity[]>;
    save(payload: ClosurePayload): Async<Stats>;
}

export interface GetOptions {
    programId: string;
    orgUnitsIds?: string[];
    startDate?: string;
    endDate?: string;
}

export interface ClosurePayload {
    enrollments: Enrollment[];
    events: Event[];
}

export interface Stats {
    created: number;
    updated: number;
    deleted: number;
    ignored: number;
    total: number;
}
