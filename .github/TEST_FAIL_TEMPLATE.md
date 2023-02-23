---
title: "{{ env.TITLE }}"
labels: [bug]
---
<!-- Based on
https://github.com/pymmcore-plus/pymmcore-widgets/blob/5e233384e223ca00101ef4b741d3c525a5cff9c9/.github/TEST_FAIL_TEMPLATE.md
-->
The {{ workflow }} workflow failed on {{ date | date("YYYY-MM-DD HH:mm") }} UTC

The most recent failing test was on {{ env.os }} py{{ env.PYTHON }}, matplotlib version
{{ env.mpl-version }}
with commit: {{ sha }}

Full run: https://github.com/matplotlib/ipympl/actions/runs/{{ env.RUN_ID }}

(This post will be updated if another test fails, as long as this issue remains open.)
