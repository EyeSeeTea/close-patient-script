import _ from "lodash";
import {
    ApiGetResponse,
    ApiPostErrorResponse,
    ApiSaveResponse,
    ProgramsRepository,
    Payload,
} from "domain/repositories/ProgramsRepository";
import { Async } from "domain/entities/Async";
import { Id } from "domain/entities/Base";
import { Pair } from "scripts/common";
import { Enrollment, TrackedEntity } from "domain/entities/TrackedEntity";
import log from "utils/log";
import { CancelableResponse } from "@eyeseetea/d2-api";

export class ClosePatientsUseCase {
    constructor(private programsRepository: ProgramsRepository) {}

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
            comments,
            post,
        } = options;

        const payload$ = this.programsRepository
            .get({ programId, orgUnitsIds, startDate, endDate })
            .map(({ data }) => this.filterEntities(data, closureProgramId, programStagesIds, timeOfReference))
            .map(({ data }) =>
                this.mapPayload(data, {
                    programStagesIds,
                    timeOfReference,
                    pairsDeValue,
                    closureProgramId,
                    comments,
                })
            );

        const saveRequest$ = payload$.flatMap(({ data }) => this.programsRepository.save(data));
        if (post) this.makeRequest(saveRequest$, post);
        else this.makeRequest(payload$, post);
    }

    /* Private */

    private filterEntities(
        data: ApiGetResponse,
        closureProgramId: string,
        programStagesIds: string[],
        timeOfReference: number
    ): TrackedEntity[] {
        const entitiesWithoutClosure = this.getEntitiesWithoutClosure(data.instances, closureProgramId);
        const filteredEntities = entitiesWithoutClosure.filter(entity => {
            const dates = this.getDatesByProgramStages(entity, programStagesIds);
            const occurredBefore = this.getRelativeDate(-timeOfReference).getTime();
            return dates && !_.isEmpty(dates) && Math.max(...dates, occurredBefore) === occurredBefore;
        });
        return filteredEntities;
    }

    private getEntitiesWithoutClosure(instances: TrackedEntity[], closureProgramId: string): TrackedEntity[] {
        return instances.filter(entity => {
            const enrollment = _.first(entity.enrollments);
            return (
                enrollment &&
                enrollment.status !== "COMPLETED" &&
                !enrollment.events?.some(event => event.programStage === closureProgramId && !event.deleted)
            );
        });
    }

    private mapPayload(entities: TrackedEntity[], options: MapPayloadOptions): Payload {
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

    private makeRequest(request$: CancelableResponse<ApiSaveResponse | Payload>, post: boolean) {
        request$
            .getData()
            .then(res =>
                log.info(
                    post
                        ? `Closed patients: enrollments and closure events: ${JSON.stringify(
                              (res as ApiSaveResponse).stats
                          )}`
                        : `Payload: ${JSON.stringify(res as Payload)}`
                )
            )
            .catch((res: ApiPostErrorResponse) => {
                const { data } = res.response;
                if (data.status !== "OK") {
                    log.error(
                        post
                            ? `POST /tracker: ${
                                  data.validationReport
                                      ? JSON.stringify(
                                            data.validationReport?.errorReports
                                                ?.map(({ message }) => message)
                                                .join("\n")
                                        )
                                      : data.message || "Unknown error"
                              }`
                            : `GET /tracker/trackedEntities: ${data.message || "Unknown error"}`
                    );
                }
            });
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
    comments?: Pair;
    post: boolean;
}
