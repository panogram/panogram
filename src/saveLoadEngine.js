import { stringifyObject, unescapeRestData, getSubSelectorTextFromXML } from "./helpers";
import { TemplateSelector } from "./templateSelector";
/**
 * SaveLoadEngine is responsible for automatic and manual save and load operations.
 *
 * @class SaveLoadEngine
 * @constructor
 */

export const ProbandDataLoader = Class.create( {
    initialize: function() {
        this.probandData = undefined;
    },
    load: function(callWhenReady) {
        new Ajax.Request("public/xwiki/PhenoTips.PatientClass/0.xml", {
            method: "GET",
            onSuccess: this.onProbandDataReady.bind(this),
            onComplete: callWhenReady ? callWhenReady : {}
        });
    },

    onProbandDataReady : function(response) {
        var responseXML = response.responseXML;  //documentElement.
        this.probandData = {};
        this.probandData.firstName = unescapeRestData(getSubSelectorTextFromXML(responseXML, "property", "name", "first_name", "value"));
        this.probandData.lastName  = unescapeRestData(getSubSelectorTextFromXML(responseXML, "property", "name", "last_name", "value"));
        this.probandData.gender    = unescapeRestData(getSubSelectorTextFromXML(responseXML, "property", "name", "gender", "value"));
        if (this.probandData.gender === undefined || this.probandData.gender == "")
            this.probandData.gender = "U";
        console.log("Proband data: " + stringifyObject(this.probandData));
    },
});


export const SaveLoadEngine = Class.create( {

    initialize: function() {
        this._saveInProgress = false;
    },

    /**
     * Saves the state of the graph
     *
     * @return Serialization data for the entire graph
     */
    serialize: function() {
        return editor.getGraph().toJSON();
    },

    createGraphFromSerializedData: function(JSONString, noUndo, centerAround0) {
        console.log("---- load: parsing data ----");
        console.log(JSONString);
        document.fire("pedigree:load:start");

        try {
            var changeSet = editor.getGraph().fromJSON(JSONString);
        }
        catch(err)
        {
            console.log("ERROR loading the graph: " + err);
            console.warn("Error loading the graph");
            document.fire("pedigree:graph:clear");
            document.fire("pedigree:load:finish");
            return;
        }

        if (!noUndo) {
            var probandData = editor.getProbandDataFromPhenotips();
            if ( probandData ) {
              var genderOk = editor.getGraph().setProbandData( probandData.firstName, probandData.lastName, probandData.gender );
              if (!genderOk)
                  console.warn("Proband gender defined in Phenotips is incompatible with this pedigree. Setting proband gender to 'Unknown'");
            }

            JSONString = editor.getGraph().toJSON();
        }

        if (editor.getView().applyChanges(changeSet, false)) {
            editor.getWorkspace().adjustSizeToScreen();
        }

        if (centerAround0)
            editor.getWorkspace().centerAroundNode(0);

        if (!noUndo)
            editor.getActionStack().addState(null, null, JSONString);

        document.fire("pedigree:load:finish");
    },

    createGraphFromImportData: function(importString, importType, importOptions, noUndo, centerAround0) {
        let JSONString;
        console.log("---- import: parsing data ----");
        document.fire("pedigree:load:start");

        try {
            var changeSet = editor.getGraph().fromImport(importString, importType, importOptions);
            if (changeSet == null) throw "unable to create a pedigree from imported data";
        }
        catch(err)
        {
            console.warn("Error importing pedigree: " + err);
            document.fire("pedigree:load:finish");
            return;
        }

        if (!noUndo) {
            var probandData = editor.getProbandDataFromPhenotips();
            if ( probandData ) {
                var genderOk = editor.getGraph().setProbandData( probandData.firstName, probandData.lastName, probandData.gender );
                if (!genderOk)
                    console.warn("Proband gender defined in Phenotips is incompatible with this pedigree. Setting proband gender to 'Unknown'");
            }            
            JSONString = editor.getGraph().toJSON();
        }

        if (editor.getView().applyChanges(changeSet, false)) {
            editor.getWorkspace().adjustSizeToScreen();
        }

        if (centerAround0)
            editor.getWorkspace().centerAroundNode(0);

        if (!noUndo)
            editor.getActionStack().addState(null, null, JSONString);

        document.fire("pedigree:load:finish");
    },

    save: function() {
        if (this._saveInProgress)
            return;   // Don't send parallel save requests

        var me = this;

        var jsonData = this.serialize();

        console.log("[SAVE] data: " + stringifyObject(jsonData));

        var image = $("canvas");
        var background = image.getElementsByClassName("panning-background")[0];
        var backgroundPosition = background.nextSibling;
        var backgroundParent =  background.parentNode;
        backgroundParent.removeChild(background);
        var bbox = image.down().getBBox();
        new Ajax.Request("public/xwiki/PhenoTips.PedigreeClass/0.xml", {
            method: "POST",
            onCreate: function() {
                me._saveInProgress = true;
            },
            onComplete: function() {
                me._saveInProgress = false;
            },
            onSuccess: function() { console.log("saved"); },
            parameters: {"property#data": jsonData, "property#image": image.innerHTML.replace(/xmlns:xlink=".*?"/, "").replace(/width=".*?"/, "").replace(/height=".*?"/, "").replace(/viewBox=".*?"/, "viewBox=\"" + bbox.x + " " + bbox.y + " " + bbox.width + " " + bbox.height + "\" width=\"" + bbox.width + "\" height=\"" + bbox.height + "\" xmlns:xlink=\"http://www.w3.org/1999/xlink\"")}
        });
        backgroundParent.insertBefore(background, backgroundPosition);
    },

    load: function() {
        console.log("initiating load process");

        new Ajax.Request("public/xwiki/PhenoTips.PedigreeClass/0.xml", {
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
