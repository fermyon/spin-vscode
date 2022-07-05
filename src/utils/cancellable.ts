export interface Accepted<T> {
    readonly accepted: true;
    readonly value: T;
}

export interface Cancelled {
    readonly accepted: false;
}

export type Cancellable<T> = Accepted<T> | Cancelled;

export function isAccepted<T>(c: Cancellable<T>): c is Accepted<T> {
    return c.accepted;
}

export function isCancelled<T>(c: Cancellable<T>): c is Cancelled {
    return !c.accepted;
}

export function accepted<T>(value: T): Cancellable<T> {
    return { accepted: true, value };
}

export function cancelled(): Cancelled {
    return { accepted: false };
}
