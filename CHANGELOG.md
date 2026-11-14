# Changelog

All notable changes to this project are listed here, newest first.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- `carryover --version` prints the version.
- Tests for negation words and month names, translation memory files (TMX and TSV), and the HTML report and its escaping.

## [0.1.0] - 2026-10-06

First version. It checks that every number, date, amount and name in a text survives translation.

- Also checks measurements, scale words such as million and Mio., lost negations, and whole translation memory files.
- A one-page HTML report you can send to a translator (`--html`).
- A test set of planted errors in several languages, including Italian and Dutch.
