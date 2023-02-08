import { TrackedEntityInstancePick } from "data/ProgramsD2Repository";
import { Async } from "domain/entities/Async";
import { Id } from "domain/entities/Base";
import { Enrollment, Event, TrackedEntity } from "domain/entities/TrackedEntity";

export interface ProgramsRepository {
    get(options: GetOptions): Async<TrackedEntity[]>;
    getTeis(ids: Id[]): Async<TrackedEntityInstancePick[]>;
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
