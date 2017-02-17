import { BaseGraph, TYPE } from "./baseGraph";
import { PositionedGraph } from "./positionedGraph";
import { Heuristics } from "./heuristics";
import { PedigreeImport } from "./import";
import { arrayContains, stringifyObject, clone2DArray, removeFirstOccurrenceByValue, Timer, arrayIndexOf } from "./helpers";
import { Queue } from "./queues";

// DynamicPositionedGraph adds support for online modifications and provides a convenient API for UI implementations

export function DynamicPositionedGraph( drawGraph ) {
    this.DG = drawGraph;

    this._heuristics = new Heuristics( drawGraph );  // heuristics & helper methods separated into a separate class

    this._heuristics.improvePositioning();

    this._onlyProbandGraph = [ { name :"proband" } ];
}

DynamicPositionedGraph.makeEmpty = function (layoutRelativePersonWidth, layoutRelativeOtherWidth) {
    var baseG       = new BaseGraph(layoutRelativePersonWidth, layoutRelativeOtherWidth);
    var positionedG = new PositionedGraph(baseG);
    return new DynamicPositionedGraph(positionedG);
};

DynamicPositionedGraph.prototype = {

    isValidID: function( id )
    {
        if (id < 0 || id > this.DG.GG.getMaxRealVertexId())
            return false;
        if (!this.DG.GG.isPerson(id) && !this.DG.GG.isRelationship(id))
            return false;
        return true;
    },

    getMaxNodeId: function()
    {
        return this.DG.GG.getMaxRealVertexId();
    },

    isPersonGroup: function( id )
    {
        return this.getProperties(id).hasOwnProperty("numPersons");
    },

    isPerson: function( id )
    {
        return this.DG.GG.isPerson(id);
    },

    isRelationship: function( id )
    {
        return this.DG.GG.isRelationship(id);
    },

    isPlaceholder: function( id )
    {
        if (!this.isPerson(id)) return false;
        // TODO
        return false;
    },

    isAdopted: function( id )
    {
        if (!this.isPerson(id))
            throw "Assertion failed: isAdopted() is applied to a non-person";
        return this.DG.GG.isAdopted(id);
    },

    getGeneration: function( id )
    {
        var minRank = Math.min.apply(null, this.DG.ranks);
        return (this.DG.ranks[id] - minRank)/2 + 1;
    },

    getOrderWithinGeneration: function( id )
    {
        if (!this.isPerson(id))
            throw "Assertion failed: getOrderWithinGeneration() is applied to a non-person";

        var order = 0;
        var rank  = this.DG.ranks[id];
        for (var i = 0; i < this.DG.order.order[rank].length; i++) {
            var next = this.DG.order.order[rank][i];
            if (this.DG.GG.isPerson(next)) order++;
            if (next == id) break;
        }
        return order;
    },

    // returns null if person has no twins
    getTwinGroupId: function( id )
    {
        return this.DG.GG.getTwinGroupId(id);
    },

    // returns and array of twins, sorted by order left to right. Always contains at least "id" itself
    getAllTwinsSortedByOrder: function( id )
    {
        var twins = this.DG.GG.getAllTwinsOf(id);
        var vOrder = this.DG.order.vOrder;
        var byOrder = function(a,b){ return vOrder[a] - vOrder[b]; };
        twins.sort( byOrder );
        return twins;
    },

    isChildless: function( id )
    {
        if (!this.getProperties(id).hasOwnProperty("childlessStatus"))
            return false;
        var res =  (this.getProperties(id)["childlessStatus"] !== null);
        //console.log("childless status of " + id + " : " + res);
        return res;
    },

    isConsangrRelationship: function( id )
    {
        if (!this.isRelationship(id))
            throw "Assertion failed: isConsangrRelationship() is applied to a non-relationship";

        return this.DG.consangr.hasOwnProperty(id);
    },

    getProperties: function( id )
    {
        return this.DG.GG.properties[id];
    },

    setProperties: function( id, newSetOfProperties )
    {
        this.DG.GG.properties[id] = newSetOfProperties;
    },

    // returns false if this gender is incompatible with this pedigree; true otherwise
    setProbandData: function( firstName, lastName, gender )
    {
        this.DG.GG.properties[0].fName = firstName;
        this.DG.GG.properties[0].lName = lastName;

        var setGender = gender;
        var possibleGenders = this.getPossibleGenders(0);
        
        if (!possibleGenders.hasOwnProperty(gender) || !possibleGenders[gender])
            setGender = "U";
        this.DG.GG.properties[0].gender = setGender;

        return (gender == setGender);
    },

    getPosition: function( v )
    {
        // returns coordinates of node v
        var x = this.DG.positions[v];
        console.warn(x);

        var rank = this.DG.ranks[v];

        var vertLevel = this.DG.GG.isChildhub(v) ? this.DG.vertLevel.childEdgeLevel[v] : 1;

        var y = this.DG.computeNodeY(rank, vertLevel);

        if (this.DG.GG.isVirtual(v)) {
            var relId    = this.DG.GG.downTheChainUntilNonVirtual(v);
            var personId = this.DG.GG.upTheChainUntilNonVirtual(v);

            var rankPerson = this.DG.ranks[personId];
            if (rank == rankPerson) {
                var level = this.DG.vertLevel.outEdgeVerticalLevel[personId][relId].verticalLevel;
                y = this.DG.computeRelLineY(rank, 0, level).relLineY;
            }

            var rankRelationship = this.DG.ranks[relId];
            if (rank == rankRelationship) {
                y = this.getPosition(relId).y;
            }
        }
        else
        if (this.isRelationship(v)) {
            var partners = this.DG.GG.getParents(v);
            var level1   = this.DG.vertLevel.outEdgeVerticalLevel[partners[0]].hasOwnProperty(v) ? this.DG.vertLevel.outEdgeVerticalLevel[partners[0]][v].verticalLevel : 0;
            var level2   = this.DG.vertLevel.outEdgeVerticalLevel[partners[1]].hasOwnProperty(v) ? this.DG.vertLevel.outEdgeVerticalLevel[partners[1]][v].verticalLevel : 0;
            var level    = Math.min(level1, level2);
            var attach1  = this.DG.vertLevel.outEdgeVerticalLevel[partners[0]].hasOwnProperty(v) ? this.DG.vertLevel.outEdgeVerticalLevel[partners[0]][v].attachlevel : 0;
            var attach2  = this.DG.vertLevel.outEdgeVerticalLevel[partners[1]].hasOwnProperty(v) ? this.DG.vertLevel.outEdgeVerticalLevel[partners[1]][v].attachlevel : 0;
            var attach   = Math.min(attach1, attach2);
            y = this.DG.computeRelLineY(rank, attach, level).relLineY;
        }

        return {"x": x, "y": y};
    },

    getRelationshipChildhubPosition: function( v )
    {
        if (!this.isRelationship(v))
            throw "Assertion failed: getRelationshipChildhubPosition() is applied to a non-relationship";

        var childhubId = this.DG.GG.getRelationshipChildhub(v);

        return this.getPosition(childhubId);
    },

    getRelationshipLineInfo: function( relationship, person )
    {
        if (!this.isRelationship(relationship))
            throw "Assertion failed: getRelationshipToPersonLinePosition() is applied to a non-relationship";
        if (!this.isPerson(person))
            throw "Assertion failed: getRelationshipToPersonLinePosition() is applied to a non-person";

        var info = this.DG.vertLevel.outEdgeVerticalLevel[person].hasOwnProperty(relationship) ?
                   this.DG.vertLevel.outEdgeVerticalLevel[person][relationship] :
                   { attachlevel: 0, verticalLevel: 0, numAttachLevels: 1 };

        //console.log("Info: " +  stringifyObject(info));

        var verticalRelInfo = this.DG.computeRelLineY(this.DG.ranks[person], info.attachlevel, info.verticalLevel);

        var result = {
            "attachmentPort": info.attachlevel,
            "attachY":        verticalRelInfo.attachY,
            "verticalLevel":  info.verticalLevel,
            "verticalY":      verticalRelInfo.relLineY,
            "numAttachPorts": info.numAttachLevels
        };

        //console.log("rel: " + relationship + ", person: " + person + " => " + stringifyObject(result));
        return result;
    },

    // returns all the children sorted by their order in the graph (left to right)
    getRelationshipChildrenSortedByOrder: function( v )
    {
        if (!this.isRelationship(v))
            throw "Assertion failed: getRelationshipChildren() is applied to a non-relationship";

        var childhubId = this.DG.GG.getRelationshipChildhub(v);

        var children = this.DG.GG.getOutEdges(childhubId);

        var vOrder = this.DG.order.vOrder;
        var byOrder = function(a,b){ return vOrder[a] - vOrder[b]; };
        children.sort( byOrder );

        return children;
    },

    getAllChildren: function( v )
    {
        if (!this.isPerson(v) && !this.isRelationship(v))
            throw "Assertion failed: getAllChildren() is applied to a non-person non-relationship node";

        var rels = this.isRelationship(v) ? [v] : this.DG.GG.getAllRelationships(v);

        var allChildren = [];
        for (var i = 0; i < rels.length; i++) {
            var chhub    = this.DG.GG.getOutEdges(rels[i])[0];
            var children = this.DG.GG.getOutEdges(chhub);

            allChildren = allChildren.concat(children);
        }
        return allChildren;
    },

    isChildOfProband: function( v )
    {
        var parents = this.DG.GG.getParents(v);
        if (arrayContains(parents,0)) return true;
        return false;
    },

    isPartnershipRelatedToProband: function( v )
    {
        var parents = this.DG.GG.getParents(v);
        if (arrayContains(parents, 0)) return true;
        if (v == this.DG.GG.getProducingRelationship(0))
        {
            return true;
        }
        return false;
    },

    // returns true iff node v is either a sibling, a child or a parent of proband node
    isRelatedToProband: function( v )
    {
        var probandRelatedRels = this.getAllRelatedRelationships(0);
        for (var i = 0; i < probandRelatedRels.length; i++) {
            var rel = probandRelatedRels[i];

            var parents = this.DG.GG.getParents(rel);
            if (arrayContains(parents, v)) return true;

            var children = this.getAllChildren(rel);
            if (arrayContains(children, v)) return true;
        }
        return false;
    },

    // returns all relationships of node v and its parent relationship, if any
    getAllRelatedRelationships: function( v )
    {
        var allRels = this.DG.GG.getAllRelationships(v);
        var parentRel = this.DG.GG.getProducingRelationship(v);
        if (parentRel != null) {
            allRels.push(parentRel);
        }
        return allRels;
    },

    hasNonPlaceholderNonAdoptedChildren: function( v )
    {
        if (this.isRelationship(v)) {
            var children = this.getRelationshipChildrenSortedByOrder(v);

            //console.log("Childtren: " + children);
            for (var i = 0; i < children.length; i++) {
                var child = children[i];
                if (!this.isPlaceholder(child) && !this.isAdopted(child)) {
                    //console.log("child: " + child + ", isAdopted: " + this.isAdopted(child));
                    return true;
                }
            }
        }
        else if (this.isPerson(v)) {
            //var children = ...
            //TODO
        }

        return false;
    },

    getParentRelationship: function( v )
    {
        if (!this.isPerson(v))
            throw "Assertion failed: getParentRelationship() is applied to a non-person";

        return this.DG.GG.getProducingRelationship(v);
    },

    hasToBeAdopted: function( v )
    {
        if (!this.isPerson(v))
            throw "Assertion failed: hasToBeAdopted() is applied to a non-person";

        var parentRel = this.getParentRelationship(v);
        if (parentRel !== null && this.isChildless(parentRel))
            return true;
        return false;
    },

    hasRelationships: function( v )
    {
        if (!this.isPerson(v))
            throw "Assertion failed: hasRelationships() is applied to a non-person";

        return (this.DG.GG.v[v].length > 0); // if it had relationships it must have been alive at some point
    },

    getPossibleGenders: function( v )
    {
        var possible = {"M": true, "F": true, "U": true};
        // any if no partners or all partners are of unknown genders; opposite of the partner gender otherwise
        var partners = this.DG.GG.getAllPartners(v);

        var knownGenderPartner = undefined;
        for (var i = 0; i < partners.length; i++) {
            var partnerGender = this.getGender(partners[i]);
            if (partnerGender != "U") {
                possible[partnerGender] = false;
                break;
            }
        }

        //console.log("Possible genders for " + v + ": " + stringifyObject(possible));
        return possible;
    },

    getPossibleChildrenOf: function( v )
    {
        // all person nodes which are not ancestors of v and which do not already have parents
        var result = [];
        for (var i = 0; i <= this.DG.GG.getMaxRealVertexId(); i++) {
            if (!this.isPerson(i)) continue;
            if (this.DG.GG.inedges[i].length != 0) continue;
            if (this.DG.ancestors[v].hasOwnProperty(i)) continue;
            result.push(i);
        }
        return result;
    },

    getPossibleSiblingsOf: function( v )
    {
        // all person nodes which are not ancestors and not descendants
        // if v has parents only nodes without parents are returned
        var hasParents = (this.getParentRelationship(v) !== null);
        var result = [];
        for (var i = 0; i <= this.DG.GG.getMaxRealVertexId(); i++) {
            if (!this.isPerson(i)) continue;
            if (this.DG.ancestors[v].hasOwnProperty(i)) continue;
            if (this.DG.ancestors[i].hasOwnProperty(v)) continue;
            if (hasParents && this.DG.GG.inedges[i].length != 0) continue;
            result.push(i);
        }
        return result;
    },

    getPossibleParentsOf: function( v )
    {
        // all person nodes which are not descendants of source node
        var result = [];
        //console.log("Ancestors: " + stringifyObject(this.DG.ancestors));
        for (var i = 0; i <= this.DG.GG.getMaxRealVertexId(); i++) {
            if (!this.isRelationship(i) && !this.isPerson(i)) continue;
            if (this.isPersonGroup(i)) continue;
            if (this.DG.ancestors[i].hasOwnProperty(v)) continue;
            result.push(i);
        }
        return result;
    },

    getPossiblePartnersOf: function( v )
    {
        // returns all person nodes of the other gender or unknown gender (who are not already partners)
        var oppositeGender  = this.DG.GG.getOppositeGender(v);
        var validGendersSet = (oppositeGender == "U") ? ["M","F","U"] : [oppositeGender,"U"];

        var result = this._getAllPersonsOfGenders(validGendersSet);

        var partners = this.DG.GG.getAllPartners(v);
        partners.push(v);
        for (var i = 0; i < partners.length; i++)
            removeFirstOccurrenceByValue( result, partners[i] );

        return result;
    },

    getOppositeGender: function( v )
    {
        if (!this.isPerson(v))
            throw "Assertion failed: getOppositeGender() is applied to a non-person";

        return this.DG.GG.getOppositeGender(v);
    },

    getGender: function( v )
    {
        if (!this.isPerson(v))
            throw "Assertion failed: getGender() is applied to a non-person";

        return this.DG.GG.getGender(v);
    },

    getDisconnectedSetIfNodeRemoved: function( v )
    {
        var removedList = {};
        removedList[v] = true;

        if (this.isPerson(v)) {
            // special case: removing the only child also removes the relationship
            if (this.DG.GG.getInEdges(v).length != 0) {
                var chhub = this.DG.GG.getInEdges(v)[0];
                if (this.DG.GG.getOutEdges(chhub).length == 1) {
                    removedList[ this.DG.GG.getInEdges(chhub)[0] ] = true;
                }
            }

            // also remove all relationships by this person
            var allRels = this.DG.GG.getAllRelationships(v);
            for (var i = 0; i < allRels.length; i++) {
                removedList[allRels[i]] = true;
            }
        }

        // remove all childhubs of all relationships that need to be removed
        for (var node in removedList) {
            if (removedList.hasOwnProperty(node) && this.isRelationship(node)) {
                var chhubId = this.DG.GG.getOutEdges(node)[0];
                removedList[chhubId] = true;
            }
        }

        // go through all the edges in the tree starting from proband and disregarding any edges going to or from v
        var connected = {};

        var queue = new Queue();
        queue.push( 0 );

        while ( queue.size() > 0 ) {
            var next = parseInt(queue.pop());

            if (connected.hasOwnProperty(next)) continue;
            connected[next] = true;

            var outEdges = this.DG.GG.getOutEdges(next);
            for (var i = 0; i < outEdges.length; i++) {
                if (!removedList.hasOwnProperty(outEdges[i]))
                    queue.push(outEdges[i]);
            }
            var inEdges = this.DG.GG.getInEdges(next);
            for (var i = 0; i < inEdges.length; i++) {
                if (!removedList.hasOwnProperty(inEdges[i]))
                    queue.push(inEdges[i]);
            }
        }
        console.log("Connected nodes: " + stringifyObject(connected));

        var affected = [];
        for (var i = 0; i < this.DG.GG.getNumVertices(); i++) {
            if (this.isPerson(i) || this.isRelationship(i)) {
                if (!connected.hasOwnProperty(i))
                    affected.push(i);
            }
        }

        console.log("Affected nodes: " + stringifyObject(affected));
        return affected;
    },

    _debugPrintAll: function( headerMessage )
    {
        console.log("========== " + headerMessage + " ==========");
        //console.log("== GG:");
        //console.log(stringifyObject(this.DG.GG));
        //console.log("== Ranks:");
        //console.log(stringifyObject(this.DG.ranks));
        //console.log("== Orders:");
        //console.log(stringifyObject(this.DG.order));
        //console.log("== Positions:");
        //console.log(stringifyObject(this.DG.positions));
        //console.log("== RankY:");
        //console.log(stringifyObject(this.DG.rankY));
    },

    updateAncestors: function()   // sometimes have to do this after the "adopted" property change
    {
        var ancestors = this.DG.findAllAncestors();
        this.DG.ancestors = ancestors.ancestors;
        this.DG.consangr  = ancestors.consangr;

        // after consang has changes a random set or relationships may become/no longer be a consangr. relationship
        var movedNodes = [];
        for (var i = 0; i <= this.DG.GG.getMaxRealVertexId(); i++) {
            if (!this.isRelationship(i)) continue;
            movedNodes.push(i);
        }

        return { "moved": movedNodes };
    },

    addNewChild: function( childhubId, properties, numTwins )
    {
        this._debugPrintAll("before");
        var timer = new Timer();

        if (!this.DG.GG.isChildhub(childhubId)) {
            if (this.DG.GG.isRelationship(childhubId))
                childhubId = this.DG.GG.getRelationshipChildhub(childhubId);
            else
                throw "Assertion failed: adding children to a non-childhub node";
        }

        var positionsBefore  = this.DG.positions.slice(0);
        var ranksBefore      = this.DG.ranks.slice(0);
        var vertLevelsBefore = this.DG.vertLevel.copy();
        var rankYBefore      = this.DG.rankY.slice(0);
        var numNodesBefore   = this.DG.GG.getMaxRealVertexId();

        if (!properties) properties = {};
        if (!numTwins) numTwins = 1;

        var insertRank = this.DG.ranks[childhubId] + 1;

        // find the best order to use for this new vertex: scan all orders on the rank, check number of crossed edges
        var insertOrder = this._findBestInsertPosition( insertRank, childhubId );

        // insert the vertex into the base graph and update ranks, orders & positions
        var newNodeId = this._insertVertex(TYPE.PERSON, properties, 1.0, childhubId, null, insertRank, insertOrder);

        var newNodes = [newNodeId];
        for (var i = 0; i < numTwins - 1; i++ ) {
            var changeSet = this.addTwin( newNodeId, properties );
            newNodes.push(changeSet["new"][0]);
        }

        // validate: by now the graph should satisfy all assumptions
        this.DG.GG.validate();

        // fix common layout mistakes (e.g. relationship not right above the only child)
        // and update vertical positioning of all edges
        this._heuristics.improvePositioning(ranksBefore, rankYBefore);

        // update ancestors
        this.updateAncestors();

        timer.printSinceLast("=== AddChild runtime: ");
        this._debugPrintAll("after");

        var movedNodes = this._findMovedNodes( numNodesBefore, positionsBefore, ranksBefore, vertLevelsBefore, rankYBefore );
        var relationshipId = this.DG.GG.getInEdges(childhubId)[0];
        if (!arrayContains(movedNodes,relationshipId))
            movedNodes.push(relationshipId);
        var animateNodes = this.DG.GG.getInEdges(relationshipId);  // animate parents if they move. if not, nothing will be done with them
        return {"new": newNodes, "moved": movedNodes, "animate": animateNodes};
    },

    addNewParents: function( personId )
    {
        this._debugPrintAll("before");
        var timer = new Timer();

        if (!this.DG.GG.isPerson(personId))
            throw "Assertion failed: adding parents to a non-person node";

        if (this.DG.GG.getInEdges(personId).length > 0)
            throw "Assertion failed: adding parents to a person with parents";

        var positionsBefore  = this.DG.positions.slice(0);
        var ranksBefore      = this.DG.ranks.slice(0);
        var vertLevelsBefore = this.DG.vertLevel.copy();
        var rankYBefore      = this.DG.rankY.slice(0);
        var numNodesBefore   = this.DG.GG.getMaxRealVertexId();

        // a few special cases which involve not only insertions but also existing node rearrangements:
        this._heuristics.swapBeforeParentsToBringToSideIfPossible( personId );

        var insertChildhubRank = this.DG.ranks[personId] - 1;

        // find the best order to use for this new vertex: scan all orders on the rank, check number of crossed edges
        var insertChildhubOrder = this._findBestInsertPosition( insertChildhubRank, personId );

        // insert the vertex into the base graph and update ranks, orders & positions
        var newChildhubId = this._insertVertex(TYPE.CHILDHUB, {}, 1.0, null, personId, insertChildhubRank, insertChildhubOrder);

        var insertParentsRank = this.DG.ranks[newChildhubId] - 1;   // note: rank may have changed since last insertion
                                                                    //       (iff childhub was insertion above all at rank 0 - which becomes rank1)

        // find the best order to use for this new vertex: scan all orders on the rank, check number of crossed edges
        var insertParentOrder = this._findBestInsertPosition( insertParentsRank, newChildhubId );

        var newRelationshipId = this._insertVertex(TYPE.RELATIONSHIP, {}, 1.0, null, newChildhubId, insertParentsRank, insertParentOrder);

        insertParentsRank = this.DG.ranks[newRelationshipId];       // note: rank may have changed since last insertion again
                                                                    //       (iff relationship was insertion above all at rank 0 - which becomes rank1)

        var newParent1Id = this._insertVertex(TYPE.PERSON, {"gender": "F"}, 1.0, null, newRelationshipId, insertParentsRank, insertParentOrder + 1);
        var newParent2Id = this._insertVertex(TYPE.PERSON, {"gender": "M"}, 1.0, null, newRelationshipId, insertParentsRank, insertParentOrder);

        // validate: by now the graph should satisfy all assumptions
        this.DG.GG.validate();

        // fix common layout mistakes (e.g. relationship not right above the only child)
        // and update vertical positioning of all edges
        this._heuristics.improvePositioning(ranksBefore, rankYBefore);

        // update ancestors
        this.updateAncestors();

        timer.printSinceLast("=== NewParents runtime: ");
        this._debugPrintAll("after");

        var animateNodes = this.DG.GG.getAllPartners(personId);
        if (animateNodes.length == 1)  // only animate node partners if there is only one - ow it may get too confusing with a lot of stuff animating around
            animateNodes.push(personId);
        else
            animateNodes = [personId];
        var movedNodes = this._findMovedNodes( numNodesBefore, positionsBefore, ranksBefore, vertLevelsBefore, rankYBefore );
        var newNodes   = [newRelationshipId, newParent1Id, newParent2Id];
        return {"new": newNodes, "moved": movedNodes, "highlight": [personId], "animate": animateNodes};
    },

    addNewRelationship: function( personId, childProperties, preferLeft, numTwins )
    {
        this._debugPrintAll("before");
        var timer = new Timer();

        if (!this.DG.GG.isPerson(personId))
            throw "Assertion failed: adding relationship to a non-person node";

        var positionsBefore  = this.DG.positions.slice(0);
        var ranksBefore      = this.DG.ranks.slice(0);
        var vertLevelsBefore = this.DG.vertLevel.copy();
        var rankYBefore      = this.DG.rankY.slice(0);
        var consangrBefore   = this.DG.consangr;
        var numNodesBefore   = this.DG.GG.getMaxRealVertexId();

        if (!childProperties) childProperties = {};

        if (!numTwins) numTwins = 1;

        var partnerProperties = { "gender": this.DG.GG.getOppositeGender(personId) };

        var insertRank  = this.DG.ranks[personId];
        var personOrder = this.DG.order.vOrder[personId];

        // a few special cases which involve not only insertions but also existing node rearrangements:
        this._heuristics.swapPartnerToBringToSideIfPossible( personId );
        this._heuristics.swapTwinsToBringToSideIfPossible( personId );

        // find the best order to use for this new vertex: scan all orders on the rank, check number of crossed edges
        var insertOrder = this._findBestInsertPosition( insertRank, personId, preferLeft );

        console.log("vOrder: " + personOrder + ", inserting @ " + insertOrder);
        console.log("Orders before: " + stringifyObject(this.DG.order.order[this.DG.ranks[personId]]));

        var newRelationshipId = this._insertVertex(TYPE.RELATIONSHIP, {}, 1.0, personId, null, insertRank, insertOrder);

        console.log("Orders after: " + stringifyObject(this.DG.order.order[this.DG.ranks[personId]]));

        var insertPersonOrder = (insertOrder > personOrder) ? insertOrder + 1 : insertOrder;

        var newPersonId = this._insertVertex(TYPE.PERSON, partnerProperties, 1.0, null, newRelationshipId, insertRank, insertPersonOrder);

        var insertChildhubRank  = insertRank + 1;
        var insertChildhubOrder = this._findBestInsertPosition( insertChildhubRank, newRelationshipId );
        var newChildhubId       = this._insertVertex(TYPE.CHILDHUB, {}, 1.0, newRelationshipId, null, insertChildhubRank, insertChildhubOrder);

        var insertChildRank  = insertChildhubRank + 1;
        var insertChildOrder = this._findBestInsertPosition( insertChildRank, newChildhubId );
        var newChildId       = this._insertVertex(TYPE.PERSON, childProperties, 1.0, newChildhubId, null, insertChildRank, insertChildOrder);

        var newNodes = [newRelationshipId, newPersonId, newChildId];
        for (var i = 0; i < numTwins - 1; i++ ) {
            var changeSet = this.addTwin( newChildId, childProperties );
            newNodes.push(changeSet["new"][0]);
        }

        console.log("Orders after all: " + stringifyObject(this.DG.order.order[this.DG.ranks[personId]]));

        // validate: by now the graph should satisfy all assumptions
        this.DG.GG.validate();

        //this._debugPrintAll("middle");

        // fix common layout mistakes (e.g. relationship not right above the only child)
        // and update vertical positioning of all edges
        this._heuristics.improvePositioning(ranksBefore, rankYBefore);

        // update ancestors
        this.updateAncestors();

        timer.printSinceLast("=== NewRelationship runtime: ");
        this._debugPrintAll("after");

        var movedNodes = this._findMovedNodes( numNodesBefore, positionsBefore, ranksBefore, vertLevelsBefore, rankYBefore, consangrBefore );
        return {"new": newNodes, "moved": movedNodes, "highlight": [personId]};
    },

    assignParent: function( parentId, childId )
    {
        if (this.isRelationship(parentId)) {
            var childHubId   = this.DG.GG.getRelationshipChildhub(parentId);
            var rankChildHub = this.DG.ranks[childHubId];
            var rankChild    = this.DG.ranks[childId];

            var weight = 1;
            this.DG.GG.addEdge(childHubId, childId, weight);

            var animateList = [childId];

            if (rankChildHub != rankChild - 1) {
                return this.redrawAll(animateList);
            }

            var positionsBefore  = this.DG.positions.slice(0);
            var ranksBefore      = this.DG.ranks.slice(0);
            var vertLevelsBefore = this.DG.vertLevel.copy();
            var rankYBefore      = this.DG.rankY.slice(0);
            var consangrBefore   = this.DG.consangr;
            var numNodesBefore   = this.DG.GG.getMaxRealVertexId();

            // TODO: move vertex closer to other children, if possible?

            // validate: by now the graph should satisfy all assumptions
            this.DG.GG.validate();

            // update vertical separation for all nodes & compute ancestors
            this._updateauxiliaryStructures(ranksBefore, rankYBefore);

            positionsBefore[parentId] = Infinity; // so that it is added to the list of moved nodes
            var movedNodes = this._findMovedNodes( numNodesBefore, positionsBefore, ranksBefore, vertLevelsBefore, rankYBefore, consangrBefore );
            return {"moved": movedNodes, "animate": [childId]};
        }
        else {
            var rankParent = this.DG.ranks[parentId];
            var rankChild  = this.DG.ranks[childId];

            var partnerProperties = { "gender": this.DG.GG.getOppositeGender(parentId) };

            //console.log("rankParent: " + rankParent + ", rankChild: " + rankChild );

            if (rankParent >= rankChild) {
                var ranksBefore        = this.DG.ranks.slice(0);
                // need a complete redraw, since this violates the core layout rule. In this case insert orders do not matter
                var insertChildhubRank = rankChild - 1;
                var newChildhubId      = this._insertVertex(TYPE.CHILDHUB, {}, 1.0, null, childId, insertChildhubRank, 0);
                var insertParentsRank  = this.DG.ranks[newChildhubId] - 1;   // note: rank may have changed since last insertion
                var newRelationshipId  = this._insertVertex(TYPE.RELATIONSHIP, {}, 1.0, null, newChildhubId, insertParentsRank, 0);
                var newParentId        = this._insertVertex(TYPE.PERSON, partnerProperties, 1.0, null, newRelationshipId, insertParentsRank, 0);
                this.DG.GG.addEdge(parentId, newRelationshipId, 1);
                var animateList = [childId, parentId];
                var newList     = [newRelationshipId, newParentId];
                return this.redrawAll(animateList, newList, ranksBefore);
            }

            // add new childhub     @ rank (rankChild - 1)
            // add new relationship @ rank (rankChild - 2)
            // add new parent       @ rank (rankChild - 2) right next to new relationship
            //                        (left or right depends on if the other parent is right or left)
            // depending on other parent rank either draw a multi-rank relationship edge or regular relationship edge

            this._debugPrintAll("before");
            var timer = new Timer();

            var positionsBefore  = this.DG.positions.slice(0);
            var ranksBefore      = this.DG.ranks.slice(0);
            var vertLevelsBefore = this.DG.vertLevel.copy();
            var rankYBefore      = this.DG.rankY.slice(0);
            var consangrBefore   = this.DG.consangr;
            var numNodesBefore   = this.DG.GG.getMaxRealVertexId();

            var x_parent     = this.DG.positions[parentId];
            var x_child      = this.DG.positions[childId];

            if (rankParent == rankChild - 2) {
                // the order of new node creation is then:
                // 1) new relationship node
                // 2) new partner
                // 3) new childhub
                var preferLeft = (x_child < x_parent);

                // add same-rank relationship edge
                var insertRelatOrder  = this._findBestInsertPosition( rankParent, parentId, preferLeft);
                var newRelationshipId = this._insertVertex(TYPE.RELATIONSHIP, {}, 1.0, parentId, null, rankParent, insertRelatOrder);

                var newParentOrder = (this.DG.order.vOrder[parentId] > this.DG.order.vOrder[newRelationshipId]) ? insertRelatOrder : (insertRelatOrder+1);
                var newParentId    = this._insertVertex(TYPE.PERSON, partnerProperties, 1.0, null, newRelationshipId, rankParent, newParentOrder);

                var insertChildhubRank  = rankChild - 1;
                var insertChildhubOrder = this._findBestInsertPosition( insertChildhubRank, newRelationshipId );
                var newChildhubId       = this._insertVertex(TYPE.CHILDHUB, {}, 1.0, newRelationshipId, null, insertChildhubRank, insertChildhubOrder);

                this.DG.GG.addEdge(newChildhubId, childId, 1);
            } else {
                // need to add a multi-rank edge: order of node creation is different:
                // 1) new childhub
                // 2) new relationship node
                // 3) new partner
                // 4) multi-rank edge
                // add a multi-rank relationship edge (e.g. a sequence of edges between virtual nodes on intermediate ranks)

                var insertChildhubRank  = rankChild - 1;
                var insertChildhubOrder = this._findBestInsertPosition( insertChildhubRank, childId );
                var newChildhubId       = this._insertVertex(TYPE.CHILDHUB, {}, 1.0, null, childId, insertChildhubRank, insertChildhubOrder);

                var insertParentsRank = rankChild - 2;

                var insertRelatOrder  = this._findBestInsertPosition( insertParentsRank, newChildhubId );
                var newRelationshipId = this._insertVertex(TYPE.RELATIONSHIP, {}, 1.0, null, newChildhubId, insertParentsRank, insertRelatOrder);

                var newParentOrder = (this.DG.positions[parentId] > this.DG.positions[newRelationshipId]) ? insertRelatOrder : (insertRelatOrder+1);
                var newParentId    = this._insertVertex(TYPE.PERSON, partnerProperties, 1.0, null, newRelationshipId, insertParentsRank, newParentOrder);

                this._addMultiRankEdge(parentId, newRelationshipId);
            }

            // validate: by now the graph should satisfy all assumptions
            this.DG.GG.validate();

            // fix common layout mistakes (e.g. relationship not right above the only child)
            // and update vertical positioning of all edges
            this._heuristics.improvePositioning(ranksBefore, rankYBefore);

            // update ancestors
            this.updateAncestors();

            timer.printSinceLast("=== DragToParentOrChild runtime: ");
            this._debugPrintAll("after");

            if (this.DG.positions.length >= 31)
                console.log("position of node 32: " + this.DG.positions[32] + ", was: " + positionsBefore[32]);
            var movedNodes = this._findMovedNodes( numNodesBefore, positionsBefore, ranksBefore, vertLevelsBefore, rankYBefore, consangrBefore );
            var newNodes   = [newRelationshipId, newParentId];
            return {"new": newNodes, "moved": movedNodes, "highlight": [parentId, newParentId, childId]};
        }

    },

    assignPartner: function( person1, person2, childProperties ) {
        var positionsBefore  = this.DG.positions.slice(0);
        var ranksBefore      = this.DG.ranks.slice(0);
        var vertLevelsBefore = this.DG.vertLevel.copy();
        var rankYBefore      = this.DG.rankY.slice(0);
        var consangrBefore   = this.DG.consangr;
        var numNodesBefore   = this.DG.GG.getMaxRealVertexId();

        var rankP1 = this.DG.ranks[person1];
        var rankP2 = this.DG.ranks[person2];

        if (rankP1 < rankP2 ||
            (rankP1 == rankP2 && this.DG.order.vOrder[person2] < this.DG.order.vOrder[person1])
           ) {
            var tmpPerson = person2;
            person2       = person1;
            person1       = tmpPerson;

            rankP1 = rankP2;
            rankP2 = this.DG.ranks[person2];
        }

        var x_person1 = this.DG.positions[person1];
        var x_person2 = this.DG.positions[person2];

        var weight = 1;

        var preferLeft        = (x_person2 < x_person1);
        var insertRelatOrder  = (rankP1 == rankP2) ? this._findBestRelationshipPosition( person1, false, person2 ) :
                                                     this._findBestRelationshipPosition( person1, preferLeft);
        var newRelationshipId = this._insertVertex(TYPE.RELATIONSHIP, {}, weight, person1, null, rankP1, insertRelatOrder);

        var insertChildhubRank  = this.DG.ranks[newRelationshipId] + 1;
        var insertChildhubOrder = this._findBestInsertPosition( insertChildhubRank, newRelationshipId );
        var newChildhubId       = this._insertVertex(TYPE.CHILDHUB, {}, 1.0, newRelationshipId, null, insertChildhubRank, insertChildhubOrder);

        var insertChildRank  = insertChildhubRank + 1;
        var insertChildOrder = this._findBestInsertPosition( insertChildRank, newChildhubId );
        var newChildId       = this._insertVertex(TYPE.PERSON, childProperties, 1.0, newChildhubId, null, insertChildRank, insertChildOrder);

        if (rankP1 == rankP2) {
            this.DG.GG.addEdge(person2, newRelationshipId, weight);
        } else {
            this._addMultiRankEdge(person2, newRelationshipId);
        }

        // validate: by now the graph should satisfy all assumptions
        this.DG.GG.validate();

        // fix common layout mistakes (e.g. relationship not right above the only child)
        // and update vertical positioning of all edges
        this._heuristics.improvePositioning(ranksBefore, rankYBefore);

        // update ancestors
        this.updateAncestors();

        this._debugPrintAll("after");

        var movedNodes = this._findMovedNodes( numNodesBefore, positionsBefore, ranksBefore, vertLevelsBefore, rankYBefore, consangrBefore );
        var newNodes   = [newRelationshipId, newChildId];
        return {"new": newNodes, "moved": movedNodes, "highlight": [person1, person2, newChildId]};
    },

    addTwin: function( personId, properties )
    {
        var positionsBefore  = this.DG.positions.slice(0);
        var ranksBefore      = this.DG.ranks.slice(0);
        var vertLevelsBefore = this.DG.vertLevel.copy();
        var rankYBefore      = this.DG.rankY.slice(0);
        var numNodesBefore   = this.DG.GG.getMaxRealVertexId();

        var parentRel = this.DG.GG.getProducingRelationship(personId);

        var twinGroupId = this.DG.GG.getTwinGroupId(personId);
        if (twinGroupId === null) {
            twinGroupId = this.DG.GG.getUnusedTwinGroupId(parentRel);
            console.log("new twin id: " + twinGroupId);
            this.DG.GG.properties[personId]["twinGroup"] = twinGroupId;
        }
        properties["twinGroup"] = twinGroupId;

        var insertRank = this.DG.ranks[personId];

        // find the best order to use for this new vertex: scan all orders on the rank, check number of crossed edges
        var insertOrder = this.DG.findBestTwinInsertPosition(personId, []);

        // insert the vertex into the base graph and update ranks, orders & positions
        var childhubId = this.DG.GG.getInEdges(personId)[0];
        var newNodeId = this._insertVertex(TYPE.PERSON, properties, 1.0, childhubId, null, insertRank, insertOrder);

        // validate: by now the graph should satisfy all assumptions
        this.DG.GG.validate();

        // fix common layout mistakes (e.g. relationship not right above the only child)
        this._heuristics.improvePositioning(ranksBefore, rankYBefore);

        var movedNodes = this._findMovedNodes( numNodesBefore, positionsBefore, ranksBefore, vertLevelsBefore, rankYBefore );
        if (!arrayContains(movedNodes, parentRel))
            movedNodes.push(parentRel);
        var animateNodes = this.DG.GG.getInEdges(parentRel).slice(0);  // animate parents if they move. if not, nothing will be done with them
        animateNodes.push(personId);
        var newNodes   = [newNodeId];
        return {"new": newNodes, "moved": movedNodes, "animate": animateNodes};
    },

    removeNodes: function( nodeList )
    {
        this._debugPrintAll("before");

        //var positionsBefore  = this.DG.positions.slice(0);
        //var ranksBefore      = this.DG.ranks.slice(0);
        //var vertLevelsBefore = this.DG.vertLevel.copy();
        //var rankYBefore      = this.DG.rankY.slice(0);
        //var consangrBefore   = this.DG.consangr;
        //var numNodesBefore   = this.DG.GG.getMaxRealVertexId();

        var removed = nodeList.slice(0);
        removed.sort();
        var moved = [];

        for (var i = 0; i < nodeList.length; i++) {
            if (this.isRelationship(nodeList[i])) {
                // also add its childhub
                var chHub = this.DG.GG.getOutEdges(nodeList[i])[0];
                nodeList.push(chHub);
                console.log("adding " + chHub + " to removal list (chhub of " + nodeList[i] + ")");

                // also add its long multi-rank edges
                var pathToParents = this.getPathToParents(nodeList[i]);
                for (var p = 0; p < pathToParents.length; p++) {
                    for (var j = 0; j < pathToParents[p].length; j++)
                        if (this.DG.GG.isVirtual(pathToParents[p][j])) {
                            console.log("adding " + pathToParents[p][j] + " to removal list (virtual of " + nodeList[i] + ")");
                            nodeList.push(pathToParents[p][j]);
                        }
                }
            }
        }

        nodeList.sort(function(a,b){return a-b;});

        //console.log("nodeList: " + stringifyObject(nodeList));

        for (var i = nodeList.length-1; i >= 0; i--) {
            var v = nodeList[i];
            //console.log("removing: " + v);

            //// add person't relationship to the list of moved nodes
            //if (this.isPerson(v)) {
            //    var rel = this.DG.GG.getProducingRelationship(v);
            //    // rel may have been already removed
            //    if (rel !== null && !arrayContains(nodeList, rel))
            //        moved.push(rel);
            //}

            this.DG.GG.remove(v);
            //console.log("order before: " + stringifyObject(this.DG.order));
            this.DG.order.remove(v, this.DG.ranks[v]);
            //console.log("order after: " + stringifyObject(this.DG.order));
            this.DG.ranks.splice(v,1);
            this.DG.positions.splice(v, 1);

            //// update moved IDs accordingly
            //for (var m = 0; m < moved.length; m++ ) {
            //    if (moved[m] > v)
            //        moved[m]--;
            //}
        }

        this.DG.maxRank = Math.max.apply(null, this.DG.ranks);

        this.DG.GG.validate();

        // note: do not update rankY, as we do not want to move anything (we know we don't need more Y space after a deletion)
        this.DG.vertLevel = this.DG.positionVertically();
        this.updateAncestors();

        // TODO: for now: redraw all relationships
        for (var i = 0 ; i <= this.getMaxNodeId(); i++)
            if (this.isRelationship(i))
                moved.push(i);

        // note: _findMovedNodes() does not work when IDs have changed. TODO
        //var movedNodes = this._findMovedNodes( numNodesBefore, positionsBefore, ranksBefore, vertLevelsBefore, rankYBefore );
        //for (var i = 0; i < moved.length; i++)
        //    if (!arrayContains(movedNodes, moved[i]))
        //        movedNodes.push(moved[i]);

        // note: moved now has the correct IDs valid in the graph with all affected nodes removed
        return {"removed": removed, "removedInternally": nodeList, "moved": moved };
    },

    improvePosition: function ()
    {
        //this.DG.positions = this.DG.position(this.DG.horizontalPersonSeparationDist, this.DG.horizontalRelSeparationDist);
        //var movedNodes = this._getAllNodes();
        //return {"moved": movedNodes};
        var positionsBefore  = this.DG.positions.slice(0);
        var ranksBefore      = this.DG.ranks.slice(0);
        var vertLevelsBefore = this.DG.vertLevel.copy();
        var rankYBefore      = this.DG.rankY.slice(0);
        var numNodesBefore   = this.DG.GG.getMaxRealVertexId();

        // fix common layout mistakes (e.g. relationship not right above the only child)
        this._heuristics.improvePositioning(ranksBefore, rankYBefore);

        var movedNodes = this._findMovedNodes( numNodesBefore, positionsBefore, ranksBefore, vertLevelsBefore, rankYBefore );

        return {"moved": movedNodes};
    },

    clearAll: function()
    {
        var removedNodes = this._getAllNodes(1);  // all nodes from 1 and up

        var emptyGraph = (this.DG.GG.getNumVertices() == 0);
                
        var node0properties = emptyGraph ? {} : this.getProperties(0);

        // it is easier to create abrand new graph transferirng node 0 propertie sthna to remove on-by-one
        // each time updating ranks, orders, etc

        var baseGraph = PedigreeImport.initFromPhenotipsInternal(this._onlyProbandGraph);

        this._recreateUsingBaseGraph(baseGraph);

        this.setProperties(0, node0properties);

        if (emptyGraph)
            return {"new": [0], "makevisible": [0]};
            
        return {"removed": removedNodes, "moved": [0], "makevisible": [0]};
    },

    redrawAll: function (animateList, newList, ranksBefore)
    {
        var ranksBefore = ranksBefore ? ranksBefore : this.DG.ranks.slice(0);  // sometimes we want to use ranksbefore as they were before some stuff was added to the graph before a redraw

        this._debugPrintAll("before");

        var baseGraph = this.DG.GG.makeGWithCollapsedMultiRankEdges();

        // collect current node ranks so that the new layout can be made more similar to the current one
        var oldRanks = clone2DArray(this.DG.order.order);
        for (var i = oldRanks.length - 1; i >=0; i--) {
            oldRanks[i] = oldRanks[i].filter(this.DG.GG.isPerson.bind(this.DG.GG));
            if (oldRanks[i].length == 0)
                oldRanks.splice(i, 1);
        }

        if (!this._recreateUsingBaseGraph(baseGraph, oldRanks)) return {};  // no changes

        var movedNodes = this._getAllNodes();

        var probandReRankSize = (ranksBefore[0] - this.DG.ranks[0]);
        var reRankedDiffFrom0 = [];
        var reRanked          = [];
        for (var i = 0; i <= this.DG.GG.getMaxRealVertexId(); i++) {
            if (this.DG.GG.isPerson(i))
                if (this.DG.ranks[i] != ranksBefore[i]) {
                    reRanked.push(i);
                }
            if ((ranksBefore[i] - this.DG.ranks[i]) != probandReRankSize) {
                reRankedDiffFrom0.push(i);
            }
        }
        if (reRankedDiffFrom0.length < reRanked.length) {
            reRanked = reRankedDiffFrom0;
        }

        if (!animateList) animateList = [];

        if (!newList)
            newList = [];
        else {
            // nodes which are force-marked as new can't be in the "moved" list
            for (var i = 0; i < newList.length; i++)
                removeFirstOccurrenceByValue(movedNodes, newList[i]);
        }

        this._debugPrintAll("after");

        return {"new": newList, "moved": movedNodes, "highlight": reRanked, "animate": animateList};
    },

    // remove empty-values optional properties, e.g. "fName: ''" or "disorders: []"
    stripUnusedProperties: function() {
        for (var i = 0; i <= this.DG.GG.getMaxRealVertexId(); i++) {
            if (this.isPerson(i)) {
                this.deleteEmptyProperty(i, "fName");
                this.deleteEmptyProperty(i, "lName");
                this.deleteEmptyProperty(i, "gestationAge");
                this.deleteEmptyProperty(i, "carrierStatus");
                this.deleteEmptyProperty(i, "comments");
                this.deleteEmptyProperty(i, "disorders");
            }            
        }
    },
    
    deleteEmptyProperty: function(nodeID, propName) {        
        if (this.DG.GG.properties[nodeID].hasOwnProperty(propName)) {
            if (Object.prototype.toString.call(this.DG.GG.properties[nodeID][propName]) === "[object Array]" &&
                this.DG.GG.properties[nodeID][propName].length == 0) {
                delete this.DG.GG.properties[nodeID][propName];
            } else if (this.DG.GG.properties[nodeID][propName] == "") { 
                delete this.DG.GG.properties[nodeID][propName];
            }
        }
    },
    
    toJSON: function ()
    {
        this.stripUnusedProperties();
        
        //var timer = new Timer();
        var output = {};
        
        // note: when saving positioned graph, need to save the version of the graph which has virtual edge pieces
        output["GG"] = this.DG.GG.serialize();

        output["ranks"]     = this.DG.ranks;
        output["order"]     = this.DG.order.serialize();
        output["positions"] = this.DG.positions;

        // note: everything else can be recomputed based on the information above

        console.log("JSON represenation: " + JSON.stringify(output));
        //timer.printSinceLast("=== to JSON: ");

        return JSON.stringify(output);
    },

    fromJSON: function (serializedAsJSON)
    {
        var removedNodes = this._getAllNodes();

        var serializedData = JSON.parse(serializedAsJSON);

        //console.log("Got serialization object: " + stringifyObject(serializedData));

        this.DG.GG = PedigreeImport.initFromPhenotipsInternal(serializedData["GG"]);

        this.DG.ranks = serializedData["ranks"];

        this.DG.maxRank = Math.max.apply(null, this.DG.ranks);

        this.DG.order.deserialize(serializedData["order"]);

        this.DG.positions = serializedData["positions"];

        this._updateauxiliaryStructures();

        this.screenRankShift = 0;

        var newNodes = this._getAllNodes();

        return {"new": newNodes, "removed": removedNodes};
    },

    fromImport: function (importString, importType, importOptions)
    {
        var removedNodes = this._getAllNodes();

        //this._debugPrintAll("before");

        if (importType == "ped") {
            var baseGraph = PedigreeImport.initFromPED(importString, importOptions.acceptUnknownPhenotypes, importOptions.markEvaluated, importOptions.externalIdMark);
            if (!this._recreateUsingBaseGraph(baseGraph)) return null;  // no changes
        } else if (importType == "BOADICEA") {
            var baseGraph = PedigreeImport.initFromBOADICEA(importString, importOptions.externalIdMark);
            if (!this._recreateUsingBaseGraph(baseGraph)) return null;  // no changes
        } else if (importType == "gedcom") {
            var baseGraph = PedigreeImport.initFromGEDCOM(importString, importOptions.markEvaluated, importOptions.externalIdMark);
            if (!this._recreateUsingBaseGraph(baseGraph)) return null;  // no changes
        } else if (importType == "simpleJSON") {
            var baseGraph = PedigreeImport.initFromSimpleJSON(importString);
            if (!this._recreateUsingBaseGraph(baseGraph)) return null;  // no changes            
        }  else if (importType == "phenotipsJSON") {
            
            // TODO
        }

        //this._debugPrintAll("after");

        var newNodes = this._getAllNodes();

        return {"new": newNodes, "removed": removedNodes};
    },

    getPathToParents: function(v)
    {
        // returns an array with two elements: path to parent1 (excluding v) and path to parent2 (excluding v):
        // [ [virtual_node_11, ..., virtual_node_1n, parent1], [virtual_node_21, ..., virtual_node_2n, parent21] ]
        return this.DG.GG.getPathToParents(v);
    },

    //=============================================================

    // suggestedRanks: when provided, attempt to use the suggested rank for all nodes,
    //                 in order to keep the new layout as close as possible to the previous layout
    _recreateUsingBaseGraph: function (baseGraph, suggestedRanks)
    {
        try {
            var newDG = new PositionedGraph( baseGraph,
                                             this.DG.horizontalPersonSeparationDist,
                                             this.DG.horizontalRelSeparationDist,
                                             this.DG.maxInitOrderingBuckets,
                                             this.DG.maxOrderingIterations,
                                             this.DG.maxXcoordIterations,
                                             false,
                                             suggestedRanks );
        } catch (e) {
            console.trace(e);
            return false;
        }

        this.DG          = newDG;
        this._heuristics = new Heuristics( this.DG );

        //this._debugPrintAll("before improvement");
        this._heuristics.improvePositioning();
        //this._debugPrintAll("after improvement");

        return true;
    },

    _insertVertex: function (type, properties, edgeWeights, inedge, outedge, insertRank, insertOrder)
    {
        // all nodes are connected to some other node, so either inedge or outedge should be given
        if (inedge === null && outedge === null)
            throw "Assertion failed: each node should be connected to at least one other node";
        if (inedge !== null && outedge !== null)
            throw "Assertion failed: not clear which edge crossing to optimize, can only insert one edge";

        var inedges  = (inedge  !== null) ? [inedge]  : [];
        var outedges = (outedge !== null) ? [outedge] : [];

        var newNodeId = this.DG.GG.insertVertex(type, properties, edgeWeights, inedges, outedges);

        // note: the graph may be inconsistent at this point, e.g. there may be childhubs with
        // no relationships or relationships without any people attached

        if (insertRank == 0) {
            for (var i = 0; i < this.DG.ranks.length; i++)
                this.DG.ranks[i]++;
            this.DG.maxRank++;

            this.DG.order.insertRank(1);

            insertRank = 1;
        }
        else if (insertRank > this.DG.maxRank) {
            this.DG.maxRank = insertRank;
            this.DG.order.insertRank(insertRank);
        }

        this.DG.ranks.splice(newNodeId, 0, insertRank);

        this.DG.order.insertAndShiftAllIdsAboveVByOne(newNodeId, insertRank, insertOrder);

        // update positions
        this.DG.positions.splice( newNodeId, 0, -Infinity );  // temporary position: will move to the correct location and shift other nodes below

        var nodeToKeepEdgeStraightTo = (inedge != null) ? inedge : outedge;
        this._heuristics.moveToCorrectPositionAndMoveOtherNodesAsNecessary( newNodeId, nodeToKeepEdgeStraightTo );

        return newNodeId;
    },

    _updateauxiliaryStructures: function(ranksBefore, rankYBefore)
    {
        var timer = new Timer();

        // update vertical levels
        this.DG.vertLevel = this.DG.positionVertically();
        this.DG.rankY     = this.DG.computeRankY(ranksBefore, rankYBefore);

        // update ancestors
        this.updateAncestors();

        timer.printSinceLast("=== Vertical spacing + ancestors runtime: ");
    },

    _getAllNodes: function (minID, maxID)
    {
        var nodes = [];
        var minID = minID ? minID : 0;
        var maxID = maxID ? Math.min( maxID, this.DG.GG.getMaxRealVertexId()) : this.DG.GG.getMaxRealVertexId();
        for (var i = minID; i <= maxID; i++) {
            if ( this.DG.GG.type[i] == TYPE.PERSON || this.DG.GG.type[i] == TYPE.RELATIONSHIP )
                nodes.push(i);
        }
        return nodes;
    },

    _findMovedNodes: function (maxOldID, positionsBefore, ranksBefore, vertLevelsBefore, rankYBefore, consangrBefore)
    {
        //console.log("Before: " + stringifyObject(vertLevelsBefore));
        //console.log("After:  " + stringifyObject(this.DG.vertLevel));
        //console.log("Before: " + stringifyObject(positionsBefore));
        //console.log("After: " + stringifyObject(this.DG.positions));

        // TODO: some heuristics cause this behaviour. Easy to fix by normalization, but better look into root cause later
        // normalize positions: if the leftmost coordinate is now greater than it was before
        // make the old leftmost node keep it's coordinate
        var oldMin = Math.min.apply( Math, positionsBefore );
        var newMin = Math.min.apply( Math, this.DG.positions );
        if (newMin > oldMin) {
            var oldMinNodeID = arrayIndexOf(positionsBefore, oldMin);
            var newMinValue  = this.DG.positions[oldMinNodeID];
            var shiftAmount  = newMinValue - oldMin;

            for (var i = 0; i < this.DG.positions.length; i++)
                this.DG.positions[i] -= shiftAmount;
        }


        var result = {};
        for (var i = 0; i <= maxOldID; i++) {
            // this node was moved
            if (this.DG.GG.type[i] == TYPE.RELATIONSHIP || this.DG.GG.type[i] == TYPE.PERSON)
            {
                var rank = this.DG.ranks[i];
                //if (rank != ranksBefore[i]) {
                //    this._addNodeAndAssociatedRelationships(i, result, maxOldID);
                //    continue;
                //}
                if (rankYBefore && this.DG.rankY[rank] != rankYBefore[ranksBefore[i]]) {
                    this._addNodeAndAssociatedRelationships(i, result, maxOldID);
                    continue;
                }
                if (this.DG.positions[i] != positionsBefore[i]) {
                    this._addNodeAndAssociatedRelationships(i, result, maxOldID);
                    continue;
                }
                // or it is a relationship with a long edge - redraw just in case since long edges may have complicated curves around other nodes
                if (this.DG.GG.type[i] == TYPE.RELATIONSHIP) {
                    if (consangrBefore && !consangrBefore.hasOwnProperty(i) && this.DG.consangr.hasOwnProperty(i)) {
                        result[i] = true;
                        continue;
                    }
                    var inEdges = this.DG.GG.getInEdges(i);
                    if (inEdges[0] > this.DG.GG.maxRealVertexId || inEdges[1] > this.DG.GG.maxRealVertexId) {
                        result[i] = true;
                        continue;
                    }
                    // check vertical positioning changes
                    var parents = this.DG.GG.getParents(i);
                    if (vertLevelsBefore.outEdgeVerticalLevel[parents[0]] !== undefined &&    // vertical levels may be outdated if multiple nodes were created in one batch
                        vertLevelsBefore.outEdgeVerticalLevel[parents[1]] !== undefined) {
                        if (vertLevelsBefore.outEdgeVerticalLevel[parents[0]][i].verticalLevel !=  this.DG.vertLevel.outEdgeVerticalLevel[parents[0]][i].verticalLevel ||
                            vertLevelsBefore.outEdgeVerticalLevel[parents[1]][i].verticalLevel !=  this.DG.vertLevel.outEdgeVerticalLevel[parents[1]][i].verticalLevel)
                        {
                            result[i] = true;
                            continue;
                        }
                    }

                    var childHub = this.DG.GG.getRelationshipChildhub(i);
                    if (vertLevelsBefore.childEdgeLevel[childHub] !== undefined && vertLevelsBefore.childEdgeLevel[childHub] != this.DG.vertLevel.childEdgeLevel[childHub]) {
                        result[i] = true;
                        continue;
                    }
                }
            }
        }

        var resultArray = [];
        for (var node in result) {
            if (result.hasOwnProperty(node)) {
                resultArray.push(parseInt(node));
            }
        }

        return resultArray;
    },

    _addNodeAndAssociatedRelationships: function ( node, addToSet, maxOldID )
    {
        addToSet[node] = true;
        if (this.DG.GG.type[node] != TYPE.PERSON) return;

        var inEdges = this.DG.GG.getInEdges(node);
        if (inEdges.length > 0) {
            var parentChildhub     = inEdges[0];
            var parentRelationship = this.DG.GG.getInEdges(parentChildhub)[0];
            if (parentRelationship <= maxOldID)
                addToSet[parentRelationship] = true;
        }

        var outEdges = this.DG.GG.getOutEdges(node);
        for (var i = 0; i < outEdges.length; i++) {
            if (outEdges[i] <= maxOldID)
                addToSet[ outEdges[i] ] = true;
        }
    },

    //=============================================================

    _addMultiRankEdge: function ( personId, relationshipId, _weight )
    {
        var weight = _weight ? _weight : 1.0;

        var rankPerson       = this.DG.ranks[personId];
        var rankRelationship = this.DG.ranks[relationshipId];

        if (rankPerson > rankRelationship - 2)
            throw "Assertion failed: attempt to make a multi-rank edge between non-multirank ranks";

        var otherpartner   = this.DG.GG.getInEdges(relationshipId)[0];

        var order_person   = this.DG.order.vOrder[personId];
        var order_rel      = this.DG.order.vOrder[relationshipId];

        var x_person       = this.DG.positions[otherpartner];
        var x_relationship = this.DG.positions[relationshipId];

        var prevPieceOrder = (x_person < x_relationship) ? (order_rel+1) : order_rel;
        var prevPieceId    = this._insertVertex(TYPE.VIRTUALEDGE, {}, weight, null, relationshipId, rankRelationship, prevPieceOrder);

        // TODO: an algorithm which optimizes the entire edge placement globally (not one piece at a time)

        var rankNext = rankRelationship;
        while (--rankNext > rankPerson) {

            var prevNodeX = this.DG.positions[prevPieceId];
            var orderToMakeEdgeStraight = this.DG.order.order[rankNext].length;
            for (var o = 0; o < this.DG.order.order[rankNext].length; o++)
                if (this.DG.positions[this.DG.order.order[rankNext][o]] >= prevNodeX) {
                    orderToMakeEdgeStraight = o;
                    break;
                }

            console.log("adding piece @ rank: " + rankNext + " @ order " + orderToMakeEdgeStraight);

            prevPieceId = this._insertVertex(TYPE.VIRTUALEDGE, {}, weight, null, prevPieceId, rankNext, orderToMakeEdgeStraight);
        }

        //connect last piece with personId
        this.DG.GG.addEdge(personId, prevPieceId, weight);
    },


    //=============================================================

    _findBestInsertPosition: function ( rank, edgeToV, preferLeft, _fromOrder, _toOrder )
    {
        // note: does not assert that the graph satisfies all the assumptions in BaseGraph.validate()

        if (rank == 0 || rank > this.DG.maxRank)
            return 0;

        // find the order on rank 'rank' to insert a new vertex so that the edge connecting this new vertex
        // and vertex 'edgeToV' crosses the smallest number of edges.
        var edgeToRank      = this.DG.ranks[ edgeToV ];
        var edgeToOrder     = this.DG.order.vOrder[edgeToV];

        if (edgeToRank == rank && this.isPerson(edgeToV))
            return this._findBestRelationshipPosition( edgeToV, preferLeft );

        var bestInsertOrder  = 0;
        var bestCrossings    = Infinity;
        var bestDistance     = Infinity;

        var crossingChildhubEdgesPenalty = false;
        if (this.DG.GG.type[edgeToV] == TYPE.CHILDHUB)
            crossingChildhubEdgesPenalty = true;

        var desiredOrder = 0;

        var edgeToX = this.DG.positions[edgeToV];
        for (var o = 0; o < this.DG.order.order[rank].length; o++) {
            var uAtPos = this.DG.order.order[rank][o];
            var uX     = this.DG.positions[uAtPos];
            if (uX < edgeToX) {
                desiredOrder = o+1;
            }
            else {
                break;
            }
        }

        // when inserting children below childhubs: next to other children
        if (this.DG.GG.type[edgeToV] == TYPE.CHILDHUB && rank > edgeToRank && this.DG.GG.getOutEdges(edgeToV).length > 0)
            desiredOrder = this._findRightmostChildPosition(edgeToV) + 1;

        var fromOrder = _fromOrder ? Math.max(_fromOrder,0) : 0;
        var toOrder   = _toOrder   ? Math.min(_toOrder,this.DG.order.order[rank].length) : this.DG.order.order[rank].length;
        for (var o = fromOrder; o <= toOrder; o++) {

            // make sure not inserting inbetween some twins
            if (o > 0 && o < this.DG.order.order[rank].length) {
                // skip virtual edges which may appear between twins
                var leftNodePos = o-1;
                while (leftNodePos > 0 && this.DG.GG.isVirtual(this.DG.order.order[rank][leftNodePos]))
                    leftNodePos--;
                rightNodePos = o;
                while (rightNodePos < this.DG.order.order[rank].length-1 && this.DG.GG.isVirtual(this.DG.order.order[rank][rightNodePos]))
                    rightNodePos--;
                var nodeToTheLeft  = this.DG.order.order[rank][leftNodePos];
                var nodeToTheRight = this.DG.order.order[rank][rightNodePos];

                if (this.isPerson(nodeToTheLeft) && this.isPerson(nodeToTheRight)) {
                    var rel1 = this.DG.GG.getProducingRelationship(nodeToTheLeft);
                    var rel2 = this.DG.GG.getProducingRelationship(nodeToTheRight);
                    if (rel1 == rel2) {
                        var twinGroupId1 = this.DG.GG.getTwinGroupId(nodeToTheLeft);
                        var twinGroupId2 = this.DG.GG.getTwinGroupId(nodeToTheRight);
                        if (twinGroupId1 !== null && twinGroupId1 == twinGroupId2)
                            continue;
                    }
                }
            }

            var numCrossings = this._edgeCrossingsByFutureEdge( rank, o - 0.5, edgeToRank, edgeToOrder, crossingChildhubEdgesPenalty, edgeToV );

            //console.log("position: " + o + ", numCross: " + numCrossings);

            if ( numCrossings < bestCrossings ||                           // less crossings
                 (numCrossings == bestCrossings && Math.abs(o - desiredOrder) <= bestDistance )   // closer to desired position
               ) {
                bestInsertOrder = o;
                bestCrossings   = numCrossings;
                bestDistance    = Math.abs(o - desiredOrder);
            }
        }

        //console.log("inserting @ rank " + rank + " with edge from " + edgeToV + " --> " + bestInsertOrder);
        return bestInsertOrder;
    },

    _findRightmostChildPosition: function ( vertex )
    {
        var childrenInfo = this._heuristics.analizeChildren(vertex);
        return childrenInfo.rightMostChildOrder;
    },

    _edgeCrossingsByFutureEdge: function ( newVRank, newVOrder, existingURank, existingUOrder, crossingChildhubEdgesPenalty, existingU )
    {
        // Note: newVOrder is expected to be a number between two existing orders, or higher than all, or lower than all

        // counts how many existing edges a new edge from given rank&order to given rank&order would cross
        // if order is an integer, it is assumed it goes form an existing vertex
        // if order is inbetween two integers, it is assumed it is the position used for a new-to-be-inserted vertex

        // for simplicity (to know if we need to check outEdges or inEdges) get the edge in the correct direction
        // (i.e. from lower ranks to higher ranks)
        var rankFrom  = Math.min( newVRank, existingURank );
        var rankTo    = Math.max( newVRank, existingURank );
        var orderFrom = (newVRank < existingURank) ? newVOrder : existingUOrder;
        var orderTo   = (newVRank < existingURank) ? existingUOrder : newVOrder;

        // for better penalty computation handle the special case of adding a new child to an existing childhub
        var vSibglingInfo = undefined;
        if (this.DG.GG.isChildhub(existingU) && (newVRank > existingURank) &&
            this.DG.GG.getOutEdges(existingU).length > 0) {
            vSibglingInfo = this._heuristics.analizeChildren(existingU);

            if (vSibglingInfo.numWithTwoPartners < vSibglingInfo.orderedChildren.length) {
                // need to insert new node next to a sibling
                var okPosition = false;
                if (newVOrder > 0) {                                         // check left neighbour
                    var leftNeighbour = this.DG.order.order[newVRank][ Math.floor(newVOrder)];
                    var neighbourInEdges = this.DG.GG.getInEdges(leftNeighbour);
                    if (neighbourInEdges.length == 1 && neighbourInEdges[0] == existingU) {
                        okPosition = true;  // left neighbour is a sibling
                    }
                }
                if (newVOrder < this.DG.order.order[newVRank].length - 1) {  // check right neighbour
                    var rightNeighbour = this.DG.order.order[newVRank][ Math.ceil(newVOrder)];
                    var neighbourInEdges = this.DG.GG.getInEdges(rightNeighbour);
                    if (neighbourInEdges.length == 1 && neighbourInEdges[0] == existingU) {
                        okPosition = true;  // right neighbour is a sibling
                    }
                }
                if (!okPosition) {
                    return Infinity;
                }
            }
        }

        var crossings = 0;

        if (rankFrom == rankTo) throw "TODO: probably not needed";

        // For multi-rank edges, crossing occurs if either
        // 1) there is an edge going from rank[v]-ranked vertex with a smaller order
        //     than v to a rank[targetV]-ranked vertex with a larger order than targetV
        // 2) there is an edge going from rank[v]-ranked vertex with a larger order
        //     than v to a rank[targetV]-ranked vertex with a smaller order than targetV

        var verticesAtRankTo = this.DG.order.order[ rankTo ];

        for (var ord = 0; ord < verticesAtRankTo.length; ord++) {
            if ( ord == orderTo ) continue;

            var vertex = verticesAtRankTo[ord];

            var inEdges = this.DG.GG.getInEdges(vertex);
            var len     = inEdges.length;

            for (var j = 0; j < len; j++) {
                var target = inEdges[j];

                var penalty = 1;
                if (crossingChildhubEdgesPenalty && this.DG.GG.isChildhub(target)) {
                    // don't want to insert a node inbetween siblings
                    penalty = 100000;
                    // ...unless siblings of the inserted node are already inbetween those siblings:
                    if (vSibglingInfo) {
                        var targetChildren = this._heuristics.analizeChildren(target);

                        if (targetChildren.leftMostChildOrder < vSibglingInfo.rightMostChildOrder &&
                            targetChildren.rightMostChildOrder > vSibglingInfo.leftMostChildOrder) {
                            penalty = 1;
                        }
                    }
                }

                var orderTarget = this.DG.order.vOrder[target];
                var rankTarget  = this.DG.ranks[target];

                if (rankTarget == rankTo)
                {
                    if ( ord < orderTo && orderTarget > orderTo ||
                         ord > orderTo && orderTarget < orderTo )
                        crossings += 2;
                }
                else
                {
                    if (ord < orderTo && orderTarget > orderFrom ||
                        ord > orderTo && orderTarget < orderFrom )
                        crossings += penalty;
                }
            }
        }

        // try not to insert between a node and it's relationship
        // (for that only need check edges on the insertion rank)
        var verticesAtNewRank = this.DG.order.order[ newVRank ];
        for (var ord = 0; ord < verticesAtNewRank.length; ord++) {
            if ( ord == newVOrder ) continue;

            var vertex = verticesAtNewRank[ord];

            var outEdges = this.DG.GG.getOutEdges(vertex);
            var len      = outEdges.length;

            for (var j = 0; j < len; j++) {
                var target = outEdges[j];

                var orderTarget = this.DG.order.vOrder[target];
                var rankTarget  = this.DG.ranks[target];

                if (rankTarget == newVRank)
                {
                    if ( newVOrder < ord && newVOrder > orderTarget ||
                         newVOrder > ord && newVOrder < orderTarget )
                        crossings += 0.1;
                }
            }
        }


        return crossings;
    },

    _findBestRelationshipPosition: function ( v, preferLeft, u )
    {
        // Handles two different cases:
        // 1) both partners are given ("v" and "u"). Then need to insert between v and u
        // 2) only one partner is given ("v"). Then given the choice prefer the left side if "preferleft" is true

        var rank   = this.DG.ranks[v];
        var orderR = this.DG.order.order[rank];
        var isTwin = (this.DG.GG.getTwinGroupId(v) != null);
        var vOrder = this.DG.order.vOrder[v];

        var penaltyBelow    = [];
        var penaltySameRank = [];
        for (var o = 0; o <= orderR.length; o++) {
            penaltyBelow[o]    = 0;
            penaltySameRank[o] = 0;
        }

        // for each order on "rank" compute heuristic penalty for inserting a node before that order
        // based on the structure of nodes below
        for (var o = 0; o < orderR.length; o++) {
            var node = orderR[o];
            if (!this.isRelationship(node)) continue;
            var childrenInfo = this._heuristics.analizeChildren(node);

            // TODO: do a complete analysis without any heuristics
            if (childrenInfo.leftMostHasLParner)  { penaltyBelow[o]   += 1; penaltyBelow[o-1] += 0.25; }   // 0.25 is just a heuristic estimation of how busy the level below is.
            if (childrenInfo.rightMostHasRParner) { penaltyBelow[o+1] += 1; penaltyBelow[o+2] += 0.25; }
        }

        // for each order on "rank" compute heuristic penalty for inserting a node before that order
        // based on the edges on that rank
        for (var o = 0; o < orderR.length; o++) {
            var node = orderR[o];
            if (!this.isRelationship(node)) continue;

            var relOrder = this.DG.order.vOrder[node];

            var parents = this.DG.GG.getInEdges(node);

            for (var p = 0; p < parents.length; p++) {
                var parent = parents[p];
                if (parent != v && this.DG.ranks[parent] == rank && parent != u) {
                    var parentOrder = this.DG.order.vOrder[parent];

                    var from = (parentOrder > relOrder) ? relOrder + 1 : parentOrder + 1;
                    var to   = (parentOrder > relOrder) ? parentOrder : relOrder;
                    for (var j = from; j <= to; j++)
                        penaltySameRank[j] = Infinity;
                }
            }
        }

        // add penalties for crossing child-to-parent lines, and forbid inserting inbetween twin nodes
        for (var o = 0; o < orderR.length; o++) {
            if (o == vOrder) continue;

            var node = orderR[o];
            if (!this.isPerson(node)) continue;
            var allTwins = this.getAllTwinsSortedByOrder(node);

            // forbid inserting inbetween twins
            if (allTwins.length > 1) {
                var leftMostTwinOrder  = this.DG.order.vOrder[ allTwins[0] ];
                var rightMostTwinOrder = this.DG.order.vOrder[ allTwins[allTwins.length-1] ];
                for (var j = leftMostTwinOrder+1; j <= rightMostTwinOrder; j++)
                    penaltySameRank[j] = Infinity;
                o = rightMostTwinOrder; // skip thorugh all other twins in this group
            }

            // penalty for crossing peron-to-parent line
            if (this.DG.GG.getProducingRelationship(node) != null) {
                if (o < vOrder) {
                    for (var j = 0; j <= o; j++)
                        penaltySameRank[j]++;
                }
                else {
                    for (var j = o+1; j <= orderR.length; j++)
                        penaltySameRank[j]++;
                }
            }
        }

        console.log("Insertion same rank penalties: " + stringifyObject(penaltySameRank));
        console.log("Insertion below penalties:     " + stringifyObject(penaltyBelow));

        if (u === undefined) {
            if (preferLeft && vOrder == 0) return 0;

            var partnerInfo = this.DG._findLeftAndRightPartners(v);
            var numLeftOf   = partnerInfo.leftPartners.length;
            var numRightOf  = partnerInfo.rightPartners.length;

            // Note: given everything else being equal, prefer the right side - to move fewer nodes

            console.log("v: " + v + ", vOrder: " + vOrder + ", numL: " + numLeftOf + ", numR: " + numRightOf);

            if (!isTwin && numLeftOf  == 0 && (preferLeft || numRightOf > 0) ) return vOrder;
            if (!isTwin && numRightOf == 0 )                                   return vOrder + 1;

            var bestPosition = vOrder + 1;
            var bestPenalty  = Infinity;
            for (var o = 0; o <= orderR.length; o++) {
                var penalty = penaltyBelow[o] + penaltySameRank[o];
                if (o <= vOrder) {
                    penalty += numLeftOf + (vOrder - o);        // o == order     => insert immediately to the left of, distance penalty = 0
                    if (preferLeft)
                        penalty -= 0.5;   // preferLeft => given equal penalty prefer left (0.5 is less than penalty diff due to other factors)
                    else
                        penalty += 0.5;   //
                }
                else {
                    penalty += numRightOf + (o - vOrder - 1);   // o == (order+1) => insert immediately to the right of, distance penalty = 0
                }

                //console.log("order: " + o + ", penalty: " + penalty);
                if (penalty < bestPenalty) {
                    bestPenalty  = penalty;
                    bestPosition = o;
                }
            }
            return bestPosition;
        }

        // for simplicity, lets make sure v is to the left of u
        if (this.DG.order.vOrder[v] > this.DG.order.vOrder[u]) {
            var tmp = u;
            u       = v;
            v       = tmp;
        }

        var orderV = this.DG.order.vOrder[v];
        var orderU = this.DG.order.vOrder[u];

        var partnerInfoV = this.DG._findLeftAndRightPartners(v);
        var numRightOf  = partnerInfoV.rightPartners.length;
        var partnerInfoU = this.DG._findLeftAndRightPartners(u);
        var numLeftOf   = partnerInfoU.leftPartners.length;

        if (numRightOf == 0 && numLeftOf > 0)  return orderV + 1;
        if (numRightOf > 0  && numLeftOf == 0) return orderU;

        var bestPosition = orderV + 1;
        var bestPenalty  = Infinity;
        for (var o = orderV+1; o <= orderU; o++) {
            var penalty = penaltyBelow[o] + penaltySameRank[o];

            for (var p = 0; p < partnerInfoV.rightPartners.length; p++) {
                var partner = partnerInfoV.rightPartners[p];
                if (o <= this.DG.order.vOrder[partner]) penalty++;
            }
            for (var p = 0; p < partnerInfoU.leftPartners.length; p++) {
                var partner = partnerInfoU.leftPartners[p];
                if (o > this.DG.order.vOrder[partner]) penalty++;
            }

            //console.log("order: " + o + ", penalty: " + penalty);

            if (penalty <= bestPenalty) {
                bestPenalty  = penalty;
                bestPosition = o;
            }
        }
        return bestPosition;
    },

    //=============================================================

    _getAllPersonsOfGenders: function (validGendersSet)
    {
        // all person nodes whose gender matches one of genders in the validGendersSet array

        // validate input genders
        for (var i = 0; i < validGendersSet.length; i++) {
            validGendersSet[i] = validGendersSet[i].toLowerCase();
            if (validGendersSet[i] != "u" && validGendersSet[i] != "m" && validGendersSet[i] != "f")
                throw "Invalid gender: " + validGendersSet[i];
        }

        var result = [];

        for (var i = 0; i <= this.DG.GG.getMaxRealVertexId(); i++) {
            if (!this.isPerson(i)) continue;
            if (this.isPersonGroup(i)) continue;
            var gender = this.getProperties(i)["gender"].toLowerCase();
            //console.log("trying: " + i + ", gender: " + gender + ", validSet: " + stringifyObject(validGendersSet));
            if (arrayContains(validGendersSet, gender))
                result.push(i);
        }

        return result;
    }
};
