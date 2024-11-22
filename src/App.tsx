/* Import tauri dialog */
import { open } from "@tauri-apps/plugin-dialog";

import { batch, computed, effect, Signal, signal } from "@preact/signals";
import { useEffect, useRef } from "preact/hooks";
import { Command } from "@tauri-apps/plugin-shell";
import { writeFile, BaseDirectory } from "@tauri-apps/plugin-fs";
import "./App.css";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Menu, Submenu, MenuItem } from "@tauri-apps/api/menu";
import { basename, join, homeDir } from "@tauri-apps/api/path";
import { createRef, RefObject } from "preact";
import { listen } from "@tauri-apps/api/event";

let videoPlayer = createRef<HTMLVideoElement>();
const currentPath = signal(localStorage.getItem("currentPath") || "");
const metadata = signal(localStorage.getItem("metadata") || "");
const chaps: { time: number; title: string }[] = localStorage.getItem("chapters")
    ? JSON.parse(localStorage.getItem("chapters")!)
    : [];

let c = Math.round(Math.random() * 1000_000);
function id() {
    return "id-" + c++;
}

const chapters = signal<Chapter[]>(
    chaps.map((chap) => {
        return {
            time: chap.time,
            title: signal(chap.title),
            id: id(),
        };
    })
);

const sortedChapters = computed(() => {
    return chapters.value.slice().sort((a, b) => a.time - b.time);
});

interface Chapter {
    time: number;
    title: Signal<string>;
    id: string;
}

await buildAppMenu();

listen("tauri://drag-drop", (event: { payload: { paths?: string[] } }) => {
    let filePath = event.payload?.paths?.[0];
    if (filePath && filePath.endsWith(".mp4")) {
        loadFile(filePath);
    }
    console.log(event);
});

effect(() => {
    /* store current path in local storage */
    localStorage.setItem("currentPath", currentPath.value);
    localStorage.setItem("metadata", metadata.value);
    localStorage.setItem("chapters", JSON.stringify(chapters.value));
});

let path = computed(() => {
    let p = currentPath.value;
    if (!p) {
        return "";
    }

    return convertFileSrc(p);
});

const expectedFramerate = 30; // yourVideo's framerate

async function buildAppMenu() {
    let menu = await Menu.default();

    // Replace "File" menu
    await menu.removeAt(1);

    let sub = await Submenu.new({
        text: "File",
        items: [
            await MenuItem.new({
                text: "Open file",
                action: openFileDialog,
            }),
            await MenuItem.new({
                text: "Save",
                action: save,
            }),
        ],
    });

    menu.insert(sub, 1);
    menu.setAsAppMenu();
}

function App() {
    useEffect(() => {
        window.addEventListener("keypress", (ev) => {
            let video = videoPlayer.current;
            const target: { matches?: (arg0: string) => boolean } = ev.target as any;
            if (!video || target?.matches?.("input,button")) {
                return;
            }

            let d = keyToFrameCount(ev.key);

            if (d) {
                if (video.paused) video.currentTime += d / expectedFramerate;
            } else {
                togglePlayback();
            }

            ev.preventDefault();

            function togglePlayback() {
                video!.paused ? video!.play() : video!.pause();
            }
        });
    }, []);

    let controls = [
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
        <div class="apa"></div>

            <main>
                <div class="player">
                    <div class="current-path">{currentPath.value}</div>
                    <video ref={videoPlayer} src={path.value} controls></video>
                    <section class="controls">
                        {controls.map(([text, d]) => (
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
        case ",":
            return 5;
        case ".":
            return +5;
        case "?":
            return -10;
        case ":":
            return +10;
        case "<":
            return -1;
        case ">":
            return +1;
        case " ":
            return 0;
    }
}

function step(video: HTMLVideoElement, d: number) {
    video.pause();
    video.currentTime += d / expectedFramerate;
}

export default App;

function parseChaptersFromFFMpegMetadata(metadata: string): Chapter[] {
    const lines = metadata.split("\n");

    let chaptersRaw: { [key: string]: string }[] = [];

    [] = [];
    let current: { [key: string]: string } | null = null;

    for (const line of lines) {
        if (line.startsWith("[CHAPTER]")) {
            current = {};
            chaptersRaw.push(current);
            continue;
        }

        if (line.startsWith("[")) {
            current = null;
            continue;
        }

        if (line.startsWith("#")) {
            continue;
        }

        if (current) {
            const [name, value] = line.split("=");
            current[name] = value;
        }
    }

    return chaptersRaw.map((raw, i) => {
        let timebase = raw["TIMEBASE"] ?? "";
        let tb = 1 / 1_000_000_000;
        if (timebase.startsWith("1/")) {
            tb = 1 / parseFloat(timebase.substring(2));
        }

        const start = raw["START"];
        const title = raw["title"];

        return {
            time: start ? parseFloat(start) * tb : 0,
            title: signal(title ?? "Chapter " + (i + 1)),
            id: id(),
        };
    });
}

async function openFileDialog() {
    const file = await open({
        multiple: false,
        directory: false,
        filters: [{ name: "mp4", extensions: ["mp4"] }],
    });

    if (!file) {
        return;
    }

    loadFile(file);
}

async function loadFile(file: string) {
    let command = Command.create("ffmpeg", ["-i", file, "-f", "ffmetadata", "-"]);
    console.log(command);
    command.on("error", (data) => {
        console.error(data);
    });

    let metadataOutput = await command.execute();

    batch(() => {
        metadata.value = metadataOutput.stdout;
        currentPath.value = file;
        chapters.value = parseChaptersFromFFMpegMetadata(metadataOutput.stdout);
    });
}

function Sidebar({ video }: { video: RefObject<HTMLVideoElement> }) {
    return (
        <aside>
            <button
                class="add-chapter"
                onClick={async () => {
                    const latest = {
                        time: video.current!.currentTime,
                        title: signal("Chapter " + (chapters.value.length + 1)),
                        id: id(),
                    };

                    const newList = [...chapters.value, latest];
                    console.log(newList.map((chap) => chap.id).join(","));
                    chapters.value = newList;
                }}
            >
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

function Close() {
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
    useEffect(() => {
        console.log("chapter", chapter);

        if (chapter == chapters.value.at(-1)) {
            console.log("last", chapter);

            inputRef.current?.focus();
        }
    }, [chapter]);

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
                <Close />
            </button>
        </>
    );
}

async function save() {
    /* Convert to command: ffmpeg -i INPUT.mp4 -i <(echo "your ffmetadata string here") -map_metadata 1 -codec copy OUTPUT.mp4 */

    let c = sortedChapters.value;
    let withChapters = c.map((chapter, i) => {
        const startTime = Math.floor(chapter.time * 1000);
        let nextChapter = c[i + 1]?.time ?? videoPlayer.current?.duration;

        const endTime = nextChapter ? Math.floor((nextChapter - 1) * 1000) : Infinity;
        return toChapter(startTime, endTime, chapter.title.value);
    });
    let metadataStr = metadata.value + withChapters.join("");

    let f = await basename(currentPath.value);

    // const metadataFike = currentPath.value.replace(f, "new." + f);

    let encoder = new TextEncoder();
    let data = encoder.encode(metadataStr);
    await writeFile("ffmetadata.ffmetadata", data, { baseDir: BaseDirectory.Home });

    let metadataPath = await join(await homeDir(), "ffmetadata.ffmetadata");
    const outputFile = currentPath.value.replace(".mp4", ".chapters.mp4");
    let command = Command.create("ffmpeg", [
        "-y",
        "-i",
        currentPath.value,
        "-i",
        metadataPath,
        "-map_metadata",
        "1",
        "-codec",
        "copy",
        outputFile,
    ]);

    console.log(metadataPath, metadataStr);
    command.on("error", (data) => {
        console.error(data);
    });

    let metadataOutput = await command.execute();

    await Command.create("open", ["-R", outputFile]).execute();
}

function toChapter(start: number, end: number, title: string) {
    return `
[CHAPTER]
TIMEBASE=1/1000
START=${start}
END=${end}
title=${title}
`;
}
