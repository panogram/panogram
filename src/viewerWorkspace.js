import { Workspace } from './workspace';

export const ViewerWorkspace = Class.create(Workspace, {

  initialize: function() {
    var me = this;
    this.canvas = new Element('div', {'id' : 'canvas'});
    this.workArea = new Element('div', {'id' : 'work-area'}).update(this.canvas);
    if ($('body') && 'jquery' in $('body')) {
      $('#panogram').append(this.workArea);
    }
    else {
      $('panogram').update(this.workArea);
    }
    var screenDimensions = document.viewport.getDimensions();
    this.width = screenDimensions.width;
    this.height = screenDimensions.height - this.canvas.cumulativeOffset().top - 4;
    this._paper = Raphael('canvas',this.width, this.height);
    this.viewBoxX = 0;
    this.viewBoxY = 0;
    this.zoomCoefficient = 1;

    this.background = this.getPaper().rect(0,0, this.width, this.height).attr({fill: 'white', stroke: 'none', opacity: 0}).toBack();
    this.background.node.setAttribute('class', 'panning-background');

    this.adjustSizeToScreen = this.adjustSizeToScreen.bind(this);
    Event.observe (window, 'resize', me.adjustSizeToScreen);
    this.generateViewControls();

        //Initialize pan by dragging
    var start = function() {
      if (editor.isAnyMenuVisible()) {
        return;
      }
      me.background.ox = me.background.attr('x');
      me.background.oy = me.background.attr('y');
            //me.background.attr({cursor: 'url(https://mail.google.com/mail/images/2/closedhand.cur)'});
      me.background.attr({cursor: 'move'});
    };
    var move = function(dx, dy) {
      var deltax = me.viewBoxX - dx/me.zoomCoefficient;
      var deltay = me.viewBoxY - dy/me.zoomCoefficient;

      me.getPaper().setViewBox(deltax, deltay, me.width/me.zoomCoefficient, me.height/me.zoomCoefficient);
      me.background.ox = deltax;
      me.background.oy = deltay;
      me.background.attr({x: deltax, y: deltay });
    };
    var end = function() {
      me.viewBoxX = me.background.ox;
      me.viewBoxY = me.background.oy;
      me.background.attr({cursor: 'default'});
    };
    me.background.drag(move, start, end);

    if (document.addEventListener) {
            // adapted from from raphaelZPD
      me.handleMouseWheel = function(evt) {
        if (evt.preventDefault)
          evt.preventDefault();
        else
                    evt.returnValue = false;

                // disable while menu is active - too easy to scroll and get the active node out of sight, which is confusing
        if (editor.isAnyMenuVisible()) {
          return;
        }

        var delta;
        if (evt.wheelDelta)
          delta = -evt.wheelDelta; // Chrome/Safari
        else
                    delta = evt.detail; // Mozilla

                //console.log("Mouse wheel: " + delta);
        if (delta > 0) {
          var x = $$('.zoom-out')[0];
          $$('.zoom-out')[0].click();
        } else {
          $$('.zoom-in')[0].click();
        }
      };

      if (navigator.userAgent.toLowerCase().indexOf('webkit') >= 0) {
        this.canvas.addEventListener('mousewheel', me.handleMouseWheel, false); // Chrome/Safari
      } else {
        this.canvas.addEventListener('DOMMouseScroll', me.handleMouseWheel, false); // Others
      }
    }
  }
});
