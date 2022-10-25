import _ from "lodash";
import { ClosePatientsOptions, ProgramsRepository } from "domain/repositories/ProgramsRepository";
import { Async } from "domain/entities/Async";
import { D2Api } from "types/d2-api";
import { TrackedEntity } from "domain/entities/TrackedEntity";

export class ProgramsD2Repository implements ProgramsRepository {
    constructor(private api: D2Api) {}

    async closePatients(options: ClosePatientsOptions): Async<void> {
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
        } = options;

        const daysOfReference = parseInt(timeOfReference);
        if (_.isNaN(daysOfReference)) throw new Error("Time of reference must be a number");

        const filteredEntities$ = this.api
            .get<ApiResponse>("/tracker/trackedEntities", {
                program: programId,
                orgUnit: orgUnitsIds?.join(";"),
                ouMode: orgUnitsIds ? "SELECTED" : "ALL",
                enrollmentOccurredAfter: startDate,
                enrollmentOccurredBefore: endDate,
                fields: "*,enrollments[*]",
                skipPaging: true,
            })
            .map(({ data }) => {
                const teisWithoutClosure = data.instances.filter(tei => {
                    const enrollment = _.first(tei.enrollments);
                    if (!enrollment) return;
                    return (
                        enrollment.status !== "COMPLETED" &&
                        !enrollment.events.some(
                            event => event.programStage === closureProgramId && !event.deleted
                        )
                    );
                });
                const filteredEntities = teisWithoutClosure.filter(tei => {
                    const dates = _.first(tei.enrollments)?.events.flatMap(event =>
                        programStagesIds.includes(event.programStage)
                            ? [new Date(event.occurredAt).getTime()]
                            : []
                    );
                    const currentDate = new Date();
                    currentDate.setDate(currentDate.getDate() - daysOfReference);
                    const occurredBefore = currentDate.getTime();
                    return (
                        dates &&
                        !_.isEmpty(dates) &&
                        Math.max(Math.max(...dates), occurredBefore) === occurredBefore
                    );
                });
                return filteredEntities;
            });

        const createClosureProgramsAndCompleteEnrollments$ = filteredEntities$.flatMap(({ data: teis }) => {
            const enrollmentsWithLastDate = teis.flatMap(tei => {
                const e = _.first(tei.enrollments);
                if (!e) return [];
                const { orgUnit, program, trackedEntity, enrollment, enrolledAt } = e;
                const dates = e.events.flatMap(event =>
                    programStagesIds.includes(event.programStage)
                        ? [new Date(event.occurredAt).getTime()]
                        : []
                );
                return [
                    {
                        enrollment: {
                            orgUnit,
                            program,
                            trackedEntity,
                            enrollment,
                            enrolledAt,
                            status: "COMPLETED",
                        },
                        lastConsultationDate: dates && !_.isEmpty(dates) && Math.max(...dates),
                    },
                ];
            });

            const events = enrollmentsWithLastDate.flatMap(
                ({ enrollment: e, lastConsultationDate: date }) => {
                    if (!date) return [];
                    const ocurredAt = new Date(date);
                    ocurredAt.setDate(ocurredAt.getDate() + daysOfReference);
                    return [
                        {
                            status: e.status,
                            programStage: closureProgramId,
                            enrollment: e.enrollment,
                            orgUnit: e.orgUnit,
                            occurredAt: ocurredAt.toISOString(),
                            dataValues: pairsDeValue.map(([dataElement, value]) => ({ dataElement, value })),
                            notes: [{ value: comments }],
                        },
                    ];
                }
            );

            return this.api.post<{ stats: object }>(
                "/tracker",
                { async: false },
                { enrollments: enrollmentsWithLastDate.map(({ enrollment }) => enrollment), events: events }
            );
        });

        createClosureProgramsAndCompleteEnrollments$.getData().then(res => {
            console.log(res.stats);
        });
    }
}

interface ApiResponse {
    instances: TrackedEntity[];
}
