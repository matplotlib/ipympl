from tempfile import mkdtemp

c.ServerApp.port = 8888  # noqa
c.ServerApp.token = ""  # noqa
c.ServerApp.password = ""  # noqa
c.ServerApp.disable_check_xsrf = True  # noqa
c.ServerApp.open_browser = False  # noqa
c.ServerApp.root_dir = mkdtemp(prefix='galata-test-')  # noqa

c.LabApp.expose_app_in_browser = True  # noqa
