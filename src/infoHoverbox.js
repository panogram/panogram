import { AbstractHoverbox } from './abstractHoverbox';
import { PedigreeEditorAttributes } from './pedigreeEditorAttributes';

/**
 * PersonHoverbox is a class for all the UI elements and graphics surrounding a Person node and
 * its labels. This includes the box that appears around the node when it's hovered by a mouse, as
 * well as the handles used for creating connections and creating new nodes.
 *
 * @class PersonHoverbox
 * @extends AbstractHoverbox
 * @constructor
 * @param {Person} personNode The person for whom this hoverbox is being drawn.
 * @param {Number} centerX The X coordinate for the center of the hoverbox
 * @param {Number} centerY The Y coordinate for the center of the hoverbox
 * @param {Raphael.st} nodeShapes All shapes associated with the person node
 */

export const InfoHoverbox = Class.create(AbstractHoverbox, {

  initialize: function($super, personNode, centerX, centerY, nodeShapes) {
    var radius = PedigreeEditorAttributes.personHoverBoxRadius;        
    $super(personNode, -radius, -radius, radius * 2, radius * 2, centerX, centerY, nodeShapes);                
  },

    /**
     * Creates the buttons used in this hoverbox
     *
     * @method generateButtons
     */
  generateButtons: function($super) {  
    if (this._currentButtons !== null) return;
    $super();

    this.generateMenuBtn();
    this.generateDataStatus();

        // proband can't be removed
    // if (!this.getNode().isProband())
    //   this.generateDeleteBtn();
  },

  _generateRadioTickCircle: function(x, y, tick) {
    return editor.getPaper().circle(x, y, 5).attr({'fill': (tick) ? '#000': '#fff'});
  },
  
  generateDataStatus: function() {

    let itemHeight = 12;
    var yPos = this.getY() + PedigreeEditorAttributes.personHoverBoxRadius * 2 - itemHeight;
    var computeItemPosition = function(itemIndex) {
      return yPos + itemHeight * itemIndex;
    };

    var dataPresence = editor.getPaper().set();
    var animatedElements = editor.getPaper().set();

    // var circle = this._generateRadioTickCircle(this.getX()+10, computeItemPosition(0), false);
    //circle.attr({ fill: circleColour });
    const label = this.getNode().getDataPresence() ? 'Clinical data only' : 'Genomic data available';
    var text = editor.getPaper().text(this.getX()+63, computeItemPosition(0), label);
    text.node.setAttribute('class', 'field-no-user-select');
    var rect = editor.getPaper()
    .rect(this.getX(), computeItemPosition(0)-itemHeight/2, this._width-10, itemHeight, 1)
    .attr({ 'stroke-width': 0 });

      // rect.click(function(i) {
      //   tick.attr({'cy' : computeItemPosition(i)});
      // 
      //   var properties = {};
      //   buttons[i].hasOwnProperty('aw') && (properties['setAliveAndWell'] = buttons[i].aw);
      //   properties['setLifeStatus'] = buttons[i].lifeStatus;
      //   var event = { 'nodeID': this.getNode().getID(), 'properties': properties };
      // 
      //   if (buttons[i].lifeStatus == 'deceased') {
      //     this._isDeceasedToggled = true;
      //     var x = tick.getBBox().x;
      //     var y = tick.getBBox().y2;
      //     var position = editor.getWorkspace().canvasToDiv(x, y);
      //     editor.getDeceasedMenu().show(node, position.x, position.y + 10);
      //   }
      //   document.fire('pedigree:node:setproperty', event);
      // }.bind(this, index));

    animatedElements.push(text);
    dataPresence.push(rect);


    dataPresence.push(animatedElements);
    dataPresence.icon = animatedElements;
    //dataPresence.mask = animatedElements;

    if (this._hidden && !this.isMenuToggled()) {
      dataPresence.hide();
    }

    this._currentButtons.push(dataPresence);
    this.disable();
    this.getFrontElements().push(dataPresence);
    this.enable();
  },

    /**
     * Creates a node-shaped show-menu button
     *
     * @method generateMenuBtn
     * @return {Raphael.st} The generated button
     */
  generateMenuBtn: function() {
    var action = () => {
      //me.toggleMenu(!me.isMenuToggled());
      console.info(1);
      window.parent.location.href = this.getNode().getExternalIDHref();
    };
    var genderShapedButton = this.getNode().getGraphics().getGenderShape().clone();
    genderShapedButton.attr(PedigreeEditorAttributes.nodeShapeMenuOff);
    genderShapedButton.click(action);
    // genderShapedButton.hover(function() { genderShapedButton.attr(PedigreeEditorAttributes.nodeShapeMenuOn);},
    //                              function() { genderShapedButton.attr(PedigreeEditorAttributes.nodeShapeMenuOff);});
    genderShapedButton.attr('cursor', 'pointer');
    this._currentButtons.push(genderShapedButton);
    this.disable();
    this.getFrontElements().push(genderShapedButton);
    this.enable();
  },

    /**
     * Returns true if the menu for this node is open
     *
     * @method isMenuToggled
     * @return {Boolean}
     */
  isMenuToggled: function() {
    return this._isMenuToggled;
  },

    /**
     * Shows/hides the menu for this node
     *
     * @method toggleMenu
     */
  toggleMenu: function(isMenuToggled) {
    if (this._justClosedMenu) return;
        //console.log("toggle menu: current = " + this._isMenuToggled);
    this._isMenuToggled = isMenuToggled;
    if(isMenuToggled) {
      this.getNode().getGraphics().unmark();
      var optBBox = this.getBoxOnHover().getBBox();
      var x = optBBox.x2;
      var y = optBBox.y;
      var position = editor.getWorkspace().canvasToDiv(x+5, y);
      editor.getNodeMenu().show(this.getNode(), position.x, position.y);
    }
  },

    /**
     * Hides the hoverbox with a fade out animation
     *
     * @method animateHideHoverZone
     */
  animateHideHoverZone: function($super) {
    this._hidden = true;
    if(!this.isMenuToggled()){
      var parentPartnershipNode = editor.getGraph().getParentRelationship(this.getNode().getID());
            //console.log("Node: " + this.getNode().getID() + ", parentPartnershipNode: " + parentPartnershipNode);            
      if (parentPartnershipNode && editor.getNode(parentPartnershipNode))
        editor.getNode(parentPartnershipNode).getGraphics().unmarkPregnancy();
      $super();
    }
  },

    /**
     * Displays the hoverbox with a fade in animation
     *
     * @method animateDrawHoverZone
     */
  animateDrawHoverZone: function($super) {
    this._hidden = false;
    if(!this.isMenuToggled()){
      var parentPartnershipNode = editor.getGraph().getParentRelationship(this.getNode().getID());
      if (parentPartnershipNode && editor.getNode(parentPartnershipNode))
        editor.getNode(parentPartnershipNode).getGraphics().markPregnancy();
      $super();
    }
  },

    /**
     * Performs the appropriate action for clicking on the handle of type handleType
     *
     * @method handleAction
     * @param {String} handleType "child", "partner" or "parent"
     * @param {Boolean} isDrag True if this handle is being dragged
     */
  handleAction : function(handleType, isDrag, curHoveredId) {        
    console.log('handleType: ' + handleType + ', isDrag: ' + isDrag + ', curHovered: ' + curHoveredId);        
        
    if(isDrag && curHoveredId !== null) {                   
            
      if(handleType == 'parent') {
        this.removeHandles();
        this.removeButtons();
        var event = { 'personID': this.getNode().getID(), 'parentID': curHoveredId };
        document.fire('pedigree:person:drag:newparent', event);
      }
      else if(handleType == 'partnerR' || handleType == 'partnerL') {
        this.removeHandles();                
        event = { 'personID': this.getNode().getID(), 'partnerID': curHoveredId };
        document.fire('pedigree:person:drag:newpartner', event);
      }
      else if(handleType == 'child') {
        event = { 'personID': curHoveredId, 'parentID': this.getNode().getID() };
        document.fire('pedigree:person:drag:newparent', event);                
      }
      else if(handleType == 'sibling') {
        event = { 'sibling2ID': curHoveredId, 'sibling1ID': this.getNode().getID() };
        document.fire('pedigree:person:drag:newsibling', event);                  
      }
    }
    else if (!isDrag) {
      if(handleType == 'partnerR' || handleType == 'partnerL') {
        this.removeHandles();                
        var preferLeft = (this.getNode().getGender() == 'F') || (handleType == 'partnerL');
        event = { 'personID': this.getNode().getID(), 'preferLeft': preferLeft };
        document.fire('pedigree:person:newpartnerandchild', event);
      }
      else if(handleType == 'child') {
        var position = editor.getWorkspace().canvasToDiv(this.getNodeX(), (this.getNodeY() + PedigreeEditorAttributes.personHandleLength + 15));
        editor.getNodetypeSelectionBubble().show(this.getNode(), position.x, position.y);
                // if user selects anything the bubble will fire an even on its own
      }
      else if(handleType == 'sibling') {                
        position = editor.getWorkspace().canvasToDiv(this.getNodeX() - PedigreeEditorAttributes.personSiblingHandleLengthX,
                                                                 this.getNodeY() - PedigreeEditorAttributes.personHandleBreakY+PedigreeEditorAttributes.personSiblingHandleLengthY + 15);
        editor.getSiblingSelectionBubble().show(this.getNode(), position.x, position.y);                
      }
      else if(handleType == 'parent') {
        this.removeHandles();
        this.removeButtons();
        event = { 'personID': this.getNode().getID() };
        document.fire('pedigree:person:newparent', event);
      }
    }
    this.animateHideHoverZone();
  }
});
