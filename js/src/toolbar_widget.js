const widgets = require('@jupyter-widgets/base');

const version = require('../package.json').version;


export
class ToolbarModel extends widgets.DOMWidgetModel {
    defaults() {
        return {
            ...super.defaults(),
            _model_name: 'ToolbarModel',
            _view_name: 'ToolbarView',
            _model_module: 'jupyter-matplotlib',
            _view_module: 'jupyter-matplotlib',
            _model_module_version: '^'+ version,
            _view_module_version: '^' + version,
            toolitems: [],
            orientation: 'vertical',
            button_style: '',
            collapsed: true,
            _current_action: '',
        };
    }
}


export
class ToolbarView extends widgets.DOMWidgetView {
    render() {
        this.el.classList = 'jupyter-widgets jupyter-matplotlib-toolbar';
        this.el.classList.add('widget-container', 'widget-box');

        this.create_toolbar();
        this.model_events();
    }

    create_toolbar() {
        const toolbar_items = this.model.get('toolitems');

        this.toggle_button = document.createElement('button');

        this.toggle_button.classList = 'jupyter-matplotlib-button jupyter-widgets jupyter-button';
        this.toggle_button.setAttribute('href', '#');
        this.toggle_button.setAttribute('title', 'Toggle Interaction');
        this.toggle_button.style.outline = 'none';
        this.toggle_button.addEventListener('click', () => {
            this.model.set('collapsed', !this.model.get('collapsed'));
            this.model.save_changes();
        });

        const icon = document.createElement('i');
        icon.classList = 'center fa fa-bars';
        this.toggle_button.appendChild(icon);

        this.el.appendChild(this.toggle_button);
        this.toolbar = document.createElement('div');
        this.toolbar.classList = 'widget-container widget-box';
        this.el.appendChild(this.toolbar);
        this.buttons = {'toggle_button': this.toggle_button};

        for(let toolbar_ind in toolbar_items) {
            const name = toolbar_items[toolbar_ind][0];
            const tooltip = toolbar_items[toolbar_ind][1];
            const image = toolbar_items[toolbar_ind][2];
            const method_name = toolbar_items[toolbar_ind][3];
            if (!name) { continue; };

            const button = document.createElement('button');
            button.classList = 'jupyter-matplotlib-button jupyter-widgets jupyter-button';
            button.setAttribute('href', '#');
            button.setAttribute('title', tooltip);
            button.style.outline = 'none';
            button.addEventListener('click', this.toolbar_button_onclick(method_name));

            const icon = document.createElement('i');
            icon.classList = 'center fa fa-' + image;
            button.appendChild(icon);

            this.buttons[method_name] = button;

            this.toolbar.appendChild(button);
        }

        this.set_orientation(this.el);
        this.set_orientation(this.toolbar);
        this.set_buttons_style();
    }

    set_orientation(el) {
        const orientation = this.model.get('orientation');
        if (orientation == 'vertical') {
            el.classList.remove('widget-hbox');
            el.classList.add('widget-vbox');
        } else {
            el.classList.add('widget-hbox');
            el.classList.remove('widget-vbox');
        }
    }

    toolbar_button_onclick(name) {
        return (event) => {
            // Special case for pan and zoom as they are toggle buttons
            if (name == 'pan' || name == 'zoom') {
                if (this.model.get('_current_action') == name) {
                    this.model.set('_current_action', '');
                }
                else {
                    this.model.set('_current_action', name);
                }
                this.model.save_changes();
            }

            this.send({
                'type': 'toolbar_button',
                'name': name
            });
        };
    }

    set_buttons_style() {
        const class_map = {
            primary: ['mod-primary'],
            success: ['mod-success'],
            info: ['mod-info'],
            warning: ['mod-warning'],
            danger: ['mod-danger']
        };

        for (let name in this.buttons) {
            const button = this.buttons[name];

            for (let class_name in class_map) {
                button.classList.remove(class_map[class_name]);
            }
            button.classList.remove('mod-active');

            const class_name = this.model.get('button_style');
            if (class_name != '') {
                button.classList.add(class_map[class_name]);
            }

            if (name == this.model.get('_current_action')) {
                button.classList.add('mod-active');
            }
        }
    }

    update_collapsed() {
        this.toolbar.style.display = this.model.get('collapsed') ? '' : 'none';
    }

    model_events() {
        this.model.on('change:orientation', this.update_orientation.bind(this));
        this.model.on_some_change(['button_style', '_current_action'], this.set_buttons_style.bind(this));
        this.model.on('change:collapsed', this.update_collapsed.bind(this));
    }

    update_orientation() {
        this.set_orientation(this.el);
        this.set_orientation(this.toolbar);
    }
}
