#!/usr/bin/env python3
import json
import math
import re
import shutil
import statistics
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent


def find_repo_root(start_dir):
    current = start_dir
    while True:
        if (current / 'package.json').exists():
            return current
        if current.parent == current:
            raise RuntimeError('Could not locate repository root (package.json not found)')
        current = current.parent


ROOT = find_repo_root(SCRIPT_DIR)
V15_DIR = ROOT
V10_DIR = Path('/tmp/inferential-stats-js-v10')
RUNS = 30

BENCHMARK_MARKER = '__INFERENTIAL_BENCHMARK_JSON__'
DURATION_RE = re.compile(r'Duration\s+([0-9.]+)s')

BENCHMARK_FILES = [
    (
        SCRIPT_DIR / 'config' / 'e2e' / 'inferential-stats.benchmark.test.ts',
        Path('e2e/inferential-stats.benchmark.test.ts'),
    ),
    (
        SCRIPT_DIR / 'config' / 'vitest.benchmark.config.ts',
        Path('vitest.benchmark.config.ts'),
    ),
]


def run_command(command, cwd):
    proc = subprocess.run(command, cwd=cwd, capture_output=True, text=True)
    return proc.returncode, proc.stdout, proc.stderr


def process_tree_rss_kb(root_pid):
    try:
        output = subprocess.check_output(['ps', '-eo', 'pid=,ppid=,rss='], text=True)
    except subprocess.CalledProcessError:
        return 0

    children = {}
    rss_by_pid = {}

    for raw_line in output.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        parts = line.split()
        if len(parts) != 3:
            continue
        pid = int(parts[0])
        ppid = int(parts[1])
        rss = int(parts[2])
        rss_by_pid[pid] = rss
        children.setdefault(ppid, []).append(pid)

    stack = [root_pid]
    visited = set()
    total = 0

    while stack:
        pid = stack.pop()
        if pid in visited:
            continue
        visited.add(pid)
        total += rss_by_pid.get(pid, 0)
        stack.extend(children.get(pid, []))

    return total


def ensure_benchmark_files(version_dir):
    for source, destination_rel_path in BENCHMARK_FILES:
        destination = version_dir / destination_rel_path
        if source.resolve() == destination.resolve():
            continue
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, destination)


def ensure_build(version_name, cwd):
    print(f'[{version_name}] build start')
    code, out, err = run_command(['npm', 'run', 'build'], cwd)
    if code != 0:
        raise RuntimeError(f'Build failed for {version_name}\nSTDOUT:\n{out}\nSTDERR:\n{err}')
    print(f'[{version_name}] build done')


def compute_stats(values):
    if not values:
        return {
            'count': 0,
            'mean': None,
            'stddev': None,
            'ci95_low': None,
            'ci95_high': None,
            'min': None,
            'max': None,
        }

    mean = statistics.mean(values)
    if len(values) > 1:
        stddev = statistics.stdev(values)
        margin = 1.96 * (stddev / math.sqrt(len(values)))
    else:
        stddev = 0.0
        margin = 0.0

    return {
        'count': len(values),
        'mean': round(mean, 3),
        'stddev': round(stddev, 3),
        'ci95_low': round(mean - margin, 3),
        'ci95_high': round(mean + margin, 3),
        'min': round(min(values), 3),
        'max': round(max(values), 3),
    }


def parse_benchmark_payload(combined_output, version_name, run_index):
    for line in combined_output.splitlines():
        marker_index = line.find(BENCHMARK_MARKER)
        if marker_index >= 0:
            payload_text = line[marker_index + len(BENCHMARK_MARKER):]
            return json.loads(payload_text)

    raise RuntimeError(
        f'Could not find benchmark marker in output for {version_name} run {run_index + 1}'
    )


def run_single(version_name, cwd, run_index):
    command = [
        'npx',
        'vitest',
        'run',
        '--config',
        'vitest.benchmark.config.ts',
        '--reporter',
        'verbose',
    ]

    started = time.perf_counter()
    proc = subprocess.Popen(command, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    peak_rss_kb = 0

    while proc.poll() is None:
        peak_rss_kb = max(peak_rss_kb, process_tree_rss_kb(proc.pid))
        time.sleep(0.1)

    out, err = proc.communicate()
    peak_rss_kb = max(peak_rss_kb, process_tree_rss_kb(proc.pid))
    elapsed = time.perf_counter() - started
    code = proc.returncode

    if code != 0:
        raise RuntimeError(
            f'E2E failed for {version_name} run {run_index + 1}\n'
            f'STDOUT:\n{out}\nSTDERR:\n{err}'
        )

    combined = f'{out}\n{err}'
    duration_sec = None
    duration_match = DURATION_RE.search(combined)
    if duration_match:
        duration_sec = float(duration_match.group(1))

    benchmark_payload = parse_benchmark_payload(combined, version_name, run_index)

    return {
        'run': run_index + 1,
        'wall_time_sec': round(elapsed, 3),
        'max_rss_kb': peak_rss_kb,
        'vitest_duration_sec': duration_sec,
        'total_execution_time_ms': round(float(benchmark_payload['totalExecutionTimeMs']), 3),
        'function_timings_ms': {
            key: round(float(value), 3)
            for key, value in benchmark_payload['functionTimingsMs'].items()
        },
    }


def summarize(version_name, runs):
    wall = [r['wall_time_sec'] for r in runs]
    rss_mb = [r['max_rss_kb'] / 1024 for r in runs]
    durations = [r['vitest_duration_sec'] for r in runs if r['vitest_duration_sec'] is not None]
    total_exec_ms = [r['total_execution_time_ms'] for r in runs]

    function_names = sorted({name for run in runs for name in run['function_timings_ms'].keys()})
    per_function = {}

    for name in function_names:
        values = [run['function_timings_ms'][name] for run in runs if name in run['function_timings_ms']]
        per_function[name] = compute_stats(values)

    return {
        'version': version_name,
        'runs': runs,
        'summary': {
            'total_wall_time_sec': round(sum(wall), 3),
            'wall_time_stats_sec': compute_stats(wall),
            'max_rss_stats_mb': compute_stats(rss_mb),
            'vitest_duration_stats_sec': compute_stats(durations),
            'total_execution_time_stats_ms': compute_stats(total_exec_ms),
            'function_execution_stats_ms': per_function,
        },
    }


def pct_change(old, new):
    if old in (None, 0) or new is None:
        return None
    return round(((new - old) / old) * 100, 3)


def write_markdown(report):
    v10 = report['results']['v10']
    v15 = report['results']['v15']

    def mean(summary, key):
        value = summary[key]['mean']
        return value

    v10_summary = v10['summary']
    v15_summary = v15['summary']

    overall_rows = [
        (
            'Total wall time (30 runs, s)',
            v10_summary['total_wall_time_sec'],
            v15_summary['total_wall_time_sec'],
            pct_change(v10_summary['total_wall_time_sec'], v15_summary['total_wall_time_sec']),
        ),
        (
            'Mean wall time (s)',
            mean(v10_summary, 'wall_time_stats_sec'),
            mean(v15_summary, 'wall_time_stats_sec'),
            pct_change(mean(v10_summary, 'wall_time_stats_sec'), mean(v15_summary, 'wall_time_stats_sec')),
        ),
        (
            'Mean max RSS (MB)',
            mean(v10_summary, 'max_rss_stats_mb'),
            mean(v15_summary, 'max_rss_stats_mb'),
            pct_change(mean(v10_summary, 'max_rss_stats_mb'), mean(v15_summary, 'max_rss_stats_mb')),
        ),
        (
            'Mean vitest duration (s)',
            mean(v10_summary, 'vitest_duration_stats_sec'),
            mean(v15_summary, 'vitest_duration_stats_sec'),
            pct_change(mean(v10_summary, 'vitest_duration_stats_sec'), mean(v15_summary, 'vitest_duration_stats_sec')),
        ),
        (
            'Mean total 16-function execution (ms)',
            mean(v10_summary, 'total_execution_time_stats_ms'),
            mean(v15_summary, 'total_execution_time_stats_ms'),
            pct_change(
                mean(v10_summary, 'total_execution_time_stats_ms'),
                mean(v15_summary, 'total_execution_time_stats_ms'),
            ),
        ),
    ]

    function_names = sorted(v10_summary['function_execution_stats_ms'].keys())
    lines = [
        '# E2E Benchmark: v10 vs v15 (30 runs)',
        '',
        f"- Timestamp (UTC): {report['timestamp_utc']}",
        f"- Runs per version: {report['runs_per_version']}",
        '- Test command: `npx vitest run --config vitest.benchmark.config.ts --reporter verbose`',
        '- Metrics: wall time (Python timer), max RSS (process-tree sampling), vitest duration, per-function execution time',
        '',
        '## Overall',
        '',
        '| Metric | v10 | v15 | Delta % (v15 vs v10) |',
        '|---|---:|---:|---:|',
    ]

    for metric, v10_value, v15_value, delta in overall_rows:
        lines.append(f'| {metric} | {v10_value} | {v15_value} | {delta} |')

    lines.extend([
        '',
        '## Distribution Stats (95% CI)',
        '',
        '| Metric | Version | Mean | StdDev | 95% CI Low | 95% CI High | Min | Max |',
        '|---|---|---:|---:|---:|---:|---:|---:|',
    ])

    dist_specs = [
        ('Wall Time (s)', 'wall_time_stats_sec'),
        ('Max RSS (MB)', 'max_rss_stats_mb'),
        ('Vitest Duration (s)', 'vitest_duration_stats_sec'),
        ('Total 16-Function Execution (ms)', 'total_execution_time_stats_ms'),
    ]

    for label, key in dist_specs:
        for version_name, summary in [('v10', v10_summary), ('v15', v15_summary)]:
            stats = summary[key]
            lines.append(
                f"| {label} | {version_name} | {stats['mean']} | {stats['stddev']} | {stats['ci95_low']} | {stats['ci95_high']} | {stats['min']} | {stats['max']} |"
            )

    lines.extend([
        '',
        '## Per-Function Mean Execution Time (ms)',
        '',
        '| Function | v10 mean | v15 mean | Delta % (v15 vs v10) | v10 stddev | v15 stddev |',
        '|---|---:|---:|---:|---:|---:|',
    ])

    for name in function_names:
        a = v10_summary['function_execution_stats_ms'][name]
        b = v15_summary['function_execution_stats_ms'][name]
        delta = pct_change(a['mean'], b['mean'])
        lines.append(
            f"| {name} | {a['mean']} | {b['mean']} | {delta} | {a['stddev']} | {b['stddev']} |"
        )

    return '\n'.join(lines) + '\n'


def main():
    if not V10_DIR.exists():
        raise RuntimeError(f'v10 directory not found: {V10_DIR}')

    ensure_benchmark_files(V15_DIR)
    ensure_benchmark_files(V10_DIR)

    ensure_build('v10', V10_DIR)
    ensure_build('v15', V15_DIR)

    v10_runs = []
    v15_runs = []

    for i in range(RUNS):
        print(f'[v10] run {i + 1}/{RUNS}')
        v10_runs.append(run_single('v10', V10_DIR, i))

    for i in range(RUNS):
        print(f'[v15] run {i + 1}/{RUNS}')
        v15_runs.append(run_single('v15', V15_DIR, i))

    report = {
        'timestamp_utc': datetime.now(timezone.utc).isoformat(),
        'runs_per_version': RUNS,
        'results': {
            'v10': summarize('v10', v10_runs),
            'v15': summarize('v15', v15_runs),
        },
    }

    output_dir = SCRIPT_DIR / 'benchmarks'
    output_dir.mkdir(parents=True, exist_ok=True)

    json_path = output_dir / 'e2e-v10-v15-benchmark-30runs.json'
    md_path = output_dir / 'e2e-v10-v15-benchmark-30runs.md'
    json_path.write_text(json.dumps(report, indent=2), encoding='utf-8')
    md_path.write_text(write_markdown(report), encoding='utf-8')

    print(f'Wrote {json_path}')
    print(f'Wrote {md_path}')


if __name__ == '__main__':
    main()
