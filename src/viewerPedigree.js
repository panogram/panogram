import { contains } from 'ramda';

import { PedigreeEditor } from './pedigree';
import { PedigreeEditorAttributes } from "./pedigreeEditorAttributes";
import { DynamicPositionedGraph } from './dynamicGraph';
import { ViewerWorkspace } from './viewerWorkspace';
import { View } from './view';
import { DisorderLegend } from './disorderLegend';
import { HPOLegend } from "./hpoLegend";
import { GeneLegend } from "./geneLegend";
import { ViewerSaveLoadEngine } from './viewerSaveLoadEngine';
import { Controller } from './controller';
import { ActionStack } from "./undoRedo";

const isTruthy = val => {
  const truthy = ['1', 'y', 'yes', 'ye', 't', 'tr', 'true'];
  if (contains(val.toString().trim().toLowerCase(), truthy)) {
    return true;
  }
  return false;
}

export const ViewerPedigree = Class.create(PedigreeEditor, {
    initialize: function(args) {
        var me = this;
        //this.DEBUG_MODE = true;
        window.editor = this;

        // initialize main data structure which holds the graph structure
        this._graphModel = DynamicPositionedGraph.makeEmpty(
            ViewerPedigree.attributes.layoutRelativePersonWidth,
            ViewerPedigree.attributes.layoutRelativeOtherWidth
        );

        //initialize the elements of the app
        this._workspace = new ViewerWorkspace();
        this._disorderLegend = new DisorderLegend();
        this._geneLegend = new GeneLegend()
        this._hpoLegend = new HPOLegend();
        
        this._view = new View();

        this._controller = new Controller();
        this._actionStack = new ActionStack();
        this._saveLoadEngine = new ViewerSaveLoadEngine(args.pedigreeDataUrl);
        const probandData = JSON.parse(args.data).filter(node => isTruthy(node.isProband))[0] || {};
        this._probandData = { probandData };

        me._saveLoadEngine.createGraphFromImportData(args.data, args.type, {});
    },

    isReadOnlyMode: function() {
        return true;
    },

    isAnyMenuVisible: function() {
        return false;
    },

    getNodeMenu: function() {},

    getNodeGroupMenu: function() {},

    generateNodeMenu: function() {
        throw new Error('Not implemented');
    },

    generateNodeGroupMenu: function() {
        throw new Error('Not implemented');
    }
});

var editor; // ????

//attributes for graphical elements in the editor
ViewerPedigree.attributes = PedigreeEditorAttributes;
