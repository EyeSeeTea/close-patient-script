import _ from "lodash";
import { ProgramsRepository, ClosurePayload } from "domain/repositories/ProgramsRepository";
import { Async } from "domain/entities/Async";
import { Id } from "domain/entities/Base";
import { Pair } from "scripts/common";
import { Enrollment, TrackedEntity } from "domain/entities/TrackedEntity";
import { ReportExportRepository } from "domain/repositories/ReportExportRepository";
import log from "utils/log";

export class ClosePatientsUseCase {
    constructor(
        private programsRepository: ProgramsRepository,
        private reportExportRepository: ReportExportRepository
    ) {}

    async execute(options: ClosePatientsOptions): Async<void> {
        const {
            orgUnitsIds,
            startDate,
            endDate,
            programId,
            programStagesIds,
            closureProgramId,
            timeOfReference,
            pairsDeValue,
            saveReportPath,
            comments,
            post,
        } = options;

        const payload = await this.programsRepository
            .get({ programId, orgUnitsIds, startDate, endDate })
            .then(trackedEntities => {
                return this.filterEntities(
                    trackedEntities,
                    programId,
                    closureProgramId,
                    programStagesIds,
                    timeOfReference,
                    orgUnitsIds
                );
            })
            .then(entities =>
                this.reportExportRepository
                    .save({
                        outputPath: saveReportPath,
                        entities,
                        programId,
                    })
                    .then(() => {
                        log.info(`Report: ${options.saveReportPath}`);
                        return entities;
                    })
            )
            .then(entities =>
                this.mapPayload(entities, {
                    programStagesIds,
                    timeOfReference,
                    pairsDeValue,
                    closureProgramId,
                    comments,
                })
            );

        if (post) {
            this.programsRepository
                .save(payload)
                .then(stats =>
                    log.info(`Closed patients. Enrollments and closure events: ${JSON.stringify(stats)}`)
                );
        } else log.info(`Payload: ${JSON.stringify(payload)}`);
    }

    /* Private */

    private filterEntities(
        trackedEntities: TrackedEntity[],
        programId: string,
        closureProgramId: string,
        programStagesIds: string[],
        timeOfReference: number,
        orgUnitsIds?: string[]
    ): TrackedEntity[] {
        const entitiesWithoutClosure = this.getEntitiesWithoutClosure(
            trackedEntities,
            programId,
            closureProgramId,
            orgUnitsIds
        );
        const filteredEntities = entitiesWithoutClosure.filter(entity => {
            const dates = this.getDatesByProgramStages(entity, programStagesIds);
            const occurredBefore = this.getRelativeDate(-timeOfReference).getTime();
            return dates && !_.isEmpty(dates) && Math.max(...dates, occurredBefore) === occurredBefore;
        });
        return filteredEntities;
    }

    private getEntitiesWithoutClosure(
        instances: TrackedEntity[],
        programId: string,
        closureProgramId: string,
        orgUnitsIds?: string[]
    ): TrackedEntity[] {
        return instances.flatMap(entity => {
            const enrollments = entity.enrollments.filter(({ orgUnit }) => orgUnitsIds?.includes(orgUnit));

            const enrollmentFromProgram = enrollments.find(enrollment => enrollment.program === programId);
            if (
                enrollmentFromProgram &&
                enrollmentFromProgram.status === "ACTIVE" &&
                !enrollmentFromProgram.events?.some(
                    event => event.programStage === closureProgramId && !event.deleted
                )
            )
                return [{ ...entity, enrollments: [enrollmentFromProgram] }];
            else return [];
        });
    }

    private mapPayload(entities: TrackedEntity[], options: MapPayloadOptions): ClosurePayload {
        const { programStagesIds, timeOfReference, pairsDeValue, closureProgramId, comments } = options;
        const enrollmentsWithLastDate = entities.flatMap(entity =>
            this.mapEnrollments(entity, programStagesIds)
        );
        const events = enrollmentsWithLastDate.flatMap(({ enrollment: e, lastConsultationDate: date }) =>
            this.mapEvents({
                enrollment: e,
                timeOfReference,
                pairsDeValue,
                closureProgramId,
                date: date ? date : undefined,
                comments,
            })
        );

        return {
            enrollments: enrollmentsWithLastDate.map(({ enrollment }) => enrollment),
            events: events,
        };
    }

    private getDatesByProgramStages(entity: TrackedEntity, programStagesIds: string[]) {
        return _.first(entity.enrollments)?.events?.flatMap(event =>
            programStagesIds.includes(event.programStage) && !event.deleted
                ? [new Date(event.occurredAt).getTime()]
                : []
        );
    }

    private mapEnrollments(entity: TrackedEntity, programStagesIds: string[]) {
        const e = _.first(entity.enrollments);
        if (!e) return [];
        const { orgUnit, program, trackedEntity, enrollment, enrolledAt, occurredAt } = e;
        const dates = e.events?.flatMap(event =>
            programStagesIds.includes(event.programStage) ? [new Date(event.occurredAt).getTime()] : []
        );
        return [
            {
                enrollment: {
                    orgUnit,
                    program,
                    trackedEntity,
                    enrollment,
                    enrolledAt,
                    occurredAt,
                    status: "COMPLETED" as const,
                },
                lastConsultationDate: dates && !_.isEmpty(dates) && Math.max(...dates),
            },
        ];
    }

    private mapEvents(options: MapEventsOptions) {
        const { enrollment: e, timeOfReference, pairsDeValue, closureProgramId, date, comments } = options;
        if (!date) return [];
        const ocurredAt = this.getRelativeDate(timeOfReference, date);
        const dataValues = pairsDeValue.map(([dataElement, value]) => ({ dataElement, value }));
        const [commentDe, commentValue] = comments ?? [];
        return [
            {
                status: "COMPLETED" as const,
                programStage: closureProgramId,
                enrollment: e.enrollment,
                orgUnit: e.orgUnit,
                occurredAt: ocurredAt.toISOString(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                dataValues:
                    commentDe && commentValue
                        ? [...dataValues, { dataElement: commentDe, value: commentValue }]
                        : dataValues,
            },
        ];
    }

    private getRelativeDate(timeOfReference: number, date?: number) {
        const relativeDate = date ? new Date(date) : new Date();
        relativeDate.setDate(relativeDate.getDate() + timeOfReference);
        return relativeDate;
    }
}

interface MapPayloadOptions {
    programStagesIds: string[];
    timeOfReference: number;
    pairsDeValue: Pair[];
    closureProgramId: string;
    comments?: Pair;
}

interface MapEventsOptions {
    enrollment: Enrollment;
    timeOfReference: number;
    pairsDeValue: Pair[];
    closureProgramId: string;
    date?: number;
    comments?: Pair;
}

export interface ClosePatientsOptions {
    orgUnitsIds?: Id[];
    startDate?: string;
    endDate?: string;
    programId: Id;
    programStagesIds: Id[];
    closureProgramId: Id;
    timeOfReference: number;
    pairsDeValue: Pair[];
    saveReportPath: string;
    comments?: Pair;
    post: boolean;
}
