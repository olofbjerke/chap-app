import { signal, batch, computed, Signal } from "@preact/signals";
import { convertFileSrc } from "@tauri-apps/api/core";
import { createRef } from "preact";
import { join, tempDir } from "@tauri-apps/api/path";
import { writeFile, BaseDirectory } from "@tauri-apps/plugin-fs";
import { ChildProcess, Command } from "@tauri-apps/plugin-shell";
import { open } from "@tauri-apps/plugin-dialog";
import { sessionSignal } from "./utils";

let startId = Math.round(Math.random() * 1000_000);
export const videoPlayer = createRef<HTMLVideoElement>();

export const currentPath = sessionSignal("currentPath", "");
export const metadata = sessionSignal("metadata", "");
export const metadataRaw = sessionSignal("metadataRaw", "");
export const debug = sessionSignal("debug", false);
export const chapters = sessionSignal<Chapter[]>(
    "chapters",
    [],
    (savedChapters: { time: number; title: string }[]) => {
        return savedChapters.map((chap) => {
            return {
                time: chap.time,
                title: signal(chap.title),
                id: id(),
            };
        });
    }
);

export let path = computed(() => {
    let p = currentPath.value;
    if (!p) {
        return "";
    }

    return convertFileSrc(p);
});

export const sortedChapters = computed(() => {
    return chapters.value.slice().sort((a, b) => a.time - b.time);
});

export const newMetadata = computed(() => {
    let c = sortedChapters.value;
    let ffmpegFormattedChapters = c.map((chapter, i) => {
        const startTime = Math.floor(chapter.time * 1000);
        let nextChapter = c[i + 1]?.time ?? videoPlayer.current?.duration;

        const endTime = nextChapter ? Math.floor((nextChapter - 1) * 1000) : Infinity;
        return toChapter(startTime, endTime, chapter.title.value);
    });

    return metadata.value + ffmpegFormattedChapters.join("");
});

function id() {
    return "id-" + startId++;
}

export function addChapterAtCurrentTime() {
    const latest = {
        time: videoPlayer.current!.currentTime,
        title: signal("Chapter " + (chapters.value.length + 1)),
        id: id(),
    };

    const newList = [...chapters.value, latest];
    chapters.value = newList;
}

export async function openFileDialog() {
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

export async function loadFile(file: string) {
    let metadataOutput = await cmd("ffmpeg", ["-i", file, "-f", "ffmetadata", "-"]);

    batch(() => {
        metadataRaw.value = metadataOutput.stdout;
        metadata.value = stripChaptersFromFFMpegMetadata(metadataOutput.stdout);
        currentPath.value = file;
        chapters.value = parseChaptersFromFFMpegMetadata(metadataOutput.stdout);
    });
}

function stripChaptersFromFFMpegMetadata(metadata: string): string {
    if (!metadata.includes("[CHAPTER]")) {
        return metadata;
    }

    let chapterIndex = metadata.indexOf("[CHAPTER]");
    let strippedResult = metadata.substring(0, chapterIndex);
    let rest = metadata.substring(chapterIndex).replaceAll("[CHAPTER]", "");

    let otherMarkers = rest.match(/\[(\w*)\]/g);

    if (otherMarkers) {
        return strippedResult + rest.substring(rest.indexOf(otherMarkers[0]));
    }

    return strippedResult;
}

function parseChaptersFromFFMpegMetadata(metadata: string): Chapter[] {
    const lines = metadata.split("\n");

    let chaptersRaw: { [key: string]: string }[] = [];
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

export async function save() {
    let encoder = new TextEncoder();
    let data = encoder.encode(newMetadata.value);
    const metadataFileName = "chap-app-ffmetadata.ffmetadata";
    await writeFile(metadataFileName, data, { baseDir: BaseDirectory.Temp });

    let i = Math.round(Math.random() * 1000_000);
    let metadataPath = await join(await tempDir(), metadataFileName);
    let tempOutputPath = await join(await tempDir(), `chap-app-output-${i}.mp4`);

    await cmd("ffmpeg", [
        "-i",
        metadataPath,
        "-i",
        currentPath.value,
        "-map",
        "1",
        "-map_metadata",
        "0",
        "-codec",
        "copy",
        tempOutputPath,
    ]);

    await cmd("mv", ["-f", tempOutputPath, currentPath.value]);
    await cmd("open", ["-R", currentPath.value]);
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

export interface Chapter {
    time: number;
    title: Signal<string>;
    id: string;
}

function cmd(cmd: string, args: string[]) {
    return new Promise<ChildProcess<string>>((resolve, reject) => {
        let command = Command.create(cmd, args);
        command.on("error", (data) => {
            console.error(data);
            reject(data);
        });

        command.on("close", (code) => {
            if (code.code !== 0 || code.signal !== null) {
                reject(code);
                return;
            }

            console.log("Close", cmd, args, code);
        });

        command.execute().then((v) => {
            console.log("resolve command", cmd, args, v);

            resolve(v);
        });
    });
}
