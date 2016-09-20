var ViewerPedigree = Class.create(PedigreeEditor, {
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
        this._view = new View();

        this._saveLoadEngine = new ViewerSaveLoadEngine(args.pedigreeDataUrl);
        this._probandData = new ViewerProbandDataLoader(args.probandDataUrl);

        // load proband data and load the graph after proband data is available
        this._probandData.load(function() {
            me._saveLoadEngine.load(me._saveLoadEngine, arguments);
            me._saveLoadEngine.createGraphFromImportData(args.data, args.type, {});
        });

        this._controller = new Controller();
        //this.startAutoSave(30);
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

var editor;

//attributes for graphical elements in the editor
ViewerPedigree.attributes = PedigreeEditor.attributes;
