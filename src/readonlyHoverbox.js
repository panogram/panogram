import { AbstractHoverbox } from './abstractHoverbox';

/**
 * A stub hoverbox used when generating read-only pedigrees
 */
export const ReadOnlyHoverbox = Class.create(AbstractHoverbox, {

  initialize: function($super, node, x, y, shapes) {
    this._node   = node;
    this._nodeX  = x;
    this._nodeY  = y;
    this._shapes = shapes;
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
