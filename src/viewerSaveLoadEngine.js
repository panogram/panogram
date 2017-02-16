import { ProbandDataLoader } from "./saveLoadEngine";
import { SaveLoadEngine } from "./saveLoadEngine";
import { stringifyObject, getSubSelectorTextFromXML, unescapeRestData } from "./helpers";
import { TemplateSelector } from "./templateSelector";


export const ViewerProbandDataLoader = Class.create(ProbandDataLoader, {
    initialize: function(probandDataUrl) {
        this._probandDataUrl = probandDataUrl;
        this.probandData = undefined;
    },
    load: function(callWhenReady) {
        new Ajax.Request(this._probandDataUrl, {
            method: "GET",
            onSuccess: this.onProbandDataReady.bind(this),
            onComplete: callWhenReady ? callWhenReady : {}
        });
    }
});


export const ViewerSaveLoadEngine = Class.create(SaveLoadEngine, {

    initialize: function(pedigreeDataUrl) {
        this._pedigreeDataUrl = pedigreeDataUrl;
        this._saveInProgress = false;
    },
    load: function() {
        console.log("initiating load process");

        new Ajax.Request(this._pedigreeDataUrl, {
            method: "GET",
            onCreate: function() {
                document.fire("pedigree:load:start");
            },
            onSuccess: function (response) {
                //console.log("Data from LOAD: " + stringifyObject(response));
                //console.log("[Data from LOAD]");
                var rawdata  = getSubSelectorTextFromXML(response.responseXML, "property", "name", "data", "value");
                var jsonData = unescapeRestData(rawdata);
                if (jsonData.trim()) {
                    console.log("[LOAD] recived JSON: " + stringifyObject(jsonData));

                    jsonData = editor.getVersionUpdater().updateToCurrentVersion(jsonData);

                    this.createGraphFromSerializedData(jsonData);
                } else {
                    new TemplateSelector(true);
                }
            }.bind(this)
        });
    }
});
