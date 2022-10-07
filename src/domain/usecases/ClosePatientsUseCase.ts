import { Async } from "domain/entities/Async";
import { ProgramsRepository, ClosePatientsOptions } from "domain/repositories/ProgramsRepository";

export class ClosePatientsUseCase {
    constructor(private programsRepository: ProgramsRepository) {}

    async execute(options: ClosePatientsOptions): Async<void> {
        await this.programsRepository.closePatients(options);
    }
}
