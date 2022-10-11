import { Async } from "domain/entities/Async";
import { Id } from "domain/entities/Base";
import { Pair } from "scripts/common";

export interface ProgramsRepository {
    closePatients(options: ClosePatientsOptions): Async<void>;
}

export interface ClosePatientsOptions {
    orgUnitsIds?: Id[];
    period?: Pair;
    programId: Id;
    programStageIds: Id[];
    closureProgramId: Id;
    timeOfReference: string;
    pairsDeValue: Pair[];
    comments: string;
}
