import os
import yaml

_config = None


def get_config() -> dict:
    """Load and return config.yaml from the project root as a dict."""
    global _config
    if _config is None:
        config_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "config.yaml",
        )
        with open(config_path, "r") as f:
            _config = yaml.safe_load(f)
    return _config
