import * as os from 'os';

interface CpuSnapshot {
  total: number;
  idle: number;
}

function snapshotCpu(): CpuSnapshot {
  let total = 0;
  let idle = 0;
  for (const cpu of os.cpus()) {
    const t = cpu.times;
    total += t.user + t.nice + t.sys + t.idle + t.irq;
    idle += t.idle;
  }
  return { total, idle };
}

// `os.loadavg()` is not CPU%: it counts runnable + uninterruptible-I/O tasks
// over 1/5/15-minute windows and routinely exceeds core count. This samples
// libuv-aggregated tick counters across two points and returns the non-idle
// fraction — the same approach `top` and `htop` use.
export async function getCpuUsagePercent(intervalMs = 100): Promise<number> {
  const a = snapshotCpu();
  await new Promise<void>((resolve) => { setTimeout(resolve, intervalMs); });
  const b = snapshotCpu();
  const totalDelta = b.total - a.total;
  const idleDelta = b.idle - a.idle;
  if (totalDelta <= 0) return 0;
  const usage = ((totalDelta - idleDelta) / totalDelta) * 100;
  return Math.max(0, Math.min(100, usage));
}

// Current process CPU usage as a 0–100 percentage normalized across cores
// (a fully busy single thread on a 10-core box reports 10, not 100).
export async function getProcessCpuPercent(intervalMs = 100): Promise<number> {
  const startCpu = process.cpuUsage();
  const startWall = process.hrtime.bigint();
  await new Promise<void>((resolve) => { setTimeout(resolve, intervalMs); });
  const cpuDelta = process.cpuUsage(startCpu);
  const wallNs = process.hrtime.bigint() - startWall;
  const wallMicros = Number(wallNs) / 1000;
  const cores = os.cpus().length;
  if (wallMicros <= 0 || cores <= 0) return 0;
  const usage = ((cpuDelta.user + cpuDelta.system) / (wallMicros * cores)) * 100;
  return Math.max(0, Math.min(100, usage));
}
