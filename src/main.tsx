import { Menu, MenuItem, Submenu } from "@tauri-apps/api/menu";
import { listen } from "@tauri-apps/api/event";

import { render } from "preact";
import { loadFile, openFileDialog, save } from "./model";
import App from "./App";

await buildAppMenu();

listen("tauri://drag-drop", (event: { payload: { paths?: string[] } }) => {
    let filePath = event.payload?.paths?.[0];
    if (filePath && filePath.endsWith(".mp4")) {
        loadFile(filePath);
    }
});

render(<App />, document.body);

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
