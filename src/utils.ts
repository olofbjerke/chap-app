import { effect, signal } from "@preact/signals";

export function sessionSignal<T>(name: string, initialValue: T, initializer?: (deserializedData: any) => T) {
    let storedValue = sessionStorage.getItem(name);
    if (storedValue) {
        try {
            initialValue = JSON.parse(storedValue);
        } catch (e) {
            initialValue = storedValue as any;
        }
    }

    let s = signal(initializer ? initializer(initialValue) : initialValue);

    effect(() => {
        sessionStorage.setItem(name, JSON.stringify(s.value));
    });

    return s;
}
