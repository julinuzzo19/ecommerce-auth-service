import { Controller, Get } from "@nestjs/common";
import { HealthCheckService, HealthCheck } from "@nestjs/terminus";

/**
 * Controlador para health checks.
 */
@Controller("health")
export class HealthController {
  constructor(private health: HealthCheckService) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      // Aquí puedes agregar checks específicos, ej. para DB:
      // () => this.db.pingCheck('database'),
    ]);
  }
}
