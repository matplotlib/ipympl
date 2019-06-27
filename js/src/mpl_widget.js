var widgets = require('@jupyter-widgets/base');
var _ = require('lodash');
var toolbar = require('./toolbar_widget.js');
var mpl = require('./mpl.js');

var version = require('../package.json').version;

var MPLCanvasModel = widgets.DOMWidgetModel.extend({
    defaults: function() {
        return _.extend(widgets.DOMWidgetModel.prototype.defaults(), {
            _model_name: 'MPLCanvasModel',
            _view_name: 'MPLCanvasView',
            _model_module: 'jupyter-matplotlib',
            _view_module: 'jupyter-matplotlib',
            _model_module_version: '^'+ version,
            _view_module_version: '^' + version,
            toolbar: null,
            toolbar_visible: true,
            toolbar_position: 'horizontal'
        });
    }
}, {
    serializers: _.extend({
        toolbar: { deserialize: widgets.unpack_models }
    }, widgets.DOMWidgetModel.serializers)
});

var MPLCanvasView = widgets.DOMWidgetView.extend({
    render: function() {
        var id = this.model.get('id');
        var that = this;

        this.create_child_view(this.model.get('toolbar')).then(function(toolbar_view) {
            that.toolbar_view = toolbar_view;
            that.fig = new mpl.figure(id, that);

            that.update_toolbar_position();

            that.model_events();
        });
    },

    model_events: function() {
        this.model.on('change:toolbar_visible', this.update_toolbar_visible.bind(this));
        this.model.on('change:toolbar_position', this.update_toolbar_position.bind(this));
    },

    update_toolbar_visible: function() {
        this.toolbar_view.el.style.display = this.model.get('toolbar_visible') ? '' : 'none';
    },

    update_toolbar_position: function() {
        var toolbar_position = this.model.get('toolbar_position');
        if (toolbar_position == 'top' || toolbar_position == 'bottom') {
            this.el.classList = 'jupyter-widgets widget-container widget-box widget-vbox';
            this.model.get('toolbar').set('orientation', 'horizontal');

            this.clear();

            if (toolbar_position == 'top') {
                this.el.appendChild(this.toolbar_view.el);
                this.el.appendChild(this.fig.root);
            } else {
                this.el.appendChild(this.fig.root);
                this.el.appendChild(this.toolbar_view.el);
            }
        } else {
            this.el.classList = 'jupyter-widgets widget-container widget-box widget-hbox';
            this.model.get('toolbar').set('orientation', 'vertical');

            this.clear();

            if (toolbar_position == 'left') {
                this.el.appendChild(this.toolbar_view.el);
                this.el.appendChild(this.fig.root);
            } else {
                this.el.appendChild(this.fig.root);
                this.el.appendChild(this.toolbar_view.el);
            }
        }
    },

    clear: function() {
        while (this.el.firstChild) {
            this.el.removeChild(this.el.firstChild);
        }
    }
});

module.exports = {
    MPLCanvasModel: MPLCanvasModel,
    MPLCanvasView: MPLCanvasView,
    ToolbarModel: toolbar.ToolbarModel,
    ToolbarView: toolbar.ToolbarView
}
