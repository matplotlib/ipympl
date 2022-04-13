version_info = (0, 8, 8)
__version__ = '.'.join(map(str, version_info))


# The versions of protocol of communication with the frontend that this python verison knows
# how to speak. See counterpart in the src/version.ts file.
# These should not be changed unless we introduce changes to communication between
# frontend and backend.
__MODEL_VERSION__ = "1.0.0"
