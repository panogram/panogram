import { ProbandDataLoader } from "./saveLoadEngine";
import { SaveLoadEngine } from "./saveLoadEngine";


export const ViewerProbandDataLoader = Class.create(ProbandDataLoader, {
    initialize: function(probandDataUrl) {
        this._probandDataUrl = probandDataUrl;
        this.probandData = undefined;
    },
    load: function(callWhenReady) {
    }
});


export const ViewerSaveLoadEngine = Class.create(SaveLoadEngine, {

    initialize: function(pedigreeDataUrl) {
        this._pedigreeDataUrl = pedigreeDataUrl;
        this._saveInProgress = false;
    },
    load: function() {
        console.log("initiating load process");
    }
});
