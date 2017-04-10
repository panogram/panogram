import { AbstractHoverbox } from './abstractHoverbox';
import { PedigreeEditorAttributes } from './pedigreeEditorAttributes';

/**
 * A stub hoverbox used when generating read-only pedigrees
 */
export const ReadOnlyHoverbox = Class.create(AbstractHoverbox, {

  initialize: function($super, node, centerX, centerY, nodeShapes) {
    this._node   = node;
    this._nodeX  = centerX;
    this._nodeY  = centerY;
    this._shapes = nodeShapes;
    var radius = PedigreeEditorAttributes.personHoverBoxRadius;        
    $super(node, -radius, -radius, radius * 2, radius * 2, centerX, centerY, nodeShapes);
  },

  getNode: function() {
    return this._node;
  },

  getCurrentButtons: function() {
    return this._currentButtons;
  },

  getFrontElements: function() {
    return this._shapes;
  },

  getBackElements: function() {
    return this._shapes;
  },

});
