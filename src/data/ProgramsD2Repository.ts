import _ from "lodash";
import { ClosePatientsOptions, ProgramsRepository } from "domain/repositories/ProgramsRepository";
import { Async } from "domain/entities/Async";
import { D2Api } from "types/d2-api";
import { log, Log } from "utils/log";

export class ProgramsD2Repository implements ProgramsRepository {
    constructor(private api: D2Api) {}

    //First of all we need the patients that don't have a closure

    async closePatients(options: ClosePatientsOptions): Async<void> {
        const {
            orgUnitsIds,
            period,
            programId,
            programStageIds,
            closureProgramId,
            timeOfReference,
            pairsDeValue,
            comments,
        } = options;

        const eventsByConsultationProgramStageFromTrackedEntitiesWithoutClosure$ = this.api
            .get<{ instances: { enrollment: string }[] }>("/tracker/events", {
                program: programId,
                programStage: closureProgramId,
                orgUnit: orgUnitsIds?.join(";"),
                ouMode: orgUnitsIds ? "SELECTED" : "ALL",
                totalPages: true,
            })
            .flatMap(({ data }) => {
                const enrollmentsWithClosure = data.instances.map(({ enrollment }) => enrollment);
                const trackedEntitiesWithoutClosure$ = this.api
                    .get<{ instances: { enrollment: string; trackedEntity: string }[] }>(
                        "/tracker/enrollments",
                        {
                            program: programId,
                            orgUnit: orgUnitsIds?.join(";"),
                            ouMode: orgUnitsIds ? "SELECTED" : "ALL",
                            totalPages: true,
                        }
                    )
                    .map(({ data }) => {
                        return data.instances
                            .filter(instance => !enrollmentsWithClosure.includes(instance.enrollment))
                            .map(instance => instance.trackedEntity);
                    });
                return trackedEntitiesWithoutClosure$;
            })
            .map(({ data }) =>
                Promise.all(
                    //Promise from each teiId with each promise
                    data.map(teiId =>
                        Promise.all(
                            //Promise from each event with teiId and each consultation program stage
                            programStageIds
                                .map(id =>
                                    this.api.get<{ instances: { enrollment: string }[] }>("/tracker/events", {
                                        program: programId,
                                        programStage: id,
                                        trackedEntity: teiId,
                                        orgUnit: orgUnitsIds?.join(";"),
                                        ouMode: orgUnitsIds ? "SELECTED" : "ALL",
                                        totalPages: true,
                                    })
                                )
                                .map(event$ => event$.getData())
                        )
                    )
                )
            );

        const eventsFromConsultationProgramStages$ = programStageIds.map(id =>
            this.api
                .get<{ instances: { enrollment: string; scheduledAt: string }[] }>("/tracker/events", {
                    program: programId,
                    programStage: id,
                    orgUnit: orgUnitsIds?.join(";"),
                    ouMode: orgUnitsIds ? "SELECTED" : "ALL",
                    totalPages: true,
                })
                .map(({ data }) => data.instances.map(instance => instance.scheduledAt))
        );

        const eventsFromConsultationProgramStages = Promise.all(
            eventsFromConsultationProgramStages$.map(event$ => event$.getData())
        );

        const events = eventsByConsultationProgramStageFromTrackedEntitiesWithoutClosure$.getData();
        events
            .then(p => p)
            .then(y => {
                log(
                    Log.fg.yellow,
                    "PRINTING EVENTS WITH SPECIFIC CONSULTATION PROGRAM STAGES OF EACH TRACKED ENTITY WITHOUT CLOSURES"
                );
                y.forEach(teiEvents =>
                    teiEvents.forEach(eventsByConsultationProgramStage =>
                        console.log(eventsByConsultationProgramStage)
                    )
                );
            });

        eventsFromConsultationProgramStages.then((y: any) => {
            log(Log.fg.yellow, "PRINTING EVENTS FROM CONSULTATION PROGRAM STAGES");
            console.log(y);
        });
    }

    private async getFromTracker(programIds: string[]) {
        const output = [];

        for (const programId of programIds) {
            let page = 1;
            let dataRemaining = true;

            while (dataRemaining) {
                // TODO: Implement in d2-api -> GET api.tracker.{events,enrollments,trackedEntities}
                const { instances } = await this.api
                    .get<{ instances: object[] }>(`/tracker/$$`, {
                        page,
                        pageSize: 10e3,
                        ouMode: "ALL",
                        fields: "*",
                        program: programId,
                    })
                    .getData();

                if (instances.length === 0) {
                    dataRemaining = false;
                } else {
                    output.push(...instances);
                    page++;
                }
            }
        }

        return output;
    }
}
