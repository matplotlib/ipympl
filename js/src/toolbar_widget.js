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
            toolitems: [],
            orientation: 'vertical',
            button_style: '',
            _current_action: '',
        });
    }
});

var ToolbarView = widgets.DOMWidgetView.extend({
    render: function() {
        this.el.classList = 'jupyter-widgets jupyter-matplotlib-toolbar';
        this.el.classList.add('widget-container', 'widget-box');
        this.create_toolbar();
        this.model_events();
    },

    create_toolbar: function() {
        var toolbar_items = this.model.get('toolitems');

        this.toggle_button = document.createElement('button');

        this.toggle_button.classList = 'jupyter-matplotlib-button jupyter-widgets jupyter-button';
        this.toggle_button.setAttribute('href', '#');
        this.toggle_button.setAttribute('title', 'Toggle Interaction');
        this.toggle_button.style.outline = 'none';
        this.toggle_button.addEventListener('click', this.toggle_interaction.bind(this));

        var icon = document.createElement('i');
        icon.classList = 'center fa fa-bars';
        this.toggle_button.appendChild(icon);

        this.el.appendChild(this.toggle_button);
        this.toolbar = document.createElement('div');
        this.toolbar.classList = 'widget-container widget-box';
        this.el.appendChild(this.toolbar);
        this.buttons = {'toggle_button': this.toggle_button};

        for(var toolbar_ind in toolbar_items) {
            var name = toolbar_items[toolbar_ind][0];
            var tooltip = toolbar_items[toolbar_ind][1];
            var image = toolbar_items[toolbar_ind][2];
            var method_name = toolbar_items[toolbar_ind][3];
            if (!name) { continue; };

            var button = document.createElement('button');
            button.classList = 'jupyter-matplotlib-button jupyter-widgets jupyter-button';
            button.setAttribute('href', '#');
            button.setAttribute('title', tooltip);
            button.style.outline = 'none';
            button.addEventListener('click', this.toolbar_button_onclick(method_name));

            var icon = document.createElement('i');
            icon.classList = 'center fa fa-' + image;
            button.appendChild(icon);

            this.buttons[method_name] = button;

            this.toolbar.appendChild(button);
        }

        this.set_orientation(this.el);
        this.set_orientation(this.toolbar);
        this.set_buttons_style();
    },

    set_orientation: function(el) {
        var orientation = this.model.get('orientation');
        if (orientation == 'vertical') {
            el.classList.remove('widget-hbox');
            el.classList.add('widget-vbox');
        } else {
            el.classList.add('widget-hbox');
            el.classList.remove('widget-vbox');
        }
    },

    toolbar_button_onclick: function(name) {
        var that = this;

        return function(event) {
            // Special case for pan and zoom as they are toggle buttons
            if (name == 'pan' || name == 'zoom') {
                if (that.model.get('_current_action') == name) {
                    that.model.set('_current_action', '');
                }
                else {
                    that.model.set('_current_action', name);
                }
                that.model.save_changes();
            }

            var message = {
                'type': 'toolbar_button',
                'name': name
            };

            that.send(message);
        };
    },

    set_buttons_style: function() {
        var class_map = {
            primary: ['mod-primary'],
            success: ['mod-success'],
            info: ['mod-info'],
            warning: ['mod-warning'],
            danger: ['mod-danger']
        };

        for (var name in this.buttons) {
            var button = this.buttons[name];

            for (var class_name in class_map) {
                button.classList.remove(class_map[class_name]);
            }
            button.classList.remove('mod-active');

            var class_name = this.model.get('button_style');
            if (class_name != '') {
                button.classList.add(class_map[class_name]);
            }

            if (name == this.model.get('_current_action')) {
                button.classList.add('mod-active');
            }
        }
    },

    toggle_interaction: function() {
        // Toggle the interactivity of the figure.
        var visible = this.toolbar.style.display !== 'none';
        this.toolbar.style.display = visible ? 'none' : '';
    },

    model_events: function() {
        this.model.on('change:orientation', this.update_orientation.bind(this));
        this.model.on_some_change(['button_style', '_current_action'], this.set_buttons_style.bind(this));
    },

    update_orientation: function() {
        this.set_orientation(this.el);
        this.set_orientation(this.toolbar);
    }
});

module.exports = {
    ToolbarModel: ToolbarModel,
    ToolbarView: ToolbarView
}
