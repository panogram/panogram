global.jQuery = global.jquery = global.$ = global.$$ = require("jquery");
import * as raphael from "raphael";
global.Raphael = window.Raphael = raphael;

// export const { ViewerPedigree } = require("./main.bundle");
export { ViewerPedigree } from "./src/viewerPedigree";
