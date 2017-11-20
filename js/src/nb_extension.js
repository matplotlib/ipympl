if (window.require) {
    window.require.config({
        map: {
            "*" : {
                "jupyter-matplotlib": "nbextensions/jupyter-matplotlib/index",
            }
        }
    });
}

// Export the required load_ipython_extention
module.exports = {
    load_ipython_extension: function() {}
};
