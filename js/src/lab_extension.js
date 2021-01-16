var jupyter_matplotlib = require('./index');

var base = require('@jupyter-widgets/base');

var notebook = require('@jupyterlab/notebook');

var onSave = function (context) {
    const cells = context.model.cells;
    const nCells = cells.length;
    for (i = 0; i < nCells; i++) {
        const cell = cells.get(i);

        if (cell.outputs && cell.outputs.length) {
            const nOutputs = cell.outputs.length;

            for (j = 0; j < nOutputs; j++) {
                const output = cell.outputs.get(j);
                // If the output is a widget
                if (output.data['application/vnd.jupyter.widget-view+json']) {
                    const ipymplModel = jupyter_matplotlib.MPLCanvasModel.registry[output.data['model_id']];

                    if (ipymplModel) {
                        const dataUrl = ipymplModel.offscreen_canvas.toDataURL();
                        output.data = {
                            'text/html': `<img src="${dataUrl}"/>`,
                            'text/plain': output.data['text/plain']
                        }
                    }
                }
            }
        }
    }
}

module.exports = {
    id: 'matplotlib-jupyter:main',
    requires: [base.IJupyterWidgetRegistry, notebook.INotebookTracker],
    activate: function (app, widgets, tracker) {
        tracker.forEach(panel => {
            panel.context.saveState.connect((sender, saveState) => {
                if (saveState === 'started') {
                    onSave(sender);
                }
            });
        });

        tracker.widgetAdded.connect((sender, panel) => {
            panel.context.saveState.connect((sender, saveState) => {
                if (saveState === 'started') {
                    onSave(sender);
                }
            });
        });

        widgets.registerWidget({
            name: 'jupyter-matplotlib',
            version: jupyter_matplotlib.version,
            exports: jupyter_matplotlib,
        });
    },
    autoStart: true,
};
