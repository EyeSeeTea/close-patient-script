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

        const trackedEntitiesWithoutClosure$ = this.api
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
            });
        // //the use case is automatically closing "lost to follow-up" patients    //each tei is a patient. with type sD7b8KtOogp
        // // const z = this.api.get("/programs/ORvg6A5ed7z", {});
        // // z.getData().then((y: any) => console.log(y));
        // const enrollments$ = this.api
        //     .get<{ instances: object[] }>("/tracker/enrollments", {
        //         program: programId,
        //         orgUnit: orgUnitsIds?.join(";"),
        //         ouMode: orgUnitsIds ? "SELECTED" : "ALL",
        //         totalPages: true,
        //     })
        //     .map(({ data }) => {
        //         return data.instances;
        //     });
        // const patients$ = this.api
        //     .get<{ instances: object[] }>("/tracker/trackedEntities", {
        //         program: programId,
        //         orgUnit: orgUnitsIds?.join(";"),
        //         ouMode: orgUnitsIds ? "SELECTED" : "ALL",
        //         totalPages: true,
        //     })
        //     .map(({ data }) => {
        //         return data.instances;
        //     });

        // const enrollments$ = this.api.get("/tracker/enrollments", {
        //     // trackedEntityType: "sD7b8KtOogp",
        //     program: "ORvg6A5ed7z",
        //     // programStage: "XuThsezwYbZ",
        //     // ouMode: "ALL",
        //     orgUnit: "bDx6cyWahq4",
        // });
        trackedEntitiesWithoutClosure$.getData().then((y: any) => {
            log(Log.fg.yellow, "PRINTING TRACKED ENTITIES WITHOUT CLOSURES");
            console.log(y);
        });
        // patients$.getData().then((y: any) => {
        //     log(Log.fg.yellow, "PRINTING PATIENTS");
        //     console.log(y);
        // });
        // closures$.getData().then((y: any) => {
        //     log(Log.fg.yellow, "PRINTING CLOSURES");
        //     console.log(y);
        // });
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
