import { Id } from "./Base";

export interface TrackedEntity {
    trackedEntity: Id;
    trackedEntityType: Id;
    createdAt: ISODate;
    createdAtClient: ISODate;
    updatedAt: ISODate;
    updatedAtClient: ISODate;
    orgUnit: Id;
    inactive: boolean;
    deleted: boolean;
    potentialDuplicate: boolean;
    relationships: never[];
    attributes: Attribute[];
    enrollments: Enrollment[];
    programOwners: ProgramOwner[];
}

export interface Enrollment {
    enrollment: Id;
    createdAt?: ISODate;
    createdAtClient?: ISODate;
    updatedAt?: ISODate;
    updatedAtClient?: ISODate;
    trackedEntity: Id;
    program: Id;
    status: "ACTIVE" | "COMPLETED" | "CANCELLED";
    orgUnit: Id;
    orgUnitName?: string;
    enrolledAt: ISODate;
    occurredAt: ISODate;
    followUp?: boolean;
    deleted?: boolean;
    storedBy?: string;
    events?: Event[];
    relationships?: never[];
    attributes?: Attribute[];
    notes?: Note[];
}

interface ProgramOwner {
    orgUnit: Id;
    trackedEntity: Id;
    program: Id;
}

interface Event {
    event: Id;
    status: "ACTIVE" | "COMPLETED" | "VISITED" | "SCHEDULE" | "OVERDUE" | "SKIPPED";
    program: Id;
    programStage: Id;
    enrollment: Id;
    orgUnit: Id;
    orgUnitName: string;
    relationships: never[];
    occurredAt: ISODate;
    scheduledAt: ISODate;
    storedBy: string;
    followup: boolean;
    deleted: boolean;
    createdAt: ISODate;
    updatedAt: ISODate;
    attributeOptionCombo: Id;
    attributeCategoryOptions: Id;
    dataValues: DataValue[];
}

interface Attribute {
    attribute: Id;
    code?: string;
    displayName?: string;
    createdAt?: ISODate;
    updatedAt?: ISODate;
    storedBy?: string;
    valueType?: string;
    value?: string;
}

interface DataValue {
    dataElement: Id;
    value?: string;
    providedElsewhere?: boolean;
    createdAt?: ISODate;
    updatedAt?: ISODate;
    storedBy?: string;
}

interface Note {
    note?: Id;
    value: string;
    storedAt?: ISODate;
    updatedAt?: ISODate;
    storedBy?: string;
}

type ISODate = string; //ISO_8601;
