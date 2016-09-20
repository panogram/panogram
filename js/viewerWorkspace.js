var ViewerWorkspace = Class.create(Workspace, {

    initialize: function() {
        var me = this;
        this.canvas = new Element('div', {'id' : 'canvas'});
        this.workArea = new Element('div', {'id' : 'work-area'}).update(this.canvas);
        $('body').update(this.workArea);
        var screenDimensions = document.viewport.getDimensions();
        this.width = screenDimensions.width;
        this.height = screenDimensions.height - this.canvas.cumulativeOffset().top - 4;
        this._paper = Raphael("canvas",this.width, this.height);
        this.viewBoxX = 0;
        this.viewBoxY = 0;
        this.zoomCoefficient = 1;

        this.background = this.getPaper().rect(0,0, this.width, this.height).attr({fill: 'blue', stroke: 'none', opacity: 0}).toBack();
        this.background.node.setAttribute("class", "panning-background");

        this.adjustSizeToScreen = this.adjustSizeToScreen.bind(this);
        Event.observe (window, 'resize', me.adjustSizeToScreen);
        this.generateViewControls();

        //Initialize pan by dragging
        var start = function() {
            if (editor.isAnyMenuVisible()) {
                return;
            }
            me.background.ox = me.background.attr("x");
            me.background.oy = me.background.attr("y");
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
            }

            if (navigator.userAgent.toLowerCase().indexOf('webkit') >= 0) {
                this.canvas.addEventListener('mousewheel', me.handleMouseWheel, false); // Chrome/Safari
            } else {
                this.canvas.addEventListener('DOMMouseScroll', me.handleMouseWheel, false); // Others
            }
        }
    },

    /**
     * Creates the controls for panning and zooming
     *
     * @method generateViewControls
     */
    generateViewControls : function() {
        var _this = this;
        this.__controls = new Element('div', {'class' : 'view-controls'});
        // Pan controls
        this.__pan = new Element('div', {'class' : 'view-controls-pan', title : 'Pan'});
        this.__controls.insert(this.__pan);
        ['up', 'right', 'down', 'left', 'home'].each(function (direction) {
            var faIconClass = (direction == 'home') ? "fa-user" : "fa-arrow-" + direction;
            _this.__pan[direction] = new Element('span', {'class' : 'view-control-pan pan-' + direction + ' fa fa-fw ' + faIconClass, 'title' : 'Pan ' + direction});
            _this.__pan.insert(_this.__pan[direction]);
            _this.__pan[direction].observe('click', function(event) {
                if (direction == 'home') {
                    _this.centerAroundNode(0);
                }
                else if(direction == 'up') {
                    _this.panTo(_this.viewBoxX, _this.viewBoxY - 300);
                }
                else if(direction == 'down') {
                    _this.panTo(_this.viewBoxX, _this.viewBoxY + 300);
                }
                else if(direction == 'left') {
                    _this.panTo(_this.viewBoxX - 300, _this.viewBoxY);
                }
                else {
                    _this.panTo(_this.viewBoxX + 300, _this.viewBoxY);
                }
            })
        });
        // Zoom controls
        var trackLength = 200;
        this.__zoom = new Element('div', {'class' : 'view-controls-zoom', title : 'Zoom'});
        this.__controls.insert(this.__zoom);
        this.__zoom.track  = new Element('div', {'class' : 'zoom-track'});
        this.__zoom.handle = new Element('div', {'class' : 'zoom-handle', title : 'Drag to zoom'});
        this.__zoom['in']  = new Element('div', {'class' : 'zoom-button zoom-in fa fa-fw fa-search-plus', title : 'Zoom in'});
        this.__zoom['out'] = new Element('div', {'class' : 'zoom-button zoom-out fa fa-fw fa-search-minus', title : 'Zoom out'});
        this.__zoom.label  = new Element('div', {'class' : 'zoom-crt-value'});
        this.__zoom.insert(this.__zoom['in']);
        this.__zoom.insert(this.__zoom.track);
        this.__zoom.track.insert(this.__zoom.handle);
        this.__zoom.track.style.height = trackLength + 'px';
        this.__zoom.insert(this.__zoom.out);
        this.__zoom.insert(this.__zoom.label);
        // Scriptaculous slider
        // see also http://madrobby.github.com/scriptaculous/slider/
        //
        // Here a non-linear scale is used: slider positions form [0 to 0.9] correspond to
        // zoom coefficients from 1.25x to 0.25x, and zoom positions from (0.9 to 1]
        // correspond to single deepest zoom level 0.15x
        this.zoomSlider = new Control.Slider(this.__zoom.handle, this.__zoom.track, {
            axis:'vertical',
            minimum: 0,
            maximum: trackLength,
            increment : 1,
            alignY: 6,
            onSlide : function (value) {
                // Called whenever the Slider is moved by dragging.
                // The called function gets the slider value (or array if slider has multiple handles) as its parameter.
                //console.log("new val: " + value + " current coeff: " + _this.zoomCoefficient );
                if (value <= 0.9) {
                    _this.zoom(-value/0.9 + 1.25);
                } else {
                    _this.zoom(0.15);
                }
            },
            onChange : function (value) {
                // Called whenever the Slider has finished moving or has had its value changed via the setSlider Value function.
                // The called function gets the slider value (or array if slider has multiple handles) as its parameter.
                if (value <= 0.9) {
                    _this.zoom(-value/0.9 + 1.25);
                } else {
                    _this.zoom(0.15);
                }
            }
        });
        if (editor.isUnsupportedBrowser()) {
            this.zoomSlider.setValue(0.25 * 0.9); // 0.25 * 0.9 corresponds to zoomCoefficient of 1, i.e. 1:1
                                                  // - for best chance of decent looks on non-SVG browsers like IE8
        } else {
            this.zoomSlider.setValue(0.5 * 0.9);  // 0.5 * 0.9 corresponds to zoomCoefficient of 0.75x
        }
        this.__zoom['in'].observe('click', function(event) {
            if (_this.zoomCoefficient < 0.25)
                _this.zoomSlider.setValue(0.9);   // zoom in from the any value below 0.25x goes to 0.25x (which is 0.9 on the slider)
            else
                _this.zoomSlider.setValue(-(_this.zoomCoefficient - 1)*0.9);     // +0.25x
        });
        this.__zoom['out'].observe('click', function(event) {
            if (_this.zoomCoefficient <= 0.25)
                _this.zoomSlider.setValue(1);     // zoom out from 0.25x goes to the final slider position
            else
                _this.zoomSlider.setValue(-(_this.zoomCoefficient - 1.5)*0.9);   // -0.25x
        });
        // Insert all controls in the document
        this.getWorkArea().insert(this.__controls);
    }
});
