"""Structured logging configuration."""

import sys
from pathlib import Path
from loguru import logger

def setup_logger(log_file: str | None = None, level: str = "INFO"):
    """
    Configure loguru logger with console and file outputs.

    Args:
        log_file: Path to log file (optional)
        level: Log level (DEBUG, INFO, WARNING, ERROR)
    """
    # Remove default handler
    logger.remove()

    # Add console handler with colors
    logger.add(
        sys.stderr,
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan> - <level>{message}</level>",
        level=level,
        colorize=True
    )

    # Add file handler if specified
    if log_file:
        log_path = Path(log_file)
        log_path.parent.mkdir(parents=True, exist_ok=True)

        logger.add(
            log_file,
            format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function} - {message}",
            level=level,
            rotation="10 MB",  # Rotate after 10 MB
            retention="30 days",  # Keep logs for 30 days
            compression="zip"  # Compress rotated logs
        )

    return logger

# Default logger instance
log = setup_logger()
