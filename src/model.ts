import { signal, batch, computed, Signal, effect } from "@preact/signals";
import { convertFileSrc } from "@tauri-apps/api/core";
import { createRef } from "preact";
import { join, homeDir, tempDir } from "@tauri-apps/api/path";
import { writeFile, BaseDirectory } from "@tauri-apps/plugin-fs";
import { ChildProcess, Command } from "@tauri-apps/plugin-shell";
import { open } from "@tauri-apps/plugin-dialog";

export const videoPlayer = createRef<HTMLVideoElement>();

export const currentPath = signal(sessionStorage.getItem("currentPath") || "");
export const metadata = signal(sessionStorage.getItem("metadata") || "");
const savedChapters: { time: number; title: string }[] = sessionStorage.getItem("chapters")
    ? JSON.parse(sessionStorage.getItem("chapters")!)
    : [];

export const chapters = signal<Chapter[]>(
    savedChapters.map((chap) => {
        return {
            time: chap.time,
            title: signal(chap.title),
            id: id(),
        };
    })
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

effect(() => {
    /* store current path in local storage */
    sessionStorage.setItem("currentPath", currentPath.value);
    sessionStorage.setItem("metadata", metadata.value);
    sessionStorage.setItem("chapters", JSON.stringify(chapters.value));
});

let startId = Math.round(Math.random() * 1000_000);
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
    let metadataOutput = await cmd("ffmpeg", ["-iassadasdas", file, "-f", "ffmetadata", "-"]);

    batch(() => {
        metadata.value = metadataOutput.stdout;
        currentPath.value = file;
        chapters.value = parseChaptersFromFFMpegMetadata(metadataOutput.stdout);
    });
}

export async function save() {
    let c = sortedChapters.value;
    let ffmpegFormattedChapters = c.map((chapter, i) => {
        const startTime = Math.floor(chapter.time * 1000);
        let nextChapter = c[i + 1]?.time ?? videoPlayer.current?.duration;

        const endTime = nextChapter ? Math.floor((nextChapter - 1) * 1000) : Infinity;
        return toChapter(startTime, endTime, chapter.title.value);
    });

    let metadataStr = metadata.value + ffmpegFormattedChapters.join("");

    let encoder = new TextEncoder();
    let data = encoder.encode(metadataStr);
    await writeFile("ffmetadata.ffmetadata", data, { baseDir: BaseDirectory.Temp });

    let metadataPath = await join(await tempDir(), "ffmetadata.ffmetadata");
    let tempOutputPath = await join(await tempDir(), "output.mp4");
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
        tempOutputPath,
    ]);

    console.log(tempOutputPath);

    command.on("error", (data) => {
        console.error(data);
    });

    await command.execute();

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
