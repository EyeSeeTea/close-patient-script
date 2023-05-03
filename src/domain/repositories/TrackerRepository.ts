import { BundleReport, ValidationReport } from "data/TrackerD2Repository";
import { Async } from "domain/entities/Async";
import { Enrollment, Event, TrackedEntity } from "domain/entities/TrackedEntity";
import { Maybe } from "utils/ts-utils";

export interface TrackerRepository {
    get(options: GetOptions): Async<TrackedEntity[]>;
    save(payload: ClosurePayload): Async<BundleReport | Maybe<ValidationReport>>;
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
