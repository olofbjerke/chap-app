import { Menu, MenuItem, Submenu } from "@tauri-apps/api/menu";
import { listen } from "@tauri-apps/api/event";
import { loadFile, openFileDialog, save } from "./model";

export function initMenu() {
    
    buildAppMenu();
    listen("tauri://drag-drop", (event: { payload: { paths?: string[] } }) => {
        let filePath = event.payload?.paths?.[0];
        if (filePath && filePath.endsWith(".mp4")) {
            loadFile(filePath);
        }
    });

    /** Quick and dirty way to modify the default menu bar to support opening and saving files */
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
}
