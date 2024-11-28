import { useEffect, useRef } from "preact/hooks";
import { RefObject } from "preact";

import "./App.css";
import { addChapterAtCurrentTime, Chapter, chapters, currentPath, path, sortedChapters, videoPlayer } from "./model";

const expectedFramerate = 30;

export default function App() {
    useEffect(() => {
        window.addEventListener("keypress", keyPressHandler);

        return () => {
            window.removeEventListener("keypress", keyPressHandler);
        };

        function keyPressHandler(ev: KeyboardEvent): void {
            let video = videoPlayer.current;
            const target: { matches?: (arg0: string) => boolean } = ev.target as any;
            if (!video || target?.matches?.("input,button")) {
                return;
            }

            ev.preventDefault();

            if (ev.key === "a") {
                addChapterAtCurrentTime();
                return;
            }

            let frameCount = keyToFrameCount(ev.key);

            if (frameCount) {
                video.currentTime += frameCount / expectedFramerate;
            } else {
                togglePlayback();
            }

            function togglePlayback() {
                video!.paused ? video!.play() : video!.pause();
            }
        }
    }, []);

    let controlButtons = [
        ["<<<", -1000],
        ["<<", -30],
        ["<", -1],
        [">", 1],
        [">>", 30],
        [">>>", 1000],
    ] as const;

    return (
        <>
            <Sidebar video={videoPlayer} />
            <div aria-hidden="true" class="bg"></div>
            <main>
                <div class="player">
                    <div title={"Current path: " + currentPath.value} class="current-path">
                        {currentPath.value}
                    </div>
                    <video ref={videoPlayer} src={path.value} controls></video>
                    <section class="controls">
                        {controlButtons.map(([text, d]) => (
                            <button
                                onClick={async () => {
                                    let video = videoPlayer.current;
                                    if (!video) {
                                        return;
                                    }

                                    step(video, d);
                                }}
                            >
                                {text}
                            </button>
                        ))}
                    </section>
                </div>
            </main>
        </>
    );
}

function keyToFrameCount(key: string) {
    switch (key) {
        case "d":
            return -15;
        case "k":
            return +15;
        case "f":
            return -5;
        case "j":
            return +5;
        case "g":
            return -1;
        case "h":
            return +1;
        case " ":
            return 0;
    }
}

function step(video: HTMLVideoElement, d: number) {
    video.pause();
    video.currentTime += d / expectedFramerate;
}

function Sidebar({ video }: { video: RefObject<HTMLVideoElement> }) {
    return (
        <aside>
            <button class="add-chapter" onClick={addChapterAtCurrentTime}>
                Add chapter
            </button>
            <ul class="chapters">
                {sortedChapters.value.map((chapter) => {
                    return (
                        <li
                            key={chapter.id}
                            onClick={() => {
                                video.current!.currentTime = chapter.time;
                            }}
                        >
                            <EditableChapter key={chapter.id} chapter={chapter} />
                        </li>
                    );
                })}
            </ul>
        </aside>
    );
}

function CloseIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none">
            <path
                d="M8.00386 9.41816C7.61333 9.02763 7.61334 8.39447 8.00386 8.00395C8.39438 7.61342 9.02755 7.61342 9.41807 8.00395L12.0057 10.5916L14.5907 8.00657C14.9813 7.61605 15.6144 7.61605 16.0049 8.00657C16.3955 8.3971 16.3955 9.03026 16.0049 9.42079L13.4199 12.0058L16.0039 14.5897C16.3944 14.9803 16.3944 15.6134 16.0039 16.0039C15.6133 16.3945 14.9802 16.3945 14.5896 16.0039L12.0057 13.42L9.42097 16.0048C9.03045 16.3953 8.39728 16.3953 8.00676 16.0048C7.61624 15.6142 7.61624 14.9811 8.00676 14.5905L10.5915 12.0058L8.00386 9.41816Z"
                fill="currentColor"
            />
            <path
                fill-rule="evenodd"
                clip-rule="evenodd"
                d="M23 12C23 18.0751 18.0751 23 12 23C5.92487 23 1 18.0751 1 12C1 5.92487 5.92487 1 12 1C18.0751 1 23 5.92487 23 12ZM3.00683 12C3.00683 16.9668 7.03321 20.9932 12 20.9932C16.9668 20.9932 20.9932 16.9668 20.9932 12C20.9932 7.03321 16.9668 3.00683 12 3.00683C7.03321 3.00683 3.00683 7.03321 3.00683 12Z"
                fill="currentColor"
            />
        </svg>
    );
}

function EditableChapter({ chapter }: { chapter: Chapter }) {
    const inputRef = useRef<HTMLInputElement>(null);
    useEffect(
        function focusInputOnMount() {
            if (chapter == chapters.value.at(-1)) {
                inputRef.current?.focus();
            }
        },
        [chapter]
    );

    return (
        <>
            <input
                ref={inputRef}
                onInput={(e) => {
                    chapter.title.value = e.currentTarget.value;
                }}
                value={chapter.title}
            />
            <button
                class={"remove"}
                onClick={() => {
                    chapters.value = chapters.value.filter((chap) => chap !== chapter);
                }}
            >
                <CloseIcon />
            </button>
        </>
    );
}
