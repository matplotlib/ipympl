def test_own_entry_points():
    from importlib_metadata import entry_points

    entries = entry_points(group="matplotlib.backend")
    for name in ["ipympl", "widget"]:
        assert name in entries.names
        entry = entries[name]
        assert entry.name == name
        assert entry.value == "ipympl.backend_nbagg"
        # Check can load module.
        entry.load()
