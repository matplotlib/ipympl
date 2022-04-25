import { DOMWidgetModel, DOMWidgetView } from '@jupyter-widgets/base';

import { MODULE_VERSION } from './version';

import '../css/mpl_widget.css';

export class ToolbarModel extends DOMWidgetModel {
    defaults() {
        return {
            ...super.defaults(),
            _model_name: 'ToolbarModel',
            _view_name: 'ToolbarView',
            _model_module: 'jupyter-matplotlib',
            _view_module: 'jupyter-matplotlib',
            _model_module_version: '^' + MODULE_VERSION,
            _view_module_version: '^' + MODULE_VERSION,
            toolitems: [],
            position: 'left',
            button_style: '',
            _current_action: '',
        };
    }
}

export class ToolbarView extends DOMWidgetView {
    toolbar: HTMLDivElement;
    buttons: { [index: string]: HTMLButtonElement };
    visibility: 'visible' | 'hidden' | 'fade-in-fade-out' = 'fade-in-fade-out';

    initialize(parameters: any) {
        super.initialize(parameters);

        this.on('comm_live_update', this.update_disabled.bind(this));
    }

    render(): void {
        this.el.classList.add(
            'jupyter-widgets',
            'jupyter-matplotlib-toolbar',
            'widget-container',
            'widget-box'
        );

        // Fade-in/fade-out mode by default, the figure will decide
        this.set_visibility('fade-in-fade-out');

        this.create_toolbar();
        this.model_events();
    }

    create_toolbar(): void {
        const toolbar_items = this.model.get('toolitems');

        this.toolbar = document.createElement('div');
        this.toolbar.classList.add('widget-container', 'widget-box');
        this.el.appendChild(this.toolbar);
        this.buttons = {};

        for (const toolbar_ind in toolbar_items) {
            const name = toolbar_items[toolbar_ind][0];
            const tooltip = toolbar_items[toolbar_ind][1];
            const image = toolbar_items[toolbar_ind][2];
            const method_name = toolbar_items[toolbar_ind][3];
            if (!name) {
                continue;
            }

            const button = document.createElement('button');
            button.classList.add(
                'jupyter-matplotlib-button',
                'jupyter-widgets',
                'jupyter-button'
            );
            button.setAttribute('href', '#');
            button.setAttribute('title', tooltip);
            button.style.outline = 'none';
            button.addEventListener(
                'click',
                this.toolbar_button_onclick(method_name)
            );

            const icon = document.createElement('i');
            icon.classList.add('center', 'fa', 'fa-fw', 'fa-' + image);
            button.appendChild(icon);

            this.buttons[method_name] = button;

            this.toolbar.appendChild(button);
        }

        this.set_position();
        this.set_buttons_style();

        this.update_disabled();
    }

    get disabled(): boolean {
        return !this.model.comm_live;
    }

    update_disabled(): void {
        // Disable buttons
        if (this.disabled) {
            this.toolbar.style.display = 'none';
        }
    }

    set_position(): void {
        const position = this.model.get('position');
        if (position === 'left' || position === 'right') {
            this.el.classList.remove('widget-hbox');
            this.el.classList.add('widget-vbox');
            this.toolbar.classList.remove('widget-hbox');
            this.toolbar.classList.add('widget-vbox');

            this.el.style.top = '3px';
            this.el.style.bottom = 'auto';

            if (position === 'left') {
                this.el.style.left = '3px';
                this.el.style.right = 'auto';
            } else {
                this.el.style.left = 'auto';
                this.el.style.right = '3px';
            }
        } else {
            this.el.classList.add('widget-hbox');
            this.el.classList.remove('widget-vbox');
            this.toolbar.classList.add('widget-hbox');
            this.toolbar.classList.remove('widget-vbox');

            this.el.style.right = '3px';
            this.el.style.left = 'auto';

            if (position === 'top') {
                this.el.style.top = '3px';
                this.el.style.bottom = 'auto';
            } else {
                this.el.style.top = 'auto';
                this.el.style.bottom = '3px';
            }
        }
    }

    toolbar_button_onclick(name: string) {
        return (_event: Event): void => {
            // Special case for pan and zoom as they are toggle buttons
            if (name === 'pan' || name === 'zoom') {
                if (this.model.get('_current_action') === name) {
                    this.model.set('_current_action', '');
                } else {
                    this.model.set('_current_action', name);
                }
                this.model.save_changes();
            }

            this.send({
                type: 'toolbar_button',
                name: name,
            });
        };
    }

    set_visibility(
        value: 'visible' | 'hidden' | 'fade-in-fade-out' | boolean
    ): void {
        // For backward compatibility with the old API
        if (typeof value === 'boolean') {
            value = value ? 'visible' : 'hidden';
        }

        this.visibility = value;

        if (value === 'fade-in-fade-out') {
            this.el.classList.add('jupyter-matplotlib-toolbar-fadein-fadeout');

            // Hide it by default
            this.el.style.visibility = 'hidden';
            this.el.style.opacity = '0';
            return;
        }

        this.el.classList.remove('jupyter-matplotlib-toolbar-fadein-fadeout');

        // Always visible
        if (value === 'visible') {
            this.el.style.visibility = 'visible';
            this.el.style.opacity = '1';
            return;
        }

        // Always hidden
        this.el.style.visibility = 'hidden';
        this.el.style.opacity = '0';
    }

    fade_in(): void {
        // This is a no-op if we are not in fade-in/fade-out mode
        if (this.visibility !== 'fade-in-fade-out') {
            return;
        }

        this.el.style.visibility = 'visible';
        this.el.style.opacity = '1';
    }

    fade_out(): void {
        // This is a no-op if we are not in fade-in/fade-out mode
        if (this.visibility !== 'fade-in-fade-out') {
            return;
        }

        this.el.style.visibility = 'hidden';
        this.el.style.opacity = '0';
    }

    set_buttons_style(): void {
        const class_map: { [index: string]: any } = {
            primary: ['mod-primary'],
            success: ['mod-success'],
            info: ['mod-info'],
            warning: ['mod-warning'],
            danger: ['mod-danger'],
        };

        for (const name in this.buttons) {
            const button = this.buttons[name];

            for (const class_name in class_map) {
                button.classList.remove(class_map[class_name]);
            }
            button.classList.remove('mod-active');

            const class_name = this.model.get('button_style');
            if (class_name !== '') {
                button.classList.add(class_map[class_name]);
            }

            if (name === this.model.get('_current_action')) {
                button.classList.add('mod-active');
            }
        }
    }

    model_events(): void {
        this.model.on('change:position', this.set_position.bind(this));
        this.model.on_some_change(
            ['button_style', '_current_action'],
            this.set_buttons_style,
            this
        );
    }
}
