import { ClosePatientsOptions } from "data/ProgramsD2Repository";
import { Async } from "domain/entities/Async";

export interface ProgramsRepository {
    closePatients(options: ClosePatientsOptions): Async<void>;
}
