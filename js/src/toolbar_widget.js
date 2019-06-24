var widgets = require('@jupyter-widgets/base');
var _ = require('lodash');

var version = require('../package.json').version;

var ToolbarModel = widgets.DOMWidgetModel.extend({
    defaults: function() {
        return _.extend(widgets.DOMWidgetModel.prototype.defaults(), {
            _model_name: 'ToolbarModel',
            _view_name: 'ToolbarView',
            _model_module: 'jupyter-matplotlib',
            _view_module: 'jupyter-matplotlib',
            _model_module_version: '^'+ version,
            _view_module_version: '^' + version,
            figure_id: '',
            toolitems: []
        });
    }
});

var ToolbarView = widgets.DOMWidgetView.extend({
    render: function() {
        this.create_toolbar();

        this.el.appendChild(this.toolbar_container);
    },

    create_toolbar: function() {
        var toolbar_items = this.model.get('toolitems');

        this.toolbar_container = document.createElement('div');
        this.toolbar_container.classList = 'jupyter-widgets widget-container widget-box widget-hbox';

        this.toggle_button = document.createElement('button');
        this.toggle_button.classList = 'jupyter-widgets jupyter-button';
        this.toggle_button.setAttribute('href', '#');
        this.toggle_button.setAttribute('title', 'Toggle Interaction');
        this.toggle_button.setAttribute('style', 'outline:none');
        this.toggle_button.addEventListener('click', this.toggle_interaction.bind(this));

        var icon = document.createElement('i');
        icon.classList = 'fa fa-bars';
        this.toggle_button.appendChild(icon);

        this.toolbar_container.appendChild(this.toggle_button);

        this.toolbar = document.createElement('div');
        this.toolbar.classList = 'jupyter-widgets widget-container widget-box widget-hbox';
        this.toolbar_container.appendChild(this.toolbar);

        for(var toolbar_ind in toolbar_items) {
            var name = toolbar_items[toolbar_ind][0];
            var tooltip = toolbar_items[toolbar_ind][1];
            var image = toolbar_items[toolbar_ind][2];
            var method_name = toolbar_items[toolbar_ind][3];
            if (!name) { continue; };

            var button = document.createElement('button');
            button.classList = 'jupyter-widgets jupyter-button';
            button.setAttribute('href', '#');
            button.setAttribute('title', tooltip);
            button.setAttribute('style', 'outline:none');
            button.addEventListener('click', this.toolbar_button_onclick(method_name));

            var icon = document.createElement('i');
            icon.classList = 'fa fa-' + image;
            button.appendChild(icon);

            this.toolbar.appendChild(button);
        }
    },

    toolbar_button_onclick: function(name) {
        var figure_id = this.model.get('figure_id');
        var toolbar_widget = this;
        return function() {
            var message = {
                'type': 'toolbar_button',
                'figure_id': figure_id,
                'name': name
            };
            toolbar_widget.send(JSON.stringify(message));
        };
    },

    toggle_interaction: function() {
        // Toggle the interactivity of the figure.
        var visible = this.toolbar.style.display !== 'none';
        this.toolbar.style.display = visible ? 'none' : '';
    }
});

module.exports = {
    ToolbarModel: ToolbarModel,
    ToolbarView: ToolbarView
}
