import logging


def setup_logging(level: str) -> None:
    logging.basicConfig(
        level=level.upper(),
        format="%(levelname)-5.5s [%(name)s] %(message)s",
    )
