import { Async } from "domain/entities/Async";
import { ProgramsRepository } from "domain/repositories/ProgramsRepository";
import { ClosePatientsOptions } from "data/ProgramsD2Repository";

export class ClosePatientsUseCase {
    constructor(private programsRepository: ProgramsRepository) {}

    async execute(options: ClosePatientsOptions): Async<void> {
        await this.programsRepository.closePatients(options);
    }
}
