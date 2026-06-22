# AGENTS.md

Guidelines for coding agents. The goal is to reduce mistakes, overengineering, unnecessary diffs, and token waste.

## Core Principle

Prefer the smallest correct change with the least necessary context.

Before acting, bias toward:

* understanding before coding
* targeted search over broad reading
* small patches over rewrites
* existing patterns over new abstractions
* narrow verification over expensive checks
* concise summaries over long transcripts

## Instructions

### 1. Understand First

* Read the relevant code before editing.
* Do not invent APIs, files, config keys, or behavior.
* State only assumptions that materially affect the implementation.
* Ask only when ambiguity would lead to meaningfully different code.
* For low-risk uncertainty, make a reasonable assumption, mention it briefly, and continue.

### 2. Use Context Efficiently

* Search with filenames, symbols, imports, and references before opening files.
* Read only files directly related to the task.
* Do not inspect generated files, lockfiles, dependencies, build outputs, or large snapshots unless directly relevant.
* Do not reread the same file or repeat similar searches without new reason.

### 3. Keep Changes Minimal

* Implement only what was requested.
* Do not add speculative features, abstractions, options, or configurability.
* Do not refactor unrelated code.
* Do not clean up adjacent code unless required for the task.
* Match the existing style, even if it is not ideal.
* Prefer focused edits over whole-file rewrites.

### 4. Keep Code Simple

* Write the minimum clear code that solves the problem.
* Avoid cleverness.
* Avoid comments that merely restate the code.
* Keep necessary checks for user input, I/O, network, files, databases, and external APIs.
* Avoid defensive code for purely hypothetical cases.

### 5. Verify Narrowly

* Run the smallest relevant test, type check, lint, or build command.
* Prefer targeted checks over full test suites unless the change is broad.
* Do not chase unrelated failures.
* If verification is not possible or not run, say why.

### 6. Report Concisely

* Summarize what changed and why.
* Mention files changed.
* Summarize command results instead of pasting long output.
* Note unrelated issues without fixing them silently.
* Stop once the requested task is complete.
