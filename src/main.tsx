import { render } from "preact";
import App from "./App";
import { initMenu } from "./menu";

initMenu();
render(<App />, document.body);
