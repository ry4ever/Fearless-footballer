import { PrismaClient } from "@prisma/client";

interface HealthCheckResult {
  status: "ok" | "degraded" | "unhealthy";
  timestamp: string;
  uptimeSeconds: number;
  database: {
    connected: boolean;
    latencyMs?: number;
    error?: string;
  };
  memory: {
    rssMb: number;
    heapUsedMb: number;
    heapTotalMb: number;
  };
}

class MonitoringService {
  private startTime = Date.now();

  public async getReadiness(prisma: PrismaClient): Promise<HealthCheckResult> {
    const start = Date.now();
    let dbConnected = false;
    let dbLatency: number | undefined;
    let dbError: string | undefined;

    try {
      // Execute lightweight raw query to test database connectivity & pool latency
      await prisma.$queryRaw`SELECT 1`;
      dbLatency = Date.now() - start;
      dbConnected = true;
    } catch (err: any) {
      dbConnected = false;
      dbError = err.message || "Database connection failed";
    }

    const memoryUsage = process.memoryUsage();
    const isHealthy = dbConnected;

    return {
      status: isHealthy ? "ok" : "unhealthy",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      database: {
        connected: dbConnected,
        latencyMs: dbLatency,
        error: dbError,
      },
      memory: {
        rssMb: Math.round((memoryUsage.rss / 1024 / 1024) * 100) / 100,
        heapUsedMb: Math.round((memoryUsage.heapUsed / 1024 / 1024) * 100) / 100,
        heapTotalMb: Math.round((memoryUsage.heapTotal / 1024 / 1024) * 100) / 100,
      },
    };
  }

  public getLiveness() {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }
}

export const monitoring = new MonitoringService();
