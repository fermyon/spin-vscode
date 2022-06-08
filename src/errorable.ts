export interface Ok<T> {
    readonly succeeded: true;
    readonly value: T;
}

export interface Err {
    readonly succeeded: false;
    readonly message: string;
}

export type Errorable<T> = Ok<T> | Err;

export function ok<T>(value: T): Errorable<T> {
    return { succeeded: true, value };
}

export function err<T>(message: string): Errorable<T> {
    return { succeeded: false, message };
}

export function isErr<T>(obj: Errorable<T>): obj is Err {
    return !obj.succeeded;
}

export function isOk<T>(obj: Errorable<T>): obj is Ok<T> {
    return obj.succeeded;
}

export function map<T, U>(self: Errorable<T>, f: (t: T) => U): Errorable<U> {
    if (isOk(self)) {
        return ok(f(self.value));
    }
    return self;
}

export async function mapAsync<T, U>(self: Promise<Errorable<T>>, f: (t: T) => U): Promise<Errorable<U>> {
    return await map(await self, f);
}
