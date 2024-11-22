import { useComputed, useSignal } from "@preact/signals";
import "./powerButton.css";
export function PowerButton({ small , active, onClick }: {  small?: boolean, active: boolean; onClick: (active: boolean) => void }) {
    let mouseDown = useSignal("mainRect");
    let mouseDownClass = useComputed(() => mouseDown.value + " mainRect");
    
    const svg = (
        <svg viewBox="0 0 24 24" fill="none">
            <path
                fill-rule="evenodd"
                clip-rule="evenodd"
                d="M13 3C13 2.44772 12.5523 2 12 2C11.4477 2 11 2.44772 11 3V12C11 12.5523 11.4477 13 12 13C12.5523 13 13 12.5523 13 12V3ZM8.6092 5.8744C9.09211 5.60643 9.26636 4.99771 8.99839 4.5148C8.73042 4.03188 8.12171 3.85763 7.63879 4.1256C4.87453 5.65948 3 8.61014 3 12C3 16.9706 7.02944 21 12 21C16.9706 21 21 16.9706 21 12C21 8.66747 19.1882 5.75928 16.5007 4.20465C16.0227 3.92811 15.4109 4.09147 15.1344 4.56953C14.8579 5.04759 15.0212 5.65932 15.4993 5.93586C17.5942 7.14771 19 9.41027 19 12C19 15.866 15.866 19 12 19C8.13401 19 5 15.866 5 12C5 9.3658 6.45462 7.06997 8.6092 5.8744Z"
            />
        </svg>
    );
    
    return (
        <button
            onClick={() => onClick(!active)}
            class={mouseDownClass.value + (small ? " small" : "") + (active ? " active" : "")}
            onMouseDown={() => (mouseDown.value = "active")}
            onTransitionEnd={() => (mouseDown.value = "")}
            id="toggleButton"
        >
            <div class="innerCircle">
                <div class="innerCircle2">
                    <i class="icon1">{svg}</i>
                    <i class="icon2">{svg}</i>
                </div>
            </div>
        </button>
    );
}
