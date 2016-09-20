function unescapeRestData (data) {
    // http://stackoverflow.com/questions/4480757/how-do-i-unescape-html-entities-in-js-change-lt-to
    var tempNode = document.createElement('div');
    tempNode.innerHTML = data.replace(/&amp;/, '&');
    return tempNode.innerText || tempNode.text || tempNode.textContent;
}

function getSelectorFromXML(responseXML, selectorName, attributeName, attributeValue) {
    if (responseXML.querySelector) {
        // modern browsers
        return responseXML.querySelector(selectorName + "[" + attributeName + "='" + attributeValue + "']");
    } else {
        // IE7 && IE8 && some other older browsers
        // http://www.w3schools.com/XPath/xpath_syntax.asp
        // http://msdn.microsoft.com/en-us/library/ms757846%28v=vs.85%29.aspx
        var query = "//" + selectorName + "[@" + attributeName + "='" + attributeValue + "']";
        try {
            return responseXML.selectSingleNode(query);
        } catch (e) {
            // Firefox v3.0-
            alert("your browser is unsupported");
            window.stop && window.stop();
            throw "Unsupported browser";
        }
    }
}

function getSubSelectorTextFromXML(responseXML, selectorName, attributeName, attributeValue, subselectorName) {
    var selector = getSelectorFromXML(responseXML, selectorName, attributeName, attributeValue);

    var value = selector.innerText || selector.text || selector.textContent;

    if (!value)     // fix IE behavior where (undefined || "" || undefined) == undefined
        value = "";

    return value;
}

var ViewerProbandDataLoader = Class.create(ProbandDataLoader, {
    initialize: function(probandDataUrl) {
        this._probandDataUrl = probandDataUrl || XWiki.currentDocument.getRestURL('objects/PhenoTips.PatientClass/0.xml').substring(1);
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


var ViewerSaveLoadEngine = Class.create(SaveLoadEngine, {

    initialize: function(pedigreeDataUrl) {
        this._pedigreeDataUrl = pedigreeDataUrl || XWiki.currentDocument.getRestURL('objects/PhenoTips.PedigreeClass/0.xml').substring(1)
        this._saveInProgress = false;
    },
    load: function() {
        console.log("initiating load process");

        new Ajax.Request(this._pedigreeDataUrl, {
            method: 'GET',
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
        })
    }
});
