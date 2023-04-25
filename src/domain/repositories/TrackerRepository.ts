import { BundleReport } from "data/TrackerD2Repository";
import { Async } from "domain/entities/Async";
import { Enrollment, Event, TrackedEntity } from "domain/entities/TrackedEntity";

export interface TrackerRepository {
    get(options: GetOptions): Async<TrackedEntity[]>;
    save(payload: ClosurePayload): Async<BundleReport>;
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
