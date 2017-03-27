import {
    contains
} from 'ramda';
import {
    PedigreeEditorAttributes
} from "./pedigreeEditorAttributes";
import {
    DynamicPositionedGraph
} from './dynamicGraph';
import {
    ViewerWorkspace
} from './viewerWorkspace';
import {
    View
} from './view';
import {
    DisorderLegend
} from './disorderLegend';
import {
    HPOLegend
} from "./hpoLegend";
import {
    GeneLegend
} from "./geneLegend";
import {
    Controller
} from './controller';
import {
    ActionStack
} from "./undoRedo";
import {
  NodeMenu
} from "./nodeMenu";
import {
  SaveLoadEngine
} from "./saveLoadEngine";

const isTruthy = val => {
    const truthy = ['1', 'y', 'yes', 'ye', 't', 'tr', 'true'];
    if (val && contains(val.toString().trim().toLowerCase(), truthy)) {
        return true;
    }
    return false;
};

const cleanBooleanField = val => {
    if (val && isTruthy(val)) return true;
    return false;
};

const cleanGender = val => {
    const maleLike = ['m', 'male'];
    const femaleLike = ['f', 'female'];
    if (val && contains(val.toString().trim().toLowerCase(), maleLike)) {
        return "M";
    }
    if (val && contains(val.toString().trim().toLowerCase(), femaleLike)) {
        return "F";
    }
    return "U";
};

// clean the data just to be extra sure
const cleanData = data => {
    return JSON.parse(data).map(datum => {
        const {
            hpoTerms,
            mother,
            father,
            proband,
            focused,
            externalIDHref,
            sex,
            externalId,
            disorders,
            gender,
            candidateGenes,
            id,
        } = datum;
        return {
            proband: cleanBooleanField(proband),
            focused: cleanBooleanField(focused),
            hpoTerms: hpoTerms,
            mother: mother,
            father: father,
            sex: cleanGender(sex),
            externalIDHref: externalIDHref,
            externalId: externalId,
            disorders: disorders,
            gender: cleanGender(gender),
            candidateGenes: candidateGenes,
            id: id,
        };
    });
};

export class ViewerPedigree {
    constructor(args) {
        var me = this;
        //this.DEBUG_MODE = true;
        window.editor = this;

        const data = cleanData(args.data); // hahahaha

        // initialize main data structure which holds the graph structure
        this._graphModel = DynamicPositionedGraph.makeEmpty(
            ViewerPedigree.attributes.layoutRelativePersonWidth,
            ViewerPedigree.attributes.layoutRelativeOtherWidth
        );

        //initialize the elements of the app
        this._workspace = new ViewerWorkspace();
        this._disorderLegend = new DisorderLegend();
        this._geneLegend = new GeneLegend();
        this._hpoLegend = new HPOLegend();

        this._view = new View();

        this._controller = new Controller();
        this._actionStack = new ActionStack();
        this._saveLoadEngine = new SaveLoadEngine();
        const probandData = data.filter(node => isTruthy(node.proband))[0] || false;
        if (probandData) {
            this._probandData = probandData;
        }

        me._saveLoadEngine.createGraphFromImportData(JSON.stringify(data), args.type, {});
    }
    /**
     * Returns the graph node with the corresponding nodeID
     * @method getNode
     * @param {Number} nodeID The id of the desired node
     * @return {AbstractNode} the node whose id is nodeID
     */
    getNode(nodeID) {
        return this.getView().getNode(nodeID);
    }

    /**
     * @method getView
     * @return {View} (responsible for managing graphical representations of nodes and interactive elements)
     */
    getView() {
        return this._view;
    }

    /**
     * @method getVersionUpdater
     * @return {VersionUpdater}
     */
    getVersionUpdater() {
        return this._versionUpdater;
    }

    /**
     * @method getGraph
     * @return {DynamicPositionedGraph} (data model: responsible for managing nodes and their positions)
     */
    getGraph() {
        return this._graphModel;
    }

    /**
     * @method getController
     * @return {Controller} (responsible for managing user input and corresponding data changes)
     */
    getController() {
        return this._controller;
    }

    /**
     * @method getActionStack
     * @return {ActionStack} (responsible for undoing and redoing actions)
     */
    getActionStack() {
        return this._actionStack;
    }

    /**
     * @method getOkCancelDialogue
     * @return {OkCancelDialogue} (responsible for displaying ok/cancel prompts)
     */
    getOkCancelDialogue() {
        return this._okCancelDialogue;
    }

    /**
     * @method getNodetypeSelectionBubble
     * @return {NodetypeSelectionBubble} (floating window with initialization options for new nodes)
     */
    getNodetypeSelectionBubble() {
        return this._nodetypeSelectionBubble;
    }

    /**
     * @method getSiblingSelectionBubble
     * @return {NodetypeSelectionBubble} (floating window with initialization options for new sibling nodes)
     */
    getSiblingSelectionBubble() {
        return this._siblingSelectionBubble;
    }

    /**
     * @method getWorkspace
     * @return {Workspace}
     */
    getWorkspace() {
        return this._workspace;
    }

    /**
     * @method getDisorderLegend
     * @return {Legend} Responsible for managing and displaying the disorder legend
     */
    getDisorderLegend() {
        return this._disorderLegend;
    }

    /**
     * @method getHPOLegend
     * @return {Legend} Responsible for managing and displaying the phenotype/HPO legend
     */
    getHPOLegend() {
        return this._hpoLegend;
    }

    /**
     * @method getGeneLegend
     * @return {Legend} Responsible for managing and displaying the candidate genes legend
     */
    getGeneLegend() {
        return this._geneLegend;
    }

    /**
     * @method getPaper
     * @return {Workspace.paper} Raphael paper element
     */
    getPaper() {
        return this.getWorkspace().getPaper();
    }

    /**
     * @method isReadOnlyMode
     * @return {Boolean} True iff pedigree drawn should be read only with no handles
     *                   (read-only mode is used for IE8 as well as for template display and
     *                   print and export versions).
     */
    isReadOnlyMode() {
        return true;
    }

    isUnsupportedBrowser() {
        // http://voormedia.com/blog/2012/10/displaying-and-detecting-support-for-svg-images
        if (!document.implementation.hasFeature("http://www.w3.org/TR/SVG11/feature#BasicStructure", "1.1")) {
            // implies unpredictable behavior when using handles & interactive elements,
            // and most likely extremely slow on any CPU
            return true;
        }
        // http://kangax.github.io/es5-compat-table/
        if (!window.JSON) {
            // no built-in JSON parser - can't proceed in any way; note that this also implies
            // no support for some other functions such as parsing XML.
            //
            // TODO: include free third-party JSON parser and replace XML with JSON when loading data;
            //       (e.g. https://github.com/douglascrockford/JSON-js)
            //
            //       => at that point all browsers which suport SVG but are treated as unsupported
            //          should theoreticaly start working (FF 3.0, Safari 3 & Opera 9/10 - need to test).
            //          IE7 does not support SVG and JSON and is completely out of the running;
            console.warn("Your browser is not supported and is unable to load and display any pedigrees.\n\n" +
                "Suported browsers include Internet Explorer version 9 and higher, Safari version 4 and higher, " +
                "Firefox version 3.6 and higher, Opera version 10.5 and higher, any version of Chrome and most " +
                "other modern browsers (including mobile). IE8 is able to display pedigrees in read-only mode.");
            window.stop && window.stop();
            return true;
        }
        return false;
    }

    /**
     * @method getSaveLoadEngine
     * @return {SaveLoadEngine} Engine responsible for saving and loading operations
     */
    getSaveLoadEngine() {
        return this._saveLoadEngine;
    }

    /**
     * @method getProbandDataFromPhenotips
     * @return {firstName: "...", lastName: "..."}
     */
    getProbandDataFromPhenotips() {
        return this._probandData;
    }

    /**
     * @method getTemplateSelector
     * @return {TemplateSelector}
     */
    getTemplateSelector() {
        return this._templateSelector;
    }

    /**
     * @method getImportSelector
     * @return {ImportSelector}
     */
    getImportSelector() {
        return this._importSelector;
    }

    /**
     * @method getExportSelector
     * @return {ExportSelector}
     */
    getExportSelector() {
        return this._exportSelector;
    }

    /**
     * Returns true if any of the node menus are visible
     * (since some UI interactions should be disabled while menu is active - e.g. mouse wheel zoom)
     *
     * @method isAnyMenuVisible
     */
    isAnyMenuVisible() {
        return false;
    }

    /**
     * Creates the context menu for Person nodes
     *
     * @method generateNodeMenu
     * @return {NodeMenu}
     */
    generateNodeMenu() {
        if (this.isReadOnlyMode()) return null;
        return new NodeMenu([{
                'name': 'identifier',
                'label': '',
                'type': 'hidden',
                'tab': 'Personal'
            },
            {
                'name': 'gender',
                'label': 'Gender',
                'type': 'radio',
                'tab': 'Personal',
                'columns': 3,
                'values': [{
                        'actual': 'M',
                        'displayed': 'Male'
                    },
                    {
                        'actual': 'F',
                        'displayed': 'Female'
                    },
                    {
                        'actual': 'U',
                        'displayed': 'Unknown'
                    }
                ],
                'default': 'U',
                'function': 'setGender'
            },
            {
                'name': 'first_name',
                'label': 'First name',
                'type': 'text',
                'tab': 'Personal',
                'function': 'setFirstName'
            },
            {
                'name': 'last_name',
                'label': 'Last name',
                'type': 'text',
                'tab': 'Personal',
                'function': 'setLastName'
            },
            {
                'name': 'last_name_birth',
                'label': 'Last name at birth',
                'type': 'text',
                'tab': 'Personal',
                'function': 'setLastNameAtBirth'
            },
            {
                'name': 'external_id',
                'label': 'External ID',
                'type': 'text',
                'tab': 'Personal',
                'function': 'setExternalID'
            },
            {
                'name': 'ethnicity',
                'label': 'Ethnicities',
                'type': 'ethnicity-picker',
                'tab': 'Personal',
                'function': 'setEthnicities'
            },
            {
                'name': 'carrier',
                'label': 'Carrier status',
                'type': 'radio',
                'tab': 'Clinical',
                'values': [{
                        'actual': '',
                        'displayed': 'Not affected'
                    },
                    {
                        'actual': 'carrier',
                        'displayed': 'Carrier'
                    },
                    //{ 'actual' : 'obligate', 'displayed' : 'Obligate carrier' },
                    {
                        'actual': 'affected',
                        'displayed': 'Affected'
                    },
                    {
                        'actual': 'presymptomatic',
                        'displayed': 'Pre-symptomatic'
                    }
                ],
                'default': '',
                'function': 'setCarrierStatus'
            },
            {
                'name': 'evaluated',
                'label': 'Documented evaluation',
                'type': 'checkbox',
                'tab': 'Clinical',
                'function': 'setEvaluated'
            },
            {
                'name': 'disorders',
                'label': 'Known disorders of this individual',
                'type': 'disease-picker',
                'tab': 'Clinical',
                'function': 'setDisorders'
            },
            {
                'name': 'hpo_positive',
                'label': 'Clinical symptoms: observed phenotypes',
                'type': 'hpo-picker',
                'tab': 'Clinical',
                'function': 'setHPO'
            },
            {
                'name': 'candidate_genes',
                'label': 'Genotype information: candidate genes',
                'type': 'gene-picker',
                'tab': 'Clinical',
                'function': 'setGenes'
            },
            {
                'name': 'date_of_birth',
                'label': 'Date of birth',
                'type': 'date-picker',
                'tab': 'Personal',
                'format': 'dd/MM/yyyy',
                'function': 'setBirthDate'
            },
            {
                'name': 'date_of_death',
                'label': 'Date of death',
                'type': 'date-picker',
                'tab': 'Personal',
                'format': 'dd/MM/yyyy',
                'function': 'setDeathDate'
            },
            {
                'name': 'gestation_age',
                'label': 'Gestation age',
                'type': 'select',
                'tab': 'Personal',
                'range': {
                    'start': 0,
                    'end': 50,
                    'item': ['week', 'weeks']
                },
                'nullValue': true,
                'function': 'setGestationAge'
            },
            {
                'name': 'state',
                'label': 'Individual is',
                'type': 'radio',
                'tab': 'Personal',
                'columns': 3,
                'values': [{
                        'actual': 'alive',
                        'displayed': 'Alive'
                    },
                    {
                        'actual': 'stillborn',
                        'displayed': 'Stillborn'
                    },
                    {
                        'actual': 'deceased',
                        'displayed': 'Deceased'
                    },
                    {
                        'actual': 'miscarriage',
                        'displayed': 'Miscarriage'
                    },
                    {
                        'actual': 'unborn',
                        'displayed': 'Unborn'
                    },
                    {
                        'actual': 'aborted',
                        'displayed': 'Aborted'
                    }
                ],
                'default': 'alive',
                'function': 'setLifeStatus'
            },
            {
                'label': 'Heredity options',
                'name': 'childlessSelect',
                'values': [{
                    'actual': 'none',
                    displayed: 'None'
                }, {
                    'actual': 'childless',
                    displayed: 'Childless'
                }, {
                    'actual': 'infertile',
                    displayed: 'Infertile'
                }],
                'type': 'select',
                'tab': 'Personal',
                'function': 'setChildlessStatus'
            },
            {
                'name': 'childlessText',
                'type': 'text',
                'dependency': 'childlessSelect != none',
                'tip': 'Reason',
                'tab': 'Personal',
                'function': 'setChildlessReason'
            },
            {
                'name': 'adopted',
                'label': 'Adopted in',
                'type': 'checkbox',
                'tab': 'Personal',
                'function': 'setAdopted'
            },
            {
                'name': 'monozygotic',
                'label': 'Monozygotic twin',
                'type': 'checkbox',
                'tab': 'Personal',
                'function': 'setMonozygotic'
            },
            {
                'name': 'nocontact',
                'label': 'Not in contact with proband',
                'type': 'checkbox',
                'tab': 'Personal',
                'function': 'setLostContact'
            },
            {
                'name': 'placeholder',
                'label': 'Placeholder node',
                'type': 'checkbox',
                'tab': 'Personal',
                'function': 'makePlaceholder'
            },
            {
                'name': 'comments',
                'label': 'Comments',
                'type': 'textarea',
                'tab': 'Clinical',
                'rows': 2,
                'function': 'setComments'
            }
        ], ["Personal", "Clinical"]);
    }

    /**
     * @method getNodeMenu
     * @return {NodeMenu} Context menu for nodes
     */
    getNodeMenu() {
        return this._nodeMenu;
    }

    /**
     * Creates the context menu for PersonGroup nodes
     *
     * @method generateNodeGroupMenu
     * @return {NodeMenu}
     */
    generateNodeGroupMenu() {
        if (this.isReadOnlyMode()) return null;
        return new NodeMenu([{
                'name': 'identifier',
                'label': '',
                'type': 'hidden'
            },
            {
                'name': 'gender',
                'label': 'Gender',
                'type': 'radio',
                'columns': 3,
                'values': [{
                        'actual': 'M',
                        'displayed': 'Male'
                    },
                    {
                        'actual': 'F',
                        'displayed': 'Female'
                    },
                    {
                        'actual': 'U',
                        'displayed': 'Unknown'
                    }
                ],
                'default': 'U',
                'function': 'setGender'
            },
            {
                'name': 'numInGroup',
                'label': 'Number of persons in this group',
                'type': 'select',
                'values': [{
                        'actual': 1,
                        displayed: 'N'
                    }, {
                        'actual': 2,
                        displayed: '2'
                    }, {
                        'actual': 3,
                        displayed: '3'
                    },
                    {
                        'actual': 4,
                        displayed: '4'
                    }, {
                        'actual': 5,
                        displayed: '5'
                    }, {
                        'actual': 6,
                        displayed: '6'
                    },
                    {
                        'actual': 7,
                        displayed: '7'
                    }, {
                        'actual': 8,
                        displayed: '8'
                    }, {
                        'actual': 9,
                        displayed: '9'
                    }
                ],
                'function': 'setNumPersons'
            },
            {
                'name': 'external_ids',
                'label': 'External ID(s)',
                'type': 'text',
                'function': 'setExternalID'
            },
            {
                'name': 'ethnicity',
                'label': 'Ethnicities<br>(common to all individuals in the group)',
                'type': 'ethnicity-picker',
                'function': 'setEthnicities'
            },
            {
                'name': 'disorders',
                'label': 'Known disorders<br>(common to all individuals in the group)',
                'type': 'disease-picker',
                'function': 'setDisorders'
            },
            {
                'name': 'comments',
                'label': 'Comments',
                'type': 'textarea',
                'rows': 2,
                'function': 'setComments'
            },
            {
                'name': 'state',
                'label': 'All individuals in the group are',
                'type': 'radio',
                'values': [{
                        'actual': 'alive',
                        'displayed': 'Alive'
                    },
                    {
                        'actual': 'aborted',
                        'displayed': 'Aborted'
                    },
                    {
                        'actual': 'deceased',
                        'displayed': 'Deceased'
                    },
                    {
                        'actual': 'miscarriage',
                        'displayed': 'Miscarriage'
                    }
                ],
                'default': 'alive',
                'function': 'setLifeStatus'
            },
            {
                'name': 'evaluatedGrp',
                'label': 'Documented evaluation',
                'type': 'checkbox',
                'function': 'setEvaluated'
            },
            {
                'name': 'adopted',
                'label': 'Adopted in',
                'type': 'checkbox',
                'function': 'setAdopted'
            }
        ], []);
    }

    /**
     * @method getNodeGroupMenu
     * @return {NodeMenu} Context menu for nodes
     */
    getNodeGroupMenu() {
        return this._nodeGroupMenu;
    }

    /**
     * Creates the context menu for Partnership nodes
     *
     * @method generatePartnershipMenu
     * @return {NodeMenu}
     */
    generatePartnershipMenu() {
        if (this.isReadOnlyMode()) return null;
        return new NodeMenu([{
                'label': 'Heredity options',
                'name': 'childlessSelect',
                'values': [{
                    'actual': 'none',
                    displayed: 'None'
                }, {
                    'actual': 'childless',
                    displayed: 'Childless'
                }, {
                    'actual': 'infertile',
                    displayed: 'Infertile'
                }],
                'type': 'select',
                'function': 'setChildlessStatus'
            },
            {
                'name': 'childlessText',
                'type': 'text',
                'dependency': 'childlessSelect != none',
                'tip': 'Reason',
                'function': 'setChildlessReason'
            },
            {
                'name': 'consangr',
                'label': 'Consanguinity of this relationship',
                'type': 'radio',
                'values': [{
                        'actual': 'A',
                        'displayed': 'Automatic'
                    },
                    {
                        'actual': 'Y',
                        'displayed': 'Yes'
                    },
                    {
                        'actual': 'N',
                        'displayed': 'No'
                    }
                ],
                'default': 'A',
                'function': 'setConsanguinity'
            },
            {
                'name': 'broken',
                'label': 'Separated',
                'type': 'checkbox',
                'function': 'setBrokenStatus'
            }
        ], [], "relationship-menu");
    }

    /**
     * @method getPartnershipMenu
     * @return {NodeMenu} The context menu for Partnership nodes
     */
    getPartnershipMenu() {
        return this._partnershipMenu;
    }

    /**
     * @method convertGraphCoordToCanvasCoord
     * @return [x,y] coordinates on the canvas
     */
    convertGraphCoordToCanvasCoord(x, y) {
        var scale = PedigreeEditorAttributes.layoutScale;
        return {
            x: x * scale.xscale + 100,
            y: y * scale.yscale
        };
    }
}

//attributes for graphical elements in the editor
ViewerPedigree.attributes = PedigreeEditorAttributes;
