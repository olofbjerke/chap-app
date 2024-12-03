import { effect, signal } from "@preact/signals";

export function sessionSignal<T>(name: string, initialValue: T, initializer?: (deserializedData: any) => T) {
    let s = createSessionSignal(name, initialValue, initializer);
    effect(() => {
        sessionStorage.setItem(name, JSON.stringify(s.value));
    });

    return s;
}

function createSessionSignal<T>(name: string, initialValue: T, initializer?: (deSerializedData: any) => T) {
    let value = sessionStorage.getItem(name);
    if (value) {
        try {
            initialValue = JSON.parse(value);
        } catch (e) {
            initialValue = value as any;
        }
    }

    return signal(initializer ? initializer(initialValue) : initialValue);
}

